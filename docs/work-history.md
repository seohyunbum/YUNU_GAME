# WorldConquest 작업 이력 (work-history)

> **이 문서의 목적**: 성공 결과가 아니라 **검증 실패한 시도·되돌린 변경·기각한 규칙/밸런스 안·하지 않기로 한 접근과 그 이유**를 기록해, 미래 세션과 병행 에이전트가 같은 시행착오를 반복하지 않게 한다.
>
> **운용 규칙**
> 1. 의미 있는 실패·되돌림·기각·보류가 있었으면 **커밋/최종 보고 전** 아래에 1항목 기록한다 [SHOULD].
> 2. 같은 문제가 다시 보이면 이 문서를 **먼저** 확인한다.
> 3. '의도적으로 안 고친 결정'도 근거와 함께 기록한다.
>
> **항목 템플릿**
> ```
> ## YYYY-MM-DD — <제목>
> - **시도/상황**:
> - **결과**:
> - **이유**:
> - **다음 작업자가 반복하지 말 판단**:
> - **관련 파일·테스트·커밋**:
> ```

---

## 2026-07-16 — 시네마틱·초빙(가챠) 설계 시 §4.4 단일 Random 이 blocker 로 판명

- **시도/상황**: 시네마틱 `chance_permyriad` 트리거·가챠 뽑기를 스펙 §4.4 문구 그대로 '시드 주입 Random 하나'로 설계.
- **결과**: 적대 검증에서 blocker — 컷씬 데이터 1편만 추가해도 난수 소비 카운트가 전진해 이후 전투 굴림 시퀀스가 바뀌고, 동일 시드 리플레이가 전면 파괴됨(설계 자신의 '컷씬은 게임 상태 불변' [MUST] 와 모순 — RNG 내부 상태도 게임 상태).
- **이유**: 단일 스트림 공유 = 콘텐츠 삽입이 재현성을 깬다. 선행 확정 'b(콘텐츠 삽입 마이그레이션 0줄)'의 정신을 난수 축에서 위반.
- **다음 작업자가 반복하지 말 판단**: 연출·콘텐츠용 난수를 전투 스트림과 공유하지 말 것. 명명 스트림(combat/world_events/summon:{세력}/cinematic) 격리 + cinematic 은 무상태 해시 파생.
- **관련 파일·테스트·커밋**: `docs/GAME_DESIGN_SPEC.md` §4.4·§2.7.3 (v1.3 개정 승인), 커밋 54d3d03.

## 2026-07-16 — 튜너블 메타데이터를 data JSON 안에 넣는 안(D-6) 기각

- **시도/상황**: 야생게임 BALANCE_TUNABLES 이식 — `game_rules` 수치에 `{value,label,min,max}` 메타데이터 부여 검토.
- **결과**: 기각. min/max 를 값과 같은 파일에 두면 값을 고치는 사람이 범위도 고칠 수 있어 **자기증명(self-attesting)** — 1차 편집 표면 안전망이 못 됨. 야생게임 4역 중 3역(공개 쓰기 Firebase 방어)이 로컬 JSON 부팅 구조에는 성립 조건 없음.
- **이유**: 범위의 SSOT 는 이미 DataLoader 검증 코드(§5.5). 밸런스 패널(§5.6)은 그 검증 규칙에서 UI manifest 를 생성하므로 메타데이터 구조 승격 불요.
- **다음 작업자가 반복하지 말 판단**: 편집 대상 데이터 안에 그 데이터의 검증 범위를 함께 두지 말 것. 검증은 코드(단일 경로)에.
- **관련 파일·테스트·커밋**: 스펙 §5.6(v1.1), 분석 워크플로우 wf_91c95588 판정.

## 2026-07-16 — winget .NET SDK 설치 hang → zip 바이너리로 회피

- **시도/상황**: 집 PC 에 dotnet 없어 `winget install Microsoft.DotNet.SDK.8 --silent` 를 백그라운드 실행.
- **결과**: 31분 hang. 진단 결과 **다운로드는 214MB 완료됐으나 installer(.exe) 실행 단계에서 멈춤**(winget CPU 0:00:01, 백그라운드 콘솔에 UI 없는 installer 가 대기). winget kill 후 **zip 바이너리**(`dotnet-sdk-8.0.423-win-x64.zip`)를 `C:\Users\서현범\dotnet` 에 압축 해제 — installer·관리자 불필요라 hang 없음. `DOTNET_ROOT` 지정해 사용.
- **다음 작업자가 반복하지 말 판단**: 이 PC 에서 dotnet 필요 시 winget installer 말고 **zip 방식**. curl 다운로드 경로는 `C:\` 루트가 아니라 홈(표준 사용자는 C:\ 루트 쓰기 불가 — curl 오류 23).
- **관련**: `C:\Users\서현범\dotnet\dotnet.exe` (8.0.423). 메모리 `pc-home-python-node-no-libreoffice` 에 dotnet 추가 필요.

## 2026-07-16 — Phase 0 위생 완료 (정수 스케일 등 6종, verify 통과)

- **시도/상황**: 보고서 §7 '즉시' 묶음의 코드/데이터 부분을 SDK 설치 후 구현.
- **결과**: baseline verify 48/48 확인 → 6종 단계별 적용, 각 verify 후 커밋: 정수 스케일(×100, `0f1b126`)·gauge+수량하한(`ee09147`)·schema_version(`542e174`)·id 생애주기(`2699bcb`)·레이어 게이트(`a8ac963`). 최종 52/52.
- **이유**: 세이브·전투가 붙기 전 데이터 계약을 정수로 굳혀야 Phase 1 마이그레이션이 없음(§4.4).
- **핵심 판단**: Grow 는 `floor(L*g)-floor((L-1)*g)` 라 정수 나눗셈(rate≥0)이 floor 와 동일 → 성장 결과 등가 보존(테스트 51 유지). 스케일은 ×100 일관(100=×1.0).
- **다음**: Phase 1 = 세이브 시스템 design-doc → GameState(Load=새 객체) → 턴 루프. `aliases` id 리매핑은 Normalize 도입 시.

## 2026-07-16 — Phase 1 완주 (§7 작업 전량 + DoD 3종)

- **시도/상황**: 스펙 §7 Phase 1 "글로벌 맵·내정 시뮬레이터(전투 제외)" 구현.
- **결과**: §7 작업 전량 완료 — 세이브 시스템(Pcg32·RngStreams·GameState·fail-soft·load 이어하기)·턴 루프(TurnSystem)·수입·시설(데이터 주도 facilities+생산 보너스)·징병(Recruit)·A* 이동(Pathfinding+MoveArmy)·무혈 점령·핫시트 콘솔(PlaySession). DoD 3종 충족: 2인 플레이·50턴 스모크·세이브 재기동 왕복(실증). test 93.
- **핵심 판단**: GameState additive 확장(Armies·Provinces)은 SaveVersion 유지(구세이브=빈 리스트, B-3). 부대·영지·병종 정의 참조는 로드 시 fail-soft(D9)로 삭제 대응. 시설 정의는 game_rules.json 데이터 주도(§5).
- **다음 작업자**: Phase 2(전투·스킬·외교·AI)는 §7 새 페이즈 — §0.3 클래스 목록 제시부터. Phase 2 완주(부자 공동 승리 1회) 후 UE5 강행/축소 게이트 리뷰. 잔여 Phase 1 세부(함대·상륙전·인구 감소)는 Phase 2와 함께.
- **관련 커밋**: e4c6da3~9b83d8f (세이브·게임루프·부대·시설).

## 2026-07-16 — Phase 1 적대 QA (확정 24건 수정, 잔여 low 문서화)

- **시도/상황**: Phase 1 완주 후 8-finder 적대 버그 헌팅(Workflow) — 오버플로·세이브왕복·fail-soft·결정론·게임로직·입력파싱·데이터검증 관점.
- **결과**: 후보 27 → 확정 24 전량 수정 + 회귀 테스트 7종. test 93→100. 커밋 `5fa73b1`.
- **핵심 수정**: 미존재 영지 id → KeyNotFound 세션 크래시(WorldMap.TryGetNode), 징병 cost 곱 오버플로(long 승격), fail-soft 완전화(고아 부대·댕글링 relation·삭제 지휘관·시설·actor 프루닝), MoveArmy 해역 우회 차단, DataLoader null-crash·검증갭.
- **안 고친 low (실害 미미, 의도적 보류)**: ① NewCampaign 초기 Actor 파생값 불일치 — Income 페이즈는 Actor 미사용이라 무해 ② 세이브 딕셔너리(Relations·Units·Facilities·RngStreams) 직렬화 순서 미고정 — 값 왕복은 정확, 바이트 동일성은 **Phase 2 시드 리플레이 골든 도입 시** 처리 ③ Save `.tmp` 잔존 — File.Replace 실패(희귀) 시, try/finally 정리 미도입 ④ TotalTroops checked Sum 오버플로 — 징병 상한(cost long)으로 완화 ⑤ CollectIncome O(영지×영지상태) — 소규모 맵(40~60노드) 무해.
- **다음 작업자**: 위 ②는 Phase 2 골든 스냅샷 테스트 착수 시 SortedDictionary/커스텀 converter 로 확정 처리할 것.
