// 신규 포식자 아키타입 비주얼 — 데이터 → THREE.Group 순수 팩토리.
// 기존 늑대/사자/거미(creatureVisuals)와 같은 PredatorVisual 형태를 반환하고,
// 공격 모션이 참조하는 부위는 group.userData 에 핸들을 남긴다
// (scorpionTail · zombieArms · ghostMaterials — predatorAi 가 사용).
import * as THREE from "three";
import { gameMaterial } from "../visuals";
import type { PredatorVisual } from "./creatureVisuals";
import type { PredatorKind, WalkPartSetup } from "./types";

function eye(color: number, emissive: number, x: number, y: number, z: number, radius = 0.045) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.7 : 0, roughness: 0.35 }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function createBoarVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const hide = gameMaterial(0x8b5a33, { roughness: 0.88 });
  const bristle = gameMaterial(0x4f2f17, { roughness: 0.95 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.85), hide);
  body.position.y = 0.66;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.32), bristle);
  ridge.position.set(-0.12, 1.1, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.6), hide);
  head.position.set(0.95, 0.62, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.36), gameMaterial(0x6d4426, { roughness: 0.9 }));
  snout.position.set(1.32, 0.5, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.26), gameMaterial(0xc4836a, { roughness: 0.8 }));
  nose.position.set(1.49, 0.5, 0);
  group.add(body, ridge, head, snout, nose);

  const tuskMaterial = gameMaterial(0xfef3c7, { roughness: 0.4 });
  for (const z of [-0.18, 0.18]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 6), tuskMaterial);
    tusk.position.set(1.34, 0.36, z);
    tusk.rotation.z = 0.5;
    group.add(tusk);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 5), bristle);
    ear.position.set(0.78, 0.96, z * 1.3);
    ear.rotation.z = -0.4;
    group.add(ear);
    group.add(eye(0xfca5a5, 0x7f1d1d, 1.18, 0.74, z * 0.9));
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.3, 6), bristle);
  tail.position.set(-0.78, 0.92, 0);
  tail.rotation.z = 0.7;
  group.add(tail);

  for (let index = 0; index < 4; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const front = index < 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), bristle);
    leg.position.set(front ? 0.52 : -0.52, 0.21, side * 0.28);
    walkParts.push({ object: leg, side: side * (front ? 1 : -1), axis: "x" });
    group.add(leg);
  }

  return {
    group,
    predatorKind: "boar",
    name: "멧돼지",
    collisionRadius: 0.95,
    collisionHeight: 1.15,
    walkParts,
    walk: { amplitude: 0.55, speed: 9, lift: 0.04 },
  };
}

function createSnakeVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const scale = gameMaterial(0x4d7c0f, { roughness: 0.72 });
  const belly = gameMaterial(0xa3b18a, { roughness: 0.8 });

  const segments: [number, number, number][] = [
    [-0.12, 0.3, 0.2],
    [-0.56, 0.27, -0.22],
    [-0.98, 0.23, 0.18],
    [-1.34, 0.18, -0.12],
  ];
  segments.forEach(([x, radius, z], index) => {
    const segment = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 9), scale);
    segment.position.set(x, radius * 0.72, z);
    segment.scale.set(1.45, 0.78, 1);
    if (index >= 2) walkParts.push({ object: segment, side: index % 2 === 0 ? 1 : -1, axis: "z" });
    group.add(segment);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.7, 8), scale);
  neck.position.set(0.28, 0.6, 0);
  neck.rotation.z = -0.5;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.5), scale);
  hood.position.set(0.4, 0.88, 0);
  hood.rotation.z = -0.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.32), gameMaterial(0x3f6212, { roughness: 0.68 }));
  head.position.set(0.62, 1.02, 0);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.26), belly);
  chin.position.set(0.6, 0.88, 0);
  group.add(neck, hood, head, chin);

  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.05), gameMaterial(0xdc2626, { emissive: 0x7f1d1d, emissiveIntensity: 0.4 }));
  tongue.position.set(0.9, 0.98, 0);
  walkParts.push({ object: tongue, side: 1, axis: "z" });
  group.add(tongue);
  group.add(eye(0xfacc15, 0xa16207, 0.74, 1.1, -0.12), eye(0xfacc15, 0xa16207, 0.74, 1.1, 0.12));

  return {
    group,
    predatorKind: "snake",
    name: "풀숲뱀",
    collisionRadius: 0.75,
    collisionHeight: 1.0,
    walkParts,
    walk: { amplitude: 0.4, speed: 7.5, lift: 0.02 },
  };
}

function createBatVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const fur = gameMaterial(0x57534e, { roughness: 0.85 });
  const membrane = gameMaterial(0x3b3734, { roughness: 0.65 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), fur);
  body.position.y = 1.5;
  body.scale.set(1.15, 1, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fur);
  head.position.set(0.3, 1.66, 0);
  group.add(body, head);

  for (const z of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(-0.02, 1.56, z * 0.16);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.66), membrane);
    inner.position.z = z * 0.42;
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.56), membrane);
    outer.position.set(-0.05, 0.04, z * 0.92);
    outer.rotation.x = z * 0.18;
    wing.add(inner, outer);
    walkParts.push({ object: wing, side: z, axis: "x" });
    group.add(wing);

    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 5), fur);
    ear.position.set(0.3, 1.9, z * 0.12);
    group.add(ear);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), membrane);
    claw.position.set(-0.1, 1.2, z * 0.1);
    claw.rotation.x = Math.PI;
    group.add(claw);
    group.add(eye(0xff5a5a, 0x991b1b, 0.48, 1.7, z * 0.09, 0.04));
  }

  return {
    group,
    predatorKind: "bat",
    name: "동굴박쥐",
    collisionRadius: 0.6,
    collisionHeight: 1.9,
    walkParts,
    walk: { amplitude: 0.75, speed: 13, lift: 0.07 },
  };
}

function createScorpionVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const shell = gameMaterial(0xa16207, { roughness: 0.62 });
  const plate = gameMaterial(0x713f12, { roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.8), shell);
  body.position.y = 0.34;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.6), plate);
  back.position.set(-0.1, 0.52, 0);
  const headPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), plate);
  headPlate.position.set(0.62, 0.4, 0);
  group.add(body, back, headPlate);
  group.add(eye(0xfbbf24, 0xb45309, 0.84, 0.5, -0.12, 0.04), eye(0xfbbf24, 0xb45309, 0.84, 0.5, 0.12, 0.04));

  for (let index = 0; index < 6; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.56), plate);
    leg.position.set(-0.3 + row * 0.32, 0.26, side * 0.52);
    leg.rotation.x = side * 0.5;
    walkParts.push({ object: leg, side: side * (row % 2 === 0 ? 1 : -1), axis: "z" });
    group.add(leg);
  }

  for (const z of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.12), shell);
    arm.position.set(0.92, 0.32, z);
    arm.rotation.y = -z * 0.6;
    const pincerTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.1), plate);
    pincerTop.position.set(1.2, 0.38, z * 1.15);
    const pincerBottom = pincerTop.clone();
    pincerBottom.position.y = 0.26;
    group.add(arm, pincerTop, pincerBottom);
  }

  const tail = new THREE.Group();
  tail.position.set(-0.62, 0.45, 0);
  const tailSegments = [0.16, 0.13, 0.11];
  let tailY = 0.12;
  let tailX = -0.1;
  tailSegments.forEach((radius, index) => {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius, 0.34, 7), shell);
    segment.position.set(tailX, tailY, 0);
    segment.rotation.z = 0.85 - index * 0.35;
    tail.add(segment);
    tailX -= 0.1 - index * 0.09;
    tailY += 0.3;
  });
  const stinger = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.3, 7),
    gameMaterial(0x16a34a, { emissive: 0x14532d, emissiveIntensity: 0.5, roughness: 0.4 }),
  );
  stinger.position.set(0.06, tailY + 0.1, 0);
  stinger.rotation.z = -2.2;
  tail.add(stinger);
  group.add(tail);
  group.userData.scorpionTail = tail;

  return {
    group,
    predatorKind: "scorpion",
    name: "바위전갈",
    collisionRadius: 0.95,
    collisionHeight: 0.9,
    walkParts,
    walk: { amplitude: 0.8, speed: 9.5, lift: 0.035 },
  };
}

function createBearVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const fur = gameMaterial(0x7c4a24, { roughness: 0.9 });
  const dark = gameMaterial(0x5b3015, { roughness: 0.92 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.95), fur);
  body.position.y = 0.95;
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), dark);
  hump.position.set(-0.35, 1.5, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.6), fur);
  head.position.set(1.05, 1.35, 0);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.3), dark);
  muzzle.position.set(1.42, 1.24, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.14), gameMaterial(0x1c1917));
  nose.position.set(1.56, 1.26, 0);
  group.add(body, hump, head, muzzle, nose);

  for (const z of [-0.2, 0.2]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), dark);
    ear.position.set(0.92, 1.7, z);
    group.add(ear);
    group.add(eye(0x1c1917, 0x000000, 1.32, 1.44, z * 0.7, 0.045));
  }

  const clawMaterial = gameMaterial(0xfef3c7, { roughness: 0.45 });
  for (let index = 0; index < 4; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const front = index < 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.28), dark);
    leg.position.set(front ? 0.58 : -0.58, 0.36, side * 0.34);
    walkParts.push({ object: leg, side: side * (front ? 1 : -1), axis: "x" });
    group.add(leg);
    if (front) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), clawMaterial);
      claw.position.set(front ? 0.72 : -0.72, 0.08, side * 0.34);
      claw.rotation.z = -Math.PI / 2;
      group.add(claw);
    }
  }

  return {
    group,
    predatorKind: "bear",
    name: "불곰",
    collisionRadius: 1.25,
    collisionHeight: 1.65,
    walkParts,
    walk: { amplitude: 0.45, speed: 6.5, lift: 0.045 },
  };
}

function createZombieVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const skin = gameMaterial(0x5b8a3c, { roughness: 0.85 });
  const cloth = gameMaterial(0x44403c, { roughness: 0.95 });
  const pants = gameMaterial(0x292524, { roughness: 0.95 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.3), cloth);
  torso.position.y = 1.08;
  const rip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.05), skin);
  rip.position.set(0.12, 1.0, 0.15);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.set(0, 1.62, 0);
  head.rotation.z = -0.14;
  const wound = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.05), gameMaterial(0x3f6212, { roughness: 0.9 }));
  wound.position.set(0.1, 1.74, 0.14);
  group.add(torso, rip, head, wound);
  group.add(eye(0xff3355, 0x991b1b, 0.1, 1.66, 0.17, 0.04), eye(0xff3355, 0x991b1b, -0.08, 1.64, 0.17, 0.04));

  const arms: THREE.Object3D[] = [];
  for (const z of [-0.24, 0.24]) {
    const arm = new THREE.Group();
    arm.position.set(0.2, 1.3, z);
    const limb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.13, 0.13), skin);
    limb.position.x = 0.3;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.15), skin);
    hand.position.set(0.62, -0.03, 0);
    arm.add(limb, hand);
    arm.rotation.z = -0.08;
    arms.push(arm);
    group.add(arm);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.19), pants);
    leg.position.set(0, 0.5, z * 0.55);
    walkParts.push({ object: leg, side: z > 0 ? 1 : -1, axis: "x" });
    group.add(leg);
  }
  group.userData.zombieArms = arms;

  return {
    group,
    predatorKind: "zombie",
    name: "좀비",
    collisionRadius: 0.55,
    collisionHeight: 1.9,
    walkParts,
    walk: { amplitude: 0.32, speed: 4.8, lift: 0.055 },
  };
}

function createGhostVisual(): PredatorVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const shroudMaterial = new THREE.MeshStandardMaterial({
    color: 0xe5edff,
    transparent: true,
    opacity: 0.52,
    emissive: 0x93b4ff,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    depthWrite: false,
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), shroudMaterial);
  head.position.y = 1.7;
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.16, 1.15, 10), shroudMaterial);
  robe.position.y = 1.05;
  group.add(head, robe);

  for (const [offset, lean] of [[-0.2, 0.4], [0.02, -0.2], [0.22, 0.5]] as const) {
    const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 7), shroudMaterial);
    wisp.position.set(offset, 0.42, offset * 0.6);
    wisp.rotation.x = Math.PI + lean * 0.3;
    wisp.rotation.z = lean;
    walkParts.push({ object: wisp, side: lean > 0 ? 1 : -1, axis: "z" });
    group.add(wisp);
  }
  for (const z of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 7), shroudMaterial);
    arm.position.set(0.18, 1.25, z);
    arm.rotation.z = -1.9;
    arm.rotation.x = z * 0.4;
    group.add(arm);
  }

  const socketMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.6 });
  for (const z of [-0.14, 0.14]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), socketMaterial);
    socket.position.set(0.32, 1.76, z);
    socket.scale.set(0.6, 1.25, 1);
    group.add(socket);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), socketMaterial);
  mouth.position.set(0.36, 1.5, 0);
  mouth.scale.set(0.5, 1.6, 0.8);
  group.add(mouth);
  group.userData.ghostMaterials = [shroudMaterial];

  return {
    group,
    predatorKind: "ghost",
    name: "묘지귀신",
    collisionRadius: 0.62,
    collisionHeight: 2.1,
    walkParts,
    walk: { amplitude: 0.26, speed: 3.6, lift: 0.085 },
  };
}

const FACTORIES: Partial<Record<PredatorKind, () => PredatorVisual>> = {
  boar: createBoarVisual,
  snake: createSnakeVisual,
  bat: createBatVisual,
  scorpion: createScorpionVisual,
  bear: createBearVisual,
  zombie: createZombieVisual,
  ghost: createGhostVisual,
};

export function createExtendedPredatorVisual(kind: PredatorKind): PredatorVisual | null {
  return FACTORIES[kind]?.() ?? null;
}
