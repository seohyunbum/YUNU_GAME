import * as THREE from "three";
import { ARENA_CENTER_Z, ARENA_HALF, ILLIA_CENTER_Z } from "./constants";
import { animateFortressBossModel } from "./fortressBossVisuals";
import { bal } from "./balanceTuning";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { animateCinematicAmbience, animateGateOpening, animateIntroVista, createCinematicAmbience, createIntroVista, resetGateVisual } from "./illiaVisuals";
import { animateTelegraphMeshes, disposeTelegraphGroup, telegraphBurstPoint, telegraphContains, telegraphMesh, type TelegraphSpec } from "./telegraph";
import type { WorldObject } from "./types";

// 판정 기하는 telegraph 리프로 이관됨 — 골든 테스트(illia-test)가 illia.telegraphContains 로 참조하므로 재노출 유지.
export { telegraphContains } from "./telegraph";

// 최종 보스 '일리아' 전투 엔진 — 텔레그래프(사전 표시 붉은 영역) 기반 패턴 보스. leaf(main.ts import 금지).
// P1(봉인된 군주): 중앙 고정(사슬) + 조준/기하 패턴 6종(졸개 소환 포함).
// P2(절망의 군주): 이동 해금 — 돌진·비행 투척·연쇄 참격 등 완전히 다른 패턴 5종.
// 피격 = 최대체력 비율(기본 50%, 튜너블 illia_hit_pct) — 패턴을 익혀 컨트롤로 회피하는 설계.
// 컷씬 2종(각성/해방, 각 ~10초, 스킵 가능) 시퀀서 포함. 설계: docs/illia-final-boss.md

export const ILLIA_P1_KIND = "illia_sealed";
export const ILLIA_P2_KIND = "illia_desperate";
export const ILLIA_ARENA_CENTER = { x: 0, z: ILLIA_CENTER_Z };
export const ILLIA_ARENA_RADIUS = 16; // 원형 결계 반경(몬스터 요새 아레나 폭 수준) — 밖으로 빠지는 원거리 카이팅 차단. 인테리어 결계벽(16.6)과 짝
// 전투 중 매 프레임 플레이어를 결계 안으로 — updateMovement 직후 1프레임 초과분(~0.1)만 되밀어 부드럽다.
export function clampToIlliaArena(position: THREE.Vector3): void {
  const dx = position.x - ILLIA_ARENA_CENTER.x;
  const dz = position.z - ILLIA_ARENA_CENTER.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= ILLIA_ARENA_RADIUS) return;
  const scale = ILLIA_ARENA_RADIUS / dist;
  position.x = ILLIA_ARENA_CENTER.x + dx * scale;
  position.z = ILLIA_ARENA_CENTER.z + dz * scale;
}
export const ILLIA_ENTRY_POS = { x: 0, z: ILLIA_CENTER_Z + ARENA_HALF - 3 }; // 아레나 남쪽 입구(사망 부활 지점)

// ── 텔레그래프 ── (엔진은 telegraph 리프로 이관 — 여기선 일리아 전용 런타임 래퍼 + 폭발 빛기둥만)
interface Telegraph {
  spec: TelegraphSpec;
  detonateAt: number;
  group: THREE.Group;
  fill: THREE.Mesh;
  edge: THREE.Mesh | null;
  shrink: THREE.Mesh | null; // 바깥에서 영역 경계로 수축하는 경고 링 — 남은 시간을 직관적으로 보여준다
  wall: THREE.Mesh | null; // 바닥에서 솟는 수직 경고 벽 — 근접·1인칭 시야에서도 범위·시전 인지
}

const PILLAR_GEOMETRY = new THREE.CylinderGeometry(1, 1.3, 1, 12, 1, true); // 폭발 빛기둥(단위 — per-burst 스케일)
const pillarMaterialBase = new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

// 폭발 빛기둥 — 형태별 스케일로 영역 위에 수직 섬광 기둥을 세운다(수명 0.45s, update 가 소멸 관리).
function spawnDetonationPillar(state: IlliaFightState, ctx: IlliaContext, spec: TelegraphSpec): void {
  const pillar = new THREE.Mesh(PILLAR_GEOMETRY, pillarMaterialBase.clone());
  const p = telegraphBurstPoint(spec);
  if (spec.kind === "line") {
    pillar.scale.set(spec.width * 0.55, 8, spec.len * 0.5);
    pillar.rotation.y = Math.atan2(spec.dirX, spec.dirZ);
  } else if (spec.kind === "ring") {
    pillar.scale.set(spec.r * 0.92, 7, spec.r * 0.92); // 링은 바깥 반경 크기의 원통 셸(open-ended라 껍데기만 빛남)
  } else {
    pillar.scale.set((spec.kind === "cone" ? spec.r * 0.4 : spec.r * 0.7), 8, (spec.kind === "cone" ? spec.r * 0.4 : spec.r * 0.7));
  }
  pillar.position.set(p.x, 4, p.z);
  ctx.scene.add(pillar);
  state.bursts.push({ mesh: pillar, bornAt: ctx.now() });
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
  bursts: { mesh: THREE.Mesh; bornAt: number }[]; // 폭발 빛기둥(수명 0.45s) — update 소멸·reset 청소
  animT: number;
}

export function createIlliaFightState(): IlliaFightState {
  return { active: false, phase: 1, lastNow: 0, nextPatternAt: 0, patternCursor: 0, telegraphs: [], pending: [], minionIds: [], move: null, bursts: [], animT: 0 };
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
  for (const telegraph of state.telegraphs) { scene.remove(telegraph.group); disposeTelegraphGroup(telegraph.group); }
  for (const burst of state.bursts) { scene.remove(burst.mesh); (burst.mesh.material as THREE.Material).dispose(); }
  state.bursts.length = 0;
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

function addTelegraph(state: IlliaFightState, ctx: IlliaContext, spec: TelegraphSpec): void {
  const { group, fill, edge, shrink, wall } = telegraphMesh(spec);
  ctx.scene.add(group);
  state.telegraphs.push({ spec, detonateAt: ctx.now() + spec.delayMs, group, fill, edge, shrink, wall });
}

function clampArena(v: number, margin = 1.5): number {
  return Math.max(-ARENA_HALF + margin, Math.min(ARENA_HALF - margin, v));
}
function clampArenaZ(z: number, margin = 1.5): number {
  return Math.max(ILLIA_CENTER_Z - ARENA_HALF + margin, Math.min(ILLIA_CENTER_Z + ARENA_HALF - margin, z));
}

let illiaTelegraphDifficultyMul = 1; // 난이도별 예고 시간 배율(어려움<1 → 반응시간 짧음). main 이 스폰 시 difficultyMods.bossTelegraph 로 설정.
export function setIlliaTelegraphDifficultyMul(mul: number): void { illiaTelegraphDifficultyMul = Number.isFinite(mul) && mul > 0 ? mul : 1; }
const telegraphMsScale = () => bal("illia_telegraph_scale", 1) * illiaTelegraphDifficultyMul; // 관리자 배율 × 난이도 배율(높을수록 쉬움)
// 결계 원판 내부 균등 랜덤 지점(sqrt 로 면적 균등) — 사각 스프레드는 모서리가 결계 밖이라 낭비된다.
function randomArenaPoint(maxR: number): { x: number; z: number } {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * maxR;
  return { x: ILLIA_ARENA_CENTER.x + Math.cos(a) * r, z: ILLIA_ARENA_CENTER.z + Math.sin(a) * r };
}
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
    addTelegraph(state, ctx, { kind: "ring", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, inner: 3.6, r: 13.5, delayMs: T(1800) }); // 결계 16 기준 — 안전지대는 보스 발밑(<3.6) 또는 결계 가장자리 띠(13.5~16)뿐
    return 4400;
  },
  (state, ctx) => { // 어둠의 부채 — 플레이어 방향 부채꼴 2연속(살짝 각도 보정)
    ctx.showMessage("⚠ 어둠의 참격 — 옆으로 피하세요!");
    const c = ILLIA_ARENA_CENTER;
    const angleTo = () => Math.atan2(ctx.playerPosition.x - c.x, ctx.playerPosition.z - c.z);
    addTelegraph(state, ctx, { kind: "cone", x: c.x, z: c.z, angle: angleTo(), arc: Math.PI / 2.1, r: 17, delayMs: T(1400) }); // 결계 끝까지 — 뒤로 빠져도 못 피함, 옆으로만
    state.pending.push({ at: ctx.now() + 1500, run: () => addTelegraph(state, ctx, { kind: "cone", x: c.x, z: c.z, angle: angleTo(), arc: Math.PI / 2.6, r: 17, delayMs: T(1200) }) });
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
      state.pending.push({ at: ctx.now() + i * 340, run: () => { const p = randomArenaPoint(ILLIA_ARENA_RADIUS - 0.5); addTelegraph(state, ctx, { kind: "circle", x: p.x, z: p.z, r: 2.6, delayMs: T(1250) }); } }); // 결계 원판 균등 낙하(모서리 낭비 제거)
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
      addTelegraph(state, ctx, { kind: "line", x: b.root.position.x, z: b.root.position.z, dirX: dx / d, dirZ: dz / d, len, width: 3.8, delayMs: T(1050) });
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
    addTelegraph(state, ctx, { kind: "circle", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, r: 11, delayMs: T(2300) });
    state.pending.push({ at: ctx.now() + T(2300) + 500, run: () => { startMove(state, ctx, ILLIA_ARENA_CENTER.x, ILLIA_ARENA_CENTER.z, 250, false); addTelegraph(state, ctx, { kind: "ring", x: ILLIA_ARENA_CENTER.x, z: ILLIA_ARENA_CENTER.z, inner: 10.8, r: 16.4, delayMs: T(1000) }); } }); // 후속 링이 결계 끝까지 — 가장자리 대피 후 반드시 안쪽으로 되돌아와야(인-아웃)
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
  clampToIlliaArena(ctx.playerPosition); // 원형 결계 — 뒤로 빠지는 원거리 카이팅 차단(1프레임 초과분만 되밀기)
  const boss = ctx.boss();
  state.animT += delta;

  // 폭발 빛기둥 소멸(0.45s: 위로 뻗으며 사라짐)
  for (let i = state.bursts.length - 1; i >= 0; i -= 1) {
    const burst = state.bursts[i];
    const age = (now - burst.bornAt) / 450;
    if (age >= 1) {
      ctx.scene.remove(burst.mesh);
      (burst.mesh.material as THREE.Material).dispose();
      state.bursts.splice(i, 1);
      continue;
    }
    (burst.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - age);
    burst.mesh.scale.y = 8 * (0.5 + age * 0.9);
  }

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
      animateTelegraphMeshes(telegraph.fill, telegraph.edge, telegraph.shrink, telegraph.wall, telegraph.spec, remain, now); // 공용 펄스(핏빛→진홍·스트로브·수축링·솟는 경고벽)
      continue;
    }
    state.telegraphs.splice(i, 1);
    exploded.push(telegraph);
  }
  if (exploded.length > 0) { ctx.playTone(42, 0.42, "sawtooth", 0.085); ctx.playTone(300, 0.1, "square", 0.05); } // 볼리당 1회 저역 폭음(다발 스팸 방지)
  for (const telegraph of exploded) {
    ctx.scene.remove(telegraph.group);
    disposeTelegraphGroup(telegraph.group);
    const burstAt = telegraphBurstPoint(telegraph.spec);
    ctx.groundBurst(burstAt.x, burstAt.z);
    spawnDetonationPillar(state, ctx, telegraph.spec);
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

export type IlliaCutsceneKind = "awaken" | "unseal" | "gateOpen" | "intro" | "fortressBoss";

// 부팅 인트로 컷씬의 마을 포커스(타이틀 배경 카메라 focus 와 동일 정본 — main 이 이 값을 titleFocus 초기값으로 사용).
export const INTRO_FOCUS = { x: 58, y: 2.8, z: -76 };

export interface IlliaCutsceneState {
  active: boolean;
  kind: IlliaCutsceneKind;
  startedAt: number;
  props: THREE.Object3D[]; // 컷씬 전용 소품(봉인석 등) — 종료 시 제거
  anchor: THREE.Object3D | null; // 월드 소유 오브젝트 참조(gateOpen 의 차원의 문) — 종료 시 제거하지 않고 원상복구만
  ambience: THREE.Object3D | null; // 시네마틱 앰비언스(엠버·갓레이) — props 에도 등록돼 종료/수동정리 시 자동 제거
  vista: THREE.Object3D | null; // 인트로 전용 원경 세트(산맥·태양·독수리) — props 에도 등록돼 자동 제거
  themeColor: number; // 앰비언스/연출 톤(fortressBoss 트레일러가 보스 컨셉 색으로 지정, 기본 심홍)
  firedSteps: number; // 원샷 스텝 진행 인덱스
}

export const ILLIA_CUTSCENE_MS = 10_000;
export const FORTRESS_TRAILER_MS = 8_000; // 요새 보스 등장 트레일러 — 5단계마다라 일리아보다 짧게

export function cutsceneDurationMs(kind: IlliaCutsceneKind): number {
  return kind === "fortressBoss" ? FORTRESS_TRAILER_MS : ILLIA_CUTSCENE_MS;
}

export function createIlliaCutsceneState(): IlliaCutsceneState {
  return { active: false, kind: "awaken", startedAt: 0, props: [], anchor: null, ambience: null, vista: null, themeColor: 0xff2d55, firedSteps: 0 };
}

export function startIlliaCutscene(state: IlliaCutsceneState, kind: IlliaCutsceneKind, now: number, props: THREE.Object3D[], anchor: THREE.Object3D | null = null, themeColor = 0xff2d55): void {
  state.active = true;
  state.kind = kind;
  state.startedAt = now;
  state.props = props;
  state.anchor = anchor;
  state.ambience = null;
  state.vista = null;
  state.themeColor = themeColor;
  state.firedSteps = 0;
}

export function finishIlliaCutscene(state: IlliaCutsceneState, ctx: IlliaCutsceneContext): void {
  if (!state.active) return;
  state.active = false;
  for (const prop of state.props) ctx.scene.remove(prop);
  state.props = [];
  state.ambience = null; // 씬 제거는 props 경유(위)로 이미 처리
  state.vista = null; // 동일 — props 경유 제거. 안개/하늘 오버라이드는 다음 프레임 updateTimeOfDay 가 자동 복원
  if (state.anchor) { resetGateVisual(state.anchor); state.anchor = null; } // 게이트는 월드 소유 — 씬에서 빼지 않고 평시 상태로만 복귀
  ctx.onFinish();
}

// 시네마틱 카메라 이징(smoothstep) — 선형 돌리의 기계적 느낌을 죽이고 묵직한 푸시인으로.
const easeCine = (k: number) => k * k * (3 - 2 * k);

// 매 프레임 — 카메라 연출 + 소품 타임라인. t(초) 기반 연속 파라미터 + 원샷 스텝.
// 컷씬 화면 진동 오프셋 — 고주파 사인 합성(결정적, 프레임레이트 무관 부드러움)
function cutsceneShake(t: number, amplitude: number): { x: number; y: number } {
  return { x: (Math.sin(t * 47.3) + Math.sin(t * 31.7) * 0.5) * amplitude, y: (Math.cos(t * 38.7) + Math.cos(t * 52.1) * 0.5) * amplitude * 0.6 };
}

// 컷씬 섬광 — 오버레이 내 .illia-flash 재생(CSS 애니). node(SSR 테스트)에서는 no-op.
function flashCutsceneScreen(): void {
  if (typeof document === "undefined") return;
  const flash = document.querySelector(".illia-cutscene .illia-flash") as HTMLElement | null;
  if (!flash) return;
  flash.classList.remove("on");
  void flash.offsetWidth; // reflow 로 애니 재시작
  flash.classList.add("on");
}

export function updateIlliaCutscene(state: IlliaCutsceneState, ctx: IlliaCutsceneContext): void {
  if (!state.active) return;
  const t = (ctx.now() - state.startedAt) / 1000;
  const cz = ILLIA_CENTER_Z;
  if (t >= cutsceneDurationMs(state.kind) / 1000) { finishIlliaCutscene(state, ctx); return; }

  // 시네마틱 앰비언스(부유 엠버 + 갓레이) — 1회 생성 후 props 에 등록(종료/수동정리 시 자동 제거), 매 프레임 무할당 애니.
  if (!state.ambience) {
    const amb = createCinematicAmbience(state.kind === "gateOpen" ? 0x8b5cf6 : state.kind === "intro" ? 0xffdf9e : state.themeColor); // 인트로=아침 햇살 금빛, 요새 보스=컨셉 색
    if (state.kind === "gateOpen" && state.anchor) amb.position.set(state.anchor.position.x, 0, state.anchor.position.z);
    else if (state.kind === "intro") amb.position.set(INTRO_FOCUS.x, 0, INTRO_FOCUS.z);
    else if (state.kind === "fortressBoss") amb.position.set(0, 0, ARENA_CENTER_Z);
    else amb.position.set(0, 0, cz);
    ctx.scene.add(amb);
    state.props.push(amb);
    state.ambience = amb;
  }
  animateCinematicAmbience(state.ambience, t);

  if (state.kind === "fortressBoss") {
    // 요새 보스 등장 트레일러(8s) — 소품 props[0] = 보스 모델(아레나 중앙). 3박자: 로우 정면 푸시인 → 반원 아크 → 로우앵글 위용+포효.
    const bz = ARENA_CENTER_Z;
    const boss = state.props[0];
    if (boss) animateFortressBossModel(boss, t);
    const amplitude = t < 5.2 ? 0.03 : t < 6.2 ? 0.55 * (1 - (t - 5.2) * 0.8) : 0.05; // 포효(5.2s) 진동
    const shake = cutsceneShake(t, amplitude);
    if (t < 3.2) {
      const k = easeCine(t / 3.2);
      ctx.setCamera(shake.x, 5.5 - k * 3.6, bz + 15 - k * 6.5, 0, 2.6, bz); // 하이앵글 원경 → 정면 푸시인
    } else if (t < 5.2) {
      const k = easeCine((t - 3.2) / 2);
      const a = 0.6 + k * 1.9;
      ctx.setCamera(Math.sin(a) * 7.5 + shake.x, 1.9 + k * 0.6, bz + Math.cos(a) * 7.5, 0, 2.8, bz); // 반원 아크(무기·실루엣 훑기)
    } else {
      const k = easeCine((t - 5.2) / 2.8);
      ctx.setCamera(shake.x, 1.2 + k * 2.2, bz + 5.6 + k * 5.4, 0, 3.0 - k * 0.4, bz); // 포효 로우앵글 → 풀백(전투 준비)
    }
    if (state.firedSteps === 0 && t >= 0.8) { state.firedSteps = 1; ctx.playTone(55, 1.4, "sawtooth", 0.06); } // 저역 혼(전조)
    if (state.firedSteps === 1 && t >= 3.2) { state.firedSteps = 2; ctx.playTone(48, 1.2, "sawtooth", 0.05); ctx.playTone(660, 0.25, "triangle", 0.03); }
    if (state.firedSteps === 2 && t >= 5.2) { state.firedSteps = 3; flashCutsceneScreen(); ctx.groundBurst(0, bz); ctx.groundBurst(-2, bz + 1.5); ctx.groundBurst(2, bz - 1.5); ctx.playTone(40, 1.6, "sawtooth", 0.1); ctx.playTone(90, 0.8, "square", 0.06); } // 포효 — 섬광+충격파
    return;
  }

  if (state.kind === "intro") {
    // 부팅 인트로(AAA 시네마틱 오프닝) — 셰이크 없음. 3막: ① 역광 태양·산맥 원경을 응시하는 하이 에어리얼 푸시인
    // ② (컷) 마을을 스치는 로우 스윕 + 갓레이 ③ (컷) 상승 크레인 — 시선을 태양 지평선 너머로(모험 기대).
    const fx = INTRO_FOCUS.x, fz = INTRO_FOCUS.z;
    if (!state.vista) {
      const vista = createIntroVista();
      vista.position.set(fx, 0, fz);
      ctx.scene.add(vista);
      state.props.push(vista);
      state.vista = vista;
      // 하늘 돔은 인트로 동안 숨긴다(새벽 그레이딩과 충돌하는 한낮 산란 하늘) — updateTimeOfDay 가 매 프레임
      // visible 을 되켜므로 참조를 잡아 매 프레임 다시 끈다. 종료 후엔 자동 복원(별도 정리 불필요).
      for (const child of ctx.scene.children) if (child instanceof Sky) { vista.userData.skyRef = child; break; }
    }
    animateIntroVista(state.vista, t);
    const skyDome = state.vista.userData.skyRef as THREE.Object3D | undefined;
    if (skyDome) skyDome.visible = false;
    // 시네마틱 안개/하늘 오버라이드(무할당 — 숫자·색 대입만): 새벽 금빛 헤이즈 + 원경 산맥이 겹겹이 잠기도록 far 확장.
    // updateTimeOfDay 가 매 프레임 먼저 돌므로 컷씬 값이 이기고, 종료/스킵 후 다음 프레임에 평시로 자동 복원된다.
    if (ctx.scene.fog instanceof THREE.Fog) {
      ctx.scene.fog.color.setHex(0xe9b98e);
      ctx.scene.fog.near = 44;
      ctx.scene.fog.far = 560;
    }
    if (ctx.scene.background instanceof THREE.Color) ctx.scene.background.setHex(0xf2c48b); // 역광 하늘 — 지평선 금빛(안개색과 한 톤)
    if (t < 4.5) {
      // 1막 — 레퍼런스 구도: 상공에서 태양(-190,96,+350 로컬)과 산맥 레이어를 응시하며 느리게 전진 하강.
      const k = easeCine(t / 4.5);
      ctx.setCamera(fx + 42 - k * 12, 26 - k * 7, fz - 74 + k * 20, fx - 120 + k * 10, 52 - k * 6, fz + 250);
    } else if (t < 8) {
      // 2막(컷) — 마을을 스치는 낮은 원호 스윕. 금빛 갓레이(앰비언스)가 지붕 사이로 떨어진다.
      const k = easeCine((t - 4.5) / 3.5);
      const a = 2.4 - k * 0.9;
      ctx.setCamera(fx + Math.sin(a) * (26 - k * 8), 8.5 - k * 4.2, fz + Math.cos(a) * (26 - k * 8), fx, 2.6 + k * 0.8, fz);
    } else {
      // 3막(컷) — 마을 뒤에서 상승 크레인, 시선은 태양 지평선으로 들어올린다.
      const k = easeCine((t - 8) / 2);
      ctx.setCamera(fx + 10 - k * 6, 5 + k * 15, fz - 28 - k * 8, fx - 40 - k * 90, 20 + k * 42, fz + 120 + k * 160);
    }
    if (state.firedSteps === 0 && t >= 1.2) { state.firedSteps = 1; ctx.playTone(523.25, 0.9, "sine", 0.028); ctx.playTone(659.25, 1.2, "sine", 0.02); } // 따뜻한 차임(제스처 전이면 무음)
    if (state.firedSteps === 1 && t >= 6) { state.firedSteps = 2; ctx.playTone(783.99, 1.1, "sine", 0.026); ctx.playTone(987.77, 1.4, "sine", 0.018); }
    return;
  }

  if (state.kind === "awaken") {
    // 진동: 균열 진행(1.2s~)과 함께 점증 → 파열(6s) 대폭발 → 등장부 잔진동
    const amplitude = t < 1.2 ? 0 : t < 6 ? 0.04 + ((t - 1.2) / 4.8) * 0.3 : t < 7 ? 0.95 * (1 - (t - 6) * 0.72) : 0.1;
    const shake = cutsceneShake(t, amplitude);
    // 카메라: 남쪽 원경 → 봉인석 근접 저각 → 파열 순간 뒤로 밀림 → 보스 로우앵글
    if (t < 6) {
      const k = easeCine(t / 6); // 묵직한 시네마틱 푸시인(가속→감속)
      ctx.setCamera(shake.x, 3.4 - k * 1.4 + shake.y, cz + 14 - k * 9.6, 0, 2.4, cz); // 봉인석 코앞(cz+4.4)까지 줌인 — 균열 발광 클로즈업
    } else if (t < 7) {
      const k = (t - 6);
      ctx.setCamera(shake.x, 2.2 + k * 0.4 + shake.y, cz + 5.5 + k * 2.4, 0, 2.4, cz); // 파열 반동+대진동
    } else {
      const k = (t - 7) / 3;
      ctx.setCamera(Math.sin(k * 0.9) * 3.2 + shake.x, 1.2 + k * 1.4 + shake.y, cz + 6.4 - k * 1.2, 0, 1.8, cz);
    }
    // 봉인석: 크랙 발광 진행(1.5~6s, 맥동) + 내부 광원 점증 + 광선 성장 → 6s 파열(파편 비산·섬광)
    const crackRamp = Math.min(1, Math.max(0, (t - 1.5) / 4.5));
    for (const prop of state.props) {
      const crystal = prop.getObjectByName("seal-crystal");
      if (!crystal) continue;
      if (t > 1.2 && t < 6) crystal.position.x = Math.sin(t * 34) * 0.05 * (t / 6);
      const sealLight = prop.getObjectByName("seal-light") as THREE.PointLight | null;
      if (sealLight) sealLight.intensity = t < 6 ? crackRamp * crackRamp * (1.6 + Math.sin(t * 9) * 0.6) : Math.max(0, 9 * (1 - (t - 6) * 1.6)); // 균열 새어나오는 빛 → 파열 섬광(크리스탈 실루엣이 빛에 묻히지 않게 절제)
      const crystalMaterial = (crystal as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (crystalMaterial?.emissive) crystalMaterial.emissiveIntensity = 0.35 + crackRamp * 1.9; // 내부에서 차오르는 발광 — 형체는 유지
      for (const child of prop.children) {
        if (child.userData.sealCrack) (child as THREE.Mesh & { material: THREE.MeshBasicMaterial }).material.opacity = crackRamp * (0.75 + Math.sin(t * 8 + child.position.y * 3) * 0.25); // 균열 맥동 발광
        if (child.userData.sealRay) { // 균열에서 새어나오는 광선 — 성장 후 파열과 함께 소멸
          const ray = child as THREE.Mesh & { material: THREE.MeshBasicMaterial };
          ray.material.opacity = t < 6 ? Math.max(0, (t - 2.2) / 3.8) * 0.55 : 0;
          ray.scale.y = 0.5 + crackRamp * 1.4;
          ray.rotation.y += 0.003;
        }
        if (child.userData.sealShard) { // 파열 파편 — 방사 비산 + 낙하 + 회전
          const shard = child;
          const throwInfo = shard.userData.sealShard as { dx: number; dy: number; dz: number; spin: number; homeX: number; homeY: number; homeZ: number };
          if (t >= 6 && t < 7.8) {
            shard.visible = true;
            const dt = t - 6;
            shard.position.set(throwInfo.homeX + throwInfo.dx * dt * 7, Math.max(0.1, throwInfo.homeY + throwInfo.dy * dt * 5 - 6 * dt * dt), throwInfo.homeZ + throwInfo.dz * dt * 7);
            shard.rotation.x += throwInfo.spin * 0.15;
            shard.rotation.z += throwInfo.spin * 0.11;
          } else if (t >= 7.8) shard.visible = false;
        }
        if (t >= 6 && (child.userData.sealCrack || child.userData.sealChain)) child.visible = false;
      }
      if (t >= 6) crystal.visible = false;
    }
    if (state.firedSteps === 0 && t >= 1.5) { state.firedSteps = 1; ctx.playTone(55, 1.2, "sawtooth", 0.05); }
    if (state.firedSteps === 1 && t >= 3.5) { state.firedSteps = 2; ctx.playTone(48, 1.4, "sawtooth", 0.06); ctx.playTone(1200, 0.15, "sine", 0.03); }
    if (state.firedSteps === 2 && t >= 6) { state.firedSteps = 3; flashCutsceneScreen(); ctx.groundBurst(0, cz); ctx.groundBurst(-2.5, cz + 1.5); ctx.groundBurst(2.5, cz - 1.5); ctx.playTone(38, 1.8, "sawtooth", 0.1); ctx.playTone(660, 0.5, "triangle", 0.05); ctx.playTone(90, 0.9, "square", 0.06); }
    if (state.firedSteps === 3 && t >= 7.2) { state.firedSteps = 4; ctx.playTone(220, 1.2, "sine", 0.05); }
  } else if (state.kind === "gateOpen") {
    // 개방(gateOpen): 불멸의 존재 처치 직후 — 지반 융기 → 부유석 수렴·링 형성 → 6s 점화(섬광·충격파) → 로우앵글 위용 → 풀백. anchor = 월드의 차원의 문.
    const gate = state.anchor;
    if (!gate) { finishIlliaCutscene(state, ctx); return; }
    const gx = gate.position.x, gz = gate.position.z;
    const amplitude = t < 1 ? 0 : t < 6 ? 0.03 + ((t - 1) / 5) * 0.22 : t < 7 ? 0.8 * (1 - (t - 6) * 0.75) : 0.06;
    const shake = cutsceneShake(t, amplitude);
    if (t < 6) {
      const k = easeCine(t / 6); const ang = 2.6 - k * 1.1; const r = 16 - k * 9.5;
      ctx.setCamera(gx + Math.sin(ang) * r + shake.x, 7.5 - k * 5.3 + shake.y, gz + Math.cos(ang) * r, gx, 2.2, gz); // 하이앵글 원경 → 반원 아크로 시네마틱 접근(easeCine)
    } else if (t < 7) {
      const k = t - 6;
      ctx.setCamera(gx + shake.x, 2.0 + k * 0.3 + shake.y, gz + 6.5 + k * 2.2, gx, 2.4, gz); // 점화 반동 — 뒤로 밀림
    } else {
      const k = (t - 7) / 3;
      ctx.setCamera(gx + Math.sin(k * 1.1) * 4 + shake.x, 1.1 + k * 3.2 + shake.y, gz + 5.2 + k * 4.5, gx, 2.4 + k * 0.6, gz); // 로우앵글 올려보기 → 상승 풀백
    }
    animateGateOpening(gate, t);
    if (state.firedSteps === 0 && t >= 1) { state.firedSteps = 1; ctx.playTone(50, 1.6, "sawtooth", 0.06); }
    if (state.firedSteps === 1 && t >= 3.2) { state.firedSteps = 2; ctx.playTone(65, 1.4, "sawtooth", 0.06); ctx.playTone(980, 0.3, "sine", 0.03); }
    if (state.firedSteps === 2 && t >= 6) { state.firedSteps = 3; flashCutsceneScreen(); ctx.groundBurst(gx, gz); ctx.groundBurst(gx - 2.2, gz + 1.6); ctx.groundBurst(gx + 2.2, gz - 1.6); ctx.playTone(36, 2, "sawtooth", 0.1); ctx.playTone(720, 0.6, "triangle", 0.05); ctx.playTone(110, 1, "square", 0.06); }
    if (state.firedSteps === 3 && t >= 7.5) { state.firedSteps = 4; ctx.playTone(520, 1.2, "sine", 0.04); ctx.playTone(780, 1.2, "sine", 0.03); }
  } else {
    // 해방(unseal): 사슬이 하나씩 끊기고 → 날개 펼침 → 카메라 풀백. 진동 = 사슬 파단마다 펄스 + 각성(6s) 대진동
    let amplitude = 0.05;
    for (let chain = 0; chain < 4; chain += 1) {
      const breakAt = 1.2 + chain * 1.05;
      if (t >= breakAt && t < breakAt + 0.45) amplitude = Math.max(amplitude, 0.6 * (1 - (t - breakAt) / 0.45));
    }
    if (t >= 6 && t < 7) amplitude = Math.max(amplitude, 0.9 * (1 - (t - 6)));
    const shake = cutsceneShake(t, amplitude);
    if (t < 5.5) {
      const k = t / 5.5;
      ctx.setCamera(Math.sin(k * 1.6) * 4.5 + shake.x, 1.6 + k * 0.8 + shake.y, cz + 7.5 - k * 1.5, 0, 1.9, cz);
    } else {
      const k = (t - 5.5) / 4.5;
      ctx.setCamera(Math.sin(k * 0.6) * 2 + shake.x, 2.2 + k * 2.6 + shake.y, cz + 6 + k * 7, 0, 2.2 + k * 0.8, cz);
    }
    for (const prop of state.props) {
      let chainIndex = 0;
      for (const child of prop.children) {
        if (!child.userData.illiaChain) continue;
        const breakAt = 1.2 + chainIndex * 1.05;
        chainIndex += 1;
        if (t >= breakAt && child.visible) { child.visible = false; flashCutsceneScreen(); ctx.groundBurst(child.position.x, cz + child.position.z); ctx.playTone(900 - chainIndex * 120, 0.3, "square", 0.05); ctx.playTone(60, 0.5, "sawtooth", 0.06); }
      }
      animateIlliaBody(prop, t * (t > 6 ? 2.2 : 1), t > 6 ? 2 : 1);
    }
    if (state.firedSteps === 0 && t >= 6) { state.firedSteps = 1; flashCutsceneScreen(); ctx.groundBurst(0, cz); ctx.groundBurst(-2, cz + 2); ctx.groundBurst(2, cz - 2); ctx.playTone(140, 1.6, "sawtooth", 0.08); ctx.playTone(880, 0.8, "triangle", 0.06); ctx.playTone(45, 1.4, "sawtooth", 0.09); }
  }
}

// ── 컷씬 오버레이(레터박스 + 타이틀 + 건너뛰기 안내) — DOM 헬퍼(main 라인 절약용 leaf) ──
export function showIlliaCutsceneOverlay(host: HTMLElement, title: string, warm = false): void {
  hideIlliaCutsceneOverlay(host);
  const overlay = document.createElement("div");
  overlay.className = warm ? "illia-cutscene intro" : "illia-cutscene"; // warm=인트로(새벽 금빛 그레이딩) — 기본은 핏빛 다크
  // 시네마틱 그레이딩(디아블로풍): 비네트 + 필름 그레인 + 컬러 그레이드 + 세리프 타이틀(장식 디바이더)
  overlay.innerHTML = `<div class="illia-grade"></div><div class="illia-vignette"></div><div class="illia-grain"></div><div class="illia-bar top"></div><div class="illia-flash"></div><div class="illia-title"><span class="illia-title-orn">— ✦ —</span><span class="illia-title-text">${title}</span></div><div class="illia-skip">Space / 클릭: 건너뛰기</div><div class="illia-bar bottom"></div>`;
  host.appendChild(overlay);
  host.classList.add("illia-cinema"); // 시네마 모드 — HUD·패널 숨김(오버레이만 표시), CSS 가 처리
}

// 전투 피격 섬광 — 붉은 비네트가 화면을 덮었다 사라진다(0.55s). main 의 applyPlayerHit 이 호출.
export function flashIlliaHit(host: HTMLElement): void {
  if (typeof document === "undefined") return;
  const flash = document.createElement("div");
  flash.className = "illia-hit-flash";
  host.appendChild(flash);
  window.setTimeout(() => flash.remove(), 600);
}
export function hideIlliaCutsceneOverlay(host: HTMLElement): void {
  host.querySelector(".illia-cutscene")?.remove();
  host.classList.remove("illia-cinema");
}
