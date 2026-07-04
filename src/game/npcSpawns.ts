import * as THREE from "three";
import { ASSET_PALETTE, makeToonMaterial } from "../visuals";
import type { ObjectType, WalkCycle, WalkPartSetup, WorldObject } from "./types";

export interface NpcSpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
  createWalkCycle(parts: WalkPartSetup[], amplitude?: number, speed?: number, lift?: number): WalkCycle;
  trackCaveObject(id: string): void;
  isHouseInterior(): boolean;
}

export function spawnMiner(context: NpcSpawnContext, position: THREE.Vector3) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x5b6c77, roughness: 0.85 }),
  );
  body.position.y = 1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32),
    new THREE.MeshStandardMaterial({ color: 0xd3a06d, roughness: 0.8 }),
  );
  head.position.y = 1.85;
  const helmet = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.7 }),
  );
  helmet.position.y = 2.15;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xf59e0b, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  lamp.position.set(0, 2.17, 0.3);
  const beard = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 6),
    new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.9 }),
  );
  beard.position.set(0, 1.69, 0.2);
  beard.scale.set(1, 0.55, 0.65);
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 5), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 }));
    eye.position.set(x, 1.89, 0.29);
    group.add(eye);
  }
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.86 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), armMaterial);
    arm.position.set(side * 0.55, 1.02, 0.04);
    arm.rotation.z = side * -0.28;
    group.add(arm);
  }
  const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.86 }));
  pickHandle.position.set(0.66, 1.05, 0.18);
  pickHandle.rotation.z = -0.72;
  const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.08), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.3, roughness: 0.45 }));
  pickHead.position.set(0.88, 1.38, 0.18);
  pickHead.rotation.z = -0.72;
  group.add(body, head, helmet, lamp, beard, pickHandle, pickHead);
  group.position.copy(position);
  const object = context.addWorldObject("miner", "광부", group, {
    collidable: true,
    collisionRadius: 0.65,
    collisionHeight: 2.2,
  });
  context.trackCaveObject(object.id);
  return object;
}

export function spawnBlacksmithNpc(context: NpcSpawnContext, position: THREE.Vector3, villageId = `blacksmith-${crypto.randomUUID()}`) {
  position.y = context.isHouseInterior() ? 0 : context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc58b64, roughness: 0.78 });
  const sootSkin = new THREE.MeshStandardMaterial({ color: 0x8d5b3d, roughness: 0.82 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82 });
  const apron = new THREE.MeshStandardMaterial({ color: 0x4a2d1a, roughness: 0.9 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8c1cc, metalness: 0.45, roughness: 0.34 });
  const ember = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xc2410c, emissiveIntensity: 0.8, roughness: 0.45 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.08, 0.52), shirt);
  torso.position.y = 1.05;
  const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.055), apron);
  apronFront.position.set(0, 0.98, 0.3);
  const apronNeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.07), leather);
  apronNeck.position.set(0, 1.43, 0.31);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.58), leather);
  belt.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), skin);
  head.position.y = 1.84;
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), dark);
  beard.position.set(0, 1.68, 0.19);
  beard.scale.set(1.05, 0.7, 0.72);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  hair.position.y = 1.95;
  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.09, 0.06), steel);
  goggles.position.set(0, 1.86, 0.31);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), sootSkin);
  nose.position.set(0, 1.78, 0.34);
  group.add(torso, apronFront, apronNeck, belt, head, beard, hair, goggles, nose);

  for (const x of [-0.12, 0.12]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dark);
    lens.position.set(x, 1.86, 0.35);
    group.add(lens);
  }

  for (const side of [-1, 1]) {
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.22), shirt);
    upperArm.position.set(side * 0.6, 1.08, 0.02);
    upperArm.rotation.z = side * -0.22;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.46, 10), sootSkin);
    forearm.position.set(side * 0.72, 0.73, 0.08);
    forearm.rotation.z = side * -0.18;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), dark);
    glove.position.set(side * 0.76, 0.48, 0.12);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.58, 0.22), dark);
    leg.position.set(side * 0.2, 0.28, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.32), leather);
    boot.position.set(side * 0.2, 0.04, 0.06);
    group.add(upperArm, forearm, glove, leg, boot);
  }

  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 8), leather);
  hammerHandle.position.set(0.83, 0.55, 0.2);
  hammerHandle.rotation.z = -0.72;
  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.16), steel);
  hammerHead.position.set(1.02, 0.78, 0.2);
  hammerHead.rotation.z = -0.72;
  const coalDust = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.04), ember);
  coalDust.position.set(-0.15, 1.28, 0.335);
  group.add(hammerHandle, hammerHead, coalDust);

  group.position.copy(position);
  return context.addWorldObject("blacksmithNpc", "대장장이", group, {
    collidable: true,
    collisionRadius: 0.62,
    collisionHeight: 2.25,
    villageId,
  });
}

export function spawnVillager(context: NpcSpawnContext, position: THREE.Vector3, villageId: string, homePosition = position.clone(), roamRadius = 14) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const skin = makeToonMaterial(ASSET_PALETTE.skin, { roughness: 0.74 });
  const tunic = makeToonMaterial(ASSET_PALETTE.clothGreen, { roughness: 0.82 });
  const apron = makeToonMaterial(ASSET_PALETTE.wallCream, { roughness: 0.86 });
  const leather = makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.86 });
  const dark = makeToonMaterial(ASSET_PALETTE.ink, { roughness: 0.7 });
  const straw = makeToonMaterial(ASSET_PALETTE.straw, { roughness: 0.9 });
  const walkParts: WalkPartSetup[] = [];

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.42), tunic);
  torso.position.y = 0.93;
  const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.04), apron);
  apronFront.position.set(0, 0.96, 0.24);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.47), leather);
  belt.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10), skin);
  head.position.y = 1.67;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  hair.position.y = 1.75;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
  nose.position.set(0, 1.67, 0.31);
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.018), dark);
  smile.position.set(0, 1.57, 0.31);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.055, 18), straw);
  hatBrim.position.y = 1.93;
  const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.34, 18), straw);
  hatTop.position.y = 2.1;
  group.add(torso, apronFront, belt, head, hair, nose, smile, hatBrim, hatTop);

  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), dark);
    eye.position.set(x, 1.7, 0.29);
    group.add(eye);
  }

  for (const side of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), tunic);
    sleeve.position.set(side * 0.48, 0.98, 0);
    sleeve.rotation.z = side * -0.18;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.set(side * 0.55, 0.68, 0.04);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), leather);
    leg.position.set(side * 0.17, 0.28, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.26), dark);
    boot.position.set(side * 0.17, 0.04, 0.04);
    walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
    group.add(sleeve, hand, leg, boot);
  }

  const sidePouch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.12), leather);
  sidePouch.position.set(-0.43, 0.68, 0.18);
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.18, 10),
    makeToonMaterial(ASSET_PALETTE.wood, { roughness: 0.9 }),
  );
  basket.position.set(0.52, 0.52, 0.16);
  basket.rotation.z = -0.2;
  group.add(sidePouch, basket);
  group.position.copy(position);
  return context.addWorldObject("villager", "주민", group, {
    hp: 10,
    collidable: true,
    collisionRadius: 0.58,
    collisionHeight: 2.15,
    villageId,
    homePosition: homePosition.clone(),
    roamRadius,
    wanderAngle: Math.random() * Math.PI * 2,
    walkCycle: context.createWalkCycle(walkParts, 0.34, 7, 0.025),
  });
}

// 마을 이장 — 모든 마을에 1명. 서브퀘스트를 주고 보상을 준다. 정지형(walk 없음)·저메시(파란 로브 원로).
export function spawnVillageChief(context: NpcSpawnContext, position: THREE.Vector3, villageId: string) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const skin = makeToonMaterial(ASSET_PALETTE.skin, { roughness: 0.74 });
  const robe = makeToonMaterial(0x3b4f9e, { roughness: 0.82 }); // 남색 로브 — 주민(초록)과 확연히 구분
  const trim = makeToonMaterial(0xf2c14e, { roughness: 0.6 }); // 금색 장식
  const white = makeToonMaterial(0xe8ecf2, { roughness: 0.85 }); // 흰 수염
  const dark = makeToonMaterial(ASSET_PALETTE.ink, { roughness: 0.7 });
  const wood = makeToonMaterial(ASSET_PALETTE.wood, { roughness: 0.9 });

  const robeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.66, 1.5, 14), robe);
  robeBody.position.y = 0.75;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.14, 14), trim);
  sash.position.y = 0.62;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin);
  head.position.y = 1.72;
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 12), white);
  beard.position.set(0, 1.5, 0.16);
  beard.rotation.x = Math.PI;
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.06, 16), trim);
  hatBrim.position.y = 1.96;
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.4, 16), robe);
  hatTop.position.y = 2.2;
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8), wood);
  staff.position.set(0.5, 0.95, 0.05);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), trim);
  orb.position.set(0.5, 1.95, 0.05);
  group.add(robeBody, sash, head, beard, hatBrim, hatTop, staff, orb);
  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dark);
    eye.position.set(x, 1.74, 0.27);
    group.add(eye);
  }
  group.position.copy(position);
  return context.addWorldObject("villageChief", "마을 이장", group, {
    collidable: true,
    collisionRadius: 0.6,
    collisionHeight: 2.3,
    villageId,
  });
}
