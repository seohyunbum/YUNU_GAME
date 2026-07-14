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

## 2026-07-05 — 적대적 테스트 2차: 오늘 변경의 기존 플레이 영향 — 1건 수리·3각도 검증

- 요청: 방금(불러오기 먹통) 같은 기존 플레이 회귀를 오늘 변경 전반에 대해 빡시게.
- **수리 — 공유 아우라 자산 dispose 오염**: `disposeObject3D` 는 sharedGeometries/Materials 레지스트리 밖 재료를 전부 dispose 한다. 아우라의 전역 공유 캐시(프리셋 ShaderMaterial·셸/링 지오메트리)는 미등록 → **핫바 무기 교체(heldItemGroup 교체)·거울 아바타 재생성 때마다 공유 자산이 dispose 되어 다음 프레임 GPU 재업로드 히컵**(교체 연타 시 반복 렉 각도). 수정: 아우라 메시에 `userData.sharedAsset=true` 플래그(leaf) + disposeObject3D 첫 가드에서 스킵(main 기존 라인 병합, +0줄). 검증: 무기 교체 30연타 후에도 아우라 정상 렌더·에러 0.
- 검증(회귀 없음 확인):
  - **인트로 중 게임 시작(파티 딥링크 등)**: startGame→resetGameState 의 컷씬 수동 해제가 intro 도 커버 — active=false·오버레이 제거·정상 시작 실측(10초 카메라 잠김 위험 없음).
  - **아바타 걷기 애니메이션**: cycle.parts(명시 등록 팔다리)만 순회 — 아우라 자식 추가가 오염시키지 않음(인덱스/전체 children 순회 아님).
  - **타이틀 불러오기**: 수정 후 재실측 grid ✓. `.title-active >` child 계열 override 는 panel-layer 뿐(전수 스캔) — 다른 피해자 없음.
  - removeObject 는 dispose 를 안 하므로(전수 확인) 드랍템/보스 제거 경로는 무관.
- 관련 파일: src/game/auraVisuals.ts(sharedAsset 플래그) · src/main.ts(disposeObject3D 가드).

## 2026-07-05 — 긴급수정: 타이틀 불러오기 먹통 (CSS 특이도 회귀)

- 보고: 오늘 수정 후 타이틀에서 불러오기 동작 안 함.
- 원인: 부팅 인트로 작업에서 `.game-ui.title-active > :not(.title-screen)` 숨김 셀렉터에 `:not(.illia-cutscene)` 을 **인라인으로 추가**하면서 특이도가 0,3,0→0,4,0 으로 상승 → 뒤쪽의 `.game-ui.title-active > .panel-layer { display: grid }`(불러오기 패널 재표시, 0,3,0) 를 이겨버려 패널이 열려도 display:none 유지.
- 수정: 숨김 셀렉터를 원래 특이도로 되돌리고, 컷씬 예외는 **동일 특이도의 별도 후행 규칙**(`.game-ui.title-active > .illia-cutscene { display: block }`)으로 분리.
- 재발 방지 원칙: **재표시(override) 규칙이 딸린 광역 숨김 셀렉터에 :not() 예외를 인라인 추가하지 말 것** — 특이도가 올라가 기존 override 를 전부 무력화한다. 예외는 항상 별도 후행 규칙으로.
- 검증(헤드리스 실측): [data-title-load] 클릭 → panel-layer computed display=grid(패널 열림 스크린샷 확인) + 인트로 오버레이 display=block 유지(양쪽 동시 성립). build 그린.
- 관련 파일: src/style.css.

## 2026-07-05 — 부팅 인트로 트레일러 (타이틀 전, 목가적 오프닝, 스킵 가능)

- 요청: 게임 실행 시 타이틀 화면 전에 트레일러 1개 — 고퀄 동일하되 평화롭지만 모험이 기대되는 인트로(택틱스풍). 스킵 동일.
- 구현: 기존 컷씬 엔진에 4번째 kind **"intro"** 추가(illiaBoss leaf) — 타이틀 배경 월드(마을, titleFocus)가 이미 렌더되므로 그 위에서 촬영.
  - 타임라인 10s: 마을 상공 슬로우 원호 드리프트(0–4.5s) → 마을을 스치는 낮은 스윕(4.5–8s) → 상승하며 시선을 지평선 너머로(8–10s, 모험 기대). 셰이크 없음, easeCine 전 구간, 따뜻한 차임 2회(오디오 제스처 전이면 무음).
  - **warm 그레이딩 변형**: showIlliaCutsceneOverlay(host, title, warm) → `.illia-cutscene.intro` — 핏빛 대신 새벽 금빛 그레이드·부드러운 비네트·금빛 타이틀 글로우. 앰비언스도 금빛 엠버(반딧불).
  - main 배선(+1): pre-game update 분기에서 1회 킥(introPlayed) + 컷씬 active 면 updateTitleCamera 대신 컷씬이 카메라 소유. onFinish "intro" 분기 no-op(cinema 해제로 타이틀 자연 노출). titleFocus 정본은 INTRO_FOCUS(leaf) 로 일원화.
  - 스킵: 기존 컷씬 스킵(Space/ESC/Enter/클릭)이 pre-game 에서도 동작(가드 순서 확인) — 스킵 후 타이틀 즉시 복귀 실측.
- **함정 2건(재발 방지)**:
  - `.game-ui.title-active > :not(.title-screen){display:none}` 이 컷씬 오버레이까지 숨겼다 → `:not(.illia-cutscene)` 예외 추가. 타이틀 전 오버레이를 띄울 땐 title-active 숨김 규칙을 반드시 확인.
  - **자동화(E2E) 호환**: 부팅 인트로가 타이틀 버튼을 10초 가리면 visual-check·save-roundtrip 등 기존 E2E 가 첫 클릭에서 전멸 → `navigator.webdriver` 감지 시 인트로 스킵(Playwright/Selenium 은 타이틀 즉시). 수동 검증은 evaluate 로 강제 시작.
- 검증: 전 게이트·전 node 테스트(illia-test 에 intro 완주/정리 케이스 추가)·build 그린. 헤드리스 강제 발동 스크린샷 — 레터박스·warm 비네트·금박 타이틀·마을 스윕 렌더 + Space 스킵 → 타이틀 visible 확인.
- 관련 파일: src/game/illiaBoss.ts · src/style.css · src/main.ts(+1) · scripts/illia-test.mjs.

## 2026-07-05 — 컷씬(트레일러) 시네마틱 업그레이드 — 디아블로4 시네마틱 추구미

- 요청: 트레일러 영상들(일리아 각성/해방·차원의 문 개방 컷씬 3종)을 훨씬 고퀄리티로. 추구미 = 디아블로4 시네마틱.
- 구현(전부 leaf: illiaBoss·illiaVisuals·style.css — main.ts 무변경, 컷씬 3종 공통 적용):
  - **DOM 시네마틱 그레이딩**(GPU 0 비용): 레터박스 12.5vh+그림자 / **비네트**(가장자리 잠식) / **필름 그레인**(SVG 노이즈 + 스텝 플리커) / **컬러 그레이드**(하이라이트 억제 + 그림자에 냉혈청·핏빛 multiply). 타이틀 = 세리프 대문자 트래킹 + **금박 그라데이션 텍스트** + 핏빛 글로우 + 장식 디바이더(— ✦ —), 블러에서 느리게 떠오르는 인트로.
  - **3D 앰비언스**: `createCinematicAmbience`(엠버 34 + 갓레이 광선 3) — 컷씬 시작 시 1회 생성해 **state.props 에 push**(종료/스킵/수동정리 모두 자동 제거), 매 프레임 무할당 나선 상승/슬로우 회전. gateOpen=보랏빛, 아레나=진홍.
  - **카메라 이징**: awaken·gateOpen 접근 돌리에 smoothstep(easeCine) — 선형 돌리의 기계적 느낌 제거(묵직한 푸시인).
- 검증: typecheck·전 게이트·전 node 테스트(illia-test 씬 완전정리 assert 포함)·build 그린. 헤드리스로 gateOpen 실발동 스크린샷 — 레터박스·비네트·금박 타이틀·갓레이·엠버 전부 렌더 확인, 에러 0.
- 다음 작업자: 컷씬 소품은 반드시 state.props 에 넣어라 — finish/leaveCave/resetGameState 세 정리 경로가 props 만 순회한다(anchor 는 예외적으로 복구만).
- 관련 파일: src/game/illiaBoss.ts · src/game/illiaVisuals.ts · src/style.css.

## 2026-07-05 — 아바타 전신 아우라 (전직 차수 차등, 4차=임팩트) — 화려함 패스 4차

- 요청: 아바타 아우라 적용, 전직 단계 차등, 4차는 진짜 멋지고 임팩트 있게.
- 구현(auraVisuals leaf 확장 + avatar.ts 팩토리 1줄 — main.ts 무변경, 파티 아바타·거울 자동 적용):
  - `attachAvatarAura(root, jobTier)` — **1차**=은은한 금빛 셸(goldSoft) / **2차**=화염 셸(flameSoft) / **3차**=보랏빛 에픽 셸 + 발밑 보라 룬링 / **4차**=푸른 다이아 **이중 셸**(진한 mythic 안쪽 + 대형 radiant 외곽) + **역회전 이중 룬링**.
  - 발밑 룬링: 공유 지오메트리/색별 캐시 머티리얼, 회전은 onBeforeRender 시간 기반 절대각(할당 0, 컬링 시 0 비용). 프리셋 3종 추가(goldSoft/flameSoft/radiant — 아바타는 몸을 가리지 않게 은은한 세기).
  - 렉: 아바타당 draw call 1차/2차 +1, 3차 +2, 4차 +4. 파티원 수 명 한정 + 아바타 컬링 동승 — 부담 미미.
- 검증: typecheck·전 게이트·전 node 테스트·build 그린. 헤드리스로 1/3/4차 아바타 3체 소환 스크린샷 — 차등(금빛/보라 룬링/푸른 이중 셸+링) 실제 렌더 확인, 에러 0.
- 관련 파일: src/game/auraVisuals.ts · src/avatar.ts(부착 1줄).

## 2026-07-05 — 무기 휘두름 궤적(스윙 아크) 업그레이드 (화려함 패스 3차)

- 요청: 무기 휘두름 궤적 진행.
- 현황: 근접 스윙 잔상이 작은 텍스처 플레인 1장(백색, 궁극 방패만 붉음) — 밋밋하고 무기 등급 무관.
- 구현(combatEffects leaf, main 은 호출부 1곳 인자 교체 — 줄 수 불변):
  - `spawnMeleeSlashTrail(context, item)` 로 시그니처 변경(기존 bool → 장착 아이템). 전사 무거운공격·독수리 빙의 등 무인자 호출부는 default null(강철백)로 호환.
  - **2겹 궤적**: ① 무기 티어색 대형 스윙 아크(RingGeometry 원호 — 검이 그린 잔상) ② 기존 텍스처 백색 코어 스트릭(하이라이트). 같은 roll 각도로 정렬 + 랜덤 변주(대각/횡/역베기).
  - **티어색**: 일반/고급=강철백 · 희귀=다이아 시안 · 에픽=보라 · 레전더리=화염 주황 · 신화=푸른 다이아(아우라 정체성과 동일 톤). 날카로운 흑요석 방패(궁극)=진홍 광폭(내부 판정).
  - 렉: 아크 지오메트리 2종(일반/광폭) 모듈 풀링(pooled:true — dispose 스킵), 잔상 수명 0.17~0.2s, 스윙은 actionTimer 게이트라 동시 잔상 2~3개. 머티리얼만 스윙당 clone(텍스처 없음, 경량).
- 검증: typecheck·전 게이트·전 node 테스트·build 그린. 헤드리스에서 전사 무거운공격 실발동(궤적 경로 실행·에러 0 — 대폭발에 묻혀 아크 단독 캡처는 불가). 기본 공격 아크 시각 확인은 PC 권장.
- 관련 파일: src/game/combatEffects.ts(spawnMeleeSlashTrail 재작성) · src/main.ts(호출부 인자).

## 2026-07-05 — 스킬 슬롯(R/T/F/G)별 시전 이펙트 차별화

- 요청: 스킬마다 이펙트가 확실히 차별화되어 멋지게 발현(화려함 패스 2차).
- 현황: 시전 임팩트가 직업별 1종뿐 — R/T/F/G 가 모두 같은 연출을 재사용(3·4스킬 컨텍스트가 secondSkillContext 를 spread 해 castImpact 까지 상속).
- 구현(combatEffects leaf + main 배선 3곳, 줄 수 불변):
  - `spawnSkillCastImpact` 에 `slot: SkillFxSlot("primary"|"second"|"third"|"fourth")` 추가. **슬롯 형태 × 직업 2톤 색 = 28종 조합 전부 구분**: R=기존 직업 고유 연출 유지 / **T=전방 ±55° 부채 러시 + 발밑 충격파**(돌진·발동기로 읽힘) / **F=발밑 마법진 + 나선 상승 기둥**(강력 시전) / **G=대형 마법진 + 충격파 + 360° 2단 노바**(궁극 — 자체가 초월 연출이라 별도 오버레이 없음). T/F 는 4차 전직 시 푸른 다이아 입자 가산.
  - 신규 파라메트릭 입자 `spawnSignatureParticles(arc|spiral|nova)` — **공용 damageParticles 풀 + 전역 상한(DAMAGE_PARTICLE_CAP 예산 가드) + lowFx 50% 감량** 그대로 준수. 시전은 쿨다운 게이트(수 초~70초)라 파티클 부담 미미(도약 실측 37개).
  - main 배선: secondSkillContext castImpact 에 "second", third/fourth 컨텍스트에 슬롯별 castImpact 오버라이드(기존 줄에 병합 — main.ts 9445 불변).
- 검증: typecheck·전 게이트·전 node 테스트·build 그린. 헤드리스에서 사무라이 T(도약) 실발동 — 파티클 37개 스폰·에러 0(돌진기라 시전 지점 이펙트는 카메라 뒤). 시각 최종 확인은 PC 권장.
- 관련 파일: src/game/combatEffects.ts · src/main.ts(castImpact 3곳).

## 2026-07-05 — 셰이더 아우라 시스템 1차 (무기·보스 넘실거리는 아우라, 렉 최소)

- 요청: 렉 거의 없이 캐릭터·무기·이펙트를 더 화려하게(넘실거리는 아우라, 스킬 차별화). "그래픽 엔진을 새로 도입해야 하나?"
- **판단: 엔진 교체 불필요.** 병목은 엔진이 아니라 이펙트 콘텐츠. Three.js ShaderMaterial 로 GPU 가 그리는 아우라는 엔티티당 draw call +1 뿐. 엔진 교체는 수개월 재작업 + 동일 GPU 예산이라 손해. (기존 PC high 의 selective bloom 이 밝은 아우라를 자동 증폭.)
- 구현(`game/auraVisuals.ts` 신규 leaf, main.ts 무변경):
  - GLSL 셰이더: 가로 파동(넘실거림) + 위로 흐르는 2중 화염 밴드 + 상/하단 페이드. additive·depthWrite off.
  - **렉 최소 설계**: 지오메트리 2종·머티리얼 프리셋당 1개를 모듈 스코프 캐시로 전부 공유. 애니메이션은 uTime 유니폼 1개(GPU 계산) — JS 프레임 비용 = onBeforeRender 숫자 대입 1회(할당 0, 컬링되면 0). raycast no-op(조준 방해 없음).
  - **무기 아우라**(heldItemVisuals 팩토리 내부 → 1인칭 손+바닥 드랍 공통): epic=보랏빛 잔불 / legendary=진홍 화염 / mythic=푸른 다이아. WEAPON_DAMAGE 등재 무기만(에픽 구급상자 등 제외).
  - **보스 아우라**: 용 6종 = 브레스 속성색(gold/flame/frost/venom/mythic), 일리아 P1/P2 = 심연(abyss). bossVisuals·illiaVisuals 팩토리에서 부착 — 스폰 경로 전부 자동 적용.
- 검증: typecheck·전 게이트·전 node 테스트·build 그린. **헤드리스 스크린샷으로 흑요석 카타나 아우라 실제 렌더 확인**(셰이더 컴파일 에러 0). perf-check(Windows) 는 PC 확인 권장 — 시작 지역엔 아우라 대상이 없어 예산 영향 없을 것으로 예상.
- 다음 후보(사용자 피드백 후): ② 스킬별(R/T/F/G) 전용 이펙트 차별화 패스(현재는 직업별 캐스트 임팩트만 차별화) ③ 파티 아바타·3인칭 전신 아우라(잡 티어별) ④ 무기 궤적(trail) 셰이더.
- 관련 파일: src/game/auraVisuals.ts(신규) · heldItemVisuals.ts · bossVisuals.ts · illiaVisuals.ts.

## 2026-07-05 — 적대적 테스트(최근 변경·주요 기능·렉) — 3건 수리 + 렉 각도 검증

- 범위: 텔레그래프 전환/경고벽·서브퀘스트(E키·파티 공유)·마법봉 스플래시·일리아 사망 이탈 + 렉 유발 관점.
- **수리 1 — cone 텔레그래프 시각≠판정 (+90° 어긋남, 중대)**: Circle/RingGeometry 는 XY 평면(θ: +X→+Y) 기준이라 바닥 회전(rotation.x=−90°) 후 방위각이 φ=θ+90° 가 된다. 판정(telegraphContains)은 φ=atan2(dx,dz) 기준 → **부채꼴이 실제 피격 영역에서 +90° 회전된 곳에 그려짐**(계산 실측 +1.571rad). 일리아 패턴 3곳(결계 끝까지 닿는 대형 브레스 포함)이 cone — "예고를 피했는데 맞는" 실질 원인. thetaStart 에 −π/2 보정. 어제 넣은 경고벽(Cylinder, φ=θ)은 정렬돼 있어 바닥과 벽이 서로 90° 어긋나 보이던 것도 함께 해소. **재발 방지: telegraph-test 에 '전 정점 방위각 ∈ 판정 호' 계산 테스트**(fill/edge/wall + line 회귀) — 시각과 히트박스를 수학으로 묶음.
- **수리 2 — 필드 텔레그래프 패널 중 폭발(불공정 ×2 피격)**: 인벤토리 등 패널 열림 = 이동 불가인데 오버월드 브레스/슬램 텔레그래프는 계속 진행·폭발했다(일리아는 타이머 시프트로 이미 해결된 정책 누락). updateTelegraphField 에 paused(경과분만큼 detonateAt 밀기) 추가, main 은 currentPanel!==null 전달. 닫은 직후 몰아치지 않음 — 테스트 추가.
- **수리 3 — 이장 보상 인벤 풀 시 증발**: claimSubquest 가 addItem 실패분을 버렸다(보상 번들 2~3종이라 위험 큼). 실패분은 발밑 드랍(spawnDroppedItem) + 안내 문구.
- 렉 각도 검증(수정 불요 확인): ① 텔레그래프 메시 — 스폰당 지오메트리 4~5개 생성/폭발·청소 시 dispose 대칭(traverse) 확인, per-frame 할당 0(hotpath 라쳇 그린), draw call +4~5/개·수명 ~1s·보스 쿨다운이 자연 상한. ② Codex 데미지 파티클 캡(700+budget) 합류 확인 — 요새 도약 프리징 재발 방어. ③ 파티 킬→syncSubquests 매 호출은 sig 캐시로 DOM 재렌더 없음. ④ 헤드리스 부팅 스모크(사무라이, 3.5s 루프) 치명 에러 0.
- 함정(재발 방지): 테스트 spec 에 필수 필드(r) 누락 시 RingGeometry 가 NaN 정점을 조용히 생성 — 정렬 테스트가 NaN 으로 실패해 잡았다. spec 리터럴은 타입 있는 소스에서 쓰거나 필드를 전부 채울 것.
- 관련 파일/검증: src/game/telegraph.ts · src/main.ts(paused 인자·보상 드랍) · scripts/telegraph-test.mjs(정렬·일시정지 테스트). 전 게이트·전 node 테스트·build·부팅 스모크 그린. 시각·성능 최종(visual/perf-check)은 PC 권장.

## 2026-07-05 — 텔레그래프 가독성 강화 (수직 경고 벽 + 밝기) — 근접/1인칭 회피 인지

- 요청: 사무라이(근접)로 불멸의 존재 싸울 때 바닥 붉은 원이 안 보여 못 피하고 죽음. 시전 중·범위를 명확히 인지해 피하게. 용들도 같으면 함께.
- 원인: 텔레그래프가 **바닥 평면(원/링/직선)**뿐이라 보스를 올려다보는 근접 시야에서는 발밑 원이 시야 밖. 공용 telegraph 엔진을 쓰는 일리아·불멸의 존재·모든 용/필드보스가 공통으로 겪음.
- 수정(telegraph 리프 1곳 → 전 보스/용 공통 적용):
  - **수직 경고 벽 추가**: 위험 경계를 따라 바닥에서 솟는 반투명 기둥(circle/ring=원통, cone=호 세그먼트, line=박스). 시전 진행도(progress)에 비례해 높이가 0→3.6까지 **자라올라** "시전 중"과 "범위"를 3D로 동시에 전달. 폭발 직전 명멸.
  - **바닥 가독성 강화**: fill 기본 불투명도 0.22→0.3, 테두리 링 두께 0.14→0.35·밝기 ↑, 펄스 불투명도 상향.
  - 무할당 유지(animateTelegraphMeshes 에 wall 파라미터 추가, scale.y·색·투명도만 변경) — check:hotpath 그린.
- 적용 범위: illiaBoss(아레나)·dragonAi(브레스)·predatorAi(슬램) 전부 telegraphMesh/animateTelegraphMeshes 공유라 자동 반영. main.ts 무변경.
- 검증: typecheck·telegraph-test(경고 벽 생성·솟음 assert 추가)·illia-test(동작 보존)·size/methods/hotpath/architecture 그린. build 성공. 시각 최종 확인(visual-check)은 Windows 전용이라 PC 권장.
- 관련 파일: src/game/telegraph.ts · src/game/illiaBoss.ts(Telegraph.wall 배선) · scripts/telegraph-test.mjs.

## 2026-07-05 — 마법봉 스플래시 범위 소폭 축소 + 스플래시 데미지 50%

- 요청: 마법봉 스플래시 범위를 소폭 줄이고, 스플래시 데미지는 50%만.
- 구현(leaf 데이터 + 배선 in-place): ① constants MAGIC_AOE_RADIUS 1.8→1.5(소폭). ② MAGIC_AOE_DAMAGE_FRACTION=0.5 신설. ③ main.ts 명중 처리 — 마법 투사체 착탄 시 applyAreaDamage 에 넘기는 스플래시 데미지를 projectile.damage → Math.max(1, round(projectile.damage×0.5)). 주 대상은 여전히 applyProjectileDamage 로 직격(풀뎀), 주변 추가타(excludeSet 로 주 대상 제외)만 50%.
- 검증: typecheck·size(줄 수 불변)·combat·content(MAGIC_AOE_RADIUS>0)·systems·balance 그린.
- 관련 파일: src/game/constants.ts · src/main.ts(마법 착탄 스플래시).

## 2026-07-05 — 파티 서브퀘스트 몬스터 처치 카운트 공유 수정

- 요청: 파티 플레이에서 이장 서브퀘스트 몬스터 처치 마리수 공유가 이상함(같은 맵인데 안 오르는 듯). 파티원이 잡은 것도 공유되고 내 것도 카운팅되게.
- 점검 결과(정확한 원인): 파티 공유 킬 콜백 `creditQuestKill`(main.ts initPartyPresence 컨텍스트)이 **누적 사냥 카운터(predatorKills)만 +1 하고 `syncSubquests("kill")`은 호출하지 않았다.** 이 콜백은 (a) 호스트가 게스트 막타를 처리하는 hostApplyGuestAttack, (b) 같은 맵 파티원 킬 브로드캐스트를 받는 onPartyKill(막타자·관전자 모두), (c) 호스트 자기 킬의 partyHostNotifyKill 브로드캐스트를 받는 게스트 — 세 경로에서 불린다. 그래서 튜토리얼 누적 마리수는 공유됐지만 **서브퀘스트 킬 진행만 공유가 빠져** "마리수가 안 오르는" 현상이 됐다. (솔로/호스트 자기 막타는 grantExperienceForTarget(creditQuest=true)에서 이미 syncSubquests("kill") 호출 → 정상이었음.)
- 수정: `creditQuestKill` 에 `this.syncSubquests("kill")` 추가(1줄, 기존 라인에 병합 — 줄 수 불변). 이제 내 막타·파티원 막타(같은 맵) 모두 내 서브퀘스트 몬스터 처치에 반영.
- 이중집계 없음 검증: 호스트는 자기 브로드캐스트를 수신하지 않으므로(자기 막타=grant 경로, 게스트 막타=hostApplyGuestAttack 경로) 각 킬당 정확히 +1. 솔로는 creditQuestKill 미호출(grant 경로만).
- 함정(재발 방지): initPartyPresence 컨텍스트는 **거대 단일 라인**이라 줄 끝에 `//` 주석을 붙이면 나머지 객체·닫는 `})`까지 통째로 주석 처리돼 파싱 폭발한다(실제로 1차 시도에서 발생). 이 라인엔 인라인 주석 금지 — 설명은 별도 위치에.
- 관련 파일/검증: src/main.ts(creditQuestKill) · verify 그린(줄 수·메서드 불변).

## 2026-07-05 — 이장 서브퀘스트 보상 E키 수령

- 요청: 마을 이장에게 말 걸고 퀘스트 보상 획득을 단축키(E)로 가능하게.
- 구현(배선 +1): ① 이장 interact() — 완료된 서브퀘스트가 있으면 대화창을 열지 않고 즉시 claimSubquest(E 한 번에 수령). ② KeyE 핸들러 — 이미 대화창이 열려 있고 완료 상태면 E 로 claimSubquest, 아니면 일반 interact. ③ subquestPanel(leaf) 문구에 "E키" 안내 + "🎁 보상 받기 (E)" 표기. 기존 클릭 버튼도 유지(공존).
- 흐름: 완료 상태로 이장에게 접근→E = 즉시 수령+새 오퍼 롤. 미완/미선택→E = 대화창(클릭으로 3택). 대화창 상태에서 진행 중 완료되면 E 로도 수령.
- 검증: typecheck·size(9444)·methods·hotpath·전체 node 테스트 그린. gameplay-systems-test 는 claim 버튼을 속성(data-subquest-claim)으로 검사하므로 문구 변경 무영향.
- 관련 파일: src/main.ts(interact 이장 분기·KeyE) · src/ui/subquestPanel.ts.

## 2026-07-05 — 오버월드 보스/용을 일리아식 텔레그래프(범위 예고) 패턴으로 전환

- 요청: 일리아 패턴 피하기가 마지막에만 나와 컨트롤 연습이 안 됨 → 모든 보스·용 스킬을 일리아처럼 바닥에 범위 표시되는 회피형으로. 맞으면 데미지 ↑.
- 확정 스코프(AskUserQuestion): **원거리/광역 시그니처 스킬만** 텔레그래프화(근접 접촉타 유지), 피격 데미지 **약 2배**.
- 설계: 일리아 전투에 갇혀 있던 텔레그래프 엔진을 공용 leaf `telegraph.ts` 로 추출(TelegraphSpec·telegraphMesh·telegraphContains·telegraphBurstPoint·disposeTelegraphGroup·animateTelegraphMeshes + 중앙 필드 매니저 createTelegraphField/spawnFieldTelegraph/updateTelegraphField/clearTelegraphField + TELEGRAPH_DAMAGE_MULT=2). illiaBoss 는 재-import(동작 보존 — illia-test 그대로 통과, telegraphContains 재노출로 호환).
- 적용:
  - **용 브레스**(dragonAi): 은밀한 지연착탄(620ms·메시지) → 착탄점 고정 + 바닥 붉은 원 텔레그래프(900ms) + 원 밖이면 회피. 데미지 ×2. 발톱(근접 즉시타)은 스코프대로 유지.
  - **필드 보스 슬램**(predatorAi): 시전 위치 고정 + 범위 원(900ms). 데미지 1.8×→×2(=3.6× 기본공격). 근접 도약 접촉타 유지. slamAt 플래그 제거(쿨다운이 재시전 차단).
  - 요새 보스(caveMonsters)는 지연 스킬 없이 근접 접촉타뿐 → 스코프상 미변경.
- 아키텍처: 오버월드 보스/용은 main 소유 단일 `overworldTelegraphs` 필드 공유(일리아는 IlliaFightState 자체 관리). main 배선 +4(필드·vfx·컨텍스트 spawnTelegraph×2·update 호출·맵전환 clear). 로직·시각·판정은 전부 leaf. 모드 이탈 시 update 가드가 자동 청소, 맵 전환은 clearWorld 직후 명시 clear → 보스 사망/이동 중 잔재·오펀 없음.
- 검증: typecheck·check:size(9443)·methods·architecture·hotpath(할당 카운트 불변)·admin + 전체 node 테스트 그린. 신규 telegraph-test(필드 수명주기·판정 기하·청소·데미지배수) 추가, illia-test 동작보존 통과. 프로덕션 build 성공. 헤드리스 부팅 스모크: gameStarted=true·필드 존재·치명 에러 0.
- 미검증/다음: 라이브 용 텔레그래프 발생→회피/피격까지의 E2E 는 디버그 스폰 훅이 없어 스크립트화 못 함(로직은 telegraph-test·illia-test 로 커버). save-roundtrip·visual-check·perf-check 는 Windows 전용이라 이 컨테이너 미실행 — 사용자 PC 권장. 텔레그래프 메시가 draw call 을 늘리므로 perf-check 를 PC 에서 확인 권장(보스 소수·단명이라 영향 경미 예상).
- 관련 파일: src/game/telegraph.ts(신규) · illiaBoss.ts · dragonAi.ts · predatorAi.ts · main.ts · scripts/telegraph-test.mjs(신규) · package.json.

## 2026-07-04 — 엔딩 크레딧/피날레 최종 보스명 정정 (불멸의 존재 → 절망의 군주 일리아)

- 요청: 일리아를 깨고 나오는 엔딩 크레딧 자막에 일리아 도입 이전의 옛 최종 보스명 '불멸의 존재'가 나옴 → 정정.
- 배경: 진 최종 보스가 일리아로 바뀌면서(불멸의 존재는 이제 차원의 문을 여는 마지막 챕터/용 보스), 피날레(startFinale)는 오직 일리아 P2 격파 시에만 트리거되는데 자막이 옛 이름 그대로였음.
- 수정(전부 leaf, main.ts 무변경): ① `finale.ts` 토벌 메시지 "불멸의 존재 토벌" → "절망의 군주 일리아 토벌" + 파일 헤더 주석. ② `endingScreen.ts` 타이틀 "🎆 불멸의 존재 토벌 🎆" → "절망의 군주 일리아", 크레딧 "최종 보스: 절망의 군주 일리아" 로 교체하고 불멸의 존재는 "차원의 문 관문"으로 재분류(실제 보스라 삭제 대신 보존). ③ `objectives.ts` final_complete 카드 "불멸의 존재를 쓰러뜨렸습니다" → "모든 여정을 완료했습니다"(디테일에 일리아 명시).
- 남긴 것: monsters.ts 의 immortal 보스 정의·objectives 의 immortal 처치 퀘스트는 그대로(불멸의 존재는 여전히 게임 내 실존 보스).
- 관련 파일/검증: src/game/finale.ts · src/ui/endingScreen.ts · src/objectives.ts · verify 그린(main.ts 무변경, 9439 유지).

## 2026-07-04 — 일리아 사망 = 무조건 차원 밖 이탈로 변경 (제자리 재시작 폐지)

- 요청(설계 확정): 아이템 손실 없음·패턴 학습형 재도전 컨셉은 유지하되, **차원 안 제자리 재시작은 의도와 다름.** 죽으면 무조건 차원 밖으로 밀려나 유저가 차원의 문에 다시 들어가(재진입) 재도전하도록.
- 변경: `damagePlayer` 사망 분기를 `illiaFight.active || illiaInArena` 단일 조건으로 통합 → `leaveCave()` 호출(illiaFight 리셋·보스/졸개 제거·illiaInArena 해제·문 앞 caveReturnPosition 이동·오버월드 복귀)로 정리하고, 체력/배고픔 회복 + 아이템 미손실 유지 + "차원의 문에 다시 들어가 재도전" 안내. 직전 커밋에서 일반 핸들러에 넣었던 `wasInIllia` 경로는 이제 도달 불가(죽은 코드)라 제거 → 순 −5줄(9444→9439).
- 재도전 페이즈는 illiaProgress 로 자연 결정: P1 사망 시 progress 0 유지 → 재진입 시 P1(각성 컷씬은 illiaAwakenSeen 로 1회만), P2 사망 시 progress 1 → 재진입 시 P2 즉시 개전.
- 다음 작업자: 보스 오브젝트는 spawnIlliaBoss 가 caveObjectIds 에 등록하므로 clearCaveObjects(=leaveCave 내부)가 확실히 제거한다. 별도 removeObject 루프 불필요.
- 관련 파일/검증: src/main.ts(damagePlayer 사망 분기) · verify 그린(9439).

## 2026-07-04 — 일리아 차원 사망 처리 점검·수정 (illiaInArena 누수 + 이탈 메시지)

- 시도: 사용자 보고 2건 점검 — ① 일리아 전투 사망 시 차원 밖 이동에 메시지가 없어 어색, ② 봉인된 일리아(P1)에서 죽은 것 같은데 밖으로 안 나가고 양쪽 풀피로 재시작된 적이 있음(버그인지 정확히 점검).
- 점검 결과(정밀):
  - **②는 버그 아님 — 의도된 설계.** `updateIlliaFight` 는 `illiaFight.active===true` 일 때만 `applyPlayerHit`(→damagePlayer)을 호출하므로, 보스 피해로 인한 사망은 **항상** `damagePlayer` 의 `illiaFight.active` 분기를 타 **제자리 풀피 재대결**(아이템 미손실, 결계 입구 부활, 보스 리셋)로 처리된다. 주석·코드가 일치. 사용자가 본 "풀피 재시작"이 정상 동작.
  - **①은 실제 잠복 버그였음.** `illiaFight.active===false` 인데 차원 안에서 죽는 경우(P2 승리 후 배회 중 굶주림/추락 등)는 일반 사망 핸들러(main.ts ~5615 cave 블록)를 타는데, 여기서 `illiaInArena` 를 리셋하지 않았다 → 오버월드로 밀려났는데 플래그가 true 로 남아 `flushAutosave`/`saveGame` 이 "일리아 차원에서는 저장 불가"로 **저장을 영구 차단**. 이탈 안내 메시지도 없어 갑작스러운 장면 전환이 어색.
- 수정:
  - 일반 핸들러 cave 블록에 `wasInIllia` 감지 → `illiaInArena=false` + `resetIlliaFight` + 컷씬 잔재 해제(leaveCave 정리 미러). 상태 누수 종결.
  - 차원 이탈 시 "🌌 일리아의 차원에서 쓰러져 문 밖 세계로 밀려났습니다." 명시.
  - 제자리 재대결(②) 메시지도 "차원 밖으로 나가지 않고 결계 입구에서 즉시 재대결(양쪽 체력 회복)"로 명확화 — 텔레포트가 침묵처럼 느껴지지 않게.
- 다음 작업자: 차원/아레나류 플래그(illiaInArena·fortressSiege)는 **모든** 이탈 경로(정상 퇴장·승리·사망·파티 소환)에서 반드시 리셋돼야 한다. 일반 사망 핸들러는 fortressSiege 는 illiaFight.active 상단 분기로, illia 아레나는 이 수정으로 커버. 새 특수 지역 추가 시 사망 핸들러의 cave 블록 정리 목록 갱신 필수.
- 관련 파일/검증: src/main.ts(damagePlayer 사망 분기) · verify 그린(9444).

## 2026-07-04 — 차원의 문 개방 트레일러(불멸의 존재 처치 → 10초 컷씬)

- 시도: 불멸의 존재(최종 챕터) 처치 시 차원의 문이 열리는 ~10초 트레일러 컷씬 추가.
- 결과: 기존 일리아 컷씬 시퀀서에 3번째 종류 `gateOpen` 추가로 구현 — 레터박스·스킵(Space/클릭)·이동 정지·카메라 보호가 `illiaCutscene.active` 기준이라 전부 무료 상속. verify 그린(9441, +1 = 컷씬 무적 가드).
- 구현:
  - `illiaVisuals.ts`(리프): `animateGateOpening(root,t)` — 지반 융기→부유석 수렴·링 형성(1.6~6s)→6s 점화(팽창+광량 스파이크)→안정. 스케일·광량·위치만 변형(공유 머티리얼 불변, 할당 0). `resetGateVisual` — 종료/스킵 시 평시 복구(부유석 정위치는 userData 1회 메모).
  - `illiaBoss.ts`(리프): `IlliaCutsceneState.anchor`(월드 소유 오브젝트 참조 — props 와 달리 종료 시 씬에서 제거하지 않고 복구만). gateOpen 카메라 타임라인(하이앵글 원경→반원 아크 접근→점화 반동→로우앵글→풀백) + 사운드 스텝.
  - `main.ts`(배선): 처치 훅(오버월드+게이트 존재 시 트레일러, 아니면 기존 안내 메시지 폴백)·onFinish gateOpen 분기·평시 `animateIlliaProps` 에서 anchor 게이트 제외(안 하면 매 프레임 컷씬 변형을 덮어씀)·수동 정리 2지점 anchor 해제·**컷씬 중 damagePlayer 무적 가드**(+1줄 — 오버월드 컷씬은 몬스터가 살아 있어 카메라 강탈 중 사망화면 진입 사고 방지).
- 주의(다음 작업자): ① 월드 소유 오브젝트를 컷씬에 쓸 땐 props 가 아니라 anchor 로 — props 는 finish 에서 scene.remove 된다. ② 평시 애니메이터(animateIlliaProps 류)와 컷씬 애니메이터가 같은 오브젝트를 만지면 update 루프 순서상 평시가 이긴다 — 반드시 평시 쪽에서 제외.
- 관련 파일/검증: src/game/illiaBoss.ts · src/game/illiaVisuals.ts · src/main.ts · scripts/illia-test.mjs(gateOpen 완주/스킵/복구 테스트 추가).

## 2026-07-04 — 메인퀘스트 '이장 서브퀘스트 받기' + 서브퀘스트 종류 확장 + 보상 밸런스 정밀화

- 시도: (a) 메인퀘스트에 "마을 이장에게서 서브퀘스트 받기" 추가, (b) 이장 서브퀘스트 종류 다양화(제작템 납품·동굴/요새 입장·용 사냥 등), (c) 보상 템 다양화 + 퀘스트 난이도별 보상 정밀 밸런스.
- 결과: verify 그린(check:size 9434→9438 배선 실측 재기준, check:methods 482 불변 — 새 메서드 0). 신규 kind/보상/밸런스 테스트를 gameplay-systems-test 에 추가(craft 제출·enterCave/fortress/dragon bump 완료·용>사냥>보급 경험치 순).
- 구현:
  - `game/subquests.ts`(리프): SubquestKind 에 craft/enterCave/enterFortress/dragon 4종 추가(총 9종). 보상 공식을 `BASE_XP[rarity] × KIND_DIFFICULTY[kind]` + `REWARD_ITEM_POOLS[rarity]` 번들(난이도 계수로 수량 스케일)로 재설계 — 희귀도×종류 두 축 차등. KIND_DIFFICULTY: supply 0.9 · enterCave 0.8 · kill 1.0 · chest 1.15 · enterFortress 1.3 · gather 1.6(제출) · craft 2.0(제작) · caveBoss 2.2 · dragon 3.0. craft 는 제출형(보유 폴링 + subquestSubmission 소비)으로 gather 와 동일 처리(isSubmissionKind 헬퍼).
  - `objectives.ts`(리프): ObjectiveSnapshot 에 subquestAccepted 추가. 메인퀘스트 스텝 accept_subquest(available: level≥SUBQUEST_MIN_LEVEL, completed: subquestAccepted) 를 fortress 탐방 다음·1차 전직 앞에 삽입.
  - `main.ts`(배선만 +4): enterCave/enterFortressSiege/dragon-kill 에 syncSubquests 훅 3 + currentObjectiveView 스냅샷에 subquestAccepted 신호 1. 로직·데이터·UI 는 전부 리프.
- 이유/다음 판단: save-roundtrip E2E 는 이 컨테이너에서 Firebase RTDB WebSocket 이 프록시(ERR_TUNNEL_CONNECTION_FAILED)로 막혀 browserErrors 어서션만 실패 — 세이브 형태 비교 자체는 통과. 로컬 PC(사용자)에서만 완전 그린. SubquestState 형태 불변이라 세이브 마이그레이션 영향 없음.
- 관련 파일/검증: src/game/subquests.ts · src/objectives.ts · src/main.ts · scripts/gameplay-systems-test.mjs · scripts/content-test.mjs · scripts/check-main-size.mjs.

## 2026-07-03 — 날카로운 흑요석 방패 내구도 1000·수리 +300 조정

- 요청: 최대 내구도 1000, 수리 1회 +300.
- 구현: SHIELD_DURABILITY.sharp_obsidian_shield 300→1000. repairPerMaterial 은 기본 50% 공식이라 1000×0.5=500이 되므로, REPAIR_PER_MATERIAL_OVERRIDE(sharp_obsidian_shield:300) 추가해 고정 +300(재료 4개로 완전회복). 방패 레시피 note "피격 300회"→"1000회(수리 가능)".
- 검증: verify 그린. content-test 방패 수리 불변식을 '2개로 완전회복'→'5개 이내 완전회복'으로 완화(1000/300=4). E2E: 카드 "내구도 300/1000 · 수리 1회 +300", 수리 시 사용 700→400(+300 회복)·재료 1 소모.

## 2026-07-03 — 방패도 수리 가능(날카로운 흑요석 방패·철 방패)

- 요청: 날카로운 흑요석 방패도 수리 가능하도록.
- 진단: 방패는 도구 테이블(DURABLE_TOOL_TABLES) 밖 + 장착형(equippedShield·shieldDurabilityUsed)이라 기존 수리(인벤 슬롯 도구)에 안 잡혀 수리 불가·닳으면 파괴만 됐음.
- 구현: ①items.ts — repairMaterialFor 가 방패(SHIELD_DURABILITY 보유)면 SHIELD_REPAIR_MATERIAL(iron→제련철, sharp_obsidian_shield→날카로운 흑요석) 반환, toolMaxDurability 가 SHIELD_DURABILITY 반영. ②main.ts — 수리 패널 repairSlots 에 착용 방패(닳았을 때) 추가 + onRepair 라우팅 + repairEquippedShield(shieldDurabilityUsed 를 재료당 50% 회복). ratchet 10211→10220.
- 검증: typecheck·build·verify 그린. content-test 방패 수리 불변식 단언 추가(재료 유효·최대내구도 일치·2개로 완전회복·흑요석방패→sharp_obsidian). E2E: 착용 흑요석방패(50/300) 수리→내구도 사용 250→100(+150)·재료 5→4, 재료 없으면 버튼 disabled. repair-system.md P2 완료 표기.

## 2026-06-28 — 검색/채팅 중 한글 입력이 단축키를 발동시키던 회귀 수정 (f403d21 되돌림)

- 신고: 제작대에서 '용의' 검색 시 지도(m)가 열림. 채팅·검색 중 단축키가 먹으면 안 됨.
- 원인(내 회귀): 직전 f403d21 에서 '검색창 포커스 중 I/K/M/B 는 단축키로 동작'하게 했는데, 한글 두벌식은 M=ㅡ, I=ㅑ, K=ㅏ, B=ㅠ. "용의"의 '의'(ㅇ+ㅡ+ㅣ)의 ㅡ가 물리 M 키 → 지도 열림. 키 탈취가 잘못된 접근이었음.
- 수정: 입력창(input/textarea) 포커스 또는 IME 조합(event.isComposing) 중이면 게임 단축키를 무조건 차단(원복). 포커스 갇힘 탈출은 f403d21 에서 넣은 '게임 화면 클릭 시 입력 blur' + ESC 로 유지(이 escape hatch 는 그대로 둠).
- 검증: typecheck·build·verify 그린. E2E: 제작대/인벤 검색 포커스 중 m/i/k/b → 패널 불변·검색창에 입력만("mikb"), blur 후 m → 지도 정상. Codex 커밋(boss·hotpath) 위에 클린 적용.

## 2026-06-28 — 단축키(i/k/m) 안 먹는 트랩 수정 (레시피 검색창 포커스)

- 신고: "단축키가 또 안 먹음. i,k,m 아무것도 안먹음."
- 재현(E2E, 실제 키보드): 인벤토리 레시피 검색창(data-recipe-search)에 포커스가 남은 상태에서 i 누르면 "철i"처럼 검색창에 타이핑되고 패널 토글이 안 됨(handleKeyDown line 2170: input 포커스면 early-return). 검색창에 포커스가 있는 줄 모르고 단축키를 눌러 '안 먹던' 트랩.
- 수정: ①레시피 검색창(data-recipe-search/data-wb-recipe-search) 포커스 중 탐색 단축키 I/K/M/B 는 검색창을 blur 하고 그대로 토글 동작(검색은 한글 위주라 i/k/m/b 입력 손실 미미). ②게임 화면 클릭 시 활성 입력 포커스 해제(채팅 등 영속 입력 트랩 escape hatch). main.ts +6 → ratchet 10178.
- 검증: typecheck·build·verify 그린. E2E: 검색 포커스 중 i→인벤 닫힘·k→캐릭터·m→지도 정상, 한글 검색("다이아")은 그대로 동작.

## 2026-06-28 — 일반 몬스터 처치 경험치 +15% 일괄 상향

- 요청: 일반 몬스터들이 주는 경험치 ~15% 일괄 상향.
- 구현(monsters.ts predatorExperienceReward, 리프): NORMAL_MONSTER_XP_MULT=1.15 을 모든 포식자 경험치에 적용(거미 18→21·늑대 45→52·사자 60→69, 변종/고레벨 level×3×고레벨배수×1.15). 보스(dragon)·동물·잼미니·마을가드는 experienceRewardForTarget 에서 별도 처리되어 대상 아님.
- 검증: typecheck·build·verify 그린. content-test 회귀 단언 추가(거미21·늑대52·사자69·Lv10=35·용500불변·닭4불변).

## 2026-06-28 — 집 보급상자: 나무·돌 제외 + 영웅(에픽)등급+ 보너스

- 요청: 직접 지은 집 보급상자에서 나무·돌은 빼고, 영웅등급(에픽) 이상 아이템·재료를 낮은 확률로 추가.
- 구현(homeBase.ts rollHomeSupply, 리프): ①base loot 에서 wood·stone 제거. ②EPIC_PLUS_SUPPLY 가중 풀 + pickEpicPlusSupply 추가, tier≥1 에서 15% 확률로 1개. 가중=에픽 재료(흑요석·날카로운흑요석·분말·용꼬리) 많음 > 에픽 장비(흑요석검/단검·아케인스태프·고급구급·용뿔) 중간 > 레전더리(날카로운흑요석 3종·경험치병·정령권) 드묾. 진행 그라인드(전직/4차 각서·용 장비 완성품)는 직접지급 제외(용 재료로 제작 유도). cap(6, 등급우선)에서 고등급이라 보존.
- 검증: typecheck·build·verify 그린(content-test 실존검증 + gameplay-systems 골든값 유지). 신규 단언 2건(나무·돌 없음·행운롤 에픽+ 추가). 분포 5000회: tier1 영웅+보너스 15.3%·나무돌 0회·가중분포 설계대로.

## 2026-06-28 — 세이브 용량 초과로 옛 저장 떨굼(공간 부족) 근본 수정

- 신고(스샷): "저장 완료 … ⚠ 공간 부족으로 '…','…','…' 저장 보관 못함." = localStorage quota 초과 시 정상 graceful trim. 근본원인=세이브가 너무 큼.
- 측정(E2E): 6맵 방문 raw 2.3MB, worldStates 84%. 맵당 ~1550 절차 오브젝트(나무 63%·야생 19%). 절차생성이 Math.random 비결정적이라 재시드 동일복원 불가(워크플로 확인).
- 수정(안전·무회귀): ①나무 압축저장 — spawnTree(type,position)가 재구성하는 타입유래 필드 전부 생략, 복원부 `?? object.X` 폴백(구세이브 호환, SavedObject.name optional). ②toSavedVector 위치 2자리 반올림. → 세이브 44%↓(raw 2346→1318KB, 압축 185KB). ③사본수 축소 MAX_SAVE_SLOTS 20→12·SAVE_HISTORY_PER_NICKNAME 15→8(20 상향이 quota 가중).
- 파일: saveManager.ts·main.ts(복원 가드)·types.ts·constants.ts·gameplay-systems-test(history cap 상수화)·save-system-history.md.
- 검증: verify 그린. E2E 라운드트립 — 나무 `{type,position}` 압축저장→로드 후 collidable·collisionRadius·name 정상(914그루).

## 2026-06-28 — 용 장비 그리드 제작 시 선택과 다른 게 만들어지던 버그

- 신고: "용의 장갑을 만들었는데 용의 왕관이 만들어짐. 선택한 거랑 다른 게 제작됨."
- 재현(E2E): 용 장비 4종(장갑·부츠·망토·왕관)은 재료가 동일(용뿔1+꼬리3+비늘6). "재료 넣기"로 왕관을 골라 그리드에 채워도 결과 미리보기·실제 제작이 모두 gloves. 원인: `workbenchRecipeFromSlots`가 그리드 재료로 레시피 매칭 시 `.find`로 첫 매칭(목록 첫 용장비=gloves)만 반환 → 부츠/망토/왕관을 그리드로 못 만들고 항상 gloves. ("바로 제작"은 id 직접 제작이라 정상.)
- 수정: '재료 넣기'로 고른 레시피 id를 `pendingGridRecipeId`에 기록, `workbenchRecipeFromSlots`가 재료 같은 매칭들 중 의도 레시피를 우선 반환. 수동 슬롯 편집·비우기 시 해제. main.ts +5 → ratchet 10172.
- 검증: typecheck·build·verify 그린. E2E: 4종 모두 재료넣기+제작·바로제작 양 경로에서 선택대로 제작(종전 전부 gloves → 각자 정상).

## 2026-06-28 — 세이브 슬롯 위치 혼선·잘못 덮어쓰기 유실 근본원인 수정

- 신고: "저장슬롯 위치가 이상하고 다른 저장이 자꾸 사라진다." 정본 이력(docs/save-system-history.md) 정독 + 병렬 분석 워크플로(쓰기경로·표시불일치·전역풀·UI위치) + MemoryStorage 재현으로 근본원인 확정.
- 닉네임 영구 단일(변경 불가) → §4 전역풀(다닉네임)은 원인 아님. 단일 닉네임 사용자의 실제 근본원인 2건(재현 완료):
  - ★picker↔로드패널 순서 불일치: 로드 패널=readSaveSlots(savedAt desc) vs 덮어쓰기 picker·가득판정=readStoredSlotList(배열 삽입순). 덮어쓰기는 in-place 교체(배열 위치 유지·savedAt만 갱신)라 한 번 덮어쓰면 두 패널 "저장 N"이 어긋남 → picker에서 엉뚱한 슬롯 덮어써 유실. 재현: 덮어쓴 최신본이 picker '저장2' vs load '저장1'.
  - ★backfill 유령 오염: backfillSlotDescription이 병합본(latest/backup 유령 포함)을 allowTrim 기본 true로 SAVE_LIST에 써넣어, 패널 조회만으로 유령 오염/trim 유실. 재현: 조회 후 SAVE_LIST에 latest-save 유령 추가됨.
- 수정: ①readStoredSlotList도 savedAt desc 정렬(두 패널 번호 일치). ②backfillSlotDescription은 LIST만 읽어 해당 슬롯 description만 갱신+allowTrim:false. ③MAX_SAVE_SLOTS 10→20(덮어쓰기 강요 마찰↓).
- 파일: saveRepository.ts, main.ts(backfill 호출부), constants.ts, save-repository-test.mjs(회귀 2건+MAX_SAVE_SLOTS import), save-system-history.md(§3·§4).
- 검증: typecheck·build·verify(전체 세이브 테스트 포함) 그린. 회귀 테스트 2건 통과. 실브라우저 E2E: 3회 저장→로드패널·picker 순서 동일(desc)·최상단 일치·콘솔에러 0.

## 2026-06-27 — 보스 야간 "검은 네모박스" 시각 개선(필드보스 자체조명)

- 증상(사용자): 보스가 가끔 "검은 네모박스 + 주황 원"으로 보임.
- 진단(병렬 조사+E2E 실측): 컬링 누수 아님(240칸 밖 root.visible=false면 전부 숨김, 누수 0 확인). 필드보스 본체는 어두운 emissive(#2f0c03)+자체 PointLight 0.6 뿐이라 밤·어두운 맵에서 새카만 블록 실루엣이 되고, 가산 합성 아우라 링(주황)·발광 룬/눈만 도드라져 "검은 네모박스+원"으로 보임. (용은 emissive 발광재질+1.3 글로우라 이 문제 없음 → 사용자도 용은 미지적)
- 수정: 필드보스 regalia 자체조명 0.6→1.3(범위↑)로 용과 동등화 — 밤에도 본체가 보이게. 바닥 아우라 가산 opacity 0.4→0.3으로 "타게팅 원" 인상 완화. (bossArmorVisuals.ts, 리프)
- 검증: typecheck·build·verify 그린. E2E 스크린샷(HUD 숨김): 밤=보스가 붉은 형체로 또렷(종전 새카만 박스→해소), 낮=정상 갈색 멧돼지(태양광 우세라 과조명 없음).

## 2026-06-27 — 보스 리시(leash): 추격 포기 후 스폰 홈으로 복귀

- 증상(사용자): 보스가 추격해오다 멀리 도망가면 추격을 멈추고, 원위치로 돌아가지도(리스폰) 않고 그 자리에 방치됨.
- 진단: predatorAi/dragonAi 모두 어그로가 풀리면 제자리 배회(0.28x)만 함. WorldObject.homePosition 필드는 있으나 NPC 전용이고 보스엔 미설정·미활용. 복귀 로직 전무(병렬 조사 워크플로 4갈래로 확인).
- 수정: ①보스 스폰 시 homePosition 설정 — 필드보스(fieldBosses.applyFieldBossDefinition, 세이브 제외라 항상 fresh)·용(entitySpawns.spawnDragon, saveManager 라운드트립). ②predatorAi: 어그로 풀린 보스가 홈 반경(BOSS_LEASH_RADIUS=6) 밖이면 홈으로 복귀(0.7x). ③dragonAi: 추격 종료 시 홈 반경(8) 밖이면 복귀 비행(0.7x). ④main 복원 시 스폰 홈 보존(구 세이브 대비). 어그로(추격) 경로는 불변 — 회귀 없음.
- 검증: typecheck·build·verify 그린. E2E: 보스를 홈에서 40칸 이격·비어그로화→40→[31,20,7]→7칸 복귀 확인. 추격도 정상(13→8 접근, 이후는 레벨1 플레이어 사망·원거리 리스폰).

## 2026-06-27 — 2차 전직 퀘스트 레벨 40+ 게이트

- 요청: "2차 전직 달성" 퀘스트는 최소 40레벨 이후에 나타나도록.
- 진단: 퀘스트는 currentObjective 가 TUTORIAL_STEPS 에서 "첫 미완료 단계"를 순서대로 노출. advance_job_tier2 는 1차 전직(Lv30) 직후 바로 떠서 2차 전직 가능 레벨(50)까지 한참 전부터 노출되던 문제.
- 구현: TutorialStep 에 선택적 노출 게이트 available?(snapshot) 추가 → currentObjective 의 next 선택에서 미충족 단계는 건너뜀(조건 열리면 순서상 제자리 재노출). advance_job_tier2 에 available:(s)=>s.level>=40 부여. Lv<40 에선 건너뛰어 다음 퀘스트(누적 사냥 등)가, Lv40+ 부터 2차 전직 퀘스트가 노출.
- 마이그레이션 불필요(레벨로 매 프레임 계산). jobTier2 는 Lv50 필요라 "완료됐는데 숨김" 상태 불가.
- 검증: typecheck·build·verify 그린. content-test 에 게이트 술어(39 숨김/40 노출) + 실제 currentObjective 통합(직전 단계·필드보스 완료 스냅샷으로 39→비노출/40→노출) 영구 단언 추가.

## 2026-06-27 — 온보딩 코치 배너가 스킬바를 가리던 문제(위로 띄움)

- 증상(사용자): "다음 할 일" 튜토리얼 배너가 하단 스킬바/핫바를 가림.
- 진단(E2E 실측): .coach-beacon bottom 104px → 핫바 상단(~91px)과 레이아웃 간격 13px뿐. 게다가 배너 드롭섀도(0 6px 22px ≈ 28px 아래로 번짐)가 핫바 상단을 ~15px 덮어 "가림"으로 보임.
- 수정: .coach-beacon bottom 104px → 128px(style.css). 박스+섀도가 스킬바/핫바를 안 덮게.
- 검증: build 그린. E2E: 간격 13→37px, 섀도가 핫바 상단 9px 위에서 끝남. 스크린샷으로 배너가 스킬·핫바 위로 분리됨 확인. 모바일(max-width 760px) 분기는 이미 bottom 150px라 무관.

## 2026-06-27 — 용 전리품 상점/판매소 일원화 (교환 → 구매+판매)

- 요청: 마을상점은 다 "구매"인데 용 전리품만 "판매(교환)"라 헷갈림. 교환을 판매소로 옮기고, 상점에선 구매 가능하게. 가격은 판매:구매 단가 비율 맞춰서.
- 설계: 기존 자동 파생 구조(BUY_DERIVED_SELL_OFFERS = POINT_SHOP_OFFERS 에서 판매가 = 구매가×SELL_SHOP_RATE 0.4165 파생) 활용. 용 전리품을 POINT_SHOP_OFFERS 에 구매 항목으로 추가하면 → 상점 구매 + 판매소 판매가 자동 일원화. 구매가 = 종전 교환가 ÷ rate 로 역산해 판매가가 4000/5000/10000P(종전 교환가) 그대로 보존되게 책정.
- 가격: 용의 비늘 구매 9700P/판매 4000P, 용의 꼬리 12100P/5000P, 용의 뿔 24100P/10000P (비율 0.41~0.42, floor 반올림이라 표준율 이하).
- 변경: trading.ts(POINT_SHOP_OFFERS 에 dragon_*_buy 3종 추가, SELL_BLOCKLIST 에서 용 소재 3종 제거·dragon_spawn 유지, POINT_EXCHANGE_OFFERS 폐지), main.ts(교환 섹션·바인딩·exchangeDragonLootForPoints·import 제거, 상점 안내문구 수정), content-test(용 전리품 구매+판매 양쪽 존재 & 비율 불변 단언). ratchet 10205→10168(순 -37).
- 검증: typecheck·build·verify 그린. E2E: 상점 교환버튼 0개·용비늘 9700P 구매(보유 0→1)·판매소 4000P 판매(1→0)·비율 0.412. 적대적 검증 워크플로(잔존참조·회귀·엣지) 통과.

## 2026-06-27 — 마을 판매소 다량 판매(수량 스테퍼)

- 요청: 판매소에서 다량을 한 번에 팔 수 있게 +/- 로 수량 세팅.
- 구현: 각 판매 카드에 .qty-stepper(−/＋/전체) 추가 — 제작대·제련대와 동일 패턴. 상한=보유량(data-qty-max), "전체" 버튼=한 번에 전량. 판매 버튼이 스테퍼 값을 읽어 sellToVillageShop(offerId, qty) 로 일괄 판매(보유량으로 상한, 포인트=단가×수량, materialsSold += 수량).
- 파일: main.ts(renderSellShopPanel 카드/바인딩, sellToVillageShop qty 인자), style.css(.qty-all-btn). ratchet 10201→10205(+4).
- 검증: typecheck·build·verify 그린. E2E: 보유 30 → ＋＋=3 → 전체=30 → 판매 1클릭 → 나무 0개·+210P(7P×30). 스크린샷으로 스테퍼 UI 확인.

## 2026-06-27 — 용 리스폰 10분 쿨다운이 재접속 시 사라지던 버그 수정

- 증상(사용자): 용 스폰이 10분보다 자주 느껴짐. 저장하고 나갔다 들어오면/맵이동하면 스폰되는지 의심.
- 진단: DRAGON_RESPAWN_MS=10분은 정상. 그러나 dragonRespawnAt 은 ①절대 performance.now() 타임스탬프(페이지 reload 시 0으로 리셋) ②런타임 Map(세이브 미포함). → 용 처치 후 저장·재접속(reload)하면 쿨다운이 사라져 ensureChapterBoss 가 즉시 재스폰. (맵이동은 같은 세션이라 performance.now 유지 → 정상)
- 수정: homeSupplyCooldowns 패턴 모사 — 남은 쿨타임(ms)을 세이브에 영속. 스냅샷에서 dragonRespawnAt Map→남은ms Record 변환 저장, 로드 시 performance.now()+남은ms 로 Map 복원. 스키마(types·saveManager)·migration(normalizeDragonCooldowns, 600000ms 상한)·main 스냅샷/복원 배선.
- 검증: typecheck·build·verify 그린. E2E: 10분 쿨다운 세팅→저장(savedCd 600000)→Map클리어(respawnReady=true=버그)→로드→복원(남은 597초·respawnReady=false). 구세이브는 필드 없음→정상(쿨다운 없이 시작).

## 2026-06-27 — 집 보급 충전 시간 30분 → 20분

- 요청: 집 보급 충전 시간 20분으로.
- 수정: HOME_SUPPLY_COOLDOWN_SECONDS 1800→1200(homeBase.ts). 하드코딩 안내문구("다음 보급은 30분 뒤!" ×2)는 `${Math.round(HOME_SUPPLY_COOLDOWN_SECONDS/60)}분`으로 상수 파생화(드리프트 방지). housing 혜택 주석 30→20분.
- 회귀 수정: gameplay-systems-test(쿨다운===1800→1200), save-migration-test(클램프 max 1800→1200) 갱신. 구세이브의 1200 초과 쿨다운은 로드 시 1200으로 클램프됨(migration).
- 검증: typecheck·build·verify 전부 그린.

## 2026-06-27 — 판매소 등급별 다양한 아이템 판매 + 정령소환 포인터락 자동해제

- ①판매소 확대: 종전 SELL_SHOP_OFFERS 가 구매상점(POINT_SHOP) 파생이라 소수만 판매 가능. trading.ts 에 등급별 매입가(SELL_POINTS_BY_TIER 일반6/고급90/희귀450/에픽1100/레전3000/신화7000) + ITEM_TIER 전체+공용(가죽/구리갑옷·기본무기/도구/재료) 오퍼 생성, 기존 가치기반 오퍼와 병합(중복 제거). 전직/진행·용 소재(전용 교환)는 블록. 판매소 패널은 보유분만 비싼순 정렬 표시.
- ②정령소환 마우스: 가챠 연출 중 포인터락이 걸려 있어 ESC 안 누르면 커서가 안 보이던 문제. openSpiritGacha 에서 runSpiritGacha(active=true) 먼저 → closePanel(가챠 active 라 재잠금 게이트로 차단) → document.exitPointerLock. requestGamePointerLock 에 isGachaActive 게이트 추가.
- 검증: typecheck·build·verify·check:size(10193, 여유8). E2E: 판매소에 마법봉90·가죽갑옷6·흑요석갑옷1100 등 등급가 표시(보유분만), 가챠 시 exitPointerLock 호출·pointerLocked=false.

## 2026-06-27 — 사망 안내 강화 + 내구도≤3 경고 + ESC 로 모든 팝업 닫기

3건 일괄.
- ①사망 인지: 사망이 transient HUD 메시지로만 떠 잘 안 보이던 문제. ui/deathBanner.ts(리프) flashDeathBanner — 화면 중앙 큰 "💀 사망했습니다" + 사유 + 붉은 비네트 3.6초 페이드. main 사망 분기에서 호출 + 낮게 가라앉는 2음 사망효과음. (집 보유 시 부활위치 confirm 은 그대로)
- ②내구도≤3 알람: consumeDurability 에 remaining≤3 분기 추가 — "⚠️🔴 …내구도 3/10! 곧 부서집니다 — 즉시 수리" + 경고음. 기존 30%(≤8) 완만 경고는 4~8 구간 유지.
- ③ESC 팝업닫기: ESC 가 입력칸 포커스(인벤/제작대 검색) 중엔 입력 무시 게이트(2165)에 걸려 안 닫히던 게 원인(일반 패널은 원래 닫혔음). ESC+currentPanel≠null 이면 입력 blur 후 closePanel 을 게이트보다 먼저 처리.
- 검증: typecheck·build·verify·check:size(10201). E2E: ESC+input포커스→패널 null·내구도 메시지 "내구도 3/10! 곧 부서집니다"·사망배너 표시(스샷 육안). 채팅(currentPanel 무관) 미영향.

## 2026-06-27 — 동굴 입장 5회 만료 + N/5 안내 (10분과 별개)

- 요청: 동굴이 10분 외에 입장 5회로도 사라지게. 입장마다 "N/5" 안내. 파티 공유 여부는 합리적 판단.
- 결정(파티): **플레이어별 카운트**. 동굴 내부는 입장 시 로컬 생성되는 플레이어별 인스턴스 + 10분 만료도 클라이언트별이라, 입장 횟수도 플레이어별이 자연스럽고 메시징 불필요. 입구 제거는 호스트 권위(호스트 5회/10분 → 전원에서 사라짐), 게스트는 자기 5회 채우면 입장 게이트(synced 동굴=partyTransient 라 로컬 sweep 제외).
- 구현: WorldObject.entryCount + constants.CAVE_MAX_ENTRIES=5. enterCave 에서 게이트(>5 차단)·증가·N/5 안내(마지막 입장 강조)·5회째 expiresAt=now(기존 만료 sweep 가 제거, 호스트면 동기). 상호작용 프롬프트에 (N/5) 표기.
- 검증: typecheck·build·verify·check:size(10193). E2E: 입장 1→5 카운트 정확·6회째 차단(entered=false)·5회째 expiresAt≈now(-7ms)·만료 sweep 가 만료동굴 제거(틱 보장 폴링으로 확인). 구 동굴(저장본)은 entryCount 0 시작.

## 2026-06-27 — 세이브 슬롯에 난이도(쉬움/어려움) 표기

- 요청: 세이브 파일이 어려움/쉬움 모드인지 표기해 구분.
- 발견: 난이도는 이미 세이브에 저장됨(saveManager difficulty 필드, 로드 시 구세이브=쉬움 폴백). 표기만 누락.
- 수정(saveRepository.saveSummary 1곳): 요약 문자열 맨 앞에 `save.difficulty==="hard" ? "🔥 어려움" : "😊 쉬움"` 프리픽스. saveSummary 를 불러오기·덮어쓰기·백업이력·자동저장 패널이 공유 + 압축슬롯도 backfillSlotDescription→saveSummary(migrate) 라 전 슬롯에 일괄 노출.
- 검증: typecheck·build·verify·save 테스트 그린. E2E(어려움 새게임→저장→불러오기): 슬롯 요약 "🔥 어려움 · 전사 · Lv 1 …" 확인. main 무변경(리프).

## 2026-06-27 — 타이틀 화면 정리: 문구 제거·보유포인트 상단·좌측 짤림/세로스크롤 완화

- 요청: ①태그라인("마을·동굴·기차…") 제거 ②기능칩(3D 오픈월드·제작과 탐험) 제거 ③보유 포인트 상단으로 ④난이도·그래픽품질이 좌측에 붙어 짤려보임 → 여백 + 가급적 세로스크롤 X.
- 수정:
  - titleScreen.ts: 태그라인 `<p>` 제거. 키커 줄을 flex topbar 로 바꿔 보유 포인트(data-title-points)를 우상단 배치(중복이던 .title-meta 의 포인트는 그게 정본). .title-meta(3D 오픈월드/제작과 탐험/포인트) 블록 통째 제거.
  - style.css: **좌측 짤림 진짜 원인** = .class-select width:min(680px,92vw) 가 .title-menu(88vw) 콘텐츠폭을 넘어 가로 오버플로(overflow-y:auto→overflow-x:auto 클립). → class-select width:100%·max-width:680px·box-sizing:border-box 로 고정(narrow 700→669, 오버플로 0 확인). .title-menu 좌우 패딩 0/8→10/10(카드없는 섹션 여백). 세로 완화: h1 상한 126→104·여백 16→10, class-select 여백 18→12, class-card min-height 112→92·padding 10→8.
- 검증(E2E 실측): 가로 오버플로 0(narrow scrollW==clientW), 1280×800 에서 난이도+그래픽품질 모두 노출(qualityBottomVisible=true, overflowH 216→133). 태그라인/칩 제거·포인트 상단 스샷 확인. verify 그린. main 무변경(리프).

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

## 2026-06-26 — 정령 표시를 좌상단 DOM 뱃지 → 왼쪽 어깨 3D 동행체로 교체

- 사용자 의도 재확인(첨부 이미지): 정령은 소환수처럼 시야 안에 떠다니는 고퀄 3D 페어리(흰 몸+분홍 결정 날개+뿔+큰 눈)여야 함. 위치는 왼쪽 어깨(소환수=오른쪽 대칭), 크기는 소환수의 ~1/3.
- 직전 구현(좌상단 DOM 뱃지)은 오해였음 → 제거(spiritBadge.ts·CSS·renderHud 호출 삭제).
- 신규 game/spiritVisuals.ts(leaf 비주얼 팩토리): createSpiritCompanionModel(grade) — 통통한 흰 몸/큰 머리/큰 눈+하이라이트/유니콘 뿔/뾰족 귀/결정 꽃잎 날개(등급↑ 3~6장/측)/분홍 망토/발광 오라. 등급색 = spiritGradeDef. updateSpiritCompanion(매 프레임, 모듈 스크래치로 할당 0) — 왼쪽 어깨(ahead 2.0·side −1.15·rise 0.55)로 lerp 추종 + 날개 플랩 + 오라 맥동. scale 0.26(소환수 0.74의 ~1/3). disposeSpiritCompanion.
- main 배선: scene 에 직접 add(월드오브젝트 아님), 장착/등급 변할 때만 모델 재생성, 미장착/타이틀 시 제거+dispose. 신규 메서드 0(인라인+leaf).
- ⚠ 브라우저 부재로 visual-check 미실행 — 모델 외형·위치·크기는 실기기 확인 권장(필요 시 SPIRIT_AHEAD/SIDE/RISE/SCALE 상수로 조정).
- 관련: src/game/spiritVisuals.ts(신규), src/main.ts, src/ui/spiritBadge.ts(삭제), src/style.css.

## 2026-06-27 — 정령 소환권 최초 습득 시 소환·장착 퀘스트 자동 진행

- 요청: 정령 소환권을 처음 얻는 시점에 "정령 소환" + "정령 장착" 퀘스트가 진행되게 추가.
- 구현: objectives.ts `currentObjective` 에 시퀀스 밖 컨텍스트 인터럽트 2개 추가(eat_meat 와 동일 패턴, TUTORIAL_STEPS 외부).
  - `summon_spirit`: `countItem("spirit_gacha_token")>0 || ownedSpiritCount>0` 일 때 노출, `ownedSpiritCount>0` 이면 완료(보상 수령). 보상 경험치 300+구급상자 2.
  - `equip_spirit`: `ownedSpiritCount>0` 일 때 노출, `hasSpiritEquipped` 이면 완료. 보상 경험치 340+구급상자 2.
  - 순서: 소환 → (보상 수령) → 장착. claimTutorialObjective 가 completedStepIds 에 기록 → 한 번 받으면 다시 안 뜸.
- ObjectiveSnapshot 에 `ownedSpiritCount`/`hasSpiritEquipped` 필드 추가. main.ts 스냅샷에서 `this.spirits.owned.length`·`equippedSpirit(this.spirits)` 로 채움.
- main.ts 예산 보존(net 0): 신규 2필드를 1줄로 합치고 completedStepIds/achievedStepIds 기존 2줄을 1줄로 병합 → 10187줄 유지.
- 테스트: gameplay-systems-test 의 보스순서 base 스냅샷이 `countItem:()=>999` 라 토큰을 999개 쥐여줘 새 인터럽트가 보스순서 검증을 깨뜨림 → hunger=HUNGER_MAX 로 eat_meat 를 막는 것과 동일하게 토큰만 0 으로(+ownedSpiritCount 0) 억제. 추가로 정령 퀘스트 양성 테스트 블록(소환권→소환→장착→완료후 미노출) 신설.
- typecheck·size(10187)·methods(495)·architecture·hotpath·combat·save-migration·content·systems·balance·mobile·difficulty·leaderboard·party-ledger·spirits 전부 녹색. save-roundtrip 은 환경 Chrome 부재로 미실행(동일 한계).
- 관련: src/objectives.ts, src/main.ts, scripts/gameplay-systems-test.mjs.

## 2026-06-27 — 데미지 고정 → 범위 내 랜덤(삼각분포)

- 요청(손그림 2장): 데미지를 고정이 아니라 범위 내 랜덤으로. 플레이어 80%~200%, 전체 몬스터(보스 포함) 80%~130%. 둘 다 피크≈100%·우편향(오른쪽 긴 꼬리).
- 분포: 삼각분포(triangular) min/mode/max = 플레이어 0.8/1.0/2.0, 몬스터 0.8/1.0/1.3. 손그림(피크 100%, 왼쪽 80% 시작, 오른쪽 긴 꼬리)을 단순·검증가능하게 근사. 기대 평균 플레이어 1.267·몬스터 1.033.
- 구현(순수 leaf): game/combat.ts 에 triangularRoll(min,mode,max,rng=Math.random) + varyPlayerDamage(base,rng) + varyMonsterDamage(base,rng). base<=0→0, 그 외 최소 1 보장. rng 주입으로 결정성(rollDragonLootCount 패턴).
- 배선(main.ts, 신규 메서드 0·줄수 net 0):
  - 플레이어 기본공격 6종 + 원거리 발사 1회굴림: attackAnimal/attackPredator/attackDragon/attackJammini/attackVillager/attackKnight 의 currentDamage(), fireRangedWeapon 의 currentRangedDamage() 를 varyPlayerDamage() 로 감쌈. (HUD 표기 displayedAttackPower 는 base 유지 — 깜빡임 방지.)
  - 몬스터 피해: 적 발(發) damagePlayer 래퍼 7곳(projectileDamageContext/graveTrap/dragonAi/caveMonster/guardAi/guardProjectile/predatorAi)에서 amount→varyMonsterDamage(amount). 반격반사(tryCounterReflect)도 변동값 기준. dragonCounterAttack 직접호출 2곳(claw/fire)도 래핑.
  - 환경/자해(낙하·레고)는 제외 — 적 피해만 변동.
  - import 는 기존 combat import 줄에 이어붙여 main.ts 줄수 불변(10168).
- 결정: 클래스 스킬(classSkills) / 독수리 빙의 데미지는 이번 범위에서 제외(기본공격·원거리·몬스터 전부 변동). 필요 시 후속.
- 테스트: combat-test 에 변동 검증 추가 — 삼각분포 경계(rng 0/1/c)·연속성·플레이어 80~200%·몬스터 80~130%·하한 1·base<=0→0 + 1만표본 LCG 퍼징(항상 범위 내 + 우편향 평균). typecheck·size(10168)·methods(494)·architecture·hotpath(할당 0)·combat·save-migration·content·systems·balance·mobile·party-ledger·difficulty·leaderboard·spirits 전부 녹색. save-roundtrip 은 환경 Chrome 부재로 미실행.
- 관련: src/game/combat.ts, src/main.ts, scripts/combat-test.mjs.

## 2026-06-27 — 스킬 데미지도 랜덤 변동 + 적대적 테스트

- 요청: 스킬 데미지도 (기본공격처럼) 범위 내 랜덤으로. 전반적 적대적 테스트 후 병합.
- 스킬 변동 배선(플레이어 80%~200%, varyPlayerDamage 재사용):
  - 스킬 투사체: this.fireSkillProjectile() 메서드의 projectile.damage 를 발사 시 1회 굴림 → 메이지 파이어볼/메테오·거너 사격·소환사 윈드 등 모든 스킬 투사체 일괄.
  - 즉발/근접/장판/도트: 스킬 컨텍스트 applyDamage 래퍼 3곳(eagleActionContext·secondSkillContext(2·3스킬 공용)·skillEffectsContext(도트/광역)) 에서 damage→varyPlayerDamage.
  - 전사 장판(areaSkillEffects) 매 틱: applyAreaDamage 호출 시 effect.damage 를 변동(틱마다 굴림). 투사체 AOE(explode/magic)는 발사 시 이미 굴렸으므로 applyAreaDamage 내부는 불변 — 이중 굴림 방지.
  - 독수리 빙의 윈드커터: 리프 모듈 eaglePossession.ts 에서 직접 생성하는 투사체 damage 를 varyPlayerDamage(발사 1회). combat.ts import(leaf→leaf, 순환 없음).
  - 이중 변동 점검: applyProjectileDamage/applyAreaDamage 내부는 변동 없음 — 기본 원거리(스폰서 1회)·근접(호출부 1회)·스킬(래퍼/메서드 1회) 모두 단일 굴림 보장.
- 적대적 강건화(combat.ts): triangularRoll 이 비정상 rng(NaN/Infinity/범위이탈) → 0 으로 클램프, 비정상 범위(max<=min, mode<min) 방어. varyX 가 비유한·비양수 base → 0 (NaN/Infinity 포함).
- 신규 적대적 테스트 scripts/damage-variance-test.mjs (verify 에 편입): 경계·u=c 연속성·단조성(1001점)·적대적 rng 8종 클램프·비정상 범위·정수출력·하한1·비정상 base 6종→0·결정성(동일 시드)·20만 표본 통계(범위100%준수·평균≈(min+mode+max)/3·P(<mode)≈c·양쪽 꼬리 도달)·몬스터<플레이어 폭.
- typecheck·size(10168)·methods(494)·architecture·hotpath(할당0)·combat·damage-variance·systems·balance·mobile·party-ledger·difficulty·leaderboard·spirits·content·save-migration 전부 녹색. save-roundtrip 만 환경 Chrome 부재로 미실행.
- 관련: src/game/combat.ts, src/game/eaglePossession.ts, src/main.ts, scripts/damage-variance-test.mjs, scripts/combat-test.mjs, package.json.

## 2026-06-27 — 닉네임에 띄어쓰기·특수기호 허용(안전 범위)

- 요청: 닉네임 띄어쓰기·특수기호 허용(문제 없으면).
- 사전 안전 점검(중요): 닉네임이 어디서 쓰이는지 전수 조사.
  - Firebase 실시간DB **키로 직접 사용**(firebaseDirectory: users/${nick}, friends/${nick}/${to}, inbox/...). RTDB 키는 `. # $ [ ] /`·제어문자 금지(공백은 허용). progressSync 는 encodeURIComponent 로 REST 기록(공백·기호 → SDK 키와 동일하게 디코드되어 일치).
  - 화면 렌더: party/map/character/training/chat 패널 + 리더보드 전부 escapeHtml(`& < > " '` 모두 이스케이프, 속성값 포함)로 출력 → XSS 안전. 3D/캔버스 네임플레이트·집 간판은 textContent/캔버스라 무해.
- 결론: 공백 + 대부분의 특수기호는 안전. **차단 대상은 Firebase 키 금지문자(. # $ [ ] /) + HTML 특수문자(< > & " ') + 제어문자뿐.** (HTML 문자는 현재 전부 이스케이프되어 안전하지만, 향후 비이스케이프 렌더 경로 대비 방어적으로 제외.)
- 변경(nickname.ts): 허용 정규식을 화이트리스트→블랙리스트(NICKNAME_FORBIDDEN)로 교체. trim + 내부 연속 공백 1칸 정규화. 비속어/예약어 필터의 normalizeForFilter 를 강화 — 영숫자·한글(완성형+자모)만 남기고 전부 제거 → "시 발"·"시*발"·"ㅅ.ㅂ"·"a d m i n" 같은 공백/기호 우회까지 검출(자모 보존으로 기존 ㅅㅂ 탐지 유지).
- UI: nicknamePanel placeholder 문구에 "띄어쓰기·기호" 추가.
- 테스트: scripts/nickname-test.mjs 신설(verify 편입) — 공백/기호 허용·Firebase 금지문자 6종 차단·HTML 5종 차단·제어문자(NUL/BEL/ESC/DEL) 차단·길이·비속어 우회 6종·예약어 우회·정규화 중복. gameplay-systems-test 의 옛 단언("공백/특수문자 거부") → 신정책(공백·일반기호 허용 + / 와 <b> 거부)으로 갱신.
- typecheck·size(10168)·methods(494)·architecture·combat·damage-variance·nickname·systems·content·balance·mobile·party-ledger·difficulty·leaderboard·spirits·save-migration 전부 녹색. save-roundtrip 만 Chrome 부재로 미실행.
- 관련: src/game/nickname.ts, src/ui/nicknamePanel.ts, scripts/nickname-test.mjs, scripts/gameplay-systems-test.mjs, package.json.

## 2026-06-27 — 훈련장 역기(hp) 미니게임 상호작용 범위 수정

- 증상: 훈련장 "역기들기" 리그가 E 상호작용이 잘 안 잡혀 미니게임 실행이 어려움.
- 원인: 상호작용 대상 해석에서 trainingRig 가 관대한 nearbyObjectInView(콘/근접) 목록에 빠져 있어 strict 크로스헤어 레이캐스트(getLookTarget)로만 잡혔음. 역기 비주얼은 가장 낮음(바/원판 중심 y≈0.55, 최상단 ≈0.97m) → 눈높이(≈1.5m) 수평 조준선이 역기 위로 지나가 정조준(아래로 봐야)이 아니면 빗나감. 다른 리그(과녁 y1.6·방패 y1.25·제단 y1.05)는 높아 덜 티남.
- 수정: updatePrompt(프롬프트, line~4107)·primaryInteract(액션, line~4220) 두 곳의 nearbyObjectInView 목록에 "trainingRig" 추가 → 침대·제작대처럼 콘/근접(반경 0.85+0.9 여유, 중심 높이 보정)으로 관대하게 잡힘. 충돌/물리값은 불변, 신규 메서드·줄 수 변화 0.
- 안전: 훈련장은 안전구역(몬스터 없음)이라 콤뱃 타겟과 충돌 없음. trainingRig 는 isCombatTarget 아님 → 액션 분기에서 기존 trainingRig 핸들러로 정상 진입.
- 검증: typecheck·size(10168)·methods(494)·systems·content·balance·mobile 녹색. 레이캐스트/콘 상호작용은 브라우저 의존이라 단위테스트 불가 — 실기기 확인 권장(특히 역기 정면 접근 시 "E: 역기들기 훈련 시작" 프롬프트).
- 관련: src/main.ts (updatePrompt, primaryInteract 대상 목록).

## 2026-06-27 — 좌하단 상태 HUD: 레벨보너스 삭제 + 정령 레벨 표기 + 버프 툴팁 개선

- 요청 3건: ① '레벨 보너스 +N' 표기 삭제 ② 정령 레벨 정보 추가 ③ 버프 아이콘 마우스오버 시 버프명+잔여시간 표기.
- hudRenderer(leaf ui):
  - HudViewModel 에서 statBonus 제거, spiritStatus?: string 추가.
  - stats-detail 의 "레벨 보너스 +N" span 삭제 → 대신 spiritStatus span(있을 때만).
  - 버프칩 title = 타이머 버프는 `이름 · 남은 시간 N분/초`, 상시 버프(정령 등 value 보유)는 이름만. 표시 시간 텍스트는 기존과 동일.
- main.ts: statBonus 지역변수·뷰모델 필드 제거(−1줄), spiritStatus 뷰모델 추가(장착 정령: 등급·Lv·공/방 보너스·EXP 현재/다음). experienceForNextSpiritLevel 를 spirits import 에 추가(줄 수 무변).
- main.ts 10168→10167 로 1줄 감소 → check-main-size MAX_MAIN_LINES 10167 로 조임(ratchet).
- 검증: typecheck·size(10167)·methods(494)·architecture·combat·systems·content·balance·mobile·spirits·nickname·damage-variance 녹색. HUD 마크업 변경이라 visual-check 권장이나 Chrome 부재로 미실행(실기기에서 정령 장착 시 상태창 정령줄·버프 호버 확인 권장).
- 관련: src/ui/hudRenderer.ts, src/main.ts, scripts/check-main-size.mjs.

## 2026-06-27 — 보스 리전 탈출 추격 수정 + 보스 방어력 현재대비 +30%

- 요청: ① 보스가 어느정도 추격해오다 지도 끝쪽으로 가면 추격 못 오는 오류 수정 ② 보스 방어력 현재대비 +30% 전반 상향.
- ① 근본 원인: predatorAi 추격 이동이 매 프레임 clampPointToRegion 으로 스폰 리전(원형 서식지, 반경 68~78)에 클램프됨.
  리전 안에서는 따라오다 플레이어가 리전 밖(지도 끝 방향)으로 나가면 보스가 원 경계에 고정 — 증상과 정확히 일치.
  월드 가장자리 마진(몬스터 −6 vs 플레이어 −5, 1유닛 차)은 reach(3.3+) 이내라 원인 아님. 용(dragonAi)은 리전 클램프가 없어 무관.
- ① 수정: 리전 클램프를 **fieldBossId 없는 일반 몬스터에만** 적용. 필드 보스는 홈 리시(BOSS_LEASH_RADIUS=6, Codex dd0748f)가
  어그로 해제 시 스폰 홈 복귀를 보장하므로 클램프 불필요 → 어디까지든 추격. 부가 효과: 리전 밖으로 나간 보스가 다음 프레임
  clampPointToRegion 의 거리 클램프로 경계까지 순간이동하던 잠재 버그도 제거.
- ② 보스 방어 +30% (현재대비 ×1.3):
  - monsterStatsFromLevel(boss=true): floor(26+0.33L) → floor((26+0.33L)×1.3) — 필드보스 8종 + 요새 '동굴의 주인' 공용.
  - 챕터 용: DRAGON_ARMOR 65→85, 파이어 81→105, 레드 101→131, 레이저/다크/불멸 117→152.
  - 요새 시즈 웨이브몹(비보스)·일반몹은 armor 0 유지 — 무영향.
- balance-test 모델 수정(오탐 해소): 종전엔 모든 보스를 Lv60 플레이어 기준으로 킬 가능성 판정 → Lv170~300 후반 용이
  전부 UNKILLABLE 오탐(기존 armor 117도 고정 스킬 100 이 армor−20=97 을 3 차로 간신히 통과하던 우연). MONSTER_DEFS 의
  bossKind→level 로 보스별 의도 레벨 기준으로 재작성 + 스킬도 levelBonus 가산(실제 classSkills 동작과 일치 — 종전 주석
  "스킬은 레벨 보너스 미적용"이 오류). 새 armor 로 전 보스 의도 레벨 킬 가능 확인(기본 용 gap −10 → 타당 37뎀/타).
- systems-test: Lv26 필드보스 armor 34→44 기대값 갱신 + 신규 골든 "필드 보스는 리전 경계 밖까지 추격(x>30), 일반몹은
  경계에 클램프(x≤28)" 추가.
- typecheck·size(10178)·methods(494)·architecture·hotpath·combat·systems·balance·content·mobile·difficulty·spirits·
  damage-variance·nickname·save-migration·party-ledger·leaderboard 전부 녹색. save-roundtrip 은 Chrome 부재로 미실행.
- 관련: src/game/predatorAi.ts, src/game/monsters.ts, src/game/constants.ts, scripts/balance-test.mjs, scripts/gameplay-systems-test.mjs.

## 2026-07-03 — 감사 후속: 핫패스 GC 제거 4종 + 적응형 화질 복구 경로

- 배경: 거버넌스·성능 3관점 병렬 감사에서 기계 검사기 사각지대 누수 4건 확인 → 품질 무손실 수정 일괄 적용.
- ① 미니맵(ui/minimap.ts): 매 프레임 dynamicGroup.innerHTML 전체 재작성(SVG 문자열 생성+파싱+노드 재생성) →
  영속 노드(mm-markers/cone/dot/arrow) 1회 생성 + 변경감지(위치 0.1px·yaw 0.005rad 반올림 비교, 마커는 문자열 비교) +
  points/cx/cy 속성 직접 갱신. 정지 시 DOM 작업 0, 이동 시에도 재파싱 없음. 픽셀 동일.
- ② objectsNear(main.ts): 호출마다 new Set + 셀키 템플릿 문자열 → 깊이별 스크래치 Set 풀(3단, 중첩 제너레이터 안전:
  try/finally 로 깊이 복원, for-of break 시에도 동작) + 셀키 숫자 패킹(cellX·65536+cellZ). spatialBuckets/spatialKeysByObject
  키 타입 string→number. 이동 중 프레임당 5~10회 불리는 최다 경로의 GC 압력 제거. 동작 동일.
- ③ 투사체 트레일(combatEffects.ts): magic/wind/tnt 트레일이 파티클마다 new SphereGeometry+Material+Vector3×2 →
  단위 구 지오메트리 공유(크기는 scale)·머티리얼 free-list 풀(페이드가 per-particle opacity 라 공유 불가 → 반납 재사용,
  CAP 96)·고정 속도벡터 모듈 상수 공유(updateDamageParticles 는 velocity 읽기 전용 — 확인함). CombatEffectParticle 에
  pooledMaterial 플래그 추가, main.ts 정리 2곳에서 dispose 대신 releasePooledTrailMaterial 반납. main 의 인라인 파티클
  타입을 CombatEffectParticle 로 정본화. 비주얼 동일.
- ④ 적응형 화질 복구(main.ts updateAdaptiveQuality): 종전엔 하향만 있고 복구 없음 → 일시 스톨(보스 스폰 등) 한 번에
  세션 내내 저화질(외곽선·HDRI·픽셀 40% 손실). 신규: 첫 자동 하향 시 원래 품질을 adaptiveRestoreTarget 으로 기억,
  쾌적 윈도우(avg<26ms·slow<2%·히치0 — 하향 임계보다 훨씬 엄격한 히스테리시스) 연속 4회(10초)면 한 단계 승급,
  승급 직후 워밍업 3초 리셋(전환 히치로 인한 즉시 재하향 방지), 승급 후 재하향 시 요구 윈도우 2배(최대 16 — 플립플롭
  방지), 원래 품질 도달 시 상태 초기화. 수동 선택(qualityLocked)은 기존대로 자동 경로 완전 비활성.
- main.ts +33줄(10178→10211) — 공간 인덱스·적응형 화질은 §3 이 main 소유로 지정한 공유 커널이라 배선 잔류가 규약 적합.
  size 예산 이력 주석과 함께 10211 로 갱신. 메서드 수 불변(494).
- 검증: typecheck·size·methods·architecture·hotpath(할당0)·combat·systems·content·balance·mobile·difficulty·spirits·
  damage-variance·nickname·save-migration·party-ledger·leaderboard 전부 녹색. 미니맵/트레일은 브라우저 시각 확인 권장
  (Chrome 부재로 visual-check 미실행 — 특히 미니맵 화살표·마커, 마법/총알 트레일 잔상).
- 관련: src/ui/minimap.ts, src/main.ts, src/game/combatEffects.ts, scripts/check-main-size.mjs.

## 2026-07-03 — 몬스터 요새 단계 이어하기가 로드마다 1단계로 리셋되던 버그 수정
- 신고: "맵별 요새가 클리어 단계를 기억 못하고 매번 첫 단계부터 시작."
- 근본원인: `fortressStageByMap`(맵별 최고 클리어 단계)이 localStorage 에만 존재·세이브 미포함.
  로드 경로 `restoreSaveData`→`resetGameState`(main.ts)가 로드마다 메모리+localStorage 를 `{}` 리셋
  → 껐다 켜서 이어하기만 해도 요새 진행 증발. (predatorKills 로드-리셋 버그와 동일 패턴의 누락 수리)
- 수정: 세이브 필드 `player.fortressStageByMap` 신설(직렬화·마이그레이션 정규화·로드 복원+구세이브 localStorage 백필).
  leaf 헬퍼 `restoreFortressStageByMap`(fortressSiege.ts). main.ts 는 전부 기존 줄 인라인 — size/methods 래칫 여유 0 유지.
- 적대적 리뷰(3렌즈+반박 판정) 확정 1건 반영: 구세이브 백필은 요새 방문 증거(visit_fortress 달성) 있을 때만 —
  전역 localStorage 미러가 다른 슬롯 진행을 미방문 캐릭터에 주입하던 창 차단.
- 검증: verify 전체 그린. save-migration(정규화·구세이브 생략)·save-roundtrip(복원·legacy 백필·무증거 차단 가드 3건) 추가.
  실브라우저 E2E: 새게임→요새 3단계 클리어→저장→page reload→이어하기→재입장 **3단계부터 시작** 확인,
  5단계 갱신 후 재재시작→5 유지, localStorage 미러 동기화, 파티 sync 는 세이브 경로 미사용(오염 없음) 확인.
- 상세: docs/save-system-history.md 2026-07-03 항목.
## 2026-07-03 — spawn* 메시 팩토리 리프 추출 (God Object 축소 1차)

- 감사 권고 5번 실행. 4배치 커밋(각각 typecheck·architecture·systems·content 녹색 확인 후):
  - spawnWaterBody·spawnTree·spawnCave → game/environmentSpawns
  - spawnDroppedItem → game/droppedItemSpawns
  - spawnKnight·spawnGolem → game/guardSpawns
  - spawnMiner·spawnVillager·spawnBlacksmithNpc → game/npcSpawns
  전부 메서드 통째 이동(좁은 컨텍스트 주입, entitySpawns 패턴)·동작 보존.
- 결과: main.ts 10211→9461줄(−750), 494→481메서드(−13). 예산 라쳇 하향(size 9461·methods 481, 여유 0).
- ⚠ 실패 기록(§11): 5번째 배치(spawnVillageSellShop·spawnVillageFence → villageSpawns)는 작업 에이전트가 세션 한도로
  중단되며 미커밋 상태가 오염됨(컨텍스트 객체 replace 가 entitySpawnContext 까지 잘못 매칭) → 미커밋분 폐기(checkout --).
  다음 작업자: 이 두 메서드 + spawnVillage(오케스트레이션) + 세이브 직렬화 3종(createSaveData/restoreSaveData/
  restoreWorldObject)이 남은 추출 대상. replace 시 컨텍스트 객체 끝 멤버가 동일한 점 주의(고유 앵커로 편집).
- 검증(폐기 후 HEAD): typecheck 0에러·size·methods·architecture·hotpath·combat·systems·content·balance·mobile·
  save-migration 전부 녹색. 시각 동일성은 브라우저 확인 권장(Chrome 부재로 visual-check 미실행).

## 2026-07-03 — spawn* 추출 5배치 재시도 성공 (villageSpawns)

- 앞서 세션 한도로 중단·폐기됐던 배치 재작업: spawnVillageFence·spawnVillageSellShop → game/villageSpawns (메서드 통째
  이동·동작 보존). 기존 worldSpawnContext 교차 타입에 VillageSpawnContext 합류(멤버 이미 충족 — addWorldObject·
  getGroundHeightAt·mergeStaticMeshes). createBuildingSign 은 리프(buildingSigns)의 동명 export 를 직접 import.
- 지난 실패 원인이던 "컨텍스트 객체 replace 오매칭"은 python 앵커 기반 삭제·고유 문자열 치환으로 회피.
- 결과: main.ts 9470→9337줄(−133), 482→480메서드(−2). 라쳇 하향(size 9337·methods 480).
- 검증: typecheck 0에러·size·methods·architecture·hotpath·combat·systems·content·balance·mobile·save-migration 녹색.
- 잔여 추출 대상: spawnVillage(오케스트레이션 성격 — 판단 필요)·세이브 직렬화 3종.

## 2026-07-03 — 재발 방지 체계화: 핫패스 검사기 확장 + 거버넌스 명문화

- 배경: 이번 감사·수정 사이클에서 드러난 치명 리스크 3류(검사기 사각지대의 매 프레임 할당/DOM, tick* 네이밍 스캐너 회피,
  광역 replace 오매칭)를 기계 게이트·규약으로 재발 차단.
- check-hotpath-allocations.mjs 확장:
  ① 핫함수 패턴에 tick[A-Z]* 추가 + \b 경계(createStickModel 오탐 방지) — "이름 바꿔 회피" 봉쇄(실사례: tickMinimap 주석이
    스캐너 회피를 자인했었음).
  ② 신규 라쳇 3종: .clone()(≤6)·new Set/Map(≤2)·innerHTML=(≤3). 예산 = 전수 실측 기준선(전부 저위험 확인, 주석에 명단).
    새 코드가 늘리면 실패, 정리로 줄면 조인다.
- AGENTS.md: §9 stale 수정(phaser/react 제거 완료), §10 게이트에 확장 검사기·네이밍 회피 금지·적응형 화질 "하향-복구 한 쌍"
  규칙 추가, §12 에 "일괄 편집은 고유 앵커로 + 직후 typecheck" 규칙 추가(villageSpawns 1차 오매칭 사고 참조).
- 검증: 확장 검사기 전 지표 기준선 일치(alloc 0/0·clone 6/6·set/map 2/2·innerHTML 3/3)·typecheck 0·size/methods/architecture
  녹색·combat/systems/content 녹색.

## 2026-07-03 — 사무라이 직업 구현 완료 (wip/samurai 재개 → 완주)

- 배경: 두 차례 세션 한도 중단으로 남아있던 wip/samurai(32 타입에러)를 master 에 병합해 완성. 카타나 2종(리치 2배)은
  선행 커밋(c2078af)으로 이미 반영돼 있었음.
- 확정 수치:
  - 패시브: 방어 +3(레벨당 +0.15) — 전사(4/0.2) 미만. 한방 배수 0.8 — 전사(0.95) 미만. 스윙 시간 ×0.8(=공속 +25%,
    쾌속 목걸이와 같은 스윙 축소 메커니즘) → DPS ≈ 전사(무기 없이 +5.3%, 근접무기 전사 대비 −4.3%).
  - 카타나 시너지(사무라이+카타나): 공격 +5%(classWeaponDamageMult 합성) · 공속 +5%(스윙 ×1/1.05) · 이속 +5%(합연산 계층).
    카타나 리치 2배는 이번에 실배선 — interact() 전투 한정 확장 탐색 + 스킬 lookCombatTarget 에 meleeReach 적용
    (기존 items.meleeReach 헬퍼가 미사용 상태였음).
  - 스킬: R 난도(마나 30·쿨 16s·4연격×55%=합 2.2배) · T 도약(마나 40·쿨 30s·최대 15칸 돌진×150%, 0.5 스텝 전진 중
    전진량<40% 면 정지 — 건물 관통 금지) · F 무한 찌르기(1차 전직 해금·마나 50·쿨 32s·11연격×40%≈1.6초 채널) ·
    G 월광베기(4차 해금·마나 80·쿨 45s·반경 6.8 광역 3연격×220%=합 6.6배, 전사 천검난무 7배 바로 아래).
  - 전직: 전사 동수치, 칭호 검객→검호→검성→검선.
- 구조: 로직·수치 전부 리프(game/samurai + classSkills 분기). 연격은 화상 도트와 같은 등록형 틱(updateSamuraiFlurries,
  updateSecondSkillEffects 에서 호출). SecondSkillContext 에 이동·공간 커널 4종(playerPosition·forwardXZ·
  nearbyCombatTargets·dashStep) 승격, SkillEffectsContext 에 meleeEffects 추가. main.ts 는 배선 +2줄(import·핸들러)로
  size 예산 9337→9339(사유 주석), methods 480 유지.
- 검증: typecheck 0에러 · size/methods/architecture/hotpath 녹색 · combat/save-migration/save-repository/content/
  systems/balance/mobile/party-ledger/difficulty/leaderboard/spirits/damage-variance/nickname 전부 녹색.
  gameplay-systems-test 에 사무라이 골든 블록 추가(패시브·시너지·스킬 수치·연격 틱 생명주기·도약 기하/장애물 정지·칭호)
  — 고장 주입(0.79 기대값)으로 실제 실행됨을 확인 후 복원.
- ⚠ 실패 기록(§11):
  - 고장 주입 확인 뒤 `git checkout scripts/gameplay-systems-test.mjs` 로 원복하다 **미커밋 테스트 블록 전체를 함께 날림**
    → 재작성. 다음 작업자: 미커밋 파일의 일부만 되돌릴 땐 checkout 금지 — 해당 한 줄만 재수정하라.
  - save-roundtrip·visual-check 는 이 작업 환경(Linux, Chrome/Edge 없음)에서 실행 불가(스크립트가 Windows 브라우저 경로
    하드코딩). 세이브 안전성은 node 기반 save-migration/save-repository 로 검증(isPlayerClassId 가 PLAYER_CLASSES 키
    기반이라 samurai 자동 인정, 구세이브는 warrior 폴백 유지). 사용자 PC 에서 visual-check 1회 권장.
- 잔여/이월: 사무라이 전용 시전음(현재 melee/wind 공용 샘플 재사용) · 도약 이동 궤적 연출(현재 즉시 이동 + 충격파) ·
  터치 UI 스킬 버튼은 buildSkillSlots 데이터 주도라 자동 지원(별도 작업 불요).

## 2026-07-04 — 로드-리셋 패턴 전수 감사: 상점 카운터·개미굴 뱅크 세이브화 + 스테일 신호 리셋
- 요새 단계 버그(5452de8)와 같은 패턴 잔여 후보 전수 점검(resetGameState × restoreSaveData 교차 대조).
- 수정: ①materialsSold·shopPurchases 세이브 필드화(로드 복원+완료 퀘스트 임계 백필) — "재료 3번 팔기" 중간 진행이
  로드마다 0 리셋되던 유실 해소. ②antStepBank 세이브화(chest/cave 뱅크와 동일 취급). ③resetGameState 에
  recoveredWorkbench·ateMeat 리셋 누락 → 이전 플레이스루 신호가 새 게임 퀘스트를 자동 완료시키던 버그 수정.
- 미수정(문서화된 결정): sprintSteps(재획득 수초), triesSinceBest(휘발 명시, trainingTries 로 합산·저장).
- 부수: Codex 추출 리팩터로 깨진 save-roundtrip(spawnDroppedItem 메서드 제거)를 dropItemFromSlot 실경로로 수리.
- 검증: verify 전체 그린(리팩터 후 첫 완주), 신규 가드 6건(마이그레이션 3·roundtrip 3), 실브라우저 E2E
  (판매 2/3 저장→재시작→로드→유지). main.ts 는 전부 기존 줄 인라인 — 래칫 9339/480 여유 0 유지.
- 상세: docs/save-system-history.md 2026-07-04 항목.

## 2026-07-04 — 사무라이 밸런스 상향 + 도약 몬스터 관통
- 유저 요청 4건: ①공속 조금 더(스윙 ×0.8→×0.75 = 전사 대비 +33%) — "DPS ≈ 전사" 골든 계약을
  "전사보다 소폭 위(유계)"로 의도적 갱신. ②도약 쿨 30→25초. ③난도 타격 55%→70%(4연격 합 2.2→2.8배).
  ④도약이 몬스터·보스 등 생명체는 관통(경로 피해 유지), 건물·지형·설치물은 기존대로 막힘.
- 구현: 관통은 resolveCollisions 에 passThroughCreatures 파라미터 추가(도약 dashStep 만 true),
  관통 대상 = samurai.ts SAMURAI_DASH_PASSTHROUGH_TYPES(생명체 7종). main.ts 전부 기존 줄 인라인(래칫 여유 0 유지).
- 검증: verify 그린(골든 갱신 포함: 공속 0.75·난도 70·쿨 25·관통 셋 구성). 실브라우저 E2E —
  경로 위 몬스터 2마리 배치 후 도약: 15.0칸 완주 관통 + 둘 다 피해, 나무 벽엔 2.0칸 정지(막힘 유지).
  ★E2E 함정 기록: 순간이동시킨 몬스터는 AI 리쉬가 원위치로 되돌림 → homePosition 이전 + 같은 evaluate 동기 발동 필요.
- 부수: 직전 카운터 수정 리뷰 확정 1건(eat_meat 달성-미수령 로드 유실, minor) 수용·문서화
  (save-system-history §4 잔여 리스크).

## 2026-07-04 — 침대 회수 시 휴식 종료(가속 회복 유지 버그) 수정
- 신고: "침대에 누워있는 동안만 빠르게 회복해야 하는데, 눕자마자 일어나 침대를 회수해도 빠른 회복이 유지됨."
- 근본원인: pickUpBed 가 침대만 제거하고 isResting 을 해제하지 않음. 자연 해제(updateMana 3068)는
  '패널 열림' 또는 'restAnchor 에서 0.6칸 이동'만 감지하는데, 눕자마자(위치 그대로) 회수하면 둘 다 미충족
  → 침대가 사라져도 isResting=true 유지 → BED_REST_PROFILE 가속·바닥 회복이 계속 적용.
- 수정: pickUpBed 에서 회수 대상이 '지금 누워 있는 침대'(위치가 restAnchor 와 일치, 오차 0.05)일 때 isResting=false.
  위치 매칭으로 '옆의 다른 침대 회수'는 휴식을 끊지 않게 구분. 파티 게스트 경로(호스트 회수 요청)보다 앞에 두어
  솔로·게스트 모두 커버. main.ts 는 기존 줄 인라인(래칫 9339/480 여유 0 유지).
- 검증: verify 전체 그린 + 실브라우저 E2E — 누워있을 때 12HP/s(가속), 이동 없이 회수 후 0.55HP/s(느린 기본),
  대조군(멀리 있는 다른 침대 회수)은 휴식 유지.

## 2026-07-04 — 방패막기: 흔들기(가짜)를 안 누르고 넘기면 성공 인정
- 유저 요청: "훈련장 방패막기에서 흔들기일 때 안 누르면 그것도 성공 카운트로 인정."
- 기존: 방어 훈련(runBlock)은 'go'(🛡 막아!)를 제때 누르면 성공, 'fake'(💤 흔들기…)를 누르면 실패.
  fake 를 안 누르면 그냥 idle 복귀(무득점)였음.
- 수정(src/ui/trainingPanel.ts, leaf): 성공 로직을 succeed(label) 헬퍼로 추출.
  fake 가 안 눌린 채 타임아웃되면 succeed("잘 참았어요!") 로 성공 카운트(+1, 3회 시 celebrate→onSuccess 보상).
  fake 를 실제로 누르면 여전히 실패(가짜에 속음), go 놓침도 여전히 실패 — 반응 변별 게임으로 성립.
- ★악용 차단(적대적 리뷰 확정 major 반영): 초기 "go 가 우세하니 안전" 판단은 틀렸음 — count≥8 이면
  blockFakeChance 가 상한 0.45 라 가짜 3연속이 잦아져(~신호 18~24회, ~35초) go 놓침 리셋보다 빨리 누적,
  자리를 비워도 armor 무한 증가. 수정: 활동성 게이트 — 가짜-통과 성공은 최근 12초(BLOCK_AFK_MS) 내
  입력(클릭/스페이스, 성공·실패 무관)이 있을 때만 인정. 순수 방치는 무득점으로 넘김. 활동하면 즉시 재개.
- 검증: verify 그린 + 실브라우저 E2E 2종 — ①가짜 안 누르면 성공(armor 5→6). ②활동성 게이트(count=9 최악구간):
  활동 중 9→10→11, >12초 방치 시 11 동결, 입력 주입 후 11→12 재개.

## 2026-07-04 — 동굴 BGM 교체: 무서운 곡 → 밝은 CC0 '수정 동굴'
- 신고: "동굴 노래가 너무 무섭다. 아이들이 하는 게임인데 무서운 BGM 지양. CC0 에서 동굴 분위기는 나되 더 밝은 곡으로."
- 교체: cave.ogg("Dark Shrine Loop" by qubodup, 어둡/공포) → cave_crystal.mp3("Crystal Cave (song18)" by cynicmusic,
  종·아르페지오의 밝고 신비로운 루프, CC0). cynicmusic 은 이미 town_theme·battle 로 크레딧된 동일 출처.
- 변경: public/bgm/cave_crystal.mp3 추가(OpenGameArt CC0, 534KB) + cave.ogg 삭제, main.ts updateMusic 참조 갱신,
  CREDITS.txt 갱신(교체 사유 명기).
- 검증: build 그린(dist/bgm/cave_crystal.mp3 포함) + 실브라우저 E2E — 동굴 진입 시 cave_crystal.mp3 요청(200)·
  decodeAudioData 성공·isPlaying=true, 옛 cave.ogg 요청 없음(404 없음).

## 2026-07-04 — 집 보급상자 고등급 확률 소폭 상향 (정령소환권·흑요석방패 더)
- 유저 요청: 직접 지은 집 보급상자에서 높은 등급 템 확률 소폭 상향, 특히 정령소환권·날카로운흑요석방패는 조금 더.
- 수정(src/game/homeBase.ts, leaf 순수함수):
  ① 에픽+ 보너스 풀 발동 15%→20%(전체 고등급 소폭 상향).
  ② 정령소환권 전용 롤 6%→11%(tier≥2).
  ③ EPIC_PLUS_SUPPLY 가중치: sharp_obsidian_shield 3→6, spirit_gacha_token 2→4.
- 실측(몬테카를로 N=200k, lv100): 정령소환권 6.3%→11.7%(≈2배), 흑요석방패 0.45%→1.15%(≈2.6배).
- 테스트 경계(무보너스 0.99 / 전보너스 0.01)를 넘지 않아 기존 골든 유지. 검증: systems·content·verify 전체 그린.

## 2026-07-04 — 사무라이 도약 경로 폭 확장(광역 스윕 느낌 강화)
- 유저 요청: 도약을 휩쓸고 지나가는 광역기 느낌 더 강하게 — 경로 좌/우로 1~2칸 더 넓게 피해.
- 수정(src/game/samurai.ts): SAMURAI_DASH_HIT_WIDTH 1.5→3.0(중심선 좌/우 수직 반폭, 각 +1.5칸).
  경로 판정(선분 수직거리 ≤ 폭+반경)은 그대로, 폭만 확대 → 좌·우 스윕 범위 2배. 관통·전방 15칸·150% 피해 불변.
  classSkills 도약 요약도 "넓은 경로를 휩쓸며 좌·우의 적까지"로 갱신.
- 검증: verify 그린. 도약 기하 단위테스트 갱신(near 0.6·wide 2.6 히트 / far 6·behind 제외 — wide 는 옛 1.5폭이면 miss라
  상향 회귀가드). 실엔진 E2E: 좌/우 2.5칸 적 모두 피해, 폭 밖 6칸 제외.

## 2026-07-04 — 동굴의 주인 처치 보상 메시지 인지 강화(빈 칼질에 안 덮이게)
- 신고: 몬스터 동굴에서 동굴의 주인(fortressBoss) 처치 보상 메시지가 너무 빨리 사라지거나,
  직후 빈 칼질의 "가까이 보고 있는 대상이 없습니다"로 덮여 뭘 얻었는지 인지가 약함.
- 원인: 킬 흐름상 🏰 보상 메시지(grantExperienceForTarget)가 마지막에 뜨지만, showMessage 는
  textContent 를 무조건 덮어써서 직후 빈 칼질 '대상 없음' 메시지(저가치)가 즉시 클로버.
- 수정(src/main.ts): showMessage 에 lockSeconds(표시 잠금)·soft(저우선) 옵션 추가.
  ① 보스 보상 = durationSeconds 9 + lockSeconds 8(8초간 soft 메시지로부터 보호, 더 오래 표시).
  ② 빈 칼질 '대상 없음' = { soft:true } → 잠금 중엔 스킵. 중요(비-soft) 메시지는 잠금 중에도 정상 표시.
  messageLockUntil 필드 추가·resetGameState 리셋. main.ts 전부 기존 줄 인라인(래칫 9339/480 여유 0 유지).
- 검증: verify 그린 + 실브라우저 E2E — 실제 보상 경로 후 soft '대상 없음'이 보상을 안 덮음,
  중요 메시지는 표시, 잠금 해제 후 soft 정상 복귀.

## 2026-07-04 — CI: Pages 배포 일시 실패 자동 재시도(네이티브 1회)
- 배경: deploy-pages@v4 가 이전 배포 finalize 와 경합하면 몇 초 만에 일시 실패(2026-07-03~04 에만 4회,
  매번 빌드는 성공·빈 커밋 수동 재시도 1회로 전부 해결). cancel-in-progress:false 는 워크플로 직렬화만 하고
  환경 finalize 경합까지는 못 막음.
- 수정(.github/workflows/deploy.yml): 외부 액션 의존 없이 네이티브 패턴 —
  1차 deploy-pages 에 continue-on-error, 실패 시 sleep 30 후 조건부 재시도 1회. 두 번 다 실패 시 job 실패(진짜 문제만 빨강).
  environment.url 은 1차∥재시도 출력 폴백.
- 효과: 일시 인프라 실패는 자동 복구(수동 빈 커밋 불필요), 실제 문제는 여전히 드러남.

## 2026-07-04 — 사무라이 적대적 QA 전수 감사: 오염 수치 방어 하드닝 + 전용 테스트 스위트

- 배경: 사무라이+카타나(c2078af..a31e202 + 밸런스 후속 ffd55e0·a0e1827)를 치터·QA 관점으로 전수 공격
  (도약 탈출·충돌 우회, 연격 수명주기, 카타나 리치 악용, 퍼징, 세이브/파티, 타 직업 회귀, 핫패스 예산).
- **CONFIRMED-FIXED** (76b203b, 전부 game/samurai.ts 리프 한정·정상 입력 골든 불변):
  ① 피해 헬퍼 4종(난도/도약/무한 찌르기/월광베기) — 비유한 currentDamage → NaN 피해 → target.hp NaN
     → `hp <= 0` 영원히 false = **불사 몬스터** (samurai.ts finiteOr1 가드).
  ② registerSamuraiFlurry — NaN 간격은 `now < nextHitAt` 전부 false = **매 프레임 타격**, NaN/∞ 타수는
     `hitsLeft <= 0` 전부 false = **무한 연격 엔트리**. 비유한 인자 등록 거부 + 타수 ≥1 클램프.
  ③ performSamuraiDash — 오염 방향(NaN/0벡터)·dashStep 위치 오염 시 playerPosition NaN 전파 +
     NaN 경로/NaN 좌표/∞ 반경 개체는 hypot 비교 전부-false 로 **반경 22 내 전 후보 오폭**.
     조기 종료·시작점 복원·오염 개체 판정 제외로 차단.
  - 검증: scripts/samurai-test.mjs 신설(spirits-test 패턴, package.json verify 편입) — 헬퍼 퍼징(적대 6종
    ×4 + LCG 200회 단조), 동일 프레임 중복 타격 금지, 중첩 시전(R+F) splice 경합, 리셋(로드/새게임) 후
    틱 릭 방지, 도약 기하(전면 차단·과전진 dashStep 종료·경로 1회 타격·오염 개체 제외), 세이브 왕복
    (isPlayerClassId)·파티 원격 모션 폴백. **고장 주입 확인**: git stash 로 하드닝 전 코드에서
    `samuraiFlurryHitDamage(NaN) → NaN` 실패 재현 후 복원(테스트 파일은 untracked 라 checkout 사고 없음).
- **CLEAN** (코드 경로 판독으로 확인, 수정 불요):
  - 도약 탈출류: 월드 경계/동굴/요새 아레나는 dashStep 이 스텝마다 clampPlayerHorizontalPosition
    (main.ts:3138·3429), 울타리 세그먼트·충돌체·buildingBlock 머리높이는 resolveCollisions 0.5스텝 +
    BLOCK_RATIO 0.4 정지(main.ts:3522) — 도보와 동일 의미론. 안전구역은 몬스터 전용 제약이라 플레이어
    도약 진입은 도보 진입과 동일하게 합법(safeZones.ts 주석·main.ts:3901 은 몬스터 이동에만 적용).
  - 시전 게이트: 패널 열림 차단(trySpendSkill main.ts:3093 + 핸들러 게이트), 사망은 즉시 부활이라 지속
    사망 상태 없음(main.ts:5534), 휴식 중 도약은 0.6칸 이탈 자동 기상(main.ts:3068), keydown !repeat +
    동기 실행 + trySpend 내부 쿨 설정으로 이중 시전 불가, 마나 경계(==cost) 허용은 전 직업 공통 규칙.
  - 연격: 대상 사망/소실 시 취소, 로드·새게임 시 resetSecondSkillEffects → resetSamuraiEffects
    (main.ts:6337·6479), 직업 전환은 새게임/로드 외 경로 없음. 전직 게이트 F=tier1(main.ts:3144)·
    G=tier4(main.ts:3150). 파티 게스트는 도약·연격 틱 모두 partyGuestAttackIntercept 경유.
  - 카타나: 시너지는 samuraiKatanaAttackMult 의 클래스 가드로 사무라이 한정(전사+카타나 = 근접 +10%만,
    골든 테스트 존재). 2배 리치 확장 탐색은 전투 대상 4종 한정(main.ts:4253) — 상자·NPC·제작대는 기본
    사거리. +5% 공격은 classWeaponDamageMult 로 bodyMeleeAttackPower 에 합성 → 근접·스킬·HUD 일관,
    스윙 두 계산 지점(main.ts:4069·4095) 동일식. 이속은 합연산 계층 1곳.
  - 세이브/파티: isPlayerClassId 가 PLAYER_CLASSES 키 기반이라 samurai 왕복·구세이브 warrior 폴백
    (saveMigration.ts:137·255), CLASS_APPEARANCE.samurai + 미지 직업 폴백(partyPresence.ts:143).
  - 핫패스: updateSamuraiFlurries 무할당 유지 — check:hotpath 0/0·clone 6/6·set/map 2/2·innerHTML 3/3.
- **DEFERRED** (판단 기록 — 수정하지 않기로 한 것과 이유):
  - 연격 사거리 취소 없음(시전 후 대상이 멀어져도 잔여 ≤1.6초 타격 적중): 전사 화상 도트와 동일한
    등록형 틱 계약. 취소 도입은 밸런스 골든 계약 변경 + 아동 플레이 좌절 요인이라 보류.
  - 근접 조준에 가림(LOS) 판정 없음: nearbyObjectInView 는 순수 기하(각도+거리)라 기본 리치(6.4)부터
    얇은 벽 너머 타격이 원래 가능 — 카타나(11.6)는 기존 모델의 증폭이지 신규 결함이 아님. 수정은
    main.ts 조준부 레이캐스트 추가 = 브라우저 실검증이 필요한 동작 변경이라 보류(도약 경로 폭 3.0 의
    측면 벽 너머 피해도 동일 모델). 다음 작업자: 고치려면 확장 탐색(4253)·lookCombatTarget 에만
    가림 검사를 한정해 일반 전투 체감을 보존할 것.
  - 도약이 마을 NPC(빌리저·경비)에 막힘 + 광역기의 빌리저 타격 가능: isCombatTarget 이 빌리저 포함 —
    전사 광역기와 동일한 기존 모델(의도된 상호작용). 관통 셋은 설계 명시대로 몬스터류 7종 한정.
  - save-roundtrip·visual-check 는 이 환경(Linux, Chrome/Edge 없음) 실행 불가(기지 제약) — 그 외
    node 스위트 13종 전부 녹색으로 대체 검증. 사용자 PC 에서 visual-check 1회 권장.

## 2026-07-04 — 드래곤 잔여 HP 인지 + 파티 HP바 좌측 고정 소모
- 신고 ①: 드래곤 류를 때릴 때 잔여 HP 를 알 수 없음. 원인 = 보스 HP바(updateBossBar)는 있었으나
  DRAGON_BOSS_BAR_DISTANCE=1(충돌면 1칸, 사실상 밀착)이라 일반 전투 거리에선 절대 안 보였음(리팩터 체크포인트 잔재).
  수정 = 30 으로 확대 + 어그로 중(angryUntil)엔 거리 무관 표시(도망치면서도 확인 가능).
- 신고 ②: 파티 오버헤드 HP바가 중앙 수축(좌우 동시)이라 어색 → 좌측 고정·우측 소모로 교체.
  스프라이트 position 은 회전축(x=0)에 둔 채(요동 방지 설계 유지) sprite.center.x 를 함께 움직여 좌단 고정 —
  순수 헬퍼 hpBarFillTransform(ratio,width) 로 분리(partyPresence leaf).
- 검증: verify 그린. 단위(좌단 고정 불변식 ratio 0~1 전 구간·풀피 center 0.5·절반 시 우단=중앙) +
  실브라우저 E2E(20칸 표시 "용 400/1000"·60칸 숨김·어그로 시 거리 무관 표시).

## 2026-07-04 — 데스크탑 전체화면 모드
- 유저 요청: 모바일(진입 시 자동 전체화면)처럼 데스크탑에도 전체화면 모드.
- 구현: ①platform.ts(leaf)에 toggleFullscreen() — fullscreenElement 여부로 진입/해제, feature-detect+catch
  (webkit 폴백 포함, 미지원·거부 시 무음). ②타이틀 화면 "🖥 전체화면" 버튼(title-actions) — setupUi 가
  leaf→leaf 직접 배선(클릭 제스처 내 동기 호출로 브라우저 정책 충족, main 콜백 불필요).
  ③게임 표준 단축키 Alt+Enter — handleKeyDown 최상단(입력 가드 앞: 검색/채팅 중에도 동작, 문자 입력 영향 없음).
  ④조작 안내에 Alt+Enter 표기. main.ts 는 기존 줄 인라인(래칫 9339/480 여유 0 유지). F11(브라우저 네이티브)과 독립.
- 검증: verify 그린 + 실브라우저 E2E(Fullscreen API 계측) — 버튼 클릭 진입→재클릭 해제,
  게임 중 Alt+Enter 진입/해제 토글, 일반 Enter 미발동.

## 2026-07-04 — 사무라이 밸런스: 난도 상향 + 도약 쿨 하향
- 유저 요청: 난도 공격력 상향 + 돌진(도약) 쿨타임 22초.
- 변경: ①난도 1타 배수 0.7→0.9 (4연격 합 2.8배→3.6배) — samurai.ts samuraiFlurryHitDamage.
  전사 '불타는 공격' 2배 대비 확실한 주력기로 세우되 짧은 쿨(16초·마나 30) 유지. finiteOr1 가드 보존.
  ②도약 쿨 25→22초 — classSkills.ts SECOND_SKILLS.samurai.cooldown. 데미지/사거리(15칸·150%·관통·건물정지)는 불변.
- 골든 동기화: samurai-test.mjs helper 배수 0.7→0.9, gameplay-systems-test.mjs 난도 어서션(70→90·합 3.6배)·
  도약 쿨 어서션(25→22)·상단 스킬수치 주석·하단 계약 문자열 일괄 갱신.
- 검증: 코드 관련 게이트 전부 녹색 — typecheck·check:size(9339)·check:methods(480)·check:architecture·
  check:hotpath·test:samurai·test:systems·test:balance + 나머지 node 스위트. save-roundtrip 은 이 환경
  (Linux, Windows Chrome/Edge 경로 하드코딩) 실행 불가 — clean HEAD 에서도 동일 실패 확인(내 변경 무관, 기지 제약).

## 2026-07-04 — 사무라이 카타나 공속 시너지 +5%→+10%
- 유저 요청. SAMURAI_KATANA_SPEED_BONUS 0.05→0.1(스윙 ×1/1.1). 공격 +5%·이속 +5% 는 유지.
- 결과 DPS(기본무기 대비 전사): 비카타나 1.12배 → 카타나 1.30배(골든 창 1.35 내 유지).
- 표기 갱신: classPassives summary·주석·골든 테스트(0.75/1.1). 검증: verify 전체 그린.

## 2026-07-04 — 무한 찌르기가 용에게 노딜이던 버그 — 다단히트 조각의 방어 이중부담 수정
- 신고: "11연속 무한 찌르기를 용한테 썼는데 데미지가 안 들어감. 일반 몬스터한테는 들어가는데."
- 근본원인: calculateCombatDamage 는 공격-방어 gap ≤ -20 이면 0 인 하드 게이트. 무한 찌르기는 공격력 40%
  조각 ×11 인데 각 조각이 용 방어 85 를 **전액** 상대 → 조각 전부 게이트에 막혀 0×11. 일반 몬스터는 방어가
  없어 정상. 부수: 조각마다 dragonCounterAttack 발동 → 노딜인데 11연속 반격까지 당함.
- 수정: applyProjectileDamage 에 ProjectileDamageOptions { armorScale, counter } 신설(combat.ts).
  연격 조각(난도·무한 찌르기 공용 updateSamuraiFlurries)은 armorScale=1/타격수(방어를 스킬 1회당 총 1번만
  부담) + counter 는 마지막 조각만 true(즉시반격 연격당 1회, 중간 조각은 어그로만 걸어 AI 자연 반격).
  필드 보스(방어 보유 wildPredator) 조각도 동일 원칙. 단일 히트(도약·월광베기·일반 투사체)는 기존 동작 불변.
- 검증: verify 그린 + combat-test 회귀 가드 5건(비스케일 조각 차단 유지·스케일 조각 피해·중간 반격 억제+어그로·
  마지막 반격 1회·필드보스 스케일) + 실브라우저 E2E(용 hp 1000→991 실피해(이전 정확히 0)·즉시반격 스팸 없음·
  일반 몬스터 회귀 없음).

## 2026-07-04 — 조작법·퀘스트 패널 접기/펼치기 (화면 가림 완화)
- 유저 요청: 좌상단 조작법 가이드와 우상단 퀘스트 카드가 화면을 많이 가림 → 접기/펼치기 토글.
  (전체화면은 동작 확인됨 — 이번 작업 대상 아님.)
- 구현(전부 leaf UI + CSS, main.ts 0 변경 — 라인 예산 9339/9339 여유 0 이라 의도적으로 회피):
  ①`ui/collapsiblePanel.ts`(신규 leaf) — 컨테이너에 `.collapsed` 토글 + localStorage 영속(`yunu:collapse:*`),
    try/catch 로 사생활 모드 무시. ②조작법: `controlsGuide.ts` 타이틀에 토글 버튼, `setupUi` 기존 위임 클릭에
    분기 추가. 접힘 시 키칩 그룹만 숨기고 퀵버튼(가방·캐릭터·파티)+타이틀 유지. ③퀘스트: `hudRenderer` 가
    토글을 **`.objective-card`(버튼) 바깥 형제**로 렌더 → main 의 카드 클릭(보상 수령/가이드) 핸들러가
    `closest(".objective-card")` 로 자연히 무시. `setupUi` 가 objectiveEl 에 별도 위임 리스너 + 초기 상태 복원.
    접힘 시 상세·보상·행동힌트 숨기고 헤더(제목·진행도) 유지.
- 왜 형제 배치인가: 카드가 `<button>` 이라 내부 중첩 버튼은 무효 HTML + 클릭이 보상 수령과 충돌. 형제로 빼서
  main.ts 수정 없이(예산 0) 충돌도 원천 차단. `.collapsed` 클래스는 컨테이너에 있어 카드 innerHTML 재렌더에도 보존.
- 검증: 헤드리스 브라우저(chromium) 실게임 진입 후 계측 — 두 토글 present+hittable(canvas 위 pointer-events
  정상), 조작법 그룹 표시→접힘/퀵버튼 유지/재펼침, 퀘스트 상세 접힘/제목 유지, **접기 클릭이 보상 모달을 열지
  않음**(rewardModalOpened=false), 새로고침 후 접힘 상태 복원. + verify 게이트(typecheck·size·methods·
  architecture·hotpath·systems 등) 녹색. save-roundtrip 은 여전히 기지 제약으로 스킵.

## 2026-07-04 — 누적 처치 퀘스트 300~700 추가
- 유저 요청: 누적 처치 300·400·500·600·700 퀘스트를 적당한 단계/레벨에 추가.
- 기존 체인(predatorKills 기준): 3→30→100→200 이 최대였음. 200 뒤 엔드게임 구간에 5개 삽입:
  hunt_300(권장 60·요새보스3 뒤), hunt_400(65·용장비 입문 앞), hunt_500(70·3차전직 앞),
  hunt_600(75·용장비 풀세트 앞), hunt_700(90+·4차전직 앞). 각 milestone 직전에 오도록 배치.
- ⚠️ 함정(다음 작업자용): 퀘스트 보상 XP 는 `scaleQuestRewards` 가 인덱스로 2.0→5.0 배 자동 보간하고
  label 의 "경험치 N" 도 재작성한다. content-test 는 **스케일 후 XP 가 이전 단계보다 낮으면 실패**(단조 비감소)
  + label↔XP 일치를 강제한다. mult 는 인덱스마다 미세 증가라 base XP 순서가 지배적 → 새 퀘스트 base 를
  양옆 이웃 사이 값으로 잡아야 함(요새보스3 1850 → 300:1900 → 용장비1 1950 → 400:1975 → 3차 2000 →
  500:2200 → 용장비올 2400 → 600:2600 → 700:2900 → 4차 3200). 임의로 낮추면 단조 위반으로 깨짐.
- 보상 아이템은 인접 엔드게임 퀘스트와 동일 계열(제련된 다이아·고급 구급상자·날카로운 흑요석)만 사용(isItem 검증 통과).
- 검증: typecheck·content(단조/라벨/아이템)·systems·balance 등 게이트 녹색 + tsx 로직 프로브 —
  순서(50~57위, 각 milestone 직전)·완주 게이팅(goal-1=미완/goal=완료)·진행 타이틀 표기 확인.

## 2026-07-04 — 파티 공유 3계통 종합 수정: 필드보스/드래곤 공유 + 직접 지은 집 공유 + 보급 결과 회신
- 신고: ①필드보스·드래곤이 파티에 공유 안 되고 각자 잡음 ②서로 지은 집이 안 보임(보급 쿨타임만 공유)
  ③게스트 보급 수령품이 이상함(5종 미만·흑요석류만·레어 없음). 4갈래 병렬 진단 워크플로(17건 확정) 기반.
- **필드보스**: (a)게이트 강화 — partyGuestSuppressLocalBosses 신설(게스트+호스트 같은 맵이면 스냅샷이 잠깐
  끊겨도(호스트 실내 등 2초) 로컬 ensure 억제 → "각자 잡음" 근본 차단). (b)토벌 교집합 — 프레즌스에
  defeatedBosses piggyback, 호스트 ensure 를 같은 맵 파티원 교집합으로(구 세이브 호스트가 기처치한 보스도
  미처치 게스트 있으면 재스폰·공유). (c)게스트 단독 처치도 partyKill 로 전파(호스트 릴레이, 중복 가드 무해).
- **드래곤(신설)**: wildPredator 패턴 확장 — 스냅샷 bossKind 편입(collectMobs)·게스트 드래곤 뷰(spawnDragonView)·
  비동기 로컬 드래곤 스윕·combat 근접/원거리 인터셉트(봉인 검사보다 앞=호스트 권위)·hostApplyGuestAttack 드래곤
  판정(방어 공식·어그로·처치 시 호스트가 전리품 롤→partyKill lootItem 지급)·partyKill.bossKind 로 전원 리스폰
  쿨다운·챕터 진행 공유. 용암 드래곤 스폰도 게스트 게이트.
- **집 공유(신설)**: 프레즌스에 homes piggyback(playerOwned 집 목록) → 호스트가 스냅샷에 자기 집+같은 맵 게스트
  집을 정적 entry(villageHouse)로 에코 → 게스트는 "OO의 집" 뷰 스폰(자기 집 에코는 스킵), 호스트는 프레즌스
  기반 직접 뷰(ensureRemoteHouseViews). 뷰=partyTransient·enterable=false(진입은 각자 자기 집만)·playerOwned=false
  (부활/지도 마커 오인 방지)·비충돌. keepStatic 보존으로 호스트 실내 진입 시 깜빡임 없음.
- **보급**: hostClaimSharedSupply 구조체화 — 창고 가득 잔여분은 pickupGrant 로 요청 게스트 인벤 반환(레어 무음
  드랍 해소), 0건 입고 시 쿨타임 보존. supplyResult 회신으로 게스트도 솔로처럼 실수령 목록/사유 메시지.
  게스트 선차단(sharedSupplyCd) + 로컬 감쇠(동결값 과차단 방지).
- 신규 컨텍스트 함수는 optional(구 mock 호환). 골든 갱신 1건(드래곤 kill 은 이제 브로드캐스트) + 신규 골든 블록
  (드래곤/집 스냅샷·게스트 뷰·자기 집 스킵·억제/해제·교집합·supplyResult/pickupGrant 회신·처치 공유 수신).
- 검증: verify 전체 그린. main.ts 래칫 9339/480 여유 0 유지(전부 기존 줄 인라인).

## 2026-07-04 — 전 직업 최초 HP +6 (10→16)
- 유저 요청: 모든 직업의 최초 hp +6.
- 변경: `BASE_PLAYER_MAX_HEALTH` 10→16 한 줄. 이 상수는 직업 무관 공용 base 라(HP 를 직업별로 나누는
  필드 없음) 7직업 전부 +6 균등 적용. 레벨(+2/lv)·훈련·장비 보너스는 이 위에 가산되어 전 레벨 +6 시프트.
- ⚠️ 마이그레이션 불필요(다음 작업자용): 로드 시 `maxHealth = max(save.maxHealth, maxHealthForLevel())`
  (main.ts:6327)라 기존 세이브도 재계산값(+6)이 더 커서 자동 상향되고, 절대 낮아지지 않음. 별도 SAVE_VERSION
  올릴 필요 없음. save-migration-test 도 리터럴이 아니라 `maxHealthForLevel` 함수로 기대값을 잡아 자동 정합.
- 검증: typecheck·save-migration·content·systems·balance·combat 등 녹색 + tsx 프로브(Lv1 10→16, 전 레벨 +6 시프트).

## 2026-07-04 — 데스크톱 기본 전체화면 + 인게임 전체화면 아이콘
- 유저 요청: ①데스크톱 게임 시작 시 기본 전체화면 ②ESC 로 전체화면이 풀리지 않게, Alt+Enter·아이콘으로만 전환.
- ①: `enterLandscapeFullscreen` 의 `!isTouchDevice()` 조기 반환 제거 → 데스크톱도 requestFullscreen(가로잠금은
  여전히 실제 모바일만). 호출부(main.ts onTitleNew/onTitleLoad)는 그대로라 main.ts 0 변경(leaf만).
- ②아이콘: 조작법 헤더에 ⛶ 버튼(`data-fullscreen-toggle`) 추가 → setupUi 위임 클릭에서 toggleFullscreen()
  (클릭 제스처 내 동기 호출). Alt+Enter 는 기존 유지.
- ⚠️ 브라우저 제약(다음 작업자용): **웹은 ESC/F11 로 브라우저 전체화면이 풀리는 걸 API 로 막을 수 없다**(보안/UX
  하드 가드). preventDefault 불가, fullscreenchange 에서 자동 재요청도 제스처 없으면 차단. 대신 게임은
  pointer lock 을 쓰므로 Chrome 에서 인게임 ESC 는 마우스만 풀고 전체화면은 유지되는 경우가 많다. 재진입 경로를
  ⛶·Alt+Enter 로 제공하는 게 현실적 최선. "ESC 완전 차단"은 불가하다고 유저에게 명확히 안내함.
- ⚠️ CSS 함정: 접힘 셰브런 회전(`rotate(-90deg)`)이 `transition: transform` 때문에 `none↔rotate` 보간이
  안 먹어 identity 로 남던 버그 — transform 트랜지션 제거(배경만 트랜지션)해 즉시 회전으로 수정. ⛶ 아이콘은
  회전 대상에서 제외(`[data-guide-collapse]`/`[data-quest-collapse]` 로 한정).
- 검증: 헤드리스(chromium, vite createServer 동일 프로세스)로 계측 — 새 게임 클릭이 requestFullscreen 호출(HTML),
  ⛶ present+hittable+클릭 시 requestFullscreen 호출, 접힘 시 셰브런 rotate(-90)·⛶ 미회전, 그룹 숨김. + verify 게이트 녹색.

## 2026-07-04 — F8 어드민 밸런스 패널 (1단계 로컬 실험 + 2단계 Firebase 전체 적용)
- 유저 승인 설계: 크레딧 소모 없이 주요 밸런스를 직접 조정. 게임 내 숨김 패널(F8, 조작 안내 미표기).
- **balanceTuning.ts(leaf)**: 튜너블 레지스트리 21개(사무라이 8종·전투/성장 6종·보급/아이템 5종·내구도 2종) —
  화이트리스트이자 UI 정의(label·min/max/step·def). 우선순위 = 로컬(localStorage 실험) > 전역(Firebase) > 코드 기본값.
  sanitizeOverrides: 미등록 키 폐기 + [min,max] 클램프 + 비유한 폐기 — Firebase 공개 쓰기라도 게임 못 망가뜨림.
  전역 경로 = users/__balance__/global.json(기존 공개 규칙 재사용 — /balance 경로는 401이라 이전. 규칙 변경 불필요).
- **adminPanel.ts(leaf)**: 그룹별 슬라이더+숫자입력+개별 리셋, 이 기기 초기화 / 🌐전체 적용 / 🌐전역 초기화.
  전체 적용·전역 초기화는 PIN(7777) 게이트 — 아이 오조작 방지용(보안 아님, 클램프가 안전망). 적용 시 로컬 실험값을
  전역으로 승격 후 비움. 부팅 1회 fetch(3s 타임아웃, 실패=기본값).
- **주입 지점**: bal(key, 기본값) — samurai.ts(스윙·카타나 공/공속·난도·도약 피해/폭·찌르기·월광), combat.ts(vary
  Player/MonsterDamage 배율), monsters.ts(XP 배율·드래곤 hp/방어), homeBase.ts(보급 확률 3종), items.ts+tanker.ts
  (흑요석 방패 내구도·수리량), main.ts(드랍률 배율·정령권 드랍률). 오버라이드 없으면 완전 동치(골든 안전).
- 검증: verify 그린 + 골든(레지스트리 유효성·클램프/화이트리스트·우선순위·기본 동치·실함수 관통) + 실브라우저 E2E
  (부팅 GET+오염값 클램프(99999→3000)·F8 패널·슬라이더 즉시 반영(난도 1.5×100=150)·리로드 유지·PIN→PUT·로컬 승격).
- main.ts 래칫 여유 0 유지(임포트 병합·인라인). ★def 는 코드 기본값과 일치 필수 — 코드 수치를 바꾸면 레지스트리 def 도 갱신(골든이 강제).

## 2026-07-04 — 어드민 재설계: F8 제거 → 바탕화면 독립 관리자 + 직업별 레벨업 성장
- 유저 요청: 게임 내 F8 방식 폐기. 이 PC 바탕화면의 별도 실행 파일(게임과 독립된 어드민 창)에서 조정해
  전 기기 배포. 직업별 레벨업당 능력치 성장도 설정 가능하게.
- **F8 완전 제거**: keydown·renderPanel 분기·PanelType "admin"·adminPanel.ts·CSS 삭제 — 게임(모든 기기)에
  어드민 진입점 없음. balanceTuning.ts 의 부팅 전역 fetch(반영 경로)만 게임에 잔존.
- **직업별 성장 21종 추가**(레지스트리 총 42개): levelup_{hp|attack|defense}_{7직업} — 레벨보너스 유입 3지점
  (maxHealthForLevel ×2 / bodyMeleeAttackPower·currentRangedDamage +1 / currentArmor +1)에 bal 배수 주입,
  레벨업 메시지도 동적화(오버라이드 시 거짓 표기 방지). 기본값 = 기존과 완전 동치.
- **바탕화면 관리자**: scripts/build-admin-html.mjs 가 레지스트리(단일 진실)에서 admin/balance-admin.html 을
  생성(자체 완결 HTML — Firebase REST 직접 GET/PUT/DELETE, 비기본값만 저장, 미등록 키 재저장 안 함).
  npm run build:admin / check:admin(verify 편입 — 레지스트리 변경 후 재생성 안 하면 빨강).
  바탕화면 사본 = C:\Users\서현범\Desktop\YUNU 밸런스 관리자.html (더블클릭 → 브라우저. 레지스트리 변경 시 재복사).
- 검증: verify 그린(check:admin 포함) + E2E — 어드민 HTML(42개 렌더·GET 반영·PUT 비기본값만·미등록 키 폐기·
  DELETE) + 게임(성장 오버라이드: 사무라이 lv11, 레벨당 체력 2→4 = 최대체력 +20 정확).

## 2026-07-04 — 정령(펫) 파티 선물 기능
- 유저 요청: 펫을 친구한테 줄 수 있게. 대상 = 정령(SpiritData, 소환권 가챠로 얻는 펫).
- UI: 캐릭터창(K) 정령 보관함 — 파티 중이면 비장착 정령 카드에 🎁 버튼. 파티원 1명이면 즉시(확인창),
  여럿이면 닉네임 입력. 장착 정령은 선물 불가(버튼 미표시+가드).
- 프로토콜: spiritGift 메시지(to/from/spirit) + PARTY_PROTOCOL_VERSION 3→4(구버전 접속 차단 — 양쪽 새로고침 필요).
  게스트→게스트는 호스트 릴레이(partyKill 패턴). 수신자만 적용(to 필터).
- 수신 방어: sanitizeGiftedSpirit(spirits.ts) — 등급 화이트리스트·스탯 등급범위 클램프·비유한 폐기·id 충돌 시 재발급.
- ★복제 차단(원장): 합성 키 `__spirit__:{JSON}` 로 partyLedger 에 양도(-1)/수령(+1) 기록 —
  reconcile add/remove 가 접두사 분기로 정령 컬렉션에 재적용. 선물 후 옛 세이브 로드해도 준 정령은
  안 돌아오고(복제 0), 받은 정령은 유지(유실 0). 장착 중이던 선물 정령 제거 시 equippedId 해제.
- 검증: verify 그린 + 골든(수신자 필터·호스트 릴레이·from 스탬프·partyMemberNames·v4) +
  spirits-test(정규화 5종) + 실브라우저 E2E(원장 재적용: sp-give 미복귀·sp-recv 유지).

## 2026-07-04 — 밸런스 관리자 UX: 하단 상태 표시 + 처리 중 버튼 잠금
- 신고: 버튼을 눌러도 메시지가 없어 처리 여부를 알 수 없음 — 상태 표시가 페이지 상단에만 있어
  42개 항목을 스크롤한 뒤 하단(스티키) 버튼을 누르면 결과가 화면 밖이었음.
- 수정(build-admin-html.mjs 생성기): 스티키 액션 바 안에 하단 상태줄 추가(상/하단 동시 갱신, ✅/❌ + 색상),
  처리 중 전 버튼 disabled(중복 클릭 방지·진행 시각화). 재생성 + 바탕화면 사본 갱신.
- 검증: E2E — 전체 적용 클릭 → 하단에 "✅ 전체 적용 완료 — 오버라이드 1개 저장…"(ok 스타일) 표시.

## 2026-07-04 — F4 치트 아이템 소환을 서버 PC 직접 실행 URL에서만 허용
- 유저 요청: F4 아이템 소환을 공개 배포 URL 접속 시에는 불가, 서버 PC 직접 실행 URL에서만 유지.
- `platform.ts` 에 `isLocalGameHost(hostname?)` leaf 헬퍼 추가 — localhost/127.0.0.1/::1/""(file://)/.local/
  사설 LAN(10.·192.168.·172.16~31.)이면 true, 그 외(공개 배포 *.github.io·공인 IP·커스텀 도메인)는 false.
  hostname 인자는 테스트용(미지정 시 window.location.hostname).
- main.ts F4 핸들러 게이트: `if (event.code === "F4" && isLocalGameHost())` — 배포에선 패널이 아예 안 열려
  소환 버튼 접근 불가(방어 충분). import·조건 모두 기존 줄 인라인 수정이라 라쳇 9339/480 여유 0 유지.
- 설계 판단: 차단 방식이 아니라 **허용 리스트(local/LAN)** 로 — 커스텀 도메인 배포까지 자동 차단. file://("")
  는 서버 PC 직접 파일 실행에 해당해 허용.
- 검증: systems 테스트에 isLocalGameHost 양/음성 케이스(localhost·LAN·.local·file ↔ github.io·공인IP) 추가 녹색
  + 헤드리스 E2E(localhost 에서 F4→cheat-panel 오픈 확인). verify 게이트 녹색.

## 2026-07-04 — 시작 초원·용용평원 몬스터 밀도 ×1.5 (렉 심한 큰 마을 인접 제외)
- 유저 요청: 시작 초원(starter_valley)·용용평원(dragon_plains) 몬스터 1.5배↑. 단 렉 심한 마을 인접은 제외,
  저부하 지역 중심으로 증량.
- 밀도: `wildlifePredatorTarget` 를 boolean(isDefaultMap) → mapId 기반 per-map 으로 변경(PREDATOR_TARGET_BY_MAP).
  starter 60→90, dragon_plains 78→117(둘 다 ×1.5), 나머지 7맵 78 불변. 고품질 216/281, 저사양 77/99.
  main.ts 호출부 2곳은 boolean→mapId 인자로 동일줄 수정(라쳇 9339/480 여유 0 유지).
- 렉 회피: safeZones.ts 에 `isNearHeavyVillage(x,z)` leaf(무할당) — special(큰) 마을 2곳 반경 70 버퍼.
  randomPredatorSpawnPoint 리젝트 조건에 OR 추가(동일줄) → 시딩·리스폰·야간 스폰 전부 큰 마을 인접 회피.
  일반 마을·훈련장은 기존 isInSafeZone(8 마진) 그대로.
- ⚠️ perf-check(다음 작업자/PC): 이 환경(Linux)은 Windows Chrome 경로 하드코딩이라 perf-check 실행 불가(save-roundtrip
  과 동일 제약). 시작맵 포식자 +72(144→216)라 field 프로파일 상승 예상 — fieldObjects 는 ~1486<1520 으로 통과
  가능하나 **fieldVisibleMeshes(예산 4650)는 스폰 지점 부근 밀도 ×1.5 로 초과할 수 있음**. PC 에서 `npm run perf-check`
  재측정 후, 의도된 콘텐츠 증량이므로 초과 시 field 예산을 측정값+마진으로 재기준(2026-06-20 마을 대형화 때와 동일 패턴).
- 검증: typecheck·size·methods·architecture·hotpath·systems·content·combat·balance 녹색 + tsx 프로브
  (맵별 목표 216/281·타맵 187 불변·×1.5 비율·버퍼 true<70/false≥70·일반마을 제외).

## 2026-07-04 — 서브퀘스트 시스템 신규 도입 (레벨 20+)
- 유저 요청: 퀘스트창 아래 서브퀘스트 창(레벨 20+). 3개 랜덤 오퍼 중 택1, 5분 쿨 새로고침, 포기 시 오퍼 재노출.
  종류(몬스터 처치·재료 채집·보물상자·보급상자·동굴의 주인)·수치·난이도(희귀도)별 보상 차등 + 배경색.
- 아키텍처(리프 우선): `game/subquests.ts`(로직·데이터·정규화)+`ui/subquestPanel.ts`(렌더). main.ts 는 상태 필드 +
  `syncSubquests` 오케스트레이션 1메서드 + 이벤트 훅(kill/chest/supply/caveBoss 인라인)·save/load·setupUi 배선만.
- 진행 판정: kill/chest/supply/caveBoss = 선택 중 일치 이벤트 발생 시 진행+1(SubquestState.progress 에 직접, 세이브 보존).
  gather = 수락 시점 보유량(gatherBaseline) 기준 "추가 채집분"의 **최댓값**(만들어 쓰거나 버려도 감소 안 함) — 유저 결정.
- 희귀도 4단(일반/희귀/영웅/전설) — 가중치·목표·보상·배경 그라디언트/테두리색. 전설일수록 목표↑·보상↑(경험치+아이템).
- 세이브: SAVE_VERSION 14→15, player.subquests 추가(types+saveManager 스냅샷+saveMigration 조건부 정규화).
  sanitizeSubquestState 로 손상/구세이브 방어(오퍼 3개 미충족→null, 현재 오퍼에 없는 selected→무효). 구세이브는 기본값.
- 렌더 성능: renderHud 에서 syncSubquests 호출하되 시그니처 캐시로 **변경 시에만 innerHTML**(매 renderHud 재렌더 방지).
  패널은 퀘스트 카드와 `.right-hud-column` 플렉스로 묶어 카드 높이(접힘 등) 무관하게 아래로 스택.
- ⚠️ 라쳇 상향(정당): 새 기능 배선으로 main.ts 9339→9371(+32)·메서드 480→481. 로직·UI 는 전부 리프라 §1(추출 후 배선만) 준수.
  MAX_MAIN_LINES·MAX_METHODS 를 실측값으로 갱신하고 근거 주석 남김.
- 검증: 전 게이트 녹색 + systems 유닛(오퍼 구조·kill/gather 진행·완료·쿨다운·sanitize·UI 렌더 3상태) +
  실브라우저 E2E(right-hud-column 이 퀘스트+서브퀘 포함·레벨1 숨김·퀘스트 카드 정상·무에러). save-roundtrip/visual-check/
  perf-check 는 이 환경(Windows 전용) 실행 불가 — PC 에서 확인 권장(특히 save-roundtrip 로 v15 왕복).

## 2026-07-04 — 서브퀘스트를 마을 이장 NPC 방식으로 전환 + 주민 수 감소
- 유저 요청: 모든 마을에 이장 NPC 추가. 서브퀘스트는 이장에게 말 걸어 3개 중 택1. 보상도 이장에게서 수령 —
  가져다 달라는 재료/아이템이 있으면 제출하고 받음(제출형은 보상 상향). 렉 감소 위해 주민 수 축소.
- 이장 NPC: `npcSpawns.spawnVillageChief`(리프) — 정지형 남색 로브 원로(저메시). 모든 마을에 1명
  (spawnVillage 신규 + restoreWorldObject 로드 + ensureVillageShops 백필=구세이브·전 마을 소급). villageChief 타입 추가.
  E 직접 조준 우선(대장장이와 동일 패턴). hp 없음=비전투(퀘스트 지급자 보호).
- 상호작용 전환: 평상시 HUD 패널은 **읽기전용**(진행 표시 / 미선택 시 "이장에게 받으세요" 힌트). 이장 대화(E) 시
  `subquestDialog=true` + 포인터락 해제 → 같은 패널이 인터랙티브(3택1·새로고침·포기·보상받기)로 전환. ESC(closePanel)로 닫힘.
  기존 subquestEl + setupUi 위임 리스너 재사용 → 새 패널레이어 모달 불필요(main 최소 증가).
- 보상 수령 이장화: syncSubquests 는 완료 감지만(자동 지급 제거). claimSubquest(이장)에서 지급 — 제출형(gather)은
  countItem 검증 후 removeItem 로 소비. gather 진행 = 보유량 기준(min(target,보유))으로 변경(제출 전제).
- 제출형 보상 상향: rollSubquest 에서 gather 는 경험치·아이템 수량 ×1.6(SUBMISSION_REWARD_MULT).
- 주민 수: 데스크톱 special 12→6 / 일반 7→3 (모바일 유지). 이장 1명 추가분 상쇄 + 순감소.
- ⚠️ 라쳇: main 9371→9390(+19)·480→... 482(claimSubquest 1). 로직/NPC 메시는 리프, main 은 배선만.
- 검증: 전 게이트 녹색 + systems 유닛(gather 보유량 진행·제출 재료·비제출 null·제출형 보상>비제출·UI 5상태:
  숨김/passive힌트/dialog오퍼/미완료포기/완료보상) + 실브라우저 E2E(3마을 이장 시드 무에러·패널 정상).
  save-roundtrip/visual/perf 는 Windows 전용이라 이 환경 미실행 — PC 확인 권장.

## 2026-07-04 — 서브퀘스트/이장 적대적 테스트 (빡시게)
- 대상: 직전 서브퀘스트+마을 이장 기능. 상태 누수·클레임 악용·세이브/이벤트 엣지 공격적 점검.
- **확정 버그 1건 수리**: `resetGameState` 가 `subquests` 는 리셋했지만 `subquestDialog` 플래그는 안 함 →
  이장 대화창을 연 채 세이브 로드/새 게임하면 dialog 플래그가 누수돼 이장 없이도 패널이 인터랙티브(선택/버튼)로
  뜨는 버그. `this.subquestDialog = false` 추가로 수리(closePanel·pick·claim 은 이미 해제하지만 reset 경로 누락이었음).
- 악용 벡터 점검(문제 없음 확인): ①claim 은 소비 직전 countItem 재검사 → 재료 부족 시 무소비 반환(무한/공짜 없음).
  gather 제출은 removeItem 로 슬롯이 비므로 보상 아이템이 오히려 더 잘 들어감(보상 유실 아님). ②pick/claim/refresh/
  abandon 버튼은 dialog 모드에서만 렌더 → 이장 없이 클릭 불가. ③이장은 hp 없음=비전투(퀘스트 지급자 사살 불가).
  ④이벤트 진행은 선택+종류 일치+target 상한에서만(가짜 진행 없음), gather 는 폴링 전용(이벤트로 안 오름).
- 적대적 단위 테스트 추가(systems): 이벤트 게이팅(무선택/불일치/gather무시/상한)·폴링 게이팅·완료 게이팅·
  sanitize(유효선택 유지·progress target 클램프·쿨다운 보존·오퍼<3→null·선택 오퍼외→null·손상→기본)·새로고침 경계.
- 브라우저: F4 치트가 localhost 에서 열림(직전 F4 게이팅도 재확인)·경험치병 레벨업 동작·**레벨 20 미만 패널 숨김
  정상**·3마을 이장 시드 무에러. (레벨 20 도달 후 패널 노출은 UI 유닛 렌더 테스트로 커버 — 헤드리스 병 소비로 20 도달은 비현실적이라 생략.)
- 전 게이트(19종) 녹색.

## 2026-07-04 — 최종 보스 '일리아' (차원의 문·컷씬·2페이즈 패턴 보스·엔딩)
- 불멸의 존재(챕터 완주) 뒤 진짜 최종 콘텐츠 추가. 상세 설계 = docs/illia-final-boss.md.
- 흐름: 불멸 처치→차원의 문(용의 땅, 세이브 소급 ensure)→진입 시 각성 컷씬(~10초, Space/클릭 스킵,
  레터박스+카메라 연출+봉인석 균열→파열)→봉인된 군주(P1, 사슬 고정, 붉은 텔레그래프 6패턴+졸개 소환,
  피격=최대체력 50% 튜너블)→사망 시 미드랍·입구 부활·보스 풀피 리셋→P1 처치→해방 컷씬(사슬 파괴→3쌍
  흑익 각성)+저장 confirm(문 앞 오버월드로 스왑 저장)→절망의 군주(P2, 이동 해금, 돌진·비행 투척 등
  신규 5패턴)→클리어 시 기존 크레딧+신규 CC0 엔딩 BGM(ending.mp3, Alex McCulloch).
- 신규 leaf: illiaBoss.ts(텔레그래프 엔진+컷씬 시퀀서+오버레이), illiaVisuals.ts(보스/봉인석/차원문 모델),
  interiors createIlliaArenaInterior. main 배선은 전부 화살표 필드/인라인(라쳇 9376/480 bump 사유 주석).
- 세이브: illiaProgress 0/1/2 5곳 규칙 + 결전 중 저장 차단. 재진입 시 progress>=1 이면 즉시 P2.
- 부수 정정: BOSS_STATS 테이블 내 bal() 이 모듈 로드 1회 평가라 전역 튜닝 미반영이던 버그 —
  dragon_hp/armor 를 스폰·보스바 시점 평가로 이동. 어드민 튜너블 5종 추가(총 47, 바탕화면 사본 갱신).
- 검증: illia-test(기하 골든·수명주기·P2 경계 2분 시뮬·컷씬 1회 보장·def 골든·세이브 왕복) verify 편입
  녹색 + 실브라우저 E2E 전 시나리오(피격 16→6, 사망 특례, 저장 슬롯 검증, 엔딩 BGM 로드) 콘솔 오류 0.
- 적대 리뷰(3렌즈→반박 검증) 확정 9건 반영: ①leaveCave 에 컷씬 수동 해제(파티 summonTo 가 컷씬 중
  이탈시켜도 카메라 강탈·보스 오버월드 누출 없음) ②패널 열림=일시정지(타이머 시프트 — 닫는 순간
  몰아치기 방지, dragonAi 정책 정합) ③텔레그래프 폭발 선분리+사망 시 볼리 중단(배열 리셋 TypeError
  제거) ④근접 막타 경로에도 일리아 분기(전리품 파밍 차단+전용 메시지, combat-test 골든 갱신)
  ⑤illiaInArena 통합 저장 가드(수동+자동저장+navGuard, 승리 후 잔류 포함 — 스왑 저장만 예외)
  ⑥텔레그래프 geometry/clone 재질 dispose ⑦일리아 공유 재질 15종+아레나 공유 자산 dispose-skip
  레지스트리 등록 ⑧기본 드래곤 보스바 분모 dragon_hp 튜너블 반영(스폰 시점 평가 전환의 잔여 회귀)
  ⑨스왑 저장 슬롯가득 모달은 ②로 안전화. illia-test 에 일시정지·볼리 중단 회귀 추가, E2E 2차
  (저장 차단·패널 정지·근접 무전리품 포함) 전부 녹색.

## 2026-07-04 — 마을집·대장간 안 상자 20분 쿨타임
- 신고: 마을집·대장간 안 상자가 입장할 때마다 계속 열려 무한 약탈 가능. 원인: enterHouse→createHouseInterior 가
  입장마다 새 상자를 스폰(개봉 상태 미추적)이라 매번 초기화됨.
- 수정: 집 오브젝트에 `houseChestReadyAt`(epoch, 세션 한정 미저장) 추가. enterHouse 가 쿨타임 경과 여부(chestReady)를
  판정해 createHouseInterior 에 전달 → 쿨타임 중이면 상자를 **이미 연 상태로 스폰**(재약탈 차단). 상자 개봉 시
  (locationMode==="house") 해당 집에 20분 쿨타임 세팅. HOUSE_CHEST_COOLDOWN_MS=20분(constants).
- 범위: 비소유 마을집·대장간의 안 상자만 대상(소유 집은 이미 보급상자 쿨타임 사용). 입장 시 쿨타임 중이면 남은 분수 안내.
- 세션 한정(집 id/오브젝트는 리로드 시 재생성이라 미저장) — 반복 입장 재약탈은 완전 차단, 리로드 리셋은 허용(경미).
- 검증: 전 게이트 녹색 + systems 유닛(createHouseInterior chestReady=true→미개봉 / false→이미 연 상자 / 쿨타임 20분 상수).
  리프(interiors)에서 chest.opened 세팅, main 은 집 오브젝트 추적·쿨타임 판정/세팅 배선만(라쳇 리베이스 합류 실측 재기준).
- 일리아 피격 데미지 혼합화: 순수 최대체력% → (최대체력×illia_hit_pct[0.5→0.2, 방어무시]) +
  (illia_hit_flat[신규 100] 공격력×랜덤·방어감소, 일반 피격과 동일). 고체력·고방어 전사/탱커가
  방어 투자로 실제 경감받도록(순수 %는 방어 무시라 불리했음). applyPlayerHit 산식 rewrite,
  어드민 튜너블 48종. 실측 방어0 ~214 / 방어220 ~116, illia-test 골든·verify·E2E 녹색.
- 일리아 아레나 결계·이펙트·컷씬 강화(사용자 피드백 3종): ①원형 결계 반경 16 — 카이팅 차단,
  아레나를 오버월드 밖 ILLIA_CENTER_Z(-1250)로 이전(기존 -875는 월드 안이라 용의 땅 나무 노출,
  ★cave 복도 클램프 견인 함정 → illiaInArena 분기), 결계벽·심연 돔, 패턴 사거리 결계 기준 재조정
  ②텔레그래프 수축 링+색 램프+스트로브, 폭발 빛기둥+볼리 폭음+피격 비네트 ③컷씬 화면 진동·균열
  발광(내부 광원+광선+크리스탈 emissive)·파열 파편 비산·섬광 + 시네마 모드(HUD/1인칭 손 숨김).
  illia-test 결계·기둥 수명 회귀 추가, E2E(연출·결계·회귀)·실화면 스샷 검증, verify 녹색(라쳇 9436).
- 난이도 배율 확충(사용자 요청, Codex 텔레그래프 리팩터 55b5217 위 재적용): ①일리아 4항목 쉬움→어려움
  자동 배율(armor×monsterDefense, hit_pct·hit_flat×monsterAttack, telegraph_scale×bossTelegraph 0.85
  [신설 필드]). 기존 HP만 ×1.5였음. ②드래곤 공격 난이도 미반영 死코드 수정 — AI/반격 발톱·브레스 전
  지점 ×monsterAttack(불멸 포함). 실측 E2E: 일리아 HP 3000→4500·방어 90→117·피격 212→280, 드래곤
  14→18(×1.3). difficulty-test bossTelegraph + illia-test 예고배율(딜레이 비율) 골든, verify 녹색.- 몬스터 던전 도약 프리징 근본 수정(사용자 신고: 요새에서 도약 쓸 때마다 끊김·완전 정지→브라우저
  강제종료·세이브 유실): 원인 = damageParticles 무제한. spawnEnemyHitParticles 가 대상당 26개(비풀링)
  스폰 → 도약이 밀집팩 수십 대상 동시 타격 시 한 번에 1700+ 파티클, updateDamageParticles 의 프레임당
  O(N) 순회+렌더가 폭주. 여러 번 도약하면 15,556개+ 누적 → 프레임 붕괴=프리징. 수정 3중:
  ①combatEffects DAMAGE_PARTICLE_CAP(700) 하드 상한 — cullExcessDamageParticles(leaf)가 매 프레임
  초과분 컬링(정본, main 은 1줄 호출) ②spawnEnemyHitParticles 예산 가드(상한 근처면 스폰 축소)
  ③도약 스윕 이펙트 SAMURAI_DASH_EFFECT_CAP(8) — 앞 8대상만 이펙트, 피해는 전원. 실측: 3000 주입
  →700 컬링, 15회 연속 도약 매번 ~700 안정(이전 15556 무한증가). samurai/combat 골든 + verify 녹색.
- 고레벨 경험치 가중(사용자 요청: 100레벨+ 레벨업 어렵게, 어드민 조절): 기존 XP 곡선
  22.5·level^1.35 는 레벨대 가중 없었음. XP 곡선이 main.ts·saveMigration.ts 두 곳 중복 →
  saveMigration 정본으로 통합(main 은 위임, XP포션 경로도 동일 곡선). 튜너블 2종:
  xp_hardcap_level(기본 100) + xp_hardcap_factor(기본 1.035, 시작 레벨 이상 레벨당 복리 가중,
  1=없음). 기본 곡선: L99 불변 → L100 ×1.04 → L130 ×2.9 → L150 ×5.8 → L200 ×32. ★안전:
  factor max(1,·) 클램프 — 0/음수면 required 0→레벨업 while 무한루프라 코드에서 하드가드.
  어드민 튜너블 50개(바탕화면 사본 갱신). save-migration 골든(불변/가중/단조/클램프) + E2E
  (1e12 XP 4ms 유한종료·튜너블 실효) + verify 녹색.
- 부팅 인트로 트레일러 v2 + 인게임 원근 헤이즈(사용자 요청: AAA 레퍼런스 이미지 2장 수준, 블룸 과금지·렉 0):
  ①인게임 — timeOfDay TIME_OF_DAY_STOPS 에 fogNear 키프레임 신설(기존 near=70 하드코딩 제거). 새벽/황혼
  38~46(근거리 헤이즈=원경 레이어감), 한낮 92(시야 확보). 무드는 fogFarScale 로 near 도 비례 축소(비율 유지).
  ②트레일러 — illiaVisuals createIntroVista/animateIntroVista(leaf): 원경 산맥 실루엣 2겹 링(공유 ConeGeometry,
  결정적 의사난수 높이), 역광 태양 세트(디스크+글로우 2겹+갓레이 팬 9+구름 실루엣 저불투명 2겹 밴드),
  활공 독수리(createEagleAvatarModel 재사용, 글라이딩=날갯짓 불필요·무할당 뱅킹). illiaBoss intro 분기 재작성:
  vista 는 props 등록(자동 정리), 매 프레임 안개/배경 오버라이드(금빛 헤이즈 near44/far560, 숫자 대입만)+
  Sky 돔 숨김(updateTimeOfDay 가 매 프레임 되켜므로 참조 잡고 재차 끔 → 종료 후 자동 복원, 별도 정리 코드 0).
  카메라 3막: 하이에어리얼 태양 응시 푸시인(컷)마을 로우 스윕(컷)상승 크레인. 전부 컷씬 10초 한정 소품이라
  게임플레이 프레임 예산 무관. 모든 게이트+illia-test+fogNear 보간 실측(0~24h·무드) 녹색.
  ★검증 함정(재발 주의): swiftshader 헤드리스에서 page.screenshot 이 수 초 걸려 10초 컷씬 검증 스샷이 전부
  종료 후에 찍힘 — "컷씬이 안 나온다"로 오진해 CSS/카메라를 한참 뒤짐. 컷씬 시각 검증은 반드시
  ①모듈 import 로 강제 발동 ②startedAt 을 setInterval 로 핀(원하는 t 고정) 후 캡처(scripts/_tmp_intro_shots.mjs
  패턴). 자동 킥 경로는 navigator.webdriver 게이트라 E2E 에선 안 돎(의도) — Navigator.prototype
  defineProperty 스푸핑으로만 우회 가능하나 저FPS 부팅 레이스로 관측이 불안정하니 강제 발동을 쓸 것.
- 몬스터 요새 5단계 보스 시스템(사용자 요청: 5단계마다 일리아식 텔레그래프 패턴 보스 + 단계 비례 능력치 +
  보스별 트레일러 후 등장): 컨셉 6종 순환(5=전쟁군주 오크·10=삼두 히드라·15=파괴왕 오우거·20=죽음의 기사·
  25=그림자 어쌔신·30=대주술사, 35부터 2주차 가중). 리프 우선 설계로 main 은 배선만(9444줄 — 오히려 2줄 감소):
  ①fortressBossVisuals(신규 leaf) — 모델 팩토리 6종+공유 머티리얼+idle 애니(무할당, userData 계약), sharedAsset
  태그로 dispose 보호 ②fortressBoss(신규 leaf) — 컨셉 데이터·능력치 스케일(monsterStatsFromLevel×배율×주차)·
  패턴 엔진(컨셉당 3패턴, pending 다단 스텝, 패널 일시정지 시 타이머 시프트) ③fortressSiege — bossPhase
  상태기(pending→trailer→fight), 보스 단계=웨이브 1개·스폰 실패 시 일반 강등 안전망, 보상 보너스(전직의서+2·
  다이아 등) ④illiaBoss — 컷씬 kind "fortressBoss"(8s, themeColor 파라미터, 컨셉 색 앰비언스, 3박자 카메라)
  ⑤보스 실체는 기존 요새 몬스터 위에 오버레이(베이스 파츠 숨김+보스 모델 add — 전투/사망/드랍/kill카운트
  경로 재사용, walkCycle 은 헛돌지만 무해) ⑥텔레그래프는 중앙 필드 재사용(active 조건에 fortressSiege 추가,
  예고시간·데미지에 난이도 배율, leaveCave 공통 경로에 필드 청소 추가) ⑦보스바 — siegeBossMaxHp 분모,
  숨김 분기 no-op 가드(요새 매 프레임 호출 대비). fortress-boss-test 신설(컨셉 순환·스케일·상태기 흐름·
  패턴 spec 유효성·보상 골든) + verify 체인 등록. 전 테스트 스위트 녹색, 보스 6종 그리드·트레일러 헤드리스
  실측(startedAt 핀 패턴 재사용). 주의: main onFinish 의 else 폴백은 unseal(저장 confirm) — 새 컷씬 kind 는
  반드시 no-op 분기에 명시하지 않으면 요새에서 일리아 저장 다이얼로그가 뜬다(이번에 intro 분기에 합류시킴).
- 마석(rune stone) 시스템 도입(사용자 요청: 전용 장착창·14슬롯 열쇠 해금·6종×4등급·조합·저확률 드롭):
  ★핵심 제약 = main.ts 예산(줄 9446·메서드 482, 둘 다 여유 0). 탐사(Explore 서브에이전트)로 dragonGear
  "장착=패시브 버프" 모델이 템플릿, ItemId=string(union 편집 불필요) 확인. 메서드 카운터 정규식이
  `식별자(` 만 잡고 `식별자 = (` (arrow 필드)·컨텍스트 객체는 제외 → 전용 패널 렌더러/콜백/refresh 를
  전부 arrow 필드로 두어 메서드 수 482 불변 유지(신규 메서드 0). 줄은 리프에 로직 몰아 배선만 남겨
  9446→9474(사유 ledger 기록, 역대 시스템 배선과 동일 관행).
  ▪리프: game/runeStones(종류·등급·버프합산·슬롯비용·정규화·조합·드롭롤, 순수) + ui/runestonePanel
  (뷰모델+콜백, main import 금지). 6종(힘=공/수호=방/활력=체/지능=마나/신속=이속·공속%/경험=xp%) ×
  4등급(마석결정→마석→마나석→마정석) = 24 아이템 + 마석열쇠. 등급배율 [1·2.2·4.5·9].
  ▪슬롯 14칸(기본 2), 다음칸 해금 열쇠 = index-1(3번째 1개 … 14번째 12개, 완전해금 78개).
  ▪버프 주입: aggregateRuneBonuses 를 refreshRuneBonuses(arrow)로 캐시, 스탯식 6곳에 1항씩
  (bodyMelee/rangedDamage attack, armorValue defense, maxHealthForLevel maxHp, manaCap maxMana,
  이동속도 ×(1+movePct), 공속/원거리쿨 ÷(1+movePct), gainExperience ×(1+xpPct)). 활력 장착/해제
  시 applyRuneChange 가 maxHealth 재계산.
  ▪드롭(저확률): chestLoot 등급별(황금 열쇠4%·마석6% … 흑요석 15%·22%, 광산 5%·10%), combat
  grantRarePredatorEpicDrop(사냥 열쇠0.8%·마석1.5%), fortressSiege itemsForStage(보스단계 확정 열쇠1
  +마석1, 컨셉 순환·15/30단계 등급↑). cap 이 고티어 마석에 밀려 핵심재료 누락 → CHEST_PROTECT 로
  등급별 핵심(gold/diamond/obsidian+dragon_scale) 보존(systems 테스트 회귀 수리).
  ▪세이브: SavedGame.player.runeSlots·equippedRunes 추가, SAVE_VERSION 15→16, migrate 기본값
  (구세이브 2슬롯·장착없음)+정규화, saveManager 스냅샷 필드, main 직렬화/복원(복원 시 refresh).
  ▪content 골든: 마석은 등급 자동 티어라 legendary 큐레이션 골든에서 제외(id prefix "rune_"),
  held-item 비주얼(마석=종류색 발광 보석+T3↑ 룬링, 열쇠=보랏빛 열쇠) 추가로 "돌덩이 폴백" 회귀 수리.
  ▪전용창 KeyJ. rune-stones-test 신설(파싱·합산·슬롯곡선·정규화·조합·엔트리24·마이그레이션왕복) +
  verify 체인 등록. 전 게이트·빌드 녹색(save-roundtrip 은 컨테이너 Chrome 부재로 PC 검증 — 대신
  migrate 왕복을 rune-stones-test 로 커버). 헤드리스 실측: 게임시작→마석지급→장착→패널 스샷으로
  슬롯/해금/조합/버프요약 확인, 버프 합산 수치 검증(힘T2 +9·활력T4 +126·신속T3 +13.5%).
- 거너 총기 장전 시스템(사용자 요청: 소총 8발마다 장전·등급↑ 탄창↑·흑요석권총 40발·장전음+1.5초·수동장전 단축키):
  리프 game/gunReload(순수) — GUN_MAGAZINE{pistol 6·rifle 8·sharp_obsidian_gun 40}, GUN_RELOAD_MS 1500,
  ReloadState{ammoByGun·reloadingGun·reloadingUntil}, ammoInGun(미기록=만탄)·consumeGunShot·beginReload
  (만탄/중복 거부)·tickReload(완료 시 만탄)·isReloading·canFireGun. 탄약은 세션 상태(세이브 미지속 —
  로드/새게임 시 resetReloadState 로 만탄). main 배선(메서드 수 482 불변 — reload 필드 + startReload arrow
  필드): fireRangedWeapon 상단 게이트(장전 중 무시·빈총 자동장전) + 발사 후 consumeGunShot(소진 시 자동장전),
  updateHand 에서 tickReload(완료음+만탄), KeyV 수동장전(발수 안 써도), HUD buffs 에 🔫 탄창 칩(장전 중 "장전…").
  장전음 = playTone 철컥(시작 150→90, 완료 320→150). gun-reload-test 신설(탄창 단조·소비/소진·장전 1.5s·
  수동장전·발사판정·리셋) + verify 체인. 헤드리스 실측: 소총 8발 7→0 자동장전·9번째 차단(투사체 8개 고정)·
  부분소비 후 V 수동장전·흑요석권총 40발 확인(전부 통과). 줄 9474→9486(ledger), 전 게이트·빌드 녹색.
  주의: 활·석궁 등 비총기는 isReloadableGun=false 로 장전 개념 없음(기존 발사 경로 그대로).
- 직업별 레전더리 무기 7종(사용자 요청: 각 직업 정점 무기 + 예: 미니건 60발·대주술사 마법봉·싸울아비 장검):
  전부 데이터/리프/비주얼/레시피만 — main.ts 무변경(예산 불변). 매핑(직업 시작무기 기준):
  전사 여명의 대검(dawn_greatsword 근접 18) · 사무라이 싸울아비 장검(bushido_blade 카타나 16·리치2·시너지) ·
  마법사 대주술사의 마법봉(archmage_wand 마법 20) · 힐러 생명의 지팡이(lifebloom_staff 14·힐 시너지) ·
  소환사 폭풍 정령의 지팡이(storm_staff 17) · 거너 미니건(minigun 총 12·탄창 60) · 탱커 수호자의 대방패
  (guardian_bulwark 방어 13·강타 14·내구 1500). 각 계열 직전 최강(흑요석 궁극/에픽) 초과로 위상 확보.
  ▪items.ts: ITEM_NAMES·WEAPON_DAMAGE·RANGED_WEAPONS·GUN_WEAPONS(+minigun)·RANGED_PROJECTILE(지팡이3=magic)·
  STAFF_WEAPONS·KATANA_WEAPONS(+bushido)·WEAPON_REACH_MULT(bushido=2)·isMeleeWeapon(대방패 제외)·ITEM_RARITY·
  ITEM_TIER(legendary)·SHIELD_DEFENSE/DURABILITY/REPAIR(대방패). 직업 시너지는 기존 group 로직(melee/staff/
  katana/gun)으로 자동 적용 — 신규 클래스 코드 0.
  ▪gunReload.ts: GUN_MAGAZINE.minigun=60(장전 시스템과 연동).
  ▪recipes.ts: extendedOnly 7종 — sharp_obsidian + dragon 재료(scale/tail/horn)로 게이팅(정점 위상).
  ▪heldItemVisuals: 지팡이3=createOrnateStaffModel(색 차등), 카타나 브랜치에 bushido(진홍·금), 미니건=다총열
  회전체, 대방패=흑요석방패 확대, 대검=금빛 발광 블레이드. 전부 non-fallback(content 폴백 게이트 통과).
  ▪content-test 골든 갱신(legendary 세트 +7·GUN_WEAPONS +minigun) + 레전더리 위상 ordering asserts.
  gun-reload-test 에 미니건 60 추가. 세이브 변경 없음(무기는 기존 인벤토리 슬롯 지속 — SAVE_VERSION 불변).
  전 게이트·빌드 녹색, held 모델 7종 그리드 헤드리스 실측(뚜렷·구분됨).
