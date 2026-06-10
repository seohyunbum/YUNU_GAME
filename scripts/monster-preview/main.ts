// 신규 몬스터 비주얼 프리뷰 — 윗줄: 드레이크 변종/신규 종 아이들 포즈,
// 아랫줄: 공격 도약 피크 포즈(phase 0.68) — 모션 인지성 QA 용.
// (scripts/monster-visual-preview.mjs 가 구동)
import * as THREE from "three";
import { createPredatorVisual } from "../../src/game/creatureVisuals";
import { applyPredatorMonsterDefinition, predatorKindForMonster, type MonsterId } from "../../src/game/monsters";
import { animatePredatorAttackMotion, triggerPredatorAttackMotion } from "../../src/game/predatorAi";
import type { WorldObject } from "../../src/game/types";

const PANEL_WIDTH = 390;
const PANEL_HEIGHT = 430;
const COLUMNS = 5;
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
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshStandardMaterial({ color: 0x3a4a3f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground, model);
  const camera = new THREE.PerspectiveCamera(42, PANEL_WIDTH / PANEL_HEIGHT, 0.05, 50);
  camera.position.set(2.5, 1.9, 3.0);
  camera.lookAt(0.3, 0.85, 0);
  return { scene, camera };
}

function monsterModel(monsterId: MonsterId, attackPhase?: number): THREE.Object3D {
  const visual = createPredatorVisual(predatorKindForMonster(monsterId));
  const fakeObject = { root: visual.group, name: visual.name, predatorKind: visual.predatorKind } as unknown as WorldObject;
  applyPredatorMonsterDefinition(fakeObject, { id: "preview", lootTier: 1 }, monsterId);
  visual.group.rotation.y = -0.6;
  if (attackPhase !== undefined) {
    triggerPredatorAttackMotion(fakeObject, 0, 0.8, 0.2);
    const duration = Number(visual.group.userData.attackDuration ?? 500);
    animatePredatorAttackMotion(fakeObject, duration * attackPhase);
  }
  return visual.group;
}

const lineup: { id: MonsterId; background: number; attackPhase?: number }[] = [
  { id: "drake", background: 0x2c3a2d },
  { id: "gale_drake", background: 0x2a323a },
  { id: "gold_drake", background: 0x3a352a },
  { id: "snake", background: 0x2d3a2c },
  { id: "scorpion", background: 0x3a342a },
  { id: "wolf", background: 0x30343a, attackPhase: 0.68 },
  { id: "boar", background: 0x33302a, attackPhase: 0.68 },
  { id: "drake", background: 0x2c3a2d, attackPhase: 0.68 },
  { id: "zombie", background: 0x2a333a, attackPhase: 0.68 },
  { id: "bear", background: 0x33302a, attackPhase: 0.68 },
];

lineup.forEach((entry, index) => {
  const { scene, camera } = buildScene(monsterModel(entry.id, entry.attackPhase), entry.background);
  const x = (index % COLUMNS) * PANEL_WIDTH;
  const y = (ROWS - 1 - Math.floor(index / COLUMNS)) * PANEL_HEIGHT;
  renderer.setViewport(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.setScissor(x, y, PANEL_WIDTH, PANEL_HEIGHT);
  renderer.render(scene, camera);
});

(window as unknown as { monsterPreviewReady: boolean }).monsterPreviewReady = true;
