import { access } from "node:fs/promises";
import { chromium } from "playwright-core";

// 성능 예산 (ratchet: 내려가기만) — AGENTS.md §10 참조.
// 씬 카운트는 런-간 분산 <1% 라 신뢰 가능한 게이트. 프레임타임은 머신 의존이라 느슨한 상한만 둔다.
const PERF_BUDGET = {
  fieldVisibleMeshes: 4400, // baseline ~4192 after fog-distance large visual culling
  fieldObjects: 1520, // baseline ~1414
  fieldRaycastTargets: 4250, // baseline ~4024 — 미세 장식 레이캐스트 제외 후. (4400 시절 콘텐츠 증가로 flaky 했음)
  villageVisibleMeshes: 3850, // baseline ~3683 after outline pruning + fog-distance large visual culling
  villageVisibleOutlines: 50, // balanced/performance quality should hide cartoon outlines
  villageShiftOnlyHitches: 0,
  villageSprintRepeatHitches: 0,
  fieldAvgMsCeiling: 40, // 머신 의존 — 파국 방지용 느슨한 상한 (현재 ~21)
};

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

async function sampleFrames(page, label, durationMs = 3000) {
  return page.evaluate(
    ({ label: sampleLabel, durationMs: sampleDuration }) =>
      new Promise((resolve) => {
        const frames = [];
        let last = performance.now();
        const startedAt = last;
        function tick(now) {
          frames.push(now - last);
          last = now;
          if (now - startedAt < sampleDuration) {
            requestAnimationFrame(tick);
            return;
          }
          const sorted = [...frames].sort((a, b) => a - b);
          const average = frames.reduce((sum, frame) => sum + frame, 0) / Math.max(1, frames.length);
          resolve({
            label: sampleLabel,
            frames: frames.length,
            averageMs: Number(average.toFixed(2)),
            p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)]?.toFixed(2) ?? 0),
            maxMs: Number(Math.max(...frames).toFixed(2)),
            slowFrames: frames.filter((frame) => frame > 33.4).length,
            hitches: frames.filter((frame) => frame > 50).length,
          });
        }
        requestAnimationFrame(tick);
      }),
    { label, durationMs },
  );
}

async function profileGame(page) {
  return page.evaluate(() => {
    const game = window.__wildernessGame;
    if (!game) return { available: false };
    let meshCount = 0;
    let visibleMeshCount = 0;
    let outlineCount = 0;
    let visibleOutlineCount = 0;
    game.scene.traverse((child) => {
      if (child.isMesh) meshCount += 1;
      let effectivelyVisible = child.visible;
      let current = child.parent;
      while (effectivelyVisible && current) {
        effectivelyVisible = current.visible;
        current = current.parent;
      }
      if (child.isMesh && effectivelyVisible) visibleMeshCount += 1;
      if (child.userData?.isCartoonOutline) {
        outlineCount += 1;
        if (effectivelyVisible) visibleOutlineCount += 1;
      }
    });
    return {
      available: true,
      objects: game.objects?.size ?? 0,
      raycastTargets: game.raycastTargets?.length ?? 0,
      meshCount,
      visibleMeshCount,
      outlineCount,
      visibleOutlineCount,
      waterRipples: game.waterRippleMeshes?.length ?? 0,
      waterSurfaces: game.waterSurfaceMeshes?.length ?? 0,
      qualityMode: game.qualityMode,
    };
  });
}

async function teleportToVillage(page) {
  const moved = await page.evaluate(() => {
    const game = window.__wildernessGame;
    if (!game) return false;
    const x = 58;
    const z = -76;
    const y = (game.getOverworldHeightAt?.(x, z) ?? 0) + 1.7;
    game.playerPosition.set(x, y, z);
    game.previousPosition.copy(game.playerPosition);
    game.yaw = 0;
    game.pitch = 0;
    game.camera.rotation.set(0, 0, 0, "YXZ");
    game.settlePlayerAfterTeleport?.();
    return true;
  });
  if (!moved) throw new Error("Development game hook was not available.");
}

async function setMovementKeys(page, codes) {
  await page.evaluate((nextCodes) => {
    const game = window.__wildernessGame;
    if (!game) return;
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "KeyC", "Space"]) {
      game.keys?.delete(code);
    }
    for (const code of nextCodes) game.keys?.add(code);
  }, codes);
}

async function sampleMovement(page, label, codes, durationMs = 3000) {
  await setMovementKeys(page, codes);
  const result = await sampleFrames(page, label, durationMs);
  await setMovementKeys(page, []);
  return result;
}

async function installProfiler(page) {
  await page.evaluate(() => {
    const game = window.__wildernessGame;
    if (!game || game.__perfProfilerInstalled) return;
    game.__perfProfilerInstalled = true;
    game.__perfProfile = {};
    const wrap = (owner, name, label = name) => {
      const original = owner?.[name];
      if (typeof original !== "function") return;
      owner[name] = function profiledFunction(...args) {
        const startedAt = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          const elapsed = performance.now() - startedAt;
          const entry = game.__perfProfile[label] ?? { calls: 0, totalMs: 0, maxMs: 0 };
          entry.calls += 1;
          entry.totalMs += elapsed;
          entry.maxMs = Math.max(entry.maxMs, elapsed);
          game.__perfProfile[label] = entry;
        }
      };
    };
    for (const name of [
      "update",
      "updateAdaptiveQuality",
      "updateMovement",
      "updateVisibilityCulling",
      "updatePrompt",
      "updateVillagers",
      "updateKnights",
      "updateAnimals",
      "updateTrains",
      "updateHand",
      "updateBossBar",
      "renderHud",
      "getLookTarget",
      "nearbyRaycastTargets",
      "resolveCollisions",
      "applyQualityMode",
    ]) {
      wrap(game, name);
    }
    wrap(game.composer, "render", "composer.render");
    wrap(game.renderer, "render", "renderer.render");
  });
}

async function resetProfiler(page) {
  await page.evaluate(() => {
    const game = window.__wildernessGame;
    if (game) game.__perfProfile = {};
  });
}

async function readProfiler(page) {
  return page.evaluate(() => {
    const profile = window.__wildernessGame?.__perfProfile ?? {};
    return Object.fromEntries(
      Object.entries(profile)
        .map(([name, entry]) => [
          name,
          {
            calls: entry.calls,
            averageMs: Number((entry.totalMs / Math.max(1, entry.calls)).toFixed(3)),
            maxMs: Number(entry.maxMs.toFixed(3)),
          },
        ])
        .sort((a, b) => b[1].maxMs - a[1].maxMs),
    );
  });
}

const browserPath = await findBrowserPath();
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript(() => localStorage.setItem("ai-game-lab:nickname-v1", "테스터"));
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".title-screen", { timeout: 10_000 });
await page.click('[data-class-choice="warrior"]');
await page.click("[data-title-new]");
await page.waitForTimeout(4200);
await installProfiler(page);

const startingProfile = await profileGame(page);
const field = await sampleFrames(page, "field");
const fieldSprint = await sampleMovement(page, "field-sprint", ["KeyW", "ShiftLeft"]);
await teleportToVillage(page);
await page.waitForTimeout(600);
const villageProfile = await profileGame(page);
const village = await sampleFrames(page, "village");
await resetProfiler(page);
const villageShiftOnly = await sampleMovement(page, "village-shift-only", ["ShiftLeft"], 1200);
const villageShiftOnlyProfile = await readProfiler(page);
await resetProfiler(page);
const villageSprint = await sampleMovement(page, "village-sprint", ["KeyW", "ShiftLeft"]);
const villageSprintProfile = await readProfiler(page);
await resetProfiler(page);
const villageSprintRepeat = await sampleMovement(page, "village-sprint-repeat", ["KeyW", "ShiftLeft"]);
const villageSprintRepeatProfile = await readProfiler(page);

await browser.close();

const result = {
  profiles: {
    field: startingProfile,
    village: villageProfile,
  },
  samples: [field, fieldSprint, village, villageShiftOnly, villageSprint, villageSprintRepeat],
  profiler: {
    villageShiftOnly: villageShiftOnlyProfile,
    villageSprint: villageSprintProfile,
    villageSprintRepeat: villageSprintRepeatProfile,
  },
  errors,
};

console.log(JSON.stringify(result, null, 2));

// 성능 예산 게이트 (AGENTS.md §10) — 초과 시 실패해 업그레이드발 렉을 막는다.
const budgetFailures = [];
const checkBudget = (label, value, max) => {
  if (typeof value === "number" && value > max) budgetFailures.push(`${label} ${value} > 예산 ${max}`);
};
if (startingProfile.available) {
  checkBudget("field.visibleMeshCount", startingProfile.visibleMeshCount, PERF_BUDGET.fieldVisibleMeshes);
  checkBudget("field.objects", startingProfile.objects, PERF_BUDGET.fieldObjects);
  checkBudget("field.raycastTargets", startingProfile.raycastTargets, PERF_BUDGET.fieldRaycastTargets);
}
if (villageProfile.available) {
  checkBudget("village.visibleMeshCount", villageProfile.visibleMeshCount, PERF_BUDGET.villageVisibleMeshes);
  if (villageProfile.qualityMode !== "high") {
    checkBudget("village.visibleOutlineCount", villageProfile.visibleOutlineCount, PERF_BUDGET.villageVisibleOutlines);
  }
}
checkBudget("field.averageMs", field.averageMs, PERF_BUDGET.fieldAvgMsCeiling);
checkBudget("village-shift-only.hitches", villageShiftOnly.hitches, PERF_BUDGET.villageShiftOnlyHitches);
checkBudget("village-sprint-repeat.hitches", villageSprintRepeat.hitches, PERF_BUDGET.villageSprintRepeatHitches);

for (const failure of budgetFailures) console.error(`PERF BUDGET ✗ ${failure}`);
if (budgetFailures.length === 0) console.log("PERF BUDGET ✓ 모든 예산 통과");
if (errors.length > 0 || budgetFailures.length > 0) process.exitCode = 1;
