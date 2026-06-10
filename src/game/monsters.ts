import * as THREE from "three";
import { DRAGON_MAX_HP, DRAGON_ARMOR } from "./constants";
import type { PredatorKind, BossKind, WorldObject } from "./types";

export const PREDATOR_STATS: Record<PredatorKind, { hp: number; attackDamage: number; aggroRange: number; strikeRange: number; speed: number; cooldown: number }> = {
  spider: { hp: 25, attackDamage: 3, aggroRange: 8, strikeRange: 1.7, speed: 2.2, cooldown: 1.45 },
  wolf: { hp: 65, attackDamage: 6, aggroRange: 13, strikeRange: 2.05, speed: 3.05, cooldown: 1.35 },
  lion: { hp: 78, attackDamage: 7, aggroRange: 15, strikeRange: 2.35, speed: 3.3, cooldown: 1.15 },
};

export type MonsterId =
  | "spider"
  | "jammini"
  | "wolf"
  | "lion"
  | "poison_spider"
  | "red_wolf"
  | "giant_spider"
  | "swamp_spider_king"
  | "berserk_lion"
  | "stone_golem"
  | "frost_wolf"
  | "ice_spider"
  | "golem"
  | BossKind;

export type MonsterArchetype = "spider" | "wolf" | "lion" | "golem" | "dragon" | "jammini";

export interface MonsterDef {
  id: MonsterId;
  name: string;
  archetype: MonsterArchetype;
  level: number;
  tint: number;
  predatorKind?: PredatorKind;
  bossKind?: BossKind;
}

export const MONSTER_DEFS: Record<MonsterId, MonsterDef> = {
  spider: { id: "spider", name: "거미", archetype: "spider", level: 5, tint: 0x27272a, predatorKind: "spider" },
  jammini: { id: "jammini", name: "잼미니", archetype: "jammini", level: 12, tint: 0x2563eb },
  wolf: { id: "wolf", name: "늑대", archetype: "wolf", level: 15, tint: 0x6b7280, predatorKind: "wolf" },
  lion: { id: "lion", name: "사자", archetype: "lion", level: 22, tint: 0xb77935, predatorKind: "lion" },
  poison_spider: { id: "poison_spider", name: "맹독거미", archetype: "spider", level: 20, tint: 0x22c55e, predatorKind: "spider" },
  red_wolf: { id: "red_wolf", name: "붉은늑대", archetype: "wolf", level: 35, tint: 0xb91c1c, predatorKind: "wolf" },
  giant_spider: { id: "giant_spider", name: "거대거미", archetype: "spider", level: 40, tint: 0x7c2d12, predatorKind: "spider" },
  swamp_spider_king: { id: "swamp_spider_king", name: "맹독거미왕", archetype: "spider", level: 55, tint: 0x16a34a, predatorKind: "spider" },
  berserk_lion: { id: "berserk_lion", name: "폭주사자", archetype: "lion", level: 70, tint: 0xf97316, predatorKind: "lion" },
  stone_golem: { id: "stone_golem", name: "바위골렘", archetype: "golem", level: 80, tint: 0x64748b },
  frost_wolf: { id: "frost_wolf", name: "서리늑대", archetype: "wolf", level: 100, tint: 0x93c5fd, predatorKind: "wolf" },
  ice_spider: { id: "ice_spider", name: "얼음거미", archetype: "spider", level: 115, tint: 0x67e8f9, predatorKind: "spider" },
  golem: { id: "golem", name: "마을 수호신 골렘", archetype: "golem", level: 40, tint: 0x94a3b8 },
  dragon: { id: "dragon", name: "용", archetype: "dragon", level: 60, tint: 0xef4444, bossKind: "dragon" },
  fire_dragon: { id: "fire_dragon", name: "파이어 드래곤", archetype: "dragon", level: 130, tint: 0xff6b1a, bossKind: "fire_dragon" },
  red_dragon: { id: "red_dragon", name: "레드 드래곤", archetype: "dragon", level: 170, tint: 0xdc2626, bossKind: "red_dragon" },
  laser_dragon: { id: "laser_dragon", name: "레이저 드래곤", archetype: "dragon", level: 220, tint: 0x22d3ee, bossKind: "laser_dragon" },
  dark_dragon: { id: "dark_dragon", name: "다크 드래곤", archetype: "dragon", level: 260, tint: 0x6d28d9, bossKind: "dark_dragon" },
  immortal: { id: "immortal", name: "불멸의 존재", archetype: "dragon", level: 300, tint: 0xf8fafc, bossKind: "immortal" },
};

export function monsterStatsFromLevel(level: number, boss = false) {
  const safeLevel = Math.max(1, Math.floor(level));
  return {
    hp: Math.floor(18 + safeLevel * (boss ? 11 : 9)),
    attackDamage: Math.max(1, Math.floor(2 + safeLevel * (boss ? 0.62 : 0.5))),
    armor: boss ? Math.floor(20 + safeLevel * 0.25) : 0,
  };
}

export function isPredatorMonster(id: MonsterId) {
  return Boolean(MONSTER_DEFS[id].predatorKind);
}

export function predatorKindForMonster(id: MonsterId): PredatorKind {
  return MONSTER_DEFS[id].predatorKind ?? "wolf";
}

export function predatorStatsForMonster(id: MonsterId, fallbackKind: PredatorKind = "wolf") {
  const def = MONSTER_DEFS[id];
  const kind = def.predatorKind ?? fallbackKind;
  const base = PREDATOR_STATS[kind] ?? PREDATOR_STATS.wolf;
  if (id === kind) return base;
  const scaled = monsterStatsFromLevel(def.level);
  return {
    ...base,
    hp: Math.max(base.hp, scaled.hp),
    attackDamage: Math.max(base.attackDamage, scaled.attackDamage),
    aggroRange: Math.min(28, Math.max(base.aggroRange, 8 + def.level * 0.12)),
    speed: Math.min(base.speed + def.level / 140, base.speed * 1.18),
    cooldown: Math.max(0.72, base.cooldown - def.level / 300),
  };
}

export function applyPredatorMonsterDefinition(
  object: WorldObject,
  region: { id: string; lootTier: number },
  monsterId: MonsterId,
) {
  const def = MONSTER_DEFS[monsterId];
  if (!def.predatorKind) return object;
  const stats = predatorStatsForMonster(monsterId, def.predatorKind);
  object.name = def.name;
  object.hp = stats.hp;
  object.armor = 0;
  object.attackDamage = stats.attackDamage;
  object.attackRange = stats.aggroRange;
  object.regionId = region.id;
  object.monsterId = monsterId;
  object.monsterLevel = def.level;
  object.lootTier = region.lootTier;
  object.root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(def.tint), 0.35);
      child.material.emissive.lerp(new THREE.Color(def.tint), 0.08);
    }
  });
  return object;
}

export const BOSS_STATS: Record<
  BossKind,
  { name: string; maxHp: number; armor: number; fireDamage: number; clawDamage: number; attackRange: number; collisionRadius: number; collisionHeight: number; scale: number; body: number; belly: number; wing: number; glow: number }
> = {
  dragon: {
    name: "용",
    maxHp: DRAGON_MAX_HP,
    armor: DRAGON_ARMOR,
    fireDamage: 8,
    clawDamage: 9,
    attackRange: 28,
    collisionRadius: 4.2,
    collisionHeight: 5.4,
    scale: 1.08,
    body: 0x8f1d2c,
    belly: 0xf59e0b,
    wing: 0xef4444,
    glow: 0xff4a1f,
  },
  fire_dragon: {
    name: "파이어 드래곤",
    maxHp: 700,
    armor: 62,
    fireDamage: 14,
    clawDamage: 13,
    attackRange: 31,
    collisionRadius: 4.8,
    collisionHeight: 6.1,
    scale: 1.22,
    body: 0xc2410c,
    belly: 0xffd166,
    wing: 0xff6b1a,
    glow: 0xff7a1a,
  },
  red_dragon: {
    name: "레드 드래곤",
    maxHp: 900,
    armor: 78,
    fireDamage: 18,
    clawDamage: 16,
    attackRange: 34,
    collisionRadius: 5.1,
    collisionHeight: 6.5,
    scale: 1.32,
    body: 0x991b1b,
    belly: 0xf97316,
    wing: 0xdc2626,
    glow: 0xff2d2d,
  },
  laser_dragon: {
    name: "레이저 드래곤",
    maxHp: 1150,
    armor: 90,
    fireDamage: 25,
    clawDamage: 19,
    attackRange: 42,
    collisionRadius: 5.4,
    collisionHeight: 6.8,
    scale: 1.4,
    body: 0x155e75,
    belly: 0x67e8f9,
    wing: 0x22d3ee,
    glow: 0x4adeff,
  },
  dark_dragon: {
    name: "다크 드래곤",
    maxHp: 1450,
    armor: 90,
    fireDamage: 34,
    clawDamage: 26,
    attackRange: 45,
    collisionRadius: 5.8,
    collisionHeight: 7.2,
    scale: 1.5,
    body: 0x1f1235,
    belly: 0x6d28d9,
    wing: 0x4c1d95,
    glow: 0xa855f7,
  },
  immortal: {
    name: "불멸의 존재",
    maxHp: 2200,
    armor: 90,
    fireDamage: 46,
    clawDamage: 38,
    attackRange: 50,
    collisionRadius: 6.2,
    collisionHeight: 7.8,
    scale: 1.62,
    body: 0x111827,
    belly: 0x9ca3af,
    wing: 0x0f172a,
    glow: 0xf8fafc,
  },
};
