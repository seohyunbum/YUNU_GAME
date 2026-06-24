// 세이브 슬롯이 가득 찼을 때 — 어느 저장을 덮어쓸지 직접 고르는 패널.
export interface SaveOverwriteSlotView {
  id: string;
  label: string;
  summary: string;
}

export interface SaveOverwritePanelCallbacks {
  onOverwrite: (slotId: string) => void;
  onClose: () => void;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderSaveOverwritePanel(panelEl: HTMLElement, slots: SaveOverwriteSlotView[], callbacks: SaveOverwritePanelCallbacks) {
  panelEl.innerHTML = `
      <section class="panel load-panel">
        <header>
          <div>
            <h2>저장 공간이 가득 찼습니다</h2>
            <p class="inventory-subtitle">저장 슬롯은 최대 ${slots.length}개입니다. 덮어쓸 저장을 선택하세요. 선택한 저장은 사라집니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="save-list">
          ${slots
            .map(
              // 모든 슬롯에 번호(저장 N)를 표기하고, index 0 은 가장 최근 저장이라 '최근 저장'을 병행 표기한다.
              (slot, index) => `<article class="save-card">
                <div>
                  <strong>저장 ${index + 1}${index === 0 ? " · 최근 저장" : ""} · ${escapeHtml(slot.label)}</strong>
                  <p>${escapeHtml(slot.summary)}</p>
                </div>
                <button data-overwrite-slot="${escapeHtml(slot.id)}">여기에 덮어쓰기</button>
              </article>`,
            )
            .join("")}
        </div>
      </section>
  `;
  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-overwrite-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onOverwrite(button.dataset.overwriteSlot ?? ""));
  });
}
