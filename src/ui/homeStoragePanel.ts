import { itemTier } from "../game/items";

export interface HomeStorageSlotView {
  label: string;
  count: number;
  empty: boolean;
  item: string | null;
}

export interface HomeStoragePanelView {
  storage: HomeStorageSlotView[];
  inventory: HomeStorageSlotView[];
}

export interface HomeStoragePanelCallbacks {
  onClose: () => void;
  onTake: (storageIndex: number) => void;
  onStore: (inventoryIndex: number) => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCell(slot: HomeStorageSlotView, attr: string, index: number) {
  const label = slot.empty ? "" : `<span class="slot-name">${escapeHtml(slot.label)}</span><span class="slot-count">${slot.count}</span>`;
  const tier = slot.empty || !slot.item ? "" : ` tier-${itemTier(slot.item)}`;
  return `<button class="craft-slot inventory-cell${tier}" ${attr}="${index}" ${slot.empty ? "disabled" : ""}>${label}</button>`;
}

export function renderHomeStoragePanel(
  panelEl: HTMLElement,
  view: HomeStoragePanelView,
  callbacks: HomeStoragePanelCallbacks,
) {
  const storageCells = view.storage.map((slot, index) => renderCell(slot, "data-storage-slot", index)).join("");
  const inventoryCells = view.inventory.map((slot, index) => renderCell(slot, "data-carry-slot", index)).join("");
  panelEl.innerHTML = `
      <section class="panel home-storage-panel">
        <header>
          <div>
            <h2>집 창고</h2>
            <p class="inventory-subtitle">집에만 있는 개인 보관함입니다. 칸을 클릭하면 인벤토리와 창고 사이를 오갑니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="home-storage-layout">
          <section>
            <div class="inventory-label">창고 (클릭하면 인벤토리로)</div>
            <div class="item-slot-grid home-storage-grid">${storageCells}</div>
          </section>
          <section>
            <div class="inventory-label">내 인벤토리 (클릭하면 창고로)</div>
            <div class="item-slot-grid home-storage-grid">${inventoryCells}</div>
          </section>
        </div>
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-storage-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onTake(Number(button.dataset.storageSlot)));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-carry-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onStore(Number(button.dataset.carrySlot)));
  });
}
