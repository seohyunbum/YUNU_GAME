import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ASSET_PALETTE,
  VISUAL_THEME,
  gameMaterial,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "../visuals";
import { PLAYER_HEIGHT } from "./constants";
import type { ObjectType, WorldObject } from "./types";

export interface EnvironmentSpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
  mergeStaticMeshes(group: THREE.Group): void;
  overlapsPriorityBiome(point: THREE.Vector3, radius: number, margin?: number): boolean;
  sunPosition(): THREE.Vector3;
}

// 나무 공유 재료 — main.ts sharedMaterials(dispose 보호)에 등록된다 (종전 main 필드에서 이동).
const treeVertexMaterial = gameMaterial(0xffffff, { vertexColors: true, roughness: 0.84, metalness: 0 });
const invisibleTargetMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

export function environmentSharedMaterials(): THREE.Material[] {
  return [treeVertexMaterial, invisibleTargetMaterial];
}

export function waterDepthForRadius(radius: number) {
  return THREE.MathUtils.clamp(radius * 0.045, 1.35, 3.4);
}

let waterNormalTexture: THREE.Texture | null = null;

function getWaterNormalTexture() {
  if (waterNormalTexture) return waterNormalTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to create water normal canvas.");
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const waveA = Math.sin((x + y * 0.62) * 0.23);
      const waveB = Math.cos((x * 0.5 - y) * 0.31);
      const value = 128 + Math.floor((waveA + waveB) * 34);
      const index = (y * size + x) * 4;
      image.data[index] = THREE.MathUtils.clamp(value + 18, 0, 255);
      image.data[index + 1] = THREE.MathUtils.clamp(value, 0, 255);
      image.data[index + 2] = 255;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  waterNormalTexture = texture;
  return texture;
}

export function spawnWaterBody(context: EnvironmentSpawnContext, position: THREE.Vector3, radius: number, name: string) {
  if (context.overlapsPriorityBiome(position, radius, 2)) return null;
  position.y = context.getGroundHeightAt(position.x, position.z);
  const depth = waterDepthForRadius(radius);
  const group = new THREE.Group();
  const basinWall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.98, radius * 0.68, depth, 42, 1, true),
    gameMaterial(0x5b6f6f, { roughness: 0.96 }),
  );
  basinWall.position.y = -depth / 2 + 0.02;
  const basinFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.78, 0.08, 42),
    gameMaterial(VISUAL_THEME.waterDeep, { roughness: 0.88, metalness: 0.02 }),
  );
  basinFloor.position.y = -depth + 0.04;
  const water = new Water(new THREE.CircleGeometry(radius, 72), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: getWaterNormalTexture(),
    sunDirection: context.sunPosition().clone().normalize(),
    sunColor: 0xfff0d4, // 따뜻한 햇빛 반사
    waterColor: VISUAL_THEME.waterDeep,
    distortionScale: 3.4, // 잔물결 ↑ — 더 생동감
    alpha: 0.82, // 살짝 더 깊고 풍부하게
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.userData.waterSurface = true;
  water.position.y = 0.13;
  const shore = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.05, 42),
    gameMaterial(0xc8b06a, { roughness: 0.92, metalness: 0 }),
  );
  shore.position.y = 0.035;
  const rippleMaterial = gameMaterial(0xbcecff, { transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0.02 });
  for (const scale of [0.36, 0.62, 0.86]) {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius * scale, 0.018, 6, 64), rippleMaterial);
    ripple.rotation.x = Math.PI / 2;
    ripple.position.y = 0.18 + scale * 0.01;
    ripple.userData.waterRipple = true;
    group.add(ripple);
  }
  const stoneMaterial = gameMaterial(0x8a8f86, { roughness: 0.95 });
  const reedMaterial = gameMaterial(0x6f8f3e, { roughness: 0.88 });
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2 + THREE.MathUtils.randFloat(-0.08, 0.08);
    if (i % 3 === 0) {
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, THREE.MathUtils.randFloat(0.58, 1.1), 6), reedMaterial);
      reed.position.set(Math.cos(angle) * radius * 0.98, 0.38, Math.sin(angle) * radius * 0.98);
      reed.rotation.z = THREE.MathUtils.randFloat(-0.18, 0.18);
      group.add(reed);
    } else {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.18, 0.42)), stoneMaterial);
      pebble.position.set(Math.cos(angle) * radius * 1.05, 0.13, Math.sin(angle) * radius * 1.05);
      pebble.scale.y = THREE.MathUtils.randFloat(0.35, 0.65);
      group.add(pebble);
    }
  }
  group.add(basinWall, basinFloor, shore, water);
  group.position.copy(position);
  return context.addWorldObject("water", name, group, {
    terrainRadius: radius,
    collisionRadius: 0,
    collisionHeight: 0,
  });
}

function markVisualOnly(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.userData.skipRaycastTarget = true;
  });
}

function paintGeometry(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const vertexCount = geometry.attributes.position.count;
  const paint = new THREE.Color(color);
  const colors: number[] = [];
  for (let index = 0; index < vertexCount; index += 1) colors.push(paint.r, paint.g, paint.b);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

export function spawnTree(context: EnvironmentSpawnContext, type: "smallTree" | "bigTree", position: THREE.Vector3) {
  const group = new THREE.Group();
  const isBig = type === "bigTree";
  const size = isBig ? 2.28 : 1.92;
  const trunkHeight = isBig ? 2.22 * size : 1.28 * size;
  const trunkRadius = isBig ? 0.22 * size : 0.15 * size;
  const geometries: THREE.BufferGeometry[] = [];
  const trunk = paintGeometry(new THREE.CylinderGeometry(trunkRadius * 0.72, trunkRadius, trunkHeight, 10), isBig ? ASSET_PALETTE.woodDark : ASSET_PALETTE.wood);
  trunk.translate(0, trunkHeight / 2, 0);
  geometries.push(trunk);

  if (isBig) {
    const lowerLeaves = paintGeometry(new THREE.ConeGeometry(1.28 * size, 2.04 * size, 14), ASSET_PALETTE.leafDark);
    lowerLeaves.rotateY(Math.PI / 4);
    lowerLeaves.translate(0, trunkHeight + 0.88 * size, 0);
    const upperLeaves = paintGeometry(new THREE.ConeGeometry(0.86 * size, 1.54 * size, 14), ASSET_PALETTE.leaf);
    upperLeaves.rotateY(Math.PI / 4 + 0.16);
    upperLeaves.translate(0, trunkHeight + 1.7 * size, 0);
    const brightEdge = paintGeometry(new THREE.ConeGeometry(0.52 * size, 0.62 * size, 12), ASSET_PALETTE.leafLight);
    brightEdge.rotateY(Math.PI / 4 + 0.32);
    brightEdge.translate(-0.28 * size, trunkHeight + 2.08 * size, 0.18 * size);
    const lowGlow = paintGeometry(new THREE.SphereGeometry(0.28 * size, 9, 7), 0x83ed70);
    lowGlow.scale(1.25, 0.72, 0.9);
    lowGlow.translate(0.42 * size, trunkHeight + 1.08 * size, 0.18 * size);
    geometries.push(lowerLeaves, upperLeaves, brightEdge, lowGlow);
  } else {
    const leaf = paintGeometry(new THREE.SphereGeometry(0.76 * size, 14, 10), ASSET_PALETTE.leafLight);
    leaf.scale(1.12, 0.84, 1);
    leaf.translate(0, trunkHeight + 0.34 * size, 0);
    const highlight = paintGeometry(new THREE.SphereGeometry(0.34 * size, 10, 8), 0xd8ff8a);
    highlight.scale(1.05, 0.72, 0.95);
    highlight.translate(-0.22 * size, trunkHeight + 0.64 * size, 0.16 * size);
    const blossomColors = [0xffd1e8, 0xfff1a8, 0xffffff];
    geometries.push(leaf, highlight);
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + 0.3;
      const blossom = paintGeometry(new THREE.SphereGeometry(0.085 * size, 8, 6), blossomColors[i]);
      blossom.scale(1, 0.85, 1);
      blossom.translate(Math.cos(angle) * 0.52 * size, trunkHeight + 0.5 * size + i * 0.08 * size, Math.sin(angle) * 0.42 * size);
      geometries.push(blossom);
    }
  }
  const visual = new THREE.Mesh(mergeGeometries(geometries), treeVertexMaterial);
  group.add(visual);
  markVisualOnly(group);
  const interactionTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(isBig ? 1.35 : 0.92, isBig ? 1.55 : 1.05, isBig ? 5.8 : 3.2, 8),
    invisibleTargetMaterial,
  );
  interactionTarget.position.y = isBig ? 2.9 : 1.6;
  group.add(interactionTarget);
  group.position.copy(position);
  return context.addWorldObject(type, isBig ? "큰 나무" : "작은 나무", group, {
    collidable: true,
    collisionRadius: isBig ? 2.55 : 1.55,
    collisionHeight: isBig ? 9.5 : 4.45,
  });
}

export function spawnCave(context: EnvironmentSpawnContext, position: THREE.Vector3) {
  const group = new THREE.Group();
  const darkStone = makeToonMaterial(0x262b31, { roughness: 0.96 });
  const midStone = makeToonMaterial(ASSET_PALETTE.stoneDark, { roughness: 0.95 });
  const lightStone = makeToonMaterial(ASSET_PALETTE.stone, { roughness: 0.92 });
  const mossMaterial = makeToonMaterial(ASSET_PALETTE.moss, { roughness: 0.94 });
  const woodMaterial = makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.84 });
  const metalMaterial = makeMetalMaterial(ASSET_PALETTE.steelDark, { metalness: 0.22, roughness: 0.5 });
  const warmGlowMaterial = makeGlowMaterial(0xffd58a, 0xd97706, { emissiveIntensity: 1.15, roughness: 0.34 });
  const crystalMaterial = makeGlowMaterial(ASSET_PALETTE.magicCyan, 0x38bdf8, { emissiveIntensity: 0.72, roughness: 0.42 });

  const entrance = new THREE.Mesh(
    new THREE.TorusGeometry(2.18, 0.38, 12, 24),
    darkStone,
  );
  entrance.position.set(0, 1.72, -0.2);
  entrance.scale.set(1.08, 1.18, 0.92);
  group.add(entrance);

  const tunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.72, 1.18, 2.3, 28, 1, true),
    makeToonMaterial(0x11151b, { roughness: 1, side: THREE.DoubleSide }),
  );
  tunnel.position.set(0, 1.45, -0.76);
  tunnel.rotation.x = Math.PI / 2;
  tunnel.scale.x = 1.08;
  const darkness = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 32),
    new THREE.MeshBasicMaterial({ color: 0x03070c, side: THREE.DoubleSide }),
  );
  darkness.position.set(0, 1.48, 0.02);
  group.add(tunnel, darkness);

  const archRocks = [
    { x: -2.05, y: 0.62, s: 1.2 },
    { x: -2.0, y: 1.42, s: 1.08 },
    { x: -1.58, y: 2.24, s: 1.0 },
    { x: -0.78, y: 2.88, s: 0.92 },
    { x: 0.02, y: 3.13, s: 1.06 },
    { x: 0.82, y: 2.88, s: 0.92 },
    { x: 1.58, y: 2.22, s: 1.0 },
    { x: 2.02, y: 1.42, s: 1.08 },
    { x: 2.08, y: 0.62, s: 1.2 },
  ];
  archRocks.forEach((setup, index) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(setup.s),
      index % 3 === 0 ? lightStone : index % 2 === 0 ? midStone : darkStone,
    );
    rock.position.set(setup.x, setup.y, THREE.MathUtils.randFloat(-0.18, 0.36));
    rock.rotation.set(THREE.MathUtils.randFloatSpread(0.42), THREE.MathUtils.randFloatSpread(0.72), THREE.MathUtils.randFloatSpread(0.48));
    rock.scale.set(THREE.MathUtils.randFloat(0.82, 1.18), THREE.MathUtils.randFloat(0.72, 1.24), THREE.MathUtils.randFloat(0.72, 1.16));
    group.add(rock);
  });

  for (let i = 0; i < 12; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const rubble = new THREE.Mesh(
      new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.32, 0.68)),
      i % 3 === 0 ? lightStone : midStone,
    );
    rubble.position.set(side * THREE.MathUtils.randFloat(1.5, 2.9), THREE.MathUtils.randFloat(0.13, 0.42), THREE.MathUtils.randFloat(-0.5, 1.12));
    rubble.scale.y = THREE.MathUtils.randFloat(0.45, 0.78);
    group.add(rubble);
  }

  const moss = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.12, 0.18),
    mossMaterial,
  );
  moss.position.set(-0.18, 2.98, 0.18);
  moss.rotation.z = -0.08;
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(3.7, 0.16, 0.72),
    midStone,
  );
  threshold.position.set(0, 0.04, 0.74);
  threshold.rotation.x = 0.04;
  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1.15, 7),
    woodMaterial,
  );
  signPost.position.set(-2.95, 0.72, 0.72);
  signPost.rotation.z = 0.06;
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.34, 0.1),
    woodMaterial,
  );
  signBoard.position.set(-2.78, 1.2, 0.74);
  signBoard.rotation.z = -0.1;

  for (const x of [-1.3, -0.62, 0.28, 0.98]) {
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, THREE.MathUtils.randFloat(0.55, 1.1), 6),
      mossMaterial,
    );
    vine.position.set(x, 2.42, 0.42);
    vine.rotation.z = THREE.MathUtils.randFloatSpread(0.2);
    group.add(vine);
  }

  for (const setup of [
    { x: -1.78, y: 1.46, z: 0.58 },
    { x: 1.78, y: 1.46, z: 0.58 },
  ]) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 14), metalMaterial);
    hook.position.set(setup.x, setup.y + 0.24, setup.z);
    hook.rotation.x = Math.PI / 2;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.32, 8), metalMaterial);
    cage.position.set(setup.x, setup.y, setup.z);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), warmGlowMaterial);
    flame.position.set(setup.x, setup.y, setup.z);
    const light = new THREE.PointLight(0xffbd73, 1.35, 8.5, 1.6);
    light.position.set(setup.x, setup.y + 0.1, setup.z);
    group.add(hook, cage, flame, light);
  }

  for (const setup of [
    { x: -1.18, z: 0.9, h: 0.58 },
    { x: -0.86, z: 0.68, h: 0.38 },
    { x: 2.38, z: 0.42, h: 0.5 },
  ]) {
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.14, setup.h, 6), crystalMaterial);
    crystal.position.set(setup.x, 0.12 + setup.h / 2, setup.z);
    crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.2);
    group.add(crystal);
  }
  const crystalLight = new THREE.PointLight(0x8fd7ff, 0.7, 6.5, 1.9);
  crystalLight.position.set(-1.05, 0.62, 0.78);
  group.add(moss, threshold, signPost, signBoard, crystalLight);
  context.mergeStaticMeshes(group);
  group.position.copy(position);
  return context.addWorldObject("cave", "동굴 입구", group, {
    caveReturn: position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 5)), expiresAt: performance.now() + 600_000,
    collidable: true,
    collisionRadius: 3.05,
    collisionHeight: 4.25,
  });
}
