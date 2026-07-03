import * as THREE from "three";
import { createMirrorModel } from "../avatar";
import { createBucketVisual } from "./bucketVisuals";
import { createHeldItemModel } from "./heldItemVisuals";
import { ITEM_NAMES } from "./items";
import {
  createBedVisual,
  createBuildingBlockVisual,
  createGrinderVisual,
  createSmelterVisual,
  createWorkbenchVisual,
} from "./placeableVisuals";
import type { ItemId, ObjectType, WorldObject } from "./types";

export interface DroppedItemSpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
}

function isBucketItem(item: ItemId) {
  return item === "bucket" || item === "water_bucket" || item === "lava_bucket";
}

export function spawnDroppedItem(context: DroppedItemSpawnContext, item: ItemId, count: number, position: THREE.Vector3) {
  position.y = context.getGroundHeightAt(position.x, position.z) + 0.08;
  const group = new THREE.Group();
  const groundShadow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 0.012, 24),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  groundShadow.position.y = 0.012;
  group.add(groundShadow);
  if (item === "tutorial_book") {
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.06, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: 0.78 }),
    );
    pages.position.y = 0.08;
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.04, 0.78),
      new THREE.MeshStandardMaterial({ color: 0x4169a8, roughness: 0.68 }),
    );
    cover.position.y = 0.13;
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x27456f, roughness: 0.7 }),
    );
    spine.position.set(-0.32, 0.12, 0);
    const title = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.012, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x6b4d03, emissiveIntensity: 0.2, roughness: 0.5 }),
    );
    title.position.set(0.07, 0.155, 0.04);
    group.add(pages, cover, spine, title);
  } else if (item === "smelter" || item === "special_smelter") {
    group.add(createSmelterVisual(item === "special_smelter", 0.42));
  } else if (item === "grinder") {
    group.add(createGrinderVisual(0.4));
  } else if (item === "mirror") {
    group.add(createMirrorModel(0.48));
  } else if (item === "crafting_table" || item === "extended_workbench") {
    group.add(createWorkbenchVisual(item === "extended_workbench", 0.38));
  } else if (item === "bed") {
    group.add(createBedVisual(0.34));
  } else if (item === "building_block") {
    const block = createBuildingBlockVisual(0.42);
    block.position.y = 0.02;
    group.add(block);
  } else if (item === "bow" || item === "magic_wand") {
    const model = createHeldItemModel(item);
    model.position.y = 0.16;
    model.rotation.set(-Math.PI / 2, 0, 0.35);
    model.scale.setScalar(item === "bow" ? 0.92 : 0.82);
    group.add(model);
  } else if (/_(sword|dagger|axe|pickaxe|shovel|bow|necklace|armor)$/.test(item) || item.startsWith("dragon_") || item === "advanced_medkit" || item === "diamond" || item === "refined_diamond" || item === "obsidian" || item === "sharp_obsidian") {
    const model = createHeldItemModel(item); // 티어 무기/도구·에픽 장신구/방어구·용 전리품·보석은 실제 모델로 떨어진다 (등급이 한눈에 보이게)
    model.position.y = 0.22;
    model.rotation.set(-Math.PI / 2.3, 0.3, 0.3);
    model.scale.setScalar(0.95);
    group.add(model);
  } else if (isBucketItem(item)) {
    const bucket = createBucketVisual(item, 0.62);
    bucket.position.y = 0.04;
    group.add(bucket);
  } else {
    // 재료·기타 아이템도 손에 든 모델 그대로 바닥에 — 광물/주괴/가루/나무 등 컨셉이 드러나게
    const model = createHeldItemModel(item);
    model.position.y = 0.18;
    model.rotation.set(0, Math.random() * Math.PI * 2, 0);
    model.scale.setScalar(1.15);
    group.add(model);
  }
  const pickupTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 12, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  pickupTarget.position.y = 0.34;
  group.add(pickupTarget);
  group.rotation.y = Math.random() * Math.PI * 2;
  group.position.copy(position);
  return context.addWorldObject("droppedItem", ITEM_NAMES[item] ?? item, group, {
    droppedItem: item,
    droppedCount: count,
    collisionRadius: 0.8,
    collisionHeight: 0.8,
  });
}
