import * as THREE from "three";
import { BEST_TRAINING_KEY } from "./constants";
import { applyStylizedMeshDefaults } from "../visuals";
import type { TrainingKind, TrainingStats, WorldObject } from "./types";

// 훈련장 — 15레벨 이후 사냥-only 성장의 대안. 미니게임 성공으로 스탯을 영구 강화한다.
// 성공 횟수(trainingStats)가 곧 난이도 — 할수록 어려워져 자연스러운 소프트캡이 된다.

export const TRAINING_MIN_LEVEL = 10;

export const TRAINING_REWARDS: Record<TrainingKind, number> = { hp: 2, attack: 1, armor: 1, mana: 2 };

export const TRAINING_GAMES: Record<TrainingKind, { name: string; rigName: string; statLabel: string; howTo: string }> = {
  hp: { name: "역기들기", rigName: "역기", statLabel: "최대 체력", howTo: "빠르게 연타해서 게이지를 끝까지 채우세요! 연타가 느려지면 역기가 내려갑니다." },
  attack: { name: "과녁맞추기", rigName: "과녁", statLabel: "공격력", howTo: "과녁이 가운데 조준선을 지나는 순간 클릭(또는 스페이스)!" },
  armor: { name: "방패막기", rigName: "방패 더미", statLabel: "방어력", howTo: "'막아!' 신호가 뜨는 순간 클릭! 가짜 신호에 속지 말고 3번 연속 막으세요." },
  mana: { name: "명상호흡", rigName: "명상 제단", statLabel: "최대 마나", howTo: "바늘이 가운데 고요 구역 안에 있을 때 클릭! 3번 모으면 성공." },
};

export function createTrainingStats(): TrainingStats {
  return { hp: 0, attack: 0, armor: 0, mana: 0 };
}

export function normalizeTrainingStats(saved?: Partial<TrainingStats> | null): TrainingStats {
  const clamp = (value: unknown) => Math.max(0, Math.floor(typeof value === "number" && Number.isFinite(value) ? value : 0));
  return { hp: clamp(saved?.hp), attack: clamp(saved?.attack), armor: clamp(saved?.armor), mana: clamp(saved?.mana) };
}

export const TRAINING_KINDS: readonly TrainingKind[] = ["hp", "attack", "armor", "mana"];

// 훈련 종목별 "계정 최고기록"(랭킹 전용). 활성 훈련치(캐릭터별 능력치 보너스)와 분리해
// 닉네임당 영구 유지한다 — 새 게임·다른 세이브 로드에도 떨어지지 않는다(요새 기록과 동일 정책).
// 더 높은 단계, 또는 같은 단계를 더 적은 시도로 = 더 좋은 기록(랭킹 정렬: stage desc, tries asc).
export type BestTraining = Record<TrainingKind, { stage: number; tries: number }>;

export function createBestTraining(): BestTraining {
  return { hp: { stage: 0, tries: 0 }, attack: { stage: 0, tries: 0 }, armor: { stage: 0, tries: 0 }, mana: { stage: 0, tries: 0 } };
}

export function loadBestTraining(): BestTraining {
  const best = createBestTraining();
  try {
    const raw = localStorage.getItem(BEST_TRAINING_KEY);
    if (!raw) return best;
    const parsed = JSON.parse(raw) as Partial<Record<TrainingKind, { stage?: number; tries?: number }>>;
    for (const kind of TRAINING_KINDS) {
      const v = parsed?.[kind];
      best[kind] = { stage: Math.max(0, Math.floor(Number(v?.stage ?? 0))), tries: Math.max(0, Math.floor(Number(v?.tries ?? 0))) };
    }
  } catch {
    // 손상된 값은 무시하고 0 기록으로 시작
  }
  return best;
}

export function saveBestTraining(best: BestTraining): void {
  try {
    localStorage.setItem(BEST_TRAINING_KEY, JSON.stringify(best));
  } catch {
    // 저장 실패(quota 등)는 조용히 무시 — 랭킹은 부가 기능
  }
}

// 현재 (stage, tries) 가 기존 최고기록보다 좋으면 갱신하고 true. 더 높은 단계 또는 동률에서 더 적은 시도.
export function raiseBestTraining(best: BestTraining, kind: TrainingKind, stage: number, tries: number): boolean {
  const s = Math.max(0, Math.floor(stage));
  const t = Math.max(0, Math.floor(tries));
  if (s <= 0) return false;
  const rec = best[kind];
  if (s > rec.stage || (s === rec.stage && (rec.tries === 0 || t < rec.tries))) {
    rec.stage = s;
    rec.tries = t;
    return true;
  }
  return false;
}

// ── 난이도 곡선 (성공 횟수 기반, 전부 단조) ──
export function liftDrainPerSecond(count: number) {
  return 26 + count * 6; // 게이지 자연 감소 — 연타 요구 속도
}
export function liftClickPower(count: number) {
  return Math.max(5.5, 9 - count * 0.25); // 클릭당 충전량은 점점 줄어든다
}
export function targetSpeed(count: number) {
  return 1.05 + count * 0.16; // 과녁 왕복 속도
}
export function targetWobble(count: number) {
  return Math.min(0.85, count * 0.09); // 불규칙성 — 이중 사인 진폭
}
export function targetTolerance(count: number) {
  return Math.max(0.05, 0.11 - count * 0.004); // 명중 허용 폭
}
// 과녁 발사 최소 입력 간격 — 스페이스 난타·꾹누르기(키 리피트)·클릭 연타로 "얻어걸리는" 악용을 막는다.
export const TARGET_SHOOT_MIN_INTERVAL_MS = 500;
export function canShootTarget(now: number, lastShotAt: number) {
  return now - lastShotAt >= TARGET_SHOOT_MIN_INTERVAL_MS;
}
export function blockWindowMs(count: number) {
  return Math.max(240, 540 - count * 26); // 막기 반응 시간
}
export function blockFakeChance(count: number) {
  return Math.min(0.45, count * 0.05); // 가짜 신호 확률
}
export function calmZoneRatio(count: number) {
  return Math.max(0.07, 0.26 - count * 0.018); // 고요 구역 폭
}

// ── 훈련장 ensure-spawn — 저장하지 않고 시작 초원에 항상 재생성한다 ──
export const TRAINING_CENTER = { x: 58, z: 46 };
const TRAINING_RADIUS = 11;

export interface TrainingGroundContext {
  defaultMapId: string;
  worldMapId(): string;
  locationMode(): string;
  hasTrainingGround(): boolean;
  addWorldObject(type: "trainingGround" | "trainingRig", name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
}

function rigVisual(kind: TrainingKind) {
  const group = new THREE.Group();
  if (kind === "hp") {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 10), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.5, roughness: 0.4 }));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.55;
    group.add(bar);
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 18), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 }));
      plate.rotation.z = Math.PI / 2;
      plate.position.set(side * 1.0, 0.55, 0);
      group.add(plate);
    }
  } else if (kind === "attack") {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 }));
    stand.position.y = 0.75;
    group.add(stand);
    const colors = [0xef4444, 0xfde68a, 0xef4444];
    colors.forEach((color, index) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.62 - index * 0.2, 0.62 - index * 0.2, 0.07 + index * 0.02, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.6, index * 0.012);
      group.add(ring);
    });
  } else if (kind === "armor") {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.7, 8), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.85 }));
    post.position.y = 0.85;
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18), new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.35, roughness: 0.45 }));
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0, 1.25, 0.18);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfcd34d, metalness: 0.5, roughness: 0.35 }));
    boss.position.set(0, 1.25, 0.3);
    group.add(post, shield, boss);
  } else {
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 }));
    altar.position.y = 0.35;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0ea5e9, emissiveIntensity: 0.7, roughness: 0.3 }));
    orb.position.y = 1.05;
    group.add(altar, orb);
  }
  return group;
}

// 훈련장 안내 간판 텍스처 — 무엇을 하는 곳인지 직관적으로. 장착 시 1회 빌드(핫패스 아님).
function trainingSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 232;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(0, 0, 512, 232);
    ctx.fillStyle = "#5a3a1e";
    ctx.fillRect(10, 10, 492, 212);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "bold 60px 'Malgun Gothic', sans-serif";
    ctx.fillText("훈 련 장", 256, 76);
    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 30px 'Malgun Gothic', sans-serif";
    ctx.fillText("미니게임으로 스탯 영구 강화", 256, 128);
    ctx.fillStyle = "#d8c9aa";
    ctx.font = "25px 'Malgun Gothic', sans-serif";
    ctx.fillText("체력 · 공격력 · 방어력 · 마나", 256, 168);
    ctx.fillText("권장 Lv.10+ · 안전구역(몬스터 없음)", 256, 204);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function ensureTrainingGround(context: TrainingGroundContext) {
  if (context.locationMode() !== "overworld" || context.worldMapId() !== context.defaultMapId) return;
  if (context.hasTrainingGround()) return;

  const centerY = context.getGroundHeightAt(TRAINING_CENTER.x, TRAINING_CENTER.z);
  const ground = new THREE.Group();
  const mat = new THREE.Mesh(
    new THREE.CylinderGeometry(TRAINING_RADIUS - 0.6, TRAINING_RADIUS - 0.6, 0.07, 30),
    new THREE.MeshStandardMaterial({ color: 0xc8b07a, roughness: 0.95 }),
  );
  mat.position.y = 0.04;
  ground.add(mat);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xa9743c, roughness: 0.8 });
  const posts = 14;
  for (let index = 0; index < posts; index += 1) {
    const angle = (index / posts) * Math.PI * 2;
    const px = Math.cos(angle) * TRAINING_RADIUS;
    const pz = Math.sin(angle) * TRAINING_RADIUS;
    if (Math.abs(angle - Math.PI / 2) < 0.24) continue; // 남쪽 입구
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.25, 7), postMaterial);
    post.position.set(px, 0.62, pz);
    ground.add(post);
    const nextAngle = ((index + 1) / posts) * Math.PI * 2;
    if (Math.abs(nextAngle - Math.PI / 2) < 0.24) continue;
    const midAngle = (angle + nextAngle) / 2;
    const segment = 2 * TRAINING_RADIUS * Math.sin(Math.PI / posts);
    for (const railY of [0.5, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segment, 0.07, 0.07), railMaterial);
      rail.position.set(Math.cos(midAngle) * TRAINING_RADIUS, railY, Math.sin(midAngle) * TRAINING_RADIUS);
      rail.rotation.y = -midAngle + Math.PI / 2;
      ground.add(rail);
    }
  }
  // 안내 간판 — 큰 나무판 + 캔버스 텍스트(앞뒤 양면)로 무엇을 하는 곳인지 바로 알 수 있게
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.1, 8), postMaterial);
  signPost.position.set(0, 1.05, TRAINING_RADIUS + 0.5);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2f17, roughness: 0.7 }));
  board.position.set(0, 2.15, TRAINING_RADIUS + 0.5);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.15), new THREE.MeshBasicMaterial({ map: trainingSignTexture(), side: THREE.DoubleSide }));
  panel.position.set(0, 2.15, TRAINING_RADIUS + 0.56);
  ground.add(signPost, board, panel);
  applyStylizedMeshDefaults(ground);
  ground.position.set(TRAINING_CENTER.x, centerY, TRAINING_CENTER.z);
  context.addWorldObject("trainingGround", "훈련장", ground, { collidable: false });

  const rigKinds: TrainingKind[] = ["hp", "attack", "armor", "mana"];
  rigKinds.forEach((kind, index) => {
    const angle = -Math.PI / 2 + (index / rigKinds.length) * Math.PI * 2; // 북쪽부터 시계방향
    const x = TRAINING_CENTER.x + Math.cos(angle) * (TRAINING_RADIUS - 3.4);
    const z = TRAINING_CENTER.z + Math.sin(angle) * (TRAINING_RADIUS - 3.4);
    const visual = rigVisual(kind);
    applyStylizedMeshDefaults(visual);
    visual.position.set(x, context.getGroundHeightAt(x, z), z);
    visual.rotation.y = -angle + Math.PI / 2;
    context.addWorldObject("trainingRig", TRAINING_GAMES[kind].rigName, visual, { trainingKind: kind, collidable: true, collisionRadius: 0.85, collisionHeight: 1.6 });
  });
}
