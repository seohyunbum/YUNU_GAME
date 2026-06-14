// leaf: main.ts 를 import 하지 않는다. 전역 window/history/document 만 다룬다.
// 게임을 브라우저 기본 동작으로부터 보호하는 3가지 가드를 한곳에 모은다.
//   1) 우클릭 컨텍스트 메뉴 — 페이지 전역에서 항상 차단(캡처 단계). 게임 내 우클릭 동작(설치/거래/대장간 등)은
//      element 핸들러가 그대로 처리한다(여기선 preventDefault 만, 전파는 막지 않음).
//   2) 뒤로가기(popstate) — 게임 중이면 더미 히스토리 상태(트랩)를 다시 밀어 페이지에 머문다. 뒤로가기로는 절대
//      게임을 나가지 못한다(사용자 요청). 게임 종료는 인게임 '새로시작' 메뉴나 탭 닫기로만.
//   3) 새로고침/탭닫기/이탈(beforeunload/pagehide/visibilitychange:hidden) — 자동저장 flush + 네이티브 확인창.
//
// 트랩 부기: armed 플래그로 "게임 중 정확히 1개의 트랩만 살아있게" 유지한다(중복 적재·누수 방지).
//   - install 시에는 트랩을 밀지 않는다(타이틀에서 정상 뒤로가기 허용).
//   - 게임 진입(enterGameplayMode) → arm(): 트랩 1개 적재.
//   - 게임 중 뒤로가기 → onPopState: 소비된 트랩을 다시 채워 항상 1개 유지(누수 0).
//   - 타이틀 복귀(showTitleScreen) → disarm(): 우리가 민 트랩 1개 제거(타이틀 뒤로가기 정상화).

export interface NavigationGuardOptions {
  getGameStarted: () => boolean;
  autosave: () => void; // 페이지가 살아있는 경로(탭 전환 등) — 비동기/압축 가능
  autosaveSync: () => void; // 페이지 종료 직전(beforeunload/pagehide) — 동기 raw 저장
  onBlockedBack?: () => void; // 뒤로가기가 흡수됐을 때 안내(토스트 등)
}

export interface NavigationGuardHandle {
  arm: () => void; // 게임 진입 — 트랩 적재(이미 무장 상태면 무시)
  disarm: () => void; // 타이틀 복귀 — 트랩 제거
  uninstall: () => void;
}

export function installNavigationGuard(opts: NavigationGuardOptions): NavigationGuardHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { arm: () => {}, disarm: () => {}, uninstall: () => {} };
  }

  let armed = false; // 우리가 민 트랩이 현재 1개 살아있는가

  const blockContextMenu = (event: Event) => event.preventDefault();

  const pushTrap = () => {
    try {
      history.pushState({ yunuTrap: true }, "", location.href);
    } catch {
      /* 일부 환경(파일 프로토콜 등)에서 pushState 불가 — 무시 */
    }
  };

  const onPopState = () => {
    // 타이틀(비게임) 또는 비무장 상태에서는 정상 뒤로가기 허용.
    if (!opts.getGameStarted() || !armed) {
      armed = false; // 트랩이 소비됐을 수 있으니 상태만 정리(재적재하지 않음)
      return;
    }
    pushTrap(); // 실수 뒤로가기 흡수 — 소비된 트랩을 다시 채워 항상 1개 유지
    opts.onBlockedBack?.();
  };

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!opts.getGameStarted()) return;
    opts.autosaveSync();
    event.preventDefault();
    event.returnValue = "게임을 나가면 직전 진행이 사라질 수 있습니다."; // 브라우저는 자체 문구를 띄움(텍스트는 무시)
  };

  const onPageHide = () => {
    if (opts.getGameStarted()) opts.autosaveSync();
  };

  const onVisibilityChange = () => {
    // 탭 전환/백그라운드 — 페이지는 살아있으므로 비동기(압축) 저장으로 jank 를 피한다.
    if (document.visibilityState === "hidden" && opts.getGameStarted()) opts.autosave();
  };

  window.addEventListener("contextmenu", blockContextMenu, { capture: true });
  window.addEventListener("popstate", onPopState);
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("visibilitychange", onVisibilityChange);
  // install 시에는 트랩을 밀지 않는다 — 타이틀에서는 정상 뒤로가기를 허용한다.

  const arm = () => {
    if (armed) return; // 단일-트랩 불변 — 중복 적재 금지
    armed = true;
    pushTrap();
  };

  const disarm = () => {
    if (!armed) return;
    armed = false;
    try {
      history.back(); // 우리가 민 트랩 1개 제거(같은 문서 내 이동 — 언로드 아님)
    } catch {
      /* 무시 */
    }
  };

  const uninstall = () => {
    window.removeEventListener("contextmenu", blockContextMenu, { capture: true } as EventListenerOptions);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener("pagehide", onPageHide);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };

  return { arm, disarm, uninstall };
}
