// 사무라이 직업 — 적대적/퍼징 테스트 (spirits-test 패턴).
// gameplay-systems-test 의 골든 수치 블록과 역할을 나눈다: 여기는 "치터·QA 관점의 악의 입력·경계·수명주기" 전용.
//   1) 신규 헬퍼 퍼징 — NaN/±Infinity/음수 가 피해 파이프라인(hp)에 퍼지지 않는다 (NaN hp = 불사 몬스터 방지)
//   2) 연격(난도·무한 찌르기) 수명주기 — 무한 연격·매 프레임 타격·splice 경합·리셋(세이브/로드)·중첩 시전
//   3) 도약 기하 — 방향 오염·시작부터 막힘·과전진 dashStep·좌표 오염 개체·위치 오염 복원
//   4) 세이브/파티 — samurai 클래스 왕복(구세이브 warrior 폴백), 원격 파티 렌더 폴백(미지 직업 무크래시)
import assert from "node:assert/strict";
import { createServer } from "vite";

// 결정적 RNG(재현 가능) — 퍼징용. Math.random 미사용.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const sam = await server.ssrLoadModule("/src/game/samurai.ts");
  const saveMigration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const avatar = await server.ssrLoadModule("/src/avatar.ts");
  const partyPresence = await server.ssrLoadModule("/src/game/partyPresence.ts");
  const classes = await server.ssrLoadModule("/src/game/classes.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");

  // ── 1) 피해 헬퍼 퍼징 — 항상 유한 정수 ≥ 1 ──
  {
    const helpers = [
      ["samuraiFlurryHitDamage", sam.samuraiFlurryHitDamage, 0.7],
      ["samuraiDashDamage", sam.samuraiDashDamage, 1.5],
      ["samuraiPierceHitDamage", sam.samuraiPierceHitDamage, 0.4],
      ["samuraiMoonlightDamage", sam.samuraiMoonlightDamage, 2.2],
    ];
    const hostile = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -100, -1, 0];
    for (const [name, fn, mult] of helpers) {
      for (const input of hostile) {
        const out = fn(input);
        assert.ok(Number.isFinite(out) && Number.isInteger(out) && out >= 1, `${name}(${input}) → 유한 정수 ≥1 (실제 ${out})`);
      }
      // 골든 유지 — 정상 입력은 하드닝 전과 동일
      assert.equal(fn(100), Math.max(1, Math.round(100 * mult)), `${name}(100) 골든 유지`);
      // 정상 범위 퍼징 — 단조 비감소 + 유한
      const rng = lcg(777);
      let prev = fn(0);
      for (let i = 1; i <= 200; i += 1) {
        const v = fn(i * 5 + rng());
        assert.ok(Number.isFinite(v) && v >= prev, `${name} 단조 비감소`);
        prev = v;
      }
    }
  }

  // ── 2) 연격 등록 퍼징 — 오염 인자는 등록 거부 (무한 연격·매 프레임 타격 차단) ──
  {
    sam.resetSamuraiEffects();
    sam.registerSamuraiFlurry("m1", Number.NaN, 4, 120, 1000); // NaN 피해
    sam.registerSamuraiFlurry("m1", 10, Number.POSITIVE_INFINITY, 120, 1000); // 무한 타수
    sam.registerSamuraiFlurry("m1", 10, 4, Number.NaN, 1000); // NaN 간격 → nextHitAt NaN = 매 프레임 타격
    sam.registerSamuraiFlurry("m1", 10, 4, 120, Number.NaN); // NaN 시각
    assert.equal(sam.activeSamuraiFlurryCount(), 0, "비유한 인자 연격은 전부 등록 거부");

    // 음수·0 타수 → 최소 1타로 클램프되어 정확히 1회 타격 후 해제 (영구 잔존 엔트리 방지)
    const one = { hp: 100, hits: 0 };
    const ctx = (now) => ({ now: () => now, getObject: (id) => (id === "m1" && one.hp > 0 ? { id: "m1", hp: one.hp } : undefined), meleeEffects: () => {}, applyDamage: (t, d) => { one.hits += 1; one.hp -= d; } });
    sam.registerSamuraiFlurry("m1", 10, -5, 120, 1000);
    sam.registerSamuraiFlurry("m1", 10, 0, 120, 2000);
    assert.equal(sam.activeSamuraiFlurryCount(), 2, "음수/0 타수는 1타로 클램프되어 등록");
    sam.updateSamuraiFlurries(ctx(3000));
    assert.equal(one.hits, 2, "클램프된 연격은 각 1타만");
    assert.equal(sam.activeSamuraiFlurryCount(), 0, "1타 후 즉시 해제 — 잔존 엔트리 없음");
  }

  // ── 2b) 매 프레임 중복 타격 금지 — 같은 timestamp 로 여러 번 틱해도 1타 ──
  {
    sam.resetSamuraiEffects();
    const st = { hp: 1000, hits: 0 };
    const ctx = (now) => ({ now: () => now, getObject: () => ({ id: "m1", hp: st.hp }), meleeEffects: () => {}, applyDamage: (t, d) => { st.hits += 1; st.hp -= d; } });
    sam.registerSamuraiFlurry("m1", 10, 4, 120, 5000);
    for (let f = 0; f < 20; f += 1) sam.updateSamuraiFlurries(ctx(5000)); // 같은 프레임 반복
    assert.equal(st.hits, 1, "동일 시각 반복 틱은 1타만 (매 프레임 타격 금지)");
    for (let f = 0; f < 20; f += 1) sam.updateSamuraiFlurries(ctx(5060)); // 간격 미도달
    assert.equal(st.hits, 1, "간격 미도달 반복 틱도 추가 타격 없음");
    sam.resetSamuraiEffects();
  }

  // ── 2c) 중첩 연격(난도+무한 찌르기 동시) + 대상 하나만 사망 — splice 경합 없음 ──
  {
    sam.resetSamuraiEffects();
    const world = { a: { id: "a", hp: 100 }, b: { id: "b", hp: 100 } };
    const dealt = { a: 0, b: 0 };
    const ctx = (now) => ({ now: () => now, getObject: (id) => (world[id] && world[id].hp > 0 ? world[id] : undefined), meleeEffects: () => {}, applyDamage: (t, d) => { dealt[t.id] += 1; t.hp -= d; } });
    sam.registerSamuraiFlurry("a", 5, 3, 100, 0); // R 난도풍
    sam.registerSamuraiFlurry("a", 5, 3, 100, 0); // F 무한 찌르기풍 — 같은 대상 중첩
    sam.registerSamuraiFlurry("b", 5, 3, 100, 0);
    assert.equal(sam.activeSamuraiFlurryCount(), 3, "중첩 시전 3건 공존");
    sam.updateSamuraiFlurries(ctx(0)); // 각 1타
    assert.deepEqual(dealt, { a: 2, b: 1 }, "같은 틱에 세 연격이 각자 타격");
    world.b.hp = 0; // b 사망
    sam.updateSamuraiFlurries(ctx(100));
    assert.equal(sam.activeSamuraiFlurryCount(), 2, "죽은 대상 연격만 취소, 나머지 유지");
    sam.updateSamuraiFlurries(ctx(200)); // a 두 연격 완주(3타째)
    assert.equal(dealt.a, 6, "생존 대상 연격은 끝까지 완주 (2연격 × 3타)");
    assert.equal(sam.activeSamuraiFlurryCount(), 0, "완주 후 전부 해제");
    assert.equal(dealt.b, 1, "죽은 대상은 추가 타격 없음");
  }

  // ── 2d) 리셋(세이브 로드·새 게임 경로) — 채널 중 초기화하면 이후 무타격 ──
  {
    sam.resetSamuraiEffects();
    let hits = 0;
    const ctx = (now) => ({ now: () => now, getObject: () => ({ id: "m1", hp: 100 }), meleeEffects: () => {}, applyDamage: () => { hits += 1; } });
    sam.registerSamuraiFlurry("m1", 10, 11, 145, 0);
    sam.updateSamuraiFlurries(ctx(0));
    assert.equal(hits, 1, "채널 1타 진행");
    sam.resetSamuraiEffects(); // = 로드/새 게임 시 resetSecondSkillEffects 경유
    assert.equal(sam.activeSamuraiFlurryCount(), 0, "리셋 시 진행 중 연격 소거");
    for (let t = 145; t <= 1600; t += 145) sam.updateSamuraiFlurries(ctx(t));
    assert.equal(hits, 1, "리셋 후 잔여 타격 누수 없음 (틱 릭 방지)");
  }

  // ── 3) 도약 퍼징 — 방향·위치·개체 좌표 오염 ──
  {
    const makeDashCtx = (overrides = {}) => {
      const st = {
        pos: { x: 0, y: 0, z: 0 },
        hit: [],
        ctx: null,
      };
      st.ctx = {
        playerPosition: st.pos,
        forwardXZ: () => ({ x: 0, z: -1 }),
        nearbyCombatTargets: () => [{ id: "near", root: { position: { x: 0.5, z: -3 } }, collisionRadius: 0.4, hp: 50 }],
        dashStep: (dx, dz) => { st.pos.x += dx; st.pos.z += dz; },
        meleeEffects: () => {},
        applyDamage: (t) => { st.hit.push(t.id); },
        ...overrides,
      };
      return st;
    };

    // 방향 0 벡터 — 이동·판정 없이 안전 종료
    {
      const st = makeDashCtx({ forwardXZ: () => ({ x: 0, z: 0 }) });
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.deepEqual(r, { distance: 0, hits: 0 }, "0 방향 → 무이동·무타격");
      assert.equal(st.pos.x, 0, "0 방향 → 위치 불변");
    }
    // 방향 NaN — 위치 NaN 전파 금지
    for (const dir of [{ x: Number.NaN, z: -1 }, { x: Number.NaN, z: Number.NaN }, { x: Number.POSITIVE_INFINITY, z: 0 }]) {
      const st = makeDashCtx({ forwardXZ: () => dir });
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.deepEqual(r, { distance: 0, hits: 0 }, `오염 방향 ${JSON.stringify(dir)} → 무이동·무타격`);
      assert.ok(Number.isFinite(st.pos.x) && Number.isFinite(st.pos.z), "오염 방향 → 위치 유한 유지");
    }
    // dashStep 이 위치를 NaN 으로 오염 — 시작점 복원 + 오폭 없음 (NaN 경로는 hypot 비교가 전부 false = 전 후보 명중이 되므로)
    {
      const st = makeDashCtx();
      st.ctx.dashStep = () => { st.pos.x = Number.NaN; st.pos.z = Number.NaN; };
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.deepEqual(r, { distance: 0, hits: 0 }, "위치 오염 → 판정 중단");
      assert.equal(st.pos.x, 0, "위치 오염 → 시작 x 복원");
      assert.equal(st.pos.z, 0, "위치 오염 → 시작 z 복원");
      assert.equal(st.hit.length, 0, "위치 오염 → 광역 오폭 없음");
    }
    // 시작부터 완전히 막힘(무이동 dashStep) — 거리 0, 시전 지점 폭 내 대상만 점접 판정(기존 동작 보존)
    {
      const st = makeDashCtx({ dashStep: () => {} });
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.equal(r.distance, 0, "전면 차단 → 거리 0");
      assert.ok(Number.isFinite(r.distance), "거리 항상 유한");
    }
    // 과전진 dashStep(요청의 2배 이동) — 무한 루프 없이 종료, 거리 유한·상식 범위
    {
      const st = makeDashCtx({ dashStep: (dx, dz) => { st.pos.x += dx * 2; st.pos.z += dz * 2; } });
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.ok(Number.isFinite(r.distance) && r.distance <= sam.SAMURAI_DASH_RANGE * 2 + 1, `과전진 dashStep 종료 (거리 ${r.distance})`);
    }
    // 좌표 오염 개체·Infinity 충돌반경 개체 — 명중 제외 (원거리 오폭 방지)
    {
      const st = makeDashCtx({
        nearbyCombatTargets: () => [
          { id: "nanPos", root: { position: { x: Number.NaN, z: Number.NaN } }, collisionRadius: 0.4, hp: 50 },
          { id: "infRadius", root: { position: { x: 999, z: 999 } }, collisionRadius: Number.POSITIVE_INFINITY, hp: 50 },
          { id: "legit", root: { position: { x: 0.5, z: -5 } }, collisionRadius: 0.4, hp: 50 },
        ],
      });
      const r = sam.performSamuraiDash(st.ctx, 30);
      assert.deepEqual(st.hit, ["legit"], "NaN 좌표·Infinity 반경 개체는 오폭하지 않고 정상 개체만 명중");
      assert.equal(r.hits, 1, "hits 집계 일치");
    }
    // 경로 피해 1회 보장 — 폭 안의 대상이 몇 스텝을 걸쳐 겹쳐도 후보당 정확히 1회
    {
      const st = makeDashCtx();
      sam.performSamuraiDash(st.ctx, 30);
      assert.deepEqual(st.hit, ["near"], "경로상 대상은 정확히 1회 타격");
    }
  }

  // ── 4) 세이브/파티 — samurai 왕복 + 구세이브·미지 직업 폴백 ──
  {
    assert.ok(saveMigration.isPlayerClassId("samurai"), "isPlayerClassId 가 samurai 인정 (세이브 왕복)");
    assert.ok(!saveMigration.isPlayerClassId("ninja") && !saveMigration.isPlayerClassId(null) && !saveMigration.isPlayerClassId(42), "미지/오염 직업 값 거부 → 로드 시 warrior 폴백 경로");
    assert.ok("samurai" in avatar.CLASS_APPEARANCE, "파티 원격 아바타 팔레트에 samurai 존재 (스폰 무폴백)");
    // 원격 공격 모션 — samurai 는 근접 휘두르기(몸통 비틀기), 미지 직업 문자열도 무크래시 폴백
    const rot = { x: 0, y: 0, z: 0 };
    partyPresence.applyAttackMotion(rot, "samurai", 0.5);
    assert.ok(rot.y < 0 && rot.x < 0, "samurai 원격 모션 = 근접 휘두르기 (미지 직업 폴백 아님)");
    const rot2 = { x: 0, y: 0, z: 0 };
    partyPresence.applyAttackMotion(rot2, "totally_unknown_class", 0.5); // 신구버전 혼재 파티 — 크래시 금지
    assert.ok(Number.isFinite(rot2.x), "미지 직업 문자열 → 폴백 모션, 무크래시");
    // 스킬 코스트 단일 진실원천 — 클래스 카드와 상수 불일치로 HUD 가 거짓말하지 않게
    assert.equal(classes.PLAYER_CLASSES.samurai.manaCost, constants.SAMURAI_SKILL_COST, "난도 마나 = 상수");
    assert.equal(classes.PLAYER_CLASSES.samurai.cooldown, constants.SAMURAI_SKILL_COOLDOWN, "난도 쿨다운 = 상수");
  }

  console.log("samurai-test: OK (fuzz + lifecycle + dash geometry + save/party, adversarial)");
} finally {
  await server.close();
}
