// 거너 총기·탱커 방패 비주얼 — 데이터 → THREE.Object3D 순수 팩토리.
// 1인칭(heldItemVisuals)과 거울 아바타(avatar) 가 공유한다. 부수효과·커널 접근 금지.
// 총기는 총신이 -Z(전방)를 향하도록 만든다. 호출자가 시점에 맞는 회전을 더한다.
import * as THREE from "three";

const GUNMETAL = { color: 0x49515f, metalness: 0.62, roughness: 0.3 };
const DARK_STEEL = { color: 0x2a2e38, metalness: 0.4, roughness: 0.55 };
const GOLD_TRIM = { color: 0xd9b257, metalness: 0.75, roughness: 0.3 };
const GRIP_PLATE = { color: 0x7a3b2e, roughness: 0.8 };

function standard(params: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial(params);
}

function energyMaterial(color: number) {
  return standard({ color, emissive: color, emissiveIntensity: 1.3, roughness: 0.3 });
}

export function createGunnerPistolModel() {
  const gun = new THREE.Group();
  const gunmetal = standard(GUNMETAL);
  const darkSteel = standard(DARK_STEEL);
  const gold = standard(GOLD_TRIM);
  const plate = standard(GRIP_PLATE);
  const energy = energyMaterial(0x22d3ee);

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.46), gunmetal);
  slide.position.set(0, 0.36, -0.1);
  const serration = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.06, 0.1), darkSteel);
  serration.position.set(0, 0.37, 0.08);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.34), darkSteel);
  frame.position.set(0, 0.295, -0.06);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 12), gunmetal);
  barrel.position.set(0, 0.36, -0.4);
  barrel.rotation.x = Math.PI / 2;
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12), gold);
  muzzle.position.set(0, 0.36, -0.46);
  muzzle.rotation.x = Math.PI / 2;
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.056, 10), darkSteel);
  bore.position.set(0, 0.36, -0.462);
  bore.rotation.x = Math.PI / 2;

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.025), darkSteel);
  frontSight.position.set(0, 0.415, -0.31);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.03), darkSteel);
  rearSight.position.set(0, 0.415, 0.1);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 0.035), darkSteel);
  hammer.position.set(0, 0.4, 0.155);
  hammer.rotation.x = 0.5;

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.23, 0.115), darkSteel);
  grip.position.set(0, 0.175, 0.1);
  grip.rotation.x = 0.28;
  const gripPlates = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.16, 0.09), plate);
  gripPlates.position.set(0, 0.18, 0.105);
  gripPlates.rotation.x = 0.28;
  const magazineBase = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.1), gunmetal);
  magazineBase.position.set(0, 0.055, 0.135);
  magazineBase.rotation.x = 0.28;

  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), darkSteel);
  triggerGuard.position.set(0, 0.255, -0.015);
  triggerGuard.rotation.y = Math.PI / 2;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.05, 0.02), gold);
  trigger.position.set(0, 0.26, -0.01);
  trigger.rotation.x = -0.2;

  const goldBand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), gold);
  goldBand.position.set(0, 0.36, -0.27);
  const energyLeft = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.3), energy);
  energyLeft.position.set(-0.046, 0.37, -0.08);
  const energyRight = energyLeft.clone();
  energyRight.position.x = 0.046;

  gun.add(slide, serration, frame, barrel, muzzle, bore, frontSight, rearSight, hammer, grip, gripPlates, magazineBase, triggerGuard, trigger, goldBand, energyLeft, energyRight);
  return gun;
}

export function createGunnerRifleModel() {
  const gun = new THREE.Group();
  const gunmetal = standard(GUNMETAL);
  const darkSteel = standard(DARK_STEEL);
  const gold = standard(GOLD_TRIM);
  const wood = standard({ color: 0x5b3322, roughness: 0.78 });
  const energy = energyMaterial(0xfbbf24);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.36), gunmetal);
  receiver.position.set(0, 0.34, -0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.52, 12), gunmetal);
  barrel.position.set(0, 0.36, -0.45);
  barrel.rotation.x = Math.PI / 2;
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.26), wood);
  handguard.position.set(0, 0.33, -0.3);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.06, 12), gold);
  muzzle.position.set(0, 0.36, -0.7);
  muzzle.rotation.x = Math.PI / 2;
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.066, 10), darkSteel);
  bore.position.set(0, 0.36, -0.702);
  bore.rotation.x = Math.PI / 2;

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.035, 0.025), darkSteel);
  frontSight.position.set(0, 0.41, -0.6);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.028, 0.03), darkSteel);
  rearSight.position.set(0, 0.415, 0.04);
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), darkSteel);
  magazine.position.set(0, 0.235, -0.08);
  magazine.rotation.x = -0.18;

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), wood);
  grip.position.set(0, 0.22, 0.12);
  grip.rotation.x = 0.4;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.3), wood);
  stock.position.set(0, 0.28, 0.3);
  stock.rotation.x = 0.12;
  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 8, 16), darkSteel);
  triggerGuard.position.set(0, 0.27, 0.03);
  triggerGuard.rotation.y = Math.PI / 2;

  const goldBand = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.078, 0.028), gold);
  goldBand.position.set(0, 0.33, -0.18);
  const energyCore = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.24), energy);
  energyCore.position.set(-0.046, 0.36, -0.02);
  const energyCoreRight = energyCore.clone();
  energyCoreRight.position.x = 0.046;

  gun.add(receiver, barrel, handguard, muzzle, bore, frontSight, rearSight, magazine, grip, stock, triggerGuard, goldBand, energyCore, energyCoreRight);
  return gun;
}

export function createIronShieldModel() {
  const shield = new THREE.Group();
  const steel = standard({ color: 0xb9c1ce, metalness: 0.5, roughness: 0.34 });
  const darkSteel = standard({ color: 0x596273, metalness: 0.45, roughness: 0.45 });
  const gold = standard(GOLD_TRIM);
  const gem = energyMaterial(0x2dd4bf);

  // 히터 실드 실루엣 (위 완만한 호 → 양옆 곡선 → 아래 뾰족)
  const outline = new THREE.Shape();
  outline.moveTo(-0.23, 0.26);
  outline.quadraticCurveTo(0, 0.32, 0.23, 0.26);
  outline.quadraticCurveTo(0.26, 0.02, 0.16, -0.16);
  outline.quadraticCurveTo(0.08, -0.3, 0, -0.36);
  outline.quadraticCurveTo(-0.08, -0.3, -0.16, -0.16);
  outline.quadraticCurveTo(-0.26, 0.02, -0.23, 0.26);

  const faceGeometry = new THREE.ExtrudeGeometry(outline, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  const face = new THREE.Mesh(faceGeometry, steel);
  const rim = new THREE.Mesh(faceGeometry, darkSteel);
  rim.scale.set(1.1, 1.1, 0.6);
  rim.position.z = -0.014;

  const ribVertical = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.02), gold);
  ribVertical.position.set(0, -0.03, 0.05);
  const ribHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.045, 0.02), gold);
  ribHorizontal.position.set(0, 0.11, 0.05);

  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), gold);
  boss.position.set(0, 0.11, 0.05);
  boss.scale.z = 0.55;
  const bossGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.034), gem);
  bossGem.position.set(0, 0.11, 0.095);

  const rivetPositions: [number, number][] = [
    [0, 0.285],
    [-0.185, 0.24],
    [0.185, 0.24],
    [-0.215, 0.08],
    [0.215, 0.08],
    [-0.14, -0.17],
    [0.14, -0.17],
  ];
  const rivetGeometry = new THREE.SphereGeometry(0.014, 8, 6);
  for (const [x, y] of rivetPositions) {
    const rivet = new THREE.Mesh(rivetGeometry, darkSteel);
    rivet.position.set(x, y, 0.05);
    shield.add(rivet);
  }

  shield.add(face, rim, ribVertical, ribHorizontal, boss, bossGem);
  return shield;
}

// ── 궁극 무기 3종 (흑요석 + 금장식 + 붉은 글로우) — 장착 시 1회 빌드(핫패스 아님) ──
const OBSIDIAN = { color: 0x2a1330, metalness: 0.58, roughness: 0.32, emissive: 0x160520, emissiveIntensity: 0.45 };
const ROYAL_GOLD = { color: 0xf0c64a, metalness: 0.82, roughness: 0.24 };

// 날카로운 흑요석 방패 — 악마풍 붉은 글로우 + 금테 + 외곽 스파이크
export function createObsidianShieldModel() {
  const shield = new THREE.Group();
  const obsidian = standard(OBSIDIAN);
  const darkObsidian = standard({ color: 0x180a22, metalness: 0.5, roughness: 0.44 });
  const gold = standard(ROYAL_GOLD);
  const red = energyMaterial(0xff2438);

  const outline = new THREE.Shape();
  outline.moveTo(-0.25, 0.28);
  outline.quadraticCurveTo(0, 0.35, 0.25, 0.28);
  outline.quadraticCurveTo(0.29, 0.02, 0.18, -0.18);
  outline.quadraticCurveTo(0.09, -0.34, 0, -0.4);
  outline.quadraticCurveTo(-0.09, -0.34, -0.18, -0.18);
  outline.quadraticCurveTo(-0.29, 0.02, -0.25, 0.28);
  const faceGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.042, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.016, bevelSegments: 2 });
  const face = new THREE.Mesh(faceGeometry, obsidian);
  const rim = new THREE.Mesh(faceGeometry, gold);
  rim.scale.set(1.12, 1.12, 0.6);
  rim.position.z = -0.016;

  const ribV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.022), gold);
  ribV.position.set(0, -0.04, 0.06);
  const ribH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.022), gold);
  ribH.position.set(0, 0.12, 0.06);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), gold);
  boss.position.set(0, 0.12, 0.06);
  boss.scale.z = 0.55;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.052), red);
  core.position.set(0, 0.12, 0.11);
  shield.add(face, rim, ribV, ribH, boss, core);

  // 외곽 악마 스파이크 (상/하/좌/우)
  const spikes: [number, number, number][] = [[0, 0.42, 0], [0, -0.5, Math.PI], [-0.28, 0.1, Math.PI / 2], [0.28, 0.1, -Math.PI / 2]];
  for (const [x, y, rz] of spikes) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), darkObsidian);
    spike.position.set(x, y, 0.04);
    spike.rotation.z = rz;
    shield.add(spike);
  }
  const rivetGeo = new THREE.SphereGeometry(0.015, 8, 6);
  for (const [x, y] of [[-0.2, 0.24], [0.2, 0.24], [-0.23, 0.06], [0.23, 0.06], [-0.15, -0.19], [0.15, -0.19]] as [number, number][]) {
    const rivet = new THREE.Mesh(rivetGeo, gold);
    rivet.position.set(x, y, 0.06);
    shield.add(rivet);
  }
  return shield;
}

// 날카로운 흑요석 지팡이 — 흑요석 자루 + 금색 왕관 갈래 + 붉은 핵 + 헤일로
export function createObsidianStaffModel() {
  const staff = new THREE.Group();
  const obsidian = standard(OBSIDIAN);
  const gold = standard(ROYAL_GOLD);
  const red = energyMaterial(0xff2438);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.78, 10), obsidian);
  shaft.position.y = 0.39;
  staff.add(shaft);
  for (const y of [0.16, 0.42, 0.66]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.04, 10), gold);
    band.position.set(0, y, 0);
    staff.add(band);
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 20), gold);
  crown.position.set(0.02, 0.84, 0);
  crown.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), red);
  core.position.set(0.02, 0.86, 0);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.01, 8, 24), red);
  halo.position.copy(core.position);
  halo.rotation.x = Math.PI / 2.4;
  staff.add(crown, core, halo);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.13, 6), gold);
    prong.position.set(0.02 + Math.cos(a) * 0.11, 0.94, Math.sin(a) * 0.11);
    staff.add(prong);
  }
  return staff;
}

// 날카로운 흑요석 총 — 황금 몸체 + 흑요석 악센트 + 총구 화염
export function createObsidianGunModel() {
  const gun = new THREE.Group();
  const gold = standard(ROYAL_GOLD);
  const obsidian = standard(OBSIDIAN);
  const flame = energyMaterial(0xff6a1a);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.36), gold);
  receiver.position.set(0, 0.34, -0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.54, 12), gold);
  barrel.position.set(0, 0.36, -0.46);
  barrel.rotation.x = Math.PI / 2;
  const barrelWrap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.26), obsidian);
  barrelWrap.position.set(0, 0.33, -0.3);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 12), obsidian);
  muzzle.position.set(0, 0.36, -0.72);
  muzzle.rotation.x = Math.PI / 2;
  const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 10, 1, true), flame);
  flameTip.position.set(0, 0.36, -0.82);
  flameTip.rotation.x = -Math.PI / 2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.1), obsidian);
  grip.position.set(0, 0.21, 0.12);
  grip.rotation.x = 0.4;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.13, 0.3), obsidian);
  stock.position.set(0, 0.28, 0.3);
  stock.rotation.x = 0.12;
  const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 8, 16), gold);
  triggerGuard.position.set(0, 0.27, 0.03);
  triggerGuard.rotation.y = Math.PI / 2;
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), obsidian);
  magazine.position.set(0, 0.235, -0.08);
  magazine.rotation.x = -0.18;
  const energyCore = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.02, 0.26), flame);
  energyCore.position.set(-0.047, 0.36, -0.02);
  const energyCoreR = energyCore.clone();
  energyCoreR.position.x = 0.047;
  const topGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), flame);
  topGem.position.set(0, 0.41, 0.04);

  gun.add(receiver, barrel, barrelWrap, muzzle, flameTip, grip, stock, triggerGuard, magazine, energyCore, energyCoreR, topGem);
  return gun;
}
