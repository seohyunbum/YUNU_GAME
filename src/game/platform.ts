// 플랫폼 감지 — 순수 유틸(부수효과 없음). main.ts import 금지(leaf 규칙).
// 모든 함수는 호출 시점에 브라우저 API 를 읽는다(모듈 top-level 평가 금지 → SSR/테스트 안전).

// 터치가 주 입력인 기기(스마트폰/태블릿)인가? — 모바일 터치 컨트롤 표시 + 저사양 품질 프리셋에 사용.
// 마우스 달린 데스크톱(터치스크린 포함)은 보통 hover:hover 라 false 가 된다.
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const mm = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
  const coarse = mm ? mm("(pointer: coarse)").matches : false;
  const noHover = mm ? mm("(hover: none)").matches : false;
  const touchPoints = (navigator.maxTouchPoints ?? 0) > 0;
  return (coarse && noHover) || (touchPoints && coarse);
}
