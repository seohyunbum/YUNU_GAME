# WorldConquest 로드맵 (now / next / later)

> 상세 파이프라인·DoD 는 스펙 §7. 이 문서는 **현재 초점과 대기 작업**의 얇은 트래커다.
> 아들 테스트(§8) 백로그·Phase 2 게이트 리뷰 결정도 여기에 수렴한다.

## NOW — Phase 1 착수

- [ ] **세이브 시스템 설계 확정** → `docs/designs/save-system-design.md` (스펙 §4.2 계약 5종 구체화: 단일 `SaveVersion`+`Normalize`, `Load`=새 GameState, fail-soft 스킵, 페이즈 경계, atomic write). design-doc 장르 첫 적용.
- [ ] Phase 1 작업: 턴 루프·자원 생산·시설·징병·A* 이동·무혈 점령·핫시트 2인·세이브/로드 (스펙 §7 Phase 1)

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
