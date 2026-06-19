import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function findBrowserPath() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  throw new Error("No local Chrome or Edge executable was found.");
}

function roundVector(vector) {
  return {
    x: Number(vector.x.toFixed(3)),
    y: Number(vector.y.toFixed(3)),
    z: Number(vector.z.toFixed(3)),
  };
}

function stableSaveShape(save) {
  return {
    player: {
      position: roundVector(save.player.position),
      yaw: Number(save.player.yaw.toFixed(4)),
      pitch: Number(save.player.pitch.toFixed(4)),
      health: save.player.health,
      maxHealth: save.player.maxHealth,
      level: save.player.level,
      experience: save.player.experience,
      playerClass: save.player.playerClass,
      mana: save.player.mana,
      maxMana: save.player.maxMana,
      companionProgress: save.player.companionProgress,
      hunger: save.player.hunger,
      hungerTimer: save.player.hungerTimer,
      worldTimeSeconds: save.player.worldTimeSeconds,
      worldMapId: save.player.worldMapId,
      bossChapter: save.player.bossChapter,
      defeatedFieldBosses: save.player.defeatedFieldBosses,
      totalSteps: save.player.totalSteps,
      playSeconds: save.player.playSeconds,
      chestStepBank: save.player.chestStepBank,
      caveStepBank: save.player.caveStepBank,
      equippedArmor: save.player.equippedArmor,
      equippedShield: save.player.equippedShield,
      equippedNecklace: save.player.equippedNecklace,
      shieldDurabilityUsed: save.player.shieldDurabilityUsed,
      ironGuardRemainingSeconds: Math.round((save.player.ironGuardRemainingMs ?? 0) / 1000),
      secondSkillCooldownRemainingSeconds: Math.round((save.player.secondSkillCooldownRemainingMs ?? 0) / 1000),
      thirdSkillCooldownRemainingSeconds: Math.round((save.player.thirdSkillCooldownRemainingMs ?? 0) / 1000),
      jobTier: save.player.jobTier,
      trainingStats: save.player.trainingStats,
      locationMode: save.player.locationMode,
      currentHouseKind: save.player.currentHouseKind,
      currentHouseOwned: save.player.currentHouseOwned,
      homeStorage: (save.player.homeStorage ?? []).filter((slot) => slot.item),
      homeSupplyCooldowns: { ...(save.player.homeSupplyCooldowns ?? {}) },
      selectedHotbarIndex: save.player.selectedHotbarIndex,
      hotbar: save.player.hotbar,
      bagSlots: save.player.bagSlots,
      craftSlots: save.player.craftSlots,
      workbenchSlots: save.player.workbenchSlots.filter((slot) => slot.item),
    },
    mountains: save.mountains.map((mountain) => ({
      position: roundVector(mountain.position),
      radius: mountain.radius,
      height: mountain.height,
    })),
    droppedItems: save.objects
      .filter((object) => object.type === "droppedItem")
      .map((object) => ({
        position: roundVector(object.position),
        droppedItem: object.droppedItem,
        droppedCount: object.droppedCount,
      })),
    worldStates: Object.fromEntries(Object.entries(save.worldStates ?? {}).sort().map(([id, state]) => [id, {
      mountains: state.mountains.map((mountain) => ({
        position: roundVector(mountain.position),
        radius: mountain.radius,
        height: mountain.height,
      })),
      droppedItems: state.objects
        .filter((object) => object.type === "droppedItem")
        .map((object) => ({
          position: roundVector(object.position),
          droppedItem: object.droppedItem,
          droppedCount: object.droppedCount,
        })),
    }])),
  };
}

const server = await createServer({
  logLevel: "silent",
  server: {
    host: "127.0.0.1",
    port: 0,
  },
});

let browser;
try {
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error("Vite server did not expose a local URL.");

  browser = await chromium.launch({
    executablePath: await findBrowserPath(),
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => localStorage.setItem("ai-game-lab:nickname-v1", "테스터"));
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__wildernessGame), null, { timeout: 10_000 });
  await page.click('[data-class-choice="mage"]');
  await page.click("[data-title-new]");
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const game = window.__wildernessGame;
    game.resetGameState({ reseed: false });

    game.playerPosition.set(12.5, 1.7, -34.25);
    game.previousPosition.copy(game.playerPosition);
    game.yaw = 0.75;
    game.pitch = -0.22;
    game.health = 18;
    game.maxHealth = 40;
    game.level = 5;
    game.experience = 123;
    game.playerClass = "tanker";
    game.pendingPlayerClass = "tanker";
    game.jobTier = 1;
    game.mana = 42;
    game.maxMana = 120;
    game.summonerCompanion.restore({ summoner: { level: 4, experience: 17 } });
    game.hunger = 3;
    game.hungerTimer = 77;
    game.worldTimeSeconds = 2400;
    game.currentWorldMapId = "mushroom_glen";
    game.totalSteps = 321;
    game.playSeconds = 4567;
    game.chestStepBank = 22;
    game.caveStepBank = 33;
    game.arcadePoints = 8765;
    game.equippedArmor = "diamond_armor";
    game.equippedShield = "iron_shield";
    game.equippedNecklace = "swift_necklace";
    game.shieldDurabilityUsed = 12;
    game.ironGuardUntil = performance.now() + 43_000;
    game.secondSkillCooldownUntil = performance.now() + 27_000;
    game.thirdSkillCooldownUntil = performance.now() + 31_000;
    game.trainingStats = { hp: 3, attack: 5, armor: 2, mana: 1 };
    game.locationMode = "overworld";
    game.currentHouseKind = "twoStory";
    game.currentHouseOwned = true;
    game.homeStorage[0] = { item: "diamond", count: 3 };
    game.homeStorage[5] = { item: "iron_axe", count: 1, durabilityUsed: 11 };
    game.homeSupplyCooldowns = { stone: 754 };
    game.selectedHotbarIndex = 2;

    game.hotbar.splice(
      0,
      game.hotbar.length,
      { item: "tutorial_book", count: 1 },
      { item: "diamond_pickaxe", count: 1, durabilityUsed: 7 },
      { item: "magic_wand", count: 1 },
      { item: "meat", count: 6 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
    );
    game.bagSlots.splice(
      0,
      game.bagSlots.length,
      { item: "iron", count: 4 },
      { item: "gold_powder", count: 9 },
      { item: "water_bucket", count: 2 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
    );

    game.craftSlots[0] = { item: "wood", count: 1 };
    game.craftSlots[1] = { item: "stick", count: 2 };
    game.craftSlots[2] = { item: null, count: 0 };
    game.craftSlots[3] = { item: "hammer", count: 1 };
    for (const slot of game.workbenchSlots) {
      slot.item = null;
      slot.count = 0;
      delete slot.durabilityUsed;
    }
    game.workbenchSlots[0] = { item: "refined_wood", count: 2 };
    game.workbenchSlots[8] = { item: "stone", count: 5 };

    const mountainPosition = game.playerPosition.clone();
    mountainPosition.set(40, 0, -40);
    game.spawnMountain(mountainPosition, 32, 8);

    const dropPosition = game.playerPosition.clone();
    dropPosition.z -= 3;
    game.spawnDroppedItem("hammer", 2, dropPosition);
    game.worldStates.dragon_lands = {
      mountains: [{ position: { x: 300, y: 0, z: -310 }, radius: 44, height: 12 }],
      objects: [{ type: "droppedItem", name: "다른 맵 전리품", position: { x: 301, y: 1.7, z: -312 }, droppedItem: "diamond", droppedCount: 3 }],
    };

    const before = game.createSaveData();
    game.restoreSaveData(before);
    const after = game.createSaveData();
    // 익스플로잇 회귀 가드: 로드는 포인트를 세이브 시점 값으로 롤백한다(판매로 번 포인트가 로드로 복제되지 않게).
    game.arcadePoints = 999999;
    game.restoreSaveData(before);
    const arcadePointsAfterReload = game.arcadePoints;
    return { before, after, arcadePointsAfterReload };
  });

  assert.deepEqual(stableSaveShape(result.after), stableSaveShape(result.before));
  assert.equal(result.before.player.arcadePoints, 8765, "arcadePoints must be persisted inside the save");
  assert.equal(result.arcadePointsAfterReload, 8765, "loading must roll arcadePoints back to the saved value (sell→load point-dupe exploit guard)");
  assert.deepEqual(browserErrors, []);

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "player stats roundtrip",
      "hotbar/bag/crafting slots roundtrip",
      "mountain roundtrip",
      "dropped item roundtrip",
      "world map state roundtrip",
      "home storage and supply cooldown roundtrip",
    ],
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
