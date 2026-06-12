import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function findBrowserPath() {
  const { access } = await import("node:fs/promises");
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

async function inspectCanvas(page) {
  const screenshot = await page.screenshot({ type: "png" });
  return page.evaluate(
    async (dataUrl) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve({ ok: false, reason: "2d context missing" });
            return;
          }
          context.drawImage(image, 0, 0);
          const first = context.getImageData(0, 0, 1, 1).data;
          let differentPixels = 0;
          let brightPixels = 0;
          for (let y = 1; y <= 8; y += 1) {
            for (let x = 1; x <= 8; x += 1) {
              const sample = context.getImageData(Math.floor((image.width * x) / 9), Math.floor((image.height * y) / 9), 1, 1).data;
              const different =
                sample[0] !== first[0] || sample[1] !== first[1] || sample[2] !== first[2] || sample[3] !== first[3];
              if (different) differentPixels += 1;
              if (sample[0] + sample[1] + sample[2] > 30) brightPixels += 1;
            }
          }
          resolve({
            ok: image.width > 0 && image.height > 0 && brightPixels > 10 && differentPixels > 4,
            width: image.width,
            height: image.height,
            brightPixels,
            differentPixels,
          });
        };
        image.onerror = () => resolve({ ok: false, reason: "screenshot decode failed" });
        image.src = dataUrl;
      }),
    `data:image/png;base64,${screenshot.toString("base64")}`,
  );
}

async function inspectGameplayUi(page, viewportName) {
  const ui = {
    objectiveVisible: false,
    hotbarSlotsAfterMigration: 0,
    workbenchSlots: 0,
    workbenchSubtitle: "",
    ironSmelted: false,
    specialSmelterHasObsidian: false,
    droppedItemPickedUp: false,
    bedSleptWithRightClick: false,
  };

  await page.waitForSelector(".objective", { timeout: 10_000 });
  ui.objectiveVisible = await page.locator(".objective").evaluate((element) => element.textContent?.includes("현재 목표") ?? false);

  if (viewportName !== "desktop") return ui;

  await page.evaluate(() => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem(
      "ai-game-lab:wilderness-save-v1",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        player: {
          position: { x: 0, y: 1.7, z: 12 },
          previousPosition: { x: 0, y: 1.7, z: 12 },
          yaw: 0,
          pitch: 0,
          health: 10,
          maxHealth: 10,
          totalSteps: 0,
          chestStepBank: 0,
          caveStepBank: 0,
          equippedArmor: null,
          locationMode: "overworld",
          caveReturnPosition: null,
          selectedHotbarIndex: 0,
          hotbar: [
            { item: "tutorial_book", count: 1 },
            { item: "diamond_pickaxe", count: 2 },
            { item: "iron", count: 1 },
            { item: null, count: 0 },
          ],
          bagSlots: [],
          craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
          toolUses: { diamond_pickaxe: 3 },
        },
        mountains: [],
        objects: [
          {
            type: "specialSmelter",
            name: "특수 제련대",
            position: { x: 0, y: 0, z: 8 },
            collidable: true,
            collisionRadius: 1.18,
            collisionHeight: 2.05,
          },
        ],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  ui.hotbarSlotsAfterMigration = await page.locator(".hotbar button").count();

  await page.evaluate(() => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem(
      "ai-game-lab:wilderness-save-v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        player: {
          position: { x: 0, y: 1.7, z: 12 },
          previousPosition: { x: 0, y: 1.7, z: 12 },
          yaw: 0,
          pitch: 0,
          health: 10,
          maxHealth: 10,
          hunger: 5,
          hungerTimer: 0,
          worldTimeSeconds: 1200,
          totalSteps: 0,
          chestStepBank: 0,
          caveStepBank: 0,
          equippedArmor: null,
          locationMode: "overworld",
          caveReturnPosition: null,
          selectedHotbarIndex: 0,
          hotbar: [{ item: "tutorial_book", count: 1 }, ...Array.from({ length: 7 }, () => ({ item: null, count: 0 }))],
          bagSlots: [],
          craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
          workbenchSlots: Array.from({ length: 36 }, () => ({ item: null, count: 0 })),
        },
        mountains: [],
        objects: [
          {
            type: "droppedItem",
            name: "망치",
            position: { x: 0, y: 0, z: 10 },
            droppedItem: "hammer",
            droppedCount: 1,
            collisionRadius: 0.8,
            collisionHeight: 0.8,
          },
        ],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(300);
  await page.click("[data-save-game]");
  await page.waitForTimeout(150);
  ui.droppedItemPickedUp = await page.evaluate(() => {
    // SAVE_KEY 는 이제 압축 스텁이라 raw 파싱 불가 — 라이브 상태에서 직접 확인한다
    const save = window.__wildernessGame.createSaveData();
    const slots = [...(save.player?.hotbar ?? []), ...(save.player?.bagSlots ?? [])];
    return slots.some((slot) => slot?.item === "hammer");
  });

  await page.evaluate(() => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem(
      "ai-game-lab:wilderness-save-v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        player: {
          position: { x: 0, y: 1.7, z: 12 },
          previousPosition: { x: 0, y: 1.7, z: 12 },
          yaw: 0,
          pitch: 0,
          health: 5,
          maxHealth: 10,
          hunger: 5,
          hungerTimer: 0,
          worldTimeSeconds: 1200,
          totalSteps: 0,
          chestStepBank: 0,
          caveStepBank: 0,
          equippedArmor: null,
          locationMode: "overworld",
          caveReturnPosition: null,
          selectedHotbarIndex: 0,
          hotbar: [{ item: "tutorial_book", count: 1 }, ...Array.from({ length: 7 }, () => ({ item: null, count: 0 }))],
          bagSlots: [],
          craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
          workbenchSlots: Array.from({ length: 36 }, () => ({ item: null, count: 0 })),
        },
        mountains: [],
        objects: [
          {
            type: "bed",
            name: "침대",
            position: { x: 0, y: 0, z: 8 },
            rotationY: 0,
            collidable: true,
            collisionRadius: 1.45,
            collisionHeight: 0.9,
          },
        ],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  await page.mouse.click(Math.floor(page.viewportSize().width / 2), Math.floor(page.viewportSize().height / 2), { button: "right" });
  await page.waitForTimeout(250);
  ui.bedSleptWithRightClick = ((await page.locator(".health-bar").textContent()) ?? "").includes("HP 10 / 10");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.exitPointerLock?.());
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem(
      "ai-game-lab:wilderness-save-v1",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        player: {
          position: { x: 0, y: 1.7, z: 12 },
          previousPosition: { x: 0, y: 1.7, z: 12 },
          yaw: 0,
          pitch: 0,
          health: 10,
          maxHealth: 10,
          totalSteps: 0,
          chestStepBank: 0,
          caveStepBank: 0,
          equippedArmor: null,
          locationMode: "overworld",
          caveReturnPosition: null,
          selectedHotbarIndex: 0,
          hotbar: [
            { item: "tutorial_book", count: 1 },
            { item: "diamond_pickaxe", count: 2 },
            { item: "iron", count: 1 },
            { item: null, count: 0 },
          ],
          bagSlots: [],
          craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
          toolUses: { diamond_pickaxe: 3 },
        },
        mountains: [],
        objects: [
          {
            type: "specialSmelter",
            name: "특수 제련대",
            position: { x: 0, y: 0, z: 8 },
            collidable: true,
            collisionRadius: 1.18,
            collisionHeight: 2.05,
          },
        ],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  await page.keyboard.down("KeyC");
  await page.waitForTimeout(500);
  await page.mouse.click(Math.floor(page.viewportSize().width / 2), Math.floor(page.viewportSize().height / 2), { button: "right" });
  await page.waitForSelector('[data-smelt="iron"]', { timeout: 5_000 });
  ui.specialSmelterHasObsidian = (await page.locator('[data-smelt="obsidian"]').count()) === 1;
  await page.click('[data-smelt="iron"]');
  await page.waitForTimeout(250);
  ui.ironSmelted = !(await page.locator('[data-smelt="iron"]').isEnabled());
  await page.keyboard.up("KeyC");
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem(
      "ai-game-lab:wilderness-save-v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        player: {
          position: { x: 0, y: 1.7, z: 12 },
          previousPosition: { x: 0, y: 1.7, z: 12 },
          yaw: 0,
          pitch: 0,
          health: 10,
          maxHealth: 10,
          hunger: 5,
          hungerTimer: 0,
          worldTimeSeconds: 1200,
          totalSteps: 0,
          chestStepBank: 0,
          caveStepBank: 0,
          equippedArmor: null,
          locationMode: "overworld",
          caveReturnPosition: null,
          selectedHotbarIndex: 0,
          hotbar: [{ item: "tutorial_book", count: 1 }, ...Array.from({ length: 7 }, () => ({ item: null, count: 0 }))],
          bagSlots: [],
          craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
          workbenchSlots: Array.from({ length: 36 }, () => ({ item: null, count: 0 })),
        },
        mountains: [],
        objects: [
          {
            type: "extendedWorkbench",
            name: "확장 제작대",
            position: { x: 0, y: 0, z: 8 },
            collidable: true,
            collisionRadius: 1.35,
            collisionHeight: 1.38,
          },
        ],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  await page.mouse.click(Math.floor(page.viewportSize().width / 2), Math.floor(page.viewportSize().height / 2), { button: "right" });
  await page.waitForSelector(".workbench-grid [data-workbench-slot]", { timeout: 5_000 });
  ui.workbenchSlots = await page.locator(".workbench-grid [data-workbench-slot]").count();
  ui.workbenchSubtitle = (await page.locator(".workbench-panel .inventory-subtitle").textContent()) ?? "";

  return ui;
}

// 화면 상단(하늘) 평균 밝기 — 보스바가 가리는 중앙은 피해 가장자리 컬럼만 샘플링한다.
async function sampleSkyBrightness(page) {
  const screenshot = await page.screenshot({ type: "png" });
  return page.evaluate(
    async (dataUrl) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve(-1);
            return;
          }
          context.drawImage(image, 0, 0);
          const y = Math.max(2, Math.floor(image.height * 0.04));
          const columns = [0.05, 0.12, 0.2, 0.8, 0.88, 0.95];
          let total = 0;
          for (const column of columns) {
            const data = context.getImageData(Math.floor(image.width * column), y, 1, 1).data;
            total += (data[0] + data[1] + data[2]) / 3;
          }
          resolve(total / columns.length);
        };
        image.onerror = () => resolve(-1);
        image.src = dataUrl;
      }),
    `data:image/png;base64,${screenshot.toString("base64")}`,
  );
}

async function startNewGameAs(page, classId) {
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector(".title-screen", { timeout: 10_000 });
  await page.click(`[data-class-choice="${classId}"]`);
  await page.click("[data-title-new]");
  await page.waitForTimeout(1_000);
}

const ALL_TUTORIAL_STEP_IDS = [
  "first_steps",
  "gather_wood",
  "find_hammer",
  "craft_workbench_item",
  "place_workbench",
  "stock_meat",
  "gather_leather",
  "craft_bag",
  "craft_shovel",
  "craft_pickaxe",
  "mine_stone",
  "mine_coal",
  "visit_cave",
  "get_smelter",
  "smelt_iron",
  "hunt_predators",
  "craft_basic_armor",
  "craft_bed",
  "open_map",
  "save_game",
  "visit_shop",
  "reach_level8",
  "train_once",
  "train_all_kinds",
  "craft_basic_weapon",
];

function expeditionSave({ bossChapter, worldTimeSeconds, worldMapId = "dragon_lands", objects }) {
  return {
    version: 7,
    savedAt: new Date().toISOString(),
    player: {
      position: { x: 0, y: 1.7, z: 12 },
      previousPosition: { x: 0, y: 1.7, z: 12 },
      yaw: 0,
      pitch: 0,
      health: 10,
      maxHealth: 10,
      level: 451,
      hunger: 5,
      hungerTimer: 0,
      worldTimeSeconds,
      worldMapId,
      bossChapter,
      tutorial: { completedStepIds: ALL_TUTORIAL_STEP_IDS },
      totalSteps: 0,
      chestStepBank: 0,
      caveStepBank: 0,
      equippedArmor: null,
      locationMode: "overworld",
      caveReturnPosition: null,
      selectedHotbarIndex: 0,
      hotbar: [{ item: "tutorial_book", count: 1 }, ...Array.from({ length: 7 }, () => ({ item: null, count: 0 }))],
      bagSlots: [],
      craftSlots: Array.from({ length: 4 }, () => ({ item: null, count: 0 })),
      workbenchSlots: Array.from({ length: 36 }, () => ({ item: null, count: 0 })),
    },
    mountains: [],
    objects: objects ?? [
      {
        type: "dragon",
        name: "파이어 드래곤",
        bossKind: "fire_dragon",
        position: { x: 0, y: 0, z: 6.5 },
        hp: 700,
        collidable: true,
        collisionRadius: 4.8,
        collisionHeight: 6.1,
      },
    ],
  };
}

async function loadInjectedSave(page, save) {
  await page.evaluate((payload) => {
    localStorage.removeItem("ai-game-lab:wilderness-saves-v1");
    localStorage.removeItem("ai-game-lab:wilderness-save-backup-v1");
    localStorage.setItem("ai-game-lab:wilderness-save-v1", JSON.stringify(payload));
  }, save);
  await page.click("[data-load-game]");
  await page.waitForTimeout(700);
}

// 신규 시스템 검사 — 거너/탱커 시작, 맵 패널, 보스 게이팅, 시간대.
async function inspectNewSystems(page) {
  const systems = {
    gunnerStartsWithPistol: false,
    tankerStartsWithShield: false,
    tankerShieldArmorApplied: false,
    mapPanelOpens: false,
    mapTeleportButtons: 0,
    mapLockedButtons: 0,
    bossSealedMarked: false,
    chapterObjectiveShown: false,
    bossUnsealsAfterChapter: false,
    nightTimeLabel: false,
    daySkyBrightness: -1,
    nightSkyBrightness: -1,
    graveyardSkyBrightness: -1,
    levelCardCompact: false,
    bossMarkers: 0,
    sealedBossMarkers: 0,
    starterFieldBossMarker: 0,
    loadPanelHasFileBackup: false,
    homeMarkers: 0,
    newGameReturnsToTitle: false,
    titleBlocksShortcuts: false,
    titleMapOpens: false,
    titleMapAllUnlocked: false,
  };

  await startNewGameAs(page, "gunner");
  systems.gunnerStartsWithPistol = ((await page.locator(".hotbar").textContent()) ?? "").includes("권총");

  await startNewGameAs(page, "tanker");
  const hotbarText = (await page.locator(".hotbar").textContent()) ?? "";
  systems.tankerStartsWithShield = hotbarText.includes("방패");
  // 탱커는 새 게임 시작 시 방패가 자동 장착된다 — 장비 방어에 방패 수치(+5)가 반영됐는지 본다.
  const statsDetail = (await page.locator(".stats-detail").first().textContent()) ?? "";
  const armorMatch = statsDetail.match(/장비 방어 (\d+)/);
  systems.tankerShieldArmorApplied = armorMatch !== null && Number(armorMatch[1]) >= 5;

  // 주간 하늘 기준점은 무드 없는 시작 초원에서 잰다 (용의 땅은 이제 화산 무드)
  systems.daySkyBrightness = await sampleSkyBrightness(page);

  await page.keyboard.press("KeyM");
  await page.waitForTimeout(300);
  systems.mapPanelOpens = (await page.locator(".map-panel").count()) === 1;
  systems.mapTeleportButtons = await page.locator("[data-teleport-map]").count();
  systems.mapLockedButtons = await page.locator("[data-teleport-map][disabled]").count();
  systems.starterFieldBossMarker = await page.locator('[data-boss-marker="open"]').count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await loadInjectedSave(page, expeditionSave({ bossChapter: 0, worldTimeSeconds: 1200 }));
  const sealedBossBar = (await page.locator(".boss-bar").textContent()) ?? "";
  systems.bossSealedMarked = sealedBossBar.includes("파이어 드래곤") && sealedBossBar.includes("봉인됨");
  systems.chapterObjectiveShown = ((await page.locator(".objective").textContent()) ?? "").includes("챕터 1/6");
  // 3자리 레벨은 카드 안에 맞게 축소된 글꼴 클래스를 받아야 한다
  systems.levelCardCompact = (await page.locator(".stats-level-card strong.lv-digits-3").count()) === 1;
  // 지역 지도에 보스 위치 마커가 떠야 한다 (봉인 상태 포함)
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(350);
  systems.bossMarkers = await page.locator("[data-boss-marker]").count();
  systems.sealedBossMarkers = await page.locator('[data-boss-marker="sealed"]').count();
  await page.screenshot({ path: "artifacts/map-bosses.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await loadInjectedSave(page, expeditionSave({ bossChapter: 1, worldTimeSeconds: 1200 }));
  const unsealedBossBar = (await page.locator(".boss-bar").textContent()) ?? "";
  systems.bossUnsealsAfterChapter = unsealedBossBar.includes("파이어 드래곤") && !unsealedBossBar.includes("봉인됨");

  // 내가 지은 집(playerOwned)은 지역 지도에 🏠 마커로 표시된다
  await loadInjectedSave(page, expeditionSave({
    bossChapter: 0,
    worldTimeSeconds: 1200,
    objects: [
      { type: "villageHouse", name: "작은 통나무집", position: { x: 30, y: 0, z: 30 }, enterable: true, playerOwned: true, houseKind: "home", villageId: "player-house-test", collidable: true, collisionRadius: 4, collisionHeight: 3 },
    ],
  }));
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(350);
  systems.homeMarkers = await page.locator("[data-home-marker]").count();
  await page.screenshot({ path: "artifacts/map-home-marker.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await loadInjectedSave(page, expeditionSave({ bossChapter: 0, worldTimeSeconds: 3300 }));
  systems.nightTimeLabel = ((await page.locator(".stats-detail.muted").textContent()) ?? "").includes("밤");
  systems.nightSkyBrightness = await sampleSkyBrightness(page);
  await page.screenshot({ path: "artifacts/new-systems-night.png", fullPage: true });

  // 공동묘지: 한낮에도 음산한 무드(하늘이 평원 낮보다 어둑)
  await loadInjectedSave(page, expeditionSave({ bossChapter: 0, worldTimeSeconds: 1200, worldMapId: "graveyard", objects: [] }));
  await page.waitForTimeout(600);
  systems.graveyardSkyBrightness = await sampleSkyBrightness(page);
  await page.screenshot({ path: "artifacts/graveyard.png", fullPage: true });

  // 불러오기 패널에 세이브 파일 백업/가져오기 버튼이 있어야 한다 (저장 2회 → 슬롯 2개 → 패널 열림).
  await page.click("[data-save-game]");
  await page.waitForTimeout(300);
  await page.click("[data-save-game]");
  await page.waitForTimeout(300);
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);
  systems.loadPanelHasFileBackup =
    (await page.locator("[data-export-save]").count()) === 1 &&
    (await page.locator("[data-import-save]").count()) === 1 &&
    (await page.locator("[data-import-input]").count()) === 1;
  await page.screenshot({ path: "artifacts/load-panel.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // 인게임 '새로시작' 버튼은 확인 후 타이틀 화면으로 돌아가야 한다.
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("[data-new-game]");
  await page.waitForTimeout(300);
  systems.newGameReturnsToTitle =
    (await page.locator(".title-screen:not(.hidden)").count()) === 1 &&
    (await page.locator("[data-title-new]").isVisible());

  // 타이틀 단축키 가드: I(인벤토리) 등은 무시되고, M 지도만 열리며 전 맵이 잠금 해제 상태
  await page.keyboard.press("KeyI");
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(250);
  systems.titleBlocksShortcuts = (await page.locator(".panel").count()) === 0;
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(350);
  systems.titleMapOpens = (await page.locator(".map-panel").count()) === 1;
  systems.titleMapAllUnlocked = (await page.locator("[data-teleport-map][disabled]").count()) <= 1 && !(await page.locator(".world-map-card").allTextContents()).some((text) => text.includes("잠김"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  return systems;
}

const browserPath = await findBrowserPath();
const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
});

const results = [];
const errors = [];
await mkdir("artifacts", { recursive: true });

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => localStorage.setItem("ai-game-lab:nickname-v1", "테스터"));
  page.on("pageerror", (error) => errors.push(`${viewport.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${viewport.name} console: ${message.text()}`);
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 10_000 });
  await page.waitForSelector(".title-screen", { timeout: 10_000 });
  await page.click('[data-class-choice="warrior"]');
  await page.click("[data-title-new]");
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: `artifacts/${viewport.name}.png`, fullPage: true });
  const canvas = await inspectCanvas(page);
  const gameplay = await inspectGameplayUi(page, viewport.name);
  if (viewport.name === "desktop") await page.screenshot({ path: "artifacts/workbench-3x3.png", fullPage: true });
  const systems = viewport.name === "desktop" ? await inspectNewSystems(page) : null;
  if (!gameplay.objectiveVisible) errors.push(`${viewport.name}: objective HUD missing`);
  if (viewport.name === "desktop" && gameplay.hotbarSlotsAfterMigration !== 8) {
    errors.push(`desktop: old save migration did not normalize hotbar to 8 slots`);
  }
  if (viewport.name === "desktop" && !gameplay.ironSmelted) {
    errors.push(`desktop: iron did not smelt in the smelter`);
  }
  if (viewport.name === "desktop" && !gameplay.specialSmelterHasObsidian) {
    errors.push(`desktop: special smelter did not expose obsidian smelting`);
  }
  if (viewport.name === "desktop" && !gameplay.droppedItemPickedUp) {
    errors.push(`desktop: dropped item was not picked up with E`);
  }
  if (viewport.name === "desktop" && !gameplay.bedSleptWithRightClick) {
    errors.push(`desktop: bed did not sleep with right click`);
  }
  if (viewport.name === "desktop" && gameplay.workbenchSlots !== 36) {
    errors.push(`desktop: extended workbench did not expose 36 crafting slots`);
  }
  if (viewport.name === "desktop" && !gameplay.workbenchSubtitle.includes("6x6")) {
    errors.push(`desktop: extended workbench subtitle did not explain 6x6 crafting`);
  }
  if (systems) {
    if (!systems.gunnerStartsWithPistol) errors.push("desktop: gunner did not start with a pistol in the hotbar");
    if (!systems.tankerStartsWithShield) errors.push("desktop: tanker did not start with a shield in the hotbar");
    if (!systems.tankerShieldArmorApplied) errors.push("desktop: tanker starter shield armor (+5) was not applied to equipment armor");
    if (!systems.mapPanelOpens) errors.push("desktop: KeyM did not open the map panel");
    if (systems.mapTeleportButtons < 5) errors.push(`desktop: map panel listed ${systems.mapTeleportButtons} teleport targets (expected >= 5)`);
    if (systems.mapLockedButtons < 1) errors.push("desktop: map panel did not lock any high-level map for a level 1 player");
    if (!systems.bossSealedMarked) errors.push("desktop: sealed boss bar did not show the seal marker");
    if (!systems.chapterObjectiveShown) errors.push("desktop: objective HUD did not show boss chapter progress");
    if (!systems.bossUnsealsAfterChapter) errors.push("desktop: boss stayed sealed after the previous chapter was cleared");
    if (!systems.nightTimeLabel) errors.push("desktop: night world time did not show the night label");
    if (systems.daySkyBrightness < 0 || systems.nightSkyBrightness < 0 || systems.nightSkyBrightness > systems.daySkyBrightness - 10) {
      errors.push(`desktop: night sky (${systems.nightSkyBrightness}) was not darker than day sky (${systems.daySkyBrightness})`);
    }
    if (!systems.newGameReturnsToTitle) errors.push("desktop: in-game new-game button did not return to the title screen");
    if (!systems.titleBlocksShortcuts) errors.push("desktop: title screen did not block gameplay shortcuts (I/B opened a panel)");
    if (!systems.titleMapOpens) errors.push("desktop: KeyM did not open the map on the title screen");
    if (!systems.titleMapAllUnlocked) errors.push("desktop: title map should unlock every map for backdrop browsing");
    if (!systems.levelCardCompact) errors.push("desktop: 3-digit level did not get the compact level-card font class");
    if (systems.bossMarkers < 1) errors.push("desktop: region map did not show any boss markers");
    if (systems.sealedBossMarkers < 1) errors.push("desktop: sealed boss was not marked as sealed on the region map");
    if (systems.starterFieldBossMarker < 1) errors.push("desktop: starter map did not show its field boss on the region map");
    if (!systems.loadPanelHasFileBackup) errors.push("desktop: load panel did not expose save file export/import buttons");
    if (systems.homeMarkers < 1) errors.push("desktop: player-built house was not marked on the region map");
    if (systems.graveyardSkyBrightness < 0 || systems.graveyardSkyBrightness > systems.daySkyBrightness - 40) {
      errors.push(`desktop: graveyard daytime sky (${systems.graveyardSkyBrightness}) was not gloomier than the plains day sky (${systems.daySkyBrightness})`);
    }
  }
  results.push({ viewport, canvas, gameplay, systems });
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, errors }, null, 2));

if (errors.length > 0 || results.some((result) => !result.canvas.ok)) {
  process.exitCode = 1;
}
