import type { ItemId } from "./types";

// 목걸이 4종(에픽) — 한 번에 하나만 착용. 효과는 main.ts 의 스탯 계산 지점에서 합산/배수로 반영한다.
//  · 힘의 목걸이  strength_necklace : 공격력 +5
//  · 수호의 목걸이 guardian_necklace : 방어력 +5
//  · 쾌속의 목걸이 swift_necklace    : 공격속도 +10% (쿨타임/시전시간 ×0.9)
//  · 현자의 목걸이 sage_necklace     : 스킬 쿨타임 -10% (×0.9)
export const NECKLACE_IDS: ItemId[] = ["strength_necklace", "guardian_necklace", "swift_necklace", "sage_necklace"];
const NECKLACE_SET = new Set<ItemId>(NECKLACE_IDS);

export function isNecklace(item: ItemId | null | undefined): boolean {
  return Boolean(item && NECKLACE_SET.has(item));
}

export function necklaceAttackBonus(necklace: ItemId | null): number {
  return necklace === "strength_necklace" ? 5 : 0;
}

export function necklaceDefenseBonus(necklace: ItemId | null): number {
  return necklace === "guardian_necklace" ? 5 : 0;
}

// 공격속도 +10% → 공격 쿨타임/시전 시간에 곱하는 배수(작을수록 빠름).
export function necklaceAttackSpeedMult(necklace: ItemId | null): number {
  return necklace === "swift_necklace" ? 0.9 : 1;
}

// 스킬 쿨타임 -10% → 쿨타임에 곱하는 배수.
export function necklaceSkillCooldownMult(necklace: ItemId | null): number {
  return necklace === "sage_necklace" ? 0.9 : 1;
}
