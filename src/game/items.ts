import { BOW_DAMAGE, MAGIC_WAND_DAMAGE, PISTOL_DAMAGE } from "./constants";
import type { ItemId, ObjectType } from "./types";

export const ITEM_NAMES: Record<ItemId, string> = {
  tutorial_book: "튜토리얼 책",
  wood: "나무",
  stick: "나무 막대기",
  hammer: "망치",
  crafting_table: "제작대",
  extended_workbench: "확장 제작대",
  smelter: "제련대",
  special_smelter: "특수 제련대",
  grinder: "분쇄기",
  mirror: "거울",
  xp_bottle: "경험치병",
  bag: "가방",
  leather: "가죽",
  meat: "고기",
  medkit: "구급상자",
  bed: "침대",
  building_block: "쌓기블록",
  bow: "활",
  magic_wand: "마법봉",
  pistol: "권총",
  iron_shield: "철 방패",
  iron_bow: "강철 활",
  diamond_bow: "다이아 활",
  rifle: "소총",
  crystal_staff: "수정 지팡이",
  arcane_staff: "비전 지팡이",
  sharp_obsidian_shield: "날카로운 흑요석 방패",
  sharp_obsidian_staff: "날카로운 흑요석 지팡이",
  sharp_obsidian_gun: "날카로운 흑요석 총",
  bucket: "양동이",
  water_bucket: "물 양동이",
  lava_bucket: "용암 양동이",
  dragon_scale: "용의 비늘",
  dragon_tail: "용의 꼬리",
  dragon_horn: "용의 뿔",
  dragon_spawn: "용 스폰",
  plastic_block: "레고 조각",
  dirt: "흙",
  stone: "돌",
  coal: "석탄",
  copper: "구리",
  iron: "철",
  gold: "금",
  diamond: "다이아몬드",
  obsidian: "흑요석",
  stone_powder: "돌 가루",
  coal_powder: "석탄 가루",
  copper_powder: "구리 가루",
  iron_powder: "철 가루",
  gold_powder: "금 가루",
  diamond_powder: "다이아몬드 가루",
  obsidian_powder: "흑요석 가루",
  mineral_compound: "광물 혼합물",
  refined_wood: "제련된 나무",
  refined_stone: "제련된 돌",
  refined_copper: "제련된 구리",
  refined_iron: "제련된 철",
  refined_gold: "제련된 금",
  refined_diamond: "제련된 다이아몬드",
  sharp_obsidian: "날카로운 흑요석",
  weak_wood_axe: "약한 나무 도끼",
  sharp_wood_axe: "날카로운 나무 도끼",
  stone_axe: "돌 도끼",
  copper_axe: "구리 도끼",
  iron_axe: "철 도끼",
  gold_axe: "금 도끼",
  diamond_axe: "다이아몬드 도끼",
  wood_shovel: "나무 삽",
  stone_shovel: "돌 삽",
  copper_shovel: "구리 삽",
  iron_shovel: "철 삽",
  gold_shovel: "금 삽",
  diamond_shovel: "다이아몬드 삽",
  wood_pickaxe: "나무 곡괭이",
  stone_pickaxe: "돌 곡괭이",
  copper_pickaxe: "구리 곡괭이",
  iron_pickaxe: "철 곡괭이",
  gold_pickaxe: "금 곡괭이",
  diamond_pickaxe: "다이아몬드 곡괭이",
  wood_dagger: "나무 단검",
  stone_dagger: "돌 단검",
  copper_dagger: "구리 단검",
  iron_dagger: "철 단검",
  gold_dagger: "금 단검",
  diamond_dagger: "다이아몬드 단검",
  obsidian_dagger: "날카로운 흑요석 단검",
  wood_sword: "나무 검",
  stone_sword: "돌 검",
  copper_sword: "구리 검",
  iron_sword: "철 검",
  gold_sword: "금 검",
  diamond_sword: "다이아몬드 검",
  obsidian_sword: "날카로운 흑요석 검",
  leather_armor: "가죽 갑옷",
  copper_armor: "구리 갑옷",
  iron_armor: "철 갑옷",
  gold_armor: "금 갑옷",
  diamond_armor: "다이아몬드 갑옷",
  obsidian_armor: "흑요석 갑옷",
};

export const RAW_MATERIALS: ItemId[] = ["wood", "stone", "copper", "iron", "gold", "diamond"];
export const SPECIAL_SMELTER_MATERIALS: ItemId[] = [...RAW_MATERIALS, "obsidian"];
export const GRINDABLE_MATERIALS: ItemId[] = ["stone", "coal", "copper", "iron", "gold", "diamond", "obsidian"];
export const REFINED_BY_RAW: Record<ItemId, ItemId> = {
  wood: "refined_wood",
  stone: "refined_stone",
  copper: "refined_copper",
  iron: "refined_iron",
  gold: "refined_gold",
  diamond: "refined_diamond",
};
export const POWDER_BY_MINERAL: Record<ItemId, ItemId> = {
  stone: "stone_powder",
  coal: "coal_powder",
  copper: "copper_powder",
  iron: "iron_powder",
  gold: "gold_powder",
  diamond: "diamond_powder",
  obsidian: "obsidian_powder",
};

export const MATERIALS = [
  { raw: "wood", refined: "refined_wood", prefix: "wood", name: "나무", dagger: 5 },
  { raw: "stone", refined: "refined_stone", prefix: "stone", name: "돌", dagger: 10 },
  { raw: "copper", refined: "refined_copper", prefix: "copper", name: "구리", dagger: 20 },
  { raw: "iron", refined: "refined_iron", prefix: "iron", name: "철", dagger: 30 },
  { raw: "gold", refined: "refined_gold", prefix: "gold", name: "금", dagger: 25 },
  { raw: "diamond", refined: "refined_diamond", prefix: "diamond", name: "다이아몬드", dagger: 40 },
] as const;

export const WEAPON_DAMAGE: Record<ItemId, number> = {
  wood_dagger: 1,
  stone_dagger: 1,
  copper_dagger: 2,
  iron_dagger: 3,
  gold_dagger: 3,
  diamond_dagger: 4,
  obsidian_dagger: 7, // 에픽 ×1.3 (기본 5)
  wood_sword: 1,
  stone_sword: 2,
  copper_sword: 4,
  iron_sword: 6,
  gold_sword: 5,
  diamond_sword: 8,
  obsidian_sword: 13, // 에픽 ×1.3 (기본 10)
  bow: BOW_DAMAGE,
  magic_wand: MAGIC_WAND_DAMAGE,
  pistol: PISTOL_DAMAGE,
  iron_shield: 3,
  iron_bow: 5,
  diamond_bow: 8,
  rifle: 7,
  crystal_staff: 6,
  arcane_staff: 12, // 에픽 ×1.3 (기본 9)
  sharp_obsidian_shield: 10, // 레전더리 ×1.3 (기본 8). 방패 강타(iron_shield 3 초과)
  sharp_obsidian_staff: 16, // 레전더리 ×1.3 (기본 12). 최상급 마법(arcane_staff 12 초과)
  sharp_obsidian_gun: 14, // 레전더리 ×1.3 (기본 11). 최상급 총(rifle 7 초과)
  weak_wood_axe: 2,
  sharp_wood_axe: 4,
  stone_axe: 5,
  copper_axe: 6,
  iron_axe: 7,
  gold_axe: 8,
  diamond_axe: 9,
};
export const RANGED_WEAPONS: ReadonlySet<ItemId> = new Set<ItemId>([
  "bow", "magic_wand", "pistol", "iron_bow", "diamond_bow", "rifle", "crystal_staff", "arcane_staff",
  "sharp_obsidian_staff", "sharp_obsidian_gun",
]);
export const RANGED_PROJECTILE: Record<ItemId, "arrow" | "magic"> = {
  magic_wand: "magic",
  crystal_staff: "magic",
  arcane_staff: "magic",
  sharp_obsidian_staff: "magic", // 흑요석 총은 미등재 → arrow 발사
};
export const MELEE_WEAPON_DAMAGE = Object.fromEntries(Object.entries(WEAPON_DAMAGE).filter(([item]) => !RANGED_WEAPONS.has(item))) as Record<ItemId, number>;

export const HEAL_ITEMS: Record<ItemId, number> = {
  medkit: 15,
};

// 희귀 등급 — 주스(큰 순간 연출)용. 등재 안 된 아이템은 common.
export const ITEM_RARITY: Record<ItemId, "rare" | "epic"> = {
  diamond: "rare",
  diamond_powder: "rare",
  refined_diamond: "rare",
  obsidian: "rare",
  obsidian_powder: "rare",
  sharp_obsidian: "rare",
  dragon_scale: "rare",
  dragon_tail: "rare",
  dragon_horn: "epic",
  diamond_sword: "rare",
  diamond_armor: "rare",
  diamond_bow: "rare",
  rifle: "rare",
  obsidian_sword: "epic",
  obsidian_dagger: "epic",
  obsidian_armor: "epic",
  arcane_staff: "epic",
  xp_bottle: "epic",
  sharp_obsidian_shield: "epic",
  sharp_obsidian_staff: "epic",
  sharp_obsidian_gun: "epic",
};
export function itemRarity(item: ItemId): "common" | "rare" | "epic" {
  return ITEM_RARITY[item] ?? "common";
}

// 5단계 아이템 등급(시각 표시용) — 일반 < 고급 < 희귀 < 에픽 < 레전더리.
// 제작 경험치 가중치(itemRarity)와는 분리: 이 등급은 핫바/인벤토리 슬롯 배경색에만 쓰여 기존 밸런스에 영향 없음.
// 미등재 = common(일반). 색: 일반=무색 / 고급=옅은초록 / 희귀=옅은파랑 / 에픽=옅은보라 / 레전더리=옅은붉은.
export type ItemTier = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const ITEM_TIER: Partial<Record<ItemId, ItemTier>> = {
  // 고급(uncommon) — 중급 금속·실용 제작품
  extended_workbench: "uncommon", special_smelter: "uncommon", grinder: "uncommon", mirror: "uncommon",
  bag: "uncommon", medkit: "uncommon", bed: "uncommon", lava_bucket: "uncommon", mineral_compound: "uncommon",
  iron: "uncommon", iron_powder: "uncommon", refined_iron: "uncommon",
  sharp_wood_axe: "uncommon", iron_axe: "uncommon", iron_shovel: "uncommon", iron_pickaxe: "uncommon",
  iron_dagger: "uncommon", iron_sword: "uncommon", iron_armor: "uncommon",
  magic_wand: "uncommon", pistol: "uncommon", iron_shield: "uncommon", iron_bow: "uncommon",
  // 희귀(rare) — 금·다이아몬드 계열
  gold: "rare", gold_powder: "rare", refined_gold: "rare", diamond: "rare", diamond_powder: "rare", refined_diamond: "rare",
  gold_axe: "rare", gold_shovel: "rare", gold_pickaxe: "rare", gold_dagger: "rare", gold_sword: "rare", gold_armor: "rare",
  diamond_axe: "rare", diamond_shovel: "rare", diamond_pickaxe: "rare", diamond_dagger: "rare", diamond_sword: "rare",
  diamond_armor: "rare", diamond_bow: "rare", rifle: "rare", crystal_staff: "rare", dragon_scale: "rare",
  // 에픽(epic) — 흑요석·용 소재·최상급 장비
  obsidian: "epic", obsidian_powder: "epic", sharp_obsidian: "epic",
  obsidian_dagger: "epic", obsidian_sword: "epic", obsidian_armor: "epic", arcane_staff: "epic",
  dragon_tail: "epic", dragon_horn: "epic", dragon_spawn: "epic",
  // 레전더리(legendary) — 최종 흑요석 무기 3종 + 경험치병(매우 희귀)
  sharp_obsidian_staff: "legendary", sharp_obsidian_gun: "legendary", sharp_obsidian_shield: "legendary", xp_bottle: "legendary",
};
export function itemTier(item: ItemId): ItemTier {
  return ITEM_TIER[item] ?? "common";
}

export const ARMOR_VALUE: Record<ItemId, number> = {
  leather_armor: 4,
  copper_armor: 7,
  iron_armor: 10,
  gold_armor: 15,
  diamond_armor: 25,
  obsidian_armor: 40,
};

export const SHIELD_DEFENSE: Record<ItemId, number> = {
  iron_shield: 5,
  sharp_obsidian_shield: 10, // 최상급 방패(iron 5 초과)
};

export const SHIELD_DURABILITY: Record<ItemId, number> = {
  iron_shield: 200,
  sharp_obsidian_shield: 300, // 더 단단(iron 200 초과)
};

export const AXE_POWER: Record<ItemId, number> = {
  weak_wood_axe: 1,
  sharp_wood_axe: 2,
  stone_axe: 2,
  copper_axe: 3,
  iron_axe: 4,
  gold_axe: 3,
  diamond_axe: 5,
};

export const PICKAXE_POWER: Record<ItemId, number> = {
  wood_pickaxe: 1,
  stone_pickaxe: 2,
  copper_pickaxe: 3,
  iron_pickaxe: 4,
  gold_pickaxe: 3,
  diamond_pickaxe: 5,
};

export const SHOVEL_POWER: Record<ItemId, number> = {
  wood_shovel: 1,
  stone_shovel: 2,
  copper_shovel: 3,
  iron_shovel: 4,
  gold_shovel: 3,
  diamond_shovel: 5,
};

export const HARVEST_HARDNESS: Record<ItemId, number> = {
  wood: 3,
  stone: 4,
  coal: 4,
  copper: 5,
  iron: 7,
  gold: 8,
  diamond: 10,
  obsidian: 14,
};

export const DURABLE_TOOL_TABLES = [AXE_POWER, PICKAXE_POWER, SHOVEL_POWER];
export const DEFAULT_TOOL_DURABILITY = 10;
export const TOOL_DURABILITY: Record<ItemId, number> = {
  weak_wood_axe: 10,
  sharp_wood_axe: 10,
  wood_pickaxe: 10,
  wood_shovel: 10,
  stone_axe: 20,
  stone_pickaxe: 20,
  stone_shovel: 20,
  copper_axe: 30,
  copper_pickaxe: 30,
  copper_shovel: 30,
  iron_axe: 45,
  iron_pickaxe: 45,
  iron_shovel: 45,
  gold_axe: 25,
  gold_pickaxe: 25,
  gold_shovel: 25,
  diamond_axe: 80,
  diamond_pickaxe: 80,
  diamond_shovel: 80,
};

export function isDurableTool(item: ItemId | null) {
  return Boolean(item && DURABLE_TOOL_TABLES.some((table) => table[item]));
}

export function toolMaxDurability(item: ItemId): number {
  return TOOL_DURABILITY[item] ?? DEFAULT_TOOL_DURABILITY;
}

// 수리 시스템 (docs/repair-system.md) — 도구 id prefix 에서 등급 제련 재료를 파생한다.
export function repairMaterialFor(item: ItemId): ItemId | null {
  if (!DURABLE_TOOL_TABLES.some((table) => table[item])) return null;
  if (item.startsWith("weak_wood_") || item.startsWith("sharp_wood_")) return "refined_wood";
  return MATERIALS.find((material) => item.startsWith(`${material.prefix}_`))?.refined ?? null;
}

// 수리 1회 = 최대 내구도의 50% 회복(올림). 완전히 닳은 도구도 재료 2개로 반드시 완전 회복된다.
export function repairPerMaterial(item: ItemId): number {
  return Math.ceil(toolMaxDurability(item) * 0.5);
}

export function shortName(item: ItemId) {
  const name = ITEM_NAMES[item] ?? item;
  return name.length > 6 ? `${name.slice(0, 6)}` : name;
}

export const PLACEABLE_TYPES: Record<ItemId, ObjectType> = {
  crafting_table: "workbench",
  extended_workbench: "extendedWorkbench",
  smelter: "smelter",
  special_smelter: "specialSmelter",
  grinder: "grinder",
  bed: "bed",
  building_block: "buildingBlock",
};
