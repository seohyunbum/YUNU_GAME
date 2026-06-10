// 무기 비주얼 스크린샷 QA — 자체 vite 서버 + 로컬 Chrome/Edge 로
// scripts/weapon-preview/ 장면을 렌더해 artifacts/weapon-preview.png 로 저장한다.
// (이 PC 는 preview MCP 가 불가하므로 visual-check 와 같은 playwright 경로를 쓴다.)
import { access, mkdir } from "node:fs/promises";
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

const server = await createServer({ logLevel: "silent", server: { host: "127.0.0.1", port: 5199, strictPort: true } });
await server.listen();

let browser = null;
try {
  browser = await chromium.launch({ executablePath: await findBrowserPath() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
  await page.goto("http://127.0.0.1:5199/scripts/weapon-preview/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.weaponPreviewReady === true, undefined, { timeout: 15_000 });
  await mkdir("artifacts", { recursive: true });
  const path = "artifacts/weapon-preview.png";
  await page.locator("canvas").screenshot({ path });
  console.log(JSON.stringify({ ok: true, screenshot: path }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
