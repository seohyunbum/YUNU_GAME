// YUNU_GAME 성능 프로브 (재사용용) — 배포본/로컬 어디서나 "주입"해 프레임당 드로우콜·FPS 측정.
// 사용법:
//   1) 수동: 게임 페이지(https://seohyunbum.github.io/YUNU_GAME/) → F12 콘솔에 이 파일 내용 전체 붙여넣기.
//   2) 자동: Claude-in-Chrome javascript_tool 로 이 IIFE 를 그대로 실행.
//   읽기: window.__perf  (= {fps, dpf=평균 draws/frame, maxDpf})  또는  window.__perfSnapshot()
//   로그: window.PERF_LOG = true  → 1초마다 콘솔 출력.
// 측정 의미:
//   · draws/frame(dpf): 기하학 종속 = 기기 무관. PC 값 ≈ 폰 값(컬링 차이만). 드로우콜 병목 판단의 핵심 지표.
//   · FPS: 기기 종속 + ★백그라운드 탭이면 rAF 가 ~2fps 로 throttle 되어 부정확. 정확한 FPS·정착 컬링은 탭을 전면(visible)에 두고 측정.
//   · 모바일 모드 수치(아웃라인/접지그림자 차이 반영): URL 에 ?touch=1 붙여 로드 후 측정.
// 자세한 절차·함정·베이스라인: docs/perf-measurement.md
(function () {
  if (window.__perfHooked) return "이미 활성 — window.__perf / window.__perfSnapshot()";
  window.__perfHooked = true;
  window.PERF_LOG = window.PERF_LOG || false;
  let calls = 0;
  const protos = [
    typeof WebGLRenderingContext !== "undefined" && WebGLRenderingContext.prototype,
    typeof WebGL2RenderingContext !== "undefined" && WebGL2RenderingContext.prototype,
  ].filter(Boolean);
  for (const p of protos) {
    for (const m of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      if (p[m] && !p[m].__perfHook) {
        const orig = p[m];
        p[m] = function () { calls++; return orig.apply(this, arguments); };
        p[m].__perfHook = true;
      }
    }
  }
  window.__perf = { fps: 0, dpf: 0, maxDpf: 0 };
  let frames = 0, last = performance.now(), maxC = 0, sumC = 0, n = 0;
  (function tick() {
    const c = calls; calls = 0; frames++; if (c > maxC) maxC = c; sumC += c; n++;
    const t = performance.now();
    if (t - last >= 1000) {
      window.__perf = { fps: frames, dpf: Math.round(sumC / n), maxDpf: maxC };
      if (window.PERF_LOG) console.log(`[perf] FPS≈${frames}  draws/frame avg ${window.__perf.dpf} max ${maxC}`);
      frames = 0; last = t; maxC = 0; sumC = 0; n = 0;
    }
    requestAnimationFrame(tick);
  })();
  window.__perfSnapshot = () => window.__perf;
  return "성능 프로브 ON — window.__perf / window.__perfSnapshot(). 정확한 FPS·정착 컬링은 탭을 전면에 둘 것.";
})();
