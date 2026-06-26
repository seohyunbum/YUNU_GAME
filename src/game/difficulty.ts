import type { DifficultyMode, WorldObject } from "./types";

// 게임 난이도 — 타이틀에서 신규게임 시작 시 1회 선택, 게임 중 변경 불가(세이브에 고정 저장).
// "쉬움"이 현재(기존) 밸런스 = 모든 배율 1.0. "어려움"은 쉬움 대비 배율 보정.
export type { DifficultyMode };

export const DEFAULT_DIFFICULTY: DifficultyMode = "easy";

// 모든 배율은 "쉬움(현재 세팅)" 기준 곱. 1.0 = 변화 없음.
export interface DifficultyModifiers {
  monsterHp: number; // 몬스터 체력
  monsterAttack: number; // 몬스터 공격력 (스폰 시 attackDamage 에 적용)
  monsterDefense: number; // 몬스터 방어력 (armor)
  monsterChaseSpeed: number; // 몬스터 추격 속도
  questExp: number; // 퀘스트 보상 경험치
  dropChance: number; // 아이템 드랍 확률
  xpPotion: number; // 경험치병 획득량
  shopPrice: number; // 상점 포인트 가격
}

export const DIFFICULTY_MODIFIERS: Record<DifficultyMode, DifficultyModifiers> = {
  easy: { monsterHp: 1, monsterAttack: 1, monsterDefense: 1, monsterChaseSpeed: 1, questExp: 1, dropChance: 1, xpPotion: 1, shopPrice: 1 },
  // 어려움: 몬스터 공·방·추격 +30%(×1.3), 체력 +50%(×1.5), 퀘스트 경험치 −40%(×0.6),
  // 드랍률 −50%(×0.5), 경험치병 −50%(×0.5), 상점 가격 +200%(×3.0). 몬스터 처치 경험치는 변경 없음.
  hard: { monsterHp: 1.5, monsterAttack: 1.3, monsterDefense: 1.3, monsterChaseSpeed: 1.3, questExp: 0.6, dropChance: 0.5, xpPotion: 0.5, shopPrice: 3 },
};

export function isDifficultyMode(value: unknown): value is DifficultyMode {
  return value === "easy" || value === "hard";
}

export function difficultyModifiers(mode: DifficultyMode): DifficultyModifiers {
  return DIFFICULTY_MODIFIERS[mode] ?? DIFFICULTY_MODIFIERS.easy;
}

export function difficultyLabel(mode: DifficultyMode): string {
  return mode === "hard" ? "어려움" : "쉬움";
}

// 스폰된 몬스터의 전투 능력치를 난이도 배율로 보정(in-place). hp/공격/방어가 이미 세팅된 직후 호출한다.
// 호출 시점에 hp = 만피(스폰 직후)라는 가정 하에 체력 배율을 hp 에 곱한다.
export function applyMonsterDifficulty(object: WorldObject, mods: DifficultyModifiers): void {
  if (typeof object.hp === "number") object.hp = Math.max(1, Math.round(object.hp * mods.monsterHp));
  if (typeof object.attackDamage === "number") object.attackDamage = Math.max(1, Math.round(object.attackDamage * mods.monsterAttack));
  if (typeof object.armor === "number") object.armor = Math.round(object.armor * mods.monsterDefense);
}

// 상점 포인트 가격을 난이도 배율로 보정.
export function difficultyShopCost(baseCost: number, mods: DifficultyModifiers): number {
  return Math.round(baseCost * mods.shopPrice);
}
