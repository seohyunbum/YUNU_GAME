// 정령 시스템 순수 로직 — 등급 추첨·능력치 롤·레벨업·먹이·버프 계산·세이브 정규화.
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const S = await server.ssrLoadModule("/src/game/spirits.ts");

  // 등급 가중치 합 = 100
  const total = S.SPIRIT_GRADES.reduce((s, g) => s + g.weight, 0);
  assert.equal(total, 100, "가챠 가중치 합 100%");

  // rollSpiritGrade — 경계
  assert.equal(S.rollSpiritGrade(0), "common", "rand 0 = 일반");
  assert.equal(S.rollSpiritGrade(0.999), "legendary", "rand 1 근처 = 전설");
  // 0.48 직후는 고급(누적 48% 경계)
  assert.equal(S.rollSpiritGrade(0.49), "uncommon");

  // rollSpiritStat — 범위 경계
  assert.equal(S.rollSpiritStat("common", 0), 0, "일반 하한 0");
  assert.equal(S.rollSpiritStat("common", 1), 5, "일반 상한 5");
  assert.equal(S.rollSpiritStat("legendary", 0), 12, "전설 하한 12");
  assert.equal(S.rollSpiritStat("legendary", 1), 17, "전설 상한 17");
  assert.equal(S.rollSpiritStat("rare", 0.5), 9, "희귀 중간 6+round(0.5*5)=6+3=9");

  // createSpirit
  const sp = S.createSpirit("sp1", { grade: 0.999, attack: 1, defense: 0 });
  assert.equal(sp.grade, "legendary");
  assert.equal(sp.baseAttack, 17);
  assert.equal(sp.baseDefense, 12);
  assert.equal(sp.level, 1);
  assert.equal(sp.experience, 0);

  // 레벨 배수 + 버프 — Lv1 = base, 레벨당 +2%
  assert.equal(S.spiritLevelMultiplier(1), 1);
  assert.equal(S.spiritLevelMultiplier(11), 1.2, "Lv11 = +20%");
  const s10 = { id: "x", grade: "rare", baseAttack: 10, baseDefense: 8, level: 11, experience: 0 };
  assert.equal(S.spiritAttackBonus(s10), 12, "10 × 1.2 = 12");
  assert.equal(S.spiritDefenseBonus(s10), 10, "8 × 1.2 = 9.6 → 10");
  assert.equal(S.spiritAttackBonus(null), 0, "미장착 0");

  // 경험치 레벨업
  const lvl = { id: "y", grade: "common", baseAttack: 2, baseDefense: 2, level: 1, experience: 0 };
  const need1 = S.experienceForNextSpiritLevel(1);
  const ups = S.gainSpiritExperience(lvl, need1);
  assert.equal(ups, 1, "정확히 한 레벨");
  assert.equal(lvl.level, 2);
  assert.equal(lvl.experience, 0);
  // 큰 경험치 = 여러 레벨
  const big = { id: "z", grade: "common", baseAttack: 1, baseDefense: 1, level: 1, experience: 0 };
  const ups2 = S.gainSpiritExperience(big, 100000);
  assert.ok(ups2 >= 3, "대량 경험치 다중 레벨업");

  // 먹이 경험치 — 등급·레벨↑ 일수록 큼
  const feedLow = S.spiritFeedExperience({ id: "a", grade: "common", baseAttack: 0, baseDefense: 0, level: 1, experience: 0 });
  const feedHigh = S.spiritFeedExperience({ id: "b", grade: "legendary", baseAttack: 0, baseDefense: 0, level: 5, experience: 0 });
  assert.ok(feedHigh > feedLow, "고등급·고레벨 먹이가 더 많은 경험치");
  assert.equal(feedLow, 25, "일반 Lv1 = (0+1)*25 + 0");

  // 세이브 정규화 — 손상·구버전 방어
  const norm = S.normalizeSpiritCollection({ owned: [
    { id: "ok", grade: "epic", baseAttack: 12, baseDefense: 9, level: 3, experience: 5 },
    { id: "bad-grade", grade: "mythic", baseAttack: 99, baseDefense: -3, level: 0, experience: -1 },
    { grade: "common" }, // id 없음 → 제외
  ], equippedId: "ok" });
  assert.equal(norm.owned.length, 2, "id 없는 항목 제외");
  assert.equal(norm.equippedId, "ok");
  const bad = norm.owned.find((s) => s.id === "bad-grade");
  assert.equal(bad.grade, "common", "알 수 없는 등급 → 일반");
  assert.equal(bad.baseAttack, 5, "일반 상한 5로 클램프(99→5)");
  assert.equal(bad.baseDefense, 0, "음수 → 0");
  assert.equal(bad.level, 1, "0 레벨 → 1");
  // 장착 id 가 목록에 없으면 null
  const norm2 = S.normalizeSpiritCollection({ owned: [], equippedId: "ghost" });
  assert.equal(norm2.equippedId, null);

  console.log("spirits-test: OK");
} finally {
  await server.close();
}
