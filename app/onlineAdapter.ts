"use client";

import {
  HostSession,
  closePeerRoom,
  createMessage,
  createPeerRoom,
  createResumeToken,
  joinPeerRoom,
  type IntentMessage,
  type JoinMessage,
  type PeerRoom,
  type PeerRoomEvent,
  type PeerRoomStatus,
  type RejectMessage,
  type SnapshotMessage,
  type WelcomeMessage,
} from "@/lib/online";
import {
  applyAction,
  autoPlayAi,
  advancePhase,
  createGame,
  getPlayerView,
  type Character,
  type GameAction,
  type GameState,
  type PendingActions,
  type PlayerView,
} from "@/lib/game";

export type OnlineStatus =
  | "disconnected"
  | "connecting"
  | "waiting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface OnlineSnapshot {
  game: GameState;
  viewerId: string;
  revision: number;
}

export type OnlineSessionEvent =
  | { type: "snapshot"; snapshot: OnlineSnapshot }
  | { type: "status"; status: OnlineStatus }
  | { type: "guest"; connected: boolean; name?: string }
  | { type: "host-ended"; message: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

export interface OnlineGameSession {
  readonly role: "host" | "guest";
  readonly roomCode: string;
  readonly status: OnlineStatus;
  readonly guestConnected: boolean;
  readonly peerName: string | null;
  subscribe(listener: (event: OnlineSessionEvent) => void): () => void;
  start(hostName: string): void;
  dispatch(action: GameAction): void;
  advance(): void;
  close(): void;
}

type OnlineListener = (event: OnlineSessionEvent) => void;

function mapStatus(status: PeerRoomStatus): OnlineStatus {
  switch (status) {
    case "opening":
      return "connecting";
    case "waiting":
      return "waiting";
    case "connected":
      return "connected";
    case "reconnecting":
      return "reconnecting";
    case "guest-replaced":
    case "host-disconnected":
    case "closed":
      return "closed";
  }
}

function sessionReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "advance") {
    return autoPlayAi(advancePhase(autoPlayAi(state)));
  }
  return autoPlayAi(applyAction(state, action));
}

function emptyPending(): PendingActions {
  return {
    nightKillVotes: {},
    cultConvertTarget: undefined,
    disguiseChoices: {},
    dayVotes: {},
  };
}

const RESUME_TOKEN_STORAGE_PREFIX = "mafia-game:resume:";

function resumeTokenStorageKey(roomCode: string): string {
  return `${RESUME_TOKEN_STORAGE_PREFIX}${roomCode}`;
}

export function readStoredResumeToken(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(resumeTokenStorageKey(roomCode));
  } catch {
    return null;
  }
}

export function storeResumeToken(roomCode: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(resumeTokenStorageKey(roomCode), token);
  } catch {
    // Storage may be disabled. The in-memory token still works until reload.
  }
}

function clearStoredResumeToken(roomCode: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(resumeTokenStorageKey(roomCode));
  } catch {
    // Ignore unavailable storage.
  }
}

function characterFromView(
  view: PlayerView,
  character: PlayerView["characters"][number],
): Character {
  const privateSummary =
    character.id === view.self.id
      ? view.self
      : character.id === view.partner?.id
        ? view.partner
        : null;
  const roleId = privateSummary?.roleId ?? "citizen";
  const faction = privateSummary?.faction ?? "citizen";

  return {
    id: character.id,
    seat: character.seat,
    name: character.displayName,
    avatar: character.avatar,
    roleId,
    originalRoleId: roleId,
    faction,
    hp: character.hp,
    alive: character.alive,
    controller:
      character.id === view.self.id
        ? "human-guest"
        : character.id === view.partnerId
          ? "human-host"
          : "ai",
    disguisedAs: null,
    converted: roleId === "cultist",
  };
}

/**
 * Guests receive a privacy-filtered PlayerView rather than the authoritative
 * state. This shadow is only used to render common UI; all rule decisions stay
 * on the host.
 */
export function shadowStateFromView(
  view: PlayerView,
  previous: GameState | null,
  cultConversionUsed: boolean,
): GameState {
  const samePhase =
    previous?.day === view.day && previous.phase === view.phase;
  return {
    version: 1,
    seed: previous?.seed ?? 1,
    rngState: previous?.rngState ?? 1,
    mode: "duo",
    day: view.day,
    phase: view.phase,
    characters: view.characters.map((character) =>
      characterFromView(view, character),
    ),
    humanIds: [
      view.self.id,
      ...(view.partnerId === null ? [] : [view.partnerId]),
    ],
    duoFaction: previous?.duoFaction ?? view.self.faction,
    pending: samePhase ? previous.pending : emptyPending(),
    cultConversionUsed: cultConversionUsed || view.selfAbilityUsed,
    messages: view.messages,
    events: view.publicEvents,
    winner: view.winner,
    winnerReason: view.winnerReason,
  };
}

function hasOptimisticPending(action: GameAction): boolean {
  return (
    action.type === "night-kill" ||
    action.type === "cult-convert" ||
    action.type === "disguise" ||
    action.type === "vote"
  );
}

interface PendingGuestAction {
  actionId: string;
  previousSnapshot: OnlineSnapshot;
  marksCultConversionUsed: boolean;
}

function markGuestPending(
  state: GameState,
  action: GameAction,
): GameState {
  const pending: PendingActions = {
    nightKillVotes: { ...state.pending.nightKillVotes },
    cultConvertTarget: state.pending.cultConvertTarget,
    disguiseChoices: { ...state.pending.disguiseChoices },
    dayVotes: { ...state.pending.dayVotes },
  };
  if (action.type === "night-kill") {
    pending.nightKillVotes[action.actorId] = action.targetId;
  } else if (action.type === "cult-convert") {
    pending.cultConvertTarget = action.targetId;
  } else if (action.type === "disguise") {
    pending.disguiseChoices[action.actorId] = action.use;
  } else if (action.type === "vote") {
    pending.dayVotes[action.actorId] = action.targetId;
  }
  return { ...state, pending };
}

export class OnlineSessionAdapter implements OnlineGameSession {
  readonly role: "host" | "guest";
  readonly roomCode: string;
  private readonly room: PeerRoom;
  private readonly localName: string;
  private readonly listeners = new Set<OnlineListener>();
  private unsubscribeRoom: (() => void) | null = null;
  private hostSession: HostSession | null = null;
  private guestPlayerId: string | null = null;
  private guestName: string | null = null;
  private resumeToken: string | null;
  private currentStatus: OnlineStatus;
  private connectedGuest = false;
  private seq = 0;
  private lastSnapshot: OnlineSnapshot | null = null;
  private guestShadow: GameState | null = null;
  private guestCultConversionUsed = false;
  private pendingGuestAction: PendingGuestAction | null = null;
  private closed = false;

  constructor(
    room: PeerRoom,
    localName: string,
    resumeToken: string | null = null,
  ) {
    this.room = room;
    this.role = room.role;
    this.roomCode = String(room.roomCode);
    this.localName = localName;
    this.resumeToken = resumeToken;
    this.currentStatus = mapStatus(room.status);
    this.unsubscribeRoom = room.subscribe((event) =>
      this.handleRoomEvent(event),
    );

    if (this.role === "guest") {
      this.sendJoin();
    }
  }

  get status(): OnlineStatus {
    return this.currentStatus;
  }

  get guestConnected(): boolean {
    return this.connectedGuest;
  }

  get peerName(): string | null {
    return this.guestName;
  }

  subscribe(listener: OnlineListener): () => void {
    this.listeners.add(listener);
    listener({ type: "status", status: this.currentStatus });
    listener({
      type: "guest",
      connected: this.connectedGuest,
      name: this.guestName ?? undefined,
    });
    if (this.lastSnapshot) {
      listener({ type: "snapshot", snapshot: this.lastSnapshot });
    }
    return () => this.listeners.delete(listener);
  }

  start(hostName: string): void {
    if (this.role !== "host") {
      throw new Error("온라인 게임은 방장만 시작할 수 있습니다.");
    }
    if (!this.connectedGuest || !this.guestName) {
      throw new Error("참가자가 연결된 뒤 게임을 시작해 주세요.");
    }

    const resumeToken = createResumeToken();
    const initialState = autoPlayAi(
      createGame({
        mode: "duo",
        hostName: hostName.trim() || this.localName,
        guestName: this.guestName,
        seed: Math.floor(Math.random() * 2_147_483_646) + 1,
      }),
    );
    const [hostPlayerId, guestPlayerId] = initialState.humanIds;
    if (!hostPlayerId || !guestPlayerId) {
      throw new Error("온라인 플레이어 좌석을 배정하지 못했습니다.");
    }

    this.guestPlayerId = guestPlayerId;
    this.resumeToken = resumeToken;
    this.hostSession = new HostSession({
      initialState,
      hostPlayerId,
      guestPlayerId,
      applyAction: sessionReducer,
      buildView: getPlayerView,
      initialRevision: 1,
    });

    const views = this.hostSession.getViews();
    const welcome = createMessage<WelcomeMessage>(
      {
        kind: "welcome",
        playerId: guestPlayerId,
        resumeToken,
        view: views.guestView,
      },
      { seq: this.nextSeq() },
    );
    if (!this.room.send(welcome)) {
      throw new Error("참가자에게 게임 정보를 보내지 못했습니다.");
    }
    this.publishHostSnapshot(views.hostView);
  }

  dispatch(action: GameAction): void {
    if (this.role === "host") {
      if (!this.hostSession) {
        throw new Error("먼저 온라인 게임을 시작해 주세요.");
      }
      const result = this.hostSession.applyHostAction(
        action,
        `host:${this.nextSeq()}:${Date.now()}`,
      );
      if (result.status === "rejected") {
        throw result.error instanceof Error
          ? result.error
          : new Error("선택을 적용할 수 없습니다.");
      }
      this.publishHostSnapshot(result.hostView);
      this.sendGuestSnapshot(result.guestView);
      return;
    }

    if (!this.guestPlayerId) {
      throw new Error("방장이 아직 역할을 배정하지 않았습니다.");
    }
    if (action.actorId !== this.guestPlayerId) {
      throw new Error("다른 플레이어의 행동을 보낼 수 없습니다.");
    }

    const intent = createMessage<IntentMessage>(
      { kind: "intent", action },
      { seq: this.nextSeq() },
    );
    if (!this.room.send(intent)) {
      throw new Error("방장과 연결이 끊겨 선택을 보내지 못했습니다.");
    }
    if (
      hasOptimisticPending(action) &&
      this.guestShadow &&
      this.lastSnapshot
    ) {
      this.pendingGuestAction = {
        actionId: intent.actionId,
        previousSnapshot: this.lastSnapshot,
        marksCultConversionUsed: action.type === "cult-convert",
      };
      this.guestShadow = markGuestPending(this.guestShadow, action);
      this.publish({
        game: this.guestShadow,
        viewerId: this.lastSnapshot.viewerId,
        revision: this.lastSnapshot.revision,
      });
    }
  }

  advance(): void {
    const actorId =
      this.role === "host"
        ? this.hostSession?.getViews().hostView.playerId
        : this.guestPlayerId;
    if (!actorId) {
      throw new Error("게임이 시작된 뒤 단계를 진행할 수 있습니다.");
    }
    this.dispatch({ type: "advance", actorId });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribeRoom?.();
    this.unsubscribeRoom = null;
    closePeerRoom(this.room, "ui-closed");
    this.currentStatus = "closed";
    this.emit({ type: "status", status: "closed" });
    this.listeners.clear();
  }

  private sendJoin(): void {
    const message = createMessage<JoinMessage>(
      {
        kind: "join",
        roomCode: this.room.roomCode,
        playerName: this.localName,
        resumeToken: this.resumeToken ?? undefined,
      },
      { seq: this.nextSeq() },
    );
    if (!this.room.send(message)) {
      this.emit({
        type: "error",
        message: "방 참가 요청을 보내지 못했습니다.",
      });
    }
  }

  private handleRoomEvent(event: PeerRoomEvent): void {
    if (event.type === "error") {
      this.emit({ type: "error", message: event.error.message });
      return;
    }
    if (event.type === "status") {
      this.currentStatus = mapStatus(event.status);
      this.emit({ type: "status", status: this.currentStatus });
      if (this.role === "host") {
        if (event.status === "reconnecting") {
          this.hostSession?.markGuestDisconnected(Date.now());
          this.connectedGuest = false;
          this.emit({
            type: "guest",
            connected: false,
            name: this.guestName ?? undefined,
          });
          this.emit({
            type: "notice",
            message: "참가자의 재접속을 60초 동안 기다립니다.",
          });
        } else if (event.status === "guest-replaced") {
          const deadline = this.hostSession?.guestReconnectDeadlineAt ?? 0;
          const replacement = this.hostSession?.advanceTime(
            Math.max(Date.now(), deadline),
          );
          if (replacement && this.hostSession) {
            const views = this.hostSession.getViews();
            this.publishHostSnapshot(views.hostView);
            this.emit({
              type: "notice",
              message: "참가자의 자리를 AI가 이어받았습니다.",
            });
          }
        }
      } else if (event.status === "host-disconnected") {
        this.emit({
          type: "host-ended",
          message: "방장 연결이 종료되어 온라인 게임을 마쳤습니다.",
        });
      }
      return;
    }

    const message = event.message;
    if (this.role === "host") {
      if (message.kind === "join") {
        this.acceptGuestJoin(message);
      } else if (message.kind === "intent") {
        this.receiveGuestIntent(message);
      }
      return;
    }

    if (message.kind === "welcome") {
      this.guestPlayerId = message.playerId;
      this.resumeToken = message.resumeToken;
      storeResumeToken(this.roomCode, message.resumeToken);
      this.seq = 0;
      this.pendingGuestAction = null;
      this.guestCultConversionUsed = message.view.selfAbilityUsed;
      this.connectedGuest = true;
      this.guestName = "방장";
      this.emit({ type: "guest", connected: true, name: "방장" });
      this.receiveGuestView(message.view);
    } else if (message.kind === "snapshot") {
      this.receiveGuestView(message.view, message.ackActionId);
    } else if (message.kind === "reject") {
      this.rollbackGuestPending(message.rejectedActionId);
      if (message.code === "invalid-resume-token") {
        this.resumeToken = null;
        clearStoredResumeToken(this.roomCode);
      }
      this.emit({ type: "error", message: message.detail });
    } else if (message.kind === "session-event") {
      this.emit({
        type: "notice",
        message: message.detail ?? "온라인 게임 상태가 변경되었습니다.",
      });
    }
  }

  private acceptGuestJoin(message: JoinMessage): void {
    if (message.roomCode !== this.room.roomCode) {
      this.sendReject(
        "참가 요청의 방 코드가 현재 방과 일치하지 않습니다.",
        "invalid-message",
      );
      this.room.rejectConnection();
      return;
    }

    const reconnecting =
      this.hostSession?.guestConnectionState === "reconnecting";
    if (
      this.hostSession &&
      (!this.resumeToken || message.resumeToken !== this.resumeToken)
    ) {
      this.sendReject(
        "이 게임의 유효한 재접속 정보가 아닙니다.",
        "invalid-resume-token",
      );
      this.room.rejectConnection();
      return;
    }

    if (this.hostSession) {
      const result = this.hostSession.markGuestReconnected(Date.now());
      if (!result.accepted) {
        if (result.event?.type === "guest-replaced-by-ai") {
          const views = this.hostSession.getViews();
          this.publishHostSnapshot(views.hostView);
          this.emit({
            type: "notice",
            message: "재접속 시간이 지나 참가자의 자리를 AI가 이어받았습니다.",
          });
        }
        this.sendReject(
          "재접속 시간이 지나 이 온라인 세션에 참가할 수 없습니다.",
          "session-ended",
        );
        this.room.rejectConnection();
        return;
      }
      if (reconnecting) {
        this.seq = 0;
      }
    }

    if (!this.room.confirmConnection()) {
      this.emit({
        type: "error",
        message: "참가자 연결을 확인하지 못했습니다.",
      });
      this.room.rejectConnection();
      return;
    }

    this.guestName = this.guestName ?? message.playerName;
    this.connectedGuest = true;
    this.emit({
      type: "guest",
      connected: true,
      name: this.guestName,
    });

    if (this.hostSession && this.guestPlayerId && this.resumeToken) {
      const guestView = this.hostSession.getView(this.guestPlayerId);
      this.room.send(
        createMessage<WelcomeMessage>(
          {
            kind: "welcome",
            playerId: this.guestPlayerId,
            resumeToken: this.resumeToken,
            view: guestView,
          },
          { seq: this.nextSeq() },
        ),
      );
    }
  }

  private receiveGuestIntent(message: IntentMessage): void {
    if (!this.hostSession) {
      this.sendReject(
        "게임이 아직 시작되지 않았습니다.",
        "invalid-message",
        message.actionId,
      );
      return;
    }
    const result = this.hostSession.receiveGuestIntent(message);
    if (result.status === "rejected") {
      this.sendReject(
        result.error instanceof Error
          ? result.error.message
          : "참가자의 선택을 적용할 수 없습니다.",
        "invalid-message",
        message.actionId,
      );
      return;
    }
    this.publishHostSnapshot(result.hostView);
    this.sendGuestSnapshot(result.guestView, message.actionId);
  }

  private sendReject(
    detail: string,
    code: RejectMessage["code"] = "invalid-message",
    rejectedActionId?: string,
  ): void {
    this.room.send(
      createMessage<RejectMessage>(
        { kind: "reject", code, detail, rejectedActionId },
        { seq: this.nextSeq() },
      ),
    );
  }

  private sendGuestSnapshot(view: PlayerView, ackActionId?: string): void {
    this.room.send(
      createMessage<SnapshotMessage>(
        { kind: "snapshot", view, ackActionId },
        { seq: this.nextSeq() },
      ),
    );
  }

  private publishHostSnapshot(view: PlayerView): void {
    if (!this.hostSession) return;
    this.publish({
      game: this.hostSession.getState(),
      viewerId: view.playerId,
      revision: this.hostSession.revision,
    });
  }

  private receiveGuestView(view: PlayerView, ackActionId?: string): void {
    this.guestCultConversionUsed =
      this.guestCultConversionUsed || view.selfAbilityUsed;
    const acknowledged =
      this.pendingGuestAction?.actionId === ackActionId
        ? this.pendingGuestAction
        : null;
    if (acknowledged?.marksCultConversionUsed) {
      this.guestCultConversionUsed = true;
    }
    this.guestShadow = shadowStateFromView(
      view,
      this.guestShadow,
      this.guestCultConversionUsed,
    );
    if (acknowledged) {
      this.pendingGuestAction = null;
    }
    this.publish({
      game: this.guestShadow,
      viewerId: view.playerId,
      revision: view.revision,
    });
  }

  private rollbackGuestPending(rejectedActionId?: string): void {
    const pending = this.pendingGuestAction;
    if (
      !pending ||
      (rejectedActionId !== undefined &&
        rejectedActionId !== pending.actionId)
    ) {
      return;
    }

    this.pendingGuestAction = null;
    this.guestShadow = pending.previousSnapshot.game;
    this.publish(pending.previousSnapshot);
  }

  private publish(snapshot: OnlineSnapshot): void {
    this.lastSnapshot = snapshot;
    this.emit({ type: "snapshot", snapshot });
  }

  private nextSeq(): number {
    const value = this.seq;
    this.seq += 1;
    return value;
  }

  private emit(event: OnlineSessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

export async function createOnlineHost(
  playerName: string,
): Promise<OnlineGameSession> {
  const room = await createPeerRoom();
  return new OnlineSessionAdapter(room, playerName.slice(0, 24));
}

export async function joinOnlineRoom(
  roomCode: string,
  playerName: string,
): Promise<OnlineGameSession> {
  const room = await joinPeerRoom(roomCode);
  return new OnlineSessionAdapter(
    room,
    playerName.slice(0, 24),
    readStoredResumeToken(String(room.roomCode)),
  );
}
