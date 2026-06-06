import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const migration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");

  const {
    migrateSaveData,
    experienceForNextLevel,
    maxHealthForLevel,
  } = migration;
  const {
    BASE_MAX_MANA,
    DAY_LENGTH_SECONDS,
    EXTENDED_WORKBENCH_SLOT_COUNT,
    HUNGER_MAX,
    HUNGER_TICK_SECONDS,
    SAVE_BUILD_ID,
    SAVE_VERSION,
    WORLD_SIZE,
  } = constants;

  assert.equal(experienceForNextLevel(10), 1007, "level 10 xp requirement should stay stable");

  const legacy = migrateSaveData({
    version: 1,
    savedAt: "2026-01-01T00:00:00.000Z",
    player: {
      position: { x: 10, y: 2, z: 20 },
      health: 7,
      maxHealth: 10,
      level: 12,
      experience: 42,
      playerClass: "unknown-class",
      hungerTimer: 9999,
      totalSteps: -10,
      chestStepBank: -4,
      caveStepBank: 30,
      locationMode: "moon",
      currentHouseKind: "castle",
      selectedHotbarIndex: 99,
      hotbar: [
        { item: "tutorial_book", count: 1 },
        { item: "stone_pickaxe", count: 2 },
        { item: "wood", count: -1 },
      ],
      bagSlots: [{ item: "iron_axe", count: 1, durabilityUsed: 3 }],
      toolUses: { stone_pickaxe: 7 },
    },
    mountains: [
      { position: { x: 1, y: 2, z: 3 }, radius: 999, height: -4 },
      { position: { x: Number.NaN, y: 0, z: 0 }, radius: 10, height: 10 },
    ],
    objects: [
      { type: "dragon", name: "old dragon", position: { x: 1, y: 2, z: 3 }, bossKind: "dragon" },
      { type: "broken", name: "broken" },
    ],
  });

  assert.equal(legacy.version, SAVE_VERSION);
  assert.equal(legacy.buildId, SAVE_BUILD_ID);
  assert.equal(legacy.migratedFromVersion, 1);
  assert.equal(legacy.player.playerClass, "warrior");
  assert.equal(legacy.player.maxMana, BASE_MAX_MANA);
  assert.equal(legacy.player.mana, BASE_MAX_MANA);
  assert.equal(legacy.player.classSkillCooldownRemainingMs, 0);
  assert.equal(legacy.player.level, 12);
  assert.equal(legacy.player.experience, 42);
  assert.equal(legacy.player.maxHealth, maxHealthForLevel(12));
  assert.equal(legacy.player.health, 7);
  assert.equal(legacy.player.hunger, HUNGER_MAX);
  assert.equal(legacy.player.hungerTimer, HUNGER_TICK_SECONDS);
  assert.equal(legacy.player.worldTimeSeconds, DAY_LENGTH_SECONDS * (8 / 24));
  assert.equal(legacy.player.totalSteps, 0);
  assert.equal(legacy.player.chestStepBank, 0);
  assert.equal(legacy.player.caveStepBank, 30);
  assert.equal(legacy.player.locationMode, "overworld");
  assert.equal(legacy.player.currentHouseKind, "home");
  assert.equal(legacy.player.selectedHotbarIndex, 7);
  assert.equal(legacy.player.hotbar.length, 8);
  assert.deepEqual(legacy.player.hotbar[1], { item: "stone_pickaxe", count: 1, durabilityUsed: 7 });
  assert.deepEqual(legacy.player.hotbar[2], { item: "stone_pickaxe", count: 1 });
  assert.deepEqual(legacy.player.hotbar[3], { item: null, count: 0 });
  assert.deepEqual(legacy.player.bagSlots[0], { item: "iron_axe", count: 1, durabilityUsed: 3 });
  assert.equal(legacy.player.craftSlots.length, 4);
  assert.equal(legacy.player.workbenchSlots.length, EXTENDED_WORKBENCH_SLOT_COUNT);
  assert.deepEqual(legacy.player.toolUses, {});
  assert.equal(legacy.mountains.length, 1);
  assert.equal(legacy.mountains[0].radius, 160);
  assert.equal(legacy.mountains[0].height, 1);
  assert.equal(legacy.objects.length, 1);
  assert.equal(legacy.objects[0].type, "dragon");

  const current = migrateSaveData({
    version: SAVE_VERSION,
    savedAt: "2026-06-06T00:00:00.000Z",
    player: {
      position: { x: 99999, y: 99999, z: -99999 },
      previousPosition: { x: 4, y: 5, z: 6 },
      yaw: 99,
      pitch: 99,
      health: 999,
      maxHealth: 30,
      level: 5,
      experience: 12,
      playerClass: "mage",
      mana: 999,
      maxMana: 120,
      classSkillCooldownRemainingMs: 999_999_999,
      hunger: -2,
      hungerTimer: -1,
      worldTimeSeconds: 999_999,
      totalSteps: 3,
      chestStepBank: 4,
      caveStepBank: 5,
      equippedArmor: "diamond_armor",
      locationMode: "cave",
      currentHouseKind: "twoStory",
      caveReturnPosition: { x: 7, y: 8, z: 9 },
      houseReturnPosition: { x: 1, y: 2, z: 3 },
      selectedHotbarIndex: -3,
      hotbar: [{ item: "magic_wand", count: 1, durabilityUsed: 2 }],
      bagSlots: [],
      craftSlots: [],
      workbenchSlots: [],
    },
    mountains: [],
    objects: [],
  });

  assert.equal(current.migratedFromVersion, undefined);
  assert.equal(current.player.position.x, WORLD_SIZE * 2);
  assert.equal(current.player.position.y, 2000);
  assert.equal(current.player.position.z, -WORLD_SIZE * 2);
  assert.deepEqual(current.player.previousPosition, { x: 4, y: 5, z: 6 });
  assert.equal(current.player.pitch, 1.32);
  assert.equal(current.player.health, current.player.maxHealth);
  assert.equal(current.player.playerClass, "mage");
  assert.equal(current.player.maxMana, 120);
  assert.equal(current.player.mana, 120);
  assert.equal(current.player.classSkillCooldownRemainingMs, 24 * 60 * 60 * 1000);
  assert.equal(current.player.hunger, 0);
  assert.equal(current.player.hungerTimer, 0);
  assert.equal(current.player.worldTimeSeconds, DAY_LENGTH_SECONDS);
  assert.equal(current.player.selectedHotbarIndex, 0);
  assert.equal(current.player.hotbar.length, 8);
  assert.deepEqual(current.player.hotbar[0], { item: "magic_wand", count: 1 });
  assert.equal(current.player.locationMode, "cave");
  assert.equal(current.player.currentHouseKind, "twoStory");

  assert.throws(
    () => migrateSaveData({ version: SAVE_VERSION + 1, player: {} }),
    /Unsupported save version/,
  );
  assert.throws(
    () => migrateSaveData({ version: 1 }),
    /missing player/i,
  );

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "legacy v1 defaults and clamps",
      "legacy durable toolUses migration",
      "current version clamps without migratedFromVersion",
      "future/missing saves rejected",
    ],
  }, null, 2));
} finally {
  await server.close();
}
