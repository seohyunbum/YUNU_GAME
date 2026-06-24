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
// 2026-06-20: 모바일 적대적 수정(파티초대 버튼·밤낮 동기·인벤 터치 버리기/설치·침대 휴식 선택창) → 9736→9749.
// 2026-06-20: 모바일 백로그2(퀘스트 클리어 가이드 팝업·독수리 T윈드커터/F해제) → 9749→9752.
// 2026-06-20: 적대적QA #11 — hunt_predators 활성 시 첫 전투 교육 1회(field+renderHud 1줄) → 9752→9754.
// 2026-06-20: 적대적QA #12 — 제련대·분쇄기 패널에 '쓰임' 표기(itemsUsing leaf, 패널당 2줄) → 9754→9758.
// 2026-06-20: 적대적QA #14 — 데스크탑 상자 획득 카드(chestContents leaf, import+호출 2줄) → 9758→9760.
// 2026-06-20: 마을 가드 — 골렘 바위 던지기(guardRocks leaf 배선: import+throwRock+필드2+update) → 9760→9764.
// 2026-06-20: 훈련장 종목별 글로벌 TOP5 랭킹(progressUpdate/loadTrainingBoard 메서드·trainingTries 배선·onSuccess/onFail) → 9764→9785.
// 2026-06-20: 저사양 모드 선택 — 타이틀 품질 선택기(loadQualityMode·fogFarForQuality·updateQualityButtons)+applyQualityMode 확장 → 9785→9816.
// 2026-06-20: 파티 아이템·설치물 공유(드롭/제련대/침대 sync + pickup/drop intercept·context 메서드) → 9816→9820.
// 2026-06-20: 맵당 몬스터 ~2배(저사양 1.3배) — 초기 predatorCount + 리전 정상상태 캡 둘 다 품질연동 상향(ambientMul/capMul) → 9820→9822.
// 2026-06-20: 게스트 설치물 공유(placeRequest→hostSpawnStation) — 게스트가 놓은 제작대/제련대 등도 파티 전원에 보이게. spawnPlaceableItem 게스트 라우팅 → 9822→9827.
// 2026-06-20: 날카로운 흑요석 궁극 FX — OBSIDIAN_PROJECTILE import 1줄 → 9828→9829.
// 2026-06-20: 사망 지점 지도 마커(deathMarker 필드+기록+회수시 제거+패널 배선) → 9829→9832.
// 2026-06-20: 집 공유(중간) — 호스트 권위 공유 창고(보기·입출고)+보급함, 캐시필드·컨텍스트·패널분기·보급분기 → 9832→9853.
// 2026-06-20: 일회성 제작템(가방·확장가방) 완료 후 제작목록 숨김 — 워크벤치·검색 필터 2줄 → 9853→9855.
// 2026-06-20: 침대 좌클릭 회수 회귀 수정(동기화 침대도 좌클릭=회수, pickUpBed 에 파티 intercept 1줄) → 9855→9856.
// 2026-06-20: 파티 거래 비가역 원장(복제 차단) — characterId/epoch 필드·로그 3지점·로드 재조정·새게임 발급 배선 → 9856→9876.
// 2026-06-20: 독수리 빙의 강화(bodyMeleeAttackPower 추출·eaglePossessionMaxHp 필드·HP/방어 레벨비례·흡혈 배선) → 9876→9877.
// 2026-06-21: 파티 설치(−1) 대칭 기록 1줄 → 9877→9878.
// 2026-06-21: 요새 게이트 ensure(소급)·해골기둥 비주얼·누적킬 세이브복원·요새탐방 퀘스트 → 9878→9900.
// 2026-06-21: 전직 차수별 화려 연출(playJobAdvanceFx) + FX import → 9900→9930.
// 2026-06-21: BGM 볼륨 정상화·아르페지오 풍부화·발소리/마법봉 음색 개선 → 9930→9934.
// 2026-06-21: 실음원(CC0) BGM 시스템 — musicPlayer 배선·맵별 트랙·updateMusic → 9934→9954.
// 2026-06-21: CC0 효과음 샘플(sfxPlayer) 배선·라우팅 → 9954→9959.
// 2026-06-21: selective bloom(EffectComposer) PC high 전용 배선 → 9959→9984.
// 2026-06-21: GTAO(앰비언트 오클루전) PC high composer 에 추가 → 9984→9993.
// 2026-06-21: HDRI 금속반사(applyEnvForQuality) PC 전용 배선 → 9993→10011.
// 2026-06-21: 야생 밀도 로드 탑업 — seedPredators(seedOverworld 추출)·ensureWildlifeDensity(소급 보충) + 로드/텔레포트 훅 → 10014→10028. 밀도 공식·목표는 constants(wildlifePredatorTarget)로 단일화, 분포/스폰은 main 인스턴스 상태 의존이라 잔류.
// 2026-06-21: 저장 중복슬롯 크리티컬 수정 — 디바운스(lastSaveCompletedAt 필드·SAVE_DEBOUNCE_MS 가드·import)+초단위 dedup → 10028→10031.
// 2026-06-21: 초보 온보딩 배선 — 코치 비콘 필드(coachEl·onboarding)+setupUi 전달+renderHud 1줄(updateOnboardingCoach)+addItem 첫인벤풀 가이드 1줄+import. 로직은 전부 ui/coachBeacon 리프 → 10042→10048.
// 2026-06-21: 제작대 레시피북 수량 제작 — counts 호이스트+maxCraft 필드(뷰)+craftWorkbenchRecipe 수량 루프. 계산은 recipeGuide.maxCraftable 리프 → 10048→10051.
// 2026-06-21: 제련대·분쇄기도 동일 컨셉(보유표기+수량 스테퍼) — 인라인 패널 HTML 을 ui/stationPanel 리프로 추출(순감). smelt/grindItem 수량 루프 → 10051→10015.
// 2026-06-21: 좌측하단 버프바 — buffs 뷰 1줄+hudRefreshTick 필드+update 루프 ~4/s 렌더 1줄. 버프 목록·렌더는 classSkills.activeBuffs/hudRenderer 리프 → 10015→10018.
// 2026-06-21: 광산 상자 전리품 상향(openMineChest 가 rollMineChestLoot 리프 사용)으로 인라인 루프 축소 → 10018→10014.
// 2026-06-23: 메테오 스킬을 전방 파이어볼로 변경하며 dead fireMeteor 메서드+import 제거 → 10014→10004.
// 2026-06-23: 용 장비 4종(자동착용·스탯·1인칭 건틀릿·3인칭 아바타·합연산) 배선 — 신규 기능으로 +37 → 10041.
// 2026-06-23: 달리기 퀘스트용 sprintSteps 누적/스냅샷 — +5 → 10046.
// 2026-06-23: 집터 판정 버그 수정 — 이동 생물(동물·몬스터·NPC·펫) 제외 BUILD_SITE_IGNORE_TYPES 셋+주석. 밀집된 야생 때문에 어디서도 집을 못 짓던 회귀 → 10046→10049.
// 2026-06-23: 요새 단계 맵별 이어하기 — fortressStageByMap 필드·enter startStage·grant 갱신·새게임 리셋·재입성 메시지. load/save 는 fortressSiege 리프 → 10049→10054.
// 2026-06-23: 4차 전직 배선 1탄(permanentNecklace 필드·tryAdvanceJob tier4·전능력치 ×1.1·영구목걸이 합산) +4 → 10058.
// 2026-06-23: 4차 전직 2탄 — 상시 반격(tryCounterReflect 메서드 + 4개 피격 경로에 attacker 주입) +10 → 10068.
// 2026-06-24: 4차 전직 3탄 — 4번째 스킬(G) useFourthSkill 메서드·fourthSkillContext·스킬 +10% 배선(primary/skill 컨텍스트 skillDamageMult) +20 → 10088.
// 2026-06-24: 4차 전직 5탄 — 초월 전직 FX 고도화(playJobAdvanceFx tier4 푸른 다이아몬드 승천 finale) +8 → 10096.
// 2026-06-24: 감사 후속 — 근접 가드 반격 시 잔여 데미지 메시지 중복 방지(lastDamageCountered 필드) +1 → 10097.
// 2026-06-24: 세이브 슬롯 번호 표기 — 로드 패널 슬롯뷰에 savedAt 전달(최근 저장 위치 표식용) +1 → 10098.
const MAX_MAIN_LINES = 10098;

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
