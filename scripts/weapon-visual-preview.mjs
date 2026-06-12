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
  await page.addInitScript(() => localStorage.setItem("ai-game-lab:nickname-v1", "테스터"));
  await page.goto("http://127.0.0.1:5199/scripts/weapon-preview/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.weaponPreviewReady === true, undefined, { timeout: 15_000 });
  await mkdir("artifacts", { recursive: true });
  const path = "artifacts/weapon-preview.png";
  const screenshot = await page.locator("canvas").screenshot({ path });

  // 픽셀 검증 — 각 패널에 모델이 실제로 그려졌고, 총 패널에 에너지 라인(시안)이 있는지
  const panels = await page.evaluate(
    async (dataUrl) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve(null);
            return;
          }
          context.drawImage(image, 0, 0);
          const panelWidth = Math.floor(image.width / 2);
          const panelHeight = Math.floor(image.height / 2);
          const report = [];
          for (let row = 0; row < 2; row += 1) {
            for (let column = 0; column < 2; column += 1) {
              const originX = column * panelWidth;
              const originY = row * panelHeight;
              const pixels = context.getImageData(originX, originY, panelWidth, panelHeight).data;
              const corner = [pixels[4 * (panelWidth * 4 + 4)], pixels[4 * (panelWidth * 4 + 4) + 1], pixels[4 * (panelWidth * 4 + 4) + 2]];
              let modelPixels = 0;
              let energyPixels = 0;
              for (let y = 0; y < panelHeight; y += 2) {
                for (let x = 0; x < panelWidth; x += 2) {
                  const offset = (y * panelWidth + x) * 4;
                  const r = pixels[offset];
                  const g = pixels[offset + 1];
                  const b = pixels[offset + 2];
                  const delta = Math.abs(r - corner[0]) + Math.abs(g - corner[1]) + Math.abs(b - corner[2]);
                  if (delta > 36) modelPixels += 1;
                  if (r < 130 && g > 150 && b > 150) energyPixels += 1;
                }
              }
              report.push({ row, column, modelPixels, energyPixels });
            }
          }
          resolve(report);
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
      }),
    `data:image/png;base64,${screenshot.toString("base64")}`,
  );

  const failures = [];
  if (!panels) {
    failures.push("screenshot decode failed");
  } else {
    for (const panel of panels) {
      if (panel.modelPixels < 200) failures.push(`panel(${panel.row},${panel.column}) rendered too few model pixels (${panel.modelPixels})`);
    }
    const pistolPanels = panels.filter((panel) => panel.column === 0);
    if (!pistolPanels.some((panel) => panel.energyPixels >= 1)) failures.push("pistol panels show no cyan energy-line pixels");
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`WEAPON PREVIEW ✗ ${failure}`);
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ ok: failures.length === 0, screenshot: path, panels }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
