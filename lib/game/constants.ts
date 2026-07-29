import type { Faction, Phase, RoleId, Winner } from "./types";

export const GAME_VERSION = 1 as const;
export const PLAYER_COUNT = 9;
export const STARTING_HP = 2;
export const MAX_TALK_LENGTH = 280;
export const DEFAULT_SEED = 0x4d414649;

export const ROLE_COUNTS: Readonly<Record<RoleId, number>> = {
  citizen: 5,
  mafia: 1,
  bomber: 1,
  cult_leader: 1,
  cultist: 1,
};

export const ROLE_FACTIONS: Readonly<Record<RoleId, Faction>> = {
  citizen: "citizen",
  mafia: "mafia",
  bomber: "mafia",
  cult_leader: "cult",
  cultist: "cult",
};

export const ROLE_DECK: readonly RoleId[] = [
  "citizen",
  "citizen",
  "citizen",
  "citizen",
  "citizen",
  "mafia",
  "bomber",
  "cult_leader",
  "cultist",
];

export const DUO_FACTIONS: readonly Faction[] = [
  "citizen",
  "mafia",
  "cult",
];

export const CHARACTER_TEMPLATES: ReadonlyArray<{
  name: string;
  avatar: string;
}> = [
  { name: "서윤", avatar: "🕵️" },
  { name: "도윤", avatar: "🎩" },
  { name: "하린", avatar: "🧥" },
  { name: "준호", avatar: "🕶️" },
  { name: "수아", avatar: "🌹" },
  { name: "민재", avatar: "🗝️" },
  { name: "예린", avatar: "🦊" },
  { name: "태오", avatar: "🃏" },
  { name: "지안", avatar: "🌙" },
];

export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  "role-reveal": "역할 확인",
  night: "밤",
  dawn: "새벽",
  morning: "아침",
  discussion: "토론",
  voting: "투표",
  dusk: "해질녘",
  ended: "게임 종료",
};

export const WINNER_LABELS: Readonly<Record<Winner, string>> = {
  citizen: "시민팀",
  mafia: "마피아팀",
  cult: "교주팀",
  draw: "무승부",
};

export const WINNER_REASONS: Readonly<Record<Winner, string>> = {
  citizen: "마피아팀과 교주팀이 모두 전멸했습니다.",
  mafia: "시민팀과 교주팀이 모두 전멸했습니다.",
  cult: "마피아팀이 전멸했고 교주팀 생존자가 시민팀 이상입니다.",
  draw: "모든 생존자가 사망하여 무승부로 끝났습니다.",
};
