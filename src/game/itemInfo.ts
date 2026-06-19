// 아이템 능력치·설명 디스크라이버 (순수) — 인벤토리/캐릭터창 마우스오버 툴팁이 쓴다.
// leaf: 데이터 테이블(items/recipes/necklace)만 읽어 표시용 정보를 만든다. 게임 객체/부수효과 없음.
import {
  ARMOR_VALUE,
  AXE_POWER,
  GUN_WEAPONS,
  HEAL_ITEMS,
  ITEM_NAMES,
  PICKAXE_POWER,
  RANGED_PROJECTILE,
  RANGED_WEAPONS,
  SHIELD_DEFENSE,
  SHIELD_DURABILITY,
  SHOVEL_POWER,
  WEAPON_DAMAGE,
  itemTier,
  toolMaxDurability,
  type ItemTier,
} from "./items";
import { isNecklace, necklaceAttackBonus, necklaceDefenseBonus } from "./necklace";
import { MINI_RECIPES, WORKBENCH_RECIPES } from "./recipes";
import type { ItemId } from "./types";

export interface ItemInfo {
  name: string;
  tier: ItemTier;
  tierLabel: string;
  stats: string[];
  note: string | null;
}

const TIER_LABELS: Record<ItemTier, string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  epic: "에픽",
  legendary: "레전더리",
};

// 목걸이 효과 문구 — necklace.ts 의 배수/보너스와 같은 의미를 사람이 읽는 형태로.
const NECKLACE_EFFECT: Partial<Record<ItemId, string>> = {
  strength_necklace: `공격력 +${necklaceAttackBonus("strength_necklace")}`,
  guardian_necklace: `방어력 +${necklaceDefenseBonus("guardian_necklace")}`,
  swift_necklace: "공격속도 +25%",
  sage_necklace: "스킬 쿨타임 -15%",
};

// 제작 가능한 아이템은 레시피 note 를 설명으로 재활용한다 (중복 방지).
const RECIPE_NOTES: Partial<Record<ItemId, string>> = {};
for (const recipe of [...MINI_RECIPES, ...WORKBENCH_RECIPES]) {
  if (RECIPE_NOTES[recipe.output] === undefined) RECIPE_NOTES[recipe.output] = recipe.note;
}

// 제작 레시피가 없는(채집·드랍) 아이템 설명.
const EXTRA_NOTES: Partial<Record<ItemId, string>> = {
  wood: "기본 재료. 막대기·도구·건축에 두루 쓰입니다.",
  stone: "돌. 도구·건축의 기초 재료입니다.",
  coal: "석탄. 분쇄해 가루로 만들 수 있습니다.",
  copper: "구리. 제련·분쇄해 중급 장비에 씁니다.",
  iron: "철. 제련해 다양한 장비를 만듭니다.",
  gold: "금. 제련·분쇄해 고급 장비에 씁니다.",
  diamond: "다이아몬드. 최상급 장비·가루 재료입니다.",
  obsidian: "흑요석. 특수 제련대에서 날카로운 흑요석이 됩니다.",
  dirt: "흙. 지형을 메우는 데 쓰입니다.",
  leather: "가죽. 가죽 갑옷 재료입니다.",
  meat: "사냥으로 얻습니다. 먹으면 배고픔을 회복합니다.",
  dragon_scale: "용 보스 전리품. 최상급 제작 재료입니다.",
  dragon_tail: "용 보스 전리품. 희귀 제작 재료입니다.",
  dragon_horn: "용 보스 전리품. 매우 희귀한 재료입니다.",
  job_change_tome: "전직의서. 몬스터 요새 보스가 떨어뜨리는 에픽 재료입니다. 제작대에서 '전직의 인장'을 만드는 데 씁니다.",
  job_seal: "전직의 인장. 전직의서로 제작합니다. 레벨 30 이상에서 들고 사용하면 1차 전직하여 새 스킬(F)과 스탯 상승, 새 외형을 얻습니다.",
  tutorial_book: "조작·목표를 안내하는 책입니다. 들고 사용하면 열립니다.",
  bag: "가방. 인벤토리 칸을 늘려 줍니다.",
  water_bucket: "물을 담은 양동이. 용암지대에 부으면 흑요석이 됩니다.",
  lava_bucket: "용암을 담은 양동이. 고급 제작에 쓰입니다.",
};

function statLines(item: ItemId): string[] {
  const lines: string[] = [];

  if (isNecklace(item)) {
    const effect = NECKLACE_EFFECT[item];
    if (effect) lines.push(effect);
    return lines;
  }

  if (RANGED_WEAPONS.has(item)) {
    const projectile = RANGED_PROJECTILE[item] === "magic" ? "마법" : "화살";
    lines.push(`원거리 공격력 +${WEAPON_DAMAGE[item] ?? 0} (${projectile})`);
    if (GUN_WEAPONS.has(item)) lines.push("연사 무기");
    return lines;
  }

  const toolPower = AXE_POWER[item] ?? PICKAXE_POWER[item] ?? SHOVEL_POWER[item];
  if (toolPower !== undefined) {
    const kind = AXE_POWER[item] !== undefined ? "벌목" : PICKAXE_POWER[item] !== undefined ? "채굴" : "채집";
    lines.push(`${kind}력 ${toolPower}`);
    lines.push(`내구도 ${toolMaxDurability(item)}`);
    if (WEAPON_DAMAGE[item] !== undefined) lines.push(`공격력 +${WEAPON_DAMAGE[item]}`);
    return lines;
  }

  if (SHIELD_DEFENSE[item] !== undefined) {
    lines.push(`방어력 +${SHIELD_DEFENSE[item]}`);
    if (SHIELD_DURABILITY[item] !== undefined) lines.push(`내구도 ${SHIELD_DURABILITY[item]}`);
    if (WEAPON_DAMAGE[item] !== undefined) lines.push(`방패 강타 +${WEAPON_DAMAGE[item]}`);
    return lines;
  }

  if (ARMOR_VALUE[item] !== undefined) {
    lines.push(`방어력 +${ARMOR_VALUE[item]}`);
    return lines;
  }

  if (WEAPON_DAMAGE[item] !== undefined) lines.push(`공격력 +${WEAPON_DAMAGE[item]}`);
  if (HEAL_ITEMS[item] !== undefined) lines.push(`체력 회복 +${HEAL_ITEMS[item]}`);
  return lines;
}

export function describeItem(item: ItemId): ItemInfo {
  const tier = itemTier(item);
  return {
    name: ITEM_NAMES[item] ?? item,
    tier,
    tierLabel: TIER_LABELS[tier],
    stats: statLines(item),
    note: RECIPE_NOTES[item] ?? EXTRA_NOTES[item] ?? null,
  };
}
