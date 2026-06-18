// 재료·소모 재료(희귀 이하) 외형 팩토리 (순수) — 데이터 → THREE.Object3D.
// 광물·주괴·가루·나무·가죽·고기·흙·가방·레고 등이 모두 같은 돌덩이로 보이던 문제를 해결한다.
// createMaterialModel 은 아는 재료면 모델을, 모르면 null 을 반환(호출측이 기본 폴백 처리).
import * as THREE from "three";
import { makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "../visuals";

const MAT_COLOR: Record<string, number> = {
  wood: 0x8b5a2b,
  stone: 0x8a8f93,
  coal: 0x2b2b30,
  copper: 0xb87345,
  iron: 0xc2c1ba,
  gold: 0xe5b83e,
  diamond: 0x6ee7f2,
  obsidian: 0x9b5cff,
};
const METALS = new Set(["copper", "iron", "gold"]);

function colorOf(key: string): number {
  return MAT_COLOR[key] ?? 0x9ca3af;
}

// ── 광물 원석 (stone/coal = 거친 돌덩이, copper/iron/gold = 금속 너깃) ──────────
function createOreModel(key: string): THREE.Object3D {
  const group = new THREE.Group();
  const color = colorOf(key);
  if (METALS.has(key)) {
    const nuggetMat = makeMetalMaterial(color, { metalness: 0.78, roughness: 0.32 });
    const rockMat = makeToonMaterial(0x6f6256, { roughness: 0.85 });
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), rockMat);
    rock.position.y = 0.15;
    rock.scale.set(1, 0.8, 1);
    group.add(rock);
    const spots: [number, number, number, number][] = [[0.05, 0.2, 0.08, 0.07], [-0.07, 0.13, 0.04, 0.055], [0.02, 0.22, -0.08, 0.05]];
    for (const [x, y, z, r] of spots) {
      const nugget = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), nuggetMat);
      nugget.position.set(x, y, z);
      group.add(nugget);
    }
  } else {
    const matte = key === "coal"
      ? makeGlowMaterial(0x26262b, 0x120a18, { emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.2 })
      : makeToonMaterial(color, { roughness: 0.9 });
    const chunks: [number, number, number, number][] = [[0, 0.15, 0, 0.15], [0.12, 0.1, 0.05, 0.09], [-0.1, 0.09, -0.06, 0.08]];
    for (const [x, y, z, r] of chunks) {
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), matte);
      chunk.position.set(x, y, z);
      chunk.rotation.set(x, y, z);
      group.add(chunk);
    }
  }
  return group;
}

// ── 주괴(ingot) — 사다리꼴 금속 바 ──────────────────────────────────────────
function createIngotModel(key: string): THREE.Object3D {
  const group = new THREE.Group();
  const color = colorOf(key);
  const mat = key === "wood" || key === "stone"
    ? makeToonMaterial(color, { roughness: 0.72 })
    : makeMetalMaterial(color, { metalness: 0.72, roughness: 0.3, emissive: key === "gold" ? 0x3a2a00 : 0x000000, emissiveIntensity: key === "gold" ? 0.15 : 0 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.2), mat);
  base.position.y = 0.13;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.13), mat);
  top.position.y = 0.22;
  group.add(base, top);
  return group;
}

// ── 가루(powder) — 자루 위 광물 가루 더미 ───────────────────────────────────
function createPowderModel(key: string): THREE.Object3D {
  const group = new THREE.Group();
  const color = colorOf(key);
  const sackMat = makeToonMaterial(0xcdb38a, { roughness: 0.9 });
  const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 14), sackMat);
  sack.position.y = 0.09;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 16), sackMat);
  rim.position.y = 0.17;
  rim.rotation.x = Math.PI / 2;
  const heapMat = METALS.has(key) || key === "gold"
    ? makeMetalMaterial(color, { metalness: 0.5, roughness: 0.45 })
    : makeGlowMaterial(color, color, { emissiveIntensity: key === "diamond" || key === "obsidian" ? 0.5 : 0.12, roughness: 0.6 });
  const heap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.13, 18), heapMat);
  heap.position.y = 0.24;
  group.add(sack, rim, heap);
  for (let i = 0; i < 3; i += 1) {
    const grain = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), heapMat);
    grain.position.set(Math.cos(i * 2.1) * 0.1, 0.21, Math.sin(i * 2.1) * 0.1);
    group.add(grain);
  }
  return group;
}

// ── 나무 통나무 / 막대기 ────────────────────────────────────────────────────
function createLogModel(): THREE.Object3D {
  const group = new THREE.Group();
  const bark = makeToonMaterial(0x6b4423, { roughness: 0.92 });
  const ringMat = makeToonMaterial(0xc59b63, { roughness: 0.78 });
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.46, 14), bark);
  log.position.y = 0.16;
  log.rotation.z = Math.PI / 2;
  group.add(log);
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.02, 14), ringMat);
    ring.position.set(sx * 0.23, 0.16, 0);
    ring.rotation.z = Math.PI / 2;
    group.add(ring);
  }
  return group;
}

function createStickModel(): THREE.Object3D {
  const group = new THREE.Group();
  const wood = makeToonMaterial(0x8b5a2b, { roughness: 0.85 });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.5, 8), wood);
  stick.position.y = 0.24;
  stick.rotation.z = 0.32;
  group.add(stick);
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), wood);
  knot.position.set(0.06, 0.3, 0);
  knot.rotation.z = -0.6;
  group.add(knot);
  return group;
}

// ── 가죽 — 둘둘 만 가죽 ─────────────────────────────────────────────────────
function createLeatherModel(): THREE.Object3D {
  const group = new THREE.Group();
  const hide = makeToonMaterial(0x9c5a2f, { roughness: 0.88 });
  const dark = makeToonMaterial(0x7c4622, { roughness: 0.9 });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.34, 16), hide);
  roll.position.y = 0.16;
  roll.rotation.z = Math.PI / 2;
  group.add(roll);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.04, 8, 16), dark);
  inner.position.set(0.17, 0.16, 0);
  inner.rotation.y = Math.PI / 2;
  group.add(inner);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.24), hide);
  flap.position.set(-0.12, 0.06, 0);
  flap.rotation.z = 0.2;
  group.add(flap);
  return group;
}

// ── 고기 — 통구이 다리살(뼈 포함) ──────────────────────────────────────────
function createMeatModel(): THREE.Object3D {
  const group = new THREE.Group();
  const meatMat = makeToonMaterial(0xc1564f, { roughness: 0.62 });
  const boneMat = makeToonMaterial(0xf3ead8, { roughness: 0.6 });
  const meat = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), meatMat);
  meat.position.y = 0.2;
  meat.scale.set(1, 1.15, 1);
  group.add(meat);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 8), boneMat);
  bone.position.set(0, 0.42, 0);
  group.add(bone);
  for (const dy of [0.46, 0.5]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), boneMat);
    knob.position.set(dy > 0.47 ? 0.03 : -0.03, dy, 0);
    group.add(knob);
  }
  return group;
}

// ── 흙 / 가방 / 레고 / 광물 혼합물 ──────────────────────────────────────────
function createDirtModel(): THREE.Object3D {
  const group = new THREE.Group();
  const soil = makeToonMaterial(0x7a5230, { roughness: 0.95 });
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil);
  mound.position.y = 0.04;
  mound.scale.set(1, 0.7, 1);
  group.add(mound);
  for (let i = 0; i < 3; i += 1) {
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), makeToonMaterial(0x5e3f24, { roughness: 0.95 }));
    clump.position.set(Math.cos(i * 2) * 0.13, 0.05, Math.sin(i * 2) * 0.13);
    group.add(clump);
  }
  return group;
}

function createBagModel(): THREE.Object3D {
  const group = new THREE.Group();
  const cloth = makeToonMaterial(0xb98a4e, { roughness: 0.9 });
  const tie = makeToonMaterial(0x6b4a25, { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14), cloth);
  body.position.y = 0.17;
  body.scale.set(1, 1.1, 1);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.1, 12), cloth);
  neck.position.y = 0.34;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 14), tie);
  band.position.y = 0.36;
  band.rotation.x = Math.PI / 2;
  group.add(body, neck, band);
  return group;
}

function createLegoModel(): THREE.Object3D {
  const group = new THREE.Group();
  const brickMat = makeToonMaterial(0xf5c518, { roughness: 0.45, metalness: 0.05 });
  const brick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), brickMat);
  brick.position.y = 0.16;
  group.add(brick);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), brickMat);
    stud.position.set(sx * 0.07, 0.26, sz * 0.05);
    group.add(stud);
  }
  return group;
}

function createCompoundModel(): THREE.Object3D {
  const group = new THREE.Group();
  const keys = ["copper", "iron", "gold", "stone"];
  const spots: [number, number, number][] = [[0, 0.16, 0], [0.1, 0.1, 0.06], [-0.09, 0.11, -0.05], [0.03, 0.2, -0.08]];
  spots.forEach(([x, y, z], i) => {
    const key = keys[i % keys.length];
    const mat = METALS.has(key) ? makeMetalMaterial(colorOf(key), { metalness: 0.65, roughness: 0.4 }) : makeToonMaterial(colorOf(key), { roughness: 0.8 });
    const bit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat);
    bit.position.set(x, y, z);
    bit.rotation.set(x, y, z);
    group.add(bit);
  });
  return group;
}

// 디스패처 — 아는 재료면 모델, 아니면 null.
export function createMaterialModel(item: string): THREE.Object3D | null {
  if (item === "meat") return createMeatModel();
  if (item === "leather") return createLeatherModel();
  if (item === "dirt") return createDirtModel();
  if (item === "bag") return createBagModel();
  if (item === "plastic_block") return createLegoModel();
  if (item === "stick") return createStickModel();
  if (item === "wood") return createLogModel();
  if (item === "mineral_compound") return createCompoundModel();
  if (item.endsWith("_powder")) return createPowderModel(item.replace("_powder", ""));
  if (item.startsWith("refined_")) return createIngotModel(item.replace("refined_", ""));
  if (item === "stone" || item === "coal" || item === "copper" || item === "iron" || item === "gold") return createOreModel(item);
  return null;
}
