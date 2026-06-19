import { readFileSync } from "node:fs";

// src/main.ts 는 "지휘자(conductor)" 전용이어야 한다 — 게임 루프·입력·배선만.
// 신규 시스템은 src/game/ 또는 src/ui/ 로 추출한다 (AGENTS.md 제1원칙).
//
// 이 예산은 ratchet: 내려가기만 한다.
// main.ts 를 줄였으면 아래 MAX_MAIN_LINES 를 새 줄 수로 낮춰 예산을 조여라.
// 2026-06-19: 전직 시스템 배선(jobTier·F키·전직 + 2·3차)으로 9489→9534.
// 2026-06-19: 모바일 터치 배선(터치 컨트롤 생성·포인터락 우회·pixelRatio/quality 모바일 분기 + 저장 콜백)으로 9534→9550.
// 2026-06-19: 몬스터 요새 디펜스 배선(siege 상태·진입/이탈·클램프/AI 경계·사망/저장 게이트·웨이브 spawn·HUD·요새 입구)으로 9550→9662.
// 로직은 모두 리프(game/fortressSiege·interiors·caveMonsters)에 두었고 main.ts 증가분은 배선 + 요새 진입/이탈/스폰/게이트 메서드다.
const MAX_MAIN_LINES = 9662;

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
