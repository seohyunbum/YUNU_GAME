# WorldConquest 로드맵 (now / next / later)

> 상세 파이프라인·DoD 는 스펙 §7. 이 문서는 **현재 초점과 대기 작업**의 얇은 트래커다.
> 아들 테스트(§8) 백로그·Phase 2 게이트 리뷰 결정도 여기에 수렴한다.

## NOW — Phase 1 착수 준비

- [ ] **세이브 시스템 설계 확정** → `docs/designs/save-system-design.md` (스펙 §4.2 계약 5종 구체화: 단일 `SaveVersion`+`Normalize`, `Load`=새 GameState, fail-soft 스킵, 페이즈 경계, atomic write). design-doc 장르 첫 적용.
- [ ] Phase 1 작업: 턴 루프·자원 생산·시설·징병·A* 이동·무혈 점령·핫시트 2인·세이브/로드 (스펙 §7 Phase 1)

## NEXT — dotnet 환경에서 처리할 코드/데이터 전환 (계약은 스펙 v1.4 에 확정, 구현 대기)

> 집 PC 에 .NET SDK 없어 보류됨 (work-history 2026-07-16). 회사 PC 또는 SDK 설치 후 `verify` 통과와 함께 처리.

- [ ] **data JSON 정수 스케일 전환** — `growth_rates`·상성 배율·세율 등 float → 정수 스케일(1.2→120, ×1.5→150/100). DataLoader 파싱·Domain 계산·테스트 동반. **스키마 굳기 전 우선** (스펙 §4.4). ⚠ 완전성 갭 P1.
- [ ] **콘텐츠 id 생애주기 구현** — `data/config/retired_ids.json` + DataLoader 재사용 검출 기동 실패 + `aliases` 맵 (스펙 §5.5). ⚠ 완전성 갭 P1.
- [ ] `game_rules.json` 에 `schema_version` 필드 + DataLoader 미래 버전 거부 (스펙 §5.5).
- [ ] DataLoader.BuildRules 에 `gauge_charge_on_attack`/`on_damaged` 범위 검사 2줄 (기존 하드코딩 검증 방식).
- [ ] `SampleDataTests` 수량 동등 assert 3건(캐릭터 10·영지 12·해역 3) → 하한(`>=`)으로 — Phase 5 'JSON 만으로 콘텐츠 추가' 시 테스트 깨짐 방지.
- [ ] 레이어 정적 게이트 테스트 — Core.csproj 참조 화이트리스트(0개) + Core 소스 `Console.`·표현층 네임스페이스 스캔 (스펙 §0.3-5 기계화).

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
