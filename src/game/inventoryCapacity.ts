import type { ItemId, Recipe, Slot } from "./types";

type DurableItemPredicate = (item: ItemId) => boolean;

export function isStorageSlotSource(source: string | null | undefined): source is "hotbar" | "bag" {
  return source === "hotbar" || source === "bag";
}

function cloneSlots(slots: readonly Slot[]) {
  return slots.map((slot) => ({ item: slot.item, count: slot.count }));
}

function consumeFromSlots(slots: { item: ItemId | null; count: number }[], ingredients: Record<ItemId, number>) {
  for (const [item, count] of Object.entries(ingredients) as [ItemId, number][]) {
    let remaining = count;
    for (const slot of slots) {
      if (slot.item !== item) continue;
      const taken = Math.min(slot.count, remaining);
      slot.count -= taken;
      remaining -= taken;
      if (slot.count <= 0) {
        slot.item = null;
        slot.count = 0;
      }
      if (remaining <= 0) break;
    }
    if (remaining > 0) return false;
  }
  return true;
}

export function canAddItemToSlots(slots: readonly Slot[], item: ItemId, count: number, isDurableItem: DurableItemPredicate) {
  if (item === "bag" || count <= 0) return true;
  if (isDurableItem(item)) return slots.filter((slot) => !slot.item).length >= count;
  return slots.some((slot) => slot.item === item || !slot.item);
}

export function canReceiveRecipeOutput(
  slots: readonly Slot[],
  recipe: Recipe,
  isDurableItem: DurableItemPredicate,
  ingredientsToConsume?: Record<ItemId, number>,
) {
  const simulatedSlots = cloneSlots(slots);
  if (ingredientsToConsume && !consumeFromSlots(simulatedSlots, ingredientsToConsume)) return false;
  return canAddItemToSlots(simulatedSlots, recipe.output, recipe.count, isDurableItem);
}
