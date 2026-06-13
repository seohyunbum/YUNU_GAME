import Peer, { type DataConnection } from "peerjs";

// 파티 시스템 2차 — 접속 계층 (docs/party-system.md)
// 호스트-게스트 WebRTC P2P. 시그널링은 PeerJS 퍼블릭 브로커(악수만 중개, 게임 데이터는 P2P).
// 이 파일이 연결 기술을 전부 격리한다 — 시그널링을 갈아타도 UI/게임 코드는 그대로.

export const PARTY_PROTOCOL_VERSION = 2; // v2: 호스트 권위 월드 공유 (mobs/attackRequest/partyKill/mobHit)
export const PARTY_MAX_MEMBERS = 4; // 호스트 포함

// 혼동 글자(0/O/1/I) 제외 32자 — 6자리 초대 코드
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PARTY_CODE_LENGTH = 6;
const PEER_ID_PREFIX = "yunu-game-";

export function generatePartyCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < PARTY_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizePartyCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== PARTY_CODE_LENGTH) return null;
  if (![...code].every((ch) => CODE_ALPHABET.includes(ch))) return null;
  return code;
}

export function peerIdForCode(code: string) {
  return `${PEER_ID_PREFIX}${code}`;
}

export interface PartyMember {
  nickname: string;
  isHost: boolean;
}

export interface PresenceData {
  nickname: string;
  mapId: string;
  x: number;
  z: number;
  yaw: number;
  playerClass: string;
  inGame: boolean;
  panelOpen?: boolean; // 인벤토리 등 패널 열림 — 호스트 몬스터가 타격을 보류 (로컬과 같은 보호)
  health?: number; // 친구 머리 위 HP바 표시용 (5.1)
  maxHealth?: number;
}

// 프레즌스가 이 시간 이상 끊긴 게스트(백그라운드 탭 등)는 명단에서 제외 — 몬스터 타게팅·아바타에서 빠진다
export const PARTY_PRESENCE_STALE_MS = 6_000;

// 몬스터 스냅샷 (5차) — 호스트가 8Hz 로 전체 목록을 보내고 게스트는 diff 로 스폰/이동/제거를 처리한다.
// y(높이)는 보내지 않는다 — 게스트가 자기 지형으로 재접지(산 생성 난수 발산 회피).
export interface MobSnapshot {
  id: string;
  name: string;
  monsterId?: string;
  kind?: string; // predatorKind
  regionId?: string;
  fieldBossId?: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  armor?: number;
  atk?: number; // 진행 중인 공격 모션의 경과 ms — 게스트가 같은 모션을 재생 (전조 가독성)
  afx?: number; // 공격 전방 단위벡터 (게스트는 제자리 모션이라 참고용)
  afz?: number;
  // 6차 — 마을 경비 동기화 (없으면 wildPredator)
  type?: string; // "villageKnight" | "villageArcher" | "villageMage" | "villageGolem"
  villageId?: string;
  guardMode?: string; // "melee" | "ranged"
  // 7차 — 정적 오브젝트 공유 (동굴 입구·보물 상자)
  objType?: string; // "cave" | "chest" | "mineChest"
  opened?: boolean; // 상자 개봉 상태
}

export type PartyMessage =
  | { type: "hello"; nickname: string; protocol: number }
  | { type: "welcome"; members: PartyMember[] }
  | { type: "reject"; reason: string }
  | { type: "roster"; members: PartyMember[] }
  | { type: "presence"; data: PresenceData }
  | { type: "presences"; list: PresenceData[] }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number }
  // 5차 — 호스트 권위 월드 공유
  | { type: "mobs"; mapId: string; list: MobSnapshot[] }
  | { type: "attackRequest"; targetId: string; power: number; kind: string }
  | { type: "partyKill"; name: string; xp: number; killer: string; mapId: string; kind?: string; fieldBossId?: string; lootItem?: string; lootCount?: number }
  | { type: "mobHit"; nickname: string; amount: number; name: string; mapId: string }
  // 5.1 — 원격 플레이어 표현
  | { type: "playerAttack"; nickname: string; mapId: string; kind: "melee" | "ranged" | "skill"; visual?: "arrow" | "magic" | "wind" | "tnt"; speed?: number; life?: number; ox?: number; oy?: number; oz?: number; dx?: number; dy?: number; dz?: number }
  | { type: "partyHeal"; recipient: string; amount: number; mapId: string }
  // 7차 — 보물 상자 개봉 (호스트 권위)
  | { type: "openRequest"; objectId: string }
  | { type: "chestLoot"; opener: string; items: { item: string; count: number }[] };

export function encodePartyMessage(message: PartyMessage): string {
  return JSON.stringify(message);
}

export function decodePartyMessage(raw: unknown): PartyMessage | null {
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { type?: unknown }).type !== "string") return null;
    return parsed as PartyMessage;
  } catch {
    return null;
  }
}

export interface PartyEvents {
  onStatus(text: string): void;
  onRoster(members: PartyMember[]): void;
  onError(text: string): void;
  onClosed(): void;
}

interface GuestLink {
  connection: DataConnection;
  nickname: string | null;
  presence: PresenceData | null;
  presenceAt: number; // 마지막 프레즌스 수신 시각 — 신선도 검사용
}

// 한 세션 = 호스트이거나 게스트이거나. 로비 단계(2차)는 로스터/핑까지만 책임진다.
export class PartySession {
  readonly role: "host" | "guest";
  readonly code: string;
  private readonly nickname: string;
  private readonly events: PartyEvents;
  private peer: Peer | null = null;
  private guests: GuestLink[] = []; // 호스트 전용
  private hostConnection: DataConnection | null = null; // 게스트 전용
  private closed = false;
  lastPingMs: number | null = null;

  private constructor(role: "host" | "guest", code: string, nickname: string, events: PartyEvents) {
    this.role = role;
    this.code = code;
    this.nickname = nickname;
    this.events = events;
  }

  static host(nickname: string, events: PartyEvents): PartySession {
    const session = new PartySession("host", generatePartyCode(), nickname, events);
    session.openHost();
    return session;
  }

  static join(code: string, nickname: string, events: PartyEvents): PartySession {
    const session = new PartySession("guest", code, nickname, events);
    session.openGuest();
    return session;
  }

  members(): PartyMember[] {
    if (this.role === "host") {
      return [
        { nickname: this.nickname, isHost: true },
        ...this.guests.filter((guest) => guest.nickname).map((guest) => ({ nickname: guest.nickname as string, isHost: false })),
      ];
    }
    return this.latestRoster;
  }

  private latestRoster: PartyMember[] = [];

  private openHost() {
    this.events.onStatus("방을 만드는 중…");
    const peer = new Peer(peerIdForCode(this.code));
    this.peer = peer;
    peer.on("open", () => {
      this.markReady();
      this.events.onStatus(`방이 열렸습니다! 초대 코드: ${this.code}`);
      this.events.onRoster(this.members());
    });
    peer.on("connection", (connection) => this.acceptGuest(connection));
    peer.on("error", (error) => this.handlePeerError(error));
    peer.on("disconnected", () => {
      if (!this.closed) peer.reconnect();
    });
  }

  private acceptGuest(connection: DataConnection) {
    const link: GuestLink = { connection, nickname: null, presence: null, presenceAt: 0 };
    connection.on("data", (raw) => {
      const message = decodePartyMessage(raw);
      if (!message) return;
      if (message.type === "hello") {
        if (message.protocol !== PARTY_PROTOCOL_VERSION) {
          connection.send(encodePartyMessage({ type: "reject", reason: "게임 버전이 달라요. 둘 다 새로고침해서 최신 버전으로 맞춰 주세요." }));
          setTimeout(() => connection.close(), 300);
          return;
        }
        if (this.members().length >= PARTY_MAX_MEMBERS) {
          connection.send(encodePartyMessage({ type: "reject", reason: `파티 정원(${PARTY_MAX_MEMBERS}명)이 가득 찼어요.` }));
          setTimeout(() => connection.close(), 300);
          return;
        }
        if (this.members().some((member) => member.nickname === message.nickname)) {
          connection.send(encodePartyMessage({ type: "reject", reason: "같은 닉네임이 이미 파티에 있어요." }));
          setTimeout(() => connection.close(), 300);
          return;
        }
        link.nickname = message.nickname;
        this.guests.push(link);
        connection.send(encodePartyMessage({ type: "welcome", members: this.members() }));
        this.broadcastRoster();
        this.events.onStatus(`${message.nickname} 님이 파티에 들어왔습니다!`);
        return;
      }
      if (message.type === "presence") {
        link.presence = message.data;
        link.presenceAt = performance.now();
      }
      if (message.type === "ping") connection.send(encodePartyMessage({ type: "pong", t: message.t }));
      if ((message.type === "attackRequest" || message.type === "openRequest") && link.nickname) this.emitGame(message, link.nickname);
      // 5.1 — 게스트가 보낸 공격 연출·파티 힐: 호스트가 처리(자기 화면 반영) + 다른 게스트에 중계
      if (message.type === "playerAttack" || message.type === "partyHeal") {
        this.emitGame(message, link.nickname ?? undefined);
        for (const other of this.guests) if (other !== link && other.connection.open) other.connection.send(encodePartyMessage(message));
      }
    });
    connection.on("close", () => {
      if (!link.nickname) return;
      this.guests = this.guests.filter((guest) => guest !== link);
      this.broadcastRoster();
      this.events.onStatus(`${link.nickname} 님이 나갔습니다.`);
    });
  }

  private broadcastRoster() {
    const roster = encodePartyMessage({ type: "roster", members: this.members() });
    for (const guest of this.guests) guest.connection.send(roster);
    this.events.onRoster(this.members());
  }

  private openGuest() {
    this.events.onStatus("파티에 연결하는 중…");
    const peer = new Peer();
    this.peer = peer;
    peer.on("open", () => {
      const connection = peer.connect(peerIdForCode(this.code), { reliable: true });
      this.hostConnection = connection;
      const joinTimeout = setTimeout(() => {
        if (this.latestRoster.length === 0 && !this.closed) {
          this.events.onError("방을 찾지 못했어요. 코드를 확인하거나, 방장이 방을 열어 둔 상태인지 확인해 주세요.");
          this.close();
        }
      }, 12_000);
      connection.on("open", () => {
        connection.send(encodePartyMessage({ type: "hello", nickname: this.nickname, protocol: PARTY_PROTOCOL_VERSION }));
      });
      connection.on("data", (raw) => {
        const message = decodePartyMessage(raw);
        if (!message) return;
        if (message.type === "welcome" || message.type === "roster") {
          clearTimeout(joinTimeout);
          this.latestRoster = message.members;
          this.markReady(); // 게스트는 welcome(또는 첫 roster) 수신 = 합류 확정
          if (message.type === "welcome") this.events.onStatus("파티에 들어왔습니다!");
          this.events.onRoster(message.members);
          return;
        }
        if (message.type === "presences") {
          this.emitPresences(message.list.filter((entry) => entry.nickname !== this.nickname));
          return;
        }
        if (message.type === "mobs" || message.type === "partyKill" || message.type === "mobHit" || message.type === "playerAttack" || message.type === "partyHeal" || message.type === "chestLoot") {
          this.emitGame(message);
          return;
        }
        if (message.type === "reject") {
          clearTimeout(joinTimeout);
          this.events.onError(message.reason);
          this.close();
          return;
        }
        if (message.type === "ping") {
          connection.send(encodePartyMessage({ type: "pong", t: message.t }));
          return;
        }
        if (message.type === "pong") this.lastPingMs = Math.max(0, Math.round(performance.now() - message.t));
      });
      connection.on("close", () => {
        if (this.closed) return;
        this.events.onError("방장과의 연결이 끊어졌습니다.");
        this.close();
      });
    });
    peer.on("error", (error) => this.handlePeerError(error));
  }

  private presenceListeners: ((list: PresenceData[]) => void)[] = [];
  private gameListeners: ((message: PartyMessage, fromNickname?: string) => void)[] = [];
  private readyResolvers: { resolve: () => void; reject: (error: Error) => void }[] = [];
  private isReady = false;

  onPresences(listener: (list: PresenceData[]) => void) {
    this.presenceListeners.push(listener);
  }

  private emitPresences(list: PresenceData[]) {
    for (const listener of this.presenceListeners) listener(list);
  }

  // 5차 게임 데이터 채널 — 호스트: attackRequest 수신(보낸 게스트 닉네임 포함) / 게스트: mobs·partyKill·mobHit·playerAttack·partyHeal 수신
  // 리스너 등록은 다음 rAF 틱에서 일어나므로, 그 전에 도착한 메시지는 버퍼링했다가 재생한다.
  // 두 소비자(partyWorldSync·partyPresence)가 같은 틱에 연속 등록되고 서로 다른 타입만 처리하므로,
  // 첫 리스너에만 flush 하면 나머지 타입(playerAttack/partyHeal)이 유실된다 → 모든 신규 리스너에 재생.
  private pendingGameMessages: { message: PartyMessage; fromNickname?: string }[] = [];
  private pendingFlushScheduled = false;

  onGame(listener: (message: PartyMessage, fromNickname?: string) => void) {
    this.gameListeners.push(listener);
    for (const entry of this.pendingGameMessages) listener(entry.message, entry.fromNickname);
    if (!this.pendingFlushScheduled && this.pendingGameMessages.length > 0) {
      this.pendingFlushScheduled = true;
      queueMicrotask(() => {
        this.pendingGameMessages.length = 0; // 동기 틱의 모든 onGame 등록이 끝난 뒤 1회 비움
        this.pendingFlushScheduled = false;
      });
    }
  }

  private emitGame(message: PartyMessage, fromNickname?: string) {
    if (this.gameListeners.length === 0) {
      // mobs 는 풀스냅샷 — 최신 1개만 유지해 8Hz 스트림이 이벤트 메시지를 밀어내지 않게 한다
      if (message.type === "mobs") {
        const index = this.pendingGameMessages.findIndex((entry) => entry.message.type === "mobs");
        if (index >= 0) this.pendingGameMessages.splice(index, 1);
      }
      this.pendingGameMessages.push({ message, fromNickname });
      if (this.pendingGameMessages.length > 64) this.pendingGameMessages.shift();
      return;
    }
    for (const listener of this.gameListeners) listener(message, fromNickname);
  }

  // 역할 인지 송신 — 게스트는 호스트에게, 호스트는 모든 게스트에게.
  // skipWhenBufferedBytes: 채널이 그만큼 적체된 게스트는 이번 송신을 건너뛴다 (스냅샷 전용 백프레셔 — 이벤트 메시지에는 쓰지 말 것)
  sendGame(message: PartyMessage, skipWhenBufferedBytes?: number) {
    if (this.closed) return;
    const packet = encodePartyMessage(message);
    if (this.role === "guest") {
      if (this.hostConnection?.open) this.hostConnection.send(packet);
      return;
    }
    for (const guest of this.guests) {
      if (!guest.connection.open) continue;
      if (skipWhenBufferedBytes && (((guest.connection as unknown as { bufferSize?: number }).bufferSize ?? 0) > 0 || (guest.connection.dataChannel?.bufferedAmount ?? 0) > skipWhenBufferedBytes)) continue;
      guest.connection.send(packet);
    }
  }

  // 호스트: 피어 서버에 방이 열린 뒤 / 게스트: welcome 수신(합류 확정) 뒤 resolve. 닫히면 reject.
  whenReady(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    if (this.closed) return Promise.reject(new Error("파티 세션이 닫혔습니다."));
    return new Promise((resolve, reject) => this.readyResolvers.push({ resolve, reject }));
  }

  private markReady() {
    this.isReady = true;
    for (const entry of this.readyResolvers.splice(0)) entry.resolve();
  }

  // 자기 프레즌스 송신 — 호스트는 전원 목록을 합쳐 브로드캐스트하고 자기 리스너에도 전달한다.
  sendPresence(data: PresenceData) {
    if (this.closed) return;
    if (this.role === "guest") {
      if (this.hostConnection?.open) this.hostConnection.send(encodePartyMessage({ type: "presence", data }));
      return;
    }
    const now = performance.now();
    // 프레즌스가 끊긴(백그라운드 탭 등) 게스트는 명단에서 제외 — 몬스터가 유령 좌표를 영원히 때리는 것을 막는다
    const list: PresenceData[] = [data, ...this.guests.filter((guest) => guest.nickname && guest.presence && now - guest.presenceAt <= PARTY_PRESENCE_STALE_MS).map((guest) => guest.presence as PresenceData)];
    const packet = encodePartyMessage({ type: "presences", list });
    for (const guest of this.guests) if (guest.connection.open) guest.connection.send(packet);
    this.emitPresences(list.filter((entry) => entry.nickname !== data.nickname));
  }

  pingHost() {
    if (this.role !== "guest" || !this.hostConnection?.open) return;
    this.hostConnection.send(encodePartyMessage({ type: "ping", t: performance.now() }));
  }

  private handlePeerError(error: { type?: string; message?: string }) {
    if (this.closed) return;
    if (error.type === "unavailable-id") {
      this.events.onError("초대 코드가 충돌했어요. 방을 다시 만들어 주세요.");
    } else if (error.type === "peer-unavailable") {
      this.events.onError("그 코드의 방을 찾지 못했어요. 코드를 다시 확인해 주세요.");
    } else if (error.type === "network" || error.type === "server-error" || error.type === "socket-error") {
      this.events.onError("연결 서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요. (학교 와이파이라면 휴대폰 핫스팟을 시도해 보세요)");
    } else {
      this.events.onError(`연결 오류: ${error.message ?? error.type ?? "알 수 없음"}`);
    }
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pendingGameMessages.length = 0;
    for (const entry of this.readyResolvers.splice(0)) entry.reject(new Error("파티 세션이 닫혔습니다."));
    try {
      this.peer?.destroy();
    } catch {
      // 종료 중 오류는 무시
    }
    this.events.onClosed();
  }
}
