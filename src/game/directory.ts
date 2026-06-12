// 파티 4차 — 소셜 디렉터리 계층 (docs/party-system.md §소셜)
// "전체 유저 목록 · 온라인 여부 · 친구 요청/수락 · 파티 초대 전달"을 담당한다.
// 게임 데이터 동기화(PartySession/WebRTC)와 분리된 별도 계층이며,
// 백엔드는 교체 가능: BroadcastDirectory(같은 브라우저, 개발/테스트) · FirebaseDirectory(실서비스).

export interface DirectoryUser {
  nickname: string;
  online: boolean;
}

export type FriendRequestResult = "sent" | "offline" | "self" | "already" | "error";

export interface PartyDirectoryEvents {
  onFriendRequest(from: string): void;
  onFriendAccepted(by: string): void;
  onPartyInvite(from: string, code: string): void;
  onUsersChanged(): void;
  onFriendsChanged(): void;
}

export interface PartyDirectory {
  readonly kind: "broadcast" | "firebase";
  connect(nickname: string, events: PartyDirectoryEvents): Promise<void>;
  disconnect(): void;
  listUsers(): Promise<DirectoryUser[]>;
  isOnline(nickname: string): Promise<boolean>;
  sendFriendRequest(to: string): Promise<FriendRequestResult>;
  respondFriendRequest(from: string, accept: boolean): Promise<void>;
  listFriends(): Promise<string[]>;
  sendPartyInvite(to: string, code: string): Promise<"sent" | "offline" | "error">;
}

// like 검색 — 대소문자 무시 부분일치, 빈 검색어면 전체
export function filterUsers(users: DirectoryUser[], query: string): DirectoryUser[] {
  const needle = query.trim().toLowerCase();
  const base = [...users].sort((a, b) => Number(b.online) - Number(a.online) || a.nickname.localeCompare(b.nickname));
  if (!needle) return base;
  return base.filter((user) => user.nickname.toLowerCase().includes(needle));
}

// ── BroadcastDirectory ──────────────────────────────────────────────────────
// 같은 브라우저(같은 PC)의 탭끼리 동작한다. BroadcastChannel 로 실시간 메시지,
// localStorage 로 유저 명부·친구 관계를 보존한다. E2E 테스트와 한 PC 두 탭 플레이용.

const BC_CHANNEL = "yunu-game:party-directory";
const USERS_KEY = "ai-game-lab:directory-users-v1";
const FRIENDS_KEY = "ai-game-lab:directory-friends-v1";
export const PRESENCE_HEARTBEAT_MS = 1_500;
export const PRESENCE_WINDOW_MS = 4_500;

type BroadcastPacket =
  | { kind: "announce"; nickname: string }
  | { kind: "bye"; nickname: string }
  | { kind: "who" }
  | { kind: "friend_request"; from: string; to: string }
  | { kind: "friend_response"; from: string; to: string; accept: boolean }
  | { kind: "friends_changed"; between: [string, string] }
  | { kind: "party_invite"; from: string; to: string; code: string };

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export class BroadcastDirectory implements PartyDirectory {
  readonly kind = "broadcast" as const;
  private channel: BroadcastChannel | null = null;
  private nickname = "";
  private events: PartyDirectoryEvents | null = null;
  private readonly lastHeard = new Map<string, number>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private readonly storage: Storage;
  private readonly now: () => number;

  constructor(storage: Storage = localStorage, now: () => number = () => Date.now()) {
    this.storage = storage;
    this.now = now;
  }

  async connect(nickname: string, events: PartyDirectoryEvents) {
    this.nickname = nickname;
    this.events = events;
    const users = readJson<Record<string, { lastSeen: number }>>(this.storage, USERS_KEY, {});
    users[nickname] = { lastSeen: this.now() };
    this.storage.setItem(USERS_KEY, JSON.stringify(users));
    this.channel = new BroadcastChannel(BC_CHANNEL);
    this.channel.onmessage = (event) => this.receive(event.data as BroadcastPacket);
    this.post({ kind: "announce", nickname });
    this.post({ kind: "who" });
    this.heartbeat = setInterval(() => this.post({ kind: "announce", nickname: this.nickname }), PRESENCE_HEARTBEAT_MS);
  }

  disconnect() {
    if (this.channel) this.post({ kind: "bye", nickname: this.nickname });
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.channel?.close();
    this.channel = null;
  }

  private post(packet: BroadcastPacket) {
    this.channel?.postMessage(packet);
  }

  private receive(packet: BroadcastPacket) {
    if (packet.kind === "announce") {
      const isNew = !this.isHeard(packet.nickname);
      this.lastHeard.set(packet.nickname, this.now());
      if (isNew) this.events?.onUsersChanged();
      return;
    }
    if (packet.kind === "bye") {
      this.lastHeard.delete(packet.nickname);
      this.events?.onUsersChanged();
      return;
    }
    if (packet.kind === "who") {
      this.post({ kind: "announce", nickname: this.nickname });
      return;
    }
    if (packet.kind === "friends_changed") {
      if (packet.between.includes(this.nickname)) this.events?.onFriendsChanged();
      return;
    }
    if (packet.kind === "friend_request" && packet.to === this.nickname) {
      this.events?.onFriendRequest(packet.from);
      return;
    }
    if (packet.kind === "friend_response" && packet.to === this.nickname) {
      if (packet.accept) this.events?.onFriendAccepted(packet.from);
      return;
    }
    if (packet.kind === "party_invite" && packet.to === this.nickname) {
      this.events?.onPartyInvite(packet.from, packet.code);
    }
  }

  private isHeard(nickname: string) {
    const heard = this.lastHeard.get(nickname);
    return heard !== undefined && this.now() - heard <= PRESENCE_WINDOW_MS;
  }

  async listUsers(): Promise<DirectoryUser[]> {
    const users = readJson<Record<string, { lastSeen: number }>>(this.storage, USERS_KEY, {});
    return Object.keys(users)
      .filter((nickname) => nickname !== this.nickname)
      .map((nickname) => ({ nickname, online: this.isHeard(nickname) }));
  }

  async isOnline(nickname: string) {
    return this.isHeard(nickname);
  }

  private friendKey() {
    return FRIENDS_KEY;
  }

  private readFriendPairs(): [string, string][] {
    return readJson<[string, string][]>(this.storage, this.friendKey(), []);
  }

  private isFriendPair(a: string, b: string) {
    return this.readFriendPairs().some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }

  async sendFriendRequest(to: string): Promise<FriendRequestResult> {
    if (to === this.nickname) return "self";
    if (this.isFriendPair(this.nickname, to)) return "already";
    if (!this.isHeard(to)) return "offline";
    this.post({ kind: "friend_request", from: this.nickname, to });
    return "sent";
  }

  async respondFriendRequest(from: string, accept: boolean) {
    if (accept && !this.isFriendPair(this.nickname, from)) {
      const pairs = this.readFriendPairs();
      pairs.push([from, this.nickname]);
      this.storage.setItem(this.friendKey(), JSON.stringify(pairs));
      this.events?.onFriendsChanged();
      this.post({ kind: "friends_changed", between: [from, this.nickname] });
    }
    this.post({ kind: "friend_response", from: this.nickname, to: from, accept });
  }

  async listFriends(): Promise<string[]> {
    return this.readFriendPairs()
      .filter((pair) => pair.includes(this.nickname))
      .map(([a, b]) => (a === this.nickname ? b : a));
  }

  async sendPartyInvite(to: string, code: string): Promise<"sent" | "offline" | "error"> {
    if (!this.isHeard(to)) return "offline";
    this.post({ kind: "party_invite", from: this.nickname, to, code });
    return "sent";
  }
}

// ── 백엔드 선택 ─────────────────────────────────────────────────────────────
// Firebase 설정이 있으면 실서비스 디렉터리, 없으면 개발 모드(같은 브라우저)에서만 동작.
export async function createDirectory(): Promise<PartyDirectory | null> {
  const { FIREBASE_CONFIG } = await import("../onlineConfig");
  if (FIREBASE_CONFIG) {
    const { FirebaseDirectory } = await import("./firebaseDirectory");
    return new FirebaseDirectory(FIREBASE_CONFIG);
  }
  if (import.meta.env.DEV && typeof BroadcastChannel !== "undefined") return new BroadcastDirectory();
  return null;
}
