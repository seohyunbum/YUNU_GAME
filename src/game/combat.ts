import type * as THREE from "three";
import type { RewardSource } from "../operatorConfig";
import { JAMMINI_MAX_HP, PREDATOR_RETALIATE_MS } from "./constants";
import { ITEM_NAMES } from "./items";
import { predatorLootForKind } from "./monsters";
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
  bossLockMessage(kind?: BossKind): string | null;
  recordBossDefeat(kind?: BossKind): void;
  dragonCounterAttack(target: WorldObject): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  updateBossBar(): void;
  rollDragonLoot(): ItemId;
  enrageVillage(villageId: string, message: string): void;
  isVillageGuard(target: WorldObject): boolean;
  damagePlayer(amount: number, showParticles?: boolean, deathReason?: string, ignoreArmor?: boolean): boolean;
  getLastDamage(): { blocked: boolean; taken: number };
  now(): number;
  // 타격감(히트스톱·넉백·데미지 숫자) — 테스트 mock 부담을 줄이기 위해 옵셔널
  hitFeedback?(target: WorldObject, damage: number, killed: boolean): void;
  // 파티 5차 (옵셔널 — main 이 partyWorldSync 로 배선): 게스트의 동기화 몬스터 공격을 호스트 판정으로 우회 / 호스트 처치를 파티에 공유
  partyAttackIntercept?(target: WorldObject, power: number, kind: string): boolean;
  partyKillNotify?(target: WorldObject): void;
}

export function rollDragonLoot(): ItemId {
  const roll = Math.random();
  if (roll < 0.5) return "dragon_scale";
  if (roll < 0.9) return "dragon_tail";
  return "dragon_horn";
}

// 용 전리품 수량 — 용 재료를 더 모으기 어렵게. 저레벨 용(기본 용 Lv60·파이어 드래곤 Lv130)은 거의 1개만,
// 그 이상(레드/레이저/다크/불멸)도 1 위주로 가끔만 2~3 (종전 randInt(1,3) 균등 대비 대량 드랍 확률 하향).
export function rollDragonLootCount(bossKind: BossKind | undefined, rng: () => number = Math.random): number {
  if (bossKind === "dragon" || bossKind === "fire_dragon") return rng() < 0.12 ? 2 : 1;
  const r = rng();
  if (r < 0.6) return 1;
  if (r < 0.88) return 2;
  return 3;
}

export function calculateCombatDamage(attackPower: number, defense: number) {
  const attack = Math.max(0, Math.floor(attackPower));
  const armor = Math.max(0, Math.floor(defense));
  const gap = attack - armor;
  if (gap <= -20) return 0;
  if (gap < 0) return Math.max(1, Math.floor((attack * (20 + gap)) / 20));
  return Math.max(1, attack + Math.floor(gap / 10));
}

// 삼각분포 샘플 — 배율을 [min,max] 범위에서 mode 근처가 가장 잦고 한쪽으로 긴 꼬리(우편향)를 갖도록 뽑는다.
// 손그림 데미지 분포(피크≈100%, 왼쪽은 80%에서 시작, 오른쪽으로 긴 꼬리)를 단순·검증가능하게 근사한다.
// rng 주입(기본 Math.random)으로 테스트 결정성 확보 — rollDragonLootCount 와 동일 패턴.
export function triangularRoll(min: number, mode: number, max: number, rng: () => number = Math.random): number {
  if (max <= min) return min;
  const m = Math.min(Math.max(mode, min), max);
  const c = (m - min) / (max - min);
  const u = Math.min(1, Math.max(0, rng()));
  if (u < c) return min + Math.sqrt(u * (max - min) * (m - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - m));
}

// 플레이어 공격 데미지 변동 — 80%~200%, 최빈 100%(우편향: 대부분 100% 안팎, 가끔 큰 한 방).
// 고정 데미지 대신 매 타격마다 굴린다. base<=0 이면 0, 그 외 최소 1 보장.
export function varyPlayerDamage(base: number, rng: () => number = Math.random): number {
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * triangularRoll(0.8, 1.0, 2.0, rng)));
}

// 몬스터(보스 포함) 공격 데미지 변동 — 80%~130%, 최빈 100%. 플레이어보다 변동폭이 좁다.
export function varyMonsterDamage(base: number, rng: () => number = Math.random): number {
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * triangularRoll(0.8, 1.0, 1.3, rng)));
}

// 몬스터 → 플레이어 피해 전용: 방어가 아무리 높아도 공격의 15%(올림)는 들어온다.
// 레벨 보너스(레벨당 방어 +1)가 몬스터 공격 성장(레벨당 +0.65)보다 빨라 생기는
// "중반 이후 완전 무적"을 막는 하한이다. 플레이어 → 보스 방향은 기존 공식 유지.
export function calculateIncomingPlayerDamage(attackPower: number, defense: number) {
  const attack = Math.max(0, Math.floor(attackPower));
  if (attack <= 0) return 0;
  return Math.max(calculateCombatDamage(attack, defense), Math.ceil(attack * 0.15));
}

export function applyProjectileDamage(
  context: ProjectileDamageContext,
  target: WorldObject,
  attackPower: number,
  kind: CombatProjectile["kind"],
) {
  const label = kind === "magic" ? "\uB9C8\uBC95" : kind === "tnt" ? "\uD3ED\uBC1C" : kind === "wind" ? "\uC708\uB4DC\uCEE4\uD130" : "\uD22C\uC0AC\uCCB4";
  context.playImpactSound(kind);
  if (target.type === "animal") {
    target.hp = (target.hp ?? 8) - attackPower;
    context.hitFeedback?.(target, attackPower, target.hp <= 0);
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
    if (context.partyAttackIntercept?.(target, attackPower, kind)) return; // 파티 게스트 — 호스트가 판정
    // 필드 보스만 방어력을 가진다 — 항상 최소 1 피해는 보장
    const predatorDamage = target.armor ? Math.max(1, calculateCombatDamage(attackPower, target.armor)) : attackPower;
    target.hp = (target.hp ?? 10) - predatorDamage;
    context.hitFeedback?.(target, predatorDamage, target.hp <= 0);
    target.angryUntil = context.now() + PREDATOR_RETALIATE_MS;
    if (target.hp > 0) {
      context.showMessage(`${target.name}에게 ${label} ${predatorDamage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
      return;
    }
    const predatorLoot = predatorLootForKind(target.predatorKind);
    const loot = predatorLoot.item;
    const lootCount = context.rollRewardChance(1, "predator", loot) ? context.grantRewardItem(loot, predatorLoot.count, "predator") : 0;
    context.removeObject(target.id);
    context.showMessage(lootCount > 0 ? `${target.name}을 쓰러뜨리고 ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.` : `${target.name}을 쓰러뜨렸지만 재료는 나오지 않았습니다.`);
    grantRarePredatorEpicDrop(context);
    context.grantExperienceForTarget(target);
    context.partyKillNotify?.(target);
    context.renderHud();
    return;
  }

  if (target.type === "dragon") {
    const lockMessage = context.bossLockMessage(target.bossKind);
    if (lockMessage) {
      context.showMessage(lockMessage);
      return;
    }
    const stats = context.bossStats(target.bossKind);
    const defense = target.armor ?? stats.armor;
    const damage = calculateCombatDamage(attackPower, defense);
    if (damage <= 0) {
      context.showMessage(`용의 방어력 ${defense}이 ${label} 공격 ${attackPower}을 막았습니다. 용이 반격합니다.`);
      context.dragonCounterAttack(target);
      return;
    }
    target.hp = (target.hp ?? stats.maxHp) - damage;
    context.hitFeedback?.(target, damage, target.hp <= 0);
    if (target.hp > 0) {
      context.showMessage(`${stats.name}에게 ${label} ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${stats.maxHp}. ${stats.name}이 반격합니다.`);
      context.dragonCounterAttack(target);
      return;
    }
    const loot = context.rollDragonLoot();
    const lootCount = context.grantRewardItem(loot, rollDragonLootCount(target.bossKind), "boss");
    context.removeObject(target.id);
    context.playTone(760, 0.24, "triangle", 0.045);
    context.showMessage(`용을 쓰러뜨렸습니다. ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.`);
    context.grantExperienceForTarget(target);
    context.partyKillNotify?.(target);
    context.recordBossDefeat(target.bossKind);
    context.updateBossBar();
    context.renderHud();
    return;
  }

  if (target.type === "jammini") {
    target.hp = (target.hp ?? JAMMINI_MAX_HP) - attackPower;
    context.hitFeedback?.(target, attackPower, target.hp <= 0);
    target.angryUntil = context.now() + 12_000;
    if (target.hp > 0) {
      context.showMessage(`잼미니에게 ${label} ${attackPower} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${JAMMINI_MAX_HP}.`);
      return;
    }
    const plasticCount = context.grantRewardItem("plastic_block", 1, "jammini");
    context.removeObject(target.id);
    context.showMessage(`잼미니를 물리쳤습니다. 레고 조각 ${plasticCount}개를 얻었습니다.`);
    context.grantExperienceForTarget(target);
    context.partyKillNotify?.(target);
    context.renderHud();
    return;
  }

  if (target.type === "villager" || target.type === "villageKing") {
    target.hp = (target.hp ?? 10) - attackPower;
    context.hitFeedback?.(target, attackPower, target.hp <= 0);
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
    if (context.partyAttackIntercept?.(target, attackPower, kind)) return; // 파티 게스트 — 호스트가 판정(enrage·반격 포함)
    const defense = target.armor ?? 0;
    const damage = calculateCombatDamage(attackPower, defense);
    if (target.villageId) context.enrageVillage(target.villageId, `${target.name}을 원거리로 공격하자 경비들이 몰려옵니다.`);
    if (damage <= 0) {
      context.showMessage(`${target.name}의 방어력 ${defense}이 ${label} 공격 ${attackPower}을 막았습니다.`);
      return;
    }
    target.hp = (target.hp ?? 10) - damage;
    context.hitFeedback?.(target, damage, target.hp <= 0);
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
    context.partyKillNotify?.(target);
    context.renderHud();
  }
}

// 에픽 전리품 — 야생 포식자 처치 시 드물게(≈2%) 고급 구급상자가 추가로 떨어진다(에픽 등급답게 희귀).
function grantRarePredatorEpicDrop(context: ProjectileDamageContext) {
  if (!context.rollRewardChance(0.02, "predator", "advanced_medkit")) return;
  const count = context.grantRewardItem("advanced_medkit", 1, "predator");
  if (count > 0) context.showMessage(`✨ 에픽 전리품! ${ITEM_NAMES["advanced_medkit"] ?? "고급 구급상자"} ${count}개를 추가로 얻었습니다.`);
}

export function applyMeleePredatorAttack(context: ProjectileDamageContext, target: WorldObject, attackPower: number) {
  if (target.type !== "wildPredator") return;
  if (context.partyAttackIntercept?.(target, attackPower, "melee")) return; // 파티 게스트 — 호스트가 판정
  // 필드 보스만 방어력을 가진다 — 항상 최소 1 피해는 보장
  const damage = target.armor ? Math.max(1, calculateCombatDamage(attackPower, target.armor)) : attackPower;
  target.hp = (target.hp ?? 10) - damage;
  context.hitFeedback?.(target, damage, target.hp <= 0);
  target.angryUntil = context.now() + PREDATOR_RETALIATE_MS;
  if (target.hp > 0) {
    context.showMessage(`${target.name}에게 ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
    return;
  }
  const predatorLoot = predatorLootForKind(target.predatorKind);
  const lootCount = context.rollRewardChance(1, "predator", predatorLoot.item) ? context.grantRewardItem(predatorLoot.item, predatorLoot.count, "predator") : 0;
  const loot = predatorLoot.item;
  context.removeObject(target.id);
  context.showMessage(lootCount > 0 ? `${target.name}를 물리치고 ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.` : `${target.name}를 물리쳤지만 재료는 나오지 않았습니다.`);
  grantRarePredatorEpicDrop(context);
  context.grantExperienceForTarget(target);
  context.partyKillNotify?.(target);
}

export function applyMeleeDragonAttack(context: ProjectileDamageContext, target: WorldObject, attackPower: number) {
  if (target.type !== "dragon") return;
  const lockMessage = context.bossLockMessage(target.bossKind);
  if (lockMessage) {
    context.showMessage(lockMessage);
    return;
  }
  const stats = context.bossStats(target.bossKind);
  const defense = target.armor ?? stats.armor;
  const damage = calculateCombatDamage(attackPower, defense);
  context.playTone(100, 0.12, "sawtooth", 0.035);
  if (damage <= 0) {
    context.showMessage(`용의 방어력 ${defense}이 공격력 ${attackPower}을 막았습니다. 그래도 용이 즉시 반격합니다.`);
    context.dragonCounterAttack(target);
    return;
  }
  target.hp = (target.hp ?? stats.maxHp) - damage;
  context.hitFeedback?.(target, damage, target.hp <= 0);
  if (target.hp > 0) {
    context.showMessage(`${stats.name}에게 ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${stats.maxHp}. ${stats.name}이 반격합니다.`);
    context.dragonCounterAttack(target);
    return;
  }
  const loot = context.rollDragonLoot();
  const lootCount = context.grantRewardItem(loot, rollDragonLootCount(target.bossKind), "boss");
  context.removeObject(target.id);
  context.playTone(760, 0.24, "triangle", 0.045);
  context.showMessage(`용을 쓰러뜨렸습니다! ${ITEM_NAMES[loot] ?? loot} ${lootCount}개를 얻었습니다.`);
  context.grantExperienceForTarget(target);
  context.partyKillNotify?.(target);
  context.recordBossDefeat(target.bossKind);
  context.updateBossBar();
}
