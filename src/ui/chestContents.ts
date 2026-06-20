// 상자 개봉 시 획득 아이템을 1.7초간 또렷이 보여주는 카드(데스크탑). #14
// leaf: main.ts 를 import 하지 않는다 — uiRoot + 아이템 이름 배열만 받는다.

let activeCard: HTMLElement | null = null;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// items = 획득한 아이템 이름 목록(빈 배열이면 빈 상자 안내).
export function showChestContents(uiRoot: HTMLElement, items: string[]): void {
  activeCard?.remove();
  const card = document.createElement("div");
  card.style.cssText =
    "position:absolute;left:50%;top:22%;transform:translate(-50%,0);background:rgba(22,17,12,0.93);border:2px solid #c79a4b;border-radius:12px;padding:13px 20px;color:#f3ead6;text-align:center;z-index:60;pointer-events:none;max-width:78%;box-shadow:0 6px 24px rgba(0,0,0,0.5)";
  const title = items.length > 0 ? "📦 상자에서 획득!" : "📦 빈 상자였어요";
  card.innerHTML =
    `<div style="font-size:15px;font-weight:700;margin-bottom:${items.length > 0 ? "8px" : "0"}">${title}</div>` +
    (items.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;font-size:14px">${items
          .map((name) => `<span>• ${escapeHtml(name)}</span>`)
          .join("")}</div>`
      : "");
  uiRoot.appendChild(card);
  activeCard = card;
  card.animate([{ opacity: 0, transform: "translate(-50%,-8px)" }, { opacity: 1, transform: "translate(-50%,0)" }], { duration: 160, easing: "ease-out" });
  window.setTimeout(() => {
    const fade = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in" });
    fade.finished.then(() => { card.remove(); if (activeCard === card) activeCard = null; }).catch(() => card.remove());
  }, 1700);
}
