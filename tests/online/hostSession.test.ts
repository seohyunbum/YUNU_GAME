import { describe, expect, it } from "vitest";
import type {
  Character,
  GameAction,
  GameState,
  PlayerView,
} from "../../lib/game/types";
import { HostSession } from "../../lib/online/hostSession";
import {
  PROTOCOL_VERSION,
  type IntentMessage,
} from "../../lib/online/protocol";

const host = character("host", "방장", "human-host");
const guest = character("guest", "게스트", "human-guest");

function character(
  id: string,
  name: string,
  controller: Character["controller"],
): Character {
  return {
    id,
    seat: id === "host" ? 0 : 1,
    name,
    avatar: "mask",
    roleId: "citizen",
    originalRoleId: "citizen",
    faction: "citizen",
    hp: 2,
    alive: true,
    controller,
    disguisedAs: null,
    converted: false,
  };
}

function initialState(): GameState {
  return {
    version: 1,
    seed: 7,
    rngState: 7,
    mode: "duo",
    day: 1,
    phase: "discussion",
    characters: [host, guest],
    humanIds: ["host", "guest"],
    duoFaction: "citizen",
    pending: {
      nightKillVotes: {},
      cultConvertTarget: undefined,
      disguiseChoices: {},
      dayVotes: {},
    },
    cultConversionUsed: false,
    messages: [],
    events: [],
    winner: null,
    winnerReason: null,
  };
}

function applyAction(state: GameState, action: GameAction): GameState {
  if (action.type !== "talk") {
    throw new Error("Only talk is supported by this fixture.");
  }
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: `message-${state.messages.length + 1}`,
        day: state.day,
        speakerId: action.actorId,
        text: action.text,
        kind: "speech",
      },
    ],
  };
}

function buildView(
  state: GameState,
  playerId: string,
  revision: number,
): PlayerView {
  const self = state.characters.find((item) => item.id === playerId);
  if (!self) throw new Error("missing player");
  const partner = state.characters.find((item) => item.id !== playerId);

  return {
    version: 1,
    revision,
    playerId,
    partnerId: partner?.id ?? null,
    day: state.day,
    phase: state.phase,
    mode: state.mode,
    characters: state.characters.map((item) => ({
      id: item.id,
      seat: item.seat,
      displayName: item.name,
      avatar: item.avatar,
      hp: item.hp,
      alive: item.alive,
      isDisguisedDouble: false,
    })),
    self: {
      id: self.id,
      name: self.name,
      roleId: self.roleId,
      faction: self.faction,
      alive: self.alive,
    },
    selfAbilityUsed: false,
    partner: partner
      ? {
          id: partner.id,
          name: partner.name,
          roleId: partner.roleId,
          faction: partner.faction,
          alive: partner.alive,
        }
      : null,
    messages: state.messages,
    publicEvents: state.events.filter(
      (event) => event.visibility === "public",
    ),
    winner: state.winner,
    winnerReason: state.winnerReason,
  };
}

function guestIntent(
  seq: number,
  actionId: string,
  actorId = "guest",
): IntentMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    kind: "intent",
    seq,
    actionId,
    sentAt: 1_000 + seq,
    action: {
      type: "talk",
      actorId,
      text: `발언 ${seq}`,
    },
  };
}

function createSession(): HostSession {
  return new HostSession({
    initialState: initialState(),
    hostPlayerId: "host",
    guestPlayerId: "guest",
    applyAction,
    buildView,
  });
}

describe("HostSession intent coordination", () => {
  it("applies an action once and gives both players the same revision", () => {
    const session = createSession();
    const message = guestIntent(0, "guest-action-0");

    const first = session.receiveGuestIntent(message);
    const duplicate = session.receiveGuestIntent(message);

    expect(first.status).toBe("applied");
    expect(first.revision).toBe(1);
    expect(first.hostView.revision).toBe(1);
    expect(first.guestView.revision).toBe(1);
    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.revision).toBe(1);
    expect(session.getState().messages).toHaveLength(1);
  });

  it("rejects stale sequences and actor spoofing without revising state", () => {
    const session = createSession();
    expect(
      session.receiveGuestIntent(guestIntent(2, "valid-2")).status,
    ).toBe("applied");

    const stale = session.receiveGuestIntent(guestIntent(1, "stale-1"));
    const spoofed = session.receiveGuestIntent(
      guestIntent(3, "spoofed-3", "host"),
    );

    expect(stale).toMatchObject({
      status: "rejected",
      reason: "stale-seq",
      revision: 1,
    });
    expect(spoofed).toMatchObject({
      status: "rejected",
      reason: "invalid-actor",
      revision: 1,
    });
    expect(session.getState().messages).toHaveLength(1);
  });

  it("does not consume sequence numbers for actor spoof attempts", () => {
    const session = createSession();
    const spoofed = session.receiveGuestIntent(
      guestIntent(Number.MAX_SAFE_INTEGER, "spoof-max", "host"),
    );
    const valid = session.receiveGuestIntent(guestIntent(0, "valid-0"));

    expect(spoofed).toMatchObject({
      status: "rejected",
      reason: "invalid-actor",
    });
    expect(valid.status).toBe("applied");
    expect(session.getState().messages).toHaveLength(1);
  });
});

describe("HostSession reconnect window", () => {
  it("accepts reconnects before the 60 second deadline", () => {
    const session = createSession();
    const disconnected = session.markGuestDisconnected(10_000);
    const reconnected = session.markGuestReconnected(69_999);

    expect(disconnected).toMatchObject({
      type: "guest-disconnected",
      reconnectDeadlineAt: 70_000,
    });
    expect(reconnected).toMatchObject({
      accepted: true,
      event: { type: "guest-reconnected" },
    });
    expect(session.guestConnectionState).toBe("connected");
    expect(session.revision).toBe(0);
  });

  it("replaces the guest with AI at the deadline and emits a public event", () => {
    const session = createSession();
    session.markGuestDisconnected(10_000);

    const event = session.advanceTime(70_000);
    const guestAfter = session
      .getState()
      .characters.find((item) => item.id === "guest");

    expect(event).toMatchObject({
      type: "guest-replaced-by-ai",
      playerId: "guest",
      revision: 1,
    });
    expect(guestAfter?.controller).toBe("ai");
    expect(session.getState().events.at(-1)).toMatchObject({
      visibility: "public",
      phase: "discussion",
    });
    expect(session.markGuestReconnected(70_001).accepted).toBe(false);
  });

  it("starts a fresh guest sequence epoch after reconnection", () => {
    const session = createSession();
    expect(
      session.receiveGuestIntent(guestIntent(7, "before-reconnect")).status,
    ).toBe("applied");

    session.markGuestDisconnected(10_000);
    expect(session.markGuestReconnected(20_000).accepted).toBe(true);

    const afterReconnect = session.receiveGuestIntent(
      guestIntent(0, "after-reconnect"),
    );
    expect(afterReconnect.status).toBe("applied");
    expect(afterReconnect.revision).toBe(2);
    expect(session.getState().messages).toHaveLength(2);
  });
});
