import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const roots = ["src/game", "src/ui"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const importPattern = /(?:from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;
const violations = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
      continue;
    }
    if (!sourceExtensions.has(extname(path))) continue;
    inspectFile(path);
  }
}

function inspectFile(path) {
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (!specifier?.startsWith(".")) continue;
    const resolved = resolve(dirname(path), specifier).replaceAll("\\", "/");
    const mainPath = resolve(projectRoot, "src/main").replaceAll("\\", "/");
    if (resolved === mainPath || resolved === `${mainPath}.ts`) {
      violations.push(`${path.replace(projectRoot, ".")} imports ${specifier}`);
    }
  }
}

for (const root of roots) walk(resolve(projectRoot, root));

if (violations.length > 0) {
  console.error("Architecture check failed: src/game and src/ui must not import src/main.ts.");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log("Architecture check passed: src/game and src/ui do not import src/main.ts.");
