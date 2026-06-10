// 무기 비주얼 프리뷰 — 1인칭 손/무기 배치를 게임과 동일한 변환 체인으로 재현해
// 스크린샷 QA 한다 (scripts/weapon-visual-preview.mjs 가 구동). 게임 코드는 건드리지 않는다.
import * as THREE from "three";
import { createHeldItemModel } from "../../src/game/heldItemVisuals";
import { createIronShieldModel, createGunnerPistolModel } from "../../src/game/weaponVisuals";
import type { ItemId } from "../../src/game/types";

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 460;
const COLUMNS = 2;
const ROWS = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(PANEL_WIDTH * COLUMNS, PANEL_HEIGHT * ROWS);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

function buildLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.35);
  sun.position.set(2, 4, 2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.45);
  fill.position.set(-3, 1, 1);
  scene.add(fill);
}

// 게임 createFirstPersonHand() 의 팔/손 배치 복제 (시각 맥락용)
function buildFirstPersonHand(held: THREE.Object3D) {
  const hand = new THREE.Group();
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), new THREE.MeshStandardMaterial({ color: 0x2f4668, roughness: 0.78 }));
  upperArm.position.set(0.47, -0.34, -1.0);
  upperArm.rotation.set(-0.48, -0.14, 0.18);
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.34), new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.75 }));
  forearm.position.set(0.36, -0.4, -1.18);
  forearm.rotation.set(-0.46, -0.2, 0.16);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x243b5a, roughness: 0.75 }));
  sleeve.position.set(0.27, -0.45, -1.35);
  sleeve.rotation.set(-0.38, -0.22, 0.13);
  const fist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.13), new THREE.MeshStandardMaterial({ color: 0xd5a16f, roughness: 0.7 }));
  fist.position.set(0.22, -0.48, -1.48);
  fist.rotation.set(-0.28, -0.18, 0.1);
  const heldGroup = new THREE.Group();
  heldGroup.position.set(0.18, -0.5, -1.52);
  heldGroup.rotation.set(-0.34, -0.22, -0.12);
  heldGroup.add(held);
  hand.add(upperArm, forearm, sleeve, fist, heldGroup);
  return hand;
}

interface Panel {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

function heldViewPanel(item: ItemId, background: number): Panel {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  buildLights(scene);
  const camera = new THREE.PerspectiveCamera(75, PANEL_WIDTH / PANEL_HEIGHT, 0.1, 50);
  scene.add(camera);
  camera.add(buildFirstPersonHand(createHeldItemModel(item)));
  return { scene, camera };
}

function showcasePanel(model: THREE.Object3D, background: number, distance = 1.15): Panel {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  buildLights(scene);
  const camera = new THREE.PerspectiveCamera(45, PANEL_WIDTH / PANEL_HEIGHT, 0.05, 50);
  camera.position.set(distance * 0.5, distance * 0.28, distance);
  camera.lookAt(0, 0, 0);
  scene.add(model);
  return { scene, camera };
}

const pistolShowcase = createGunnerPistolModel();
pistolShowcase.position.y = -0.3; // 모델 중심(y≈0.3) 을 원점으로
pistolShowcase.rotation.y = 2.0;

const panels: Panel[] = [
  heldViewPanel("pistol", 0x2c3a4d),
  heldViewPanel("iron_shield", 0x33424f),
  showcasePanel(pistolShowcase, 0x223041),
  showcasePanel(createIronShieldModel(), 0x2a3644),
];

panels.forEach((panel, index) => {
  const x = (index % COLUMNS) * PANEL_WIDTH;
  const y = (ROWS - 1 - Math.floor(index / COLUMNS)) * PANEL_HEIGHT;
  renderer.setViewport(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.setScissor(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.render(panel.scene, panel.camera);
});

(window as unknown as { weaponPreviewReady: boolean }).weaponPreviewReady = true;
