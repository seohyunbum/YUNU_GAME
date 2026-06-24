import type * as THREE from "three";
import { GUNNER_SKILL_DAMAGE, HEALER_HEAL_AMOUNT, MAGE_TNT_DAMAGE, MAGE_TNT_RADIUS, WARRIOR_EXPLOSION_DAMAGE, WIND_CUTTER_DAMAGE } from "./constants";
import { partyEmpowerNearby, partyHealNearby, partyRallyNearby } from "./partyPresence";
import { partyGuestAttackIntercept } from "./partyWorldSync";
import type { SkillElement } from "./skillSounds";
import type { PlayerClassId, WorldObject } from "./types";

// 힐러 파티 힐 사정거리 — 1스킬(천상치유)·2스킬(치유의 비) 공통 (5.1)
export const HEAL_PARTY_RADIUS = 12;
export const EMPOWER_DURATION_MS = 300_000; // 심판의 빛 버프 지속 5분
export const EMPOWER_MULT = 1.1; // 공격·방어 +10%
export const EMPOWER_PARTY_RADIUS = 999; // 같은 맵 파티원 전원에 적용
export const RALLY_DEF_MULT = 1.2; // 불굴의 함성 — 방어 +20%
export const RALLY_DEF_SECONDS = 20; // 지속 20초
export const RALLY_PARTY_RADIUS = 999; // 같은 맵 파티원 전원에 적용
// 고기 스튜(전투 버프식) — 사용 시 5분간 공격·방어 가산 + 즉시 회복. 휘발 버프(세이브 안 함).
export const STEW_BUFF_SECONDS = 300;
export const STEW_ATTACK_BONUS = 5;
export const STEW_DEFENSE_BONUS = 5;
export const STEW_HEAL = 20;

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
  summoner: { name: "바람 정령", summary: "빙의 없이 본체가 윈드커터를 발사합니다.", manaCost: 25, cooldown: 16 },
  gunner: { name: "속사", summary: "10초 동안 원거리 무기 연사 속도가 2배가 됩니다.", manaCost: 30, cooldown: 40 },
  tanker: { name: "불타는 방패", summary: "20초 동안 방어 +1, 가까이 붙은 적이 매초 화상 피해를 입습니다.", manaCost: 40, cooldown: 50 },
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
  return scaledSkillValue(WIND_CUTTER_DAMAGE, levelBonus, 1.4);
}
export const BURN_TICKS = 5;
export const BURN_TICK_MS = 1000;
export const BURNING_SHIELD_SECONDS = 20;
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
  unbreakableUntil: number; // 탱커 3스킬(불굴의 함성) — 방어 +UNBREAKABLE_ARMOR
  empowerUntil: number; // 힐러 3스킬(심판의 빛) — 자신·파티 공격·방어 +10%
  nextSpiritStormTickAt: number; // 소환사 3스킬(정령 폭풍) — DoT 다음 틱 시각
  spiritStormTicksLeft: number; // 정령 폭풍 남은 틱(3초간 초당 1회 = 3)
  rallyDefUntil: number; // 탱커 3스킬(불굴의 함성) — 자신·파티 방어 ×RALLY_DEF_MULT
  stewBuffUntil: number; // 고기 스튜 — 공격·방어 가산 버프 만료 시각
}

export function createSkillBuffs(): SkillBuffs {
  return { burningShieldUntil: 0, healingRainUntil: 0, rapidFireUntil: 0, nextAuraTickAt: 0, nextRainTickAt: 0, unbreakableUntil: 0, empowerUntil: 0, nextSpiritStormTickAt: 0, spiritStormTicksLeft: 0, rallyDefUntil: 0, stewBuffUntil: 0 };
}

export function burningShieldArmorBonus(buffs: SkillBuffs, now: number) {
  return buffs.burningShieldUntil > now ? 1 : 0;
}

// 힐러 3스킬(심판의 빛) — 활성 시 공격·방어 ×EMPOWER_MULT(1.1), 비활성 1.
export function empowerMultiplier(buffs: SkillBuffs, now: number) {
  return buffs.empowerUntil > now ? EMPOWER_MULT : 1;
}

// 탱커 3스킬(불굴의 함성) — 활성 시 방어 ×RALLY_DEF_MULT(1.2), 비활성 1.
export function rallyDefenseMultiplier(buffs: SkillBuffs, now: number) {
  return buffs.rallyDefUntil > now ? RALLY_DEF_MULT : 1;
}

// 고기 스튜 버프 — 활성 시 공격/방어 가산(평탄), 만료 시 0. 스탯 계산 지점에 더한다.
export function stewAttackBonus(buffs: SkillBuffs, now: number) {
  return buffs.stewBuffUntil > now ? STEW_ATTACK_BONUS : 0;
}
export function stewDefenseBonus(buffs: SkillBuffs, now: number) {
  return buffs.stewBuffUntil > now ? STEW_DEFENSE_BONUS : 0;
}

export function rapidFireCooldownScale(buffs: SkillBuffs, now: number) {
  return buffs.rapidFireUntil > now ? RAPID_FIRE_SCALE : 1;
}

// 현재 걸려 있는 버프(만료시각 *Until 필드) — HUD 버프바 표시용. 아이콘 + 이름 + 남은 ms.
const BUFF_DESCRIPTORS: { field: keyof SkillBuffs; icon: string; name: string }[] = [
  { field: "empowerUntil", icon: "✨", name: "심판의 빛 — 공·방 +10%" },
  { field: "stewBuffUntil", icon: "🍲", name: "고기 스튜 — 공·방 +5" },
  { field: "rallyDefUntil", icon: "💪", name: "불굴의 함성 — 방어 +20%" },
  { field: "unbreakableUntil", icon: "🛡️", name: "불굴 — 방어 강화" },
  { field: "burningShieldUntil", icon: "🔥", name: "불타는 방패 — 방어 +1" },
  { field: "healingRainUntil", icon: "🌧️", name: "치유의 비 — 지속 회복" },
  { field: "rapidFireUntil", icon: "💨", name: "속사 — 공격속도 상승" },
];
export function activeBuffs(buffs: SkillBuffs, now: number): { icon: string; name: string; remainingMs: number }[] {
  const out: { icon: string; name: string; remainingMs: number }[] = [];
  for (const d of BUFF_DESCRIPTORS) {
    const until = buffs[d.field];
    if (typeof until === "number" && until > now) out.push({ icon: d.icon, name: d.name, remainingMs: until - now });
  }
  return out;
}

// ===== 2스킬 실행 =====
export interface SecondSkillContext {
  playerClass(): PlayerClassId;
  levelBonus(): number;
  currentDamage(): number;
  damageMult(): number; // 무기조건 데미지 배수(직업 패시브). 플랫 스킬에만 곱함 — currentDamage 파생 스킬은 이미 포함.
  skillDamageMult(): number; // 4차(초월) 전직 시 스킬 데미지 +10% (jobTierSkillDamageMult). 미전직 시 1.0. 모든 스킬 직접 피해에 곱한다.
  now(): number;
  buffs: SkillBuffs;
  trySpend(skill: SecondSkillDef): boolean;
  lookCombatTarget(): WorldObject | null;
  fireSkillProjectile(kind: "tnt" | "wind" | "arrow", visual: "magic" | "wind" | "fireball" | "arrow", damage: number, speed: number, radius: number, explosionRadius?: number, dirYaw?: number): void;
  applyDamage(target: WorldObject, damage: number): void;
  meleeEffects(target: WorldObject): void;
  playHandAction(kind: "melee" | "magic"): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  skillSound(element: SkillElement): void; // 스킬 시전음 — 원소별 CC0 샘플(SKILL_SOUND)
  showMessage(text: string): void;
  renderHud(): void;
  castImpact(): void;
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
    context.castImpact();
    const strike = Math.round(burningStrikeDamage(context.currentDamage()) * context.skillDamageMult());
    context.meleeEffects(target);
    context.applyDamage(target, strike);
    const burnDmg = Math.round(burnTickDamage(bonus) * context.skillDamageMult());
    registerBurn(target.id, burnDmg, context.now());
    context.skillSound("fire");
    context.showMessage(`불타는 공격! ${strike} 피해 + ${BURN_TICKS}초 동안 매초 ${burnDmg} 화상 피해.`);
    return;
  }
  if (playerClass === "mage") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const fbDmg = Math.round(fireballDamage(bonus) * context.damageMult() * context.skillDamageMult());
    context.fireSkillProjectile("tnt", "fireball", fbDmg, 30, 0.4, FIREBALL_RADIUS);
    context.playHandAction("magic");
    context.skillSound("fire");
    context.showMessage(`파이어볼! ${fbDmg} 범위 피해의 화염구를 발사했습니다.`);
    return;
  }
  if (playerClass === "summoner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const windDmg = Math.round(windSpiritDamage(bonus) * context.damageMult() * context.skillDamageMult());
    context.fireSkillProjectile("wind", "wind", windDmg, 34, 0.5);
    context.playHandAction("magic");
    context.skillSound("wind");
    context.showMessage(`바람 정령! ${windDmg} 피해의 윈드커터를 발사했습니다.`);
    return;
  }
  if (playerClass === "gunner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.buffs.rapidFireUntil = context.now() + RAPID_FIRE_SECONDS * 1000;
    context.skillSound("buff");
    context.showMessage(`속사! ${RAPID_FIRE_SECONDS}초 동안 연사 속도가 2배가 됩니다.`);
    context.renderHud();
    return;
  }
  if (playerClass === "tanker") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.buffs.burningShieldUntil = context.now() + BURNING_SHIELD_SECONDS * 1000;
    context.buffs.nextAuraTickAt = context.now() + BURN_TICK_MS;
    context.playHandAction("melee");
    context.skillSound("fire");
    context.showMessage(`불타는 방패! ${BURNING_SHIELD_SECONDS}초 동안 방어 +1, 가까운 적이 매초 ${thornsTickDamage(bonus)} 화상 피해를 입습니다.`);
    context.renderHud();
    return;
  }
  // healer
  if (!context.trySpend(skill)) return;
  context.castImpact();
  context.buffs.healingRainUntil = context.now() + HEALING_RAIN_SECONDS * 1000;
  context.buffs.nextRainTickAt = context.now() + BURN_TICK_MS;
  context.playHandAction("magic");
  context.skillSound("heal");
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
  buffs.unbreakableUntil = 0;
  buffs.empowerUntil = 0;
  buffs.spiritStormTicksLeft = 0;
  buffs.rallyDefUntil = 0;
  buffs.stewBuffUntil = 0;
}

export function activeBurnCount() {
  return burningTargets.length;
}

export interface SkillEffectsContext {
  now(): number;
  buffs: SkillBuffs;
  levelBonus(): number;
  skillDamageMult(): number; // 4차 전직 스킬 +10% — 지속 피해(불타는 방패·정령 폭풍)에도 적용. 미전직 1.0.
  getObject(id: string): WorldObject | undefined;
  nearbyCombatTargets(radius: number): WorldObject[];
  applyDamage(target: WorldObject, damage: number): void;
  heal(amount: number): void;
  healingRain(): void; // 치유의 비 지속 연출(틱마다 떨어지는 빗방울)
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
    const damage = Math.round(thornsTickDamage(context.levelBonus()) * context.skillDamageMult());
    for (const target of context.nearbyCombatTargets(BURNING_SHIELD_RADIUS)) if (!partyGuestAttackIntercept(target, damage, "dot")) context.applyDamage(target, damage);
  }

  // 정령 폭풍 — 3초간 1초 간격 광역 DoT(총 3회), 매 틱 주변 적 재탐색
  if (context.buffs.spiritStormTicksLeft > 0 && now >= context.buffs.nextSpiritStormTickAt) {
    context.buffs.nextSpiritStormTickAt = now + BURN_TICK_MS;
    context.buffs.spiritStormTicksLeft -= 1;
    const damage = Math.round(spiritStormDamage(context.levelBonus()) * context.skillDamageMult());
    for (const target of context.nearbyCombatTargets(SPIRIT_STORM_RADIUS)) if (!partyGuestAttackIntercept(target, damage, "dot")) context.applyDamage(target, damage);
  }

  // 치유의 비 — 1초 간격 회복 (자신 + 사정거리 내 파티원)
  if (context.buffs.healingRainUntil > now && now >= context.buffs.nextRainTickAt) {
    context.buffs.nextRainTickAt = now + BURN_TICK_MS;
    const rain = healingRainTick(context.levelBonus());
    context.heal(rain);
    partyHealNearby(rain, HEAL_PARTY_RADIUS);
    context.healingRain(); // 매 틱 빗방울 연출 — 캐스트 후광만 있고 지속 연출이 없던 문제 해결
  }
}

// ===== 3스킬 (F 키) — 1차 전직 시 해금되는 직업별 시그니처 스킬 =====
// 데이터·로직 모두 여기(리프)에 둔다. main.ts 는 F 입력 → useThirdSkill 배선만.
export const UNBREAKABLE_SECONDS = 20;
export const UNBREAKABLE_ARMOR = 6;

// 탱커 불굴의 함성 — 지속되는 방어 보너스. burningShieldArmorBonus 와 같은 패턴.
export function unbreakableArmorBonus(buffs: SkillBuffs, now: number) {
  return buffs.unbreakableUntil > now ? UNBREAKABLE_ARMOR : 0;
}

// 3스킬 수치 — 전직 보상답게 2스킬보다 강하게 스케일.
export function earthCleaveDamage(currentDamage: number) {
  return Math.floor(currentDamage * 2);
}
export function judgmentLightDamage(levelBonus: number) {
  return scaledSkillValue(50, levelBonus, 1.4);
}
export const JUDGMENT_SELF_HEAL = 30;
export function meteorDamage(levelBonus: number) {
  return scaledSkillValue(49, levelBonus, 1.26); // 발당 데미지 ×0.7 (3발 발사 밸런스 — base 70→49, scale 1.8→1.26)
}
export const METEOR_RADIUS = MAGE_TNT_RADIUS * 1.35; // 3발 부채꼴 발사에 맞춰 발당 폭발 범위 확대
export const METEOR_SPREAD = 0.18; // 메테오 3발 좌/우 분산 각(rad, ≈10°)
export function spiritStormDamage(levelBonus: number) {
  return scaledSkillValue(36, levelBonus, 1.44); // 소환사 F스킬 — base·scale 을 기본 대비 +20% (30→36, 1.2→1.44)
}
export function piercingShotDamage(levelBonus: number) {
  return scaledSkillValue(120, levelBonus, 2.2);
}
export const EARTH_CLEAVE_RADIUS = 4;
export const SPIRIT_STORM_RADIUS = 5;
export const RALLY_BURST_RADIUS = 3.5;

export const THIRD_SKILLS: Record<PlayerClassId, SecondSkillDef> = {
  warrior: { name: "대지가르기", summary: "주변 모든 적에게 공격력 2배의 광역 강타.", manaCost: 50, cooldown: 35 },
  healer: { name: "심판의 빛", summary: "5분간 자신과 파티원 전체의 공격력·방어력을 +10% 높입니다.", manaCost: 50, cooldown: 240 },
  mage: { name: "메테오", summary: "불덩이 운석 3발을 부채꼴로 발사해 넓은 범위에 큰 피해를 줍니다.", manaCost: 62, cooldown: 22 },
  summoner: { name: "정령 폭풍", summary: "주변에 바람 정령 폭풍을 일으켜 3초간 초당 광역 피해(총 3회)를 줍니다.", manaCost: 45, cooldown: 28 },
  gunner: { name: "관통 강탄", summary: "강력한 관통탄을 발사해 직선상의 적에게 큰 피해를 줍니다.", manaCost: 55, cooldown: 30 },
  tanker: { name: "불굴의 함성", summary: "20초 동안 자신과 파티원 전체의 방어력을 +20% 높입니다.", manaCost: 50, cooldown: 60 },
};

// 3스킬 컨텍스트 — 2스킬 컨텍스트에 광역 대상/자가회복만 추가.
export interface ThirdSkillContext extends SecondSkillContext {
  nearbyCombatTargets(radius: number): WorldObject[];
  heal(amount: number): void;
  spiritStorm(radius: number): void; // 정령 폭풍 — 주변 회오리 광역 연출
}

export function useThirdClassSkill(context: ThirdSkillContext) {
  const playerClass = context.playerClass();
  const skill = THIRD_SKILLS[playerClass];
  const bonus = context.levelBonus();
  if (playerClass === "warrior") {
    const targets = context.nearbyCombatTargets(EARTH_CLEAVE_RADIUS);
    if (targets.length === 0) {
      context.showMessage("대지가르기: 주변에 적이 있을 때 사용하세요.");
      return;
    }
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const dmg = Math.round(earthCleaveDamage(context.currentDamage()) * context.skillDamageMult());
    for (const target of targets) {
      context.meleeEffects(target);
      context.applyDamage(target, dmg);
    }
    context.playHandAction("melee");
    context.skillSound("earth");
    context.showMessage(`대지가르기! 주변 ${targets.length}명에게 ${dmg} 광역 피해.`);
    return;
  }
  if (playerClass === "healer") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.buffs.empowerUntil = context.now() + EMPOWER_DURATION_MS; // 자신 버프
    const buffed = partyEmpowerNearby(EMPOWER_DURATION_MS, EMPOWER_PARTY_RADIUS); // 파티원 버프
    context.playHandAction("magic");
    context.skillSound("heal");
    context.showMessage(buffed > 0 ? `심판의 빛! 5분간 나와 파티원 ${buffed}명 공격·방어 +10%.` : "심판의 빛! 5분간 공격·방어 +10%.");
    context.renderHud();
    return;
  }
  if (playerClass === "mage") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const meteorDmg = Math.round(meteorDamage(bonus) * context.damageMult() * context.skillDamageMult());
    for (let i = -1; i <= 1; i += 1) context.fireSkillProjectile("tnt", "fireball", meteorDmg, 32, 0.6, METEOR_RADIUS, i * METEOR_SPREAD); // 전방으로 불덩이 운석 3발 부채꼴 발사 → 각각 광역 폭발(넓은 타격 범위)
    context.playHandAction("magic");
    context.skillSound("fire");
    context.showMessage(`메테오! ${meteorDmg} 광역 피해의 불덩이 운석 3발을 발사했습니다.`);
    return;
  }
  if (playerClass === "summoner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.spiritStorm(SPIRIT_STORM_RADIUS); // 주변 회오리 광역 연출
    context.buffs.nextSpiritStormTickAt = context.now(); // 즉시 첫 틱부터
    context.buffs.spiritStormTicksLeft = 3; // 3초간 초당 1회(총 3회) — updateSecondSkillEffects 가 매 틱 주변 적 재탐색·피해
    context.playHandAction("magic");
    context.skillSound("wind");
    context.showMessage(`정령 폭풍! 3초간 주변 적에게 초당 ${spiritStormDamage(bonus)} 피해(총 3회).`);
    return;
  }
  if (playerClass === "gunner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const pierceDmg = Math.round(piercingShotDamage(bonus) * context.skillDamageMult());
    context.fireSkillProjectile("arrow", "arrow", pierceDmg, 64, 0.26);
    context.playHandAction("magic");
    context.skillSound("gun");
    context.showMessage(`관통 강탄! ${pierceDmg} 피해의 관통탄을 발사했습니다.`);
    return;
  }
  // tanker — 불굴의 함성
  if (!context.trySpend(skill)) return;
  context.castImpact();
  context.buffs.rallyDefUntil = context.now() + RALLY_DEF_SECONDS * 1000; // 자신 방어 +20%
  const buffed = partyRallyNearby(RALLY_DEF_SECONDS * 1000, RALLY_PARTY_RADIUS); // 같은 맵 파티원 전원
  context.playHandAction("melee");
  context.skillSound("buff");
  context.showMessage(buffed > 0 ? `불굴의 함성! 20초간 나와 파티원 ${buffed}명 방어 +20%.` : "불굴의 함성! 20초간 방어 +20%.");
  context.renderHud();
}

// ===== 4스킬 (G 키) — 4차(초월) 전직 궁극기. 최상위 위상의 압도적 효과. =====
export const FOURTH_SKILLS: Record<PlayerClassId, SecondSkillDef> = {
  warrior: { name: "천검난무", summary: "주변을 검기 폭풍으로 2연격해 막대한 광역 피해를 줍니다.", manaCost: 80, cooldown: 45 },
  healer: { name: "신의 강림", summary: "자신·파티 전체를 완전 회복하고 5분 강화하며, 주변 적에게 성스러운 폭발 피해를 줍니다.", manaCost: 90, cooldown: 90 },
  mage: { name: "천공의 운석우", summary: "운석 5발을 부채꼴로 쏟아부어 초광역에 큰 피해를 줍니다.", manaCost: 95, cooldown: 50 },
  summoner: { name: "용 정령 강림", summary: "거대 용 정령의 폭풍이 6초간 주변을 휩쓸어 초당 큰 피해를 줍니다.", manaCost: 90, cooldown: 55 },
  gunner: { name: "초토화 난사", summary: "관통탄 7발을 부채꼴로 퍼부어 직선상의 적을 초토화합니다.", manaCost: 85, cooldown: 45 },
  tanker: { name: "불멸의 요새", summary: "20초간 방어를 대폭 강화하고 주변에 도발 폭발, 파티 전체를 보호합니다.", manaCost: 80, cooldown: 70 },
};

export function useFourthClassSkill(context: ThirdSkillContext) {
  const playerClass = context.playerClass();
  const skill = FOURTH_SKILLS[playerClass];
  const bonus = context.levelBonus();
  if (playerClass === "warrior") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const targets = context.nearbyCombatTargets(EARTH_CLEAVE_RADIUS * 1.7);
    const dmg = Math.round(context.currentDamage() * 3.5 * context.skillDamageMult());
    for (let wave = 0; wave < 2; wave += 1) for (const t of targets) { context.meleeEffects(t); context.applyDamage(t, dmg); }
    context.playHandAction("melee"); context.skillSound("earth");
    context.showMessage(`천검난무! 주변 ${targets.length}명에게 ${dmg} 피해를 2연격했습니다.`);
    return;
  }
  if (playerClass === "healer") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.heal(99999); partyHealNearby(99999, HEAL_PARTY_RADIUS);
    context.buffs.empowerUntil = context.now() + EMPOWER_DURATION_MS; partyEmpowerNearby(EMPOWER_DURATION_MS, EMPOWER_PARTY_RADIUS);
    const nova = Math.round(scaledSkillValue(120, bonus, 2.0) * context.skillDamageMult());
    for (const t of context.nearbyCombatTargets(EARTH_CLEAVE_RADIUS * 1.5)) context.applyDamage(t, nova);
    context.playHandAction("magic"); context.skillSound("heal"); context.renderHud();
    context.showMessage(`신의 강림! 나와 파티를 완전 회복·강화하고 주변에 ${nova} 신성 폭발.`);
    return;
  }
  if (playerClass === "mage") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const dmg = Math.round(scaledSkillValue(70, bonus, 1.5) * context.damageMult() * context.skillDamageMult());
    for (let i = -2; i <= 2; i += 1) context.fireSkillProjectile("tnt", "fireball", dmg, 34, 0.6, METEOR_RADIUS, i * METEOR_SPREAD);
    context.playHandAction("magic"); context.skillSound("fire");
    context.showMessage(`천공의 운석우! ${dmg} 광역 운석 5발을 쏟아부었습니다.`);
    return;
  }
  if (playerClass === "summoner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    context.spiritStorm(SPIRIT_STORM_RADIUS * 1.4);
    context.buffs.nextSpiritStormTickAt = context.now(); context.buffs.spiritStormTicksLeft = 6;
    context.playHandAction("magic"); context.skillSound("wind");
    context.showMessage(`용 정령 강림! 6초간 주변 적에게 초당 ${spiritStormDamage(bonus)} 피해.`);
    return;
  }
  if (playerClass === "gunner") {
    if (!context.trySpend(skill)) return;
    context.castImpact();
    const dmg = Math.round(piercingShotDamage(bonus) * context.skillDamageMult());
    for (let i = -3; i <= 3; i += 1) context.fireSkillProjectile("arrow", "arrow", dmg, 64, 0.24, undefined, i * 0.12);
    context.playHandAction("magic"); context.skillSound("gun");
    context.showMessage(`초토화 난사! ${dmg} 관통탄 7발을 퍼부었습니다.`);
    return;
  }
  // tanker — 불멸의 요새
  if (!context.trySpend(skill)) return;
  context.castImpact();
  context.buffs.rallyDefUntil = context.now() + RALLY_DEF_SECONDS * 2 * 1000; partyRallyNearby(RALLY_DEF_SECONDS * 2 * 1000, RALLY_PARTY_RADIUS);
  const taunt = Math.round(scaledSkillValue(90, bonus, 1.4) * context.skillDamageMult());
  for (const t of context.nearbyCombatTargets(EARTH_CLEAVE_RADIUS * 1.5)) { context.meleeEffects(t); context.applyDamage(t, taunt); }
  context.playHandAction("melee"); context.skillSound("buff"); context.renderHud();
  context.showMessage(`불멸의 요새! 방어 대폭 강화 + 주변에 ${taunt} 도발 폭발.`);
}
