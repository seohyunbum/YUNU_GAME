import * as THREE from "three";
import { applyStylizedMeshDefaults } from "../visuals";
import type { CombatProjectile, WorldObject } from "./types";

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
  const color = kind === "magic" ? 0x64ffad : kind === "tnt" ? 0xff7a1a : 0xfff1f2;
  const flash = new THREE.Mesh(
    new THREE.RingGeometry(0.1, kind === "magic" ? 0.48 : kind === "tnt" ? 0.72 : 0.34, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.copy(position);
  flash.quaternion.copy(context.camera.quaternion);
  flash.renderOrder = 23;
  context.scene.add(flash);
  context.damageParticles.push({ mesh: flash, velocity: new THREE.Vector3(0, 0.1, 0), life: 0.18, maxLife: 0.18 });
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
  for (let index = 0; index < 3; index += 1) {
    const slash = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.86, 0.035),
      new THREE.MeshBasicMaterial({ color: index === 1 ? 0xfff1a8 : 0xff3b30, transparent: true, opacity: 0.78, depthWrite: false }),
    );
    slash.position
      .copy(context.camera.position)
      .addScaledVector(forward, 0.95)
      .addScaledVector(right, (index - 1) * 0.22)
      .addScaledVector(up, THREE.MathUtils.randFloat(-0.12, 0.24));
    slash.quaternion.copy(context.camera.quaternion);
    slash.rotation.z += -0.72 + index * 0.42;
    slash.renderOrder = 21;
    const velocity = origin.clone().sub(context.playerPosition).setY(0).normalize().multiplyScalar(0.12);
    context.scene.add(slash);
    context.damageParticles.push({ mesh: slash, velocity, life: 0.32, maxLife: 0.32 });
  }
}
