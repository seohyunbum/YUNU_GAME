export interface LoadGameSlotView {
  id: string;
  label: string;
  summary: string;
  objectCount: number;
  mountainCount: number;
}

export interface LoadGamePanelCallbacks {
  onClose: () => void;
  onLoad: (slotId: string) => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLoadGamePanel(
  panelEl: HTMLElement,
  saves: LoadGameSlotView[],
  callbacks: LoadGamePanelCallbacks,
) {
  panelEl.innerHTML = `
      <section class="panel load-panel">
        <header>
          <div>
            <h2>저장 파일 불러오기</h2>
            <p class="inventory-subtitle">${saves.length > 0 ? "불러올 시점을 선택하세요. 선택하면 그 저장 시점부터 이어서 플레이합니다." : "아직 불러올 저장 파일이 없습니다."}</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        ${
          saves.length > 0
            ? `<div class="save-list">
                ${saves
                  .map(
                    (slot, index) => `<article class="save-card">
                      <div>
                        <strong>${index === 0 ? "최근 저장" : `저장 ${index + 1}`} · ${escapeHtml(slot.label)}</strong>
                        <p>${escapeHtml(slot.summary)}</p>
                        <small>저장된 오브젝트 ${slot.objectCount}개 · 지형 ${slot.mountainCount}개</small>
                      </div>
                      <button data-load-slot-index="${index}">불러오기</button>
                    </article>`,
                  )
                  .join("")}
              </div>`
            : `<div class="empty-inventory">저장 버튼을 눌러 진행 상황을 먼저 저장하세요.</div>`
        }
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-load-slot-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.loadSlotIndex);
      if (!Number.isInteger(index)) return;
      const slot = saves[index];
      if (slot) callbacks.onLoad(slot.id);
    });
  });
}
