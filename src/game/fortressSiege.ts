import { ARENA_CENTER_Z, ARENA_HALF, SIEGE_MAX_ALIVE, SIEGE_SPAWN_STAGGER, SIEGE_WAVE_CLEAR_DELAY } from "./constants";
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
  return 1 + Math.floor((stage - 1) / 3); // 1~3단계 1개, 4~6 2개, 7~9 3개 …
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
}

export function createSiegeState(baseLevel: number): SiegeState {
  const stage = 1;
  return {
    active: true,
    stage,
    waveIndex: 0,
    wavesInStage: wavesForStage(stage),
    toSpawn: monstersForWave(stage),
    spawnTimer: 0.8, // 진입 직후 약간의 준비 시간
    clearTimer: 0,
    aliveIds: [],
    baseLevel: Math.max(1, Math.floor(baseLevel)),
    spawnCursor: 0,
  };
}

export interface SiegeContext {
  spawnSiegeMonster(x: number, z: number, level: number, elite: boolean): string | null;
  isAlive(id: string): boolean;
  grantStageReward(stage: number, tomes: number, items: Partial<Record<ItemId, number>>): void;
  showMessage(text: string): void;
  renderHud(): void;
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
      context.grantStageReward(state.stage, tomes, itemsForStage(state.stage));
      context.showMessage(`🏰 ${state.stage}단계 클리어! 전직의서 ${tomes}개 + 보상 획득. 잠시 후 더 강한 다음 단계가 시작됩니다…`);
      state.stage += 1;
      state.waveIndex = 0;
      state.wavesInStage = wavesForStage(state.stage);
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
