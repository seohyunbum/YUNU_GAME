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

## 2026-06-27 — 저사양 보스전 렉 2탄: draw call 급감(렌더거리·밀도)

- 측정(E2E renderer.info, 보스 옆): **draw call 6,801 / 삼각형 549k / 씬자식 1,673 / 포식자 145마리**. 결정타 = 포식자 1마리당 **23~33 메시(=draw call)**, 보스 1마리 **75 메시**, 게다가 포식자 렌더거리 **175** 라 멀리 점 크기인 개체도 다 그림.
- 수정(둘 다 저위험·게임플레이 중립):
  1) **크리처 렌더거리 품질별 분기**(visibilityDistanceForType): animal/wildPredator/jammini = 저사양 100·그외 150(종전 175). 멀리선 점이라 가까이서만 그려 draw call 급감. droppedItem/ore/chest 등 가벼운 건 175 유지.
  2) **필드보스 컬링 면제**: fieldBossId 는 거리 240 — 랜드마크/타깃이라 멀리서도 보이게(크리처 거리 단축의 예외).
  3) **저사양 밀도 하향**: WILDLIFE_DENSITY_MUL_PERF 1.5→0.85(시작맵 90→≈51마리). 고품질(2.4)은 유지.
- 결과(E2E, performance 세션 신규): draw call **1,973**(약 71%↓)·삼각형 204k·포식자 52. verify 그린. ratchet 10180.
- 남은 더 큰 레버(차기): 포식자/보스 모델 메시 병합(27→3) 또는 인스턴싱 = draw call 추가 급감 가능하나 워크사이클 애니메이션 때문에 위험 → 별도 검토.

## 2026-06-27 — 훈련장 방어(방패막기)·명상(명상호흡) 훈련도 스페이스바 지원

- 요청: 훈련장의 방어 훈련·명상 훈련도 스페이스로 가능하게(과녁=attack 은 이미 지원).
- 구현(trainingPanel.ts): runBlock 의 인라인 mousedown 핸들러를 `block()` 함수로, runMeditation 의 것을 `gather()` 로 추출. 각각 attack(runTarget)과 동일하게 window keydown(code==="Space") 핸들러 추가(클릭과 동일 동작, preventDefault) + tick 의 root.isConnected 해제 분기에서 removeEventListener 정리. howTo 문구에 "(또는 스페이스)" 추가(training.ts).
- 검증: typecheck·build·verify 그린. E2E(레벨15, 패널 직접 오픈 후 Space 디스패치): armor→피드백 변화·mana→피드백 변화·attack(대조)도 변화·pageerror 0. main 무변경(리프).

## 2026-06-27 — 저사양 보스전 렉 완화(충격파 파티클 감량·슬램전용·지오 풀링)

- 배경: 하드+저화질 저사양에서 멧돼지 대왕 파티전 큰 렉. 진단 결과 우리 최근 작업(도약/floor 클램프)은 가벼운 스칼라라 원인 아님(오히려 floor 가 보스의 카메라 관통 필레이트 폭발을 줄임). 진짜 비용은 기존 spawnGroundShockwave(호출마다 메시·지오·머티 30개 신규)가 ①저화질 무시 ②필드보스 일반 공격마다 발생.
- 수정(3종):
  1) **저사양 감량**: CombatEffectContext.lowFx 신호(main: qualityMode==="performance") → 충격파 링 2→1·흙먼지 28→6(총 30→7). lowFx 옵셔널이라 하위호환.
  2) **슬램 전용**: 필드보스 일반 공격마다 터지던 충격파(predatorAi:257) 제거 → 슬램(resolveBossSlam)에서만. 동굴 요새보스(슬램 없음)는 per-attack 유지하되 lowFx 감량.
  3) **지오메트리 풀링**: 충격파 링·구체 지오를 모듈 공유(SHOCK_RING_GEO·SHOCK_SPHERE_GEO, 구체는 scale 로 크기변화). 입자에 pooled 플래그 → updateDamageParticles·clearDamageParticles 가 공유 지오 dispose 스킵(다음 호출 재사용). 매번 new 제거로 GPU 업로드·GC 부담↓.
- 검증: typecheck+build, verify 전부 그린. 모듈 시뮬(고품질 30·저사양 7·전입자 pooled·지오 호출간 공유 동일객체·lowFx 미설정 하위호환 30). E2E(performance, 슬램 3회 강제): pageerror 0(풀 지오 dispose/재사용 사이클 안전)·게임 정상·저화질 충격파 7개 확인. ratchet 10179.

## 2026-06-27 — 적대적 리뷰 후속: 정령 소환권 막타자 귀속 + 흑요석 상자 dragon_scale cap 예외

직전 검수 3건(①파티 게스트 보스 막타 토큰이 호스트로 ②펫 보스 막타 토큰 미드랍 ③흑요석 상자 dragon_scale 밀림) 반영.

- ①②(막타자 귀속): 토큰 롤을 main.dropKillSpiritToken(wild, boss) 1개로 중앙화. grantExperienceForTarget 의 토큰 롤을 creditQuest 게이트(호스트가 게스트 막타 크레딧 시 creditQuest=false → 스킵, 호스트 오귀속 차단). 막타자 귀속 경로 보강: 파티는 onPartyKill 의 isKiller 분기에서 world.dropKillSpiritToken(true, !!fieldBossId) 호출(필드보스 메시지는 kind+fieldBossId 둘 다 세팅 확인), 펫은 grantSummonerPetKill 의 wildPredator 분기에서 context.dropKillSpiritToken(true, !!fieldBossId) 호출(주인=로컬 귀속). 이중지급 없음(호스트는 자기 브로드캐스트 미수신).
- ③(dragon_scale 보호): capLootByGrade 에 protect 셋 인자 추가(보호분 먼저 확보 후 등급순). rollChestLoot tier≥3 은 OBSIDIAN_CHEST_PROTECT={dragon_scale} 전달 → 잭팟 풀 롤이어도 dragon_scale 1종 항상 보존(총 ≤6 유지).
- 검증: npm run verify 전부 그린. 모듈 시뮬(흑요석 풀 롤 dragon_scale 항상 보존·protect 없으면 밀림 대조). 시스템테스트 신규 단언(killer guest spiritRoll·dragon_scale 보호) + mock world 3곳 dropKillSpiritToken 배선. ratchet 10171→10178·메서드 494→495(중앙화 1개).

## 2026-06-27 — 근접 보스 도약공격 겹침/시야이탈/순간이동 회귀 정타 수정

- 증상: 멧돼지 대왕 등 큰 보스가 도약공격 시 거의 겹쳐져 2초간 시야에서 사라졌다가 멀리서 다시 나타나기를 반복(직전 lunge 델타/원복 패치 회귀로 사용자 지목).
- 진단(E2E 실측): 보스 collisionRadius 2.09(scale 2.2)인데 reach=strikeRange+2.5+collisionRadius×0.5 가 몸집의 *절반*만 반영 → 정지거리 5.5, 도약이 중심거리 2.9까지 파고들어 표면이 플레이어로부터 0.8칸 = 거대 모델이 카메라를 관통("사라짐") 후 후퇴("순간이동"처럼 보임). 도약/원복 자체는 ≤2칸으로 정상이었고, 진짜 원인은 몸집 미반영 사거리.
- 수정(predatorAi·caveMonsters 공통):
  - reach = strikeRange + 3.2 + collisionRadius(전부 반영). 큰 보스일수록 더 멀리 멈춤.
  - 도약 직후 **최소거리 하드클램프**: 중심거리 < strikeRange+1.7+collisionRadius 면 타깃 반대방향으로 floor 까지 밀어냄. 아무리 공격중이라도 표면이 ~3~4칸 안으로 못 들어옴. 겹쳐 방향 모호하면 추격 반대로. 파티 원격 타깃도 동일(targetX/Z 캡처).
- 검증(E2E 실측): 고정 플레이어 — 보스 MIN 중심거리 5.74(표면 3.65칸)·rest 7.0·maxFrameJump 1.94(순간이동 아님). 회피 이동 플레이어 — minSurface 양수(관통 없음)·maxWorldJump 2.53/폴(부드러움). typecheck·build·test:combat/systems/mobile 그린. main 무변경(리프).

## 2026-06-27 — 정령 소환 사운드(CC0)·그래픽(호루스의 눈)·캐릭터창 정령 UI(팝업내 팝업)

3건 일괄. 사용자 요청: ①소환 사운드를 CC0(뽑기 긴장감)로 교체 ②소환 그래픽을 이집트 호루스의 눈 풍으로 멋지게 ③캐릭터창 정령 목록이 100마리면 끝없이 나열 → 팝업내 팝업으로 정리.

- ①사운드: OpenGameArt(BGM 작업 시 쓰던 CC0 소스)에서 Spring Spring "Power-Up Sound v3"(기존 heal_cast/buff_cast 동일 작가) 받아 `public/sfx/spirit_summon.ogg`. gachaScreen 공개 순간 `playSample("spirit_summon")` 재생(미로드 폴백). 빌드업은 절차 톤을 더 낮고 빠른 심장박동으로 강화(뽑기 조마조마함). main: preload 등록 + deps.playSample 주입. CREDITS 갱신.
- ②그래픽: gachaScreen 의 단순 CSS 눈 → SVG 호루스의 눈(피라미드 프레임 + 눈썹·아몬드·홍채·눈물줄기·나선 컬) + 회전 황금 sunburst 광선 + 공개 시 홍채가 등급 색으로 부풀고 등급색 반짝임 입자 버스트. style.css 가챠 블록 교체. E2E 스샷으로 전설(황금) 공개 확인 — 첨부 레퍼런스(이집트의 눈)와 합치.
- ③UI: characterPanel 인라인 정령 나열 제거 → "정령 보관함 열기·N마리" 버튼 → 팝업내 팝업(renderSpiritModal, 리프). 등급 높은 순 정렬 카드 그리드(스크롤), 장착/먹이기, 장착 해제, "낮은 등급 일괄 먹이기"(100마리 노가다 해소). 모달 열림상태=main.spiritManagerOpen 필드(재렌더에도 유지). main +6 → ratchet 10171.
- 검증: npm run verify 전부 그린(typecheck·build·check:size/methods·전 테스트). E2E(Edge 헤드리스): gameStarted·gachaOpen·modalOpen·cards=14·bulkBtn 확인 + 스샷 2종 육안 확인.

## 2026-06-23 — 정령 소환권 획득처 확대(집 보급상자 + 보스/용/요새보스)

- 요청: 지은 집 보급상자에서도 낮은 확률로, 보스몬스터/드래곤도 아주 낮은 확률로 정령 소환권(spirit_gacha_token) 드랍.
- 발견: main.ts:4920 `grantExperienceForTarget`(모든 처치 경로의 중앙 훅 — 솔로·호스트·파티 creditHostKill 공통)에 이미 일반 사냥 1.2% 드랍 존재.
- 구현:
  - 보스: 그 1줄을 머지해 `sc = (wildPredator/dragon ? 1.2% : 0) + (fieldBossId || dragon || fortressBoss ? +3% : 0)` 단일 롤로. 보스/용/요새보스=4.2%, 일반몹=1.2% 유지, 비몬스터=0. main 라인 net 0(머지).
  - 집 보급: homeBase.rollHomeSupply tier≥2 에서 6% 추가(전설이라 6종 cap 상위로 거의 항상 보존).
- 회귀 발견·수정: 직전 turn 의 6종 cap 이 gameplay-systems-test 2건을 깨뜨림(테스트가 pre-cap 계약 인코딩) — ①집보급 "정확히 2확률라인" → cap+정령으로 무효 ②흑요석 상자 dragon_scale 보장 → 풀 롤 시 rare 라 cap 에 밀림(의도된 등급순). 두 단언을 새 cap 계약으로 갱신(cap≤6·전설 보존 검증).
- 검증: typecheck+build, check:size(10165=예산), 모듈 시뮬(집보급 6%·tier<2 0%·cap생존, 보스 4.2%/일반 1.2%/비몹 0%), test:systems·test:content 그린.
- ⚠️ 부작용 고지: 6종 cap 은 등급순이라 흑요석 상자가 잭팟(에픽/전설 다수)일 때 dragon_scale 같은 rare 가 밀릴 수 있음. 기본 롤(확률템 미적중)은 6종 정확이라 보존.

## 2026-06-23 — 집 보급상자 경험치병 확률 70%로 하향 + 모든 상자 최대 6종류 제한

- 요청1: 내가 지은 집 보급상자의 경험치병(xp_bottle) 드랍 확률을 현재의 70%로. → homeBase.rollHomeSupply 의 tier≥2 조건 확률 0.5→0.35.
- 요청2: 모든 상자(보물·광산·집 보급)가 한 번에 최대 6종류만 주도록. 6종 초과 시 등급 높은 것 → 수량 많은 것 순으로 상위 6개만.
- 구현: chestLoot.ts 에 공용 `capLootByGrade<T>(loot, max)` 추가(LOOT_TIER_RANK: mythic5>legendary4>epic3>rare2>uncommon1>common0, 등급 desc → count desc 정렬 후 slice). rollChestLoot·rollMineChestLoot·rollHomeSupply 각 return 에 cap(.,6) 적용. 솔로·파티(호스트 1회 롤) 양쪽 자동 적용.
- 함정: ItemTier 에 Codex가 추가한 `mythic`(레전더리 위)이 있어 rank map 누락 시 typecheck 실패 → mythic:5 포함.
- 검증: typecheck+build, 모듈 시뮬 — cap=[xp_bottle,obsidian,sharp_obsidian,gold5,diamond3,medkit](common 전탈락·등급/수량 정렬), 집보급 ≤6·xp 35%, 보물/광산 ≤6. main 변경 없음(리프).

## 2026-06-23 — 근접 몹 도약공격이 플레이어를 관통·시야이탈하던 버그 수정

- 증상: 늑대·독사 등 근접 몹이 "달려들듯" 공격할 때 캐릭터와 거의 겹쳐지거나(거미는 그나마 보임) 시야에서 완전히 사라져(뒤로 가버림) 카메라를 돌려야 보임.
- 원인: animatePredatorAttackMotion 이 매 프레임 `position += forward*advance`(누적). 추격 루프(updatePredatorAi)가 그 도약분이 포함된 현재 위치에서 다음 위치를 계산 → 사거리 내(추격속도0)에서 도약 오프셋이 프레임마다 쌓여 플레이어를 향해 끝없이 파고듦.
- 수정: 도약을 '누적'이 아닌 현재 오프셋으로(델타) 적용 — `position += (forward*advance) - 이전오프셋`, userData.attackLungeX/Z 로 추적, 공격 종료 시 잔여 오프셋 원복. 도약은 이제 최대 lunge 거리만큼만 튀었다 정확히 원위치 복귀(누적 0). 정지/공격 사거리(reach=strikeRange+2.5+…)는 유지되어 도약 정점에도 시야 안. predatorAi 는 overworld·cave 공용이라 양쪽 적용.
- 검증: typecheck+build, 모듈 시뮬(추격 리셋 없이 순수 animate 최악케이스): 늑대 min거리 2.0·종료 원위치 3.0, 독사 1.7, 멧돼지(보스) 1.06 — 관통/드리프트 0. main 변경 없음(리프).

## 2026-06-23 — 용 전리품 수량 하향(저레벨 용은 거의 1개)

- 요청: 용 재료(비늘·꼬리·뿔)를 더 모으기 어렵게 — 대량 드랍 확률 낮추고, 저레벨 용(기본 용·파이어 드래곤)은 거의 1개만.
- 원인: 모든 용이 grantRewardItem(loot, 1, "boss") → rewardQuantity 기본 튜닝(maxRandom 3)으로 randInt(1,3) 균등(평균 2). 레벨 무관.
- 수정: combat.rollDragonLootCount(bossKind) 신설 — 저레벨(dragon Lv60·fire_dragon Lv130)=88% 1개/12% 2개(평균 1.12), 고레벨(red/laser/dark/immortal)=60/28/12% 1/2/3(평균 1.52). 멜리·레인지 두 드랍 사이트(applyMeleeDragonAttack·applyProjectileDamage) 모두 적용. operatorConfig sourceOverrides.boss=(1,1,1) 로 고정해 수량 재굴림 차단(boss 소스는 용 전리품 전용이라 타 드랍 무영향, predator 등은 1,1,3 유지).
- 검증: typecheck+build, 모듈 테스트(분포: 기본용/파이어 88% 1개·3개 0%, 레드 평균1.52 + boss 튜닝 정확수량·predator 미영향). main 변경 없음(combat·operatorConfig 리프).

## 2026-06-23 — 파티 버프(심판의 빛·불굴) 미전파 수정 + 몬스터 요새 맵별 이어하기

- ① 힐러 '심판의 빛'(empower)·탱커 '불굴의 함성'(rally) 버프가 파티원에게 안 걸림(시전자 본인만). 원인: party.ts 메시지 라우팅 2곳(호스트 중계 ~284, 게스트 수신 ~349)에 partyHeal 만 있고 partyEmpower/partyRally 누락 → 메시지가 핸들러까지 도달 못 함. 스킬 추가 커밋(1dcbefc) 때부터의 버그(전파 배선 누락). 수정: 두 라우팅 리스트에 partyEmpower·partyRally 추가(partyHeal 와 동일 경로). partyEmpowerNearby/수신 핸들러(empowerLocalPlayer)는 원래 정상.
- ② 몬스터 요새가 재입장 시 1단계부터 시작 → 맵별 최고 클리어 단계부터 이어서 시작. fortressSiege.ts: createSiegeState(baseLevel, startStage) 파라미터화 + loadFortressStageByMap/saveFortressStageByMap(localStorage, 세이브 스키마 무관). main: fortressStageByMap 필드, enter 시 그 맵 기록부터 시작·재입성 메시지, grantStageReward 에서 맵별 갱신, 새 게임 리셋. main +5 → ratchet 10049→10054.
- 검증: typecheck+build, 요새 E2E(dragon_plains 6단계 재개·기록없는맵 1단계·7클리어→기록7·localStorage 저장). empower 는 partyHeal 미러라 코드추론+build. ⚠️ verify 의 save-roundtrip(tanker maxHealth 28≠40)·content(dragon gear 퀘XP·레전더리셋)은 동시 Codex 세션의 미완 작업 — 내 변경 무관(touch 안 함), Codex 확인 필요.

## 2026-06-23 — 집짓기 회귀 수정: 집터 판정이 이동 생물을 장애물로 오인

- 증상: 어느 지형에서든 "이 위치에는 집을 지을 수 없습니다" 메시지로 집짓기 불가.
- 원인: isBuildSiteClear 의 인근 오브젝트 루프가 droppedItem 만 제외하고, collisionRadius 가진 모든 오브젝트를 장애물로 판정 → 동물·야생몬스터(이동 생물)도 집터를 막음. 야생 밀도 상향(2.4/1.5) 이후 집터 7~8칸 안에 거의 항상 생물이 있어 어디서도 못 지음. 진단 E2E 로 blockers=animal/wildPredator 확인(inBiome/nearWater=false).
- 수정: 모듈 const BUILD_SITE_IGNORE_TYPES(동물·몬스터·경비·NPC·펫·드래곤·jammini·미너·떨군아이템) 추가, 루프에서 이 타입은 skip. 정적 구조물·지형·물만 집터를 막는다.
- 검증: typecheck+build, 진단 E2E(정면에 생물 있어도 clear=true·여러 지점 집터 열림, 물/구조물만 막음). main +3 → ratchet 10046→10049.
- ⚠️ verify 중 test:save-roundtrip 1건 실패는 본 수정과 무관 — 동시(Codex) 세션의 직업 밸런스 변경으로 tanker Lv5 maxHealth 28(기대 40) 불일치. tanker HP 하락이 의도인지 회귀인지 Codex 확인 필요(테스트는 내 변경 대상 아니라 미수정). build/typecheck/배포는 정상.

## 2026-06-21 — 몬스터 요새 난이도를 맵 레벨대 기준으로 (플레이어 레벨 의존 제거)

- 증상: 저레벨 맵(용용평원 [10,25])에 뜬 요새가 70레벨로 1단계조차 어려움.
- 원인: enterFortressSiege 의 baseLevel = Math.max(this.level, ...activeRegions.level, 1) — 플레이어 레벨이 섞여 고렙이 저레벨 맵 요새를 과도하게 어렵게 만듦. 퀘스트 안내문("요새 난이도=그 맵 권장 레벨")과 불일치.
- 수정: baseLevel = round((map.levelRange[0]+[1])/2) (그 맵 권장 레벨대 중앙값, 플레이어 레벨·activeRegions 무관). levelForStage=baseLevel+stage*3 라 1단계≈맵중앙+3, 단계마다 +3 램프.
- 검증: verify+build, E2E(용용평원→18(70 아님)·시작초원→10·독늪→53·플레이어70 무관). main 순감 유지(1줄 교체).

## 2026-06-21 — 광산 상자 전리품 상향 + 동굴 깜빡임(파티) + 누적 사냥 파티 합산

- ① 광산 상자 전리품 빈약(구리/석탄 1개) → chestLoot.rollMineChestLoot 신설(흑요석 30%·가끔 2~3개, 다이아 50%, 금 65%, 항상 철·석탄 2~4, 다이아가루/제련다이아/구급상자 보너스). openMineChest 가 rollMineMineral 1롤 → rollMineChestLoot 사용(main 순감, rollMineMineral 은 동굴 광맥용으로 유지).
- ② 파티에서 호스트가 동굴/집(실내)에 들어가면 스냅샷이 끊겨 게스트가 STALE_MS 후 clearSyncedMobs 로 동기화물 전부 제거 → 정적 동굴 입구·상자까지 사라졌다 호스트 복귀 시 재등장(깜빡임). 수정: 스테일 정리에서 정적(cave/chest/mineChest)은 보존(clearSyncedMobs(keepStatic=true)). 세션 종료/맵이동 등 진짜 정리는 기존대로 전체 제거. (저사양은 프레임 stutter 로 더 잘 보였을 뿐, 전 게스트 공통.)
- ③ 누적 사냥(predatorKills)에 파티원 킬 합산: onPartyKill 에서 같은 맵 야생 처치(kind 有)면 막타/관전 무관 +1, 호스트는 게스트 막타를 hostApplyGuestAttack 에서 +1(자기 브로드캐스트 미수신이라 이중집계 없음). 호스트 자기 막타는 기존 로컬 grantExperienceForTarget(creditQuest=true) 그대로. 경비·다른맵 제외.
- 검증: verify+build, 모듈 9종(광산 흑요석30%/다이아>흑요석/금>다이아/빈상자0 + 파티킬 같은맵+1/경비제외/다른맵제외/내막타+1). main 10014(순감, ratchet 하향). #2 는 party 통합테스트가 무거워 코드추론+verify(party-ledger/systems)로 검증.

## 2026-06-21 — 고기 스튜 희귀 등급 + 좌측하단 버프 아이콘바(만료 15초 깜빡)

- ① 고기 스튜 등급을 희귀로: ITEM_RARITY·ITEM_TIER 에 meat_stew:"rare" 추가(이전 미등재=common).
- ② 현재 버프 아이콘바: classSkills.activeBuffs(SkillBuffs *Until 7종 → {icon,name,remainingMs}) + hudRenderer renderStatsMarkup 상단에 .buff-bar(grid-column 1/-1) 칩(아이콘+남은시간). 남은 15초 미만이면 .buff-expiring 으로 깜빡(CSS @keyframes). 위치=좌측하단 상태창 '내부 상단'이라 모바일 재배치/스케일도 자동 추종(별도 위치 CSS 불필요).
- 갱신 cadence: renderHud 는 체력/마나 변화 시에만 호출 → 버프 타이머가 안 흐름. update 루프에 hudRefreshTick(~4/s) 추가해 주기 렌더(문자열 캐시라 DOM 변화 없으면 갱신 안 함). 버프 만료 시 칩 자동 제거.
- 검증: verify+build, 모듈 5종(스튜 rarity/tier=rare·activeBuffs 2개/5분/빈배열) + 브라우저 6종(칩 2개·아이콘 🍲✨·'분' 표기·만료임박 깜빡 1개·버프해제 시 바 제거·무예외) + 스크린샷. main +3 → ratchet 10015→10018(목록·렌더는 리프).

## 2026-06-21 — 첫 배고픔 감소 시 '고기 먹기' 컨텍스트 퀘스트

- 사용자 요청: 시작 후 배고픔이 처음 한 칸 줄 때 고기 먹기 퀘스트(사냥으로 획득·퀵슬롯 넣고 사용 안내).
- 결과: currentObjective 에 시퀀스 밖 컨텍스트 퀘스트 추가(claimableBoss 다음, nextStep 앞). 조건=snapshot.hunger < HUNGER_MAX && !completed("eat_meat") → 배고픔이 세이브되므로 신호 없이 hunger 값에서 직접 파생(리로드 견고). 완료=snapshot.ateMeat, kind:tutorial 이라 Q로 보상 수령(meat 3)·completedStepIds 래치로 1회성. HUNGER_MAX=5, 첫 감소=10분(HUNGER_TICK 600s).
- 신호: tutorialSignals.ateMeat — setHunger 콜백에서 value>현재(=고기 섭취로 배고픔 증가) 시 set(setHunger 는 hotbarUse 고기분기에서만 호출돼 오발화 없음). ObjectiveSnapshot 에 ateMeat 추가(스냅샷은 ...tutorialSignals 스프레드라 자동).
- 검증: verify+build, ssrLoadModule 모듈 6종(가득→무·첫감소→등장·안내문구·먹음→완료·수령후 무·kind) + 브라우저 4종(고기 먹기→ateMeat·배고픔 3→4·무예외). main 예산 10015 유지(두 줄 다 기존 라인 수정).

## 2026-06-21 — 퀘스트 흐름 3건: 훈련장 먼저·동굴 지도안내·제작대 회수 퀘스트

- 사용자 피드백 3건.
- ① 용용 평원(=dragon_plains 맵, 새끼용 여왕) 등 필드보스가 훈련장 퀘스트보다 먼저 떠서, 필드보스 끼워넣기 게이트를 hunt_predators → hunt_predators && train_all_kinds 로 강화. 훈련장 1종(train_once)·4종(train_all_kinds) 퀘스트 완료 전엔 어떤 필드보스도 목표로 끼워넣지 않음(보스는 차단이 아니라 '제안 지연' — 튜토리얼 완료 후 bossLine 으로 항상 노출). 멧돼지 대왕(starter)·용용 평원 모두 훈련 뒤로.
- ② visit_cave 퀘스트 안내에 "발견한 동굴 입구는 지도(M)·미니맵에 동굴 아이콘으로 표시" 추가(이미 mapPanel data-cave-marker·minimap caves 존재).
- ③ '제작대 회수' 퀘스트 신설(recover_workbench, craft_pickaxe 직후). 좌클릭/E=가방 회수, 우클릭=제작 안내. 신호 tutorialSignals.recoveredWorkbench(휘발, achievedStepIds 래치로 영속)·ObjectiveSnapshot 필드 추가·pickUpWorkbench 에서 set(스냅샷은 ...tutorialSignals 스프레드라 자동 반영).
- 검증: vite ssrLoadModule 모듈테스트 6종(보스게이트 A/B·동굴 지도문구·회수퀘 존재/순서/시그널) + 브라우저 6종(설치→회수→시그널 true·제작대 복귀·월드 제거). main 예산 10015 유지(회수 신호 라인 병합).

## 2026-06-21 — 제련대·분쇄기도 동일 컨셉(보유 재료 표기 + 수량 스테퍼)

- 사용자 피드백: "제련대 등등 제작도구를 위와 유사한 컨셉으로 다 변경". 제련대·특수제련대·분쇄기에 보유 재료 표기 + 수량 스테퍼 적용.
- 결과: 인라인이던 renderSmelterPanel·renderGrinderPanel HTML 을 공용 리프 `ui/stationPanel.ts`(renderStationPanel: 보유/필요 라인 + −[1]+ 스테퍼 + 액션)로 추출 → main.ts 순감(10051→10015, ratchet 하향). smeltItem/grindItem 을 (id, quantity) 수량 루프로(재료 소진·인벤 공간 부족 시 만든 만큼만 + 입력 롤백 + 정확한 개수 메시지). 스테퍼 상한 = 보유 재료(min 99). 변환은 1→1(제련)/1→2(분쇄)라 max=보유수.
- 검증: verify+build, E2E 9종(제련대 5/1 표기·상한5·5개 제련 wood5→0/refined5·분쇄기 4/1·상한4·4개 분쇄 stone 소진·무예외). CSS 는 직전 .craft-qty-row/.qty-stepper 재사용.

## 2026-06-21 — 제작대 레시피북: 보유 재료 표기 + 수량 스테퍼(한 번에 N개 제작)

- 사용자 피드백. ① 레시피북 재료를 항상 "보유/필요"로 표기 — ingredientCounts 에 alwaysCount 옵션 추가(워크벤치 뷰만 true; 인벤 검색은 기존대로). ② '바로 제작' 옆에 −[1]+ 수량 스테퍼 — 보유 재료 기준 상한(maxCraftable 리프: min floor(보유/필요), 일회성 가방류는 1, UI상 99 캡)에서 + 가 멈춤. craftWorkbenchRecipe(id, quantity) 루프로 N개 제작(재료 소진·인벤 공간 부족 시 만든 만큼만 + 정확한 개수 메시지).
- 곁들여 수정(직전 커밋 적대적 검수 confirmed 2건=동일 근본): special_smelter 가 MINI_RECIPES·WORKBENCH_RECIPES 양쪽 중복 정의 → workbenchRecipesForStation union 후 레시피북에 카드 2개 중복 노출(기능 영향 X, 인덱스 기반이라 제작은 동일). WORKBENCH 쪽 중복 제거하고 MINER 노트에 용도 병합. 인벤 검색 목록 중복도 함께 해소.
- 검증: verify+build, E2E 8종(보유/필요 18/6 표기·스테퍼 상한 3·중복 카드 1개·막대기 목록·+ 상한 정지·3개 제작 가죽18 소모·붕대 3획득·무예외) + 스크린샷. main +3줄 → ratchet 10048→10051(계산은 recipeGuide.maxCraftable 리프).

## 2026-06-21 — 초보 UX 5종: 핫바 즉시설치·튜토리얼책 재구성·제작대 클릭안내·캐릭터창 자동열림 안내·막대기 제작대 허용

- 사용자 피드백 묶음. ① 핫바 설치물(제작대·침대 등)은 숫자키/터치로 즉시 정면 설치 — placeSelected 가 데스크톱서도 placeItemFromSlot 호출(이전엔 "인벤서 우클릭" 메시지만). 손에 드는 단계 제거. ② 튜토리얼 책 전면 재구성 — tutorial.ts 를 평면 문자열→섹션 구조(TutorialSection[])로, bookPanel.ts 헤더+불릿 렌더, KEY_RECIPES 분리. 처음 흐름 순서·핵심만. ③ 제작대 우클릭=제작/좌클릭=가방 회수 명확화 — 설치 메시지(데스크톱/모바일 분기)·상호작용 프롬프트(제작대·제련대·분쇄기 "우클릭 열기 | 좌클릭/E 회수"). ④ 제작 레벨업 시 캐릭터창 자동열림이 초보에 불친절 → 첫 1회 objectiveGuide 안내 팝업(localStorage 'craft-stat-hint', 익숙한 유저 방해 X)+배너 문구에 "제작을 하면 능력치 포인트" 추가. objectiveGuide 에 heading 옵션·빈 progress/reward 생략 추가(재사용). ⑤ 나무 막대기 등 미니 레시피를 제작대(3x3)·확장(6x6)에서도 제작 — workbenchRecipesForStation 가 [...MINI_RECIPES, ...WORKBENCH_RECIPES] 반환.
- 검증: verify+build, E2E 12종(즉시설치·설치메시지·막대기 3x3/6x6·책 섹션화/레시피/우클릭안내·캐릭터 자동오픈·첫회 팝업·배너·1회플래그·2회차 미표시·무예외) + 스크린샷 2장. main.ts 변경은 전부 기존 라인 수정/병합 → 예산 10048 유지.

## 2026-06-21 — 데스크톱 좌상단 퀵버튼(가방·캐릭터·파티) + 조작법 슬림화

- 시도: 데스크톱도 모바일 touch-menu 처럼 좌상단에서 가방·캐릭터창·파티를 아이콘 버튼으로 열게 하고, 조작법 설명에서는 나머지만 남기자는 사용자 피드백.
- 결과: controlsGuide 상단에 퀵버튼 3종(🎒가방=inventory, 👤캐릭터=character, 🎉파티=party) 추가. data-quick-action 을 setupUi 가 위임 클릭 처리(.controls-guide 는 pointer-events:none 라 버튼만 auto). main 은 onQuickAction 콜백 1개로 togglePanel/​togglePartyLobby 라우팅(onNewGame 라인 병합=배선 0줄). 조작법 텍스트에서 'I 가방'·'O 파티 초대' 제거(도감 B·지도 M·퀘스트 Q·ESC·Enter 파티 채팅 유지). 모바일은 기존 touch-menu 사용 + controls-guide 가 touch-mode 에서 숨김이라 중복 없음.
- 검증: verify+build, E2E 9종(퀵버튼 3개·아이콘·가방행/파티초대 제거·나머지 유지·각 버튼 클릭→인벤/캐릭터 열림·파티 무예외) + 스크린샷.

## 2026-06-21 — 인벤토리창 정리: 보조설명 제거·미니제작 축소·제작검색 확대·집짓기 하단·정렬

- 시도: 인벤토리창의 보조 설명 텍스트가 공간을 많이 먹고 제작 검색 영역이 좁다는 사용자 피드백.
- 결과: ① 보조설명 전부 삭제(상단 subtitle·미니제작 craft-note·레시피 카드 note·집짓기 description). ② 미니 제작대 칸 높이 절반(craft-slot clamp 66~82→30~40px, arrow/result도 동조). ③ 제작 검색 리스트 max-height 210px→clamp(300,56vh,640) 로 대폭 확대. ④ 집짓기 영역을 inv2-side 밖·inv2-layout 뒤(최하단, 스크롤 노출)로 이동 + 전체폭 한 줄(flex). ⑤ 제작 검색 정렬: 지금 미니제작대(2x2)로 만들 수 있는 것 먼저(stationKey==="mini" && canMake), 그 다음은 기존 정렬(canMake/station/name) 유지 — 안정정렬 활용. 정렬은 인벤 호출부에서만 적용(workbench 패널 미영향).
- 검증: verify+build, E2E 9종(subtitle/craft-note/note 삭제·집짓기 위치·첫카드 미니&ready·craft-slot 40px·무예외) + 스크린샷. main 변경=정렬 1줄(기존 라인 연장, 줄수 0). isTable dead-code도 이전 커밋서 제거됨.

## 2026-06-21 — 초보 온보딩 고도화: 제작대·가방을 놓치지 않게 (3티어 전부)

- 시도: 처음 켠 유저가 사실상 필수인 제작대 설치·가방 제작을 놓침. 원인=발견성(HUD엔 퀘스트 제목만, "어떻게"는 hover/클릭 뒤; I키·우클릭-설치·작은가방 비직관). 사용자 선택=전체(Tier 1+2+3).
- 결과: ① **핵심 스텝 가이드 1회 자동**(craft_workbench_item/place_workbench/craft_bag 활성 순간 objectiveGuide 자동+exitPointerLock). ② **HUD 코치 비콘**(1챕터 한정 "다음 할 일 1개"+키칩, 스텝마다 자동 갱신·✕ 해제, 챕터1 벗어나면 자동 숨김). ③ **첫 인벤-풀 시 가방 제작 가이드 1회**. ④ **퀘스트 문구 단계번호화**(제작대 제작/설치/가방). ⑤ **인벤 UI**: 설치형 '설치' 뱃지, 2x2(어디서나) vs 3x3(설치한 제작대) 동적 라벨+설명, 가방 부족 경고바(8→40칸·urgent 점멸). 로직·데이터는 ui/coachBeacon 리프, 상태 전부 휘발(세이브·회귀 0).
- 설계 판단: 푸시>풀(결정적 순간 먼저 안내, 1회·해제). 자동팝업은 exitPointerLock으로 커서 확보. 코치 비콘은 COACH_HINTS 키(챕터1)만 표시→자동 은퇴.
- 검증: verify+build, E2E 11종(시작 비콘·핵심스텝 자동팝업·1회성·설치뱃지·가방경고바·2x2라벨·✕닫기·무예외) + 스크린샷. main 배선 6줄(전부 wiring)로 ratchet 10042→10048(사유 기재). 설계 docs/beginner-onboarding-design.md.
- 적대적 검수 후속(2 LOW 수정): ① 온보딩 상태가 resetGameState 에서 미리셋 → 같은 세션 재시작 시 안내 억제. resetOnboardingState(leaf) 추가·resetGameState 에서 호출(closePanel 라인 병합=배선 0줄). ② inventoryPanel 의 isTable(3x3) 분기는 항상 false(인벤은 항상 2x2, 3x3는 별도 workbenchPanel)였음 → dead code 제거하고 workbenchPanel 부제에 "설치한 제작대 …" 보강. E2E 5종(게임1 팝업→새게임 리셋→게임2 재노출·라벨 유지) PASS.
- 사용자 피드백 후속: ① 가방 제작에 제작대가 필요함을 명시 — 가방 경고바·인벤풀 토스트 문구에 "제작대에서 가죽 7개로" 추가. ② find_hammer 막힘 방지 — openChest 에서 망치·제작대·워크벤치가 모두 없으면 상자에서 망치 보장(loot 선두 1개; crafting_table 보유 시 게이트 OFF=과발동 없음). find_hammer 퀘스트 문구도 "첫 상자에 반드시" 로 갱신. E2E 5종(시작 망치0→첫상자 망치≥1→제작대 보유 게이트OFF·가방바 제작대 명시) PASS. main 배선 0줄(loot 선언 라인 병합).

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

## 2026-06-26 — 난이도 모드(쉬움/어려움) 추가

- 무엇: 타이틀 신규게임 시 난이도 선택(기본 쉬움, 게임 중 변경 불가, 세이브에 고정). 어려움 = 쉬움(현재 세팅) 대비 몬스터 공·방·추격 ×1.3·체력 ×1.5, 퀘스트 경험치 ×0.6, 드랍률 ×0.5, 경험치병 ×0.5, 상점 가격 ×3. 몬스터 처치 경험치는 불변.
- 설계: 로직은 `src/game/difficulty.ts`(순수 모듈, 배율표 + `applyMonsterDifficulty`/`difficultyShopCost`). main.ts 는 필드 3개 + 컨텍스트에 배율 주입만(신규 메서드 0 — check:methods 495 불변). 몬스터 능치는 "스폰 시 1회 보정" 모델: 각 스폰 경로의 최종 stat-set 직후 `applyMonsterDifficulty` 1회. override 분기(시즈/요새보스/필드보스)는 raw 재설정 후 1회 보정이라 이중적용 없음.
- 추격속도는 hot-path(predatorAi/caveMonsters/guardAi/dragonAi 매 프레임)라 **할당 없이 숫자 배율만** 주입(`monsterChaseSpeedMul()`)해 chase 항에 곱함.
- 세이브: `SavedGame.difficulty`(optional) + `SAVE_VERSION` 12→13 + 마이그레이션 통과(구세이브·잘못된 값 → easy). 보스 체력바 분모도 ×체력배율로 맞춰 비율 정확.
- 테스트: `scripts/difficulty-test.mjs` 신규(배율·보정·상점가격·항등) + save-migration 에 난이도 보존/폴백 assert 추가. typecheck·combat·save-migration·save-repository·content·gameplay-systems·balance·mobile·party-ledger·difficulty 전부 녹색.
- ⚠ 미검증(환경 제약): 이 원격 컨테이너엔 브라우저가 없어 `save-roundtrip`(Windows Chrome 경로 한정 finder)·`visual-check`·`perf-check` 미실행. 타이틀 UI(난이도 버튼)는 기존 그래픽품질 셀렉터를 그대로 미러링했고, 엔티티 수 증가는 없음(능치만 보정)이라 성능 영향 낮음. 사용자 PC 에서 visual-check 권장.
- 관련 파일: src/game/difficulty.ts(신규), entitySpawns·monsters·caveMonsters·fieldBosses·predatorAi·dragonAi·guardAi·saveManager·saveMigration·types·constants, src/objectiveClaim.ts, src/ui/titleScreen.ts·setupUi.ts, src/main.ts.

## 2026-06-26 — 요새 글로벌 랭킹 난이도별 분리 + 리셋 버그 수정

- 증상(사용자 보고): 몬스터요새 글로벌 랭킹이 자꾸 리셋됨 + 난이도별 구분 없음.
- 근본 원인(리셋): `resetGameState()`(main.ts)가 무조건 `bestFortressStage=0; saveBestFortressStage()` 로 localStorage 를 0 으로 덮어썼다. 이 함수는 **신규게임뿐 아니라 세이브 로드(restoreSaveData)에서도 매번 호출**된다. bestFortressStage 는 세이브에 없고 닉네임당 전역(localStorage) 기록이라, 로드할 때마다 0 으로 지워지고 → 이후 publishProgress 가 Firebase `/users/{nick}` 에 fortressStage:0 을 PATCH 해 글로벌 기록까지 덮어썼다. (predatorKills 는 과거 같은 버그를 세이브 복원으로 막아둔 전례 있음 — main.ts:6259 주석.)
- 수정(리셋): resetGameState 에서 bestFortress 초기화 제거. 요새 기록은 닉네임당 **영구**(로드·새 게임에도 유지, 단조 증가만). 맵별 진행(fortressStageByMap, 런 상태)만 계속 리셋.
- 수정(난이도 분리): bestFortress 를 `Record<"easy"|"hard", {stage, baseLevel}>` 로. 클리어 시 현재 난이도 슬롯만 갱신. Firebase 레코드에 `fortressStageHard`/`fortressBaseHard` 추가(기존 fortressStage=쉬움, 레거시 기록은 쉬움으로 호환). `fetchFortressLeaderboards` 가 /users.json 1회 읽어 쉬움·어려움 두 표 생성. 캐릭터 창에 두 랭킹 + 내 최고(쉬움/어려움) 표시.
- 메서드 −1: loadBestFortressStage+loadBestFortressBaseLevel → loadBestFortress 1개로 병합(MAX_METHODS 495→494 조임).
- ⚠ 한계: 이미 옛 버그로 0 으로 덮어써진 과거 기록(local·Firebase 모두)은 **복구 불가** — 이번 수정은 이후 리셋만 막는다. 사용자에게 고지.
- 테스트: `scripts/leaderboard-test.mjs` 신규(발행 필드·난이도 분리·레거시→쉬움·myRank). typecheck·전체 단위테스트 녹색. (브라우저 부재로 visual-check 미실행 — 패널 마크업만 추가.)
- 관련: src/game/progressSync.ts, src/game/constants.ts, src/ui/characterPanel.ts, src/main.ts.

## 2026-06-26 — 훈련장 랭킹 점검 + 계정 best-ever 전환

- 점검 결과: 훈련 랭킹은 요새와 "동일한" 매-로드 리셋 버그는 **없음**. trainingStats/trainingTries 는 SavedGame 에 저장되고 restoreSaveData 에서 resetGameState 직후 세이브값으로 복원되므로(reset 6197 → 복원 6291) 로드 시 0 발행 안 됨.
- 그러나 관련 약버그 존재: 훈련 기록은 캐릭터별(활성 능력치 보너스)이라 **새 게임/다른 세이브 로드 후 저장** 시 그 캐릭터의 낮은 값이 발행돼 닉네임 훈련 랭킹이 내려갔다(요새의 새-게임 리셋과 유사).
- 결정(사용자): 요새와 동일하게 **계정 best-ever** 로 고정.
- 구현: 활성 trainingStats(캐릭터별, 능력치 보너스)는 그대로 두고, 랭킹 전용 `bestTraining`(종목별 {stage,tries}, localStorage `best-training-v1`, 닉네임당 영구)을 game/training.ts 에 추가(loadBestTraining/saveBestTraining/raiseBestTraining/TRAINING_KINDS — leaf). main 은 필드+성공 시 raise+로드 시 시드 배선만(신규 메서드 0). progressUpdate 가 bestTraining 발행. resetGameState 는 bestTraining 을 건드리지 않음 → 새 게임에도 안 떨어짐. 로드 시 캐릭터 훈련치로 best-ever 시드(낮으면 안 떨어뜨림)라 기존 랭크 보존.
- best-ever 규칙: 더 높은 stage, 또는 동률 stage 에서 더 적은 tries 일 때만 갱신(랭킹 정렬 stage desc·tries asc 와 일치).
- 테스트: leaderboard-test 에 raiseBestTraining 단조성/동률-시도/0단계 케이스 추가. typecheck·전체 단위테스트 녹색.
- 한계: 이미 새-게임 등으로 낮아진 과거 Firebase 훈련 기록은 복구 불가 — 이후 하락만 방지.
- 비고: 훈련 랭킹은 난이도 분리 안 함(요청 범위 아님 — 요새만 난이도별).
- 관련: src/game/training.ts, src/game/constants.ts, src/main.ts, scripts/leaderboard-test.mjs.

## 2026-06-26 — 모바일 UX 4종 개선

- 문제(사용자 보고): (1) 인게임 중 '새로시작' 버튼이 모바일에 없음, (2) 전체화면 아이콘(⛶)이 불직관, (3) 최근 바뀐 제작대·캐릭터창 UI가 모바일서 깨짐(축소 필요), (4) 가이드 문구가 데스크톱 단축키만 설명.
- 원인(1): `body.touch-mode .save-controls { display:none }` 로 새로시작/저장/불러오기 바가 통째로 숨겨짐. 터치 메뉴엔 저장·불러오기만 있고 새로시작 없음.
- 수정(1): touchControls 터치 메뉴에 '새로시작' 버튼 추가 — 불러오기와 동일하게 숨겨진 데스크톱 `[data-new-game]` 클릭 재사용(콜백/main.ts 무수정, 확인창 그대로).
- 수정(2): 전체화면 버튼 라벨을 `⛶` → `⛶ 전체화면` 으로 병기.
- 수정(3): style.css `@media (max-width:640px)` 에 캐릭터 패널 축소 추가(20px→13~14px 폰트, padding/gap 축소, stat-row 64px 컬럼). 워크벤치는 기존 720px 1열 collapse 로 커버. ⚠ 브라우저 부재로 visual-check 미실행 — 실기기 확인 권장.
- 수정(4): coachBeacon 에 데스크톱키→모바일 라벨 맵(WASD→조이스틱, 좌/우클릭→👊버튼/탭, E→👊버튼 등) 추가해 touch 시 kbd 배지 치환. tutorial 책·training howTo·recipes note 의 데스크톱 전용 문구에 "(모바일: …)" 병기(기존 패턴 답습). controlsGuide 는 이미 모바일서 숨김, objectiveGuide 는 이미 모바일 안내 있음.
- 검증: typecheck·mobile·content·gameplay-systems·combat·save·difficulty·leaderboard 녹색. main.ts 무변경(예산 그대로).
- 관련: src/ui/touchControls.ts, src/ui/coachBeacon.ts, src/game/tutorial.ts, src/game/training.ts, src/game/recipes.ts, src/style.css.

## 2026-06-26 — 정령(Spirit) 가챠·장착·레벨업 시스템 (4단계 커밋)

- 요청: 가챠 아이템으로 등급별 정령 확률 획득 → 목걸이처럼 장착해 공·방 버프, 소환수식 레벨업 + 먹이.
- 설계: 로직은 leaf(game/spirits.ts), 연출/표현은 ui(gachaScreen.ts·spiritBadge.ts), main 은 배선만(신규 메서드 0 — 컨텍스트 콜백·필드로만). 등급/배율은 데이터(SPIRIT_GRADES)로 표현.
- 등급: 5단계(일반/고급/희귀/영웅/전설), 가챠 48/30/15/5.5/1.5%, 공·방 각각 0-5/3-8/6-11/9-14/12-17 독립 롤. 레벨당 버프 = 초기치 ×(1+2%×(Lv-1)).
- 1단계(e7d8743): spirits.ts + 타입 + 아이템(정령 소환권, 전설 tier + 황금 눈 외형) + spirits-test.
- 2단계(530c72d): 세이브 스키마(SAVE_VERSION 13→14, 마이그레이션 빈 컬렉션) + 드랍(상자 12%/4%·사냥 1.2%×난이도) + 사용(인벤 더블클릭·핫바 → 전체화면 가챠 연출: 이집트 눈 빌드업→등급색 공개, 건너뛰기, 신디사이즈 효과음).
- 3단계(dad3e4f): 캐릭터창 장착 섹션 + 공/방 적용(목걸이와 동일 합산 위치) + 좌하단 버프 칩(상시 value) + 좌상단 미니 뱃지(등급↑ 발광/반짝 차등).
- 4단계(이 커밋): 장착 정령이 처치 시 소환수와 동일 경험치로 레벨업 + 미착용 정령 먹이기(등급·레벨 비례 경험치).
- 결정/기본값(사용자 질문 도구가 권한오류로 실패 → 권장값으로 진행, 사용자 정정 가능): 5등급/위 배율, 공·방 독립 롤, BGM=엔진 신디사이즈(외부 파일 없음 — 이 환경서 바이너리 추가 불가), 단일 장착, 사냥·상자 드랍.
- ⚠ 미검증(환경 제약): 브라우저 부재로 visual-check 미실행 — 가챠 연출(눈 애니메이션)·뱃지·패널 레이아웃은 실기기 확인 권장. 로직은 spirits-test 로 커버.
- 관련: game/spirits.ts·types·items·chestLoot·hotbarUse·saveManager·saveMigration·constants·heldItemVisuals, ui/gachaScreen·spiritBadge·characterPanel·hudRenderer, main.ts, style.css, scripts/spirits-test.

## 2026-06-26 — 정령 7등급 확장 + 적대적 테스트/리뷰

- 7등급(일반/고급/희귀/영웅/전설/신화/초월), 확률 42/27/16/8/4/2/1%, 범위 …12-17/15-20/18-23.
- spirits-test 를 적대적/엄격으로 재작성: 등급테이블 무결성·rollGrade 경계+6만표본 분포·rollStat 퍼징(범위이탈/비정수 0)·createSpirit 결정성·버프 단조성·레벨업 불변식(잔여<요구치, 무한루프 없음)·먹이 단조·악의적 normalize 입력(9999→상한클램프, NaN→0, 문자열파싱, 쓰레기 제외, 멱등성)·dangling equippedId→null.
- 적대적 코드리뷰(서브에이전트)로 통합 버그 추적. 판정: 스탯수식·수치·핫패스·세이브/마이그·더블클릭 CLEAN. 발견·수정:
  - [HIGH] 가챠 오버레이가 모듈 싱글톤이라 연출 중 2번째 토큰 사용 시 첫 결과가 고아화 → `isSpiritGachaActive()` 가드를 hotbarUse 의 토큰 소모 *전*에 추가(이중 소모·연출 겹침 차단).
  - [HIGH→방어] 연출 예외 시 토큰만 소모되고 복구 안 됨 → openSpiritGacha 에 try/catch(정령은 이미 보유 추가됨 → HUD/패널 복구).
  - [LOW] 먹이가 단클릭 영구 삭제 → window.confirm 확인창 추가(아이가 고등급 정령 실수 소멸 방지).
- typecheck·아키텍처·hotpath·메서드(494)·전체 단위테스트 녹색. (브라우저 부재로 visual-check/roundtrip 미실행은 동일.)
