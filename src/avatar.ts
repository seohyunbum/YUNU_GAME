import * as THREE from "three";
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

export function createAvatarModel(appearance: AvatarAppearance = DEFAULT_AVATAR_APPEARANCE) {
  const group = new THREE.Group();
  const skin = makeToonMaterial(appearance.skinColor, { roughness: 0.72 });
  const hair = makeToonMaterial(appearance.hairColor, { roughness: 0.82 });
  const shirt = makeToonMaterial(appearance.shirtColor, { roughness: 0.76 });
  const pants = makeToonMaterial(appearance.pantsColor, { roughness: 0.8 });
  const boots = makeToonMaterial(appearance.bootColor, { roughness: 0.86 });
  const accent = makeMetalMaterial(appearance.accentColor, { metalness: 0.18, roughness: 0.38 });

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
