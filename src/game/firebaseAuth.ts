import type { FirebaseConfigShape } from "../onlineConfig";

// Firebase 익명 로그인 — DB 규칙(database.rules.json)은 모든 쓰기에 로그인(auth != null)을 요구한다.
// 디렉터리(firebaseDirectory, SDK 실시간 연결)와 진행도 발행(progressSync, REST)이 같은 익명 신원을 공유한다.
// 닉네임과 신원은 묶지 않는다(주인 없는 최소 보호 — 소유권 검사 없음). 신원은 브라우저에 보존돼 재접속해도 같다.
// 실패(익명 로그인 미활성·오프라인)는 null 로 조용히 넘긴다 — 쓰기만 규칙에 거부되고 게임은 계속된다. 30초 뒤 재시도.
// leaf: main.ts 를 import 하지 않는다. firebase/* 는 동적 import(첫 화면 번들 제외). Node(테스트·빌드 스크립트)에서는 로그인하지 않는다.

type FirebaseAuth = import("firebase/auth").Auth;

const RETRY_AFTER_MS = 30_000;
let signing: Promise<FirebaseAuth | null> | null = null;
let failedAt = Number.NEGATIVE_INFINITY;

export function ensureAnonymousAuth(config: FirebaseConfigShape): Promise<FirebaseAuth | null> {
  if (import.meta.env.SSR || typeof window === "undefined") return Promise.resolve(null);
  if (signing) return signing; // 동시 호출(디렉터리 연결 + 진행도 발행)은 한 번의 로그인으로 합친다
  if (Date.now() - failedAt < RETRY_AFTER_MS) return Promise.resolve(null);
  signing = (async () => {
    try {
      const { getApps, initializeApp } = await import("firebase/app");
      const { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously } = await import("firebase/auth");
      // getAuth 대신 initializeAuth — 팝업/리디렉션 처리기를 빼서 모바일에서 인증 iframe 을 미리 띄우지 않는다(같은 옵션 재호출은 같은 인스턴스).
      const auth = initializeAuth(getApps()[0] ?? initializeApp(config), { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
      if (!auth.currentUser) await signInAnonymously(auth); // 보존된 익명 사용자가 있으면 새로 만들지 않고 그대로 쓴다
      return auth;
    } catch {
      failedAt = Date.now();
      return null;
    } finally {
      signing = null;
    }
  })();
  return signing;
}

// REST 요청용 ID 토큰(만료가 가까우면 SDK 가 자동 갱신). 로그인 실패면 null.
export async function firebaseIdToken(config: FirebaseConfigShape): Promise<string | null> {
  const auth = await ensureAnonymousAuth(config);
  try {
    return (await auth?.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}
