// 일회용 — 요새 보스 강림 트레일러(fortressBoss 컷씬) 시각 검증. 강제 발동 + startedAt 핀.
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 400)));
await page.addInitScript(() => { localStorage.setItem("ai-game-lab:nickname-v1", "테스터"); });
await page.goto("http://localhost:5199/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__wildernessGame, { timeout: 30000 });
await page.waitForTimeout(2000);
await page.evaluate(async () => {
  const g = window.__wildernessGame;
  const m = await import("/src/game/illiaBoss.ts");
  const bossMod = await import("/src/game/fortressBoss.ts");
  const vis = await import("/src/game/fortressBossVisuals.ts");
  const constants = await import("/src/game/constants.ts");
  // 아레나 인테리어 + 동굴 분위기까지 실제 진입과 동일하게 구성(시각 검증의 정직성)
  const interiors = await import("/src/game/interiors.ts");
  g.clearCaveObjects(); g.locationMode = "cave"; g.setCaveAtmosphere();
  interiors.createSiegeArenaInterior(g.interiorContext);
  const c = bossMod.fortressBossConceptForStage(5);
  const prop = vis.createFortressBossModel(c.key);
  prop.scale.setScalar(c.scale);
  prop.position.set(0, 0, constants.ARENA_CENTER_Z);
  g.scene.add(prop);
  m.showIlliaCutsceneOverlay(g.uiRoot, c.title);
  m.startIlliaCutscene(g.illiaCutscene, "fortressBoss", performance.now(), [prop], null, c.color);
});
const pinAndShoot = async (ms, name) => {
  await page.evaluate((t) => {
    if (window.__pin) clearInterval(window.__pin);
    const g = window.__wildernessGame;
    window.__pin = setInterval(() => { if (g.illiaCutscene.active) g.illiaCutscene.startedAt = performance.now() - t; }, 30);
  }, ms);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `scripts/_tmp_trailer_${name}.png` });
  console.log("captured", name);
};
await pinAndShoot(1800, "act1");
await pinAndShoot(4300, "act2");
await pinAndShoot(6100, "roar");
await page.evaluate(() => { clearInterval(window.__pin); const g = window.__wildernessGame; g.illiaCutscene.startedAt = performance.now() - 7900; });
await page.waitForFunction(() => window.__wildernessGame?.illiaCutscene?.active === false, { timeout: 15000 });
const after = await page.evaluate(() => ({ props: window.__wildernessGame.illiaCutscene.props.length, overlay: !!document.querySelector(".illia-cutscene") }));
console.log("after:", JSON.stringify(after));
await browser.close(); await server.close(); process.exit(after.props === 0 && !after.overlay ? 0 : 1);
