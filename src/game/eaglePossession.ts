import * as THREE from "three";
import { EAGLE_CLAW_COOLDOWN, EAGLE_CLAW_DAMAGE, PROJECTILE_MAX_LIFE, WIND_CUTTER_COOLDOWN, WIND_CUTTER_DAMAGE } from "./constants";
import { createWindCutterProjectile, spawnEnemyHitParticles, spawnMeleeSlashTrail, type CombatEffectContext } from "./combatEffects";
import { WEAPON_DAMAGE } from "./items";
import type { CombatProjectile, HandActionMode, ItemId, WorldObject } from "./types";

export interface EagleActionContext {
  possessedEagleId(): string | null;
  selectedItem(): ItemId | null | undefined;
  bodyAttackPower(): number; // 본체 전체 공격력(무기+레벨+훈련+제작+목걸이+버프) — 빙의 공격이 이를 받음
  healEagle(amount: number): void; // 할퀴기 흡혈 — 독수리 HP 회복
  clawCooldownUntil(): number;
  windCutterCooldownUntil(): number;
  setClawCooldownUntil(value: number): void;
  setWindCutterCooldownUntil(value: number): void;
  target(): WorldObject | null;
  scene: THREE.Scene;
  camera: THREE.Camera;
  projectiles: CombatProjectile[];
  combatEffectContext: CombatEffectContext;
  applyDamage(target: WorldObject, damage: number, kind: CombatProjectile["kind"]): void;
  playHandAction(mode?: HandActionMode): void;
  playMeleeWhoosh(): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  showMessage(text: string): void;
  renderHud(): void;
}

export function eagleHeldWeaponDamage(item: ItemId | null | undefined) {
  return item ? WEAPON_DAMAGE[item] ?? 0 : 0;
}

export function possessedEagleDamage(skillBase: number, bodyAttack: number) {
  return skillBase + bodyAttack; // bodyAttack 에 무기·훈련·제작·목걸이·버프 모두 포함(본체와 동일)
}

export function eagleSkillCooldownRemaining(until: number, now = performance.now()) {
  return Math.max(0, (until - now) / 1000);
}

export function eagleSkillStatus(clawUntil: number, windUntil: number, now = performance.now()) {
  const claw = eagleSkillCooldownRemaining(clawUntil, now);
  const wind = eagleSkillCooldownRemaining(windUntil, now);
  return `R 할퀴기 ${claw > 0 ? Math.ceil(claw) + "초" : "준비"} · 우클릭 윈드커터 ${wind > 0 ? Math.ceil(wind) + "초" : "준비"} · X 해제`;
}

export function tryEagleClaw(context: EagleActionContext) {
  if (!context.possessedEagleId()) return false;
  const remaining = eagleSkillCooldownRemaining(context.clawCooldownUntil());
  if (remaining > 0) {
    context.showMessage(`할퀴기는 ${Math.ceil(remaining)}초 후 다시 사용할 수 있습니다.`);
    return true;
  }
  const target = context.target();
  if (!target) {
    context.showMessage("할퀴기 대상이 시야 안에 없습니다.");
    return true;
  }
  const damage = possessedEagleDamage(EAGLE_CLAW_DAMAGE, context.bodyAttackPower());
  context.setClawCooldownUntil(performance.now() + EAGLE_CLAW_COOLDOWN * 1000);
  context.playHandAction("melee");
  spawnMeleeSlashTrail(context.combatEffectContext);
  spawnEnemyHitParticles(context.combatEffectContext, target);
  context.playMeleeWhoosh();
  context.playTone(720, 0.07, "triangle", 0.026);
  context.applyDamage(target, damage, "wind");
  context.healEagle(Math.round(damage * 0.3)); // 입힌 데미지 30% 흡혈 → 독수리 HP 회복
  context.renderHud();
  return true;
}

export function tryEagleWindCutter(context: EagleActionContext) {
  if (!context.possessedEagleId()) return false;
  const remaining = eagleSkillCooldownRemaining(context.windCutterCooldownUntil());
  if (remaining > 0) {
    context.showMessage(`윈드커터는 ${Math.ceil(remaining)}초 후 다시 사용할 수 있습니다.`);
    return true;
  }
  context.setWindCutterCooldownUntil(performance.now() + WIND_CUTTER_COOLDOWN * 1000);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(context.camera.quaternion).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(context.camera.quaternion).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(context.camera.quaternion).normalize();
  const origin = context.camera.position
    .clone()
    .addScaledVector(direction, 0.94)
    .addScaledVector(right, 0.18)
    .addScaledVector(up, -0.08);
  const projectile: CombatProjectile = {
    kind: "wind",
    mesh: createWindCutterProjectile(direction),
    velocity: direction.multiplyScalar(37),
    damage: possessedEagleDamage(WIND_CUTTER_DAMAGE, context.bodyAttackPower()),
    radius: 0.42,
    life: PROJECTILE_MAX_LIFE,
  };
  projectile.mesh.position.copy(origin);
  context.scene.add(projectile.mesh);
  context.projectiles.push(projectile);
  context.playHandAction("magic");
  context.playTone(920, 0.08, "triangle", 0.026);
  context.playTone(360, 0.12, "sine", 0.014);
  context.showMessage(`윈드커터! 전방으로 ${projectile.damage} 공격의 바람 칼날을 날렸습니다.`);
  context.renderHud();
  return true;
}
