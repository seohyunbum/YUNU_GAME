import * as THREE from "three";
import type { BiomeConfig } from "./types";

export const BIOMES: BiomeConfig[] = [
  { kind: "bamboo", center: new THREE.Vector3(185, 0, -115), radius: 44 },
  { kind: "mountain", center: new THREE.Vector3(-210, 0, -160), radius: 58 },
  { kind: "mushroom", center: new THREE.Vector3(165, 0, 190), radius: 38 },
  { kind: "swamp", center: new THREE.Vector3(-205, 0, 170), radius: 46 },
  { kind: "snow", center: new THREE.Vector3(20, 0, -250), radius: 54 },
  { kind: "lava", center: new THREE.Vector3(305, 0, -268), radius: 62 },
  { kind: "lava", center: new THREE.Vector3(-310, 0, -245), radius: 44 },
  { kind: "lava", center: new THREE.Vector3(295, 0, 250), radius: 42 },
  { kind: "lava", center: new THREE.Vector3(370, 0, 72), radius: 40 },
  { kind: "lava", center: new THREE.Vector3(-370, 0, 36), radius: 42 },
  { kind: "lava", center: new THREE.Vector3(78, 0, 340), radius: 38 },
  { kind: "lava", center: new THREE.Vector3(-98, 0, -360), radius: 38 },
  { kind: "lava", center: new THREE.Vector3(420, 0, -125), radius: 36 },
  { kind: "lava", center: new THREE.Vector3(220, 0, -390), radius: 34 },
  { kind: "lava", center: new THREE.Vector3(-410, 0, -372), radius: 36 },
  { kind: "lava", center: new THREE.Vector3(-420, 0, 145), radius: 34 },
  { kind: "lava", center: new THREE.Vector3(410, 0, 350), radius: 34 },
  { kind: "lava", center: new THREE.Vector3(-22, 0, 404), radius: 34 },
  { kind: "lava", center: new THREE.Vector3(420, 0, -392), radius: 32 },
  { kind: "lava", center: new THREE.Vector3(-175, 0, 410), radius: 32 },
];

export const WATER_ZONES = [
  { center: new THREE.Vector3(-58, 0, -46), radius: 23, name: "호수" },
  { center: new THREE.Vector3(112, 0, 78), radius: 17, name: "작은 호수" },
  { center: new THREE.Vector3(-330, 0, 315), radius: 68, name: "바다" },
] as const;
export const WATER_RADIUS_MULTIPLIER = 2;
