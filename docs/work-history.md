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
