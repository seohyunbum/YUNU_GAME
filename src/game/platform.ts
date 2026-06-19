// 플랫폼 감지 — 순수 유틸(부수효과 없음). main.ts import 금지(leaf 규칙).
// 모든 함수는 호출 시점에 브라우저 API 를 읽는다(모듈 top-level 평가 금지 → SSR/테스트 안전).

const FORCE_TOUCH_KEY = "ai-game-lab:force-touch";

// 수동 오버라이드 — 자동 감지가 실패하는 기기(예: 크롬 "데스크톱 사이트" 모드)를 위한 탈출구.
// URL ?touch=1 → 강제 ON, ?touch=0 → 강제 OFF. 한 번 방문하면 localStorage 에 영속.
// 반환: true(강제 ON) / false(강제 OFF) / null(오버라이드 없음 → 자동 감지).
function forcedTouch(): boolean | null {
  try {
    const param = new URLSearchParams(window.location.search).get("touch");
    if (param === "1" || param === "0") localStorage.setItem(FORCE_TOUCH_KEY, param);
    const stored = localStorage.getItem(FORCE_TOUCH_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* localStorage/URL 접근 불가(프라이버시 모드 등) — 자동 감지로 폴백 */
  }
  return null;
}

// 터치가 주 입력인 기기(스마트폰/태블릿)인가? — 모바일 터치 컨트롤 표시 + 저사양 품질 프리셋에 사용.
// 마우스 달린 데스크톱(터치스크린 포함)은 보통 hover:hover 라 false 가 된다.
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const forced = forcedTouch();
  if (forced !== null) return forced;
  const mm = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
  const coarse = mm ? mm("(pointer: coarse)").matches : false;
  const noHover = mm ? mm("(hover: none)").matches : false;
  const touchPoints = (navigator.maxTouchPoints ?? 0) > 0;
  const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? "");
  // coarse+noHover = 전형적 폰/태블릿. 일부 기기는 pointer 미디어가 어긋나므로
  // (터치포인트 보유 && (coarse 또는 모바일 UA)) 도 인정 — 마우스 데스크톱은 둘 다 거짓이라 제외된다.
  return (coarse && noHover) || (touchPoints && (coarse || uaMobile));
}
