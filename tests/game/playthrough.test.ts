import { describe, expect, it } from "vitest";

import {
  advancePhase,
  applyAction,
  autoPlayAi,
  createGame,
  type GameAction,
  type GameState,
} from "../../lib/game";

function submitHumanAction(state: GameState): GameState {
  const actor = state.characters.find(
    (character) =>
      character.alive && character.controller === "human-host",
  );
  if (!actor) return state;

  let action: GameAction | null = null;

  if (state.phase === "night" && actor.faction === "mafia") {
    const target = state.characters.find(
      (character) => character.alive && character.faction !== "mafia",
    );
    if (target) {
      action = { type: "night-kill", actorId: actor.id, targetId: target.id };
    }
  } else if (
    state.phase === "night" &&
    actor.roleId === "cult_leader" &&
    !state.cultConversionUsed
  ) {
    const target = state.characters.find(
      (character) => character.alive && character.faction === "citizen",
    );
    action = {
      type: "cult-convert",
      actorId: actor.id,
      targetId: target?.id ?? null,
    };
  } else if (state.phase === "morning" && actor.roleId === "mafia") {
    action = { type: "disguise", actorId: actor.id, use: true };
  } else if (state.phase === "voting") {
    const target = state.characters.find(
      (character) => character.alive && character.id !== actor.id,
    );
    if (target) {
      action = { type: "vote", actorId: actor.id, targetId: target.id };
    }
  }

  return action ? applyAction(state, action) : state;
}

function finishPhase(state: GameState): GameState {
  return advancePhase(submitHumanAction(autoPlayAi(state)));
}

describe("complete AI-assisted match", () => {
  it.each([801, 802, 803])(
    "reaches a declared winner without stalling for seed %s",
    (seed) => {
      let state = createGame({ mode: "solo", seed });
      let transitions = 0;

      while (state.phase !== "ended" && transitions < 160) {
        state = finishPhase(state);
        transitions += 1;
      }

      expect(state.phase).toBe("ended");
      expect(state.winner).not.toBeNull();
      expect(state.winnerReason).toBeTruthy();
      expect(state.day).toBeLessThan(40);
    },
  );
});
