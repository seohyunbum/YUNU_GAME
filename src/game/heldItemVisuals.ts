import * as THREE from "three";
import { createMirrorModel } from "../avatar";
import { createBucketVisual } from "./bucketVisuals";
import { createGunnerPistolModel, createGunnerRifleModel, createIronShieldModel, createObsidianGunModel, createObsidianShieldModel, createObsidianStaffModel, createOrnateStaffModel } from "./weaponVisuals";
import { AXE_POWER, PICKAXE_POWER, PLACEABLE_TYPES, SHOVEL_POWER } from "./items";
import { createAdvancedMedkitModel, createArmorModel, createBigBagModel, createDragonTrophyModel, createGemClusterModel, createJobAdvanceModel, createNecklaceModel, createTutorialBookModel, GEM_ITEMS } from "./accessoryVisuals";
import { createMaterialModel } from "./materialVisuals";
import { addLegendaryWeapon } from "./legendaryWeapon";
import { tierBladeMaterial, tierEdgeMaterial, tierGemMaterial, tierOf, tierVisual } from "./tierVisuals";
import {
  createBuildingBlockVisual,
  createSmelterVisual,
  createWorkbenchVisual,
} from "./placeableVisuals";
import type { ItemId } from "./types";

export function heldItemMaterialColor(item: ItemId) {
  if (item.includes("obsidian")) return 0x25102f;
  if (item.includes("diamond")) return 0x6ee7f2;
  if (item.includes("gold")) return 0xe5b83e;
  if (item.includes("iron")) return 0xb8b7b0;
  if (item.includes("copper")) return 0xb87345;
  if (item.includes("stone")) return 0x8a8f93;
  if (item.includes("leather")) return 0x8a4f2d;
  if (item.includes("wood") || item.includes("stick")) return 0x8b5a2b;
  if (item === "bed") return 0xb91c1c;
  if (item === "bow") return 0x8b5a2b;
  if (item === "magic_wand") return 0x36f28f;
  if (item === "mirror") return 0xa7d8ff;
  if (item === "bucket") return 0xb8c1cc;
  if (item === "water_bucket") return 0x48d8ff;
  if (item === "lava_bucket") return 0xff5a1f;
  if (item === "dragon_scale") return 0xb91c1c;
  if (item === "dragon_tail") return 0x7f1d1d;
  if (item === "dragon_horn") return 0xfff1c2;
  if (item === "dragon_spawn") return 0xff3b1f;
  if (item === "plastic_block") return 0xfacc15;
  if (item === "medkit") return 0xf8fafc;
  if (item === "building_block") return 0xb7793c;
  if (item === "smelter" || item === "special_smelter") return item === "special_smelter" ? 0x6d3a9c : 0x545b5f;
  if (item === "pistol") return 0x4a4f57;
  if (item === "iron_shield") return 0xb8b7b0;
  if (item === "rifle") return 0x44484f;
  if (item.endsWith("_staff")) return 0x6cc8ff;
  return 0x9ca3af;
}

function isBucketItem(item: ItemId) {
  return item === "bucket" || item === "water_bucket" || item === "lava_bucket";
}

export function createHeldItemModel(item: ItemId) {
  const group = new THREE.Group();
  const materialColor = heldItemMaterialColor(item);
  const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.78 });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: materialColor,
    metalness: item.includes("iron") || item.includes("gold") || item.includes("diamond") || item.includes("copper") ? 0.32 : 0.08,
    roughness: item.includes("diamond") ? 0.28 : 0.55,
    emissive: item.includes("obsidian") ? 0x14051d : item.includes("diamond") ? 0x0a4d55 : 0x000000,
    emissiveIntensity: item.includes("obsidian") || item.includes("diamond") ? 0.35 : 0,
  });

  const addHandle = (height = 0.56) => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, height, 8), handleMaterial);
    handle.position.y = height / 2;
    handle.rotation.z = 0.12;
    group.add(handle);
    return handle;
  };

  if (item === "hammer") {
    addHandle(0.46);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.15), headMaterial);
    head.position.set(0.02, 0.48, 0);
    group.add(head);
  } else if (item === "bow" || item.endsWith("_bow")) {
    const bowTier = tierOf(item);
    const bowMaterial = bowTier ? tierBladeMaterial(tierVisual(item)) : new THREE.MeshStandardMaterial({ color: 0x8b5a2b, metalness: 0, roughness: 0.6 });
    const stringMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.46, 10), bowMaterial);
    upper.position.set(0.08, 0.42, 0);
    upper.rotation.z = -0.28;
    const lower = upper.clone();
    lower.position.set(-0.05, 0.08, 0);
    lower.rotation.z = 0.28;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), handleMaterial);
    grip.position.set(0.02, 0.25, 0);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 6), stringMaterial);
    string.position.set(0.18, 0.25, 0);
    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.48, 8), new THREE.MeshStandardMaterial({ color: 0xd6b58a, roughness: 0.62 }));
    arrow.position.set(0.06, 0.29, -0.02);
    arrow.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.38, roughness: 0.38 }));
    tip.position.set(0.06, 0.53, -0.02);
    tip.rotation.x = -Math.PI / 2;
    group.add(upper, lower, grip, string, arrow, tip);
    if (bowTier) {
      const tv = tierVisual(item);
      if (tv.gem) { const nock = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), tierGemMaterial(tv)); nock.position.set(0.02, 0.25, 0); group.add(nock); }
      if (tv.fancy) { const glowTip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 10), tierEdgeMaterial(tv)); glowTip.position.set(0.06, 0.55, -0.02); glowTip.rotation.x = -Math.PI / 2; group.add(glowTip); }
    }
  } else if (item === "magic_wand") {
    // 기본 마법봉 — 화려 빌더의 소형판(초록 보석, 날개 1겹, 불꽃 없음)
    group.add(createOrnateStaffModel({ gem: 0x36f28f, glow: 0x10b981, wingsPerSide: 1, flames: 0, scale: 0.88 }));
  } else if (item === "sharp_obsidian_shield") {
    const shield = createObsidianShieldModel();
    shield.position.set(0.06, 0.34, 0);
    shield.rotation.set(0, 0.25, 0);
    group.add(shield);
  } else if (item === "sharp_obsidian_staff") {
    group.add(createObsidianStaffModel());
  } else if (item === "sharp_obsidian_gun") {
    const gun = createObsidianGunModel();
    gun.rotation.set(-0.05, 0.7, 0);
    gun.scale.setScalar(1.12);
    group.add(gun);
  } else if (item === "pistol") {
    // 총신이 화면 전방(-Z)을 향하도록 카메라 공간 보정 회전 (계산값)
    const pistol = createGunnerPistolModel();
    pistol.rotation.set(-0.05, 0.7, 0);
    pistol.scale.setScalar(1.12);
    group.add(pistol);
  } else if (item === "iron_shield") {
    // 장식면이 3/4 시점으로 보이도록 보정 회전 (계산값)
    const shield = createIronShieldModel();
    shield.position.set(0.06, 0.34, 0);
    shield.rotation.set(0, 0.25, 0);
    group.add(shield);
  } else if (item === "rifle") {
    const rifle = createGunnerRifleModel();
    rifle.rotation.set(-0.05, 0.7, 0);
    rifle.scale.setScalar(1.12);
    group.add(rifle);
  } else if (item.endsWith("_staff")) {
    // 비전 지팡이(에픽) = 보라 + 날개 2겹·불꽃 6, 수정 지팡이(희귀) = 청록 + 날개 1겹·불꽃 4
    group.add(item === "arcane_staff"
      ? createOrnateStaffModel({ gem: 0xc05cff, glow: 0x9b5cff, wingsPerSide: 2, flames: 6 })
      : createOrnateStaffModel({ gem: 0x6ee7f2, glow: 0x22d3ee, wingsPerSide: 1, flames: 4 }));
  } else if (AXE_POWER[item]) {
    const tv = tierVisual(item);
    const headMat = tierBladeMaterial(tv);
    addHandle(0.58 + tv.rank * 0.02);
    const g = tv.rank * 0.018;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26 + g, 0.26 + g, 0.06), headMat);
    blade.position.set(0.12, 0.5, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.055), headMat);
    back.position.set(-0.08, 0.47, 0);
    group.add(blade, back);
    if (tv.fancy) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26 + g, 0.065), tierEdgeMaterial(tv)); edge.position.set(0.26 + g / 2, 0.5, 0); group.add(edge); }
    if (tv.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), tierGemMaterial(tv)); gem.position.set(0.02, 0.5, 0); group.add(gem); }
  } else if (PICKAXE_POWER[item]) {
    const tv = tierVisual(item);
    const headMat = tierBladeMaterial(tv);
    addHandle(0.62 + tv.rank * 0.02);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52 + tv.rank * 0.03, 0.08, 0.08), headMat);
    head.position.set(0.02, 0.57, 0);
    head.rotation.z = -0.06;
    group.add(head);
    if (tv.fancy) for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), tierEdgeMaterial(tv)); tip.position.set(0.02 + sx * (0.27 + tv.rank * 0.015), 0.57, 0); tip.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2; group.add(tip); }
    if (tv.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), tierGemMaterial(tv)); gem.position.set(0.02, 0.57, 0); group.add(gem); }
  } else if (SHOVEL_POWER[item]) {
    const tv = tierVisual(item);
    const headMat = tierBladeMaterial(tv);
    addHandle(0.58 + tv.rank * 0.02);
    const scoop = new THREE.Mesh(new THREE.ConeGeometry(0.13 + tv.rank * 0.008, 0.24, 14), headMat);
    scoop.position.set(0.02, 0.58, 0);
    scoop.scale.z = 0.55;
    group.add(scoop);
    if (tv.gem) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), tierGemMaterial(tv)); gem.position.set(0.02, 0.66, 0.06); group.add(gem); }
  } else if (item.endsWith("_dagger") || item.endsWith("_sword")) {
    const sword = item.endsWith("_sword");
    const tv = tierVisual(item);
    if (tv.rank >= 4) {
      // 고급(gold/diamond/obsidian) — 전설 무기: 날개 가드·룬 마법진·에너지 불꽃·테이퍼드 블레이드·왕관 포멜
      addLegendaryWeapon(group, tv, sword);
    } else {
      // 저~중급(wood..iron) — 박스 블레이드 + (copper+) fuller·보석
      const bladeMat = tierBladeMaterial(tv);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8), handleMaterial);
      handle.position.y = 0.1;
      const guardW = (sword ? 0.32 : 0.22) + tv.rank * 0.012;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW, 0.05, 0.07), tv.rank >= 2 ? tierBladeMaterial(tv) : handleMaterial);
      guard.position.y = 0.23;
      const bladeLen = (sword ? 0.58 : 0.36) + tv.rank * 0.045;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(sword ? 0.1 : 0.08, bladeLen, 0.035), bladeMat);
      blade.position.y = 0.26 + bladeLen / 2;
      group.add(handle, guard, blade);
      if (tv.rank >= 2) {
        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.024, bladeLen * 0.82, 0.02), tierBladeMaterial(tv));
        fuller.position.set(0, blade.position.y, 0.02);
        group.add(fuller);
      }
      if (tv.gem) {
        const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), tierGemMaterial(tv));
        pommel.position.y = -0.01;
        group.add(pommel);
        for (const sx of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.OctahedronGeometry(0.028), tierGemMaterial(tv));
          wing.position.set((sx * guardW) / 2, 0.23, 0);
          group.add(wing);
        }
      }
    }
  } else if (item === "bed") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.5), handleMaterial);
    base.position.y = 0.16;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.44), new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 }));
    mat.position.y = 0.23;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 }));
    cover.position.set(0, 0.28, 0.08);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.86 }));
    pillow.position.set(0, 0.29, -0.14);
    group.add(base, mat, cover, pillow);
  } else if (item === "mirror") {
    const mirror = createMirrorModel(0.45);
    mirror.position.y = 0.34;
    mirror.rotation.x = -0.16;
    group.add(mirror);
  } else if (item === "xp_bottle") {
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.5, roughness: 0.2 });
    const liquidMaterial = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 1.1, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 12), glassMaterial);
    body.position.y = 0.3;
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.2, 12), liquidMaterial);
    fill.position.y = 0.27;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 10), glassMaterial);
    neck.position.y = 0.5;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 10), handleMaterial);
    cork.position.y = 0.58;
    group.add(body, fill, neck, cork);
  } else if (item === "job_change_tome") {
    // 전직의서 — 보라빛 발광 표지의 두꺼운 책 + 금색 룬 잠금쇠
    const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x4c1d95, emissive: 0x7c3aed, emissiveIntensity: 0.5, roughness: 0.5 });
    const pageMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f3ff, roughness: 0.7 });
    const runeMaterial = new THREE.MeshStandardMaterial({ color: 0xfcd34d, emissive: 0xf59e0b, emissiveIntensity: 0.9, roughness: 0.4 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.1), coverMaterial);
    cover.position.y = 0.34;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.12), pageMaterial);
    pages.position.set(0.02, 0.34, 0);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), runeMaterial);
    gem.position.set(-0.04, 0.34, 0.07);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.02), runeMaterial);
    clasp.position.set(0.17, 0.34, 0.04);
    group.add(pages, cover, gem, clasp);
  } else if (item === "medkit") {
    const caseMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.62 });
    const redMaterial = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.16), caseMaterial);
    box.position.y = 0.28;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), redMaterial);
    latch.position.set(0, 0.43, 0);
    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.018), redMaterial);
    crossVertical.position.set(0, 0.29, -0.086);
    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.02), redMaterial);
    crossHorizontal.position.copy(crossVertical.position);
    group.add(box, latch, crossVertical, crossHorizontal);
  } else if (item === "leather_bandage") {
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe7ddc4, roughness: 0.85 });
    const tan = new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.8 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.24, 16), cloth);
    roll.rotation.z = Math.PI / 2; roll.position.y = 0.28;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.07, 16), tan);
    band.rotation.z = Math.PI / 2; band.position.y = 0.28;
    group.add(roll, band);
  } else if (item === "meat_stew") {
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8 });
    const brothMat = new THREE.MeshStandardMaterial({ color: 0x9c4a1e, roughness: 0.5, emissive: 0x3a1404, emissiveIntensity: 0.18 });
    const chunkMat = new THREE.MeshStandardMaterial({ color: 0xc06a3a, roughness: 0.7 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.13, 0.16, 18), bowlMat);
    bowl.position.y = 0.22;
    const broth = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.05, 18), brothMat);
    broth.position.y = 0.31;
    for (let i = 0; i < 3; i += 1) { const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), chunkMat); chunk.position.set(-0.08 + i * 0.08, 0.34, (i % 2) * 0.06 - 0.03); group.add(chunk); }
    group.add(bowl, broth);
  } else if (item === "smelter" || item === "special_smelter") {
    const smelter = createSmelterVisual(item === "special_smelter", 0.22);
    smelter.position.y = 0.08;
    group.add(smelter);
  } else if (item === "crafting_table" || item === "extended_workbench") {
    const workbench = createWorkbenchVisual(item === "extended_workbench", 0.2);
    workbench.position.y = 0.08;
    group.add(workbench);
  } else if (item === "building_block") {
    const block = createBuildingBlockVisual(0.26);
    block.position.y = 0.02;
    group.add(block);
  } else if (isBucketItem(item)) {
    const bucket = createBucketVisual(item, 0.34);
    bucket.position.y = 0.1;
    group.add(bucket);
  } else if (item.endsWith("_necklace")) {
    group.add(createNecklaceModel(item));
  } else if (item.endsWith("_armor")) {
    group.add(createArmorModel(item));
  } else if (item.startsWith("dragon_")) {
    group.add(createDragonTrophyModel(item));
  } else if (item === "advanced_medkit") {
    group.add(createAdvancedMedkitModel());
  } else if (GEM_ITEMS.has(item)) {
    group.add(createGemClusterModel(item));
  } else if (item === "tutorial_book") {
    group.add(createTutorialBookModel());
  } else if (item === "big_bag") {
    group.add(createBigBagModel());
  } else if (item === "job_seal" || item === "job_decree" || item === "job_decree_high") {
    group.add(createJobAdvanceModel(item));
  } else if (PLACEABLE_TYPES[item]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), headMaterial);
    block.position.y = 0.16;
    group.add(block);
  } else {
    const material = createMaterialModel(item);
    if (material) {
      group.add(material);
    } else {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), headMaterial);
      pebble.position.y = 0.18;
      group.add(pebble);
    }
  }

  group.rotation.set(0.15, -0.35, -0.22);
  group.scale.setScalar(0.78);
  return group;
}
