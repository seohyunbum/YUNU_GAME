import { describe, expect, it } from "vitest";

import {
  advancePhase,
  applyAction,
  autoPlayAi,
  createGame,
  getPlayerView,
  ROLE_COUNTS,
  STARTING_HP,
  type Character,
  type GameState,
} from "../../lib/game";

function byRole(state: GameState, roleId: Character["roleId"]): Character {
  const character = state.characters.find(
    (candidate) => candidate.roleId === roleId,
  );
  if (!character) {
    throw new Error(`Missing role: ${roleId}`);
  }
  return character;
}

function completeNight(
  source: GameState,
  killTargetId: string,
  convertTargetId: string | null,
): GameState {
  let state = source;
  for (const mafia of state.characters.filter(
    (character) => character.alive && character.faction === "mafia",
  )) {
    state = applyAction(state, {
      type: "night-kill",
      actorId: mafia.id,
      targetId: killTargetId,
    });
  }
  const leader = state.characters.find(
    (character) => character.alive && character.roleId === "cult_leader",
  );
  if (leader && !state.cultConversionUsed) {
    state = applyAction(state, {
      type: "cult-convert",
      actorId: leader.id,
      targetId: convertTargetId,
    });
  }
  return state;
}

function withOnlyFactions(
  source: GameState,
  aliveByFaction: Partial<Record<Character["faction"], number>>,
): GameState {
  const used = { citizen: 0, mafia: 0, cult: 0 };
  return {
    ...source,
    phase: "dawn",
    winner: null,
    winnerReason: null,
    characters: source.characters.map((character) => {
      const shouldLive =
        used[character.faction] < (aliveByFaction[character.faction] ?? 0);
      if (shouldLive) {
        used[character.faction] += 1;
      }
      return {
        ...character,
        alive: shouldLive,
        hp: shouldLive ? Math.max(1, character.hp) : 0,
      };
    }),
  };
}

describe("game creation", () => {
  it("creates the approved nine-player role composition at 2 HP", () => {
    const state = createGame({ mode: "solo", seed: 101 });
    const counts = Object.fromEntries(
      Object.keys(ROLE_COUNTS).map((roleId) => [
        roleId,
        state.characters.filter(
          (character) => character.originalRoleId === roleId,
        ).length,
      ]),
    );

    expect(state.phase).toBe("night");
    expect(state.characters).toHaveLength(9);
    expect(counts).toEqual(ROLE_COUNTS);
    expect(state.characters.every((character) => character.hp === STARTING_HP))
      .toBe(true);
  });

  it("assigns duo humans to the same faction and exposes both roles to them", () => {
    const state = createGame({
      mode: "duo",
      seed: 202,
      hostName: "호스트",
      guestName: "게스트",
    });
    const [hostId, guestId] = state.humanIds;
    const host = state.characters.find((character) => character.id === hostId)!;
    const guest = state.characters.find(
      (character) => character.id === guestId,
    )!;
    const view = getPlayerView(state, hostId, 7);

    expect(host.faction).toBe(guest.faction);
    expect(state.duoFaction).toBe(host.faction);
    expect(view.partnerId).toBe(guestId);
    expect(view.partner?.roleId).toBe(guest.roleId);
    expect(view.revision).toBe(7);
  });

  it("is deterministic for a supplied seed, including AI choices", () => {
    const first = createGame({ mode: "solo", seed: 303 });
    const second = createGame({ mode: "solo", seed: 303 });

    expect(first).toEqual(second);
    expect(autoPlayAi(first)).toEqual(autoPlayAi(second));
  });

  it("protects citizen duo humans from cult conversion and AI targeting", () => {
    const state = createGame({ mode: "duo", seed: 1 });
    const leader = byRole(state, "cult_leader");

    expect(state.duoFaction).toBe("citizen");
    expect(
      state.humanIds.every(
        (id) =>
          state.characters.find((character) => character.id === id)
            ?.faction === "citizen",
      ),
    ).toBe(true);
    for (const humanId of state.humanIds) {
      expect(() =>
        applyAction(state, {
          type: "cult-convert",
          actorId: leader.id,
          targetId: humanId,
        }),
      ).toThrow(/듀오 참가자/);
    }

    const automated = autoPlayAi(state);
    expect(automated.pending.cultConvertTarget).not.toBeUndefined();
    expect(state.humanIds).not.toContain(
      automated.pending.cultConvertTarget,
    );
  });

  it("rejects a cult duo leader targeting their human partner", () => {
    const state = createGame({ mode: "duo", seed: 2 });
    const leader = byRole(state, "cult_leader");
    const partner = state.characters.find(
      (character) =>
        state.humanIds.includes(character.id) &&
        character.id !== leader.id,
    )!;

    expect(state.duoFaction).toBe("cult");
    expect(() =>
      applyAction(state, {
        type: "cult-convert",
        actorId: leader.id,
        targetId: partner.id,
      }),
    ).toThrow(/교주팀 구성원/);
  });
});

describe("night resolution", () => {
  it("kills the agreed target immediately and never mutates the input state", () => {
    const initial = createGame({ mode: "solo", seed: 404 });
    const victim = initial.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const before = structuredClone(initial);
    const ready = completeNight(initial, victim.id, null);
    const dawn = advancePhase(ready);

    expect(initial).toEqual(before);
    expect(dawn.phase).toBe("dawn");
    expect(dawn.characters.find((character) => character.id === victim.id))
      .toMatchObject({ alive: false, hp: 0 });
  });

  it("allows exactly one conversion and keeps a failed mafia attempt secret", () => {
    const initial = createGame({ mode: "solo", seed: 505 });
    const citizens = initial.characters.filter(
      (character) => character.faction === "citizen",
    );
    const ready = completeNight(initial, citizens[0].id, citizens[1].id);
    const dawn = advancePhase(ready);
    const converted = dawn.characters.find(
      (character) => character.id === citizens[1].id,
    )!;

    expect(converted).toMatchObject({
      originalRoleId: "citizen",
      roleId: "cultist",
      faction: "cult",
      converted: true,
    });
    expect(dawn.cultConversionUsed).toBe(true);

    const leader = byRole(dawn, "cult_leader");
    const nextNight: GameState = {
      ...dawn,
      phase: "night",
      pending: {
        nightKillVotes: {},
        cultConvertTarget: undefined,
        disguiseChoices: {},
        dayVotes: {},
      },
    };
    expect(() =>
      applyAction(nextNight, {
        type: "cult-convert",
        actorId: leader.id,
        targetId: byRole(nextNight, "mafia").id,
      }),
    ).toThrow(/이미 사용/);

    const failedInitial = createGame({ mode: "solo", seed: 506 });
    const failedCitizen = failedInitial.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const failedReady = completeNight(
      failedInitial,
      failedCitizen.id,
      byRole(failedInitial, "mafia").id,
    );
    const failedDawn = advancePhase(failedReady);
    const citizenViewer = failedDawn.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const publicTexts = getPlayerView(
      failedDawn,
      citizenViewer.id,
      1,
    ).publicEvents.map((event) => event.text);
    const cultTexts = getPlayerView(
      failedDawn,
      byRole(failedDawn, "cult_leader").id,
      2,
    ).publicEvents.map((event) => event.text);
    expect(failedDawn.cultConversionUsed).toBe(true);
    expect(publicTexts.join(" ")).not.toContain("포교");
    expect(publicTexts.join(" ")).not.toContain("마피아");
    expect(cultTexts.join(" ")).toContain("포교가 실패");
    expect(cultTexts.join(" ")).not.toContain("마피아");
  });

  it("reports missing mandatory actions before phase resolution", () => {
    const state = createGame({ mode: "solo", seed: 507 });
    expect(() => advancePhase(state)).toThrow(/선택하지 않은 마피아|포교 대상/);
  });
});

describe("day rules", () => {
  it("copies a living citizen and damages the disguised mafia when that seat wins", () => {
    const initial = createGame({ mode: "solo", seed: 606 });
    const nightVictim = initial.characters.find(
      (character) => character.faction === "citizen",
    )!;
    let state = advancePhase(completeNight(initial, nightVictim.id, null));
    state = advancePhase(state);
    const mafia = byRole(state, "mafia");
    state = applyAction(state, {
      type: "disguise",
      actorId: mafia.id,
      use: true,
    });
    state = advancePhase(state);

    const disguised = state.characters.find(
      (character) => character.id === mafia.id,
    )!;
    const original = state.characters.find(
      (character) => character.id === disguised.disguisedAs,
    )!;
    expect(original.alive).toBe(true);
    expect(original.faction).toBe("citizen");
    const publicView = getPlayerView(state, state.humanIds[0], 2);
    expect(
      publicView.characters.filter(
        (character) =>
          character.isDisguisedDouble &&
          character.displayName === original.name,
      ),
    ).toHaveLength(2);

    state = advancePhase(state);
    for (const voter of state.characters.filter(
      (character) => character.alive,
    )) {
      const targetId =
        voter.id === mafia.id
          ? state.characters.find(
              (candidate) =>
                candidate.alive &&
                candidate.id !== voter.id &&
                candidate.id !== mafia.id,
            )!.id
          : mafia.id;
      state = applyAction(state, {
        type: "vote",
        actorId: voter.id,
        targetId,
      });
    }
    state = advancePhase(state);
    expect(state.characters.find((character) => character.id === mafia.id))
      .toMatchObject({ hp: 1, alive: true });
    expect(state.phase).toBe("dusk");

    state = advancePhase(state);
    expect(
      state.characters.find((character) => character.id === mafia.id)
        ?.disguisedAs,
    ).toBeNull();
  });

  it("invalidates a tied vote", () => {
    let state = createGame({ mode: "solo", seed: 607 });
    state = { ...state, phase: "voting" };
    const alive = state.characters.filter((character) => character.alive);
    const targets = [alive[0], alive[1], alive[2]];
    const targetIndexes = [1, 0, 0, 0, 1, 1, 2, 2, 2];
    for (const [index, voter] of alive.entries()) {
      const target = targets[targetIndexes[index]];
      state = applyAction(state, {
        type: "vote",
        actorId: voter.id,
        targetId: target.id,
      });
    }
    const result = advancePhase(state);
    expect(result.characters.every((character) => character.hp === 2)).toBe(
      true,
    );
  });

  it("explodes a voted-out bomber and damages every surviving voter", () => {
    let state = createGame({ mode: "solo", seed: 608 });
    const bomber = byRole(state, "bomber");
    state = {
      ...state,
      phase: "voting",
      characters: state.characters.map((character) => ({
        ...character,
        hp: character.id === bomber.id ? 1 : 1,
      })),
    };
    const voters = state.characters.filter(
      (character) => character.id !== bomber.id,
    );
    for (const voter of voters) {
      state = applyAction(state, {
        type: "vote",
        actorId: voter.id,
        targetId: bomber.id,
      });
    }
    const bomberTarget = state.characters.find(
      (character) => character.id !== bomber.id,
    )!;
    state = applyAction(state, {
      type: "vote",
      actorId: bomber.id,
      targetId: bomberTarget.id,
    });
    const result = advancePhase(state);

    expect(result.phase).toBe("ended");
    expect(result.winner).toBe("draw");
    expect(result.winnerReason).toContain("무승부");

    expect(result.characters.find((character) => character.id === bomber.id))
      .toMatchObject({ alive: false, hp: 0 });
    expect(
      voters.every(
        (voter) =>
          result.characters.find((character) => character.id === voter.id)
            ?.alive === false,
      ),
    ).toBe(true);
  });
});

describe("AI public reasoning", () => {
  it("uses the public disguise name instead of leaking the mafia's original name", () => {
    const base = createGame({ mode: "solo", seed: 609 });
    const mafia = byRole(base, "mafia");
    const citizen = base.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const state: GameState = {
      ...base,
      phase: "discussion",
      characters: base.characters.map((character) => {
        if (character.id === mafia.id || character.id === citizen.id) {
          return {
            ...character,
            alive: true,
            hp: 2,
            controller: "ai",
            disguisedAs:
              character.id === mafia.id ? citizen.id : null,
          };
        }
        return {
          ...character,
          alive: false,
          hp: 0,
          controller: "human-host",
          disguisedAs: null,
        };
      }),
    };

    const result = autoPlayAi(state);
    const speech = result.messages
      .filter((message) => message.kind === "speech")
      .map((message) => message.text)
      .join(" ");

    expect(speech).toContain(citizen.name);
    expect(speech).not.toContain(mafia.name);
  });

  it("uses an earlier public vote result instead of hidden in-progress votes", () => {
    const base = createGame({ mode: "solo", seed: 610 });
    const voter = base.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const suspicious = byRole(base, "mafia");
    const decoy = base.characters.find(
      (character) =>
        character.id !== voter.id && character.id !== suspicious.id,
    )!;
    const earlyVoters = base.characters
      .filter((character) => ![voter.id, decoy.id].includes(character.id))
      .slice(0, 2);
    const state: GameState = {
      ...base,
      day: 2,
      phase: "voting",
      characters: base.characters.map((character) => ({
        ...character,
        controller:
          character.id === voter.id ? "ai" : "human-host",
      })),
      pending: {
        nightKillVotes: {},
        cultConvertTarget: undefined,
        disguiseChoices: {},
        dayVotes: Object.fromEntries(
          earlyVoters.map((character) => [
            character.id,
            decoy.id,
          ]),
        ),
      },
      events: [
        ...base.events,
        {
          id: "event-prior-vote",
          day: 1,
          phase: "voting",
          text: `이전 투표에서 ${suspicious.name}님이 생명력 1을 잃었습니다.`,
          visibility: "public",
        },
      ],
    };

    const result = autoPlayAi(state);

    expect(result.pending.dayVotes[voter.id]).toBe(suspicious.id);
  });

  it("focuses a citizen AI vote on publicly duplicated appearances", () => {
    const base = createGame({ mode: "solo", seed: 611 });
    const citizens = base.characters.filter(
      (character) => character.faction === "citizen",
    );
    const voter = citizens[0];
    const original = citizens[1];
    const mafia = byRole(base, "mafia");
    const state: GameState = {
      ...base,
      phase: "voting",
      characters: base.characters.map((character) => ({
        ...character,
        controller:
          character.id === voter.id ? "ai" : "human-host",
        disguisedAs:
          character.id === mafia.id ? original.id : null,
      })),
    };

    const result = autoPlayAi(state);

    expect([original.id, mafia.id]).toContain(
      result.pending.dayVotes[voter.id],
    );
  });
});

describe("winner and player-view boundaries", () => {
  it.each([
    [{ citizen: 0, mafia: 0, cult: 0 }, "draw"],
    [{ citizen: 1, mafia: 0, cult: 0 }, "citizen"],
    [{ citizen: 0, mafia: 1, cult: 0 }, "mafia"],
    [{ citizen: 2, mafia: 0, cult: 2 }, "cult"],
  ] as const)("applies the exact victory condition for %s", (alive, winner) => {
    const result = advancePhase(
      withOnlyFactions(createGame({ mode: "solo", seed: 701 }), alive),
    );
    expect(result.phase).toBe("ended");
    expect(result.winner).toBe(winner);
  });

  it("reveals only the viewer's faction events without leaking hidden state", () => {
    const source = createGame({ mode: "duo", seed: 702 });
    const citizenViewer = source.characters.find(
      (character) => character.faction === "citizen",
    )!;
    const outsider = source.characters.find(
      (character) => character.id !== citizenViewer.id,
    )!;
    const secretState: GameState = {
      ...source,
      events: [
        ...source.events,
        {
          id: "secret-mafia",
          day: 1,
          phase: "night",
          text: "MAFIA_SECRET",
          visibility: "mafia",
        },
        {
          id: "secret-cult",
          day: 1,
          phase: "night",
          text: "CULT_SECRET",
          visibility: "cult",
        },
        {
          id: "secret-host",
          day: 1,
          phase: "night",
          text: "HOST_SECRET",
          visibility: "host",
        },
      ],
    };
    const view = getPlayerView(secretState, citizenViewer.id, 9);
    const serialized = JSON.stringify(view);

    expect(view.characters).toHaveLength(9);
    expect(view.characters.find((character) => character.id === outsider.id))
      .not.toHaveProperty("roleId");
    expect(serialized).not.toContain("originalRoleId");
    expect(serialized).not.toContain("converted");
    expect(serialized).not.toContain("MAFIA_SECRET");
    expect(serialized).not.toContain("CULT_SECRET");
    expect(serialized).not.toContain("HOST_SECRET");

    const mafiaTexts = getPlayerView(
      secretState,
      secretState.characters.find(
        (character) => character.faction === "mafia",
      )!.id,
      10,
    ).publicEvents.map((event) => event.text);
    const cultTexts = getPlayerView(
      secretState,
      secretState.characters.find(
        (character) => character.faction === "cult",
      )!.id,
      11,
    ).publicEvents.map((event) => event.text);

    expect(mafiaTexts).toContain("MAFIA_SECRET");
    expect(mafiaTexts).not.toContain("CULT_SECRET");
    expect(mafiaTexts).not.toContain("HOST_SECRET");
    expect(cultTexts).toContain("CULT_SECRET");
    expect(cultTexts).not.toContain("MAFIA_SECRET");
    expect(cultTexts).not.toContain("HOST_SECRET");
  });
});
