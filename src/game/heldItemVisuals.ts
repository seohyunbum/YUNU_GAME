import * as THREE from "three";
import { createMirrorModel } from "../avatar";
import { createBucketVisual } from "./bucketVisuals";
import { createGunnerPistolModel, createGunnerRifleModel, createIronShieldModel } from "./weaponVisuals";
import { AXE_POWER, PICKAXE_POWER, PLACEABLE_TYPES, SHOVEL_POWER } from "./items";
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
    const bowMaterial = new THREE.MeshStandardMaterial({ color: item === "bow" ? 0x8b5a2b : materialColor, metalness: item === "bow" ? 0 : 0.32, roughness: 0.6 });
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
  } else if (item === "magic_wand") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.62, 10), handleMaterial);
    staff.position.y = 0.31;
    staff.rotation.z = 0.06;
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x36f28f,
      emissive: 0x10b981,
      emissiveIntensity: 1.6,
      roughness: 0.28,
    });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), orbMaterial);
    orb.position.set(0.04, 0.65, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 24), new THREE.MeshBasicMaterial({ color: 0xb8ffe2, transparent: true, opacity: 0.78 }));
    ring.position.copy(orb.position);
    ring.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 12), headMaterial);
    cap.position.set(0.02, 0.55, 0);
    group.add(staff, cap, orb, ring);
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
    const arcane = item === "arcane_staff";
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.72, 10), handleMaterial);
    shaft.position.y = 0.36;
    const orbColor = arcane ? 0x9b5cff : 0x5cc8ff;
    const orbMat = new THREE.MeshStandardMaterial({ color: orbColor, emissive: orbColor, emissiveIntensity: 1.4, roughness: 0.28 });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), orbMat);
    orb.position.set(0.02, 0.8, 0);
    const prongs = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 18), new THREE.MeshStandardMaterial({ color: 0xd9c46a, metalness: 0.4, roughness: 0.4 }));
    prongs.position.copy(orb.position);
    prongs.rotation.x = Math.PI / 2;
    group.add(shaft, orb, prongs);
  } else if (AXE_POWER[item]) {
    addHandle(0.58);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), headMaterial);
    blade.position.set(0.12, 0.5, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.055), headMaterial);
    back.position.set(-0.08, 0.47, 0);
    group.add(blade, back);
  } else if (PICKAXE_POWER[item]) {
    addHandle(0.62);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.08), headMaterial);
    head.position.set(0.02, 0.57, 0);
    head.rotation.z = -0.06;
    group.add(head);
  } else if (SHOVEL_POWER[item]) {
    addHandle(0.58);
    const scoop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 14), headMaterial);
    scoop.position.set(0.02, 0.58, 0);
    scoop.scale.z = 0.55;
    group.add(scoop);
  } else if (item.endsWith("_dagger") || item.endsWith("_sword")) {
    const sword = item.endsWith("_sword");
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), handleMaterial);
    handle.position.y = 0.1;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(sword ? 0.32 : 0.22, 0.04, 0.06), handleMaterial);
    guard.position.y = 0.23;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(sword ? 0.1 : 0.08, sword ? 0.62 : 0.38, 0.035), headMaterial);
    blade.position.y = sword ? 0.56 : 0.43;
    group.add(handle, guard, blade);
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
  } else if (PLACEABLE_TYPES[item]) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), headMaterial);
    block.position.y = 0.16;
    group.add(block);
  } else {
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), headMaterial);
    pebble.position.y = 0.18;
    group.add(pebble);
  }

  group.rotation.set(0.15, -0.35, -0.22);
  group.scale.setScalar(0.78);
  return group;
}
