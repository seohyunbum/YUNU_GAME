import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH, // 명시 오버라이드 최우선
  "/opt/pw-browsers/chromium", // 리눅스 원격 세션 프리인스톨 Chromium(심링크)
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

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
      fortressStageByMap: { ...(save.player.fortressStageByMap ?? {}) },
      materialsSold: save.player.materialsSold,
      shopPurchases: save.player.shopPurchases,
      antStepBank: save.player.antStepBank,
      totalSteps: save.player.totalSteps,
      playSeconds: save.player.playSeconds,
      chestStepBank: save.player.chestStepBank,
      caveStepBank: save.player.caveStepBank,
      equippedArmor: save.player.equippedArmor,
      equippedShield: save.player.equippedShield,
      equippedNecklace: save.player.equippedNecklace,
      equippedDragonGear: save.player.equippedDragonGear,
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

  browser = await chromium.launch({ args: ["--no-sandbox"], /* 컨테이너 루트 헤드리스 필수 · 윈도우선 무해 */
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
    game.fortressStageByMap = { mushroom_glen: 4, dragon_lands: 2 };
    game.tutorialSignals.materialsSold = 2;
    game.tutorialSignals.shopPurchases = 1;
    game.antStepBank = 37;
    game.totalSteps = 321;
    game.playSeconds = 4567;
    game.chestStepBank = 22;
    game.caveStepBank = 33;
    game.arcadePoints = 8765;
    game.equippedArmor = "diamond_armor";
    game.equippedShield = "iron_shield";
    game.equippedNecklace = "swift_necklace";
    game.dragonGearEquipped = { gloves: true, boots: false, cloak: true, crown: false };
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

    // spawnDroppedItem 은 leaf(droppedItemSpawns)로 추출돼 GameClient 메서드가 아님 — 실사용 드랍 경로로 대체
    const tempDropSlot = { item: "hammer", count: 2 };
    game.dropItemFromSlot(tempDropSlot);
    game.dropItemFromSlot(tempDropSlot);
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
    // 요새 단계 회귀 가드: 로드가 맵별 진행을 지우지 않는다(전엔 resetGameState 가 로드마다 {} 리셋 → 매번 1단계부터).
    const fortressAfterReload = { ...game.fortressStageByMap };
    // 구세이브(필드 없음) 백필: 요새 방문 증거(visit_fortress)가 있으면 로드 직전 in-memory(=localStorage 미러) 진행을 유지한다.
    const legacySave = JSON.parse(JSON.stringify(before));
    delete legacySave.player.fortressStageByMap;
    legacySave.player.tutorial.completedStepIds.push("visit_fortress");
    game.fortressStageByMap = { legacy_map: 7 };
    game.restoreSaveData(legacySave);
    const fortressAfterLegacyLoad = { ...game.fortressStageByMap };
    // 증거 없는 구세이브는 백필하지 않는다 — 전역 미러가 다른 슬롯 진행을 미방문 캐릭터에 주입하는 것 차단.
    const legacyNoEvidence = JSON.parse(JSON.stringify(before));
    delete legacyNoEvidence.player.fortressStageByMap;
    legacyNoEvidence.player.tutorial.completedStepIds = legacyNoEvidence.player.tutorial.completedStepIds.filter((id) => id !== "visit_fortress");
    legacyNoEvidence.player.tutorial.achievedStepIds = legacyNoEvidence.player.tutorial.achievedStepIds.filter((id) => id !== "visit_fortress");
    game.fortressStageByMap = { legacy_map: 7 };
    game.restoreSaveData(legacyNoEvidence);
    const fortressAfterNoEvidence = { ...game.fortressStageByMap };
    // 상점 판매/구매·개미굴 뱅크: 로드가 세이브값을 복원한다(전엔 로드마다 0 리셋 → 퀘스트 중간 진행 유실).
    game.restoreSaveData(before);
    const countersAfterReload = { materialsSold: game.tutorialSignals.materialsSold, shopPurchases: game.tutorialSignals.shopPurchases, antStepBank: game.antStepBank };
    // 구세이브(필드 없음)는 완료 퀘스트 임계로 백필(sell_materials 완료=최소 3회 판매).
    const legacyCounters = JSON.parse(JSON.stringify(before));
    delete legacyCounters.player.materialsSold;
    delete legacyCounters.player.shopPurchases;
    delete legacyCounters.player.antStepBank;
    legacyCounters.player.tutorial.completedStepIds.push("sell_materials", "buy_from_shop");
    game.restoreSaveData(legacyCounters);
    const countersAfterLegacyLoad = { materialsSold: game.tutorialSignals.materialsSold, shopPurchases: game.tutorialSignals.shopPurchases, antStepBank: game.antStepBank };
    // 스테일 신호 리셋: recoveredWorkbench·ateMeat 는 리셋 누락 시 이전 플레이스루가 새 게임 퀘스트를 자동 완료시킴.
    game.tutorialSignals.recoveredWorkbench = true;
    game.tutorialSignals.ateMeat = true;
    game.resetGameState({ reseed: false });
    const staleSignalsAfterReset = { recoveredWorkbench: game.tutorialSignals.recoveredWorkbench, ateMeat: game.tutorialSignals.ateMeat };
    return { before, after, arcadePointsAfterReload, fortressAfterReload, fortressAfterLegacyLoad, fortressAfterNoEvidence, countersAfterReload, countersAfterLegacyLoad, staleSignalsAfterReset };
  });

  assert.deepEqual(stableSaveShape(result.after), stableSaveShape(result.before));
  assert.equal(result.before.player.arcadePoints, 8765, "arcadePoints must be persisted inside the save");
  assert.equal(result.arcadePointsAfterReload, 8765, "loading must roll arcadePoints back to the saved value (sell→load point-dupe exploit guard)");
  assert.deepEqual(result.fortressAfterReload, { mushroom_glen: 4, dragon_lands: 2 }, "loading must restore per-map fortress stages from the save (load-reset regression guard)");
  assert.deepEqual(result.fortressAfterLegacyLoad, { legacy_map: 7 }, "legacy saves with fortress-visit evidence must keep pre-load fortress progress (localStorage backfill)");
  assert.deepEqual(result.fortressAfterNoEvidence, {}, "legacy saves without fortress-visit evidence must NOT inherit another slot's fortress progress");
  assert.deepEqual(result.countersAfterReload, { materialsSold: 2, shopPurchases: 1, antStepBank: 37 }, "loading must restore shop counters and ant step bank from the save (load-reset regression guard)");
  assert.deepEqual(result.countersAfterLegacyLoad, { materialsSold: 3, shopPurchases: 1, antStepBank: 0 }, "legacy saves must backfill shop counters from completed quest thresholds (ant bank has no quest → 0)");
  assert.deepEqual(result.staleSignalsAfterReset, { recoveredWorkbench: false, ateMeat: false }, "resetGameState must clear recoveredWorkbench/ateMeat (stale signals auto-completed quests in a new playthrough)");
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
      "fortress stage per-map roundtrip + legacy backfill",
      "shop counters + ant step bank roundtrip + legacy quest-threshold backfill",
      "stale boolean signals cleared on reset",
    ],
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
