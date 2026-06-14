import type { FirebaseConfigShape } from "../onlineConfig";
import type { DirectoryUser, FriendRequestResult, PartyDirectory, PartyDirectoryEvents } from "./directory";

// Firebase Realtime Database 디렉터리 — 실서비스(서로 다른 PC/집) 백엔드.
// 경로 구조:
//   users/{nick}        = { online: boolean, lastSeen: number }   (onDisconnect 로 자동 오프라인)
//   friends/{nick}/{other} = true                                  (양방향 기록)
//   inbox/{nick}/friendRequests/{from} = ts
//   inbox/{nick}/friendAccepted/{by}   = ts
//   inbox/{nick}/partyInvites/{from}   = { code, ts }
// 수신자는 자기 inbox 를 구독해 팝업을 띄우고, 처리한 항목은 지운다.

type FirebaseDatabase = typeof import("firebase/database");

export class FirebaseDirectory implements PartyDirectory {
  readonly kind = "firebase" as const;
  private readonly config: FirebaseConfigShape;
  private nickname = "";
  private events: PartyDirectoryEvents | null = null;
  private db: ReturnType<FirebaseDatabase["getDatabase"]> | null = null;
  private fdb: FirebaseDatabase | null = null;
  private unsubscribers: (() => void)[] = [];

  constructor(config: FirebaseConfigShape) {
    this.config = config;
  }

  async connect(nickname: string, events: PartyDirectoryEvents) {
    this.nickname = nickname;
    this.events = events;
    const { initializeApp, getApps } = await import("firebase/app");
    const fdb = await import("firebase/database");
    this.fdb = fdb;
    const app = getApps()[0] ?? initializeApp(this.config);
    const db = fdb.getDatabase(app);
    this.db = db;

    const meRef = fdb.ref(db, `users/${nickname}`);
    // update(merge) — set 으로 덮으면 저장 시 발행한 진행도(level/playSeconds 등)가 재접속마다 지워진다.
    await fdb.update(meRef, { online: true, lastSeen: fdb.serverTimestamp() });
    fdb.onDisconnect(meRef).update({ online: false, lastSeen: fdb.serverTimestamp() });

    const watch = (path: string, handler: (snapshot: import("firebase/database").DataSnapshot) => void) => {
      const reference = fdb.ref(db, path);
      const unsubscribe = fdb.onValue(reference, handler);
      this.unsubscribers.push(unsubscribe);
    };

    watch(`inbox/${nickname}/friendRequests`, (snapshot) => {
      snapshot.forEach((child) => {
        this.events?.onFriendRequest(child.key as string);
        void fdb.remove(child.ref);
      });
    });
    watch(`inbox/${nickname}/friendAccepted`, (snapshot) => {
      snapshot.forEach((child) => {
        this.events?.onFriendAccepted(child.key as string);
        void fdb.remove(child.ref);
      });
    });
    watch(`inbox/${nickname}/partyInvites`, (snapshot) => {
      snapshot.forEach((child) => {
        const value = child.val() as { code?: string } | null;
        if (value?.code) this.events?.onPartyInvite(child.key as string, value.code);
        void fdb.remove(child.ref);
      });
    });
    watch("users", () => this.events?.onUsersChanged());
    watch(`friends/${nickname}`, () => this.events?.onFriendsChanged());
  }

  disconnect() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers = [];
    if (this.db && this.fdb) void this.fdb.update(this.fdb.ref(this.db, `users/${this.nickname}`), { online: false });
  }

  private requireDb() {
    if (!this.db || !this.fdb) throw new Error("directory not connected");
    return { db: this.db, fdb: this.fdb };
  }

  async listUsers(): Promise<DirectoryUser[]> {
    const { db, fdb } = this.requireDb();
    const snapshot = await fdb.get(fdb.ref(db, "users"));
    const users: DirectoryUser[] = [];
    snapshot.forEach((child) => {
      if (child.key !== this.nickname) users.push({ nickname: child.key as string, online: Boolean((child.val() as { online?: boolean })?.online) });
    });
    return users;
  }

  async isOnline(nickname: string) {
    const { db, fdb } = this.requireDb();
    const snapshot = await fdb.get(fdb.ref(db, `users/${nickname}/online`));
    return snapshot.val() === true;
  }

  async sendFriendRequest(to: string): Promise<FriendRequestResult> {
    try {
      if (to === this.nickname) return "self";
      const { db, fdb } = this.requireDb();
      const already = await fdb.get(fdb.ref(db, `friends/${this.nickname}/${to}`));
      if (already.val() === true) return "already";
      if (!(await this.isOnline(to))) return "offline";
      await fdb.set(fdb.ref(db, `inbox/${to}/friendRequests/${this.nickname}`), fdb.serverTimestamp());
      return "sent";
    } catch {
      return "error";
    }
  }

  async respondFriendRequest(from: string, accept: boolean) {
    const { db, fdb } = this.requireDb();
    if (!accept) return;
    await fdb.update(fdb.ref(db), {
      [`friends/${this.nickname}/${from}`]: true,
      [`friends/${from}/${this.nickname}`]: true,
      [`inbox/${from}/friendAccepted/${this.nickname}`]: fdb.serverTimestamp(),
    });
  }

  async listFriends(): Promise<string[]> {
    const { db, fdb } = this.requireDb();
    const snapshot = await fdb.get(fdb.ref(db, `friends/${this.nickname}`));
    const friends: string[] = [];
    snapshot.forEach((child) => {
      if (child.val() === true) friends.push(child.key as string);
    });
    return friends;
  }

  async sendPartyInvite(to: string, code: string): Promise<"sent" | "offline" | "error"> {
    try {
      const { db, fdb } = this.requireDb();
      if (!(await this.isOnline(to))) return "offline";
      await fdb.set(fdb.ref(db, `inbox/${to}/partyInvites/${this.nickname}`), { code, ts: fdb.serverTimestamp() });
      return "sent";
    } catch {
      return "error";
    }
  }
}
