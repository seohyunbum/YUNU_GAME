import { capLootByGrade } from "./chestLoot";
import type { ItemId, Slot } from "./types";

// 내 집 베이스캠프 — 플레이어가 지은 집(playerOwned)에만 주어지는 혜택 로직.
// 설계: docs/home-base.md

export const HOME_STORAGE_SLOTS = 24;

// 보급 상자: 플레이 시간 20분마다 1회. 저장은 남은 초(cooldown)로 — 게임 시계는 하루 단위로 순환하므로 절대 시각을 쓸 수 없다.
export const HOME_SUPPLY_COOLDOWN_SECONDS = 1200;

export function normalizeHomeStorage(saved?: readonly Slot[] | null): Slot[] {
  const slots: Slot[] = Array.from({ length: HOME_STORAGE_SLOTS }, () => ({ item: null, count: 0 }));
  (saved ?? []).slice(0, HOME_STORAGE_SLOTS).forEach((slot, index) => {
    if (slot?.item && slot.count > 0) slots[index] = { item: slot.item, count: slot.count, durabilityUsed: slot.durabilityUsed };
  });
  return slots;
}

// 슬롯 단위 이동(창고↔인벤토리 공용). 같은 아이템 스택에 합치고, 내구도 있는 도구는 섞이지 않게 빈 칸에만 넣는다.
export function transferSlot(from: Slot, to: Slot[]): boolean {
  if (!from.item || from.count <= 0) return false;
  if (from.durabilityUsed === undefined) {
    const stack = to.find((slot) => slot.item === from.item && slot.count > 0 && slot.durabilityUsed === undefined);
    if (stack) {
      stack.count += from.count;
      from.item = null;
      from.count = 0;
      return true;
    }
  }
  const empty = to.find((slot) => !slot.item || slot.count <= 0);
  if (!empty) return false;
  empty.item = from.item;
  empty.count = from.count;
  empty.durabilityUsed = from.durabilityUsed;
  from.item = null;
  from.count = 0;
  from.durabilityUsed = undefined;
  return true;
}

export function homeSupplyReadyLabel(cooldownSeconds: number): string {
  if (cooldownSeconds <= 0) return "보급 상자가 준비되었습니다";
  const minutes = Math.ceil(cooldownSeconds / 60);
  return `다음 보급까지 약 ${minutes}분`;
}

// 영웅(에픽)등급 이상 보너스 풀 — 직접 지은 집 보급상자에서 낮은 확률로 1개. 재료(흔함)>에픽 장비(중간)>레전더리(드묾) 가중.
// 진행 그라인드인 전직/4차(초월) 각서·용 장비 완성품은 직접 지급하지 않는다(용 재료를 줘 제작 유도).
const EPIC_PLUS_SUPPLY: { item: ItemId; count: number; weight: number }[] = [
  { item: "obsidian", count: 2, weight: 18 }, { item: "sharp_obsidian", count: 1, weight: 14 }, { item: "obsidian_powder", count: 2, weight: 14 }, { item: "dragon_tail", count: 1, weight: 10 }, // 에픽 재료
  { item: "obsidian_sword", count: 1, weight: 7 }, { item: "obsidian_dagger", count: 1, weight: 7 }, { item: "arcane_staff", count: 1, weight: 7 }, { item: "advanced_medkit", count: 2, weight: 6 }, { item: "dragon_horn", count: 1, weight: 5 }, // 에픽 장비·소비·최상급 재료
  { item: "sharp_obsidian_staff", count: 1, weight: 3 }, { item: "sharp_obsidian_gun", count: 1, weight: 3 }, { item: "sharp_obsidian_shield", count: 1, weight: 3 }, { item: "xp_bottle", count: 1, weight: 2 }, { item: "spirit_gacha_token", count: 1, weight: 2 }, // 레전더리
];
function pickEpicPlusSupply(random: () => number): { item: ItemId; count: number } {
  const total = EPIC_PLUS_SUPPLY.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of EPIC_PLUS_SUPPLY) if ((roll -= entry.weight) < 0) return { item: entry.item, count: entry.count };
  return { item: EPIC_PLUS_SUPPLY[0].item, count: EPIC_PLUS_SUPPLY[0].count };
}

// 레벨 구간별 보급품. 기본은 결정적(식량·약·금속), 확률 보너스는 행운 1줄 + 영웅(에픽)등급+ 1줄.
// 나무·돌은 베이스캠프(중후반)에선 쓸모가 적어 제외하고, 대신 영웅등급 이상 아이템·재료를 낮은 확률로 준다.
export function rollHomeSupply(level: number, random: () => number = Math.random): { item: ItemId; count: number }[] {
  const tier = level >= 85 ? 4 : level >= 55 ? 3 : level >= 30 ? 2 : level >= 15 ? 1 : 0;
  const loot: { item: ItemId; count: number }[] = [
    { item: "meat", count: 4 + tier * 2 },
    { item: "medkit", count: 2 + tier },
  ];
  if (tier >= 1) loot.push({ item: "copper", count: 8 + tier * 3 }, { item: "refined_iron", count: 2 + tier });
  if (tier >= 2) loot.push({ item: "iron", count: 8 + tier * 2 }, { item: "gold", count: 4 + tier });
  // 경험치병(레전더리) — tier≥2에서 35% 확률로만(종전 50%의 70%)
  if (tier >= 2 && random() < 0.35) loot.push({ item: "xp_bottle", count: 1 });
  // 정령 소환권(전설) — tier≥2에서 낮은 확률(6%)로만. cap 에서 레전더리라 거의 항상 보존.
  if (tier >= 2 && random() < 0.06) loot.push({ item: "spirit_gacha_token", count: 1 });
  if (tier >= 3) loot.push({ item: "diamond", count: 3 }, { item: "refined_diamond", count: 2 }, { item: "gold_powder", count: 3 }, { item: "diamond_powder", count: 2 });
  if (tier >= 4) loot.push({ item: "obsidian", count: 3 }, { item: "sharp_obsidian", count: 2 }, { item: "obsidian_powder", count: 2 }, { item: "dragon_scale", count: 2 });
  // 행운 보너스 1줄 — 등급별 상향(흑요석 베이스캠프는 용의 뿔까지)
  if (random() < 0.2) loot.push(tier >= 4 ? { item: "dragon_horn", count: 1 } : tier >= 3 ? { item: "refined_diamond", count: 2 } : tier >= 1 ? { item: "diamond", count: 1 } : { item: "gold", count: 2 });
  // 영웅(에픽)등급 이상 보너스 — 집(tier≥1)에서 낮은 확률(15%)로 1개. cap 에서 고등급이라 거의 항상 보존.
  if (tier >= 1 && random() < 0.15) loot.push(pickEpicPlusSupply(random));
  return capLootByGrade(loot, 6); // 모든 상자 공통 — 최대 6종류(등급·수량 우선)
}
