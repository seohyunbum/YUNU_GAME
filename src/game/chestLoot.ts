import type { ItemId } from "./types";

// 보물 상자 전리품 롤 — main.openChest 에서 추출. 파티에선 호스트가 1회 롤해 개봉자에게 전달(이중 지급 방지).
// 등급(chestTier) 0 일반 / 1 황금 / 2 다이아몬드 / 3 흑요석 — 고급일수록 희귀 재료·제작템·무기/방어구.
export interface ChestLootEntry {
  item: ItemId;
  count: number;
}

export type ChestTier = 0 | 1 | 2 | 3;

const TIER_NAMES = ["일반 상자", "황금 상자", "다이아몬드 상자", "흑요석 상자"] as const;
export function chestTierName(tier: number): string {
  return TIER_NAMES[Math.max(0, Math.min(3, Math.floor(tier)))];
}

// 등급 추첨: 일반 74% / 황금 20% / 다이아 5% / 흑요석 1%
export function rollChestTier(rng: () => number = Math.random): ChestTier {
  const r = rng();
  if (r < 0.01) return 3;
  if (r < 0.06) return 2;
  if (r < 0.26) return 1;
  return 0;
}

const ri = (min: number, max: number, rng: () => number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

export function rollChestLoot(tier: number = 0, rng: () => number = Math.random): ChestLootEntry[] {
  const loot: ChestLootEntry[] = [];
  const add = (item: ItemId, count: number) => { if (count > 0) loot.push({ item, count }); };
  const chance = (p: number) => rng() < p;
  if (tier >= 3) {
    // 흑요석 — 에픽 장비 + 드래곤 재료 (잭팟)
    add("obsidian", ri(2, 4, rng));
    add("sharp_obsidian", ri(1, 2, rng));
    add("refined_diamond", ri(2, 3, rng));
    add(pick(["obsidian_sword", "obsidian_dagger"] as const, rng), 1);
    if (chance(0.55)) add("obsidian_armor", 1);
    if (chance(0.4)) add("arcane_staff", 1);
    add("dragon_scale", ri(1, 2, rng));
    if (chance(0.15)) add("dragon_horn", 1);
    if (chance(0.25)) add("xp_bottle", 1); // 레전더리 — 희귀하게(종전 60%·1~2개)
    add("medkit", ri(2, 3, rng));
  } else if (tier === 2) {
    // 다이아몬드 — 희귀 재료 + 다이아 장비
    add("diamond", ri(1, 3, rng));
    add("refined_diamond", ri(1, 2, rng));
    add("gold", ri(3, 5, rng));
    if (chance(0.5)) add(pick(["diamond_sword", "diamond_dagger", "diamond_bow"] as const, rng), 1);
    if (chance(0.35)) add("diamond_armor", 1);
    if (chance(0.3)) add(pick(["crystal_staff", "rifle"] as const, rng), 1);
    if (chance(0.1)) add("xp_bottle", 1); // 레전더리 — 희귀하게(종전 20%)
    add("medkit", ri(1, 2, rng));
  } else if (tier === 1) {
    // 황금 — 좋은 재료 + 철/금 장비·제작템 가능
    add("gold", ri(2, 4, rng));
    add("refined_iron", ri(1, 3, rng));
    add("iron", ri(2, 4, rng));
    if (chance(0.35)) add(pick(["iron_sword", "gold_sword", "iron_dagger"] as const, rng), 1);
    if (chance(0.25)) add(pick(["iron_armor", "gold_armor"] as const, rng), 1);
    if (chance(0.3)) add(pick(["smelter", "grinder"] as const, rng), 1);
    add("medkit", 1);
    if (chance(0.3)) add("leather", ri(2, 3, rng));
  } else {
    // 일반 — 기존과 동일
    if (chance(0.5)) add("hammer", 1);
    if (chance(0.02)) add("smelter", 1);
    if (chance(0.45)) add("wood", ri(1, 3, rng));
    if (chance(0.35)) add("stick", ri(1, 2, rng));
    if (chance(0.38)) add("stone", ri(1, 3, rng));
    if (chance(0.15)) add("leather", 1);
  }
  return loot;
}
