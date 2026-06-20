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
// 2026-06-19: 모바일 점검 — 새 게임 quality 모바일 분기 + useItem 배선(net 0) + 중복 performance 리셋 5줄 제거 → 9669(예산초과)→9664.
// 2026-06-19: ensureVillageShops 를 대장간 보강까지 확장하며 상점 스폰 블록 압축 → 9664→9658.
// 2026-06-19: 세이브 데이터 유실 수정 — saveGame/덮어쓰기 동시저장 직렬화 가드(saveInProgress)+finally,
//   덮어쓰기 allowTrim:false 안전화, 떨궈진 슬롯 식별 경고. 정본 저장 orchestration 이라 리프 추출 불가 → 9658→9666.
// 2026-06-19: 세이브 후속 — 로드 세이브 명명슬롯 승급(promoteSaveToSlotList 리프) 배선 import+호출 → 9666→9669.
// 2026-06-19: 적대적 리뷰 후속 — savedAt 없는 import 는 승급 제외(중복 슬롯 방지) 가드 1줄 → 9669→9670.
// 2026-06-19: arcadePoints 세이브 포함(판매→로드 포인트 복제 차단) — snapshot 1줄 + restore 롤백 가드 2줄 → 9670→9673.
// 2026-06-19: 스킬 이펙트 고도화 — 메테오 하늘낙하(fireMeteor 메서드)+치유의 비/정령 폭풍 배선 → 9673→9685.
// 2026-06-20: 크리처 raycast cap 적용 시 addWorldObject raycast 등록부 압축 → 9685→9684.
// 2026-06-20: 요새 최고 단계 기록(bestFortressStage load/save·field·기록 표시 배선) → 9684→9694.
// 2026-06-20: 전체 플레이어 TOP3 랭킹(leaderboard field·loadLeaderboard·패널 훅·publish 확장) → 9694→9703.
// 2026-06-20: 랭킹 공정성 — 기록 당시 baseLevel 저장/발행(난이도 맥락 'Lv N' 표기) → 9703→9711.
// 2026-06-20: 적대적QA 클러스터A — 요새 보상 즉시저장(saveSiegeRewardSnapshot)+패널닫기 자동저장 → 9711→9725.
// 2026-06-20: 적대적QA — 배고픔 경고 텔레그래프 + 동굴 출현 pity(caveMissStreak) → 9725→9730.
// 2026-06-20: PC 아웃라인 거리 게이트(outline distance gating) — addCartoonOutlines 반환화+object.outlines+컬링 게이트 → 9730→9736.
const MAX_MAIN_LINES = 9736;

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
