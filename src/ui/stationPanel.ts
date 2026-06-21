// 변환형 제작 도구(제련대·분쇄기) 공용 패널 — 보유 재료 표기 + 수량 스테퍼(한 번에 N개).
// leaf: main.ts 를 import 하지 않는다. 닫기/ESC 는 호출부 bindPanelBasics 가 담당(마크업에 data-close 포함).
export interface StationRecipeView {
  id: string; // 입력 아이템 id
  title: string; // 예: "철광석 제련"
  line: string; // 예: "철광석 12/1 -> 철 1" (보유/필요 포함)
  uses: string; // "→ 쓰임: ..." (없으면 "")
  max: number; // 보유 재료 기준 한 번에 가능한 최대
  canDo: boolean;
}

export interface StationPanelView {
  title: string; // "제련대" / "분쇄기"
  actionLabel: string; // "제련" / "분쇄"
  recipes: StationRecipeView[];
}

export interface StationPanelCallbacks {
  onAction: (id: string, quantity: number) => void;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderStationCard(recipe: StationRecipeView, actionLabel: string) {
  const stepBtns = recipe.canDo && recipe.max > 1 ? "" : "disabled";
  return `<article class="recipe-card${recipe.canDo ? " ready" : ""}">
        <div>
          <strong>${escapeHtml(recipe.title)}</strong>
          <p>${escapeHtml(recipe.line)}</p>
          ${recipe.uses ? `<p style="font-size:12px;opacity:0.65;margin:2px 0 0">${escapeHtml(recipe.uses)}</p>` : ""}
        </div>
        <div class="recipe-actions">
          <div class="craft-qty-row">
            <div class="qty-stepper" data-qty-max="${recipe.max}">
              <button type="button" class="qty-btn" data-qty-dec ${stepBtns}>−</button>
              <span class="qty-val" data-qty-val>1</span>
              <button type="button" class="qty-btn" data-qty-inc ${stepBtns}>＋</button>
            </div>
            <button data-station-action="${escapeHtml(recipe.id)}" ${recipe.canDo ? "" : "disabled"}>${escapeHtml(actionLabel)}</button>
          </div>
        </div>
      </article>`;
}

export function renderStationPanel(panelEl: HTMLElement, view: StationPanelView, callbacks: StationPanelCallbacks) {
  panelEl.innerHTML = `
      <section class="panel smelter-panel">
        <header>
          <h2>${escapeHtml(view.title)}</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">${view.recipes.map((recipe) => renderStationCard(recipe, view.actionLabel)).join("")}</div>
      </section>
    `;
  panelEl.querySelectorAll<HTMLElement>(".qty-stepper").forEach((stepper) => {
    const max = Math.max(1, Number(stepper.dataset.qtyMax) || 1);
    const valEl = stepper.querySelector<HTMLElement>("[data-qty-val]");
    const setVal = (n: number) => { if (valEl) valEl.textContent = String(Math.max(1, Math.min(max, n))); };
    stepper.querySelector<HTMLButtonElement>("[data-qty-dec]")?.addEventListener("click", () => setVal(Number(valEl?.textContent) - 1));
    stepper.querySelector<HTMLButtonElement>("[data-qty-inc]")?.addEventListener("click", () => setVal(Number(valEl?.textContent) + 1));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-station-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const qty = Math.max(1, Number(button.closest(".recipe-card")?.querySelector("[data-qty-val]")?.textContent) || 1);
      callbacks.onAction(button.dataset.stationAction ?? "", qty);
    });
  });
}
