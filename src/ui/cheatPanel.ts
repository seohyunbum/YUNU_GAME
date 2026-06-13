import { ITEM_NAMES } from "../game/items";

// F4 치트 패널 마크업 — 정적. leaf: main.ts 를 import 하지 않는다.
// (닫기/ESC + 아이템 지급 클릭 바인딩은 호출부에서 처리)
export function renderCheatPanelMarkup(): string {
  const items = Object.entries(ITEM_NAMES)
    .map(
      ([item, name]) => `<article class="cheat-card">
          <div>
            <strong>${name}</strong>
            <small>${item}</small>
          </div>
          <div class="cheat-actions">
            <button data-cheat-item="${item}" data-cheat-count="1">+1</button>
            <button data-cheat-item="${item}" data-cheat-count="10">+10</button>
          </div>
        </article>`,
    )
    .join("");
  return `
      <section class="panel cheat-panel">
        <header>
          <div>
            <h2>F4 치트 아이템</h2>
            <p class="muted">테스트용입니다. 원하는 아이템을 바로 인벤토리에 넣습니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="cheat-grid">${items}</div>
      </section>
    `;
}
