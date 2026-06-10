import * as THREE from "three";
import { WORLD_SIZE } from "./constants";
import { clampPointToRegion, getRegionById, regionAtPosition, type Region } from "./regions";
import type { MonsterId } from "./monsters";
import type { LocationMode, PredatorKind, WorldObject } from "./types";

export interface PredatorAiContext {
  locationMode(): LocationMode;
  playerPosition: THREE.Vector3;
  activeRegions(): readonly Region[];
  predators(): Iterable<WorldObject>;
  predatorAggroRange(kind?: PredatorKind): number;
  predatorStrikeRange(kind?: PredatorKind): number;
  predatorStats(kind?: PredatorKind, monsterId?: MonsterId): { speed: number; cooldown: number; attackDamage: number };
  getGroundHeightAt(x: number, z: number): number;
  refreshSpatialObject(object: WorldObject): void;
  animateWalkCycle(object: WorldObject, delta: number, movementSpeed: number): void;
  damagePlayer(amount: number, showParticles: boolean, deathReason: string): boolean;
}

const nextPosition = new THREE.Vector3();

// 종 특성별 공격 모션 길이 — 무거운 종일수록 길게 (예열이 보여야 회피가 공정하다)
const ATTACK_DURATIONS: Partial<Record<NonNullable<WorldObject["predatorKind"]>, number>> = {
  spider: 520,
  lion: 420,
  wolf: 360,
  boar: 460,
  snake: 500,
  bat: 430,
  scorpion: 560,
  bear: 660,
  zombie: 520,
  ghost: 470,
};

const GHOST_BASE_OPACITY = 0.52;
const ZOMBIE_ARM_REST = -0.08;

function resetAttackExtras(predator: WorldObject) {
  const tail = predator.root.userData.scorpionTail;
  if (tail instanceof THREE.Object3D) tail.rotation.z = 0;
  const arms = predator.root.userData.zombieArms;
  if (Array.isArray(arms)) {
    for (const arm of arms) if (arm instanceof THREE.Object3D) arm.rotation.z = ZOMBIE_ARM_REST;
  }
  const ghostMaterials = predator.root.userData.ghostMaterials;
  if (Array.isArray(ghostMaterials)) {
    for (const material of ghostMaterials) if (material instanceof THREE.MeshStandardMaterial) material.opacity = GHOST_BASE_OPACITY;
  }
}

export function triggerPredatorAttackMotion(predator: WorldObject, now: number) {
  predator.root.userData.attackStartedAt = now;
  predator.root.userData.attackDuration = ATTACK_DURATIONS[predator.predatorKind ?? "wolf"] ?? 360;
  if (!predator.root.userData.baseScale) predator.root.userData.baseScale = predator.root.scale.clone();
}

export function animatePredatorAttackMotion(predator: WorldObject, now: number) {
  const startedAt = Number(predator.root.userData.attackStartedAt ?? 0);
  const duration = Number(predator.root.userData.attackDuration ?? 0);
  const baseScale = predator.root.userData.baseScale instanceof THREE.Vector3 ? predator.root.userData.baseScale : predator.root.scale;
  if (duration <= 0 || now - startedAt >= duration) {
    predator.root.rotation.x = 0;
    predator.root.scale.copy(baseScale);
    resetAttackExtras(predator);
    return;
  }
  const phase = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
  const strike = Math.sin(phase * Math.PI);
  const kind = predator.predatorKind;
  if (kind === "spider") {
    predator.root.rotation.x = -strike * 0.16;
    predator.root.scale.set(baseScale.x * (1 + strike * 0.2), baseScale.y * (1 - strike * 0.1), baseScale.z * (1 + strike * 0.16));
    predator.root.position.y += strike * 0.24;
    return;
  }
  if (kind === "boar") {
    // 돌진 — 머리를 숙이고 몸을 앞으로 쭉 뻗는다
    predator.root.rotation.x = -strike * 0.1;
    predator.root.scale.set(baseScale.x * (1 + strike * 0.34), baseScale.y * (1 - strike * 0.08), baseScale.z);
    return;
  }
  if (kind === "snake") {
    // 전반 움츠림 → 후반 런지
    const lunge = Math.max(0, Math.sin(phase * Math.PI * 2 - Math.PI / 2));
    predator.root.rotation.x = -lunge * 0.2;
    predator.root.scale.set(baseScale.x * (1 - strike * 0.12 + lunge * 0.5), baseScale.y, baseScale.z);
    predator.root.position.y += strike * 0.08;
    return;
  }
  if (kind === "bat") {
    // 급강하 스윕
    predator.root.rotation.x = -strike * 0.4;
    predator.root.position.y -= strike * 0.5;
    return;
  }
  if (kind === "scorpion") {
    // 꼬리를 머리 위로 휘둘러 내려찍는다
    const tail = predator.root.userData.scorpionTail;
    if (tail instanceof THREE.Object3D) tail.rotation.z = -strike * 1.15;
    predator.root.rotation.x = -strike * 0.08;
    return;
  }
  if (kind === "bear") {
    // 일어섰다가 앞발로 내려찍는다
    const rise = Math.sin(Math.min(phase * 1.6, 1) * (Math.PI / 2));
    const slam = phase > 0.62 ? Math.sin(((phase - 0.62) / 0.38) * Math.PI) : 0;
    predator.root.rotation.x = rise * -0.55 + slam * 0.7;
    predator.root.position.y += rise * 0.35;
    predator.root.scale.set(baseScale.x, baseScale.y * (1 + rise * 0.12), baseScale.z);
    return;
  }
  if (kind === "zombie") {
    // 양팔을 들었다가 함께 내려친다
    const bite = Math.sin(phase * Math.PI * 2);
    const arms = predator.root.userData.zombieArms;
    if (Array.isArray(arms)) {
      for (const arm of arms) if (arm instanceof THREE.Object3D) arm.rotation.z = ZOMBIE_ARM_REST - strike * 0.55 + Math.max(0, bite) * 0.45;
    }
    predator.root.rotation.x = -strike * 0.14;
    return;
  }
  if (kind === "ghost") {
    // 반투명해지며 확 들이닥친다
    const ghostMaterials = predator.root.userData.ghostMaterials;
    if (Array.isArray(ghostMaterials)) {
      for (const material of ghostMaterials) if (material instanceof THREE.MeshStandardMaterial) material.opacity = GHOST_BASE_OPACITY - strike * 0.32;
    }
    predator.root.scale.set(baseScale.x * (1 + strike * 0.22), baseScale.y * (1 + strike * 0.22), baseScale.z * (1 + strike * 0.22));
    predator.root.position.y += strike * 0.18;
    return;
  }
  const bite = Math.sin(phase * Math.PI * 2);
  predator.root.rotation.x = -strike * (kind === "lion" ? 0.24 : 0.18);
  predator.root.scale.set(baseScale.x * (1 + strike * 0.16), baseScale.y * (1 - strike * 0.04), baseScale.z * (1 + Math.max(0, bite) * 0.08));
}

export function updatePredatorAi(context: PredatorAiContext, delta: number) {
  if (context.locationMode() !== "overworld") return;
  const now = performance.now();
  for (const predator of context.predators()) {
    const dx = context.playerPosition.x - predator.root.position.x;
    const dz = context.playerPosition.z - predator.root.position.z;
    const distance = Math.hypot(dx, dz);
    const aggroRange = predator.attackRange ?? context.predatorAggroRange(predator.predatorKind);
    const aggroed = distance <= aggroRange || (predator.angryUntil ?? 0) > now;
    if (!aggroed && Math.random() < 0.012) predator.wanderAngle = Math.random() * Math.PI * 2;
    if (!aggroed && distance > aggroRange * 1.8) predator.wanderAngle = (predator.wanderAngle ?? 0) + THREE.MathUtils.randFloatSpread(0.08);
    const angle = aggroed ? Math.atan2(dz, dx) : predator.wanderAngle ?? 0;
    const predatorStats = context.predatorStats(predator.predatorKind, predator.monsterId as MonsterId | undefined);
    const speed = aggroed ? predatorStats.speed : predatorStats.speed * 0.28;
    nextPosition.set(
      THREE.MathUtils.clamp(predator.root.position.x + Math.cos(angle) * speed * delta, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6),
      0,
      THREE.MathUtils.clamp(predator.root.position.z + Math.sin(angle) * speed * delta, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6),
    );
    const region = getRegionById(predator.regionId, context.activeRegions()) ?? regionAtPosition(predator.root.position, context.activeRegions());
    if (region) clampPointToRegion(nextPosition, region);
    nextPosition.y = context.getGroundHeightAt(nextPosition.x, nextPosition.z);
    predator.root.position.copy(nextPosition);
    predator.root.rotation.y = -angle + Math.PI / 2;
    animatePredatorAttackMotion(predator, now);
    context.refreshSpatialObject(predator);
    context.animateWalkCycle(predator, delta, aggroed ? 0.82 : 0.28);
    predator.attackCooldown = Math.max(0, (predator.attackCooldown ?? 0) - delta);
    if (aggroed && distance < context.predatorStrikeRange(predator.predatorKind) && (predator.attackCooldown ?? 0) <= 0) {
      predator.attackCooldown = predatorStats.cooldown;
      triggerPredatorAttackMotion(predator, now);
      context.damagePlayer(predatorStats.attackDamage, true, `${predator.name}에게 공격받아 체력이 모두 떨어졌습니다.`);
    }
  }
}
