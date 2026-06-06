export interface WorkbenchSlotView {
  item: string | null;
  label: string;
  count: number;
}

export interface WorkbenchMaterialView {
  item: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface WorkbenchRecipeView {
  id: string;
  name: string;
  ingredientsLabel: string;
  outputLabel: string;
  note: string;
  canCraft: boolean;
}

export interface WorkbenchPanelView {
  isExtended: boolean;
  gridSize: string;
  resultLabel: string;
  resultReady: boolean;
  slots: WorkbenchSlotView[];
  materials: WorkbenchMaterialView[];
  recipes: WorkbenchRecipeView[];
}

export interface WorkbenchPanelCallbacks {
  onClose: () => void;
  onSelectItem: (item: string) => void;
  onSlotClick: (index: number) => void;
  onCraft: () => void;
  onClear: () => void;
  onFillRecipe: (recipeId: string) => void;
  onCraftRecipe: (recipeId: string) => void;
  bindDragDrop: () => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

function renderWorkbenchSlot(slot: WorkbenchSlotView, index: number) {
  const label = slot.item
    ? `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>`
    : "";
  const dragAttrs = slot.item
    ? ` draggable="true" data-drop-item="${escapeAttr(slot.item)}" data-slot-source="workbench" data-slot-index="${index}"`
    : "";
  return `<button class="craft-slot inventory-cell" data-workbench-slot="${index}"${dragAttrs}>${label}</button>`;
}

function renderMaterialButton(material: WorkbenchMaterialView, index: number) {
  const selected = material.selected ? " selected" : "";
  return `<button class="item-button item-slot${selected}" draggable="true" data-drop-item="${escapeAttr(material.item)}" data-select-item-index="${index}">
          <span class="slot-name">${escapeHtml(material.label)}</span>
          <span class="slot-count">${material.count}</span>
        </button>`;
}

function renderRecipeCard(recipe: WorkbenchRecipeView, index: number) {
  const disabled = recipe.canCraft ? "" : "disabled";
  return `<article class="recipe-card">
                    <div>
                      <strong>${escapeHtml(recipe.name)}</strong>
                      <p>${escapeHtml(recipe.ingredientsLabel)} -> ${escapeHtml(recipe.outputLabel)}</p>
                      <small>${escapeHtml(recipe.note)}</small>
                    </div>
                    <div class="recipe-actions">
                      <button data-fill-recipe-index="${index}" ${disabled}>재료 넣기</button>
                      <button data-craft-recipe-index="${index}" ${disabled}>바로 제작</button>
                    </div>
                  </article>`;
}

export function renderWorkbenchPanel(
  panelEl: HTMLElement,
  view: WorkbenchPanelView,
  callbacks: WorkbenchPanelCallbacks,
) {
  const workbenchSlots = view.slots.map(renderWorkbenchSlot).join("");
  const itemButtons = view.materials.map(renderMaterialButton).join("");
  const recipeCards = view.recipes.map(renderRecipeCard).join("");

  panelEl.innerHTML = `
      <section class="panel workbench-panel">
        <header>
          <div>
            <h2>${view.isExtended ? "확장 제작대" : "제작대"}</h2>
            <p class="inventory-subtitle">${view.gridSize} 제작 공간입니다. 재료 위치는 상관없고 조합만 맞으면 제작됩니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="workbench-layout">
          <section class="workbench-crafting-board">
            <div class="inventory-label">제작 공간 ${view.gridSize}</div>
            <div class="workbench-crafting-flow">
              <div class="workbench-grid${view.isExtended ? " extended" : ""}">${workbenchSlots}</div>
              <div class="craft-arrow">→</div>
              <div class="craft-result${view.resultReady ? " ready" : ""}">${escapeHtml(view.resultLabel)}</div>
            </div>
            <div class="panel-actions">
              <button data-workbench-craft>제작</button>
              <button data-clear-workbench>재료 비우기</button>
            </div>
            <div class="inventory-label">재료 선택</div>
            <div class="item-list item-slot-grid">${itemButtons || '<div class="empty-inventory">비어 있음</div>'}</div>
            <div class="ground-drop-zone" data-ground-drop>여기로 드래그하면 일반 아이템은 버리고 설치 아이템은 설치</div>
          </section>

          <section class="recipe-book-board">
            <div class="inventory-label">제작대 레시피북</div>
            <div class="recipes">${recipeCards}</div>
          </section>
        </div>
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-select-item-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const material = view.materials[Number(button.dataset.selectItemIndex)];
      if (material) callbacks.onSelectItem(material.item);
    });
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-workbench-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onSlotClick(Number(button.dataset.workbenchSlot)));
  });
  panelEl.querySelector<HTMLButtonElement>("[data-workbench-craft]")?.addEventListener("click", callbacks.onCraft);
  panelEl.querySelector<HTMLButtonElement>("[data-clear-workbench]")?.addEventListener("click", callbacks.onClear);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-fill-recipe-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const recipe = view.recipes[Number(button.dataset.fillRecipeIndex)];
      if (recipe) callbacks.onFillRecipe(recipe.id);
    });
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-recipe-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const recipe = view.recipes[Number(button.dataset.craftRecipeIndex)];
      if (recipe) callbacks.onCraftRecipe(recipe.id);
    });
  });
  callbacks.bindDragDrop();
}
