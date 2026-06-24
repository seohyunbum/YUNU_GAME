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
            <p class="inventory-subtitle">저장 슬롯은 최대 ${slots.length}개입니다. 덮어쓸 저장을 선택하세요. 선택한 저장은 사라집니다. <strong>맨 위 '최신 저장'은 자동 동기화 슬롯이라 덮어쓸 수 없습니다.</strong></p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="save-list">
          ${slots
            .map((slot, index) => {
              // index 0 = 가장 최근 저장 = 자동 동기화되는 '최신 저장' 슬롯. 실수로 덮어써 최신본을 잃지 않도록 선택 불가.
              // (슬롯이 1개뿐이면 보호하지 않는다 — 그러면 덮어쓸 대상이 하나도 없어진다.)
              const locked = index === 0 && slots.length > 1;
              return `<article class="save-card${locked ? " save-card-locked" : ""}">
                <div>
                  <strong>${index === 0 ? "최신 저장 (자동 동기화)" : `저장 ${index + 1}`} · ${escapeHtml(slot.label)}</strong>
                  <p>${escapeHtml(slot.summary)}</p>
                </div>
                ${locked
                  ? `<button disabled title="최신 저장은 자동 동기화 슬롯이라 덮어쓸 수 없습니다">덮어쓰기 불가</button>`
                  : `<button data-overwrite-slot="${escapeHtml(slot.id)}">여기에 덮어쓰기</button>`}
              </article>`;
            })
            .join("")}
        </div>
      </section>
  `;
  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-overwrite-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onOverwrite(button.dataset.overwriteSlot ?? ""));
  });
}
