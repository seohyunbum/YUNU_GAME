# WorldConquest 로드맵 (now / next / later)

> 상세 파이프라인·DoD 는 스펙 §7. 이 문서는 **현재 초점과 대기 작업**의 얇은 트래커다.
> 아들 테스트(§8) 백로그·Phase 2 게이트 리뷰 결정도 여기에 수렴한다.

## NOW — Phase 1 진행 중

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
