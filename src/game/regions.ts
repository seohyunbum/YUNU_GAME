import * as THREE from "three";
import { WORLD_SIZE } from "./constants";
import { MONSTER_DEFS, isPredatorMonster, type MonsterId } from "./monsters";
import type { BiomeKind } from "./types";

export interface RegionMonsterWeight {
  id: MonsterId;
  weight: number;
}

export interface Region {
  id: string;
  name: string;
  center: THREE.Vector3;
  radius: number;
  innerRadius?: number;
  level: number;
  levelRange: [number, number];
  biome: BiomeKind | "plains";
  lootTier: number;
  color: number;
  monsters: RegionMonsterWeight[];
}

export interface RegionWarningState {
  regionId: string | null;
  lastWarnAt: number;
}

export const REGIONS: Region[] = [
  {
    id: "bamboo_forest",
    name: "대나무 숲",
    center: new THREE.Vector3(185, 0, -115),
    radius: 68,
    level: 22,
    levelRange: [15, 30],
    biome: "bamboo",
    lootTier: 2,
    color: 0x22c55e,
    monsters: [{ id: "wolf", weight: 4 }, { id: "poison_spider", weight: 3 }, { id: "bat", weight: 3 }, { id: "scorpion", weight: 2 }, { id: "jammini", weight: 1 }],
  },
  {
    id: "mushroom_glen",
    name: "버섯 골",
    center: new THREE.Vector3(165, 0, 190),
    radius: 72,
    level: 38,
    levelRange: [30, 45],
    biome: "mushroom",
    lootTier: 3,
    color: 0xd946ef,
    monsters: [{ id: "red_wolf", weight: 4 }, { id: "giant_spider", weight: 3 }, { id: "bear", weight: 3 }, { id: "scorpion", weight: 2 }, { id: "poison_spider", weight: 1 }],
  },
  {
    id: "toxic_swamp",
    name: "독늪",
    center: new THREE.Vector3(-205, 0, 170),
    radius: 78,
    level: 52,
    levelRange: [45, 60],
    biome: "swamp",
    lootTier: 4,
    color: 0x15803d,
    monsters: [{ id: "swamp_spider_king", weight: 4 }, { id: "swamp_snake", weight: 4 }, { id: "giant_spider", weight: 2 }, { id: "red_wolf", weight: 1 }],
  },
  {
    id: "mountain_ridge",
    name: "산악",
    center: new THREE.Vector3(-210, 0, -160),
    radius: 82,
    level: 75,
    levelRange: [60, 90],
    biome: "mountain",
    lootTier: 5,
    color: 0x94a3b8,
    monsters: [{ id: "berserk_lion", weight: 4 }, { id: "dune_scorpion", weight: 3 }, { id: "lava_boar", weight: 2 }, { id: "lion", weight: 1 }],
  },
  {
    id: "snowfield",
    name: "설원",
    center: new THREE.Vector3(20, 0, -250),
    radius: 86,
    level: 110,
    levelRange: [90, 130],
    biome: "snow",
    lootTier: 5,
    color: 0x93c5fd,
    monsters: [{ id: "frost_wolf", weight: 4 }, { id: "ice_spider", weight: 3 }, { id: "frost_bear", weight: 3 }, { id: "wraith", weight: 2 }, { id: "berserk_lion", weight: 1 }],
  },
  {
    id: "bamboo_frontier_field",
    name: "대나무 개척 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 22,
    levelRange: [15, 30],
    biome: "bamboo",
    lootTier: 2,
    color: 0x16a34a,
    monsters: [{ id: "wolf", weight: 4 }, { id: "poison_spider", weight: 3 }, { id: "bat", weight: 2 }, { id: "scorpion", weight: 2 }, { id: "jammini", weight: 1 }],
  },
  {
    id: "mushroom_frontier_field",
    name: "버섯 골 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 38,
    levelRange: [30, 45],
    biome: "mushroom",
    lootTier: 3,
    color: 0xc026d3,
    monsters: [{ id: "red_wolf", weight: 4 }, { id: "giant_spider", weight: 3 }, { id: "bear", weight: 3 }, { id: "poison_spider", weight: 1 }],
  },
  {
    id: "swamp_frontier_field",
    name: "독늪 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 52,
    levelRange: [45, 60],
    biome: "swamp",
    lootTier: 4,
    color: 0x166534,
    monsters: [{ id: "swamp_spider_king", weight: 4 }, { id: "swamp_snake", weight: 3 }, { id: "giant_spider", weight: 2 }, { id: "red_wolf", weight: 1 }],
  },
  {
    id: "mountain_frontier_field",
    name: "산악 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 75,
    levelRange: [60, 90],
    biome: "mountain",
    lootTier: 5,
    color: 0x64748b,
    monsters: [{ id: "berserk_lion", weight: 4 }, { id: "dune_scorpion", weight: 3 }, { id: "lava_boar", weight: 2 }, { id: "lion", weight: 1 }],
  },
  {
    id: "snow_frontier_field",
    name: "설원 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 110,
    levelRange: [90, 130],
    biome: "snow",
    lootTier: 5,
    color: 0x60a5fa,
    monsters: [{ id: "frost_wolf", weight: 4 }, { id: "ice_spider", weight: 3 }, { id: "frost_bear", weight: 3 }, { id: "wraith", weight: 2 }, { id: "berserk_lion", weight: 1 }],
  },
  {
    id: "dragon_plains_roost",
    name: "새끼용 둥지터",
    center: new THREE.Vector3(160, 0, -120),
    radius: 92,
    level: 18,
    levelRange: [10, 25],
    biome: "plains",
    lootTier: 2,
    color: 0xbef264,
    monsters: [
      { id: "drake", weight: 5 },
      { id: "gale_drake", weight: 3 },
      { id: "rock_drake", weight: 2 },
      { id: "gold_drake", weight: 1 },
      { id: "bat", weight: 2 },
    ],
  },
  {
    id: "dragon_plains_field",
    name: "용용 사냥 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 16,
    levelRange: [10, 25],
    biome: "plains",
    lootTier: 2,
    color: 0xa3e635,
    monsters: [
      { id: "drake", weight: 4 },
      { id: "boar", weight: 3 },
      { id: "snake", weight: 3 },
      { id: "wolf", weight: 2 },
      { id: "gale_drake", weight: 2 },
      { id: "lion", weight: 1 },
      { id: "gold_drake", weight: 1 },
    ],
  },
  {
    id: "graveyard_core",
    name: "공동묘지 중심",
    center: new THREE.Vector3(150, 0, -130),
    radius: 96,
    level: 78,
    levelRange: [70, 85],
    biome: "graveyard",
    lootTier: 5,
    color: 0x84cc16,
    monsters: [
      { id: "zombie", weight: 4 },
      { id: "ghoul", weight: 3 },
      { id: "ghost", weight: 3 },
      { id: "grave_bat", weight: 2 },
    ],
  },
  {
    id: "graveyard_frontier_field",
    name: "묘지 안개 들판",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 78,
    levelRange: [70, 85],
    biome: "graveyard",
    lootTier: 5,
    color: 0x65a30d,
    monsters: [
      { id: "zombie", weight: 4 },
      { id: "grave_bat", weight: 3 },
      { id: "ghoul", weight: 2 },
      { id: "ghost", weight: 2 },
    ],
  },
  {
    id: "lava_outer",
    name: "용암 외곽",
    center: new THREE.Vector3(0, 0, 0),
    innerRadius: 285,
    radius: WORLD_SIZE / 2 - 18,
    level: 180,
    levelRange: [130, 300],
    biome: "lava",
    lootTier: 6,
    color: 0xef4444,
    monsters: [
      { id: "frost_wolf", weight: 3 },
      { id: "ice_spider", weight: 3 },
      { id: "berserk_lion", weight: 2 },
      { id: "dragon", weight: 1 },
      { id: "fire_dragon", weight: 1 },
      { id: "red_dragon", weight: 1 },
      { id: "laser_dragon", weight: 1 },
      { id: "dark_dragon", weight: 1 },
      { id: "immortal", weight: 1 },
    ],
  },
  {
    id: "dragon_frontier_field",
    name: "용암 황무지",
    center: new THREE.Vector3(0, 0, 0),
    radius: WORLD_SIZE / 2 - 18,
    level: 180,
    levelRange: [130, 300],
    biome: "lava",
    lootTier: 6,
    color: 0xdc2626,
    monsters: [
      { id: "frost_wolf", weight: 2 },
      { id: "ice_spider", weight: 2 },
      { id: "berserk_lion", weight: 2 },
      { id: "dragon", weight: 1 },
      { id: "fire_dragon", weight: 1 },
      { id: "red_dragon", weight: 1 },
      { id: "laser_dragon", weight: 1 },
      { id: "dark_dragon", weight: 1 },
      { id: "immortal", weight: 1 },
    ],
  },
  {
    id: "wild_fields",
    name: "야생 들판",
    center: new THREE.Vector3(0, 0, 0),
    innerRadius: 260,
    radius: WORLD_SIZE / 2 - 18,
    level: 14,
    levelRange: [10, 18],
    biome: "plains",
    lootTier: 2,
    color: 0x84cc16,
    monsters: [{ id: "wolf", weight: 3 }, { id: "spider", weight: 3 }, { id: "boar", weight: 3 }, { id: "snake", weight: 2 }, { id: "lion", weight: 1 }],
  },
  {
    id: "central_plains",
    name: "중앙 평원",
    center: new THREE.Vector3(0, 0, 0),
    radius: 260,
    level: 6,
    levelRange: [1, 10],
    biome: "plains",
    lootTier: 1,
    color: 0x6ee7b7,
    monsters: [{ id: "spider", weight: 5 }, { id: "boar", weight: 2 }, { id: "wolf", weight: 2 }],
  },
];

export function containsRegion(region: Region, point: THREE.Vector3, margin = 0) {
  const distance = Math.hypot(point.x - region.center.x, point.z - region.center.z);
  return distance <= region.radius + margin && distance >= (region.innerRadius ?? 0) - margin;
}

export function regionAtPosition(point: THREE.Vector3, regions: readonly Region[] = REGIONS) {
  return regions.find((region) => containsRegion(region, point)) ?? null;
}

export function getRegionById(id?: string | null, regions: readonly Region[] = REGIONS) {
  return regions.find((region) => region.id === id) ?? null;
}

export function randomPointInRegion(region: Region) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const minRadius = region.innerRadius ?? 0;
    const radius = THREE.MathUtils.randFloat(minRadius + 2, region.radius - 2);
    const point = new THREE.Vector3(region.center.x + Math.cos(angle) * radius, 0, region.center.z + Math.sin(angle) * radius);
    if (containsRegion(region, point, -1)) return point;
  }
  return region.center.clone();
}

export function clampPointToRegion(point: THREE.Vector3, region: Region, margin = 2) {
  const offsetX = point.x - region.center.x;
  const offsetZ = point.z - region.center.z;
  const distance = Math.hypot(offsetX, offsetZ);
  if (distance <= 0.001) return point;
  const minDistance = (region.innerRadius ?? 0) + margin;
  const maxDistance = region.radius - margin;
  const clampedDistance = THREE.MathUtils.clamp(distance, minDistance, maxDistance);
  if (Math.abs(clampedDistance - distance) < 0.001) return point;
  point.x = region.center.x + (offsetX / distance) * clampedDistance;
  point.z = region.center.z + (offsetZ / distance) * clampedDistance;
  return point;
}

export function chooseWeightedMonster(monsters: readonly RegionMonsterWeight[]) {
  const total = monsters.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = Math.random() * Math.max(1, total);
  for (const entry of monsters) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.id;
  }
  return monsters[0]?.id ?? "spider";
}

export function chooseRegionPredatorMonster(region: Region | null) {
  const candidates = (region ?? REGIONS[REGIONS.length - 1]).monsters.filter((entry) => isPredatorMonster(entry.id));
  return chooseWeightedMonster(candidates.length > 0 ? candidates : [{ id: "spider", weight: 1 }]);
}

export function regionLootChanceScale(region: Region | null) {
  return 1 + Math.max(0, (region?.lootTier ?? 1) - 1) * 0.08;
}

export function maybeWarnRegionLevel(
  state: RegionWarningState,
  point: THREE.Vector3,
  playerLevel: number,
  nowMs: number,
  showMessage: (message: string) => void,
  regions: readonly Region[] = REGIONS,
) {
  const region = regionAtPosition(point, regions);
  if (!region) return { regionId: null, lastWarnAt: state.lastWarnAt };
  const dangerGap = region.level - playerLevel;
  const shouldWarn = dangerGap >= 10 && (region.id !== state.regionId || nowMs - state.lastWarnAt >= 5_000);
  if (shouldWarn) {
    showMessage(`${region.name} 권장 Lv ${region.levelRange[0]}-${region.levelRange[1]} 지역입니다. 현재 Lv ${playerLevel}, 후퇴하면 안전합니다.`);
    return { regionId: region.id, lastWarnAt: nowMs };
  }
  return { regionId: region.id, lastWarnAt: state.lastWarnAt };
}

export function regionMonsterNames(region: Region) {
  return region.monsters.map((entry) => MONSTER_DEFS[entry.id].name);
}
