import * as THREE from "three";
import { BUILDING_BLOCK_SIZE } from "./constants";
import {
  createBedVisual,
  createBuildingBlockVisual,
  createGrinderVisual,
  createSmelterVisual,
  createWorkbenchVisual,
} from "./placeableVisuals";
import { spawnObject, type SpawnContext } from "./spawnContext";

export function spawnBed(context: SpawnContext, position: THREE.Vector3, rotationY = 0) {
  const group = createBedVisual();
  group.position.copy(position);
  group.rotation.y = rotationY;
  return spawnObject(context, {
    type: "bed",
    name: "침대",
    root: group,
    extra: {
      collidable: true,
      collisionRadius: 1.45,
      collisionHeight: 0.9,
    },
  });
}

export function spawnBuildingBlock(context: SpawnContext, position: THREE.Vector3) {
  const group = createBuildingBlockVisual();
  group.position.copy(position);
  return spawnObject(context, {
    type: "buildingBlock",
    name: "쌓기블록",
    root: group,
    extra: {
      collidable: true,
      collisionRadius: 0.62,
      collisionHeight: BUILDING_BLOCK_SIZE,
    },
  });
}

export function spawnWorkbench(context: SpawnContext, position: THREE.Vector3, extended: boolean) {
  const group = createWorkbenchVisual(extended);
  group.position.copy(position);
  return spawnObject(context, {
    type: extended ? "extendedWorkbench" : "workbench",
    name: extended ? "확장 제작대" : "제작대",
    root: group,
    extra: {
      collidable: true,
      collisionRadius: extended ? 1.35 : 1.15,
      collisionHeight: extended ? 1.38 : 1.05,
    },
  });
}

export function spawnSmelter(context: SpawnContext, position: THREE.Vector3, special: boolean) {
  const group = createSmelterVisual(special);
  group.position.copy(position);
  return spawnObject(context, {
    type: special ? "specialSmelter" : "smelter",
    name: special ? "특수 제련대" : "제련대",
    root: group,
    extra: {
      collidable: true,
      collisionRadius: 1.18,
      collisionHeight: 2.05,
    },
  });
}

export function spawnGrinder(context: SpawnContext, position: THREE.Vector3) {
  const group = createGrinderVisual();
  group.position.copy(position);
  return spawnObject(context, {
    type: "grinder",
    name: "분쇄기",
    root: group,
    extra: {
      collidable: true,
      collisionRadius: 1.15,
      collisionHeight: 1.4,
    },
  });
}
