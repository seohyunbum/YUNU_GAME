import * as THREE from "three";
import { gameMaterial, VISUAL_THEME } from "../visuals";
import { createBuildingSign } from "./buildingSigns";
import type { CollisionSegment, ObjectType, WorldObject } from "./types";

// 마을 구조물 스폰(울타리·판매소) — main.ts 에서 이동(동작 보존). 좁은 컨텍스트 주입(§3), 메시 생성은 리프(§2).

export interface VillageSpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
  mergeStaticMeshes(group: THREE.Group): void;
}

export function spawnVillageFence(context: VillageSpawnContext, position: THREE.Vector3, radius: number, villageId: string) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const group = new THREE.Group();
  const wood = gameMaterial(VISUAL_THEME.barkDark, { roughness: 0.88 });
  const darkWood = gameMaterial(0x2c1a11, { roughness: 0.86 });
  const stone = gameMaterial(0x8a806f, { roughness: 0.95 });
  const segments = 36;
  const collisionSegments: CollisionSegment[] = [];
  const gateIndices = new Set([0, 1, segments - 1, segments / 2 - 1, segments / 2, segments / 2 + 1]);

  const makePost = (x: number, z: number, height: number) => {
    const groundY = context.getGroundHeightAt(position.x + x, position.z + z) - position.y;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, height, 0.34), wood);
    post.position.set(x, groundY + height / 2 - 0.05, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.34, 4), darkWood);
    cap.position.set(x, groundY + height + 0.08, z);
    cap.rotation.y = Math.PI / 4;
    group.add(post, cap);
  };
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    if (gateIndices.has(i)) {
      makePost(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.95);
      continue;
    }
    const nextAngle = ((i + 1) / segments) * Math.PI * 2;
    const start = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const end = new THREE.Vector3(Math.cos(nextAngle) * radius, 0, Math.sin(nextAngle) * radius);
    start.y = context.getGroundHeightAt(position.x + start.x, position.z + start.z) - position.y;
    end.y = context.getGroundHeightAt(position.x + end.x, position.z + end.z) - position.y;
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    const chordAngle = Math.atan2(end.z - start.z, end.x - start.x);

    const base = new THREE.Mesh(new THREE.BoxGeometry(length + 0.08, 0.58, 0.5), stone);
    base.position.set(mid.x, mid.y + 0.28, mid.z);
    base.rotation.y = -chordAngle;
    const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.18, 0.18, 0.22), darkWood);
    lowerRail.position.set(mid.x, mid.y + 0.84, mid.z);
    lowerRail.rotation.y = -chordAngle;
    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.18, 0.18, 0.22), darkWood);
    upperRail.position.set(mid.x, mid.y + 1.28, mid.z);
    upperRail.rotation.y = -chordAngle;
    group.add(base, lowerRail, upperRail);
    makePost(start.x, start.z, 1.7);
    makePost(end.x, end.z, 1.7);
    collisionSegments.push({ start, end, halfWidth: 0.38, height: 1.62 });
  }
  context.mergeStaticMeshes(group);
  group.position.copy(position);
  return context.addWorldObject("villageFence", "마을 울타리", group, {
    collidable: true,
    collisionRadius: 0,
    collisionHeight: 1.65,
    collisionSegments,
    terrainRadius: radius,
    villageId,
  });
}

export function spawnVillageSellShop(context: VillageSpawnContext, position: THREE.Vector3, villageId: string) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const shop = new THREE.Group();
  const wood = gameMaterial(0x8b4a22, { roughness: 0.84 });
  const darkWood = gameMaterial(0x3f2415, { roughness: 0.9 });
  const clothAmber = gameMaterial(0xf59e0b, { roughness: 0.76 });
  const clothCream = gameMaterial(0xfff1c2, { roughness: 0.82 });
  const coin = gameMaterial(0xfacc15, { metalness: 0.2, roughness: 0.34 });
  const brass = gameMaterial(0xb7791f, { metalness: 0.24, roughness: 0.44 });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.82, 1.48), wood);
  counter.position.set(0, 0.55, 0.34);
  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.38, 0.12), darkWood);
  frontPanel.position.set(0, 0.77, 1.14);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.16, 1.74), darkWood);
  counterTop.position.set(0, 1.04, 0.34);
  const backShelf = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.32, 0.44), darkWood);
  backShelf.position.set(0, 1.08, -1.1);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.2, 2.62), clothAmber);
  canopy.position.set(0, 2.58, -0.04);
  canopy.rotation.x = -0.08;

  for (let index = 0; index < 5; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.7), index % 2 === 0 ? clothCream : clothAmber);
    stripe.position.set(-2 + index, 2.71, -0.04);
    stripe.rotation.x = canopy.rotation.x;
    shop.add(stripe);
  }
  for (const x of [-2.25, 2.25]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.42, 8), darkWood);
    post.position.set(x, 1.26, 0.9);
    shop.add(post);
  }
  for (const x of [-1.55, -0.58, 0.62, 1.58]) {
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.55), gameMaterial(x < 0 ? 0x9a3412 : 0x7c2d12, { roughness: 0.88 }));
    basket.position.set(x, 1.34, -0.72);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.58), gameMaterial(0xfde68a, { roughness: 0.74 }));
    lid.position.set(x, 1.6, -0.72);
    shop.add(basket, lid);
  }

  const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.72, 8), brass);
  scalePost.position.set(-1.25, 1.42, 0.8);
  const scaleBeam = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.045, 0.045), brass);
  scaleBeam.position.set(-1.25, 1.8, 0.8);
  for (const side of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), brass);
    chain.position.set(-1.25 + side * 0.38, 1.63, 0.8);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.055, 18), brass);
    pan.position.set(-1.25 + side * 0.38, 1.47, 0.8);
    shop.add(chain, pan);
  }
  for (let index = 0; index < 7; index += 1) {
    const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), coin);
    coinMesh.position.set(0.42 + index * 0.18, 1.14 + (index % 3) * 0.035, 0.88);
    coinMesh.rotation.x = Math.PI / 2;
    shop.add(coinMesh);
  }

  const sign = createBuildingSign("판매소", "sell", 2.55, 0.72);
  sign.position.set(0, 2.05, 1.24);
  shop.add(counter, frontPanel, counterTop, backShelf, canopy, scalePost, scaleBeam, sign);
  context.mergeStaticMeshes(shop);
  shop.position.copy(position);
  return context.addWorldObject("villageSellShop", "마을 판매소", shop, {
    collidable: true,
    collisionRadius: 2.65,
    collisionHeight: 2.9,
    villageId,
  });
}
