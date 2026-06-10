import * as THREE from "three";
import { gameMaterial } from "../visuals";
import { createExtendedPredatorVisual } from "./monsterVisuals";
import type { AnimalKind, PredatorKind, WalkPartSetup } from "./types";

export interface CreatureWalkConfig {
  amplitude: number;
  speed: number;
  lift: number;
}

export interface AnimalVisual {
  group: THREE.Group;
  animalType: AnimalKind;
  name: string;
  hp: number;
  collisionRadius: number;
  collisionHeight: number;
  walkParts: WalkPartSetup[];
  walk: CreatureWalkConfig;
}

export interface PredatorVisual {
  group: THREE.Group;
  predatorKind: PredatorKind;
  name: string;
  collisionRadius: number;
  collisionHeight: number;
  walkParts: WalkPartSetup[];
  walk: CreatureWalkConfig;
}

export interface JamminiVisual {
  group: THREE.Group;
  walkParts: WalkPartSetup[];
  walk: CreatureWalkConfig;
}

export function createAnimalVisual(preferredType?: AnimalKind): AnimalVisual {
  const group = new THREE.Group();
  const roll = Math.random();
  const animalType: AnimalKind = preferredType ?? (roll < 0.32 ? "cow" : roll < 0.58 ? "horse" : roll < 0.82 ? "pig" : "chicken");
  const isChicken = animalType === "chicken";
  const isPig = animalType === "pig";
  const isHorse = animalType === "horse";
  const walkParts: WalkPartSetup[] = [];
  const bodyColor = isHorse ? 0x9a6338 : animalType === "cow" ? 0xf2eee4 : isPig ? 0xf2a5b5 : 0xf2e6bf;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(isChicken ? 0.68 : isHorse ? 1.85 : 1.5, isChicken ? 0.56 : isHorse ? 0.82 : 0.74, isChicken ? 0.5 : 0.62),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9 }),
  );
  body.position.y = isChicken ? 0.48 : isHorse ? 1.05 : 0.88;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(isChicken ? 0.42 : isHorse ? 0.52 : 0.6, isChicken ? 0.38 : 0.48, isChicken ? 0.38 : 0.48),
    new THREE.MeshStandardMaterial({ color: isHorse ? 0x8a512e : animalType === "cow" ? 0xd9c7ae : isPig ? 0xf5b4c0 : 0xf6e7c8, roughness: 0.9 }),
  );
  head.position.set(isChicken ? 0.42 : isHorse ? 1.18 : 0.96, isChicken ? 0.86 : isHorse ? 1.36 : 1.05, 0);
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(isChicken ? 0.18 : 0.28, isHorse ? 0.78 : 0.35, isChicken ? 0.18 : 0.36),
    new THREE.MeshStandardMaterial({ color: isHorse ? 0x8a512e : animalType === "cow" ? 0xd9c7ae : isPig ? 0xf5b4c0 : 0xf6e7c8, roughness: 0.9 }),
  );
  neck.position.set(isChicken ? 0.24 : 0.86, isChicken ? 0.68 : isHorse ? 1.22 : 1.0, 0);
  neck.rotation.z = isHorse ? -0.35 : -0.12;
  group.add(body, neck, head);

  const legXs = isChicken ? [-0.18, 0.18] : [-0.58, 0.58];
  const legZs = isChicken ? [0] : [-0.23, 0.23];
  for (const x of legXs) {
    for (const z of legZs) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(isChicken ? 0.06 : 0.16, isChicken ? 0.36 : isHorse ? 0.95 : 0.72, isChicken ? 0.06 : 0.16),
        new THREE.MeshStandardMaterial({ color: isChicken ? 0xd97706 : isHorse ? 0x4d2f20 : 0x3c332d, roughness: 0.92 }),
      );
      leg.position.set(x, isChicken ? 0.18 : isHorse ? 0.48 : 0.36, z);
      walkParts.push({ object: leg, side: (x >= 0 ? 1 : -1) * (z >= 0 ? 1 : -1), axis: "z" });
      group.add(leg);
    }
  }

  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(isChicken ? 0.04 : 0.035, isChicken ? 0.08 : 0.06, isChicken ? 0.32 : isHorse ? 0.9 : 0.55, 7),
    new THREE.MeshStandardMaterial({ color: isChicken ? 0xffffff : isHorse ? 0x2b1a12 : isPig ? 0xf28aa2 : 0xddd6c9, roughness: 0.9 }),
  );
  tail.position.set(isChicken ? -0.42 : isHorse ? -1.05 : -0.82, isChicken ? 0.67 : isHorse ? 1.08 : 0.83, 0);
  tail.rotation.z = isChicken ? 0.8 : 1.1;
  group.add(tail);

  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(isChicken ? 0.035 : 0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 }),
    );
    eye.position.set(head.position.x + (isChicken ? 0.21 : 0.29), head.position.y + 0.08, z);
    group.add(eye);
  }
  const nose = new THREE.Mesh(
    isChicken ? new THREE.ConeGeometry(0.11, 0.24, 4) : new THREE.BoxGeometry(isPig ? 0.28 : 0.2, isPig ? 0.18 : 0.12, isPig ? 0.28 : 0.18),
    new THREE.MeshStandardMaterial({ color: isChicken ? 0xf59e0b : isPig ? 0xe8798f : 0x2f2118, roughness: 0.76 }),
  );
  nose.position.set(head.position.x + (isChicken ? 0.32 : 0.34), head.position.y - (isChicken ? 0.02 : 0.04), 0);
  if (isChicken) nose.rotation.z = -Math.PI / 2;
  group.add(nose);

  if (!isChicken) {
    const earMaterial = new THREE.MeshStandardMaterial({ color: isHorse ? 0x7a4528 : isPig ? 0xf0a0b2 : 0xd6c4aa, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, isHorse ? 0.32 : 0.2, 6), earMaterial);
      ear.position.set(head.position.x - 0.08, head.position.y + 0.28, side * 0.22);
      ear.rotation.set(side * 0.22, 0, side * -0.72);
      group.add(ear);
    }
  }
  if (isHorse) {
    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.62, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.88 }),
    );
    mane.position.set(0.78, 1.32, 0);
    mane.rotation.z = -0.36;
    const saddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.08, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x6b2f1a, roughness: 0.78 }),
    );
    saddle.position.set(-0.08, 1.48, 0);
    group.add(mane, saddle);
  }
  if (isPig) {
    const cheekMaterial = new THREE.MeshStandardMaterial({ color: 0xf9c0cb, roughness: 0.82 });
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), cheekMaterial);
      cheek.position.set(head.position.x + 0.22, head.position.y - 0.02, side * 0.2);
      group.add(cheek);
    }
  }
  if (animalType === "cow") {
    const spot = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.06, 0.64),
      new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 0.9 }),
    );
    spot.position.set(-0.18, 1.27, 0);
    group.add(spot);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 7), new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.78 }));
      horn.position.set(head.position.x + 0.02, head.position.y + 0.25, side * 0.24);
      horn.rotation.z = side * -0.7;
      group.add(horn);
    }
  }
  if (isChicken) {
    const comb = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.75 }),
    );
    comb.position.set(0.43, 1.11, 0);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: 0xfff7d8, roughness: 0.86 }));
      wing.position.set(0.02, 0.52, side * 0.29);
      wing.rotation.x = side * 0.3;
      group.add(wing);
    }
    group.add(comb);
  }

  group.scale.setScalar(isChicken ? 1.16 : 1.18);
  const nameByAnimal: Record<AnimalKind, string> = { horse: "\ub9d0", cow: "\uc18c", pig: "\ub3fc\uc9c0", chicken: "\ub2ed" };
  return {
    group,
    animalType,
    name: nameByAnimal[animalType],
    hp: isHorse ? 10 : isChicken ? 3 : 8,
    collisionRadius: isChicken ? 0.45 : isHorse ? 1.15 : 0.95,
    collisionHeight: isChicken ? 0.95 : isHorse ? 1.75 : 1.35,
    walkParts,
    walk: {
      amplitude: isChicken ? 0.72 : 0.42,
      speed: isChicken ? 10 : 7.5,
      lift: isChicken ? 0.05 : 0.035,
    },
  };
}

export function createPredatorVisual(preferredType?: PredatorKind): PredatorVisual {
  const predatorKind = preferredType ?? (Math.random() < 0.5 ? "wolf" : Math.random() < 0.72 ? "spider" : "lion");
  const extended = createExtendedPredatorVisual(predatorKind);
  if (extended) return extended;
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const isSpider = predatorKind === "spider";
  const color = predatorKind === "lion" ? 0xb77935 : predatorKind === "wolf" ? 0x6b7280 : 0x27272a;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(isSpider ? 1.15 : predatorKind === "lion" ? 1.9 : 1.45, isSpider ? 0.32 : 0.72, isSpider ? 0.9 : 0.56),
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );
  body.position.y = isSpider ? 0.42 : 0.82;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(isSpider ? 0.46 : 0.5, isSpider ? 0.28 : 0.42, isSpider ? 0.5 : 0.42),
    new THREE.MeshStandardMaterial({ color: predatorKind === "lion" ? 0xc88a45 : color, roughness: 0.84 }),
  );
  head.position.set(isSpider ? 0.72 : 0.98, isSpider ? 0.46 : 0.95, 0);
  group.add(body, head);

  const legCount = isSpider ? 8 : 4;
  for (let index = 0; index < legCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(isSpider ? 0.08 : 0.14, isSpider ? 0.12 : 0.62, isSpider ? 0.62 : 0.14),
      new THREE.MeshStandardMaterial({ color: isSpider ? 0x111827 : 0x2f2a25, roughness: 0.9 }),
    );
    leg.position.set(isSpider ? -0.36 + row * 0.28 : side * (row < 1 ? 0.48 : -0.48), isSpider ? 0.24 : 0.34, side * (isSpider ? 0.52 : 0.22));
    leg.rotation.x = side * (isSpider ? 0.55 : 0);
    walkParts.push({ object: leg, side: side * (row % 2 === 0 ? 1 : -1), axis: isSpider ? "z" : "x" });
    group.add(leg);
  }
  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({
        color: isSpider ? 0xff3355 : 0xfff7ed,
        emissive: isSpider ? 0x991b1b : 0x000000,
        emissiveIntensity: isSpider ? 0.65 : 0,
        roughness: 0.35,
      }),
    );
    eye.position.set(head.position.x + 0.26, head.position.y + 0.04, z);
    group.add(eye);
  }
  if (isSpider) {
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.92 }));
    abdomen.position.set(-0.42, 0.46, 0);
    abdomen.scale.set(1.25, 0.72, 1.02);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.52), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0x450a0a, emissiveIntensity: 0.18, roughness: 0.72 }));
    mark.position.set(-0.42, 0.78, 0);
    const fangMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    for (const z of [-0.08, 0.08]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5), fangMaterial);
      fang.position.set(0.98, 0.3, z);
      fang.rotation.z = -Math.PI / 2;
      group.add(fang);
    }
    group.add(abdomen, mark);
  } else {
    const earMaterial = new THREE.MeshStandardMaterial({ color: predatorKind === "lion" ? 0x9a5a24 : 0x4b5563, roughness: 0.88 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 6), earMaterial);
      ear.position.set(0.88, 1.26, side * 0.22);
      ear.rotation.z = side * -0.65;
      group.add(ear);
    }
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.07, predatorKind === "lion" ? 0.85 : 0.62, 8),
      new THREE.MeshStandardMaterial({ color: predatorKind === "lion" ? 0x7c3f18 : 0x374151, roughness: 0.88 }),
    );
    tail.position.set(-0.9, 0.88, 0);
    tail.rotation.z = 1.0;
    group.add(tail);
    const fangMaterial = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.42 });
    for (const z of [-0.08, 0.08]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 5), fangMaterial);
      fang.position.set(1.25, 0.8, z);
      fang.rotation.z = -Math.PI / 2;
      group.add(fang);
    }
  }
  if (predatorKind === "lion") {
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0x7c3f18, roughness: 0.9 }));
    mane.position.set(0.82, 0.95, 0);
    mane.scale.set(0.8, 0.9, 0.8);
    group.add(mane);
  }

  const nameByKind: Partial<Record<PredatorKind, string>> = { wolf: "\ub291\ub300", lion: "\uc0ac\uc790", spider: "\uac70\ubbf8" };
  return {
    group,
    predatorKind,
    name: nameByKind[predatorKind] ?? "늑대",
    collisionRadius: isSpider ? 0.78 : predatorKind === "lion" ? 1.2 : 0.9,
    collisionHeight: isSpider ? 0.7 : 1.25,
    walkParts,
    walk: {
      amplitude: isSpider ? 0.9 : 0.55,
      speed: isSpider ? 10 : 8,
      lift: isSpider ? 0.045 : 0.035,
    },
  };
}

export function createJamminiVisual(): JamminiVisual {
  const group = new THREE.Group();
  const walkParts: WalkPartSetup[] = [];
  const skin = gameMaterial(0xffd7a3, { roughness: 0.64 });
  const shirt = gameMaterial(0x2563eb, { roughness: 0.62 });
  const pants = gameMaterial(0x1e3a5f, { roughness: 0.66 });
  const hair = gameMaterial(0x1f2937, { roughness: 0.74 });
  const legoRed = gameMaterial(0xef4444, { roughness: 0.46 });
  const legoYellow = gameMaterial(0xfacc15, { roughness: 0.42 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), skin);
  head.position.set(0.15, 1.72, 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  cap.position.set(0.12, 1.87, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.76, 0.36), shirt);
  body.position.set(0, 1.12, 0);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.39), legoYellow);
  belt.position.set(0, 0.74, 0);
  group.add(head, cap, body, belt);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), gameMaterial(0x111827, { roughness: 0.3 }));
    eye.position.set(0.39, 1.76, side * 0.11);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gameMaterial(0xff9faf, { roughness: 0.6 }));
    cheek.position.set(0.36, 1.65, side * 0.18);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirt);
    arm.position.set(0.02, 1.14, side * 0.32);
    arm.rotation.x = side * -0.18;
    walkParts.push({ object: arm, side: -side, axis: "x" });
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 6), skin);
    hand.position.set(0.08, 0.78, side * 0.35);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), pants);
    leg.position.set(-0.05, 0.42, side * 0.13);
    walkParts.push({ object: leg, side, axis: "x" });
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.2), gameMaterial(0x111827, { roughness: 0.7 }));
    shoe.position.set(0.08, 0.1, side * 0.13);
    group.add(eye, cheek, arm, hand, leg, shoe);
  }

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.44), legoRed);
  backpack.position.set(-0.36, 1.14, 0);
  group.add(backpack);
  for (const z of [-0.12, 0.12]) {
    const heldBrick = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.14), z < 0 ? legoRed : legoYellow);
    heldBrick.position.set(0.31, 0.92, z * 2.85);
    group.add(heldBrick);
    for (const dx of [-0.06, 0.06]) {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8), z < 0 ? legoRed : legoYellow);
      stud.position.set(0.31 + dx, 1.02, z * 2.85);
      group.add(stud);
    }
  }

  return {
    group,
    walkParts,
    walk: { amplitude: 0.46, speed: 8.5, lift: 0.035 },
  };
}

export function createEagleVisual() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82 });
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x5b371d, roughness: 0.86 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.64 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 12), bodyMaterial);
  body.scale.set(1.05, 0.78, 0.72);
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), headMaterial);
  head.position.set(0, 0.9, -0.34);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.26, 4), beakMaterial);
  beak.position.set(0, 0.89, -0.58);
  beak.rotation.x = -Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.46, 5), wingMaterial);
  tail.position.set(0, 0.5, 0.52);
  tail.rotation.x = Math.PI / 2;
  group.add(body, head, beak, tail);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.32), wingMaterial);
    wing.position.set(side * 0.58, 0.64, -0.02);
    wing.rotation.set(0.18, 0, side * 0.36);
    wing.userData.flapSide = side;
    group.add(wing);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.36 }));
    eye.position.set(side * 0.09, 0.97, -0.55);
    group.add(eye);
    const talon = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.58 }));
    talon.position.set(side * 0.18, 0.14, -0.08);
    talon.rotation.x = Math.PI;
    group.add(talon);
  }
  return group;
}
