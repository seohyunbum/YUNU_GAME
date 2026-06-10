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
  obsidian_dagger: 5,
  wood_sword: 1,
  stone_sword: 2,
  copper_sword: 4,
  iron_sword: 6,
  gold_sword: 5,
  diamond_sword: 8,
  obsidian_sword: 10,
  bow: BOW_DAMAGE,
  magic_wand: MAGIC_WAND_DAMAGE,
  pistol: PISTOL_DAMAGE,
  iron_shield: 3,
  iron_bow: 5,
  diamond_bow: 8,
  rifle: 7,
  crystal_staff: 6,
  arcane_staff: 9,
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
]);
export const RANGED_PROJECTILE: Record<ItemId, "arrow" | "magic"> = {
  magic_wand: "magic",
  crystal_staff: "magic",
  arcane_staff: "magic",
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
};
export function itemRarity(item: ItemId): "common" | "rare" | "epic" {
  return ITEM_RARITY[item] ?? "common";
}

export const ARMOR_VALUE: Record<ItemId, number> = {
  leather_armor: 5,
  copper_armor: 12,
  iron_armor: 22,
  gold_armor: 30,
  diamond_armor: 45,
  obsidian_armor: 65,
};

export const SHIELD_DEFENSE: Record<ItemId, number> = {
  iron_shield: 5,
};

export const SHIELD_DURABILITY: Record<ItemId, number> = {
  iron_shield: 200,
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

export const PLACEABLE_TYPES: Record<ItemId, ObjectType> = {
  crafting_table: "workbench",
  extended_workbench: "extendedWorkbench",
  smelter: "smelter",
  special_smelter: "specialSmelter",
  grinder: "grinder",
  bed: "bed",
  building_block: "buildingBlock",
};
