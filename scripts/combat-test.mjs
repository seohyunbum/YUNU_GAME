import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const THREE = await import("three");
  const { applyMeleeDragonAttack, applyProjectileDamage, calculateCombatDamage, triangularRoll, varyPlayerDamage, varyMonsterDamage } = await server.ssrLoadModule("/src/game/combat.ts");
  const { PREDATOR_RETALIATE_MS } = await server.ssrLoadModule("/src/game/constants.ts");

  const cases = [
    { attack: 8, defense: 0, expected: 8, label: "unarmored target takes base damage" },
    { attack: 8, defense: 10, expected: 7, label: "small armor advantage reduces damage" },
    { attack: 8, defense: 19, expected: 3, label: "large armor advantage still allows chip damage" },
    { attack: 8, defense: 28, expected: 0, label: "armor gap of 20 fully blocks damage" },
    { attack: 40, defense: 50, expected: 20, label: "dragon-grade armor halves a weaker hit" },
    { attack: 80, defense: 25, expected: 85, label: "big attack advantage adds bonus damage" },
    { attack: 8.9, defense: 1.2, expected: 8, label: "fractional inputs are floored" },
    { attack: -5, defense: 0, expected: 1, label: "current legacy behavior preserves minimum nonblocked damage" },
    { attack: 0, defense: 100, expected: 0, label: "very high armor blocks zero attack" },
  ];

  for (const testCase of cases) {
    assert.equal(
      calculateCombatDamage(testCase.attack, testCase.defense),
      testCase.expected,
      testCase.label,
    );
  }

  const createRoot = (x = 0, y = 0, z = 0) => {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    return root;
  };

  function createProjectileContext(overrides = {}) {
    const calls = [];
    const context = {
      calls,
      playerPosition: new THREE.Vector3(1, 2, 3),
      playImpactSound: (kind) => calls.push(["sound", kind]),
      showMessage: (text) => calls.push(["message", text]),
      grantAnimalLoot: (target, actionLabel) => calls.push(["animalLoot", target.id, actionLabel]),
      removeObject: (id) => calls.push(["remove", id]),
      grantExperienceForTarget: (target) => calls.push(["experience", target.id]),
      renderHud: () => calls.push(["hud"]),
      rollRewardChance: () => false,
      grantRewardItem: (item, baseCount) => {
        calls.push(["reward", item, baseCount]);
        return baseCount;
      },
      bossStats: () => ({ name: "용", maxHp: 500, armor: 50 }),
      bossLockMessage: () => null,
      recordBossDefeat: (kind) => calls.push(["bossDefeat", kind]),
      dragonCounterAttack: (target) => calls.push(["dragonCounter", target.id]),
      playTone: (frequency) => calls.push(["tone", frequency]),
      updateBossBar: () => calls.push(["bossBar"]),
      rollDragonLoot: () => "dragon_scale",
      enrageVillage: (villageId, message) => calls.push(["enrage", villageId, message]),
      isVillageGuard: (target) => ["villageKnight", "villageArcher", "villageMage", "villageGolem"].includes(target.type),
      damagePlayer: (amount) => {
        calls.push(["damagePlayer", amount]);
        return false;
      },
      getLastDamage: () => ({ blocked: false, taken: 1 }),
      now: () => 1_000,
      ...overrides,
    };
    return context;
  }

  {
    const context = createProjectileContext();
    const animal = { id: "animal-1", type: "animal", name: "소", root: createRoot(), hp: 10 };
    applyProjectileDamage(context, animal, 3, "arrow");
    assert.equal(animal.hp, 7, "projectile damage reduces animal hp");
    assert.equal(animal.fleeUntil, 7_000, "animal flees for six seconds after projectile hit");
    assert.deepEqual(animal.fleeFrom.toArray(), [1, 2, 3], "animal flees from current player position");
    assert.notEqual(animal.fleeFrom, context.playerPosition, "animal flee position is cloned");
    assert.deepEqual(context.calls.map((call) => call[0]), ["sound", "message"], "nonlethal animal hit only plays sound and message");
  }

  {
    const context = createProjectileContext();
    const predator = { id: "predator-1", type: "wildPredator", name: "거미", root: createRoot(), hp: 2, predatorKind: "spider" };
    applyProjectileDamage(context, predator, 4, "magic");
    assert.equal(predator.hp, -2, "lethal predator hit applies raw projectile damage");
    assert.equal(predator.angryUntil, 1_000 + PREDATOR_RETALIATE_MS, "predator anger timeout is set from injected clock");
    assert.deepEqual(context.calls.map((call) => call[0]), ["sound", "remove", "message", "experience", "hud"], "lethal predator hit removes target and refreshes HUD");
  }

  {
    const context = createProjectileContext();
    const guard = {
      id: "guard-1",
      type: "villageKnight",
      name: "마을 기사",
      root: createRoot(1, 2, 3),
      hp: 10,
      armor: 0,
      attackRange: 5,
      attackDamage: 2,
      villageId: "village-1",
    };
    applyProjectileDamage(context, guard, 4, "arrow");
    assert.equal(guard.hp, 6, "nonlethal guard hit applies calculated damage");
    assert.deepEqual(
      context.calls.map((call) => call[0]),
      ["sound", "enrage", "damagePlayer", "message"],
      "guard hit enrages village and counterattacks when in range",
    );
  }

  {
    const context = createProjectileContext();
    const dragon = { id: "dragon-1", type: "dragon", name: "용", root: createRoot(), hp: 100, bossKind: "dragon" };
    applyMeleeDragonAttack(context, dragon, 40);
    assert.equal(dragon.hp, 80, "melee dragon hit applies armor-calculated damage");
    assert.deepEqual(context.calls.map((call) => call[0]), ["tone", "message", "dragonCounter"], "nonlethal melee dragon hit triggers counterattack");
  }

  {
    const context = createProjectileContext();
    const dragon = { id: "dragon-2", type: "dragon", name: "용", root: createRoot(), hp: 100, bossKind: "dragon" };
    applyMeleeDragonAttack(context, dragon, 30);
    assert.equal(dragon.hp, 100, "fully blocked melee hit leaves dragon hp unchanged");
    assert.deepEqual(context.calls.map((call) => call[0]), ["tone", "message", "dragonCounter"], "blocked melee dragon hit still counterattacks");
  }

  {
    const context = createProjectileContext();
    const dragon = { id: "dragon-3", type: "dragon", name: "용", root: createRoot(), hp: 10, bossKind: "dragon" };
    applyMeleeDragonAttack(context, dragon, 40);
    assert.deepEqual(
      context.calls.map((call) => call[0]),
      ["tone", "reward", "remove", "tone", "message", "experience", "bossDefeat", "bossBar"],
      "lethal melee dragon hit grants loot, records the chapter defeat, and refreshes boss bar",
    );
  }

  {
    const context = createProjectileContext({ bossLockMessage: () => "봉인되어 있습니다." });
    const dragon = { id: "dragon-4", type: "dragon", name: "파이어 드래곤", root: createRoot(), hp: 100, bossKind: "fire_dragon" };
    applyMeleeDragonAttack(context, dragon, 40);
    assert.equal(dragon.hp, 100, "sealed boss takes no melee damage");
    assert.deepEqual(context.calls.map((call) => call[0]), ["message"], "sealed boss melee hit only shows the lock message");
    applyProjectileDamage(context, dragon, 40, "arrow");
    assert.equal(dragon.hp, 100, "sealed boss takes no projectile damage");
    assert.deepEqual(
      context.calls.map((call) => call[0]),
      ["message", "sound", "message"],
      "sealed boss projectile hit shows the lock message without counterattack",
    );
  }

  // ── 데미지 랜덤 변동(삼각분포) ──
  {
    // 경계: rng→0 이면 최저(min), rng→1 이면 최고(max).
    assert.equal(triangularRoll(0.8, 1.0, 2.0, () => 0), 0.8, "triangular rng=0 returns min");
    assert.equal(triangularRoll(0.8, 1.0, 2.0, () => 1), 2.0, "triangular rng=1 returns max");
    // u=c(=(mode-min)/(max-min)) 에서 정확히 mode 로 연속.
    const cPlayer = (1.0 - 0.8) / (2.0 - 0.8);
    assert.ok(Math.abs(triangularRoll(0.8, 1.0, 2.0, () => cPlayer) - 1.0) < 1e-9, "triangular at u=c equals mode");
    assert.equal(triangularRoll(5, 5, 5, () => 0.4), 5, "degenerate range returns the point");

    // 플레이어 80%~200%: 경계·최빈·범위·하한.
    assert.equal(varyPlayerDamage(100, () => 0), 80, "player damage floor = 80% (rng=0)");
    assert.equal(varyPlayerDamage(100, () => 1), 200, "player damage ceil = 200% (rng=1)");
    assert.equal(varyPlayerDamage(100, () => cPlayer), 100, "player damage mode ≈ 100% (rng=c)");
    assert.equal(varyPlayerDamage(0, () => 0.5), 0, "no base → no damage (player)");
    assert.equal(varyPlayerDamage(1, () => 0), 1, "player damage never drops below 1");

    // 몬스터 80%~130%.
    assert.equal(varyMonsterDamage(100, () => 0), 80, "monster damage floor = 80% (rng=0)");
    assert.equal(varyMonsterDamage(100, () => 1), 130, "monster damage ceil = 130% (rng=1)");
    assert.equal(varyMonsterDamage(0, () => 0.5), 0, "no base → no damage (monster)");
    assert.equal(varyMonsterDamage(-5, () => 0.9), 0, "negative base → 0 (monster)");
    assert.equal(varyMonsterDamage(1, () => 0), 1, "monster damage never drops below 1");

    // 퍼징: 결정적 LCG 로 1만 표본 — 항상 범위 내 + 우편향(평균>base) 검증.
    let seed = 123456789;
    const rng = () => { seed = (1103515245 * seed + 12345) % 2147483648; return seed / 2147483648; };
    let pSum = 0, mSum = 0; const N = 10000;
    for (let i = 0; i < N; i++) {
      const p = varyPlayerDamage(1000, rng);
      const m = varyMonsterDamage(1000, rng);
      assert.ok(p >= 800 && p <= 2000, `player roll in [800,2000] (got ${p})`);
      assert.ok(m >= 800 && m <= 1300, `monster roll in [800,1300] (got ${m})`);
      pSum += p; mSum += m;
    }
    const pMean = pSum / N / 1000, mMean = mSum / N / 1000;
    // 삼각분포 기대 평균 = (min+mode+max)/3 → player 1.267, monster 1.033. 우편향이라 mode(1.0)보다 큼.
    assert.ok(pMean > 1.18 && pMean < 1.36, `player mean ~1.27 right-skewed (got ${pMean.toFixed(3)})`);
    assert.ok(mMean > 1.0 && mMean < 1.07, `monster mean ~1.03 right-skewed (got ${mMean.toFixed(3)})`);
  }

  console.log(JSON.stringify({
    ok: true,
    checks: [
      ...cases.map((testCase) => testCase.label),
      "projectile animal hit behavior",
      "projectile predator defeat behavior",
      "projectile guard counterattack behavior",
      "melee dragon attack behavior",
      "sealed boss blocks melee and projectile damage",
      "damage variance: triangular boundaries + player 80-200% + monster 80-130% + skew",
    ],
  }, null, 2));
} finally {
  await server.close();
}
