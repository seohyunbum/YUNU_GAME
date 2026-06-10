import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Fast, browser-free ratchet for AGENTS.md §10.
// Counts explicit THREE allocations inside per-frame update*/animate* functions.
// Lower this budget after cleanup; do not raise it for new gameplay features.
const MAX_HOTPATH_ALLOCATIONS = 0;
const MAX_HOTPATH_MATERIAL_UPDATES = 0;

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const srcRoot = join(projectRoot, "src");
const sourceExtensions = new Set([".ts"]);
const hotFunctionPattern =
  /(?:private\s+|public\s+|protected\s+|export\s+)?(?:async\s+)?(?:function\s+)?(update[A-Z]\w*|animate[A-Z]\w*|apply(?:TimeOfDay|OverworldTimeOfDay))\s*\([^)]*\)\s*(?::[^{]+)?\{/g;
const allocationPattern =
  /new\s+THREE\.(?:Vector[234]|Color|Quaternion|Euler|Matrix[34]|Box3|Sphere|Raycaster|(?:Mesh|Line|Points)?(?:Basic|Standard|Phong|Lambert|Toon)?Material|(?:Box|Sphere|Cylinder|Cone|Plane|Circle|Ring|Torus|Buffer)?Geometry)\b/g;
const materialNeedsUpdatePattern = /\bmaterial\.needsUpdate\s*=\s*true\b/g;

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, files);
    else if (sourceExtensions.has(path.slice(path.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (text[cursor] === "\n") line += 1;
  return line;
}

const findings = [];

for (const file of walk(srcRoot)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(hotFunctionPattern)) {
    const bodyStart = match.index + match[0].length - 1;
    const bodyEnd = findMatchingBrace(text, bodyStart);
    if (bodyEnd < 0) continue;
    const body = text.slice(bodyStart, bodyEnd + 1);
    const allocations = [...body.matchAll(allocationPattern)];
    const materialUpdates = [...body.matchAll(materialNeedsUpdatePattern)];
    if (allocations.length <= 0 && materialUpdates.length <= 0) continue;
    findings.push({
      file: relative(projectRoot, file).replaceAll("\\", "/"),
      name: match[1],
      line: lineNumberAt(text, match.index),
      count: allocations.length,
      materialUpdates: materialUpdates.length,
    });
  }
}

const total = findings.reduce((sum, finding) => sum + finding.count, 0);
const materialUpdateTotal = findings.reduce((sum, finding) => sum + finding.materialUpdates, 0);

if (total > MAX_HOTPATH_ALLOCATIONS || materialUpdateTotal > MAX_HOTPATH_MATERIAL_UPDATES) {
  if (total > MAX_HOTPATH_ALLOCATIONS) console.error(`Hotpath allocation budget exceeded: ${total}/${MAX_HOTPATH_ALLOCATIONS}.`);
  if (materialUpdateTotal > MAX_HOTPATH_MATERIAL_UPDATES) console.error(`Hotpath material.needsUpdate budget exceeded: ${materialUpdateTotal}/${MAX_HOTPATH_MATERIAL_UPDATES}.`);
  for (const finding of findings.sort((a, b) => b.count - a.count)) {
    console.error(`  - ${finding.file}:${finding.line} ${finding.name} => allocations ${finding.count}, material.needsUpdate ${finding.materialUpdates}`);
  }
  process.exit(1);
}

console.log(`Hotpath THREE allocations ${total} / budget ${MAX_HOTPATH_ALLOCATIONS}; material.needsUpdate ${materialUpdateTotal} / budget ${MAX_HOTPATH_MATERIAL_UPDATES}`);
