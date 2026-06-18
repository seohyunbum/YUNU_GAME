import * as THREE from "three";
import { CAVE_END_Z, CAVE_START_Z, CAVE_WIDTH } from "./constants";
import { spawnGroundShockwave, type CombatEffectContext } from "./combatEffects";
import { animatePredatorAttackMotion, triggerPredatorAttackMotion } from "./predatorAi";
import { monsterStatsFromLevel, type MonsterId } from "./monsters";
import type { Region } from "./regions";
import type { PredatorKind, WorldObject } from "./types";

// 몬스터 요새 몬스터 스폰 — 맵 레벨대(region) 기반. boss=true 면 끝 제단의 강화 보스.
export interface FortressSpawnDeps {
  activeRegions(): readonly Region[];
  spawnPredator(kind: PredatorKind, position: THREE.Vector3): WorldObject;
  applyMonsterDef(monster: WorldObject, region: Region, monsterId: MonsterId): void;
  chooseMonster(region: Region): MonsterId;
  kindForMonster(id: MonsterId): PredatorKind;
  refreshSpatialObject(object: WorldObject): void;
}

export function spawnFortressMonster(deps: FortressSpawnDeps, position: THREE.Vector3, boss: boolean): WorldObject | null {
  const regions = deps.activeRegions();
  const region = (boss ? [...regions].sort((a, b) => b.level - a.level)[0] : regions[Math.floor(Math.random() * regions.length)]) ?? regions[0];
  if (!region) return null;
  const monsterId = deps.chooseMonster(region);
  const monster = deps.spawnPredator(deps.kindForMonster(monsterId), position.clone());
  deps.applyMonsterDef(monster, region, monsterId);
  monster.root.position.y = 0;
  if (boss) {
    const level = region.levelRange[1] + 6;
    const stats = monsterStatsFromLevel(level, true);
    monster.name = `${region.name} 요새의 주인`;
    monster.hp = stats.hp; monster.armor = stats.armor; monster.attackDamage = stats.attackDamage;
    monster.attackRange = 30; monster.monsterLevel = level; monster.fortressBoss = true; monster.fortressLevel = level;
    monster.collisionRadius = (monster.collisionRadius ?? 1) * 2; monster.collisionHeight = (monster.collisionHeight ?? 1.5) * 2;
    monster.root.scale.multiplyScalar(2);
  }
  deps.refreshSpatialObject(monster);
  return monster;
}

// 몬스터 요새(동굴) 전용 몬스터 AI — 동굴 좌표계 안에서 플레이어를 추격·공격한다.
// 오버월드 predatorAi 는 동굴에서 early-return 하므로(월드/리전/안전구역 클램프가 동굴엔 안 맞음)
// 동굴 경계로만 클램프하는 가벼운 추격 루프를 따로 둔다. 공격 모션은 predatorAi 의 것을 재사용.
export interface CaveMonsterContext {
  playerPosition: THREE.Vector3;
  isPanelOpen(): boolean;
  predators(): Iterable<WorldObject>;
  predatorStats(kind?: PredatorKind, monsterId?: MonsterId): { speed: number; cooldown: number; attackDamage: number };
  predatorStrikeRange(kind?: PredatorKind): number;
  getGroundHeightAt(x: number, z: number): number;
  refreshSpatialObject(object: WorldObject): void;
  animateWalkCycle(object: WorldObject, delta: number, movementSpeed: number): void;
  damagePlayer(amount: number, showParticles: boolean, deathReason: string): boolean;
  effects(): CombatEffectContext;
}

const CAVE_MIN_X = -CAVE_WIDTH / 2 + 1.0;
const CAVE_MAX_X = CAVE_WIDTH / 2 - 1.0;
const CAVE_MIN_Z = CAVE_END_Z + 2.5;
const CAVE_MAX_Z = CAVE_START_Z + 2.5;
const next = new THREE.Vector3();

export function updateCaveMonsters(context: CaveMonsterContext, delta: number) {
  const now = performance.now();
  const panelOpen = context.isPanelOpen();
  for (const monster of context.predators()) {
    const dx = context.playerPosition.x - monster.root.position.x;
    const dz = context.playerPosition.z - monster.root.position.z;
    const distance = Math.hypot(dx, dz);
    const aggroRange = monster.attackRange ?? 16;
    const aggroed = distance <= aggroRange || (monster.angryUntil ?? 0) > now;
    const stats = context.predatorStats(monster.predatorKind, monster.monsterId as MonsterId | undefined);
    const angle = aggroed ? Math.atan2(dz, dx) : (monster.wanderAngle ?? 0);
    if (!aggroed && Math.random() < 0.02) monster.wanderAngle = Math.random() * Math.PI * 2;
    const speed = (aggroed ? stats.speed : stats.speed * 0.3) * (monster.fortressBoss ? 0.82 : 1);
    next.set(
      THREE.MathUtils.clamp(monster.root.position.x + Math.cos(angle) * speed * delta, CAVE_MIN_X, CAVE_MAX_X),
      0,
      THREE.MathUtils.clamp(monster.root.position.z + Math.sin(angle) * speed * delta, CAVE_MIN_Z, CAVE_MAX_Z),
    );
    next.y = context.getGroundHeightAt(next.x, next.z);
    monster.root.position.copy(next);
    monster.root.rotation.y = -angle;
    animatePredatorAttackMotion(monster, now);
    context.refreshSpatialObject(monster);
    context.animateWalkCycle(monster, delta, aggroed ? 0.82 : 0.3);

    monster.attackCooldown = Math.max(0, (monster.attackCooldown ?? 0) - delta);
    const canAct = aggroed && !panelOpen;
    if (canAct && distance < context.predatorStrikeRange(monster.predatorKind) && (monster.attackCooldown ?? 0) <= 0) {
      monster.attackCooldown = stats.cooldown;
      triggerPredatorAttackMotion(monster, now, dx / Math.max(0.001, distance), dz / Math.max(0.001, distance));
      if (monster.fortressBoss) spawnGroundShockwave(context.effects(), monster.root.position, 0xff3b3b);
      context.damagePlayer(monster.attackDamage ?? stats.attackDamage, true, `${monster.name}에게 공격받아 체력이 모두 떨어졌습니다.`);
    }
  }
}
