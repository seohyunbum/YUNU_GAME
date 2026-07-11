// 일회용 — 부팅 인트로 v2 시각 검증(강제 발동 + 시간 핀). swiftshader 저FPS 에서 자동 킥 타이밍이 불안정하므로
// 모듈 인스턴스로 컷씬을 직접 시작하고 startedAt 을 핀해 원하는 t 프레임을 캡처한다.
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 500)));
await page.addInitScript(() => { localStorage.setItem("ai-game-lab:nickname-v1", "테스터"); });
await page.goto("http://localhost:5199/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__wildernessGame && !window.__wildernessGame.gameStarted, { timeout: 30000 });
await page.waitForTimeout(2500); // 타이틀 안정화
await page.evaluate(async () => {
  const m = await import("/src/game/illiaBoss.ts");
  const g = window.__wildernessGame;
  m.showIlliaCutsceneOverlay(g.uiRoot, "야생 마을", true);
  m.startIlliaCutscene(g.illiaCutscene, "intro", performance.now(), []);
});
console.log("intro forced");
const pinAndShoot = async (ms, name) => {
  await page.evaluate((t) => {
    if (window.__pin) clearInterval(window.__pin);
    const g = window.__wildernessGame;
    window.__pin = setInterval(() => { if (g.illiaCutscene.active) g.illiaCutscene.startedAt = performance.now() - t; }, 30);
  }, ms);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `scripts/_tmp_intro_${name}.png` });
  console.log("captured", name);
};
await pinAndShoot(2200, "act1");
await pinAndShoot(6300, "act2");
await pinAndShoot(9300, "act3");
await page.evaluate(() => { clearInterval(window.__pin); const g = window.__wildernessGame; g.illiaCutscene.startedAt = performance.now() - 9950; });
await page.waitForFunction(() => window.__wildernessGame?.illiaCutscene?.active === false, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "scripts/_tmp_intro_after.png" });
const after = await page.evaluate(() => {
  const g = window.__wildernessGame;
  return { titleVisible: getComputedStyle(document.querySelector(".title-screen")).visibility !== "hidden", fogNear: Math.round(g.scene.fog?.near ?? -1), propsLeft: g.illiaCutscene.props.length, skyVisible: g.sky?.visible };
});
console.log("after:", JSON.stringify(after));
await browser.close(); await server.close(); process.exit(after.titleVisible && after.propsLeft === 0 ? 0 : 1);
