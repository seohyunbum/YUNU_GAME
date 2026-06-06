import { readFileSync } from "node:fs";

// src/main.ts 는 "지휘자(conductor)" 전용이어야 한다 — 게임 루프·입력·배선만.
// 신규 시스템은 src/game/ 또는 src/ui/ 로 추출한다 (AGENTS.md 제1원칙).
//
// 이 예산은 ratchet: 내려가기만 한다.
// main.ts 를 줄였으면 아래 MAX_MAIN_LINES 를 새 줄 수로 낮춰 예산을 조여라.
const MAX_MAIN_LINES = 10270;

const file = new URL("../src/main.ts", import.meta.url);
const lines = readFileSync(file, "utf8").split("\n").length;
const headroom = MAX_MAIN_LINES - lines;

if (lines > MAX_MAIN_LINES) {
  console.error(`✗ src/main.ts 가 ${lines}줄로 예산(${MAX_MAIN_LINES})을 초과했습니다 (+${lines - MAX_MAIN_LINES}).`);
  console.error("  신규 코드는 main.ts 가 아니라 src/game/ 또는 src/ui/ 로 보내세요.");
  console.error("  무언가를 추출해 main.ts 를 줄이면 통과합니다. (AGENTS.md 제1·7항)");
  process.exit(1);
}

console.log(`✓ src/main.ts ${lines}줄 / 예산 ${MAX_MAIN_LINES} (여유 ${headroom}).`);
if (headroom >= 200) {
  console.log(`  ↓ 여유가 큽니다. scripts/check-main-size.mjs 의 MAX_MAIN_LINES 를 ${lines} 근처로 낮춰 예산을 조이세요.`);
}
