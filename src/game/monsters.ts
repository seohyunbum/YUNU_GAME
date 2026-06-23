import * as THREE from "three";
import { DRAGON_MAX_HP, DRAGON_ARMOR } from "./constants";
import type { PredatorKind, BossKind, WorldObject } from "./types";

export const PREDATOR_STATS: Record<PredatorKind, { hp: number; attackDamage: number; aggroRange: number; strikeRange: number; speed: number; cooldown: number }> = {
  spider: { hp: 25, attackDamage: 3, aggroRange: 8, strikeRange: 1.7, speed: 3.2, cooldown: 1.45 },
  wolf: { hp: 65, attackDamage: 6, aggroRange: 13, strikeRange: 2.05, speed: 4.05, cooldown: 1.35 },
  lion: { hp: 78, attackDamage: 7, aggroRange: 15, strikeRange: 2.35, speed: 4.3, cooldown: 1.15 },
  boar: { hp: 48, attackDamage: 5, aggroRange: 11, strikeRange: 1.95, speed: 4.5, cooldown: 1.55 },
  snake: { hp: 42, attackDamage: 6, aggroRange: 9, strikeRange: 2.3, speed: 3.7, cooldown: 1.7 },
  bat: { hp: 50, attackDamage: 6, aggroRange: 17, strikeRange: 1.85, speed: 4.7, cooldown: 1.1 },
  scorpion: { hp: 120, attackDamage: 9, aggroRange: 10, strikeRange: 2.1, speed: 3.45, cooldown: 1.8 },
  bear: { hp: 200, attackDamage: 12, aggroRange: 12, strikeRange: 2.5, speed: 3.75, cooldown: 1.9 },
  zombie: { hp: 660, attackDamage: 28, aggroRange: 14, strikeRange: 1.95, speed: 3.0, cooldown: 1.5 },
  ghost: { hp: 500, attackDamage: 34, aggroRange: 18, strikeRange: 2.15, speed: 4.1, cooldown: 1.35 },
  drake: { hp: 70, attackDamage: 7, aggroRange: 13, strikeRange: 2.1, speed: 4.2, cooldown: 1.4 },
};

// 포식자 처치 전리품 — 종 특성에 맞는 재료 (양쪽 전투 경로가 공유)
export function predatorLootForKind(kind: PredatorKind | undefined): { item: "meat" | "coal" | "leather"; count: number } {
  if (kind === "spider" || kind === "bat" || kind === "ghost") return { item: "coal", count: 1 };
  if (kind === "zombie") return { item: "leather", count: 2 };
  if (kind === "lion" || kind === "bear") return { item: "meat", count: 3 };
  if (kind === "boar" || kind === "drake") return { item: "meat", count: 2 };
  return { item: "meat", count: 1 };
}

// 처치 경험치 — main.grantExperienceForTarget 가 소비하는 단일 표 (이동: main.ts → leaf)
export function experienceRewardForTarget(target: WorldObject): number {
  if (target.type === "animal") {
    if (target.animalKind === "chicken") return 4;
    if (target.animalKind === "pig" || target.animalKind === "cow") return 6;
    return 8;
  }
  if (target.type === "wildPredator") return predatorExperienceReward(target.predatorKind, target.monsterLevel);
  if (target.type === "jammini") return 75;
  if (target.type === "dragon") {
    const rewards: Record<BossKind, number> = {
      dragon: 500,
      fire_dragon: 900,
      red_dragon: 1300,
      laser_dragon: 1800,
      dark_dragon: 2400,
      immortal: 3500,
    };
    return rewards[target.bossKind ?? "dragon"];
  }
  if (target.type === "villageGolem") return 280;
  if (target.type === "villageMage" || target.type === "villageArcher") return 125;
  if (target.type === "villageKnight") return 110;
  return 0;
}

// 포식자 처치 경험치 — 기본 3종은 기존 수치를 보존하고, 변종/신규 종은 몬스터 레벨 비례(레벨×3).
export function predatorExperienceReward(kind: PredatorKind | undefined, monsterLevel?: number): number {
  if (kind === "spider" && !monsterLevel) return 18;
  if (kind === "wolf" && !monsterLevel) return 45;
  if (kind === "lion" && !monsterLevel) return 60;
  const level = monsterLevel ?? (kind && MONSTER_DEFS[kind as MonsterId] ? MONSTER_DEFS[kind as MonsterId].level : 8);
  // 50레벨 이상 몬스터 경험치 +10% (용/드래곤 보스는 type==="dragon" 으로 별도 처리되어 제외됨)
  const highLevelMult = level >= 50 ? 1.1 : 1;
  return Math.round(level * 3 * highLevelMult);
}

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
  | "boar"
  | "snake"
  | "bat"
  | "scorpion"
  | "bear"
  | "swamp_snake"
  | "dune_scorpion"
  | "lava_boar"
  | "zombie"
  | "grave_bat"
  | "ghoul"
  | "ghost"
  | "frost_bear"
  | "wraith"
  | "drake"
  | "gale_drake"
  | "rock_drake"
  | "gold_drake"
  | "hound"
  | "viper"
  | BossKind;

export type MonsterArchetype = "spider" | "wolf" | "lion" | "golem" | "dragon" | "jammini" | "boar" | "snake" | "bat" | "scorpion" | "bear" | "zombie" | "ghost" | "drake";

export interface MonsterDef {
  id: MonsterId;
  name: string;
  archetype: MonsterArchetype;
  level: number;
  tint: number;
  predatorKind?: PredatorKind;
  bossKind?: BossKind;
  // 레벨 공식 대신 강제할 스탯 (기획 수치 지정 몬스터용)
  statsOverride?: Partial<(typeof PREDATOR_STATS)[PredatorKind]>;
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
  boar: { id: "boar", name: "멧돼지", archetype: "boar", level: 8, tint: 0x8b5a33, predatorKind: "boar" },
  snake: { id: "snake", name: "풀숲뱀", archetype: "snake", level: 10, tint: 0x4d7c0f, predatorKind: "snake" },
  bat: { id: "bat", name: "동굴박쥐", archetype: "bat", level: 18, tint: 0x57534e, predatorKind: "bat" },
  scorpion: { id: "scorpion", name: "바위전갈", archetype: "scorpion", level: 25, tint: 0xa16207, predatorKind: "scorpion" },
  bear: { id: "bear", name: "불곰", archetype: "bear", level: 30, tint: 0x7c4a24, predatorKind: "bear" },
  swamp_snake: { id: "swamp_snake", name: "늪독사", archetype: "snake", level: 45, tint: 0x65a30d, predatorKind: "snake" },
  dune_scorpion: { id: "dune_scorpion", name: "모래전갈", archetype: "scorpion", level: 50, tint: 0xd9a441, predatorKind: "scorpion" },
  lava_boar: { id: "lava_boar", name: "용암멧돼지", archetype: "boar", level: 60, tint: 0xff5a1f, predatorKind: "boar" },
  zombie: { id: "zombie", name: "좀비", archetype: "zombie", level: 72, tint: 0x5b8a3c, predatorKind: "zombie" },
  grave_bat: { id: "grave_bat", name: "무덤박쥐", archetype: "bat", level: 75, tint: 0x6d28d9, predatorKind: "bat" },
  ghoul: { id: "ghoul", name: "구울", archetype: "zombie", level: 78, tint: 0x84cc16, predatorKind: "zombie" },
  ghost: { id: "ghost", name: "묘지귀신", archetype: "ghost", level: 80, tint: 0xc7d2fe, predatorKind: "ghost" },
  frost_bear: { id: "frost_bear", name: "서리곰", archetype: "bear", level: 95, tint: 0x93c5fd, predatorKind: "bear" },
  wraith: { id: "wraith", name: "망령", archetype: "ghost", level: 110, tint: 0x67e8f9, predatorKind: "ghost" },
  drake: { id: "drake", name: "풀빛 새끼용", archetype: "drake", level: 12, tint: 0x65a30d, predatorKind: "drake" },
  gale_drake: { id: "gale_drake", name: "바람 새끼용", archetype: "drake", level: 16, tint: 0x7dd3fc, predatorKind: "drake" },
  rock_drake: { id: "rock_drake", name: "바위 새끼용", archetype: "drake", level: 20, tint: 0xa8a29e, predatorKind: "drake" },
  gold_drake: { id: "gold_drake", name: "황금 새끼용", archetype: "drake", level: 24, tint: 0xfacc15, predatorKind: "drake" },
  hound: { id: "hound", name: "맹견", archetype: "wolf", level: 11, tint: 0x57423a, predatorKind: "wolf", statsOverride: { hp: 25, attackDamage: 6 } },
  viper: { id: "viper", name: "독사", archetype: "snake", level: 14, tint: 0xa21caf, predatorKind: "snake", statsOverride: { hp: 45, attackDamage: 8 } },
  dragon: { id: "dragon", name: "용", archetype: "dragon", level: 60, tint: 0xef4444, bossKind: "dragon" },
  fire_dragon: { id: "fire_dragon", name: "파이어 드래곤", archetype: "dragon", level: 130, tint: 0xff6b1a, bossKind: "fire_dragon" },
  red_dragon: { id: "red_dragon", name: "레드 드래곤", archetype: "dragon", level: 170, tint: 0xdc2626, bossKind: "red_dragon" },
  laser_dragon: { id: "laser_dragon", name: "레이저 드래곤", archetype: "dragon", level: 220, tint: 0x22d3ee, bossKind: "laser_dragon" },
  dark_dragon: { id: "dark_dragon", name: "다크 드래곤", archetype: "dragon", level: 260, tint: 0x6d28d9, bossKind: "dark_dragon" },
  immortal: { id: "immortal", name: "불멸의 존재", archetype: "dragon", level: 300, tint: 0xf8fafc, bossKind: "immortal" },
};

export function monsterStatsFromLevel(level: number, boss = false) {
  const safeLevel = Math.max(1, Math.floor(level));
  // 30+ 보정 — 레벨당 HP +2 로 후반 플레이어가 약 +74% 더 단단해진 만큼, 30레벨 이상 몬스터 공격을 완만히 상향.
  // 30에서 정확히 0(절벽 없음), 이후 0.2/레벨씩(예: 45→+3, 60→+6). 저레벨·챕터 보스(BOSS_STATS 하드코딩)는 무영향.
  const highLevelAtk = safeLevel >= 30 ? (safeLevel - 30) * 0.2 : 0;
  return {
    // 보스 대폭 상향(기존 수치 직접 상향): 체력 +100%(레벨계수 11→22), 공격 +20%(0.62→0.75), 방어 +30%(20·0.25→26·0.33). 일반몹(boss=false)은 불변.
    hp: Math.floor(18 + safeLevel * (boss ? 22 : 9)),
    attackDamage: Math.max(1, Math.floor(2 + safeLevel * (boss ? 0.75 : 0.65) + highLevelAtk)),
    armor: boss ? Math.floor(26 + safeLevel * 0.33) : 0,
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
  if (id === kind) return def.statsOverride ? { ...base, ...def.statsOverride } : base;
  const scaled = monsterStatsFromLevel(def.level);
  const result = {
    ...base,
    hp: Math.max(base.hp, scaled.hp),
    attackDamage: Math.max(base.attackDamage, scaled.attackDamage),
    aggroRange: Math.min(28, Math.max(base.aggroRange, 8 + def.level * 0.12)),
    // 레벨이 오를수록 추격이 빨라진다 — 상한 7.2(전체 +1 상향). 걷기(7) 보다 약간 빨라 고렙은 걸어선 못 벗어나고, 달리기(14)로만 도주 가능.
    speed: Math.min(base.speed * (1 + def.level * 0.02), 7.2),
    cooldown: Math.max(0.72, base.cooldown - def.level / 300),
  };
  return def.statsOverride ? { ...result, ...def.statsOverride } : result;
}

export function predatorBaseStats(kind: PredatorKind = "wolf", monsterId?: MonsterId) {
  return monsterId ? predatorStatsForMonster(monsterId, kind) : PREDATOR_STATS[kind] ?? PREDATOR_STATS.wolf;
}

export function predatorAggroRangeFor(kind: PredatorKind = "wolf") {
  return predatorBaseStats(kind).aggroRange;
}

export function predatorStrikeRangeFor(kind: PredatorKind = "wolf") {
  return predatorBaseStats(kind).strikeRange;
}

// 야외 로밍 스폰 레벨 캡 — 저렙이 고렙 지역에 들어가 원킬당하는 것 방지(#2). 보스/요새/파티동기는 호출 시 playerLevel 미전달로 면제.
export const ROAMING_LEVEL_CAP_OFFSET = 20; // 로밍 몬스터는 플레이어보다 최대 +20렙
export const ROAMING_CAP_GAP_THRESHOLD = 25; // 몬스터가 플레이어보다 이만큼 이상 높을 때만 캡(의도된 난이도 지역은 보존)
export function cappedRoamingLevel(defLevel: number, playerLevel: number): number {
  return defLevel - playerLevel > ROAMING_CAP_GAP_THRESHOLD ? playerLevel + ROAMING_LEVEL_CAP_OFFSET : defLevel;
}

export function applyPredatorMonsterDefinition(
  object: WorldObject,
  region: { id: string; lootTier: number },
  monsterId: MonsterId,
  playerLevel?: number, // 지정 시 야외 로밍 레벨 캡 적용(보스/요새/파티동기는 미전달=면제)
) {
  const def = MONSTER_DEFS[monsterId];
  if (!def.predatorKind) return object;
  const level = playerLevel !== undefined ? cappedRoamingLevel(def.level, playerLevel) : def.level;
  const stats = predatorStatsForMonster(monsterId, def.predatorKind);
  let hp = stats.hp;
  let attackDamage = stats.attackDamage;
  if (level < def.level) { const scaled = monsterStatsFromLevel(level); hp = Math.min(hp, scaled.hp); attackDamage = Math.min(attackDamage, scaled.attackDamage); } // 캡 시 hp/공격력만 레벨에 맞춰 하향(공유 stats 객체는 변형하지 않음)
  object.name = def.name;
  object.hp = hp;
  object.armor = 0;
  object.attackDamage = attackDamage;
  object.attackRange = stats.aggroRange;
  object.regionId = region.id;
  object.monsterId = monsterId;
  object.monsterLevel = level;
  object.lootTier = region.lootTier;
  // 고렙(50+)일수록 종족색 발광을 강하게 — 엘리트 오라처럼 한눈에 "센 놈"이 보이게(캡 적용 후 레벨 기준).
  const elite = level >= 50;
  const tintLerp = elite ? 0.5 : 0.35;
  const emissiveLerp = elite ? 0.34 : 0.08;
  const emissiveIntensity = elite ? Math.min(1.0, 0.3 + (level - 50) / 150) : null; // 50렙 0.3 → 최고렙 ~1.0
  object.root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(def.tint), tintLerp);
      child.material.emissive.lerp(new THREE.Color(def.tint), emissiveLerp);
      if (emissiveIntensity !== null) child.material.emissiveIntensity = emissiveIntensity;
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
    fireDamage: 12,
    clawDamage: 13,
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
    maxHp: 1400,
    armor: 81,
    fireDamage: 20,
    clawDamage: 18,
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
    maxHp: 1800,
    armor: 101,
    fireDamage: 28,
    clawDamage: 24,
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
    maxHp: 2300,
    armor: 117,
    fireDamage: 37,
    clawDamage: 29,
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
    maxHp: 2900,
    armor: 117,
    fireDamage: 50,
    clawDamage: 38,
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
    maxHp: 4400,
    armor: 117,
    fireDamage: 67,
    clawDamage: 55,
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
