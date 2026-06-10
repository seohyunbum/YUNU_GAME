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

## 2026-06-10 in-app Browser verification blocked by sandbox refresh

- Attempt: Open the local Vite app in the in-app Browser after predator/pet/HUD changes to visually verify the bottom-left HUD.
- Result: The Vite dev server started, but Browser setup through the Node-backed runtime failed twice with `windows sandbox failed: spawn setup refresh`.
- Reason: This is an environment sandbox initialization failure, not an application build/runtime failure. The same sandbox refresh failure also affected ordinary shell reads earlier in the turn.
- Next guard: Do not keep retrying browser setup in a loop when this exact error appears. Use `npm.cmd run verify`, `npm.cmd run build`, and focused code inspection for this session; retry Browser only in a fresh session or after the sandbox state changes.
- Files/checks: `src/style.css`, `src/game/predatorAi.ts`, `src/game/summonerPet.ts`, `npm.cmd run verify`, `npm.cmd run build`
