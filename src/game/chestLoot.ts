import * as THREE from "three";
import type { ItemId } from "./types";

// 보물 상자 전리품 롤 — main.openChest 에서 추출. 파티에선 호스트가 1회 롤해 개봉자에게 전달(이중 지급 방지).
export interface ChestLootEntry {
  item: ItemId;
  count: number;
}

export function rollChestLoot(): ChestLootEntry[] {
  const loot: ChestLootEntry[] = [];
  if (Math.random() < 0.5) loot.push({ item: "hammer", count: 1 });
  if (Math.random() < 0.02) loot.push({ item: "smelter", count: 1 });
  if (Math.random() < 0.45) loot.push({ item: "wood", count: THREE.MathUtils.randInt(1, 3) });
  if (Math.random() < 0.35) loot.push({ item: "stick", count: THREE.MathUtils.randInt(1, 2) });
  if (Math.random() < 0.38) loot.push({ item: "stone", count: THREE.MathUtils.randInt(1, 3) });
  if (Math.random() < 0.15) loot.push({ item: "leather", count: 1 });
  return loot;
}
