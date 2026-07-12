import { ARENA_CENTER_Z, ARENA_HALF, SIEGE_MAX_ALIVE, SIEGE_SPAWN_STAGGER, SIEGE_WAVE_CLEAR_DELAY } from "./constants";
import { createFortressBossRuntime, fortressBossConceptForStage, fortressBossStats, isFortressBossStage, updateFortressBossPatterns, type FortressBossPatternContext, type FortressBossRuntime } from "./fortressBoss";
import { runeItemId, RUNE_KEY, RUNE_TYPES, type RuneTier } from "./runeStones";
import type { ItemId } from "./types";

// 몬스터 요새 디펜스 — 무한 점증 웨이브 상태머신(순수 로직). main.ts import 금지(leaf).
// 스폰·보상·메시지는 SiegeContext 콜백으로만 게임에 닿는다. 설계: docs/monster-fortress-design.md

// ===== 점증 공식(데이터·조정 가능) =====
export function wavesForStage(stage: number): number {
  return Math.min(2 + Math.floor(stage / 2), 5);
}
export function monstersForWave(stage: number): number {
  return 6 + stage; // 웨이브당 마릿수
}
export function levelForStage(baseLevel: number, stage: number): number {
  return Math.max(1, baseLevel + stage * 3);
}
export function tomesForStage(stage: number): number {
  return 1 + Math.floor((stage - 1) / 3) + (isFortressBossStage(stage) ? 2 : 0); // 1~3단계 1개, 4~6 2개, 7~9 3개 … + 보스 단계(5의 배수) 보너스 2개
}
// 단계가 오를수록 정예(강화) 비율↑ — 3단계 급증 절벽 완화(0.08+0.04→0.05+0.025, 상한 0.5→0.4, #3)
export function eliteChance(stage: number): number {
  return Math.min(0.05 + stage * 0.025, 0.4);
}
// 단계별 추가 아이템 보상(전직의서와 별개)
export function itemsForStage(stage: number): Partial<Record<ItemId, number>> {
  const items: Partial<Record<ItemId, number>> = { obsidian: 2 + Math.floor(stage / 2) };
  if (stage >= 3) items.diamond = 1 + Math.floor((stage - 3) / 2);
  if (stage >= 5) items.refined_diamond = 1 + Math.floor((stage - 5) / 3);
  if (stage >= 7) items.sharp_obsidian = 1 + Math.floor((stage - 7) / 3);
  if (stage % 3 === 0) items.advanced_medkit = 1;
  if (isFortressBossStage(stage)) { // 보스 단계 처치 보너스 — 단계가 깊을수록 두둑하게 + 마석 시스템 확정 보상(고급 아이템이라 여기서 보장)
    items.diamond = (items.diamond ?? 0) + 2 + Math.floor(stage / 10);
    items.refined_diamond = (items.refined_diamond ?? 0) + 1 + Math.floor(stage / 15);
    items.advanced_medkit = (items.advanced_medkit ?? 0) + 1;
    items[RUNE_KEY] = (items[RUNE_KEY] ?? 0) + 1; // 마석열쇠 1개(슬롯 해금 페이싱)
    const runeType = RUNE_TYPES[(Math.floor(stage / 5) - 1) % RUNE_TYPES.length]; // 보스 컨셉과 짝맞춰 순환
    const runeTier = Math.min(4, 1 + Math.floor(stage / 15)) as RuneTier; // 15·30단계마다 등급↑
    items[runeItemId(runeType, runeTier)] = (items[runeItemId(runeType, runeTier)] ?? 0) + 1;
  }
  return items;
}

export interface SiegeState {
  active: boolean;
  stage: number; // 1,2,3,…
  waveIndex: number; // 0-based, 현재 단계 내
  wavesInStage: number;
  toSpawn: number; // 이번 웨이브 남은 스폰 수
  spawnTimer: number; // 다음 스폰까지(초)
  clearTimer: number; // 웨이브/단계 클리어 후 다음까지(초). >0 이면 대기 중.
  aliveIds: string[]; // 스폰된 생존 몬스터 id
  baseLevel: number;
  spawnCursor: number; // 통로 라운드로빈 — 진입마다 리셋(모듈 전역 누적 방지)
  bossPhase: "none" | "pending" | "trailer" | "fight"; // 5단계 보스 스테이지 흐름: 트레일러 → 스폰 → 전투
  bossRuntime: FortressBossRuntime | null; // 텔레그래프 패턴 엔진 상태(전투 중에만)
}

// 맵별 몬스터 요새 최고 클리어 단계 — 재입장 시 이어서 시작. SSOT=세이브(player.fortressStageByMap, 로드 시 복원);
// localStorage 는 부팅 초기값·구세이브(필드 없음) 백필용 미러다(전엔 여기에만 있어 로드-리셋으로 매번 1단계부터 시작하던 버그).
const FORTRESS_STAGE_BY_MAP_KEY = "ai-game-lab:fortress-stage-by-map-v1";
export function loadFortressStageByMap(): Record<string, number> {
  try { const raw = localStorage.getItem(FORTRESS_STAGE_BY_MAP_KEY); const obj = raw ? JSON.parse(raw) : {}; return obj && typeof obj === "object" ? (obj as Record<string, number>) : {}; } catch { return {}; }
}
export function saveFortressStageByMap(map: Record<string, number>): void {
  try { localStorage.setItem(FORTRESS_STAGE_BY_MAP_KEY, JSON.stringify(map)); } catch { /* 저장 차단 환경 무시 */ }
}
// 로드 시 복원 — 세이브 필드 우선, 없으면(구세이브) 로드 직전 값으로 백필(localStorage 전역값).
// resetGameState 가 로드 경로에서도 진행을 {} 로 지우므로, 여기서 세이브 기준으로 되살리고 localStorage 미러도 맞춘다.
export function restoreFortressStageByMap(fromSave: Record<string, number> | undefined, fallback: Record<string, number>): Record<string, number> {
  const restored = { ...(fromSave ?? fallback) };
  saveFortressStageByMap(restored);
  return restored;
}

export function createSiegeState(baseLevel: number, startStage = 1): SiegeState {
  const stage = Math.max(1, Math.floor(startStage));
  const boss = isFortressBossStage(stage); // 보스 단계로 직행(재입장 이어서)이어도 트레일러부터
  return {
    active: true,
    stage,
    waveIndex: 0,
    wavesInStage: boss ? 1 : wavesForStage(stage),
    toSpawn: boss ? 0 : monstersForWave(stage),
    spawnTimer: 0.8, // 진입 직후 약간의 준비 시간
    clearTimer: boss ? 1.6 : 0, // 보스 단계는 짧은 정적 후 트레일러
    aliveIds: [],
    baseLevel: Math.max(1, Math.floor(baseLevel)),
    spawnCursor: 0,
    bossPhase: boss ? "pending" : "none",
    bossRuntime: null,
  };
}

export interface SiegeContext {
  spawnSiegeMonster(x: number, z: number, level: number, elite: boolean): string | null;
  isAlive(id: string): boolean;
  grantStageReward(stage: number, tomes: number, items: Partial<Record<ItemId, number>>): void;
  showMessage(text: string): void;
  renderHud(): void;
  startBossTrailer(stage: number): void; // 보스 등장 트레일러(컷씬) 시작 — 소품·오버레이는 main 이 배선
  spawnSiegeBoss(stage: number): string | null; // 보스 몬스터 스폰 → id
  isCutsceneActive(): boolean; // 트레일러 재생 중 여부(끝나면 보스 스폰)
  isPanelOpen(): boolean; // 패널 열림 = 보스 패턴 일시정지
  bossPattern: FortressBossPatternContext; // 텔레그래프 패턴 시전 컨텍스트(중앙 필드로 연결)
}

// 4 갈래 가장자리 스폰 지점(중앙 플레이어로 수렴). 스폰 순번으로 통로를 돌려 고르게.
function lanePoint(index: number): { x: number; z: number } {
  const edge = ARENA_HALF - 1.5;
  const spread = (ARENA_HALF - 3) * (Math.random() * 2 - 1);
  switch (index % 4) {
    case 0: return { x: spread, z: ARENA_CENTER_Z - edge }; // 북
    case 1: return { x: spread, z: ARENA_CENTER_Z + edge }; // 남
    case 2: return { x: -edge, z: ARENA_CENTER_Z + spread }; // 서
    default: return { x: edge, z: ARENA_CENTER_Z + spread }; // 동
  }
}

// 매 프레임 호출(동굴 모드 + siege.active). 상태를 진행시킨다.
export function updateSiege(state: SiegeState, context: SiegeContext, delta: number) {
  if (!state.active) return;

  // 생존 목록 정리
  for (let i = state.aliveIds.length - 1; i >= 0; i -= 1) {
    if (!context.isAlive(state.aliveIds[i])) state.aliveIds.splice(i, 1);
  }

  // 웨이브/단계 클리어 대기 중
  if (state.clearTimer > 0) {
    state.clearTimer -= delta;
    if (state.clearTimer <= 0) beginNextWave(state, context);
    return;
  }

  // ── 5단계 보스 스테이지 흐름: pending(트레일러 시작) → trailer(컷씬 대기) → fight(패턴 전투) ──
  if (state.bossPhase === "pending") {
    context.startBossTrailer(state.stage);
    state.bossPhase = "trailer";
    return;
  }
  if (state.bossPhase === "trailer") {
    if (context.isCutsceneActive()) return; // 트레일러(스킵 포함) 종료를 기다렸다가 스폰
    const id = context.spawnSiegeBoss(state.stage);
    if (!id) { state.bossPhase = "none"; return; } // 스폰 실패 안전망 — 일반 단계로 강등(멈춤 방지)
    state.aliveIds.push(id);
    state.bossRuntime = createFortressBossRuntime(id, state.stage, fortressBossStats(state.baseLevel, state.stage).attackBase);
    state.bossPhase = "fight";
    context.renderHud();
    return;
  }
  if (state.bossPhase === "fight" && state.bossRuntime && state.aliveIds.length > 0) {
    updateFortressBossPatterns(state.bossRuntime, context.bossPattern, delta, context.isPanelOpen());
  }

  // 스폰 진행
  if (state.toSpawn > 0) {
    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0 && state.aliveIds.length < SIEGE_MAX_ALIVE) {
      const point = lanePoint(state.spawnCursor);
      state.spawnCursor += 1;
      const elite = Math.random() < eliteChance(state.stage);
      const level = levelForStage(state.baseLevel, state.stage) + (elite ? 4 : 0);
      const id = context.spawnSiegeMonster(point.x, point.z, level, elite);
      if (id) state.aliveIds.push(id);
      state.toSpawn -= 1;
      state.spawnTimer = SIEGE_SPAWN_STAGGER;
    }
    return;
  }

  // 모두 스폰됐고 전멸 → 웨이브 클리어
  if (state.aliveIds.length === 0) {
    const lastWave = state.waveIndex + 1 >= state.wavesInStage;
    if (lastWave) {
      // 단계 클리어 → 보상 + 다음 단계
      const tomes = tomesForStage(state.stage);
      const bossDown = state.bossPhase === "fight";
      context.grantStageReward(state.stage, tomes, itemsForStage(state.stage));
      context.showMessage(bossDown
        ? `👑 ${fortressBossConceptForStage(state.stage).name} 격파! ${state.stage}단계 클리어 — 전직의서 ${tomes}개 + 보스 보상 획득. 잠시 후 다음 단계…`
        : `🏰 ${state.stage}단계 클리어! 전직의서 ${tomes}개 + 보상 획득. 잠시 후 더 강한 다음 단계가 시작됩니다…`);
      state.stage += 1;
      state.waveIndex = 0;
      state.wavesInStage = isFortressBossStage(state.stage) ? 1 : wavesForStage(state.stage);
      state.bossPhase = isFortressBossStage(state.stage) ? "pending" : "none";
      state.bossRuntime = null;
      state.clearTimer = SIEGE_WAVE_CLEAR_DELAY + 2;
    } else {
      context.showMessage(`웨이브 클리어! (${state.waveIndex + 1}/${state.wavesInStage}) 다음 웨이브 대비…`);
      state.waveIndex += 1;
      state.clearTimer = SIEGE_WAVE_CLEAR_DELAY;
    }
    context.renderHud();
  }
}

function beginNextWave(state: SiegeState, context: SiegeContext) {
  if (state.bossPhase !== "none") { // 보스 단계 — 웨이브 스폰 대신 트레일러 흐름(pending 핸들러)으로
    state.toSpawn = 0;
    context.showMessage(`👑 ${state.stage}단계 — ${fortressBossConceptForStage(state.stage).name}이(가) 요새에 강림합니다!`);
    context.renderHud();
    return;
  }
  state.toSpawn = monstersForWave(state.stage);
  state.spawnTimer = 0.3;
  if (state.waveIndex === 0) context.showMessage(`🏰 ${state.stage}단계 도전 시작! (웨이브 ${state.wavesInStage}개 · 정예 ${Math.round(eliteChance(state.stage) * 100)}%) 중앙을 사수하세요.`); // 새 단계 알림 + 정예 출현률 텔레그래프(#3)
  context.renderHud();
}

// HUD 표시용 요약
export function siegeStatus(state: SiegeState): { stage: number; wave: number; waves: number; remaining: number; intermission: boolean } {
  return {
    stage: state.stage,
    wave: state.waveIndex + 1,
    waves: state.wavesInStage,
    remaining: state.aliveIds.length + state.toSpawn,
    intermission: state.clearTimer > 0,
  };
}
