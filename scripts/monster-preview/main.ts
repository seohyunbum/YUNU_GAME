// 신규 몬스터 비주얼 프리뷰 — 아키타입 7종 + 틴트 변종 1종을 4x2 그리드로 렌더해
// 스크린샷 QA 한다 (scripts/monster-visual-preview.mjs 가 구동).
import * as THREE from "three";
import { createPredatorVisual } from "../../src/game/creatureVisuals";
import { applyPredatorMonsterDefinition, predatorKindForMonster, type MonsterId } from "../../src/game/monsters";
import type { PredatorKind, WorldObject } from "../../src/game/types";

const PANEL_WIDTH = 480;
const PANEL_HEIGHT = 430;
const COLUMNS = 4;
const ROWS = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(PANEL_WIDTH * COLUMNS, PANEL_HEIGHT * ROWS);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

function buildScene(model: THREE.Object3D, background: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(2.5, 4, 2.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd8ff, 0.5);
  fill.position.set(-3, 1.5, -1);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshStandardMaterial({ color: 0x3a4a3f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground, model);
  const camera = new THREE.PerspectiveCamera(42, PANEL_WIDTH / PANEL_HEIGHT, 0.05, 50);
  camera.position.set(2.4, 1.9, 2.9);
  camera.lookAt(0, 0.85, 0);
  return { scene, camera };
}

function monsterModel(monsterId: MonsterId): THREE.Object3D {
  const visual = createPredatorVisual(predatorKindForMonster(monsterId));
  const fakeObject = { root: visual.group, name: visual.name } as unknown as WorldObject;
  applyPredatorMonsterDefinition(fakeObject, { id: "preview", lootTier: 1 }, monsterId);
  visual.group.rotation.y = -0.6;
  return visual.group;
}

const lineup: { id: MonsterId; background: number }[] = [
  { id: "boar", background: 0x2c3a2d },
  { id: "snake", background: 0x2d3a2c },
  { id: "bat", background: 0x2a2f3a },
  { id: "scorpion", background: 0x3a342a },
  { id: "bear", background: 0x33302a },
  { id: "zombie", background: 0x2a333a },
  { id: "ghost", background: 0x222a38 },
  { id: "wraith", background: 0x1f2733 },
];

lineup.forEach((entry, index) => {
  const { scene, camera } = buildScene(monsterModel(entry.id), entry.background);
  const x = (index % COLUMNS) * PANEL_WIDTH;
  const y = (ROWS - 1 - Math.floor(index / COLUMNS)) * PANEL_HEIGHT;
  renderer.setViewport(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.setScissor(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.render(scene, camera);
});

(window as unknown as { monsterPreviewReady: boolean }).monsterPreviewReady = true;
