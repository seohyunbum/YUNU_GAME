// 몬스터 요새 5단계 보스 — 골든/수명주기 테스트 (illia-test 패턴: vite ssrLoadModule).
//   1) 스테이지 판정·컨셉 순환 골든 — 5=오크 → 10=히드라 → … → 30=대주술사 → 35=오크(2주차)
//   2) 능력치 스케일 — 단계 단조 증가 + 주차 가중 + 컨셉 배율 반영
//   3) 시즈 상태머신 — 보스 단계: pending→trailer(컷씬 대기)→fight(스폰)→처치→보상→다음 단계 / 일반 단계 흐름 보존
//   4) 패턴 엔진 — 발화 시 텔레그래프 spec 유효(아레나 안·delay>0), 일시정지 시 타이머 밀림
//   5) 보상 — 보스 단계 전직의서 +2·아이템 보너스, 비보스 단계 기존값 불변(골든)
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const boss = await server.ssrLoadModule("/src/game/fortressBoss.ts");
  const siege = await server.ssrLoadModule("/src/game/fortressSiege.ts");
  const telegraph = await server.ssrLoadModule("/src/game/telegraph.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const { ARENA_CENTER_Z, ARENA_HALF } = constants;

  // ── 1) 스테이지 판정 + 컨셉 순환 골든 ─────────────────────────────────
  assert.equal(boss.isFortressBossStage(4), false);
  assert.equal(boss.isFortressBossStage(5), true);
  assert.equal(boss.isFortressBossStage(7), false);
  assert.equal(boss.isFortressBossStage(10), true);
  const cycleKeys = [5, 10, 15, 20, 25, 30, 35].map((s) => boss.fortressBossConceptForStage(s).key);
  assert.deepEqual(cycleKeys, ["orc_warlord", "hydra", "ogre_boss", "death_knight", "assassin", "shaman", "orc_warlord"], "5단계 간격 컨셉 순환");
  assert.equal(boss.FORTRESS_BOSS_CONCEPTS.length, 6);
  for (const concept of boss.FORTRESS_BOSS_CONCEPTS) assert.ok(concept.patterns.length >= 3, `${concept.key} 패턴 3종 이상`);

  // ── 2) 능력치 스케일 — 단조 증가 + 주차 가중 ─────────────────────────
  const s5 = boss.fortressBossStats(30, 5);
  const s10 = boss.fortressBossStats(30, 10);
  const s35 = boss.fortressBossStats(30, 35); // 오크 2주차
  assert.ok(s10.level > s5.level && s10.attackBase > 0 && s5.hp > 0);
  assert.ok(s35.level > s5.level + 25, "2주차 오크는 레벨 보정 가중");
  assert.ok(s35.hp > boss.fortressBossStats(30, 5).hp, "같은 컨셉이라도 주차가 돌면 강해짐");

  // ── 3) 시즈 상태머신 — 보스 스테이지 흐름 ────────────────────────────
  const makeCtx = () => {
    const calls = { trailer: 0, boss: 0, monsters: 0, rewards: [], messages: [] };
    let cutscene = false;
    let bossAlive = false;
    const ctx = {
      spawnSiegeMonster: () => { calls.monsters += 1; return `m${calls.monsters}`; },
      isAlive: (id) => (id.startsWith("boss") ? bossAlive : false), // 일반 몬스터는 즉사 처리(빠른 진행)
      grantStageReward: (stage, tomes, items) => calls.rewards.push({ stage, tomes, items }),
      showMessage: (t) => calls.messages.push(t),
      renderHud: () => {},
      startBossTrailer: () => { calls.trailer += 1; cutscene = true; },
      spawnSiegeBoss: () => { calls.boss += 1; bossAlive = true; return `boss${calls.boss}`; },
      isCutsceneActive: () => cutscene,
      isPanelOpen: () => false,
      bossPattern: { now: () => performance.now(), playerX: () => 0, playerZ: () => ARENA_CENTER_Z, bossX: () => 0, bossZ: () => ARENA_CENTER_Z - 10, animateBoss: () => {}, spawnBossTelegraph: () => {}, showMessage: () => {}, playTone: () => {} },
    };
    return { ctx, calls, endCutscene: () => { cutscene = false; }, killBoss: () => { bossAlive = false; } };
  };

  // 보스 단계로 직행(재입장) — pending → trailer → (컷씬 종료) → 스폰 → 처치 → 보상 → 다음 단계
  {
    const { ctx, calls, endCutscene, killBoss } = makeCtx();
    const st = siege.createSiegeState(30, 5);
    assert.equal(st.bossPhase, "pending");
    assert.equal(st.wavesInStage, 1);
    for (let i = 0; i < 40 && st.clearTimer > 0; i += 1) siege.updateSiege(st, ctx, 0.1); // 입장 정적
    siege.updateSiege(st, ctx, 0.05); // pending → trailer
    assert.equal(calls.trailer, 1, "트레일러 정확히 1회");
    assert.equal(st.bossPhase, "trailer");
    siege.updateSiege(st, ctx, 0.05); // 컷씬 중 — 대기
    assert.equal(calls.boss, 0, "컷씬 중엔 스폰 안 함");
    endCutscene();
    siege.updateSiege(st, ctx, 0.05); // 스폰
    assert.equal(calls.boss, 1);
    assert.equal(st.bossPhase, "fight");
    assert.ok(st.bossRuntime && st.bossRuntime.bossId === "boss1");
    killBoss();
    siege.updateSiege(st, ctx, 0.05); // 처치 → 단계 클리어
    assert.equal(calls.rewards.length, 1);
    assert.equal(calls.rewards[0].stage, 5);
    assert.equal(st.stage, 6);
    assert.equal(st.bossPhase, "none", "다음(6단계)은 일반 단계");
    assert.equal(st.bossRuntime, null);
    assert.ok(calls.messages.some((m) => m.includes("격파")), "보스 격파 메시지");
  }

  // 일반 단계(4) 클리어 → 5단계 진입 시 보스 흐름 전환
  {
    const { ctx, calls, endCutscene } = makeCtx();
    const st = siege.createSiegeState(30, 4);
    assert.equal(st.bossPhase, "none");
    for (let i = 0; i < 4000 && st.stage === 4; i += 1) siege.updateSiege(st, ctx, 0.1); // 몬스터 즉사라 웨이브가 빠르게 소진
    assert.equal(st.stage, 5);
    assert.equal(st.bossPhase, "pending", "5단계는 보스 단계로 예약");
    for (let i = 0; i < 200 && calls.trailer === 0; i += 1) siege.updateSiege(st, ctx, 0.1);
    assert.equal(calls.trailer, 1);
    endCutscene();
    siege.updateSiege(st, ctx, 0.05);
    assert.equal(calls.boss, 1, "일반→보스 단계 전환 후 스폰");
    assert.ok(calls.monsters > 0, "4단계 일반 웨이브는 기존대로 스폰됨");
  }

  // 스폰 실패 안전망 — 일반 단계로 강등(멈춤 방지)
  {
    const { ctx, endCutscene } = makeCtx();
    ctx.spawnSiegeBoss = () => null;
    const st = siege.createSiegeState(30, 5);
    st.clearTimer = 0;
    siege.updateSiege(st, ctx, 0.05); // pending → trailer
    endCutscene();
    siege.updateSiege(st, ctx, 0.05); // 스폰 실패
    assert.equal(st.bossPhase, "none", "스폰 실패 시 강등 — 무한 대기 없음");
  }

  // ── 4) 패턴 엔진 — 텔레그래프 유효성 + 일시정지 ──────────────────────
  {
    const specs = [];
    let paused = false;
    const pctx = {
      now: () => performance.now(),
      playerX: () => 2, playerZ: () => ARENA_CENTER_Z + 3,
      bossX: () => 0, bossZ: () => ARENA_CENTER_Z - 8,
      animateBoss: () => {},
      spawnBossTelegraph: (spec) => specs.push(spec),
      showMessage: () => {}, playTone: () => {},
    };
    for (const concept of boss.FORTRESS_BOSS_CONCEPTS) {
      const rt = boss.createFortressBossRuntime("b", 5, 100);
      rt.conceptKey = concept.key;
      rt.nextPatternAt = 1; // 즉시 발화
      for (let i = 0; i < concept.patterns.length; i += 1) {
        rt.pending.length = 0;
        const cooldown = concept.patterns[i](rt, pctx);
        assert.ok(cooldown >= 3000, `${concept.key} 패턴 ${i} 쿨다운 합리적`);
        for (const step of [...rt.pending]) step.run(); // 지연 스텝 즉시 실행해 spec 수집
      }
    }
    assert.ok(specs.length >= 18, `컨셉 6×패턴 3 에서 텔레그래프 다수 생성(실측 ${specs.length})`);
    for (const spec of specs) {
      assert.ok(spec.delayMs >= 900, "예고 시간은 반응 가능해야");
      assert.ok(Math.abs(spec.x) <= ARENA_HALF + 0.001 || spec.kind === "line" || spec.kind === "cone", `시전 원점이 아레나 안: ${JSON.stringify(spec)}`);
      if (spec.kind === "circle" || spec.kind === "ring" || spec.kind === "cone") assert.ok(spec.r > 0 && spec.r <= ARENA_HALF * 2, "반경 유효");
      if (spec.kind === "ring") assert.ok(spec.inner < spec.r, "링 안지름 < 바깥지름");
      if (spec.kind === "line") assert.ok(Math.hypot(spec.dirX, spec.dirZ) > 0.99 && Math.hypot(spec.dirX, spec.dirZ) < 1.01, "직선 방향 단위벡터");
      // 판정 기하와 정합 — 원점 자체가 스펙 안이면 contains 참(스모크)
      if (spec.kind === "circle") assert.equal(telegraph.telegraphContains(spec, spec.x, spec.z), true);
    }
    // 일시정지 — 타이머가 경과분만큼 밀린다
    const rt = boss.createFortressBossRuntime("b", 5, 100);
    rt.nextPatternAt = performance.now() + 1000;
    rt.pending.push({ at: performance.now() + 500, run: () => { throw new Error("일시정지 중 스텝 실행 금지"); } });
    const before = rt.nextPatternAt;
    rt.lastNow = performance.now() - 200; // 200ms 경과 흉내
    paused = true;
    boss.updateFortressBossPatterns(rt, pctx, 0.2, paused);
    assert.ok(rt.nextPatternAt >= before + 190, "패턴 타이머 밀림");
  }

  // ── 5) 보상 골든 — 보스 단계 보너스 / 비보스 불변 ────────────────────
  assert.equal(siege.tomesForStage(4), 2, "비보스 4단계 기존값");
  assert.equal(siege.tomesForStage(5), 2 + 2, "보스 5단계 = 기존 2 + 보너스 2");
  assert.equal(siege.tomesForStage(6), 2, "비보스 6단계 기존값");
  const items4 = siege.itemsForStage(4);
  const items5 = siege.itemsForStage(5);
  assert.equal(items4.refined_diamond, undefined, "4단계 비보스 — 기존 보상 그대로");
  assert.ok((items5.diamond ?? 0) >= 4 && (items5.refined_diamond ?? 0) >= 2 && (items5.advanced_medkit ?? 0) >= 1, "보스 단계 아이템 보너스");

  console.log("✓ fortress-boss-test: 컨셉 순환 · 능력치 스케일 · 시즈 보스 흐름 · 패턴 유효성 · 보상 골든 전부 통과");
} finally {
  await server.close();
}
