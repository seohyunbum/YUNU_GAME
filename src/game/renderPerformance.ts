import * as THREE from "three";
import type { QualityMode } from "./types";

const distanceCullBox = new THREE.Box3();
const distanceCullSphere = new THREE.Sphere();
const DISTANCE_CULL_MARGIN = 72;

export function precompileSceneShaders(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const shadowEnabled = renderer.shadowMap.enabled;
  try {
    renderer.compile(scene, camera);
    renderer.shadowMap.enabled = false;
    renderer.compile(scene, camera);
  } catch (error) {
    console.warn("Shader precompile failed.", error);
  } finally {
    renderer.shadowMap.enabled = shadowEnabled;
  }
}

export function applyShadowQuality(light: THREE.DirectionalLight, mode: QualityMode) {
  const mapSize = mode === "high" ? 1024 : 512;
  const far = mode === "high" ? 320 : mode === "balanced" ? 180 : 140;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.camera.far = far;
  light.shadow.camera.updateProjectionMatrix();
}

export function shouldShowPerformanceHiddenVisual(
  visual: THREE.Object3D,
  qualityMode: QualityMode,
  sprintRenderOptimized: boolean,
) {
  if (sprintRenderOptimized) return false;
  if (visual.userData.isCartoonOutline && qualityMode !== "high") return false;
  return true;
}

export function refreshTrackedVisualVisibility(
  visuals: THREE.Object3D[],
  qualityMode: QualityMode,
  sprintRenderOptimized: boolean,
) {
  for (let index = visuals.length - 1; index >= 0; index -= 1) {
    const visual = visuals[index];
    if (!visual.parent) {
      visuals.splice(index, 1);
      continue;
    }
    visual.visible = shouldShowPerformanceHiddenVisual(visual, qualityMode, sprintRenderOptimized);
  }
}

export function registerDistanceCulledVisual(visual: THREE.Object3D) {
  if (
    typeof visual.userData.distanceCullCenterX === "number" &&
    typeof visual.userData.distanceCullCenterZ === "number" &&
    typeof visual.userData.distanceCullRadius === "number"
  ) {
    return;
  }
  visual.updateWorldMatrix(true, true);
  distanceCullBox.setFromObject(visual);
  if (distanceCullBox.isEmpty()) {
    visual.getWorldPosition(distanceCullSphere.center);
    distanceCullSphere.radius = 0;
  } else {
    distanceCullBox.getBoundingSphere(distanceCullSphere);
  }
  visual.userData.distanceCullCenterX = distanceCullSphere.center.x;
  visual.userData.distanceCullCenterZ = distanceCullSphere.center.z;
  visual.userData.distanceCullRadius = distanceCullSphere.radius;
}

export function updateDistanceCulledVisuals(
  visuals: THREE.Object3D[],
  playerPosition: THREE.Vector3,
  visibleDistance: number,
) {
  const baseDistance = Number.isFinite(visibleDistance) ? Math.max(1, visibleDistance) : Infinity;
  for (let index = visuals.length - 1; index >= 0; index -= 1) {
    const visual = visuals[index];
    if (!visual.parent) {
      visuals.splice(index, 1);
      continue;
    }
    if (baseDistance === Infinity) {
      visual.visible = true;
      continue;
    }
    const centerX = typeof visual.userData.distanceCullCenterX === "number" ? visual.userData.distanceCullCenterX : visual.position.x;
    const centerZ = typeof visual.userData.distanceCullCenterZ === "number" ? visual.userData.distanceCullCenterZ : visual.position.z;
    const radius = typeof visual.userData.distanceCullRadius === "number" ? visual.userData.distanceCullRadius : 0;
    const distance = baseDistance + radius + DISTANCE_CULL_MARGIN;
    const dx = centerX - playerPosition.x;
    const dz = centerZ - playerPosition.z;
    visual.visible = dx * dx + dz * dz <= distance * distance;
  }
}

export function shouldHideInvisibleMeshFromRender(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material instanceof THREE.MeshBasicMaterial && material.colorWrite === false);
}
