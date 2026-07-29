import type {
  Character,
  GameAction,
  GameEvent,
  GameState,
  PlayerView,
} from "../game/types";
import {
  PROTOCOL_VERSION,
  RECONNECT_GRACE_MS,
  type IntentMessage,
} from "./protocol";

export type ApplyGameAction = (
  state: GameState,
  action: GameAction,
) => GameState;

export type BuildPlayerView = (
  state: GameState,
  playerId: string,
  revision: number,
) => PlayerView;

export interface HostSessionOptions {
  initialState: GameState;
  hostPlayerId: string;
  guestPlayerId: string;
  applyAction: ApplyGameAction;
  buildView: BuildPlayerView;
  initialRevision?: number;
  reconnectGraceMs?: number;
  dedupeCapacity?: number;
}

export type HostSessionEvent =
  | {
      type: "guest-disconnected";
      playerId: string;
      reconnectDeadlineAt: number;
    }
  | {
      type: "guest-reconnected";
      playerId: string;
    }
  | {
      type: "guest-replaced-by-ai";
      playerId: string;
      revision: number;
    };

export type IntentRejectReason =
  | "protocol-mismatch"
  | "stale-seq"
  | "invalid-actor"
  | "guest-not-connected"
  | "apply-error";

export interface HostSessionResult {
  status: "applied" | "duplicate" | "rejected";
  revision: number;
  reason?: IntentRejectReason;
  error?: unknown;
  hostView: PlayerView;
  guestView: PlayerView;
}

export interface GuestConnectionResult {
  accepted: boolean;
  event?: HostSessionEvent;
}

const DEFAULT_DEDUPE_CAPACITY = 2_048;

/**
 * Authoritative, transport-agnostic online session coordinator.
 *
 * The class deliberately owns no sockets and starts no timers. Callers feed it
 * guest intents and clock values, which keeps reducer/deduplication behavior
 * deterministic and straightforward to test.
 */
export class HostSession {
  private state: GameState;
  private readonly hostPlayerId: string;
  private readonly guestPlayerId: string;
  private readonly applyAction: ApplyGameAction;
  private readonly buildView: BuildPlayerView;
  private readonly reconnectGraceMs: number;
  private readonly dedupeCapacity: number;
  private readonly seenActionIds = new Map<string, number>();
  private currentRevision: number;
  private lastGuestSeq = -1;
  private guestStatus: "connected" | "reconnecting" | "replaced" =
    "connected";
  private reconnectDeadlineAt: number | null = null;

  constructor(options: HostSessionOptions) {
    if (!Number.isSafeInteger(options.initialRevision ?? 0)) {
      throw new RangeError("initialRevision must be a safe integer.");
    }
    if ((options.initialRevision ?? 0) < 0) {
      throw new RangeError("initialRevision cannot be negative.");
    }
    if (options.hostPlayerId === options.guestPlayerId) {
      throw new Error("Host and guest must be different players.");
    }
    if (!hasCharacter(options.initialState, options.hostPlayerId)) {
      throw new Error(`Unknown host player: ${options.hostPlayerId}`);
    }
    if (!hasCharacter(options.initialState, options.guestPlayerId)) {
      throw new Error(`Unknown guest player: ${options.guestPlayerId}`);
    }

    this.state = options.initialState;
    this.hostPlayerId = options.hostPlayerId;
    this.guestPlayerId = options.guestPlayerId;
    this.applyAction = options.applyAction;
    this.buildView = options.buildView;
    this.currentRevision = options.initialRevision ?? 0;
    this.reconnectGraceMs =
      options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
    this.dedupeCapacity =
      options.dedupeCapacity ?? DEFAULT_DEDUPE_CAPACITY;

    if (this.reconnectGraceMs < 0) {
      throw new RangeError("reconnectGraceMs cannot be negative.");
    }
    if (
      !Number.isSafeInteger(this.dedupeCapacity) ||
      this.dedupeCapacity < 1
    ) {
      throw new RangeError("dedupeCapacity must be a positive integer.");
    }
  }

  get revision(): number {
    return this.currentRevision;
  }

  get guestConnectionState(): "connected" | "reconnecting" | "replaced" {
    return this.guestStatus;
  }

  get guestReconnectDeadlineAt(): number | null {
    return this.reconnectDeadlineAt;
  }

  getState(): GameState {
    return this.state;
  }

  getView(playerId: string): PlayerView {
    if (playerId !== this.hostPlayerId && playerId !== this.guestPlayerId) {
      throw new Error(`Player is not part of this online session: ${playerId}`);
    }

    const view = this.buildView(this.state, playerId, this.currentRevision);
    return view.revision === this.currentRevision
      ? view
      : { ...view, revision: this.currentRevision };
  }

  getViews(): { hostView: PlayerView; guestView: PlayerView } {
    return {
      hostView: this.getView(this.hostPlayerId),
      guestView: this.getView(this.guestPlayerId),
    };
  }

  receiveGuestIntent(message: IntentMessage): HostSessionResult {
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      return this.result("rejected", "protocol-mismatch");
    }

    if (this.guestStatus !== "connected") {
      return this.result("rejected", "guest-not-connected");
    }
    if (message.action.actorId !== this.guestPlayerId) {
      return this.result("rejected", "invalid-actor");
    }

    const seenRevision = this.seenActionIds.get(message.actionId);
    if (seenRevision !== undefined) {
      return this.result("duplicate");
    }

    if (message.seq <= this.lastGuestSeq) {
      return this.result("rejected", "stale-seq");
    }

    this.lastGuestSeq = message.seq;
    this.rememberAction(message.actionId);

    try {
      this.state = this.applyAction(this.state, message.action);
      this.currentRevision += 1;
      this.seenActionIds.set(message.actionId, this.currentRevision);
      return this.result("applied");
    } catch (error) {
      return this.result("rejected", "apply-error", error);
    }
  }

  applyHostAction(action: GameAction, actionId: string): HostSessionResult {
    if (this.seenActionIds.has(actionId)) {
      return this.result("duplicate");
    }

    this.rememberAction(actionId);
    if (action.actorId !== this.hostPlayerId) {
      return this.result("rejected", "invalid-actor");
    }

    try {
      this.state = this.applyAction(this.state, action);
      this.currentRevision += 1;
      this.seenActionIds.set(actionId, this.currentRevision);
      return this.result("applied");
    } catch (error) {
      return this.result("rejected", "apply-error", error);
    }
  }

  markGuestDisconnected(nowMs: number): HostSessionEvent | null {
    assertClock(nowMs);
    if (this.guestStatus !== "connected") return null;

    this.guestStatus = "reconnecting";
    this.reconnectDeadlineAt = nowMs + this.reconnectGraceMs;
    return {
      type: "guest-disconnected",
      playerId: this.guestPlayerId,
      reconnectDeadlineAt: this.reconnectDeadlineAt,
    };
  }

  markGuestReconnected(nowMs: number): GuestConnectionResult {
    assertClock(nowMs);
    const replacement = this.advanceTime(nowMs);
    if (replacement || this.guestStatus === "replaced") {
      return { accepted: false, event: replacement ?? undefined };
    }
    if (this.guestStatus === "connected") return { accepted: true };

    this.guestStatus = "connected";
    this.lastGuestSeq = -1;
    this.reconnectDeadlineAt = null;
    return {
      accepted: true,
      event: {
        type: "guest-reconnected",
        playerId: this.guestPlayerId,
      },
    };
  }

  advanceTime(nowMs: number): HostSessionEvent | null {
    assertClock(nowMs);
    if (
      this.guestStatus !== "reconnecting" ||
      this.reconnectDeadlineAt === null ||
      nowMs < this.reconnectDeadlineAt
    ) {
      return null;
    }

    const replacementEvent = makeReplacementGameEvent(
      this.state,
      this.guestPlayerId,
      this.currentRevision + 1,
    );
    this.state = {
      ...this.state,
      characters: this.state.characters.map((character) =>
        character.id === this.guestPlayerId
          ? { ...character, controller: "ai" }
          : character,
      ),
      events: [...this.state.events, replacementEvent],
    };
    this.currentRevision += 1;
    this.guestStatus = "replaced";
    this.reconnectDeadlineAt = null;

    return {
      type: "guest-replaced-by-ai",
      playerId: this.guestPlayerId,
      revision: this.currentRevision,
    };
  }

  private rememberAction(actionId: string): void {
    this.seenActionIds.set(actionId, this.currentRevision);
    while (this.seenActionIds.size > this.dedupeCapacity) {
      const oldest = this.seenActionIds.keys().next().value;
      if (oldest === undefined) break;
      this.seenActionIds.delete(oldest);
    }
  }

  private result(
    status: HostSessionResult["status"],
    reason?: IntentRejectReason,
    error?: unknown,
  ): HostSessionResult {
    return {
      status,
      revision: this.currentRevision,
      reason,
      error,
      ...this.getViews(),
    };
  }
}

function hasCharacter(state: GameState, playerId: string): boolean {
  return state.characters.some((character) => character.id === playerId);
}

function assertClock(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("Clock values must be finite and non-negative.");
  }
}

function makeReplacementGameEvent(
  state: GameState,
  guestPlayerId: string,
  revision: number,
): GameEvent {
  const guest: Character | undefined = state.characters.find(
    (character) => character.id === guestPlayerId,
  );
  return {
    id: `online-ai-${guestPlayerId}-${revision}`,
    day: state.day,
    phase: state.phase,
    text: `${guest?.name ?? "게스트"}님의 연결이 끊겨 AI가 대신 플레이합니다.`,
    visibility: "public",
  };
}
