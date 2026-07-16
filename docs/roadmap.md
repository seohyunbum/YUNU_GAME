# WorldConquest 로드맵 (now / next / later)

> 상세 파이프라인·DoD 는 스펙 §7. 이 문서는 **현재 초점과 대기 작업**의 얇은 트래커다.
> 아들 테스트(§8) 백로그·Phase 2 게이트 리뷰 결정도 여기에 수렴한다.

## NOW — Phase 2 (전투·스킬·외교·AI) 착수

설계: `docs/designs/combat-system-design.md` (클래스 목록·C1~C8). 단계: DamageCalculator(순수함수) → CombatManager(자동계산) → SkillSystem(EffectType) → 해상/상륙전 → DiplomacyManager → AIController.
- [x] DamageCalculator (순수 함수, 상성·지형 정수 합성). `2d55c90`
- [x] CombatManager 자동 전투 + GameManager.Attack + 콘솔 attack — 결정론(combat 스트림)·비례 손실·점령 이전·무저항 함락. 실전투 구동 확인.
- [x] SkillSystem — EffectType 해석기 7종(미지 타입 throw [MUST])·게이지 충전·궁극기 자동 발동·버프/실드/소환/회복·지휘관 임명(assign). 실전 패시브 발동 확인.
- [x] 해상전·상륙전 — 함대(Fleets additive 세이브)·항구 건조·해로 이동·풍향(8방위 combat 스트림)×조류(해역 데이터) 보정·상륙 -25% 디버프·이순신 학익진 해상 발동. DoD '풍향·조류 변경 시 결과 상이' ✔
- [x] DiplomacyManager — 동맹/선전포고/종전 양측 동기·자원지원(턴당 상한 alliance_transfer_cap·수입 페이즈 리셋)·공동 수비(동맹 주둔군 합류)·**공동 승리 [MUST]**. 콘솔 ally/war/peace/send.
- [x] AIController — 규칙 기반(성향별 예산·병종): 스택 병합·빈 영지 점령·전선 진군·전력 우위 공격·**해상 원정**(고립 시 함대 집중→상륙→교두보 징병). 결정적(난수 0).
- [x] 배치 시뮬 — `simulate [판수] [--assert] [--trace]`: 정복승+판정승(턴캡 최다 영지, 시뮬 전용) 리포트. **100판 결과: 칼데아 98% — 샘플 맵 지리 불균형 검출** (12영지 샘플 한계, 맵 확장 §2.1 시 시작 조건 재밸런스 필요 — 시뮬이 §8 취지대로 작동).
- [x] **일기토(§2.6)** — 양측 지휘관·무력 격차 조건·승자 사기/게이지 이득. DuelStarted/DuelEnded 이벤트.
- [x] **시네마틱 T0 (§2.7)** — EventBus·CutsceneDirector(fired=seen·priority 선택·무상태 해시 확률)·TextCutscenePlayer·T0 스크립트 15편(궁극기 10·온주참화웅 2·동맹·엔딩 2)·로더 §5.7 검증·fired 세이브. **실 콘솔: 프리롤→일기토→溫酒斬華雄→청룡언월참 체인 확인**.
- [x] **초빙/가챠(§2.8)** — 천명(기본/전투/점령/일기토 수입)·SummonSystem(비복원·soft/hard pity·세력별 스트림 세이브스컴 방지·풀 파생)·확률 공시(rates=판정 동일 함수)·리빌(자/금 문)·★5=등장씬 재사용·CharacterJoined. 실 콘솔 확인.
- [ ] 밸런스 패널(§5.6) + 바탕화면 바로가기(게임·패널) + 로컬 배포
- [ ] Phase 2 DoD 잔여: 부자 완주 게이트(U1— 사용자) · ★게이트 리뷰(U2~U4)

## Phase 1 (완료 ✅) — §7 전량

- [x] **세이브 시스템 설계** → `docs/designs/save-system-design.md` (§4.2 계약 D1~D10, design-doc 장르 첫 적용). `f80741f`
- [x] **세이브 시스템 골격 구현** — Pcg32 `e4c6da3` · RngStreams `918b841` · GameState·SaveSystem `3581656`. 세이브→로드 상태 동일성·RNG 연속성 검증(test 68).
- [x] **턴 루프·수입·무혈 점령** — TurnSystem(페이즈 전이)·GameSetup.NewCampaign·GameManager(수입·무혈 점령·승리 stub). `b412067`·`11ebbb0`
- [x] **50턴 자동 스모크** (예외·자원 음수 0). `11ebbb0`
- [x] **핫시트 2인 콘솔 루프** — PlaySession(TextReader/Writer 주입, 테스트 가능) + Program `play` 모드. status/capture/save/end/quit. 실 콘솔 구동 확인(조선 평양 점령·수입 누적). Phase 1 DoD '2인이 턴 넘기며 자원 모으고 빈 영지 점령' ✔
- [x] **A* 경로 탐색** — Pathfinding.FindPath (BFS 최단 홉, 간선 종류 제한). 부대 이동의 토대. `0a95548`+
- [x] **부대 상태·징병·이동** — GameState.Armies(additive 세이브)·GameManager.Recruit(금 소비)·MoveArmy(Pathfinding). 콘솔 recruit/move/armies 명령. 실 구동 확인(창병10·궁병5 편성→평양 이동).
- [x] **시설 건설** — game_rules facilities(시장·농지)·ProvinceState(시설 레벨 additive 세이브)·BuildFacility(슬롯·최대레벨)·수입 보너스. 실 구동(market+farm → 수입 +250금/+182식). 함대·상륙전은 Phase 2.

> ✅✅ **Phase 1 §7 작업 전량 완료** (2026-07-16): 턴 루프·자원 생산·시설·징병·A* 이동·무혈 점령·핫시트 2인·세이브/로드. 부자가 콘솔에서 완전한 한 판(자원·내정·부대·점령·저장·이어하기)을 플레이 가능. **다음 = Phase 2**(전투·스킬·외교·AI).
- [x] **프로세스 재기동 세이브 E2E** — Program `load` 모드(이어하기). play 저장→프로세스 종료→load 재기동에서 영지 3개(평양 점령)·수입 복원 실증. `187fab0`+
- [x] **세이브 fail-soft(D9)** — 로드 시 GameDatabase 대조로 삭제 정의 id 참조 건별 스킵+고지 (정의 참조가 늘어나는 시점).

> ✅ **Phase 1 DoD 충족** (§7): ① 2인 턴 넘기며 자원 모으고 빈 영지 점령 ② 50턴 자동 스모크(예외·자원 음수 0) ③ 세이브→로드 상태 동일성(프로세스 재기동 실증). 남은 항목(부대 이동·시설·징병·fail-soft)은 Phase 1 확장·Phase 2 진입 전 작업.

## DONE — Phase 0 위생 (2026-07-16, dotnet 8.0.423 설치 후 verify 통과)

> `.NET SDK` 를 zip 바이너리로 `C:\Users\서현범\dotnet` 에 설치(winget installer hang 회피). baseline verify 48/48 확인 후 진행.

- [x] **data JSON 정수 스케일 전환(×100)** — growth 120·상성 150·terrain ±100·tax 10·landing −25. Grow 는 정수 나눗셈으로 결과 등가 보존 (스펙 §4.4). ⚠ 완전성 갭 P1. `0f1b126`
- [x] **콘텐츠 id 생애주기** — `retired_ids.json` + DataLoader 재사용 검출 기동 실패 (스펙 §5.5). ⚠ 완전성 갭 P1. `aliases` 리매핑은 SaveSystem.Normalize 도입(Phase 1) 시. `2699bcb`
- [x] `game_rules.json` `schema_version` + 미래 버전 거부. `542e174`
- [x] gauge 범위 검사 2줄 + `SampleDataTests` 수량 하한화. `ee09147`
- [x] 레이어 정적 게이트 테스트 (Core 외부·표현층 의존 0). `a8ac963`
- 현재 테스트 52/52 통과.

## LATER

- Phase 2: 전투·스킬·외교·AI + 시네마틱(§2.7) 트리거·초빙(§2.8) 구현 + 밸런스 패널(§5.6). **무가챠 완주 시뮬 [MUST]**.
  - **★ Phase 2 게이트 리뷰 결정란** (완주 후 기록): ① UE5 강행/Godot·2D 축소/콘솔 유지 ② "관우 찻잔이 T0 로 통했는가" ③ **.NET 10 승급 여부**(.NET 8 EOL 2026-11-10).
- Phase 3a/3b: UE5 이식·오라클·연출 티어. Phase 4: CC0 사운드·트레일러. Phase 5: 콘텐츠 확장·라이브 밸런스.

## 사용자 대기 결정 (스펙 ⚠ 미확정 콜아웃)

- 시네마틱: T3 캡 5 vs 3 · AI 영상 생성 채택 · 체감 파라미터 기본값 · union 갤러리 조기 도입
- 초빙: 페이크아웃 ON/OFF · 천장·비용 수치 · 선물 pity 전진 · 전용 컷씬 v1 명단 3본 · 메타 컬렉션 처분
- 엔지니어링: **orphan 브랜치 통합 경로**(별도 repo vs 영구 브랜치)

## 아들 테스트 백로그 (§8 — 실플레이 발견 사항)

_(Phase 1 완료 후 실플레이부터 채워짐)_
