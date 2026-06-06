import * as THREE from "three";
import type { ItemId } from "./types";

export function createBucketVisual(item: ItemId = "bucket", scale = 1) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c1cc, metalness: 0.38, roughness: 0.34 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.35, roughness: 0.42 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.25, 0.48, 18, 1, true), metal);
  body.position.y = 0.3;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.25, 0.04, 18), darkMetal);
  bottom.position.y = 0.06;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 18), darkMetal);
  rim.position.y = 0.55;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, 22, Math.PI), darkMetal);
  handle.position.y = 0.58;
  handle.rotation.z = Math.PI;
  group.add(body, bottom, rim, handle);

  if (item === "water_bucket" || item === "lava_bucket") {
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.24, 0.045, 18),
      new THREE.MeshStandardMaterial({
        color: item === "water_bucket" ? 0x46d6ef : 0xff5a1f,
        emissive: item === "water_bucket" ? 0x0c7da0 : 0xff2d00,
        emissiveIntensity: item === "water_bucket" ? 0.24 : 0.85,
        roughness: 0.28,
        metalness: 0.02,
      }),
    );
    liquid.position.y = 0.51;
    group.add(liquid);
  }

  group.scale.setScalar(scale);
  return group;
}
