import type * as THREE from "three";
import type { RewardSource } from "../operatorConfig";
import { JAMMINI_MAX_HP } from "./constants";
import { ITEM_NAMES } from "./items";
import type { BossKind, CombatProjectile, ItemId, WorldObject } from "./types";

interface ProjectileDamageBossStats {
  name: string;
  maxHp: number;
  armor: number;
}

export interface ProjectileDamageContext {
  playerPosition: THREE.Vector3;
  playImpactSound(kind: CombatProjectile["kind"]): void;
  showMessage(text: string): void;
  grantAnimalLoot(target: WorldObject, actionLabel: string): void;
  removeObject(id: string): void;
  grantExperienceForTarget(target: WorldObject): void;
  renderHud(): void;
  rollRewardChance(baseChance: number, source: RewardSource, item: ItemId): boolean;
  grantRewardItem(item: ItemId, baseCount: number, source: RewardSource): number;
  bossStats(kind?: BossKind): ProjectileDamageBossStats;
  dragonCounterAttack(target: WorldObject): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  updateBossBar(): void;
  rollDragonLoot(): ItemId;
  enrageVillage(villageId: string, message: string): void;
  isVillageGuard(target: WorldObject): boolean;
  damagePlayer(amount: number, showParticles?: boolean, deathReason?: string, ignoreArmor?: boolean): boolean;
  getLastDamage(): { blocked: boolean; taken: number };
  now(): number;
}

export function calculateCombatDamage(attackPower: number, defense: number) {
  const attack = Math.max(0, Math.floor(attackPower));
  const armor = Math.max(0, Math.floor(defense));
  const gap = attack - armor;
  if (gap <= -20) return 0;
  if (gap < 0) return Math.max(1, Math.floor((attack * (20 + gap)) / 20));
  return Math.max(1, attack + Math.floor(gap / 10));
}

export function applyProjectileDamage(
  context: ProjectileDamageContext,
  target: WorldObject,
  attackPower: number,
  kind: CombatProjectile["kind"],
) {
  const label = kind === "magic" ? "마법" : kind === "tnt" ? "폭발" : "화살";
  context.playImpactSound(kind);
  if (target.type === "animal") {
    target.hp = (target.hp ?? 8) - attackPower;
    target.fleeUntil = context.now() + 6_000;
    target.fleeFrom = context.playerPosition.clone();
    if (target.hp > 0) {
      context.showMessage(`${target.name}에게 ${label} ${attackPower} 피해. 도망갑니다. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
      return;
    }
    context.grantAnimalLoot(target, `${label}로 사냥했습니다`);
    context.removeObject(target.id);
    context.grantExperienceForTarget(target);
    context.renderHud();
    return;
  }

  if (target.type === "wildPredator") {
    target.hp = (target.hp ?? 10) - attackPower;
    target.angryUntil = context.now() + 8_000;
    if (target.hp > 0) {
      context.showMessage(`${target.name}에게 ${label} ${attackPower} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
      return;
    }
    const loot = target.predatorKind === "spider" ? "coal" : "meat";
    const lootCount = context.rollRewardChance(1, "predator", loot) ? context.grantRewardItem(loot, target.predatorKind === "lion" ? 3 : 1, "predator") : 0;
    context.removeObject(target.id);
    context.showMessage(lootCount > 0 ? `${target.name}을 쓰러뜨리고 ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.` : `${target.name}을 쓰러뜨렸지만 재료는 나오지 않았습니다.`);
    context.grantExperienceForTarget(target);
    context.renderHud();
    return;
  }

  if (target.type === "dragon") {
    const stats = context.bossStats(target.bossKind);
    const defense = target.armor ?? stats.armor;
    const damage = calculateCombatDamage(attackPower, defense);
    if (damage <= 0) {
      context.showMessage(`용의 방어력 ${defense}이 ${label} 공격 ${attackPower}을 막았습니다. 용이 반격합니다.`);
      context.dragonCounterAttack(target);
      return;
    }
    target.hp = (target.hp ?? stats.maxHp) - damage;
    if (target.hp > 0) {
      context.showMessage(`${stats.name}에게 ${label} ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${stats.maxHp}. ${stats.name}이 반격합니다.`);
      context.dragonCounterAttack(target);
      return;
    }
    const loot = context.rollDragonLoot();
    const lootCount = context.grantRewardItem(loot, 1, "boss");
    context.removeObject(target.id);
    context.playTone(760, 0.24, "triangle", 0.045);
    context.showMessage(`용을 쓰러뜨렸습니다. ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.`);
    context.grantExperienceForTarget(target);
    context.updateBossBar();
    context.renderHud();
    return;
  }

  if (target.type === "jammini") {
    target.hp = (target.hp ?? JAMMINI_MAX_HP) - attackPower;
    target.angryUntil = context.now() + 12_000;
    if (target.hp > 0) {
      context.showMessage(`잼미니에게 ${label} ${attackPower} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${JAMMINI_MAX_HP}.`);
      return;
    }
    const plasticCount = context.grantRewardItem("plastic_block", 1, "jammini");
    context.removeObject(target.id);
    context.showMessage(`잼미니를 물리쳤습니다. 레고 조각 ${plasticCount}개를 얻었습니다.`);
    context.grantExperienceForTarget(target);
    context.renderHud();
    return;
  }

  if (target.type === "villager" || target.type === "villageKing") {
    target.hp = (target.hp ?? 10) - attackPower;
    if (target.villageId) context.enrageVillage(target.villageId, `${target.name ?? "주민"}을 공격하자 마을 수호자들이 반격합니다.`);
    if (target.hp > 0) {
      context.showMessage(`${target.name ?? "주민"}에게 ${label} ${attackPower} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
      return;
    }
    context.removeObject(target.id);
    context.showMessage(`${target.name ?? "주민"}이 쓰러졌습니다. 마을 수호자들이 계속 추격합니다.`);
    context.renderHud();
    return;
  }

  if (context.isVillageGuard(target)) {
    const defense = target.armor ?? 0;
    const damage = calculateCombatDamage(attackPower, defense);
    if (target.villageId) context.enrageVillage(target.villageId, `${target.name}을 원거리로 공격하자 경비들이 몰려옵니다.`);
    if (damage <= 0) {
      context.showMessage(`${target.name}의 방어력 ${defense}이 ${label} 공격 ${attackPower}을 막았습니다.`);
      return;
    }
    target.hp = (target.hp ?? 10) - damage;
    if (target.hp > 0) {
      const range = target.attackRange ?? (target.guardMode === "ranged" ? 18 : 2.05);
      if (target.root.position.distanceTo(context.playerPosition) <= range) {
        const counterDamage = target.attackDamage ?? 1;
        if (context.damagePlayer(counterDamage, true, `${target.name}의 반격을 받아 체력이 모두 떨어졌습니다.`)) return;
        const lastDamage = context.getLastDamage();
        context.showMessage(
          lastDamage.blocked
            ? `${target.name}에게 ${label} ${damage} 피해. 방어구가 반격을 막았습니다.`
            : `${target.name}에게 ${label} ${damage} 피해. 반격 피해 ${lastDamage.taken}.`,
        );
      } else {
        context.showMessage(`${target.name}에게 ${label} ${damage} 피해. 아직 반격 사거리 밖입니다.`);
      }
      return;
    }
    const ironCount = context.rollRewardChance(1, "guard", "iron") ? context.grantRewardItem("iron", 1, "guard") : 0;
    context.removeObject(target.id);
    context.showMessage(ironCount > 0 ? `${target.name}을 물리치고 철 ${ironCount}개를 얻었습니다.` : `${target.name}을 물리쳤지만 철은 나오지 않았습니다.`);
    context.grantExperienceForTarget(target);
    context.renderHud();
  }
}
