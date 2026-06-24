import type { ItemId } from "./types";
import { necklaceAttackSpeedHaste, necklaceSkillCooldownReduction } from "./necklace";

// 용 장비 4종(최고등급=레전더리/빨강) — 가방에 보유하면 자동 착용(부위별 독립, 목걸이와 별개).
// 제작으로만 획득(용 뿔 1 + 꼬리 3 + 비늘 6). 효과는 main.ts 스탯 계산 지점에서 합산/배수로 반영.
//  · 용의 장갑 dragon_gloves : 공격력 +10 · 공격속도 +10%
//  · 용의 부츠 dragon_boots  : 이동속도 +15% · 최대 HP·마나 +10
//  · 용의 망토 dragon_cloak  : 방어력 +10 · 초당 체력 회복 +2
//  · 용의 왕관 dragon_crown  : 스킬 쿨타임 -10% · 초당 마나 회복 +2
export const DRAGON_GEAR_IDS: ItemId[] = ["dragon_gloves", "dragon_boots", "dragon_cloak", "dragon_crown"];

export interface DragonGearWorn {
  gloves: boolean;
  boots: boolean;
  cloak: boolean;
  crown: boolean;
}

export const NO_DRAGON_GEAR: DragonGearWorn = { gloves: false, boots: false, cloak: false, crown: false };

// 보유 여부 → 착용 상태로 해석(자동 착용).
export function resolveDragonGear(has: (item: ItemId) => boolean): DragonGearWorn {
  return {
    gloves: has("dragon_gloves"),
    boots: has("dragon_boots"),
    cloak: has("dragon_cloak"),
    crown: has("dragon_crown"),
  };
}

// ── 평탄(flat) 보너스 — 이미 합연산이라 그대로 더하면 됨 ──
export function dragonGearAttackBonus(w: DragonGearWorn): number { return w.gloves ? 10 : 0; }
export function dragonGearDefenseBonus(w: DragonGearWorn): number { return w.cloak ? 10 : 0; }
export function dragonGearMaxHpBonus(w: DragonGearWorn): number { return w.boots ? 10 : 0; }
export function dragonGearMaxManaBonus(w: DragonGearWorn): number { return w.boots ? 10 : 0; }
export function dragonGearHealthRegenBonus(w: DragonGearWorn): number { return w.cloak ? 2 : 0; }
export function dragonGearManaRegenBonus(w: DragonGearWorn): number { return w.crown ? 2 : 0; }

// ── 퍼센트 보너스 (장신구 계층 합연산) ──
export function dragonGearAttackSpeedHaste(w: DragonGearWorn): number { return w.gloves ? 0.1 : 0; } // 공속 +10%
export function dragonGearMoveSpeedPct(w: DragonGearWorn): number { return w.boots ? 0.15 : 0; } // 이동속도 +15%
export function dragonGearSkillCooldownReduction(w: DragonGearWorn): number { return w.crown ? 0.1 : 0; } // 스킬쿨 -10%

// 장신구 계층 공속 → 쿨타임/시전시간에 곱하는 단일 배수(작을수록 빠름).
// 목걸이 haste + 용장갑 haste 를 합연산(합산) 후 1/(1+합) — 곱연산 과증폭 방지.
export function accessoryAttackSpeedMult(necklace: ItemId | null, w: DragonGearWorn, permanent: ItemId | null = null): number {
  const haste = necklaceAttackSpeedHaste(necklace) + necklaceAttackSpeedHaste(permanent) + dragonGearAttackSpeedHaste(w);
  return 1 / (1 + haste);
}

// 장신구 계층 스킬 쿨타임 → 쿨타임에 곱하는 단일 배수. 목걸이 + 용왕관 감소율 합연산.
export function accessorySkillCooldownMult(necklace: ItemId | null, w: DragonGearWorn, permanent: ItemId | null = null): number {
  const reduction = necklaceSkillCooldownReduction(necklace) + necklaceSkillCooldownReduction(permanent) + dragonGearSkillCooldownReduction(w);
  return Math.max(0.1, 1 - reduction);
}

// 이동속도 계층 합연산 배수: 1 + (클래스 이동배수-1) + 용부츠 이동%.
export function additiveMoveSpeedMult(classMoveSpeedMult: number, w: DragonGearWorn): number {
  return 1 + (classMoveSpeedMult - 1) + dragonGearMoveSpeedPct(w);
}
