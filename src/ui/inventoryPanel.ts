export interface InventorySlotView {
  item: string | null;
  label: string;
  count: number;
  source?: "hotbar" | "bag" | "craft";
  index?: number;
  extraClass?: string;
  moveSelected?: boolean;
  locked?: boolean;
}

export interface InventoryMaterialView {
  item: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface HouseBuildOptionView {
  id: string;
  name: string;
  description: string;
  ingredientsLabel: string;
  canBuild: boolean;
}

export interface InventoryPanelView {
  hotbarCount: number;
  hotbar: InventorySlotView[];
  bagLabel: string;
  bagSlots: InventorySlotView[];
  craftSlots: InventorySlotView[];
  materials: InventoryMaterialView[];
  houseBuildOptions: HouseBuildOptionView[];
}

export interface InventoryPanelCallbacks {
  onClose: () => void;
  onSelectItem: (item: string) => void;
  onCraftSlotClick: (index: number) => void;
  onMiniCraft: () => void;
  onClearCraft: () => void;
  onBuildHouse: (id: string) => void;
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

function renderInventorySlot(slot: InventorySlotView) {
  if (slot.locked) return '<div class="mini-slot inventory-cell locked-slot"></div>';
  const sourceAttrs =
    slot.source !== undefined && slot.index !== undefined
      ? ` data-slot-source="${slot.source}" data-slot-index="${slot.index}"`
      : "";
  const dragAttrs =
    slot.item && slot.source !== undefined && slot.index !== undefined
      ? ` draggable="true" data-drop-item="${escapeAttr(slot.item)}"`
      : "";
  const moveSelected = slot.moveSelected ? " move-selected" : "";
  const content = slot.item
    ? `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>`
    : "";
  return `<div class="mini-slot inventory-cell${slot.extraClass ?? ""}${moveSelected}"${sourceAttrs}${dragAttrs}>${content}</div>`;
}

function renderCraftSlot(slot: InventorySlotView, index: number) {
  const label = slot.item
    ? `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>`
    : "";
  const dragAttrs = slot.item
    ? ` draggable="true" data-drop-item="${escapeAttr(slot.item)}" data-slot-source="craft" data-slot-index="${index}"`
    : "";
  return `<button class="craft-slot inventory-cell" data-craft-slot="${index}"${dragAttrs}>${label}</button>`;
}

function renderMaterialButton(material: InventoryMaterialView, index: number) {
  const selected = material.selected ? " selected" : "";
  return `<button class="item-button item-slot${selected}" draggable="true" data-drop-item="${escapeAttr(material.item)}" data-select-item-index="${index}">
          <span class="slot-name">${escapeHtml(material.label)}</span>
          <span class="slot-count">${material.count}</span>
        </button>`;
}

function renderHouseBuildOption(option: HouseBuildOptionView) {
  const disabled = option.canBuild ? "" : "disabled";
  return `<article class="recipe-card house-build-card">
        <div>
          <strong>${escapeHtml(option.name)}</strong>
          <p>${escapeHtml(option.description)}</p>
          <small>${escapeHtml(option.ingredientsLabel)}</small>
        </div>
        <button data-build-house="${escapeAttr(option.id)}" ${disabled}>집짓기</button>
      </article>`;
}

export function renderInventoryPanel(
  panelEl: HTMLElement,
  view: InventoryPanelView,
  callbacks: InventoryPanelCallbacks,
) {
  const buildOptions = view.houseBuildOptions.map(renderHouseBuildOption).join("");
  const hotbar = view.hotbar.map(renderInventorySlot).join("");
  const bagGrid = view.bagSlots.map(renderInventorySlot).join("");
  const craftSlots = view.craftSlots.map(renderCraftSlot).join("");
  const itemButtons = view.materials.map(renderMaterialButton).join("");

  panelEl.innerHTML = `
      <section class="panel inventory-panel">
        <header>
          <div>
            <h2>인벤토리</h2>
            <p class="inventory-subtitle">재료 위치는 상관없고 조합만 맞으면 제작됩니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="inventory-layout">
          <section class="craft-board house-build-panel">
            <div class="inventory-label">집짓기</div>
            <div class="recipes house-build-list">${buildOptions}</div>
          </section>
          <section class="inventory-board">
            <div class="inventory-label">하단 핫바 ${view.hotbarCount}칸</div>
            <div class="inventory-hotbar inventory-grid">${hotbar}</div>
            <div class="inventory-label">가방 ${escapeHtml(view.bagLabel)}</div>
            <div class="bag-grid inventory-grid">${bagGrid}</div>
          </section>

          <section class="craft-board">
            <div class="inventory-label">미니 제작대 2x2</div>
            <div class="crafting-flow">
              <div class="craft-grid inventory-craft-grid">${craftSlots}</div>
              <div class="craft-arrow">→</div>
              <div class="craft-result">제작</div>
            </div>
            <div class="panel-actions">
              <button data-mini-craft>제작</button>
              <button data-clear-craft>재료 빼기</button>
            </div>
            <div class="inventory-label">재료 선택</div>
            <div class="item-list item-slot-grid">${itemButtons || '<div class="empty-inventory">비어 있음</div>'}</div>
            <div class="ground-drop-zone" data-ground-drop>여기로 드래그하면 일반 아이템은 버리고 설치 아이템은 설치</div>
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
  panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onCraftSlotClick(Number(button.dataset.craftSlot)));
  });
  panelEl.querySelector<HTMLButtonElement>("[data-mini-craft]")?.addEventListener("click", callbacks.onMiniCraft);
  panelEl.querySelector<HTMLButtonElement>("[data-clear-craft]")?.addEventListener("click", callbacks.onClearCraft);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-build-house]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onBuildHouse(button.dataset.buildHouse ?? ""));
  });
  callbacks.bindDragDrop();
}
