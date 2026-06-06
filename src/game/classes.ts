import { HEALER_HEAL_AMOUNT, HEALER_SKILL_COST, HEALER_SKILL_COOLDOWN, SUMMONER_SKILL_COST, SUMMONER_SKILL_COOLDOWN, EAGLE_MAX_HP, EAGLE_ARMOR, EAGLE_ATTACK, WARRIOR_SKILL_COST, WARRIOR_SKILL_COOLDOWN, WARRIOR_EXPLOSION_SECONDS, MAGE_TNT_COST, MAGE_TNT_COOLDOWN, MAGE_TNT_DAMAGE } from "./constants";
import type { ItemId, PlayerClassId } from "./types";

export const PLAYER_CLASSES: Record<
  PlayerClassId,
  { name: string; tagline: string; starterItem: ItemId; skillName: string; skillSummary: string; manaCost: number; cooldown: number }
> = {
  warrior: {
    name: "전사",
    tagline: "철검으로 근접전을 여는 단단한 전투 직업",
    starterItem: "iron_sword",
    skillName: "무거운공격",
    skillSummary: `타격 지점에 ${WARRIOR_EXPLOSION_SECONDS}초 동안 폭발을 남깁니다.`,
    manaCost: WARRIOR_SKILL_COST,
    cooldown: WARRIOR_SKILL_COOLDOWN,
  },
  healer: {
    name: "힐러",
    tagline: "천상치유로 자신과 향후 파티원을 살리는 지원 직업",
    starterItem: "magic_wand",
    skillName: "천상치유",
    skillSummary: `마나 ${HEALER_SKILL_COST}로 체력 ${HEALER_HEAL_AMOUNT}을 회복합니다.`,
    manaCost: HEALER_SKILL_COST,
    cooldown: HEALER_SKILL_COOLDOWN,
  },
  mage: {
    name: "마법사",
    tagline: "마법봉과 폭발 주문으로 범위 피해를 주는 직업",
    starterItem: "magic_wand",
    skillName: "TNT발사",
    skillSummary: `전방으로 TNT를 쏘아 범위 피해 ${MAGE_TNT_DAMAGE}을 줍니다.`,
    manaCost: MAGE_TNT_COST,
    cooldown: MAGE_TNT_COOLDOWN,
  },
  summoner: {
    name: "소환사",
    tagline: "독수리를 소환하고 빙의해서 대신 싸우는 직업",
    starterItem: "magic_wand",
    skillName: "독수리소환술",
    skillSummary: `독수리 체력 ${EAGLE_MAX_HP}, 방어 ${EAGLE_ARMOR}, 공격 ${EAGLE_ATTACK}.`,
    manaCost: SUMMONER_SKILL_COST,
    cooldown: SUMMONER_SKILL_COOLDOWN,
  },
};
