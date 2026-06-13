import * as THREE from "three";
import { makeGlowMaterial, makeMetalMaterial } from "../visuals";
import { tierEdgeMaterial, tierGemMaterial, type TierVisual } from "./tierVisuals";

// 고급(gold+) 무기 전용 화려한 장식 — 날개형 가드·룬 마법진(halo)·에너지 불꽃·테이퍼드 블레이드·
// 왕관 포멜·금빛 필리그리·스파크. tier rank 가 오를수록 더 화려해진다(다이아/흑요석이 풀 레전더리).
// 색은 티어색을 유지하되 금빛 장식 + 티어색 에너지 발광으로 "전설 무기" 아우라를 낸다.
// 장착 시 1회만 빌드(핫패스 아님) — 재료는 per-call(교체 시 dispose 됨).

// blade 기준점: 가드 y=GUARD_Y, 블레이드는 그 위로 뻗는다.
const GUARD_Y = 0.24;

export function addLegendaryWeapon(group: THREE.Group, tv: TierVisual, sword: boolean) {
  const gold = makeMetalMaterial(0xe7c45a, { metalness: 0.74, roughness: 0.24, emissive: 0x4a3500, emissiveIntensity: 0.28 });
  const goldDark = makeMetalMaterial(0xb88a2e, { metalness: 0.7, roughness: 0.32 });
  const white = makeMetalMaterial(0xf4f0e6, { metalness: 0.5, roughness: 0.3, emissive: tv.emissive, emissiveIntensity: tv.emissiveIntensity * 0.5 });
  const bladeMat = makeMetalMaterial(0xeef2f4, { metalness: 0.55, roughness: 0.2, emissive: tv.emissive, emissiveIntensity: tv.emissiveIntensity * 0.7 });
  const gem = tierGemMaterial(tv);
  const energy = tierEdgeMaterial(tv);
  const coreGlow = makeGlowMaterial(tv.gem ?? tv.base, tv.gem ?? tv.base, { emissiveIntensity: tv.glow * 1.6, transparent: true, opacity: 0.95 });
  const auraColor = tv.gem ?? tv.base;
  const full = tv.rank >= 5; // diamond/obsidian = 풀 레전더리

  // ── 그립(필리그리 밴드) ──
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.2, 10), goldDark);
  grip.position.y = 0.11;
  group.add(grip);
  for (let i = 0; i < 3; i += 1) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 16), gold);
    band.position.y = 0.05 + i * 0.05;
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  // ── 왕관형 포멜 ──
  const pommelCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), gem);
  pommelCore.position.y = -0.02;
  group.add(pommelCore);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 4), gold);
    prong.position.set(Math.cos(a) * 0.045, -0.07, Math.sin(a) * 0.045);
    prong.rotation.x = Math.PI;
    group.add(prong);
  }

  // ── 날개형 가드 ──
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18 + tv.rank * 0.01, 0.06, 0.08), gold);
  guard.position.y = GUARD_Y;
  group.add(guard);
  const wingsPerSide = full ? 3 : 2;
  for (const sx of [-1, 1]) {
    for (let w = 0; w < wingsPerSide; w += 1) {
      const len = (0.2 + tv.rank * 0.012) * (1 - w * 0.22);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.05, len, 4), w === 0 ? white : gold);
      wing.position.set(sx * (0.1 + w * 0.04), GUARD_Y + 0.03 + w * 0.07, 0);
      wing.rotation.z = sx * (Math.PI / 2 - 0.45 - w * 0.32);
      wing.scale.set(1, 1, 0.35);
      group.add(wing);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, len * 0.55, 4), energy);
      tip.position.copy(wing.position);
      tip.rotation.copy(wing.rotation);
      tip.scale.copy(wing.scale);
      group.add(tip);
    }
  }

  // ── 룬 마법진(halo) — 가드 뒤 ──
  if (full) {
    const haloR = 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(haloR, 0.013, 10, 30), gold);
    ring.position.set(0, GUARD_Y, -0.03);
    group.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(haloR * 0.6, 0.009, 8, 24), gem);
    inner.position.copy(ring.position);
    group.add(inner);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(haloR * 0.95, 28), new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    disc.position.set(0, GUARD_Y, -0.04);
    group.add(disc);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), gem);
      tick.position.set(Math.cos(a) * haloR * 0.8, GUARD_Y + Math.sin(a) * haloR * 0.8, -0.02);
      tick.rotation.z = a;
      group.add(tick);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), coreGlow);
    orb.position.set(0, GUARD_Y, 0.02);
    group.add(orb);
  }

  // ── 에너지 불꽃 — 가드 주변 방사 ──
  const flames = full ? 7 : 4;
  for (let i = 0; i < flames; i += 1) {
    const a = Math.PI * 0.2 + (i / (flames - 1)) * Math.PI * 1.6;
    const r = 0.22;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.24 + tv.rank * 0.02, 5), energy);
    flame.position.set(Math.cos(a) * r, GUARD_Y + Math.sin(a) * r, -0.01);
    flame.rotation.z = a - Math.PI / 2;
    flame.scale.set(1, 1, 0.5);
    group.add(flame);
  }

  // ── 테이퍼드 블레이드 ──
  const baseW = sword ? 0.13 : 0.1;
  const bladeLen = (sword ? 0.72 : 0.46) + tv.rank * 0.05;
  const bladeBase = GUARD_Y + 0.05;
  const lowerH = bladeLen * 0.55;
  const upperH = bladeLen * 0.3;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(baseW, lowerH, 0.04), bladeMat);
  lower.position.y = bladeBase + lowerH / 2;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.66, upperH, 0.035), bladeMat);
  upper.position.y = bladeBase + lowerH + upperH / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(baseW * 0.34, bladeLen * 0.2, 4), bladeMat);
  tip.position.y = bladeBase + lowerH + upperH + bladeLen * 0.1;
  tip.rotation.y = Math.PI / 4;
  group.add(lower, upper, tip);

  // 금빛 사이드 레일
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.016, lowerH + upperH, 0.044), gold);
    rail.position.set(sx * (baseW / 2 - 0.006), bladeBase + (lowerH + upperH) / 2, 0.004);
    group.add(rail);
  }
  // 발광 코어 라인 (앞으로 살짝 돌출)
  const core = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.28, lowerH + upperH, 0.012), coreGlow);
  core.position.set(0, bladeBase + (lowerH + upperH) / 2, 0.03);
  group.add(core);

  // 블레이드 기부 플레어 바브 (불꽃 모양 돌출)
  for (const sx of [-1, 1]) {
    const barb = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), gold);
    barb.position.set(sx * (baseW / 2 + 0.04), bladeBase + 0.06, 0.01);
    barb.rotation.z = sx * -1.1;
    barb.scale.set(1, 1, 0.45);
    group.add(barb);
    const barbTip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 4), energy);
    barbTip.position.copy(barb.position);
    barbTip.rotation.copy(barb.rotation);
    barbTip.scale.copy(barb.scale);
    group.add(barbTip);
  }

  // 스파크 (작은 발광 옥타) — 다이아/흑요석
  if (full) {
    for (let i = 0; i < 8; i += 1) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.013), energy);
      spark.position.set((i % 2 ? 1 : -1) * (0.07 + (i % 3) * 0.025), bladeBase + 0.1 + i * 0.09, 0.03);
      group.add(spark);
    }
  }
}
