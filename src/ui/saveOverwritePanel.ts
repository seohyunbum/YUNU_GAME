// 세이브 슬롯이 가득 찼을 때 — 어느 저장을 덮어쓸지 직접 고르는 패널.
export interface SaveOverwriteSlotView {
  id: string;
  savedAt: string;
  label: string;
  summary: string;
}

// 가장 최근 저장(=max savedAt) 슬롯의 인덱스. 슬롯 번호는 위치 고정이고 '최근 저장' 표식만 이 슬롯에 붙는다.
// (예: 4번 슬롯에 덮어쓰면 그 슬롯이 최신본이므로 '저장 4 · 최근 저장'.)
function mostRecentIndex(slots: { savedAt: string }[]): number {
  let best = -1;
  for (let i = 0; i < slots.length; i += 1) if (best < 0 || slots[i].savedAt > slots[best].savedAt) best = i;
  return best;
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
          ${(() => {
            const recent = mostRecentIndex(slots);
            // 슬롯 번호는 위치 고정(저장 N) — 불러오기 패널과 동일 순서. '최근 저장'은 실제 최신본 슬롯에만 병행 표기.
            return slots
              .map(
                (slot, index) => `<article class="save-card">
                <div>
                  <strong>저장 ${index + 1}${index === recent ? " · 최근 저장" : ""} · ${escapeHtml(slot.label)}</strong>
                  <p>${escapeHtml(slot.summary)}</p>
                </div>
                <button data-overwrite-slot="${escapeHtml(slot.id)}">여기에 덮어쓰기</button>
              </article>`,
              )
              .join("");
          })()}
        </div>
      </section>
  `;
  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-overwrite-slot]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onOverwrite(button.dataset.overwriteSlot ?? ""));
  });
}
