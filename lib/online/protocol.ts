import type {
  Faction,
  GameAction,
  GameEvent,
  Phase,
  PlayerView,
  RoleId,
  TalkMessage,
  Winner,
} from "../game/types";

export const PROTOCOL_VERSION = 1 as const;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PEER_ID_PREFIX = "mafia-game-";
export const JOIN_TIMEOUT_MS = 12_000;
export const RECONNECT_GRACE_MS = 60_000;

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const PHASES = new Set<Phase>([
  "role-reveal",
  "night",
  "dawn",
  "morning",
  "discussion",
  "voting",
  "dusk",
  "ended",
]);
const FACTIONS = new Set<Faction>(["citizen", "mafia", "cult"]);
const WINNERS = new Set<Winner>([
  "citizen",
  "mafia",
  "cult",
  "draw",
]);
const ROLES = new Set<RoleId>([
  "citizen",
  "mafia",
  "bomber",
  "cult_leader",
  "cultist",
]);

export type RoomCode = string & { readonly __roomCode: unique symbol };

export interface MessageEnvelope<K extends string> {
  protocolVersion: typeof PROTOCOL_VERSION;
  kind: K;
  seq: number;
  actionId: string;
  sentAt: number;
}

export interface JoinMessage extends MessageEnvelope<"join"> {
  roomCode: RoomCode;
  playerName: string;
  resumeToken?: string;
}

export interface IntentMessage extends MessageEnvelope<"intent"> {
  action: GameAction;
}

export interface PingMessage extends MessageEnvelope<"ping"> {
  nonce: string;
}

export interface PongMessage extends MessageEnvelope<"pong"> {
  nonce: string;
}

export interface WelcomeMessage extends MessageEnvelope<"welcome"> {
  playerId: string;
  resumeToken: string;
  view: PlayerView;
}

export interface SnapshotMessage extends MessageEnvelope<"snapshot"> {
  view: PlayerView;
  ackActionId?: string;
}

export type SessionEventCode =
  | "guest-reconnecting"
  | "guest-reconnected"
  | "guest-replaced-by-ai"
  | "host-disconnected"
  | "game-ended";

export interface SessionEventMessage extends MessageEnvelope<"session-event"> {
  event: SessionEventCode;
  detail?: string;
  reconnectDeadlineAt?: number;
}

export type RejectCode =
  | "room-full"
  | "invalid-message"
  | "protocol-mismatch"
  | "invalid-resume-token"
  | "session-ended";

export interface RejectMessage extends MessageEnvelope<"reject"> {
  code: RejectCode;
  detail: string;
  rejectedActionId?: string;
}

export type GuestMessage = JoinMessage | IntentMessage | PingMessage | PongMessage;

export type HostMessage =
  | WelcomeMessage
  | SnapshotMessage
  | SessionEventMessage
  | RejectMessage
  | PingMessage
  | PongMessage;

export type ProtocolMessage = GuestMessage | HostMessage;

type GeneratedEnvelopeField =
  | "protocolVersion"
  | "seq"
  | "actionId"
  | "sentAt";

export type MessageWithoutEnvelope<T extends ProtocolMessage> = Omit<
  T,
  GeneratedEnvelopeField
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSafeSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function hasValidEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.protocolVersion === PROTOCOL_VERSION &&
    isNonEmptyString(value.kind, 32) &&
    isSafeSequence(value.seq) &&
    isNonEmptyString(value.actionId, 128) &&
    isTimestamp(value.sentAt)
  );
}

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && PHASES.has(value as Phase);
}

function isFaction(value: unknown): value is Faction {
  return typeof value === "string" && FACTIONS.has(value as Faction);
}

function isWinner(value: unknown): value is Winner {
  return typeof value === "string" && WINNERS.has(value as Winner);
}

function isRole(value: unknown): value is RoleId {
  return typeof value === "string" && ROLES.has(value as RoleId);
}

function isTalkMessage(value: unknown): value is TalkMessage {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isSafeSequence(value.day) &&
    (value.speakerId === null || isNonEmptyString(value.speakerId)) &&
    typeof value.text === "string" &&
    (value.kind === "speech" || value.kind === "system")
  );
}

function isGameEvent(value: unknown): value is GameEvent {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isSafeSequence(value.day) &&
    isPhase(value.phase) &&
    typeof value.text === "string" &&
    (value.visibility === "public" ||
      value.visibility === "mafia" ||
      value.visibility === "cult" ||
      value.visibility === "host")
  );
}

function isPublicCharacter(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isSafeSequence(value.seat) &&
    isNonEmptyString(value.displayName, 80) &&
    typeof value.avatar === "string" &&
    typeof value.hp === "number" &&
    Number.isFinite(value.hp) &&
    typeof value.alive === "boolean" &&
    typeof value.isDisguisedDouble === "boolean"
  );
}

function isPrivateCharacterSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name, 80) &&
    isRole(value.roleId) &&
    isFaction(value.faction) &&
    typeof value.alive === "boolean"
  );
}

export function isPlayerView(value: unknown): value is PlayerView {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    isSafeSequence(value.revision) &&
    isNonEmptyString(value.playerId) &&
    (value.partnerId === null || isNonEmptyString(value.partnerId)) &&
    isSafeSequence(value.day) &&
    isPhase(value.phase) &&
    (value.mode === "solo" || value.mode === "duo") &&
    Array.isArray(value.characters) &&
    value.characters.every(isPublicCharacter) &&
    isPrivateCharacterSummary(value.self) &&
    typeof value.selfAbilityUsed === "boolean" &&
    (value.partner === null || isPrivateCharacterSummary(value.partner)) &&
    Array.isArray(value.messages) &&
    value.messages.every(isTalkMessage) &&
    Array.isArray(value.publicEvents) &&
    value.publicEvents.every(isGameEvent) &&
    (value.winner === null || isWinner(value.winner)) &&
    isNullableString(value.winnerReason)
  );
}

export function isGameAction(value: unknown): value is GameAction {
  if (!isRecord(value) || !isNonEmptyString(value.actorId)) return false;

  switch (value.type) {
    case "advance":
      return true;
    case "night-kill":
    case "vote":
      return isNonEmptyString(value.targetId);
    case "cult-convert":
      return value.targetId === null || isNonEmptyString(value.targetId);
    case "disguise":
      return typeof value.use === "boolean";
    case "talk":
      return (
        typeof value.text === "string" &&
        value.text.length <= 1_000 &&
        (value.targetId === undefined || isNonEmptyString(value.targetId))
      );
    default:
      return false;
  }
}

function isSessionEventCode(value: unknown): value is SessionEventCode {
  return (
    value === "guest-reconnecting" ||
    value === "guest-reconnected" ||
    value === "guest-replaced-by-ai" ||
    value === "host-disconnected" ||
    value === "game-ended"
  );
}

function isRejectCode(value: unknown): value is RejectCode {
  return (
    value === "room-full" ||
    value === "invalid-message" ||
    value === "protocol-mismatch" ||
    value === "invalid-resume-token" ||
    value === "session-ended"
  );
}

export function isProtocolMessage(value: unknown): value is ProtocolMessage {
  if (!isRecord(value) || !hasValidEnvelope(value)) return false;

  switch (value.kind) {
    case "join": {
      const code =
        typeof value.roomCode === "string"
          ? normalizeRoomCode(value.roomCode)
          : null;
      return (
        code !== null &&
        code === value.roomCode &&
        isNonEmptyString(value.playerName, 24) &&
        value.playerName.trim() === value.playerName &&
        (value.resumeToken === undefined ||
          isNonEmptyString(value.resumeToken, 128))
      );
    }
    case "intent":
      return isGameAction(value.action);
    case "ping":
    case "pong":
      return isNonEmptyString(value.nonce, 128);
    case "welcome":
      return (
        isNonEmptyString(value.playerId) &&
        isNonEmptyString(value.resumeToken, 128) &&
        isPlayerView(value.view)
      );
    case "snapshot":
      return (
        isPlayerView(value.view) &&
        (value.ackActionId === undefined ||
          isNonEmptyString(value.ackActionId, 128))
      );
    case "session-event":
      return (
        isSessionEventCode(value.event) &&
        (value.detail === undefined || typeof value.detail === "string") &&
        (value.reconnectDeadlineAt === undefined ||
          isTimestamp(value.reconnectDeadlineAt))
      );
    case "reject":
      return (
        isRejectCode(value.code) &&
        typeof value.detail === "string" &&
        value.detail.length <= 500 &&
        (value.rejectedActionId === undefined ||
          isNonEmptyString(value.rejectedActionId, 128))
      );
    default:
      return false;
  }
}

export function isGuestMessage(value: unknown): value is GuestMessage {
  return (
    isProtocolMessage(value) &&
    (value.kind === "join" ||
      value.kind === "intent" ||
      value.kind === "ping" ||
      value.kind === "pong")
  );
}

export function isHostMessage(value: unknown): value is HostMessage {
  return (
    isProtocolMessage(value) &&
    (value.kind === "welcome" ||
      value.kind === "snapshot" ||
      value.kind === "session-event" ||
      value.kind === "reject" ||
      value.kind === "ping" ||
      value.kind === "pong")
  );
}

/**
 * User-entered room codes may contain spaces or hyphens for readability.
 * Ambiguous glyphs (0/O/1/I) and every other symbol are rejected.
 */
export function normalizeRoomCode(input: string): RoomCode | null {
  const normalized = input.toUpperCase().replace(/[\s-]+/g, "");
  return ROOM_CODE_PATTERN.test(normalized)
    ? (normalized as RoomCode)
    : null;
}

export function requireRoomCode(input: string): RoomCode {
  const normalized = normalizeRoomCode(input);
  if (normalized === null) {
    throw new Error(
      "방 코드는 0/O/1/I를 제외한 영문 대문자와 숫자 6자리여야 합니다.",
    );
  }
  return normalized;
}

export function isValidRoomCode(input: string): input is RoomCode {
  return normalizeRoomCode(input) === input;
}

export function generateRoomCode(
  random: () => number = Math.random,
): RoomCode {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const sample = random();
    const safeSample =
      Number.isFinite(sample) && sample >= 0 && sample < 1 ? sample : 0;
    const alphabetIndex = Math.floor(safeSample * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[alphabetIndex];
  }
  return code as RoomCode;
}

export function roomCodeToPeerId(roomCode: string): string {
  return `${PEER_ID_PREFIX}${requireRoomCode(roomCode).toLowerCase()}`;
}

export function createActionId(prefix = "action"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}:${uuid}`;

  const entropy = Math.random().toString(36).slice(2);
  return `${prefix}:${Date.now().toString(36)}:${entropy}`;
}

export function createResumeToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) {
    throw new Error("보안 재접속 토큰을 생성할 수 없는 환경입니다.");
  }
  return `resume:${uuid}`;
}

export function createMessage<T extends ProtocolMessage>(
  message: MessageWithoutEnvelope<T>,
  envelope: {
    seq: number;
    actionId?: string;
    sentAt?: number;
  },
): T {
  if (!isSafeSequence(envelope.seq)) {
    throw new RangeError("seq must be a non-negative safe integer.");
  }

  return {
    ...message,
    protocolVersion: PROTOCOL_VERSION,
    seq: envelope.seq,
    actionId: envelope.actionId ?? createActionId(message.kind),
    sentAt: envelope.sentAt ?? Date.now(),
  } as T;
}
