import * as THREE from "three";
import type { ItemId } from "./types";

// 광물 비주얼 공유 geometry/material — 동굴 진입마다 spawnOre 가 ~70개 광물을 만들 때 매번 새 도형/재료를
// 할당하던 것을 "종류별 1회 생성 + 재사용"으로 대체한다(시각 결과 동일).
// 도형/재료는 채굴 시 dispose 되면 안 되므로(공유본이 깨짐), main 의 sharedGeometries/sharedMaterials 에
// 등록해야 한다 — oreSharedGeometries()/oreSharedMaterials() 로 노출하고, 등록이 누락되지 않도록
// 모든 표준 광물 재료를 import 시점에 미리 만들어 둔다(아래 for 루프).

const colorByOre: Partial<Record<ItemId, number>> = {
  stone: 0x8a8f93,
  coal: 0x202225,
  copper: 0xb66f39,
  iron: 0xb8aca0,
  gold: 0xe3ba32,
  diamond: 0x66d9e8,
  obsidian: 0x24152f,
};

const ORE_TYPES: ItemId[] = ["stone", "coal", "copper", "iron", "gold", "diamond", "obsidian"];

// 단위 도형 — spawnOre 가 per-mesh scale 로 광물별 형태(벽/바닥/지상)를 만든다.
const baseGeometry = new THREE.DodecahedronGeometry(0.75);
const shardGeometries = [0, 1, 2, 3].map((i) => new THREE.ConeGeometry(0.08 + i * 0.012, 0.24 + i * 0.035, 5));

interface OreMaterials {
  base: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}
const materialCache = new Map<string, OreMaterials>();

function buildOreMaterials(ore: ItemId): OreMaterials {
  const color = colorByOre[ore] ?? 0x888888;
  return {
    base: new THREE.MeshStandardMaterial({
      color,
      emissive: ore === "diamond" ? 0x144d55 : 0x000000,
      emissiveIntensity: ore === "diamond" ? 0.35 : 0,
      roughness: 0.9,
    }),
    accent: new THREE.MeshStandardMaterial({
      color,
      emissive: ore === "diamond" ? 0x1f9fb0 : ore === "gold" ? 0x7c4a03 : ore === "obsidian" ? 0x35144f : 0x000000,
      emissiveIntensity: ore === "diamond" ? 0.55 : ore === "gold" ? 0.16 : ore === "obsidian" ? 0.22 : 0,
      roughness: 0.48,
      metalness: ore === "gold" || ore === "iron" || ore === "copper" ? 0.24 : 0.04,
    }),
  };
}

// 표준 광물 + 미지 광물용 fallback("__default__", 손상된 세이브 대비)을 미리 생성·캐시한다.
for (const ore of ORE_TYPES) materialCache.set(ore, buildOreMaterials(ore));
materialCache.set("__default__", buildOreMaterials("__default__" as ItemId));

function oreMaterials(ore: ItemId): OreMaterials {
  return materialCache.get(ore) ?? materialCache.get("__default__")!;
}

// 광물 메쉬(본체 + accent 파편)를 공유 도형/재료로 만든다. 위치·스케일·월드 등록은 호출자(main spawnOre)가 한다.
export function buildOreMesh(ore: ItemId): THREE.Mesh {
  const mats = oreMaterials(ore);
  const mesh = new THREE.Mesh(baseGeometry, mats.base);
  for (let i = 0; i < (ore === "stone" ? 2 : 4); i += 1) {
    const shard = new THREE.Mesh(shardGeometries[i], mats.accent);
    shard.position.set(THREE.MathUtils.randFloatSpread(0.48), 0.14 + i * 0.02, THREE.MathUtils.randFloatSpread(0.42));
    shard.rotation.set(THREE.MathUtils.randFloatSpread(0.7), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloatSpread(0.5));
    mesh.add(shard);
  }
  return mesh;
}

// main 의 dispose-skip 등록용 — 광물 채굴 시 공유 도형/재료가 dispose 되지 않게 한다.
export function oreSharedGeometries(): THREE.BufferGeometry[] {
  return [baseGeometry, ...shardGeometries];
}
export function oreSharedMaterials(): THREE.MeshStandardMaterial[] {
  return [...materialCache.values()].flatMap((m) => [m.base, m.accent]);
}
