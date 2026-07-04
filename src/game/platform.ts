// 플랫폼 감지 — 순수 유틸(부수효과 없음). main.ts import 금지(leaf 규칙).
// 모든 함수는 호출 시점에 브라우저 API 를 읽는다(모듈 top-level 평가 금지 → SSR/테스트 안전).

const FORCE_TOUCH_KEY = "ai-game-lab:force-touch";

// 개발자 기능(F4 치트 아이템 소환 등) 게이트 — 서버 PC 에서 직접 실행한 URL(localhost·127.0.0.1·사설 LAN IP·.local)에서만 true.
// 공개 배포(GitHub Pages *.github.io, 커스텀 도메인 등)에서는 false 라 일반 유저는 사용 불가.
// hostname 인자는 테스트용(미지정 시 현재 window.location.hostname 을 읽음). 브라우저 밖(node)에서는 false.
export function isLocalGameHost(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "" || host.endsWith(".local")) return true;
  // 사설 LAN 대역 — 서버 PC 를 같은 네트워크의 다른 기기(폰·태블릿)에서 접속하는 경우도 허용
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

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

// 진짜 폰/태블릿인가 — orientation lock 은 실제 모바일에서만 시도(데스크톱 ?touch=1 강제 모드는 전체화면만).
function isRealMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator.maxTouchPoints ?? 0) > 0 && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? "");
}

// 데스크탑 포함 전체화면 토글 — 타이틀 버튼·Alt+Enter 에서 호출(사용자 제스처 내 동기 호출 필수).
// feature-detect + catch: 미지원(iPhone 등)·권한 거부 시 조용히 무시. F11(브라우저 네이티브)과는 독립.
export function toggleFullscreen(): void {
  if (typeof document === "undefined") return;
  const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  try {
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      const p = typeof exit === "function" ? exit.call(doc) : undefined;
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
    } else {
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
      const p = typeof req === "function" ? req.call(el) : undefined;
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
    }
  } catch {
    /* 미지원/거부 — 무시 */
  }
}

// 게임 진입 시(데스크톱·모바일 공통): 전체화면 요청 → (실제 모바일이면) 가로 잠금. 전부 feature-detect + catch 라 미지원/거부 시 조용히 무시(예외 없음).
// ※ 반드시 사용자 제스처(클릭) 안에서 동기 호출해야 브라우저 정책을 충족한다(새로시작/불러오기 버튼 클릭에서 호출). iOS Safari 는 두 API 모두 미제공 → no-op(가로 안내 오버레이로 폴백).
// 데스크톱도 기본 전체화면(2026-07-04) — 브라우저 정책상 ESC/F11 로 나가는 건 웹에서 막을 수 없으므로, 재진입은 Alt+Enter·HUD 전체화면 아이콘으로 안내.
export function enterLandscapeFullscreen(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  const lockLandscape = () => {
    if (!isRealMobileDevice()) return; // 데스크톱 터치모드: 전체화면만, lock 생략
    try {
      const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<unknown> } }).orientation;
      const p = orientation?.lock?.("landscape");
      if (p && typeof (p as Promise<unknown>).catch === "function") (p as Promise<unknown>).catch(() => {});
    } catch {
      /* iOS NotSupportedError / 데스크톱 거부 등 무시 */
    }
  };
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (typeof req !== "function") { lockLandscape(); return; } // 전체화면 미지원(iPhone 등) — 단독 lock 시도 후 종료
  let result: Promise<void> | void;
  try { result = req.call(el); } catch { lockLandscape(); return; }
  if (result && typeof (result as Promise<void>).then === "function") (result as Promise<void>).then(lockLandscape, lockLandscape);
  else lockLandscape();
}
