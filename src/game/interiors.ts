import * as THREE from "three";
import { applyStylizedMeshDefaults } from "../visuals";
import { CAVE_CENTER_Z, CAVE_END_Z, CAVE_LENGTH, CAVE_START_Z, CAVE_WIDTH, HOUSE_CENTER_Z } from "./constants";
import { spawnGrinder, spawnSmelter, spawnWorkbench } from "./placeableSpawns";
import type { SpawnContext } from "./spawnContext";
import type { HouseKind, ItemId, WorldObject } from "./types";

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

export function createCaveInterior(context: InteriorContext) {
  const shell = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CAVE_WIDTH, CAVE_LENGTH, 2, 18),
    new THREE.MeshStandardMaterial({ color: 0x393a38, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, CAVE_CENTER_Z);
  shell.add(floor);

  for (let i = 0; i < 22; i += 1) {
    const z = CAVE_START_Z - 8 - (i / 21) * (CAVE_LENGTH - 20);
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(THREE.MathUtils.randFloat(1.4, 2.8), 14),
      new THREE.MeshStandardMaterial({ color: 0x6b523d, roughness: 1 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 5), 0.01, z + THREE.MathUtils.randFloatSpread(4));
    dirt.scale.z = THREE.MathUtils.randFloat(0.55, 1.25);
    shell.add(dirt);
  }

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(CAVE_WIDTH + 2.5, 0.75, CAVE_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0x454a4f, roughness: 1 }),
  );
  ceiling.position.set(0, 4.35, CAVE_CENTER_Z);
  shell.add(ceiling);

  for (let i = 0; i < 46; i += 1) {
    const z = CAVE_START_Z - (i / 45) * CAVE_LENGTH;
    for (const side of [-1, 1]) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(1.0, 2.7)),
        new THREE.MeshStandardMaterial({ color: THREE.MathUtils.randInt(0, 1) === 0 ? 0x5a636a : 0x464d54, roughness: 1 }),
      );
      rock.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 0.4, CAVE_WIDTH / 2 + 1.4), THREE.MathUtils.randFloat(0.8, 3.1), z + THREE.MathUtils.randFloatSpread(2.7));
      rock.scale.y = THREE.MathUtils.randFloat(0.9, 1.85);
      shell.add(rock);
    }
    if (i % 3 === 0) {
      const overhead = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.8, 1.8)),
        new THREE.MeshStandardMaterial({ color: 0x4d535a, roughness: 1 }),
      );
      overhead.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 3), THREE.MathUtils.randFloat(3.2, 4.15), z);
      overhead.scale.y = THREE.MathUtils.randFloat(0.45, 0.9);
      shell.add(overhead);
    }
  }

  const torchWood = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.84 });
  const torchFlame = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xea8a22, emissiveIntensity: 1.1, roughness: 0.38 });
  const caveCrystal = new THREE.MeshStandardMaterial({ color: 0xa7e8ff, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.5 });
  for (let i = 0; i < 8; i += 1) {
    const z = CAVE_START_Z - 12 - (i / 7) * (CAVE_LENGTH - 28);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (CAVE_WIDTH / 2 - 0.9);
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.74, 7), torchWood);
    bracket.position.set(x, 1.28, z);
    bracket.rotation.z = side * 0.72;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), torchFlame);
    flame.position.set(x - side * 0.28, 1.62, z);
    const light = new THREE.PointLight(0xffbd73, 1.5, 22, 1.55);
    light.position.set(x - side * 0.45, 1.78, z);
    shell.add(bracket, flame, light);
  }

  for (let i = 0; i < 9; i += 1) {
    const z = CAVE_START_Z - 18 - (i / 8) * (CAVE_LENGTH - 36);
    const side = i % 2 === 0 ? 1 : -1;
    const cluster = new THREE.Group();
    for (let shard = 0; shard < 3; shard += 1) {
      const height = THREE.MathUtils.randFloat(0.32, 0.78);
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.12, height, 6), caveCrystal);
      crystal.position.set(THREE.MathUtils.randFloatSpread(0.45), height / 2, THREE.MathUtils.randFloatSpread(0.38));
      crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.18);
      cluster.add(crystal);
    }
    cluster.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 2.7, CAVE_WIDTH / 2 - 1.3), 0.02, z + THREE.MathUtils.randFloatSpread(2.4));
    shell.add(cluster);
  }

  const entranceLight = new THREE.PointLight(0xffe3b0, 1.65, 26, 1.4);
  entranceLight.position.set(0, 2.1, CAVE_START_Z - 5);
  const deepGuideLight = new THREE.PointLight(0x9fd8ff, 1.0, 28, 1.7);
  deepGuideLight.position.set(0, 1.9, CAVE_END_Z + 10);
  shell.add(entranceLight, deepGuideLight);
  applyStylizedMeshDefaults(shell);
  context.scene.add(shell);
  context.trackCaveObjects(`loose-${shell.uuid}`);

  const entranceId = context.addWorldObject("caveExit", "입구로 나가기", createExitPortal(new THREE.Vector3(0, 0, CAVE_START_Z + 2))).id;
  const deepExitId = context.addWorldObject("caveExit", "동굴 끝 출구", createExitPortal(new THREE.Vector3(0, 0, CAVE_END_Z + 4))).id;
  context.trackCaveObjects(entranceId, deepExitId);

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

export function createHouseInterior(context: InteriorContext, chestRich: boolean, houseKind: HouseKind = "home") {
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
  bed.position.set(-3.15, 0.38, HOUSE_CENTER_Z - 2.9);
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
  room.add(bed, table, lamp, rug);
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
  const chest = context.spawnChest(new THREE.Vector3(2.4, 0, HOUSE_CENTER_Z - 3.15), houseKind === "blacksmith" || chestRich);
  context.trackHouseObjects(exitId, chest.id);
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
