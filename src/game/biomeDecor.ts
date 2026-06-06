import * as THREE from "three";
import { gameMaterial } from "../visuals";
import type { BiomeConfig } from "./types";

export interface BiomeDecorContext {
  biomes: BiomeConfig[];
  clearBiomeMeshes(): void;
  addBiomeMesh(object: THREE.Object3D): void;
  randomPointInCircle(center: THREE.Vector3, radius: number): THREE.Vector3;
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
  }
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
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.92);
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
  stemMesh.instanceMatrix.needsUpdate = true;
  jointMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  group.add(stemMesh, jointMesh, leafMesh);
  context.addBiomeMesh(group);
}

function createMushroomBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  for (let i = 0; i < 34; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.86);
    const height = THREE.MathUtils.randFloat(0.7, 2.4);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * height, 0.18 * height, height, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8d2b4, roughness: 0.86 }),
    );
    stem.position.set(point.x, point.y + height / 2, point.z);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * height, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0xb93848 : 0x7b4ab0, roughness: 0.78 }),
    );
    cap.position.set(point.x, point.y + height, point.z);
    group.add(stem, cap);
  }
  context.addBiomeMesh(group);
}

function createSwampBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.72);
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(THREE.MathUtils.randFloat(3.2, 6.8), THREE.MathUtils.randFloat(3.2, 6.8), 0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0x365f62, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.7 }),
    );
    pond.position.set(point.x, point.y + 0.035, point.z);
    group.add(pond);
  }
  for (let i = 0; i < 18; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.88);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, THREE.MathUtils.randFloat(1.2, 2.4), 7),
      new THREE.MeshStandardMaterial({ color: 0x4b3824, roughness: 1 }),
    );
    trunk.position.set(point.x, point.y + 0.8, point.z);
    trunk.rotation.z = THREE.MathUtils.randFloat(-0.28, 0.28);
    group.add(trunk);
  }
  context.addBiomeMesh(group);
}

function createSnowBiome(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  for (let i = 0; i < 34; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.86);
    const height = THREE.MathUtils.randFloat(1.8, 3.5);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, height * 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x5b321f, roughness: 0.9 }),
    );
    trunk.position.set(point.x, point.y + height * 0.3, point.z);
    const snowTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.72, height, 9),
      new THREE.MeshStandardMaterial({ color: 0xe9f5f7, roughness: 0.9 }),
    );
    snowTop.position.set(point.x, point.y + height * 0.78, point.z);
    group.add(trunk, snowTop);
  }
  context.addBiomeMesh(group);
}

function createMountainBiomeDecor(context: BiomeDecorContext, biome: BiomeConfig) {
  const group = new THREE.Group();
  for (let i = 0; i < 28; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.9);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.7, 2.1)),
      new THREE.MeshStandardMaterial({ color: 0x697178, roughness: 1 }),
    );
    rock.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.4, 1.1), point.z);
    rock.scale.y = THREE.MathUtils.randFloat(0.55, 1.25);
    group.add(rock);
  }
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

  for (let i = 0; i < 11; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.82);
    const poolRadius = THREE.MathUtils.randFloat(2.4, 6.8);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(poolRadius, poolRadius * THREE.MathUtils.randFloat(0.72, 1.1), 0.08, 28), lavaMaterial);
    pool.position.set(point.x, point.y + 0.12, point.z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(poolRadius * 1.1, poolRadius * 1.05, 0.12, 28), crustMaterial);
    rim.position.set(point.x, point.y + 0.06, point.z);
    group.add(rim, pool);
  }

  for (let i = 0; i < 46; i += 1) {
    const point = context.randomPointInCircle(biome.center, biome.radius * 0.92);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.45, 1.55)), crustMaterial);
    rock.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.22, 0.85), point.z);
    rock.scale.y = THREE.MathUtils.randFloat(0.45, 1.05);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.05, 0.14), 8, 6), emberMaterial);
    ember.position.set(point.x + THREE.MathUtils.randFloatSpread(0.45), point.y + THREE.MathUtils.randFloat(0.18, 0.75), point.z + THREE.MathUtils.randFloatSpread(0.45));
    group.add(rock, ember);
  }

  context.addBiomeMesh(group);
}
