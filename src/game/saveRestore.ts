import * as THREE from "three";
import { savedVector as normalizeSavedVector } from "./saveMigration";
import { cloneSlots, toSavedVector } from "./saveManager";
import type { SavedVector, Slot } from "./types";

export function fromSavedVector(vector: SavedVector | null | undefined, fallback = new THREE.Vector3()) {
  const safe = normalizeSavedVector(vector, toSavedVector(fallback));
  return new THREE.Vector3(safe.x, safe.y, safe.z);
}

export function restoreSlots(targetSlots: Slot[], savedSlots: readonly Slot[]) {
  targetSlots.splice(0, targetSlots.length, ...cloneSlots(savedSlots));
}

export function copySavedSlot(targetSlot: Slot, savedSlot: Slot | null | undefined) {
  targetSlot.item = savedSlot?.item ?? null;
  targetSlot.count = savedSlot?.count ?? 0;
  targetSlot.durabilityUsed = savedSlot?.durabilityUsed;
}
