import {
  CHARACTER_TEMPLATES,
  DEFAULT_SEED,
  DUO_FACTIONS,
  GAME_VERSION,
  MAX_TALK_LENGTH,
  ROLE_DECK,
  ROLE_FACTIONS,
  STARTING_HP,
  WINNER_LABELS,
  WINNER_REASONS,
} from "./constants";
import type {
  Character,
  Faction,
  GameAction,
  GameEvent,
  GameState,
  NewGameOptions,
  PendingActions,
  Phase,
  RoleId,
  TalkMessage,
  Winner,
} from "./types";

export type GameRuleErrorCode =
  | "GAME_ENDED"
  | "WRONG_PHASE"
  | "ACTOR_NOT_FOUND"
  | "ACTOR_DEAD"
  | "INVALID_ROLE"
  | "TARGET_NOT_FOUND"
  | "TARGET_DEAD"
  | "INVALID_TARGET"
  | "DUPLICATE_ACTION"
  | "ACTION_REQUIRED"
  | "INVALID_ACTION";

export class GameRuleError extends Error {
  readonly code: GameRuleErrorCode;

  constructor(code: GameRuleErrorCode, message: string) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}

function ruleError(code: GameRuleErrorCode, message: string): never {
  throw new GameRuleError(code, message);
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    characters: state.characters.map((character) => ({ ...character })),
    humanIds: [...state.humanIds],
    pending: {
      nightKillVotes: { ...state.pending.nightKillVotes },
      cultConvertTarget: state.pending.cultConvertTarget,
      disguiseChoices: { ...state.pending.disguiseChoices },
      dayVotes: { ...state.pending.dayVotes },
    },
    messages: state.messages.map((message) => ({ ...message })),
    events: state.events.map((event) => ({ ...event })),
  };
}

function emptyPending(): PendingActions {
  return {
    nightKillVotes: {},
    cultConvertTarget: undefined,
    disguiseChoices: {},
    dayVotes: {},
  };
}

function normalizeSeed(seed: number | undefined): number {
  if (seed === undefined) {
    return (Date.now() >>> 0) || DEFAULT_SEED;
  }
  if (!Number.isFinite(seed)) {
    ruleError("INVALID_ACTION", "시드는 유한한 숫자여야 합니다.");
  }
  return (Math.trunc(seed) >>> 0) || DEFAULT_SEED;
}

export function nextRngState(rngState: number): number {
  return (Math.imul(rngState, 1_664_525) + 1_013_904_223) >>> 0;
}

function drawIndexFromNumber(
  rngState: number,
  length: number,
): { rngState: number; index: number } {
  if (!Number.isInteger(length) || length <= 0) {
    ruleError("INVALID_ACTION", "빈 후보 목록에서는 무작위 선택을 할 수 없습니다.");
  }
  const next = nextRngState(rngState);
  return { rngState: next, index: next % length };
}

export function drawRandomIndex(
  state: GameState,
  length: number,
): { state: GameState; index: number } {
  const next = cloneGameState(state);
  const draw = drawIndexFromNumber(next.rngState, length);
  next.rngState = draw.rngState;
  return { state: next, index: draw.index };
}

function shuffleWithRng<T>(
  values: readonly T[],
  initialRngState: number,
): { values: T[]; rngState: number } {
  const shuffled = [...values];
  let rngState = initialRngState;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const draw = drawIndexFromNumber(rngState, index + 1);
    rngState = draw.rngState;
    [shuffled[index], shuffled[draw.index]] = [
      shuffled[draw.index],
      shuffled[index],
    ];
  }
  return { values: shuffled, rngState };
}

function safePlayerName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().replace(/\s+/g, " ").slice(0, 20);
  return normalized || fallback;
}

function takeRolesForFaction(
  roles: RoleId[],
  faction: Faction,
  count: number,
  rngState: number,
): { selected: RoleId[]; remaining: RoleId[]; rngState: number } {
  const candidates = roles.filter((roleId) => ROLE_FACTIONS[roleId] === faction);
  const shuffled = shuffleWithRng(candidates, rngState);
  const selected = shuffled.values.slice(0, count);
  const remaining = [...roles];
  for (const roleId of selected) {
    const index = remaining.indexOf(roleId);
    remaining.splice(index, 1);
  }
  return { selected, remaining, rngState: shuffled.rngState };
}

function createInitialEvent(): GameEvent {
  return {
    id: "event-1",
    day: 1,
    phase: "night",
    text: "아홉 명이 모였습니다. 첫 번째 밤이 시작됩니다.",
    visibility: "public",
  };
}

function createInitialMessage(): TalkMessage {
  return {
    id: "message-1",
    day: 1,
    speakerId: null,
    text: "도시는 잠들고, 각 진영이 조용히 움직이기 시작합니다.",
    kind: "system",
  };
}

export function createGame(options: NewGameOptions): GameState {
  if (options.mode !== "solo" && options.mode !== "duo") {
    ruleError("INVALID_ACTION", "게임 모드는 solo 또는 duo여야 합니다.");
  }

  const seed = normalizeSeed(options.seed);
  let rngState = seed;
  let humanRoles: RoleId[];
  let remainingRoles: RoleId[];
  let duoFaction: Faction | null = null;

  if (options.mode === "duo") {
    const factionDraw = drawIndexFromNumber(rngState, DUO_FACTIONS.length);
    rngState = factionDraw.rngState;
    duoFaction = DUO_FACTIONS[factionDraw.index];
    const selection = takeRolesForFaction(
      [...ROLE_DECK],
      duoFaction,
      2,
      rngState,
    );
    humanRoles = selection.selected;
    remainingRoles = selection.remaining;
    rngState = selection.rngState;
  } else {
    const roleShuffle = shuffleWithRng(ROLE_DECK, rngState);
    rngState = roleShuffle.rngState;
    humanRoles = [roleShuffle.values[0]];
    remainingRoles = roleShuffle.values.slice(1);
  }

  const remainingShuffle = shuffleWithRng(remainingRoles, rngState);
  rngState = remainingShuffle.rngState;
  const assignedRoles = [...humanRoles, ...remainingShuffle.values];

  const templateShuffle = shuffleWithRng(CHARACTER_TEMPLATES, rngState);
  rngState = templateShuffle.rngState;
  const templates = templateShuffle.values;
  const hostName = safePlayerName(options.hostName, "방장");
  const guestName = safePlayerName(options.guestName, "친구");
  const humanCount = options.mode === "duo" ? 2 : 1;

  const characters: Character[] = assignedRoles.map((roleId, index) => {
    const seat = index + 1;
    const template = templates[index];
    const isHost = index === 0;
    const isGuest = options.mode === "duo" && index === 1;
    return {
      id: `p${seat}`,
      seat,
      name: isHost ? hostName : isGuest ? guestName : template.name,
      avatar: template.avatar,
      roleId,
      originalRoleId: roleId,
      faction: ROLE_FACTIONS[roleId],
      hp: STARTING_HP,
      alive: true,
      controller: isHost
        ? "human-host"
        : isGuest
          ? "human-guest"
          : "ai",
      disguisedAs: null,
      converted: false,
    };
  });

  return {
    version: GAME_VERSION,
    seed,
    rngState,
    mode: options.mode,
    day: 1,
    phase: "night",
    characters,
    humanIds: characters.slice(0, humanCount).map((character) => character.id),
    duoFaction,
    pending: emptyPending(),
    cultConversionUsed: false,
    messages: [createInitialMessage()],
    events: [createInitialEvent()],
    winner: null,
    winnerReason: null,
  };
}

function assertPhase(state: GameState, expected: Phase): void {
  if (state.phase === "ended") {
    ruleError("GAME_ENDED", "이미 종료된 게임입니다.");
  }
  if (state.phase !== expected) {
    ruleError(
      "WRONG_PHASE",
      `${expected} 단계에서만 가능한 행동입니다. 현재 단계: ${state.phase}`,
    );
  }
}

function getActor(state: GameState, actorId: string): Character {
  const actor = state.characters.find((character) => character.id === actorId);
  if (!actor) {
    ruleError("ACTOR_NOT_FOUND", `행동 주체를 찾을 수 없습니다: ${actorId}`);
  }
  return actor;
}

function getLivingActor(state: GameState, actorId: string): Character {
  const actor = getActor(state, actorId);
  if (!actor.alive) {
    ruleError("ACTOR_DEAD", `${actor.name}님은 사망하여 행동할 수 없습니다.`);
  }
  return actor;
}

function getLivingTarget(state: GameState, targetId: string): Character {
  const target = state.characters.find((character) => character.id === targetId);
  if (!target) {
    ruleError("TARGET_NOT_FOUND", `대상을 찾을 수 없습니다: ${targetId}`);
  }
  if (!target.alive) {
    ruleError("TARGET_DEAD", `${target.name}님은 이미 사망했습니다.`);
  }
  return target;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function addEvent(
  state: GameState,
  text: string,
  visibility: GameEvent["visibility"] = "public",
  phase: Phase = state.phase,
): void {
  state.events.push({
    id: `event-${state.events.length + 1}`,
    day: state.day,
    phase,
    text,
    visibility,
  });
}

function addSystemMessage(state: GameState, text: string): void {
  state.messages.push({
    id: `message-${state.messages.length + 1}`,
    day: state.day,
    speakerId: null,
    text,
    kind: "system",
  });
}

function aliveCharacters(state: GameState): Character[] {
  return state.characters.filter((character) => character.alive);
}

export function isDuoCitizenProtectedFromConversion(
  state: Pick<GameState, "mode" | "duoFaction" | "humanIds">,
  targetId: string,
): boolean {
  return (
    state.mode === "duo" &&
    state.duoFaction === "citizen" &&
    state.humanIds.includes(targetId)
  );
}

export function getPublicDisplayName(
  state: GameState,
  character: Character,
): string {
  if (character.disguisedAs) {
    const original = state.characters.find(
      (candidate) => candidate.id === character.disguisedAs && candidate.alive,
    );
    if (original) {
      return original.name;
    }
  }
  return character.name;
}

function removeBrokenDisguises(state: GameState): boolean {
  let removed = false;
  for (const character of state.characters) {
    if (!character.disguisedAs) {
      continue;
    }
    const original = state.characters.find(
      (candidate) => candidate.id === character.disguisedAs,
    );
    if (!character.alive || !original?.alive) {
      character.disguisedAs = null;
      removed = true;
    }
  }
  return removed;
}

function markDead(character: Character): void {
  character.hp = 0;
  character.alive = false;
  character.disguisedAs = null;
}

function evaluateWinner(state: GameState): Winner | null {
  const living = aliveCharacters(state);
  if (living.length === 0) {
    return "draw";
  }

  const counts: Record<Faction, number> = {
    citizen: 0,
    mafia: 0,
    cult: 0,
  };
  for (const character of living) {
    counts[character.faction] += 1;
  }

  if (counts.mafia === 0) {
    if (counts.cult === 0) {
      return "citizen";
    }
    if (counts.cult >= counts.citizen) {
      return "cult";
    }
  }
  if (counts.mafia > 0 && counts.citizen === 0 && counts.cult === 0) {
    return "mafia";
  }
  return null;
}

function finishIfWon(state: GameState): boolean {
  const winner = evaluateWinner(state);
  if (!winner) {
    return false;
  }
  state.winner = winner;
  const winnerLabel = WINNER_LABELS[winner];
  state.winnerReason = WINNER_REASONS[winner];
  state.phase = "ended";
  for (const character of state.characters) {
    character.disguisedAs = null;
  }
  addEvent(
    state,
    `${winner === "draw" ? winnerLabel : `${winnerLabel} 승리`} — ${WINNER_REASONS[winner]}`,
    "public",
    "ended",
  );
  addSystemMessage(
    state,
    winner === "draw"
      ? "게임이 무승부로 끝났습니다."
      : `${winnerLabel}이 승리했습니다.`,
  );
  return true;
}

function validateAdvanceRequirements(state: GameState): void {
  if (state.phase === "night") {
    const missingMafia = aliveCharacters(state).filter(
      (character) =>
        character.faction === "mafia" &&
        !hasOwn(state.pending.nightKillVotes, character.id),
    );
    if (missingMafia.length > 0) {
      ruleError(
        "ACTION_REQUIRED",
        `밤 살해 대상을 선택하지 않은 마피아가 있습니다: ${missingMafia.map((character) => character.name).join(", ")}`,
      );
    }
    const leader = aliveCharacters(state).find(
      (character) => character.roleId === "cult_leader",
    );
    if (
      leader &&
      !state.cultConversionUsed &&
      state.pending.cultConvertTarget === undefined
    ) {
      ruleError(
        "ACTION_REQUIRED",
        "교주는 포교 대상 또는 이번 밤 포기를 선택해야 합니다.",
      );
    }
  }

  if (state.phase === "morning") {
    const missingMafia = aliveCharacters(state).filter(
      (character) =>
        character.roleId === "mafia" &&
        !hasOwn(state.pending.disguiseChoices, character.id),
    );
    if (missingMafia.length > 0) {
      ruleError(
        "ACTION_REQUIRED",
        `변신 여부를 선택하지 않은 일반 마피아가 있습니다: ${missingMafia.map((character) => character.name).join(", ")}`,
      );
    }
  }

  if (state.phase === "voting") {
    const missingVoters = aliveCharacters(state).filter(
      (character) => !hasOwn(state.pending.dayVotes, character.id),
    );
    if (missingVoters.length > 0) {
      ruleError(
        "ACTION_REQUIRED",
        `투표하지 않은 생존자가 있습니다: ${missingVoters.map((character) => character.name).join(", ")}`,
      );
    }
  }
}

function resolveNight(state: GameState): void {
  const mafiaVoters = aliveCharacters(state).filter(
    (character) => character.faction === "mafia",
  );
  const voteCounts = new Map<string, number>();
  for (const voter of mafiaVoters) {
    const targetId = state.pending.nightKillVotes[voter.id];
    voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
  }

  if (voteCounts.size > 0) {
    const maxVotes = Math.max(...voteCounts.values());
    const agreedTargets = [...voteCounts.entries()]
      .filter(([, votes]) => votes === maxVotes)
      .map(([targetId]) => targetId);
    if (agreedTargets.length === 1) {
      const victim = state.characters.find(
        (character) => character.id === agreedTargets[0] && character.alive,
      );
      if (victim) {
        markDead(victim);
        addEvent(state, `밤사이 ${victim.name}님이 사망했습니다.`);
      }
    } else {
      addEvent(state, "마피아가 살해 대상에 합의하지 못해 아무도 죽지 않았습니다.");
    }
  }

  removeBrokenDisguises(state);

  const leader = aliveCharacters(state).find(
    (character) => character.roleId === "cult_leader",
  );
  const targetId = state.pending.cultConvertTarget;
  if (leader && !state.cultConversionUsed && targetId !== undefined) {
    if (targetId === null) {
      addEvent(state, "교주가 이번 밤 포교를 보류했습니다.", "cult");
    } else {
      const target = state.characters.find(
        (character) => character.id === targetId,
      );
      if (
        target &&
        isDuoCitizenProtectedFromConversion(state, target.id)
      ) {
        addEvent(
          state,
          "시민 진영 온라인 듀오 참가자는 포교할 수 없습니다.",
          "cult",
        );
      } else {
        state.cultConversionUsed = true;
        if (!target?.alive) {
          addEvent(state, "포교 대상이 생존하지 않아 포교에 실패했습니다.", "cult");
        } else if (target.faction === "citizen") {
          target.roleId = "cultist";
          target.faction = "cult";
          target.converted = true;
          addEvent(state, `${target.name}님을 신도로 포교했습니다.`, "cult");
        } else {
          addEvent(state, "포교가 실패했습니다. 대상의 정체는 알 수 없습니다.", "cult");
        }
      }
    }
  }

  state.pending = emptyPending();
  if (!finishIfWon(state)) {
    state.phase = "dawn";
    addSystemMessage(state, "밤이 끝나고 새벽이 밝았습니다.");
  }
}

function resolveMorning(state: GameState): void {
  const disguisers = aliveCharacters(state).filter(
    (character) => character.roleId === "mafia",
  );
  const reservedTargetIds = new Set(
    state.characters
      .map((character) => character.disguisedAs)
      .filter((targetId): targetId is string => targetId !== null),
  );

  for (const disguiser of disguisers) {
    disguiser.disguisedAs = null;
    if (!state.pending.disguiseChoices[disguiser.id]) {
      addEvent(state, "일반 마피아가 오늘은 변신하지 않기로 했습니다.", "mafia");
      continue;
    }
    const candidates = aliveCharacters(state).filter(
      (character) =>
        character.faction === "citizen" &&
        character.id !== disguiser.id &&
        !reservedTargetIds.has(character.id),
    );
    if (candidates.length === 0) {
      addEvent(state, "복제할 수 있는 생존 시민이 없어 변신하지 못했습니다.", "mafia");
      continue;
    }
    const draw = drawIndexFromNumber(state.rngState, candidates.length);
    state.rngState = draw.rngState;
    const target = candidates[draw.index];
    disguiser.disguisedAs = target.id;
    reservedTargetIds.add(target.id);
    addEvent(state, `${target.name}님의 외형으로 변신했습니다.`, "mafia");
  }

  state.pending.disguiseChoices = {};
  state.phase = "discussion";
  addSystemMessage(state, "아침이 되었습니다. 서로의 말을 듣고 의심되는 사람을 찾으세요.");
}

function resolveVote(state: GameState): void {
  const counts = new Map<string, number>();
  for (const targetId of Object.values(state.pending.dayVotes)) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }
  const maxVotes = counts.size > 0 ? Math.max(...counts.values()) : 0;
  const topTargetIds = [...counts.entries()]
    .filter(([, count]) => count === maxVotes)
    .map(([targetId]) => targetId);

  if (topTargetIds.length !== 1) {
    addEvent(state, "최다 득표자가 동률이라 아무도 피해를 입지 않았습니다.");
    addSystemMessage(state, "투표가 동률로 끝났습니다.");
  } else {
    const target = state.characters.find(
      (character) => character.id === topTargetIds[0] && character.alive,
    );
    if (target) {
      const displayedName = getPublicDisplayName(state, target);
      target.hp = Math.max(0, target.hp - 1);
      if (target.hp > 0) {
        addEvent(
          state,
          `${displayedName}님이 최다 득표로 생명력 1을 잃었습니다.`,
        );
      } else {
        markDead(target);
        addEvent(state, `${displayedName}님이 투표 결과 사망했습니다.`);

        if (target.originalRoleId === "bomber") {
          const blastVictims = Object.entries(state.pending.dayVotes)
            .filter(([, votedTargetId]) => votedTargetId === target.id)
            .map(([voterId]) =>
              state.characters.find(
                (character) => character.id === voterId && character.alive,
              ),
            )
            .filter((character): character is Character => Boolean(character));

          addEvent(
            state,
            `폭탄마가 폭발하여 자신에게 투표한 생존자 ${blastVictims.length}명이 피해를 입었습니다.`,
          );
          for (const victim of blastVictims) {
            victim.hp = Math.max(0, victim.hp - 1);
            if (victim.hp === 0) {
              markDead(victim);
              addEvent(state, `${victim.name}님이 폭발 피해로 사망했습니다.`);
            }
          }
        }
      }
    }
  }

  if (removeBrokenDisguises(state)) {
    addEvent(state, "원본 시민의 죽음과 함께 복제 외형이 해제되었습니다.");
  }
  state.pending.dayVotes = {};
  if (!finishIfWon(state)) {
    state.phase = "dusk";
  }
}

export function advancePhase(state: GameState): GameState {
  if (state.phase === "ended") {
    ruleError("GAME_ENDED", "이미 종료된 게임입니다.");
  }
  const next = cloneGameState(state);
  if (finishIfWon(next)) {
    return next;
  }
  validateAdvanceRequirements(next);

  switch (next.phase) {
    case "role-reveal":
      next.phase = "night";
      addSystemMessage(next, "첫 번째 밤이 시작됩니다.");
      return next;
    case "night":
      resolveNight(next);
      return next;
    case "dawn":
      next.phase = "morning";
      addSystemMessage(next, "아침 변신 행동을 선택할 시간입니다.");
      return next;
    case "morning":
      resolveMorning(next);
      return next;
    case "discussion":
      next.phase = "voting";
      addSystemMessage(next, "토론이 끝났습니다. 한 명에게 투표하세요.");
      return next;
    case "voting":
      resolveVote(next);
      return next;
    case "dusk":
      for (const character of next.characters) {
        character.disguisedAs = null;
      }
      next.day += 1;
      next.phase = "night";
      next.pending = emptyPending();
      addSystemMessage(next, `${next.day}일 차 밤이 시작됩니다.`);
      return next;
    case "ended":
      ruleError("GAME_ENDED", "이미 종료된 게임입니다.");
  }
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.phase === "ended") {
    ruleError("GAME_ENDED", "이미 종료된 게임입니다.");
  }

  if (action.type === "advance") {
    const actor = getActor(state, action.actorId);
    if (actor.controller === "ai") {
      ruleError("INVALID_ROLE", "AI는 수동으로 단계를 진행할 수 없습니다.");
    }
    return advancePhase(state);
  }

  const next = cloneGameState(state);

  switch (action.type) {
    case "night-kill": {
      assertPhase(next, "night");
      const actor = getLivingActor(next, action.actorId);
      const target = getLivingTarget(next, action.targetId);
      if (actor.faction !== "mafia") {
        ruleError("INVALID_ROLE", "마피아팀 생존자만 밤 살해에 참여할 수 있습니다.");
      }
      if (target.faction === "mafia") {
        ruleError("INVALID_TARGET", "같은 마피아팀을 밤 살해 대상으로 삼을 수 없습니다.");
      }
      if (hasOwn(next.pending.nightKillVotes, actor.id)) {
        ruleError("DUPLICATE_ACTION", "이미 밤 살해 대상을 선택했습니다.");
      }
      next.pending.nightKillVotes[actor.id] = target.id;
      return next;
    }
    case "cult-convert": {
      assertPhase(next, "night");
      const actor = getLivingActor(next, action.actorId);
      if (actor.roleId !== "cult_leader") {
        ruleError("INVALID_ROLE", "생존한 교주만 포교할 수 있습니다.");
      }
      if (next.cultConversionUsed) {
        ruleError("DUPLICATE_ACTION", "이번 게임의 포교 기회를 이미 사용했습니다.");
      }
      if (next.pending.cultConvertTarget !== undefined) {
        ruleError("DUPLICATE_ACTION", "이번 밤의 포교 행동을 이미 선택했습니다.");
      }
      if (action.targetId !== null) {
        const target = getLivingTarget(next, action.targetId);
        if (target.id === actor.id || target.faction === "cult") {
          ruleError("INVALID_TARGET", "교주팀 구성원은 포교 대상으로 삼을 수 없습니다.");
        }
        if (
          isDuoCitizenProtectedFromConversion(next, target.id)
        ) {
          ruleError(
            "INVALID_TARGET",
            "시민 진영 온라인 듀오 참가자는 포교 대상으로 삼을 수 없습니다.",
          );
        }
      }
      next.pending.cultConvertTarget = action.targetId;
      return next;
    }
    case "disguise": {
      assertPhase(next, "morning");
      const actor = getLivingActor(next, action.actorId);
      if (actor.roleId !== "mafia") {
        ruleError("INVALID_ROLE", "일반 마피아만 아침에 변신할 수 있습니다.");
      }
      if (hasOwn(next.pending.disguiseChoices, actor.id)) {
        ruleError("DUPLICATE_ACTION", "이미 오늘의 변신 여부를 선택했습니다.");
      }
      next.pending.disguiseChoices[actor.id] = action.use;
      return next;
    }
    case "talk": {
      assertPhase(next, "discussion");
      const actor = getLivingActor(next, action.actorId);
      const text = action.text.trim().replace(/\s+/g, " ");
      if (!text) {
        ruleError("INVALID_ACTION", "빈 발언은 전송할 수 없습니다.");
      }
      if (text.length > MAX_TALK_LENGTH) {
        ruleError(
          "INVALID_ACTION",
          `발언은 ${MAX_TALK_LENGTH}자 이하여야 합니다.`,
        );
      }
      if (action.targetId !== undefined) {
        const target = getLivingTarget(next, action.targetId);
        if (target.id === actor.id) {
          ruleError("INVALID_TARGET", "자기 자신에게 질문할 수 없습니다.");
        }
      }
      next.messages.push({
        id: `message-${next.messages.length + 1}`,
        day: next.day,
        speakerId: actor.id,
        text,
        kind: "speech",
      });
      return next;
    }
    case "vote": {
      assertPhase(next, "voting");
      const actor = getLivingActor(next, action.actorId);
      const target = getLivingTarget(next, action.targetId);
      if (actor.id === target.id) {
        ruleError("INVALID_TARGET", "자기 자신에게 투표할 수 없습니다.");
      }
      if (hasOwn(next.pending.dayVotes, actor.id)) {
        ruleError("DUPLICATE_ACTION", "이미 이번 낮 투표를 완료했습니다.");
      }
      next.pending.dayVotes[actor.id] = target.id;
      return next;
    }
  }
}
