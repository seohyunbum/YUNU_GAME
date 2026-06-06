import * as THREE from "three";
import type { QualityMode } from "./types";

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

export function shouldHideInvisibleMeshFromRender(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => material instanceof THREE.MeshBasicMaterial && material.colorWrite === false);
}
