import * as THREE from "three";
import { ARENA_CENTER_Z, ARENA_HALF } from "./constants";
import { bal } from "./balanceTuning";
import type { WorldObject } from "./types";

// 최종 보스 '일리아' 전투 엔진 — 텔레그래프(사전 표시 붉은 영역) 기반 패턴 보스. leaf(main.ts import 금지).
// P1(봉인된 군주): 중앙 고정(사슬) + 조준/기하 패턴 6종(졸개 소환 포함).
// P2(절망의 군주): 이동 해금 — 돌진·비행 투척·연쇄 참격 등 완전히 다른 패턴 5종.
// 피격 = 최대체력 비율(기본 50%, 튜너블 illia_hit_pct) — 패턴을 익혀 컨트롤로 회피하는 설계.
// 컷씬 2종(각성/해방, 각 ~10초, 스킵 가능) 시퀀서 포함. 설계: docs/illia-final-boss.md

export const ILLIA_P1_KIND = "illia_sealed";
export const ILLIA_P2_KIND = "illia_desperate";
export const ILLIA_ARENA_CENTER = { x: 0, z: ARENA_CENTER_Z };
export const ILLIA_ENTRY_POS = { x: 0, z: ARENA_CENTER_Z + ARENA_HALF - 3 }; // 아레나 남쪽 입구(사망 부활 지점)

// ── 텔레그래프 ──────────────────────────────────────────────────────────────
export type TelegraphSpec =
  | { kind: "circle"; x: number; z: number; r: number; delayMs: number }
  | { kind: "ring"; x: number; z: number; inner: number; r: number; delayMs: number }
  | { kind: "line"; x: number; z: number; dirX: number; dirZ: number; len: number; width: number; delayMs: number }
  | { kind: "cone"; x: number; z: number; angle: number; arc: number; r: number; delayMs: number };

interface Telegraph {
  spec: TelegraphSpec;
  detonateAt: number;
  group: THREE.Group;
  fill: THREE.Mesh;
}

const fillMaterialBase = new THREE.MeshBasicMaterial({ color: 0xff1f3d, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });

function telegraphMesh(spec: TelegraphSpec): { group: THREE.Group; fill: THREE.Mesh } {
  const group = new THREE.Group();
  let fillGeometry: THREE.BufferGeometry;
  let edgeGeometry: THREE.BufferGeometry | null = null;
  if (spec.kind === "circle") {
    fillGeometry = new THREE.CircleGeometry(spec.r, 30);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 30);
  } else if (spec.kind === "ring") {
    fillGeometry = new THREE.RingGeometry(spec.inner, spec.r, 36);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 36);
  } else if (spec.kind === "cone") {
    fillGeometry = new THREE.CircleGeometry(spec.r, 24, spec.angle - spec.arc / 2, spec.arc);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 24, 1, spec.angle - spec.arc / 2, spec.arc);
  } else {
    fillGeometry = new THREE.PlaneGeometry(spec.width, spec.len);
    edgeGeometry = null;
  }
  const fill = new THREE.Mesh(fillGeometry, fillMaterialBase.clone());
  fill.rotation.x = -Math.PI / 2;
  if (spec.kind === "line") {
    // 라인은 시작점에서 dir 방향으로 len 만큼 — 평면 중심을 절반 지점으로 이동 후 진행각 회전.
    const yaw = Math.atan2(spec.dirX, spec.dirZ);
    group.rotation.y = yaw;
    fill.position.z = spec.len / 2;
  }
  group.add(fill);
  if (edgeGeometry) {
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.012;
    group.add(edge);
  }
  group.position.set(spec.x, 0.07, spec.z);
  return { group, fill };
}

export function telegraphContains(spec: TelegraphSpec, px: number, pz: number): boolean { // export: 골든 테스트(판정 기하)용
  const dx = px - spec.x;
  const dz = pz - spec.z;
  if (spec.kind === "circle") return dx * dx + dz * dz <= spec.r * spec.r;
  if (spec.kind === "ring") { const d2 = dx * dx + dz * dz; return d2 >= spec.inner * spec.inner && d2 <= spec.r * spec.r; }
  if (spec.kind === "cone") {
    const d2 = dx * dx + dz * dz;
    if (d2 > spec.r * spec.r) return false;
    let diff = Math.atan2(dx, dz) - spec.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) <= spec.arc / 2;
  }
  // line: 진행 방향 투영 0..len, 수직 거리 ≤ width/2
  const along = dx * spec.dirX + dz * spec.dirZ;
  if (along < 0 || along > spec.len) return false;
  const perp = Math.abs(dx * spec.dirZ - dz * spec.dirX);
  return perp <= spec.width / 2;
}

// ── 전투 상태 ──────────────────────────────────────────────────────────────
export interface IlliaFightState {
  active: boolean;
  phase: 1 | 2;
  lastNow: number; // 직전 틱 시각 — 패널 일시정지 시 경과분만큼 타이머를 밀기 위한 기준(0=미시작)
  nextPatternAt: number;
  patternCursor: number;
  telegraphs: Telegraph[];
  pending: { at: number; run: () => void }[]; // 다단 패턴 지연 스텝
  minionIds: string[];
  move: { fromX: number; fromZ: number; toX: number; toZ: number; startAt: number; durMs: number; fly: boolean } | null;
  animT: number;
}

export function createIlliaFightState(): IlliaFightState {
  return { active: false, phase: 1, lastNow: 0, nextPatternAt: 0, patternCursor: 0, telegraphs: [], pending: [], minionIds: [], move: null, animT: 0 };
}

export interface IlliaContext {
  scene: THREE.Scene;
  now(): number;
  playerPosition: THREE.Vector3;
  boss(): WorldObject | null;
  applyPlayerHit(maxHealthPct: number, label: string): boolean; // 반환 = 사망 여부(사망 특례가 전투를 리셋하므로 잔여 폭발 중단용)
  isPanelOpen?(): boolean; // 패널 열림 = 일시정지(dragonAi/caveMonsters 와 동일 정책)
  spawnMinion(x: number, z: number): string | null;
  isMinionAlive(id: string): boolean;
  groundBurst(x: number, z: number): void; // 폭발 연출(붉은 충격파+파티클)
  showMessage(text: string): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
}

export function resetIlliaFight(state: IlliaFightState, scene: THREE.Scene): void {
  for (const telegraph of state.telegraphs) { scene.remove(telegraph.group); disposeTelegraph(telegraph); }
  state.telegraphs.length = 0;
  state.lastNow = 0;
  state.pending.length = 0;
  state.minionIds.length = 0;
  state.move = null;
  state.active = false;
}

export function startIlliaFight(state: IlliaFightState, phase: 1 | 2, now: number): void {
  state.active = true;
  state.phase = phase;
  state.lastNow = 0;
  state.patternCursor = 0;
  state.nextPatternAt = now + 2600; // 개전 여유 — 첫 패턴 전 관찰 시간
  state.telegraphs.length = 0;
  state.pending.length = 0;
  state.minionIds.length = 0;
  state.move = null;
}

// 텔레그래프 자산 해제 — 지오메트리는 매번 신규 생성이라 폭발/리셋 시 dispose(전투 내내 GPU 누적 방지).
// fill 재질은 clone(펄스 개별 제어용)이라 함께 해제, 공유 edgeMaterial 은 보존.
function disposeTelegraph(telegraph: Telegraph): void {
  telegraph.group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh) return;
    mesh.geometry.dispose();
    if (mesh.material !== edgeMaterial) (mesh.material as THREE.Material).dispose();
  });
}

function addTelegraph(state: IlliaFightState, ctx: IlliaContext, spec: TelegraphSpec): void {
  const { group, fill } = telegraphMesh(spec);
  ctx.scene.add(group);
  state.telegraphs.push({ spec, detonateAt: ctx.now() + spec.delayMs, group, fill });
}

function clampArena(v: number, margin = 1.5): number {
  return Math.max(-ARENA_HALF + margin, Math.min(ARENA_HALF - margin, v));
}
function clampArenaZ(z: number, margin = 1.5): number {
  return Math.max(ARENA_CENTER_Z - ARENA_HALF + margin, Math.min(ARENA_CENTER_Z + ARENA_HALF - margin, z));
}

const telegraphMsScale = () => bal("illia_telegraph_scale", 1); // 텔레그래프 시간 배율(높을수록 쉬움)
const T = (ms: number) => Math.round(ms * telegraphMsScale());

// ── P1 패턴(고정형) — 보스 위치 = 아레나 중앙 ──────────────────────────────
const P1_PATTERNS: ((state: IlliaFightState, ctx: IlliaContext) => number)[] = [
  (state, ctx) => { // 심판의 낙인 — 플레이어 현위치 추적 원 3연속
    ctx.showMessage("⚠ 일리아가 낙인을 새깁니다 — 붉은 원에서 벗어나세요!");
    for (let i = 0; i < 3; i += 1) {
      state.pending.push({ at: ctx.now() + i * 620, run: () => addTelegraph(state, ctx, { kind: "circle", x: clampArena(ctx.playerPosition.x), z: clampArenaZ(ctx.playerPosition.z), r: 3.1, delayMs: T(1350) }) });
    }
    return 4200;
  },
  (state, ctx) => { // 회전 십자 참격 — 십자 빔 → 45° 회전 빔
    ctx.showMessage("⚠ 참격이 교차합니다 — 빔 사이로!");
    const c = ILLIA_ARENA_CENTER;
    for (let d = 0; d < 4; d += 1) {
      const a = (Math.PI / 2) * d;
      addTelegraph(state, ctx, { kind: "line", x: c.x, z: c.z, dirX: Math.sin(a), dirZ: Math.cos(a), len: ARENA_HALF, width: 3.0, delayMs: T(1500) });
      state.pending.push({ at: ctx.now() + 1100, run: () => addTelegraph(state, ctx, { kind: "line", x: c.x, z: c.z, dirX: Math.sin(a + Math.PI / 4), dirZ: Math.cos(a + Math.PI / 4), len: ARENA_HALF, width: 3.0, delayMs: T(1500) }) });
    }
    return 5200;
  },
  (state, ctx) => { // 속박의 파동 — 중거리 링(안전=보스 근접 or 바깥)
    ctx.showMessage("⚠ 속박의 파동 — 바짝 붙거나 멀리 벗어나세요!");
    addTelegraph(state, ctx, { kind: "ring", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, inner: 4.2, r: 10.5, delayMs: T(1800) });
    return 4400;
  },
  (state, ctx) => { // 어둠의 부채 — 플레이어 방향 부채꼴 2연속(살짝 각도 보정)
    ctx.showMessage("⚠ 어둠의 참격 — 옆으로 피하세요!");
    const c = ILLIA_ARENA_CENTER;
    const angleTo = () => Math.atan2(ctx.playerPosition.x - c.x, ctx.playerPosition.z - c.z);
    addTelegraph(state, ctx, { kind: "cone", x: c.x, z: c.z, angle: angleTo(), arc: Math.PI / 2.1, r: 13, delayMs: T(1400) });
    state.pending.push({ at: ctx.now() + 1500, run: () => addTelegraph(state, ctx, { kind: "cone", x: c.x, z: c.z, angle: angleTo(), arc: Math.PI / 2.6, r: 13, delayMs: T(1200) }) });
    return 4600;
  },
  (state, ctx) => { // 구속의 병사 — 졸개 소환(가장자리 4방)
    state.minionIds = state.minionIds.filter((id) => ctx.isMinionAlive(id));
    if (state.minionIds.length >= 4) return 2600; // 이미 충분 — 짧게 넘어감
    ctx.showMessage("⚠ 일리아가 어둠의 병사를 소환합니다!");
    for (let i = 0; i < 4 - state.minionIds.length; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const id = ctx.spawnMinion(clampArena(Math.cos(a) * (ARENA_HALF - 4)), clampArenaZ(ILLIA_ARENA_CENTER.z + Math.sin(a) * (ARENA_HALF - 4)));
      if (id) state.minionIds.push(id);
    }
    ctx.playTone(180, 0.4, "sawtooth", 0.05);
    return 5200;
  },
  (state, ctx) => { // 절망의 비 — 무작위 원 8개 순차 낙하
    ctx.showMessage("⚠ 절망의 비 — 계속 움직이세요!");
    for (let i = 0; i < 8; i += 1) {
      state.pending.push({ at: ctx.now() + i * 340, run: () => addTelegraph(state, ctx, { kind: "circle", x: clampArena(THREE.MathUtils.randFloatSpread(ARENA_HALF * 1.7)), z: clampArenaZ(ILLIA_ARENA_CENTER.z + THREE.MathUtils.randFloatSpread(ARENA_HALF * 1.7)), r: 2.6, delayMs: T(1250) }) });
    }
    return 5600;
  },
];

// ── P2 패턴(이동형) ────────────────────────────────────────────────────────
function startMove(state: IlliaFightState, ctx: IlliaContext, toX: number, toZ: number, durMs: number, fly: boolean): void {
  const boss = ctx.boss();
  if (!boss) return;
  state.move = { fromX: boss.root.position.x, fromZ: boss.root.position.z, toX: clampArena(toX, 2.5), toZ: clampArenaZ(toZ, 2.5), startAt: ctx.now(), durMs, fly };
}

const P2_PATTERNS: ((state: IlliaFightState, ctx: IlliaContext) => number)[] = [
  (state, ctx) => { // 절망의 돌진 — 플레이어 방향 직선 표시 후 대시(2연속)
    const boss = ctx.boss();
    if (!boss) return 3000;
    ctx.showMessage("⚠ 일리아가 돌진 자세를 취합니다 — 경로에서 비키세요!");
    const dash = () => {
      const b = ctx.boss();
      if (!b) return;
      const dx = ctx.playerPosition.x - b.root.position.x;
      const dz = ctx.playerPosition.z - b.root.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const len = Math.min(26, d + 7);
      addTelegraph(state, ctx, { kind: "line", x: b.root.position.x, z: b.root.position.z, dirX: dx / d, dirZ: dz / d, len, width: 3.6, delayMs: T(1050) });
      state.pending.push({ at: ctx.now() + T(1050), run: () => startMove(state, ctx, b.root.position.x + (dx / d) * len, b.root.position.z + (dz / d) * len, 340, false) });
    };
    dash();
    state.pending.push({ at: ctx.now() + 2100, run: dash });
    return 5400;
  },
  (state, ctx) => { // 흑익 비상 — 중앙 상공 비행 후 플레이어 주변 낙하 투척 6발
    ctx.showMessage("⚠ 일리아가 날아올라 창을 던집니다!");
    startMove(state, ctx, ILLIA_ARENA_CENTER.x, ILLIA_ARENA_CENTER.z, 900, true);
    for (let i = 0; i < 6; i += 1) {
      state.pending.push({ at: ctx.now() + 1000 + i * 430, run: () => addTelegraph(state, ctx, { kind: "circle", x: clampArena(ctx.playerPosition.x + THREE.MathUtils.randFloatSpread(7)), z: clampArenaZ(ctx.playerPosition.z + THREE.MathUtils.randFloatSpread(7)), r: 2.9, delayMs: T(1150) }) });
    }
    state.pending.push({ at: ctx.now() + 4400, run: () => startMove(state, ctx, ILLIA_ARENA_CENTER.x + THREE.MathUtils.randFloatSpread(10), ILLIA_ARENA_CENTER.z + THREE.MathUtils.randFloatSpread(10), 700, false) });
    return 6200;
  },
  (state, ctx) => { // 연쇄 참격 — 플레이어 근처로 접근 후 부채꼴 3연쇄(좌→우→정면 광폭)
    const boss = ctx.boss();
    if (!boss) return 3000;
    ctx.showMessage("⚠ 연쇄 참격 — 등 뒤로 돌아가세요!");
    startMove(state, ctx, ctx.playerPosition.x + THREE.MathUtils.randFloatSpread(4), ctx.playerPosition.z + THREE.MathUtils.randFloatSpread(4), 620, false);
    const swing = (offset: number, arc: number, delay: number) => {
      state.pending.push({ at: ctx.now() + delay, run: () => {
        const b = ctx.boss();
        if (!b) return;
        const angle = Math.atan2(ctx.playerPosition.x - b.root.position.x, ctx.playerPosition.z - b.root.position.z) + offset;
        addTelegraph(state, ctx, { kind: "cone", x: b.root.position.x, z: b.root.position.z, angle, arc, r: 9.5, delayMs: T(950) });
      } });
    };
    swing(-0.5, Math.PI / 2.4, 800);
    swing(0.5, Math.PI / 2.4, 1750);
    swing(0, Math.PI / 1.6, 2700);
    return 6000;
  },
  (state, ctx) => { // 깃털 폭풍 — 현위치 중심 링 3겹 순차 확장
    const boss = ctx.boss();
    if (!boss) return 3000;
    ctx.showMessage("⚠ 깃털 폭풍 — 파동 사이 틈으로!");
    const bx = boss.root.position.x, bz = boss.root.position.z;
    for (let i = 0; i < 3; i += 1) {
      state.pending.push({ at: ctx.now() + i * 750, run: () => addTelegraph(state, ctx, { kind: "ring", x: bx, z: bz, inner: 2.5 + i * 4.2, r: 6.6 + i * 4.2, delayMs: T(1400) }) });
    }
    return 5400;
  },
  (state, ctx) => { // 절망 강림 — 중앙 대형 원(가장자리로 대피) 후 착지 충격 링
    ctx.showMessage("⚠ 절망이 강림합니다 — 가장자리로 대피!");
    startMove(state, ctx, ILLIA_ARENA_CENTER.x, ILLIA_ARENA_CENTER.z, 800, true);
    addTelegraph(state, ctx, { kind: "circle", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, r: 10.5, delayMs: T(2300) });
    state.pending.push({ at: ctx.now() + T(2300) + 500, run: () => { startMove(state, ctx, ILLIA_ARENA_CENTER.x, ILLIA_ARENA_CENTER.z, 250, false); addTelegraph(state, ctx, { kind: "ring", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, inner: 10.5, r: 14.5, delayMs: T(1000) }); } });
    return 6400;
  },
];

// ── 프레임 틱 — main update 에서 호출(전투 활성 시). 변형 위주(스폰 시에만 할당). ──
export function updateIlliaFight(state: IlliaFightState, ctx: IlliaContext, delta: number): void {
  if (!state.active) return;
  const now = ctx.now();
  const elapsedMs = state.lastNow > 0 ? now - state.lastNow : 0;
  state.lastNow = now;
  if (ctx.isPanelOpen?.()) {
    // 패널 열림 = 일시정지 — 타이머(벽시계 기준)를 경과분만큼 밀어, 닫는 순간 밀린 폭발이 몰아치지 않게 한다.
    state.nextPatternAt += elapsedMs;
    for (const telegraph of state.telegraphs) telegraph.detonateAt += elapsedMs;
    for (const step of state.pending) step.at += elapsedMs;
    if (state.move) state.move.startAt += elapsedMs;
    return;
  }
  const boss = ctx.boss();
  state.animT += delta;

  // 지연 스텝 실행
  for (let i = state.pending.length - 1; i >= 0; i -= 1) {
    if (now >= state.pending[i].at) {
      const step = state.pending[i];
      state.pending.splice(i, 1);
      step.run();
    }
  }

  // 이동(P2) — 보간 + 비행 고도
  if (boss && state.move) {
    const m = state.move;
    const t = Math.min(1, (now - m.startAt) / m.durMs);
    const ease = t * t * (3 - 2 * t);
    boss.root.position.x = m.fromX + (m.toX - m.fromX) * ease;
    boss.root.position.z = m.fromZ + (m.toZ - m.fromZ) * ease;
    if (t >= 1) state.move = m.fly ? m : null; // 비행은 다음 이동 명령까지 고도 유지
  }
  if (boss) {
    const targetY = state.move?.fly ? 4.2 : 0;
    boss.root.position.y += (targetY - boss.root.position.y) * Math.min(1, delta * 4);
    // 항상 플레이어를 바라봄
    boss.root.rotation.y = Math.atan2(ctx.playerPosition.x - boss.root.position.x, ctx.playerPosition.z - boss.root.position.z);
    animateIlliaBody(boss.root, state.animT, state.phase);
  }

  // 텔레그래프 펄스 + 폭발 판정 — 폭발분을 먼저 분리 수집(피격→사망 특례가 같은 콜스택에서 배열을 리셋해도 안전)
  const exploded: Telegraph[] = [];
  for (let i = state.telegraphs.length - 1; i >= 0; i -= 1) {
    const telegraph = state.telegraphs[i];
    const remain = telegraph.detonateAt - now;
    if (remain > 0) {
      (telegraph.fill.material as THREE.MeshBasicMaterial).opacity = 0.18 + (1 - remain / telegraph.spec.delayMs) * 0.34; // 다가올수록 진해짐
      continue;
    }
    state.telegraphs.splice(i, 1);
    exploded.push(telegraph);
  }
  for (const telegraph of exploded) {
    ctx.scene.remove(telegraph.group);
    disposeTelegraph(telegraph);
    ctx.groundBurst(telegraph.spec.x, telegraph.spec.z);
  }
  for (const telegraph of exploded) {
    if (!telegraphContains(telegraph.spec, ctx.playerPosition.x, ctx.playerPosition.z)) continue;
    const died = ctx.applyPlayerHit(bal("illia_hit_pct", 0.2), state.phase === 1 ? "봉인된 군주 일리아의 일격" : "절망의 군주 일리아의 일격");
    if (died) return; // 사망 특례가 전투를 풀피로 재개하므로 이 볼리의 잔여 폭발은 새 판에 이월하지 않는다
  }

  // 다음 패턴
  if (now >= state.nextPatternAt && state.pending.length === 0) {
    const patterns = state.phase === 1 ? P1_PATTERNS : P2_PATTERNS;
    const pattern = patterns[state.patternCursor % patterns.length];
    state.patternCursor += 1;
    if (state.patternCursor % patterns.length === 0) state.patternCursor += Math.floor(Math.random() * patterns.length); // 사이클마다 시작점 셔플
    const cooldown = pattern(state, ctx);
    ctx.playTone(120, 0.25, "sawtooth", 0.04);
    state.nextPatternAt = now + cooldown;
  }
}

// 본체 idle 애니메이션 — 날개짓·머리칼·부유·사슬 출렁(변형만, 할당 0).
export function animateIlliaBody(root: THREE.Object3D, t: number, phase: 1 | 2): void {
  for (const child of root.children) {
    if (child.userData.illiaChain) {
      child.rotation.y = Math.sin(t * 1.1) * 0.03;
      continue;
    }
    if (child.userData.illiaAura) { child.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06); continue; }
    if (child.userData.illiaRing) { child.rotation.z = t * 0.8; continue; }
    if (child.name === "illia-body") {
      if (phase === 2) child.position.y = 0.55 + Math.sin(t * 1.6) * 0.28; // 부유
      for (const part of child.children) {
        const flap = part.userData.wingFlap;
        if (flap) part.rotation.z = flap.side * (0.12 + Math.sin(t * (phase === 2 ? 3.4 : 1.7) + flap.pair * 0.8) * (phase === 2 ? 0.34 : 0.16));
        else if (part.userData.hairFlow) part.rotation.x = Math.sin(t * 1.3) * 0.08 - 0.06;
        else if (part.name === "illia-sword" && phase === 2) part.rotation.z = -0.6 + Math.sin(t * 2.6) * 0.1;
      }
    }
  }
}

// ── 컷씬 시퀀서(각성 awaken / 해방 unseal, 각 ~10초, 스킵 가능) ────────────────
export interface IlliaCutsceneContext {
  scene: THREE.Scene;
  now(): number;
  setCamera(x: number, y: number, z: number, lookX: number, lookY: number, lookZ: number): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
  groundBurst(x: number, z: number): void;
  onFinish(): void;
}

export interface IlliaCutsceneState {
  active: boolean;
  kind: "awaken" | "unseal";
  startedAt: number;
  props: THREE.Object3D[]; // 컷씬 전용 소품(봉인석 등) — 종료 시 제거
  firedSteps: number; // 원샷 스텝 진행 인덱스
}

export const ILLIA_CUTSCENE_MS = 10_000;

export function createIlliaCutsceneState(): IlliaCutsceneState {
  return { active: false, kind: "awaken", startedAt: 0, props: [], firedSteps: 0 };
}

export function startIlliaCutscene(state: IlliaCutsceneState, kind: "awaken" | "unseal", now: number, props: THREE.Object3D[]): void {
  state.active = true;
  state.kind = kind;
  state.startedAt = now;
  state.props = props;
  state.firedSteps = 0;
}

export function finishIlliaCutscene(state: IlliaCutsceneState, ctx: IlliaCutsceneContext): void {
  if (!state.active) return;
  state.active = false;
  for (const prop of state.props) ctx.scene.remove(prop);
  state.props = [];
  ctx.onFinish();
}

// 매 프레임 — 카메라 연출 + 소품 타임라인. t(초) 기반 연속 파라미터 + 원샷 스텝.
export function updateIlliaCutscene(state: IlliaCutsceneState, ctx: IlliaCutsceneContext): void {
  if (!state.active) return;
  const t = (ctx.now() - state.startedAt) / 1000;
  const cz = ARENA_CENTER_Z;
  if (t >= ILLIA_CUTSCENE_MS / 1000) { finishIlliaCutscene(state, ctx); return; }

  if (state.kind === "awaken") {
    // 카메라: 남쪽 원경 → 봉인석 근접 저각 → 파열 순간 뒤로 밀림 → 보스 로우앵글
    if (t < 6) {
      const k = t / 6;
      ctx.setCamera(0, 3.4 - k * 1.2, cz + 14 - k * 8.5, 0, 2.4, cz);
    } else if (t < 7) {
      const k = (t - 6);
      ctx.setCamera(THREE.MathUtils.randFloatSpread(0.24), 2.2 + k * 0.4, cz + 5.5 + k * 2.4, 0, 2.4, cz); // 파열 반동+흔들림
    } else {
      const k = (t - 7) / 3;
      ctx.setCamera(Math.sin(k * 0.9) * 3.2, 1.2 + k * 1.4, cz + 6.4 - k * 1.2, 0, 1.8, cz);
    }
    // 봉인석 소품 애니: 크랙 진행(1.5s~6s), 진동, 6s 파열
    for (const prop of state.props) {
      const crystal = prop.getObjectByName("seal-crystal");
      if (!crystal) continue;
      if (t > 1.2 && t < 6) crystal.position.x = Math.sin(t * 34) * 0.03 * (t / 6);
      for (const child of prop.children) {
        if (child.userData.sealCrack) (child as THREE.Mesh & { material: THREE.MeshBasicMaterial }).material.opacity = Math.min(1, Math.max(0, (t - 1.5) / 4.5));
        if (t >= 6 && (child.userData.sealCrack || child.userData.sealChain)) child.visible = false;
      }
      if (t >= 6) { crystal.visible = false; prop.visible = t < 6.05 ? prop.visible : true; }
    }
    if (state.firedSteps === 0 && t >= 1.5) { state.firedSteps = 1; ctx.playTone(55, 1.2, "sawtooth", 0.05); }
    if (state.firedSteps === 1 && t >= 3.5) { state.firedSteps = 2; ctx.playTone(48, 1.4, "sawtooth", 0.06); }
    if (state.firedSteps === 2 && t >= 6) { state.firedSteps = 3; ctx.groundBurst(0, cz); ctx.playTone(38, 1.8, "sawtooth", 0.09); ctx.playTone(660, 0.5, "triangle", 0.05); }
    if (state.firedSteps === 3 && t >= 7.2) { state.firedSteps = 4; ctx.playTone(220, 1.2, "sine", 0.05); }
  } else {
    // 해방(unseal): 사슬이 하나씩 끊기고 → 날개 펼침 → 카메라 풀백
    if (t < 5.5) {
      const k = t / 5.5;
      ctx.setCamera(Math.sin(k * 1.6) * 4.5, 1.6 + k * 0.8, cz + 7.5 - k * 1.5, 0, 1.9, cz);
    } else {
      const k = (t - 5.5) / 4.5;
      ctx.setCamera(Math.sin(k * 0.6) * 2, 2.2 + k * 2.6, cz + 6 + k * 7, 0, 2.2 + k * 0.8, cz);
    }
    for (const prop of state.props) {
      let chainIndex = 0;
      for (const child of prop.children) {
        if (!child.userData.illiaChain) continue;
        const breakAt = 1.2 + chainIndex * 1.05;
        chainIndex += 1;
        if (t >= breakAt && child.visible) { child.visible = false; ctx.groundBurst(child.position.x, cz + child.position.z); ctx.playTone(900 - chainIndex * 120, 0.3, "square", 0.05); }
      }
      animateIlliaBody(prop, t * (t > 6 ? 2.2 : 1), t > 6 ? 2 : 1);
    }
    if (state.firedSteps === 0 && t >= 6) { state.firedSteps = 1; ctx.groundBurst(0, cz); ctx.playTone(140, 1.6, "sawtooth", 0.08); ctx.playTone(880, 0.8, "triangle", 0.06); }
  }
}

// ── 컷씬 오버레이(레터박스 + 타이틀 + 건너뛰기 안내) — DOM 헬퍼(main 라인 절약용 leaf) ──
export function showIlliaCutsceneOverlay(host: HTMLElement, title: string): void {
  hideIlliaCutsceneOverlay(host);
  const overlay = document.createElement("div");
  overlay.className = "illia-cutscene";
  overlay.innerHTML = `<div class="illia-bar top"></div><div class="illia-title">${title}</div><div class="illia-skip">Space / 클릭: 건너뛰기</div><div class="illia-bar bottom"></div>`;
  host.appendChild(overlay);
}
export function hideIlliaCutsceneOverlay(host: HTMLElement): void {
  host.querySelector(".illia-cutscene")?.remove();
}
