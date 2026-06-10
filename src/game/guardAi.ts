import * as THREE from "three";
import { PLAYER_RADIUS } from "./constants";
import type { WorldObject } from "./types";

// 마을 수호자(기사·궁수·마법사·골렘) 추격/공격 AI — main.ts updateKnights 에서 추출.
// 수호자 모델(guardVisuals)은 +Z 가 정면이다 (눈이 z=+0.27).
export interface GuardAiContext {
  guards(): Iterable<WorldObject>;
  playerPosition: THREE.Vector3;
  getGroundHeightAt(x: number, z: number): number;
  refreshSpatialObject(object: WorldObject): void;
  runWalkCycle(object: WorldObject, delta: number, speed: number): void;
  damagePlayer(amount: number, showParticles: boolean, deathReason: string): boolean;
  playHandAction(): void;
  showMessage(text: string): void;
  renderHud(): void;
  getLastDamage(): { blocked: boolean; taken: number };
}

function lerpAngle(current: number, target: number, alpha: number) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * alpha;
}

export function updateVillageGuards(context: GuardAiContext, delta: number) {
  const now = performance.now();
  for (const guard of context.guards()) {
    if (!guard.angryUntil || guard.angryUntil < now) continue;
    const mode = guard.guardMode ?? "melee";
    const range = guard.attackRange ?? (mode === "ranged" ? 18 : 2.05);
    const damage = guard.attackDamage ?? (guard.type === "villageMage" ? 2 : guard.type === "villageGolem" ? 9 : 1);
    const dx = context.playerPosition.x - guard.root.position.x;
    const dz = context.playerPosition.z - guard.root.position.z;
    const centerDistance = Math.hypot(dx, dz);
    const attackDistance =
      mode === "melee"
        ? Math.max(0, centerDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
        : centerDistance;
    let movementSpeed = 0;
    if (mode === "melee" && attackDistance > range) {
      if (centerDistance > 0.01) {
        const chaseSpeed = guard.type === "villageGolem" ? 1.85 : 2.4;
        const step = Math.min(attackDistance - range, chaseSpeed * delta);
        guard.root.position.x += (dx / centerDistance) * step;
        guard.root.position.z += (dz / centerDistance) * step;
        guard.root.position.y = context.getGroundHeightAt(guard.root.position.x, guard.root.position.z);
        context.refreshSpatialObject(guard);
        movementSpeed = step / Math.max(delta, 0.001);
      }
    }
    // 추격·공격 중에는 플레이어를 정면으로 바라본다 (+Z 정면 모델 → atan2(dx, dz))
    if (centerDistance > 0.01) guard.root.rotation.y = lerpAngle(guard.root.rotation.y, Math.atan2(dx, dz), Math.min(1, delta * 10));
    context.runWalkCycle(guard, delta, movementSpeed);

    guard.attackCooldown = Math.max(0, (guard.attackCooldown ?? 0) - delta);
    if (guard.attackCooldown > 0) continue;
    const currentCenterDistance = Math.hypot(context.playerPosition.x - guard.root.position.x, context.playerPosition.z - guard.root.position.z);
    const currentAttackDistance =
      mode === "melee"
        ? Math.max(0, currentCenterDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
        : currentCenterDistance;
    if (currentAttackDistance > range) continue;
    guard.attackCooldown = guard.attackInterval ?? (mode === "ranged" ? 1.8 : 1.2);
    const died = context.damagePlayer(
      damage,
      true,
      `${guard.name}의 ${mode === "ranged" ? "원거리 공격" : "근거리 공격"}을 받아 체력이 모두 떨어졌습니다.`,
    );
    context.playHandAction();
    if (died) continue;
    const lastDamage = context.getLastDamage();
    const attackText = lastDamage.blocked
      ? `${guard.name}의 공격을 방어구가 완전히 막았습니다.`
      : mode === "ranged"
        ? `${guard.name}의 원거리 공격을 받았습니다. 피해 ${lastDamage.taken}.`
        : `${guard.name}가 가까이 붙어 공격했습니다. 피해 ${lastDamage.taken}.`;
    context.showMessage(attackText);
    context.renderHud();
  }
}
