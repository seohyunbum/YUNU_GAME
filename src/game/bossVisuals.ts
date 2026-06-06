import * as THREE from "three";
import {
  ASSET_PALETTE,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "../visuals";
import type { BossKind } from "./types";

export interface DragonVisualStats {
  scale: number;
  body: number;
  belly: number;
  wing: number;
  glow: number;
}

export function createDragonVisual(bossKind: BossKind, stats: DragonVisualStats) {
  const group = new THREE.Group();
  const darkColor = new THREE.Color(stats.body).multiplyScalar(0.42).getHex();
  const bodyMaterial = makeToonMaterial(stats.body, { roughness: 0.64, metalness: bossKind === "immortal" ? 0.18 : 0.04 });
  const bellyMaterial = makeGlowMaterial(stats.belly, stats.glow, { emissiveIntensity: bossKind === "immortal" ? 0.42 : 0.18, roughness: 0.5 });
  const darkMaterial = makeToonMaterial(darkColor, { roughness: 0.72 });
  const wingMaterial = makeGlowMaterial(stats.wing, stats.glow, {
    emissiveIntensity: bossKind === "dragon" ? 0.16 : 0.34,
    roughness: 0.58,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  });
  const hornMaterial = makeMetalMaterial(ASSET_PALETTE.clothCream, { roughness: 0.42, metalness: 0.08 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), bodyMaterial);
  body.position.set(0, 2.65, 0);
  body.scale.set(2.55, 0.82, 0.95);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.74, 18, 10), bellyMaterial);
  belly.position.set(0.55, 2.42, 0);
  belly.scale.set(1.6, 0.36, 0.7);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.88, 18, 10), bodyMaterial);
  chest.position.set(1.52, 2.82, 0);
  chest.scale.set(0.95, 0.9, 0.9);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.48, 1.45, 12), bodyMaterial);
  neck.position.set(2.06, 3.32, 0);
  neck.rotation.z = -0.76;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), bodyMaterial);
  head.position.set(2.82, 3.78, 0);
  head.scale.set(1.16, 0.82, 0.9);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.78, 8), bodyMaterial);
  snout.position.set(3.35, 3.68, 0);
  snout.rotation.z = -Math.PI / 2;
  group.add(body, belly, chest, neck, head, snout);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 6),
      makeGlowMaterial(0xfff7ed, stats.glow, { emissiveIntensity: bossKind === "immortal" ? 1.6 : 0.85, roughness: 0.28 }),
    );
    eye.position.set(3.26, 3.88, side * 0.24);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.58, 7), hornMaterial);
    horn.position.set(2.56, 4.26, side * 0.25);
    horn.rotation.set(side * 0.28, 0, -0.45);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.1), darkMaterial);
    brow.position.set(3.12, 3.99, side * 0.22);
    brow.rotation.z = side * -0.1;
    group.add(eye, horn, brow);
  }

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-1.35, 1.45);
  wingShape.lineTo(-2.85, -0.25);
  wingShape.lineTo(-1.05, -0.42);
  wingShape.lineTo(0, 0);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), wingMaterial);
    wing.position.set(0.48, 3.2, side * 0.72);
    wing.rotation.set(side * -0.28, side * 0.16, side * 0.16);
    wing.userData.dragonWing = true;
    wing.userData.baseZ = wing.rotation.z;
    const boneA = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 2.2, 8), darkMaterial);
    boneA.position.set(-0.58, 3.72, side * 0.78);
    boneA.rotation.set(0.04, side * 0.2, 0.92);
    const boneB = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.85, 8), darkMaterial);
    boneB.position.set(-1.35, 2.9, side * 0.82);
    boneB.rotation.set(0, side * 0.18, 1.7);
    group.add(wing, boneA, boneB);
  }

  for (let index = 0; index < 6; index += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14 - index * 0.008, 0.42, 7), darkMaterial);
    spike.position.set(2.05 - index * 0.72, 3.55 - index * 0.08, 0);
    spike.rotation.z = Math.PI;
    group.add(spike);
  }

  const tailRoot = new THREE.Group();
  tailRoot.userData.dragonTail = true;
  tailRoot.position.set(-1.98, 2.58, 0);
  for (let index = 0; index < 5; index += 1) {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - index * 0.025, 0.3 - index * 0.03, 0.72, 10), bodyMaterial);
    segment.position.set(-0.36 - index * 0.46, -index * 0.05, 0);
    segment.rotation.z = 1.42;
    tailRoot.add(segment);
  }
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 7), darkMaterial);
  tailTip.position.set(-2.95, -0.3, 0);
  tailTip.rotation.z = Math.PI / 2;
  tailRoot.add(tailTip);
  group.add(tailRoot);

  for (const x of [-0.95, 0.92]) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 1.15, 10), bodyMaterial);
      leg.position.set(x, 1.42, side * 0.48);
      leg.rotation.z = x > 0 ? -0.12 : 0.12;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.3), darkMaterial);
      foot.position.set(x + 0.16, 0.78, side * 0.52);
      for (let clawIndex = 0; clawIndex < 3; clawIndex += 1) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 5), hornMaterial);
        claw.position.set(x + 0.46, 0.8, side * (0.38 + clawIndex * 0.08));
        claw.rotation.z = -Math.PI / 2;
        group.add(claw);
      }
      group.add(leg, foot);
    }
  }

  if (bossKind === "laser_dragon" || bossKind === "dark_dragon" || bossKind === "immortal") {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: stats.glow, transparent: true, opacity: bossKind === "immortal" ? 0.48 : 0.34, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const radius of bossKind === "immortal" ? [1.4, 2.15, 2.9] : [1.35, 2.1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 64), ringMaterial);
      ring.position.set(0.55, 2.8, 0);
      ring.rotation.x = Math.PI / 2;
      ring.userData.dragonTail = true;
      group.add(ring);
    }
  }

  const glow = new THREE.PointLight(stats.glow, bossKind === "immortal" ? 2.4 : 1.15, bossKind === "immortal" ? 18 : 11, 1.8);
  glow.position.set(1.8, 3.2, 0);
  group.add(glow);
  group.scale.setScalar(stats.scale);
  return group;
}
