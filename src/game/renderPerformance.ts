import * as THREE from "three";
import type { QualityMode } from "./types";

const distanceCullBox = new THREE.Box3();
const distanceCullSphere = new THREE.Sphere();
const DISTANCE_CULL_MARGIN = 72;

// 셰이더 프로그램은 renderer 수명 동안 캐시된다(WebGLRenderer 의 프로그램 캐시는 "프로그램 키"=재료 파라미터
// 기준이라 인스턴스·씬이 새로 만들어져도 같은 파라미터면 재사용). 동굴/집처럼 같은 종류의 인테리어를 반복 진입할
// 때마다 전체 scene traverse + GPU compile + 1×1 워밍 렌더를 다시 돌리면 진입마다 큰 프레임 히치가 생긴다.
// onceKey 가 주어지면 그 종류는 최초 1회만 워밍하고 이후 진입은 건너뛴다(프로그램은 이미 캐시됨).
// 주의: 이 Set 은 의도적으로 renderer 수명(모듈 수명) 동안 유지한다 — renderer 는 readonly 로 재생성되지 않으므로
// 새 게임/세이브 로드 후에도 프로그램 캐시가 살아 있어 다시 워밍할 필요가 없다. 리셋 시 clear 하면 새 게임 첫
// 진입마다 전체-씬 워밍을 재실행해 바로 이 히치를 부활시키므로 clear 하지 말 것(컨텍스트 손실은 별도 드문 케이스).
const precompiledOnceKeys = new Set<string>();

export function precompileSceneShaders(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, onceKey?: string) {
  if (onceKey !== undefined) {
    if (precompiledOnceKeys.has(onceKey)) return;
    precompiledOnceKeys.add(onceKey);
  }
  const state: { object: THREE.Object3D; visible: boolean; frustumCulled: boolean }[] = [];
  const previousTarget = renderer.getRenderTarget();
  const previousShadowNeedsUpdate = renderer.shadowMap.needsUpdate;
  const warmupTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
  try {
    scene.traverse((object) => {
      state.push({ object, visible: object.visible, frustumCulled: object.frustumCulled });
      object.visible = true;
      object.frustumCulled = false;
    });
    renderer.compile(scene, camera);
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(warmupTarget);
    renderer.render(scene, camera);
  } catch (error) {
    console.warn("Shader precompile failed.", error);
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.shadowMap.needsUpdate = previousShadowNeedsUpdate;
    warmupTarget.dispose();
    for (const entry of state) {
      entry.object.visible = entry.visible;
      entry.object.frustumCulled = entry.frustumCulled;
    }
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

// 생물류는 개체당 15~24개 메쉬(눈·코·수염 같은 미세 장식 포함)를 가진다.
// 미세 장식은 레이캐스트 대상에서 제외해 클릭 판정 비용을 낮춘다 — 몸통/머리/팔다리는 남으므로 조준에는 지장 없다.
const TINY_DETAIL_SKIP_TYPES = new Set([
  "animal",
  "wildPredator",
  "villager",
  "villageKnight",
  "villageArcher",
  "villageMage",
  "villageGolem",
  "villageKing",
  "blacksmithNpc",
  "jammini",
  "miner",
  "dragon",
]);

export function shouldSkipTinyRaycastDetail(type: string, mesh: THREE.Mesh) {
  if (!TINY_DETAIL_SKIP_TYPES.has(type)) return false;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const radius = (mesh.geometry.boundingSphere?.radius ?? 1) * Math.max(Math.abs(mesh.scale.x), Math.abs(mesh.scale.y), Math.abs(mesh.scale.z));
  return radius < 0.09;
}

// 크리처(동물·주민·포식자·경비 등)는 단일 타겟이라 모든 팔다리 메시를 raycast 대상으로 둘 필요가 없다.
// 가장 큰 메시 몇 개만 남겨 타겟 가능성(몸통)은 유지하면서 등록 수·근처 look-raycast 비용을 대폭 줄인다.
// 보스 드래곤은 제외(거대·중요 타겟이라 전체 유지). 최소 1개는 항상 남는다.
export const CREATURE_RAYCAST_TYPES = new Set<string>([
  "animal", "villager", "wildPredator", "jammini",
  "villageKnight", "villageArcher", "villageMage", "villageGolem", "villageKing",
]);
export const CREATURE_RAYCAST_KEEP = 4;
function raycastMeshSize(obj: THREE.Object3D): number {
  const mesh = obj as THREE.Mesh;
  if (!mesh.geometry) return 0;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  return (mesh.geometry.boundingSphere?.radius ?? 0) * Math.max(Math.abs(mesh.scale.x), Math.abs(mesh.scale.y), Math.abs(mesh.scale.z));
}
export function capCreatureRaycastMeshes(type: string, meshes: THREE.Object3D[]) {
  if (!CREATURE_RAYCAST_TYPES.has(type) || meshes.length <= CREATURE_RAYCAST_KEEP) return;
  meshes.sort((a, b) => raycastMeshSize(b) - raycastMeshSize(a));
  meshes.length = CREATURE_RAYCAST_KEEP;
}
