import { FIREBASE_CONFIG } from "../onlineConfig";

// 저장 시 플레이어 진행도를 Firebase 중앙 디렉터리(users/{닉네임})에 발행한다.
// 운영자 리포트(admin-report)가 원격 유저의 최고 레벨·플레이타임까지 한곳에서 집계할 수 있게 한다.
// leaf: main.ts 를 import 하지 않는다. REST PATCH(merge) 라 디렉터리(SDK)가 쓴
// online/lastSeen 은 보존되고, 디렉터리 연결 상태와 무관하게 동작한다. 부가 기능 — 실패해도 저장은 막지 않는다.

export interface ProgressUpdate {
  level: number;
  cls: string; // playerClass
  steps: number;
  playSeconds: number;
}

export async function publishProgress(
  nickname: string,
  progress: ProgressUpdate,
  fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch),
): Promise<boolean> {
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || !nickname || typeof fetchImpl !== "function") return false;
  const url = `${dbUrl.replace(/\/$/, "")}/users/${encodeURIComponent(nickname)}.json`;
  const body = JSON.stringify({
    level: Math.max(1, Math.floor(progress.level)),
    class: progress.cls,
    steps: Math.max(0, Math.floor(progress.steps)),
    playSeconds: Math.max(0, Math.floor(progress.playSeconds)),
    progressAt: Date.now(),
  });
  try {
    const res = await fetchImpl(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    return Boolean(res?.ok);
  } catch {
    return false; // 오프라인/네트워크 오류는 조용히 무시
  }
}
