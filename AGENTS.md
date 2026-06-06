# AGENTS.md — AI Game Lab 작업지침 (정본 / source of truth)

> 이 파일은 **Codex·Claude Code 가 매 세션 자동으로 읽는** 엔지니어링 작업지침 + 아키텍처 설계도다.
> 콘텐츠·밸런스 설계는 `docs/`, 실행·조작은 `README.md` 를 본다.
> 여기는 오직 **"코드를 어디에·어떻게 넣고, 어떻게 안전하게 바꾸는가"** 만 다룬다.
> (Claude Code 는 `CLAUDE.md` 가 이 파일을 참조한다. 정본은 항상 이 파일이다.)

## 0. 이 프로젝트는

- 초등 자녀와 함께 Codex/Claude Code 로 만드는 **Three.js 1인칭 야생 생존 게임**. 로컬 브라우저(Vite) 실행.
- 한 번에 작은 변경 · 30분 안에 움직이는 결과 · 재미있어진 순간마다 커밋.

## 1. 제1원칙 — 재발 방지의 핵심 ⛔

**신규 기능 코드를 `src/main.ts` 에 추가하지 않는다.**

- 게임 로직·데이터 → `src/game/`
- 화면 표현(HTML/DOM) → `src/ui/` · 메시 생성 → `src/game/*Visuals.ts`
- `main.ts` 는 **지휘자(conductor)** 다: 게임 루프·입력·공유 상태 보관·시스템 배선만. **줄어들기만 해야 하고 늘어나면 안 된다.**
- 새 시스템을 `WildernessGame` 의 메서드로 늘리고 싶으면 → **멈추고, 모듈로 빼서 배선만 추가하라.**

> 과거 main.ts 가 12,000줄로 비대해진 원인은 "모든 변경을 main.ts 에서 한다"는 관성이었다. 이 규칙이 그것을 되돌린다.

## 2. 아키텍처 지도 (의존 방향 불변)

| 경로 | 역할 | 규칙 |
| --- | --- | --- |
| `src/main.ts` | `WildernessGame` 지휘자: `update()` 루프(**호출 순서 민감**)·입력·공유 커널 보관·배선 | 신규 로직 금지, **축소만** |
| `src/game/` (순수 로직·데이터) | `constants` `types` `items` `recipes` `monsters` `classes` `trading` `smithing` `housing` `tutorial` `worldData`(데이터) · `saveMigration` `saveRepository` `saveManager`(저장) · `combat`(전투 순수 코어) | **main.ts import 금지** |
| `src/game/*Visuals.ts` | `bossVisuals` `creatureVisuals` `heldItemVisuals` `placeableVisuals` `buildingSigns` `bucketVisuals` — 데이터 → `THREE.Object3D` 순수 팩토리 | 부수효과·커널 접근 금지 |
| `src/ui/` (표현) | `hudRenderer` `loadGamePanel` `workbenchPanel` — 뷰모델 + DOM 받아 렌더 | **main.ts import 금지**, 게임 객체 접근 금지 |
| `src/avatar.ts` `visuals.ts` `objectives.ts` `operatorConfig.ts` | 보조 모듈 | — |

**의존 방향:** `main.ts → (game/, ui/)`. **`game/`·`ui/` 는 절대 `main.ts` 를 import 하지 않는다** (leaf 규칙). 이 방향이 깨지면 분리가 무의미해진다.

## 3. 공유 커널 — main.ts 가 소유, 시스템엔 좁게 주입

다음은 도처에서 쓰여 옮길 수 없다. 시스템에 **`this` 를 통째로 넘기지 말고, 필요한 것만 좁은 컨텍스트로 주입**한다:

- 월드 레지스트리: `objects` Map + `addObject`/`removeObject` + 공간 인덱스
- `playerPosition`(읽기 다수), 인벤토리 슬롯(`hotbar`/`bagSlots`/`craftSlots`/`workbenchSlots`)
- 교차 관심사: `showMessage`, `renderHud`

## 4. 두 가지 추출 패턴

- **A형 — 순수/뷰모델** (렌더·직렬화·비주얼): 평범한 데이터 입력 → 산출(markup / `Object3D` / `SavedGame`).
  예) `ui/hudRenderer`(`HudViewModel` + elements + cache), `game/saveManager`.
- **B형 — 커널 변이** (전투 적용·스폰 등): 좁은 `GameContext`(`showMessage`·`removeObject`·`grantLoot`·`grantExperience`·`renderHud`·`playerPosition` 읽기)를 주입. **`this` 통째 금지.**

## 5. 추출 7단계 의식 (한 번에 하나만)

1. 직전 녹색 상태 **커밋**
2. 대상 순수 로직에 **특성화 테스트 먼저**
3. **이동만(동작 보존)** — `this.X` → 인자/컨텍스트로 치환, `main.ts` 엔 위임만 남김. 로직 변경 0.
4. `npm run verify` → **녹색** (깨지면 1번으로 되돌림)
5. (UI 변경 시) `npm run visual-check`
6. **즉시 커밋** (작게, 라벨 명확)
7. 다음 대상

> **이동(move) ≠ 개선(improve).** 동작 보존 이동과 동작 변경 개선을 같은 커밋에 섞지 않는다.

## 6. 커밋 규율

- **큰 리팩터를 미커밋 상태로 두지 않는다.** 녹색이면 자주 커밋한다.
- 커밋은 **pathspec 으로 대상 한정**. 무관한 staged 파일을 섞지 않는다.
- `SavedGame` 형태를 바꿨으면 → `SAVE_VERSION` 올리고 마이그레이션 + roundtrip 테스트 추가.

## 7. main.ts 크기 예산 (ratchet)

- `npm run check:size` 가 예산 초과 시 실패한다. 예산은 **내려가기만** 한다.
- main.ts 를 줄였으면 `scripts/check-main-size.mjs` 의 `MAX_MAIN_LINES` 를 새 줄 수로 낮춘다.
- 새 메서드를 넣었으면 다른 곳에서 그만큼 빼서 갚는다.

## 8. 테스트·게이트

- `npm run verify` = `typecheck` + `check:size` + 단위 테스트(`combat`·`save-migration`·`save-roundtrip`·`save-repository`). **커밋 전 필수.**
- `npm run visual-check` = 브라우저 픽셀/E2E 검사. UI 변경 시 추가 실행.
- `npm run perf-check` = 프레임·메시·객체 측정 + **성능 예산 게이트**(§10). 엔티티·메시·매 프레임 작업 추가 시 필수.
- `npm run verify:full` = `verify` + 서버 점검 + `visual-check` + `perf-check`. UI/성능 영향 변경의 종합 게이트.
- 규칙: 순수 로직(전투·세이브·경제·레시피)은 **의존되기 전에 테스트부터**. 위험 시스템은 **리팩터 전에 테스트**.

## 9. 기술 사실 (stale 금지)

- 엔진은 **Three.js**. `phaser`·`react`·`react-dom` 은 **미사용 — 제거 예정**(새 코드에서 쓰지 말 것).
- Vite + TypeScript **strict**(`any` 금지 유지). 저장은 localStorage + 버전 마이그레이션.

## 10. 성능 예산 (렉 방지)

업그레이드가 렉을 유발하지 않도록 **성능도 기계적으로 강제**한다.
(현재 개방 필드는 이미 ~30fps · 가시 메시 ~6,160 — 헤드룸이 거의 없어 엔티티/메시 증가에 민감하다.)

### 핫패스 규칙 (`update*` · `animate*` · 매 프레임)

1. **할당 금지** — `new THREE.Vector3/Color/Quaternion`, 새 `{}`/`[]`/클로저를 매 프레임 만들지 않는다. **풀링된 스크래치 필드 재사용**(예: `sunPosition`).
2. **머티리얼/지오메트리/텍스처 생성 금지** — `update` 나 대량 `spawn` 루프에서 `new *Material/*Texture/*Geometry` 금지. 한 번 만들어 공유(`makeToonMaterial`·`sharedMaterials`).
3. **반복 정적 오브젝트는 머지/인스턴싱**(`mergeGeometries`). 가시 메시 1개 ≈ draw call 1개.
4. **DOM 은 변경 시에만** — `hudRenderCache` 같은 변경감지 캐시 유지. 매 프레임 `innerHTML` 금지.
5. **모든 spawn 은 제거 경로 보유 + 배열 상한** — `projectiles`·`damageParticles` 등이 무한 증가하지 않게.
6. **컬링·throttle·적응형 화질 우회 금지** — `updateVisibilityCulling`·`shadowRefreshInterval`·`updateAdaptiveQuality` 를 무력화하지 않는다.

### 추출 시 성능 규칙

- **컨텍스트/facade 객체는 생성자에서 1회만** 만든다(`spawnContext` 처럼 `readonly` 필드). 매 프레임·매 호출 생성 금지.
- 추출은 **성능 캐시·throttle 을 보존**한다. "동작 보존(move)"에는 **성능 보존이 포함**된다 — 매 프레임 할당이나 draw call 1개라도 늘리면 동작 보존이 아니다.

### 기계적 게이트

- `npm run perf-check` 가 **성능 예산 초과 시 실패**한다(`scripts/performance-smoke.mjs` 의 `PERF_BUDGET`). 씬 카운트(메시/객체/raycast)는 런-간 분산 <1% 라 신뢰 가능; 프레임타임은 머신 의존이라 느슨한 상한만 둔다.
- 예산은 **내려가기만** 한다(ratchet). 최적화로 메시가 줄면 `PERF_BUDGET` 를 낮춰 조인다.
- `verify:full` 에 포함된다. **엔티티·메시·매 프레임 작업을 추가/변경하면 perf-check 전후를 비교**한다.
