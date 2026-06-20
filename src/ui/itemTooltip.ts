// 아이템 마우스오버 툴팁 (leaf UI) — `data-item="<id>"` 가 붙은 요소에 호버하면
// 능력치·설명을 띄운다. body 에 단일 툴팁 div 를 두고 전역 위임으로 처리하므로
// 패널이 innerHTML 로 다시 그려져도 재바인딩이 필요 없다. 호버 이벤트에서만 동작(매 프레임 비용 0).
import { describeItem } from "../game/itemInfo";
import { isTouchDevice } from "../game/platform";
import type { ItemId } from "../game/types";

const CURSOR_OFFSET = 16;

let tooltipEl: HTMLDivElement | null = null;
let initialized = false;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "item-tooltip hidden";
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function renderTooltip(item: ItemId): string {
  const info = describeItem(item);
  const stats = info.stats.map((line) => `<div class="item-tooltip-stat">${escapeHtml(line)}</div>`).join("");
  const note = info.note ? `<div class="item-tooltip-note">${escapeHtml(info.note)}</div>` : "";
  return `<div class="item-tooltip-head tier-${info.tier}">
      <span class="item-tooltip-name">${escapeHtml(info.name)}</span>
      <span class="item-tooltip-tier">${escapeHtml(info.tierLabel)}</span>
    </div>${stats}${note}`;
}

function positionTooltip(el: HTMLDivElement, clientX: number, clientY: number) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  let left = clientX + CURSOR_OFFSET;
  let top = clientY + CURSOR_OFFSET;
  if (left + width > window.innerWidth - 8) left = clientX - CURSOR_OFFSET - width;
  if (top + height > window.innerHeight - 8) top = clientY - CURSOR_OFFSET - height;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

function hide() {
  if (tooltipEl) tooltipEl.classList.add("hidden");
}

function itemFromEvent(event: Event): { item: ItemId; target: HTMLElement } | null {
  const start = event.target;
  if (!(start instanceof HTMLElement)) return null;
  const host = start.closest<HTMLElement>("[data-item]");
  const value = host?.dataset.item;
  if (!host || !value) return null;
  return { item: value as ItemId, target: host };
}

// 한 번만 호출하면 이후 모든 `[data-item]` 요소에 적용된다 (멱등).
export function initItemTooltips() {
  if (initialized) return;
  initialized = true;

  if (isTouchDevice()) {
    // 터치: hover 가 없으므로 [data-item] 롱프레스(≈380ms)로 능력치 툴팁 표시 + 자동 숨김. 일반 탭(슬롯 액션)과 분리.
    let lpTimer = 0;
    let lpFired = false;
    document.addEventListener("touchstart", (event) => {
      hide();
      const match = itemFromEvent(event);
      if (!match) return;
      lpFired = false;
      lpTimer = window.setTimeout(() => {
        lpFired = true;
        const el = ensureTooltip();
        el.innerHTML = renderTooltip(match.item);
        el.classList.remove("hidden");
        const t = event.touches[0];
        positionTooltip(el, t ? t.clientX : window.innerWidth / 2, t ? t.clientY : window.innerHeight / 2);
        window.setTimeout(hide, 3500);
      }, 380);
    }, { passive: true });
    const cancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = 0; } };
    document.addEventListener("touchmove", cancel, { passive: true });
    document.addEventListener("touchend", cancel, { passive: true });
    // 롱프레스로 툴팁이 떴으면 뒤따르는 click(슬롯 액션 등)을 1회 억제 — 정보 보기와 동작을 분리.
    document.addEventListener("click", (event) => { if (lpFired) { event.stopPropagation(); event.preventDefault(); lpFired = false; } }, true);
    return;
  }

  document.addEventListener("pointerover", (event) => {
    const match = itemFromEvent(event);
    if (!match) return;
    const el = ensureTooltip();
    el.innerHTML = renderTooltip(match.item);
    el.classList.remove("hidden");
    positionTooltip(el, event.clientX, event.clientY);
  });

  document.addEventListener("pointermove", (event) => {
    if (!tooltipEl || tooltipEl.classList.contains("hidden")) return;
    if (!itemFromEvent(event)) {
      hide();
      return;
    }
    positionTooltip(tooltipEl, event.clientX, event.clientY);
  });

  document.addEventListener("pointerout", (event) => {
    const match = itemFromEvent(event);
    if (!match) return;
    const next = (event as PointerEvent).relatedTarget;
    if (next instanceof HTMLElement && next.closest("[data-item]") === match.target) return;
    hide();
  });

  // 패널이 닫히거나 드래그가 시작되면 떠 있는 툴팁을 정리한다.
  document.addEventListener("pointerdown", hide, true);
}
