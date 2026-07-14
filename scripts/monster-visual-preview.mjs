// 몬스터 비주얼 스크린샷 QA — 자체 vite 서버 + 로컬 Chrome 으로
// scripts/monster-preview/ 장면을 렌더해 artifacts/monster-preview.png 로 저장한다.
import { access, mkdir } from "node:fs/promises";
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

const server = await createServer({ logLevel: "silent", server: { host: "127.0.0.1", port: 5198, strictPort: true } });
await server.listen();

let browser = null;
try {
  browser = await chromium.launch({ args: ["--no-sandbox"], /* 컨테이너 루트 헤드리스 필수 · 윈도우선 무해 */ executablePath: await findBrowserPath() });
  const page = await browser.newPage({ viewport: { width: 1960, height: 880 } });
  await page.addInitScript(() => localStorage.setItem("ai-game-lab:nickname-v1", "테스터"));
  page.on("pageerror", (error) => {
    console.error(`MONSTER PREVIEW page error: ${error.message}`);
    process.exitCode = 1;
  });
  await page.goto("http://127.0.0.1:5198/scripts/monster-preview/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.monsterPreviewReady === true, undefined, { timeout: 15_000 });
  await mkdir("artifacts", { recursive: true });
  const path = "artifacts/monster-preview.png";
  await page.locator("canvas").screenshot({ path });
  console.log(JSON.stringify({ ok: process.exitCode !== 1, screenshot: path }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
