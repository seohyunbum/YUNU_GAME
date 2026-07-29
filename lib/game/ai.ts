import {
  applyAction,
  cloneGameState,
  drawRandomIndex,
  getPublicDisplayName,
  isDuoCitizenProtectedFromConversion,
} from "./engine";
import type { Character, GameState } from "./types";

function isAi(character: Character): boolean {
  return character.alive && character.controller === "ai";
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function chooseRandom<T>(
  state: GameState,
  candidates: readonly T[],
): { state: GameState; value: T } {
  const draw = drawRandomIndex(state, candidates.length);
  return { state: draw.state, value: candidates[draw.index] };
}

function voteCandidates(state: GameState, voter: Character): Character[] {
  return state.characters.filter((candidate) => {
    if (!candidate.alive || candidate.id === voter.id) {
      return false;
    }
    if (voter.faction === "mafia" && candidate.faction === "mafia") {
      return false;
    }
    if (voter.faction === "cult" && candidate.faction === "cult") {
      return false;
    }
    return true;
  });
}

function chooseDayVote(
  state: GameState,
  voter: Character,
): { state: GameState; target: Character } | null {
  const candidates = voteCandidates(state, voter);
  if (candidates.length === 0) {
    return null;
  }

  const currentMessages = state.messages.filter(
    (message) => message.day === state.day && message.kind === "speech",
  );
  const scored = candidates.map((candidate) => {
    const displayName = getPublicDisplayName(state, candidate);
    const mentions = currentMessages.filter((message) =>
      message.text.includes(displayName),
    ).length;
    const publicEventMentions = state.events.filter(
      (event) =>
        event.visibility === "public" &&
        event.day < state.day &&
        event.text.includes(displayName),
    ).length;
    const sameDisplayCount = state.characters.filter(
      (character) =>
        character.alive &&
        getPublicDisplayName(state, character) === displayName,
    ).length;
    const duplicateAppearance = sameDisplayCount > 1 ? 2 : 0;
    return {
      candidate,
      score: publicEventMentions * 3 + mentions + duplicateAppearance,
    };
  });
  const bestScore = Math.max(...scored.map(({ score }) => score));
  const tied = scored
    .filter(({ score }) => score === bestScore)
    .map(({ candidate }) => candidate);
  const choice = chooseRandom(state, tied);
  return { state: choice.state, target: choice.value };
}

function autoNight(state: GameState): GameState {
  let next = cloneGameState(state);
  const mafiaActors = next.characters.filter(
    (character) =>
      isAi(character) &&
      character.faction === "mafia" &&
      !hasOwn(next.pending.nightKillVotes, character.id),
  );

  for (const actorSnapshot of mafiaActors) {
    const actor = next.characters.find(
      (character) => character.id === actorSnapshot.id,
    );
    if (!actor?.alive || hasOwn(next.pending.nightKillVotes, actor.id)) {
      continue;
    }
    const candidates = next.characters.filter(
      (candidate) => candidate.alive && candidate.faction !== "mafia",
    );
    if (candidates.length === 0) {
      continue;
    }

    const teammateTargetId = Object.values(
      next.pending.nightKillVotes,
    ).find((targetId) =>
      candidates.some((candidate) => candidate.id === targetId),
    );
    let target: Character;
    if (teammateTargetId) {
      target = candidates.find(
        (candidate) => candidate.id === teammateTargetId,
      )!;
    } else {
      const choice = chooseRandom(next, candidates);
      next = choice.state;
      target = choice.value;
    }
    next = applyAction(next, {
      type: "night-kill",
      actorId: actor.id,
      targetId: target.id,
    });
  }

  const leader = next.characters.find(
    (character) =>
      isAi(character) &&
      character.roleId === "cult_leader" &&
      !next.cultConversionUsed,
  );
  if (leader && next.pending.cultConvertTarget === undefined) {
    const candidates = next.characters.filter(
      (candidate) =>
        candidate.alive &&
        candidate.id !== leader.id &&
        candidate.faction !== "cult" &&
        !isDuoCitizenProtectedFromConversion(next, candidate.id),
    );
    if (candidates.length === 0) {
      next = applyAction(next, {
        type: "cult-convert",
        actorId: leader.id,
        targetId: null,
      });
    } else {
      const choice = chooseRandom(next, candidates);
      next = applyAction(choice.state, {
        type: "cult-convert",
        actorId: leader.id,
        targetId: choice.value.id,
      });
    }
  }
  return next;
}

function autoMorning(state: GameState): GameState {
  let next = cloneGameState(state);
  const disguisers = next.characters.filter(
    (character) =>
      isAi(character) &&
      character.roleId === "mafia" &&
      !hasOwn(next.pending.disguiseChoices, character.id),
  );
  for (const disguiser of disguisers) {
    next = applyAction(next, {
      type: "disguise",
      actorId: disguiser.id,
      use: true,
    });
  }
  return next;
}

function autoDiscussion(state: GameState): GameState {
  let next = cloneGameState(state);
  const speakers = next.characters.filter(isAi);

  for (const speakerSnapshot of speakers) {
    const alreadySpoke = next.messages.some(
      (message) =>
        message.day === next.day &&
        message.kind === "speech" &&
        message.speakerId === speakerSnapshot.id,
    );
    if (alreadySpoke) {
      continue;
    }
    const speaker = next.characters.find(
      (character) => character.id === speakerSnapshot.id && character.alive,
    );
    if (!speaker) {
      continue;
    }
    const candidates = voteCandidates(next, speaker);
    if (candidates.length === 0) {
      continue;
    }
    const targetChoice = chooseRandom(next, candidates);
    next = targetChoice.state;
    const target = targetChoice.value;
    const speakerDisplayName = getPublicDisplayName(next, speaker);
    const targetDisplayName = getPublicDisplayName(next, target);
    const wasAccused = next.messages.some(
      (message) =>
        message.day === next.day &&
        message.kind === "speech" &&
        message.speakerId !== speaker.id &&
        message.text.includes(speakerDisplayName),
    );
    const lines = wasAccused
      ? [
          `저는 결백합니다. 오히려 ${targetDisplayName}님의 설명부터 확인해 주세요.`,
          `제 행동은 숨길 것이 없습니다. ${targetDisplayName}님은 어젯밤 무엇을 했나요?`,
        ]
      : [
          `${targetDisplayName}님, 어젯밤 누구를 가장 의심했는지 말해 주세요.`,
          `저는 ${targetDisplayName}님의 반응을 조금 더 지켜봐야 한다고 생각합니다.`,
          `투표 전에 ${targetDisplayName}님의 동선을 먼저 확인하고 싶습니다.`,
        ];
    const lineChoice = chooseRandom(next, lines);
    next = applyAction(lineChoice.state, {
      type: "talk",
      actorId: speaker.id,
      targetId: target.id,
      text: lineChoice.value,
    });
  }
  return next;
}

function autoVoting(state: GameState): GameState {
  let next = cloneGameState(state);
  const voters = next.characters.filter(
    (character) =>
      isAi(character) && !hasOwn(next.pending.dayVotes, character.id),
  );

  for (const voterSnapshot of voters) {
    const voter = next.characters.find(
      (character) => character.id === voterSnapshot.id && character.alive,
    );
    if (!voter || hasOwn(next.pending.dayVotes, voter.id)) {
      continue;
    }
    const choice = chooseDayVote(next, voter);
    if (!choice) {
      continue;
    }
    next = applyAction(choice.state, {
      type: "vote",
      actorId: voter.id,
      targetId: choice.target.id,
    });
  }
  return next;
}

export function autoPlayAi(state: GameState): GameState {
  switch (state.phase) {
    case "night":
      return autoNight(state);
    case "morning":
      return autoMorning(state);
    case "discussion":
      return autoDiscussion(state);
    case "voting":
      return autoVoting(state);
    default:
      return cloneGameState(state);
  }
}
