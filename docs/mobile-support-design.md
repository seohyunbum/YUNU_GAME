# 모바일(스마트폰 터치) 지원 설계

> 상태: **P0~P3 구현 완료** (브랜치 `feat/mobile-support`). P4~P6은 후속. 결정: 가로 모드·우측 절반 드래그.
> 구현: `src/game/platform.ts`(터치 감지)·`src/ui/touchControls.ts`(조이스틱·룩존·버튼)·`index.html`(viewport)·`src/style.css`(.touch-mode)·`src/main.ts`(배선: 포인터락 우회·pixelRatio/quality 모바일 분기). 핫바는 기존 탭 가능 핫바 재사용.
> 작업지침 정본은 `AGENTS.md`. 데스크톱 키보드/마우스 동작은 100% 유지하고 모바일을 **병행 추가**한다.

## 0. 목표 / 비목표

- 목표: 스마트폰 브라우저에서 **이동·시점·전투·채집·스킬·인벤토리**를 손가락으로 플레이. 화면 크기 반응형. 모바일 GPU에서 플레이 가능한 프레임.
- 비목표(후순위): 인벤토리 드래그앤드롭 정교화, 멀티터치 고급 제스처, 가로/세로 자동 회전 UI, PWA 설치.

## 1. 현 구조 (분석 결과 — 모바일이 바꿔야 할 지점)

| 영역 | 현재(데스크톱 전용) | 근거(파일:라인) |
| --- | --- | --- |
| 이동 | `keys: Set<string>`에 WASD/Space/Shift/C 기록 → `updateMovement`가 `keys.has()` 소비 | `main.ts:339, 1937(keydown), 1990(keyup), 2933(updateMovement)` |
| 시점 | **포인터락** + `mousemove`→`rotateCameraByMouse(movementX,movementY)`(yaw/pitch) | `main.ts:1811(lock), 1907(move), 1930(rotate)` |
| 액션 | keydown 즉시 호출: R/T/F 스킬·E 상호작용·1~8 핫바·I/B/M 패널 | `main.ts:1981-1987, 2006(hotbar), 5376(togglePanel)` |
| 좌클릭 상호작용 | **포인터락 획득 상태에서만** `interact()` 발동 | `main.ts:1797, 3841(interact)` |
| 우클릭 액션 | 12종 우선순위 체인(설치·양동이·침대·거래·제작대·제련대·분쇄기·상점) | `main.ts:1778-1798` |
| 인벤토리 이동 | HTML5 드래그앤드롭(dataTransfer) + 탭 선택 폴백 일부 존재 | `main.ts:6685-6791` |
| 렌더/성능 | antialias off, pixelRatio cap(high1.35/bal1.12/perf1.0), shadow 기본 off, 적응형 화질 | `main.ts:335, 958, 2537-2567`, `renderPerformance.ts` |
| 캔버스 | `resize()`가 pixelRatio 재적용 | `main.ts:1768, 2444` |
| 뷰포트 | `width=device-width, initial-scale=1` (줌/스크롤 허용) | `index.html:5` |
| CSS | 고정 px 다수 + `@media 640/720/900` 1열 접힘만. 슬롯 40~62px(터치엔 작음), safe-area 미반영, touch-action 없음 | `style.css` |

### 모바일 4대 난제
1. **포인터락 미지원**(iOS Safari 전면 차단) → 시점은 **터치 드래그**로 대체.
2. **좌클릭 interact가 포인터락 전제** → 모바일은 **버튼/탭이 `interact()` 직접 호출**(락 우회).
3. **main.ts 예산 포화**(9534줄/462메서드, 여유 0) → 터치 코드는 **전부 리프(`src/ui/`)**, main.ts는 narrow 배선만.
4. **성능 헤드룸 0**(~30fps·가시메시 ~6160) → 모바일 **저사양 프리셋 기본값** 필수.

## 2. 아키텍처 (데이터/리프 우선)

```
src/ui/touchControls.ts   (신규 leaf)  ← 터치 전부 담당
  · 모바일 감지(matchMedia('(pointer:coarse)') / maxTouchPoints)
  · 오버레이 DOM 생성(조이스틱·룩존·버튼) → .game-ui 루트에 부착
  · touchstart/move/end 처리 → 좁은 콜백으로만 게임과 통신 (스크래치 재사용, 매프레임 할당 0)
  · CSS는 style.css 의 .touch-mode/@media 로 표시·크기 전환

src/main.ts (배선만, 순증 최소):
  · createTouchControls(uiRoot, callbacks) 1회 호출
  · callbacks = 기존 메서드 재사용:
      setMoveKey(code,on) → this.keys.add/delete       // 이동: updateMovement 그대로 재사용
      applyLook(dx,dy)    → this.rotateCameraByMouse(dx*TOUCH_SENS, dy*TOUCH_SENS)
      jump/interact/attack/useSkill(1|2|3)/selectHotbar(i)/togglePanel(p) → 기존 메서드
  · isMobile() → 포인터락 요청 스킵 + 품질 프리셋 'performance'

src/game/constants.ts (데이터):
  · TOUCH_SENSITIVITY_X/Y, MOBILE_PIXEL_RATIO_CAP(0.75), VISIBILITY_DISTANCE_SCALE,
    조이스틱/버튼 크기 등 → 하드코딩 금지
```

핵심 원리: **이동은 `keys` Set 재사용**(조이스틱이 WASD 키를 켜고 끔), **시점은 `rotateCameraByMouse` 재사용**(터치 델타 주입), **액션은 기존 메서드 직접 호출**. → 게임 로직 0 수정, 게이팅(`currentPanel`)·쿨다운·HUD 그대로 동작.

## 3. 컨트롤 레이아웃 (가로 모드 기준)

- **좌하단**: 가상 조이스틱(이동). 위에 점프 버튼.
- **우측 절반**: 시점 드래그 영역(버튼 위가 아닌 곳을 끌면 시점 회전).
- **우하단**: 상호작용/공격 큰 버튼 + 스킬 R/T/F 버튼(쿨다운 오버레이, 전직 전 F 숨김 — skillBar 슬롯 로직 재사용).
- **하단 중앙**: 핫바 1~8(탭 선택).
- **상단**: 체력/마나(좌)·목표(우) HUD(safe-area 반영). 인벤토리(I)·지도(M) 작은 버튼.
- 화면 중앙 **조준점(+)** 표시(데스크톱은 암묵, 모바일은 명시).

## 4. 단계 계획 (핵심 우선 · 단계마다 검토)

| 단계 | 내용 | 가치 |
| --- | --- | --- |
| **P0 토대** | viewport meta 갱신(user-scalable=no·viewport-fit=cover) + touch-action:none + `isTouch/isMobile` 유틸 + dev `--host`(폰 LAN) | 폰에서 열림·줌/스크롤 차단 |
| **P1 이동+시점** | `touchControls.ts`: 좌 조이스틱(→keys WASD) + 우 드래그(→rotateCameraByMouse). 포인터락 우회 | **폰에서 돌아다님**(최대 가치) |
| **P2 핵심 액션** | 점프·상호작용/공격·스킬(R/T/F)·핫바(1~8)·인벤토리(I) 버튼 → 기존 메서드 | 전투·채집·스킬·인벤 |
| **P3 성능 프리셋** | isMobile→quality 'performance'·pixelRatio cap 0.75·가시거리 ×0.8·모바일 PERF_BUDGET | 폰 프레임 확보 |
| **P4 반응형 HUD** | `.touch-mode` 미디어쿼리·슬롯≥48px·safe-area·데스크톱 가이드 숨김 | 작은 화면 가독·오터치 방지 |
| **P5 고급 입력** | 우클릭 액션(설치·거래·제작대 등) 버튼 + 인벤토리 탭선택 이동 | 건축·거래·제작 |
| **P6 폴리시** | 가로 권장 안내·조준점·iOS/Android 점검·README 조작법·verify | 완성도 |

> 권장 1차 산출물 = **P0~P3**(돌아다니고 싸우고 스킬 쓰고 프레임 확보). P4~P6은 후속 증분.

## 5. 가드레일 · 검증

- main.ts: 신규 로직 0, narrow 배선만. 순증 시 ratchet 사유 기록(또는 추출 상쇄). game/ui→main import 금지.
- 핫패스: 터치 델타는 스크래치 재사용(매 프레임 `new` 금지). perf-check 전후 비교.
- **검증 제약**: 이 개발 PC엔 Node 없음 → 로컬 verify/dev/디바이스 에뮬 불가. **CI `tsc && vite build`로 타입 검증**, 실제 터치 동작은 **배포된 GitHub Pages를 폰 브라우저로 직접 테스트**(merge→deploy→폰에서 https://seohyunbum.github.io/YUNU_GAME/ 열기). 데스크톱 회귀는 `npm run verify`(dev 머신).

## 6. 미해결 — 사용자 확인 필요

- 화면 방향: **가로 권장**(1인칭 시야·양손 조작 유리) vs 세로 지원.
- 1차 산출물 범위: **P0~P3**(권장) vs 전체(P0~P6 한 번에).
- 시점 조작: **우측 절반 드래그**(권장) vs 전용 작은 룩패드.
