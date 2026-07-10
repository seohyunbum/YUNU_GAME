import * as THREE from "three";
import { itemTier, WEAPON_DAMAGE } from "./items";
import type { BossKind, ItemId } from "./types";

// 넘실거리는 아우라 — GPU 셰이더 기반 VFX(leaf, main.ts import 금지).
// 렉 최소화 설계: ① 지오메트리/머티리얼은 모듈 스코프에서 프리셋당 1회 생성·전부 공유(엔티티당 draw call +1 뿐)
// ② 애니메이션은 uTime 유니폼 하나로 GPU 가 계산(JS 프레임 작업 = onBeforeRender 에서 숫자 대입 1회, 할당 0)
// ③ additive blending + depthWrite off — 오버드로우 외 비용 없음. 부모(무기/보스 root)와 함께 컬링된다.

const AURA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 가로 파동(넘실거림) + 위로 흐르는 화염 밴드 + 상단 소멸 페이드.
const AURA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float sway = sin(vUv.x * 12.566 + uTime * 1.7) * 0.5 + sin(vUv.x * 6.283 - uTime * 2.3) * 0.5;
    float y = vUv.y + sway * 0.09;
    float band = sin(y * 14.0 - uTime * 3.6) * 0.5 + 0.5;
    float band2 = sin(y * 23.0 - uTime * 5.1 + vUv.x * 6.283) * 0.5 + 0.5;
    float flame = pow(band, 2.0) * 0.75 + pow(band2, 3.0) * 0.45;
    float fadeTop = smoothstep(1.0, 0.18, y);
    float fadeBottom = smoothstep(0.0, 0.14, y);
    vec3 col = mix(uColor, uColor2, band);
    gl_FragColor = vec4(col, flame * fadeTop * fadeBottom * uIntensity);
  }
`;

export type AuraPreset = "ember" | "flame" | "mythic" | "abyss" | "gold" | "frost" | "venom";

// 프리셋 → 색상 2톤 + 세기. epic=보랏빛 잔불, legendary=진홍 화염, mythic=푸른 다이아, abyss=일리아 심연, 용 계열은 브레스 색과 톤 일치.
const PRESET_DEFS: Record<AuraPreset, { c1: number; c2: number; intensity: number }> = {
  ember: { c1: 0x7c3aed, c2: 0xc4b5fd, intensity: 0.5 },
  flame: { c1: 0xff3d1f, c2: 0xffc46b, intensity: 0.62 },
  mythic: { c1: 0x1d6fff, c2: 0x9fdcff, intensity: 0.66 },
  abyss: { c1: 0x8b0f2a, c2: 0xff2d55, intensity: 0.6 },
  gold: { c1: 0xffa612, c2: 0xfff3b0, intensity: 0.55 },
  frost: { c1: 0x1fb6d9, c2: 0xcffcff, intensity: 0.55 },
  venom: { c1: 0x5b21b6, c2: 0xa855f7, intensity: 0.55 },
};

// 공유 자산 — 프리셋당 머티리얼 1개, 지오메트리 2종(무기 셸·보스 셸). lazy 생성 후 영구 공유(dispose 금지).
const materialCache = new Map<AuraPreset, THREE.ShaderMaterial>();
let weaponShellGeometry: THREE.CylinderGeometry | null = null;
let bossShellGeometry: THREE.CylinderGeometry | null = null;

function auraMaterial(preset: AuraPreset): THREE.ShaderMaterial {
  let material = materialCache.get(preset);
  if (!material) {
    const def = PRESET_DEFS[preset];
    material = new THREE.ShaderMaterial({
      vertexShader: AURA_VERT,
      fragmentShader: AURA_FRAG,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(def.c1) }, uColor2: { value: new THREE.Color(def.c2) }, uIntensity: { value: def.intensity } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    materialCache.set(preset, material);
  }
  return material;
}

// 공유 uTime 갱신 — 각 아우라 메시의 onBeforeRender 에서 호출(렌더될 때만·컬링되면 0 비용). 숫자 대입뿐(할당 0).
function tickAuraTime(material: THREE.ShaderMaterial): void {
  material.uniforms.uTime.value = performance.now() * 0.001;
}

function makeAuraMesh(geometry: THREE.BufferGeometry, preset: AuraPreset): THREE.Mesh {
  const material = auraMaterial(preset);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.onBeforeRender = () => tickAuraTime(material);
  mesh.raycast = () => {}; // 아우라는 조준/타게팅 대상 아님
  return mesh;
}

// 무기 티어별 아우라 프리셋 — 무기(WEAPON_DAMAGE 등재)만, epic 부터(흔한 등급까지 붙이면 시각 소음 + draw call 낭비).
export function weaponAuraPreset(item: ItemId): AuraPreset | null {
  if (WEAPON_DAMAGE[item] === undefined) return null; // 구급상자·장신구 등 비무기 에픽 제외
  const tier = itemTier(item);
  if (tier === "mythic") return "mythic";
  if (tier === "legendary") return "flame";
  if (tier === "epic") return "ember";
  return null;
}

// 손에 든/떨어진 무기 모델에 아우라 셸 부착 — 날 주변을 감싸는 얇은 원통(위로 갈수록 좁아짐).
export function attachWeaponAura(group: THREE.Group, item: ItemId): void {
  const preset = weaponAuraPreset(item);
  if (!preset) return;
  if (!weaponShellGeometry) { weaponShellGeometry = new THREE.CylinderGeometry(0.07, 0.13, 0.92, 10, 6, true); weaponShellGeometry.translate(0, 0.46, 0); }
  const shell = makeAuraMesh(weaponShellGeometry, preset);
  shell.position.y = 0.18; // 손잡이 위 날 구간
  shell.rotation.z = 0.12; // 손잡이 기울기와 정렬
  group.add(shell);
}

// 보스 종류별 아우라 — 브레스 색 계열과 톤을 맞춰 "이 보스의 위험 속성"이 몸에서 넘실거린다.
const BOSS_AURA: Partial<Record<BossKind, AuraPreset>> = {
  dragon: "gold",
  fire_dragon: "flame",
  red_dragon: "flame",
  laser_dragon: "frost",
  dark_dragon: "venom",
  immortal: "mythic",
  illia_sealed: "abyss",
  illia_desperate: "abyss",
};

// 보스 몸통을 감싸는 대형 아우라 셸. radius/height 는 모델 크기에 맞춰 호출부가 지정.
export function attachBossAura(root: THREE.Object3D, bossKind: BossKind, radius = 2.4, height = 3.4): void {
  const preset = BOSS_AURA[bossKind];
  if (!preset) return;
  if (!bossShellGeometry) { bossShellGeometry = new THREE.CylinderGeometry(0.72, 1, 1, 18, 6, true); bossShellGeometry.translate(0, 0.5, 0); }
  const shell = makeAuraMesh(bossShellGeometry, preset);
  shell.scale.set(radius, height, radius);
  root.add(shell);
}
