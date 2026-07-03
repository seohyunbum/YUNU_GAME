import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Fast, browser-free ratchet for AGENTS.md §10.
// Counts explicit THREE allocations inside per-frame update*/animate* functions.
// Lower this budget after cleanup; do not raise it for new gameplay features.
const MAX_HOTPATH_ALLOCATIONS = 0;
const MAX_HOTPATH_MATERIAL_UPDATES = 0;
// 2026-07-03 감사 후속 확장 — 종전 스캐너의 사각지대(§10 위반이 실제로 통과했던 유형)를 라쳇으로 봉쇄:
//   .clone() (Vector3 등 할당), new Set/Map, innerHTML 대입(변경감지 캐시 없는 매 프레임 DOM 쓰기 후보).
//   예산 = 현재 실측치(알려진 저위험 잔존분). 새 코드가 늘리면 실패. 정리로 줄면 예산을 내려 조인다.
// 현재 기준선(전수 실측·전부 저위험 확인): clone 6 = updateJamminis 2·updateMovement/Animals/Villagers/NightSpawns 각 1(엔티티 수 소·컬링됨),
//   set/map 2 = updateLavaMiniGame(미니게임 중만)·updateProjectiles(마법 AOE 명중 시만), innerHTML 3 = updateBossBar 2(쓰기 가드 1·빈클리어 1)·tickMinimap 1(마커 변경감지 가드).
const MAX_HOTPATH_CLONES = 6;
const MAX_HOTPATH_COLLECTIONS = 2;
const MAX_HOTPATH_INNERHTML = 3;

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const srcRoot = join(projectRoot, "src");
const sourceExtensions = new Set([".ts"]);
const hotFunctionPattern =
  /(?:private\s+|public\s+|protected\s+|export\s+)?(?:async\s+)?(?:function\s+)?\b(update[A-Z]\w*|animate[A-Z]\w*|tick[A-Z]\w*|apply(?:TimeOfDay|OverworldTimeOfDay))\s*\([^)]*\)\s*(?::[^{]+)?\{/g;
const allocationPattern =
  /new\s+THREE\.(?:Vector[234]|Color|Quaternion|Euler|Matrix[34]|Box3|Sphere|Raycaster|(?:Mesh|Line|Points)?(?:Basic|Standard|Phong|Lambert|Toon)?Material|(?:Box|Sphere|Cylinder|Cone|Plane|Circle|Ring|Torus|Buffer)?Geometry)\b/g;
const materialNeedsUpdatePattern = /\bmaterial\.needsUpdate\s*=\s*true\b/g;
const clonePattern = /\.clone\(\)/g;
const collectionPattern = /\bnew\s+(?:Set|Map)\b/g;
const innerHTMLPattern = /\.innerHTML\s*=/g;

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
    const clones = [...body.matchAll(clonePattern)];
    const collections = [...body.matchAll(collectionPattern)];
    const innerHtml = [...body.matchAll(innerHTMLPattern)];
    if (allocations.length <= 0 && materialUpdates.length <= 0 && clones.length <= 0 && collections.length <= 0 && innerHtml.length <= 0) continue;
    findings.push({
      file: relative(projectRoot, file).replaceAll("\\", "/"),
      name: match[1],
      line: lineNumberAt(text, match.index),
      count: allocations.length,
      materialUpdates: materialUpdates.length,
      clones: clones.length,
      collections: collections.length,
      innerHtml: innerHtml.length,
    });
  }
}

const total = findings.reduce((sum, finding) => sum + finding.count, 0);
const materialUpdateTotal = findings.reduce((sum, finding) => sum + finding.materialUpdates, 0);
const cloneTotal = findings.reduce((sum, finding) => sum + finding.clones, 0);
const collectionTotal = findings.reduce((sum, finding) => sum + finding.collections, 0);
const innerHtmlTotal = findings.reduce((sum, finding) => sum + finding.innerHtml, 0);

const exceeded = total > MAX_HOTPATH_ALLOCATIONS || materialUpdateTotal > MAX_HOTPATH_MATERIAL_UPDATES || cloneTotal > MAX_HOTPATH_CLONES || collectionTotal > MAX_HOTPATH_COLLECTIONS || innerHtmlTotal > MAX_HOTPATH_INNERHTML;
if (exceeded) {
  if (total > MAX_HOTPATH_ALLOCATIONS) console.error(`Hotpath allocation budget exceeded: ${total}/${MAX_HOTPATH_ALLOCATIONS}.`);
  if (materialUpdateTotal > MAX_HOTPATH_MATERIAL_UPDATES) console.error(`Hotpath material.needsUpdate budget exceeded: ${materialUpdateTotal}/${MAX_HOTPATH_MATERIAL_UPDATES}.`);
  if (cloneTotal > MAX_HOTPATH_CLONES) console.error(`Hotpath .clone() budget exceeded: ${cloneTotal}/${MAX_HOTPATH_CLONES}. 스크래치 벡터를 재사용하세요(§10.1).`);
  if (collectionTotal > MAX_HOTPATH_COLLECTIONS) console.error(`Hotpath new Set/Map budget exceeded: ${collectionTotal}/${MAX_HOTPATH_COLLECTIONS}. 스크래치 컬렉션을 .clear() 로 재사용하세요(§10.1).`);
  if (innerHtmlTotal > MAX_HOTPATH_INNERHTML) console.error(`Hotpath innerHTML budget exceeded: ${innerHtmlTotal}/${MAX_HOTPATH_INNERHTML}. 변경감지 캐시 또는 속성 직접 갱신을 쓰세요(§10.4).`);
  for (const finding of findings.sort((a, b) => (b.count + b.clones + b.collections + b.innerHtml) - (a.count + a.clones + a.collections + a.innerHtml))) {
    console.error(`  - ${finding.file}:${finding.line} ${finding.name} => alloc ${finding.count}, clone ${finding.clones}, set/map ${finding.collections}, innerHTML ${finding.innerHtml}, needsUpdate ${finding.materialUpdates}`);
  }
  process.exit(1);
}

console.log(`Hotpath THREE alloc ${total}/${MAX_HOTPATH_ALLOCATIONS}; clone ${cloneTotal}/${MAX_HOTPATH_CLONES}; set/map ${collectionTotal}/${MAX_HOTPATH_COLLECTIONS}; innerHTML ${innerHtmlTotal}/${MAX_HOTPATH_INNERHTML}; needsUpdate ${materialUpdateTotal}/${MAX_HOTPATH_MATERIAL_UPDATES}`);
