import * as THREE from "three";
import {
  ASSET_PALETTE,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "../visuals";
import { applyMonsterDifficulty, type DifficultyModifiers } from "./difficulty";
import { buildStrikeArm } from "./guardMotion";
import type { ObjectType, WalkCycle, WalkPartSetup, WorldObject } from "./types";

export interface GuardSpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
  createWalkCycle(parts: WalkPartSetup[], amplitude?: number, speed?: number, lift?: number): WalkCycle;
  monsterDifficulty(): DifficultyModifiers;
}

export function spawnKnight(context: GuardSpawnContext, position: THREE.Vector3, villageId: string) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const steel = makeMetalMaterial(ASSET_PALETTE.steel, { metalness: 0.45, roughness: 0.38 });
  const darkSteel = makeMetalMaterial(ASSET_PALETTE.steelDark, { metalness: 0.45, roughness: 0.42 });
  const blue = makeToonMaterial(ASSET_PALETTE.clothBlue, { roughness: 0.68 });
  const gold = makeMetalMaterial(ASSET_PALETTE.gold, { metalness: 0.35, roughness: 0.36 });
  const skin = makeToonMaterial(ASSET_PALETTE.skin, { roughness: 0.8 });
  const leather = makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.85 });
  const walkParts: WalkPartSetup[] = [];

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.52), steel);
  torso.position.y = 1.02;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.055), darkSteel);
  chestPlate.position.set(0, 1.12, 0.3);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.07), gold);
  crest.position.set(0, 1.18, 0.34);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.11, 0.58), leather);
  belt.position.y = 0.58;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 10), skin);
  neck.position.y = 1.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin);
  head.position.y = 1.93;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.72), darkSteel);
  helmet.position.y = 2.02;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.09), steel);
  visor.position.set(0, 1.93, 0.31);
  const plume = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.08), blue);
  plume.position.set(0, 2.34, -0.04);
  group.add(torso, chestPlate, crest, belt, neck, head, helmet, visor, plume);

  let knightArm: THREE.Object3D | null = null;
  let knightGauntlet: THREE.Object3D | null = null;
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), darkSteel);
    pauldron.position.set(side * 0.62, 1.52, 0);
    pauldron.scale.set(1.25, 0.58, 0.9);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), steel);
    arm.position.set(side * 0.68, 1.0, 0.02);
    arm.rotation.z = side * -0.12;
    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), darkSteel);
    gauntlet.position.set(side * 0.73, 0.58, 0.06);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.24), steel);
    leg.position.set(side * 0.23, 0.27, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.34), darkSteel);
    boot.position.set(side * 0.23, 0.03, 0.06);
    walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
    group.add(pauldron, arm, gauntlet, leg, boot);
    if (side === 1) { knightArm = arm; knightGauntlet = gauntlet; }
  }

  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.95, 0.68),
    blue,
  );
  shield.position.set(-0.75, 1.05, 0.22);
  shield.rotation.z = 0.05;
  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), gold);
  shieldBoss.position.set(-0.86, 1.06, 0.22);
  shieldBoss.scale.set(0.55, 1, 1);
  const swordBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.82, 0.05),
    makeMetalMaterial(0xd8dee8, { metalness: 0.6, roughness: 0.28 }),
  );
  swordBlade.position.set(0.78, 1.12, 0.26);
  swordBlade.rotation.z = -0.22;
  const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), gold);
  swordGuard.position.set(0.7, 0.78, 0.24);
  swordGuard.rotation.z = -0.22;
  const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), leather);
  swordGrip.position.set(0.64, 0.62, 0.22);
  swordGrip.rotation.z = -0.22;
  group.add(shield, shieldBoss, swordBlade, swordGuard, swordGrip);
  // 검을 든 오른팔 + 검을 어깨 피벗으로 묶어 공격 시 내려친다(방패 팔은 몸에 고정).
  if (knightArm && knightGauntlet) buildStrikeArm(group, [0.62, 1.52, 0], [knightArm, knightGauntlet, swordBlade, swordGuard, swordGrip]);
  group.position.copy(position);
  const knight = context.addWorldObject("villageKnight", "마을기사", group, {
    hp: 90,
    armor: 18,
    collidable: true,
    collisionRadius: 0.78,
    collisionHeight: 2.42,
    villageId, homePosition: position.clone(),
    guardMode: "melee",
    attackRange: 2.05,
    attackDamage: 8,
    walkCycle: context.createWalkCycle(walkParts, 0.38, 8, 0.025),
  });
  applyMonsterDifficulty(knight, context.monsterDifficulty());
  return knight;
}

export function spawnGolem(context: GuardSpawnContext, position: THREE.Vector3, villageId: string) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const stone = makeToonMaterial(ASSET_PALETTE.stone, { roughness: 0.92, metalness: 0.1 });
  const darkStone = makeToonMaterial(ASSET_PALETTE.stoneDark, { roughness: 0.96, metalness: 0.08 });
  const moss = makeToonMaterial(ASSET_PALETTE.moss, { roughness: 0.92 });
  const glow = makeGlowMaterial(ASSET_PALETTE.magicCyan, 0x16a6c7, { emissiveIntensity: 1.4, roughness: 0.22 });

  const addBlock = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
    return mesh;
  };

  addBlock(new THREE.BoxGeometry(1.78, 2.18, 0.98), stone, 0, 1.62, 0, 0.02, 0, 0.03);
  addBlock(new THREE.BoxGeometry(1.32, 0.78, 1.04), darkStone, 0, 1.28, 0.04, 0, 0, -0.02);
  const chestCore = addBlock(new THREE.OctahedronGeometry(0.28), glow, 0, 1.95, 0.56);
  chestCore.scale.set(0.85, 1.15, 0.35);
  addBlock(new THREE.BoxGeometry(0.64, 0.34, 0.62), darkStone, 0, 2.82, 0);
  addBlock(new THREE.BoxGeometry(1.04, 0.86, 0.82), stone, 0, 3.24, 0.02, -0.02, 0.02, 0);
  addBlock(new THREE.BoxGeometry(1.12, 0.16, 0.18), darkStone, 0, 3.38, 0.45);
  addBlock(new THREE.BoxGeometry(0.82, 0.18, 0.24), darkStone, 0, 2.88, 0.4);

  for (const x of [-0.26, 0.26]) {
    const eye = addBlock(new THREE.BoxGeometry(0.16, 0.12, 0.08), glow, x, 3.28, 0.48);
    eye.scale.z = 0.55;
  }

  const golemArm: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const shoulderBlock = addBlock(new THREE.BoxGeometry(0.86, 0.42, 0.78), darkStone, side * 1.18, 2.38, 0, 0, 0, side * 0.12);
    const upperArm = addBlock(new THREE.BoxGeometry(0.42, 1.18, 0.44), stone, side * 1.42, 1.68, 0, 0, 0, side * 0.14);
    const foreArm = addBlock(new THREE.BoxGeometry(0.5, 1.02, 0.48), darkStone, side * 1.5, 0.85, 0.04, 0, 0, side * -0.1);
    const fist = addBlock(new THREE.BoxGeometry(0.74, 0.48, 0.64), stone, side * 1.56, 0.28, 0.08, 0, side * 0.04, side * -0.05);
    addBlock(new THREE.BoxGeometry(0.54, 1.0, 0.55), stone, side * 0.52, 0.58, 0, 0, 0, side * 0.04);
    addBlock(new THREE.BoxGeometry(0.7, 0.28, 0.72), darkStone, side * 0.54, 0.08, 0.14);
    const spike = addBlock(new THREE.ConeGeometry(0.16, 0.46, 4), darkStone, side * 1.2, 2.84, 0.03, 0, side * 0.55, side * -0.22);
    const runeA = addBlock(new THREE.BoxGeometry(0.08, 0.42, 0.08), glow, side * 1.14, 2.32, 0.43, 0, 0, side * 0.1);
    const runeB = addBlock(new THREE.BoxGeometry(0.08, 0.38, 0.08), glow, side * 1.55, 1.22, 0.34, 0, 0, side * -0.1);
    if (side === 1) golemArm.push(shoulderBlock, upperArm, foreArm, fist, spike, runeA, runeB);
  }

  addBlock(new THREE.BoxGeometry(1.1, 0.08, 1.04), moss, -0.18, 2.72, 0.04);
  addBlock(new THREE.BoxGeometry(0.14, 0.74, 0.08), moss, -0.66, 2.28, 0.54, 0, 0, -0.08);
  addBlock(new THREE.BoxGeometry(0.1, 0.58, 0.08), moss, 0.58, 2.16, 0.54, 0, 0, 0.12);
  addBlock(new THREE.BoxGeometry(0.78, 0.1, 0.1), glow, 0, 1.54, 0.58);
  addBlock(new THREE.BoxGeometry(0.1, 0.5, 0.08), glow, 0, 1.18, 0.58);
  addBlock(new THREE.ConeGeometry(0.1, 0.38, 4), darkStone, -0.42, 3.82, 0.02, 0, 0.2, 0);
  addBlock(new THREE.ConeGeometry(0.1, 0.38, 4), darkStone, 0.42, 3.82, 0.02, 0, -0.2, 0);
  // 오른팔 전체를 어깨 피벗으로 묶어 공격 시 묵직하게 내려찍는다(golem = heavy 프로파일).
  buildStrikeArm(group, [1.18, 2.38, 0], golemArm);
  group.position.copy(position);
  const golem = context.addWorldObject("villageGolem", "마을 수호신 골렘", group, {
    hp: 180,
    armor: 30,
    collidable: true,
    collisionRadius: 1.45,
    collisionHeight: 3.9,
    villageId, homePosition: position.clone(),
    guardMode: "melee",
    attackRange: 2.55,
    attackDamage: 14,
    attackInterval: 5,
  });
  applyMonsterDifficulty(golem, context.monsterDifficulty());
  return golem;
}
