// 에픽+ 아이템 외형 팩토리 (순수) — 데이터 → THREE.Object3D. 부수효과·커널 접근 없음.
// 기존엔 목걸이/방어구/용 전리품/고급 구급상자/보석 원석이 모두 기본 돌덩이(Dodecahedron)로
// 떨어져 등급·컨셉이 드러나지 않았다. 여기서 각 아이템에 맞는 모델을 만든다.
import * as THREE from "three";
import { makeGlowMaterial, makeMetalMaterial } from "../visuals";
import { armorTierOf, TIER_VISUALS, tierBladeMaterial, tierEdgeMaterial, tierGemMaterial } from "./tierVisuals";

// ── 목걸이 4종 — 금 체인 + 컨셉별 펜던트 보석 ────────────────────────────────
type NecklaceShape = "ruby" | "shield" | "wing" | "orb";
const NECKLACE_STYLE: Record<string, { gem: number; bezel: number; shape: NecklaceShape }> = {
  strength_necklace: { gem: 0xef4444, bezel: 0xb91c1c, shape: "ruby" }, // 힘 — 붉은 루비
  guardian_necklace: { gem: 0x3b82f6, bezel: 0x1d4ed8, shape: "shield" }, // 수호 — 푸른 방패석
  swift_necklace: { gem: 0x34f0a0, bezel: 0x059669, shape: "wing" }, // 쾌속 — 초록 날개석
  sage_necklace: { gem: 0xb06bff, bezel: 0x7c3aed, shape: "orb" }, // 현자 — 보라 지혜구슬
};

export function createNecklaceModel(item: string): THREE.Object3D {
  const style = NECKLACE_STYLE[item] ?? NECKLACE_STYLE.sage_necklace;
  const group = new THREE.Group();
  const chainMat = makeMetalMaterial(0xe7c558, { metalness: 0.72, roughness: 0.3 });
  const bezelMat = makeMetalMaterial(style.bezel, { metalness: 0.6, roughness: 0.32 });
  const gemMat = makeGlowMaterial(style.gem, style.gem, { emissiveIntensity: 1.0, roughness: 0.16, metalness: 0.15 });

  // 목줄(체인) — 타원형 고리
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 8, 36), chainMat);
  chain.position.y = 0.42;
  chain.rotation.x = 1.18;
  chain.scale.set(1, 0.78, 1);
  group.add(chain);
  // 체인 구슬 몇 개 (디테일)
  for (let i = 0; i < 8; i += 1) {
    const a = -Math.PI * 0.78 + (i / 7) * Math.PI * 1.56;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), chainMat);
    bead.position.set(Math.sin(a) * 0.2, 0.42 + Math.cos(a) * 0.156, 0);
    group.add(bead);
  }

  // 펜던트 베젤(고리 틀) + 보석
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 22), bezelMat);
  bezel.position.y = 0.2;
  group.add(bezel);

  if (style.shape === "ruby") {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.082), gemMat);
    gem.position.y = 0.2;
    gem.scale.y = 1.25;
    group.add(gem);
  } else if (style.shape === "shield") {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.04), gemMat);
    plate.position.y = 0.22;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.066, 0.1, 4), gemMat);
    tip.position.y = 0.12;
    tip.rotation.y = Math.PI / 4;
    group.add(plate, tip);
  } else if (style.shape === "wing") {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), gemMat);
    core.position.y = 0.2;
    group.add(core);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), gemMat);
      wing.position.set(sx * 0.09, 0.2, 0);
      wing.rotation.z = sx * 1.25;
      wing.scale.set(0.6, 1, 0.3);
      group.add(wing);
    }
  } else {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), gemMat);
    orb.position.y = 0.2;
    group.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 20), makeGlowMaterial(0xffffff, style.gem, { emissiveIntensity: 0.6, transparent: true, opacity: 0.7 }));
    ring.position.y = 0.2;
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
  }
  return group;
}

// ── 방어구 — 티어 판금 흉갑 + 어깨 + 엠블럼 ──────────────────────────────────
export function createArmorModel(item: string): THREE.Object3D {
  const tier = TIER_VISUALS[armorTierOf(item) ?? "wood"];
  const plateMat = tierBladeMaterial(tier);
  const group = new THREE.Group();

  // 흉갑 본체 (위로 갈수록 좁아지게 — 두 단)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.16), plateMat);
  chest.position.y = 0.3;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.15), plateMat);
  upper.position.y = 0.46;
  group.add(chest, upper);
  // 복부 판금 라인
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.15), plateMat);
  belly.position.y = 0.16;
  group.add(belly);
  // 목깃
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 18, Math.PI), plateMat);
  collar.position.y = 0.54;
  collar.rotation.x = Math.PI / 2;
  group.add(collar);
  // 어깨 보호대
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), plateMat);
    pad.position.set(sx * 0.21, 0.5, 0);
    pad.scale.set(1, 0.8, 1);
    group.add(pad);
  }
  // 고티어 발광 트림 + 보석 엠블럼
  if (tier.fancy) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.17), tierEdgeMaterial(tier));
    trim.position.y = 0.43;
    group.add(trim);
  }
  if (tier.gem) {
    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), tierGemMaterial(tier));
    emblem.position.set(0, 0.32, 0.09);
    group.add(emblem);
  }
  return group;
}

// ── 용 전리품 — 비늘 / 꼬리 / 뿔 / 알 ──────────────────────────────────────
export function createDragonTrophyModel(item: string): THREE.Object3D {
  const group = new THREE.Group();
  if (item === "dragon_scale") {
    const scaleMat = makeGlowMaterial(0xc01616, 0x7f0d0d, { emissiveIntensity: 0.5, roughness: 0.32, metalness: 0.35 });
    // 겹친 비늘 판 — 부채꼴로 3겹
    for (let row = 0; row < 3; row += 1) {
      const count = 3 - (row % 2);
      for (let i = 0; i < count; i += 1) {
        const plate = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 12, 1, false, 0, Math.PI), scaleMat);
        plate.position.set((i - (count - 1) / 2) * 0.13, 0.16 + row * 0.1, -row * 0.02);
        plate.rotation.x = -Math.PI / 2.1;
        plate.scale.set(1, 0.5, 1);
        group.add(plate);
      }
    }
  } else if (item === "dragon_tail") {
    const tailMat = makeGlowMaterial(0x8a1f1f, 0x4c0d0d, { emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.3 });
    const spikeMat = makeGlowMaterial(0xffb070, 0xff6a1f, { emissiveIntensity: 0.7 });
    // 마디 + 가시
    for (let i = 0; i < 5; i += 1) {
      const r = 0.085 - i * 0.013;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), tailMat);
      seg.position.set(Math.sin(i * 0.5) * 0.04, 0.12 + i * 0.11, 0);
      group.add(seg);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, 0.08, 6), spikeMat);
      spike.position.set(seg.position.x, seg.position.y, -r);
      spike.rotation.x = -0.6;
      group.add(spike);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), spikeMat);
    tip.position.y = 0.7;
    group.add(tip);
  } else if (item === "dragon_horn") {
    const hornMat = makeMetalMaterial(0xf3e6c4, { metalness: 0.2, roughness: 0.45 });
    const ridgeMat = makeMetalMaterial(0xc9b48a, { metalness: 0.25, roughness: 0.4 });
    // 휘어진 뿔 — 줄어드는 마디로 곡선
    let y = 0.12;
    let x = 0;
    for (let i = 0; i < 6; i += 1) {
      const r = 0.07 - i * 0.01;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, 0.12, 10), hornMat);
      seg.position.set(x, y, 0);
      seg.rotation.z = -i * 0.16;
      group.add(seg);
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 14), ridgeMat);
      ridge.position.set(x, y - 0.05, 0);
      ridge.rotation.x = Math.PI / 2;
      group.add(ridge);
      x += 0.035 + i * 0.012;
      y += 0.11;
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 8), hornMat);
    tip.position.set(x + 0.02, y - 0.02, 0);
    tip.rotation.z = -1.1;
    group.add(tip);
  } else {
    // dragon_spawn — 빛나는 용의 알
    const shellMat = makeGlowMaterial(0xff5a2a, 0xb21d0a, { emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.2 });
    const crackMat = makeGlowMaterial(0xffd86b, 0xff8a1f, { emissiveIntensity: 1.2 });
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 16), shellMat);
    egg.position.y = 0.3;
    egg.scale.set(0.86, 1.18, 0.86);
    group.add(egg);
    for (let i = 0; i < 3; i += 1) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.02), crackMat);
      crack.position.set((i - 1) * 0.07, 0.3, 0.16);
      crack.rotation.z = (i - 1) * 0.4;
      group.add(crack);
    }
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 18), makeMetalMaterial(0x5a4632, { roughness: 0.85 }));
    nest.position.y = 0.12;
    nest.rotation.x = Math.PI / 2;
    group.add(nest);
  }
  return group;
}

// ── 고급 구급상자 (에픽) — 금장 흰 케이스 + 발광 십자 ─────────────────────────
export function createAdvancedMedkitModel(): THREE.Object3D {
  const group = new THREE.Group();
  const caseMat = makeMetalMaterial(0xf4f7fb, { metalness: 0.25, roughness: 0.4 });
  const goldMat = makeMetalMaterial(0xf0c44a, { metalness: 0.75, roughness: 0.28 });
  const crossMat = makeGlowMaterial(0x39e08a, 0x10b981, { emissiveIntensity: 1.1 });

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.18), caseMat);
  box.position.y = 0.29;
  group.add(box);
  // 금장 모서리 트림 (상/하단 띠)
  for (const dy of [0.16, 0.42]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.19), goldMat);
    band.position.y = dy;
    group.add(band);
  }
  // 손잡이
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16, Math.PI), goldMat);
  handle.position.y = 0.44;
  group.add(handle);
  // 발광 십자
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.02), crossMat);
  crossV.position.set(0, 0.29, 0.095);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.02), crossMat);
  crossH.position.set(0, 0.29, 0.095);
  group.add(crossV, crossH);
  return group;
}

// ── 보석 원석 (다이아·흑요석) — 빛나는 결정 + 잔결정 ──────────────────────────
const GEM_STYLE: Record<string, { base: number; glow: number; sharp: boolean }> = {
  diamond: { base: 0x9bf0ff, glow: 0x22d3ee, sharp: false },
  refined_diamond: { base: 0xb7f6ff, glow: 0x38e0ee, sharp: false },
  obsidian: { base: 0x2a1336, glow: 0x7c2dff, sharp: true },
  sharp_obsidian: { base: 0x33184a, glow: 0x9b5cff, sharp: true },
};
export const GEM_ITEMS = new Set(Object.keys(GEM_STYLE));

export function createGemClusterModel(item: string): THREE.Object3D {
  const style = GEM_STYLE[item] ?? GEM_STYLE.diamond;
  const group = new THREE.Group();
  const mat = makeGlowMaterial(style.base, style.glow, { emissiveIntensity: 0.7, roughness: 0.16, metalness: 0.25, transparent: true, opacity: 0.93 });
  const makeCrystal = (r: number) => new THREE.Mesh(style.sharp ? new THREE.ConeGeometry(r * 0.7, r * 2.4, 5) : new THREE.OctahedronGeometry(r), mat);

  const main = makeCrystal(0.15);
  main.position.y = 0.24;
  if (!style.sharp) main.scale.y = 1.35;
  group.add(main);
  const shards: [number, number, number, number][] = [
    [0.13, 0.16, 0.1, 0.6],
    [-0.12, 0.13, -0.08, 0.5],
    [0.04, 0.12, -0.14, 0.45],
  ];
  for (const [x, y, z, s] of shards) {
    const shard = makeCrystal(0.15 * s);
    shard.position.set(x, y, z);
    shard.rotation.set(0.5, x, z);
    if (!style.sharp) shard.scale.y = 1.3;
    group.add(shard);
  }
  return group;
}
