import * as THREE from "three";
import type { WorldObject } from "./types";

// 마을 주민·수호자(가드)가 건물 안으로 들어가지 못하게 막는 공통 헬퍼.
// 건물은 단일 원기둥(collisionRadius) 충돌체라, NPC 위치를 그 원 밖으로 밀어낸다.
// (leaf 모듈 — main.ts 를 import 하지 않는다.)
const BUILDING_TYPES = new Set([
  "villageHouse",
  "foodStorage",
  "villageShop",
  "villageSellShop",
  "blacksmith",
]);

export function isBuildingObject(object: WorldObject): boolean {
  return BUILDING_TYPES.has(object.type) && object.collidable !== false && (object.collisionRadius ?? 0) > 0;
}

// position 을 근처 건물들의 충돌 원 밖으로 밀어낸다. position 을 in-place 로 수정한다.
// nearby 는 position 주변 후보 오브젝트(공간 인덱스 조회 결과)를 넘긴다.
export function keepOutOfBuildings(position: THREE.Vector3, nearby: Iterable<WorldObject>, selfRadius = 0.45): boolean {
  let pushed = false;
  for (let pass = 0; pass < 2; pass += 1) {
    let changed = false;
    for (const object of nearby) {
      if (!isBuildingObject(object)) continue;
      const combined = (object.collisionRadius ?? 1) + selfRadius;
      const dx = position.x - object.root.position.x;
      const dz = position.z - object.root.position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= combined * combined) continue;
      const distance = Math.sqrt(distanceSq);
      if (distance < 0.0001) {
        // 정확히 중심에 있으면 임의 방향(+x)으로 밀어낸다.
        position.x += combined;
      } else {
        const push = combined - distance;
        position.x += (dx / distance) * push;
        position.z += (dz / distance) * push;
      }
      changed = true;
      pushed = true;
    }
    if (!changed) break;
  }
  return pushed;
}
