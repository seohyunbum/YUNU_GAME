import { itemSortCategory, itemTier, type ItemTier } from "./items";
import type { ItemId, Slot } from "./types";

// 가방 자동정렬 — 같은 아이템 스택 합치기 + 카테고리(무기/방어구/도구/제작설비/소비/재료)별 묶음 +
// 각 묶음 내 희귀등급 오름차순(일반→레전더리) → 이름 순. 내구도 있는 도구는 합치지 않고 개별 유지.
// 순수 함수(부수효과 없음) — 입력과 같은 길이의 새 슬롯 배열을 돌려준다. 핫바는 호출자가 제외한다.

const TIER_RANK: Record<ItemTier, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

function compare(a: Slot, b: Slot): number {
  const itemA = a.item as ItemId, itemB = b.item as ItemId;
  const ca = itemSortCategory(itemA), cb = itemSortCategory(itemB);
  if (ca !== cb) return ca - cb;
  const ta = TIER_RANK[itemTier(itemA)], tb = TIER_RANK[itemTier(itemB)];
  if (ta !== tb) return ta - tb;
  if (itemA !== itemB) return itemA < itemB ? -1 : 1;
  return (a.durabilityUsed ?? 0) - (b.durabilityUsed ?? 0);
}

export function sortInventory(slots: readonly Slot[]): Slot[] {
  const stackable = new Map<ItemId, number>(); // 내구도 없는 아이템: 합산
  const tools: Slot[] = []; // 내구도 있는 도구: 개별 유지
  for (const slot of slots) {
    if (!slot.item || slot.count <= 0) continue;
    if (slot.durabilityUsed === undefined) stackable.set(slot.item, (stackable.get(slot.item) ?? 0) + slot.count);
    else tools.push({ item: slot.item, count: slot.count, durabilityUsed: slot.durabilityUsed });
  }
  const entries: Slot[] = [...[...stackable].map(([item, count]) => ({ item, count } as Slot)), ...tools];
  entries.sort(compare);
  const out: Slot[] = Array.from({ length: slots.length }, () => ({ item: null, count: 0 }));
  entries.slice(0, slots.length).forEach((entry, index) => { out[index] = entry; });
  return out;
}
