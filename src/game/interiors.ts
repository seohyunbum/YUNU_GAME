import * as THREE from "three";
import { applyStylizedMeshDefaults } from "../visuals";
import { ARENA_CENTER_Z, ARENA_HALF, CAVE_CENTER_Z, CAVE_END_Z, CAVE_LENGTH, CAVE_START_Z, CAVE_WIDTH, HOUSE_CENTER_Z } from "./constants";
import { spawnGrinder, spawnSmelter, spawnWorkbench } from "./placeableSpawns";
import type { SpawnContext } from "./spawnContext";
import type { BedTier } from "./constants";
import type { HouseKind, ItemId, WorldObject } from "./types";

// 동굴 셸 공유 지오메트리·재료 — 진입마다 새로 만들지 않는다.
// 셸(loose Group)은 clearCaveObjects 에서 scene.remove 로만 제거되어 dispose 되지 않으므로(레퍼런스만 끊김)
// 모듈 레벨에서 1회 생성해 재사용하면 진입당 ~250건의 geometry/material 할당과 누수가 사라진다.
// DodecahedronGeometry(r)·CircleGeometry(r,n)·ConeGeometry(rad,h,n) 는 단위 도형의 r/h 배 스케일과 수학적으로
// 동일하므로 단위 도형 + per-mesh scale 로 대체한다(시각 결과 동일). tuneMaterial 은 stylizedTuned 가드로 멱등이라 공유 재료에 안전.
const CAVE_FLOOR_GEOMETRY = new THREE.PlaneGeometry(CAVE_WIDTH, CAVE_LENGTH, 2, 18);
const CAVE_CEILING_GEOMETRY = new THREE.BoxGeometry(CAVE_WIDTH + 2.5, 0.75, CAVE_LENGTH);
const CAVE_UNIT_ROCK_GEOMETRY = new THREE.DodecahedronGeometry(1);
const CAVE_UNIT_DIRT_GEOMETRY = new THREE.CircleGeometry(1, 14);
const CAVE_TORCH_BRACKET_GEOMETRY = new THREE.CylinderGeometry(0.06, 0.08, 0.74, 7);
const CAVE_TORCH_FLAME_GEOMETRY = new THREE.SphereGeometry(0.16, 12, 8);
const CAVE_UNIT_CRYSTAL_GEOMETRY = new THREE.ConeGeometry(0.12, 1, 6);
const caveFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x393a38, roughness: 1 });
const caveCeilingMaterial = new THREE.MeshStandardMaterial({ color: 0x454a4f, roughness: 1 });
const caveDirtMaterial = new THREE.MeshStandardMaterial({ color: 0x6b523d, roughness: 1 });
const caveRockMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x5a636a, roughness: 1 }),
  new THREE.MeshStandardMaterial({ color: 0x464d54, roughness: 1 }),
];
const caveOverheadMaterial = new THREE.MeshStandardMaterial({ color: 0x4d535a, roughness: 1 });
const caveTorchWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.84 });
const caveTorchFlameMaterial = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xea8a22, emissiveIntensity: 1.1, roughness: 0.38 });
const caveCrystalMaterial = new THREE.MeshStandardMaterial({ color: 0xa7e8ff, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.5 });

// 몬스터 요새 전용 공유 props — 진입마다 재생성하지 않도록 모듈 레벨 1회 생성(셸과 동일 정책).
const FORTRESS_BANNER_GEOMETRY = new THREE.PlaneGeometry(1.1, 2.0);
const FORTRESS_BANNER_POLE_GEOMETRY = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
const FORTRESS_BRAZIER_BOWL_GEOMETRY = new THREE.CylinderGeometry(0.34, 0.2, 0.34, 10);
const FORTRESS_BRAZIER_LEG_GEOMETRY = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6);
const FORTRESS_FLAME_GEOMETRY = new THREE.SphereGeometry(0.22, 12, 8);
const FORTRESS_SKULL_GEOMETRY = new THREE.IcosahedronGeometry(0.18, 0);
const FORTRESS_BONE_GEOMETRY = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
const FORTRESS_SPIKE_GEOMETRY = new THREE.ConeGeometry(0.12, 1.1, 6);
const FORTRESS_BAR_GEOMETRY = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6);
const FORTRESS_ALTAR_BASE_GEOMETRY = new THREE.CylinderGeometry(2.4, 2.8, 0.5, 18);
const FORTRESS_ALTAR_RING_GEOMETRY = new THREE.TorusGeometry(2.1, 0.12, 10, 36);
const fortressBannerMaterial = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0x450a0a, emissiveIntensity: 0.35, roughness: 0.85, side: THREE.DoubleSide });
const fortressIronMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.45, roughness: 0.55 });
const fortressFlameMaterial = new THREE.MeshStandardMaterial({ color: 0xff7a33, emissive: 0xef4444, emissiveIntensity: 1.3, roughness: 0.34 });
const fortressBoneMaterial = new THREE.MeshStandardMaterial({ color: 0xe7e5d8, roughness: 0.8 });
const fortressAltarMaterial = new THREE.MeshStandardMaterial({ color: 0x3b0d12, emissive: 0x7f1d1d, emissiveIntensity: 0.4, roughness: 0.7 });
const fortressRuneMaterial = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff1f1f, emissiveIntensity: 1.0, roughness: 0.4 });

// 몬스터 요새 디펜스 아레나 전용 공유 자산(모듈 1회 생성).
const ARENA_FLOOR_GEOMETRY = new THREE.PlaneGeometry(ARENA_HALF * 2 + 2, ARENA_HALF * 2 + 2);
const ARENA_WALL_SEG_GEOMETRY = new THREE.BoxGeometry(ARENA_HALF - 4, 4.4, 1.2); // 한 변에 2 세그먼트(가운데 통로 개구부)
const ARENA_PLATFORM_GEOMETRY = new THREE.CylinderGeometry(3.4, 3.8, 0.45, 24);
const arenaFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2024, roughness: 1 });

// main 의 dispose-skip 등록용 — 동굴 셸은 모듈 공유 자산이라 채굴/퇴장 시 dispose 되면 다음 진입이 깨진다.
// (현재 clearCaveObjects 는 scene.remove 만 하지만, 등록해 두면 실수로 dispose 경로를 타도 공유본이 보존된다.)
export function caveSharedGeometries(): THREE.BufferGeometry[] {
  return [CAVE_FLOOR_GEOMETRY, CAVE_CEILING_GEOMETRY, CAVE_UNIT_ROCK_GEOMETRY, CAVE_UNIT_DIRT_GEOMETRY, CAVE_TORCH_BRACKET_GEOMETRY, CAVE_TORCH_FLAME_GEOMETRY, CAVE_UNIT_CRYSTAL_GEOMETRY, FORTRESS_BANNER_GEOMETRY, FORTRESS_BANNER_POLE_GEOMETRY, FORTRESS_BRAZIER_BOWL_GEOMETRY, FORTRESS_BRAZIER_LEG_GEOMETRY, FORTRESS_FLAME_GEOMETRY, FORTRESS_SKULL_GEOMETRY, FORTRESS_BONE_GEOMETRY, FORTRESS_SPIKE_GEOMETRY, FORTRESS_BAR_GEOMETRY, FORTRESS_ALTAR_BASE_GEOMETRY, FORTRESS_ALTAR_RING_GEOMETRY, ARENA_FLOOR_GEOMETRY, ARENA_WALL_SEG_GEOMETRY, ARENA_PLATFORM_GEOMETRY];
}
export function caveSharedMaterials(): THREE.MeshStandardMaterial[] {
  return [caveFloorMaterial, caveCeilingMaterial, caveDirtMaterial, ...caveRockMaterials, caveOverheadMaterial, caveTorchWoodMaterial, caveTorchFlameMaterial, caveCrystalMaterial, fortressBannerMaterial, fortressIronMaterial, fortressFlameMaterial, fortressBoneMaterial, fortressAltarMaterial, fortressRuneMaterial, arenaFloorMaterial];
}

// 동굴/집 인테리어 빌더 — main.ts 에서 추출한 순수 장면 구성 로직.
// 월드 상태 접근(상자/광물/NPC 스폰, 오브젝트 추적)은 context 콜백으로 받는다.
export interface InteriorContext extends SpawnContext {
  scene: THREE.Scene;
  spawnChest(position: THREE.Vector3, mineRich: boolean): WorldObject;
  spawnOre(ore: ItemId, position: THREE.Vector3): WorldObject;
  spawnMiner(position: THREE.Vector3): WorldObject;
  spawnBlacksmithNpc(position: THREE.Vector3): WorldObject;
  randomCavePoint(): THREE.Vector3;
  rollMineMineral(): ItemId;
  spawnFortressMonster(position: THREE.Vector3, boss: boolean): WorldObject | null;
  trackCaveObjects(...ids: string[]): void;
  trackHouseObjects(...ids: string[]): void;
  showMessage(text: string): void;
}

function createExitPortal(position: THREE.Vector3) {
  const group = new THREE.Group();
  const portal = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 3.2, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x243a52, roughness: 0.6 }),
  );
  portal.position.y = 1.6;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 2.4, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x8fd7ff, emissive: 0x3e91c2, emissiveIntensity: 0.9 }),
  );
  glow.position.y = 1.55;
  group.add(portal, glow);
  group.position.copy(position);
  return group;
}

function createHouseExit(position: THREE.Vector3) {
  const group = new THREE.Group();
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.7, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.85 }),
  );
  door.position.y = 1.35;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 2.0, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0x92400e, emissiveIntensity: 0.65, roughness: 0.5 }),
  );
  glow.position.y = 1.25;
  group.add(door, glow);
  group.position.copy(position);
  return group;
}

// 동굴 공동(cavern) 셸 — 일반 동굴과 몬스터 요새가 공유하는 기반 구조(바닥·천장·벽 바위·횃불·크리스탈·조명).
// fortress=true 면 푸른 크리스탈을 빼고 조명을 붉게 해 "요새" 분위기로 바꾼다.
function buildCaveShell(fortress = false) {
  const shell = new THREE.Group();
  const floor = new THREE.Mesh(CAVE_FLOOR_GEOMETRY, caveFloorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, CAVE_CENTER_Z);
  shell.add(floor);

  for (let i = 0; i < 22; i += 1) {
    const z = CAVE_START_Z - 8 - (i / 21) * (CAVE_LENGTH - 20);
    const radius = THREE.MathUtils.randFloat(1.4, 2.8);
    const dirt = new THREE.Mesh(CAVE_UNIT_DIRT_GEOMETRY, caveDirtMaterial);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 5), 0.01, z + THREE.MathUtils.randFloatSpread(4));
    dirt.scale.set(radius, radius, THREE.MathUtils.randFloat(0.55, 1.25));
    shell.add(dirt);
  }

  const ceiling = new THREE.Mesh(CAVE_CEILING_GEOMETRY, caveCeilingMaterial);
  ceiling.position.set(0, 4.35, CAVE_CENTER_Z);
  shell.add(ceiling);

  for (let i = 0; i < 46; i += 1) {
    const z = CAVE_START_Z - (i / 45) * CAVE_LENGTH;
    for (const side of [-1, 1]) {
      const radius = THREE.MathUtils.randFloat(1.0, 2.7);
      const rock = new THREE.Mesh(CAVE_UNIT_ROCK_GEOMETRY, caveRockMaterials[THREE.MathUtils.randInt(0, 1)]);
      rock.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 0.4, CAVE_WIDTH / 2 + 1.4), THREE.MathUtils.randFloat(0.8, 3.1), z + THREE.MathUtils.randFloatSpread(2.7));
      rock.scale.set(radius, radius * THREE.MathUtils.randFloat(0.9, 1.85), radius);
      shell.add(rock);
    }
    if (i % 3 === 0) {
      const radius = THREE.MathUtils.randFloat(0.8, 1.8);
      const overhead = new THREE.Mesh(CAVE_UNIT_ROCK_GEOMETRY, caveOverheadMaterial);
      overhead.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 3), THREE.MathUtils.randFloat(3.2, 4.15), z);
      overhead.scale.set(radius, radius * THREE.MathUtils.randFloat(0.45, 0.9), radius);
      shell.add(overhead);
    }
  }

  for (let i = 0; i < 8; i += 1) {
    const z = CAVE_START_Z - 12 - (i / 7) * (CAVE_LENGTH - 28);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (CAVE_WIDTH / 2 - 0.9);
    const bracket = new THREE.Mesh(CAVE_TORCH_BRACKET_GEOMETRY, caveTorchWoodMaterial);
    bracket.position.set(x, 1.28, z);
    bracket.rotation.z = side * 0.72;
    const flame = new THREE.Mesh(CAVE_TORCH_FLAME_GEOMETRY, caveTorchFlameMaterial);
    flame.position.set(x - side * 0.28, 1.62, z);
    const light = new THREE.PointLight(0xffbd73, 1.5, 22, 1.55);
    light.position.set(x - side * 0.45, 1.78, z);
    shell.add(bracket, flame, light);
  }

  if (!fortress) {
    for (let i = 0; i < 9; i += 1) {
      const z = CAVE_START_Z - 18 - (i / 8) * (CAVE_LENGTH - 36);
      const side = i % 2 === 0 ? 1 : -1;
      const cluster = new THREE.Group();
      for (let shard = 0; shard < 3; shard += 1) {
        const height = THREE.MathUtils.randFloat(0.32, 0.78);
        const crystal = new THREE.Mesh(CAVE_UNIT_CRYSTAL_GEOMETRY, caveCrystalMaterial);
        crystal.scale.y = height;
        crystal.position.set(THREE.MathUtils.randFloatSpread(0.45), height / 2, THREE.MathUtils.randFloatSpread(0.38));
        crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.18);
        cluster.add(crystal);
      }
      cluster.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 2.7, CAVE_WIDTH / 2 - 1.3), 0.02, z + THREE.MathUtils.randFloatSpread(2.4));
      shell.add(cluster);
    }
  }

  const entranceLight = new THREE.PointLight(fortress ? 0xff7340 : 0xffe3b0, 1.65, 26, 1.4);
  entranceLight.position.set(0, 2.1, CAVE_START_Z - 5);
  const deepGuideLight = new THREE.PointLight(fortress ? 0xff2d2d : 0x9fd8ff, fortress ? 1.6 : 1.0, 30, 1.6);
  deepGuideLight.position.set(0, 1.9, CAVE_END_Z + 10);
  shell.add(entranceLight, deepGuideLight);
  applyStylizedMeshDefaults(shell);
  return shell;
}

function addCaveExits(context: InteriorContext) {
  const entranceId = context.addWorldObject("caveExit", "입구로 나가기", createExitPortal(new THREE.Vector3(0, 0, CAVE_START_Z + 2))).id;
  const deepExitId = context.addWorldObject("caveExit", "동굴 끝 출구", createExitPortal(new THREE.Vector3(0, 0, CAVE_END_Z + 4))).id;
  context.trackCaveObjects(entranceId, deepExitId);
}

export function createCaveInterior(context: InteriorContext) {
  const shell = buildCaveShell();
  context.scene.add(shell);
  context.trackCaveObjects(`loose-${shell.uuid}`);
  addCaveExits(context);

  for (let i = 0; i < 34; i += 1) context.spawnOre("stone", context.randomCavePoint());
  for (let i = 0; i < 20; i += 1) context.spawnOre("coal", context.randomCavePoint());
  for (let i = 0; i < 12; i += 1) context.spawnOre(Math.random() < 0.62 ? "copper" : "iron", context.randomCavePoint());
  for (let i = 0; i < 3; i += 1) if (Math.random() < 0.52) context.spawnOre("gold", context.randomCavePoint());
  for (let i = 0; i < 2; i += 1) if (Math.random() < 0.28) context.spawnOre("diamond", context.randomCavePoint());
  for (let i = 0; i < 2; i += 1) if (Math.random() < 0.2) context.spawnOre("obsidian", context.randomCavePoint());
  if (Math.random() < 0.1) context.spawnMiner(context.randomCavePoint());

  if (Math.random() < 0.001) {
    for (let i = 0; i < 8; i += 1) {
      const chest = context.spawnChest(context.randomCavePoint(), true);
      context.trackCaveObjects(chest.id);
    }
    for (let i = 0; i < 30; i += 1) context.spawnOre(context.rollMineMineral(), context.randomCavePoint());
    for (let i = 0; i < 3; i += 1) if (Math.random() < 0.35) context.spawnOre("obsidian", context.randomCavePoint());
    context.showMessage("엄청 드문 광산을 발견했습니다. 광산 상자가 많습니다!");
  }
}

// 몬스터 요새 장식 — 동굴 공동 셸 위에 군기·화로·해골 더미·창살·바닥 가시를 덧대 "요새" 분위기를 만든다.
function buildFortressDecor() {
  const decor = new THREE.Group();
  // 벽을 따라 늘어선 붉은 군기 + 화로(붉은 불꽃) — 동굴의 푸른 크리스탈 대신 전쟁 캠프 느낌.
  for (let i = 0; i < 8; i += 1) {
    const z = CAVE_START_Z - 14 - (i / 7) * (CAVE_LENGTH - 34);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (CAVE_WIDTH / 2 - 0.7);
    const pole = new THREE.Mesh(FORTRESS_BANNER_POLE_GEOMETRY, fortressIronMaterial);
    pole.position.set(x, 2.4, z);
    const banner = new THREE.Mesh(FORTRESS_BANNER_GEOMETRY, fortressBannerMaterial);
    banner.position.set(x - side * 0.15, 2.5, z);
    banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    decor.add(pole, banner);
  }
  for (let i = 0; i < 6; i += 1) {
    const z = CAVE_START_Z - 18 - (i / 5) * (CAVE_LENGTH - 40);
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (CAVE_WIDTH / 2 - 1.5);
    const leg = new THREE.Mesh(FORTRESS_BRAZIER_LEG_GEOMETRY, fortressIronMaterial);
    leg.position.set(x, 0.5, z);
    const bowl = new THREE.Mesh(FORTRESS_BRAZIER_BOWL_GEOMETRY, fortressIronMaterial);
    bowl.position.set(x, 1.05, z);
    const flame = new THREE.Mesh(FORTRESS_FLAME_GEOMETRY, fortressFlameMaterial);
    flame.position.set(x, 1.32, z);
    const light = new THREE.PointLight(0xff5a33, 1.8, 16, 1.5);
    light.position.set(x, 1.5, z);
    decor.add(leg, bowl, flame, light);
  }
  // 바닥 곳곳의 해골·뼈 더미 + 벽가 가시 — 으스스한 요새 흔적.
  for (let i = 0; i < 10; i += 1) {
    const z = CAVE_START_Z - 16 - (i / 9) * (CAVE_LENGTH - 36);
    const x = THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 4);
    const skull = new THREE.Mesh(FORTRESS_SKULL_GEOMETRY, fortressBoneMaterial);
    skull.position.set(x, 0.18, z);
    skull.rotation.set(THREE.MathUtils.randFloatSpread(0.6), Math.random() * Math.PI, 0);
    decor.add(skull);
    for (let b = 0; b < 2; b += 1) {
      const bone = new THREE.Mesh(FORTRESS_BONE_GEOMETRY, fortressBoneMaterial);
      bone.position.set(x + THREE.MathUtils.randFloatSpread(0.6), 0.08, z + THREE.MathUtils.randFloatSpread(0.6));
      bone.rotation.z = Math.PI / 2 + THREE.MathUtils.randFloatSpread(0.8);
      bone.rotation.y = Math.random() * Math.PI;
      decor.add(bone);
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const z = CAVE_START_Z - 10 - (i / 11) * (CAVE_LENGTH - 24);
    const side = i % 2 === 0 ? -1 : 1;
    const spike = new THREE.Mesh(FORTRESS_SPIKE_GEOMETRY, fortressIronMaterial);
    spike.position.set(side * (CAVE_WIDTH / 2 - 1.1), 0.55, z);
    spike.rotation.z = side * 0.12;
    decor.add(spike);
  }
  // 동굴 끝 보스 제단 — 붉은 룬 링이 깔린 단상 + 양옆 창살 기둥.
  const altarZ = CAVE_END_Z + 9;
  const base = new THREE.Mesh(FORTRESS_ALTAR_BASE_GEOMETRY, fortressAltarMaterial);
  base.position.set(0, 0.25, altarZ);
  const ring = new THREE.Mesh(FORTRESS_ALTAR_RING_GEOMETRY, fortressRuneMaterial);
  ring.position.set(0, 0.54, altarZ);
  ring.rotation.x = Math.PI / 2;
  const altarLight = new THREE.PointLight(0xff2d2d, 2.2, 20, 1.6);
  altarLight.position.set(0, 2.0, altarZ);
  decor.add(base, ring, altarLight);
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(FORTRESS_BAR_GEOMETRY, fortressIronMaterial);
    bar.position.set(side * 2.4, 1.2, altarZ);
    decor.add(bar);
  }
  applyStylizedMeshDefaults(decor);
  return decor;
}

export function createMonsterFortressInterior(context: InteriorContext) {
  const shell = buildCaveShell(true);
  shell.add(buildFortressDecor());
  context.scene.add(shell);
  context.trackCaveObjects(`loose-${shell.uuid}`);
  addCaveExits(context);

  // 맵 레벨대의 몬스터들이 통로 전체에 고르게 분포(입구 몰림 방지). 끝 제단에는 보스 1마리.
  // 입구(CAVE_START_Z)에서 30 들어간 지점부터 제단 직전까지 균등 배치 → 진행하며 계속 만난다.
  const monsterCount = 13;
  for (let i = 0; i < monsterCount; i += 1) {
    const t = (i + 0.5) / monsterCount;
    const z = CAVE_START_Z - 30 - t * (CAVE_LENGTH - 55); // ≈ -810 → -945
    const x = THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 4);
    const monster = context.spawnFortressMonster(new THREE.Vector3(x, 0, z), false);
    if (monster) context.trackCaveObjects(monster.id);
  }
  const boss = context.spawnFortressMonster(new THREE.Vector3(0, 0, CAVE_END_Z + 11), true);
  if (boss) context.trackCaveObjects(boss.id);
}

// 몬스터 요새 디펜스 아레나(신규) — 정사각 셸 + 중앙 단상 + 4 통로 개구부 + 붉은 요새 분위기.
// 몬스터는 웨이브로 스폰(여기서 스폰하지 않음). 셸/조명만 깐다. 나가기(포기) 출구 1개.
export function createSiegeArenaInterior(context: InteriorContext) {
  const cz = ARENA_CENTER_Z;
  const half = ARENA_HALF;
  const group = new THREE.Group();

  const floor = new THREE.Mesh(ARENA_FLOOR_GEOMETRY, arenaFloorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, cz);
  group.add(floor);

  // 4 변 성벽 — 한 변당 2 세그먼트, 가운데는 통로 개구부.
  const segOffset = half / 2 + 1;
  for (const sign of [-1, 1]) {
    const north = new THREE.Mesh(ARENA_WALL_SEG_GEOMETRY, fortressIronMaterial);
    north.position.set(sign * segOffset, 2.2, cz - half);
    const south = new THREE.Mesh(ARENA_WALL_SEG_GEOMETRY, fortressIronMaterial);
    south.position.set(sign * segOffset, 2.2, cz + half);
    const west = new THREE.Mesh(ARENA_WALL_SEG_GEOMETRY, fortressIronMaterial);
    west.rotation.y = Math.PI / 2;
    west.position.set(-half, 2.2, cz + sign * segOffset);
    const east = new THREE.Mesh(ARENA_WALL_SEG_GEOMETRY, fortressIronMaterial);
    east.rotation.y = Math.PI / 2;
    east.position.set(half, 2.2, cz + sign * segOffset);
    group.add(north, south, west, east);
  }

  // 중앙 단상 + 룬 링.
  const platform = new THREE.Mesh(ARENA_PLATFORM_GEOMETRY, fortressAltarMaterial);
  platform.position.set(0, 0.22, cz);
  const ring = new THREE.Mesh(FORTRESS_ALTAR_RING_GEOMETRY, fortressRuneMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.5, cz);
  group.add(platform, ring);

  // 코너 화로(불꽃 + 조명) + 깃발.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bx = sx * (half - 2);
      const bz = cz + sz * (half - 2);
      const bowl = new THREE.Mesh(FORTRESS_BRAZIER_BOWL_GEOMETRY, fortressIronMaterial);
      bowl.position.set(bx, 1.0, bz);
      const flame = new THREE.Mesh(FORTRESS_FLAME_GEOMETRY, fortressFlameMaterial);
      flame.position.set(bx, 1.34, bz);
      const light = new THREE.PointLight(0xff5a33, 1.35, 22, 1.5);
      light.position.set(bx, 2.0, bz);
      group.add(bowl, flame, light);
    }
    const pole = new THREE.Mesh(FORTRESS_BANNER_POLE_GEOMETRY, fortressIronMaterial);
    pole.position.set(sx * (half - 0.6), 1.2, cz);
    const banner = new THREE.Mesh(FORTRESS_BANNER_GEOMETRY, fortressBannerMaterial);
    banner.position.set(sx * (half - 0.6), 2.1, cz);
    group.add(pole, banner);
  }

  // 중앙 강한 붉은 조명 + 앰비언트(요새 한가운데 분위기).
  const centerLight = new THREE.PointLight(0xff2d2d, 2.3, 44, 1.5);
  centerLight.position.set(0, 7, cz);
  group.add(centerLight, new THREE.AmbientLight(0xff5544, 0.32));

  context.scene.add(group);
  context.trackCaveObjects(`loose-${group.uuid}`);

  // 나가기(포기) 출구 — 남쪽 통로 옆. 진행 중 사용 시 보상 보존하고 이탈.
  const exitId = context.addWorldObject("caveExit", "요새에서 나가기 (포기)", createExitPortal(new THREE.Vector3(half - 2.5, 0, cz + half - 2))).id;
  context.trackCaveObjects(exitId);
}

function createHomeStorageVisual(position: THREE.Vector3) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 1.5, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.78 }),
  );
  body.position.y = 0.75;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.12, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xd9b13b, metalness: 0.35, roughness: 0.5 }),
  );
  trim.position.y = 1.52;
  group.add(body, trim);
  for (const y of [0.45, 1.05]) {
    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.42, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.82 }),
    );
    drawer.position.set(0, y, 0.36);
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfcd34d, emissive: 0x92400e, emissiveIntensity: 0.4, roughness: 0.4 }),
    );
    knob.position.set(0, y, 0.42);
    group.add(drawer, knob);
  }
  group.position.copy(position);
  return group;
}

function createHomeSupplyVisual(position: THREE.Vector3) {
  const group = new THREE.Group();
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.85, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x3d6b4f, roughness: 0.8 }),
  );
  crate.position.y = 0.43;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.16, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2f5440, roughness: 0.78 }),
  );
  lid.position.y = 0.92;
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.87, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.35, roughness: 0.5 }),
  );
  ribbon.position.y = 0.43;
  const bow = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfcd34d, emissive: 0xb45309, emissiveIntensity: 0.5, roughness: 0.45 }),
  );
  bow.position.y = 1.05;
  group.add(crate, lid, ribbon, bow);
  group.position.copy(position);
  return group;
}

export function createHouseInterior(context: InteriorContext, chestRich: boolean, houseKind: HouseKind = "home", playerOwned = false, bedTier: BedTier = "wood") {
  const room = new THREE.Group();
  const twoStory = houseKind === "twoStory";
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.16, 11.5),
    new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.88 }),
  );
  floor.position.set(0, -0.08, HOUSE_CENTER_Z);
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.18, 11.5),
    new THREE.MeshStandardMaterial({ color: 0x4b3322, roughness: 0.9 }),
  );
  ceiling.position.set(0, twoStory ? 6.25 : 3.65, HOUSE_CENTER_Z);
  room.add(floor, ceiling);

  for (const wall of [
    { x: 0, z: -5.75, w: 11.5, d: 0.2 },
    { x: 0, z: 5.75, w: 11.5, d: 0.2 },
    { x: -5.75, z: 0, w: 0.2, d: 11.5 },
    { x: 5.75, z: 0, w: 0.2, d: 11.5 },
  ]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wall.w, twoStory ? 6.0 : 3.5, wall.d),
      new THREE.MeshStandardMaterial({ color: 0x9b7655, roughness: 0.82 }),
    );
    mesh.position.set(wall.x, twoStory ? 3.0 : 1.75, HOUSE_CENTER_Z + wall.z);
    room.add(mesh);
  }

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.55, 1.25),
    new THREE.MeshStandardMaterial({ color: houseKind === "blacksmith" ? 0x5b3428 : 0x3d5a80, roughness: 0.75 }),
  );
  bed.position.set(playerOwned ? 0 : -3.15, 0.38, playerOwned ? 0 : HOUSE_CENTER_Z - 2.9);
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x5d3a22, roughness: 0.84 }),
  );
  table.position.set(2.9, 1.0, HOUSE_CENTER_Z - 2.0);
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 0.55, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xb45309, emissiveIntensity: 0.7, roughness: 0.42 }),
  );
  lamp.position.set(2.9, 1.42, HOUSE_CENTER_Z - 2.0);
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.65, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.8 }),
  );
  rug.position.set(0, 0.02, HOUSE_CENTER_Z + 0.4);
  rug.scale.z = 0.6;
  room.add(table, lamp, rug);
  if (playerOwned) {
    // 내 집 침대는 상호작용 오브젝트 — 푹 쉬기(완전 회복)가 가능하고 회수는 안 된다.
    const bedGroup = new THREE.Group();
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.18, 0.92),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 }),
    );
    pillow.position.set(-0.8, 0.74, 0);
    bedGroup.add(bed, pillow);
    bedGroup.position.set(-3.15, 0, HOUSE_CENTER_Z - 2.9);
    const bedObject = context.addWorldObject("bed", "내 침대", bedGroup, { homeBed: true, bedTier, collidable: true, collisionRadius: 1.1, collisionHeight: 0.8 });
    context.trackHouseObjects(bedObject.id);
  } else {
    room.add(bed);
  }
  if (twoStory) {
    const upperFloor = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.18, 4.05),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.86 }),
    );
    upperFloor.position.set(0, 2.55, HOUSE_CENTER_Z - 3.55);
    const upperRug = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.05, 1.45),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.8 }),
    );
    upperRug.position.set(1.6, 2.66, HOUSE_CENTER_Z - 3.55);
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.22, 0.92),
      new THREE.MeshStandardMaterial({ color: 0x5d3a22, roughness: 0.84 }),
    );
    desk.position.set(3.2, 3.05, HOUSE_CENTER_Z - 4.4);
    const bedUpper = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.45, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x2f5f9f, roughness: 0.75 }),
    );
    bedUpper.position.set(-1.2, 2.88, HOUSE_CENTER_Z - 4.55);
    room.add(upperFloor, upperRug, desk, bedUpper);

    for (let i = 0; i < 9; i += 1) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.18, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.86 }),
      );
      const t = i / 8;
      step.position.set(-3.25, 0.18 + t * 2.45, HOUSE_CENTER_Z + 2.3 - t * 4.0);
      room.add(step);
    }
    for (const x of [-4.45, 4.45]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.72, 4.0),
        new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.84 }),
      );
      rail.position.set(x, 3.0, HOUSE_CENTER_Z - 3.55);
      room.add(rail);
    }
  }
  applyStylizedMeshDefaults(room);
  context.scene.add(room);
  context.trackHouseObjects(`loose-${room.uuid}`);

  const exitId = context.addWorldObject("houseExit", "문으로 나가기", createHouseExit(new THREE.Vector3(0, 0, HOUSE_CENTER_Z + 5.2))).id;
  context.trackHouseObjects(exitId);
  if (playerOwned) {
    // 내 집: 일회성 보물상자 대신 영구 창고 + 주기 보급 상자
    const storage = context.addWorldObject("homeStorage", "집 창고", createHomeStorageVisual(new THREE.Vector3(2.6, 0, HOUSE_CENTER_Z - 3.3)), { collidable: true, collisionRadius: 0.85, collisionHeight: 1.6 });
    const supply = context.addWorldObject("homeSupply", "보급 상자", createHomeSupplyVisual(new THREE.Vector3(4.35, 0, HOUSE_CENTER_Z - 0.6)), { collidable: true, collisionRadius: 0.75, collisionHeight: 1.1 });
    context.trackHouseObjects(storage.id, supply.id);
  } else {
    const chest = context.spawnChest(new THREE.Vector3(2.4, 0, HOUSE_CENTER_Z - 3.15), houseKind === "blacksmith" || chestRich);
    context.trackHouseObjects(chest.id);
  }
  if (houseKind === "blacksmith") {
    const workbench = spawnWorkbench(context, new THREE.Vector3(-3.15, 0, HOUSE_CENTER_Z + 1.9), true);
    const smelter = spawnSmelter(context, new THREE.Vector3(0, 0, HOUSE_CENTER_Z - 2.55), true);
    const grinder = spawnGrinder(context, new THREE.Vector3(3.15, 0, HOUSE_CENTER_Z + 1.7));
    const smith = context.spawnBlacksmithNpc(new THREE.Vector3(0, 0, HOUSE_CENTER_Z + 1.35));
    for (const station of [workbench, smelter, grinder]) {
      station.lockedStation = true;
      context.trackHouseObjects(station.id);
    }
    context.trackHouseObjects(smith.id);
  }
}
