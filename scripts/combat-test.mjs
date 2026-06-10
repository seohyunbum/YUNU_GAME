import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const THREE = await import("three");
  const { applyProjectileDamage, calculateCombatDamage } = await server.ssrLoadModule("/src/game/combat.ts");
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

  console.log(JSON.stringify({
    ok: true,
    checks: [
      ...cases.map((testCase) => testCase.label),
      "projectile animal hit behavior",
      "projectile predator defeat behavior",
      "projectile guard counterattack behavior",
    ],
  }, null, 2));
} finally {
  await server.close();
}
