import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataConnection, Peer } from "peerjs";
import {
  createGame,
  getPlayerView,
  type GameState,
  type PlayerView,
} from "../../lib/game";
import {
  BrowserPeerRoom,
  PROTOCOL_VERSION,
  createMessage,
  requireRoomCode,
  type HostMessage,
  type IntentMessage,
  type JoinMessage,
  type PeerRoom,
  type PeerRoomEvent,
  type PeerRoomListener,
  type PeerRoomStatus,
  type ProtocolMessage,
  type RejectMessage,
  type WelcomeMessage,
} from "../../lib/online";
import {
  OnlineSessionAdapter,
  readStoredResumeToken,
  shadowStateFromView,
  storeResumeToken,
  type OnlineSessionEvent,
} from "../../app/onlineAdapter";

type Handler = (...args: unknown[]) => void;

class FakeEmitter {
  private readonly handlers = new Map<string, Handler[]>();

  on(event: string, handler: Handler): this {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

class FakePeer extends FakeEmitter {
  readonly id = "fake-host-peer";
  open = true;
  destroyed = false;

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeConnection extends FakeEmitter {
  open = true;
  readonly sent: unknown[] = [];

  send(message: unknown): void {
    this.sent.push(message);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.emit("close");
  }
}

class FakePeerRoom implements PeerRoom {
  readonly roomCode = requireRoomCode("ABCDEF");
  readonly peerId = "fake-peer";
  readonly sent: ProtocolMessage[] = [];
  readonly listeners = new Set<PeerRoomListener>();
  confirmCount = 0;
  rejectCount = 0;
  closeCount = 0;
  private currentStatus: PeerRoomStatus;

  constructor(
    readonly role: "host" | "guest",
    initialStatus: PeerRoomStatus = role === "host" ? "waiting" : "connected",
  ) {
    this.currentStatus = initialStatus;
  }

  get status(): PeerRoomStatus {
    return this.currentStatus;
  }

  subscribe(listener: PeerRoomListener): () => void {
    this.listeners.add(listener);
    listener({ type: "status", status: this.currentStatus });
    return () => this.listeners.delete(listener);
  }

  send(message: ProtocolMessage): boolean {
    this.sent.push(message);
    return this.currentStatus !== "closed";
  }

  confirmConnection(): boolean {
    this.confirmCount += 1;
    this.emit({ type: "status", status: "connected" });
    return true;
  }

  rejectConnection(): void {
    this.rejectCount += 1;
  }

  close(): void {
    this.closeCount += 1;
    this.emit({ type: "status", status: "closed" });
  }

  emit(event: PeerRoomEvent): void {
    if (event.type === "status") {
      this.currentStatus = event.status;
    }
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function joinMessage(
  room: FakePeerRoom,
  resumeToken?: string,
): JoinMessage {
  return createMessage<JoinMessage>(
    {
      kind: "join",
      roomCode: room.roomCode,
      playerName: "게스트",
      resumeToken,
    },
    { seq: 0 },
  );
}

function welcomeMessage(view: PlayerView): WelcomeMessage {
  return createMessage<WelcomeMessage>(
    {
      kind: "welcome",
      playerId: view.playerId,
      resumeToken: "resume:11111111-1111-4111-8111-111111111111",
      view,
    },
    { seq: 0 },
  );
}

function findDuoState(
  predicate: (state: GameState, guestId: string) => boolean,
): GameState {
  for (let seed = 1; seed < 2_000; seed += 1) {
    const state = createGame({
      mode: "duo",
      seed,
      hostName: "방장",
      guestName: "게스트",
    });
    const guestId = state.humanIds[1];
    if (guestId && predicate(state, guestId)) return state;
  }
  throw new Error("조건에 맞는 듀오 시드를 찾지 못했습니다.");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PeerRoom confirmation boundary", () => {
  it("does not cancel the reconnect deadline for an unconfirmed socket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const peer = new FakePeer();
    const room = new BrowserPeerRoom(
      "host",
      requireRoomCode("ABCDEF"),
      peer as unknown as Peer,
      100,
    );
    room.markPeerOpen();

    const first = new FakeConnection();
    peer.emit("connection", first as unknown as DataConnection);
    first.emit("open");
    expect(room.status).toBe("waiting");
    expect(room.confirmConnection()).toBe(true);
    expect(room.status).toBe("connected");

    first.close();
    expect(room.status).toBe("reconnecting");

    const unconfirmed = new FakeConnection();
    peer.emit("connection", unconfirmed as unknown as DataConnection);
    unconfirmed.emit("open");
    expect(room.status).toBe("reconnecting");

    vi.advanceTimersByTime(100);
    expect(room.status).toBe("guest-replaced");
    expect(unconfirmed.open).toBe(false);
  });
});

describe("online adapter reconnect authentication", () => {
  it("requires the unpredictable token issued at game start", () => {
    const room = new FakePeerRoom("host");
    const session = new OnlineSessionAdapter(room, "방장");
    room.emit({ type: "message", message: joinMessage(room) });
    session.start("방장");

    const initialWelcome = room.sent.find(
      (message): message is WelcomeMessage => message.kind === "welcome",
    );
    expect(initialWelcome?.resumeToken).toMatch(
      /^resume:[0-9a-f-]{36}$/,
    );
    expect(initialWelcome?.resumeToken).not.toContain(String(room.roomCode));

    room.emit({ type: "status", status: "reconnecting" });
    room.emit({
      type: "message",
      message: joinMessage(
        room,
        "resume:22222222-2222-4222-8222-222222222222",
      ),
    });

    expect(room.rejectCount).toBe(1);
    expect(room.sent.at(-1)).toMatchObject({
      kind: "reject",
      code: "invalid-resume-token",
    });

    room.emit({
      type: "message",
      message: joinMessage(room, initialWelcome?.resumeToken),
    });
    expect(room.confirmCount).toBe(2);
    expect(room.sent.at(-1)).toMatchObject({
      kind: "welcome",
      resumeToken: initialWelcome?.resumeToken,
      seq: 0,
    });
  });

  it("includes a stored resume token in a new guest join", () => {
    const room = new FakePeerRoom("guest");
    const storedToken =
      "resume:33333333-3333-4333-8333-333333333333";

    new OnlineSessionAdapter(room, "게스트", storedToken);

    expect(room.sent[0]).toMatchObject({
      kind: "join",
      roomCode: room.roomCode,
      resumeToken: storedToken,
    });
  });

  it("persists and reloads reconnect tokens in session storage", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      },
    });
    const token =
      "resume:44444444-4444-4444-8444-444444444444";

    storeResumeToken("ABCDEF", token);

    expect(readStoredResumeToken("ABCDEF")).toBe(token);
    expect(readStoredResumeToken("ABCDEG")).toBeNull();
  });
});

describe("guest shadow and optimistic rollback", () => {
  it("preserves the human partner and cult ability state", () => {
    const state = findDuoState((candidate, guestId) => {
      const guest = candidate.characters.find(
        (character) => character.id === guestId,
      );
      return guest?.roleId === "cult_leader";
    });
    state.cultConversionUsed = true;
    const guestId = state.humanIds[1];
    const view = getPlayerView(state, guestId, 8);
    const shadow = shadowStateFromView(view, null, false);
    const rerendered = getPlayerView(shadow, guestId, 8);

    expect(shadow.humanIds).toEqual([
      view.self.id,
      view.partnerId,
    ]);
    expect(shadow.duoFaction).toBe(view.self.faction);
    expect(shadow.cultConversionUsed).toBe(true);
    expect(rerendered.partner).toMatchObject({
      id: view.partner?.id,
      roleId: view.partner?.roleId,
      faction: view.partner?.faction,
    });

    const room = new FakePeerRoom("guest");
    const reconnected = new OnlineSessionAdapter(
      room,
      "게스트",
      "resume:55555555-5555-4555-8555-555555555555",
    );
    const snapshots: OnlineSessionEvent[] = [];
    reconnected.subscribe((event) => snapshots.push(event));
    room.emit({ type: "message", message: welcomeMessage(view) });
    expect(snapshots.at(-1)).toMatchObject({
      type: "snapshot",
      snapshot: { game: { cultConversionUsed: true } },
    });
  });

  it("rolls back a rejected optimistic action by action id", () => {
    const state = findDuoState((candidate, guestId) => {
      const guest = candidate.characters.find(
        (character) => character.id === guestId,
      );
      return guest?.faction === "mafia";
    });
    const guestId = state.humanIds[1];
    const view = getPlayerView(state, guestId, 1);
    const room = new FakePeerRoom("guest");
    const session = new OnlineSessionAdapter(room, "게스트");
    const snapshots: OnlineSessionEvent[] = [];
    session.subscribe((event) => {
      if (event.type === "snapshot") snapshots.push(event);
    });
    room.emit({ type: "message", message: welcomeMessage(view) });

    session.dispatch({
      type: "night-kill",
      actorId: guestId,
      targetId: view.partnerId as string,
    });
    const intent = room.sent.at(-1) as IntentMessage;
    const optimistic = snapshots.at(-1);
    expect(optimistic).toMatchObject({
      type: "snapshot",
      snapshot: {
        game: {
          pending: {
            nightKillVotes: { [guestId]: view.partnerId },
          },
        },
      },
    });

    const reject: RejectMessage = {
      protocolVersion: PROTOCOL_VERSION,
      kind: "reject",
      seq: 1,
      actionId: "reject-1",
      sentAt: 1,
      code: "invalid-message",
      detail: "같은 진영은 대상으로 삼을 수 없습니다.",
      rejectedActionId: intent.actionId,
    };
    room.emit({ type: "message", message: reject as HostMessage });

    const rolledBack = snapshots.at(-1);
    expect(rolledBack).toMatchObject({
      type: "snapshot",
      snapshot: {
        game: { pending: { nightKillVotes: {} } },
      },
    });
  });
});
