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

function triggerPredatorAttackMotion(predator: WorldObject, now: number) {
  predator.root.userData.attackStartedAt = now;
  predator.root.userData.attackDuration = predator.predatorKind === "spider" ? 520 : predator.predatorKind === "lion" ? 420 : 360;
  if (!predator.root.userData.baseScale) predator.root.userData.baseScale = predator.root.scale.clone();
}

function animatePredatorAttackMotion(predator: WorldObject, now: number) {
  const startedAt = Number(predator.root.userData.attackStartedAt ?? 0);
  const duration = Number(predator.root.userData.attackDuration ?? 0);
  const baseScale = predator.root.userData.baseScale instanceof THREE.Vector3 ? predator.root.userData.baseScale : predator.root.scale;
  if (duration <= 0 || now - startedAt >= duration) {
    predator.root.rotation.x = 0;
    predator.root.scale.copy(baseScale);
    return;
  }
  const phase = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
  const strike = Math.sin(phase * Math.PI);
  if (predator.predatorKind === "spider") {
    predator.root.rotation.x = -strike * 0.16;
    predator.root.scale.set(baseScale.x * (1 + strike * 0.2), baseScale.y * (1 - strike * 0.1), baseScale.z * (1 + strike * 0.16));
    predator.root.position.y += strike * 0.24;
    return;
  }
  const bite = Math.sin(phase * Math.PI * 2);
  predator.root.rotation.x = -strike * (predator.predatorKind === "lion" ? 0.24 : 0.18);
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
