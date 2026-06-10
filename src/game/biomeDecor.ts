import * as THREE from "three";
import { gameMaterial } from "../visuals";
import type { BiomeConfig } from "./types";

export interface BiomeDecorContext {
  biomes: BiomeConfig[];
  clearBiomeMeshes(): void;
  addBiomeMesh(object: THREE.Object3D): void;
  randomPointInCircle(center: THREE.Vector3, radius: number): THREE.Vector3;
  isPointInWater?(point: THREE.Vector3, margin: number): boolean;
}

export function createBiomeDecor(context: BiomeDecorContext) {
  context.clearBiomeMeshes();
  for (const biome of context.biomes) {
    if (biome.kind === "bamboo") createBambooBiome(context, biome);
    if (biome.kind === "mushroom") createMushroomBiome(context, biome);
    if (biome.kind === "swamp") createSwampBiome(context, biome);
    if (biome.kind === "snow") createSnowBiome(context, biome);
    if (biome.kind === "mountain") createMountainBiomeDecor(context, biome);
    if (biome.kind === "lava") createLavaBiome(context, biome);
    if (biome.kind === "graveyard") createGraveyardBiome(context, biome);
  }
}

// 공동묘지 — 묘비(둥근 묘비·십자가)와 봉분이 바닥에 가득 깔리고 고사목이 드문드문 선다.
function createGraveyardBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const slabCount = 110;
  const crossCount = 36;
  const moundCount = 120;
  const treeCount = 12;
  const stoneMaterial = gameMaterial(0x99a1ad, { roughness: 0.94 });
  const oldStoneMaterial = gameMaterial(0x6f7884, { roughness: 0.96 });
  const soilMaterial = gameMaterial(0x4a3a2b, { roughness: 1 });
  const woodMaterial = gameMaterial(0x33271d, { roughness: 0.95 });

  const slabMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.95, 0.15), stoneMaterial, slabCount);
  const slabTopMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.31, 0.31, 0.15, 10, 1, false, 0, Math.PI), stoneMaterial, slabCount);
  const slabMoundMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 9, 6), soilMaterial, slabCount);
  const crossVerticalMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.92, 0.13), oldStoneMaterial, crossCount);
  const crossArmMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.14, 0.13), oldStoneMaterial, crossCount);
  const moundMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 9, 6), soilMaterial, moundCount);
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.17, 2.6, 7), woodMaterial, treeCount);
  const branchMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.09, 0.09), woodMaterial, treeCount * 2);

  const dummy = new THREE.Object3D();
  const placeSlab = (mesh: THREE.InstancedMesh, index: number, point: THREE.Vector3, yaw: number, height: number, lean: number, scale: number, tipOver = 0) => {
    dummy.position.set(point.x, point.y + height * scale, point.z);
    dummy.rotation.set(lean + tipOver, yaw, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  };

  for (let i = 0; i < slabCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.94);
    const yaw = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const lean = THREE.MathUtils.randFloat(-0.14, 0.14);
    const scale = THREE.MathUtils.randFloat(0.9, 1.25);
    placeSlab(slabMesh, i, point, yaw, 0.45, lean, scale);
    placeSlab(slabTopMesh, i, point, yaw, 0.92, lean, scale, -Math.PI / 2);
    dummy.position.set(point.x + Math.sin(yaw) * 0.8, point.y + 0.04, point.z + Math.cos(yaw) * 0.8);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(0.85, 0.3, 1.35);
    dummy.updateMatrix();
    slabMoundMesh.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < crossCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.9);
    const yaw = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const lean = THREE.MathUtils.randFloat(-0.18, 0.18);
    const scale = THREE.MathUtils.randFloat(0.9, 1.3);
    placeSlab(crossVerticalMesh, i, point, yaw, 0.46, lean, scale);
    placeSlab(crossArmMesh, i, point, yaw, 0.62, lean, scale);
  }
  for (let i = 0; i < moundCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.97);
    dummy.position.set(point.x, point.y + 0.02, point.z);
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(THREE.MathUtils.randFloat(0.7, 1.2), THREE.MathUtils.randFloat(0.22, 0.32), THREE.MathUtils.randFloat(1.0, 1.5));
    dummy.updateMatrix();
    moundMesh.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < treeCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.84);
    const yaw = THREE.MathUtils.randFloat(0, Math.PI * 2);
    dummy.position.set(point.x, point.y + 1.3, point.z);
    dummy.rotation.set(THREE.MathUtils.randFloat(-0.08, 0.08), yaw, THREE.MathUtils.randFloat(-0.1, 0.1));
    dummy.scale.setScalar(THREE.MathUtils.randFloat(0.85, 1.35));
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    for (const [branchIndex, side] of [-1, 1].entries()) {
      dummy.position.set(point.x + Math.cos(yaw) * 0.4 * side, point.y + THREE.MathUtils.randFloat(1.7, 2.3), point.z - Math.sin(yaw) * 0.4 * side);
      dummy.rotation.set(THREE.MathUtils.randFloat(-0.3, 0.3), yaw, side * THREE.MathUtils.randFloat(0.35, 0.7));
      dummy.scale.setScalar(THREE.MathUtils.randFloat(0.7, 1.1));
      dummy.updateMatrix();
      branchMesh.setMatrixAt(i * 2 + branchIndex, dummy.matrix);
    }
  }

  finalizeInstances(slabMesh, slabTopMesh, slabMoundMesh, crossVerticalMesh, crossArmMesh, moundMesh, trunkMesh, branchMesh);
  group.add(slabMesh, slabTopMesh, slabMoundMesh, crossVerticalMesh, crossArmMesh, moundMesh, trunkMesh, branchMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function finalizeInstances(...meshes: THREE.InstancedMesh[]) {
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

function markBiomeDistanceCull(group: THREE.Object3D, biome: BiomeConfig, padding = 18) {
  group.userData.distanceCullCenterX = biome.center.x;
  group.userData.distanceCullCenterZ = biome.center.z;
  group.userData.distanceCullRadius = biome.radius + padding;
}

function randomDryBiomePoint(context: BiomeDecorContext, biome: BiomeConfig, radiusScale: number, margin = 2) {
  let fallback = context.randomPointInCircle(biome.center, biome.radius * radiusScale);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * radiusScale);
    fallback = point;
    if (!context.isPointInWater?.(point, margin)) return point;
  }
  return fallback;
}

function createBambooBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const count = 575;
  const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.085, 1, 8),
    gameMaterial(0x5c9b35, { roughness: 0.72 }),
    count,
  );
  const jointMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8),
    gameMaterial(0xd7bf55, { roughness: 0.8 }),
    count,
  );
  const leafMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.58, 1.05, 6),
    gameMaterial(0x2f7d32, { roughness: 0.8 }),
    count,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.92);
    const height = THREE.MathUtils.randFloat(8.1, 15.6);
    dummy.position.set(point.x, point.y + height / 2, point.z);
    dummy.rotation.set(THREE.MathUtils.randFloat(-0.02, 0.02), 0, THREE.MathUtils.randFloat(-0.05, 0.05));
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(point.x, point.y + height * 0.62, point.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    jointMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(point.x + THREE.MathUtils.randFloatSpread(0.32), point.y + height + 0.28, point.z + THREE.MathUtils.randFloatSpread(0.32));
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(THREE.MathUtils.randFloat(0.78, 1.18), THREE.MathUtils.randFloat(0.78, 1.22), THREE.MathUtils.randFloat(0.78, 1.18));
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  }
  finalizeInstances(stemMesh, jointMesh, leafMesh);
  group.add(stemMesh, jointMesh, leafMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function createMushroomBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const count = 34;
  const redCount = Math.ceil(count / 3);
  const purpleCount = count - redCount;
  const stemMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.18, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8d2b4, roughness: 0.86 }),
    count,
  );
  const redCapMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xb93848, roughness: 0.78 }),
    redCount,
  );
  const purpleCapMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x7b4ab0, roughness: 0.78 }),
    purpleCount,
  );
  const dummy = new THREE.Object3D();
  let redIndex = 0;
  let purpleIndex = 0;
  for (let i = 0; i < count; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.86);
    const height = THREE.MathUtils.randFloat(0.7, 2.4);
    dummy.position.set(point.x, point.y + height / 2, point.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(height, height, height);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(point.x, point.y + height, point.z);
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(height, height, height);
    dummy.updateMatrix();
    if (i % 3 === 0) {
      redCapMesh.setMatrixAt(redIndex, dummy.matrix);
      redIndex += 1;
    } else {
      purpleCapMesh.setMatrixAt(purpleIndex, dummy.matrix);
      purpleIndex += 1;
    }
  }
  finalizeInstances(stemMesh, redCapMesh, purpleCapMesh);
  group.add(stemMesh, redCapMesh, purpleCapMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function createSwampBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const pondCount = 7;
  const trunkCount = 18;
  const pondMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0x365f62, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.7 }),
    pondCount,
  );
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.22, 1, 7),
    new THREE.MeshStandardMaterial({ color: 0x4b3824, roughness: 1 }),
    trunkCount,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < pondCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.72);
    const radius = THREE.MathUtils.randFloat(3.2, 6.8);
    dummy.position.set(point.x, point.y + 0.035, point.z);
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(radius, 1, radius * THREE.MathUtils.randFloat(0.72, 1.1));
    dummy.updateMatrix();
    pondMesh.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < trunkCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.88);
    const height = THREE.MathUtils.randFloat(1.2, 2.4);
    dummy.position.set(point.x, point.y + 0.8, point.z);
    dummy.rotation.set(0, 0, THREE.MathUtils.randFloat(-0.28, 0.28));
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
  }
  finalizeInstances(pondMesh, trunkMesh);
  group.add(pondMesh, trunkMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function createSnowBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const count = 34;
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.14, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x5b321f, roughness: 0.9 }),
    count,
  );
  const snowTopMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.72, 1, 9),
    new THREE.MeshStandardMaterial({ color: 0xe9f5f7, roughness: 0.9 }),
    count,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.86);
    const height = THREE.MathUtils.randFloat(1.8, 3.5);
    dummy.position.set(point.x, point.y + height * 0.3, point.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, height * 0.6, 1);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(point.x, point.y + height * 0.78, point.z);
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    snowTopMesh.setMatrixAt(i, dummy.matrix);
  }
  finalizeInstances(trunkMesh, snowTopMesh);
  group.add(trunkMesh, snowTopMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function createMountainBiomeDecor(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const count = 28;
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1),
    new THREE.MeshStandardMaterial({ color: 0x697178, roughness: 1 }),
    count,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.9);
    const size = THREE.MathUtils.randFloat(0.7, 2.1);
    dummy.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.4, 1.1), point.z);
    dummy.rotation.set(THREE.MathUtils.randFloatSpread(0.5), THREE.MathUtils.randFloat(0, Math.PI * 2), THREE.MathUtils.randFloatSpread(0.5));
    dummy.scale.set(size, size * THREE.MathUtils.randFloat(0.55, 1.25), size);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  }
  finalizeInstances(rockMesh);
  group.add(rockMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}

function createLavaBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  const lavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xff5a1f,
    emissive: 0xff2d00,
    emissiveIntensity: 1.05,
    roughness: 0.36,
    metalness: 0.05,
  });
  const crustMaterial = new THREE.MeshStandardMaterial({ color: 0x23201e, roughness: 0.95 });
  const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.5 });

  const poolCount = 11;
  const emberCount = 46;
  const poolMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.08, 28), lavaMaterial, poolCount);
  const rimMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.05, 0.12, 28), crustMaterial, poolCount);
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), crustMaterial, emberCount);
  const emberMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), emberMaterial, emberCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < poolCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.82);
    const poolRadius = THREE.MathUtils.randFloat(2.4, 6.8);
    const stretch = THREE.MathUtils.randFloat(0.72, 1.1);
    dummy.position.set(point.x, point.y + 0.12, point.z);
    dummy.rotation.set(0, THREE.MathUtils.randFloat(0, Math.PI * 2), 0);
    dummy.scale.set(poolRadius, 1, poolRadius * stretch);
    dummy.updateMatrix();
    poolMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(point.x, point.y + 0.06, point.z);
    dummy.scale.set(poolRadius, 1, poolRadius * stretch);
    dummy.updateMatrix();
    rimMesh.setMatrixAt(i, dummy.matrix);
  }

  for (let i = 0; i < emberCount; i += 1) {
    const point = randomDryBiomePoint(context, biome, 0.92);
    const rockSize = THREE.MathUtils.randFloat(0.45, 1.55);
    dummy.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.22, 0.85), point.z);
    dummy.rotation.set(THREE.MathUtils.randFloatSpread(0.7), THREE.MathUtils.randFloat(0, Math.PI * 2), THREE.MathUtils.randFloatSpread(0.7));
    dummy.scale.set(rockSize, rockSize * THREE.MathUtils.randFloat(0.45, 1.05), rockSize);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);

    const emberSize = THREE.MathUtils.randFloat(0.05, 0.14);
    dummy.position.set(point.x + THREE.MathUtils.randFloatSpread(0.45), point.y + THREE.MathUtils.randFloat(0.18, 0.75), point.z + THREE.MathUtils.randFloatSpread(0.45));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(emberSize);
    dummy.updateMatrix();
    emberMesh.setMatrixAt(i, dummy.matrix);
  }

  finalizeInstances(poolMesh, rimMesh, rockMesh, emberMesh);
  group.add(rimMesh, poolMesh, rockMesh, emberMesh);
  markBiomeDistanceCull(group, biome);
  context.addBiomeMesh(group);
}
