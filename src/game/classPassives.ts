import type { PlayerClassId, SummonerPetProgress } from "./types";

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
  rangedCooldownScale: number;
  manaRegenScale: number;
  healthRegenPerSec: number;
  pet?: SummonerPetPassive;
}

export const CLASS_PASSIVES: Record<PlayerClassId, ClassPassive> = {
  warrior: {
    label: "단단함",
    summary: "방어력이 6 증가합니다.",
    armorBonus: 6,
    rangedCooldownScale: 1,
    manaRegenScale: 1,
    healthRegenPerSec: 0,
  },
  healer: {
    label: "재생",
    summary: "전투 중에도 천천히 체력을 회복합니다.",
    armorBonus: 0,
    rangedCooldownScale: 1,
    manaRegenScale: 1,
    healthRegenPerSec: 0.25,
  },
  mage: {
    label: "마나 순환",
    summary: "마나 회복 속도가 2배가 됩니다.",
    armorBonus: 0,
    rangedCooldownScale: 1,
    manaRegenScale: 2,
    healthRegenPerSec: 0,
  },
  summoner: {
    label: "정령 동료",
    summary: "작은 독수리 정령이 곁에서 함께 성장합니다.",
    armorBonus: 0,
    rangedCooldownScale: 1,
    manaRegenScale: 1,
    healthRegenPerSec: 0,
    pet: {
      label: "독수리 정령",
      baseDamage: 4,
      attackInterval: 1.0, // 초당 1회 공격
      attackRange: 13,
      flightAhead: 2.2,
      flightSide: 1.3,
      flightRise: 0.5,
      playerXpShare: 1.0, // 플레이어는 항상 full XP(펫 몫을 차감하지 않음) — petXpShare 는 추가 보너스
      petXpShare: 0.6, // 0.3→0.6: 펫 레벨업 가속(플레이어 XP 가산 보너스)
      damagePerLevels: 2, // 2레벨마다 +1
      maxDamage: 25, // 캡 상향(base4 + 최대 +21 ≈ Lv43 도달). 균형 조정 가능
    },
  },
  gunner: {
    label: "빠른 사격",
    summary: "원거리 무기 연사 속도가 빨라집니다.",
    armorBonus: 0,
    rangedCooldownScale: 0.667, // 연사속도 90% 로 하향(쿨다운 0.6→0.667, ×1.11)
    manaRegenScale: 1,
    healthRegenPerSec: 0,
  },
  tanker: {
    label: "철벽",
    summary: "방어력이 8 증가하고 방패를 더 잘 활용합니다.",
    armorBonus: 8,
    rangedCooldownScale: 1,
    manaRegenScale: 1,
    healthRegenPerSec: 0,
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
