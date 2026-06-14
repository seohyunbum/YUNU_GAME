import { itemRarity } from "./items";
import type { ItemId, Recipe } from "./types";

// 제작 레벨 시스템 — 일반 레벨과 별개. 순수 함수만 두어 골든 테스트 가능 (main.ts import 금지).

export interface CraftStatAlloc {
  hp: number;
  mana: number;
  attack: number;
  defense: number;
}

export function createCraftStatAlloc(): CraftStatAlloc {
  return { hp: 0, mana: 0, attack: 0, defense: 0 };
}

export function normalizeCraftStatAlloc(saved?: Partial<CraftStatAlloc> | null): CraftStatAlloc {
  const clamp = (v: unknown) => Math.max(0, Math.floor(typeof v === "number" && Number.isFinite(v) ? v : 0));
  return { hp: clamp(saved?.hp), mana: clamp(saved?.mana), attack: clamp(saved?.attack), defense: clamp(saved?.defense) };
}

// 다음 레벨까지 필요한 경험치 — 일반 레벨(experienceForNextLevel)을 닮되 조금 완만(전투 없이도 도달 가능).
export function craftXpForNextLevel(level: number): number {
  return Math.floor(18 * Math.pow(Math.max(1, Math.floor(level)), 1.3));
}

const RARITY_WEIGHT = { common: 1, rare: 3, epic: 6 } as const;

// 고난도 장비일수록 제작 경험치를 가파르게 상향. 저레벨 도구(임계값 이하)는 현 수준 그대로 두고,
// 임계값 초과분만 증폭 → 최상위 장비(예: 날카로운 흑요석 지팡이 82→160)는 약 2배 보상.
// 주의: '초과분 가산' 구조라 배율은 raw 에 따라 가변이다(정확히 2.0x 는 raw=100 한 점, 현 최상위 raw≈82~87 에선 ≈1.95x,
// raw 가 더 커질수록 SLOPE(2.25x)로 점근 상승). raw>100 짜리 초고난도 레시피를 추가할 땐 2배를 넘을 수 있으니 재점검.
const CRAFT_XP_BOOST_THRESHOLD = 20;
const CRAFT_XP_BOOST_SLOPE = 2.25;

// 한 번 제작 시 주는 경험치 — 재료를 많이/희귀하게 쓰는 레시피, 희귀 결과물일수록 더 많이.
export function craftXpForRecipe(recipe: Recipe): number {
  let ingredientScore = 0;
  for (const [item, count] of Object.entries(recipe.ingredients)) ingredientScore += count * RARITY_WEIGHT[itemRarity(item as ItemId)];
  const outputScore = recipe.count * RARITY_WEIGHT[itemRarity(recipe.output)];
  const raw = Math.max(5, Math.round(2 * ingredientScore + 3 * outputScore));
  if (raw <= CRAFT_XP_BOOST_THRESHOLD) return raw;
  return Math.round(CRAFT_XP_BOOST_THRESHOLD + (raw - CRAFT_XP_BOOST_THRESHOLD) * CRAFT_XP_BOOST_SLOPE);
}

export interface CraftLevelGain {
  craftLevel: number;
  craftXp: number;
  levelsGained: number;
}

// 경험치를 더하고 레벨업을 해소 — 일반 레벨업 루프를 닮음. 레벨업 수만큼 스탯 포인트를 준다.
export function applyCraftXp(craftLevel: number, craftXp: number, gained: number): CraftLevelGain {
  let lvl = Math.max(1, Math.floor(craftLevel));
  let xp = Math.max(0, craftXp) + Math.max(0, gained);
  let levelsGained = 0;
  while (xp >= craftXpForNextLevel(lvl)) {
    xp -= craftXpForNextLevel(lvl);
    lvl += 1;
    levelsGained += 1;
  }
  return { craftLevel: lvl, craftXp: xp, levelsGained };
}
