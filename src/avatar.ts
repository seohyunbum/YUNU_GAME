import * as THREE from "three";
import { createIronShieldModel } from "./game/weaponVisuals";
import { addLegendaryArmor } from "./game/legendaryArmor";
import { createJobTierCosmetic } from "./game/jobTierVisuals";
import { TIER_VISUALS, tierBladeMaterial, tierGemMaterial, type TierId } from "./game/tierVisuals";
import { ASSET_PALETTE, makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "./visuals";

export interface AvatarAppearance {
  skinColor: number;
  hairColor: number;
  shirtColor: number;
  pantsColor: number;
  bootColor: number;
  accentColor: number;
}

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = {
  skinColor: ASSET_PALETTE.skin,
  hairColor: ASSET_PALETTE.ink,
  shirtColor: ASSET_PALETTE.clothBlue,
  pantsColor: 0x29415f,
  bootColor: ASSET_PALETTE.leatherDark,
  accentColor: ASSET_PALETTE.gold,
};

export type AvatarClassId = "warrior" | "healer" | "mage" | "summoner" | "gunner" | "tanker";

// 직업별 외형 팔레트 — 거울/파티 표시에서 직업을 한눈에 구분한다.
export const CLASS_APPEARANCE: Record<AvatarClassId, AvatarAppearance> = {
  warrior: { skinColor: ASSET_PALETTE.skin, hairColor: 0x3a2c22, shirtColor: 0x70798a, pantsColor: 0x2b2f36, bootColor: 0x20242b, accentColor: 0xc0392b },
  healer: { skinColor: ASSET_PALETTE.skin, hairColor: 0x8a6b3f, shirtColor: 0xeaf2ec, pantsColor: 0x8aa0a8, bootColor: 0x6c7c80, accentColor: 0x49b58f },
  mage: { skinColor: ASSET_PALETTE.skin, hairColor: 0x2a2440, shirtColor: 0x553a8b, pantsColor: 0x2c2347, bootColor: 0x241d3a, accentColor: 0x8e6bd6 },
  summoner: { skinColor: ASSET_PALETTE.skin, hairColor: 0x3a2a1c, shirtColor: 0x6b4a2f, pantsColor: 0x3f2e1f, bootColor: 0x2c2016, accentColor: 0xcf9b3a },
  gunner: { skinColor: ASSET_PALETTE.skin, hairColor: 0x2c241d, shirtColor: 0x4a3a2c, pantsColor: 0x2f2820, bootColor: 0x1f1a14, accentColor: 0xb9925a },
  tanker: { skinColor: ASSET_PALETTE.skin, hairColor: 0x29313a, shirtColor: 0x596473, pantsColor: 0x25313d, bootColor: 0x151a20, accentColor: 0xa8b3c7 },
};

export function createAvatarModel(appearance: AvatarAppearance = DEFAULT_AVATAR_APPEARANCE, classId?: AvatarClassId, armorTier?: string | null, jobTier = 0) {
  const pal = classId ? CLASS_APPEARANCE[classId] : appearance;
  const group = new THREE.Group();
  const skin = makeToonMaterial(pal.skinColor, { roughness: 0.72 });
  const hair = makeToonMaterial(pal.hairColor, { roughness: 0.82 });
  const shirt = makeToonMaterial(pal.shirtColor, { roughness: 0.76 });
  const pants = makeToonMaterial(pal.pantsColor, { roughness: 0.8 });
  const boots = makeToonMaterial(pal.bootColor, { roughness: 0.86 });
  const accent = makeMetalMaterial(pal.accentColor, { metalness: 0.18, roughness: 0.38 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.08, 0.44), shirt);
  torso.position.y = 1.04;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.48), accent);
  belt.position.y = 0.58;
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.5), accent);
  collar.position.y = 1.52;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 10), skin);
  neck.position.y = 1.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), skin);
  head.position.y = 1.9;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairCap.position.y = 2.0;
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), hair);
  fringe.position.set(-0.03, 1.99, 0.25);
  fringe.rotation.z = -0.12;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin);
  nose.position.set(0, 1.9, 0.31);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), hair);
  mouth.position.set(0, 1.8, 0.31);
  group.add(torso, belt, collar, neck, head, hairCap, fringe, nose, mouth);

  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hair);
    eye.position.set(x, 1.94, 0.3);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 5), makeToonMaterial(ASSET_PALETTE.blush, { roughness: 0.74 }));
    cheek.position.set(x * 1.45, 1.84, 0.3);
    cheek.scale.set(1.15, 0.72, 0.45);
    group.add(eye);
    group.add(cheek);
  }

  const makeLimb = (start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) => {
    const direction = end.clone().sub(start);
    const length = Math.max(0.001, direction.length());
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, length, 10), material);
    limb.position.copy(start).add(end).multiplyScalar(0.5);
    limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return limb;
  };

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), shirt);
    shoulder.position.set(side * 0.52, 1.43, 0);
    shoulder.scale.set(1.15, 0.8, 0.9);
    const shoulderPoint = new THREE.Vector3(side * 0.53, 1.38, 0.02);
    const elbowPoint = new THREE.Vector3(side * 0.63, 0.98, 0.03);
    const wristPoint = new THREE.Vector3(side * 0.58, 0.64, 0.04);
    const upperArm = makeLimb(shoulderPoint, elbowPoint, 0.078, shirt);
    const forearm = makeLimb(elbowPoint, wristPoint, 0.072, shirt);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 6), shirt);
    elbow.position.copy(elbowPoint);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.079, 0.083, 0.055, 10), accent);
    cuff.position.copy(wristPoint);
    cuff.quaternion.copy(forearm.quaternion);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skin);
    hand.position.copy(wristPoint).add(new THREE.Vector3(side * 0.015, -0.035, 0.015));
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.62, 10), pants);
    leg.position.set(side * 0.22, 0.28, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.32), boots);
    boot.position.set(side * 0.22, 0.04, 0.05);
    group.add(shoulder, upperArm, forearm, elbow, cuff, hand, leg, boot);
  }

  const backPack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.16), makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.88 }));
  backPack.position.set(0, 1.08, -0.33);
  const strapA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.055), accent);
  strapA.position.set(-0.26, 1.08, 0.24);
  strapA.rotation.z = 0.08;
  const strapB = strapA.clone();
  strapB.position.x = 0.26;
  strapB.rotation.z = -0.08;
  group.add(backPack, strapA, strapB);

  if (classId) addClassAccessories(group, classId, pal);
  if (armorTier) addArmorOverlay(group, armorTier);
  if (classId && jobTier >= 1) {
    const cosmetic = createJobTierCosmetic(classId, jobTier);
    if (cosmetic) group.add(cosmetic);
  }
  return group;
}

// 방어구 시각 오버레이 — 티어가 오를수록 화려해지되 머리 영역(y>1.8, 직업 투구/후드/모자)은 건드리지 않아
// 직업 특성이 항상 보이게 한다. 몸통/어깨/허리/다리에만 판금·보석·발광 트림을 얹는다.
function addArmorOverlay(group: THREE.Group, armorTier: string) {
  const tv = TIER_VISUALS[armorTier as TierId];
  if (!tv) return;
  if (tv.rank >= 4) {
    // 고급(gold/diamond/obsidian) — 무기와 동일한 전설 컨셉(날개 견갑·등 룬 마법진·발광 코어·스파크)
    addLegendaryArmor(group, tv);
    return;
  }
  const plateMat = tierBladeMaterial(tv);

  // 가슴 판금 (토르소 z=0 앞면 약간 앞에). 전사/탱커의 기존 plate 위로 살짝 더 앞에 얹혀 티어가 도드라진다.
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.12), plateMat);
  chest.position.set(0, 1.08, 0.3);
  group.add(chest);

  // 어깨 견갑 (collar 1.52 아래, 머리 액세서리 영역 밖)
  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plateMat);
    pauldron.position.set(sx * 0.52, 1.46, 0);
    pauldron.scale.set(1.12, 0.92, 1.0);
    group.add(pauldron);
  }

  // 허리 트림 밴드
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 22), tv.rank >= 2 ? tierGemMaterial(tv) : plateMat);
  belt.position.y = 0.6;
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.62, 1);
  group.add(belt);

  // copper+ : 가슴 중앙 보석 (gold+ 는 위에서 레전더리로 분기되므로 여기는 leather/copper/iron 전용)
  if (tv.gem) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), tierGemMaterial(tv));
    gem.position.set(0, 1.16, 0.37);
    group.add(gem);
  }
}

// 직업 특징을 살린 장신구/장비 — 거울에서 직업이 즉시 드러나게 한다.
function addClassAccessories(group: THREE.Group, classId: AvatarClassId, pal: AvatarAppearance) {
  const accentMetal = makeMetalMaterial(pal.accentColor, { metalness: 0.5, roughness: 0.3 });
  const accentGlow = makeGlowMaterial(pal.accentColor, pal.accentColor, { emissiveIntensity: 0.4, roughness: 0.3 });

  if (classId === "warrior") {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), makeMetalMaterial(0x8a93a3, { metalness: 0.6, roughness: 0.32 }));
    helm.position.y = 2.0;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), makeMetalMaterial(0x6f7785, { metalness: 0.6, roughness: 0.34 }));
    visor.position.set(0, 1.94, 0.27);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.32), accentMetal);
    crest.position.set(0, 2.18, 0);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.12), makeMetalMaterial(0x9aa3b2, { metalness: 0.58, roughness: 0.34 }));
    plate.position.set(0, 1.12, 0.24);
    group.add(helm, visor, crest, plate);
    return;
  }

  if (classId === "tanker") {
    const armor = makeMetalMaterial(0x9aa6b8, { metalness: 0.64, roughness: 0.3 });
    const darkArmor = makeMetalMaterial(0x596372, { metalness: 0.58, roughness: 0.36 });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), armor);
    helm.position.y = 2.01;
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.12), darkArmor);
    brow.position.set(0, 1.96, 0.27);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.72, 0.14), armor);
    plate.position.set(0, 1.08, 0.25);
    const shield = createIronShieldModel();
    shield.position.set(-0.66, 1.02, 0.3);
    shield.rotation.z = 0.08;
    group.add(helm, brow, plate, shield);
    return;
  }

  if (classId === "healer") {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 14), makeToonMaterial(pal.shirtColor, { roughness: 0.7 }));
    hood.position.y = 2.18;
    const hoodTrim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), accentMetal);
    hoodTrim.position.y = 1.98;
    hoodTrim.rotation.x = Math.PI / 2;
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.5, 8), makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.8 }));
    staff.position.set(0.62, 1.0, 0.18);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), accentGlow);
    orb.position.set(0.62, 1.82, 0.18);
    group.add(hood, hoodTrim, staff, orb);
    return;
  }

  if (classId === "mage") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 18), makeToonMaterial(pal.shirtColor, { roughness: 0.72 }));
    brim.position.y = 2.06;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.78, 16), makeToonMaterial(pal.shirtColor, { roughness: 0.72 }));
    hat.position.set(0.04, 2.42, 0);
    hat.rotation.z = -0.12;
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), accentGlow);
    star.position.set(0.12, 2.78, 0);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 16), accentMetal);
    band.position.y = 2.1;
    band.rotation.x = Math.PI / 2;
    group.add(brim, hat, star, band);
    return;
  }

  if (classId === "summoner") {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), makeToonMaterial(pal.shirtColor, { roughness: 0.78 }));
    hood.position.y = 1.96;
    const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), accentGlow);
    emblem.position.set(0, 1.18, 0.25);
    emblem.scale.set(1.1, 0.7, 0.4);
    for (const side of [-1, 1]) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 7), makeToonMaterial(pal.accentColor, { roughness: 0.6 }));
      feather.position.set(side * 0.34, 1.6, -0.1);
      feather.rotation.set(0.5, 0, side * 0.6);
      group.add(feather);
    }
    group.add(hood, emblem);
    return;
  }

  // gunner: 챙모자 + 권총 홀스터 + 탄띠
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.26, 14), makeToonMaterial(0x3a2e22, { roughness: 0.78 }));
  crown.position.y = 2.12;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.045, 18), makeToonMaterial(0x2e241b, { roughness: 0.8 }));
  brim.position.y = 1.99;
  const hatBand = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 16), accentMetal);
  hatBand.position.y = 2.02;
  hatBand.rotation.x = Math.PI / 2;
  const bandolier = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.92, 0.06), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.84 }));
  bandolier.position.set(0, 1.08, 0.23);
  bandolier.rotation.z = 0.5;
  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.12), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.84 }));
  holster.position.set(0.32, 0.5, 0.12);
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), makeMetalMaterial(0x4a4f57, { metalness: 0.55, roughness: 0.34 }));
  pistolGrip.position.set(0.32, 0.62, 0.12);
  pistolGrip.rotation.x = 0.25;
  group.add(crown, brim, hatBand, bandolier, holster, pistolGrip);
}

// 소환사가 독수리에 빙의했을 때 거울/파티에 보일 모습.
export function createEagleAvatarModel() {
  const group = new THREE.Group();
  const feather = makeToonMaterial(0x6b4a2f, { roughness: 0.7 });
  const featherLight = makeToonMaterial(0x9a7444, { roughness: 0.68 });
  const headFeather = makeToonMaterial(0xf2ead8, { roughness: 0.66 });
  const beakMat = makeToonMaterial(0xf2c14e, { roughness: 0.5 });
  const talonMat = makeMetalMaterial(0xe0a93a, { metalness: 0.4, roughness: 0.4 });
  const eyeMat = makeGlowMaterial(0xffd34d, 0x6b3b00, { emissiveIntensity: 0.4, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), feather);
  body.position.y = 1.2;
  body.scale.set(0.9, 1.2, 0.9);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), featherLight);
  chest.position.set(0, 1.18, 0.22);
  chest.scale.set(0.8, 1.0, 0.6);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), headFeather);
  head.position.set(0, 1.78, 0.06);
  const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 10), beakMat);
  beakUpper.position.set(0, 1.74, 0.34);
  beakUpper.rotation.x = Math.PI / 2;
  const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), beakMat);
  beakHook.position.set(0, 1.68, 0.42);
  beakHook.rotation.x = Math.PI / 2 + 0.6;
  group.add(body, chest, head, beakUpper, beakHook);

  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), feather);
    brow.position.set(side * 0.13, 1.86, 0.24);
    brow.rotation.z = side * 0.3;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeMat);
    eye.position.set(side * 0.13, 1.8, 0.26);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.5), feather);
    wing.position.set(side * 0.55, 1.2, -0.05);
    wing.rotation.z = side * 0.4;
    wing.scale.set(1, 1, 1.1);
    const wingTip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), featherLight);
    wingTip.position.set(side * 0.82, 0.78, -0.05);
    wingTip.rotation.z = side * (Math.PI / 2 - 0.3);
    const talon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.3, 7), talonMat);
    talon.position.set(side * 0.18, 0.5, 0.1);
    group.add(brow, eye, wing, wingTip, talon);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), feather);
  tail.position.set(0, 0.85, -0.42);
  tail.rotation.x = -1.2;
  tail.scale.set(1.2, 1, 0.4);
  group.add(tail);
  return group;
}

export function createMirrorModel(scale = 1) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.96, 0.08),
    makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.72 }),
  );
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.76, 0.035),
    makeGlowMaterial(0xbfe9ff, 0x123447, {
      metalness: 0.5,
      roughness: 0.12,
      transparent: true,
      opacity: 0.72,
      emissiveIntensity: 0.18,
    }),
  );
  glass.position.z = 0.04;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.5, 10), makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.8 }));
  handle.position.y = -0.72;
  const shine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.04), makeGlowMaterial(0xffffff, 0xffffff, { transparent: true, opacity: 0.55, emissiveIntensity: 0.18 }));
  shine.position.set(-0.14, 0.08, 0.07);
  shine.rotation.z = -0.28;
  group.add(frame, glass, handle, shine);
  group.scale.setScalar(scale);
  return group;
}
