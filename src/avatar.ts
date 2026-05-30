import * as THREE from "three";

export interface AvatarAppearance {
  skinColor: number;
  hairColor: number;
  shirtColor: number;
  pantsColor: number;
  bootColor: number;
  accentColor: number;
}

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = {
  skinColor: 0xd1a17a,
  hairColor: 0x1f2937,
  shirtColor: 0x2f5f9f,
  pantsColor: 0x334155,
  bootColor: 0x24170f,
  accentColor: 0xfacc15,
};

export function createAvatarModel(appearance: AvatarAppearance = DEFAULT_AVATAR_APPEARANCE) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: appearance.skinColor, roughness: 0.78 });
  const hair = new THREE.MeshStandardMaterial({ color: appearance.hairColor, roughness: 0.82 });
  const shirt = new THREE.MeshStandardMaterial({ color: appearance.shirtColor, roughness: 0.78 });
  const pants = new THREE.MeshStandardMaterial({ color: appearance.pantsColor, roughness: 0.82 });
  const boots = new THREE.MeshStandardMaterial({ color: appearance.bootColor, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: appearance.accentColor, metalness: 0.18, roughness: 0.42 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.08, 0.44), shirt);
  torso.position.y = 1.04;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.48), accent);
  belt.position.y = 0.58;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 10), skin);
  neck.position.y = 1.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), skin);
  head.position.y = 1.9;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  hairCap.position.y = 2.0;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin);
  nose.position.set(0, 1.9, 0.31);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), hair);
  mouth.position.set(0, 1.8, 0.31);
  group.add(torso, belt, neck, head, hairCap, nose, mouth);

  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hair);
    eye.position.set(x, 1.94, 0.3);
    group.add(eye);
  }

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.18), shirt);
    arm.position.set(side * 0.56, 1.08, 0);
    arm.rotation.z = side * -0.18;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skin);
    hand.position.set(side * 0.62, 0.64, 0.03);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.22), pants);
    leg.position.set(side * 0.22, 0.28, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.32), boots);
    boot.position.set(side * 0.22, 0.04, 0.05);
    group.add(arm, hand, leg, boot);
  }

  const backPack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.16), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.88 }));
  backPack.position.set(0, 1.08, -0.33);
  group.add(backPack);
  return group;
}

export function createMirrorModel(scale = 1) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.96, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.72 }),
  );
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.76, 0.035),
    new THREE.MeshStandardMaterial({
      color: 0xbfe9ff,
      metalness: 0.5,
      roughness: 0.12,
      transparent: true,
      opacity: 0.72,
      emissive: 0x123447,
      emissiveIntensity: 0.18,
    }),
  );
  glass.position.z = 0.04;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.8 }));
  handle.position.y = -0.72;
  const shine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  shine.position.set(-0.14, 0.08, 0.07);
  shine.rotation.z = -0.28;
  group.add(frame, glass, handle, shine);
  group.scale.setScalar(scale);
  return group;
}
