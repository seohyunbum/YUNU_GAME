// 난이도(쉬움/어려움) 순수 로직 테스트 — 배율·몬스터 능치 보정·상점 가격·세이브 라운드트립 보조.
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const {
    DEFAULT_DIFFICULTY,
    DIFFICULTY_MODIFIERS,
    difficultyModifiers,
    isDifficultyMode,
    difficultyLabel,
    applyMonsterDifficulty,
    difficultyShopCost,
  } = await server.ssrLoadModule("/src/game/difficulty.ts");

  // 디폴트는 쉬움
  assert.equal(DEFAULT_DIFFICULTY, "easy", "기본 난이도는 쉬움");

  // 쉬움 = 모든 배율 1.0 (현재 세팅 보존)
  for (const [key, value] of Object.entries(DIFFICULTY_MODIFIERS.easy)) {
    assert.equal(value, 1, `쉬움 배율 ${key} 은 1.0 이어야 함(현재 세팅 = 쉬움)`);
  }

  // 어려움 배율 — 스펙 그대로
  const hard = DIFFICULTY_MODIFIERS.hard;
  assert.equal(hard.monsterHp, 1.5, "체력 +50%");
  assert.equal(hard.monsterAttack, 1.3, "공격 +30%");
  assert.equal(hard.monsterDefense, 1.3, "방어 +30%");
  assert.equal(hard.monsterChaseSpeed, 1.3, "추격속도 +30%");
  assert.equal(hard.questExp, 0.6, "퀘스트 경험치 −40%");
  assert.equal(hard.dropChance, 0.5, "드랍률 −50%");
  assert.equal(hard.xpPotion, 0.5, "경험치병 −50%");
  assert.equal(hard.shopPrice, 3, "상점 가격 +200%(×3)");

  assert.equal(isDifficultyMode("easy"), true);
  assert.equal(isDifficultyMode("hard"), true);
  assert.equal(isDifficultyMode("insane"), false);
  assert.equal(isDifficultyMode(undefined), false);
  assert.equal(difficultyModifiers("insane").monsterHp, 1, "알 수 없는 모드는 쉬움으로 폴백");
  assert.equal(difficultyLabel("easy"), "쉬움");
  assert.equal(difficultyLabel("hard"), "어려움");

  // 쉬움은 몬스터 능치를 바꾸지 않는다(항등)
  const easyMob = { hp: 100, attackDamage: 10, armor: 18 };
  applyMonsterDifficulty(easyMob, difficultyModifiers("easy"));
  assert.deepEqual(easyMob, { hp: 100, attackDamage: 10, armor: 18 }, "쉬움은 능치 항등");

  // 어려움은 hp×1.5, attack×1.3, armor×1.3
  const hardMob = { hp: 100, attackDamage: 10, armor: 18 };
  applyMonsterDifficulty(hardMob, hard);
  assert.equal(hardMob.hp, 150, "어려움 hp 150");
  assert.equal(hardMob.attackDamage, 13, "어려움 attack 13");
  assert.equal(hardMob.armor, 23, "어려움 armor 18×1.3=23(반올림)");

  // armor 0 인 포식자는 방어 배율이 0 으로 유지(곱이라 무효과)
  const predator = { hp: 65, attackDamage: 6, armor: 0 };
  applyMonsterDifficulty(predator, hard);
  assert.equal(predator.armor, 0, "armor 0 은 ×1.3 도 0");
  assert.equal(predator.hp, 98, "65×1.5=97.5→98");

  // 누락 필드는 건드리지 않음(undefined 안전)
  const partial = { hp: 50 };
  applyMonsterDifficulty(partial, hard);
  assert.equal(partial.hp, 75);
  assert.equal(partial.attackDamage, undefined);

  // 상점 가격: 쉬움 = 그대로, 어려움 = ×3
  assert.equal(difficultyShopCost(160, difficultyModifiers("easy")), 160);
  assert.equal(difficultyShopCost(160, hard), 480, "160P → 480P");
  assert.equal(difficultyShopCost(50, hard), 150);

  console.log("difficulty-test: OK");
} finally {
  await server.close();
}
