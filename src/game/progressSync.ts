import { FIREBASE_CONFIG } from "../onlineConfig";
import type { TrainingKind } from "./types";

// 저장 시 플레이어 진행도를 Firebase 중앙 디렉터리(users/{닉네임})에 발행한다.
// 운영자 리포트(admin-report)가 원격 유저의 최고 레벨·플레이타임까지 한곳에서 집계할 수 있게 한다.
// leaf: main.ts 를 import 하지 않는다. REST PATCH(merge) 라 디렉터리(SDK)가 쓴
// online/lastSeen 은 보존되고, 디렉터리 연결 상태와 무관하게 동작한다. 부가 기능 — 실패해도 저장은 막지 않는다.

export interface ProgressUpdate {
  level: number;
  cls: string; // playerClass
  steps: number;
  playSeconds: number;
  bestFortressStage: number; // 몬스터 요새 최고 클리어 단계(쉬움 — 랭킹용). 레거시 fortressStage 와 동일 필드.
  baseLevel: number; // 그 단계 기록 당시 baseLevel(쉬움 — 난이도 맥락 표기용)
  bestFortressStageHard: number; // 어려움 최고 클리어 단계(난이도별 랭킹 분리)
  baseLevelHard: number; // 어려움 최고 단계 기록 당시 baseLevel
  kills: number; // 누적 처치 몬스터 수(랭킹 보조 지표)
  training: Record<TrainingKind, { stage: number; tries: number }>; // 훈련 종목별 최고 단계 + 그 단계 달성 시도수
}

// 훈련 종목별 랭킹 한 줄 — 최고 단계 desc, 동률이면 시도수 asc.
export interface TrainingRankEntry {
  nickname: string;
  stage: number; // 최고 클리어 단계(성공 횟수)
  tries: number; // 그 단계 달성까지 시도 횟수(적을수록 효율적)
}

export interface TrainingLeaderboard {
  top: TrainingRankEntry[];
  myRank: number | null;
  total: number;
}

// 전체 플레이어 랭킹 한 줄(요새 최고 단계 기준).
export interface RankEntry {
  nickname: string;
  stage: number;
  baseLevel: number; // 기록 당시 도전 레벨(0 = 미상/레거시)
  kills: number;
}

export interface LeaderboardResult {
  top: RankEntry[]; // 상위 N명
  myRank: number | null; // 내 순위(1-based). 기록이 없으면 null
  total: number; // 기록 보유 플레이어 수
}

// 난이도별 요새 랭킹(쉬움/어려움 각각 분리). 캐릭터 창에서 두 표로 표시.
export interface FortressLeaderboards {
  easy: LeaderboardResult;
  hard: LeaderboardResult;
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
    fortressStage: Math.max(0, Math.floor(progress.bestFortressStage)),
    fortressBase: Math.max(0, Math.floor(progress.baseLevel)),
    fortressStageHard: Math.max(0, Math.floor(progress.bestFortressStageHard)),
    fortressBaseHard: Math.max(0, Math.floor(progress.baseLevelHard)),
    kills: Math.max(0, Math.floor(progress.kills)),
    training: Object.fromEntries(
      (Object.entries(progress.training ?? {}) as [TrainingKind, { stage: number; tries: number }][]).map(([k, v]) => [k, { stage: Math.max(0, Math.floor(v.stage)), tries: Math.max(0, Math.floor(v.tries)) }]),
    ),
    progressAt: Date.now(),
  });
  try {
    const res = await fetchImpl(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    return Boolean(res?.ok);
  } catch {
    return false; // 오프라인/네트워크 오류는 조용히 무시
  }
}

// 전체 플레이어(users/*) 를 한 번 읽어 난이도별(쉬움/어려움) 요새 랭킹 두 개를 만든다.
// 레거시 기록(fortressStage 만 있고 Hard 필드 없음)은 난이도 도입 전 = 쉬움 기준이므로 쉬움 표에 포함.
// users 노드는 DB 규칙상 누구나 read 가능(party-system.md). 플레이어 수가 적어 클라이언트 정렬로 충분.
// 부가 기능 — 오프라인/오류 시 빈 결과를 돌려주고 조용히 실패한다(게임 진행 불방해).
function rankBoard(
  data: Record<string, FortressUserRow>,
  myNickname: string,
  limit: number,
  pickStage: (v: FortressUserRow) => number,
  pickBase: (v: FortressUserRow) => number,
): LeaderboardResult {
  const entries: RankEntry[] = Object.entries(data)
    .map(([nickname, v]) => ({ nickname, stage: Math.max(0, Math.floor(Number(pickStage(v) ?? 0))), baseLevel: Math.max(0, Math.floor(Number(pickBase(v) ?? 0))), kills: Math.max(0, Math.floor(Number(v?.kills ?? 0))) }))
    .filter((e) => e.stage > 0)
    .sort((a, b) => b.stage - a.stage || b.kills - a.kills || a.nickname.localeCompare(b.nickname));
  const myRank = myNickname ? (entries.findIndex((e) => e.nickname === myNickname) + 1) || null : null;
  return { top: entries.slice(0, Math.max(1, limit)), myRank, total: entries.length };
}

interface FortressUserRow {
  fortressStage?: number;
  fortressBase?: number;
  fortressStageHard?: number;
  fortressBaseHard?: number;
  level?: number;
  kills?: number;
}

export async function fetchFortressLeaderboards(
  myNickname: string,
  limit: number,
  fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch),
): Promise<FortressLeaderboards> {
  const empty: FortressLeaderboards = { easy: { top: [], myRank: null, total: 0 }, hard: { top: [], myRank: null, total: 0 } };
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || typeof fetchImpl !== "function") return empty;
  const url = `${dbUrl.replace(/\/$/, "")}/users.json`;
  try {
    const res = await fetchImpl(url);
    if (!res?.ok) return empty;
    const data = (await res.json()) as Record<string, FortressUserRow> | null;
    if (!data || typeof data !== "object") return empty;
    return {
      easy: rankBoard(data, myNickname, limit, (v) => v?.fortressStage ?? 0, (v) => v?.fortressBase ?? v?.level ?? 0),
      hard: rankBoard(data, myNickname, limit, (v) => v?.fortressStageHard ?? 0, (v) => v?.fortressBaseHard ?? 0),
    };
  } catch {
    return empty; // 오프라인/네트워크 오류는 조용히 무시
  }
}

// 훈련 종목(kind)별 상위 N명 — 최고 단계 desc, 동률이면 시도수 asc. 각 훈련 패널에 표기.
export async function fetchTrainingLeaderboard(
  myNickname: string,
  kind: TrainingKind,
  limit: number,
  fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch),
): Promise<TrainingLeaderboard> {
  const empty: TrainingLeaderboard = { top: [], myRank: null, total: 0 };
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || typeof fetchImpl !== "function") return empty;
  try {
    const res = await fetchImpl(`${dbUrl.replace(/\/$/, "")}/users.json`);
    if (!res?.ok) return empty;
    const data = (await res.json()) as Record<string, { training?: Record<string, { stage?: number; tries?: number }> }> | null;
    if (!data || typeof data !== "object") return empty;
    const entries: TrainingRankEntry[] = Object.entries(data)
      .map(([nickname, v]) => {
        const t = v?.training?.[kind];
        return { nickname, stage: Math.max(0, Math.floor(Number(t?.stage ?? 0))), tries: Math.max(0, Math.floor(Number(t?.tries ?? 0))) };
      })
      .filter((e) => e.stage > 0)
      .sort((a, b) => b.stage - a.stage || a.tries - b.tries || a.nickname.localeCompare(b.nickname));
    const myRank = myNickname ? (entries.findIndex((e) => e.nickname === myNickname) + 1) || null : null;
    return { top: entries.slice(0, Math.max(1, limit)), myRank, total: entries.length };
  } catch {
    return empty;
  }
}
