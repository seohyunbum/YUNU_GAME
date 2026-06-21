import { itemTier, PLACEABLE_TYPES } from "../game/items";
import { initItemTooltips } from "./itemTooltip";

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

export interface HouseBuildOptionView {
  id: string;
  name: string;
  description: string;
  ingredients: { label: string; short: boolean }[];
  canBuild: boolean;
}

export interface InventoryRecipeGuideView {
  id: string;
  name: string;
  stationKey?: string;
  station: string;
  outputLabel: string;
  ingredients: { label: string; short: boolean }[];
  note: string;
  canMake: boolean;
  searchText: string;
}

export interface InventoryPanelView {
  hotbarCount: number;
  hotbar: InventorySlotView[];
  bagLabel: string;
  bagSlots: InventorySlotView[];
  craftSlots: InventorySlotView[];
  houseBuildOptions: HouseBuildOptionView[];
  recipeGuide: InventoryRecipeGuideView[];
}

export interface InventoryPanelCallbacks {
  onClose: () => void;
  onCraftSlotClick: (index: number) => void;
  onMiniCraft: () => void;
  onClearCraft: () => void;
  onBuildHouse: (id: string) => void;
  onCraftGuide: (recipeId: string) => void;
  onSortBag: () => void;
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
  const tier = slot.item ? ` tier-${itemTier(slot.item)}` : "";
  const infoAttr = slot.item ? ` data-item="${escapeAttr(slot.item)}"` : "";
  const placeable = slot.item && PLACEABLE_TYPES[slot.item as keyof typeof PLACEABLE_TYPES] ? " placeable-slot" : "";
  const badge = placeable ? `<span class="placeable-badge" title="우클릭하면 바닥에 설치됩니다">설치</span>` : "";
  const content = slot.item
    ? `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>${badge}`
    : "";
  return `<div class="mini-slot inventory-cell${slot.extraClass ?? ""}${moveSelected}${tier}${placeable}"${sourceAttrs}${dragAttrs}${infoAttr}>${content}</div>`;
}

function renderCraftSlot(slot: InventorySlotView, index: number) {
  const label = slot.item
    ? `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>`
    : "";
  const dragAttrs = slot.item
    ? ` draggable="true" data-drop-item="${escapeAttr(slot.item)}" data-slot-source="craft" data-slot-index="${index}"`
    : "";
  const tier = slot.item ? ` tier-${itemTier(slot.item)}` : "";
  const infoAttr = slot.item ? ` data-item="${escapeAttr(slot.item)}"` : "";
  return `<button class="craft-slot inventory-cell${tier}" data-craft-slot="${index}"${dragAttrs}${infoAttr}>${label}</button>`;
}

// 부족한 재료는 빨간 "보유/필요" 로 — 클릭해보지 않아도 뭐가 몇 개 모자란지 보인다
function renderIngredientCounts(ingredients: { label: string; short: boolean }[]) {
  return ingredients.map((entry) => `<span${entry.short ? ' class="ing-short"' : ""}>${escapeHtml(entry.label)}</span>`).join(" + ");
}

function renderHouseBuildOption(option: HouseBuildOptionView) {
  const disabled = option.canBuild ? "" : "disabled";
  return `<article class="recipe-card house-build-card">
        <div>
          <strong>${escapeHtml(option.name)}</strong>
          <p>${escapeHtml(option.description)}</p>
          <small>${renderIngredientCounts(option.ingredients)}</small>
        </div>
        <button data-build-house="${escapeAttr(option.id)}" ${disabled}>집짓기</button>
      </article>`;
}

function renderRecipeGuideCard(recipe: InventoryRecipeGuideView) {
  const status = recipe.canMake ? "만들기" : "재료 부족";
  const statusClass = recipe.canMake ? " ready" : "";
  return `<article class="recipe-card recipe-guide-card${statusClass}" data-recipe-search-text="${escapeAttr(recipe.searchText)}">
        <div>
          <strong>${escapeHtml(recipe.name)}</strong>
          <p>${escapeHtml(recipe.station)} · 결과: ${escapeHtml(recipe.outputLabel)}</p>
          <small>재료: ${renderIngredientCounts(recipe.ingredients)}</small>
          <small>${escapeHtml(recipe.note)}</small>
        </div>
        <button class="recipe-guide-status" data-craft-guide="${escapeAttr(recipe.id)}" ${recipe.canMake ? "" : "disabled"}>${status}</button>
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
  const recipeGuide = view.recipeGuide.map(renderRecipeGuideCard).join("");

  // 인벤토리 패널은 항상 2x2 미니 제작 — 설치한 제작대의 3x3는 별도 패널(workbenchPanel). 초보가 "왜 또 만들지?"를 헷갈리지 않게 차이를 설명.
  const craftLabel = "미니 제작대 2x2 — 어디서나";
  const craftNote = "제작대·삽·막대기 등 기본 아이템을 어디서나 만들 수 있어요. 제작대를 만들어 바닥에 설치하면 더 큰 3x3 제작대가 열립니다.";

  // 가방 부족 경고 — 시작 8칸은 금방 차서 새 전리품을 못 줍는다 → 가방 제작으로 유도
  const bagCapacity = view.bagSlots.filter((s) => !s.locked).length;
  const bagFilled = view.bagSlots.filter((s) => s.item).length;
  const smallBag = bagCapacity > 0 && bagCapacity <= 8;
  const bagUrgent = smallBag && bagFilled >= bagCapacity - 1;
  const bagHint = smallBag
    ? `<div class="bag-hint-bar${bagUrgent ? " urgent" : ""}">${bagUrgent ? "⚠️ 가방이 거의 찼어요" : "🎒 가방이 작아요"} (${bagFilled}/${bagCapacity}칸) — 가죽 7개로 가방을 만들면 <b>8 → 40칸</b>으로 늘어납니다. 가득 차면 새 전리품을 못 줍습니다.</div>`
    : "";

  panelEl.innerHTML = `
      <section class="panel inventory-panel inventory-panel-v2">
        <header>
          <div>
            <h2>인벤토리</h2>
            <p class="inventory-subtitle">아이템을 클릭해 고른 뒤 제작칸을 누르거나, 칸으로 드래그해 넣으세요. 다른 칸을 누르면 위치가 바뀝니다. 우클릭 = 설치/버리기.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="inv2-layout">
          <section class="inventory-board inv2-bag">
            <div class="inventory-label">핫바 ${view.hotbarCount}칸</div>
            <div class="inventory-hotbar inventory-grid">${hotbar}</div>
            <div class="inventory-label">가방 ${escapeHtml(view.bagLabel)}<button class="bag-sort-btn" data-sort-bag title="무기·도구/설치물·소비·재료별로 묶고 등급 오름차순 정렬 (제련대·제작대·침대 등 사용가능 도구는 한 묶음, 가방만)">↕ 자동정렬</button></div>
            ${bagHint}
            <div class="bag-grid inventory-grid">${bagGrid}</div>
          </section>

          <aside class="inv2-side">
            <section class="craft-board">
              <div class="inventory-label">${escapeHtml(craftLabel)}</div>
              <p class="craft-note">${escapeHtml(craftNote)}</p>
              <div class="crafting-flow">
                <div class="craft-grid inventory-craft-grid">${craftSlots}</div>
                <div class="craft-arrow">→</div>
                <div class="craft-result">제작</div>
              </div>
              <div class="panel-actions">
                <button data-mini-craft>제작</button>
                <button data-clear-craft>재료 빼기</button>
              </div>
            </section>
            <section class="craft-board recipe-guide-panel">
              <div class="inventory-label">제작 검색 — 이 세계의 모든 제작 아이템</div>
              <input class="recipe-search-input" data-recipe-search type="search" placeholder="아이템, 재료, 제작 장소 검색" autocomplete="off" />
              <div class="recipe-search-list" data-recipe-search-list>${recipeGuide}</div>
              <div class="recipe-search-empty hidden" data-recipe-search-empty>검색 결과가 없습니다.</div>
            </section>
            <section class="craft-board house-build-panel">
              <div class="inventory-label">집짓기</div>
              <div class="recipes house-build-list">${buildOptions}</div>
            </section>
          </aside>
        </div>
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelector<HTMLButtonElement>("[data-sort-bag]")?.addEventListener("click", callbacks.onSortBag);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onCraftSlotClick(Number(button.dataset.craftSlot)));
  });
  panelEl.querySelector<HTMLButtonElement>("[data-mini-craft]")?.addEventListener("click", callbacks.onMiniCraft);
  panelEl.querySelector<HTMLButtonElement>("[data-clear-craft]")?.addEventListener("click", callbacks.onClearCraft);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-build-house]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onBuildHouse(button.dataset.buildHouse ?? ""));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-guide]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onCraftGuide(button.dataset.craftGuide ?? ""));
  });
  const searchInput = panelEl.querySelector<HTMLInputElement>("[data-recipe-search]");
  const recipeCards = [...panelEl.querySelectorAll<HTMLElement>("[data-recipe-search-text]")];
  const emptyMessage = panelEl.querySelector<HTMLElement>("[data-recipe-search-empty]");
  const applyRecipeFilter = () => {
    const query = (searchInput?.value ?? "").trim().toLowerCase();
    let visibleCount = 0;
    for (const card of recipeCards) {
      const matched = query.length === 0 || (card.dataset.recipeSearchText ?? "").includes(query);
      card.classList.toggle("hidden", !matched);
      if (matched) visibleCount += 1;
    }
    emptyMessage?.classList.toggle("hidden", visibleCount > 0);
  };
  searchInput?.addEventListener("input", applyRecipeFilter);
  applyRecipeFilter();
  initItemTooltips();
  callbacks.bindDragDrop();
}
