# 작업 이력과 실패 기록

이 문서는 성공 결과만 남기는 로그가 아니다. 반복하면 손해가 큰 실패, 되돌림, 보류 판단을 기록해서 Codex와 Claude Code가 같은 시행착오를 다시 밟지 않게 하는 재발 방지 문서다.

새 기록은 아래 형식을 따른다.

```text
## YYYY-MM-DD — 제목

- 시도:
- 결과:
- 이유:
- 다음 판단:
- 관련 파일/검증:
```

## 2026-06-21 — 초보 온보딩 고도화: 제작대·가방을 놓치지 않게 (3티어 전부)

- 시도: 처음 켠 유저가 사실상 필수인 제작대 설치·가방 제작을 놓침. 원인=발견성(HUD엔 퀘스트 제목만, "어떻게"는 hover/클릭 뒤; I키·우클릭-설치·작은가방 비직관). 사용자 선택=전체(Tier 1+2+3).
- 결과: ① **핵심 스텝 가이드 1회 자동**(craft_workbench_item/place_workbench/craft_bag 활성 순간 objectiveGuide 자동+exitPointerLock). ② **HUD 코치 비콘**(1챕터 한정 "다음 할 일 1개"+키칩, 스텝마다 자동 갱신·✕ 해제, 챕터1 벗어나면 자동 숨김). ③ **첫 인벤-풀 시 가방 제작 가이드 1회**. ④ **퀘스트 문구 단계번호화**(제작대 제작/설치/가방). ⑤ **인벤 UI**: 설치형 '설치' 뱃지, 2x2(어디서나) vs 3x3(설치한 제작대) 동적 라벨+설명, 가방 부족 경고바(8→40칸·urgent 점멸). 로직·데이터는 ui/coachBeacon 리프, 상태 전부 휘발(세이브·회귀 0).
- 설계 판단: 푸시>풀(결정적 순간 먼저 안내, 1회·해제). 자동팝업은 exitPointerLock으로 커서 확보. 코치 비콘은 COACH_HINTS 키(챕터1)만 표시→자동 은퇴.
- 검증: verify+build, E2E 11종(시작 비콘·핵심스텝 자동팝업·1회성·설치뱃지·가방경고바·2x2라벨·✕닫기·무예외) + 스크린샷. main 배선 6줄(전부 wiring)로 ratchet 10042→10048(사유 기재). 설계 docs/beginner-onboarding-design.md.

## 2026-06-21 — 잉여 고기·가죽 소모처: 가죽 붕대 + 고기 스튜(전투 버프식) + 퀘스트

- 시도: 후반에 고기·가죽이 적체(요리 시스템 없음·크래프팅 소모 거의 없음) → 반복 소모 회복/버프식 추가.
- 결과: ① 가죽 붕대(가죽 6 → 회복 12) = HEAL_ITEMS 재사용(메인/세이브 변경 0). ② 고기 스튜(고기 16+석탄 2+철 1) = 즉시 회복 20 + 5분 공격·방어 +5 버프. 버프는 `skillBuffs.stewBuffUntil`(휘발, empower/rally 패턴) + `stewAttackBonus`/`stewDefenseBonus`(classSkills leaf)를 bodyMeleeAttackPower·currentRangedDamage·equippedArmorValue 합산에 추가. 사용은 useHotbarItem meat_stew 분기→context.consumeStew(메인 컨텍스트 프로퍼티, 클래스 메서드 아님=메서드예산 무영향). ③ 퀘스트 craft_bandage·craft_stew(countItem 기반, id-set 소급). 비주얼 전용 모델 2종(content-test 돌덩이 폴백 방지).
- 다음 판단: 회복 수치 medkit(15)·고급(25) 아래로 유지(붕대 12). 스튜 버프는 empower/necklace 와 곱·합 스택(의도). 적체 더 빼야 하면 무두질 가죽→고렙 가죽장비(설계서 §3-B) 후속.
- 관련 파일/검증: `items.ts`·`classSkills.ts`·`main.ts`·`hotbarUse.ts`·`heldItemVisuals.ts`·`recipes.ts`·`objectives.ts`. verify+build, E2E 9종(스튜 버프 +5/원복·붕대 회복 12·소비), 퀘스트 module 검증. 설계 `docs/meat-leather-sinks-design.md`. ratchet line 10042 유지(컨텍스트 1줄 병합).

## 2026-06-21 — 흑요석 광맥 시각 강화 + 흑요석 획득 퀘스트

- 시도: 동굴 흑요석 타일이 석탄(무광 검정)과 헷갈린다는 피드백 → 귀한 재료답게 눈에 띄게 강화 + 획득 가이드 퀘스트 추가.
- 결과(시각, `oreVisual.ts` leaf): 흑요석 base 색 #24152f→#3d1f66(선명한 보라), base/accent emissive 강화(보라 자가발광), 파편 위에 '빛나는 보라 결정 스파이크' 1개 추가(공유 cone[3] 재사용 → dispose-skip 동일). **블룸/post-processing 이 OFF(6452b0c)라 emissive 헤일로가 안 생김 → 머티리얼 색 자체를 밝게 해야 띄움**(이 점이 핵심 교훈). 실 렌더 확인: 석탄=거의 안 보이는 무광 검정, 흑요석=선명한 보라로 확연히 구분.
- 결과(퀘스트, `objectives.ts`): `gather_obsidian`(흑요석 2개) 추가 — craft_advanced_medkit 다음·craft_necklace 앞(목걸이 재료라 자연스러운 선행). 조건 countItem("obsidian")≥2 → 스냅샷/메인 변경 0, id-set 라 옛 세이브 자동 소급. 가이드: 다이아 곡괭이로 동굴 채굴(power≥5 게이트, main.ts:4728), 몬스터 요새 클리어 보상(fortressSiege +obsidian), 흑요석 상자, 고레벨 필드보스. 보상=특수 제련대(다음 단계 sharp_obsidian 정제용).
- 다음 판단: post-processing 복구되면 흑요석 emissive 헤일로가 더 살아남 → 그때 base 보라를 다시 약간 어둡게 조정 여지. 동굴 실채굴 스폰은 oreVisual 공유본이라 자동 반영.
- 관련 파일/검증: `src/game/oreVisual.ts`·`src/objectives.ts`, 테스트 mock `scripts/gameplay-systems-test.mjs`(동시세션이 classSkills 에 skillSound 추가했으나 mock 미반영 → verify 적색이던 것 동반 수정). verify+build 통과, 퀘스트 module 검증(index 34, 2개 완료), 실 WebGL 렌더 스크린샷 확인.

## 2026-06-21 — 야생 몹 밀도 상향(2.4/1.5) + 로드 시 탑업(옛 세이브 소급)

- 시도: ① 밀도 배수 고품질 2.0→2.4·저사양 1.3→1.5 ② 로드/맵이동 직후 포식자가 목표보다 적으면 즉시 보충(옛 세이브 소급). 진단: `restoreSaveData` 가 `resetGameState({reseed:false})` 후 저장된 몹을 복원만 하고 재시딩 안 함 + 야생몹이 세이브에 저장됨(shouldPersistObject) → 밀도 상향 이전 세이브는 듬성한 분포 그대로였음.
- 결과/결정: 밀도 공식·배수를 `constants.ts`(WILDLIFE_DENSITY_MUL_*·wildlifePredatorTarget)로 **단일 소스화** — 시딩(seedOverworld)·런타임 야간 캡(capMul)·로드 탑업이 모두 같은 값을 써 드리프트 차단(따로 두면 시딩 2.4·캡 2.0 으로 인구 감쇠함). seedOverworld 포식자 루프를 `seedPredators(count)` 로 추출해 탑업과 공유. `ensureWildlifeDensity()`(목표-현재 차액만 스폰, 멱등, 게스트/비오버월드 skip)를 `restoreSaveData` 오버월드 분기 + `teleportToWorldMap` 복원 분기에 훅(결정: 다른맵 방문 보강 O / 동굴복귀 X / 포식자만).
- 다음 판단(★perf watch): 상시 밀도 +20%(저사양 +15%) + 옛 세이브 로드 시 최대 ~144마리 일괄 스폰. **perf-check(모바일 실측) 권장**, 과하면 2.2/1.4 로 소폭 하향(배수는 constants 한 곳만 고치면 전부 반영). 시간대×지역 게이트(낮·리전 밖 신규스폰 0)는 별개 설계로 미변경.
- 관련 파일/검증: `constants.ts`·`main.ts`(seedPredators·ensureWildlifeDensity·capMul·restore/teleport 훅), ratchet 2종(line 10014→10028·method 488→490, 사유 주석). E2E: 신규 시딩 145≈목표144·탑업 회복144·멱등·저사양 90 검증. 설계 `docs/wildlife-density-and-load-topup.md`.

## 2026-06-21 — ⚠️ 비주얼 post-processing 반영 후 OFF (과노출 회귀) [동시 세션]

- 시도: selective bloom(발광체 글로우) + GTAO(앰비언트 오클루전) + 금속 HDRI 반사를 PC high 전용으로 추가(커밋 12a9c77 → 6cfde7a → 54bbb89).
- 결과/원복: 직후 "화면이 하얗게(과노출)" 회귀 발생 → **post-processing 컴포저를 일시 OFF**(6452b0c). bloom/GTAO/HDRI 코드는 남아 있으나 컴포저가 꺼져 효과 비활성.
- 이유: 톤매핑/노출이 겹치며 과노출. 노출·톤매핑 기준을 먼저 잡지 않은 채 후처리를 합성한 게 원인으로 추정.
- 다음 판단(★재발 방지): **post-processing/bloom 을 다시 켜려면 노출·톤매핑 보정이 선행돼야 함.** 모르고 재활성하면 같은 과노출이 재발하므로 재시도 전 반드시 이 항목 확인. git revert 가 아니라 fix 커밋으로 껐기 때문에 `git log --grep revert` 로는 안 잡힘.
- 관련 파일/검증: git 6452b0c ← 54bbb89 ← 6cfde7a ← 12a9c77, 렌더 비주얼 컴포저.

## 2026-06-21 — 모바일 진입 자동 가로+전체화면 + 세로 차단 회전 오버레이 (de096d2)

- 시도: 직업 선택 후 진입 클릭(사용자 제스처)에서 전체화면 요청 → (실모바일) `screen.orientation.lock('landscape')`. 세로일 때 화면을 가리는 회전 오버레이(`body.touch-mode.in-game::after`).
- 결과/결정: ① 오버레이는 차단형 ② 새 게임+불러오기 진입 모두 적용 ③ 데스크톱 `?touch=1` 강제모드는 전체화면만(lock 생략) ④ orientationchange→resize 추가.
- 이유/한계(★재시도 방지): **iOS Safari(iPhone)는 Fullscreen/Orientation Lock API 자체가 없어 강제 불가** — 코드로 우회 불가, 오버레이 안내가 최선. **Android 만 완전 강제.** iPadOS 13+ 는 desktop UA 로 위장해 lock 생략됨. 모든 호출은 feature-detect + catch 라 미지원 기기서도 예외 0.
- 다음 판단/검증: 실제 API 무스텁 E2E(미처리 rejection·콘솔에러 0) + **6관점 적대적 감사 확정 버그 0건** → 재감사 불필요.
- 관련 파일/검증: `src/game/platform.ts`(enterLandscapeFullscreen)·`main.ts`(진입 훅·in-game 클래스)·`style.css`. 설계 `docs/mobile-landscape-fullscreen.md`.

## 2026-06-21 — 직업별 패시브 개편 (a1c5b40)

- 시도: 무기조건 데미지(전사 근접 +10% / 힐러 지팡이 +10%(힐량 포함) / 마법사 +15% / 소환사 +10%), 방어 레벨스케일(전사 base 4 +0.2/lv·탱커 base 8 +0.4/lv), 힐러 마나 +0.25/s, 탱커 방패 장착 시 체력 +(0.25+레벨/50)/s, 거너 쿨감 총기 전용화 + 이동속도 +10%.
- 결과/결정/함정(★): ① 데미지 배수는 기존 `empowerMultiplier` 와 동일 패턴으로 **1회만** 적용 — currentDamage 파생 스킬(불타는공격·대지가르기 = currentDamage×2)은 자동 포함이라 **이중적용 금지**, 플랫 즉발 스킬(무거운공격·TNT·파이어볼·메테오·바람정령)만 명시 곱. ② **DoT/HoT(정령폭풍·화상·불타는방패·치유의비)·펫·빙의는 배수 제외(결정)** — 틱 시점 무기정보 없음. ③ 방어/회복 레벨스케일은 `levelStatBonus`(전직 보너스 포함) 아닌 **순수 캐릭터 레벨**. ④ 목걸이 제작 퀘스트는 상자드랍 소유가 아니라 `craftedNecklace` 신호로만 완료.
- 이유: 무기 선택·직업 정체성을 살리되 기존 데미지 파이프라인(empowerMultiplier)을 그대로 재사용해 회귀 위험 최소화.
- 관련 파일/검증: `classPassives.ts`(classWeaponDamageMult)·`items.ts`·`classSkills.ts`·`main.ts`. 골든(매트릭스·방어/회복)+E2E 9종+핀 SHA 적대적 검수 0건. 설계 `docs/class-passive-rework.md`.

## 2026-06-21 — 재료판매 70%↓ + 상점 2배 + 에픽 목걸이 4종 + 퀘스트 삽입(소급) (e7adf78)

- 시도: SELL_SHOP_RATE 0.85→0.595(판매 포인트 ~70%), 상점 9→18종(일반·고급·희귀), 에픽 목걸이 4종(힘/수호/쾌속/현자) + K 캐릭터창 목걸이 슬롯·착용 UI, 신규 퀘스트(재료팔기·물건사기·목걸이 제작/착용).
- 결과/핵심(★재사용 패턴): **튜토리얼 퀘스트 삽입은 진행도가 id-set(`completedStepIds`)이라, `RAW_TUTORIAL_STEPS` 원하는 위치에 끼워넣기만 하면 이미 그 지점을 지난 세이브도 자동 소급 노출 — 마이그레이션 코드 불필요.** (memory `yunu-game-quest-insertion-pattern` 에도 기록.) 목걸이 효과는 `necklace.ts` 헬퍼로 분리.
- 다음 판단: 목걸이 수치는 이후 밸런스 상향됨(공격/방어 +5→+7, 쾌속 ×0.9→×0.75, 현자 ×0.9 + 마나 회복 +1/s).
- 관련 파일/검증: `trading.ts`·`items.ts`·`necklace.ts`·`objectives.ts`·`ui/characterPanel.ts`·`saveManager/saveMigration/types`·`chestLoot.ts`·`recipes.ts`.

## 2026-06-20 — 이층집 전용 외관 + 보급상자 집 종류별 쿨타임 (2c17116)

- 시도: deluxe(플레이어) 집도 variant 3 이면 2층 외관(deluxeTwoStoryStyle, 단층 코티지보다 크고 높게). 보급상자 쿨타임을 단일값 → 집 종류(`currentHouseBedTier`)별 Record 로 분리(통나무/돌/이층 각자, 같은 종류끼리만 공유).
- 결과/함정(★): **새 player 세이브 필드는 `saveMigration` 의 필드별 재구성에도 반드시 추가**해야 로드 시 안 날아감(과거 `currentHouseBedTier` 누락으로 매 로드 초기화되던 버그와 동일 교훈).
- 관련 파일/검증: `structureVisuals.ts`·`main.ts`·`saveManager/saveMigration/types`. 테스트 save-migration/roundtrip·gameplay-systems.

## 2026-06-19 — 몬스터 요새 적대적 검증 + 확정 버그 6건 수정

- 시도: 배포된 요새 디펜스에 6차원 적대적 코드 리뷰(워크플로) + 발견별 독립 반증 검증. 16건 발견→10 확정→오수정 방지 위해 raw 코드 재검증 후 6건 수정.
- 수정: ① 엘리트 공격력 ×1.4 누락(HP·크기만) ② siege 중 맵 텔레포트/지도 패널 차단 + leaveCave 가 모든 cave 이탈에서 fortressSiege=null(파티 소환·맵 텔레포트가 exitFortressSiege 우회→overworld+siege 활성 유령상태 근본 버그) ③ 독수리 빙의 정리(leaveCave→endEaglePossession + spawnEagleSummon 의 cave eagle caveObjectIds 추적, orphan 방지) ④ spawnCursor 모듈전역→SiegeState(재진입 통로편향).
- 미수정(판단): 요새 몬스터 일반 루팅=의도(사용자 요구는 플레이어 무드랍이며 몬스터 루팅 아님, combat 2경로 수정 위험 회피). #10 "고단계 스폰 락업"=false positive(toSpawn 은 자리 나면 감소·deferred 정상). fortressGate 영속 정상.
- 검증: tsc CI 통과 + 배포. **교훈**: blind 구현은 "여러 exit/전이 경로가 상태 플래그를 안 비우는" 일관성 버그가 흔함 → 공통 이탈 함수(leaveCave)에서 플래그 해제가 근본 수정. 적대적 검증의 false positive(deferred 스폰)는 raw 재검증으로 걸러야.
- 관련: `src/game/fortressSiege.ts`·`src/main.ts`(leaveCave·teleportToWorldMap·togglePanel·spawnSiegeMonster·spawnEagleSummon), ratchet.

## 2026-06-19 — 몬스터 요새: 기존→동굴 리네임 + 신규 디펜스 아레나(무한 웨이브)

- 시도: (A) 기존 '몬스터 요새'(동굴 15% 변형)를 '몬스터 동굴'로 리네임(사용자 텍스트만, fortressBossKills 휘발값이라 마이그레이션 0). (B) 신규 '몬스터 요새' = 디펜스 아레나: 중앙 플레이어 + 4통로 무한 점증 웨이브, 단계 클리어마다 전직의서(차등)+보상, 요새 내 사망 시 드랍 0, 사망/포기로만 이탈.
- 결정(사용자): 진입=오버월드 '요새 입구' 구조물 / 무한 점증 단계 / 전직의서는 요새+기존 동굴 둘 다 / 자가 방어 호드(설치형 타워 X).
- 결과(아키텍처): **locationMode 확장 안 함** — "cave" 재사용 + `fortressSiege` 상태 플래그(분기 40여 곳·세이브 마이그레이션 회피). 클램프는 물리충돌이 아니라 위치클램프라 아레나 폭 확장(34×34) 안전. 로직은 리프 `game/fortressSiege.ts`(무한 웨이브 상태머신·점증 공식·보상). `interiors.createSiegeArenaInterior`(정사각 셸+중앙 단상+4 통로+붉은 요새). `caveMonsters` AI에 arenaBounds 주입. main.ts는 배선 + 진입/이탈/스폰/게이트 메서드 4개.
- 결과(세이브): siege 상태는 휘발(저장·자동저장 모두 차단) → **SAVE_VERSION 무변경**. 요새 입구(fortressGate)는 saveManager 블랙리스트 미포함이라 자동 저장 + 로드 스위치 케이스 추가로 영속. ratchet MAX_MAIN_LINES 9550→9662, MAX_METHODS 462→466.
- 다음 판단: **Node 없어 로컬 verify·플레이 불가** → CI 타입체크 + 폰/PC 실플레이로 검증(merge→deploy). 알려진 v1 한계: 요새 진행 저장 불가(한 세션 완료 전제), 신규 요새 전용 퀘스트 미추가. 밸런스(웨이브 수·레벨·보상)는 `fortressSiege.ts` 데이터/공식만 조정.
- 관련 파일: `src/game/fortressSiege.ts`(신규)·`interiors.ts`·`caveMonsters.ts`·`constants.ts`·`types.ts`·`main.ts`·`objectives.ts`·`itemInfo.ts`·`style.css`, ratchet 2종. 설계 `docs/monster-fortress-design.md`.

## 2026-06-19 — 모바일(터치) 지원 P0~P3 구현

- 시도: 스마트폰(가로) 터치 플레이 핵심부. 데스크톱 키보드/마우스는 100% 유지하고 터치를 병행 추가. 분석 6서브시스템(입력·카메라·클릭·UI/CSS·렌더성능·뷰포트) 후 단계화(P0 토대·P1 이동/시점·P2 액션버튼·P3 성능 프리셋).
- 결과: 신규 리프 `src/game/platform.ts`(isTouchDevice)·`src/ui/touchControls.ts`(좌 조이스틱→keys WASD/Shift, 우측 절반 드래그→rotateCameraByMouse, 점프/공격/스킬 R·T·F/가방·지도 버튼, 멀티터치 식별자 라우팅). main.ts 배선만: 터치 시 포인터락 우회·pixelRatio cap(0.75)·qualityMode 'performance' 시작. index.html viewport(user-scalable=no·viewport-fit=cover), style.css `.touch-mode`(타이틀 중 숨김·HP/MP 좌상단·controls-guide/save 숨김·safe-area). ratchet MAX_MAIN_LINES 9534→9549.
- 핵심 설계: **게임 로직 무수정** — 이동은 기존 `keys` Set 재사용, 시점은 `rotateCameraByMouse` 재사용, 액션은 기존 `interact()/useClassSkill()/togglePanel()` 직접 호출. 핫바는 기존 `<button data-hotbar>` 가 이미 click 위임(hudRenderer)이라 탭 자동 동작 → 별도 핫바 안 만듦.
- 테스트 전 보강(자기검토): ① 모바일 저장 구멍 메움 — save-controls 숨김으로 수동 저장 불가였음 → 터치 메뉴에 '저장' 버튼 추가(saveGame 콜백). ② iOS 고무줄 스크롤 방지 — 조이스틱/시점 추적 터치에만 touchmove preventDefault(패널 목록 스크롤은 방해 안 함). ③ 메뉴 위치 충돌 — top-center 가 보스바(top:22)와 겹쳐 좌측 중앙 세로 스택으로 이동. 검증된 정상: interact()는 포인터락 가드 없음(공격 버튼 동작), .crosshair 이미 존재(조준점), 타이틀→직업선택→플레이→저장→재로드 전부 DOM 버튼이라 탭 동작. 크래프팅(우클릭/드래그)은 P5 까지 모바일 미지원(알려진 한계).
- 제약/다음 판단: **이 PC엔 Node 없음 + 모바일 디바이스 에뮬 불가** → 실제 터치 검증은 **배포된 GitHub Pages 를 폰 브라우저로 직접** 테스트(merge→deploy→폰). CI 는 타입체크만. 데스크톱 회귀는 isTouchDevice() 가 false 라 터치 코드 경로가 전부 비활성(영향 0)이지만 dev 머신 `npm run verify` 권장. P4(반응형 HUD/슬롯≥48px/safe-area 정교화)·P5(우클릭 액션·인벤 탭선택)·P6(가로 안내·조준점·iOS/Android 점검) 후속.
- 관련 파일: `src/game/platform.ts`·`src/ui/touchControls.ts`(신규), `index.html`·`src/style.css`·`src/game/constants.ts`·`src/main.ts`·`scripts/check-main-size.mjs`. 설계 `docs/mobile-support-design.md`.

## 2026-06-19 — 전직 시스템 1·2·3차 구현 + 검증 환경 제약(Node 미설치)

- 시도: 전직 시스템 1·2·3차 전부 구현. 1차=직업별 새 3번째 스킬(F) 해금, 2·3차=신규 스킬 없이 스탯 누적 상승(+5/+10/+17레벨) + 모든 스킬 쿨다운 단축(×0.85/×0.8 누적). 레벨 게이트 30/50/70, 전직의 인장 1/2/3개 소비. 차수 누적 외형(buildTier1/2/3) + 차수별 전직 퀘스트 + jobTier 세이브(SAVE_VERSION 12). 설계 정본은 `docs/job-advancement-design.md`.
- 결과(구현): 로직은 전부 리프 모듈에 둠 — 신규 `game/jobAdvancement.ts`(차수 데이터·판정), `game/jobTierVisuals.ts`(직업별 외형 순수 팩토리), `game/classSkills.ts`(THIRD_SKILLS·useThirdClassSkill·unbreakable 버프). main.ts는 배선만(jobTier 필드·F입력·levelStatBonus 가산 1줄·useThirdSkill·thirdSkillContext·tryAdvanceJob·세이브/로드/스냅샷·아바타 인자).
- 결과(ratchet): 배선 순증으로 `MAX_MAIN_LINES 9489→9534`, `MAX_METHODS 460→462` 갱신(각 스크립트에 사유 주석). 늘린 만큼은 순수 입력/전이 배선이며 신규 로직은 main.ts에 넣지 않음. 후속 추출로 다시 조일 여지 있음.
- 이유/제약(중요): **이 개발 PC에 Node.js가 설치돼 있지 않아 `npm run verify`·typecheck·dev 서버·visual-check를 로컬에서 실행할 수 없음.** node_modules도 비어 있음(npm install 자체가 `command not found`). 따라서 코드는 기존 패턴을 정확히 따라 작성하고, 정적 점검만 로컬 수행함: 변경 파일 괄호/문자열 균형 OK, ratchet 실측, 타입 경유 지점(`PartialSavedGame`=`Partial<SavedGame["player"]>`, material 시그니처, `SecondSkillContext.fireSkillProjectile`에 "arrow" 추가) 수기 확인.
- 다음 판단: **머지 전 dev 머신에서 반드시 `npm run verify` (UI/외형 영향이 있으므로 `npm run verify:full` + `visual-check` 베이스라인 갱신) 실행.** master push는 CI가 즉시 GitHub Pages 배포로 이어지므로 검증 전 금지. 외형 추가로 `visual-check`/`perf-check` 픽셀·메시 베이스라인이 바뀔 수 있음(아바타는 1회 생성이라 핫패스 무관하나 메시 수는 증가).
- 관련 파일/검증: `src/game/jobAdvancement.ts`·`jobTierVisuals.ts`·`classSkills.ts`·`hotbarUse.ts`·`items.ts`·`itemInfo.ts`·`recipes.ts`·`types.ts`·`constants.ts`·`saveMigration.ts`·`saveManager.ts`, `src/objectives.ts`·`avatar.ts`·`ui/skillBar.ts`·`main.ts`, 테스트 `scripts/save-roundtrip-test.mjs`·`save-migration-test.mjs`·`gameplay-systems-test.mjs`, ratchet `scripts/check-main-size.mjs`·`check-method-count.mjs`.

## 2026-06-06 — 스프린트 중 shadowMap 토글 제거 시도는 보류

- 시도: Shift 달리기 중 첫 프레임 히치를 줄이기 위해 `setSprintRenderOptimizations()` 의 그림자 맵 on/off 토글을 제거하는 방안을 테스트했다.
- 결과: 필드 평균 프레임타임이 오히려 나빠져 되돌렸다.
- 이유: 이 게임의 병목은 JS 로직보다 렌더 draw call/가시 메시 수에 있었다. 스프린트 중 그림자를 계속 켜 두면 첫 토글 비용은 줄 수 있어도, 이동 중 렌더 부하가 더 커진다.
- 다음 판단: 스프린트 렉은 그림자 토글 제거보다 draw call 감소, 인스턴싱, 아웃라인/그림자 범위 제어로 접근한다. 그림자 토글을 제거하려면 반드시 `perf-check` 전후 비교가 먼저 필요하다.
- 관련 파일/검증: `src/main.ts`, `src/game/biomeDecor.ts`, `npm.cmd run perf-check`

## 2026-06-06 — 샌드박스 초기화 오류는 코드 문제가 아니라 실행 환경 문제

- 시도: 일반 샌드박스 권한으로 `git status`, `git diff`, 문서 읽기 등 기본 PowerShell 명령을 실행했다.
- 결과: `windows sandbox: setup refresh failed with status exit code: 1` 오류가 반복되어 명령이 실행되지 않았다.
- 이유: 저장소 코드나 명령 자체의 실패가 아니라 Codex Desktop의 Windows 샌드박스 초기화 단계에서 발생하는 환경 문제다.
- 다음 판단: 중요한 확인/커밋/검증 명령이 이 오류로 실패하면 같은 명령을 `require_escalated` 로 재시도한다. 우회용 파일 쓰기, 임시 스크립트, 파이프 조합으로 문제를 숨기지 않는다.
- 관련 파일/검증: 작업 환경, `git status --short --branch`, `git diff --stat`

## 2026-06-06 — 상호작용 가능한 나무는 인스턴싱 대상에서 제외

- 시도: 반복되는 월드 장식을 `InstancedMesh` 로 줄이는 성능 개선을 진행하면서 나무까지 인스턴싱할 수 있는지 검토했다.
- 결과: 채집 가능한 작은/큰 나무는 인스턴싱하지 않고, 비상호작용 바이옴 장식만 인스턴싱했다.
- 이유: 나무는 충돌, 채집 횟수, 저장/복원, raycast, 아이템 드랍 상태를 가진 게임플레이 오브젝트다. 인스턴싱하면 개별 상태 제거와 충돌 처리가 복잡해져 회귀 위험이 크다.
- 다음 판단: 상호작용 없는 원거리/배경 장식부터 인스턴싱한다. 상호작용 오브젝트 인스턴싱은 별도 설계와 테스트가 있을 때만 진행한다.
- 관련 파일/검증: `src/game/biomeDecor.ts`, `scripts/performance-smoke.mjs`, 커밋 `eae98fb`

## 2026-06-06 — 평타 ÷10이 고방어 보스를 무적으로 만든 함정

- 시도: 모든 직업 평타 데미지를 약 1/10로 낮췄다(옵션 B: 보스는 스킬/고렙으로 잡는 설계).
- 결과: 데미지 공식 `gap = 공격 − 방어; gap ≤ −20 → 0` 에 걸려, 불멸의 존재(방어 145)가 어떤 무기·스킬로도 0 데미지인 무적 상태가 됐다. 신규 `test:balance` 가 자동 포착했다.
- 이유: 무기 수치만 낮추고 보스 방어력을 그대로 둬서, 낼 수 있는 최대 공격(강탄 100)이 방어 컷(125)을 못 넘었다.
- 다음 판단: 데미지/방어/레시피 등 수치 변경 시 반드시 `npm run test:balance` 를 돌린다. 보스 방어력은 도달가능 한도(최대공격 − 20) 안에 둔다. 무기/방어를 동시 비례 조정하거나 스킬 방어관통을 고려한다.
- 관련 파일/검증: `scripts/balance-test.mjs`, `src/game/monsters.ts`, `src/game/items.ts`, `npm run test:balance`

## 2026-06-06 — Codex 활성 중 main.ts 동시편집은 전부 실패

- 시도: Codex가 main.ts 를 리팩터링하는 동안, 거너 직업 배선 9곳을 Claude Code 로 편집·커밋하려 했다("Codex 작업 완료" 안내를 받은 뒤).
- 결과: main.ts 가 실시간으로 계속 바뀌어 Edit 가 매번 "file modified since read" 로 2라운드 전부 실패했다. 거너 리프 데이터(types/classes/items/recipes)만 격리 선커밋하고 main.ts 배선은 보류했다.
- 이유: 두 에이전트가 같은 파일을 동시에 쓰면 read→edit 사이에 파일이 바뀌어 편집이 무효화된다. "완료" 안내가 실제 정지를 보장하지 않았다.
- 다음 판단: 다른 에이전트가 쥔 파일(main.ts 등)은 `git status` 가 정적임을 확인한 뒤에만 편집한다. 리프 모듈(game/·ui/)부터 충돌 없이 진행하고, 공유 파일은 상대 작업이 커밋·정지된 뒤 한 번에 배선한다.
- 관련 파일/검증: `src/main.ts`, 커밋 `367e081`(리프 선커밋) → `438c50e`(배선), `git status --short`

## 2026-06-06 — 프리뷰 MCP 서버가 이 PC에서 dev 서버를 못 띄움

- 시도: 1인칭 손 색/권총 모델 변경을 브라우저로 시각 검증하려고 preview_start(`.claude/launch.json`, `npm run dev`)를 실행했다(`npm`, `npm.cmd` 전체경로 둘 다).
- 결과: `Failed to start preview server: Python` 오류로 두 번 실패. 서버가 안 떠 스크린샷 검증을 못 했다.
- 이유: launch.json 내용 문제가 아니라, 이 PC의 dev 명령 해석이 Windows python Store stub / PowerShell 차단 환경에 걸리는 실행 환경 문제다.
- 다음 판단: 이 PC에선 preview MCP로 시각 검증을 시도하지 않는다. `typecheck`/`verify` + 기존 자체 playwright(`visual-check`/`perf-check`, dev 서버 선기동 필요) 또는 사용자 플레이테스트로 검증한다.
- 관련 파일/검증: preview_start, `npm run verify`

## 2026-06-06 — village-sprint 렌더 히치는 별도 추적 필요

- 시도: fog 밖 대형 비주얼 컬링, 반복 오브젝트 아웃라인 제외, 산/쌓기블록 그림자 투사 축소 후 `npm.cmd run perf-check` 로 스프린트 성능을 확인했다.
- 결과: 한 번은 `village-sprint` 첫 샘플만 `renderer.render max 617.2ms` 로 튀고 repeat는 깨끗했지만, 다음 실행에서는 repeat도 `max 500.4ms` 로 한 번 튀었다. 평균 프레임과 visible mesh 예산은 통과했다.
- 이유: JS update 병목이 아니라 renderer/render thread 쪽 stall이다. 다만 런 간 변동이 커서 이번 draw-call 패치와 직접 인과로 묶기 어렵다.
- 다음 판단: 스프린트 히치를 다룰 때는 `renderer.shadowMap.enabled` 토글, shadow map update, postprocessing 전환, 브라우저/드라이버 stall을 분리 측정한다. 이전에 shadowMap 토글 제거는 평균 프레임을 악화시켰으므로 같은 시도를 그대로 반복하지 않는다.
- 관련 파일/검증: `src/game/renderPerformance.ts`, `src/main.ts`, `npm.cmd run perf-check`

## 2026-06-06 — sprint visibility 숨김 제거는 성능 예산을 깨뜨림

- 시도: Shift 입력 순간 렉을 줄이기 위해 `sprintHiddenVisuals` 순회와 outline/contact shadow 숨김을 제거하고, 후처리 제거만으로 스프린트 성능을 버티는지 테스트했다.
- 결과: `npm.cmd run perf-check` 에서 field visible mesh가 `6807`까지 증가하고, field 평균 프레임타임도 긴 렌더 stall 때문에 예산을 초과했다.
- 이유: 후처리 제거만으로는 high 모드의 outline/contact shadow draw call 증가를 상쇄하지 못했다. 스프린트 중 outline/contact shadow 숨김은 여전히 필요한 최적화다.
- 다음 판단: Shift 렉 개선은 postprocessing 전환 제거, 사전 워밍업, 렌더 상태 전환 측정으로 접근한다. `sprintHiddenVisuals` 숨김 자체를 통째로 제거하지 않는다.
- 관련 파일/검증: `src/main.ts`, `src/game/renderPerformance.ts`, 실패한 `npm.cmd run perf-check`

## 2026-06-06 ?? ?? ? ??? ?? ? ?? ??

- ??: `main.ts`? ???? ???/HUD ????? ??? ??? ? ??? ???? `apply_patch`? ?? ???? ??.
- ??: ?? ??? ?? mojibake? ?? ?? ???? ?? `apply_patch`? ?? ?? ???? ???. ??? `node -e` ??? ??? ????? PowerShell? ??? ????? ??? ??? `Unterminated regexp literal` ??? ??. `node_repl`? Windows sandbox ??? ??? ????.
- ??: ? ??? UTF-8 ?? ???? ??, ?? ??? ??? CP949 ?? mojibake? ???. PowerShell ? ? ????? JS ??? ???? ??? ?? ????? ??? ???.
- ?? ??: ??/??? ??? ?? ??? ? ?? ??? ?? ????. ????? ?? ??? ???? `@' ... @' | node -` here-string? ??, prefix_rule ?? ?? ???? ????. ?? ?? `npm.cmd run typecheck`? ?? ???? ???.
- ?? ??/??: `src/main.ts`, `src/game/tanker.ts`, `npm.cmd run verify`

## 2026-06-06 Shift+W ? ?? ?? ?? ?? ??? ??

- ??: `renderer.shadowMap.enabled` ??? ??? ????. ???? ??? ? ?? ??? ??? ??? ?? ??? ???.
- ??: `village-sprint` ? ??? ?? ??? ??? ????? ???. baseline? `renderer.render max 783.9ms`, 1? ?? ??? `900.7ms`? ???.
- ?? ??: ?? ? outline/contact shadow ?? `visible` ??? ????. ??? ?? ???? `450ms` ??? ???. ?? ? shadow refresh? ??? `633ms` ??? 1?? render stall? ???.
- ?? ??: Shift ? ??? ??? `Shift+W`? ???? ? ?? ??? ?, ?? ?? ??? ? ?? ?? ??? GPU ??? ???? ? render ???? ???. `village-shift-only`? `max 16.9ms / hitches 0`??, `village-sprint`? ???.
- ??: `precompileSceneShaders()`? ???/frustum ? ???? ??? visible + frustumCulled=false? ?? ? `renderer.compile()`? 1x1 ????? `renderer.render()`? ????? ????. GPU ??? ??? ??? ? ? ?? ???? ??? ??/?? ?? ??? ???.
- ??: ?? `npm.cmd run perf-check`?? `village-sprint max 16.9ms / hitches 0`, `village-shift-only max 16.9ms / hitches 0`, `village-sprint-repeat max 16.9ms / hitches 0`.
- ?? ??: ???? `renderer.shadowMap.enabled/type`? ?? ?? ??. ?? ? ?? visible ??? ???. ? ??/?? ? ???? ????? warm render? ????.
- ?? ??/??: `src/main.ts`, `src/game/renderPerformance.ts`, `scripts/performance-smoke.mjs`, `AGENTS.md`, `npm.cmd run perf-check`


## 2026-06-06 Shift sprint render hitch fixed

- Attempt: Fix frequent hitch and color-tone change when pressing/releasing Shift sprint.
- Result: Removed runtime shadow-map program-key changes and sprint-time visual toggles. `npm.cmd run perf-check` now passes with `village-shift-only`, `village-sprint`, and `village-sprint-repeat` all reporting 0 hitches in the final sample.
- Reason: Runtime `renderer.shadowMap.enabled` changes can invalidate shader programs and cause render-thread stalls. Sprint also should not mass-toggle outline/contact-shadow visibility because that creates avoidable render-state churn. Global shadow maps are now disabled for this stylized build, keeping the calmer sprint color tone consistently on/off Shift while relying on contact shadows/outlines for depth.
- Next guard: Do not toggle `renderer.shadowMap.enabled` or `renderer.shadowMap.type` at runtime. Performance changes affecting sprint must pass `npm.cmd run perf-check`, especially the shift-only and sprint-repeat hitch budgets.
- Files/checks: `src/main.ts`, `src/game/renderPerformance.ts`, `scripts/performance-smoke.mjs`, `AGENTS.md`, `npm.cmd run perf-check`

## 2026-06-09 — PowerShell 파이프 한글 리터럴 비교 실패

- 시도: 인벤토리 제작 검색의 `만들기` 버튼 텍스트를 Playwright 인라인 스크립트에서 직접 비교했다.
- 결과: 기능은 정상인데, `@'...'@ | node --input-type=module -` 경로에서 한글 리터럴이 `???`로 전달되어 텍스트 assertion만 실패했다.
- 이유: PowerShell 파이프/콘솔 인코딩이 UTF-8 한글 리터럴을 안정적으로 보존하지 못했다. 브라우저 DOM 문제나 게임 코드 문제는 아니었다.
- 다음 판단: 인라인 Node/Playwright 검증에서는 한글 텍스트 자체보다 `data-*` 속성, disabled 상태, 아이템 수 변화 같은 ASCII/동작 기준을 우선 검증한다. 한글 UI 문구 검증이 필요하면 파일 기반 테스트나 UTF-8 입력 경로를 사용한다.
- 관련 파일/검증: `src/ui/inventoryPanel.ts`, `src/main.ts`, Playwright inline DOM check

## 2026-06-10 — HUD 문구를 바꾸면 visual-check assertion 도 같이 갱신해야 한다

- 시도: visual-check 를 신규 시스템(거너/탱커/맵/보스 게이팅/시간대)으로 확장하면서 기존 검사를 함께 실행했다.
- 결과: 기존 침대 검사가 실패하고 있었다 — 침대 기능은 정상인데, HUD 개편(스탯 바)으로 표시 문구가 "체력 10/10" → "HP 10 / 10" 으로 바뀌어 assertion 만 낡아 있었다. 탱커 방패도 "장착 시 방어 상승" 검사가 불가능했는데, 탱커는 새 게임 시작 시 방패가 자동 장착되기 때문이다 (`main.ts` 새 게임 초기화).
- 다음 판단: HUD 텍스트/마크업을 바꾸는 커밋은 `visual-check` 를 같이 돌려 assertion 을 동기화한다. 시작 직후 상태를 검사할 때는 "자동 장착/자동 부여" 초기화 로직을 먼저 확인한다.
- 미커버로 남긴 것: 독수리 빙의 스킬(서모너+독수리 셋업 필요), 거너 실발사(포인터락 의존), 포식자 스폰(확률 의존). 추가 시 결정적 셋업을 먼저 설계할 것.
- 관련 파일/검증: `scripts/visual-check.mjs`, `scripts/weapon-visual-preview.mjs`, `npm run visual-check`, `npm run visual:weapons`

## 2026-06-10 — 무기/장비 비주얼 QA 는 weapon-preview 스크린샷 하네스로

- 시도: 거너 권총·탱커 방패 리디자인을 시각 검증해야 했으나 이 PC 는 preview MCP 로 dev 서버를 못 띄운다 (아래 기존 기록 참조).
- 결과: `npm run visual:weapons` (`scripts/weapon-visual-preview.mjs`) 를 추가 — 자체 vite 서버 + 로컬 Chrome 으로 1인칭 변환 체인(heldItemGroup 회전 포함)을 재현한 4분할 스크린샷을 `artifacts/weapon-preview.png` 로 저장해 직접 확인했다.
- 판단: 1인칭 held 모델은 모델 +Y 가 카메라 공간에서 거의 수직 위를 향한다 (계산: +Y → (0.26, 0.96, -0.04)). 총처럼 "전방을 향해야 하는" 아이템은 -Z 축으로 만들고 보정 회전 `(-0.05, 0.7, 0)` 을 더해야 한다. 수직(+Y) 빌드 패턴을 총기에 쓰면 "세워진 블록(탄창)"처럼 보인다.
- 다음 작업자: held 아이템 비주얼을 바꾸면 `npm run visual:weapons` 로 스크린샷을 찍어 확인하라. 1인칭 뷰에서 총신이 화면 중앙(소실점) 쪽으로 후퇴해 보이는 것은 정상 원근이다.
- 관련 파일/검증: `src/game/weaponVisuals.ts`, `src/game/heldItemVisuals.ts`, `scripts/weapon-visual-preview.mjs`, `npm run visual:weapons`

## 2026-06-10 in-app Browser verification blocked by sandbox refresh

- Attempt: Open the local Vite app in the in-app Browser after predator/pet/HUD changes to visually verify the bottom-left HUD.
- Result: The Vite dev server started, but Browser setup through the Node-backed runtime failed twice with `windows sandbox failed: spawn setup refresh`.
- Reason: This is an environment sandbox initialization failure, not an application build/runtime failure. The same sandbox refresh failure also affected ordinary shell reads earlier in the turn.
- Next guard: Do not keep retrying browser setup in a loop when this exact error appears. Use `npm.cmd run verify`, `npm.cmd run build`, and focused code inspection for this session; retry Browser only in a fresh session or after the sandbox state changes.
- Files/checks: `src/style.css`, `src/game/predatorAi.ts`, `src/game/summonerPet.ts`, `npm.cmd run verify`, `npm.cmd run build`

## 2026-06-18 — 몬스터 요새 동굴: 보류한 "세이브 영속화"

- 시도: 동굴 입장 시 15% 확률로 "몬스터 요새"(맵 레벨대 몬스터 다수 + 끝 보스 → 흑요석·전직의서 확정 드랍)를 생성. 보스/몬스터는 `wildPredator` 로 스폰하고 동굴 전용 AI(`game/caveMonsters.ts`)로 추격. 셸은 기존 동굴 셸 재사용 + 요새 장식 오버레이(`game/interiors.ts buildFortressDecor`).
- 결과: 정상 동작. 단, **세이브-중간-리로드 시 요새는 일반 동굴로 되돌아간다**(요새 종류·몬스터·보스는 세이브에 영속화하지 않음).
- 보류 이유: 동굴 종류를 세이브에 넣으면 `SAVE_VERSION` 증가 + 마이그레이션 + roundtrip 테스트가 필요한데, 이 원격 환경은 브라우저(Chrome)가 없어 `test:save-roundtrip`/`visual-check`/`perf-check` 를 돌릴 수 없다. 기존 패턴(동굴은 재생성, 광산 종류도 입장 시 재롤, 동굴 내 몬스터는 세이브 제외 = `excludedObjectIds`)과 일관되게 "입장 시 결정 + 비영속"으로 맞췄다.
- 다음 작업자: 요새를 세이브 간 유지하려면 cave 오브젝트에 `caveKind` 필드를 추가하고 saveManager/saveMigration + SAVE_VERSION 업 + roundtrip 테스트를 브라우저 가능한 환경에서 함께 진행할 것. 그 전엔 farm 가능성(재입장 시 새 보스)도 의도된 동작으로 본다.
- 관련 파일: `src/game/caveMonsters.ts`, `src/game/interiors.ts`, `src/game/items.ts`(전직의서), `src/main.ts`(enterCave 분기·grantExperienceForTarget 드랍·clearCaveObjects suppressRespawn)

## 2026-06-18 — 몬스터 요새 버그 수정 (보이지 않는 몹·입구 몰림)

- 증상: 요새 입장 시 몬스터가 입구에만 몰려 즉사 위기, 중반부터 몬스터 없음, 보스 못 봄, 중반에서 "보이지 않는 몹"에게 맞고 허공을 치면 처치됨.
- 원인: `updateCaveMonsters` 가 `objectsOfType("wildPredator")` 전체(= 오버월드 포식자 포함)를 대상으로 삼았다. 오버월드 포식자는 동굴 진입 직전 가시성 컬링으로 `.visible=false` 가 된 채 남아 있었고(컬링은 동굴에서 미실행=해제 안 됨), 동굴 AI 가 이들을 동굴 경계로 끌어들여 "보이지 않는데 공격하는 몹"이 되었다. 또 분포가 randomCavePoint(균등이지만 끌려온 몹이 섞여) 입구 몰림처럼 느껴졌다.
- 수정: `WorldObject.fortressMonster` 태그 추가 → 스폰 시 표시, `updateCaveMonsters` 가 태그 없는 포식자는 skip. 스폰 시 `.visible=true` 강제. 요새 몬스터는 입구 30칸 뒤부터 제단 직전까지 z 균등 배치. 요새 셸은 푸른 크리스탈 제거 + 붉은 조명으로 일반 동굴과 시각 구분.
- 다음 작업자: 동굴 내 신규 엔티티 AI 는 반드시 "그 동굴 소속" 태그로 필터링할 것. 오버월드 엔티티가 `this.objects` 에 그대로 남아 있음을 항상 전제하라(진입 시 제거되지 않음).
- 관련 파일: `src/game/caveMonsters.ts`, `src/game/interiors.ts`, `src/game/types.ts`

## 2026-06-19 — 모바일 터치 지원 적대적 점검 (확정 버그 4건 + 게이트 위반 1건)

다른 PC 에서 들어온 모바일 터치 지원(76594d9·9c98861)을 적대적으로 검증. 코어 플레이 루프를 막는 도달성(reachability) 버그 다수 발견 — 데스크톱은 좌클릭/우클릭/숫자키로 하던 동작이 터치엔 경로가 없었다.

- **B1 (퍼포먼스 회귀)**: 새 게임 리셋이 `qualityMode="high"` 로 고정 → 모바일이 시작 시 정한 `performance` 프리셋을 새 게임마다 잃음. 수정: `isTouchDevice() ? "performance" : "high"`.
- **B2 (먹기·회복·소비 불가)**: 핫바 탭은 *선택*만 하고 *사용*은 데스크톱 숫자키에만 있었음 → 모바일은 고기 먹기·구급상자·경험치병·전직 인장 사용 불가(굶어 죽음). 수정: 터치 컨트롤에 "사용" 버튼 추가 → `useSelectedHotbarItem`.
- **B3 (설치 불가 — 튜토리얼 하드블록)**: 설치물(제작대·침대 등) 설치는 우클릭(contextmenu)·HTML5 드래그뿐 → 터치 불가. "제작대 설치" 튜토리얼에서 진행 불가. 수정: `hotbarUse.placeSelected()` 훅 추가, 터치면 정면 설치.
- **B4 (제작대/제련대/분쇄기 열기 불가)**: 스테이션 *열기*는 우클릭 전용, `interact()`(좌클릭=탭)은 *회수*만 함 → 모바일은 3x3 제작·제련·분쇄 불가. 수정: 터치면 `interact()` 가 스테이션을 *열도록*(회수는 데스크톱 전용).
- **게이트 위반**: master(c590227)의 `src/main.ts` 가 이미 `check:size` +1 초과(9669/9668) 상태로 푸시돼 있었음(커밋 전 verify 미실행 추정). 새 게임 리셋 블록의 중복 performance 리셋 5줄을 제거해 9664 로 내리고 예산도 9664 로 조임.
- **회귀 가드 추가**: `scripts/mobile-test.mjs`(`test:mobile`, verify 포함) — `isTouchDevice()` SSR 안전성 + 조이스틱→키 매핑(데드존·4방향·전후 상호배타·대각선·달리기 임계·NaN 안전정지·경계 strict). 이를 위해 `joystickKeyState` 순수 함수로 추출.
- 남은 가벼운 갭(미수정, 보고): 캐릭터창(K) 터치 진입 없음 → 목걸이 착용(엔드게임 퀘) 불가 / 아이템 버리기(우클릭) 터치 경로 없음 / 쌓기블록 설치(우클릭) 터치 경로 없음. 모두 비핵심·후반 요소라 별도 결정 필요.
- 모든 수정은 `isTouchDevice()` 게이트라 **데스크톱 동작 불변**. 관련: `src/ui/touchControls.ts`, `src/game/hotbarUse.ts`, `src/main.ts`, `src/style.css`.

## 2026-06-20 — 야생 몬스터 균등 분포 + 밀도 상향 (perf-check 미실행 주의)

- 증상: 맵에 몬스터가 리전(원형 구역) 안에만 몰리고, 리전 밖 평원은 한참 뛰어도 거의 없음.
- 원인: 초기 스폰 루프가 "랜덤 리전 선택 → 그 리전 원 안에 점 생성"이라 리전 사이 평원엔 0마리.
- 수정: 초기 스폰을 "맵 전체 랜덤 좌표 → 그 위치의 리전(없으면 nearestRegion)으로 종/레벨 결정"으로 변경 → 평원 포함 균등 분포. 마릿수도 상향(기본맵 36→60, 그 외 48→78). regions.ts 에 nearestRegion 추가(leaf).
- ⚠ 보류/주의: 엔티티 수 증가는 AGENTS §10 상 perf-check 비교가 필요한데, 이 원격 환경은 브라우저(Chrome)가 없어 perf-check/verify:full 을 못 돌린다. 가시성 컬링(updateVisibilityCulling)이 먼 몬스터를 숨겨 draw call 증가는 제한적이라 판단하고 진행. 사용자 기기에서 FPS 체감 확인 권장. 렉 시 predatorCount(60/78) 를 낮추면 됨.
- 관련 파일: src/main.ts(초기 스폰 루프), src/game/regions.ts(nearestRegion).

## 🔴 미해결 TODO — 속도(성능) 검증 필요: 몬스터 밀도 상향분

- **무엇**: 2026-06-20 야생 몬스터 마릿수 상향(기본맵 36→60, 그 외 48→78) + 전맵 균등 분포(commit 3dbf4f7).
- **왜 미검증**: 이 원격 환경엔 브라우저(Chrome)가 없어 `npm run perf-check` / `verify:full` 을 돌릴 수 없음. typecheck·단위테스트·build 만 통과.
- **해야 할 일** (브라우저 있는 PC 에서):
  1. `npm run perf-check` 실행 → `PERF_BUDGET`(scripts/performance-smoke.mjs) 초과 여부 확인.
  2. 실기기, 특히 **모바일 가로모드**에서 FPS 체감(개방 필드 ~30fps 기준 유지되는지).
  3. 렉 발생 시 `src/main.ts` 의 `predatorCount`(60/78) 를 낮춰 재조정. 컬링은 이미 적용됨.
- **상태**: 기능은 마스터 배포 완료, 성능만 미검증.
