// 보스 챕터 게이팅 — docs/boss-chapter-economy-balance.md "보스 챕터 진행표"의 게이트 구현.
// bossChapter = 순서대로 처치한 보스 수 (0 = 아직 없음, 6 = 전부 클리어).
// 이전 보스를 처치해야 다음 보스의 봉인이 풀린다.
import { BOSS_STATS } from "./monsters";
import type { BossKind } from "./types";

export interface BossChapterStep {
  kind: BossKind;
  chapter: number;
  recommendedLevel: number;
}

export const BOSS_PROGRESSION: readonly BossChapterStep[] = [
  { kind: "dragon", chapter: 1, recommendedLevel: 10 },
  { kind: "fire_dragon", chapter: 2, recommendedLevel: 15 },
  { kind: "red_dragon", chapter: 3, recommendedLevel: 22 },
  { kind: "laser_dragon", chapter: 4, recommendedLevel: 32 },
  { kind: "dark_dragon", chapter: 5, recommendedLevel: 45 },
  { kind: "immortal", chapter: 6, recommendedLevel: 60 },
];

export const FINAL_BOSS_CHAPTER = BOSS_PROGRESSION.length;

export function normalizeBossChapter(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(FINAL_BOSS_CHAPTER, Math.max(0, Math.floor(value)));
}

function progressionIndex(kind: BossKind): number {
  return BOSS_PROGRESSION.findIndex((step) => step.kind === kind);
}

export function isBossUnlocked(kind: BossKind, bossChapter: number): boolean {
  const index = progressionIndex(kind);
  return index < 0 || index <= normalizeBossChapter(bossChapter);
}

export function bossLockMessage(kind: BossKind, bossChapter: number): string | null {
  if (isBossUnlocked(kind, bossChapter)) return null;
  const required = BOSS_PROGRESSION[normalizeBossChapter(bossChapter)];
  return `${BOSS_STATS[kind].name}은(는) 아직 봉인되어 있습니다. 먼저 ${BOSS_STATS[required.kind].name}을(를) 처치하세요.`;
}

export function nextBossTarget(bossChapter: number): BossChapterStep | null {
  return BOSS_PROGRESSION[normalizeBossChapter(bossChapter)] ?? null;
}

export function applyBossDefeat(bossChapter: number, kind: BossKind): { bossChapter: number; message: string | null } {
  const chapter = normalizeBossChapter(bossChapter);
  const target = BOSS_PROGRESSION[chapter];
  if (!target || target.kind !== kind) return { bossChapter: chapter, message: null };
  const next = BOSS_PROGRESSION[chapter + 1] ?? null;
  const message = next
    ? `챕터 ${target.chapter} 클리어! 다음 목표: ${BOSS_STATS[next.kind].name} (권장 레벨 ${next.recommendedLevel})`
    : `챕터 ${target.chapter} 클리어! 모든 보스를 정복했습니다. 이제 세계를 자유롭게 탐험하세요.`;
  return { bossChapter: chapter + 1, message };
}
