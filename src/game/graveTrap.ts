// 초록손 무덤 함정 — 공동묘지 맵의 일부 무덤에 초록 좀비 손이 솟아 있고,
// 그 위를 지나가면 지하의 좁은 무덤 공간으로 끌려가 좀비 1마리와 싸운다.
// 이기면 출구가 열리고(잡으면 탈출), 지면 일반 사망 규칙을 따른다.
// 지하 공간은 기존 동굴 모드(locationMode "cave")를 재사용한다 — 분위기·정리·사망 처리가 공짜로 따라온다.
import * as THREE from "three";
import { gameMaterial } from "../visuals";
import { applyPredatorMonsterDefinition } from "./monsters";
import { animatePredatorAttackMotion, triggerPredatorAttackMotion } from "./predatorAi";
import { biomesForWorldMap } from "./worldData";
import type { LocationMode, WorldMapId, WorldObject } from "./types";

export const GRAVE_HAND_COUNT = 6; // 장식 묘비 ~290기 대비 ≈ 1/50
const TRIGGER_RADIUS = 1.15;
const HAND_MIN_PLAYER_DISTANCE = 25;
const BURROW_CENTER = new THREE.Vector3(80, 0, -845); // 동굴(z -780~-970)과 같은 지하 대역, x 로 분리
const BURROW_RADIUS = 6.5;
const ZOMBIE_STRIKE_RANGE = 1.95;
const ZOMBIE_SPEED = 2.1;
const ZOMBIE_ATTACK_COOLDOWN = 1.5;

export interface GraveTrapState {
  active: boolean;
  zombieId: string | null;
  exitSpawned: boolean;
}

export function createGraveTrapState(): GraveTrapState {
  return { active: false, zombieId: null, exitSpawned: false };
}

export interface GraveTrapContext {
  state: GraveTrapState;
  playerPosition: THREE.Vector3;
  locationMode(): LocationMode;
  worldMapId(): WorldMapId;
  now(): number;
  graveHands(): Iterable<WorldObject>;
  getObject(id: string): WorldObject | undefined;
  removeObject(id: string): void;
  addWorldObject(type: "graveHand" | "caveExit", name: string, root: THREE.Object3D, extra: Partial<WorldObject>): WorldObject;
  addCaveDressing(object: THREE.Object3D): void;
  spawnZombie(position: THREE.Vector3): WorldObject;
  enterUnderground(point: THREE.Vector3): void;
  getGroundHeightAt(x: number, z: number): number;
  animateWalkCycle(object: WorldObject, delta: number, movementSpeed: number): void;
  refreshSpatialObject(object: WorldObject): void;
  damagePlayer(amount: number, showParticles: boolean, deathReason: string): boolean;
  showMessage(text: string): void;
  renderHud(): void;
}

function createGraveHandVisual() {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(new THREE.SphereGeometry(0.62, 9, 6), gameMaterial(0x3c2f22, { roughness: 1 }));
  soil.scale.set(1.15, 0.3, 1.45);
  soil.position.y = 0.04;
  group.add(soil);
  const fleshMaterial = gameMaterial(0x4ade80, { emissive: 0x166534, emissiveIntensity: 0.55, roughness: 0.7 });
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.13), fleshMaterial);
  forearm.position.set(0, 0.3, 0);
  forearm.rotation.z = 0.14;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.09), fleshMaterial);
  palm.position.set(0.03, 0.56, 0);
  group.add(forearm, palm);
  for (const [offset, height] of [[-0.07, 0.16], [0, 0.2], [0.07, 0.17]] as const) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.045, height, 0.05), fleshMaterial);
    finger.position.set(0.03 + offset, 0.66 + height / 2 - 0.05, 0);
    finger.rotation.z = offset * -1.6;
    group.add(finger);
  }
  return group;
}

// 손 무덤이 항상 GRAVE_HAND_COUNT 개 유지되게 충원한다 (세이브 복원 시 유실돼도 자동 회복).
function ensureGraveHands(context: GraveTrapContext) {
  let count = 0;
  for (const hand of context.graveHands()) if (hand) count += 1;
  if (count >= GRAVE_HAND_COUNT) return;
  const biomes = biomesForWorldMap("graveyard").filter((biome) => biome.kind === "graveyard");
  if (biomes.length === 0) return;
  for (let i = count; i < GRAVE_HAND_COUNT; i += 1) {
    const biome = biomes[Math.floor(Math.random() * biomes.length)];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * biome.radius * 0.85;
    const point = new THREE.Vector3(biome.center.x + Math.cos(angle) * distance, 0, biome.center.z + Math.sin(angle) * distance);
    if (Math.hypot(point.x - context.playerPosition.x, point.z - context.playerPosition.z) < HAND_MIN_PLAYER_DISTANCE) continue;
    point.y = context.getGroundHeightAt(point.x, point.z);
    const visual = createGraveHandVisual();
    visual.position.copy(point);
    visual.rotation.y = Math.random() * Math.PI * 2;
    context.addWorldObject("graveHand", "초록손 무덤", visual, { collidable: false });
  }
}

function buildBurrow(context: GraveTrapContext) {
  const group = new THREE.Group();
  const dirtMaterial = gameMaterial(0x3a2c1f, { roughness: 1 });
  const darkDirtMaterial = gameMaterial(0x2a2017, { roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(BURROW_RADIUS + 2, 18), dirtMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(BURROW_CENTER.x, 0.01, BURROW_CENTER.z);
  group.add(floor);
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 1.2), i % 2 === 0 ? dirtMaterial : darkDirtMaterial);
    wall.position.set(BURROW_CENTER.x + Math.cos(angle) * (BURROW_RADIUS + 1.4), 2.0, BURROW_CENTER.z + Math.sin(angle) * (BURROW_RADIUS + 1.4));
    wall.rotation.y = -angle + Math.PI / 2;
    group.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.CylinderGeometry(BURROW_RADIUS + 2.4, BURROW_RADIUS + 2.4, 0.7, 16), darkDirtMaterial);
  ceiling.position.set(BURROW_CENTER.x, 4.3, BURROW_CENTER.z);
  group.add(ceiling);
  for (let i = 0; i < 5; i += 1) {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, THREE.MathUtils.randFloat(0.8, 1.6), 6), gameMaterial(0x4f3a26, { roughness: 0.95 }));
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * BURROW_RADIUS * 0.8;
    root.position.set(BURROW_CENTER.x + Math.cos(angle) * distance, 3.7, BURROW_CENTER.z + Math.sin(angle) * distance);
    root.rotation.set(THREE.MathUtils.randFloatSpread(0.5), 0, THREE.MathUtils.randFloatSpread(0.5));
    group.add(root);
  }
  const coffin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 2.1), gameMaterial(0x4a3625, { roughness: 0.92 }));
  coffin.position.set(BURROW_CENTER.x - 3.4, 0.26, BURROW_CENTER.z - 1.8);
  coffin.rotation.y = 0.5;
  const coffinLid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 2.14), gameMaterial(0x3c2c1e, { roughness: 0.92 }));
  coffinLid.position.set(BURROW_CENTER.x - 4.1, 0.16, BURROW_CENTER.z - 0.9);
  coffinLid.rotation.set(0.18, 0.9, 0);
  const light = new THREE.PointLight(0x86efac, 1.15, 20, 1.5);
  light.position.set(BURROW_CENTER.x, 2.6, BURROW_CENTER.z);
  group.add(coffin, coffinLid, light);
  context.addCaveDressing(group);
}

function spawnBurrowExit(context: GraveTrapContext) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 0.4), gameMaterial(0x3b3a36, { roughness: 0.8 }));
  frame.position.y = 1.5;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 0.44), gameMaterial(0xb7f7c4, { emissive: 0x4ade80, emissiveIntensity: 1.0 }));
  glow.position.y = 1.45;
  group.add(frame, glow);
  group.position.set(BURROW_CENTER.x, 0, BURROW_CENTER.z + BURROW_RADIUS - 0.6);
  context.addWorldObject("caveExit", "무덤 밖으로 나가기", group, { collidable: false });
}

function updateBurrowZombie(context: GraveTrapContext, delta: number) {
  const state = context.state;
  const zombie = state.zombieId ? context.getObject(state.zombieId) : undefined;
  if (!zombie || (zombie.hp ?? 0) <= 0) {
    if (!state.exitSpawned) {
      state.exitSpawned = true;
      spawnBurrowExit(context);
      context.showMessage("좀비를 물리쳤습니다! 빛나는 출구가 열렸습니다.");
      context.renderHud();
    }
    return;
  }
  const dx = context.playerPosition.x - zombie.root.position.x;
  const dz = context.playerPosition.z - zombie.root.position.z;
  const distance = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  if (distance > ZOMBIE_STRIKE_RANGE * 0.8) {
    const step = ZOMBIE_SPEED * delta;
    let nx = zombie.root.position.x + Math.cos(angle) * step;
    let nz = zombie.root.position.z + Math.sin(angle) * step;
    const offsetX = nx - BURROW_CENTER.x;
    const offsetZ = nz - BURROW_CENTER.z;
    const radius = Math.hypot(offsetX, offsetZ);
    if (radius > BURROW_RADIUS) {
      nx = BURROW_CENTER.x + (offsetX / radius) * BURROW_RADIUS;
      nz = BURROW_CENTER.z + (offsetZ / radius) * BURROW_RADIUS;
    }
    zombie.root.position.set(nx, 0, nz);
  }
  zombie.root.rotation.y = -angle + Math.PI / 2;
  animatePredatorAttackMotion(zombie, context.now());
  context.refreshSpatialObject(zombie);
  context.animateWalkCycle(zombie, delta, 0.7);
  zombie.attackCooldown = Math.max(0, (zombie.attackCooldown ?? 0) - delta);
  if (distance < ZOMBIE_STRIKE_RANGE && (zombie.attackCooldown ?? 0) <= 0) {
    zombie.attackCooldown = ZOMBIE_ATTACK_COOLDOWN;
    triggerPredatorAttackMotion(zombie, context.now());
    context.damagePlayer(zombie.attackDamage ?? 28, true, "무덤 속 좀비에게 당해 체력이 모두 떨어졌습니다.");
  }
}

function triggerTrap(context: GraveTrapContext, hand: WorldObject) {
  context.removeObject(hand.id);
  context.showMessage("초록 좀비 손이 발목을 붙잡았습니다! 좁은 무덤 속으로 끌려갑니다...");
  context.enterUnderground(new THREE.Vector3(BURROW_CENTER.x, 0, BURROW_CENTER.z + 3.4));
  buildBurrow(context);
  const zombie = context.spawnZombie(new THREE.Vector3(BURROW_CENTER.x, 0, BURROW_CENTER.z - 3.8));
  applyPredatorMonsterDefinition(zombie, { id: "graveyard_core", lootTier: 5 }, "zombie");
  context.state.active = true;
  context.state.zombieId = zombie.id;
  context.state.exitSpawned = false;
  context.renderHud();
}

export function updateGraveTrap(context: GraveTrapContext, delta: number) {
  const state = context.state;
  if (state.active) {
    if (context.locationMode() !== "cave") {
      // 출구 탈출 또는 사망으로 무덤을 벗어났다 — 함정 상태 정리
      state.active = false;
      state.zombieId = null;
      state.exitSpawned = false;
      return;
    }
    updateBurrowZombie(context, delta);
    return;
  }
  if (context.locationMode() !== "overworld" || context.worldMapId() !== "graveyard") return;
  ensureGraveHands(context);
  for (const hand of context.graveHands()) {
    const distance = Math.hypot(hand.root.position.x - context.playerPosition.x, hand.root.position.z - context.playerPosition.z);
    if (distance > TRIGGER_RADIUS) continue;
    triggerTrap(context, hand);
    return;
  }
}
