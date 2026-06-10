import * as THREE from "three";
import { REGIONS, type Region } from "./regions";
import type { WorldMapId } from "./types";

export interface WorldMapDefinition {
  id: WorldMapId;
  name: string;
  description: string;
  levelRange: [number, number];
  regionIds: readonly string[];
  spawn: THREE.Vector3;
}

export const DEFAULT_WORLD_MAP_ID: WorldMapId = "starter_valley";
export const MAX_TELEPORT_LEVEL_GAP = 20;

export const WORLD_MAPS: readonly WorldMapDefinition[] = [
  {
    id: "starter_valley",
    name: "시작 초원",
    description: "초반 자원과 낮은 레벨 야생동물이 있는 안전한 첫 번째 맵입니다.",
    levelRange: [1, 18],
    regionIds: ["central_plains", "wild_fields"],
    spawn: new THREE.Vector3(0, 0, 12),
  },
  {
    id: "bamboo_frontier",
    name: "대나무 개척지",
    description: "대나무 숲과 철/구리 자원을 준비하는 초중반 원정 맵입니다.",
    levelRange: [15, 30],
    regionIds: ["bamboo_forest", "bamboo_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "mushroom_glen",
    name: "버섯 골 원정지",
    description: "독버섯 지형과 금/다이아몬드 가루를 노리는 중반 맵입니다.",
    levelRange: [30, 45],
    regionIds: ["mushroom_glen", "mushroom_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "toxic_swamp",
    name: "독늪 원정지",
    description: "맹독 계열 적과 흑요석 가루를 준비하는 고난도 진입 맵입니다.",
    levelRange: [45, 60],
    regionIds: ["toxic_swamp", "swamp_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "mountain_ridge",
    name: "산악 원정지",
    description: "강한 사자와 산악 자원이 나오는 상급 성장 맵입니다.",
    levelRange: [60, 90],
    regionIds: ["mountain_ridge", "mountain_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "graveyard",
    name: "공동묘지 원정지",
    description: "좀비와 귀신이 떠도는 언데드 원정 맵입니다. 초록 손이 보이는 무덤을 조심하세요.",
    levelRange: [70, 85],
    regionIds: ["graveyard_core", "graveyard_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "snowfield",
    name: "설원 원정지",
    description: "서리 계열 몬스터가 있는 최상급 진입 맵입니다.",
    levelRange: [90, 130],
    regionIds: ["snowfield", "snow_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
  {
    id: "dragon_lands",
    name: "용암 용의 땅",
    description: "용과 최종 보스 루트가 열리는 최종 원정 맵입니다.",
    levelRange: [130, 300],
    regionIds: ["lava_outer", "dragon_frontier_field"],
    spawn: new THREE.Vector3(0, 0, 18),
  },
];

export function isWorldMapId(value: unknown): value is WorldMapId {
  return typeof value === "string" && WORLD_MAPS.some((map) => map.id === value);
}

export function getWorldMapById(id: WorldMapId | string | null | undefined) {
  return WORLD_MAPS.find((map) => map.id === id) ?? WORLD_MAPS[0];
}

export function regionsForWorldMap(id: WorldMapId | string | null | undefined): Region[] {
  const allowed = new Set(getWorldMapById(id).regionIds);
  return REGIONS.filter((region) => allowed.has(region.id));
}

export function canTeleportToWorldMap(playerLevel: number, map: WorldMapDefinition) {
  return map.id === DEFAULT_WORLD_MAP_ID || map.levelRange[0] - playerLevel <= MAX_TELEPORT_LEVEL_GAP;
}

export function worldMapLockReason(playerLevel: number, map: WorldMapDefinition) {
  if (canTeleportToWorldMap(playerLevel, map)) return "";
  return `현재 Lv ${playerLevel}. 권장 Lv ${map.levelRange[0]} 이상 맵이라 아직 텔레포트할 수 없습니다.`;
}
