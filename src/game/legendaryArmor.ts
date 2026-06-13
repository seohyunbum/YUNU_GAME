import * as THREE from "three";
import { makeMetalMaterial } from "../visuals";
import { tierBladeMaterial, tierEdgeMaterial, tierGemMaterial, type TierVisual } from "./tierVisuals";

// 고급(gold+) 방어구 전용 화려한 장식 — 무기와 동일한 "전설" 언어를 몸에 입힌다:
// 금빛 테두리 가슴판금 + 발광 코어 보석, 날개형 견갑, 등 뒤 룬 마법진(halo), 보석 허리띠, 그리브, 스파크.
// 모든 조각은 몸통/어깨/등/다리(y<1.7)에만 둔다 — 머리(y>1.8)의 직업 투구·후드·모자는 절대 가리지 않는다.
// 장착/스폰 시 1회 빌드(핫패스 아님). 재료는 per-call.

export function addLegendaryArmor(group: THREE.Group, tv: TierVisual) {
  const gold = makeMetalMaterial(0xe7c45a, { metalness: 0.74, roughness: 0.24, emissive: 0x4a3500, emissiveIntensity: 0.28 });
  const plate = tierBladeMaterial(tv);
  const gem = tierGemMaterial(tv);
  const energy = tierEdgeMaterial(tv);
  const auraColor = tv.gem ?? tv.base;
  const full = tv.rank >= 5; // diamond/obsidian = 풀 레전더리

  // ── 금빛 테두리 가슴판금 (뒤에 큰 골드 플레이트가 프레임처럼 비친다) ──
  const goldFrame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.8, 0.1), gold);
  goldFrame.position.set(0, 1.08, 0.25);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.68, 0.13), plate);
  chest.position.set(0, 1.08, 0.3);
  group.add(goldFrame, chest);
  // 중앙 발광 코어 보석
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), gem);
  core.position.set(0, 1.16, 0.38);
  group.add(core);
  // 가슴 에너지 V 라인
  for (const sx of [-1, 1]) {
    const vline = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.012), energy);
    vline.position.set(sx * 0.12, 0.98, 0.38);
    vline.rotation.z = sx * 0.4;
    group.add(vline);
  }

  // ── 날개형 견갑 (어깨 위, 머리 높이 아래) ──
  for (const sx of [-1, 1]) {
    const spaulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate);
    spaulder.position.set(sx * 0.54, 1.45, 0);
    spaulder.scale.set(1.15, 1.0, 1.05);
    group.add(spaulder);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 8, 18), gold);
    rim.position.set(sx * 0.54, 1.44, 0.02);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);
    const wings = full ? 2 : 1;
    for (let w = 0; w < wings; w += 1) {
      const len = 0.26 - w * 0.07;
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.045, len, 4), w === 0 ? gold : energy);
      wing.position.set(sx * (0.6 + w * 0.05), 1.5 + w * 0.05, 0);
      wing.rotation.z = sx * (0.7 + w * 0.3); // 위-바깥으로 쓸어 올린다 (팁 y≈1.65, 머리 안 가림)
      wing.scale.set(1, 1, 0.4);
      group.add(wing);
    }
  }

  // ── 보석 허리띠 ──
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 24), gold);
  belt.position.y = 0.6;
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.62, 1);
  group.add(belt);
  for (const sx of [-1, 1]) {
    const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), gem);
    buckle.position.set(sx * 0.28, 0.6, 0.3);
    group.add(buckle);
  }
  const beltCenter = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), gem);
  beltCenter.position.set(0, 0.6, 0.33);
  group.add(beltCenter);

  // ── 그리브(다리 판금) + 무릎 보석 ──
  for (const sx of [-1, 1]) {
    const greave = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.18), plate);
    greave.position.set(sx * 0.22, 0.3, 0.03);
    group.add(greave);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.2), gold);
    trim.position.set(sx * 0.22, 0.5, 0.03);
    group.add(trim);
    const knee = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), gem);
    knee.position.set(sx * 0.22, 0.36, 0.14);
    group.add(knee);
  }

  // ── 등 뒤 룬 마법진(halo) — 캐릭터 뒤에서 빛난다 (앞면/머리 미가림) ──
  if (full) {
    const haloR = 0.42;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(haloR, 0.018, 10, 36), gold);
    ring.position.set(0, 1.15, -0.34);
    group.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(haloR * 0.62, 0.012, 8, 28), gem);
    inner.position.copy(ring.position);
    group.add(inner);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(haloR * 0.95, 36), new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
    disc.position.set(0, 1.15, -0.36);
    group.add(disc);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.06, 0.016), gem);
      tick.position.set(Math.cos(a) * haloR * 0.82, 1.15 + Math.sin(a) * haloR * 0.82, -0.33);
      tick.rotation.z = a;
      group.add(tick);
    }
  }

  // ── 떠다니는 스파크 (다이아/흑요석) ──
  if (full) {
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), energy);
      spark.position.set(Math.cos(a) * 0.6, 1.0 + Math.sin(a * 2) * 0.4, 0.1 + Math.sin(a) * 0.2);
      group.add(spark);
    }
  }
}
