import * as THREE from "three";
import type { ObjectType, WalkPartSetup } from "./types";

export interface RangedGuardVisual {
  group: THREE.Group;
  name: string;
  hp: number;
  armor: number;
  collisionRadius: number;
  collisionHeight: number;
  attackRange: number;
  attackDamage: number;
  walkParts: WalkPartSetup[];
  walk: {
    amplitude: number;
    speed: number;
    lift: number;
  };
}

export function createRangedGuardVisual(type: Extract<ObjectType, "villageArcher" | "villageMage">): RangedGuardVisual {
  const isMage = type === "villageMage";
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xceb08c, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a3823, roughness: 0.86 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.82 });
  const walkParts: WalkPartSetup[] = [];

  if (isMage) {
    const robe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.62, 1.32, 8),
      new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.78 }),
    );
    robe.position.y = 0.92;
    const robeFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.08, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x8b6fd2, roughness: 0.7 }),
    );
    robeFront.position.set(0, 0.96, 0.5);
    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.2, roughness: 0.48 }),
    );
    sash.position.set(0, 0.66, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), skin);
    head.position.y = 1.78;
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9dce8, roughness: 0.92 }),
    );
    beard.position.set(0, 1.48, 0.25);
    beard.rotation.x = -0.25;
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.78, 16),
      new THREE.MeshStandardMaterial({ color: 0x3b2671, roughness: 0.76 }),
    );
    hat.position.y = 2.18;
    hat.rotation.z = -0.1;
    const hatBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.36, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.44 }),
    );
    hatBand.position.y = 1.92;
    group.add(robe, robeFront, sash, head, beard, hat, hatBand);

    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x91f2ff, emissive: 0x187aa0, emissiveIntensity: 0.75, roughness: 0.25 }),
      );
      eye.position.set(x, 1.8, 0.27);
      group.add(eye);
    }

    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.7, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x4f347f, roughness: 0.78 }),
      );
      sleeve.position.set(side * 0.5, 1.02, 0.02);
      sleeve.rotation.z = side * -0.28;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
      hand.position.set(side * 0.62, 0.7, 0.1);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), dark);
      foot.position.set(side * 0.2, 0.08, 0.1);
      const robeHem = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.36, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x4f347f, roughness: 0.8 }),
      );
      robeHem.position.set(side * 0.18, 0.27, 0.02);
      walkParts.push({ object: robeHem, side, axis: "x" }, { object: foot, side, axis: "x" });
      group.add(sleeve, hand, robeHem, foot);
    }

    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.55, 8), wood);
    staff.position.set(0.72, 1.08, 0.08);
    staff.rotation.z = -0.16;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x8fd7ff, emissive: 0x2467ff, emissiveIntensity: 1.35, roughness: 0.22 }),
    );
    orb.position.set(0.84, 1.88, 0.08);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.015, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.75 }),
    );
    halo.position.copy(orb.position);
    halo.rotation.x = Math.PI / 2;
    group.add(staff, orb, halo);
  } else {
    const tunic = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 1.08, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x4f6f4a, roughness: 0.82 }),
    );
    tunic.position.y = 0.92;
    const leatherVest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.05), leather);
    leatherVest.position.set(0, 1.0, 0.25);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.48), leather);
    belt.position.y = 0.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), skin);
    head.position.y = 1.72;
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.76),
      new THREE.MeshStandardMaterial({ color: 0x2f5731, roughness: 0.82 }),
    );
    hood.position.y = 1.81;
    const hoodPeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.24, 4),
      new THREE.MeshStandardMaterial({ color: 0x264c2a, roughness: 0.82 }),
    );
    hoodPeak.position.set(0, 1.78, 0.35);
    hoodPeak.rotation.x = Math.PI / 2;
    group.add(tunic, leatherVest, belt, head, hood, hoodPeak);

    for (const x of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
      eye.position.set(x, 1.73, 0.27);
      group.add(eye);
    }

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.72, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x3e5f3c, roughness: 0.82 }),
      );
      arm.position.set(side * 0.52, 1.0, 0.04);
      arm.rotation.z = side * (side > 0 ? -0.52 : 0.28);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
      hand.position.set(side * 0.62, 0.7, 0.14);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), leather);
      leg.position.set(side * 0.18, 0.25, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.26), dark);
      boot.position.set(side * 0.18, 0.04, 0.04);
      walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
      group.add(arm, hand, leg, boot);
    }

    const bowTop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.78, 8), wood);
    bowTop.position.set(0.72, 1.28, 0.18);
    bowTop.rotation.z = -0.42;
    bowTop.rotation.x = 0.1;
    const bowBottom = bowTop.clone();
    bowBottom.position.set(0.52, 0.72, 0.18);
    bowBottom.rotation.z = 0.42;
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 1.16, 6),
      new THREE.MeshBasicMaterial({ color: 0xe5e7eb }),
    );
    string.position.set(0.62, 1.0, 0.29);
    string.rotation.z = -0.08;
    const arrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.82, 6),
      new THREE.MeshStandardMaterial({ color: 0xddd6c9, roughness: 0.7 }),
    );
    arrow.position.set(0.58, 1.02, 0.35);
    arrow.rotation.z = Math.PI / 2;
    const quiver = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.62, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.85 }),
    );
    quiver.position.set(-0.42, 1.08, -0.26);
    quiver.rotation.z = 0.36;
    for (const offset of [-0.08, 0, 0.08]) {
      const quiverArrow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 5), wood);
      quiverArrow.position.set(-0.44 + offset, 1.43, -0.22);
      quiverArrow.rotation.z = 0.28;
      group.add(quiverArrow);
    }
    group.add(bowTop, bowBottom, string, arrow, quiver);
  }

  return {
    group,
    name: isMage ? "마을 마법사" : "마을 궁수",
    hp: isMage ? 72 : 78,
    armor: isMage ? 14 : 16,
    collisionRadius: isMage ? 0.68 : 0.64,
    collisionHeight: isMage ? 2.35 : 2.1,
    attackRange: isMage ? 22 : 18,
    attackDamage: isMage ? 10 : 9,
    walkParts,
    walk: {
      amplitude: isMage ? 0.28 : 0.36,
      speed: isMage ? 6.5 : 7.5,
      lift: 0.022,
    },
  };
}
