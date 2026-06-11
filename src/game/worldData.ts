import * as THREE from "three";
import type { BiomeConfig, TerrainKind, WorldMapId } from "./types";

export interface WaterZone {
  center: THREE.Vector3;
  radius: number;
  name: string;
}

const MAP_SCALE = 2;
const v = (x: number, z: number) => new THREE.Vector3(x * MAP_SCALE, 0, z * MAP_SCALE);
const b = (kind: BiomeConfig["kind"], x: number, z: number, radius: number): BiomeConfig => ({ kind, center: v(x, z), radius: radius * MAP_SCALE });
const w = (x: number, z: number, radius: number, name: string): WaterZone => ({ center: v(x, z), radius: radius * MAP_SCALE, name });

export const BIOMES_BY_WORLD_MAP: Record<WorldMapId, BiomeConfig[]> = {
  starter_valley: [
    b("bamboo", 245, -160, 32),
    b("mountain", -240, -220, 36),
    b("mushroom", 230, 210, 26),
    b("flower", -85, 130, 26),
    b("flower", 150, -70, 22),
    b("flower", -190, 30, 20),
  ],
  dragon_plains: [
    b("mountain", -280, -240, 34),
    b("savanna", 0, 0, 115),
    b("savanna", 205, -75, 95),
    b("savanna", -190, 125, 100),
    b("savanna", 125, 205, 85),
    b("savanna", -130, -165, 90),
    b("savanna", 295, 95, 75),
    b("savanna", -300, 280, 80),
  ],
  bamboo_frontier: [
    b("bamboo", 185, -115, 88),
    b("bamboo", -210, 170, 72),
    b("bamboo", 0, -10, 74),
    b("bamboo", 95, 255, 64),
    b("bamboo", -75, -265, 66),
    b("mountain", -280, -230, 42),
  ],
  mushroom_glen: [
    b("mushroom", 165, 190, 84),
    b("mushroom", -255, -120, 62),
    b("mushroom", 0, 25, 80),
    b("mushroom", 275, -55, 62),
    b("mushroom", -85, -280, 64),
    b("swamp", -285, 230, 36),
  ],
  toxic_swamp: [
    b("swamp", -205, 170, 92),
    b("swamp", 265, -160, 68),
    b("swamp", 25, -35, 88),
    b("swamp", -255, -135, 70),
    b("swamp", 90, 290, 66),
    b("swamp", -45, -300, 62),
    b("mushroom", 210, 260, 42),
  ],
  mountain_ridge: [
    b("mountain", -210, -160, 108),
    b("mountain", 240, 210, 78),
    b("mountain", 35, 35, 72),
    b("mountain", 300, -70, 66),
    b("mountain", -290, 215, 62),
    b("snow", 20, -290, 46),
    b("snow", -90, -115, 40),
  ],
  snowfield: [
    b("snow", 20, -250, 118),
    b("snow", -260, 210, 82),
    b("snow", 0, -20, 105),
    b("snow", -175, -170, 85),
    b("snow", 255, 55, 82),
    b("snow", 140, 290, 78),
    b("snow", -320, -45, 68),
    b("snow", -55, 330, 66),
    b("mountain", 275, -185, 56),
  ],
  dragon_lands: [
    b("lava", 0, 0, 72),
    b("lava", 145, 150, 64),
    b("lava", -150, 85, 62),
    b("lava", 65, -165, 62),
    b("lava", -85, -95, 58),
    b("lava", 305, -268, 96),
    b("lava", -310, -245, 78),
    b("lava", 295, 250, 74),
    b("lava", 370, 72, 70),
    b("lava", -370, 36, 72),
    b("lava", 78, 340, 68),
    b("lava", -98, -360, 68),
    b("lava", 420, -125, 64),
    b("lava", 220, -390, 62),
    b("lava", -410, -372, 66),
    b("lava", -420, 145, 62),
    b("lava", 410, 350, 62),
    b("lava", -22, 404, 62),
    b("lava", 420, -392, 60),
    b("lava", -175, 410, 60),
  ],
  graveyard: [
    b("graveyard", 0, 40, 72),
    b("graveyard", 150, -130, 96),
    b("graveyard", -190, 150, 84),
    b("graveyard", -230, -210, 64),
    b("graveyard", 240, 215, 60),
    b("graveyard", 40, 320, 54),
    b("mountain", 360, -40, 40),
  ],
};

export const WATER_ZONES_BY_WORLD_MAP: Record<WorldMapId, WaterZone[]> = {
  starter_valley: [w(-58, -46, 23, "호수"), w(112, 78, 17, "작은 호수"), w(-330, 315, 68, "바다")],
  dragon_plains: [w(-80, 60, 20, "용용 연못"), w(260, -240, 26, "비늘 호수")],
  bamboo_frontier: [w(-310, 290, 54, "대나무 호수"), w(320, 130, 34, "맑은 연못")],
  mushroom_glen: [w(-300, 260, 46, "보랏빛 호수"), w(270, -250, 28, "버섯 연못")],
  toxic_swamp: [w(-260, 250, 58, "늪 호수"), w(315, -300, 42, "진흙 연못")],
  mountain_ridge: [w(320, -280, 38, "산정 호수"), w(-330, 300, 32, "계곡 물웅덩이")],
  snowfield: [w(-315, -280, 44, "얼음 호수"), w(330, 260, 38, "눈녹은 연못")],
  dragon_lands: [w(-360, 310, 32, "뜨거운 샘")],
  graveyard: [w(-60, -40, 24, "안개 늪"), w(300, -300, 30, "검은 연못")],
};

export const BIOMES = BIOMES_BY_WORLD_MAP.starter_valley;
export const WATER_ZONES = WATER_ZONES_BY_WORLD_MAP.starter_valley;
export const WATER_RADIUS_MULTIPLIER = 2;

// 바이옴 종류별 바닥 지형 계획 — main.spawnBiomeTerrains 가 데이터로 소비한다.
// 신규 바이옴은 여기(+biomeDecor)에만 추가하면 된다.
export interface BiomeTerrainPatchPlan {
  terrain: TerrainKind;
  radiusScale: number;
  raised: boolean;
  offset?: [number, number];
}

export interface BiomeTerrainPlan {
  patches: BiomeTerrainPatchPlan[];
  mountains?: { count: number; height: [number, number]; radius: [number, number] };
}

export const BIOME_TERRAIN_PLANS: Record<BiomeConfig["kind"], BiomeTerrainPlan> = {
  bamboo: { patches: [{ terrain: "grass", radiusScale: 1, raised: false }] },
  mountain: {
    patches: [
      { terrain: "stone", radiusScale: 0.55, raised: true },
      { terrain: "ore", radiusScale: 0.24, raised: true, offset: [18, -12] },
    ],
    mountains: { count: 4, height: [18, 34], radius: [7, 17] },
  },
  mushroom: { patches: [{ terrain: "dirt", radiusScale: 1, raised: false }] },
  swamp: { patches: [{ terrain: "swamp", radiusScale: 1, raised: false }] },
  snow: {
    patches: [
      { terrain: "snow", radiusScale: 1, raised: false },
      { terrain: "stone", radiusScale: 0.24, raised: true, offset: [-14, 11] },
    ],
  },
  lava: {
    patches: [
      { terrain: "lava", radiusScale: 1, raised: false },
      { terrain: "stone", radiusScale: 0.36, raised: true, offset: [16, -10] },
    ],
    mountains: { count: 3, height: [11, 22], radius: [4, 10] },
  },
  graveyard: { patches: [{ terrain: "dirt", radiusScale: 1, raised: false }] },
  // 사바나 — 마른 황금빛 초원. 둥지/바위첨탑 데코는 biomeDecor 가 담당
  savanna: { patches: [{ terrain: "savanna", radiusScale: 1, raised: false }] },
  // 꽃밭 — 바닥은 잔디 그대로, 꽃 데코만 깔린다
  flower: { patches: [{ terrain: "grass", radiusScale: 1, raised: false }] },
};

// 지형 패치 색/이름 — main.spawnTerrainPatch 가 소비 (이동: main.ts → leaf)
export const TERRAIN_COLORS: Record<TerrainKind, number> = {
  grass: 0x4f8f49,
  dirt: 0x8a5a32,
  stone: 0x7d858b,
  ore: 0x5c6670,
  snow: 0xdcecf1,
  swamp: 0x6f6a3d,
  lava: 0xe64a19,
  savanna: 0xc9a753,
};

export const TERRAIN_NAMES: Record<string, string> = {
  grass: "잔디 지형",
  dirt: "흙 지역",
  stone: "돌 지형",
  ore: "광맥 지형",
  snow: "눈밭",
  swamp: "늪지대",
  lava: "용암 지대",
  savanna: "마른 초원",
};

export function biomesForWorldMap(id: WorldMapId) {
  return BIOMES_BY_WORLD_MAP[id] ?? BIOMES_BY_WORLD_MAP.starter_valley;
}

export function waterZonesForWorldMap(id: WorldMapId) {
  return WATER_ZONES_BY_WORLD_MAP[id] ?? WATER_ZONES_BY_WORLD_MAP.starter_valley;
}
