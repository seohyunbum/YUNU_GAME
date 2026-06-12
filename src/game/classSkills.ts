import type * as THREE from "three";
import { GUNNER_SKILL_DAMAGE, HEALER_HEAL_AMOUNT, MAGE_TNT_DAMAGE, MAGE_TNT_RADIUS, WARRIOR_EXPLOSION_DAMAGE, WIND_CUTTER_DAMAGE } from "./constants";
import { partyGuestAttackIntercept } from "./partyWorldSync";
import type { PlayerClassId, WorldObject } from "./types";

// ===== 스킬 데미지 스케일링 =====
// 일반 공격은 레벨당 +1 강해지는데 스킬은 고정값이라 후반에 쓸모가 없어진다.
// 모든 스킬 수치는 레벨 보너스(레벨-1)에 비례해 함께 성장한다.
export function scaledSkillValue(base: number, levelBonus: number, scale: number) {
  return Math.floor(base + Math.max(0, levelBonus) * scale);
}

// 1스킬 스케일 수치 — 단일 대상 한방기는 높게, 광역기는 약간 낮게
export function warriorExplosionDamage(levelBonus: number) {
  return scaledSkillValue(WARRIOR_EXPLOSION_DAMAGE, levelBonus, 1.0);
}
export function mageTntDamage(levelBonus: number) {
  return scaledSkillValue(MAGE_TNT_DAMAGE, levelBonus, 0.9);
}
export function gunnerShotDamage(levelBonus: number) {
  return scaledSkillValue(GUNNER_SKILL_DAMAGE, levelBonus, 2.0);
}
export function healerHealAmount(levelBonus: number) {
  return scaledSkillValue(HEALER_HEAL_AMOUNT, levelBonus, 1.0);
}

// ===== 2스킬 정의 (T 키) =====
export interface SecondSkillDef {
  name: string;
  summary: string;
  manaCost: number;
  cooldown: number;
}

export const SECOND_SKILLS: Record<PlayerClassId, SecondSkillDef> = {
  warrior: { name: "불타는 공격", summary: "정면의 적에게 공격력 2배 피해 + 5초 동안 화상 피해.", manaCost: 40, cooldown: 30 },
  healer: { name: "치유의 비", summary: "10초 동안 매초 체력을 회복합니다.", manaCost: 45, cooldown: 60 },
  mage: { name: "파이어볼", summary: "강력한 화염구를 발사해 범위 피해를 줍니다.", manaCost: 25, cooldown: 20 },
  summoner: { name: "바람 정령", summary: "빙의 없이 본체가 윈드커터를 발사합니다.", manaCost: 25, cooldown: 20 },
  gunner: { name: "속사", summary: "10초 동안 원거리 무기 연사 속도가 2배가 됩니다.", manaCost: 30, cooldown: 40 },
  tanker: { name: "불타는 방패", summary: "30초 동안 방어 +1, 가까이 붙은 적이 매초 화상 피해를 입습니다.", manaCost: 35, cooldown: 60 },
};

// 2스킬 수치
export function fireballDamage(levelBonus: number) {
  return scaledSkillValue(45, levelBonus, 1.6);
}
export const FIREBALL_RADIUS = MAGE_TNT_RADIUS * 0.8;
export function burningStrikeDamage(currentDamage: number) {
  return Math.floor(currentDamage * 2);
}
export function burnTickDamage(levelBonus: number) {
  return scaledSkillValue(4, levelBonus, 0.5);
}
export function thornsTickDamage(levelBonus: number) {
  return scaledSkillValue(3, levelBonus, 0.6);
}
export function healingRainTick(levelBonus: number) {
  return scaledSkillValue(2, levelBonus, 0.4);
}
export function windSpiritDamage(levelBonus: number) {
  return scaledSkillValue(WIND_CUTTER_DAMAGE, levelBonus, 1.2);
}
export const BURN_TICKS = 5;
export const BURN_TICK_MS = 1000;
export const BURNING_SHIELD_SECONDS = 30;
export const BURNING_SHIELD_RADIUS = 3.2;
export const HEALING_RAIN_SECONDS = 10;
export const RAPID_FIRE_SECONDS = 10;
export const RAPID_FIRE_SCALE = 0.5;

// ===== 지속 버프 상태 (저장하지 않는 휘발 상태) =====
export interface SkillBuffs {
  burningShieldUntil: number;
  healingRainUntil: number;
  rapidFireUntil: number;
  nextAuraTickAt: number;
  nextRainTickAt: number;
}

export function createSkillBuffs(): SkillBuffs {
  return { burningShieldUntil: 0, healingRainUntil: 0, rapidFireUntil: 0, nextAuraTickAt: 0, nextRainTickAt: 0 };
}

export function burningShieldArmorBonus(buffs: SkillBuffs, now: number) {
  return buffs.burningShieldUntil > now ? 1 : 0;
}

export function rapidFireCooldownScale(buffs: SkillBuffs, now: number) {
  return buffs.rapidFireUntil > now ? RAPID_FIRE_SCALE : 1;
}

// ===== 2스킬 실행 =====
export interface SecondSkillContext {
  playerClass(): PlayerClassId;
  levelBonus(): number;
  currentDamage(): number;
  now(): number;
  buffs: SkillBuffs;
  trySpend(skill: SecondSkillDef): boolean;
  lookCombatTarget(): WorldObject | null;
  fireSkillProjectile(kind: "tnt" | "wind", visual: "magic" | "wind", damage: number, speed: number, radius: number, explosionRadius?: number): void;
  applyDamage(target: WorldObject, damage: number): void;
  meleeEffects(target: WorldObject): void;
  playHandAction(kind: "melee" | "magic"): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  showMessage(text: string): void;
  renderHud(): void;
}

export function useSecondClassSkill(context: SecondSkillContext) {
  const playerClass = context.playerClass();
  const skill = SECOND_SKILLS[playerClass];
  const bonus = context.levelBonus();
  if (playerClass === "warrior") {
    const target = context.lookCombatTarget();
    if (!target) {
      context.showMessage("불타는 공격: 정면의 몬스터를 바라보고 사용하세요.");
      return;
    }
    if (!context.trySpend(skill)) return;
    const strike = burningStrikeDamage(context.currentDamage());
    context.meleeEffects(target);
    context.applyDamage(target, strike);
    registerBurn(target.id, burnTickDamage(bonus), context.now());
    context.playTone(180, 0.12, "sawtooth", 0.035);
    context.showMessage(`불타는 공격! ${strike} 피해 + ${BURN_TICKS}초 동안 매초 ${burnTickDamage(bonus)} 화상 피해.`);
    return;
  }
  if (playerClass === "mage") {
    if (!context.trySpend(skill)) return;
    context.fireSkillProjectile("tnt", "magic", fireballDamage(bonus), 30, 0.4, FIREBALL_RADIUS);
    context.playHandAction("magic");
    context.playTone(300, 0.1, "sawtooth", 0.03);
    context.showMessage(`파이어볼! ${fireballDamage(bonus)} 범위 피해의 화염구를 발사했습니다.`);
    return;
  }
  if (playerClass === "summoner") {
    if (!context.trySpend(skill)) return;
    context.fireSkillProjectile("wind", "wind", windSpiritDamage(bonus), 34, 0.5);
    context.playHandAction("magic");
    context.playTone(780, 0.08, "triangle", 0.026);
    context.showMessage(`바람 정령! ${windSpiritDamage(bonus)} 피해의 윈드커터를 발사했습니다.`);
    return;
  }
  if (playerClass === "gunner") {
    if (!context.trySpend(skill)) return;
    context.buffs.rapidFireUntil = context.now() + RAPID_FIRE_SECONDS * 1000;
    context.playTone(520, 0.07, "square", 0.028);
    context.showMessage(`속사! ${RAPID_FIRE_SECONDS}초 동안 연사 속도가 2배가 됩니다.`);
    context.renderHud();
    return;
  }
  if (playerClass === "tanker") {
    if (!context.trySpend(skill)) return;
    context.buffs.burningShieldUntil = context.now() + BURNING_SHIELD_SECONDS * 1000;
    context.buffs.nextAuraTickAt = context.now() + BURN_TICK_MS;
    context.playHandAction("melee");
    context.playTone(240, 0.16, "sawtooth", 0.03);
    context.showMessage(`불타는 방패! ${BURNING_SHIELD_SECONDS}초 동안 방어 +1, 가까운 적이 매초 ${thornsTickDamage(bonus)} 화상 피해를 입습니다.`);
    context.renderHud();
    return;
  }
  // healer
  if (!context.trySpend(skill)) return;
  context.buffs.healingRainUntil = context.now() + HEALING_RAIN_SECONDS * 1000;
  context.buffs.nextRainTickAt = context.now() + BURN_TICK_MS;
  context.playHandAction("magic");
  context.playTone(840, 0.14, "sine", 0.024);
  context.showMessage(`치유의 비! ${HEALING_RAIN_SECONDS}초 동안 매초 체력 ${healingRainTick(bonus)}을 회복합니다.`);
  context.renderHud();
}

// ===== 지속 효과 틱 (per-frame — THREE 할당 금지) =====
interface BurningTarget {
  id: string;
  ticksLeft: number;
  damage: number;
  nextTickAt: number;
}

const burningTargets: BurningTarget[] = [];

export function registerBurn(id: string, damage: number, now: number) {
  const existing = burningTargets.find((burn) => burn.id === id);
  if (existing) {
    existing.ticksLeft = BURN_TICKS;
    existing.damage = Math.max(existing.damage, damage);
    return;
  }
  burningTargets.push({ id, ticksLeft: BURN_TICKS, damage, nextTickAt: now + BURN_TICK_MS });
}

export function resetSecondSkillEffects(buffs: SkillBuffs) {
  burningTargets.length = 0;
  buffs.burningShieldUntil = 0;
  buffs.healingRainUntil = 0;
  buffs.rapidFireUntil = 0;
}

export function activeBurnCount() {
  return burningTargets.length;
}

export interface SkillEffectsContext {
  now(): number;
  buffs: SkillBuffs;
  levelBonus(): number;
  getObject(id: string): WorldObject | undefined;
  nearbyCombatTargets(radius: number): WorldObject[];
  applyDamage(target: WorldObject, damage: number): void;
  heal(amount: number): void;
  playerPosition: THREE.Vector3;
}

export function updateSecondSkillEffects(context: SkillEffectsContext) {
  const now = context.now();

  // 화상 도트 — 1초 간격, 대상이 사라지면 종료
  for (let index = burningTargets.length - 1; index >= 0; index -= 1) {
    const burn = burningTargets[index];
    if (now < burn.nextTickAt) continue;
    const target = context.getObject(burn.id);
    if (!target || (target.hp ?? 0) <= 0) {
      burningTargets.splice(index, 1);
      continue;
    }
    if (!partyGuestAttackIntercept(target, burn.damage, "dot")) context.applyDamage(target, burn.damage); // 파티 게스트의 동기화 몬스터는 호스트가 판정
    burn.ticksLeft -= 1;
    burn.nextTickAt = now + BURN_TICK_MS;
    if (burn.ticksLeft <= 0) burningTargets.splice(index, 1);
  }

  // 불타는 방패 — 1초 간격 근접 오라
  if (context.buffs.burningShieldUntil > now && now >= context.buffs.nextAuraTickAt) {
    context.buffs.nextAuraTickAt = now + BURN_TICK_MS;
    const damage = thornsTickDamage(context.levelBonus());
    for (const target of context.nearbyCombatTargets(BURNING_SHIELD_RADIUS)) if (!partyGuestAttackIntercept(target, damage, "dot")) context.applyDamage(target, damage);
  }

  // 치유의 비 — 1초 간격 회복
  if (context.buffs.healingRainUntil > now && now >= context.buffs.nextRainTickAt) {
    context.buffs.nextRainTickAt = now + BURN_TICK_MS;
    context.heal(healingRainTick(context.levelBonus()));
  }
}
