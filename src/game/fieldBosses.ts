// 맵 필드 보스 — 최종맵(dragon_lands)을 제외한 모든 맵에 1마리씩.
// 그 맵 레벨 구간의 최대 레벨로 보스 공식 스탯(공/방/체)을 받고, 지도에 표시되며,
// 한 번 처치하면 세이브에 기록되어 다시 스폰되지 않는다. 세이브에는 보스 오브젝트
// 자체를 저장하지 않고(체력 리셋 허용) "처치 기록"만 저장한다 — 스폰은 매 프레임 ensure.
import * as THREE from "three";
import { MONSTER_DEFS, monsterStatsFromLevel, type MonsterId } from "./monsters";
import { addBossRegalia, bossRegaliaPalette } from "./bossArmorVisuals";
import { getWorldMapById } from "./worldMaps";
import type { ItemId, LocationMode, PredatorKind, WorldMapId, WorldObject } from "./types";

export interface FieldBossDef {
  id: string;
  mapId: WorldMapId;
  name: string;
  monsterId: MonsterId; // 외형/종 베이스
  level: number; // 맵 레벨 구간의 최대 레벨 + 8 (보스 상향)
  scale: number;
  tint: number;
  position: [number, number];
  rewardExperience: number;
  rewardItems: Partial<Record<ItemId, number>>;
  rewardLabel: string;
  chaseSpeedBonus?: number; // 이 보스만 추격 속도 가산(곰 족장·좀비 군주 +0.5)
}

export const FIELD_BOSSES: readonly FieldBossDef[] = [
  { id: "boss_starter_valley", mapId: "starter_valley", name: "멧돼지 대왕", monsterId: "boar", level: 26, scale: 2.2, tint: 0x7c2d12, position: [120, -95], rewardExperience: 240, rewardItems: { iron: 5, medkit: 2 }, rewardLabel: "경험치 240 + 철 5개 + 구급상자 2개", chaseSpeedBonus: 0.68 },
  { id: "boss_dragon_plains", mapId: "dragon_plains", name: "새끼용 여왕", monsterId: "gold_drake", level: 33, scale: 2.1, tint: 0xfacc15, position: [170, -130], rewardExperience: 400, rewardItems: { gold: 4, medkit: 2 }, rewardLabel: "경험치 400 + 금 4개 + 구급상자 2개", chaseSpeedBonus: 0.93 },
  { id: "boss_bamboo_frontier", mapId: "bamboo_frontier", name: "왕전갈", monsterId: "scorpion", level: 38, scale: 2.3, tint: 0x15803d, position: [185, -115], rewardExperience: 560, rewardItems: { diamond: 1, iron: 6 }, rewardLabel: "경험치 560 + 다이아몬드 1개 + 철 6개", chaseSpeedBonus: 0.52 },
  { id: "boss_mushroom_glen", mapId: "mushroom_glen", name: "곰 족장", monsterId: "bear", level: 53, scale: 2.0, tint: 0xa21caf, position: [165, 190], rewardExperience: 800, rewardItems: { diamond: 2, medkit: 3 }, rewardLabel: "경험치 800 + 다이아몬드 2개 + 구급상자 3개", chaseSpeedBonus: 1.14 },
  { id: "boss_toxic_swamp", mapId: "toxic_swamp", name: "늪의 제왕 독사", monsterId: "swamp_snake", level: 68, scale: 2.6, tint: 0x16a34a, position: [-205, 170], rewardExperience: 1120, rewardItems: { obsidian: 2, diamond: 2 }, rewardLabel: "경험치 1120 + 흑요석 2개 + 다이아몬드 2개", chaseSpeedBonus: 1.05 },
  { id: "boss_graveyard", mapId: "graveyard", name: "좀비 군주", monsterId: "zombie", level: 93, scale: 2.2, tint: 0x365314, position: [150, -130], rewardExperience: 1600, rewardItems: { obsidian: 4, medkit: 5 }, rewardLabel: "경험치 1600 + 흑요석 4개 + 구급상자 5개", chaseSpeedBonus: 1.03 },
  { id: "boss_mountain_ridge", mapId: "mountain_ridge", name: "산악 사자왕", monsterId: "berserk_lion", level: 98, scale: 2.3, tint: 0xf59e0b, position: [-210, -160], rewardExperience: 1800, rewardItems: { dragon_scale: 2, obsidian: 3 }, rewardLabel: "경험치 1800 + 용의 비늘 2개 + 흑요석 3개", chaseSpeedBonus: 1.08 },
  { id: "boss_snowfield", mapId: "snowfield", name: "서리곰 대군주", monsterId: "frost_bear", level: 138, scale: 2.5, tint: 0x60a5fa, position: [20, -250], rewardExperience: 2800, rewardItems: { dragon_horn: 1, diamond: 5 }, rewardLabel: "경험치 2800 + 용의 뿔 1개 + 다이아몬드 5개", chaseSpeedBonus: 1.08 },
];

export function fieldBossForMap(mapId: WorldMapId): FieldBossDef | null {
  return FIELD_BOSSES.find((def) => def.mapId === mapId) ?? null;
}

export function fieldBossById(id: string): FieldBossDef | null {
  return FIELD_BOSSES.find((def) => def.id === id) ?? null;
}

export function normalizeDefeatedFieldBosses(source: unknown): string[] {
  if (!Array.isArray(source)) return [];
  return [...new Set(source.filter((id): id is string => typeof id === "string" && FIELD_BOSSES.some((def) => def.id === id)))];
}

export function fieldBossDefeatMessage(id: string): string {
  const def = fieldBossById(id);
  return def ? `🎇 ${def.name} 토벌! 목표창에서 퀘스트 보상을 받으세요.` : "🎇 맵 보스를 토벌했습니다!";
}

// 목표(퀘스트) 뷰 — objectives.currentObjective 가 소비한다
export interface FieldBossQuestView {
  id: string;
  bossName: string;
  mapName: string;
  level: number;
  defeated: boolean;
  rewardExperience: number;
  rewardItems: Partial<Record<ItemId, number>>;
  rewardLabel: string;
}

export function fieldBossQuestFor(mapId: WorldMapId, defeatedFieldBosses: readonly string[]): FieldBossQuestView | null {
  const def = fieldBossForMap(mapId);
  if (!def) return null;
  return {
    id: def.id,
    bossName: def.name,
    mapName: getWorldMapById(def.mapId).name,
    level: def.level,
    defeated: defeatedFieldBosses.includes(def.id),
    rewardExperience: def.rewardExperience,
    rewardItems: def.rewardItems,
    rewardLabel: def.rewardLabel,
  };
}

// 외형·스탯 적용 — 스폰 직후 1회
export function applyFieldBossDefinition(object: WorldObject, def: FieldBossDef) {
  const stats = monsterStatsFromLevel(def.level, true);
  object.name = def.name;
  object.hp = stats.hp;
  object.armor = stats.armor;
  object.attackDamage = stats.attackDamage;
  object.speedBonus = def.chaseSpeedBonus; // 보스별 추격 속도 가산(없으면 undefined → 0)
  object.attackRange = 18; // 어그로 범위
  object.monsterId = def.monsterId;
  object.monsterLevel = def.level;
  object.lootTier = 6;
  object.fieldBossId = def.id;
  object.collisionRadius = (object.collisionRadius ?? 1) * def.scale;
  object.collisionHeight = (object.collisionHeight ?? 1.5) * def.scale;
  // 베이스 메시 색만 보스 tint 로 물들이고(regalia 는 제외), 그 위에 악마 군주 regalia 를 덧씌운다.
  object.root.traverse((child) => {
    if (child.userData.bossRegalia) return;
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(def.tint), 0.4);
      child.material.emissive.lerp(new THREE.Color(def.tint), 0.14);
    }
  });
  addBossRegalia(object.root, bossRegaliaPalette(def.tint)); // 측정→배치 후, 아래 scale 로 보스와 함께 비례 확대
  object.root.scale.multiplyScalar(def.scale);
  return object;
}

export interface FieldBossContext {
  locationMode(): LocationMode;
  worldMapId(): WorldMapId;
  defeatedFieldBosses(): readonly string[];
  liveFieldBoss(): WorldObject | null;
  spawnPredator(kind: PredatorKind, position: THREE.Vector3): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
}

const spawnPoint = new THREE.Vector3();

// 매 프레임 ensure — 현재 맵의 보스가 "미처치 + 부재"면 정위치에 스폰한다 (세이브 복원·맵 이동 모두 커버)
export function updateFieldBosses(context: FieldBossContext) {
  if (context.locationMode() !== "overworld") return;
  const def = fieldBossForMap(context.worldMapId());
  if (!def || context.defeatedFieldBosses().includes(def.id) || context.liveFieldBoss()) return;
  spawnPoint.set(def.position[0], 0, def.position[1]);
  spawnPoint.y = context.getGroundHeightAt(spawnPoint.x, spawnPoint.z);
  const kind = MONSTER_DEFS[def.monsterId].predatorKind ?? "wolf";
  applyFieldBossDefinition(context.spawnPredator(kind, spawnPoint), def);
}
