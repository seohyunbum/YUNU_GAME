import type {
  Character,
  GameState,
  PlayerView,
  PublicCharacter,
} from "./types";

function privateCharacter(
  character: Character,
): PlayerView["self"] {
  return {
    id: character.id,
    name: character.name,
    roleId: character.roleId,
    faction: character.faction,
    alive: character.alive,
  };
}

function publicCharacters(state: GameState): PublicCharacter[] {
  const duplicatedIds = new Set<string>();
  for (const character of state.characters) {
    if (!character.alive || !character.disguisedAs) {
      continue;
    }
    const original = state.characters.find(
      (candidate) =>
        candidate.id === character.disguisedAs && candidate.alive,
    );
    if (original) {
      duplicatedIds.add(character.id);
      duplicatedIds.add(original.id);
    }
  }

  return state.characters.map((character) => {
    const original = character.disguisedAs
      ? state.characters.find(
          (candidate) =>
            candidate.id === character.disguisedAs && candidate.alive,
        )
      : undefined;
    return {
      id: character.id,
      seat: character.seat,
      displayName: original?.name ?? character.name,
      avatar: original?.avatar ?? character.avatar,
      hp: character.hp,
      alive: character.alive,
      isDisguisedDouble: duplicatedIds.has(character.id),
    };
  });
}

export function getPlayerView(
  state: GameState,
  playerId: string,
  revision: number,
): PlayerView {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("revision은 0 이상의 안전한 정수여야 합니다.");
  }
  const player = state.characters.find(
    (character) => character.id === playerId,
  );
  if (!player) {
    throw new Error(`플레이어를 찾을 수 없습니다: ${playerId}`);
  }

  const isDuoHuman =
    state.mode === "duo" && state.humanIds.includes(player.id);
  const partner = isDuoHuman
    ? state.characters.find(
        (character) =>
          character.id !== player.id &&
          state.humanIds.includes(character.id),
      ) ?? null
    : null;

  return {
    version: 1,
    revision,
    playerId,
    partnerId: partner?.id ?? null,
    day: state.day,
    phase: state.phase,
    mode: state.mode,
    characters: publicCharacters(state),
    self: privateCharacter(player),
    selfAbilityUsed:
      player.roleId === "cult_leader" && state.cultConversionUsed,
    partner: partner ? privateCharacter(partner) : null,
    messages: state.messages.map((message) => ({ ...message })),
    publicEvents: state.events
      .filter(
        (event) =>
          event.visibility === "public" ||
          event.visibility === player.faction,
      )
      .map((event) => ({ ...event })),
    winner: state.winner,
    winnerReason: state.winnerReason,
  };
}
