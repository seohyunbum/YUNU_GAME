import * as THREE from "three";
import {
  ASSET_PALETTE,
  VISUAL_THEME,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "../visuals";
import { createBuildingSign as createBuildingSignModel } from "./buildingSigns";

export interface ChestVisual {
  group: THREE.Group;
  type: "chest" | "mineChest";
  name: string;
  mineRich: boolean;
  chestTier: number;
  collisionRadius: number;
  collisionHeight: number;
}

// 필드 상자 등급별 색/글로우 (0 일반 = null → 기존 나무색). 1 황금 / 2 다이아몬드 / 3 흑요석.
const CHEST_TIER_PALETTE: ({ wood: number; lid: number; band: number; gem: number; em: number; emi: number; name: string } | null)[] = [
  null,
  { wood: 0x8a6d1e, lid: 0xc09524, band: 0xe7c45a, gem: 0xffe98a, em: 0xa16207, emi: 0.5, name: "황금 상자" },
  { wood: 0x166e7a, lid: 0x2aa7b8, band: 0x7fe9f4, gem: 0xbafcff, em: 0x0a4d55, emi: 0.75, name: "다이아몬드 상자" },
  { wood: 0x2a1438, lid: 0x4a2160, band: 0x9b5bff, gem: 0xd9b8ff, em: 0x7c2dff, emi: 1.0, name: "흑요석 상자" },
];

export interface TrainVisual {
  track: THREE.Mesh;
  group: THREE.Group;
  name: string;
  collisionRadius: number;
  collisionHeight: number;
  trainSpeed: number;
  trainDirection: number;
  trainPause: number;
}

export interface VillageHouseVisual {
  group: THREE.Group;
  type: "foodStorage" | "villageHouse";
  name: string;
  collisionRadius: number;
  collisionHeight: number;
  enterable: boolean;
  houseKind: "home" | "twoStory";
  foodRemaining?: number;
}

export function createChestVisual(mineRich: boolean, chestTier = 0): ChestVisual {
  const group = new THREE.Group();
  const tp = mineRich ? null : (CHEST_TIER_PALETTE[Math.max(0, Math.min(3, Math.floor(chestTier)))] ?? null);
  const woodColor = tp ? tp.wood : mineRich ? ASSET_PALETTE.woodDark : ASSET_PALETTE.wood;
  const baseWood = makeToonMaterial(woodColor, { roughness: 0.78 });
  const lidWood = makeToonMaterial(tp ? tp.lid : mineRich ? 0x6a4931 : ASSET_PALETTE.woodLight, { roughness: 0.72 });
  const bandMetal = makeMetalMaterial(tp ? tp.band : mineRich ? ASSET_PALETTE.magicCyan : ASSET_PALETTE.brass, { metalness: tp ? 0.62 : mineRich ? 0.46 : 0.32 });
  const strapMaterial = makeToonMaterial(mineRich ? 0x202738 : ASSET_PALETTE.leatherDark, { roughness: 0.76 });
  const lockMaterial = makeGlowMaterial(
    tp ? tp.gem : mineRich ? ASSET_PALETTE.magicCyan : ASSET_PALETTE.gold,
    tp ? tp.em : mineRich ? 0x1d4ed8 : 0xa16207,
    { metalness: 0.42, roughness: 0.34, emissiveIntensity: tp ? tp.emi : mineRich ? 0.44 : 0.22 },
  );
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1), baseWood);
  base.position.y = 0.4;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.34, 1.06), lidWood);
  lid.position.y = 0.96;
  lid.scale.y = 0.72;
  const frontBand = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.12, 0.08), bandMetal);
  frontBand.position.set(0, 0.84, 0.55);
  const sideBandA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.08, 1.12), bandMetal);
  sideBandA.position.set(-0.52, 0.58, 0);
  const sideBandB = sideBandA.clone();
  sideBandB.position.x = 0.52;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.1), lockMaterial);
  lock.position.set(0, 0.58, 0.58);
  group.add(base, lid, frontBand, sideBandA, sideBandB, lock);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(tp ? 0.13 : 0.11, 10, 6),
    makeGlowMaterial(tp ? tp.gem : mineRich ? ASSET_PALETTE.magicCyan : 0xffef9a, tp ? tp.em : mineRich ? 0x1d4ed8 : 0xa16207, {
      emissiveIntensity: tp ? tp.emi + 0.1 : mineRich ? 0.55 : 0.25,
      roughness: 0.3,
    }),
  );
  glow.position.set(0, 0.61, 0.64);
  group.add(glow);
  for (const x of [-0.62, 0.62]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), bandMetal);
    handle.position.set(x, 0.56, 0);
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
    for (const y of [0.28, 0.78, 1.08]) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bandMetal);
      stud.position.set(x, y, 0.53);
      group.add(stud);
    }
  }
  for (const z of [-0.48, 0.48]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.07), strapMaterial);
    strap.position.set(0, 1.1, z);
    group.add(strap);
  }

  return {
    group,
    type: mineRich ? "mineChest" : "chest",
    name: tp ? tp.name : mineRich ? "광산 상자" : "상자",
    mineRich,
    chestTier: tp ? Math.max(0, Math.min(3, Math.floor(chestTier))) : 0,
    collisionRadius: 0.95,
    collisionHeight: 0.95,
  };
}

export function createTrainVisual(trackRadius: number): TrainVisual {
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(trackRadius, 0.22, 10, 180),
    new THREE.MeshStandardMaterial({ color: 0x34383d, metalness: 0.45, roughness: 0.48 }),
  );
  track.rotation.x = Math.PI / 2;
  track.position.y = 0.08;

  const group = new THREE.Group();
  const engine = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 1.35, 1.55),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.62, metalness: 0.08 }),
  );
  engine.position.y = 0.95;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.25, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x263f75, roughness: 0.56, metalness: 0.12 }),
  );
  cabin.position.set(-0.75, 1.65, 0);
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.48, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x9bd7ff, emissive: 0x1d4f72, emissiveIntensity: 0.25, roughness: 0.22 }),
  );
  window.position.set(-0.18, 1.78, 0.73);
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.45, roughness: 0.48 }),
  );
  chimney.position.set(1.0, 1.9, 0);
  const cowcatcher = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.45, roughness: 0.4 }),
  );
  cowcatcher.position.set(1.95, 0.6, 0);
  cowcatcher.rotation.z = -Math.PI / 2;
  const boiler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.58, 2.2, 18),
    new THREE.MeshStandardMaterial({ color: 0xd13b2f, roughness: 0.5, metalness: 0.16 }),
  );
  boiler.position.set(0.45, 1.26, 0);
  boiler.rotation.z = Math.PI / 2;
  const brassBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.035, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xe4bd55, metalness: 0.35, roughness: 0.34 }),
  );
  brassBand.position.set(1.16, 1.26, 0);
  brassBand.rotation.y = Math.PI / 2;
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe6a1, emissive: 0xf59e0b, emissiveIntensity: 0.75, roughness: 0.3 }),
  );
  lamp.position.set(1.82, 1.07, 0);
  const rearCar = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 1.08, 1.38),
    new THREE.MeshStandardMaterial({ color: 0x2f6f73, roughness: 0.58, metalness: 0.08 }),
  );
  rearCar.position.set(-2.8, 0.95, 0);
  const rearRoof = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.18, 1.48),
    new THREE.MeshStandardMaterial({ color: 0x1d3f52, roughness: 0.62, metalness: 0.08 }),
  );
  rearRoof.position.set(-2.8, 1.58, 0);
  for (const x of [-3.35, -2.8, -2.25]) {
    const carWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.42, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xb6f0ff, emissive: 0x1d4f72, emissiveIntensity: 0.18, roughness: 0.2 }),
    );
    carWindow.position.set(x, 1.08, 0.72);
    group.add(carWindow);
    const opposite = carWindow.clone();
    opposite.position.z = -0.72;
    group.add(opposite);
  }
  group.add(engine, cabin, window, chimney, cowcatcher, boiler, brassBand, lamp, rearCar, rearRoof);
  for (const x of [-3.45, -2.15, -1.0, 0.95]) {
    for (const z of [-0.68, 0.68]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.16, 18),
        new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.35, roughness: 0.5 }),
      );
      wheel.position.set(x, 0.34, z);
      wheel.rotation.x = Math.PI / 2;
      group.add(wheel);
    }
  }

  return {
    track,
    group,
    name: "탑승 가능한 기차",
    collisionRadius: 1.9,
    collisionHeight: 2.4,
    trainSpeed: 0.075,
    trainDirection: 1,
    trainPause: 0,
  };
}

// 플레이어 전용 코티지 장식 — 포치·기둥·포치지붕·계단·줄무늬 차양·처마 스캘럽·굴뚝캡·우편함. 마을 집과 확실히 차별화.
function addDeluxeCottage(house: THREE.Group, width: number, depth: number, bodyHeight: number) {
  const white = makeToonMaterial(0xfdf6ee, { roughness: 0.7 });
  const coral = makeToonMaterial(0xe0866a, { roughness: 0.8 });
  const cream = makeToonMaterial(0xfff1cf, { roughness: 0.78 });
  const front = depth / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.2, 1.9), white);
  deck.position.set(0, 0.22, front + 1.05);
  house.add(deck);
  for (const x of [-(width / 2) - 0.1, width / 2 + 0.1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.3, 10), white);
    col.position.set(x, 1.25, front + 1.78);
    const colCap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), coral);
    colCap.position.set(x, 2.42, front + 1.78);
    house.add(col, colCap);
  }
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.85, 0.16, 2.0), coral);
  porchRoof.position.set(0, 2.46, front + 1.25);
  porchRoof.rotation.x = -0.13;
  house.add(porchRoof);
  for (let s = 0; s < 2; s += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.7 - s * 0.34, 0.16, 0.42), white);
    step.position.set(0, 0.13 - s * 0.005, front + 2.0 + s * 0.42);
    house.add(step);
  }
  for (let i = 0; i < 7; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.52), i % 2 === 0 ? coral : cream);
    stripe.position.set(-0.6 + i * 0.2, 1.66, front + 0.36);
    stripe.rotation.x = -0.42;
    house.add(stripe);
  }
  for (let i = 0; i <= 8; i += 1) {
    const scallop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), coral);
    scallop.position.set(-width * 0.45 + (i * width * 0.9) / 8, bodyHeight + 0.06, front + 0.24);
    scallop.rotation.x = Math.PI;
    house.add(scallop);
  }
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), makeToonMaterial(0x3a2a22, { roughness: 0.9 }));
  chimneyCap.position.set(width * 0.27, bodyHeight + 1.28, -depth * 0.18);
  const mailPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 8), white);
  mailPost.position.set(width * 0.5 + 0.7, 0.48, front + 1.3);
  const mailBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.42), coral);
  mailBox.position.set(width * 0.5 + 0.7, 1.0, front + 1.3);
  house.add(chimneyCap, mailPost, mailBox);
}

export function createVillageHouseVisual(name: string, isStorage: boolean, variant: number, options?: { deluxe?: boolean; signLabel?: string }): VillageHouseVisual {
  const house = new THREE.Group();
  const deluxe = Boolean(options?.deluxe);
  const isTwoStory = !isStorage && !deluxe && variant % 4 === 3;
  const houseStyles = [
    { width: 4.6, depth: 4.1, wall: ASSET_PALETTE.wallWarm, roof: ASSET_PALETTE.roofRed, roofHeight: 1.65, chimneyX: 0.24, bodyHeight: 2.7 },
    { width: 5.3, depth: 3.8, wall: ASSET_PALETTE.wallCream, roof: ASSET_PALETTE.roofBlue, roofHeight: 1.35, chimneyX: -0.22, bodyHeight: 2.7 },
    { width: 4.2, depth: 4.9, wall: 0xc98245, roof: 0x8e3f31, roofHeight: 1.9, chimneyX: 0.1, bodyHeight: 2.7 },
    { width: 5.6, depth: 4.9, wall: 0xb79b66, roof: 0x5367c8, roofHeight: 1.55, chimneyX: 0.25, bodyHeight: 4.85 },
  ];
  const deluxeStyle = { width: 5.6, depth: 4.7, wall: 0xf5e3d0, roof: 0xe0866a, roofHeight: 1.95, chimneyX: 0.27, bodyHeight: 2.95 }; // 플레이어 전용 아늑한 코티지 — 파스텔 크림 벽 + 코랄 지붕
  const style = deluxe ? deluxeStyle : isStorage ? { width: 7.1, depth: 5.5, wall: 0xba7440, roof: 0xe0661d, roofHeight: 1.45, chimneyX: 0.28, bodyHeight: 2.7 } : houseStyles[variant % houseStyles.length];
  const width = style.width;
  const depth = style.depth;
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(width, style.bodyHeight, depth),
    makeToonMaterial(style.wall, { roughness: 0.8 }),
  );
  hut.position.y = style.bodyHeight / 2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.76, style.roofHeight, 4),
    makeToonMaterial(style.roof, { roughness: 0.84 }),
  );
  roof.position.y = style.bodyHeight + style.roofHeight * 0.5;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.45, 0.08),
    makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.86 }),
  );
  door.position.set(0, 0.72, depth / 2 + 0.045);
  const windowMaterial = makeGlowMaterial(0x9bd7ff, 0x1d4f72, { emissiveIntensity: 0.18, roughness: 0.25 });
  const windowA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.48, 0.08), windowMaterial);
  windowA.position.set(-width * 0.28, 1.52, depth / 2 + 0.052);
  const windowB = windowA.clone();
  windowB.position.x = width * 0.28;
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 1.05, 0.48),
    makeToonMaterial(0x5b3428, { roughness: 0.9 }),
  );
  chimney.position.set(width * style.chimneyX, style.bodyHeight + 0.68, -depth * 0.18);
  house.add(hut, roof, door, windowA, windowB, chimney);
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.28, depth + 0.5), makeToonMaterial(VISUAL_THEME.warmStone, { roughness: 0.92 }));
  foundation.position.y = 0.14;
  const roofLipFront = new THREE.Mesh(new THREE.BoxGeometry(width + 0.72, 0.12, 0.24), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.78 }));
  roofLipFront.position.set(0, style.bodyHeight + 0.08, depth / 2 + 0.2);
  const roofLipBack = roofLipFront.clone();
  roofLipBack.position.z = -depth / 2 - 0.2;
  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), makeMetalMaterial(ASSET_PALETTE.gold, { metalness: 0.22, roughness: 0.36 }));
  doorKnob.position.set(0.27, 0.8, depth / 2 + 0.1);
  const roofGem = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 7),
    makeGlowMaterial(isStorage ? 0xffef9a : isTwoStory ? 0xc4b5fd : 0x93c5fd, isStorage ? 0xa16207 : 0x1d4ed8, {
      emissiveIntensity: 0.22,
      roughness: 0.35,
    }),
  );
  roofGem.position.set(0, style.bodyHeight + style.roofHeight * 0.85, depth / 2 + 0.06);
  house.add(foundation, roofLipFront, roofLipBack, doorKnob, roofGem);
  for (const x of [-width / 2 - 0.05, width / 2 + 0.05]) {
    for (const z of [-depth / 2 - 0.05, depth / 2 + 0.05]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, style.bodyHeight + 0.18, 0.18), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.84 }));
      post.position.set(x, style.bodyHeight / 2, z);
      house.add(post);
    }
  }
  for (const x of [-width * 0.28, width * 0.28]) {
    const shutterLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 0.07), makeToonMaterial(0x315f72, { roughness: 0.72 }));
    shutterLeft.position.set(x - 0.44, 1.52, depth / 2 + 0.09);
    const shutterRight = shutterLeft.clone();
    shutterRight.position.x = x + 0.44;
    const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.2), makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.86 }));
    flowerBox.position.set(x, 1.13, depth / 2 + 0.16);
    house.add(shutterLeft, shutterRight, flowerBox);
    for (const dx of [-0.24, 0, 0.24]) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), makeToonMaterial(dx === 0 ? 0xf9a8d4 : 0xfff1a8, { roughness: 0.7 }));
      flower.position.set(x + dx, 1.24, depth / 2 + 0.22);
      house.add(flower);
    }
  }
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    makeGlowMaterial(0xffdd87, 0xc56b12, { emissiveIntensity: 0.48, roughness: 0.38 }),
  );
  lantern.position.set(-width * 0.42, 2.15, depth / 2 + 0.17);
  house.add(lantern);
  if (isStorage) {
    const doubleDoor = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.75, 0.1), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.88 }));
    doubleDoor.position.set(0, 0.88, depth / 2 + 0.07);
    const sign = createBuildingSignModel("창고", "storage", 2.55, 0.82);
    sign.position.set(0, 2.38, depth / 2 + 0.16);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.12, 0.72), makeToonMaterial(0x92400e, { roughness: 0.82 }));
    awning.position.set(0, 2.0, depth / 2 + 0.42);
    house.add(doubleDoor, sign, awning);
    for (const x of [-2.8, 2.8]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.62, 0.8), makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.9 }));
      crate.position.set(x, 0.31, depth / 2 + 0.72);
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 7), makeToonMaterial(0xd6b171, { roughness: 0.95 }));
      sack.position.set(x * 0.82, 0.34, depth / 2 + 0.98);
      sack.scale.set(0.82, 1.05, 0.72);
      house.add(crate, sack);
    }
  } else {
    const signLabel = options?.signLabel ?? (isTwoStory ? "2층집" : "집");
    const signWidth = options?.signLabel ? Math.min(3.4, Math.max(2.4, signLabel.length * 0.42)) : isTwoStory ? 2.25 : 1.62;
    const sign = createBuildingSignModel(signLabel, isTwoStory ? "twoStory" : "home", signWidth, 0.66);
    sign.position.set(0, deluxe ? style.bodyHeight + style.roofHeight * 0.32 : isTwoStory ? 2.18 : 2.08, depth / 2 + (deluxe ? 0.26 : 0.16));
    house.add(sign);
    if (deluxe) addDeluxeCottage(house, width, depth, style.bodyHeight);
    if (isTwoStory) {
      const secondBand = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, 0.12, depth * 1.04), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.84 }));
      secondBand.position.y = 2.55;
      const upperWindowA = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.08), windowMaterial);
      upperWindowA.position.set(-width * 0.24, 3.55, depth / 2 + 0.058);
      const upperWindowB = upperWindowA.clone();
      upperWindowB.position.x = width * 0.24;
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.15, 0.72), makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.86 }));
      balcony.position.set(0, 2.62, depth / 2 + 0.45);
      const balconyRail = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.42, 0.1), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.84 }));
      balconyRail.position.set(0, 2.92, depth / 2 + 0.78);
      house.add(secondBand, upperWindowA, upperWindowB, balcony, balconyRail);
    }
    if (variant % 3 === 1) {
      const porch = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.16, 0.92), makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.9 }));
      porch.position.set(0, 0.12, depth / 2 + 0.55);
      const railA = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.12, 0.12), makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.86 }));
      railA.position.set(0, 0.68, depth / 2 + 0.96);
      house.add(porch, railA);
    }
    if (variant % 3 === 2) {
      const sideShed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.45, 1.55), makeToonMaterial(0x7c5132, { roughness: 0.84 }));
      sideShed.position.set(-width / 2 - 0.55, 0.72, -0.25);
      const planter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.34), makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.9 }));
      planter.position.set(width * 0.28, 0.55, depth / 2 + 0.14);
      house.add(sideShed, planter);
    }
  }

  return {
    group: house,
    type: isStorage ? "foodStorage" : "villageHouse",
    name,
    collisionRadius: Math.max(width, depth) * 0.56,
    collisionHeight: isTwoStory ? 6.2 : 3.4,
    enterable: !isStorage,
    houseKind: isTwoStory ? "twoStory" : "home",
    foodRemaining: isStorage ? 10 : undefined,
  };
}
