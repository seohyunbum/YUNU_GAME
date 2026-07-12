import * as THREE from "three";
import { attachBossAura } from "./auraVisuals";
import { makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "../visuals";

// 몬스터 요새 5단계 보스 외형 6종 — 하이엔드 오크·히드라·오우거·죽음의 기사·어쌔신·대주술사.
// 순수 모델 팩토리 leaf(main.ts import 금지). 저폴리 프리미티브 조합 + 발광 포인트 + 셰이더 아우라.
// 애니메이션 계약(animateFortressBossModel): 루트 직속 자식 중 userData.bossBob(부유/호흡) ·
// userData.bossSway{phase}(팔·머리 흔들림 z회전) · userData.bossSpin(y 회전) 만 프레임 루프가 만진다.

export type FortressBossConceptKey = "orc_warlord" | "hydra" | "ogre_boss" | "death_knight" | "assassin" | "shaman";

// 공유 머티리얼 — 스폰/트레일러마다 재생성하지 않게 모듈 싱글턴(dispose 금지 — disposeObject3D 는
// userData.sharedAsset 가드가 아니라 traverse dispose 라, 보스 root 에 sharedAsset 태그를 단다).
const orcSkin = makeToonMaterial(0x4c7a3d, { roughness: 0.7 });
const orcArmor = makeMetalMaterial(0x3a3f4a, { metalness: 0.55, roughness: 0.4 });
const hydraScale = makeToonMaterial(0x2e6e5e, { roughness: 0.65 });
const hydraBelly = makeToonMaterial(0x9ad0a8, { roughness: 0.6 });
const ogreSkin = makeToonMaterial(0xb08a5a, { roughness: 0.75 });
const ogreCloth = makeToonMaterial(0x6b3a2a, { roughness: 0.8 });
const knightArmor = makeMetalMaterial(0x1a1d26, { metalness: 0.7, roughness: 0.3 });
const knightTrim = makeMetalMaterial(0x7c8aa5, { metalness: 0.8, roughness: 0.25 });
const assassinCloth = makeToonMaterial(0x23202e, { roughness: 0.72 });
const assassinTrim = makeToonMaterial(0x8b1030, { roughness: 0.5 });
const shamanRobe = makeToonMaterial(0x3b2a52, { roughness: 0.75 });
const shamanBone = makeToonMaterial(0xe6e0cc, { roughness: 0.7 });
const darkIron = makeMetalMaterial(0x2c2f36, { metalness: 0.6, roughness: 0.45 });
const redEye = makeGlowMaterial(0xff2a2a, 0xff0000, { emissiveIntensity: 1.6, roughness: 0.3 });
const greenEye = makeGlowMaterial(0x5aff6a, 0x0aa02a, { emissiveIntensity: 1.5, roughness: 0.3 });
const blueEye = makeGlowMaterial(0x66c9ff, 0x1060c0, { emissiveIntensity: 1.5, roughness: 0.3 });
const runeGlow = makeGlowMaterial(0xa855f7, 0x6d28d9, { emissiveIntensity: 1.3, roughness: 0.4 });

function eyes(parent: THREE.Object3D, material: THREE.Material, y: number, z: number, spread: number, r = 0.09): void {
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), material);
    eye.position.set(side * spread, y, z);
    parent.add(eye);
  }
}

// 하이엔드 오크 전쟁군주 — 육중한 상체·강철 견갑·대형 도끼·엄니.
function createOrcWarlord(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.5, 10), orcSkin);
  torso.position.y = 1.7;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), orcSkin);
  belly.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.66), orcSkin);
  head.position.y = 2.75;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.5), orcSkin);
  jaw.position.set(0, 2.5, 0.12);
  body.add(torso, belly, head, jaw);
  eyes(body, redEye, 2.82, 0.34, 0.19);
  for (const side of [-1, 1]) { // 엄니 + 강철 견갑 + 팔
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), shamanBone);
    tusk.position.set(side * 0.2, 2.62, 0.34);
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), orcArmor);
    pauldron.position.set(side * 0.86, 2.32, 0);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 6), knightTrim);
    spike.position.set(side * 0.98, 2.7, 0);
    spike.rotation.z = side * -0.4;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.15, 8), orcSkin);
    arm.position.set(side * 0.95, 1.6, 0.08);
    arm.userData.bossSway = { phase: side };
    body.add(tusk, pauldron, spike, arm);
  }
  const axe = new THREE.Group(); // 오른손 대형 전투도끼
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8), darkIron);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 3), knightTrim);
  blade.rotation.x = Math.PI / 2;
  blade.position.y = 0.85;
  axe.add(haft, blade);
  axe.position.set(1.15, 1.35, 0.3);
  axe.rotation.z = -0.35;
  body.add(axe);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 8), orcArmor);
    leg.position.set(side * 0.42, 0.45, 0);
    g.add(leg);
  }
  g.add(body);
  attachBossAura(g, "red_dragon", 1.7, 3.6); // flame 프리셋(전쟁군주 살기)
  return g;
}

// 삼두 히드라 — 뱀 몸통 + 목 3개(중앙 높고 좌우 벌어짐), 각 머리 발광 눈.
function createHydra(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const trunk = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), hydraScale);
  trunk.position.y = 1.05;
  trunk.scale.set(1.15, 0.85, 1.3);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), hydraBelly);
  chest.position.set(0, 1.0, 0.55);
  chest.scale.set(0.9, 0.7, 0.7);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 8), hydraScale);
  tail.position.set(0, 0.7, -1.9);
  tail.rotation.x = -1.35;
  body.add(trunk, chest, tail);
  for (const [ix, side] of [[0, 0], [1, -1], [2, 1]] as const) { // 목 3개 — 중앙(0) 곧게, 좌우 벌어짐
    const neck = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.9 - Math.abs(side) * 0.35, 8), hydraScale);
    col.position.y = 0.95 - Math.abs(side) * 0.15;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 8), hydraScale);
    head.position.set(0, 1.95 - Math.abs(side) * 0.3, 0.28);
    head.rotation.x = 1.25;
    neck.add(col, head);
    eyes(neck, greenEye, 2.0 - Math.abs(side) * 0.3, 0.42, 0.14, 0.08);
    neck.position.set(side * 0.62, 1.5, 0.45);
    neck.rotation.z = side * -0.35;
    neck.userData.bossSway = { phase: ix * 2.1 };
    body.add(neck);
  }
  g.add(body);
  attachBossAura(g, "dark_dragon", 1.9, 3.8); // venom 프리셋(맹독)
  return g;
}

// 오우거 파괴왕 — 거대 배·외눈 왕관·통나무 곤봉.
function createOgreBoss(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 12), ogreSkin);
  belly.position.y = 1.5;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), ogreSkin);
  chest.position.y = 2.4;
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.05, 0.6, 10), ogreCloth);
  cloth.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), ogreSkin);
  head.position.y = 3.3;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.3, 6), knightTrim);
  crown.position.y = 3.7;
  body.add(belly, chest, cloth, head, crown);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), redEye); // 외눈
  eye.position.set(0, 3.35, 0.45);
  body.add(eye);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.6, 8), ogreSkin);
    arm.position.set(side * 1.25, 2.1, 0.1);
    arm.rotation.z = side * 0.25;
    arm.userData.bossSway = { phase: side * 1.4 };
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 1.0, 8), ogreSkin);
    leg.position.set(side * 0.55, 0.5, 0);
    body.add(arm);
    g.add(leg);
  }
  const club = new THREE.Group(); // 통나무 곤봉(가시 박힘)
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 2.2, 8), ogreCloth);
  for (let i = 0; i < 5; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), darkIron);
    spike.position.set(Math.cos(i * 2.3) * 0.3, 0.5 + (i % 3) * 0.3, Math.sin(i * 2.3) * 0.3);
    spike.rotation.z = Math.cos(i * 2.3) * -1.2;
    log.add(spike);
  }
  club.add(log);
  club.position.set(1.55, 2.0, 0.35);
  club.rotation.z = -0.5;
  body.add(club);
  g.add(body);
  attachBossAura(g, "dragon", 2.1, 4.2); // gold 프리셋(파괴왕 위엄)
  return g;
}

// 죽음의 기사 — 흑갑주·투구 발광 눈·대검·망토.
function createDeathKnight(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.3, 8), knightArmor);
  torso.position.y = 1.85;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.5), knightTrim);
  plate.position.set(0, 2.15, 0.05);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 0.7, 8), knightArmor);
  skirt.position.y = 0.95;
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.55, 8), knightArmor);
  helm.position.y = 2.85;
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 6), knightTrim);
  hornL.position.set(-0.32, 3.15, 0);
  hornL.rotation.z = 0.5;
  const hornR = hornL.clone();
  hornR.position.x = 0.32;
  hornR.rotation.z = -0.5;
  body.add(torso, plate, skirt, helm, hornL, hornR);
  eyes(body, blueEye, 2.88, 0.28, 0.13, 0.07); // 투구 틈 냉광
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7), assassinCloth);
  cape.position.set(0, 1.9, -0.4);
  cape.userData.bossSway = { phase: 0.5 };
  body.add(cape);
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), knightTrim);
    pauldron.position.set(side * 0.62, 2.42, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.0, 8), knightArmor);
    arm.position.set(side * 0.68, 1.75, 0.05);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.85, 8), knightArmor);
    leg.position.set(side * 0.3, 0.42, 0);
    body.add(pauldron, arm);
    g.add(leg);
  }
  const sword = new THREE.Group(); // 대검 — 지면에 짚은 자세
  const bl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.04), knightTrim);
  bl.position.y = 1.1;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.1), darkIron);
  guard.position.y = 2.05;
  sword.add(bl, guard);
  sword.position.set(0.95, 0.05, 0.45);
  body.add(sword);
  g.add(body);
  attachBossAura(g, "laser_dragon", 1.6, 3.6); // frost 프리셋(사령 냉기)
  return g;
}

// 그림자 어쌔신 — 후드 로브·쌍단검·가벼운 실루엣.
function createAssassin(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.9, 8), assassinCloth);
  robe.position.y = 1.25;
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.7, 8), assassinCloth);
  chest.position.y = 2.15;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 12), assassinTrim);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 1.85;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 8), assassinCloth);
  hood.position.y = 2.85;
  body.add(robe, chest, sash, hood);
  eyes(body, redEye, 2.62, 0.24, 0.11, 0.06); // 후드 속 안광
  for (const side of [-1, 1]) { // 쌍단검(역수) + 팔
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.85, 6), assassinCloth);
    arm.position.set(side * 0.5, 1.95, 0.1);
    arm.rotation.z = side * 0.4;
    arm.userData.bossSway = { phase: side * 2.2 };
    const dagger = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 6), knightTrim);
    dagger.position.set(side * 0.68, 1.45, 0.2);
    dagger.rotation.x = Math.PI; // 역수 그립
    body.add(arm, dagger);
  }
  const smoke = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 6, 16), assassinTrim); // 발밑 그림자 고리
  smoke.rotation.x = Math.PI / 2;
  smoke.position.y = 0.15;
  smoke.userData.bossSpin = 1.4;
  g.add(body, smoke);
  attachBossAura(g, "illia_sealed", 1.4, 3.2); // abyss 프리셋(그림자)
  return g;
}

// 대주술사 — 뼈 가면·룬 지팡이·부유 토템.
function createShaman(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.userData.bossBob = true;
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.0, 9), shamanRobe);
  robe.position.y = 1.3;
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), shamanRobe);
  shoulders.position.y = 2.3;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.3), shamanBone);
  mask.position.set(0, 2.75, 0.14);
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), shamanBone);
  hornL.position.set(-0.26, 3.1, 0.05);
  hornL.rotation.z = 0.6;
  const hornR = hornL.clone();
  hornR.position.x = 0.26;
  hornR.rotation.z = -0.6;
  body.add(robe, shoulders, mask, hornL, hornR);
  eyes(body, runeGlow, 2.8, 0.3, 0.12, 0.07);
  const staff = new THREE.Group(); // 룬 지팡이 — 정점 발광 크리스탈
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), ogreCloth);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), runeGlow);
  crystal.position.y = 1.35;
  staff.add(pole, crystal);
  staff.position.set(0.75, 1.5, 0.2);
  staff.rotation.z = -0.12;
  body.add(staff);
  for (let i = 0; i < 3; i += 1) { // 부유 토템 3개 — 회전 링
    const totem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), shamanBone);
    const a = (i / 3) * Math.PI * 2;
    totem.position.set(Math.cos(a) * 1.3, 1.9 + (i % 2) * 0.4, Math.sin(a) * 1.3);
    totem.userData.orbitPhase = a;
    g.add(totem);
  }
  g.add(body);
  attachBossAura(g, "illia_desperate", 1.6, 3.6); // abyss 프리셋(저주)
  return g;
}

const FACTORIES: Record<FortressBossConceptKey, () => THREE.Group> = {
  orc_warlord: createOrcWarlord,
  hydra: createHydra,
  ogre_boss: createOgreBoss,
  death_knight: createDeathKnight,
  assassin: createAssassin,
  shaman: createShaman,
};

// 보스 모델 생성 — 요새 몬스터 root 에 덧씌우거나 트레일러 소품으로 쓴다.
// sharedAsset 태그: 공유 머티리얼/지오메트리가 removeObject(disposeObject3D)에 dispose 되지 않게 메시 전체에 표시.
export function createFortressBossModel(key: FortressBossConceptKey): THREE.Group {
  const group = FACTORIES[key]();
  group.traverse((child) => { child.userData.sharedAsset = true; });
  group.userData.fortressBossModel = key;
  return group;
}

// 프레임 idle 애니메이션(무할당) — 부유 호흡 + 팔/목 스웨이 + 토템 궤도 + 링 회전. 보스 엔진/컷씬이 t(초)로 구동.
export function animateFortressBossModel(root: THREE.Object3D, t: number): void {
  for (const child of root.children) {
    if (child.userData.bossBob) {
      child.position.y = Math.sin(t * 1.8) * 0.08;
      for (const part of child.children) {
        const sway = part.userData.bossSway as { phase: number } | undefined;
        if (sway) part.rotation.x = Math.sin(t * 2.2 + sway.phase) * 0.12;
      }
      continue;
    }
    if (child.userData.bossSpin) { child.rotation.z = t * (child.userData.bossSpin as number); continue; }
    const orbit = child.userData.orbitPhase as number | undefined;
    if (orbit !== undefined) {
      const a = orbit + t * 0.9;
      child.position.x = Math.cos(a) * 1.3;
      child.position.z = Math.sin(a) * 1.3;
      child.rotation.y = a;
    }
  }
}
