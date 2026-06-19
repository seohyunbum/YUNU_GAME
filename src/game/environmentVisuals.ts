import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { VISUAL_THEME, makeGroundMaterial } from "../visuals";

export function createStylizedGround(worldSize: number, isNearWater: (point: THREE.Vector3, margin: number) => boolean) {
  const geometry = new THREE.PlaneGeometry(worldSize, worldSize, 96, 96);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const base = new THREE.Color(VISUAL_THEME.grassBase);
  const warm = new THREE.Color(VISUAL_THEME.grassWarm);
  const cool = new THREE.Color(VISUAL_THEME.grassCool);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getY(index);
    const ripple = Math.sin(x * 0.023) * 0.055 + Math.cos(z * 0.019) * 0.045 + Math.sin((x + z) * 0.011) * 0.035;
    positions.setZ(index, ripple);
    const color = base.clone().lerp(ripple > 0 ? warm : cool, Math.min(0.55, Math.abs(ripple) * 5.5 + 0.12));
    if (isNearWater(new THREE.Vector3(x, 0, z), 7)) color.lerp(new THREE.Color(0xc8b06a), 0.44);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, makeGroundMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

export function createCloudLayer(scene: THREE.Scene, cloudLayer: THREE.Group, cloudCount: number, worldSize: number) {
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });

  for (let i = 0; i < cloudCount; i += 1) {
    const cloud = new THREE.Group();
    const puffCount = THREE.MathUtils.randInt(3, 6);
    // 퍼프 지오메트리에 스케일·위치를 구워 머지 → 구름당 1 메시·공유 머티리얼(이전: 퍼프마다 메시+clone). 형상·색 동일, 드로우콜·머티리얼 급감.
    const puffGeometries: THREE.BufferGeometry[] = [];
    for (let puffIndex = 0; puffIndex < puffCount; puffIndex += 1) {
      const geo = new THREE.SphereGeometry(THREE.MathUtils.randFloat(1.8, 4.6), 12, 8);
      geo.scale(THREE.MathUtils.randFloat(1.5, 2.7), THREE.MathUtils.randFloat(0.32, 0.62), THREE.MathUtils.randFloat(0.8, 1.4));
      geo.translate(THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(1.4), THREE.MathUtils.randFloatSpread(5.2));
      puffGeometries.push(geo);
    }
    const puffMesh = new THREE.Mesh(mergeGeometries(puffGeometries), baseMaterial);
    puffMesh.castShadow = false;
    puffMesh.receiveShadow = false;
    for (const geo of puffGeometries) geo.dispose();
    cloud.add(puffMesh);
    cloud.position.set(THREE.MathUtils.randFloatSpread(worldSize * 0.92), THREE.MathUtils.randFloat(48, 84), THREE.MathUtils.randFloatSpread(worldSize * 0.92));
    cloud.userData.speed = THREE.MathUtils.randFloat(0.45, 1.15);
    cloud.userData.drift = THREE.MathUtils.randFloat(-0.1, 0.1);
    cloud.userData.wrap = worldSize * 0.56;
    cloudLayer.add(cloud);
  }

  scene.add(cloudLayer);
}
