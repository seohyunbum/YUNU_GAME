// 패널 접기/펼치기 상태 — 컨테이너에 .collapsed 클래스 토글 + localStorage 영속.
// 순수 DOM + 스토리지 leaf (main.ts·게임 객체 접근 없음). 사생활 모드 등 스토리지 예외는 조용히 무시.
const STORE_PREFIX = "yunu:collapse:";

function readCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(STORE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(STORE_PREFIX + key, collapsed ? "1" : "0");
  } catch {
    /* 스토리지 불가(사생활 모드 등) — 세션 내 클래스 토글만 유지 */
  }
}

// 저장된 접힘 상태를 컨테이너에 반영(초기 렌더 직후 1회). innerHTML 재렌더에도 클래스는 컨테이너에 남아 보존된다.
export function applyCollapseState(container: HTMLElement, key: string): void {
  container.classList.toggle("collapsed", readCollapsed(key));
}

// 접힘 상태 토글 + 영속. 새 상태(true=접힘)를 반환.
export function toggleCollapse(container: HTMLElement, key: string): boolean {
  const next = !container.classList.contains("collapsed");
  container.classList.toggle("collapsed", next);
  writeCollapsed(key, next);
  return next;
}
