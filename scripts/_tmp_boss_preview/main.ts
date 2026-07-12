// 일회용 — 요새 5단계 보스 6종 비주얼 프리뷰(그리드). monster-preview 패턴.
import * as THREE from "three";
import { createFortressBossModel, animateFortressBossModel, type FortressBossConceptKey } from "../../src/game/fortressBossVisuals";
import { FORTRESS_BOSS_CONCEPTS } from "../../src/game/fortressBoss";

const PANEL_W = 420;
const PANEL_H = 520;
const COLS = 3;
const ROWS = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(PANEL_W * COLS, PANEL_H * ROWS);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

function panelScene(key: FortressBossConceptKey) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2433);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
  sun.position.set(2.5, 4, 2.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.5);
  fill.position.set(-3, 1.5, -1);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.8, 24), new THREE.MeshStandardMaterial({ color: 0x33313f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const model = createFortressBossModel(key);
  animateFortressBossModel(model, 1.2);
  scene.add(model);
  return scene;
}

const camera = new THREE.PerspectiveCamera(38, PANEL_W / PANEL_H, 0.1, 60);
camera.position.set(0, 2.6, 7.2);
camera.lookAt(0, 1.9, 0);

const scenes = FORTRESS_BOSS_CONCEPTS.map((c) => panelScene(c.key));
for (let i = 0; i < scenes.length; i += 1) {
  const x = (i % COLS) * PANEL_W;
  const y = (ROWS - 1 - Math.floor(i / COLS)) * PANEL_H;
  renderer.setViewport(x, y, PANEL_W, PANEL_H);
  renderer.setScissor(x, y, PANEL_W, PANEL_H);
  renderer.render(scenes[i], camera);
}
(window as unknown as { bossPreviewReady: boolean }).bossPreviewReady = true;
