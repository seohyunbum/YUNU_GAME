import type { DataConnection, Peer, PeerOptions } from "peerjs";
import {
  JOIN_TIMEOUT_MS,
  PEER_ID_PREFIX,
  RECONNECT_GRACE_MS,
  createMessage,
  generateRoomCode,
  isGuestMessage,
  isHostMessage,
  requireRoomCode,
  roomCodeToPeerId,
  type PingMessage,
  type PongMessage,
  type ProtocolMessage,
  type RoomCode,
} from "./protocol";

export type PeerRoomRole = "host" | "guest";

export type PeerRoomStatus =
  | "opening"
  | "waiting"
  | "connected"
  | "reconnecting"
  | "guest-replaced"
  | "host-disconnected"
  | "closed";

export type PeerRoomEvent =
  | {
      type: "status";
      status: PeerRoomStatus;
      reconnectDeadlineAt?: number;
      reason?: string;
    }
  | {
      type: "message";
      message: ProtocolMessage;
    }
  | {
      type: "error";
      error: Error;
    };

export type PeerRoomListener = (event: PeerRoomEvent) => void;

export interface PeerRoom {
  readonly role: PeerRoomRole;
  readonly roomCode: RoomCode;
  readonly peerId: string;
  readonly status: PeerRoomStatus;
  subscribe(listener: PeerRoomListener): () => void;
  send(message: ProtocolMessage): boolean;
  confirmConnection(): boolean;
  rejectConnection(): void;
  close(reason?: string): void;
}

export interface CreatePeerRoomOptions {
  roomCode?: string;
  peerOptions?: PeerOptions;
  joinTimeoutMs?: number;
  reconnectGraceMs?: number;
  onEvent?: PeerRoomListener;
}

export interface JoinPeerRoomOptions {
  peerOptions?: PeerOptions;
  joinTimeoutMs?: number;
  onEvent?: PeerRoomListener;
}

export class PeerRoomError extends Error {
  constructor(
    message: string,
    readonly code:
      | "browser-only"
      | "join-timeout"
      | "room-unavailable"
      | "peer-error",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PeerRoomError";
  }
}

export class BrowserPeerRoom implements PeerRoom {
  readonly role: PeerRoomRole;
  readonly roomCode: RoomCode;
  readonly peerId: string;
  private currentStatus: PeerRoomStatus = "opening";
  private readonly peer: Peer;
  private readonly listeners = new Set<PeerRoomListener>();
  private readonly reconnectGraceMs: number;
  private connection: DataConnection | null = null;
  private confirmedConnection: DataConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private everConnected = false;
  private heartbeatSeq = 0;

  constructor(
    role: PeerRoomRole,
    roomCode: RoomCode,
    peer: Peer,
    reconnectGraceMs: number,
    onEvent?: PeerRoomListener,
  ) {
    this.role = role;
    this.roomCode = roomCode;
    this.peer = peer;
    this.peerId = peer.id;
    this.reconnectGraceMs = reconnectGraceMs;
    if (onEvent) this.listeners.add(onEvent);

    peer.on("error", (error) => {
      this.emit({
        type: "error",
        error: toError(error, "PeerJS 연결 오류가 발생했습니다."),
      });
    });
    peer.on("close", () => {
      if (!this.intentionallyClosed) {
        this.setStatus(
          role === "guest" ? "host-disconnected" : "closed",
          undefined,
          "peer-closed",
        );
      }
    });
    if (role === "host") {
      peer.on("connection", (connection) => {
        this.acceptHostConnection(connection);
      });
    }
  }

  get status(): PeerRoomStatus {
    return this.currentStatus;
  }

  subscribe(listener: PeerRoomListener): () => void {
    this.listeners.add(listener);
    listener({ type: "status", status: this.currentStatus });
    return () => {
      this.listeners.delete(listener);
    };
  }

  send(message: ProtocolMessage): boolean {
    const canRejectBeforeConfirmation =
      this.role === "host" &&
      message.kind === "reject" &&
      this.connection?.open === true;
    if (
      !this.connection?.open ||
      (this.currentStatus !== "connected" && !canRejectBeforeConfirmation)
    ) {
      return false;
    }
    if (
      (this.role === "host" && !isHostMessage(message)) ||
      (this.role === "guest" && !isGuestMessage(message))
    ) {
      this.emit({
        type: "error",
        error: new Error(
          `A ${this.role} room cannot send a ${message.kind} message.`,
        ),
      });
      return false;
    }

    this.connection.send(message);
    return true;
  }

  close(reason = "closed-by-client"): void {
    if (this.intentionallyClosed) return;
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    const connection = this.connection;
    this.connection = null;
    this.confirmedConnection = null;
    connection?.close();
    this.peer.destroy();
    this.setStatus("closed", undefined, reason);
  }

  markPeerOpen(): void {
    this.setStatus(this.role === "host" ? "waiting" : "opening");
  }

  attachGuestConnection(connection: DataConnection): void {
    this.connection = connection;
    this.bindConnection(connection);
  }

  confirmConnection(): boolean {
    if (
      this.role !== "host" ||
      this.intentionallyClosed ||
      !this.connection?.open
    ) {
      return false;
    }

    this.confirmedConnection = this.connection;
    this.clearReconnectTimer();
    this.everConnected = true;
    this.setStatus("connected");
    return true;
  }

  rejectConnection(): void {
    if (this.role !== "host") return;
    const connection = this.connection;
    if (!connection) return;

    const wasConfirmed = this.confirmedConnection === connection;
    this.connection = null;
    if (wasConfirmed) {
      this.confirmedConnection = null;
    }
    connection.close();
    if (wasConfirmed) {
      this.startReconnectGracePeriod();
    } else if (!this.everConnected && this.currentStatus !== "waiting") {
      this.setStatus("waiting");
    }
  }

  waitUntilConnected(timeoutMs: number): Promise<void> {
    if (this.currentStatus === "connected") return Promise.resolve();

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        reject(
          new PeerRoomError(
            "12초 안에 방장과 연결하지 못했습니다.",
            "join-timeout",
          ),
        );
      }, timeoutMs);
      const unsubscribe = this.subscribe((event) => {
        if (settled) return;
        if (event.type === "status" && event.status === "connected") {
          settled = true;
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        } else if (
          event.type === "status" &&
          (event.status === "host-disconnected" ||
            event.status === "closed")
        ) {
          settled = true;
          clearTimeout(timeout);
          unsubscribe();
          reject(
            new PeerRoomError(
              "방장과 연결할 수 없습니다.",
              "room-unavailable",
            ),
          );
        }
      });
    });
  }

  private acceptHostConnection(connection: DataConnection): void {
    if (
      this.intentionallyClosed ||
      this.currentStatus === "guest-replaced" ||
      this.confirmedConnection?.open
    ) {
      connection.close();
      return;
    }

    const previousConnection = this.connection;
    this.connection = connection;
    previousConnection?.close();
    this.bindConnection(connection);
  }

  private bindConnection(connection: DataConnection): void {
    connection.on("open", () => {
      if (connection !== this.connection || this.intentionallyClosed) return;
      if (this.role === "guest") {
        this.clearReconnectTimer();
        this.everConnected = true;
        this.setStatus("connected");
      }
    });
    connection.on("data", (data) => {
      if (connection !== this.connection || this.intentionallyClosed) return;
      this.handleIncoming(data);
    });
    connection.on("error", (error) => {
      if (connection !== this.connection || this.intentionallyClosed) return;
      this.emit({
        type: "error",
        error: toError(error, "상대방과의 데이터 연결 오류가 발생했습니다."),
      });
    });
    connection.on("close", () => {
      if (connection !== this.connection || this.intentionallyClosed) return;
      this.connection = null;
      const wasConfirmed = connection === this.confirmedConnection;
      if (wasConfirmed) {
        this.confirmedConnection = null;
      }

      if (this.role === "guest") {
        this.setStatus(
          "host-disconnected",
          undefined,
          "host-connection-closed",
        );
        this.close("host-disconnected");
        return;
      }

      if (!wasConfirmed) {
        if (!this.everConnected && this.currentStatus !== "waiting") {
          this.setStatus("waiting");
        }
        return;
      }

      if (!this.everConnected) {
        this.setStatus("waiting");
        return;
      }
      this.startReconnectGracePeriod();
    });

    if (
      connection.open &&
      (this.role === "guest" || connection === this.confirmedConnection)
    ) {
      this.clearReconnectTimer();
      this.everConnected = true;
      this.setStatus("connected");
    }
  }

  private handleIncoming(data: unknown): void {
    const valid =
      this.role === "host" ? isGuestMessage(data) : isHostMessage(data);
    if (!valid) {
      this.emit({
        type: "error",
        error: new Error("규격에 맞지 않는 온라인 메시지를 무시했습니다."),
      });
      return;
    }

    const message = data as ProtocolMessage;
    if (message.kind === "ping") {
      this.sendPong(message);
    }
    this.emit({ type: "message", message });
  }

  private sendPong(ping: PingMessage): void {
    const pong = createMessage<PongMessage>(
      { kind: "pong", nonce: ping.nonce },
      {
        seq: this.heartbeatSeq,
        actionId: `pong:${ping.actionId}`,
      },
    );
    this.heartbeatSeq += 1;
    this.send(pong);
  }

  private startReconnectGracePeriod(): void {
    this.clearReconnectTimer();
    const reconnectDeadlineAt = Date.now() + this.reconnectGraceMs;
    this.setStatus("reconnecting", reconnectDeadlineAt);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (
        !this.intentionallyClosed &&
        this.currentStatus === "reconnecting"
      ) {
        const pendingConnection = this.connection;
        if (
          pendingConnection &&
          pendingConnection !== this.confirmedConnection
        ) {
          this.connection = null;
          pendingConnection.close();
        }
        this.setStatus(
          "guest-replaced",
          undefined,
          "reconnect-grace-expired",
        );
      }
    }, this.reconnectGraceMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(
    status: PeerRoomStatus,
    reconnectDeadlineAt?: number,
    reason?: string,
  ): void {
    this.currentStatus = status;
    this.emit({ type: "status", status, reconnectDeadlineAt, reason });
  }

  private emit(event: PeerRoomEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export async function createPeerRoom(
  options: CreatePeerRoomOptions = {},
): Promise<PeerRoom> {
  assertBrowser();
  const PeerConstructor = await loadPeerConstructor();
  const timeoutMs = options.joinTimeoutMs ?? JOIN_TIMEOUT_MS;
  const reconnectGraceMs =
    options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
  const requestedCode =
    options.roomCode === undefined
      ? undefined
      : requireRoomCode(options.roomCode);
  const attempts = requestedCode ? 1 : 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const roomCode = requestedCode ?? generateRoomCode();
    const peer = new PeerConstructor(
      roomCodeToPeerId(roomCode),
      options.peerOptions,
    );
    const room = new BrowserPeerRoom(
      "host",
      roomCode,
      peer,
      reconnectGraceMs,
      options.onEvent,
    );

    try {
      await waitForPeerOpen(peer, timeoutMs);
      room.markPeerOpen();
      return room;
    } catch (error) {
      lastError = error;
      room.close("open-failed");
      if (requestedCode || !isUnavailableIdError(error)) throw error;
    }
  }

  throw new PeerRoomError(
    "사용 가능한 방 코드를 만들지 못했습니다.",
    "room-unavailable",
    { cause: lastError },
  );
}

export async function joinPeerRoom(
  roomCodeInput: string,
  options: JoinPeerRoomOptions = {},
): Promise<PeerRoom> {
  assertBrowser();
  const startedAt = Date.now();
  const timeoutMs = options.joinTimeoutMs ?? JOIN_TIMEOUT_MS;
  const roomCode = requireRoomCode(roomCodeInput);
  const PeerConstructor = await loadPeerConstructor();
  const guestPeerId = `${PEER_ID_PREFIX}guest-${roomCode.toLowerCase()}-${randomPeerSuffix()}`;
  const peer = new PeerConstructor(guestPeerId, options.peerOptions);
  const room = new BrowserPeerRoom(
    "guest",
    roomCode,
    peer,
    RECONNECT_GRACE_MS,
    options.onEvent,
  );

  try {
    await waitForPeerOpen(peer, timeoutMs);
    room.markPeerOpen();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(1, timeoutMs - elapsed);
    const connection = peer.connect(roomCodeToPeerId(roomCode), {
      reliable: true,
      serialization: "json",
    });
    room.attachGuestConnection(connection);
    await room.waitUntilConnected(remaining);
    return room;
  } catch (error) {
    room.close("join-failed");
    throw error;
  }
}

export function closePeerRoom(room: PeerRoom, reason?: string): void {
  room.close(reason);
}

async function loadPeerConstructor(): Promise<typeof Peer> {
  const peerModule = await import("peerjs");
  return peerModule.Peer;
}

function waitForPeerOpen(peer: Peer, timeoutMs: number): Promise<string> {
  if (peer.open) return Promise.resolve(peer.id);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new PeerRoomError(
          "12초 안에 PeerJS 서버에 연결하지 못했습니다.",
          "join-timeout",
        ),
      );
    }, timeoutMs);

    peer.once("open", (id) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(id);
    });
    peer.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new PeerRoomError(
          "PeerJS 서버에 연결하지 못했습니다.",
          isUnavailableIdError(error) ? "room-unavailable" : "peer-error",
          { cause: error },
        ),
      );
    });
  });
}

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new PeerRoomError(
      "온라인 방 연결은 브라우저에서만 사용할 수 있습니다.",
      "browser-only",
    );
  }
}

function randomPeerSuffix(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return (uuid ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 12)
    .toLowerCase();
}

function isUnavailableIdError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (
    "type" in error &&
    (error as { type?: unknown }).type === "unavailable-id"
  );
}

function toError(value: unknown, fallbackMessage: string): Error {
  return value instanceof Error ? value : new Error(fallbackMessage);
}
