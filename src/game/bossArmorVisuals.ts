import * as THREE from "three";
import type { WorldObject } from "./types";

// 필드 보스 외형 고도화 — 베이스 크리처(멧돼지/곰/전갈 등) 위에 "악마 군주" regalia 를
// 덧씌운다: 뿔 왕관 + 해골 견갑 + 등줄기 가시판 + 금색 가슴판 + 발광 룬 + 바닥 아우라.
// leaf: main.ts 를 import 하지 않는다. 스폰 직후 1회만 호출(프레임 루프 아님).
// 모든 메시는 userData.bossRegalia=true 로 표시해 보스 tint 단계에서 색이 덮이지 않게 한다.

export interface BossRegaliaPalette {
  armor: number; // 암흑 금속
  trim: number; // 금색 테두리
  gem: number; // 보석/룬 발광색
}

function mark<T extends THREE.Object3D>(mesh: T): T {
  mesh.userData.bossRegalia = true;
  return mesh;
}

export function addBossRegalia(root: THREE.Object3D, palette: BossRegaliaPalette): void {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty() || !Number.isFinite(box.min.y)) return;
  const size = box.getSize(new THREE.Vector3());
  const topY = box.max.y;
  const baseY = box.min.y;
  // 긴·납작한 몸(뱀/전갈)에서 장식이 몸 길이를 따라 퍼지지 않도록, 반경·전후 앵커를 키(높이) 기준으로 클램프
  const radius = Math.max(0.3, Math.min(Math.max(size.x, size.z) * 0.45, size.y * 0.85));
  const frontZ = Math.min(box.max.z, radius); // 베이스 메시 정면(+z) 기준 (몸 길이만큼 튀어나가지 않게 제한)
  const backZ = Math.max(box.min.z, -radius);
  const unit = Math.max(0.2, size.y * 0.16); // 장식 기준 크기

  const armorMat = new THREE.MeshStandardMaterial({ color: palette.armor, metalness: 0.72, roughness: 0.34 });
  const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim, metalness: 0.85, roughness: 0.28, emissive: new THREE.Color(palette.trim), emissiveIntensity: 0.18 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e2d2, metalness: 0.1, roughness: 0.7 });
  const gemMat = new THREE.MeshStandardMaterial({ color: palette.gem, emissive: new THREE.Color(palette.gem), emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.25 });

  const g = new THREE.Group();
  g.userData.bossRegalia = true;

  // ── 1. 뿔 왕관 — 머리 위 링으로 작은 뿔 8개 + 앞쪽 대형 뿔 2개(악마 투구) ──
  const crownY = topY + unit * 0.2;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(unit * 0.16, unit * 1.1, 6), armorMat);
    horn.position.set(Math.cos(a) * radius * 0.55, crownY + unit * 0.45, Math.sin(a) * radius * 0.55);
    horn.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(mark(horn));
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(unit * 0.1), gemMat);
    tip.position.set(Math.cos(a) * radius * 0.72, crownY + unit * 0.95, Math.sin(a) * radius * 0.72);
    g.add(mark(tip));
  }
  for (const sx of [-1, 1]) {
    const bigHorn = new THREE.Mesh(new THREE.ConeGeometry(unit * 0.26, unit * 2.0, 7), armorMat);
    bigHorn.position.set(sx * radius * 0.45, crownY + unit * 0.9, frontZ * 0.5);
    bigHorn.rotation.set(-0.5, 0, sx * 0.85);
    g.add(mark(bigHorn));
  }

  // ── 2. 해골 견갑 — 어깨 높이 양쪽, 눈 발광 + 작은 뿔 ──
  const shoulderY = baseY + size.y * 0.72;
  for (const sx of [-1, 1]) {
    const skull = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.42, 12, 10), boneMat);
    skull.position.set(sx * radius * 0.95, shoulderY, frontZ * 0.15);
    skull.scale.set(1, 1.05, 0.92);
    g.add(mark(skull));
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(unit * 0.4, unit * 0.16, unit * 0.36), boneMat);
    jaw.position.set(skull.position.x, skull.position.y - unit * 0.32, skull.position.z + unit * 0.08);
    g.add(mark(jaw));
    for (const ex of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.08, 6, 6), gemMat);
      eye.position.set(skull.position.x + ex * unit * 0.14, skull.position.y + unit * 0.05, skull.position.z + unit * 0.34);
      g.add(mark(eye));
    }
    const spike = new THREE.Mesh(new THREE.ConeGeometry(unit * 0.12, unit * 0.6, 6), armorMat);
    spike.position.set(skull.position.x, skull.position.y + unit * 0.5, skull.position.z);
    spike.rotation.z = sx * -0.4;
    g.add(mark(spike));
  }

  // ── 3. 등줄기 암흑 가시판 ──
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const plate = new THREE.Mesh(new THREE.ConeGeometry(unit * (0.3 - t * 0.12), unit * (1.1 - t * 0.4), 4), armorMat);
    plate.position.set(0, baseY + size.y * (0.85 - t * 0.5), backZ * 0.6);
    plate.rotation.x = -0.6;
    g.add(mark(plate));
  }

  // ── 4. 금색 가슴 장갑판 + 룬 ──
  const chest = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.1, size.y * 0.32, unit * 0.18), armorMat);
  chest.position.set(0, baseY + size.y * 0.6, frontZ * 0.85);
  g.add(mark(chest));
  const chestTrim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.42, unit * 0.06, 6, 16), trimMat);
  chestTrim.position.set(0, chest.position.y, frontZ * 0.85 + unit * 0.12);
  g.add(mark(chestTrim));
  const chestRune = new THREE.Mesh(new THREE.OctahedronGeometry(unit * 0.22), gemMat);
  chestRune.position.set(0, chest.position.y, frontZ * 0.85 + unit * 0.2);
  g.add(mark(chestRune));

  // ── 5. 떠다니는 룬(정적) ──
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(unit * 0.13), gemMat);
    rune.position.set(Math.cos(a) * radius * 1.3, baseY + size.y * (0.5 + 0.3 * Math.sin(a * 2)), Math.sin(a) * radius * 1.3);
    g.add(mark(rune));
  }

  // ── 6. 바닥 발광 아우라(가산 합성) + 위엄 라이트 ──
  const auraMat = new THREE.MeshBasicMaterial({ color: palette.gem, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); // 가산 링 살짝 약화(0.4→0.3) — 밤에 "타게팅 원"처럼 과하게 도드라지던 문제 완화
  const aura = new THREE.Mesh(new THREE.RingGeometry(radius * 1.1, radius * 1.5, 28), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.set(0, baseY + 0.05, 0);
  g.add(mark(aura));
  // 위엄 라이트 — 밤·어두운 맵에서 보스 본체가 새카만 실루엣("검은 네모박스")으로만 보이지 않도록 자체 조명 강화(0.6→1.3, 범위 ↑). 낮엔 태양광에 묻혀 영향 작음.
  const light = new THREE.PointLight(palette.gem, 1.3, radius * 7.5);
  light.position.set(0, baseY + size.y * 0.6, 0);
  g.add(mark(light));

  root.add(g);
}

export function bossRegaliaPalette(tint: number): BossRegaliaPalette {
  return { armor: 0x14121b, trim: 0xe7c45a, gem: tint };
}

export function applyBossRegalia(object: WorldObject, tint: number): void {
  addBossRegalia(object.root, bossRegaliaPalette(tint));
}
