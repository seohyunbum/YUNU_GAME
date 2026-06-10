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
  const worldMaps = await server.ssrLoadModule("/src/game/worldMaps.ts");

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
    IRON_GUARD_DURATION_SECONDS,
    SAVE_BUILD_ID,
    SAVE_VERSION,
    WORLD_SIZE,
  } = constants;
  const { DEFAULT_WORLD_MAP_ID } = worldMaps;

  assert.equal(experienceForNextLevel(10), 503, "level 10 xp requirement should stay stable");

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
  assert.equal(legacy.player.equippedShield, null);
  assert.equal(legacy.player.shieldDurabilityUsed, 0);
  assert.equal(legacy.player.ironGuardRemainingMs, 0);
  assert.deepEqual(legacy.player.companionProgress, { summoner: { level: 1, experience: 0 } });
  assert.equal(legacy.player.level, 12);
  assert.equal(legacy.player.experience, 42);
  assert.equal(legacy.player.maxHealth, maxHealthForLevel(12));
  assert.equal(legacy.player.health, 7);
  assert.equal(legacy.player.hunger, HUNGER_MAX);
  assert.equal(legacy.player.hungerTimer, HUNGER_TICK_SECONDS);
  assert.equal(legacy.player.worldTimeSeconds, DAY_LENGTH_SECONDS * (8 / 24));
  assert.equal(legacy.player.worldMapId, DEFAULT_WORLD_MAP_ID);
  assert.equal(legacy.player.bossChapter, 0);
  assert.deepEqual(legacy.player.defeatedFieldBosses, []);
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
  assert.equal(legacy.worldStates[DEFAULT_WORLD_MAP_ID].mountains.length, 1);
  assert.equal(legacy.worldStates[DEFAULT_WORLD_MAP_ID].objects.length, 1);

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
      companionProgress: { summoner: { level: -4, experience: -99 } },
      hunger: -2,
      hungerTimer: -1,
      worldTimeSeconds: 999_999,
      worldMapId: "snowfield",
      bossChapter: 99,
      defeatedFieldBosses: ["boss_snowfield", "fake_boss", "boss_snowfield"],
      tutorial: { completedStepIds: ["gather_wood"], achievedStepIds: ["find_hammer"] },
      totalSteps: 3,
      chestStepBank: 4,
      caveStepBank: 5,
      equippedArmor: "diamond_armor",
      equippedShield: "iron_shield",
      shieldDurabilityUsed: 999,
      ironGuardRemainingMs: 999_999,
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
    worldStates: {
      dragon_lands: {
        mountains: [{ position: { x: 3, y: 0, z: 4 }, radius: 12, height: 5 }],
        objects: [
          { type: "droppedItem", name: "drop", position: { x: 1, y: 2, z: 3 }, droppedItem: "hammer", droppedCount: 1 },
          { type: "broken" },
        ],
      },
      not_a_map: { mountains: [{ broken: true }], objects: [{ type: "chest" }] },
    },
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
  assert.equal(current.player.equippedShield, "iron_shield");
  assert.equal(current.player.shieldDurabilityUsed, 200);
  assert.equal(current.player.ironGuardRemainingMs, IRON_GUARD_DURATION_SECONDS * 1000);
  assert.deepEqual(current.player.companionProgress, { summoner: { level: 1, experience: 0 } });
  assert.equal(current.player.hunger, 0);
  assert.equal(current.player.hungerTimer, 0);
  assert.equal(current.player.worldTimeSeconds, DAY_LENGTH_SECONDS);
  assert.equal(current.player.worldMapId, "snowfield");
  assert.equal(current.player.bossChapter, 6);
  assert.deepEqual(current.player.defeatedFieldBosses, ["boss_snowfield"]);
  assert.deepEqual(current.player.tutorial, { completedStepIds: ["gather_wood"], achievedStepIds: ["find_hammer", "gather_wood"] });
  assert.equal(current.player.selectedHotbarIndex, 0);
  assert.equal(current.player.hotbar.length, 8);
  assert.deepEqual(current.player.hotbar[0], { item: "magic_wand", count: 1 });
  assert.equal(current.player.locationMode, "cave");
  assert.equal(current.player.currentHouseKind, "twoStory");
  assert.equal(current.worldStates.snowfield.mountains.length, 0);
  assert.equal(current.worldStates.dragon_lands.mountains[0].radius, 12);
  assert.equal(current.worldStates.dragon_lands.objects.length, 1);
  assert.equal(current.worldStates.dragon_lands.objects[0].droppedItem, "hammer");
  assert.equal(current.worldStates.not_a_map, undefined);

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
      "world state migration",
      "current version clamps without migratedFromVersion",
      "future/missing saves rejected",
    ],
  }, null, 2));
} finally {
  await server.close();
}
