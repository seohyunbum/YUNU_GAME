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
  results.push({ viewport, canvas });
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ results, errors }, null, 2));

if (errors.length > 0 || results.some((result) => !result.canvas.ok)) {
  process.exitCode = 1;
}
