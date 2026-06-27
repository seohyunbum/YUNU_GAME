// 데미지 랜덤 변동(삼각분포) 적대적 테스트.
// 경계·연속성·단조성·범위 불변식·적대적 입력(NaN/Infinity/범위이탈 rng, 비정상 base)·통계 분포·결정성을 빡세게 검증.
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const { triangularRoll, varyPlayerDamage, varyMonsterDamage } = await server.ssrLoadModule("/src/game/combat.ts");

  const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

  // ── 1. 경계 ──
  assert.equal(triangularRoll(0.8, 1.0, 2.0, () => 0), 0.8, "rng=0 → min (player)");
  assert.equal(triangularRoll(0.8, 1.0, 2.0, () => 1), 2.0, "rng=1 → max (player)");
  assert.equal(triangularRoll(0.8, 1.0, 1.3, () => 0), 0.8, "rng=0 → min (monster)");
  assert.equal(triangularRoll(0.8, 1.0, 1.3, () => 1), 1.3, "rng=1 → max (monster)");

  // ── 2. u=c 에서 정확히 mode + 양 분기 연속 ──
  for (const [min, mode, max] of [[0.8, 1.0, 2.0], [0.8, 1.0, 1.3], [0.5, 1.5, 3.0]]) {
    const c = (mode - min) / (max - min);
    assert.ok(approx(triangularRoll(min, mode, max, () => c), mode), `u=c → mode (${min}/${mode}/${max})`);
    // 연속성: c 직전/직후가 mode 에 수렴
    assert.ok(Math.abs(triangularRoll(min, mode, max, () => c - 1e-7) - mode) < 1e-3, "left-continuous at c");
    assert.ok(Math.abs(triangularRoll(min, mode, max, () => c + 1e-7) - mode) < 1e-3, "right-continuous at c");
  }

  // ── 3. 단조성: u 증가 → 결과 비감소 (역가능 분포의 핵심 성질) ──
  {
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const u = i / 1000;
      const x = triangularRoll(0.8, 1.0, 2.0, () => u);
      assert.ok(x >= prev - 1e-9, `monotonic non-decreasing at u=${u}`);
      assert.ok(x >= 0.8 - 1e-9 && x <= 2.0 + 1e-9, `in range at u=${u}`);
      prev = x;
    }
  }

  // ── 4. 적대적 rng: NaN/Infinity/음수/>1 → 절대 범위 이탈/ NaN 없음 ──
  for (const bad of [NaN, Infinity, -Infinity, -5, 1.5, 99, -0.0001, 1.0001]) {
    const x = triangularRoll(0.8, 1.0, 2.0, () => bad);
    assert.ok(Number.isFinite(x) && x >= 0.8 - 1e-9 && x <= 2.0 + 1e-9, `hostile rng=${bad} clamped & finite (got ${x})`);
  }

  // ── 5. 비정상 범위 ──
  assert.equal(triangularRoll(5, 5, 5, () => 0.4), 5, "degenerate min==max → point");
  assert.equal(triangularRoll(2, 1, 5, () => 0.5) >= 2 && triangularRoll(2, 1, 5, () => 0.5) <= 5, true, "mode<min clamps inside");
  assert.equal(triangularRoll(3, 9, 1, () => 0.5), 3, "max<min → min (no crash)");

  // ── 6. 데미지 래퍼: 경계·최빈·하한·적대적 base ──
  assert.equal(varyPlayerDamage(100, () => 0), 80, "player 80% floor");
  assert.equal(varyPlayerDamage(100, () => 1), 200, "player 200% ceil");
  assert.equal(varyMonsterDamage(100, () => 0), 80, "monster 80% floor");
  assert.equal(varyMonsterDamage(100, () => 1), 130, "monster 130% ceil");
  assert.equal(varyPlayerDamage(1, () => 0), 1, "player min damage 1");
  assert.equal(varyMonsterDamage(1, () => 0), 1, "monster min damage 1");
  for (const badBase of [0, -1, -9999, NaN, Infinity, -Infinity]) {
    assert.equal(varyPlayerDamage(badBase, () => 0.5), 0, `player base=${badBase} → 0`);
    assert.equal(varyMonsterDamage(badBase, () => 0.5), 0, `monster base=${badBase} → 0`);
  }
  // 정수 출력 보장
  for (let i = 0; i <= 50; i++) {
    const u = i / 50;
    assert.ok(Number.isInteger(varyPlayerDamage(137, () => u)), `player output integer @u=${u}`);
    assert.ok(Number.isInteger(varyMonsterDamage(137, () => u)), `monster output integer @u=${u}`);
  }

  // ── 7. 결정성: 동일 rng 시퀀스 → 동일 출력 ──
  const seqRng = (seed) => { let s = seed; return () => { s = (1103515245 * s + 12345) % 2147483648; return s / 2147483648; }; };
  {
    const a = [], b = [];
    const ra = seqRng(42), rb = seqRng(42);
    for (let i = 0; i < 500; i++) { a.push(varyPlayerDamage(500, ra)); b.push(varyPlayerDamage(500, rb)); }
    assert.deepEqual(a, b, "deterministic for identical rng seed");
  }

  // ── 8. 통계 분포(대표본) — 범위 100% 준수 + 우편향 평균 + mode 미만 비율 ≈ c ──
  {
    const rng = seqRng(987654321);
    const N = 200000;
    let pSum = 0, mSum = 0, pBelowMode = 0, mBelowMode = 0, pMin = Infinity, pMax = -Infinity;
    for (let i = 0; i < N; i++) {
      const p = varyPlayerDamage(1000, rng) / 1000;
      const m = varyMonsterDamage(1000, rng) / 1000;
      assert.ok(p >= 0.8 && p <= 2.0, `player sample in [0.8,2.0] (got ${p})`);
      assert.ok(m >= 0.8 && m <= 1.3, `monster sample in [0.8,1.3] (got ${m})`);
      pSum += p; mSum += m;
      if (p < 1.0) pBelowMode++;
      if (m < 1.0) mBelowMode++;
      pMin = Math.min(pMin, p); pMax = Math.max(pMax, p);
    }
    const pMean = pSum / N, mMean = mSum / N;
    // 기대 평균 = (min+mode+max)/3 : player 1.2667, monster 1.0333
    assert.ok(approx(pMean, 1.2667, 0.01), `player mean ≈1.267 (got ${pMean.toFixed(4)})`);
    assert.ok(approx(mMean, 1.0333, 0.01), `monster mean ≈1.033 (got ${mMean.toFixed(4)})`);
    // P(x<mode) = c : player (1-0.8)/(2-0.8)=0.1667, monster (1-0.8)/(1.3-0.8)=0.4
    assert.ok(approx(pBelowMode / N, 0.1667, 0.01), `player P(<mode) ≈0.167 (got ${(pBelowMode / N).toFixed(4)})`);
    assert.ok(approx(mBelowMode / N, 0.4, 0.01), `monster P(<mode) ≈0.40 (got ${(mBelowMode / N).toFixed(4)})`);
    // 우편향: 평균 > 최빈(1.0)
    assert.ok(pMean > 1.0 && mMean > 1.0, "right-skew: mean above mode");
    // 큰 표본이면 꼬리 양끝 근처까지 도달
    assert.ok(pMax > 1.9 && pMin < 0.85, `player reaches both tails (min ${pMin.toFixed(3)}, max ${pMax.toFixed(3)})`);
  }

  // ── 9. 몬스터 변동폭이 플레이어보다 좁다(설계 의도) ──
  assert.ok(varyMonsterDamage(1000, () => 1) < varyPlayerDamage(1000, () => 1), "monster ceil (130%) < player ceil (200%)");

  console.log("damage-variance-test: OK (boundaries, continuity, monotonicity, hostile inputs, distribution, determinism)");
} finally {
  await server.close();
}
