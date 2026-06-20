# 성능 측정 절차 (드로우콜·FPS) — 재사용 가이드

배포본/로컬에서 **프레임당 드로우콜·FPS**를 빠르게 재는 법. 프로브 코드 = `scripts/perf-probe.js`.

## 무엇을 보는가
- **draws/frame (dpf)**: 한 프레임에 발생한 WebGL draw call 수. **기하학 종속 = 기기 무관** → PC 값이 곧 폰 값과 거의 같음(컬링 차이만). **드로우콜 병목 판단의 핵심.**
- **FPS**: 기기 종속. ⚠️ **백그라운드 탭이면 rAF 가 ~2fps 로 throttle** 되어 부정확 → 정확한 FPS·정착 컬링은 **탭을 전면(visible)** 에 두고 측정.
- **모바일 모드 수치**: URL 에 `?touch=1` 붙여 로드하면 performance 프리셋(아웃라인/일부 효과 off)이 적용된 **실제 모바일 드로우콜**을 잼.

## 예산 감각
모바일 건강 100~500 draws/frame, 무리해도 ~1000. PC 는 수천도 가능하나 저사양/고밀도에선 영향.

## 베이스라인 (2026-06-19, 커밋 cb83bde 시점, PC 고화질 스폰 뷰)
- **draws/frame ≈ 6,150** (가시메시 ~6,160 과 일치 → **객체당 드로우콜 1개, 배칭 거의 없음 = 드로우콜 병목 확정**).
- 나무 1144그루 = 단일 최대 인스턴싱 대상(~18%). 나머지 ~5000 의 정체(아웃라인/접지그림자 복제·기타 개별객체) 규명 시 추가 ROI.

## A. 수동 측정 (콘솔, 확장 불필요)
1. PC Chrome 에서 `https://seohyunbum.github.io/YUNU_GAME/` 열기 (모바일 모드는 `?touch=1`).
2. F12 → Console 에 `scripts/perf-probe.js` 내용 전체 붙여넣기.
3. `window.PERF_LOG = true` (1초마다 콘솔 출력) 또는 `window.__perfSnapshot()` 로 즉시 확인.
4. 게임 시작 후 **나무 보는 쪽 vs 하늘 보는 쪽** dpf 비교 → 차이가 나무/지형 드로우콜 기여.

## B. 자동 측정 (Claude-in-Chrome)
1. "Claude in Chrome"(claude.com) 확장 연결 → `list_connected_browsers` 로 확인.
2. `navigate` → 게임 URL.
3. `javascript_tool` 로 `scripts/perf-probe.js` IIFE 주입(후킹 ON).
4. 시작 플로우 자동화(닉네임 모달 → 직업 → 새로시작):
   ```js
   const inp=[...document.querySelectorAll('input')].find(i=>i.offsetParent!==null);
   if(inp){inp.value='측정테스트'; inp.dispatchEvent(new Event('input',{bubbles:true}));}
   document.querySelector('[data-nickname-confirm]')?.click();
   await new Promise(r=>setTimeout(r,500));
   document.querySelector('[data-class-choice]')?.click();      // 첫 직업(전사)
   await new Promise(r=>setTimeout(r,200));
   document.querySelector('[data-title-new]')?.click();         // 새로시작(로딩 ~5초)
   await new Promise(r=>setTimeout(r,9000));
   window.__perf
   ```
5. 읽기: `window.__perf`.

### ★ 함정 / 주의
- **백그라운드 탭 throttle**: 자동 측정 시 탭이 `document.visibilityState==='hidden'` 이면 rAF 2fps → FPS 부정확 + 거리컬링이 패스당 160개(`VISIBILITY_CHANGES_PER_PASS`)씩만 처리돼 **정착이 느림**. 정확값은 **게임 탭을 전면에 두고** 측정. (dpf 절대값 자체는 그래도 유효.)
- **닉네임 모달**: 페이지 로드 시 `ensureNickname` 으로 닉네임 입력 모달이 뜸 → 시작 전 반드시 입력·확정(`[data-nickname-confirm]`).
- **로딩 오버레이**: `새로시작`은 `runWithLoading`(동기 ~5초)을 거침 → 시작 클릭 후 충분히 대기.
- 셀렉터: 직업=`[data-class-choice]`, 새시작=`[data-title-new]`, 불러오기=`[data-title-load]`, 저장=`[data-save-game]`/`[data-load-game]`(인게임 save-controls).

## 다음에 잴 것 (5000 드로우콜 정체 규명)
- 같은 스폰에서 **하늘 보는 쪽** dpf (나무·지면 빠진 값) ↔ 나무 보는 쪽 dpf 차이 = 나무+지형 기여.
- `?touch=1`(모바일 performance) dpf — 아웃라인/접지그림자 off 반영된 실제 모바일 수치.
- 둘을 비교해 **나무 InstancedMesh vs 광범위 배칭** 중 ROI 최대 항목 결정 → 설계서.
