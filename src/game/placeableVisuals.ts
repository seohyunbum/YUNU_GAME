import * as THREE from "three";
import { ASSET_PALETTE, makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "../visuals";

export function createBedVisual(scale = 1) {
  const group = new THREE.Group();
  const wood = makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.82 });
  const darkWood = makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.88 });
  const mattress = makeToonMaterial(0xf3ead8, { roughness: 0.9 });
  const blanket = makeToonMaterial(ASSET_PALETTE.clothRed, { roughness: 0.78 });
  const pillow = makeToonMaterial(0xf8fafc, { roughness: 0.86 });
  const seam = makeToonMaterial(0x7f1d1d, { roughness: 0.82 });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 2.65), wood);
  frame.position.y = 0.22;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 2.82), darkWood);
  base.position.y = 0.11;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 2.44), mattress);
  mat.position.y = 0.42;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.09, 1.35), blanket);
  cover.position.set(0, 0.6, 0.42);
  const pillowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.44), pillow);
  pillowMesh.position.set(0, 0.63, -0.86);
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.86, 0.18), darkWood);
  headboard.position.set(0, 0.47, -1.5);
  const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 0.16), darkWood);
  footboard.position.set(0, 0.28, 1.5);
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 2.7), darkWood);
  leftRail.position.set(-0.91, 0.26, 0);
  const rightRail = leftRail.clone();
  rightRail.position.x = 0.91;
  const blanketFold = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.045, 0.08), seam);
  blanketFold.position.set(0, 0.66, -0.22);
  const pillowStripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.025, 0.045), mattress);
  pillowStripe.position.set(0, 0.735, -0.72);
  const blanketStripeA = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 1.18), seam);
  blanketStripeA.position.set(-0.42, 0.675, 0.42);
  const blanketStripeB = blanketStripeA.clone();
  blanketStripeB.position.x = 0.42;
  const pillowButton = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 5), mattress);
  pillowButton.position.set(0.38, 0.74, -0.86);
  group.add(base, frame, mat, cover, blanketFold, blanketStripeA, blanketStripeB, pillowMesh, pillowStripe, pillowButton, headboard, footboard, leftRail, rightRail);

  for (const x of [-0.68, 0.68]) {
    for (const z of [-1.18, 1.18]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), darkWood);
      leg.position.set(x, -0.04, z);
      group.add(leg);
    }
  }

  group.scale.setScalar(scale);
  return group;
}

export function createBuildingBlockVisual(scale = 1) {
  const group = new THREE.Group();
  const wood = makeToonMaterial(ASSET_PALETTE.woodLight, { roughness: 0.72, metalness: 0.03 });
  const side = makeToonMaterial(ASSET_PALETTE.wood, { roughness: 0.78, metalness: 0.02 });
  const trim = makeToonMaterial(0x5b351f, { roughness: 0.82, metalness: 0.04 });
  const glow = makeGlowMaterial(0xf6d58a, 0x8a5a13, { emissiveIntensity: 0.18, roughness: 0.48 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.94, 0.94), wood);
  body.position.y = 0.5;
  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.54, 0.035), side);
  frontPanel.position.set(0, 0.5, 0.49);
  const backPanel = frontPanel.clone();
  backPanel.position.z = -0.49;
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.54, 0.72), side);
  leftPanel.position.set(-0.49, 0.5, 0);
  const rightPanel = leftPanel.clone();
  rightPanel.position.x = 0.49;
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.045, 0.86), glow);
  topPlate.position.y = 0.98;
  const bottomBand = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 1.02), trim);
  bottomBand.position.y = 0.08;
  const topBand = bottomBand.clone();
  topBand.position.y = 0.92;
  group.add(body, frontPanel, backPanel, leftPanel, rightPanel, topPlate, bottomBand, topBand);

  for (const x of [-0.28, 0.28]) {
    for (const z of [-0.28, 0.28]) {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 12), glow);
      peg.position.set(x, 1.05, z);
      group.add(peg);
    }
  }

  for (const x of [-0.47, 0.47]) {
    for (const z of [-0.47, 0.47]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.08), trim);
      post.position.set(x, 0.5, z);
      group.add(post);
    }
  }

  group.scale.setScalar(scale);
  return group;
}

export function createWorkbenchVisual(extended: boolean, scale = 1) {
  const group = new THREE.Group();
  const baseMaterial = makeToonMaterial(extended ? ASSET_PALETTE.woodDark : ASSET_PALETTE.wood, { roughness: 0.78 });
  const topMaterial = makeToonMaterial(extended ? ASSET_PALETTE.woodLight : 0xd1a35a, { roughness: 0.62 });
  const trimMaterial = makeToonMaterial(extended ? ASSET_PALETTE.leatherDark : 0x5b351f, { roughness: 0.8 });
  const lineMaterial = extended
    ? makeGlowMaterial(ASSET_PALETTE.gold, 0xa16207, { emissiveIntensity: 0.16, roughness: 0.48 })
    : makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.58 });
  const size = extended ? 2.1 : 1.65;
  const height = extended ? 1.05 : 0.85;

  const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.92, height, size * 0.92), baseMaterial);
  body.position.y = height / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(size, 0.14, size), topMaterial);
  top.position.y = height + 0.08;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(size * 1.04, 0.12, size * 1.04), trimMaterial);
  trim.position.y = height + 0.02;

  const legHeight = height * 0.72;
  for (const x of [-size * 0.34, size * 0.34]) {
    for (const z of [-size * 0.34, size * 0.34]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, legHeight, 0.16), trimMaterial);
      leg.position.set(x, legHeight / 2 - 0.02, z);
      group.add(leg);
    }
  }

  const divisions = extended ? 6 : 3;
  for (let index = 1; index < divisions; index += 1) {
    const offset = -size / 2 + (size / divisions) * index;
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, size * 0.88), lineMaterial);
    vertical.position.set(offset, height + 0.16, 0);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(size * 0.88, 0.018, 0.018), lineMaterial);
    horizontal.position.set(0, height + 0.165, offset);
    group.add(vertical, horizontal);
  }

  if (extended) {
    const sideBand = new THREE.Mesh(new THREE.BoxGeometry(size * 0.82, 0.1, 0.08), lineMaterial);
    sideBand.position.set(0, height * 0.62, size * 0.49);
    group.add(sideBand);
  }

  const smallHammer = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.055, 0.08), trimMaterial);
  smallHammer.position.set(size * 0.18, height + 0.22, -size * 0.22);
  smallHammer.rotation.y = 0.42;
  const smallHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.44, 6), trimMaterial);
  smallHandle.position.set(size * 0.04, height + 0.2, -size * 0.1);
  smallHandle.rotation.set(Math.PI / 2, 0.2, 0.8);
  const cornerGem = new THREE.Mesh(
    new THREE.SphereGeometry(extended ? 0.08 : 0.055, 10, 6),
    makeGlowMaterial(extended ? ASSET_PALETTE.magicCyan : 0xffe08a, extended ? 0x2563eb : 0xa16207, { emissiveIntensity: 0.28, roughness: 0.42 }),
  );
  cornerGem.position.set(-size * 0.36, height + 0.23, size * 0.34);
  group.add(smallHammer, smallHandle, cornerGem);

  group.add(body, trim, top);
  group.scale.setScalar(scale);
  return group;
}

export function createGrinderVisual(scale = 1) {
  const group = new THREE.Group();
  const stone = makeToonMaterial(ASSET_PALETTE.stoneDark, { roughness: 0.9 });
  const dark = makeToonMaterial(0x2f3439, { roughness: 0.82 });
  const iron = makeMetalMaterial(ASSET_PALETTE.steel, { metalness: 0.28, roughness: 0.45 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.92, 0.22, 14), dark);
  base.position.y = 0.11;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 0.62, 14), stone);
  bowl.position.y = 0.52;
  const topStone = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 14), stone);
  topStone.position.y = 0.92;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.08, 10), iron);
  axle.position.y = 0.94;
  axle.rotation.z = Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.72), iron);
  handle.position.set(0.66, 0.94, 0);
  const hopper = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.42, 4), dark);
  hopper.position.set(-0.28, 1.23, 0);
  hopper.rotation.y = Math.PI / 4;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 6), iron);
  knob.position.set(1.04, 0.94, 0);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.42), dark);
  tray.position.set(0.2, 0.18, 0.72);
  const powder = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.12, 12), stone);
  powder.position.set(0.2, 0.28, 0.72);
  group.add(base, bowl, topStone, axle, handle, knob, hopper, tray, powder);
  group.scale.setScalar(scale);
  return group;
}

export function createSmelterVisual(special: boolean, scale = 1) {
  const group = new THREE.Group();
  const stoneMaterial = makeToonMaterial(special ? 0x3b2948 : ASSET_PALETTE.stoneDark, { roughness: 0.88 });
  const darkMaterial = makeToonMaterial(special ? 0x17111f : 0x1f2528, { roughness: 0.92 });
  const metalMaterial = makeMetalMaterial(special ? 0x9c6bd3 : ASSET_PALETTE.steel, { metalness: 0.28, roughness: 0.48 });
  const glowMaterial = makeGlowMaterial(special ? 0xc084fc : ASSET_PALETTE.ember, special ? 0x7c2dff : ASSET_PALETTE.lava, {
    emissiveIntensity: special ? 1.65 : 1.45,
    roughness: 0.34,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.86, 0.18, 10), darkMaterial);
  base.position.y = 0.09;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.76, 1.14, 10), stoneMaterial);
  body.position.y = 0.74;
  const topBand = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.045, 8, 28), metalMaterial);
  topBand.position.y = 1.34;
  topBand.rotation.x = Math.PI / 2;
  const bottomBand = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.035, 8, 28), metalMaterial);
  bottomBand.position.y = 0.25;
  bottomBand.rotation.x = Math.PI / 2;
  const mouthFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.09), metalMaterial);
  mouthFrame.position.set(0, 0.72, 0.66);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.12), darkMaterial);
  mouth.position.set(0, 0.72, 0.72);
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.04), glowMaterial);
  fire.position.set(0, 0.68, 0.79);
  const grate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.08), darkMaterial);
  grate.position.set(0, 0.48, 0.75);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.68, 10), darkMaterial);
  chimney.position.set(-0.26, 1.72, -0.18);
  const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.1, 10), metalMaterial);
  chimneyCap.position.set(-0.26, 2.1, -0.18);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), metalMaterial);
  vent.position.set(0.28, 1.42, 0.48);

  for (const x of [-0.42, 0.42]) {
    for (const z of [-0.42, 0.42]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), darkMaterial);
      foot.position.set(x, 0.02, z);
      group.add(foot);
    }
  }

  const topGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glowMaterial);
  topGlow.position.set(0.24, 1.48, 0.26);
  for (const x of [-0.38, 0.38]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 5), metalMaterial);
    rivet.position.set(x, 0.98, 0.69);
    group.add(rivet);
  }

  group.add(base, body, topBand, bottomBand, mouthFrame, mouth, fire, grate, chimney, chimneyCap, vent, topGlow);
  group.scale.setScalar(scale);
  return group;
}
