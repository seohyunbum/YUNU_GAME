# 모바일 진입 시 자동 가로모드 + 전체화면 — 실현가능성 검토 & 설계 (구현 대기)

> 상태: **구현 완료** (2026-06). platform.ts(enterLandscapeFullscreen)·main.ts(진입 훅·in-game 클래스·orientationchange)·style.css(세로 차단 오버레이). 결정 4건(오버레이 격상/로드 적용/데스크톱 lock 생략/orientationchange) 반영. verify+build+E2E(11종) 통과.
> 코드 라인은 동시 작업으로 이동 가능 → **심볼명 기준**.

## 0. 결론 (핵심 — 기대치 정렬용)

| 플랫폼 | 전체화면 | 가로 강제(orientation lock) | 결과 |
|---|---|---|---|
| **Android** (Chrome·Edge·삼성) | ✅ | ✅ `screen.orientation.lock('landscape')` | **완전 강제 가능** |
| **iOS Safari (iPhone)** | ❌ (iPhone은 Fullscreen API 없음) | ❌ (orientation.lock 미지원) | **강제 불가** — OS/브라우저 한계 |
| **iPadOS Safari** | △ (요소 한정) | ❌ | 부분/사실상 폴백 |
| 데스크톱(터치모드 강제 시) | ✅ | ❌(throw→catch) | 전체화면만 |

- **"오류 없이"**: ✅ 전 플랫폼. 모든 호출을 feature-detect + `Promise.catch` 로 감싸 미지원 기기에서도 예외 없음(기존 전체화면 코드가 이미 이 패턴).
- **"정확하게 강제"**: **Android 만** 100% 강제. **iPhone 은 프로그램적으로 강제 불가**(애플 정책 — Fullscreen/Orientation Lock API 미제공). → iOS 는 "가로로 돌려주세요" 안내로 우아하게 폴백(이미 존재). 이 점이 유일한 제약이며 우리가 코드로 우회 불가.

즉 **구현은 안전하게 가능**하되, iPhone 사용자에게는 "자동 회전"이 아니라 "회전 안내"가 된다는 점만 합의되면 됨.

## 1. 이미 갖춰진 부품 (대부분 재사용)

| 부품 | 위치 | 비고 |
|---|---|---|
| 모바일 감지 | `src/game/platform.ts` `isTouchDevice()` | 견고(pointer/hover/touchPoints/UA) + `?touch=1` 테스트 오버라이드 |
| 전체화면 토글/자동 | `src/ui/touchControls.ts:293-304` | 버튼 + 인게임 첫 터치 자동. `requestFullscreen?.().catch` 라 iOS-safe |
| 리사이즈 적응 | `src/main.ts:1868` → `resize()` (`camera.updateProjectionMatrix` + `renderer.setSize`) | 방향 전환 시 뷰포트 자동 재계산(orientationchange 도 resize 발생) |
| 세로모드 안내 | `src/style.css:3845` `@media (orientation: portrait) body.touch-mode::after` | iOS 폴백(회전 권유 배너) — 이미 있음 |
| 가로 레이아웃 | `src/style.css:4055` `@media (orientation: landscape) and (max-height:480px)` | 좁은 가로 최적화 |
| **진입 제스처** | `src/main.ts:868` `onTitleNew: () => runWithLoading(uiRoot, () => this.startGame("new"))` | "새로시작" 클릭 = 게임 진입. 닉네임은 로드 시(`:937 ensureNickname`) 이미 처리되므로 이 클릭이 깨끗한 단일 제스처 |

→ **신규로 필요한 것은 단 2가지**: (a) orientation lock 호출, (b) 트리거를 "인게임 첫 터치" → "게임 진입 클릭"으로 이동.

## 2. 설계

### 2-1. 신규 리프 헬퍼 `enterLandscapeFullscreen()`
`src/game/platform.ts` (또는 touchControls.ts). 부수효과만, main.ts import 금지 규칙 유지.
```ts
// 모바일 게임 진입 시: 전체화면 → 가로 잠금. 전부 feature-detect + catch (미지원/거부 시 무시, 예외 없음).
export function enterLandscapeFullscreen(): void {
  if (!isTouchDevice()) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
  const lockLandscape = () => { try { void orientation?.lock?.("landscape")?.catch(() => {}); } catch { /* iOS NotSupportedError 등 무시 */ } };
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (typeof req === "function") {
    let p: unknown;
    try { p = req.call(el); } catch { p = null; }
    if (p && typeof (p as Promise<void>).then === "function") (p as Promise<void>).then(lockLandscape, lockLandscape);
    else lockLandscape();
  } else {
    lockLandscape(); // 전체화면 미지원이어도 단독 lock 시도(일부 안드로이드)
  }
}
```
포인트:
- **전체화면 먼저 → 그다음 lock**: Chrome 은 fullscreen 상태에서만 orientation.lock 허용. Promise resolve 후 lock 호출(성공/실패 모두 lockLandscape 시도).
- iPhone: `requestFullscreen` 과 `webkitRequestFullscreen` 모두 undefined → else 분기 → `orientation.lock` 도 undefined → no-op, 예외 없음.
- 데스크톱(터치 강제): orientation.lock 이 throw/ reject → catch.

### 2-2. 진입 클릭에 훅
`src/main.ts:868` 의 `onTitleNew` 를:
```ts
onTitleNew: () => { enterLandscapeFullscreen(); runWithLoading(this.uiRoot, () => this.startGame("new")); },
```
- **반드시 클릭 핸들러 내부에서 동기 호출**(사용자 제스처 요건). `runWithLoading` 이 fn 을 지연 실행하더라도 헬퍼는 그 앞에서 제스처 컨텍스트에 실행되므로 안전.
- `isTouchDevice()` 게이트는 헬퍼 내부에 있어 데스크톱은 자동 no-op.

### 2-3. 기존 인게임 자동 전체화면 유지
`touchControls.ts:298-304` autoFullscreen 은 그대로 둠(`if (fsAuto || document.fullscreenElement) return` 가드라 멱등). 진입 시 이미 전체화면이면 재요청 안 함. iOS 에서 인게임 첫 터치로라도 (가능하면) 전체화면 시도하는 안전망.

### 2-4. iOS 폴백 (강제 불가 보완)
- 기존 세로 안내 배너(style.css:3845) 가 폴백. 필요 시 **더 강한 전체화면 회전 오버레이**(세로일 때 캔버스 위 반투명 "📱↻ 가로로 돌려주세요")로 격상 가능 — 선택(§4).
- 본질적으로 iPhone 은 자동 회전 불가이므로 이게 최선.

## 3. 엣지/정확성 체크
- **제스처 요건**: 진입 클릭에서 동기 실행 → 충족. orientation.lock 은 fullscreen Promise 이후라도 동일 제스처 체인으로 Chrome 이 허용(표준 패턴).
- **방향 전환 리사이즈**: 세로→가로 잠금 시 뷰포트 변경 → 기존 `resize` 핸들러가 카메라 aspect·렌더러 크기 재계산. (안전 위해 `orientationchange` 리스너도 `resize()` 호출하도록 추가 권장 — 일부 구형 브라우저 resize 누락 대비.)
- **전체화면 해제**(사용자 스와이프/뒤로): lock 자동 해제, 게임 계속. 무해.
- **불러오기 진입**(`[data-load-game]`)·파티 소환 진입: 새 게임만이 아니라 로드 진입에도 동일 적용할지 결정 필요(§4-2). 권장: 로드 진입에도 동일 헬퍼 호출(일관성).
- **데스크톱 `?touch=1`**: orientation.lock reject → catch. 무해(전체화면만).
- **세이브/마이그레이션 영향 없음** — 순수 표시/뷰포트.

## 4. 미결 결정 (구현 전 확인)
1. **iOS 폴백 강화 여부**: 현 배너 유지(권장) vs 세로일 때 가리는 전체 오버레이로 격상.
2. **로드 진입에도 적용?**: 새 게임뿐 아니라 "불러오기"·파티 소환 진입에도 가로/전체화면 적용할지(권장: 적용).
3. **데스크톱 터치(`?touch=1`)에서 전체화면까지 시도할지**: 권장 그대로(전체화면만, lock 무시).
4. **orientationchange 리스너 추가**: 권장(저비용 안전망).

## 5. 검증 계획 (구현 후)
- **유닛**: `enterLandscapeFullscreen` 가 (a) requestFullscreen/orientation 부재 시 throw 안 함, (b) 존재 시 fullscreen→lock('landscape') 순서 호출. `requestFullscreen`/`screen.orientation.lock` 스텁(spy)으로 검증.
- **E2E(playwright)**: `?touch=1` 또는 body.touch-mode 강제 + requestFullscreen/orientation.lock 을 spy 로 스텁 → "새로시작" 클릭 시 lock('landscape') 호출 & 미지원 스텁에서도 무예외 확인.
- **수동**: 실제 Android(강제 동작 확인) + 실제 iPhone(강제 안 되지만 안내 노출·무예외 확인).
- `npm run verify` + `build` 녹색. main.ts 증분 최소(헬퍼는 leaf, 호출부 1줄) → 라인 예산 영향 거의 없음.

## 6. 리스크
- **낮음.** 변경 범위가 작고(헬퍼 1 + 호출 1줄 + 선택적 orientationchange), 전부 feature-detect+catch 라 어떤 기기에서도 크래시 없음. 유일한 한계는 iPhone 강제 불가(코드로 해결 불가, 안내로 폴백).
