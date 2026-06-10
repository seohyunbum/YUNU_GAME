export interface LoadGameSlotView {
  id: string;
  label: string;
  summary: string;
  objectCount?: number;
  mountainCount?: number;
}

export interface LoadGamePanelCallbacks {
  onClose: () => void;
  onLoad: (slotId: string) => void;
  // 파일 백업 — 브라우저 데이터가 지워져도 진행을 지킬 수 있게 한다
  onExportSave: () => Promise<object | null>;
  onImportSave: (save: object) => void;
}

function downloadJson(fileName: string, data: object) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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
          <div class="save-file-actions">
            <button data-export-save>파일로 백업</button>
            <button data-import-save>파일 가져오기</button>
            <button class="icon-button" data-close>닫기</button>
          </div>
        </header>
        <input type="file" accept=".json,application/json" data-import-input style="display:none" />
        ${
          saves.length > 0
            ? `<div class="save-list">
                ${saves
                  .map(
                    (slot, index) => `<article class="save-card">
                      <div>
                        <strong>${index === 0 ? "최근 저장" : `저장 ${index + 1}`} · ${escapeHtml(slot.label)}</strong>
                        <p>${escapeHtml(slot.summary)}</p>
                        ${slot.objectCount !== undefined ? `<small>저장된 오브젝트 ${slot.objectCount}개 · 지형 ${slot.mountainCount ?? 0}개</small>` : ""}
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
  panelEl.querySelector<HTMLButtonElement>("[data-export-save]")?.addEventListener("click", () => {
    void callbacks.onExportSave().then((save) => {
      if (save) downloadJson("야생마을-세이브.json", save);
    });
  });
  const importInput = panelEl.querySelector<HTMLInputElement>("[data-import-input]");
  panelEl.querySelector<HTMLButtonElement>("[data-import-save]")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => callbacks.onImportSave(JSON.parse(text) as object));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-load-slot-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.loadSlotIndex);
      if (!Number.isInteger(index)) return;
      const slot = saves[index];
      if (!slot) return;
      // 복원이 수 초 걸린다 — 클릭 즉시 전체 버튼을 잠그고 진행 중임을 표시해 중복 클릭을 막는다.
      panelEl.querySelectorAll<HTMLButtonElement>("[data-load-slot-index]").forEach((other) => {
        other.disabled = true;
      });
      button.textContent = "불러오는 중…";
      button.classList.add("loading");
      callbacks.onLoad(slot.id);
    });
  });
}
