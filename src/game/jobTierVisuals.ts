import * as THREE from "three";
import { makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "../visuals";
import type { PlayerClassId } from "./types";

// 전직 차수별 외형 오버레이 — 데이터 → THREE.Object3D 순수 팩토리(부수효과·커널 접근 금지).
// 차수가 오를수록, 직업 특징에 맞게 멋있어진다. 현재는 1차만 정의(2·3차 자리 비움).
// 아바타는 거울/파티 표시용으로 1회 생성되므로 핫패스 무관. 메시 수는 아바타당 소수로 유지.
// 설계 정본: docs/job-advancement-design.md §4.3

interface ClassCosmeticPalette {
  primary: number; // 본체(견갑/로브) 색
  trim: number; // 발광 트림/보석 색
}

const PALETTE: Record<PlayerClassId, ClassCosmeticPalette> = {
  warrior: { primary: 0x70798a, trim: 0xc0392b },
  healer: { primary: 0xeaf2ec, trim: 0x49b58f },
  mage: { primary: 0x553a8b, trim: 0x8e6bd6 },
  summoner: { primary: 0x6b4a2f, trim: 0xcf9b3a },
  gunner: { primary: 0x4a3a2c, trim: 0xb9925a },
  tanker: { primary: 0x596473, trim: 0xa8b3c7 },
};

function box(w: number, h: number, d: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

// 1차 전직 외형 — 직업별 시그니처 실루엣.
function buildTier1(classId: PlayerClassId, group: THREE.Group) {
  const pal = PALETTE[classId];
  const metal = makeMetalMaterial(pal.primary, { metalness: 0.45, roughness: 0.4 });
  const glow = makeGlowMaterial(pal.trim, pal.trim, { emissiveIntensity: 0.7 });

  if (classId === "warrior") {
    // 붉은 견갑 + 등 망토 + 발광 트림
    for (const side of [-1, 1]) {
      const pauldron = box(0.36, 0.22, 0.4, metal);
      pauldron.position.set(side * 0.54, 1.5, 0);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), glow);
      spike.position.set(side * 0.54, 1.66, 0);
      group.add(pauldron, spike);
    }
    const cape = box(0.66, 0.96, 0.05, makeToonMaterial(pal.trim, { roughness: 0.6 }));
    cape.position.set(0, 1.02, -0.27);
    cape.rotation.x = 0.08;
    group.add(cape);
    return;
  }
  if (classId === "healer") {
    // 머리 위 빛 고리 + 어깨 성스러운 천
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 10, 28), glow);
    halo.position.set(0, 2.32, 0);
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
    for (const side of [-1, 1]) {
      const mantle = box(0.3, 0.18, 0.42, makeToonMaterial(pal.primary, { roughness: 0.7 }));
      mantle.position.set(side * 0.5, 1.46, 0);
      group.add(mantle);
    }
    return;
  }
  if (classId === "mage") {
    // 떠다니는 룬 오브 2개 + 어깨 로브 + 발광 트림
    for (const side of [-1, 1]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), glow);
      orb.position.set(side * 0.62, 1.74, 0.12);
      const robe = box(0.28, 0.3, 0.36, makeToonMaterial(pal.primary, { roughness: 0.72 }));
      robe.position.set(side * 0.5, 1.38, 0);
      group.add(orb, robe);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glow);
    gem.position.set(0, 1.58, 0.24);
    group.add(gem);
    return;
  }
  if (classId === "summoner") {
    // 가죽 견갑 + 깃털 + 금빛 토템
    for (const side of [-1, 1]) {
      const pad = box(0.32, 0.2, 0.38, makeToonMaterial(pal.primary, { roughness: 0.78 }));
      pad.position.set(side * 0.52, 1.46, 0);
      group.add(pad);
    }
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), glow);
    feather.position.set(0.36, 2.04, -0.12);
    feather.rotation.z = -0.5;
    const totem = box(0.12, 0.24, 0.12, makeMetalMaterial(pal.trim, { metalness: 0.5, roughness: 0.42 }));
    totem.position.set(0, 1.15, 0.24);
    group.add(feather, totem);
    return;
  }
  if (classId === "gunner") {
    // 챙모자 + 어깨 탄띠 + 코트 트림
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), makeToonMaterial(pal.primary, { roughness: 0.7 }));
    brim.position.set(0, 2.2, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.24, 20), makeToonMaterial(pal.primary, { roughness: 0.7 }));
    crown.position.set(0, 2.34, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.285, 0.06, 20), glow);
    band.position.set(0, 2.25, 0);
    const bandolier = box(0.14, 0.96, 0.46, makeMetalMaterial(pal.trim, { metalness: 0.4, roughness: 0.5 }));
    bandolier.position.set(0.04, 1.05, 0.2);
    bandolier.rotation.z = 0.5;
    group.add(brim, crown, band, bandolier);
    return;
  }
  // tanker — 대형 강철 견갑 + 가슴 엠블럼 + 은청 트림
  for (const side of [-1, 1]) {
    const pauldron = box(0.44, 0.28, 0.46, metal);
    pauldron.position.set(side * 0.58, 1.5, 0);
    const ridge = box(0.46, 0.06, 0.48, glow);
    ridge.position.set(side * 0.58, 1.64, 0);
    group.add(pauldron, ridge);
  }
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow);
  emblem.position.set(0, 1.18, 0.24);
  group.add(emblem);
}

// 전직 외형 그룹을 만든다. 미전직(jobTier<1)이면 null.
export function createJobTierCosmetic(classId: PlayerClassId, jobTier: number): THREE.Group | null {
  if (!jobTier || jobTier < 1) return null;
  const group = new THREE.Group();
  buildTier1(classId, group);
  // 2·3차 외형은 후속 작업에서 jobTier>=2 분기로 추가.
  return group;
}
