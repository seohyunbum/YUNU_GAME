export type Faction = "citizen" | "mafia" | "cult";
export type Winner = Faction | "draw";

export type RoleId =
  | "citizen"
  | "mafia"
  | "bomber"
  | "cult_leader"
  | "cultist";

export type Controller = "human-host" | "human-guest" | "ai";

export type Phase =
  | "role-reveal"
  | "night"
  | "dawn"
  | "morning"
  | "discussion"
  | "voting"
  | "dusk"
  | "ended";

export interface Character {
  id: string;
  seat: number;
  name: string;
  avatar: string;
  roleId: RoleId;
  originalRoleId: RoleId;
  faction: Faction;
  hp: number;
  alive: boolean;
  controller: Controller;
  disguisedAs: string | null;
  converted: boolean;
}

export interface TalkMessage {
  id: string;
  day: number;
  speakerId: string | null;
  text: string;
  kind: "speech" | "system";
}

export interface GameEvent {
  id: string;
  day: number;
  phase: Phase;
  text: string;
  visibility: "public" | "mafia" | "cult" | "host";
}

export interface PendingActions {
  nightKillVotes: Record<string, string>;
  cultConvertTarget: string | null | undefined;
  disguiseChoices: Record<string, boolean>;
  dayVotes: Record<string, string>;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  mode: "solo" | "duo";
  day: number;
  phase: Phase;
  characters: Character[];
  humanIds: string[];
  duoFaction: Faction | null;
  pending: PendingActions;
  cultConversionUsed: boolean;
  messages: TalkMessage[];
  events: GameEvent[];
  winner: Winner | null;
  winnerReason: string | null;
}

export type GameAction =
  | { type: "advance"; actorId: string }
  | { type: "night-kill"; actorId: string; targetId: string }
  | { type: "cult-convert"; actorId: string; targetId: string | null }
  | { type: "disguise"; actorId: string; use: boolean }
  | {
      type: "talk";
      actorId: string;
      text: string;
      targetId?: string;
    }
  | { type: "vote"; actorId: string; targetId: string };

export interface NewGameOptions {
  mode: "solo" | "duo";
  seed?: number;
  hostName?: string;
  guestName?: string;
}

export interface PublicCharacter {
  id: string;
  seat: number;
  displayName: string;
  avatar: string;
  hp: number;
  alive: boolean;
  isDisguisedDouble: boolean;
}

export interface PlayerView {
  version: 1;
  revision: number;
  playerId: string;
  partnerId: string | null;
  day: number;
  phase: Phase;
  mode: "solo" | "duo";
  characters: PublicCharacter[];
  self: Pick<Character, "id" | "name" | "roleId" | "faction" | "alive">;
  selfAbilityUsed: boolean;
  partner:
    | Pick<Character, "id" | "name" | "roleId" | "faction" | "alive">
    | null;
  messages: TalkMessage[];
  publicEvents: GameEvent[];
  winner: Winner | null;
  winnerReason: string | null;
}
