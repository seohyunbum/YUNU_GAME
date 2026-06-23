import type { ItemId, PlayerClassId, SummonerPetProgress } from "./types";
import { isStaffWeapon, isMeleeWeapon } from "./items";

export interface SummonerPetPassive {
  label: string;
  baseDamage: number;
  attackInterval: number;
  attackRange: number;
  flightAhead: number;
  flightSide: number;
  flightRise: number;
  playerXpShare: number;
  petXpShare: number;
  damagePerLevels: number;
  maxDamage: number;
}

export interface ClassPassive {
  label: string;
  summary: string;
  armorBonus: number;
  armorPerLevel: number; // 레벨업(레벨-1)당 방어 가산
  rangedCooldownScale: number;
  gunOnlyRangedCooldown: boolean; // rangedCooldownScale 을 총기 장착 시에만 적용
  manaRegenScale: number;
  manaRegenFlat: number; // 마나 회복 평탄 가산(초당)
  healthRegenPerSec: number;
  shieldHealthRegenBase: number; // 방패 장착 시 체력 회복 base(초당)
  shieldHealthRegenPerLevel: number; // 방패 장착 시 레벨당 추가 회복(초당)
  moveSpeedMult: number; // 이동속도 배수
  weaponDamage?: { group: "melee" | "staff"; pct: number; affectsHeal?: boolean }; // 무기조건 데미지(힐량) 배수
  basicAttackMult: number; // 기본 공격(근접·원거리) 데미지 배수 — 직업 밸런스
  rangedRangeScale: number; // 원거리 투사체 사거리(수명) 배수 — 직업 밸런스
  pet?: SummonerPetPassive;
}

// 무기조건 데미지 배수 — 든 무기가 직업 조건(근접/지팡이)에 맞을 때만 (1 + pct), 아니면 1.
export function classWeaponDamageMult(playerClass: PlayerClassId, heldItem: ItemId | null): number {
  const wd = CLASS_PASSIVES[playerClass].weaponDamage;
  if (!wd) return 1;
  const match = wd.group === "melee" ? isMeleeWeapon(heldItem) : isStaffWeapon(heldItem);
  return match ? 1 + wd.pct : 1;
}

export const CLASS_PASSIVES: Record<PlayerClassId, ClassPassive> = {
  warrior: {
    label: "단단한 근접딜러",
    summary: "방어 +4 (레벨당 +0.2) · 근접무기 장착 시 데미지 +10%(스킬 포함).",
    armorBonus: 4,
    armorPerLevel: 0.2,
    rangedCooldownScale: 1,
    gunOnlyRangedCooldown: false,
    manaRegenScale: 1,
    manaRegenFlat: 0.5,
    healthRegenPerSec: 0.5,
    shieldHealthRegenBase: 0,
    shieldHealthRegenPerLevel: 0,
    moveSpeedMult: 1,
    weaponDamage: { group: "melee", pct: 0.1 },
    basicAttackMult: 0.95,
    rangedRangeScale: 1,
  },
  healer: {
    label: "재생",
    summary: "체력 +0.75/s · 마나 +0.75/s · 지팡이 장착 시 데미지·힐량 +10%.",
    armorBonus: 0,
    armorPerLevel: 0,
    rangedCooldownScale: 1,
    gunOnlyRangedCooldown: false,
    manaRegenScale: 1,
    manaRegenFlat: 0.75,
    healthRegenPerSec: 0.75,
    shieldHealthRegenBase: 0,
    shieldHealthRegenPerLevel: 0,
    moveSpeedMult: 1,
    weaponDamage: { group: "staff", pct: 0.1, affectsHeal: true },
    basicAttackMult: 1,
    rangedRangeScale: 1,
  },
  mage: {
    label: "마나 순환",
    summary: "마나 회복 ×2 · 지팡이 장착 시 데미지 +15%(스킬 포함).",
    armorBonus: 0,
    armorPerLevel: 0,
    rangedCooldownScale: 1,
    gunOnlyRangedCooldown: false,
    manaRegenScale: 2,
    manaRegenFlat: 0.5,
    healthRegenPerSec: 0.5,
    shieldHealthRegenBase: 0,
    shieldHealthRegenPerLevel: 0,
    moveSpeedMult: 1,
    weaponDamage: { group: "staff", pct: 0.15 },
    basicAttackMult: 1.1,
    rangedRangeScale: 1,
  },
  summoner: {
    label: "정령 동료",
    summary: "독수리 정령이 함께 성장 · 지팡이 장착 시 데미지 +10%(스킬 포함).",
    armorBonus: 0,
    armorPerLevel: 0,
    rangedCooldownScale: 1,
    gunOnlyRangedCooldown: false,
    manaRegenScale: 1,
    manaRegenFlat: 0.5,
    healthRegenPerSec: 0.5,
    shieldHealthRegenBase: 0,
    shieldHealthRegenPerLevel: 0,
    moveSpeedMult: 1,
    weaponDamage: { group: "staff", pct: 0.1 },
    basicAttackMult: 1,
    rangedRangeScale: 1,
    pet: {
      label: "독수리 정령",
      baseDamage: 4,
      attackInterval: 1.0, // 초당 1회 공격
      attackRange: 13,
      flightAhead: 2.2,
      flightSide: 1.3,
      flightRise: 0.5,
      playerXpShare: 0.85, // 플레이어는 85% 습득(15% 손해) — 소환수 밸런스 비용
      petXpShare: 0.6, // 펫 레벨업 가속(플레이어 85%와 별개의 추가 보너스)
      damagePerLevels: 1, // 1레벨마다 +1
      maxDamage: 200, // 데미지 캡
    },
  },
  gunner: {
    label: "빠른 사격",
    summary: "총기 장착 시 연사 속도 ↑ · 이동속도 +10%.",
    armorBonus: 0,
    armorPerLevel: 0,
    rangedCooldownScale: 0.667, // 연사속도 90% 로 하향(쿨다운 0.6→0.667, ×1.11). 총기 장착 시에만 적용.
    gunOnlyRangedCooldown: true,
    manaRegenScale: 1,
    manaRegenFlat: 0.5,
    healthRegenPerSec: 0.5,
    shieldHealthRegenBase: 0,
    shieldHealthRegenPerLevel: 0,
    moveSpeedMult: 1.1,
    basicAttackMult: 0.7,
    rangedRangeScale: 0.9, // 거너 사거리 90% 로 하향
  },
  tanker: {
    label: "철벽",
    summary: "방어 +8 (레벨당 +0.4) · 방패 장착 시 체력 +(0.25+레벨/50)/s.",
    armorBonus: 8,
    armorPerLevel: 0.4,
    rangedCooldownScale: 1,
    gunOnlyRangedCooldown: false,
    manaRegenScale: 1,
    manaRegenFlat: 0.5,
    healthRegenPerSec: 0.5,
    shieldHealthRegenBase: 0.25,
    shieldHealthRegenPerLevel: 0.02, // 1/50
    moveSpeedMult: 1,
    basicAttackMult: 0.9,
    rangedRangeScale: 1,
  },
};

export const DEFAULT_SUMMONER_PET_PROGRESS: SummonerPetProgress = {
  level: 1,
  experience: 0,
};

export function experienceForNextPetLevel(level: number) {
  return Math.floor(24 * Math.pow(Math.max(1, Math.floor(level)), 1.25));
}

export function summonerPetDamage(progress: SummonerPetProgress) {
  const pet = CLASS_PASSIVES.summoner.pet;
  if (!pet) return 0;
  const bonus = Math.floor((Math.max(1, Math.floor(progress.level)) - 1) / pet.damagePerLevels);
  return Math.min(pet.maxDamage, pet.baseDamage + bonus);
}
