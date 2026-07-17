# 외교 시스템 설계 — 관계도·조공·계략·AI 외교 (Phase 2 심화)

> **상태**: 설계 (2026-07-17) — 구현 미착수. Phase 2 외교 구현분(`docs/roadmap.md:27`)의 **심화·확장**이지 신규 시스템 도입이 아니다.
> **⚠ 코드 인용 기준 커밋 = `3aa413d`.** 본 문서의 모든 `파일:줄` 앵커는 이 커밋 기준이며 **줄번호는 반드시 썩는다** — 구현 착수 시 심볼(메서드·필드 이름)로 재확인하라. 앵커가 아니라 **인용된 사실**이 정본이다. (실측 예: `3aa413d` 이후 `claude/three-kingdoms-game-design-ipmajw` 의 시설 아이콘 작업으로 **`GameManager.cs` 가 +2줄 밀렸다** — `PublishBattleEvents` 호출 `:328`→`:330`, 정의 `:348`→`:350`, `CollectIncome` `:100`→`:99`. `DataLoader.cs` 앵커(`:278`·`:295`·`:329`·`:398`)는 유효.)
> **선행 조건**: Phase 2 `DiplomacyManager` 구현 완료 — 동맹·선전포고·종전 양측 동기, 자원지원(턴당 상한·수입 페이즈 리셋), 공동 수비, 공동 승리 [MUST]. 콘솔 `ally`/`war`/`peace`/`send`.
> **정본 관계**: `docs/GAME_DESIGN_SPEC.md` §1.2·§2.2·§2.4·§4.2·§4.4·§5 의 하위 상세. `docs/designs/combat-system-design.md`(Phase 2 전체) 중 **외교 축만 분가**해 심화한다 — C7(외교 상태 전이의 양측 동기화·자원지원 턴당 상한)은 그대로 유효하며 본 문서가 이를 상속한다. 전투·스킬·AI 군사 판단은 여전히 combat 문서가 정본.
> **⚠ 스펙 개정을 요구하는 항목 (본 문서는 [MUST] 를 임의로 재정의하지 않는다)**: 아래 2건은 **[MUST] 의 적용 범위를 바꾸므로 사용자 승인 전 해당 단계 착수 불가**. §10 에 등재.
> - **U-D1 — 비동맹 자원 이전(조공)**: §1.2 는 "**동맹 전용 메커니즘**" 표제 아래 "**자원 지원**(금·식량 이전, 턴당 상한 있음)" 을 열거한다(`SPEC:64-66`). 조공은 이 [MUST] 의 적용 범위를 축소한다.
> - **U-D2 — RNG `diplomacy` 스트림 등재**: §4.4 "스트림 신설·구현체 변경은 스펙 개정 항목"(`SPEC:602`).
> **구현 완료 시**: 본 문서를 as-built 로 갱신 + `docs/roadmap.md` Phase 2 절 링크 갱신.
> **핵심 [MUST] (본 문서가 상속·집행하는 기존 규정)**:
> - 천명(`Mandate`)은 **조공 품목이 될 수 없다** — §2.8.3 "천명 직접 이전은 §1.2 동맹 자원 지원 대상에서 제외 [MUST]". 조공 품목은 금·식량뿐.
> - 조공과 동맹 자원지원은 **턴당 캡 예산을 공유한다** — 분리하면 §1.2 상한이 우회된다(E7).
> - 게임플레이 산술은 **정수만**. float/double 금지. **나눗셈은 전부 C# 정수 나눗셈 = 0 방향 절사(truncation)** 로 통일하고 공식마다 명시 (§4.4 `SPEC:603` "나눗셈 반올림 규칙을 공식마다 명세").
> - 밸런스 수치 **하드코딩 금지** — 전부 `data/config/game_rules.json` (§5, §0.3-4).

---

## 1. 현황·진단 (as-is — 전부 코드 근거)

### 1.1 "AI 가 무조건 나만 공격한다" 의 실제 원인 — 플레이어 편향은 **없다**

체감과 코드가 다르다. 정직하게 기록한다.

| 가설 | 사실 | 근거 |
| --- | --- | --- |
| AI 가 인간 플레이어를 우선 표적으로 삼는다 | **거짓.** `AIController` 전체에서 `Controller` 참조는 line 28(`f.Controller == "ai"`, 자기 순회 대상 선별) 단 1곳이고 `"human"`/`"human_p1"`/`"human_p2"` 문자열은 파일 내 **0회**. 목표 선정·진군·해상원정 어디에도 대상의 조작 주체를 보는 코드가 없다. | `AIController.cs:28`; 대상 선정 `:215-226`, 진군 `:238-244`, 해상 `:102-111` |
| AI 끼리는 안 싸운다 | **거짓.** 대상 필터는 '소유자 ≠ 자기'만 요구하고 `Controller` 를 보지 않으며(`:219`), `GameManager.Attack` 지상 분기에도 가드가 없다(`:292-299`). `GameSetup.AiCampaign` 은 전 세력 AI 캠페인을 정식 지원. **AI vs AI 는 이미 기본 동작이다.** | `AIController.cs:219`, `GameManager.cs:292-299`, `GameSetup.cs:8-33` |

**진짜 원인 3가지**:

1. **목표 선정이 단일 축** — `AttackWeakNeighbors` 는 후보를 `OrderBy(Garrison).ThenBy(Id)` 로만 정렬한다(`:225`). 거리·가치·세력 크기·관계 무관, 오직 **가장 약한 인접 영지**. 초반 플레이어가 가장 약하면 인접한 모든 AI 가 동시에 플레이어를 향한다 — 편향이 아니라 **약자 집중**이다.
2. **기본 국제상태가 '만인 대 만인'** — 신규 캠페인의 `Relations` 는 빈 Dictionary 이고(`GameSetup.cs:19,65`) `DiplomaticState.Neutral = 0` 이라 `GetValueOrDefault` 가 Neutral 을 돌려준다. AI 필터는 `!= Alliance (&& != NonAggression)` 라는 **부정 조건**이라 Neutral·War 가 모두 통과 → **선전포고 없이 즉시 공격**. `Alliance`/`NonAggression` 만이 예외적 억제 장치다.
3. **AI 가 외교를 하지 못한다** — `AIController` 는 `DiplomacyManager` 를 참조조차 하지 않는다(파일 내 `Diplomacy` 문자열 0건). `Relations` 는 **읽기 전용**이며 쓰기가 0건. 동맹·선전포고·종전·자원지원 중 무엇도 AI 는 하지 않는다. 즉 **국제정치가 존재하지 않는다**.

> 결론: 요구사항 "AI 들이 지들끼리도 적대치/우호도에 따라 공격하거나 동맹 맺음" 에서 **'서로 공격'은 이미 되고 있고, 없는 것은 '관계도'와 '동맹·외교 행동'** 이다. 본 설계의 무게중심은 편향 제거가 아니라 **관계 동역학 도입**이다.
>
> ⚠ **반복 금지**: AI 편향 제거 코드를 넣지 말 것 — 없는 편향을 지우려다 `Controller` 의존을 새로 만들면 오히려 AI 가 인간을 특별 취급하게 된다.

### 1.2 관계도(수치)는 스펙이 약속했으나 구현에 없다

- 스펙 §4.2 는 `DiplomacyManager` 의 책임을 "외교 제안·수락·**관계도 변화**"로 명세한다(`SPEC:584`). 그러나 관계도의 **정의·범위·산식이 스펙 어디에도 없고**, 구현은 4값 enum 전이뿐이다.
- `'우호도|favor|reputation|goodwill|relation_score|trust'` 전 저장소 grep **0건**.
- 본 설계가 채우는 것이 정확히 이 **빈칸**이다 — 새 [MUST] 를 만드는 것이 아니라 §4.2 가 이미 승인한 개념에 해상도를 부여한다.

### 1.3 구현 격차 목록

| # | 항목 | 상태 | 근거 |
| --- | --- | --- | --- |
| G1 | 수치형 관계도 | **없음** | grep 0건 |
| G2 | 조공(비동맹 자원 이전) | **없음.** 자원 이동 경로는 `TransferResources` 하나이며 `AreAllied` 강제 | `DiplomacyManager.cs:83`, enum 주석 `:13` "자원 지원은 동맹 전용 (§1.2)" |
| G3 | 계략 | **없음.** `scheme_success` 는 `valid_buff_stats` 에 등재되고 조조 패시브 `hero_of_chaos` 가 +15 를 주지만 **읽는 소비자가 0개 = 실효 no-op** | `game_rules.json:98`, `skills.json:14-23`, `SkillSystem.cs:72-75` |
| G4 | 지력(INT) 의 게임플레이 소비 | **없음.** 스펙 §2.4 는 INT = "계략 성공/회피" 라 규정하나 어떤 판정도 INT 를 읽지 않는다 | `SPEC:118-125` vs 코드 |
| G5 | 정치(POL) = 외교 성공률 | **없음.** `DiplomacyManager` 는 어떤 스탯도 읽지 않는다 | `SPEC:124` vs `DiplomacyManager.cs:42-75` |
| G6 | 불가침 체결 경로 | **도달 불가(dead branch).** enum 에 있고 `:221` 이 읽지만 **쓰는** 런타임 코드가 없다 | `DiplomaticState.cs:7`, `Faction.cs:79-85`, `GameSessionHost.cs:239-260` |
| G7 | AI 외교 행동 | **없음** (§1.1) | `AIController.cs` 전체 |
| G8 | 제안/수락 2단계 | **없음.** `ProposeAlliance` 는 스펙 §584 에만 존재. `FormAlliance` 는 상대 동의 없이 **일방 호출로 즉시 양측 체결** | `DiplomacyManager.cs:42` |
| G9 | 배신 페널티 | **없음.** `DeclareWar` 는 동맹 중이어도 즉시 War. 쿨다운·페널티 전무 | `DiplomacyManager.cs:56-64` |
| G10 | 시나리오 초기 관계 | **없음.** `factions.json` 에 relations 정의 없음 | `GameSetup.cs:19,65` — **본 설계 비목표(§2)로 유예** |

### 1.4 정합성 결함 3건

- **F1 — 불가침이 지상에서만 존중된다.** `NonAggression` 비교는 `AttackWeakNeighbors`(`:221`) **단 1곳**. 나머지 필터(`:60,:104,:194,:240`)는 `Alliance` 만 배제한다. 결과: **해상 상륙 공격이 불가침 상대 항구를 그대로 친다**(`:131-141`), 진군은 불가침 상대를 '적'으로 보고 국경으로 향한다.
- **F2 — 관계 필터 복붙.** 정확한 집계: **`Alliance` 필터 사이트 5곳**(`:60,:104,:194,:220,:240`) + **`NonAggression` 비교 1곳**(`:221`) = **`Relations` 읽기 6회**. 5개 사이트에 같은 술어가 복붙되어 F1 을 낳았다. 중앙화하지 않으면 본 설계의 Favor 조건이 또 5곳에 복제된다.
- **F3 — 해상전 방어측에 조약이 전혀 없다.** 해상 방어자 = `State.Fleets.Where(f => f.FactionId != factionId && f.LocationNodeId == targetNodeId)` — 소유·동맹 필터가 없어 **여러 세력 함대가 한 전투의 방어측에 섞이고, 공격자의 동맹 함대까지 방어측에 포함**된다. F1 과 같은 계열의 '바다에는 조약이 없다' 문제. | `GameManager.cs:280-281`

### 1.5 스펙 드리프트 (본 문서가 흡수·정정)

- `SPEC:577` 은 `Faction` 을 외교상태의 주체로 명세하나, **`Faction` 은 불변 정의 캐시**이고 런타임 정본은 **`GameState.Factions` = `List<FactionState>`** 다. `Faction` 의 외교 메서드는 프로덕션 호출처 0(`DomainTests` 전용).
  → **[본 설계의 기준] 외교 상태는 전부 `FactionState`/`GameState` 기준.** `Faction` 의 외교 API 는 손대지 않는다(Phase 1 잔재, 별건).
- `SPEC:584` 의 `ProposeAlliance()` 는 코드에 없다(실제는 `FormAlliance`). E9 에서 정식 도입하며 이름을 스펙에 맞춘다.

---

## 2. 설계 목표

| 요구 | 대응 | 절 |
| --- | --- | --- |
| AI 들이 지들끼리도 적대치/우호도에 따라 공격하거나 동맹 | 쌍 단위 **관계도(Favor)** + `AiDiplomat` 결정적 외교 판단 + 목표 선정 Favor 반영 | §4 E1~E5, §7 |
| 조공을 보내 우호도를 올림 | `SendTribute` — 비동맹 금·식량 이전 + Favor 상승 (⚠ **U-D1 승인 선행**) | §4 E6~E7 |
| 전투를 하면 우호도가 떨어짐 | 전투 3분기 전부에 Favor 훅 (F-경로 비대칭 해소) | §4 E8, §5.2 |
| 계략으로 두 국가의 우호도를 떨어뜨림 | `SchemeSystem` — 이간계, INT 기반 만분율, 무상태 해시 파생 | §4 E10~E12, §5.4 |

**비목표 (이번 범위 밖)**: 시야 공유·통행권(§1.2 [MUST] 이나 별건 미구현), 인재 추천(§2.8.8 ③ [MAY, Phase 5]), 매수·유언비어(E12), 비대칭 관계도(E2 기각), **시나리오 초기 관계(G10)** — `factions.json` `initial_relations` 는 `GameSetup`·`FactionDto`·`Faction` 배선이 함께 필요해 범위가 번진다. **[MAY, 후속]** 으로 유예하고 G10 은 미해소로 남긴다.

---

## 3. 신규 클래스·파일 목록 (§0.3-2, §4.2)

> §0.3-2 [MUST]: "코드 작성 전 어떤 클래스/파일을 만들지 목록을 먼저 제시하고 승인받는다."

### 3.1 신규

| 클래스/파일 (레이어) | 책임 (이것만 한다) | 비고 |
| --- | --- | --- |
| `RelationState` (Domain) | 쌍 단위 관계 레코드 — `FactionA`·`FactionB`·`Favor`·`TruceUntilTurn` | `PairKey` 는 **파생 프로퍼티**(§6.2) |
| `RelationLedger` (Data/Core) | **관계도 장부 단일 소유자** — Favor 조회·변동(소스 화이트리스트 강제)·구간→태도 변환·턴 감쇠. **`Canonical(a,b)` 의 새 소유자** | Favor 를 쓰는 유일한 클래스 |
| `FavorSource` (Domain, enum) | Favor 변동 소스 화이트리스트 | 천명 소스 화이트리스트(§2.8.3) 선례 |
| `Attitude` (Domain, enum) | `Nemesis`/`Hostile`/`Neutral`/`Friendly`/`Devoted` | Favor 구간의 파생 표현형 |
| `Proposal` (Domain) | 외교 제안 — `From`·`To`·`Kind`·`ExpiresOnTurn` | `GameState.PendingProposals` |
| `SchemeSystem` (Data/Core) | 계략 실행·성공 판정(INT)·비용·턴당 캡 | Favor 변동은 `RelationLedger` 위임 |
| `AiDiplomat` (Data/Core) | AI 1세력의 외교 의사결정(결정적) | `AIController` 가 호출 |
| `docs/designs/diplomacy-system-design.md` | 본 문서 | — |

### 3.2 기존 수정 (§0.3-3 — 파일·이유 1줄)

| 파일 | 이유 |
| --- | --- |
| `Domain/GameState.cs` | `List<RelationState> Relations` + `List<Proposal> PendingProposals` additive |
| `Domain/FactionState.cs` | `SchemesThisTurn` 턴 카운터 additive |
| `Domain/GameRules.cs` | `Diplomacy*` 평탄 스칼라 프로퍼티 |
| `Domain/RngStreams.cs` | `diplomacy` 명명 스트림 상수 (⚠ **U-D2 승인 선행**) |
| `Data/DiplomacyManager.cs` | `SendTribute`·`SetNonAggression`·`ProposeX`/`RespondToProposal` 추가, 배신 판정, `Canonical` **이전**(→`RelationLedger`), `RelationLedger` 위임 |
| `Data/AIController.cs` | `IsHostile`/`HasLandFront` 술어 분리·중앙화(F1·F2), `AiDiplomat` 호출, 목표 선정 Favor 반영 |
| `Data/GameManager.cs` | 전투 **3분기** Favor 훅, `CollectIncome` 에 감쇠·`CommonEnemy`·카운터 리셋·제안 만료 |
| `Data/DataLoader.cs` | `diplomacy` 블록 Need/Check/매핑 3중 훅 + `SupportedSchemaVersion` 2 |
| `Data/SaveDto.cs`·`SaveSystem.cs` | additive **6점** 배선 + D9 프루닝 확장 (§6.2) |
| `Data/GameSessionHost.cs`·`PlaySession.cs` | 콘솔 명령 표면 |
| `data/config/game_rules.json` | `diplomacy` 블록 + `schema_version` 2 |
| `tests/.../DiplomacyTests.cs`·`AiTests.cs` | 확장 (시스템별 1클래스 관례 — 신규 파일 불필요) |

> ⚠ `DataLoader.cs`·`GameManager.cs`·`game_rules.json` 은 **다중 에이전트 공유 파일**(AGENTS.md:47-53). 리프 모듈(`RelationLedger`·`SchemeSystem`·`AiDiplomat`)을 먼저 완성하고 공유 파일 배선은 **마지막에 한 번에**.

---

## 4. 확정 결정 (E1~E14)

| # | 결정 | 근거 | 확정일 |
| --- | --- | --- | --- |
| **E1** | **조약(이산)과 호감(수치)을 별개 축으로 둔다.** `DiplomaticState` = **법적 조약**, `Favor` = **감정**. Favor 가 조약을 **자동 전이시키지 않는다** — 전이는 항상 명시적 행위. | 기존 enum 과 5개 필터 사이트·세이브·테스트 보존 → **호환 파괴 0**. 자동 전이는 핫시트 2인에서 플레이어 동의 없이 상태가 바뀌어 통제 상실 | 2026-07-17 |
| **E2** | **Favor 는 쌍 단위 대칭 단일 정수** — `favor(a,b) == favor(b,a)`, `-1000 ~ +1000`, 초기 `0`. **비대칭 기각.** | ①세력별 Dictionary 는 **양측 이중 장부** → 동기화 버그. ②현 `AIController` 는 관계를 **단방향(자기 시점)으로만** 조회하므로 비대칭 도입 시 즉시 오독. ③가족용 게임에 과잉 | 2026-07-17 |
| **E3** | **저장 위치 = `GameState.Relations` (`List<RelationState>`)**. 키 = `Canonical(a,b)`(ordinal 정렬 `"{a}+{b}"`). **`Canonical` 을 `DiplomacyManager`(현재 `private static`, `cs:108-109`)에서 `RelationLedger` 로 이전**하고 `DiplomacyManager` 가 호출한다. | 쌍 상태를 세력별로 쪼개면 이중 장부(E2). `Canonical` 이 private 이라 **이전하지 않으면 `RelationLedger` 에서 호출 불가 = 컴파일 실패**. 이전 후 `alliance:{canonical}` Progress 규약 회귀 테스트(`DiplomacyTests.cs:26` 의 `alliance:joseon+wei`) 유지 | 2026-07-17 |
| **E4** | **Favor 구간 → 태도 5단.** 경계는 데이터. **임계값은 해당 태도에 포함(`<=`/`>=`)** — 경계 소유 규칙을 명시한다. 태도는 파생값이며 저장하지 않는다. | 단일 진실원(Favor). 저장 시 드리프트. 경계 미명시가 §5.1↔§6.1 불일치를 낳았다 | 2026-07-17 |
| **E5** | **Favor 변동은 화이트리스트 소스(`FavorSource`)로만.** `RelationLedger.Apply(a, b, FavorSource)` 외 경로는 리젝. | §2.8.3 천명 수입원 화이트리스트 [MUST] 의 동형 적용 — 수치 인플레 경로를 열거로 봉인. 밸런스 추적성 | 2026-07-17 |
| **E6** ⚠ | **조공 = `SendTribute(from, to, gold, food)` — 비동맹 대상 전용.** 동맹 상대에게는 `TransferResources`. **천명 불가 [MUST]**. **단 이는 §1.2 [MUST] 의 적용 범위를 축소하므로 U-D1 승인 전 4단계 착수 불가.** | §1.2 는 "**동맹 전용 메커니즘**" 아래 "**자원 지원**(금·식량 이전)" 을 열거(`SPEC:64-66`)하고 구현도 이를 집행한다(`AreAllied` 강제, enum 주석 "자원 지원은 동맹 전용 (§1.2)"). **경로를 둘로 쪼갠다고 [MUST] 가 지켜지는 것이 아니다** — 비동맹 금·식량 이전은 그 자체가 §1.2 의 범위 변경이다. 천명 금지(§2.8.3)를 헤더 [MUST] 로 올리고 스트림 신설(U-D2)에 게이트를 걸면서 이것만 임의 확정하는 것은 자기모순 | 2026-07-17 |
| **E7** | **조공과 동맹 자원지원은 턴당 캡 예산을 공유한다 [MUST]** — 기존 `TransferredGoldThisTurn`/`TransferredFoodThisTurn` 를 조공도 함께 증가시키고, 상한은 `alliance_transfer_cap_per_turn`(gold 500/food 500) 하나로 판정. **조공 전용 캡 신설 금지.** | 캡은 **보내는 세력당 턴 누계**(대상 무관, `DiplomacyManager.cs:86-94` 가 `from!.Transferred*ThisTurn` 를 검사). 분리하면 유효 우회 경로 = **"동맹 A 에게 지원 500 → 비동맹 제3국 B 에게 조공 500" = 턴당 1000 이전**으로 §1.2 상한이 무력화된다. (E6 이 동맹 상대 조공을 가드로 막으므로 '같은 상대에게 지원+조공' 은 도달 불가 — 그 시나리오를 근거로 들면 안 된다) | 2026-07-17 |
| **E8** | **전투 Favor 훅은 `GameManager.Attack` 의 3분기에 각각 배선한다** — ①육상전 ②해상전 ③무저항 함락. `PublishBattleEvents` 내부에 넣지 않는다. | `PublishBattleEvents` 는 **육상 경로에서만 호출**(`:328` 단일 호출처, 정의 `:348`). 해상전은 `:284-288`, 무저항 함락은 `:311-313` 에서 각각 조기 return 하며 `BattleEnded` 조차 발행하지 않는다. 내부에 넣으면 **2경로 누락** | 2026-07-17 |
| **E9** | **제안/수락 2단계 도입** — `ProposeAlliance`/`ProposeNonAggression`/`ProposePeace` + `RespondToProposal(accept)`. `GameState.PendingProposals` 에 **1턴 유효**(`ExpiresOnTurn`), `CollectIncome` 에서 만료 제거. **AI 의 응답 규칙은 §7.2 0행에 데이터로 규정**한다. 핫시트 인간 2인 간에는 기존 즉시 체결(`FormAlliance`) 유지. | `DiplomacyManager.cs:22` 주석이 예고한 확장. 스펙 §584 이름 정합. **응답 규칙이 없으면 AI↔AI 동맹이 절차상 성립 불가** → §9 요구사항 게이트 직결. 인간 2인은 §1.2 '동석 구두 합의' 전제라 절차 불필요 | 2026-07-17 |
| **E10** | **계략 확률은 `cinematic` 과 동형의 무상태 해시 파생**으로 판정한다 — 순차 소비 스트림이 아니다. `p = H(masterSeed, "diplomacy", turn, executor, targetA, targetB) % 10000`. | `SPEC:602` 말미: "`cinematic` 스트림은 순차 소비가 아니라 **무상태 해시 파생**(§2.7.3)" — 스펙이 이미 승인한 양식. 무상태이므로 **소비 격리 [MUST] 위험이 0**(다른 스트림 시퀀스를 바꿀 수 없다)이고 세이브 스트림 연속성 부담도 없다. **세이브스컴 방지**도 자동 — 같은 (턴·시전자·대상) 은 재시도해도 같은 결과. `combat` 스트림 재사용은 **금지**(전투 리플레이 오염) | 2026-07-17 |
| **E11** | **AI 외교 판단(`AiDiplomat`)은 난수를 쓰지 않는다 — 순수 결정적.** 난수는 **계략 성공 판정에만**(E10). | `AIController` 클래스 주석의 계약: "난수 없이 결정적(ordinal 순회)이라 시드 리플레이(§8)와 자동 정합". AI 판단에 난수를 넣으면 §8 골든 리플레이가 전부 무효 | 2026-07-17 |
| **E12** | **계략 초판은 이간계(Sow Discord) 1종만.** 매수·유언비어는 [MAY, Phase 5]. | 요구사항을 정확히 충족하는 최소 집합. §0.3-1 "한 번에 한 모듈" | 2026-07-17 |
| **E13** | **관계 술어를 2개로 분리해 중앙화한다** — `IsHostile(self, otherId)`(= **공격해도 되는가**: Alliance·NonAggression·Devoted 제외)와 `HasLandFront(self)`(= **육상 전선이 있는가**: **Alliance 만 제외**). `:220`(공격)·`:104`·`:240` 은 `IsHostile` 로, **`:60`·`:194` 는 `HasLandFront` 로** 교체. | **`:60` 은 공격 필터가 아니라 분기 게이트다** — `LandReachableEnemyExists` 가 false 면 AI 는 육상 분기 전체(**징병 포함**)를 건너뛰고 `NavalOperations` 로 간다(`:41-52`). 여기에 불가침을 '비적대'로 넣으면 육상 이웃 전부와 불가침인 AI 는 고립 판정 → `NavalOperations` 도 즉시 return(`:109`) → **징병조차 않는 영구 무행동**. 불가침에는 만료가 없어 회복 경로도 없다 | 2026-07-17 |
| **E14** | **`alliance_transfer_cap_per_turn` 은 최상위 유지** — `diplomacy` 블록으로 **이동하지 않는다**. | 이동 = 기존 키의 **형태 변경** → 마이그레이션·호환 판정 동반(§0.3-7). 얻는 것은 정돈뿐. (⚠ `diplomacy` 블록 **신규 추가** 자체는 §0.3-7 의 '필드 추가' 에 해당해 `schema_version` 상향 대상 — §6.1) | 2026-07-17 |

---

## 5. 관계도(Favor) 상세

### 5.1 태도 구간 — 임계값은 **해당 태도에 포함** (E4)

| 조건 | 태도 | AI 성향 |
| --- | --- | --- |
| `favor >= devoted` (600) | 맹우 (`Devoted`) | 동맹 제안·유지. 공격 후보에서 **제외**(E13 `IsHostile`) |
| `favor >= friendly` (200) | 우호 (`Friendly`) | 불가침 제안. 공격 회피(스코어 후순위) |
| `hostile < favor < friendly` | 중립 (`Neutral`) | 기회주의 — 약하면 친다 (현행 동작) |
| `favor <= hostile` (-200) | 적대 (`Hostile`) | 선전포고 검토. 목표 우선순위 상승 |
| `favor <= nemesis` (-600) | 숙적 (`Nemesis`) | 최우선 표적. 동맹·불가침 제안 거부 |

> 판정 순서 = `Nemesis → Hostile → Devoted → Friendly → Neutral`. `-600` 은 `Nemesis`, `+600` 은 `Devoted` 다(경계 소유 = 해당 태도). Check 에서 `nemesis < hostile < 0 < friendly < devoted` 강제.

### 5.2 Favor 변동 소스 화이트리스트 [MUST] (E5)

**대상 쌍은 집합으로 정의한다** — 전투 방어측은 단일 세력이 아니다(육상 공동 수비 §1.2, 해상 혼전 F3).

| `FavorSource` | 시점 (§2.2) | 대상 쌍 | 기본값(초안, 정수) |
| --- | --- | --- | --- |
| `BattleFought` | [5] 해결 | 공격자 ↔ **해당 전투에 병력을 낸 모든 방어 세력** 각각(distinct) | **-120** |
| `ProvinceLost` | [5] 해결 | 공격자 ↔ **영지 소유자(owner) 만** | **-80** (전투분에 가산) |
| `BloodlessCapture` | [5] 해결 | 점령자 ↔ 피탈자 | **-40** |
| `TributeReceived` | [2][3] / [4] | 조공자 ↔ 수령자 | `gold / gold_per_favor + food / food_per_favor` (절사, 상한 §5.3) |
| `AllianceFormed` | 즉시 | 양측 | **+200** |
| `PeaceMade` | 즉시 | 양측 | **+50** |
| `Betrayal` | 즉시 | 배신자 ↔ 피배신자 | **-600** |
| `BetrayalReputation` | 즉시 | 배신자 ↔ **제3국 전체** | **-100** |
| `SchemeDiscord` | [2][3] / [4] | 이간 대상 두 세력 | **-250** |
| `SchemeExposed` | [2][3] / [4] | 시전자 ↔ 각 대상 | **-100** |
| `CommonEnemy` | [1] 수입 | 같은 세력과 교전 중인 쌍 | **+30/턴** |
| `Decay` | [1] 수입 | **음수(적대) 쌍만** | 0 방향으로 **5/턴** |

**설계 의도**:
- **`BattleFought` 가 방어 세력 집합에 걸리는 이유** — 육상 공동 수비로 동맹을 도와 피를 흘린 세력이 리터럴 독해상 어느 쌍에도 안 걸리면 **"동맹을 도와 싸워도 공격자와 관계가 나빠지지 않는" 구멍**이 생겨 요구("전투를 하면 우호도가 떨어짐")를 정면으로 비껴간다.
- **`Decay` 가 음수 구간에만 적용되는 이유 [MUST]** — 감쇠의 입법 취지는 **영구 원한 방지**(판이 굳지 않게)다. 우호까지 감쇠시키면 아래 §5.5 의 동맹 도달 산술이 무너진다.
- **`CommonEnemy`** — "적의 적은 친구". AI 들이 **자연스럽게 뭉치는 주 엔진**이며 요구사항 "AI 들이 지들끼리 동맹" 의 핵심.
- **`BetrayalReputation`** — 동맹 중 선전포고 시 **제3국 전체**가 등을 돌린다. G9(배신 무페널티) 해소 + "배신하면 국제적 고립".

### 5.3 조공 수확 체감 [MUST]

**`diplomacy.tribute.favor_ceiling: 500`** — 조공으로 올릴 수 있는 Favor 는 **+500 까지**. 그 이상은 조공으로 1도 오르지 않는다.

> 없으면 금으로 전 세계 우호도를 도배해 외교가 자판기가 된다. 맹우(+600)는 **동맹·공동의 적** 같은 *행동*으로만 도달 가능해야 한다 — 돈으로 살 수 있는 것은 '적당한 호의'까지다.

캡(E7)과 상한은 다른 장치다: **캡 = 보내는 세력의 턴당 이전 총량**, **상한 = 조공이 도달 가능한 Favor 천장**.

### 5.4 계략 — 이간계 (Sow Discord)

- **행위**: 세력 `C` 가 제3국 `A`·`B` 의 사이를 벌린다. `C ∉ {A, B}` [MUST].
- **비용**: `scheme.cost_gold`(300). 턴당 `scheme.per_turn`(1) — `FactionState.SchemesThisTurn`, `CollectIncome` 리셋.
- **성공 판정 (만분율, 무상태 해시 파생 — E10)**:
  ```
  executor_int = C 소유 캐릭터 중 최대 INT        (CharacterOwners 로 조회, 없으면 0)
  resist_pol   = max(A 최고 POL, B 최고 POL)      (없으면 0)
  p = base_success_permyriad + (executor_int - resist_pol) * int_diff_permyriad_per_point
  p = clamp(p, success_permyriad_min, success_permyriad_max)     // 정수, 절사 없음
  roll = H(masterSeed, "diplomacy", turn, C, Canonical(A,B)) % 10000    // 무상태·결정적
  성공 = roll < p
  ```
  기본값: `base 4000`(40%) / `점당 60`(0.6%p) / `min 500`(5%) / `max 9000`(90%).
- **결과**: 성공 → `favor(A,B) -= 250`. 실패(발각) → `favor(C,A) -= 100`, `favor(C,B) -= 100`.
- **INT·POL 실효화** — G4·G5 를 이 경로로 처음 해소한다. 지력이 드디어 §2.4 규정("계략 성공/회피")대로 동작한다.
- **`scheme_success` 버프 연결은 비목표 [MAY]** — 조조 `hero_of_chaos`(+15)는 **전투 버프 경로(`BattleSideState`)에만 등록**되며(`SkillSystem.cs:72-75`), 계략은 전투 밖 행위라 **전투 밖 패시브 조회 경로**라는 별도 설계가 필요하다. 초판은 순수 INT 만 본다. **정직한 서술: `scheme_success` 는 본 설계 후에도 여전히 no-op 이다.**

### 5.5 ⚠ AI 동맹 도달 가능성 — 수치 근거 [MUST]

> §9 의 요구사항 직결 게이트("AI 간 동맹 1회 이상 체결")가 **설계 상수만으로 실패하지 않는지** 산술로 증명한다. 이 절이 §6.1 기본값의 존재 이유다.

비동맹 AI 쌍에 걸리는 지속적 양(+) 소스는 `CommonEnemy` 뿐이다. 따라서:

| 조건 | 순증/턴 | `alliance_favor_min` 도달 |
| --- | --- | --- |
| ❌ **기각안**: `CommonEnemy +10`, `Decay 5`(전 구간), `min 600` | `+10 - 5 = +5` | **120턴 연속 공동교전** — `BatchSimulator` 기본 `turnCap=200`, `AiTests` 는 60·80턴. **사실상 도달 불가 → 게이트가 설계 상수로 실패** |
| ✅ **채택안**: `CommonEnemy +30`, `Decay` **음수 구간만**, `min 300` | `+30` (양수 구간 감쇠 없음) | **10턴** 연속 공동교전 |

추가 경로: §7.2 **2행(동맹 육성 조공)** 이 `favor_ceiling 500` 까지 열려 있어 `CommonEnemy` 와 병행하면 더 빠르다.
> ⚠ **반복 금지**: AI 조공 조건을 `Attitude <= Hostile` 로만 두면 Favor 가 -199 로 오르는 순간 조건이 꺼져 **자기종료**한다 — 조공은 -199 를 넘길 수 없고 `favor_ceiling 500` 은 AI 에게 사문(死文)이 된다. 그래서 §7.2 는 조공을 **2행(동맹 육성)** 과 **5행(전쟁 회피)** 으로 분리한다.

---

## 6. 데이터·세이브 스키마

### 6.1 `data/config/game_rules.json` — 신규 최상위 `diplomacy` 블록

`combat`(`:162-168`)·`duel`(`:169-174`)·`summon`(`:175-191`) 과 **동형의 중첩 스칼라 그룹**. 키는 snake_case, DTO 는 PascalCase(자동 매핑).

```jsonc
"schema_version": 2,             // ⚠ 1 → 2 상향 (아래 근거)
"diplomacy": {
  "favor_min": -1000,
  "favor_max": 1000,
  "favor_initial": 0,
  "attitude_thresholds": { "devoted": 600, "friendly": 200, "hostile": -200, "nemesis": -600 },
  "decay_per_turn": 5,           // 음수(적대) 구간에만 적용 [MUST] — §5.2·§5.5
  "common_enemy_per_turn": 30,   // §5.5 산술 근거
  "on_battle_fought": -120,
  "on_province_lost": -80,
  "on_bloodless_capture": -40,
  "on_alliance_formed": 200,
  "on_peace_made": 50,
  "on_betrayal": -600,
  "on_betrayal_reputation": -100,
  "tribute": {
    "gold_per_favor": 10,        // 금 10당 Favor +1 (정수 나눗셈 = 절사)
    "food_per_favor": 20,
    "favor_ceiling": 500         // §5.3
  },
  "scheme": {
    "cost_gold": 300,
    "per_turn": 1,
    "base_success_permyriad": 4000,
    "int_diff_permyriad_per_point": 60,
    "success_permyriad_min": 500,
    "success_permyriad_max": 9000,
    "discord_favor": -250,
    "exposed_favor": -100
  },
  "ai": {
    "actions_per_turn": 1,
    "alliance_favor_min": 300,   // §5.5 — 600 은 도달 불가라 기각
    "nonaggression_favor_min": 200,
    "war_favor_max": -200,
    "peace_favor_min": -100,
    "max_alliances": 2,
    "power_metric_province_weight": 100,   // §7.2 국력 산식
    "peace_power_ratio": 60,     // 자기 국력 < 상대 × 60/100 → '열세 심각'(종전)
    "war_power_ratio": 130,      // 자기 국력 > 상대 × 130/100 → '전력 우위'(선전포고)
    "tribute_power_ratio": 150,  // 상대 국력 > 자기 × 150/100 → 전쟁 회피 조공
    "target_favor_weight": 30,   // §7.3 (0~300)
    "disposition_war_favor_delta": { "aggressive": 100, "defensive": -100, "expansionist": 0 }
  }
}
```

- **⚠ `schema_version` 1 → 2 [MUST]** — §0.3-7 원문(`SPEC:39`)은 "세이브·데이터 스키마의 형태(**필드 추가**·의미 변경·제거)를 바꾸면 **버전 상향** + 마이그레이션/호환 판정 + 왕복 테스트를 **같은 커밋 단위**로" 라 규정하며 **'필드 추가' 를 명시적으로 열거**한다. 세이브에는 additive 예외 조항이 있지만(`SPEC:525` "additive 필드 추가 = 버전 유지" — §6.2), **데이터 스키마에는 그런 예외가 스펙 어디에도 없다**. 비용도 낮다: `DataLoader.cs:317` 검사는 `>= 1 && <= SupportedSchemaVersion` 이라 2 로 올려도 기존 v1 데이터가 그대로 통과하며(마이그레이션 0줄), `GameState.DataSchemaVersion`(`GameState.cs:11`)이 이미 드리프트를 감지한다 → 실질 비용 = 상수 1줄 + v1 로드 호환 테스트. E14 가 같은 조문으로 키 **이동**을 상향 대상이라 판정한 이상, **추가**만 면제하는 것은 자기모순이다.
- **평탄화 규약**: `dto.Diplomacy.Tribute.FavorCeiling` → `GameRules.DiplomacyTributeFavorCeiling` (`Combat*`/`Duel*`/`Summon*` 선례, `DataLoader.cs:397-428`).
- **DataLoader 3중 훅 [MUST]** (`:278-312` Need / `:314-352` Check / `:379-443` 매핑) — 세 곳 모두. 하나라도 빠지면 **조용한 무시 또는 NRE**.
- **Check 항목**: `favor_min < 0 < favor_max`; `nemesis < hostile < 0 < friendly < devoted`; `favor_ceiling <= favor_max`; `success_permyriad_min <= max <= 10000`; 전 permyriad `0~10000`; `per_turn >= 1`; `actions_per_turn >= 1`; `0 <= target_favor_weight <= 300`(§7.3 이 `100 + favor*w/1000 > 0` 를 요구); `disposition_war_favor_delta` 의 키가 `valid_ai_dispositions`(`:133-137`)와 **일치**; `*_power_ratio > 0`.
- **밸런스 패널 무작업** — `PanelServer.EditableFiles` 에 `game_rules` 가 이미 포함되고 폼은 JSON 재귀 자동생성이라 신규 키는 **패널 코드 수정 없이 즉시 튜닝 가능**. (성향 델타·국력비를 데이터로 뺀 이유 — 코드 상수로 두면 U-D3 의 "패널로 무코드 조정" 전제가 이 수치들에 대해서만 거짓이 된다.)

### 6.2 세이브 — additive (SaveVersion **유지**)

`SaveSystem.CurrentSaveVersion = 1` 을 **올리지 않는다**. 근거: `SPEC:525` "additive 필드 추가 = 버전 유지(부재 시 기본값 0/빈 세트 로드 — 구세이브 무마이그레이션)" — **세이브에만 있는 명시적 예외**. 선례 = `Mandate`/`PityCount`/`SummonsThisTurn`.

```csharp
// Domain/RelationState.cs
public sealed class RelationState {
    public required string FactionA { get; init; }   // Canonical 정렬 결과의 앞
    public required string FactionB { get; init; }   // 뒤
    public required int Favor { get; set; }
    public int? TruceUntilTurn { get; set; }
    public string PairKey => $"{FactionA}+{FactionB}";   // 파생 — 역파싱 금지
}
// Domain/Proposal.cs : From, To, Kind(alliance|non_aggression|peace), ExpiresOnTurn
// GameState      : List<RelationState> Relations = new();  List<Proposal> PendingProposals = new();
// FactionState   : int SchemesThisTurn { get; set; }
```

> **`FactionA`/`FactionB` 를 필드로 두는 이유 [MUST]**: `PairKey` 문자열만 저장하면 D9 프루닝이 `"{a}+{b}"` 를 **역파싱**해야 하는데, 이는 세력 id 에 `+` 가 없어야만 성립한다. `ValidateFactions` 에는 **id 문자 제약이 없다**(예약어·중복만 검사). 기존 프루닝은 Dictionary 키가 곧 세력 id 라 파싱이 필요 없었다 — 동형이 되려면 두 id 를 직접 들고 있어야 한다.

**additive 배선 — 6점 [MUST]** (앵커가 다르다. `Relations` 는 **GameState 루트**이고 `SchemesThisTurn` 은 **FactionState 하위**라 지점이 갈린다):

| # | 대상 | 지점 | 내용 |
| --- | --- | --- | --- |
| 1 | `Relations` | `SaveDto.cs:8-25` | SaveDto **루트**에 `List<RelationStateDto>? Relations` + `List<ProposalDto>? PendingProposals` (전 필드 nullable) |
| 2 | `Relations` | `SaveSystem.cs:195-211` (**루트 Normalize** `return new GameState {...}`) | `Relations = (dto.Relations ?? new()).Select(...)` |
| 3 | `Relations` | `SaveSystem.cs:214-260` (**루트 ToDto**) | `OrderBy(r => r.PairKey, StringComparer.Ordinal)` 정렬 직렬화 |
| 4 | `Relations` | `SaveSystem.cs:101-115` | **D9 프루닝** (아래) |
| 5 | `SchemesThisTurn` | `SaveDto.cs:50-64` + `SaveSystem.cs:76-90` | `FactionStateDto` nullable 필드 + Normalize `?? 0` |
| 6 | `SchemesThisTurn` | `SaveSystem.cs:226-237` | ToDto 매핑 |

> ⚠ **반복 금지**: `:76-90`·`:226-237` 은 **FactionState 하위 매핑 구간**(`dto.Factions.Select(...)`)이다. 루트 `Relations` 를 여기에 넣으려 하면 들어갈 자리가 없고, DTO 필드만 만들고 읽기·쓰기 배선을 빠뜨리면 `?? new()` 때문에 **항상 빈 리스트가 되어 조용히 유실**된다. 왕복 테스트만이 이를 잡는다.

**D9 fail-soft 프루닝 [MUST]** — 술어는 `db.Factions` 가 **아니라 `liveFactionIds`**(= 세이브 `Factions` 에 살아남았고 db 에도 있는 세력 집합, `SaveSystem.cs:98,:110`)로 판정한다. `db.Factions.ContainsKey` 를 쓰면 **db 정의엔 있으나 세이브에서 이미 스킵된 세력**을 가리키는 쌍이 살아남아 dangling `RelationState` 가 된다 — 기존 `relation:{key}@{f.Id}` 프루닝과 동작이 달라진다.
- `Relations`: `FactionA` 또는 `FactionB` ∉ `liveFactionIds` → 제거 + `skipped.Add($"relation_pair:{r.PairKey}")`
- `PendingProposals`: `From` 또는 `To` ∉ `liveFactionIds` → 제거 + `skipped.Add($"proposal:{p.From}->{p.To}")`

**결정성 [MUST]**: `Relations`·`PendingProposals` 는 ordinal 정렬 직렬화 — 기존 `Progress`/`FiredCutsceneIds`/`CharacterOwners` 선례(`SaveSystem.cs:238` "동일 상태 = 동일 바이트").

> 별건 [SHOULD]: 기존 `FactionState.Relations` 딕셔너리와 `Factions` 리스트는 **정렬 없이** 직렬화되어(`:226,:231`) 삽입 순서에 따라 바이트가 달라질 수 있다. 본 설계 범위 밖이나 왕복 **바이트** 비교를 하려면 별도 커밋으로 해소해야 한다.

---

## 7. AI 외교 의사결정 (`AiDiplomat`)

### 7.1 호출 지점

`AIController.TakeTurn`(`:33-53`)의 **`CaptureEmptyNeighbors`(`:39`) 뒤, 군사 분기(`:41`) 앞**에 `_diplomat.Decide(faction);`

> 군사 결정 **전**에 관계를 확정해야 같은 턴의 공격 필터(`IsHostile`)에 즉시 반영된다.

### 7.2 판단 — **행위-major** 의사코드 [MUST]

> 순회 구조가 결정성을 좌우하므로 의사코드로 고정한다. **세력-major(대상마다 1~6 검사)로 읽으면 안 된다** — 그러면 행 번호가 우선순위 의미를 잃고 실질 우선순위가 '대상 Id ordinal' 이 되며, **5행(계략)은 대상이 단수가 아니라 `(A,B)` 쌍**이라 대상-major 루프에 구조적으로 들어가지 못한다.

```
Decide(self):
  budget = rules.ai.actions_per_turn          # 기본 1
  for action in ActionOrder(self.disposition):     # 성향 = 이 배열의 순열
      if action.IsPairwise:                        # 5행 계략
          for (A, B) in AllPairs().OrderBy(a.Id).ThenBy(b.Id):   # ordinal
              if action.Matches(self, A, B): action.Do(self, A, B); return
      else:
          for t in OtherFactions().OrderBy(t.Id):                # ordinal
              if action.Matches(self, t): action.Do(self, t); return
  # 매칭 없으면 무행동
```

**기본 행위 순서** (`ActionOrder` 기본값 — 성향은 이 배열의 **순열**):

| # | 행위 | 조건 | 비고 |
| --- | --- | --- | --- |
| **0** | **수신 제안 응답** | `PendingProposals` 중 `To == self` | **최우선.** 수락 조건: `alliance` = `Favor >= ai.alliance_favor_min && 자기 동맹 수 < ai.max_alliances && Attitude != Nemesis` / `non_aggression` = `Favor >= ai.nonaggression_favor_min` / `peace` = `Favor >= ai.peace_favor_min \|\| power(self) < power(t) * peace_power_ratio / 100`. **응답은 `actions_per_turn` 예산에 포함되지 않는다**(응답 불능 = 제안 사문화) |
| 1 | 종전 제안 | `War` && (`Favor >= ai.peace_favor_min` \|\| `power(self) < power(t) * peace_power_ratio / 100`) | `ProposePeace` |
| 2 | **동맹 육성 조공** | `Favor >= 0 && Favor < ai.alliance_favor_min && 공동의 적 존재 && Treasury > scheme.cost_gold * 2` | ⚠ §5.5 — 이 행이 없으면 `favor_ceiling` 이 AI 에게 사문 |
| 3 | 동맹 제안 | `Favor >= ai.alliance_favor_min && 공동의 적 존재 && 자기 동맹 수 < ai.max_alliances` | `ProposeAlliance` |
| 4 | 불가침 제안 | `Favor >= ai.nonaggression_favor_min && power(t) > power(self)` | `ProposeNonAggression` |
| 5 | 전쟁 회피 조공 | 인접 && `Attitude <= Hostile` && `power(t) > power(self) * tribute_power_ratio / 100` | 매수 |
| 6 | 계략(이간계) | `IsHostile(self,A) && IsHostile(self,B) && favor(A,B) >= friendly` | **쌍 인자** |
| 7 | 선전포고 | 인접 && `Favor <= ai.war_favor_max + disposition_war_favor_delta[disposition]` && `power(self) > power(t) * war_power_ratio / 100` | `DeclareWar` |

**국력 산식 [MUST] (데이터·정수)**:
```
power(f) = f.OwnedProvinceIds.Count(육상만) * ai.power_metric_province_weight + f.총병력
```
> '국력' 을 정의하지 않으면 구현자가 발명해 하드코딩한다(§5 [MUST] 위반). 문턱은 전부 `*_power_ratio` 키로 데이터화했다.

**6행(계략)이 이 설계의 백미다** — AI 가 **플레이어의 동맹을 깨려고 이간계를 걸어온다**.

**`AiDisposition` 확장** (현재 징병 예산·병종에만 쓰임 `:175-180` → 외교로 확장). **순서 재배치는 수치가 아니라 규칙이므로 코드에 둔다**(근거: 데이터로 빼면 행위 배열의 순열을 JSON 으로 검증해야 해 §5.5 의 Check 비용이 이득을 넘는다). 수치인 문턱 델타만 데이터(`disposition_war_favor_delta`).

| 성향 | 외교 |
| --- | --- |
| `aggressive` | 선전포고 문턱 완화(델타 `+100`), **조공 스킵**(2·5행 제외) |
| `defensive` | 불가침·조공 우선(4·5행을 1행 뒤로), 선전포고 문턱 강화(델타 `-100`) |
| `expansionist` | **계략 선호**(6행을 2행 앞으로), 델타 `0` |

### 7.3 목표 선정에 Favor 반영

`AttackWeakNeighbors`(`:208-233`)를 **두 곳** 고친다.

**① 정렬 키 — garrison 배수로 정규화** (절대 가산 금지):
```
score = garrison * (100 + favor(self, owner) * ai.target_favor_weight / 1000) / 100
        // 전부 C# 정수 나눗셈 = 0 방향 절사 (§4.4 — 공식마다 명세)
        // favor -1000, w=30 → 배수 70/100 (우선)  |  favor +1000 → 130/100 (후순위)
후보 정렬: OrderBy(score).ThenBy(Id, Ordinal)      // 동점 타이브레이크 [MUST]
```
> ⚠ **절대 가산(`garrison + favor*w/100`) 기각 근거**: favor 항은 최대 ±300 인데 실제 garrison 은 시작 금 1000~1200 / spearman 50골드/명 / 영지 산출 60~120골드/턴 / AI 예산율 40~70% 라 초·중반 내내 수십~수백 규모다 — favor 항이 garrison 을 **압도하거나(초반) 무의미해지거나(후반)** 둘 중 하나이며 '가중' 이 성립하는 구간이 없다. 배수 정규화는 스케일 불변이다.
> ⚠ **음수 절사 주의**: `favor * w / 1000` 은 C# 정수 나눗셈이라 **내림이 아니라 0 방향 절사**다(favor 는 음수 구간이 주 사용처). 예: `-199*30/1000 = -5` (내림이면 -6). C++ 도 절사라 §7 Phase 3 오라클과 일치한다 — **'내림' 이라 명세하면 오라클이 깨진다.**

**② 문턱 판정 — `target[0]` 단독 판정 폐기 [MUST]**:
현재는 정렬 후 **`target[0]` 하나만** 전력 문턱에 건다(`:229-231`). 정렬 키를 '최약체' 에서 사실상 '최증오' 로 바꾸면서 이를 두면 **증오 대상이 강할 때 AI 가 바로 옆 무방비 영지를 두고 아무것도 공격하지 않는 마비**가 생긴다.
> 예: 증오 이웃(favor -1000 → score `250*70/100=175`, garrison 250) vs 중립 이웃(favor 0 → score 10, garrison 10) → target[0] = 중립 이웃… 이 아니라 **175 > 10 이므로 중립이 먼저다**. 그러나 증오 이웃 garrison 이 작으면(예: 20 → score 14) target[0] = 증오 이웃(14 < 10? 아니오)… **경계 사례가 수치에 따라 갈리므로 구조적으로 막는다**: 정렬 순으로 순회하며 **문턱을 통과하는 첫 후보**를 공격한다(`FirstOrDefault(문턱통과)`).

- **정수 산술 [MUST]** — 전 항 절사.
- **결정성 [MUST]** — 동점 시 `Id` ordinal. `AIController` 의 시드 리플레이 계약(§8) 유지.

---

## 8. 단계 계획

> §0.3-1 "한 번에 한 Phase·한 모듈만". 각 단계는 `dotnet build -warnaserror && dotnet test` **녹색에서 커밋**.

| 단계 | 내용 | 게이트 |
| --- | --- | --- |
| **0a** | **술어 추출 — 동작 보존 커밋.** `IsHostile`/`HasLandFront` 를 현재 동작 그대로 추출해 5개 사이트 교체 | 기존 `AiTests` 녹색 (동작 무변화) |
| **0b** | **F1 수정 — 동작 변경 커밋.** 불가침을 해상(`:104`)·진군(`:240`)에서도 존중. `:60`·`:194` 는 `HasLandFront`(Alliance 만 제외) 유지 | **신설 회귀**: ①불가침 상대 항구를 상륙 공격하지 않는가 ②**전 육상 이웃과 불가침인 AI 가 계속 징병하고 무행동에 빠지지 않는가**(E13 근거) |
| **1** | `RelationLedger`+`RelationState`+`FavorSource`+`Attitude`, `Canonical` 이전. 세이브 6점 + D9 프루닝 + 정렬 직렬화 | 왕복(보존·프루닝·바이트 동일) + `alliance:joseon+wei` 회귀 |
| **2** | 데이터 — `diplomacy` 블록 + `schema_version` 2 + `SupportedSchemaVersion` 2 + DataLoader 3중 훅 | `dotnet test`(§5.5 경유 — **build 만으로는 JSON 오매칭이 통과**) + 누락/범위위반 부정 테스트 + **v1 데이터 로드 호환** |
| **3** | 전투 → Favor 훅 **3분기**(E8) + `CollectIncome` 감쇠·`CommonEnemy`·카운터 리셋·제안 만료 | 3경로 각각 + **공동 수비 참전 동맹국도 Favor 하락**(§5.2) |
| **4** ⚠ | 조공 — `SendTribute` + **캡 예산 공유(E7)** + ceiling. **U-D1 승인 전 착수 불가** | **캡 우회 불가 [MUST]**: 동맹 A 에게 지원 500 후 **비동맹 제3국 B** 에게 조공 시도 → `TransferCapExceeded` |
| **5** | 배신 페널티 — `DeclareWar` 가 동맹 중이면 `Betrayal` + `BetrayalReputation` | 공동 승리 취소 기존 테스트 유지 |
| **6** ⚠ | 계략 — `SchemeSystem` + 무상태 해시 파생. **U-D2 승인 전 착수 불가** | 성공/실패/발각 + **동일 (시드·턴·대상) 재현** + **`combat` 스트림 소비량 불변** |
| **7** | `AiDiplomat`(0~7행) + E9 제안/수락 + §7.3 목표 선정 + `AIController` 배선 | §9 게이트 전량 |
| **8** | 명령 표면 — 콘솔 `tribute`/`scheme`/`nonaggress`/`propose`/`accept` + UE5 외교 UI | 콘솔 왕복 |

---

## 9. DoD

- [ ] `dotnet build -warnaserror` + `dotnet test` 녹색 (전 단계)
- [ ] **AI vs AI 캠페인에서 AI 간 동맹이 `turnCap` 내 1회 이상 체결** (`GameSetup.AiCampaign` + `Progress` 의 `alliance:` 항목) ← **요구사항 직결 게이트.** §5.5 가 산술 근거를 제시한다 (10턴 도달)
- [ ] **배치 시뮬 회귀 — 절대 70% 가 아니라 '도입 전후 비교'.** 스펙 §7 Phase 2 DoD 원문은 "특정 세력 승률 70% 초과 없음 [SHOULD]" 이나 **이 게이트는 외교와 무관하게 이미 실패 중**이다 — `docs/roadmap.md:30`: "100판 결과: **칼데아 98%** — 샘플 맵 지리 불균형 검출(12영지 샘플 한계, 맵 확장 §2.1 시 시작 조건 재밸런스 필요)". 판정 = **①최고 승률이 도입 전(98%) 대비 악화 없음 ②`simulate 100 --assert` 가 크래시·비결정 없이 완주**. 절대 70% 달성은 **맵 확장(§2.1)의 책임**이지 외교의 책임이 아니다
- [ ] **조공이 §1.2 캡을 우회하지 못한다** [MUST] — 동맹 A 지원 500 → **비동맹 B** 조공 시도가 `TransferCapExceeded`
- [ ] 조공 품목에 천명이 **없다** [MUST] — API 시그니처에 `Mandate` 인자 부재로 컴파일 수준 보장
- [ ] 계략이 **동일 (시드·턴·시전자·대상) 에서 재현**되고 `combat` 스트림 소비량이 **불변**(무상태 해시 파생 — E10)
- [ ] 세이브 왕복: `Relations`·`PendingProposals`·`SchemesThisTurn` 보존, **구세이브(v1, 필드 부재) 무마이그레이션 로드**, 죽은 세력 쌍·제안 프루닝 고지
- [ ] 데이터 `schema_version` 2 로드 + **v1 데이터 하위 호환 로드**
- [ ] 불가침이 **지상·해상·진군 전 경로에서 존중**되고, 전 이웃과 불가침인 AI 가 **무행동에 빠지지 않는다**
- [ ] 부자 2인 콘솔 완주(U1) 시 — **아들이 조공·계략을 이해하고 쓰는가**

---

## 10. 미해결 — 사용자 결정 필요

> `docs/decisions-pending.md` 규약: 사용자만 내릴 수 있는 결정만 등재하고, 그 외는 AI 가 합리적 기본값으로 확정한다. 아래는 **전자** — 둘 다 **[MUST] 의 적용 범위를 바꾸므로** AI 가 확정할 수 없다.

| # | 항목 | 쟁점 | 제안 |
| --- | --- | --- | --- |
| **U-D1** ⚠ | **비동맹 자원 이전(조공) = §1.2 [MUST] 개정** | §1.2 는 "**동맹 전용 메커니즘**" 아래 "**자원 지원**(금·식량 이전, 턴당 상한)" 을 열거(`SPEC:64-66`)하고, 구현도 `AreAllied` 로 집행한다(`DiplomacyManager.cs:83`, enum 주석 `:13`). 조공은 이 [MUST] 의 범위를 축소한다. **승인 없이 4단계 착수 불가.** | **(a) 개정 승인** — §1.2 에 "자원 이전은 동맹(지원)과 비동맹(조공)으로 분기하되 **턴당 캡 예산을 공유**한다" 명문화. 요구사항을 그대로 충족. **(b) 축소 대안** — 조공을 **자원 이전 없는 Favor 제스처**(예물 = 금 소모만, 수령자 자산 증가 0)로 바꾸면 §1.2 의 '이전' 이 발생하지 않아 [MUST] 와 충돌하지 않는다. 단 "조공" 의 손맛이 죽는다. → **(a) 권장** |
| **U-D2** ⚠ | **RNG `diplomacy` 명명 스트림 등재 = §4.4 개정** | §4.4 "스트림 신설·구현체 변경은 **스펙 개정 항목**"(`SPEC:602`). **승인 없이 6단계 착수 불가.** | **승인 권장 — 위험 0의 형식적 등재.** E10 이 `cinematic` 과 동형의 **무상태 해시 파생**을 쓰므로 순차 소비가 없고, §4.4 가 스트림 신설을 개정 항목으로 묶은 이유인 **소비 격리 [MUST] 위반이 구조적으로 불가능**하다(다른 스트림 시퀀스를 바꿀 수 없음). v1 목록에 `diplomacy`(무상태 해시 파생) 1줄 추가 |
| **U-D3** | **밸런스 초기값 전량**(§5.2·§6.1) | 전부 초안. `on_battle_fought(-120)` vs `decay_per_turn(5)` 는 "한 번 싸우면 24턴 원한" 을 뜻한다 | 아들 테스트(U1) 후 튜닝. **§5.5 의 동맹 도달 산술만은 깨지 말 것**(`common_enemy_per_turn > 0` 이고 `Decay` 가 양수 구간 미적용이어야 성립). 밸런스 패널로 무코드 조정 가능 |
| **U-D4** | **`scheme_success` 버프 실효화 시점** | 조조 `hero_of_chaos`(+15)를 계략에 연결하려면 전투 밖 패시브 조회 경로 신설 필요 | Phase 5 [MAY]. 초판은 순수 INT |

---

## 11. 기각한 대안 (반복 금지 — `docs/work-history.md` 연동)

| 대안 | 기각 이유 |
| --- | --- |
| **AI 편향 제거 코드** | **편향이 없다**(§1.1). 없는 것을 지우려다 `Controller` 의존을 새로 만들면 AI 가 인간을 특별 취급하게 된다 |
| **비대칭 관계도**(A→B ≠ B→A) | 이중 장부 + `AIController` 가 관계를 단방향으로만 조회해 즉시 오독 (E2) |
| **Favor 를 `FactionState` 에 저장** | 쌍 상태를 세력별로 쪼개면 동기화 버그 원천 (E3) |
| **`RelationState` 가 `PairKey` 문자열만 보유** | D9 프루닝이 `"{a}+{b}"` 역파싱을 요구하는데 세력 id 문자 제약이 없어 `+` 포함 id 에서 깨진다 (§6.2) |
| **`CommonEnemy +10` / `Decay` 전 구간 / `alliance_favor_min 600`** | **AI 동맹이 산술적으로 도달 불가** — 순증 +5/턴 → 120턴 필요, `turnCap` 200. 요구사항 직결 게이트가 설계 상수로 실패 (§5.5) |
| **AI 조공 조건을 `Attitude <= Hostile` 단일 행으로** | Favor -199 에서 조건이 꺼져 **자기종료** → `favor_ceiling 500` 이 AI 에게 사문 (§5.5) |
| **조공 전용 턴당 캡 신설** | §1.2 상한 우회 — "동맹 A 지원 500 → 비동맹 B 조공 500" = 1000 (E7) |
| **조공 품목에 천명 포함** | §2.8.3 [MUST] 정면 위반 |
| **`PublishBattleEvents` 내부에 Favor 훅** | 해상전·무저항 함락 **2경로 누락** (E8) |
| **전투 Favor 를 '공격자↔방어자' 단일 쌍으로** | 육상 공동 수비 참전 동맹국이 어느 쌍에도 안 걸려 **동맹을 도와 싸워도 관계가 안 나빠진다** (§5.2) |
| **`combat` RNG 스트림을 계략에 재사용** | 전투 골든 리플레이 오염 (§4.4 소비 격리 [MUST]) |
| **계략을 결정적으로 만들어 U-D2 회피** | 성공/실패가 뻔해져 재미가 죽는다. 무상태 해시 파생이 **개정 비용은 형식적이면서 확률을 살리는** 제3의 길 (E10·U-D2) |
| **AI 외교 판단에 난수 사용** | `AIController` 결정성 계약 파기 → §8 시드 리플레이 무효 (E11) |
| **`alliance_transfer_cap_per_turn` 을 `diplomacy` 블록으로 이동** | 기존 키 형태 변경 = 마이그레이션 동반 (E14) |
| **`diplomacy` 블록 추가 시 `schema_version` 유지** | §0.3-7 이 '**필드 추가**' 를 명시적으로 상향 대상에 열거(`SPEC:39`). 세이브의 additive 예외(`SPEC:525`)는 **세이브 전용** — 데이터에는 그런 조항이 없다 (§6.1) |
| **§7.3 스코어를 절대 가산(`garrison + favor*w/100`)으로** | 스케일 불균형 — favor 항 ±300 vs garrison 수십~수백 → 초반 압도/후반 무의미, '가중' 성립 구간 없음. 배수 정규화가 스케일 불변 (§7.3) |
| **§7.3 반올림을 '내림' 으로 명세** | `favor*w/1000` 은 C# 정수 나눗셈 = **0 방향 절사**이고 Favor 는 음수 구간이 주 사용처. C++ 도 절사라 '내림' 명세는 §7 Phase 3 오라클을 깬다 (§7.3) |
| **`AttackWeakNeighbors` 의 `target[0]` 단독 문턱 판정 유지** | 정렬 키에 증오를 넣으면 **증오 대상이 강할 때 AI 마비** — 옆의 무방비 영지를 두고 무행동 (§7.3) |
| **`IsHostile` 하나로 5개 사이트 전부 교체** | `:60`·`:194` 는 공격 필터가 아니라 **분기 게이트** — 불가침을 넣으면 전 이웃과 불가침인 AI 가 **징병조차 않는 영구 무행동** (E13) |
| **`AiDiplomat` 을 세력-major 순회로** | 행 번호가 우선순위 의미를 잃고 실질 우선순위가 '대상 Id ordinal' 이 된다. **계략은 쌍 인자**라 대상 루프에 구조적으로 못 들어간다 (§7.2) |
| **Favor 가 조약을 자동 전이시킴** | 플레이어 동의 없이 상태가 바뀌어 핫시트 2인에서 통제 상실 (E1) |
| **시나리오 초기 관계(`initial_relations`) 를 이번에 포함** | `GameSetup`·`FactionDto`·`Faction` 배선이 함께 필요해 범위가 번진다. 배선 없이 데이터만 넣으면 **검증만 통과하고 게임에 반영 안 되는 죽은 데이터** → 비목표로 유예(§2), G10 미해소 |
