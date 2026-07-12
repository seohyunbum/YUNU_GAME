import { ARENA_CENTER_Z, ARENA_HALF } from "./constants";
import { monsterStatsFromLevel } from "./monsters";
import { TELEGRAPH_DAMAGE_MULT, type TelegraphSpec } from "./telegraph";
import type { FortressBossConceptKey } from "./fortressBossVisuals";

// 몬스터 요새 5단계 보스 엔진 — 일리아식 텔레그래프(범위 예고) 패턴 보스. leaf(main.ts import 금지).
// 5·10·15… 단계마다 컨셉이 순환 등장(오크→히드라→오우거→죽음의 기사→어쌔신→대주술사), 능력치는 단계 비례.
// 텔레그래프 판정·데미지는 중앙 필드(telegraph.ts)가 처리 — 여기는 패턴 시전(어떤 spec 을 언제 어디에)만 담당.

export interface FortressBossConcept {
  key: FortressBossConceptKey;
  name: string;
  title: string; // 트레일러 오버레이 타이틀
  color: number; // 트레일러 앰비언스/연출 톤
  hpMul: number; // 동레벨 보스 몬스터 대비 체력 배율(솔로 스테이지 보정)
  atkMul: number; // 텔레그래프 피격 데미지 배율(TELEGRAPH_DAMAGE_MULT 와 별개)
  scale: number; // 모델 스케일
  patterns: ((rt: FortressBossRuntime, ctx: FortressBossPatternContext) => number)[]; // 반환 = 다음 패턴까지 ms
}

export interface FortressBossRuntime {
  bossId: string;
  conceptKey: FortressBossConceptKey;
  level: number;
  attackBase: number; // 패턴 1히트 기본 데미지(피격 시 ×TELEGRAPH_DAMAGE_MULT×atkMul)
  lastNow: number; // 직전 틱 시각 — 패널 일시정지 시 경과분만큼 타이머를 밀기 위한 기준(0=미시작)
  nextPatternAt: number;
  patternCursor: number;
  pending: { at: number; run: () => void }[]; // 다단 패턴 지연 스텝
  animT: number;
}

export interface FortressBossPatternContext {
  now(): number;
  playerX(): number;
  playerZ(): number;
  bossX(): number;
  bossZ(): number;
  spawnBossTelegraph(spec: TelegraphSpec, damage: number, label: string): void; // 중앙 필드에 예고 등록(폭발 판정 포함)
  animateBoss(t: number): void; // 보스 모델 idle 애니(부유·스웨이) — main 이 overlay 참조로 배선
  showMessage(text: string): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
}

const clampX = (v: number) => Math.max(-ARENA_HALF + 1.2, Math.min(ARENA_HALF - 1.2, v));
const clampZ = (z: number) => Math.max(ARENA_CENTER_Z - ARENA_HALF + 1.2, Math.min(ARENA_CENTER_Z + ARENA_HALF - 1.2, z));
const rand = (spread: number) => (Math.random() * 2 - 1) * spread;

// 피격 데미지 산출 — 컨셉 배율 포함(피할 수 있는 대신 아프게 = ×2 는 중앙 필드 규약과 동일 상수 사용).
function hit(rt: FortressBossRuntime, concept: FortressBossConcept): number {
  return Math.round(rt.attackBase * concept.atkMul * TELEGRAPH_DAMAGE_MULT);
}
const angleToPlayer = (ctx: FortressBossPatternContext) => Math.atan2(ctx.playerX() - ctx.bossX(), ctx.playerZ() - ctx.bossZ());

// ── 컨셉 6종 + 전용 패턴(각 3종, 일리아 문법: 원=이탈 / 직선=옆으로 / 부채꼴=등 뒤로 / 링=안-밖) ──
export const FORTRESS_BOSS_CONCEPTS: FortressBossConcept[] = [
  {
    key: "orc_warlord", name: "전쟁군주 카르가쉬", title: "전쟁군주, 카르가쉬", color: 0xff5a1a, hpMul: 4.2, atkMul: 0.95, scale: 1.5,
    patterns: [
      (rt, ctx) => { // 대지 강타 — 플레이어 추적 원 3연속
        ctx.showMessage("⚠ 카르가쉬가 대지를 내리찍습니다 — 붉은 원에서 벗어나세요!");
        for (let i = 0; i < 3; i += 1) rt.pending.push({ at: ctx.now() + i * 650, run: () => ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX()), z: clampZ(ctx.playerZ()), r: 3.4, delayMs: 1350 }, hit(rt, FORTRESS_BOSS_CONCEPTS[0]), "전쟁군주 카르가쉬의 대지 강타") });
        return 5200;
      },
      (rt, ctx) => { // 돌진 격돌 — 보스→플레이어 관통 직선
        ctx.showMessage("⚠ 돌진 격돌 — 경로에서 비키세요!");
        const a = angleToPlayer(ctx);
        ctx.spawnBossTelegraph({ kind: "line", x: ctx.bossX(), z: ctx.bossZ(), dirX: Math.sin(a), dirZ: Math.cos(a), len: ARENA_HALF * 1.7, width: 4.2, delayMs: 1500 }, hit(rt, FORTRESS_BOSS_CONCEPTS[0]), "전쟁군주 카르가쉬의 돌진");
        return 4600;
      },
      (rt, ctx) => { // 전장의 포효 — 보스 중심 충격 링(붙거나 멀리)
        ctx.showMessage("⚠ 전장의 포효 — 바짝 붙거나 멀리 벗어나세요!");
        ctx.spawnBossTelegraph({ kind: "ring", x: ctx.bossX(), z: ctx.bossZ(), inner: 3.2, r: 10.5, delayMs: 1700 }, hit(rt, FORTRESS_BOSS_CONCEPTS[0]), "전쟁군주 카르가쉬의 포효");
        return 5000;
      },
    ],
  },
  {
    key: "hydra", name: "삼두 히드라", title: "심연에서 기어나온, 삼두 히드라", color: 0x3ddc84, hpMul: 4.8, atkMul: 0.9, scale: 1.6,
    patterns: [
      (rt, ctx) => { // 삼두 브레스 — 부채꼴 3갈래 동시(가운데 좁게 좌우 넓게)
        ctx.showMessage("⚠ 세 머리가 숨을 모읍니다 — 부채꼴 사이 틈으로!");
        const a = angleToPlayer(ctx);
        for (const off of [-0.85, 0, 0.85]) ctx.spawnBossTelegraph({ kind: "cone", x: ctx.bossX(), z: ctx.bossZ(), angle: a + off, arc: Math.PI / 5, r: 15, delayMs: 1600 }, hit(rt, FORTRESS_BOSS_CONCEPTS[1]), "삼두 히드라의 브레스");
        return 5400;
      },
      (rt, ctx) => { // 맹독의 비 — 무작위 원 6개 순차
        ctx.showMessage("⚠ 맹독의 비 — 계속 움직이세요!");
        for (let i = 0; i < 6; i += 1) rt.pending.push({ at: ctx.now() + i * 380, run: () => ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX() + rand(6.5)), z: clampZ(ctx.playerZ() + rand(6.5)), r: 2.8, delayMs: 1250 }, hit(rt, FORTRESS_BOSS_CONCEPTS[1]), "삼두 히드라의 맹독") });
        return 5600;
      },
      (rt, ctx) => { // 독무 파동 — 보스 중심 링 2겹 순차 확장
        ctx.showMessage("⚠ 독무가 퍼집니다 — 파동 사이 틈으로!");
        const bx = ctx.bossX(), bz = ctx.bossZ();
        for (let i = 0; i < 2; i += 1) rt.pending.push({ at: ctx.now() + i * 800, run: () => ctx.spawnBossTelegraph({ kind: "ring", x: bx, z: bz, inner: 2.4 + i * 5, r: 7.4 + i * 5, delayMs: 1400 }, hit(rt, FORTRESS_BOSS_CONCEPTS[1]), "삼두 히드라의 독무") });
        return 5200;
      },
    ],
  },
  {
    key: "ogre_boss", name: "파괴왕 오우거", title: "성벽을 부수는 자, 파괴왕 오우거", color: 0xffc14d, hpMul: 5.6, atkMul: 1.1, scale: 1.7,
    patterns: [
      (rt, ctx) => { // 곤봉 내리찍기 — 플레이어 위치 대형 원
        ctx.showMessage("⚠ 곤봉이 떨어집니다 — 크게 벗어나세요!");
        ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX()), z: clampZ(ctx.playerZ()), r: 5.4, delayMs: 1800 }, hit(rt, FORTRESS_BOSS_CONCEPTS[2]), "파괴왕 오우거의 내리찍기");
        return 4800;
      },
      (rt, ctx) => { // 지면 균열 — 십자 직선 4방 → 45° 회전 4방
        ctx.showMessage("⚠ 지면이 갈라집니다 — 빔 사이로!");
        const bx = ctx.bossX(), bz = ctx.bossZ();
        for (let d = 0; d < 4; d += 1) {
          const a = (Math.PI / 2) * d;
          ctx.spawnBossTelegraph({ kind: "line", x: bx, z: bz, dirX: Math.sin(a), dirZ: Math.cos(a), len: ARENA_HALF * 1.4, width: 2.8, delayMs: 1600 }, hit(rt, FORTRESS_BOSS_CONCEPTS[2]), "파괴왕 오우거의 균열");
          rt.pending.push({ at: ctx.now() + 1200, run: () => ctx.spawnBossTelegraph({ kind: "line", x: bx, z: bz, dirX: Math.sin(a + Math.PI / 4), dirZ: Math.cos(a + Math.PI / 4), len: ARENA_HALF * 1.4, width: 2.8, delayMs: 1500 }, hit(rt, FORTRESS_BOSS_CONCEPTS[2]), "파괴왕 오우거의 균열") });
        }
        return 6200;
      },
      (rt, ctx) => { // 광란의 발구름 — 확장 링 2연속
        ctx.showMessage("⚠ 광란의 발구름 — 링 사이 안전지대로!");
        const bx = ctx.bossX(), bz = ctx.bossZ();
        for (let i = 0; i < 2; i += 1) rt.pending.push({ at: ctx.now() + i * 900, run: () => ctx.spawnBossTelegraph({ kind: "ring", x: bx, z: bz, inner: 3 + i * 5.5, r: 8.5 + i * 5.5, delayMs: 1500 }, hit(rt, FORTRESS_BOSS_CONCEPTS[2]), "파괴왕 오우거의 발구름") });
        return 5600;
      },
    ],
  },
  {
    key: "death_knight", name: "죽음의 기사 모르드", title: "몰락한 맹세, 죽음의 기사 모르드", color: 0x66c9ff, hpMul: 5.0, atkMul: 1.05, scale: 1.5,
    patterns: [
      (rt, ctx) => { // 영혼 참격 — 부채꼴 좌→우 연쇄
        ctx.showMessage("⚠ 영혼 참격 — 등 뒤로 돌아가세요!");
        const spawnSwing = (off: number, delay: number) => rt.pending.push({ at: ctx.now() + delay, run: () => ctx.spawnBossTelegraph({ kind: "cone", x: ctx.bossX(), z: ctx.bossZ(), angle: angleToPlayer(ctx) + off, arc: Math.PI / 2.3, r: 11, delayMs: 1250 }, hit(rt, FORTRESS_BOSS_CONCEPTS[3]), "죽음의 기사의 참격") });
        spawnSwing(-0.45, 0);
        spawnSwing(0.45, 1100);
        return 5200;
      },
      (rt, ctx) => { // 사신의 낫 — 플레이어 관통 직선 2연속(재조준)
        ctx.showMessage("⚠ 사신의 낫이 날아옵니다 — 옆으로!");
        const throwScythe = () => { const a = angleToPlayer(ctx); ctx.spawnBossTelegraph({ kind: "line", x: ctx.bossX(), z: ctx.bossZ(), dirX: Math.sin(a), dirZ: Math.cos(a), len: ARENA_HALF * 1.7, width: 3.2, delayMs: 1300 }, hit(rt, FORTRESS_BOSS_CONCEPTS[3]), "죽음의 기사의 낫"); };
        throwScythe();
        rt.pending.push({ at: ctx.now() + 1700, run: throwScythe });
        return 5400;
      },
      (rt, ctx) => { // 망자의 원 — 아레나 중앙 대형 링(중앙 or 가장자리만 안전)
        ctx.showMessage("⚠ 망자의 원 — 중앙 또는 가장자리로!");
        ctx.spawnBossTelegraph({ kind: "ring", x: 0, z: ARENA_CENTER_Z, inner: 4, r: 13, delayMs: 2000 }, hit(rt, FORTRESS_BOSS_CONCEPTS[3]), "망자의 원");
        return 5600;
      },
    ],
  },
  {
    key: "assassin", name: "그림자 어쌔신 실크", title: "그림자에 숨은 칼날, 실크", color: 0xff2d55, hpMul: 3.6, atkMul: 1.2, scale: 1.35,
    patterns: [
      (rt, ctx) => { // 표창 부채 — 보스 방사 직선 5줄
        ctx.showMessage("⚠ 그림자 표창 — 부챗살 사이로!");
        const base = angleToPlayer(ctx);
        for (let i = 0; i < 5; i += 1) { const a = base + (i - 2) * 0.42; ctx.spawnBossTelegraph({ kind: "line", x: ctx.bossX(), z: ctx.bossZ(), dirX: Math.sin(a), dirZ: Math.cos(a), len: ARENA_HALF * 1.6, width: 1.9, delayMs: 1350 }, hit(rt, FORTRESS_BOSS_CONCEPTS[4]), "실크의 표창"); }
        return 4800;
      },
      (rt, ctx) => { // 암살 급습 — 작고 빠른 추적 원 4연속
        ctx.showMessage("⚠ 급습 연격 — 멈추면 당합니다!");
        for (let i = 0; i < 4; i += 1) rt.pending.push({ at: ctx.now() + i * 520, run: () => ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX()), z: clampZ(ctx.playerZ()), r: 2.4, delayMs: 1000 }, hit(rt, FORTRESS_BOSS_CONCEPTS[4]), "실크의 급습") });
        return 5400;
      },
      (rt, ctx) => { // 연막 폭살 — 보스 중심 대형 원(밖으로 대피)
        ctx.showMessage("⚠ 연막 폭살 — 어쌔신에게서 멀어지세요!");
        ctx.spawnBossTelegraph({ kind: "circle", x: ctx.bossX(), z: ctx.bossZ(), r: 8.5, delayMs: 1900 }, hit(rt, FORTRESS_BOSS_CONCEPTS[4]), "실크의 연막 폭살");
        return 5000;
      },
    ],
  },
  {
    key: "shaman", name: "대주술사 우가크", title: "금기를 삼킨 목소리, 대주술사 우가크", color: 0xa855f7, hpMul: 4.4, atkMul: 1.15, scale: 1.5,
    patterns: [
      (rt, ctx) => { // 룬 폭발진 — 플레이어 주변 원 5개 격자 낙하
        ctx.showMessage("⚠ 룬이 새겨집니다 — 빈 칸으로!");
        for (let i = 0; i < 5; i += 1) rt.pending.push({ at: ctx.now() + i * 300, run: () => { const a = (i / 5) * Math.PI * 2; ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX() + Math.cos(a) * 3.6), z: clampZ(ctx.playerZ() + Math.sin(a) * 3.6), r: 3.0, delayMs: 1500 }, hit(rt, FORTRESS_BOSS_CONCEPTS[5]), "우가크의 룬 폭발"); } });
        return 5600;
      },
      (rt, ctx) => { // 저주 파동 — 보스 중심 링 3겹 순차
        ctx.showMessage("⚠ 저주 파동 — 파동 틈으로 파고드세요!");
        const bx = ctx.bossX(), bz = ctx.bossZ();
        for (let i = 0; i < 3; i += 1) rt.pending.push({ at: ctx.now() + i * 700, run: () => ctx.spawnBossTelegraph({ kind: "ring", x: bx, z: bz, inner: 2.2 + i * 4.2, r: 6.4 + i * 4.2, delayMs: 1400 }, hit(rt, FORTRESS_BOSS_CONCEPTS[5]), "우가크의 저주 파동") });
        return 5800;
      },
      (rt, ctx) => { // 정령 낙뢰 — 빠른 소형 원 8연타
        ctx.showMessage("⚠ 정령 낙뢰 — 계속 움직이세요!");
        for (let i = 0; i < 8; i += 1) rt.pending.push({ at: ctx.now() + i * 300, run: () => ctx.spawnBossTelegraph({ kind: "circle", x: clampX(ctx.playerX() + rand(5)), z: clampZ(ctx.playerZ() + rand(5)), r: 2.2, delayMs: 1050 }, hit(rt, FORTRESS_BOSS_CONCEPTS[5]), "우가크의 낙뢰") });
        return 6000;
      },
    ],
  },
];

export const FORTRESS_BOSS_STAGE_INTERVAL = 5; // 5단계마다 보스 스테이지

export function isFortressBossStage(stage: number): boolean {
  return stage > 0 && stage % FORTRESS_BOSS_STAGE_INTERVAL === 0;
}

// 단계 → 컨셉(순환): 5=오크, 10=히드라, 15=오우거, 20=죽음의 기사, 25=어쌔신, 30=대주술사, 35=오크(2주차)…
export function fortressBossConceptForStage(stage: number): FortressBossConcept {
  const index = Math.max(0, Math.floor(stage / FORTRESS_BOSS_STAGE_INTERVAL) - 1);
  return FORTRESS_BOSS_CONCEPTS[index % FORTRESS_BOSS_CONCEPTS.length];
}

// 능력치 — 요새 단계 공식(levelForStage)과 같은 축 + 보스 보정. 주차(cycle)가 돌수록 추가 가중.
export function fortressBossStats(baseLevel: number, stage: number): { level: number; hp: number; armor: number; attackBase: number; concept: FortressBossConcept } {
  const concept = fortressBossConceptForStage(stage);
  const cycle = Math.floor(Math.max(0, stage / FORTRESS_BOSS_STAGE_INTERVAL - 1) / FORTRESS_BOSS_CONCEPTS.length); // 0=1주차
  const level = Math.max(1, baseLevel + stage * 3 + 8 + cycle * 6);
  const stats = monsterStatsFromLevel(level, true);
  return {
    level,
    hp: Math.round(stats.hp * concept.hpMul * (1 + cycle * 0.35)),
    armor: Math.round(stats.armor * (1 + cycle * 0.2)),
    attackBase: Math.round(stats.attackDamage * (1 + cycle * 0.25)),
    concept,
  };
}

export function createFortressBossRuntime(bossId: string, stage: number, attackBase: number): FortressBossRuntime {
  const concept = fortressBossConceptForStage(stage);
  return { bossId, conceptKey: concept.key, level: 0, attackBase, lastNow: 0, nextPatternAt: 0, patternCursor: Math.floor(Math.random() * concept.patterns.length), pending: [], animT: 0 };
}

// 프레임 틱 — updateSiege(보스 전투 중)가 호출. 패널 일시정지 시 타이머를 경과분만큼 민다(일리아와 동일 정책).
export function updateFortressBossPatterns(rt: FortressBossRuntime, ctx: FortressBossPatternContext, delta: number, paused: boolean): void {
  const now = ctx.now();
  const elapsedMs = rt.lastNow > 0 ? now - rt.lastNow : 0;
  rt.lastNow = now;
  if (paused) {
    rt.nextPatternAt += elapsedMs;
    for (const step of rt.pending) step.at += elapsedMs;
    return;
  }
  rt.animT += delta;
  ctx.animateBoss(rt.animT);
  for (let i = rt.pending.length - 1; i >= 0; i -= 1) {
    if (now >= rt.pending[i].at) {
      const step = rt.pending[i];
      rt.pending.splice(i, 1);
      step.run();
    }
  }
  if (rt.nextPatternAt === 0) rt.nextPatternAt = now + 3000; // 개전 여유 — 첫 패턴 전 관찰 시간
  if (now >= rt.nextPatternAt && rt.pending.length === 0) {
    const concept = FORTRESS_BOSS_CONCEPTS.find((c) => c.key === rt.conceptKey) ?? FORTRESS_BOSS_CONCEPTS[0];
    const pattern = concept.patterns[rt.patternCursor % concept.patterns.length];
    rt.patternCursor += 1;
    const cooldown = pattern(rt, ctx);
    ctx.playTone(110, 0.3, "sawtooth", 0.045);
    rt.nextPatternAt = now + cooldown;
  }
}
