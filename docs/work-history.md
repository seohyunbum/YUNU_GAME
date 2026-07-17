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

## 2026-07-17 — 수치제 경제 + 파견 모델 (§2.3.2): 시장·농지 시설 폐지, 등용 사신 소진은 채택 안 함

- **시도/상황**: T14 — "내정·징병·등용·탐색 모두 무장 파견 + 능력치 의존, 상업·농업은 수치제(거점별 max)". 상업/농업을 시장·농지 시설(레벨 1~3)에서 **수치 개발**로 전환하고, 개발(POL)·징병 군수(LDR)·탐색(INT)을 파견 행동으로 구현.
- **결과**: game_rules `internal_affairs.governor_*_pct` 는 유지(태수 즉시 생산 % 보정)하되, 시장·농지 FacilityDef 는 제거하고 `economy`/`search` 블록 신설(schema_version 2→3). ProvinceState.Commerce/Agriculture·FactionState.ActedCharacterIds/SearchesThisTurn additive. 빌드·226 테스트 녹색.
- **이유 / 기각한 대안**:
  - **등용(recruit) 사신을 ActedCharacterIds 로 소진 처리하려다 기각** — 기존 `recruit_general.max_per_turn`(반복형 외교 캡)·다회 시도 테스트와 충돌. 등용은 이미 사신 매력이 성공률을 좌우해 "능력치 의존" 요건을 만족하므로 소진 대상에서 제외. 소진은 영구 자산을 만드는 개발·징병군수·탐색에만 적용.
  - **태수 생산 % 보정 제거 검토 → 유지** — InternalAffairsRules·DTO·검증 churn 회피 + "태수는 즉시 효율(%) + 장기 자동개발" 2층 해석이 자연스러움.
- **밸런스 관측 (하지 않기로 한 것)**: 병행 세션의 지도 확장(육상 18→42거점)과 리베이스 후 배치 시뮬 100판 = 최고 58%(어벤져스) — DoD 70% [SHOULD] 통과. (리베이스 전 소형 18거점 맵에서는 칼데아 100% 편중이 나왔으나 지도 확장으로 해소된 소형 맵 아티팩트.) 수치제 경제는 세력 공통이라 *상대* 균형을 바꾸지 않음 — **경제 계수로 편중을 쫓지 않음**. 남은 이슈는 "전 판 200턴 판정승 교착"(정복 종결 미달성)이며 이는 지도/전투 부채(§9)로 §5.6 밸런스 패널 안건, 경제와 무관.
- **리베이스 통합 함정**: 병행 세션이 world_map.json 을 대폭 확장(신규 도시 24개+)해 위상 의존 테스트 `분리된_그래프_검출` 이 깨짐(끊으려던 chengdu/nanjing 이 신규 도시로 재연결). → 특정 도시쌍 대신 **대상 노드(sydney)의 전 간선·인접을 프로그램적으로 제거**하는 위상 독립 방식으로 재작성. 신규 도시 24개는 commerce_max/agriculture_max 미지정이나 DataLoader base×5 fallback 으로 정상 로드.
- **다음 작업자가 반복하지 말 판단**: (1) 등용 사신을 턴당 1행동으로 묶지 말 것(다회 시도 캡과 이중 제약·테스트 회귀). (2) 세력 편중을 경제 계수로 고치려 하지 말 것(원인은 지도/전투). (3) UE5 도시화면 build 버튼의 `market`/`farm` 은 이제 UnknownFacility(fail-soft) — 개발(`develop`) 액션으로 재배선 필요(UE5 세션 작업, Core 무영향). (4) 위상 의존 맵 테스트는 도시쌍 대신 단일 노드 완전 고립으로 작성(맵 확장 내성).
- **관련 파일·테스트·커밋**: InternalAffairsManager/RecruitmentSystem/AIController/PlaySession/GameSessionHost, GameRules/ProvinceState/FactionState/LandProvince, DataLoader/Dtos/SaveDto/SaveSystem, data/config/game_rules.json·data/map/world_map.json; InternalAffairsTests·RecruitmentTests·GameplayTests·PlaySessionTests·ValidationTests·DomainTests.

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

## 2026-07-17 — 밸런스 패널(§5.6) + 로컬 배포·바탕화면 바로가기

- **시도/상황**: Phase 2 잔여 — 매번 LLM 에 수치 수정을 요청하지 않고 패널로 밸런스를 조정하는 §5.6, 그리고 부자 실플레이(U1)를 위한 바탕화면 진입점.
- **결과**: ① `PanelServer`(exe 내장 `panel` 모드, localhost:8377) — 편집 폼은 데이터 JSON 에서 재귀 자동생성(수기 필드 목록 없음), 저장은 임시 폴더 전체 사본에 반영 → §5.5 DataLoader 단일 검증 통과 시에만 atomic write. 실검증: 음수 상성 → HTTP 422(§5.5 포맷 오류 표시), 유효값 → 200 저장·원본 반영. ② `scripts/deploy-local.py` — publish→`~/WorldConquest/app` + data 사본 + 실행 배치 2종 + 바탕화면 lnk 2개(세계정복 게임·밸런스관리). 바로가기→배치→exe 전 체인 실증.
- **인코딩 함정 (실측 3연발)**: `.bat`/`.vbs` 는 cmd/cscript 가 **ANSI(CP949)** 로 파싱 — UTF-8 저장 시 한글 사용자명 경로가 깨져 `cd /d`·CreateShortcut 이 실패. **CP949 로 저장**해야 함. 게임 한글 출력은 exe 가 `Console.OutputEncoding=UTF8` 설정하므로 chcp 불필요. 또 subprocess 로 dotnet 호출 시 자식 env 의 PATH 는 CreateProcess 탐색에 안 쓰임 — **절대경로 필수**.
- **다음 작업자가 반복하지 말 판단**: 배포 스크립트를 .bat 로 쓰지 말 것(인코딩 지옥) — python 단일 스크립트가 정답. 패널 편집 파일 추가는 `PanelServer.EditableFiles` 화이트리스트에 DataLoader 상수만 추가하면 폼은 자동.
- **관련**: `src/WorldConquest.ConsoleHost/PanelServer.cs` · `scripts/deploy-local.py` · 배포본 `C:\Users\서현범\WorldConquest`.

## 2026-07-17 — Phase 3 M0: 게임 API 서버 (UE5 클라이언트 계약, 헤드리스 완결)

- **시도/상황**: U2 앞당김 결정(UE5 강행) 후 아키텍처 판정 패널(3렌즈)+적대 검증 2인 워크플로로 C안(UE5 표현 클라 + C# 권위 시뮬) 3:0 확정. UE 설치 전 헤드리스로 M0 완성.
- **결과**: ①`SessionDriver`(Core) — 페이즈 오케스트레이션 단일 구현, PlaySession 도 이걸 쓰도록 리팩터링(기존 163테스트 무손상 통과 = 콘솔 동작 보존 증명) ②`GameSessionHost` — 이벤트 저널(seq)·명령 멱등 캐시·전체 상태 스냅샷·verb 디스패치 ③`ApiServer` — HTTP 얇은 계층, `WC_API_PORT=` stdout 핸드셰이크, `/api/static`(map_pos·세력 color 포함) ④계약 테스트 7종(총 170). 라이브 E2E 전 시나리오 실증 — 멱등 재전송 시 천명 불변(RNG 이중 소모 차단), end 한 번에 AI 6세력 진행·이벤트 저널로 관측.
- **핵심 판단**: 적대 검증의 완화책을 그대로 채택 — 저널 seq(유실 복구), 멱등 seq(HTTP 재시도 안전), SessionDriver 공유(이중정산 함정 단일화), 캠페인마다 Bus 재생성(구독자 누적 차단). 무혈 점령에 `ProvinceCaptured` 이벤트 신설(§4.3 — UE 연출용, 콘솔 무영향).
- **함정 (재발 방지)**: Git Bash 의 curl.exe 는 `-d '한글'` 인자를 CP949 로 전송해 서버(UTF-8 리더)에서 mojibake — API 검증 시 **한글 본문은 UTF-8 파일로 만들어 `--data-binary @file`** 로 보낼 것. `curl -X POST` 본문 없음 = HTTP.SYS 411 → `-d '{}'` 필수. 서버 결함 아님(UE 클라는 Content-Length 정상 부착).
- **다음**: Day-0(U6 — 사용자: 디스크 확보+UE5.5+VS2022 C++ 설치) → AI 가 CLI 빌드·오프스크린 샷 왕복 검증 → M1 수직 슬라이스.
- **관련**: `src/WorldConquest.Core/Data/SessionDriver.cs`·`GameSessionHost.cs`·`ApiDtos.cs`, `src/WorldConquest.ConsoleHost/ApiServer.cs`, `tests/.../ApiContractTests.cs`, 설계 정본 `docs/designs/ue5-client-design.md`.

## 2026-07-17 — Day-0 게이트 통과: UE 5.8 + VS2022 설치, 빌드·스크린샷·핸드셰이크 왕복

- **시도/상황**: U6(디스크·설치) 해소 — Fortnite 96GB 삭제(사용자), VS2022 CLI 무인 설치(AI, 부트스트래퍼 --passive), UE 5.8.0 런처 설치(사용자 클릭). AI가 Day-0 게이트 검증.
- **결과**: ①UBT CLI 빌드 Succeeded(49s) ②오프스크린 부팅(-game -RenderOffscreen) ③**UE 클라 → C# 게임서버 HTTP 핸드셰이크 성공** ("서버 핸드셰이크 OK — protocol v1") ④HighResShot 1280×720 → AI 이미지 판독(Entry 맵=순흑, 예상 일치). 시각 QA 하네스 성립 — 이후 모든 UE 반복이 자가검증 가능.
- **UE 프로젝트 골격**: `ue/WorldConquestUE/` — uproject(플러그인 0)·C++ 모듈(HTTP/Json/UMG 내장만)·WCGameMode·WCApiSubsystem(/api/info)·엔진 내장 Entry 맵 부팅(.umap 저작 없음, 코드-퍼스트).
- **함정 3건 (재발 방지)**: ①스크래치패드 워크트리 경로가 UE 중간산출물에서 **260자 초과** → junction `C:\Users\Public\WCUE`(python `_winapi.CreateJunction` — cmd mklink 는 MSYS 인자변환 충돌) ②UE 첫 실행이 **무음으로 수 분**(Defender 스캔 추정) — `-stdout -FullStdOutLogOutput -unattended` 없이는 진행 판별 불가 ③엔진 설치 완료 직후엔 파일이 덜 풀려 UBT 룰 어셈블리 오류 — 설치 안정화 후 재시도.
- **다음**: M1 수직 슬라이스 — /api/static 지도 절차 생성 렌더 + 소유 색 + end turn + 스크린샷 QA.

## 2026-07-17 — M1 수직 슬라이스: UE5 세계지도 렌더 + 자동 턴 QA 하네스

- **시도/상황**: Day-0 직후 M1 — /api/static 절차 생성 보드 + 소유 색 + end turn + 스크린샷 QA.
- **결과**: ①WCMapActor — 노드(map_pos→월드, 육상=원판·해역=넓은 원판)·간선(육로 베이지/해로 파랑 실린더)·세력색 MaterialInstanceDynamic ②WCGameMode 부팅 시퀀스(핸드셰이크→캠페인 자동 생성→보드→상태) ③직교 탑다운 카메라(OrthoWidth 23000) ④WCPlayerController(Enter=end)·WCHUD(턴/차례 Canvas) ⑤**QA 하네스 내장**: `-WCShot`(첫 상태 후 자동 촬영·종료)+`-WCTurns=N`(촬영 전 N턴 자동 진행). 실증: 1턴 지도 → 5턴 자동 진행 → **6턴 지도에서 AI 점령 색 변화 시각 확인** (유럽→프랑스 보라, 동아시아 확장).
- **시각 QA 루프가 잡은 결함**: 첫 판은 원근 카메라로 지도 기울음+우측 잘림 → 직교 전환+BoardToWorld 재매핑(화면 위=북)으로 해소. 하네스 없었으면 "컴파일 되니 OK"로 넘어갔을 것.
- **함정**: UE C++ 지역변수명 `Owner` 는 AActor 멤버 가림(C4458=error). HTTP 비동기라 ExecCmds HighResShot 은 로드 전 촬영 — 상태 적용 후 코드 촬영(-WCShot)이 정답.
- **다음**: M2 — 명령 UI(클릭 픽킹·징병·이동·공격·초빙)·이벤트 로그 연출·도시명 라벨(한글 폰트)·C# 서버 자식 스폰(Job Object)·세력 선택.
- **관련**: `ue/WorldConquestUE/Source/WorldConquestUE/` WCMapActor·WCGameMode·WCPlayerController·WCHUD·WCApiSubsystem.

## 2026-07-17 — M2 증분 1: 원클릭 스폰·클릭 선택·한글 라벨·이벤트 로그·고아 차단

- **시도/상황**: M2(콘솔 기능 동등) 첫 증분 — 가족용 원클릭 실행(서버 자식 스폰)과 조작 기반.
- **결과**: ①EnsureServer — 기존 서버 우선, 없으면 배포 exe 스폰(`server --port 0 --parent-pid <UE pid>`) + stdout `WC_API_PORT=` 파싱(동적 포트 55520 실증) ②노드 클릭 픽킹(GetHitResultUnderCursor→컴포넌트 역조회)·선택 강조 `[ 평양 ]`·선택 정보줄 ③도시명 한글 라벨 15개(Canvas Project — 엔진 폰트 한글 폴백, TextRender 회피) ④이벤트 로그 패널("귀살대 ▶ 도쿄 점령"·"⚔ 로마 공방전 — 수비 성공"·미지 타입 원형 폴백) ⑤부대·함대 마커(병력 비례 높이, 세력색) ⑥[C] 점령 명령.
- **이벤트 키 계약 수정 (서버)**: 전투 점령 ProvinceCaptured 가 `by` 키, 무혈은 `faction` — **동일 타입 키 분열**을 faction 으로 통일. 소비자 검색 후 안전 확인. BattleEnded·DuelStarted 는 클라 정식 라인 승격.
- **고아 차단 여정 (3회 실패 끝 확정)**: ①Deinitialize TerminateProc — 강제 킬 시 미호출 ②Windows Job Object(KILL_ON_JOB_CLOSE) — 이 실행 환경(상위 Job 존재)에서 무력 ③stdin EOF — **파이프 핸들이 자식에 상속되면 EOF 불발**(Win32 함정) ④**부모 PID 감시(`Process.GetProcessById(pid).WaitForExit()`) = 정답** — 격리 실험+UE 경유 양쪽 실증. 콘솔 직접 실행은 --parent-pid 미지정이라 무영향.
- **검증 스크립트 함정 (오판 3회의 원인)**: `tasklist | grep pat | head -1 && ✘ || ✔` 은 **파이프 exit code 가 head(항상 0)** 라 매치 없어도 ✘ — 존재 판정은 반드시 `grep -q` 를 파이프 말단에. 고아 "잔존" 오판 전부 이것.
- **관련**: WCApiSubsystem(스폰·핸드셰이크), WCGameMode(이벤트 라인·선택), WCHUD(라벨·로그), WCMapActor(마커·픽킹), ApiServer.cs(--parent-pid).

## 2026-07-17 — 바탕화면 [세계정복 3D] 바로가기 (영구 경로)

- **핵심 판단**: 개발 worktree 는 임시 scratchpad 라 바로가기 대상 부적합 → **영구 detached 체크아웃** `C:\Users\Public\wc-game` (origin 브랜치 추적, 짧은 ASCII 경로라 junction 불필요). 갱신 = `git fetch + reset --hard origin/<브랜치>` + UE 재빌드.
- **결과**: WorldConquest3D.bat → UnrealEditor.exe -game (서버는 UE 가 자식 스폰·고아 차단 포함). 영구 경로에서 스폰→핸드셰이크→지도 스크린샷→정리 전 사이클 실증. 바탕화면 4종: 게임(콘솔2인)·1인플레이(콘솔)·3D(UE)·밸런스관리.
- **다음 작업자**: 코드 갱신 후 3D 반영은 wc-game 에서 fetch+reset+Build.bat. deploy-local.py 통합은 M2 증분2.

## 2026-07-17 — M2 증분 2: 명령 조작 전체 (클릭+단축키, 콘솔 동등 근접)

- **결과**: ①클릭 해석 모드 — [M]이동/[A]공격 → 목표 클릭 2단계, ESC 취소 ②영지 선택 시 아군 부대 자동 선택(이동·공격의 주어) ③[R/T]징병 10/50·[U]병종 순환·[B/N]건설·[S]초빙·[F5/F9] 퀵세이브/로드(서버 로컬 %USERPROFILE%/WorldConquest/saves/quick.json) ④명령 안내줄 HUD ⑤**QA -WCCmd="verb a b|verb c"** 명령 체인 러너 — 클릭 없이 명령 경로 시각 검증. 실증: 점령→징병20(주둔 20·아군부대 표시)→건설·초빙 서버 거부 라인 표시.
- **함정**: `UInputComponent::BindKeyLambda` 는 존재하지 않는 API — 람다 키 바인딩은 `FInputKeyBinding` + `KeyDelegate.GetDelegateForManualSet().BindLambda` + `KeyBindings.Add` 패턴.
- **잔여 (M2 마감 항목)**: 세력 선택 화면(현재 solo 조선 고정)·컷씬 대사 표시(현재 id 만)·deploy-local.py 에 3D 바로가기·wc-game 갱신 통합·병종별 징병 비용 표시.

## 2026-07-17 — 비주얼 개편 1: NASA 실세계지도 + 줌/팬 (사용자 피드백 대응)

- **계기**: 사용자 실플레이 피드백 — "실제 세계지도 멋진 게 나오고 KOEI 같은 인터페이스 창들이 나와야지". 기능 배선 단계의 그래프 다이어그램 화면은 기대 미달. 비주얼·UI 우선으로 전환.
- **결과**: ①NASA Blue Marble 7월(퍼블릭 도메인, 사용자 다운로드 승인) 5400×2700 을 unlit 평면으로 — **에디터 Python 커맨드렛**(`Scripts/import_worldmap.py`)으로 텍스처 임포트+머티리얼 생성 (에셋 파이프라인 개통, GUI 0) ②map_pos 를 실위경도 등장방형(1000×500)으로 재정합 — 도시가 실제 위치에 ③M_UnlitColor(색 파라미터 unlit)로 마커·간선 — 조명 씻김 해소 ④마커 흑 테두리 ⑤**휠 줌(OrthoWidth 2500~21000)+우클릭 드래그 팬** — 동아시아 밀집 해소 수단.
- **디버깅 여정 (3샷)**: 흰 간선 원인 후보를 A/B 로 배제 — ①lit 폴백? → ConstructorHelpers 가 CDO 시점에 /Game 에셋 로드 실패하는 함정 발견, 런타임 LoadObject 로 교체 ②MID 미적용? → 머티리얼 기본값을 마젠타로 바꿔 촬영 = 마젠타 없음 → MID 정상 ③**진범 = 서브픽셀 지오메트리의 TAA 뭉개짐** (간선 반지름 7cm ≈ 화면 1px) → 두께 픽셀 기준 상향으로 해소.
- **함정 (재발 방지)**: ①생성자 ConstructorHelpers 로 /Game 에셋 찾지 말 것(레지스트리 타이밍) — 런타임 LoadObject ②`unreal.log` 는 pythonscript 커맨드렛 stdout 에 안 흐름 — 검사 출력은 파일로 ③가는 지오메트리는 TAA 에 하얗게 뭉개져 "색 버그"처럼 보임 — 두께부터 의심.
- **다음**: Slate UI 창(상단 자원바·영지 정보/명령 버튼 창·전역 버튼) = KOEI 인터페이스 본체.

## 2026-07-17 — 비주얼 개편 2: KOEI 식 Slate UI (버튼 인터페이스)

- **결과**: `SWCMainUI`(SCompoundWidget, UMG 에셋 0) — ①상단 자원 바(턴·차례·금·식량·천명, TAttribute 폴링으로 자동 갱신) ②영지 선택 시 우측 명령 창(점령·징병 10/50·병종 순환·시장/농지·부대 이동/공격 — **아군 부대 없으면 자동 비활성**) ③우하단 전역 패널(무장 초빙·저장·이어하기·턴 종료). 전부 마우스 클릭, 단축키는 보조로 유지.
- **함정 2건**: ①Slate 기본 Roboto 는 한글 글리프 없음 → `GEngine->GetLargeFont()->GetLegacySlateFontInfo()` (Canvas 에서 검증된 엔진 폰트) ②`FScreenshotRequest::RequestScreenshot(false)` 의 false = **UI 제외 캡처** — Slate 만 안 찍혀 "UI 미표시"로 오진할 뻔. QA 하네스는 true 필수 (Canvas HUD 는 뷰포트 렌더에 포함이라 false 에서도 찍혀 혼란 가중).
- **함정 3**: 사용자가 게임 실행 중이면 Live Coding 세션이 UBT 빌드를 차단 ("Unable to build while Live Coding is active") — 빌드 전 UnrealEditor 프로세스 확인.
- **다음 (M2 잔여)**: 세력 선택도 클릭 버튼화·컷씬 QA 샷 재검증·deploy-local.py 에 3D 갱신 통합·M3(전투/가챠 연출).

## 2026-07-17 — 거점(도시) 화면: KOEI 식 2층 구조 (지도 ⇄ 도시)

- **계기**: 사용자 피드백 — "거점 안으로 진입해서 내정 돌보고 상점에서 무장초빙도 하고, 세계지도와 별개로 UI 제대로".
- **결과**: `SWCCityView` 전면 화면 — 헤더(도시명·소유·인구·항구 + 자원) / 3컬럼: **[내정]** 생산·시설 현황·건설 버튼 **[군사]** 주둔 부대·징병·병종 **[주막]** 천명·§2.8.6 확률 공시(서버 /api/rates 신설 — 판정과 동일 함수)·천장·소속 무장·초빙 버튼 / [◀ 세계지도로]. 진입 = 소유 도시 **더블클릭** 또는 영지 창 [도시 진입] 버튼(비소유 시 비활성), ESC = 복귀. 초빙·징병 후 천명·확률 자동 갱신.
- **서버 확장**: /api/rates (SummonRates — 천명·비용·pity·풀·만분율 확률), /api/static nodes 에 population·production 추가. 테스트 170 유지.
- **함정 3건**: ①UE 5.8 `FJsonObject::Values` 키 = FStringType(UTF8) — FString 파라미터에 바로 못 넘김, `FString(Pair.Key)` 명시 변환 ②Slate 기본 Border 브러시는 이미지 기반이라 BorderBackgroundColor 알파가 안 먹음 — 불투명 패널은 `.BorderImage(FCoreStyle WhiteBrush)` 필수 ③사용자가 게임 실행 중이면 Live Coding 이 UBT 를 차단해 **옛 바이너리로 QA 샷**이 찍힘 — QA 전 빌드 성공 확인 + UE 프로세스 정리 (2회 재발).
- **QA**: -WCCity=<id> 도시 화면 자동 진입 촬영. 실증 샷 — 시장 Lv1(WCCmd 건설 반영)·창병 10·확률 공시·소속 무장.

## 2026-07-17 — 도시 화면 고급화: 위성 배경·금색 프레임·무장 카드 (사용자 "빡세게" 요구)

- **결과**: ①**도시별 실제 위성 배경** — 고해상 NASA(21600×10800)에서 도시 주변 ±8°크롭+다크+비네팅 15장 자동 생성(`scratchpad make_city_bg.py` → RawAssets/CityBg) → 에디터 Python 일괄 임포트(`Scripts/import_citybg.py` → /Game/CityBg/T_<id>) → SImage lazy 브러시 교체(진입 도시 변경 감지) ②헤더 세력색 배너 + 금색 이중 프레임 패널(WhiteBrush 1.5px 골드 외곽+다크 내부) ③시설 레벨 ●●○ 표시 ④확률 공시 **희귀도 색상 행**(★5 금·★4 자·★3 은) + **천장 SProgressBar** ⑤소속 무장 **카드 그리드**(SWrapBox, 희귀도색 테두리) — 초빙 시 카드 수 변화 감지로 자동 재구성.
- **구조화 뷰모델**: FText 덩어리 → FWCCharCard/FWCArmyCard/FWCFacilityRow/FWCRateRow 배열 (카드 UI 전제). RefreshRates 가 구조 캐시.
- **판단**: Slate 동적 콘텐츠(카드 그리드)는 TAttribute 로 불가 — SWrapBox 재구성 함수 + 저비용 변경 감지(카드 수 비교)를 브러시 어트리뷰트 평가에 편승(게임 스레드 보장).
- **다음 후보**: 무장 초상화 드롭인(Content/Portraits — 카드에 이미지), 도시 화면에서 지휘관 임명, 초빙 리빌 전용 연출(M3).

## 2026-07-17 — 무장 초상 파이프라인 + 초빙 리빌 연출 (§2.8.10)

- **결과**: ①**초상 드롭인 파이프라인** — `RawAssets/Portraits/<캐릭터id>.png` 에 이미지를 넣고 `Scripts/import_portraits.py` 실행하면 도시 카드·리빌에 자동 반영. 진짜 일러스트 전까지는 절차 생성 플레이스홀더 10장(희귀도색 프레임+그라데이션+이니셜+이름, `scratchpad make_portraits.py`) ②주막 무장 카드가 **초상 카드**로(96×120, 희귀도 테두리 — 텍스트 폴백 유지) ③**초빙 리빌 오버레이**(z30) — 암전 + 등급 문구("하늘이 울린다… 금색 문" / "자색 문" / 합류) + 등급색 프레임 초상 + ★·이름, 클릭 진행. CharacterJoined(내 세력만) 큐잉, **리빌 → ★5 등장씬 순서 보장**(TryStartNextCutscene 이 리빌 중 대기).
- **크로스오버 IP**: 시스템은 이미지를 요구하지 않음 — 파일을 넣으면 뜨는 구조(가족 전용 사적 이용, 스펙 §0 정책 유지).
- **QA**: -WCReveal=<charId> 강제 리빌 촬영. 실증: 관우 ★5 금문 리빌 + 이순신 초상 카드.

## 2026-07-17 — 그래픽 개편 3: 3D 지형 세계지도 (사용자 "그래픽 수준부터 빡세게")

- **계기**: 사용자가 상용 삼국지 게임 스크린샷 4장을 기준으로 "UE5 를 쓰는 이유인 최신 고퀄 그래픽"을 요구. 평면 지도 → RTK14 식 3D 지형으로.
- **결과**: ①NASA/GEBCO 고도맵(퍼블릭 도메인) → 720×360 그리드 지형 OBJ 자동 생성(`make_terrain.py` — 바다 평탄·육지 260배 과장, UE 월드좌표 직출력) → 에디터 Python 임포트(SM_Terrain, 복합 콜리전) ②위성 머티리얼 unlit→**lit 전환**(그림자·대기광 반응) ③**시네마틱 환경 코드 스폰**: 사선 태양(그림자 on, 대기 연동)·SkyAtmosphere·SkyLight(실시간 캡처)·높이 안개·볼류메트릭 구름·PostProcess(블룸·AO·비네트) ④**원근 틸트 카메라**(-52°, 줌 시 -58~-46 가변) + 돌리 줌/타깃 팬 ⑤마커·간선 지형 표면 부착(라인트레이스).
- **함정 (OBJ→UE Interchange)**: ①삼각형 winding 이 그대로면 **백페이스 컬링으로 지형 실종**(검은 파편만) ②RH→LH 변환이 **Y 축 반전 → 동서 미러**. 해법 = OBJ 생성 시 Y 선반전 + winding 원상 — 샷 2회 왕복으로 실측 교정.
- **다음**: 도시 3D 마커(성채/깃발)·바다 스펙큘러·구름 확인, 도시 디오라마(Fab 무료 에셋 — 사용자 클릭 필요), 무장 일러스트(AI아트 프롬프트 시트).

## 2026-07-17 — 그래픽 개편 4: 성채·군기 마커 + 8K 텍스처 + 초상 프롬프트 시트

- **결과**: ①도시 마커 = **성채 구성**(성벽 원판+본체 큐브+세력색 콘 지붕+깃대·깃발 — AddShape 헬퍼, 색 대상 복수 MID 일괄 갱신) ②부대 = **군기 마커**(받침+깃대+병력 비례 세력색 깃발), 함대 = 선체+돛 ③위성 텍스처 5400→**8192×4096**(줌인 선명) — import_worldmap.py 를 lit 정본으로 갱신(재실행이 unlit 로 되돌리던 함정 제거) ④QA `-WCLook=<노드>[,거리]` 카메라 근접 플래그 ⑤`docs/portrait-prompts.md` — 무장 10명 AI아트 프롬프트 시트(공통 스타일 접두+개별, 적용 3단계).
- **판정**: 근접 샷에서 성채 형상·세력색 지붕·깃발 식별 확인. 남은 미세: 간선 두께(0.3)·군기 실샷 미확인(징병 30=금 부족으로 미생성 — 코드 경로는 동일 패턴).

## 2026-07-17 — M3 전투 결과 연출 (BattleEnded 화면)

- **결과**: ①서버 BattleEnded 이벤트 강화 — node·attacker_won 만 있던 것을 **양측 세력·전후 병력·손실·라운드·지휘관·일기토 승패**까지 (Attack 에서 전투 전 스냅샷 캡처 → PublishBattleEvents 확장). 테스트 170 유지 ②`SWCBattleOverlay`(z28) — 암전 + 제목("한성 공방전 — 승리/패배", **내 관점** 기준) + 공격/수비 세력색 밴드에 "세력 (지휘관) · 전→후 (-손실)" + 푸터 "N라운드 · 일기토 A▶B" ③연출 우선순위 확립: **전투 → 리빌 → 컷씬** (각 TryStartNext 가 상위 활성 시 대기) ④내 세력 관여 전투만 큐잉(AI끼리는 로그).
- **검증**: QA `-WCBattle` 강제샷(한성 패배·관우 일기토) + **실 서버 이벤트**(로마 공방전 어벤져스 5→0 vs 칼데아 8→7, 25턴 내 AI 전투에서 스키마 전량 확인).
- **다음**: 전투 화면에 지휘관 초상 삽입·스킬 발동 로그·승패 사운드, 도시 3D 디오라마(Fab 에셋).

## 2026-07-17 — 도시 3D 디오라마: Fab "Stylized Eastern Village" 데모 맵 로드

- **계기**: 프리미티브 디오라마가 "애들 장난 수준"이라는 강한 피드백 → CC0/Fab 고품질 에셋 활용. 사용자가 Fab 무료팩 추가(5.8 버전 우회: 5.7 스텁 프로젝트 AssetGrab57 로 다운로드 → Content 복사).
- **결과**: `WCCityDiorama` 가 `ULevelStreamingDynamic::LoadLevelInstance` 로 **아티스트 데모 맵(Asian_Village_Demo, 2944 액터)을 통째 로드** — 청록 기와지붕·붉은 목조·금 처마의 웅장한 궁궐 복합체. 도시 진입 시 전용 카메라 전환.
- **핵심 판단(실측 여정)**: ①HISM 재구성 → 무채색 ②일반 액터도 무채색(=HISM 버그 아님) ③VT 아님·노출 아님·텍스처 컬러 정상 → **원인 = 우리 씬 조명에서 이 팩 재질이 안 뜸**. ④데모 맵 통째 로드 = 자체 라이팅으로 완벽 컬러. 재구성 포기, 레벨 인스턴스 채택.
- **함정**: 데모 맵 전역 조명(directional/sky/fog)이 세계지도와 공존 → 세계지도 무해 확인. 화면 경고(라이팅 리빌드·다중 조명)는 GAreScreenMessagesEnabled=false 로 억제. 1GB 팩은 gitignore(repo 미포함), wc-game 엔 배포 시 복사. 절차 정본=docs/fab-assets.md.

## 2026-07-17 — 내정 시스템 (§2.3.1) + 병행 세션 대규모 업데이트 통합

- 상황: 다른 세션이 원격을 크게 전진(UE5 클라이언트·API 계층·MapPos·SessionDriver·port 시설·academy 직접가산 tech). 우리 내정 브랜치(태수·민심·세율·인구·반란·시설)와 game_rules/FacilityDef/DataLoader/Dtos/GameManager/AIController/PlaySession 에서 정면 충돌.
- 판단: 강제 푸시 금지 — 원격을 새 기반으로 reset 후 우리 내정을 재적용. 우리 CA2021 커밋은 원격이 자체 해결(ToList/target[0])이라 폐기.
- tech 시스템 포크 통합: 원격 academy 직접가산(`TechLevel += tech`, `TechBonusPerLevel`) vs 우리 누적(포인트→비용곡선→Lv5·태수 지력). 우리 누적 방식 채택(스펙 §2.3.1·풍부·태수 연동), 원격 직접가산 제거. `TechBonusPerLevel`이 UE/API 미참조 확인 후 `TechPointsPerLevel`로 통일 — UE 클라이언트 무영향.
- 보존한 원격 자산: MapPos·port 시설·API 계층·SessionDriver·이벤트 확장(ProvinceCaptured/BattleEnded)·1인 플레이 모드. API 뷰에 민심·인구·태수·세율·기술점 additive 노출 + governor/dismiss/tax 명령 추가(콘솔 parity).
- 검증: build -warnaserror 녹색, 테스트 170→198. 배치 시뮬 회귀 없음 — 기반 칼데아 98%(평균 200턴) → 내정 후 93%(무승부 1). 200턴 상한·편중은 원격 기존 전투/맵 밸런스 이슈(내정 무관, DoD [SHOULD]).
- 함정: SnakeCaseLower 가 `Per100Pol`→`per100_pol` 로 변환 → JSON `per_100_pol` 과 어긋남. 숫자경계 키는 `[JsonPropertyName]` 명시. (리눅스 SDK 분석기 CA2021 오탐도 원격판이 이미 회피.)
- 관련: InternalAffairsManager.cs · InternalAffairsTests.cs(28) · ApiDtos/GameSessionHost(내정 노출) · docs/GAME_DESIGN_SPEC §2.3.1

## 2026-07-17 — 콘텐츠 확장: 캐릭터 10·세력 3·거점 6 (§5 데이터 주도, JSON-only)

- 요청: 초기 무장 10명이 적음 → 제갈량·곽가·태사자·손권·랜서(빛의왕자)·고죠 사토루·이타도리 유지·헐크·아처·장영실 추가 + 세력·거점 증설.
- 추가: 캐릭터 10(→20), 스킬 20(패시브+궁극기), 궁극기 컷씬 10, 고유병종 2(주술고전 술사·신기전 화차), 세력 3(촉/오/주술고전 →10), 육상거점 6(청두·난징·오사카·런던·이스탄불·리우 →18). 신규 출신 ip_jjk 화이트리스트 등록. 전부 data/*.json 만 수정, 엔진 코드 0줄 (Phase 5 "JSON 만으로 콘텐츠 추가" 실증).
- 소환 캐릭터는 acquisition.channels=[summon,recruit] — 배너/확률표는 등급별이라 개별 등록 불필요(풀은 GetPool 이 채널로 파생). entry_cutscene 는 null(스크립트 없이 등장씬 스킵).
- 검증: build -warnaserror 녹색, 테스트 200 유지. 콘텐츠 증가로 깨진 기존 테스트 7건은 하드코딩(풀 3명·그래프 격리 지점·wei 베이징 태수)을 **데이터 유래로 강건화**해 의도 보존 수정 (§5 확장마다 테스트가 깨지지 않도록).
- 맵 밸런스: 신규 동아시아 거점이 beijing 과 접경 → AI 턴1 무방비 수도 스나이프(기존 france↔rome 과 동일한 기존 AI 행동). nanjing 을 beijing 대신 chengdu 접경으로 옮겨 베이징 이중접경 완화.
- ⚠ 배치 시뮬 관찰(회귀 아님, [SHOULD]): 7세력→10세력·12→18거점으로 커지며 AI 대 AI 는 200턴 내 완전정복 미완 = 전부 무승부(이전 판정 종결). 대륙이 대양으로 분단돼 AI 해상 원정이 통일을 못 맺음. **2인 핫시트(주 모드)엔 무영향** — 인간이 능동 정복. 후속 밸런스(턴 상한·AI 후반 해상 공세·대륙 간 연결)는 Phase 2 게이트 안건.

## 2026-07-17 — 무장 획득 2경로 추가: 시작 배치(start_characters) + 등용(recruit)

- 요청: "시작 무장 1명(리더)뿐 → 몇 명 데리고 시작 + 등용 시스템 둘 다(C)".
- (A) start_characters: factions.json 신규 필드. GameSetup StartOwners 가 리더+start_characters 를 시작 소속. 6세력에 2번째 무장 배치(촉 관우·위 곽가·오 태사자·조선 장영실·칼데아 마슈·어벤져스 헐크). 검증(존재·리더중복·세력간 중복소속) DataLoader. 잔여 재야 4명(잔다르크·랜서·이타도리·아처)이 등용/초빙 풀.
- (B) 등용 RecruitmentSystem: 재야(recruit 채널·미소속) 지목 영입. 성공률=base+사신매력×계수−rarity×페널티(정수 만분율 clamp), 비용=base+rarity×cost_per_rarity(실패도 소모), recruit:{faction} 스트림으로 결정적·세이브스컴 불가. 턴당 캡(RecruitsThisTurn, 수입 리셋·additive 세이브). 콘솔 recruits/enlist, API enlist. game_rules.recruit_general 상수.
- 판단: 초빙(SummonSystem)과 별개 클래스(SRP) — 등용=지목·매력승부, 초빙=확률추첨. 충성도는 CharacterOwners 소속만(초빙과 동일, 별도 충성도 스토어 미도입 — 후속). 랜서(빛의왕자)에 등장씬 부여(★5 소환 등장씬 테스트 대상 겸 콘텐츠).
- 검증: build -warnaserror 녹색, 테스트 200→215(신규 15: 시작배치 3·등용 12). 콘솔 실행으로 시작 2인·recruits·enlist(성공률 25% 표시·실패 비용 소모) 실동작 확인. schema_version 유지(recruit_general 은 rules 추가라 세이브 스키마 불변, start_characters 는 정의 데이터 additive).
- data schema/세이브: FactionState.RecruitsThisTurn additive(SaveVersion 불변). start_characters 는 정의 데이터(schema_version 2 유지 — 필수화 아닌 선택 필드).

## 2026-07-17 — 로스터 대폭 확장: 무장 20→52 + 전 세력 3인 시작

- 요청: "모든 세력 2~3명으로 시작 + 무장 대폭 증원".
- 방식: Workflow(ultracode)로 8개 테마 배치(한국사·위·촉오·유럽·귀멸·주술·마블·Fate/나혼렙) 병렬 설계 → 엄격 구조화 스키마(스탯·성장·패시브·궁극기 kind) → 결정적 조립(캐릭터+스킬 각2+컷씬). DataLoader 검증이 하드 게이트.
- 신규 32명(→52): 김유신·강감찬·을지문덕·세종 / 사마의·하후돈·여포·전위 / 장비·조운·주유·육손 / 알렉산더·카이사르·한니발·리처드 / 렌고쿠·기유·젠이츠·이노스케 / 메구미·노바라·스쿠나·마키 / 캡틴아메리카·토르·스파이더맨·닥터스트레인지 / 길가메시·쿠훌린·차해인·백윤호. 스킬 40→104, 컷씬 41→61.
- 전 10세력 start_characters 3명(리더+2)으로 통일. 재야 풀 22명(등용·초빙 후보) — ★5 다수(여포 무120·스쿠나 무120지115·토르·세종 지115·닥터스트레인지 지120 등).
- 검증: build -warnaserror 녹색, 테스트 215(초빙 소진 테스트만 풀>캡 대응해 다턴 소진으로 수정). 배치 시뮬 40판: 3인 시작으로 AI가 지휘관 편성 가능해져 판정승 39·무승부 1로 **재종결**(직전 6거점 추가 때의 전량 무승부 해소). 칼데아 97% 편중은 기존 전투/맵 밸런스([SHOULD], 회귀 아님).
- 엔진 코드 0줄 — 전량 data/*.json (§5 데이터 주도). 밸런스 수치는 game_rules·characters JSON 이라 이후 튜닝·추가도 JSON 편집만.

## 2026-07-17 — 외교 심화 설계: "AI 가 나만 공격한다" 는 편향이 아니라 약자 집중으로 판명

- **시도/상황**: 요구("AI 들이 지들끼리도 적대치/우호도로 공격·동맹, 조공, 전투 시 우호도 하락, 계략") 설계 전 원인 진단.
- **결과**: **플레이어 편향 가설 기각 — 코드에 없음.** `AIController` 전체에서 `Controller` 참조는 line 28(`f.Controller == "ai"`, 자기 순회용) 단 1곳이고 `"human"` 문자열 0건. 목표 선정·진군·해상원정 어디도 대상의 조작 주체를 보지 않는다. **AI vs AI 전투도 이미 기본 동작**(대상 필터가 소유자≠자기만 요구, `GameSetup.AiCampaign` 이 전 세력 AI 캠페인 정식 지원). 진짜 원인 3종 = ①목표 선정이 `OrderBy(Garrison).ThenBy(Id)` **단일 축**(약자 집중 — 초반 최약체 플레이어에게 인접 AI 가 동시 쇄도) ②`Relations` 빈 딕셔너리 + `Neutral=0` + 필터가 `!= Alliance` 부정 조건 → **선전포고 없이 즉시 공격 가능**(만인 대 만인) ③`AIController` 가 `DiplomacyManager` 를 참조조차 안 함(Relations **쓰기 0건**) → 국제정치 부재.
- **이유**: 없는 것은 '편향 제거'가 아니라 **관계 동역학**. 설계 무게중심을 그쪽으로 옮김.
- **다음 작업자가 반복하지 말 판단**:
  - **AI 편향 제거 코드를 넣지 말 것** — 없는 편향을 지우려다 `Controller` 의존을 새로 만들면 오히려 AI 가 인간을 특별 취급하게 된다.
  - **조공에 전용 턴당 캡을 주지 말 것** — §1.2 자원지원 상한 [MUST] 이 우회된다(동맹 지원 500 + 조공 500 = 1000). 기존 `TransferredGold/FoodThisTurn` **예산 공유**가 유일 정합 (E7).
  - **Favor 훅을 `PublishBattleEvents` 내부에 넣지 말 것** — 이 함수는 육상 경로(`GameManager.cs:328`)에서만 호출된다. 해상전(`:284-288`)·무저항 함락(`:311-313`)은 조기 return 하며 `BattleEnded` 조차 발행 안 함 → **2경로 누락** (E8).
  - **`combat` RNG 스트림을 계략에 재사용하지 말 것** — 전투 골든 리플레이 오염. 단 **신규 순차 스트림도 정답이 아니다**: `cinematic` 선례의 **무상태 해시 파생**(`SPEC:602` 말미)을 쓰면 소비 격리 위험이 0이라 §4.4 등재가 형식적 승인으로 끝난다(U-D2). "결정적으로 만들어 승인 회피" vs "순차 스트림 신설" 은 **거짓 이분법**이었다.
  - **비대칭 관계도 채택하지 말 것** — `AIController` 가 관계를 단방향(자기 시점)으로만 조회하므로 즉시 오독 (E2).
  - 배치 시뮬 **70% 게이트를 외교 책임으로 걸지 말 것** — 이미 칼데아 98%(샘플 맵 지리 불균형, `roadmap.md:30`). 판정은 도입 전후 비교로.
- **관련 파일·테스트·커밋**: `docs/designs/diplomacy-system-design.md`(E1~E14·§11 기각 대안), `docs/roadmap.md` Phase 2, 진단 근거 `AIController.cs:28,208-233`·`GameManager.cs:328,284-288,311-313`·`DiplomacyManager.cs:78-96`·`GameSetup.cs:19,65`.

## 2026-07-17 — 외교 설계 자체 검수: 초안이 요구사항 게이트를 설계 상수로 실패시키고 있었음

- **시도/상황**: 위 진단 후 작성한 `diplomacy-system-design.md` 초안을 3관점(스펙 [MUST] 준수 / 내부 모순·근거 오류 / 구현 가능성) 적대 검수. 24건 지적 중 다수가 확정 결함이라 **전면 개정**.
- **결과**: 초안의 확정 결함 6종 — 전부 스펙 원문·코드 대조로 확증 후 수정.
  1. **요구사항 직결 게이트가 산술적으로 불가능했다** — `alliance_favor_min 600` + `CommonEnemy +10/턴` + `Decay 5/턴`(전 구간) = 순증 +5/턴 → AI 동맹에 **120턴 연속 공동교전** 필요. `BatchSimulator` 기본 `turnCap=200`, `AiTests` 는 60·80턴. 게다가 AI 조공 조건을 `Attitude <= Hostile` 로만 둬 Favor -199 에서 **자기종료** → `favor_ceiling 500` 이 AI 에게 사문(死文). "AI 들이 지들끼리 동맹" 이 설계 상수만으로 실패.
  2. **§1.2 [MUST] 를 몰래 재정의했다** — 조공(비동맹 금·식량 이전)은 §1.2 "**동맹 전용 메커니즘** … **자원 지원**(금·식량 이전)"(`SPEC:64-66`)의 적용 범위를 축소한다. 초안은 이를 '확정 결정 E6' 으로 통과시키면서 문서 헤더엔 "스펙 [MUST] 를 재정의하지 않는다" 고 선언 — 자기모순. (천명 금지는 [MUST] 로 못박고 RNG 스트림엔 승인 게이트를 걸면서 이것만 임의 확정)
  3. **`schema_version` 판단이 §0.3-7 원문과 반대** — `SPEC:39` 는 "형태(**필드 추가**·의미 변경·제거)를 바꾸면 **버전 상향**" 이라 '필드 추가' 를 명시적으로 열거한다. 초안은 괄호를 "이동·의미 변경·제거를 뜻하며" 로 재해석해 면제. 세이브의 additive 예외(`SPEC:525`)는 **세이브 전용**이고 데이터 스키마엔 그런 조항이 없다.
  4. **반올림 명세가 구현 지시와 불일치** — `favor * weight / 100` 을 "내림" 이라 명세했으나 C# 정수 나눗셈은 **0 방향 절사**다. Favor 는 **음수 구간이 주 사용처**(적대일수록 우선 표적)라 둘이 갈린다(-199*30/100: 절사 -59 vs 내림 -60). C++ 도 절사라 '내림' 대로 재구현하면 §7 Phase 3 오라클이 깨진다.
  5. **§7.3 스코어가 작동 불능** — ①절대 가산은 스케일 불균형(favor ±300 vs garrison 수십~수백) ②`AttackWeakNeighbors` 는 정렬 후 **`target[0]` 하나만** 문턱 판정하므로 정렬 키에 증오를 넣으면 **증오 대상이 강할 때 AI 마비**(옆 무방비 영지 두고 무행동).
  6. **`IsHostile` 단일 술어로 5곳 일괄 교체가 AI 를 죽인다** — `:60` 은 공격 필터가 아니라 **분기 게이트**(`LandReachableEnemyExists`). 불가침을 '비적대' 로 넣으면 전 육상 이웃과 불가침인 AI 는 고립 판정 → `NavalOperations` 도 즉시 return → **징병조차 않는 영구 무행동**. 불가침엔 만료가 없어 회복 경로도 없다.
- **이유**: 설계문서는 구현을 지휘한다. 틀린 근거·놓친 [MUST]·도달 불가능한 상수는 그대로 잘못된 코드가 된다. 특히 (1)은 "요구를 충족하는 설계" 처럼 읽히면서 실제로는 요구를 달성 못 하는 가장 위험한 종류.
- **다음 작업자가 반복하지 말 판단**:
  - **밸런스 상수를 적을 때 목표 상태의 도달 시간을 산술로 검산할 것** — 특히 감쇠(Decay)와 축적 소스를 함께 둘 때. 개정본은 §5.5 에 도달 산술을 [MUST] 로 박아뒀다(`Decay` 는 **음수 구간에만** 적용 — 우호를 감쇠시키면 동맹이 성립 안 함).
  - **조건이 자기종료하는지 볼 것** — "적대일 때만 조공" 은 조공이 성공하는 순간 조건이 꺼진다.
  - **[MUST] 범위를 바꾸는 결정을 '확정 결정' 표에 넣지 말 것** — §10 미해결로 올려 승인받는다.
  - **기존 함수의 사용처를 다 보고 술어를 중앙화할 것** — 같은 `Relations` 읽기라도 '공격해도 되는가'(`IsHostile`)와 '육상 전선이 있는가'(`HasLandFront`)는 다른 술어다.
- **관련 파일·테스트·커밋**: `docs/designs/diplomacy-system-design.md` §5.5(도달 산술)·§7.2(행위-major 의사코드)·§7.3(배수 정규화+문턱)·§10(U-D1·U-D2)·§11(기각 22종). 근거 `SPEC:39,64-66,525,602,603` · `AIController.cs:41-52,56-66,229-231` · `SaveSystem.cs:98,110,195-211`.

## 2026-07-17 — 외교 구현: 설계가 옳아도 계측 없이는 게이트가 죽어 있었다

- **시도/상황**: 승인된 외교 설계(E1~E14) 8단계 구현. 리베이스로 기반이 d14f429(내정 시스템·세력 10)로 전진한 뒤 착수.
- **결과**: 전 단계 구현·검증 완료(테스트 200→238). 그러나 **설계문서가 옳았음에도 실제로 돌려보기 전엔 요구사항 게이트가 죽어 있었다** — 계측으로만 잡힌 결함 4건:
  1. **라이브락** — Favor -900 인 전쟁 상대에게 '국력 열세' 로 매턴 종전 제안 → 상대는 매턴 거절 → 제안 등록은 항상 성공이라 **턴당 1 행동 예산을 영구 소모** → 동맹 행이 평생 평가되지 않음. Favor 가 대칭(E2)이라 상대 수락 여부를 미리 계산 가능 → 제안·응답이 **같은 술어(WouldAccept) 공유**로 해소.
  2. **불가침 막다른 길** — 동맹 조건 Rel==Neutral 이라 불가침을 먼저 맺은 쌍은 영구 차단(실측: favor 420 쌍이 갇힘). 불가침은 동맹의 전 단계 → Neutral|NonAggression 허용.
  3. **죽은 적을 공동의 적으로 셈** — 멸망해도 Relations 항목이 남아, 최후의 두 세력이 죽은 적을 '공유' 한다는 이유로 CommonEnemy(+30/턴)를 영원히 축적. 살아있는 세력만 세도록 수정.
  4. **조약의 영속성이 승리 조건과 충돌** — 만료도 파기 경로도 없어 마지막 둘이 동맹/불가침이면 영구 동결(100판 중 **98 무승부**, 8:8). Act.EndgameBetrayal 신설. 좁혀간 과정: 동맹만 풀면 **불가침으로 굳고**, 전력비 130% 를 요구하면 **8:8 대칭이라 양쪽 다 우위가 없어 교착 유지** → '칠 상대가 조약 상대뿐' 이면 전력비 무관하게 결별.
- **이유**: 관계도·조공·계략은 단위 테스트로 다 녹색이었다. 죽은 것은 **동역학**이었고, 그건 배치 시뮬·상태 덤프로만 보인다.
- **다음 작업자가 반복하지 말 판단**:
  - **AI 행동 예산(actions_per_turn=1)을 쓰는 행위는 "상대가 받아들일 것" 을 선검사할 것** — 거절당할 제안이 예산을 먹으면 뒤 행이 영원히 안 돈다.
  - **멸망 세력의 Relations 는 남는다** — 세력을 순회하는 모든 외교 판정에 `OwnedProvinceIds.Count > 0` 필터를 넣을 것(프루닝은 세이브 로드 시에만 돈다).
  - **조약에 해소 경로가 없으면 정복 승리와 충돌한다** — 새 조약 종류를 추가하면 반드시 파기/만료 경로를 함께 설계할 것.
  - **단위 테스트 녹색 ≠ 동역학 작동.** 외교·AI 변경 후엔 `simulate 100` 과 상태 덤프를 반드시 볼 것.
- **관련 파일·테스트·커밋**: `AiDiplomat.cs`(WouldAccept·EndgameBetrayal)·`RelationLedger.cs`(SharesEnemy 생존 필터)·`AiTests.AI끼리_동맹을_맺는다`. 배치 시뮬 **최고 승률 93% → 55%** — 스펙 §7 Phase 2 DoD "70% 초과 없음 [SHOULD]" 이 외교 도입으로 **처음 달성**(그전까지 맵 지리 불균형으로 실패 중이었음), 무승부 1→35.
