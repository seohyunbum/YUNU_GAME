import * as THREE from "three";
import type { BiomeConfig, WorldMapId } from "./types";

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
  ],
  bamboo_frontier: [
    b("bamboo", 185, -115, 88),
    b("bamboo", -210, 170, 72),
    b("mountain", -280, -230, 42),
  ],
  mushroom_glen: [
    b("mushroom", 165, 190, 84),
    b("mushroom", -255, -120, 62),
    b("swamp", -285, 230, 36),
  ],
  toxic_swamp: [
    b("swamp", -205, 170, 92),
    b("swamp", 265, -160, 68),
    b("mushroom", 210, 260, 42),
  ],
  mountain_ridge: [
    b("mountain", -210, -160, 108),
    b("mountain", 240, 210, 78),
    b("snow", 20, -290, 46),
  ],
  snowfield: [
    b("snow", 20, -250, 118),
    b("snow", -260, 210, 82),
    b("mountain", 275, -185, 56),
  ],
  dragon_lands: [
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
};

export const WATER_ZONES_BY_WORLD_MAP: Record<WorldMapId, WaterZone[]> = {
  starter_valley: [w(-58, -46, 23, "호수"), w(112, 78, 17, "작은 호수"), w(-330, 315, 68, "바다")],
  bamboo_frontier: [w(-310, 290, 54, "대나무 호수"), w(320, 130, 34, "맑은 연못")],
  mushroom_glen: [w(-300, 260, 46, "보랏빛 호수"), w(270, -250, 28, "버섯 연못")],
  toxic_swamp: [w(-260, 250, 58, "늪 호수"), w(315, -300, 42, "진흙 연못")],
  mountain_ridge: [w(320, -280, 38, "산정 호수"), w(-330, 300, 32, "계곡 물웅덩이")],
  snowfield: [w(-315, -280, 44, "얼음 호수"), w(330, 260, 38, "눈녹은 연못")],
  dragon_lands: [w(-360, 310, 32, "뜨거운 샘")],
};

export const BIOMES = BIOMES_BY_WORLD_MAP.starter_valley;
export const WATER_ZONES = WATER_ZONES_BY_WORLD_MAP.starter_valley;
export const WATER_RADIUS_MULTIPLIER = 2;

export function biomesForWorldMap(id: WorldMapId) {
  return BIOMES_BY_WORLD_MAP[id] ?? BIOMES_BY_WORLD_MAP.starter_valley;
}

export function waterZonesForWorldMap(id: WorldMapId) {
  return WATER_ZONES_BY_WORLD_MAP[id] ?? WATER_ZONES_BY_WORLD_MAP.starter_valley;
}
