import * as THREE from "three";
import { PLAYER_RADIUS } from "./constants";
import { partyDamageRemotePlayer, partyHostCombatTargets } from "./partyWorldSync";
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
  keepOutOfBuildings(position: THREE.Vector3): void;
  throwRock(fromX: number, fromY: number, fromZ: number, targetX: number, targetZ: number, damage: number): void; // 골렘 바위 던지기
}

function lerpAngle(current: number, target: number, alpha: number) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * alpha;
}

export function updateVillageGuards(context: GuardAiContext, delta: number) {
  const now = performance.now();
  let partyTargets: ReturnType<typeof partyHostCombatTargets> | null = null; // 각성 경비가 있을 때만 1회 조회 (평소 할당 0)
  for (const guard of context.guards()) {
    if (!guard.angryUntil || guard.angryUntil < now) continue;
    if (partyTargets === null) partyTargets = partyHostCombatTargets(); // 호스트: 같은 맵 게스트도 추격/공격 대상
    const mode = guard.guardMode ?? "melee";
    const range = guard.attackRange ?? (mode === "ranged" ? 18 : 2.05);
    const damage = guard.attackDamage ?? (guard.type === "villageMage" ? 2 : guard.type === "villageGolem" ? 9 : 1);
    // 가장 가까운 대상(로컬 플레이어 + 같은 맵 파티원)을 노린다
    let targetX = context.playerPosition.x;
    let targetZ = context.playerPosition.z;
    let remoteTarget: string | null = null;
    let remotePanelOpen = false;
    let bestSq = (targetX - guard.root.position.x) ** 2 + (targetZ - guard.root.position.z) ** 2;
    for (const candidate of partyTargets) {
      const candSq = (candidate.x - guard.root.position.x) ** 2 + (candidate.z - guard.root.position.z) ** 2;
      if (candSq < bestSq) {
        bestSq = candSq;
        targetX = candidate.x;
        targetZ = candidate.z;
        remoteTarget = candidate.nickname;
        remotePanelOpen = candidate.panelOpen;
      }
    }
    const dx = targetX - guard.root.position.x;
    const dz = targetZ - guard.root.position.z;
    const centerDistance = Math.hypot(dx, dz);
    const attackDistance =
      mode === "melee"
        ? Math.max(0, centerDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
        : centerDistance;
    let movementSpeed = 0;
    if (mode === "melee" && attackDistance > range) {
      if (centerDistance > 0.01) {
        // 추격 속도 — 저레벨 경험치 농사 방지로 추가 +50% (골렘 2.405→3.6, 그 외 3.12→4.68)
        const chaseSpeed = guard.type === "villageGolem" ? 3.6 : 4.68;
        const step = Math.min(attackDistance - range, chaseSpeed * delta);
        guard.root.position.x += (dx / centerDistance) * step;
        guard.root.position.z += (dz / centerDistance) * step;
        context.keepOutOfBuildings(guard.root.position); // 가드는 건물 안으로 절대 못 들어간다
        guard.root.position.y = context.getGroundHeightAt(guard.root.position.x, guard.root.position.z);
        context.refreshSpatialObject(guard);
        movementSpeed = step / Math.max(delta, 0.001);
      }
    }
    // 추격·공격 중에는 플레이어를 정면으로 바라본다 (+Z 정면 모델 → atan2(dx, dz))
    if (centerDistance > 0.01) guard.root.rotation.y = lerpAngle(guard.root.rotation.y, Math.atan2(dx, dz), Math.min(1, delta * 10));
    context.runWalkCycle(guard, delta, movementSpeed);

    // 골렘 — 5초마다 바위 던지기(원거리). 일반 공격은 근접 유지.
    if (guard.type === "villageGolem") {
      guard.skillCooldown = Math.max(0, (guard.skillCooldown ?? 0) - delta);
      if (guard.skillCooldown <= 0 && centerDistance > 4 && centerDistance <= 22) {
        context.throwRock(guard.root.position.x, guard.root.position.y + (guard.collisionHeight ?? 3.9) * 0.7, guard.root.position.z, targetX, targetZ, guard.attackDamage ?? 14);
        guard.skillCooldown = 5;
        context.playHandAction();
      }
    }

    guard.attackCooldown = Math.max(0, (guard.attackCooldown ?? 0) - delta);
    if (guard.attackCooldown > 0) continue;
    const currentCenterDistance = Math.hypot(targetX - guard.root.position.x, targetZ - guard.root.position.z);
    const currentAttackDistance =
      mode === "melee"
        ? Math.max(0, currentCenterDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
        : currentCenterDistance;
    if (currentAttackDistance > range) continue;
    guard.attackCooldown = guard.attackInterval ?? (mode === "ranged" ? 1.8 : 1.2);
    if (remoteTarget !== null) {
      // 같은 맵 게스트 타격 — 패널(인벤토리) 열림이면 보류 (로컬과 같은 보호). 피해는 그 게스트가 적용.
      if (!remotePanelOpen) partyDamageRemotePlayer(remoteTarget, damage, guard.name ?? "경비");
      context.playHandAction();
      continue;
    }
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
