import * as THREE from "three";
import {
  ASSET_PALETTE,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "../visuals";
import type { BossKind } from "./types";

// 챕터 보스 드래곤 외형 — 장갑판·뿔 왕관·갈래 막날개·등줄기 가시·꼬리 블레이드로 위압감을 준다.
// 저폴리 스타일 유지. 애니메이션 계약(updateDragons): group 직속 자식 중
//   userData.dragonWing(+baseZ, position.z 부호) → z 회전 날갯짓 / userData.dragonTail → y 회전.
// 정적 파츠는 한 개의 sub-group 으로 묶어 프레임 루프가 건너뛰게 한다.

export interface DragonVisualStats {
  scale: number;
  body: number;
  belly: number;
  wing: number;
  glow: number;
}

const darken = (hex: number, f: number) => new THREE.Color(hex).multiplyScalar(f).getHex();

export function createDragonVisual(bossKind: BossKind, stats: DragonVisualStats) {
  const group = new THREE.Group();
  const isFire = bossKind === "dragon" || bossKind === "fire_dragon" || bossKind === "red_dragon";
  const ringed = bossKind === "laser_dragon" || bossKind === "dark_dragon" || bossKind === "immortal";

  const armorColor = darken(stats.body, bossKind === "immortal" ? 0.55 : 0.34);
  const plateColor = darken(stats.body, bossKind === "immortal" ? 0.7 : 0.5);
  const bodyMaterial = makeToonMaterial(stats.body, { roughness: 0.6, metalness: bossKind === "immortal" ? 0.22 : 0.06 });
  const armorMaterial = makeMetalMaterial(armorColor, { metalness: 0.74, roughness: 0.38 });
  const plateMaterial = makeMetalMaterial(plateColor, { metalness: 0.78, roughness: 0.34 });
  const trimMaterial = makeMetalMaterial(bossKind === "immortal" ? 0xb9c2cf : ASSET_PALETTE.clothCream, { metalness: 0.6, roughness: 0.4 });
  const bellyMaterial = makeGlowMaterial(stats.belly, stats.glow, { emissiveIntensity: bossKind === "immortal" ? 0.5 : 0.24, roughness: 0.5 });
  const crackMaterial = makeGlowMaterial(stats.glow, stats.glow, { emissiveIntensity: 1.1, roughness: 0.3 });
  const eyeMaterial = makeGlowMaterial(isFire ? 0xfff1d0 : 0xeaffff, stats.glow, { emissiveIntensity: bossKind === "immortal" ? 1.8 : 1.0, roughness: 0.25 });
  const wingMaterial = makeGlowMaterial(stats.wing, stats.glow, {
    emissiveIntensity: bossKind === "dragon" ? 0.2 : 0.4,
    roughness: 0.55,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });

  // ── 정적 파츠 (한 그룹으로 묶어 애니메이션 루프 스킵) ──
  const stat = new THREE.Group();
  const add = (...m: THREE.Object3D[]) => stat.add(...m);

  // 몸통 + 가슴 장갑 + 배 발광
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bodyMaterial);
  body.position.set(0, 2.65, 0); body.scale.set(2.55, 0.86, 0.98);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.74, 18, 12), bellyMaterial);
  belly.position.set(0.5, 2.4, 0); belly.scale.set(1.7, 0.4, 0.72);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 12), bodyMaterial);
  chest.position.set(1.5, 2.82, 0); chest.scale.set(0.98, 0.94, 0.92);
  const chestPlate = new THREE.Mesh(new THREE.SphereGeometry(0.78, 16, 10), plateMaterial);
  chestPlate.position.set(1.74, 2.86, 0); chestPlate.scale.set(0.7, 0.92, 0.86);
  add(body, belly, chest, chestPlate);
  // 어깨 장갑 + 가시
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), armorMaterial);
    pauldron.position.set(1.35, 3.18, side * 0.66); pauldron.scale.set(0.9, 0.8, 0.9);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 6), armorMaterial);
    spike.position.set(1.2, 3.5, side * 0.7); spike.rotation.set(side * 0.4, 0, -0.5);
    add(pauldron, spike);
  }

  // 목 — 테이퍼 + 장갑 링 + 갈기 가시
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 1.5, 12), bodyMaterial);
  neck.position.set(2.06, 3.34, 0); neck.rotation.z = -0.74;
  add(neck);
  for (let i = 0; i < 3; i += 1) {
    const ringPlate = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.03, 0.07, 6, 14), armorMaterial);
    ringPlate.position.set(1.78 + i * 0.32, 3.16 + i * 0.36, 0); ringPlate.rotation.set(Math.PI / 2, 0, -0.74);
    add(ringPlate);
  }

  // ── 머리 (장갑 투구) ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.64, 18, 14), bodyMaterial);
  head.position.set(2.84, 3.82, 0); head.scale.set(1.2, 0.84, 0.92);
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.74), armorMaterial);
  helm.position.set(2.78, 4.08, 0); helm.rotation.z = -0.12;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.92, 8), bodyMaterial);
  snout.position.set(3.42, 3.7, 0); snout.rotation.z = -Math.PI / 2; snout.scale.set(1, 1, 0.85);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.5), plateMaterial);
  jaw.position.set(3.2, 3.46, 0); jaw.rotation.z = -0.12;
  add(head, helm, snout, jaw);
  // 이빨
  for (const side of [-1, 1]) for (let t = 0; t < 3; t += 1) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), trimMaterial);
    tooth.position.set(3.3 + t * 0.18, 3.56, side * (0.12 + t * 0.04)); tooth.rotation.z = Math.PI;
    add(tooth);
  }
  // 눈 + 눈썹 + 볼 가시
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), eyeMaterial);
    eye.position.set(3.24, 3.9, side * 0.26); eye.scale.set(1.2, 0.8, 1);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.12), armorMaterial);
    brow.position.set(3.12, 4.02, side * 0.24); brow.rotation.z = side * -0.12;
    const cheek = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), armorMaterial);
    cheek.position.set(2.92, 3.7, side * 0.4); cheek.rotation.set(side * 0.5, 0, 0.4);
    add(eye, brow, cheek);
  }
  // 뿔 — 대형 후방 뿔 2 + 왕관 뿔 4
  for (const side of [-1, 1]) {
    const bigHorn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.15, 7), trimMaterial);
    bigHorn.position.set(2.46, 4.34, side * 0.3); bigHorn.rotation.set(side * 0.3, 0, 1.0);
    add(bigHorn);
    for (let h = 0; h < 2; h += 1) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 6), trimMaterial);
      crown.position.set(2.66 - h * 0.22, 4.26, side * (0.12 + h * 0.12)); crown.rotation.set(side * 0.3, 0, -0.3 - h * 0.2);
      add(crown);
    }
  }

  // ── 등줄기 가시 크레스트 (목→꼬리) ──
  for (let i = 0; i < 11; i += 1) {
    const t = i / 10;
    const h = 0.7 - Math.abs(t - 0.35) * 0.7;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16 - i * 0.008, Math.max(0.28, h), 6), armorMaterial);
    spike.position.set(2.0 - i * 0.42, 3.6 - Math.abs(t - 0.3) * 0.5, 0);
    add(spike);
  }
  // 등 장갑판
  for (let i = 0; i < 4; i += 1) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.1), plateMaterial);
    plate.position.set(1.1 - i * 0.7, 3.36 - i * 0.02, 0); plate.rotation.x = Math.PI / 2 * 0.04;
    add(plate);
  }

  // ── 다리 (장갑 허벅지 + 발톱 발) ──
  for (const fx of [-0.95, 0.95]) for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), armorMaterial);
    thigh.position.set(fx, 1.95, side * 0.5); thigh.scale.set(0.9, 1.1, 0.9);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.0, 10), bodyMaterial);
    shin.position.set(fx + 0.05, 1.3, side * 0.5); shin.rotation.z = fx > 0 ? -0.1 : 0.1;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.42), plateMaterial);
    foot.position.set(fx + 0.18, 0.78, side * 0.52);
    add(thigh, shin, foot);
    for (let c = 0; c < 4; c += 1) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 5), trimMaterial);
      claw.position.set(fx + 0.5, 0.78, side * (0.34 + c * 0.1)); claw.rotation.z = -Math.PI / 2 - 0.2;
      add(claw);
    }
  }

  // 화염 종족 — 몸·목·다리에 용암 균열(발광)
  if (isFire) {
    const cracks: [number, number, number][] = [[0.2, 2.5, 0.6], [-0.6, 2.7, -0.5], [1.0, 2.9, 0.4], [-1.3, 2.6, 0.3], [1.7, 3.0, -0.3]];
    for (const [cx, cy, cz] of cracks) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), crackMaterial);
      crack.position.set(cx, cy, cz); crack.rotation.set(Math.random() * 0.6, Math.random() * 0.6, Math.random());
      add(crack);
    }
  }
  group.add(stat);

  // ── 날개 (애니메이션) — 막 + 갈래 뼈대 + 윙클로 를 한 그룹으로 ──
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-1.7, 1.85);
  wingShape.lineTo(-3.6, 0.7);
  wingShape.lineTo(-2.85, 0.12);
  wingShape.lineTo(-3.15, -0.5);
  wingShape.lineTo(-2.35, -0.18);
  wingShape.lineTo(-2.5, -0.86);
  wingShape.lineTo(-1.65, -0.28);
  wingShape.lineTo(-1.75, -0.92);
  wingShape.lineTo(-0.9, -0.34);
  wingShape.lineTo(0, 0);
  const fingerTips: [number, number][] = [[-3.6, 0.7], [-3.15, -0.5], [-2.5, -0.86], [-1.75, -0.92]];
  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();
    // 어깨에서 옆으로 활짝 — y 로 측면 전개, x 로 살짝 위로, z 는 날갯짓용(baseZ=0)
    wingGroup.position.set(0.2, 3.45, side * 0.55);
    wingGroup.rotation.set(-0.32, side * 1.32, 0);
    wingGroup.scale.setScalar(1.4);
    wingGroup.userData.dragonWing = true;
    wingGroup.userData.baseZ = 0;
    const membrane = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), wingMaterial);
    wingGroup.add(membrane);
    // 앞날 뼈대 + 갈래 뼈대
    for (const [fxTip, fyTip] of fingerTips) {
      const len = Math.hypot(fxTip, fyTip);
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, len, 7), armorMaterial);
      bone.position.set(fxTip / 2, fyTip / 2, side * 0.02);
      bone.rotation.z = Math.atan2(fyTip, fxTip) - Math.PI / 2;
      wingGroup.add(bone);
    }
    const wingClaw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), trimMaterial);
    wingClaw.position.set(-3.7, 0.8, side * 0.02); wingClaw.rotation.z = 0.6;
    wingGroup.add(wingClaw);
    group.add(wingGroup);
  }

  // ── 꼬리 (애니메이션) — 분절 + 장갑판 + 끝 블레이드 ──
  const tailRoot = new THREE.Group();
  tailRoot.userData.dragonTail = true;
  tailRoot.position.set(-1.98, 2.58, 0);
  for (let i = 0; i < 7; i += 1) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.24 - i * 0.026, 0.3 - i * 0.03, 0.6, 10), bodyMaterial);
    seg.position.set(-0.32 - i * 0.42, -i * 0.06, 0); seg.rotation.z = 1.42;
    tailRoot.add(seg);
    if (i % 2 === 0) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), armorMaterial);
      fin.position.set(-0.32 - i * 0.42, 0.22 - i * 0.06, 0);
      tailRoot.add(fin);
    }
  }
  // 꼬리 끝 블레이드(쌍날) — 흑요석/불멸은 더 큼
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.95, 4), armorMaterial);
    blade.position.set(-3.4, -0.42, side * 0.14); blade.rotation.set(side * 0.5, 0, Math.PI / 2 + 0.2);
    tailRoot.add(blade);
  }
  group.add(tailRoot);

  // ── 오라 링 (laser/dark/immortal, y 회전) ──
  if (ringed) {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: stats.glow, transparent: true, opacity: bossKind === "immortal" ? 0.5 : 0.36, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const radius of bossKind === "immortal" ? [1.5, 2.3, 3.1] : [1.4, 2.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, 8, 64), ringMaterial);
      ring.position.set(0.5, 2.8, 0); ring.rotation.x = Math.PI / 2;
      ring.userData.dragonTail = true;
      group.add(ring);
    }
  }

  const glow = new THREE.PointLight(stats.glow, bossKind === "immortal" ? 2.6 : 1.3, bossKind === "immortal" ? 20 : 12, 1.8);
  glow.position.set(1.6, 3.1, 0);
  group.add(glow);
  group.scale.setScalar(stats.scale);
  return group;
}
