# 세이브 시스템 설계 (Phase 1)

> **상태**: 구현 진행 중 (2026-07-16) — Pcg32 `e4c6da3` · RngStreams `918b841` · GameState·SaveSystem·SaveDto `3581656`. 세이브 왕복 동일성·RNG 연속성 검증 완료(test 68). 잔여: fail-soft(D9, GameDatabase 대조)·프로세스 재기동 E2E·게임플레이 필드 확장.
> **선행 조건**: 정수 스케일 전환·id 생애주기·schema_version 완료(Phase 0 위생, `04d3c30`). Phase 0 데이터/도메인 확정.
> **정본 관계**: `docs/GAME_DESIGN_SPEC.md` §4.2·§9·v1.4 §0.3-7 의 하위 상세. 스펙 [MUST] 를 재정의하지 않고 그 아래 해상도만 다룬다.
> **구현 완료 시**: 이 문서를 as-built 로 갱신하고, 첫 실사고 시 `docs/save-system-history.md` 를 개설한다(스펙 §9 리스크 표에서 링크).

---

## 1. 현황·진단

- Phase 0 는 **정의 데이터**(캐릭터·스킬·병종·영지·규칙)만 로드한다. `GameDatabase` 는 불변 정의 캐시이며 "진행 중 게임 상태는 Phase 1 GameState 책임"으로 주석에 명시됨.
- 세이브 대상 = **가변 게임 상태**(GameState). 아직 클래스 없음. `SaveSystem` 은 §4.2 표에 1행 명세만 존재.
- 결정론: §4.4 개정 완료 — 명명 RNG 스트림(combat/world_events/summon:{}/cinematic) + PCG32(상태 직렬화 가능). Phase 1 은 combat·world_events 만 실사용, summon·cinematic 은 Phase 2.

## 2. 확정 결정 (D1~D10)

| # | 결정 | 근거 | 승인일 |
|---|---|---|---|
| D1 | **`Load` 는 새 `GameState` 객체를 생성**한다 (팩토리 `GameState.FromSave(dto)`). '새 게임 초기화 후 되채움' 금지. 필드는 `required`/`init` 로 누락을 컴파일 타임 노출 | §4.2 ①. 리셋 함정 원천 차단 | 2026-07-16 |
| D2 | 마이그레이션 = **단일 `SaveVersion` 상수 + 전 필드 nullable `SaveDto` → `Normalize` 단일 정규화 경로**. 버전별 마이그레이터 체인 금지 | §4.2 ② | 2026-07-16 |
| D3 | 버전 검사 = **미래 버전만 명시 거부**, 과거 버전은 동일 Normalize 경로로 동화 + `migratedFromVersion` 기록 | §4.2 ② | 2026-07-16 |
| D4 | 세이브 = **정의 참조 id + 가변 상태만**. 스탯·성장률·상성·비용 등 정의값 복사 저장 금지 — 로드 시 `GameDatabase` 에서 재계산·재바인딩 | §4.2·B-6. 밸런스 패치가 진행 세이브에 자동 소급 | 2026-07-16 |
| D5 | 진행도(무혈 점령 이력·달성 플래그 등)는 **`HashSet<string>` id-set**. 콘텐츠 삽입 시 마이그레이션 0줄. id 재사용 금지(§5.5 결번) | §4.2·B-5 | 2026-07-16 |
| D6 | 저장 허용 = **페이즈 경계에서만**. 세이브에 `CurrentTurn`·`CurrentPhase` 기록, 로드 시 해당 페이즈 시작점 재개. 수동·자동 저장 동일 가드 | §4.2 ④·B-7 | 2026-07-16 |
| D7 | **atomic write** — 임시 파일 완성 후 `File.Replace`/rename 교체, 실패 시 기존 파일 무손상 | §4.2 ⑤·B-10 | 2026-07-16 |
| D8 | RNG = **스트림별 `{state, inc}`(PCG32, 정수) 직렬화**. cinematic 스트림은 무상태 해시라 저장 불요. 부재 구세이브는 `Hash(campaignSeed, stream, turn)` 재시드(기본값 0 금지) | §4.4·§2.7.3·B-2 | 2026-07-16 |
| D9 | 세이브 내 컬렉션의 **삭제된 정의 id 참조는 건별 스킵+카운트+고지**(정의=fail-fast §5.5 와 대칭, 세이브=fail-soft). 스킵 목록은 로드 결과에 표면화 | §4.2 ③·B-8 | 2026-07-16 |
| D10 | PCG32 는 **직접 구현**(외부 패키지 금지 §4.1 — 레이어 게이트가 강제). `WorldConquest.Core` 내 순수 struct | §4.1·D8 | 2026-07-16 |

## 3. 아키텍처 — 신규 클래스 (Phase 1, §0.3-2 목록)

| 클래스 (레이어) | 책임 (이것만) | 세이브 관련 |
|---|---|---|
| `GameState` (Core) | 진행 중 전체 가변 상태 컨테이너 (turn·phase·actor·factions·provinces·characters·armies·rng·progress) | 직렬화 루트. `FromSave`/`ToSave` |
| `Pcg32` (Core, struct) | 상태 직렬화 가능 결정론 PRNG (D8·D10) | `{state, inc}` |
| `RngStreams` (Core) | 마스터 시드 → 명명 스트림 파생·보관 | 스트림별 상태 |
| `SaveSystem` (Core) | `Save(slot)`/`Load(slot)` 단일 진입점, Normalize, atomic write, 페이즈 경계 가드 | 본체 |
| `SaveDto` 계열 (Core/Data) | 전 필드 nullable 직렬화 DTO | Normalize 입력 |
| `TurnSystem` (Core) | 페이즈 순서·전이 (§2.2 [1]~[7]) | `CurrentPhase` 전이 |
| `GameManager` (Core) | 게임 흐름 오케스트레이션·`AdvancePhase`·`CheckWinCondition` | 저장 트리거(경계) |

> **주의**: 부대 편성·시설·이동은 Phase 1 게임플레이 클래스(별도 진행)에서 추가. 이 문서는 **세이브 계약**에 집중하며, GameState 가 담을 필드는 게임플레이 구현과 함께 확장(D2 additive 규칙 — 필드 추가는 SaveVersion 안 올림).

## 4. GameState 세이브 스키마 초안 (Phase 1 범위)

```jsonc
{
  "save_version": 1,
  "migrated_from_version": 1,          // 로드 시 기록
  "data_schema_version": 1,            // 저장 당시 game_rules schema_version (드리프트 감지, B-1)
  "campaign_seed": 123456789,          // 재시드·리플레이 기준
  "turn": 12, "phase": "player1_command", "actor": "father",
  "rng_streams": {                     // D8 — cinematic 제외
    "combat":       { "state": "0x…", "inc": "0x…" },
    "world_events": { "state": "0x…", "inc": "0x…" }
  },
  "factions": [                        // 가변 상태만 — 정의(색·성향 등)는 factions.json 참조
    { "id": "father", "controller": "human_p1",
      "treasury": 1200, "food": 800, "tech_level": 1,
      "owned_province_ids": ["hanseong", "busan"],
      "relations": { "wei": "war", "france": "alliance" } }
  ],
  "provinces": [                       // 소유·시설·수비만 (인구·기본생산은 정의 참조; 가변 시 여기)
    { "id": "hanseong", "owner": "father", "garrison": { "spearman": 2000 },
      "facilities": { "market": 2, "farm": 1 } }
  ],
  "characters": [                      // level·exp·loyalty·소속만 (스탯은 정의+성장 재계산, D4)
    { "id": "yi_sunsin", "faction": "father", "level": 3, "exp": 40, "loyalty": 95 }
  ],
  "progress": ["captured:pyongyang", "first_alliance"]   // D5 id-set
}
```

## 5. 단계 계획

1. `Pcg32` + `RngStreams` + 단위 테스트(결정성·상태 왕복).
2. `GameState` 골격 + `SaveDto` + `SaveSystem.Save/Load`(Normalize·atomic write·미래 버전 거부).
3. 세이브 왕복 테스트 3종(§8): 풍부 상태 픽스처(2인 협동 상태 포함)·프로세스 재기동 E2E·명명 회귀 가드. `tests/fixtures/saves/v1/` 동결.
4. 게임플레이(턴 루프·자원·이동) 진행과 함께 GameState 필드 확장(additive).

## 6. 가드레일·검증 (돌릴 게이트)

- `verify` = `dotnet build -warnaserror && dotnet test` (커밋 전 필수, §0.3-6).
- 세이브 스키마 형태 변경 = SaveVersion 상향 + Normalize 보강 + 왕복 테스트를 **같은 커밋**(§0.3-7).
- Phase 1 DoD(스펙 §7): 50턴 자동 스모크(예외·자원 음수 0) + 세이브→로드 상태 동일성.

## 7. 확정 (2026-07-16 — 기본값으로 확정)

1. **자동저장 링**: Phase 1 은 **수동 명명 슬롯만**. 턴 단위 자동저장 링(B-10)은 이어하기 QoL 요구가 실제로 나올 때.
2. **세이브 파일 저장 경로**: **`%APPDATA%/WorldConquest/saves/`** (repo 밖, gitignore 안전장치는 AGENTS.md §4). `SaveSystem` 은 경로를 인자로 받으므로 경로 결정처는 ConsoleHost/호출자.
3. **controller 필드**: **세이브에 포함**(`FactionState.Controller` = human_p1/human_p2/ai). 핫시트 2인 매핑의 정본 = 세이브.
