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
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ok: false, reason: "canvas missing" };
    }

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      return { ok: false, reason: "webgl context missing" };
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const first = new Uint8Array(4);
    const sample = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, first);

    let differentPixels = 0;
    let brightPixels = 0;
    for (let y = 1; y <= 8; y += 1) {
      for (let x = 1; x <= 8; x += 1) {
        gl.readPixels(
          Math.floor((width * x) / 9),
          Math.floor((height * y) / 9),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          sample,
        );
        const different =
          sample[0] !== first[0] || sample[1] !== first[1] || sample[2] !== first[2] || sample[3] !== first[3];
        if (different) differentPixels += 1;
        if (sample[0] + sample[1] + sample[2] > 30) brightPixels += 1;
      }
    }

    return {
      ok: width > 0 && height > 0 && brightPixels > 10 && differentPixels > 4,
      width,
      height,
      brightPixels,
      differentPixels,
    };
  });
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
  };

  await page.waitForSelector(".objective", { timeout: 10_000 });
  ui.objectiveVisible = await page.locator(".objective").evaluate((element) => element.textContent?.includes("현재 목표") ?? false);

  if (viewportName !== "desktop") return ui;

  await page.evaluate(() => {
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
            name: "특수 재련대",
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
    const rawSave = localStorage.getItem("ai-game-lab:wilderness-save-v1");
    if (!rawSave) return false;
    const save = JSON.parse(rawSave);
    const slots = [...(save.player?.hotbar ?? []), ...(save.player?.bagSlots ?? [])];
    return slots.some((slot) => slot?.item === "hammer");
  });

  await page.evaluate(() => {
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
            name: "특수 재련대",
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
        objects: [],
      }),
    );
  });
  await page.click("[data-load-game]");
  await page.waitForTimeout(400);

  await page.keyboard.press("F4");
  await page.click('[data-cheat-item="extended_workbench"][data-cheat-count="1"]');
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyP");
  await page.keyboard.down("KeyC");
  await page.waitForTimeout(300);
  await page.mouse.click(Math.floor(page.viewportSize().width / 2), Math.floor(page.viewportSize().height / 2), { button: "right" });
  await page.waitForSelector(".workbench-grid [data-workbench-slot]", { timeout: 5_000 });
  ui.workbenchSlots = await page.locator(".workbench-grid [data-workbench-slot]").count();
  ui.workbenchSubtitle = (await page.locator(".workbench-panel .inventory-subtitle").textContent()) ?? "";
  await page.keyboard.up("KeyC");

  return ui;
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
  page.on("pageerror", (error) => errors.push(`${viewport.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${viewport.name} console: ${message.text()}`);
  });

  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 10_000 });
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: `artifacts/${viewport.name}.png`, fullPage: true });
  const canvas = await inspectCanvas(page);
  const gameplay = await inspectGameplayUi(page, viewport.name);
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
  if (viewport.name === "desktop" && gameplay.workbenchSlots !== 36) {
    errors.push(`desktop: extended workbench did not expose 36 crafting slots`);
  }
  if (viewport.name === "desktop" && !gameplay.workbenchSubtitle.includes("6x6")) {
    errors.push(`desktop: extended workbench subtitle did not explain 6x6 crafting`);
  }
  if (viewport.name === "desktop") await page.screenshot({ path: "artifacts/workbench-3x3.png", fullPage: true });
  results.push({ viewport, canvas, gameplay });
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, errors }, null, 2));

if (errors.length > 0 || results.some((result) => !result.canvas.ok)) {
  process.exitCode = 1;
}
