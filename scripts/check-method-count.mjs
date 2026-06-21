import { readFileSync } from "node:fs";

// WildernessGame 의 메서드 수 = God Object 의 "책임 수" 직접 지표.
// 줄 수(check:size)는 비주얼/순수부만 빼도 줄지만, 메서드 수는 "메서드 통째 이동" 때만 줄어든다.
// 그래서 둘을 함께 본다. 예산은 ratchet: 내려가기만. (AGENTS.md §1·§7)
// 2026-06-19: 전직 시스템의 입력/전이 배선 메서드 2개(useThirdSkill·tryAdvanceJob)로 460→462.
// 2026-06-19: 몬스터 요새 디펜스 메서드 4개(enterFortressSiege·exitFortressSiege·spawnSiegeMonster·spawnFortressGate)로 462→466.
// 2026-06-19: 메테오 하늘낙하 스폰 메서드(fireMeteor) 1개로 466→467 (스킬 이펙트 고도화).
// 2026-06-20: 요새 최고 단계 기록 load/save 메서드로 467→468.
// 2026-06-20: 전체 랭킹 조회 메서드(loadLeaderboard)로 468→469.
// 2026-06-20: 기록 당시 baseLevel 로드 메서드(loadBestFortressBaseLevel)로 469→470.
// 2026-06-20: 요새 보상 즉시저장 메서드(saveSiegeRewardSnapshot)로 470→471.
// 2026-06-20: 훈련 랭킹 — progressUpdate()+loadTrainingBoard() 메서드로 471→473.
// 2026-06-20: 품질 선택 메서드 3개(loadQualityMode·fogFarForQuality·updateQualityButtons)로 473→476.
// 2026-06-20: broadcastSharedStorage(공유 창고 동기화 전송) 1개 → 476→477.
// 2026-06-20: appendPartyLedger(파티 거래 기록) 1개 → 477→478.
// 2026-06-20: bodyMeleeAttackPower(빙의 데미지=본체 능력치 추출) 1개 → 478→479.
// 2026-06-21: ensureFortressGate 1개 → 479→480.
// 2026-06-21: playJobAdvanceFx 1개 → 480→481.
// 2026-06-21: 사운드 개편 — kit·combatMoodActive 2개 → 481→483.
const MAX_METHODS = 483;

const file = new URL("../src/main.ts", import.meta.url);
const text = readFileSync(file, "utf8");
const methodPattern = /^ {2}(?:private |public |protected |readonly |async )*[A-Za-z0-9_]+\s*\(/;
const count = text.split("\n").filter((line) => methodPattern.test(line)).length;
const headroom = MAX_METHODS - count;

if (count > MAX_METHODS) {
  console.error(`✗ src/main.ts 메서드 ${count}개로 예산(${MAX_METHODS}) 초과 (+${count - MAX_METHODS}).`);
  console.error("  비주얼/순수부만 빼지 말고, 메서드를 통째로 src/game/·src/ui/ 로 옮겨 클래스에서 제거하세요. (AGENTS.md §1)");
  process.exit(1);
}

console.log(`✓ src/main.ts 메서드 ${count}개 / 예산 ${MAX_METHODS} (여유 ${headroom}).`);
if (headroom >= 15) {
  console.log(`  ↓ 여유가 큽니다. scripts/check-method-count.mjs 의 MAX_METHODS 를 ${count} 근처로 낮춰 조이세요.`);
}
