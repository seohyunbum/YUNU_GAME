import * as THREE from "three";

export const ASSET_PALETTE = {
  skin: 0xf2c49b,
  skinShadow: 0xc58b64,
  blush: 0xf7a7a0,
  ink: 0x111827,
  clothBlue: 0x2f5f9f,
  clothTeal: 0x2f8f7b,
  clothGreen: 0x5f9b72,
  clothCream: 0xfff3c4,
  clothRed: 0xd84b3a,
  clothPurple: 0x6d5dd3,
  leather: 0x7a4a25,
  leatherDark: 0x3f2415,
  wood: 0x9a6338,
  woodDark: 0x4b2816,
  woodLight: 0xc98a4a,
  straw: 0xd7a84f,
  gold: 0xffd86b,
  brass: 0xc99432,
  steel: 0xb9c5d0,
  steelDark: 0x4b5563,
  stone: 0x8c99a4,
  stoneDark: 0x4f5961,
  stoneLight: 0xb7c0c8,
  moss: 0x3f8f46,
  leaf: 0x52d56f,
  leafDark: 0x167a4a,
  leafLight: 0xb2f26b,
  roofRed: 0xd84b3a,
  roofBlue: 0x476cc4,
  wallWarm: 0xd79a62,
  wallCream: 0xe0b978,
  magicCyan: 0x8fd7ff,
  magicGreen: 0x64ffad,
  ember: 0xff9f43,
  lava: 0xff6a00,
} as const;

export const VISUAL_THEME = {
  grassBase: 0x6ed77b,
  grassWarm: 0xb2df69,
  grassCool: 0x35b48f,
  dirt: 0xb87747,
  bark: ASSET_PALETTE.wood,
  barkDark: ASSET_PALETTE.woodDark,
  leafLight: ASSET_PALETTE.leafLight,
  leafMid: ASSET_PALETTE.leaf,
  leafDark: ASSET_PALETTE.leafDark,
  stone: ASSET_PALETTE.stone,
  warmStone: 0xb5a990,
  roofRed: ASSET_PALETTE.roofRed,
  roofBlue: ASSET_PALETTE.roofBlue,
  creamWall: ASSET_PALETTE.wallCream,
  gold: ASSET_PALETTE.gold,
  water: 0x46d6ef,
  waterDeep: 0x127fb1,
  nightBlue: 0x17294b,
} as const;

export function gameMaterial(
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.03,
    envMapIntensity: 0.35,
    ...options,
  });
}

export function makeToonMaterial(
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters = {},
) {
  return gameMaterial(color, {
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.5,
    ...options,
  });
}

export function makeMetalMaterial(
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters = {},
) {
  return gameMaterial(color, {
    roughness: 0.38,
    metalness: 0.34,
    envMapIntensity: 0.68,
    ...options,
  });
}

export function makeGlowMaterial(
  color: THREE.ColorRepresentation,
  emissive: THREE.ColorRepresentation = color,
  options: THREE.MeshStandardMaterialParameters = {},
) {
  return gameMaterial(color, {
    emissive,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.04,
    envMapIntensity: 0.72,
    ...options,
  });
}

export function applyStylizedMeshDefaults(
  root: THREE.Object3D,
  options: { castShadow?: boolean; receiveShadow?: boolean } = {},
) {
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = castShadow && !isTransparentMaterial(child.material);
    child.receiveShadow = receiveShadow;
    tuneMaterial(child.material);
  });
}

export function makeGroundMaterial() {
  return gameMaterial(0xffffff, {
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
}

function isTransparentMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) return material.some((entry) => entry.transparent);
  return material.transparent;
}

function tuneMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    for (const entry of material) tuneMaterial(entry);
    return;
  }
  if (material instanceof THREE.MeshStandardMaterial) {
    if (material.userData.stylizedTuned) return;
    material.color.offsetHSL(0, 0.035, 0.018);
    material.flatShading = true;
    material.envMapIntensity = Math.max(material.envMapIntensity, 0.45);
    material.needsUpdate = true;
    material.userData.stylizedTuned = true;
  }
}
