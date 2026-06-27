import { capLootByGrade } from "./chestLoot";
import type { ItemId, Slot } from "./types";

// 내 집 베이스캠프 — 플레이어가 지은 집(playerOwned)에만 주어지는 혜택 로직.
// 설계: docs/home-base.md

export const HOME_STORAGE_SLOTS = 24;

// 보급 상자: 플레이 시간 30분마다 1회. 저장은 남은 초(cooldown)로 — 게임 시계는 하루 단위로 순환하므로 절대 시각을 쓸 수 없다.
export const HOME_SUPPLY_COOLDOWN_SECONDS = 1800;

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

// 레벨 구간별 보급품. 보급 상자는 "예측 가능한 베이스캠프 수입"이라 기본 구성은 결정적이고, 행운 보너스 1줄만 확률(20%)이다.
// 필드 보물상자(특히 흑요석=완성 장비 잭팟)와 균형: 집은 30분마다 궁극템 재료(흑요석·분말·용 재료)가 꾸준히 쌓이는 쪽으로 상향.
export function rollHomeSupply(level: number, random: () => number = Math.random): { item: ItemId; count: number }[] {
  const tier = level >= 85 ? 4 : level >= 55 ? 3 : level >= 30 ? 2 : level >= 15 ? 1 : 0;
  const loot: { item: ItemId; count: number }[] = [
    { item: "meat", count: 4 + tier * 2 },
    { item: "medkit", count: 2 + tier },
    { item: "wood", count: 40 + tier * 20 },
    { item: "stone", count: 24 + tier * 14 },
  ];
  if (tier >= 1) loot.push({ item: "copper", count: 8 + tier * 3 }, { item: "refined_iron", count: 2 + tier });
  if (tier >= 2) loot.push({ item: "iron", count: 8 + tier * 2 }, { item: "gold", count: 4 + tier });
  // 경험치병(레전더리) — tier≥2에서 35% 확률로만(종전 50%의 70%)
  if (tier >= 2 && random() < 0.35) loot.push({ item: "xp_bottle", count: 1 });
  if (tier >= 3) loot.push({ item: "diamond", count: 3 }, { item: "refined_diamond", count: 2 }, { item: "gold_powder", count: 3 }, { item: "diamond_powder", count: 2 });
  if (tier >= 4) loot.push({ item: "obsidian", count: 3 }, { item: "sharp_obsidian", count: 2 }, { item: "obsidian_powder", count: 2 }, { item: "dragon_scale", count: 2 });
  // 행운 보너스 1줄 — 등급별 상향(흑요석 베이스캠프는 용의 뿔까지)
  if (random() < 0.2) loot.push(tier >= 4 ? { item: "dragon_horn", count: 1 } : tier >= 3 ? { item: "refined_diamond", count: 2 } : tier >= 1 ? { item: "diamond", count: 1 } : { item: "gold", count: 2 });
  return capLootByGrade(loot, 6); // 모든 상자 공통 — 최대 6종류(등급·수량 우선)
}
