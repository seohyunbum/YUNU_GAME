import * as THREE from "three";
import { applyStylizedMeshDefaults } from "../visuals";
import type { CombatProjectile, PlayerClassId, WorldObject } from "./types";

export interface CombatEffectParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface CombatEffectContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  playerPosition: THREE.Vector3;
  damageParticles: CombatEffectParticle[];
  getGroundHeightAt(x: number, z: number): number;
}

let slashTrailTexture: THREE.Texture | null = null;

export function createArrowProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const shaftMaterial = new THREE.MeshStandardMaterial({ color: 0xd7b98d, roughness: 0.55 });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.48, roughness: 0.34 });
  const featherMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.92 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.84, 8), shaftMaterial);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.16, 12), metalMaterial);
  tip.position.y = 0.5;
  const featherA = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.018), featherMaterial);
  featherA.position.set(0.05, -0.42, 0);
  featherA.rotation.z = 0.28;
  const featherB = featherA.clone();
  featherB.position.x = -0.05;
  featherB.rotation.z = -0.28;
  group.add(shaft, tip, featherA, featherB);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  applyStylizedMeshDefaults(group, { castShadow: true, receiveShadow: false });
  return group;
}

export function createMagicProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0x42ff9b, transparent: true, opacity: 0.92, depthWrite: false }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7dffbf,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.018, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xc4ffe3, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
  group.add(glow, core, ring);
  return group;
}

// 파이어볼 전용 — 백황색 핵 + 주황/적색 불꽃 글로우 + 진행 반대쪽으로 늘어지는 혜성 꼬리.
// (마법 지팡이의 createMagicProjectile 과 분리 — 지팡이는 기존 녹색 마법 그대로 유지)
export function createFireballProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff2c2, transparent: true, opacity: 0.97, depthWrite: false }),
  );
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const outer = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3411, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(outer, inner, core);
  // 혜성 꼬리 — 진행 반대(로컬 +z)로 늘어지는 콘 2겹(주황/노랑)
  const tails: [number, number, number, number][] = [[0.38, 1.7, 0xff7a1a, 0.34], [0.22, 1.15, 0xffc24a, 0.42]];
  for (const [tipR, len, tc, op] of tails) {
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(tipR, len, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    tail.rotation.x = Math.PI / 2; // 콘 축을 z 로 (apex → +z = 뒤)
    tail.position.z = len / 2; // base 는 오브, apex 는 뒤로
    group.add(tail);
  }
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize()); // 로컬 -z = 진행, +z = 뒤
  return group;
}

export function createWindCutterProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.026, 8, 42, Math.PI * 1.28),
    new THREE.MeshBasicMaterial({
      color: 0xdffcff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 8, 42, Math.PI * 1.18),
    new THREE.MeshBasicMaterial({
      color: 0x8eefff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  blade.rotation.z = Math.PI * 0.12;
  glow.rotation.z = Math.PI * 0.12;
  group.add(glow, blade);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());
  return group;
}

export function createTntProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.58 }),
  );
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.1, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
  );
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.78 }),
  );
  fuse.position.y = 0.34;
  fuse.rotation.z = 0.38;
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff3a1, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  spark.position.set(0.08, 0.48, 0);
  group.add(body, band, fuse, spark);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());
  applyStylizedMeshDefaults(group, { castShadow: true, receiveShadow: false });
  return group;
}

export function spawnExplosionVisual(context: CombatEffectContext, position: THREE.Vector3, radius: number) {
  const colorSet = [0xfff3a1, 0xff7a1a, 0xdc2626, 0xf97316];
  for (let index = 0; index < 38; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: colorSet[index % colorSet.length],
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.62, 0.94),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.06, 0.16), 8, 6), material);
    const angle = Math.random() * Math.PI * 2;
    const spread = THREE.MathUtils.randFloat(0.1, radius * 0.75);
    particle.position.copy(position).add(new THREE.Vector3(Math.cos(angle) * spread, THREE.MathUtils.randFloat(0.2, 1.7), Math.sin(angle) * spread));
    particle.renderOrder = 24;
    const velocity = new THREE.Vector3(Math.cos(angle) * THREE.MathUtils.randFloat(0.6, 1.8), THREE.MathUtils.randFloat(0.5, 2.2), Math.sin(angle) * THREE.MathUtils.randFloat(0.6, 1.8));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: THREE.MathUtils.randFloat(0.42, 0.78), maxLife: 0.78 });
  }
  const flash = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.12, radius, 42),
    new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.copy(position).setY(position.y + 0.04);
  flash.rotation.x = -Math.PI / 2;
  flash.renderOrder = 24;
  context.scene.add(flash);
  context.damageParticles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0.08, 0), life: 0.34, maxLife: 0.34 });
}

// 엔딩 폭죽 — 하늘에서 사방으로 퍼지는 발광 파티클 구체 + 중심 섬광
export function spawnFireworkBurst(context: CombatEffectContext, position: THREE.Vector3, colors: readonly number[]) {
  for (let index = 0; index < 30; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: colors[index % colors.length],
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.7, 0.96),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particle = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.09, 0.2), 8, 6), material);
    particle.position.copy(position);
    particle.renderOrder = 24;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));
    const speed = THREE.MathUtils.randFloat(2.4, 4.6);
    const velocity = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.cos(phi) * speed * 0.8 + 0.4,
      Math.sin(phi) * Math.sin(theta) * speed,
    );
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: THREE.MathUtils.randFloat(0.9, 1.5), maxLife: 1.5 });
  }
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  flash.position.copy(position);
  flash.renderOrder = 24;
  context.scene.add(flash);
  context.damageParticles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0.4, 0), life: 0.28, maxLife: 0.28 });
}

export function spawnTntTrail(context: CombatEffectContext, position: THREE.Vector3) {
  if (Math.random() > 0.72) return;
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.035, 0.085), 8, 6),
    new THREE.MeshBasicMaterial({ color: Math.random() > 0.45 ? 0xfff3a1 : 0xff7a1a, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  particle.position.copy(position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.16), THREE.MathUtils.randFloatSpread(0.16), THREE.MathUtils.randFloatSpread(0.16)));
  particle.renderOrder = 18;
  context.scene.add(particle);
  context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(0, -0.03, 0), life: 0.22, maxLife: 0.22 });
}

export function spawnMeleeSlashTrail(context: CombatEffectContext) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion).normalize();
  const slash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.38),
    new THREE.MeshBasicMaterial({
      map: getSlashTrailTexture(),
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  slash.position
    .copy(context.camera.position)
    .addScaledVector(forward, 0.95)
    .addScaledVector(right, 0.15)
    .addScaledVector(up, -0.08);
  slash.quaternion.copy(context.camera.quaternion);
  slash.rotation.z += THREE.MathUtils.randFloat(-0.32, 0.32);
  slash.renderOrder = 24;
  context.scene.add(slash);
  context.damageParticles.push({ mesh: slash, velocity: forward.multiplyScalar(0.32), life: 0.2, maxLife: 0.2 });
}

function getSlashTrailTexture() {
  if (slashTrailTexture) return slashTrailTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(24, 48, 238, 48);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.92)");
    gradient.addColorStop(0.68, "rgba(195,225,255,0.62)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, 70);
    ctx.quadraticCurveTo(120, 8, 238, 36);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.48)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(42, 78);
    ctx.quadraticCurveTo(138, 28, 218, 50);
    ctx.stroke();
  }
  slashTrailTexture = new THREE.CanvasTexture(canvas);
  slashTrailTexture.needsUpdate = true;
  return slashTrailTexture;
}

export function spawnEnemyHitParticles(context: CombatEffectContext, target: WorldObject, hitPosition?: THREE.Vector3) {
  const base = hitPosition?.clone() ?? target.root.position.clone();
  if (!hitPosition) {
    const toPlayer = context.playerPosition.clone().sub(target.root.position).setY(0);
    if (toPlayer.lengthSq() > 0.001) {
      toPlayer.normalize();
      base.addScaledVector(toPlayer, Math.max(0.35, target.collisionRadius ?? 0.6));
    }
    base.y += target.type === "dragon" ? Math.min((target.collisionHeight ?? 5.4) * 0.42, 3.4) : target.type === "villageGolem" ? 1.55 : 1.0;
  }
  for (let i = 0; i < 26; i += 1) {
    const color = i % 4 === 0 ? 0xfff1f2 : i % 3 === 0 ? 0xff7a1f : 0xef233c;
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.035, 0.09), 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: THREE.MathUtils.randFloat(0.72, 0.96), depthWrite: false }),
    );
    particle.position
      .copy(base)
      .add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.35), THREE.MathUtils.randFloatSpread(0.28), THREE.MathUtils.randFloatSpread(0.35)));
    particle.renderOrder = 23;
    const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.2), THREE.MathUtils.randFloat(0.35, 1.25), THREE.MathUtils.randFloatSpread(1.2));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: THREE.MathUtils.randFloat(0.34, 0.58), maxLife: 0.58 });
  }
}

export function spawnProjectileImpact(context: CombatEffectContext, position: THREE.Vector3, kind: CombatProjectile["kind"]) {
  const color = kind === "magic" ? 0x64ffad : kind === "tnt" ? 0xff7a1a : kind === "wind" ? 0xcffafe : 0xfff1f2;
  const flash = new THREE.Mesh(
    new THREE.RingGeometry(0.1, kind === "magic" ? 0.48 : kind === "tnt" ? 0.72 : kind === "wind" ? 0.58 : 0.34, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.copy(position);
  flash.quaternion.copy(context.camera.quaternion);
  flash.renderOrder = 23;
  context.scene.add(flash);
  context.damageParticles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0.1, 0), life: 0.18, maxLife: 0.18 });
}

export function spawnWindCutterTrail(context: CombatEffectContext, position: THREE.Vector3) {
  if (Math.random() > 0.68) return;
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.025, 0.06), 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xcffafe, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  particle.position.copy(position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.24), THREE.MathUtils.randFloatSpread(0.12), THREE.MathUtils.randFloatSpread(0.24)));
  particle.renderOrder = 18;
  context.scene.add(particle);
  context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(0, 0.07, 0), life: 0.22, maxLife: 0.22 });
}

export function spawnMagicTrail(context: CombatEffectContext, position: THREE.Vector3) {
  if (Math.random() > 0.62) return;
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.035, 0.075), 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x86ffc2, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  particle.position.copy(position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.18), THREE.MathUtils.randFloatSpread(0.18), THREE.MathUtils.randFloatSpread(0.18)));
  particle.renderOrder = 18;
  context.scene.add(particle);
  context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(0, 0.06, 0), life: 0.24, maxLife: 0.24 });
}

export function spawnDamageParticles(context: CombatEffectContext) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion);
  for (let i = 0; i < 22; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff1f35,
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.65, 0.95),
      depthTest: false,
    });
    const particle = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.025, 0.06), 8, 6), material);
    particle.position
      .copy(context.camera.position)
      .addScaledVector(forward, THREE.MathUtils.randFloat(0.7, 1.15))
      .addScaledVector(right, THREE.MathUtils.randFloatSpread(0.85))
      .addScaledVector(up, THREE.MathUtils.randFloatSpread(0.55));
    particle.renderOrder = 20;
    const velocity = right
      .clone()
      .multiplyScalar(THREE.MathUtils.randFloatSpread(0.95))
      .addScaledVector(up, THREE.MathUtils.randFloatSpread(0.7))
      .addScaledVector(forward, THREE.MathUtils.randFloat(0.25, 0.75));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: 0.48, maxLife: 0.48 });
  }
}

// 레벨업 축하 — 발밑에서 금빛 링+상승 스파크.
export function celebrationBurst(context: CombatEffectContext) {
  const base = context.playerPosition.clone();
  base.y = context.getGroundHeightAt(base.x, base.z) + 0.1;
  for (let ringIndex = 0; ringIndex < 2; ringIndex += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.76 + ringIndex * 0.42, 0.05, 10, 56),
      new THREE.MeshBasicMaterial({ color: ringIndex === 0 ? 0xffe066 : 0x9fe8ff, transparent: true, opacity: ringIndex === 0 ? 0.98 : 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(base).add(new THREE.Vector3(0, ringIndex * 0.16, 0));
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 26;
    context.scene.add(ring);
    context.damageParticles.push({ mesh: ring, velocity: new THREE.Vector3(0, 1.45 + ringIndex * 0.45, 0), life: 0.9 + ringIndex * 0.18, maxLife: 0.9 + ringIndex * 0.18 });
  }
  for (let i = 0; i < 54; i += 1) {
    const color = i % 5 === 0 ? 0x9fe8ff : i % 2 === 0 ? 0xffe066 : 0xfff7cc;
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.045, 0.12), 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    particle.position.copy(base).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.15), THREE.MathUtils.randFloat(0, 0.55), THREE.MathUtils.randFloatSpread(1.15)));
    particle.renderOrder = 26;
    const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.7), THREE.MathUtils.randFloat(2.7, 4.8), THREE.MathUtils.randFloatSpread(1.7));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: 1.15, maxLife: 1.15 });
  }
}

// 희귀 드랍 — 카메라 앞에 반짝이는 별 파티클.
export function sparkleBurst(context: CombatEffectContext, epic = false) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion);
  const color = epic ? 0xffd34d : 0x9fe8ff;
  const count = epic ? 26 : 16;
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.OctahedronGeometry(THREE.MathUtils.randFloat(0.03, 0.07)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    particle.position
      .copy(context.camera.position)
      .addScaledVector(forward, THREE.MathUtils.randFloat(1.0, 1.6))
      .addScaledVector(right, THREE.MathUtils.randFloatSpread(1.0))
      .addScaledVector(up, THREE.MathUtils.randFloatSpread(0.7));
    particle.renderOrder = 26;
    const velocity = new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.9), THREE.MathUtils.randFloat(0.4, 1.4), THREE.MathUtils.randFloatSpread(0.9));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: 0.8, maxLife: 0.8 });
  }
}

export function spawnDragonFireBurst(context: CombatEffectContext, position: THREE.Vector3) {
  const center = position.clone();
  center.y = context.getGroundHeightAt(center.x, center.z) + 1.35;
  for (let index = 0; index < 34; index += 1) {
    const color = index % 3 === 0 ? 0xfff3a1 : index % 3 === 1 ? 0xff6b1a : 0xdc2626;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.62, 0.92),
      depthWrite: false,
    });
    const particle = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.045, 0.14), 8, 6), material);
    particle.position
      .copy(center)
      .add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.25), THREE.MathUtils.randFloat(0.4, 2.2), THREE.MathUtils.randFloatSpread(1.25)));
    particle.renderOrder = 19;
    const velocity = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.8),
      THREE.MathUtils.randFloat(-1.3, -0.35),
      THREE.MathUtils.randFloatSpread(0.8),
    );
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: 0.78, maxLife: 0.78 });
  }
}

export function spawnDragonClawBurst(context: CombatEffectContext, origin: THREE.Vector3) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion);
  // 화면 가득 크게 베는 5줄 + 길고 오래 — 근접에서도 "보스가 할퀴었다"가 또렷하게 보이도록
  for (let index = 0; index < 5; index += 1) {
    const slash = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 1.5, 0.05),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xff3b30 : 0xfff1a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    slash.position
      .copy(context.camera.position)
      .addScaledVector(forward, 0.85)
      .addScaledVector(right, (index - 2) * 0.26)
      .addScaledVector(up, THREE.MathUtils.randFloat(-0.2, 0.32));
    slash.quaternion.copy(context.camera.quaternion);
    slash.rotation.z += -0.85 + index * 0.34;
    slash.renderOrder = 21;
    const velocity = origin.clone().sub(context.playerPosition).setY(0).normalize().multiplyScalar(0.1);
    context.scene.add(slash);
    context.damageParticles.push({ mesh: slash, velocity, life: 0.5, maxLife: 0.5 });
  }
}

// 보스 종류별 브레스 색 — 속성에 맞춰 멀리서도 한눈에 보이게.
const BOSS_BREATH_COLORS: Record<string, readonly number[]> = {
  dragon: [0xff8a1f, 0xffd24a, 0xdc2626],
  fire_dragon: [0xff5a1f, 0xff8a1f, 0xfff1a8],
  red_dragon: [0xff2d2d, 0xb91c1c, 0xff8a8a],
  laser_dragon: [0x38bdf8, 0x7c3aed, 0xe0f2fe],
  dark_dragon: [0x9b5cff, 0x4c1d95, 0xc4b5fd],
  immortal: [0xfff7cc, 0xffd24a, 0xffffff],
};
export function bossBreathColors(kind?: string): readonly number[] {
  return BOSS_BREATH_COLORS[kind ?? "dragon"] ?? BOSS_BREATH_COLORS.dragon;
}

// 보스 속성 브레스 — source(주둥이)에서 target(플레이어)로 쏟아지는 원뿔형 발광 스트림. colors 로 속성 색 지정.
export function spawnBossBreathStream(context: CombatEffectContext, source: THREE.Vector3, target: THREE.Vector3, colors: readonly number[]) {
  const dir = target.clone().sub(source);
  const dist = Math.max(0.5, dir.length());
  dir.normalize();
  for (let i = 0; i < 42; i += 1) {
    const t = i / 42;
    const spread = 0.2 + t * 1.1; // 끝으로 갈수록 퍼지는 원뿔
    const at = source.clone().addScaledVector(dir, t * dist).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(spread), THREE.MathUtils.randFloatSpread(spread * 0.7), THREE.MathUtils.randFloatSpread(spread)));
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.1, 0.27), 8, 6),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: THREE.MathUtils.randFloat(0.6, 0.95), blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    particle.position.copy(at);
    particle.renderOrder = 22;
    const velocity = dir.clone().multiplyScalar(THREE.MathUtils.randFloat(4, 8.5)).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.3), THREE.MathUtils.randFloatSpread(0.9), THREE.MathUtils.randFloatSpread(1.3)));
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity, life: THREE.MathUtils.randFloat(0.34, 0.66), maxLife: 0.66 });
  }
}

// 지면 충격파 — 바닥 확장 링 2겹(스케일 불가라 큰 반경+페이드) + 사방으로 튀는 흙/돌. 보스 강타·궁극기 임팩트용.
export function spawnGroundShockwave(context: CombatEffectContext, center: THREE.Vector3, color: number) {
  const base = center.clone();
  base.y = context.getGroundHeightAt(base.x, base.z) + 0.05;
  for (let i = 0; i < 2; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2 + i * 1.1, 3.3 + i * 1.1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 - i * 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.copy(base);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 24;
    context.scene.add(ring);
    context.damageParticles.push({ mesh: ring, velocity: new THREE.Vector3(0, 0.05, 0), life: 0.42 + i * 0.1, maxLife: 0.55 });
  }
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.22;
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.06, 0.16), 7, 5),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? color : 0x8a6a45, transparent: true, opacity: 0.86, depthWrite: false }),
    );
    particle.position.copy(base).add(new THREE.Vector3(Math.cos(angle) * 0.6, 0.15, Math.sin(angle) * 0.6));
    particle.renderOrder = 23;
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(Math.cos(angle) * THREE.MathUtils.randFloat(2.4, 4.4), THREE.MathUtils.randFloat(1.2, 2.8), Math.sin(angle) * THREE.MathUtils.randFloat(2.4, 4.4)), life: 0.5, maxLife: 0.5 });
  }
}

// 포효/충전 — 공격 예열(텔레그래프) 시 발밑에서 솟구치는 발광 입자.
export function spawnBossRoar(context: CombatEffectContext, position: THREE.Vector3, color: number) {
  for (let i = 0; i < 20; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.06, 0.15), 7, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    particle.position.copy(position).add(new THREE.Vector3(Math.cos(angle) * 0.5, THREE.MathUtils.randFloat(0, 1.4), Math.sin(angle) * 0.5));
    particle.renderOrder = 22;
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(Math.cos(angle) * 1.6, THREE.MathUtils.randFloat(0.6, 2), Math.sin(angle) * 1.6), life: 0.5, maxLife: 0.5 });
  }
}

// ── 직업별 스킬 시전 임팩트 ───────────────────────────────────────────────
// 스킬을 쓰는 순간 직업 특성을 살린 캐스팅 연출을 분출한다(마법사=눈앞 마법진 등).
// 모든 메시는 기존 damageParticles 페이드 시스템에 올려 수명 뒤 자동 정리된다.
// (event-driven — update*/animate* 핫패스가 아니라 시전 시점에만 호출.)
function pushFade(context: CombatEffectContext, mesh: THREE.Mesh, velocity: THREE.Vector3, life: number, renderOrder = 25) {
  mesh.renderOrder = renderOrder;
  context.scene.add(mesh);
  context.damageParticles.push({ mesh, velocity, life, maxLife: life });
}

function flatForward(context: CombatEffectContext) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion);
  forward.y = 0;
  if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
  return forward.normalize();
}

function groundPointInFront(context: CombatEffectContext, distance: number) {
  const point = context.playerPosition.clone().addScaledVector(flatForward(context), distance);
  point.y = context.getGroundHeightAt(point.x, point.z) + 0.06;
  return point;
}

// 마법진 — 바닥에 깔리는 발광 디스크 + 2겹 룬 링 + 방사형 눈금 + 솟구치는 룬 입자.
export function spawnMagicCircle(context: CombatEffectContext, center: THREE.Vector3, innerColor: number, runeColor: number, radius = 1.5) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 36),
    new THREE.MeshBasicMaterial({ color: innerColor, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.position.copy(center);
  disc.rotation.x = -Math.PI / 2;
  pushFade(context, disc, new THREE.Vector3(0, 0.02, 0), 0.55);
  for (let i = 0; i < 2; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * (0.62 + i * 0.38), 0.04, 8, 52),
      new THREE.MeshBasicMaterial({ color: runeColor, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(center).add(new THREE.Vector3(0, 0.02 + i * 0.01, 0));
    ring.rotation.x = Math.PI / 2;
    pushFade(context, ring, new THREE.Vector3(0, 0.02, 0), 0.62 + i * 0.06);
  }
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.02, 0.3),
      new THREE.MeshBasicMaterial({ color: runeColor, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    tick.position.copy(center).add(new THREE.Vector3(Math.cos(angle) * radius * 0.82, 0.03, Math.sin(angle) * radius * 0.82));
    tick.rotation.y = -angle;
    pushFade(context, tick, new THREE.Vector3(0, 0.05, 0), 0.55);
  }
  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * Math.sqrt(Math.random());
    const mote = new THREE.Mesh(
      new THREE.OctahedronGeometry(THREE.MathUtils.randFloat(0.04, 0.09)),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? innerColor : runeColor, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mote.position.copy(center).add(new THREE.Vector3(Math.cos(angle) * r, 0.05, Math.sin(angle) * r));
    pushFade(context, mote, new THREE.Vector3(0, THREE.MathUtils.randFloat(1.6, 3.2), 0), THREE.MathUtils.randFloat(0.5, 0.85));
  }
}

// 카메라 앞 발광 링 + 전방으로 쏘는 스파크 — 거너 머즐 플래시/사격 임팩트.
function spawnMuzzleFlash(context: CombatEffectContext, color: number) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion);
  const origin = context.camera.position.clone().addScaledVector(forward, 1.0).addScaledVector(right, 0.16).addScaledVector(up, -0.12);
  const flash = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.34, 22),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.copy(origin);
  flash.quaternion.copy(context.camera.quaternion);
  pushFade(context, flash, forward.clone().multiplyScalar(0.4), 0.16);
  for (let i = 0; i < 12; i += 1) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.025, 0.06), 7, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? color : 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    spark.position.copy(origin);
    const velocity = forward.clone().multiplyScalar(THREE.MathUtils.randFloat(6, 12))
      .addScaledVector(right, THREE.MathUtils.randFloatSpread(2.4))
      .addScaledVector(up, THREE.MathUtils.randFloatSpread(1.8));
    pushFade(context, spark, velocity, THREE.MathUtils.randFloat(0.12, 0.26));
  }
}

// 머리 위 후광 링 + 내려앉는 빛 입자 — 힐러 신성 캐스팅.
function spawnHolyHalo(context: CombatEffectContext, color: number) {
  const center = context.playerPosition.clone().setY(context.playerPosition.y + 0.9);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 10, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.copy(center);
  halo.rotation.x = Math.PI / 2;
  pushFade(context, halo, new THREE.Vector3(0, 0.55, 0), 0.7);
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.04, 0.08), 8, 6),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mote.position.copy(center).add(new THREE.Vector3(Math.cos(angle) * 0.7, THREE.MathUtils.randFloat(0.4, 1.2), Math.sin(angle) * 0.7));
    pushFade(context, mote, new THREE.Vector3(0, THREE.MathUtils.randFloat(-1.4, -0.6), 0), THREE.MathUtils.randFloat(0.5, 0.8));
  }
}

// 발밑 회오리 링 + 솟구치는 깃털 — 소환사 빙의 캐스팅.
function spawnWindSummon(context: CombatEffectContext, color: number) {
  const base = context.playerPosition.clone();
  base.y = context.getGroundHeightAt(base.x, base.z) + 0.1;
  for (let i = 0; i < 2; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7 + i * 0.5, 0.035, 8, 44),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 - i * 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(base).add(new THREE.Vector3(0, 0.05 + i * 0.05, 0));
    ring.rotation.x = Math.PI / 2;
    pushFade(context, ring, new THREE.Vector3(0, 1.0 + i * 0.4, 0), 0.6 + i * 0.08);
  }
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const feather = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.02, 0.18),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? color : 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    feather.position.copy(base).add(new THREE.Vector3(Math.cos(angle) * 0.8, 0.2, Math.sin(angle) * 0.8));
    feather.rotation.y = -angle;
    const swirl = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(2.2);
    swirl.y = THREE.MathUtils.randFloat(2.2, 4.0);
    pushFade(context, feather, swirl, THREE.MathUtils.randFloat(0.5, 0.85));
  }
}

// 플레이어를 감싸는 6각 강철 방벽 + 발밑 링 — 탱커 철벽 캐스팅.
function spawnIronBarrier(context: CombatEffectContext, color: number) {
  const base = context.playerPosition.clone();
  base.y = context.getGroundHeightAt(base.x, base.z) + 0.05;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.06, 10, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.position.copy(base).add(new THREE.Vector3(0, 0.08, 0));
  ring.rotation.x = Math.PI / 2;
  pushFade(context, ring, new THREE.Vector3(0, 0.2, 0), 0.6);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.2, 0.08),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? color : 0xcfd8e3, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    plate.position.copy(base).add(new THREE.Vector3(Math.cos(angle) * 1.25, 1.0, Math.sin(angle) * 1.25));
    plate.rotation.y = -angle + Math.PI / 2;
    pushFade(context, plate, new THREE.Vector3(0, 0.35, 0), 0.65);
  }
}

// 직업별 캐스팅 임팩트 디스패치 — 1차/2차 스킬 시전 시 호출.
export function spawnSkillCastImpact(context: CombatEffectContext, classId: PlayerClassId) {
  switch (classId) {
    case "mage":
      spawnMagicCircle(context, groundPointInFront(context, 2.6), 0x7c5bff, 0x5eead4, 1.65);
      break;
    case "warrior": {
      const feet = context.playerPosition.clone();
      feet.y = context.getGroundHeightAt(feet.x, feet.z) + 0.05;
      spawnGroundShockwave(context, feet, 0xff5a2a);
      spawnBossRoar(context, feet, 0xffae42);
      break;
    }
    case "gunner":
      spawnMuzzleFlash(context, 0xfff0a3);
      break;
    case "healer":
      spawnHolyHalo(context, 0xffe9a3);
      break;
    case "summoner":
      spawnWindSummon(context, 0xdffcff);
      break;
    case "tanker":
      spawnIronBarrier(context, 0x9fb4c9);
      break;
  }
}

// 치유 연출 — main.ts 에서 이동. 회복 링 + 떠오르는 입자
export function spawnHealEffect(context: CombatEffectContext, position: THREE.Vector3) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.035, 10, 42),
    new THREE.MeshBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.position.copy(position).setY(position.y - 1.7 + 0.08);
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 24;
  context.scene.add(ring);
  context.damageParticles.push({ mesh: ring, velocity: new THREE.Vector3(0, 0.18, 0), life: 0.55, maxLife: 0.55 });
  for (let index = 0; index < 20; index += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.035, 0.075), 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    particle.position.copy(position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.7), THREE.MathUtils.randFloat(-1.1, 0.35), THREE.MathUtils.randFloatSpread(0.7)));
    particle.renderOrder = 24;
    context.scene.add(particle);
    context.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.25), THREE.MathUtils.randFloat(0.65, 1.35), THREE.MathUtils.randFloatSpread(0.25)), life: 0.62, maxLife: 0.62 });
  }
}

// 메테오 운석 — 용암 균열이 빛나는 검은 암석 + 2겹 화염 글로우 + 진행 반대로 늘어지는 불꼬리.
// 파이어볼(구체)과 확실히 달라 보이게 불규칙 암석 + 큰 화염 꼬리. main.fireMeteor 가 하늘에서 떨어뜨린다.
export function createMeteorProjectile(direction: THREE.Vector3) {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.52, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a1206, emissive: 0xff4d12, emissiveIntensity: 0.95, roughness: 1, metalness: 0.1, flatShading: true }),
  );
  rock.scale.set(1, 0.92, 1.08);
  const innerFlame = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }));
  const outerFlame = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff2a08, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(outerFlame, innerFlame, rock);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.52, 2.8, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb43a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  tail.rotation.x = Math.PI / 2; tail.position.z = 1.4; // 로컬 +z = 진행 반대(꼬리)
  group.add(tail);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().normalize());
  return group;
}

// 치유의 비 지속 연출 — 회복 틱마다 호출. 반경에 떨어지는 청록 빗방울 + 발밑 회복 물결 링.
export function spawnHealingRain(context: CombatEffectContext, position: THREE.Vector3) {
  const groundY = position.y - 1.7; // playerPosition.y 는 눈높이 → 발밑 기준
  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 3.2;
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.03, 0.06), 6, 5),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xa7f3d0 : 0x7dd3fc, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    drop.position.set(position.x + Math.cos(angle) * r, groundY + THREE.MathUtils.randFloat(2.4, 4.4), position.z + Math.sin(angle) * r);
    pushFade(context, drop, new THREE.Vector3(0, THREE.MathUtils.randFloat(-5.6, -3.8), 0), THREE.MathUtils.randFloat(0.55, 0.85));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.set(position.x, groundY + 0.08, position.z); ring.rotation.x = Math.PI / 2;
  pushFade(context, ring, new THREE.Vector3(0, 0.1, 0), 0.6);
}

// 정령 폭풍 — 플레이어 주변 회오리. 솟구치는 바람 링 + 나선으로 도는 바람칼.
export function spawnSpiritStorm(context: CombatEffectContext, center: THREE.Vector3, radius: number) {
  const base = center.clone(); base.y = context.getGroundHeightAt(base.x, base.z) + 0.1;
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * (0.5 + i * 0.28), 0.05, 8, 44), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xdffcff : 0x8eefff, transparent: true, opacity: 0.7 - i * 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.copy(base).add(new THREE.Vector3(0, 0.1 + i * 0.18, 0)); ring.rotation.x = Math.PI / 2;
    pushFade(context, ring, new THREE.Vector3(0, 1.4 + i * 0.5, 0), 0.6 + i * 0.08);
  }
  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2;
    const r = radius * THREE.MathUtils.randFloat(0.4, 1.0);
    const cutter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.26), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xffffff : 0x8eefff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    cutter.position.copy(base).add(new THREE.Vector3(Math.cos(angle) * r, THREE.MathUtils.randFloat(0.3, 1.6), Math.sin(angle) * r));
    cutter.rotation.y = -angle;
    const swirl = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(3.0); swirl.y = THREE.MathUtils.randFloat(1.8, 3.6);
    pushFade(context, cutter, swirl, THREE.MathUtils.randFloat(0.5, 0.85));
  }
}
