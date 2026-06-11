import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

interface TimeOfDayStop {
  hour: number;
  sky: number;
  fog: number;
  ambient: number;
  sun: number;
  cloud: number;
  opacity: number;
  fogFar: number;
}

export type TimeOfDayMood = "default" | "graveyard" | "swamp" | "snowfield" | "volcanic" | "duskPurple" | "savanna" | "freshGreen" | "crisp";

export function timeOfDayName(hour: number) {
  if (hour < 4.5) return "밤";
  if (hour < 7) return "새벽";
  if (hour < 11) return "아침";
  if (hour < 17) return "낮";
  if (hour < 20) return "저녁";
  return "밤";
}

export function gameClockText(hour: number) {
  const totalMinutes = Math.floor(hour * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  return `${hours}시`;
}

export interface TimeOfDayContext {
  hour: number;
  scene: THREE.Scene;
  sky: Sky;
  ambientLight: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  moonLight: THREE.DirectionalLight;
  cloudLayer: THREE.Group;
  sunPosition: THREE.Vector3;
  mood?: TimeOfDayMood;
}

const TIME_OF_DAY_STOPS: TimeOfDayStop[] = [
  { hour: 0, sky: 0x06101f, fog: 0x050814, ambient: 0.36, sun: 0.02, cloud: 0x8695b6, opacity: 0.45, fogFar: 310 },
  { hour: 4.6, sky: 0x233659, fog: 0x182944, ambient: 0.64, sun: 0.12, cloud: 0xaab7d6, opacity: 0.58, fogFar: 340 },
  { hour: 6.2, sky: 0xf0a269, fog: 0xb7816b, ambient: 1.4, sun: 1.15, cloud: 0xffd5aa, opacity: 0.76, fogFar: 410 },
  { hour: 8.5, sky: 0x9fd8ff, fog: 0x9fd8ff, ambient: 2.0, sun: 2.25, cloud: 0xffffff, opacity: 0.84, fogFar: 465 },
  { hour: 13.0, sky: 0xaed8ff, fog: 0xaed8ff, ambient: 2.25, sun: 2.7, cloud: 0xffffff, opacity: 0.86, fogFar: 480 },
  { hour: 17.8, sky: 0xf19a65, fog: 0xa86f68, ambient: 1.45, sun: 1.05, cloud: 0xffc49d, opacity: 0.74, fogFar: 405 },
  { hour: 20.4, sky: 0x14213d, fog: 0x101827, ambient: 0.56, sun: 0.07, cloud: 0x8796b7, opacity: 0.5, fogFar: 320 },
  { hour: 24, sky: 0x06101f, fog: 0x050814, ambient: 0.36, sun: 0.02, cloud: 0x8695b6, opacity: 0.45, fogFar: 310 },
];

const skyColor = new THREE.Color();
const skyTargetColor = new THREE.Color();
const fogColor = new THREE.Color();
const fogTargetColor = new THREE.Color();
const cloudColor = new THREE.Color();
const cloudTargetColor = new THREE.Color();
const ambientColor = new THREE.Color();
const groundColor = new THREE.Color();
const fillColor = new THREE.Color();
const fallbackFog = new THREE.Fog(0xaed8ff, 70, 460);
const graveyardSkyColor = new THREE.Color();
const graveyardFogColor = new THREE.Color();

interface MoodTint {
  sky: number;
  fog: number;
  skyBlend: number;
  fogBlend: number;
  cloudBlend: number;
  ambient: number;
  sun: number;
  fogFarScale: number;
  fogFarCap?: number;
  hideSky?: boolean;
}

// 맵별 하늘/안개 무드 — 이름값을 하는 풍경의 절반은 하늘이 만든다.
const MOOD_TINTS: Record<Exclude<TimeOfDayMood, "default">, MoodTint> = {
  graveyard: { sky: 0x39412f, fog: 0x2c3327, skyBlend: 0.72, fogBlend: 0.78, cloudBlend: 0.55, ambient: 0.62, sun: 0.45, fogFarScale: 0.55, fogFarCap: 240, hideSky: true },
  swamp: { sky: 0x515f35, fog: 0x46522f, skyBlend: 0.78, fogBlend: 0.82, cloudBlend: 0.6, ambient: 0.74, sun: 0.62, fogFarScale: 0.55, fogFarCap: 230, hideSky: true },
  snowfield: { sky: 0xdfe9f2, fog: 0xe3ecf4, skyBlend: 0.38, fogBlend: 0.5, cloudBlend: 0.3, ambient: 1.12, sun: 1.05, fogFarScale: 0.85 },
  volcanic: { sky: 0x8c2f15, fog: 0x6e2812, skyBlend: 0.72, fogBlend: 0.76, cloudBlend: 0.6, ambient: 0.88, sun: 0.8, fogFarScale: 0.62, fogFarCap: 290, hideSky: true },
  duskPurple: { sky: 0x6e5694, fog: 0x5e4d80, skyBlend: 0.55, fogBlend: 0.6, cloudBlend: 0.45, ambient: 0.92, sun: 0.85, fogFarScale: 0.78, hideSky: true },
  savanna: { sky: 0xf3c87e, fog: 0xe8c08a, skyBlend: 0.28, fogBlend: 0.3, cloudBlend: 0.25, ambient: 1.05, sun: 1.05, fogFarScale: 1 },
  freshGreen: { sky: 0xbfe6b1, fog: 0xcfe9c4, skyBlend: 0.22, fogBlend: 0.25, cloudBlend: 0.2, ambient: 1.04, sun: 1, fogFarScale: 1.05 },
  crisp: { sky: 0xa9c8de, fog: 0xbcd4e4, skyBlend: 0.2, fogBlend: 0.25, cloudBlend: 0.15, ambient: 1, sun: 1.05, fogFarScale: 1.1 },
};

// 맵 id → 무드. 등록 안 된 맵(시작 초원)은 기본 하늘.
const MOOD_BY_MAP: Record<string, TimeOfDayMood> = {
  graveyard: "graveyard",
  toxic_swamp: "swamp",
  snowfield: "snowfield",
  dragon_lands: "volcanic",
  mushroom_glen: "duskPurple",
  dragon_plains: "savanna",
  bamboo_frontier: "freshGreen",
  mountain_ridge: "crisp",
};

export function moodForWorldMap(worldMapId: string): TimeOfDayMood {
  return MOOD_BY_MAP[worldMapId] ?? "default";
}

export function applyOverworldTimeOfDay(context: TimeOfDayContext) {
  const nextIndex = TIME_OF_DAY_STOPS.findIndex((stop) => context.hour <= stop.hour);
  const after = TIME_OF_DAY_STOPS[Math.max(1, nextIndex)];
  const before = TIME_OF_DAY_STOPS[Math.max(0, Math.max(1, nextIndex) - 1)];
  const span = Math.max(0.001, after.hour - before.hour);
  const rawT = THREE.MathUtils.clamp((context.hour - before.hour) / span, 0, 1);
  const t = rawT * rawT * (3 - 2 * rawT);
  skyColor.setHex(before.sky).lerp(skyTargetColor.setHex(after.sky), t);
  fogColor.setHex(before.fog).lerp(fogTargetColor.setHex(after.fog), t);
  cloudColor.setHex(before.cloud).lerp(cloudTargetColor.setHex(after.cloud), t);
  const ambientIntensity = THREE.MathUtils.lerp(before.ambient, after.ambient, t);
  let ambientScaled = ambientIntensity;
  let sunIntensity = THREE.MathUtils.lerp(before.sun, after.sun, t);
  let fogFar = THREE.MathUtils.lerp(before.fogFar, after.fogFar, t);
  const tint = context.mood && context.mood !== "default" ? MOOD_TINTS[context.mood] : null;
  if (tint) {
    skyColor.lerp(graveyardSkyColor.setHex(tint.sky), tint.skyBlend);
    fogColor.lerp(graveyardFogColor.setHex(tint.fog), tint.fogBlend);
    cloudColor.lerp(graveyardFogColor, tint.cloudBlend);
    ambientScaled = ambientIntensity * tint.ambient;
    sunIntensity *= tint.sun;
    fogFar = Math.min(fogFar * tint.fogFarScale, tint.fogFarCap ?? Number.POSITIVE_INFINITY);
  }

  context.scene.background = skyColor;
  if (!(context.scene.fog instanceof THREE.Fog)) context.scene.fog = fallbackFog;
  context.scene.fog.color.copy(fogColor);
  context.scene.fog.near = 70;
  context.scene.fog.far = fogFar;
  context.sky.visible = !tint?.hideSky; // 짙은 무드(묘지 등)는 하늘 돔을 끄고 배경색을 그대로 드러낸다
  context.ambientLight.intensity = ambientScaled;
  context.ambientLight.color.copy(ambientColor.setHex(0xeaf7ff).lerp(skyColor, 0.24));
  context.ambientLight.groundColor.copy(groundColor.setHex(0x39542c).lerp(fogColor, 0.22));
  context.sunLight.intensity = sunIntensity;
  const sunAngle = ((context.hour - 6) / 24) * Math.PI * 2;
  context.sunLight.position.set(Math.cos(sunAngle) * 120, Math.max(-28, Math.sin(sunAngle) * 150), 55);
  const elevation = THREE.MathUtils.clamp(Math.sin(sunAngle) * 48 + 8, -8, 74);
  const azimuth = THREE.MathUtils.radToDeg(sunAngle) - 80;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  context.sunPosition.setFromSphericalCoords(1, phi, theta);
  context.sky.material.uniforms.sunPosition.value.copy(context.sunPosition);
  context.sky.material.uniforms.turbidity.value = THREE.MathUtils.lerp(9.2, 6.8, Math.min(1, sunIntensity / 2.7));
  context.sky.material.uniforms.rayleigh.value = THREE.MathUtils.lerp(1.2, 3.0, Math.min(1, sunIntensity / 2.7));
  context.fillLight.intensity = THREE.MathUtils.lerp(0.16, 0.72, Math.min(1, sunIntensity / 2.7));
  context.fillLight.color.copy(fillColor.setHex(0xffedd5).lerp(skyColor, 0.16));
  const nightStrength = context.hour >= 20 || context.hour < 5 ? 1 : context.hour < 7 ? (7 - context.hour) / 2 : context.hour > 18 ? (context.hour - 18) / 2 : 0;
  context.moonLight.intensity = THREE.MathUtils.clamp(nightStrength, 0, 1) * 0.38;

  const cloudOpacity = THREE.MathUtils.lerp(before.opacity, after.opacity, t);
  context.cloudLayer.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
      child.material.color.copy(cloudColor);
      child.material.opacity = cloudOpacity;
    }
  });
}
