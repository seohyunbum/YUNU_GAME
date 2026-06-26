// 정령 시스템 순수 로직 — 적대적/엄격 테스트. 7등급. 경계·퍼징·분포·불변식·악의적 세이브 입력 방어.
import assert from "node:assert/strict";
import { createServer } from "vite";

// 결정적 RNG(재현 가능) — 분포·퍼징용. Math.random 미사용.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const S = await server.ssrLoadModule("/src/game/spirits.ts");
  const GRADES = S.SPIRIT_GRADES;

  // ── 등급 테이블 무결성 ──
  assert.equal(GRADES.length, 7, "7등급");
  assert.equal(GRADES.reduce((s, g) => s + g.weight, 0), 100, "가챠 가중치 합 100%");
  for (const g of GRADES) {
    assert.ok(g.weight > 0, `${g.grade} weight>0`);
    assert.equal(g.max - g.min, 5, `${g.grade} 범위 폭 5`);
    assert.ok(typeof g.label === "string" && g.label.length > 0, `${g.grade} 라벨`);
    assert.ok(/^#|rgba/.test(g.color), `${g.grade} 색`);
    assert.ok(typeof g.emoji === "string" && g.emoji.length > 0, `${g.grade} 이모지`);
  }
  // 범위·인덱스 단조 증가
  for (let i = 1; i < GRADES.length; i += 1) {
    assert.ok(GRADES[i].min >= GRADES[i - 1].min, "min 단조");
    assert.ok(GRADES[i].weight <= GRADES[i - 1].weight, "고등급일수록 희귀(weight 비증가)");
    assert.equal(S.spiritGradeIndex(GRADES[i].grade), i, "index 일치");
  }
  // 이모지 고유(등급 구분)
  assert.equal(new Set(GRADES.map((g) => g.emoji)).size, 7, "등급 이모지 7개 고유");

  // ── rollSpiritGrade 경계 ──
  assert.equal(S.rollSpiritGrade(0), "common", "rand 0 = 일반");
  assert.equal(S.rollSpiritGrade(0.9999), "transcendent", "rand 1 근처 = 초월(최상위)");
  assert.equal(S.rollSpiritGrade(-5), "common", "음수 클램프 → 일반");
  assert.equal(S.rollSpiritGrade(5), "transcendent", "초과 클램프 → 최상위");
  // 누적 경계 직접 검증
  let acc = 0;
  for (const g of GRADES) {
    const mid = (acc + 0.0001) / 100;
    assert.equal(S.rollSpiritGrade(mid), g.grade, `누적 ${acc}% 직후 = ${g.grade}`);
    acc += g.weight;
  }

  // ── rollSpiritGrade 분포(퍼징) — 가중치 비례, 관대한 허용오차 ──
  {
    const rng = lcg(12345);
    const counts = {};
    const N = 60000;
    for (let i = 0; i < N; i += 1) { const gr = S.rollSpiritGrade(rng()); counts[gr] = (counts[gr] ?? 0) + 1; }
    for (const g of GRADES) {
      const pct = ((counts[g.grade] ?? 0) / N) * 100;
      assert.ok(Math.abs(pct - g.weight) < Math.max(1.2, g.weight * 0.25), `${g.grade} 분포 ${pct.toFixed(2)}% ≈ ${g.weight}%`);
    }
    assert.ok((counts["transcendent"] ?? 0) > 0, "초월도 표본에 등장(starvation 없음)");
  }

  // ── rollSpiritStat 경계 + 퍼징(범위 이탈·비정수 없음) ──
  for (const g of GRADES) {
    assert.equal(S.rollSpiritStat(g.grade, 0), g.min, `${g.grade} 하한`);
    assert.equal(S.rollSpiritStat(g.grade, 1), g.max, `${g.grade} 상한`);
    assert.equal(S.rollSpiritStat(g.grade, -9), g.min, "음수 → 하한");
    assert.equal(S.rollSpiritStat(g.grade, 9), g.max, "초과 → 상한");
    const rng = lcg(777);
    for (let i = 0; i < 4000; i += 1) {
      const v = S.rollSpiritStat(g.grade, rng());
      assert.ok(Number.isInteger(v) && v >= g.min && v <= g.max, `${g.grade} 롤 ${v} 범위 내 정수`);
    }
  }
  assert.equal(S.rollSpiritStat("bogus", 0), 0, "알 수 없는 등급 → 일반(min 0)으로 폴백");

  // ── createSpirit 퍼징 + 결정성 ──
  {
    const rng = lcg(42);
    for (let i = 0; i < 5000; i += 1) {
      const sp = S.createSpirit(`id${i}`, { grade: rng(), attack: rng(), defense: rng() });
      const def = S.spiritGradeDef(sp.grade);
      assert.ok(S.isSpiritGrade(sp.grade));
      assert.ok(sp.baseAttack >= def.min && sp.baseAttack <= def.max, "공격 범위 내");
      assert.ok(sp.baseDefense >= def.min && sp.baseDefense <= def.max, "방어 범위 내");
      assert.equal(sp.level, 1);
      assert.equal(sp.experience, 0);
    }
    const a = S.createSpirit("z", { grade: 0.3, attack: 0.6, defense: 0.1 });
    const b = S.createSpirit("z", { grade: 0.3, attack: 0.6, defense: 0.1 });
    assert.deepEqual(a, b, "동일 시드 = 동일 결과(결정적)");
  }

  // ── 레벨 배수 + 버프 단조성 ──
  assert.equal(S.spiritLevelMultiplier(1), 1);
  assert.equal(S.spiritLevelMultiplier(11), 1.2, "Lv11 = +20%");
  assert.equal(S.spiritLevelMultiplier(0), 1, "Lv0 방어 → 1");
  for (let lv = 1; lv < 200; lv += 1) assert.ok(S.spiritLevelMultiplier(lv + 1) >= S.spiritLevelMultiplier(lv), "배수 비감소");
  assert.equal(S.spiritAttackBonus(null), 0);
  assert.equal(S.spiritDefenseBonus(undefined), 0);
  {
    const sp = { id: "x", grade: "rare", baseAttack: 10, baseDefense: 8, level: 1, experience: 0 };
    let prevA = -1, prevD = -1;
    for (let lv = 1; lv <= 100; lv += 1) {
      sp.level = lv;
      const a = S.spiritAttackBonus(sp), d = S.spiritDefenseBonus(sp);
      assert.equal(a, Math.round(10 * S.spiritLevelMultiplier(lv)));
      assert.equal(d, Math.round(8 * S.spiritLevelMultiplier(lv)));
      assert.ok(a >= prevA && d >= prevD, "레벨↑ 버프 비감소");
      prevA = a; prevD = d;
    }
  }

  // ── 경험치/레벨업 불변식 ──
  assert.ok(S.experienceForNextSpiritLevel(1) > 0);
  for (let lv = 1; lv < 100; lv += 1) assert.ok(S.experienceForNextSpiritLevel(lv + 1) >= S.experienceForNextSpiritLevel(lv), "요구 경험치 비감소");
  {
    const sp = { id: "y", grade: "common", baseAttack: 2, baseDefense: 2, level: 1, experience: 0 };
    assert.equal(S.gainSpiritExperience(sp, 0), 0, "0 경험치 = 레벨업 0");
    assert.equal(S.gainSpiritExperience(sp, -100), 0, "음수 경험치 = 변화 없음");
    assert.equal(sp.level, 1);
    assert.equal(sp.experience, 0);
    assert.equal(S.gainSpiritExperience(sp, S.experienceForNextSpiritLevel(1)), 1, "임계 = 정확히 1레벨");
    assert.equal(sp.level, 2);
    // 대량 경험치 후에도 잔여 경험치 < 다음 요구치(불변식)
    S.gainSpiritExperience(sp, 1_000_000);
    assert.ok(sp.experience < S.experienceForNextSpiritLevel(sp.level), "잔여 경험치 < 다음 요구치");
    assert.ok(sp.level > 2);
  }

  // ── 먹이 경험치 ──
  assert.ok(S.spiritFeedExperience({ grade: "common", level: 1 }) > 0);
  {
    // 등급↑·레벨↑ 일수록 더 많은 경험치(단조)
    let prev = -1;
    for (const g of GRADES) { const e = S.spiritFeedExperience({ grade: g.grade, level: 1 }); assert.ok(e > prev, "등급↑ 먹이 경험치↑"); prev = e; }
    assert.ok(S.spiritFeedExperience({ grade: "common", level: 5 }) > S.spiritFeedExperience({ grade: "common", level: 1 }), "레벨↑ 먹이 경험치↑");
    // 누적 경험치 = 현재 레벨까지 든 합 + 잔여
    const matLv1 = { grade: "common", level: 1, experience: 0 };
    assert.equal(S.spiritTotalExperience(matLv1), 0, "Lv1·0잔여 = 누적 0");
    const need = S.experienceForNextSpiritLevel(1) + S.experienceForNextSpiritLevel(2);
    const matLv3 = { grade: "rare", level: 3, experience: 7 };
    assert.equal(S.spiritTotalExperience(matLv3), need + 7, "Lv3 누적 = L1+L2 요구 + 잔여7");
    // 먹이 경험치는 누적의 80% 를 이어받는다(+ 등급 기본값). 키운 정령일수록 큰 보탬.
    const expected = (S.spiritGradeIndex("rare") + 1) * 20 + Math.round((need + 7) * 0.8);
    assert.equal(S.spiritFeedExperience(matLv3), expected, "먹이 = 등급기본 + 누적×0.8");
    // 손상 입력 방어(필드 누락)
    assert.equal(S.spiritTotalExperience({ grade: "common" }), 0, "필드 누락 안전");
    assert.ok(S.spiritFeedExperience({ grade: "common" }) > 0, "필드 누락에도 양수");
  }

  // ── normalizeSpiritCollection: 악의적/손상 입력 방어 ──
  assert.deepEqual(S.normalizeSpiritCollection(null), { owned: [], equippedId: null }, "null 안전");
  assert.deepEqual(S.normalizeSpiritCollection(undefined), { owned: [], equippedId: null }, "undefined 안전");
  assert.deepEqual(S.normalizeSpiritCollection({ owned: "nope", equippedId: 5 }), { owned: [], equippedId: null }, "비배열 owned·잘못된 id 안전");
  {
    const norm = S.normalizeSpiritCollection({
      owned: [
        { id: "ok", grade: "transcendent", baseAttack: 20, baseDefense: 19, level: 4, experience: 5 },
        { id: "evil", grade: "mythic", baseAttack: 9999, baseDefense: -50, level: -3, experience: Number.NaN },
        { id: "str", grade: "rare", baseAttack: "12", baseDefense: "x", level: "3", experience: "7" },
        { grade: "common" }, // id 없음 → 제외
        null, 42, "junk", // 쓰레기 → 제외
      ],
      equippedId: "ok",
    });
    assert.equal(norm.owned.length, 3, "유효 항목 3개만(id 없는/쓰레기 제외)");
    const evil = norm.owned.find((s) => s.id === "evil");
    assert.equal(evil.baseAttack, 20, "신화 상한 20으로 클램프(9999→20)");
    assert.equal(evil.baseDefense, 0, "음수 → 0");
    assert.equal(evil.level, 1, "음수 레벨 → 1");
    assert.equal(evil.experience, 0, "NaN 경험치 → 0");
    const str = norm.owned.find((s) => s.id === "str");
    assert.equal(str.baseAttack, 11, "문자열 숫자 파싱·희귀 상한 11 클램프('12'→11)");
    assert.equal(str.baseDefense, 6, "파싱 불가 'x' → 희귀 하한 6");
    assert.equal(str.level, 3, "문자열 레벨 파싱");
    assert.equal(norm.equippedId, "ok");
  }
  assert.equal(S.normalizeSpiritCollection({ owned: [], equippedId: "ghost" }).equippedId, null, "목록에 없는 장착 id → null");
  // 멱등성 — normalize(normalize(x)) === normalize(x)
  {
    const once = S.normalizeSpiritCollection({ owned: [{ id: "a", grade: "epic", baseAttack: 12, baseDefense: 10, level: 2, experience: 3 }], equippedId: "a" });
    const twice = S.normalizeSpiritCollection(once);
    assert.deepEqual(twice, once, "normalize 멱등");
  }

  // ── 조회 헬퍼 ──
  {
    const col = { owned: [{ id: "a", grade: "common", baseAttack: 1, baseDefense: 1, level: 1, experience: 0 }], equippedId: "a" };
    assert.equal(S.findSpirit(col, null), null);
    assert.equal(S.findSpirit(col, "missing"), null);
    assert.equal(S.equippedSpirit(col).id, "a");
    assert.equal(S.equippedSpirit({ owned: [], equippedId: null }), null);
  }

  console.log("spirits-test: OK (7 grades, adversarial)");
} finally {
  await server.close();
}
