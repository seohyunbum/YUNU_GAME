export interface LoadGameSlotView {
  id: string;
  label: string;
  summary: string;
  // 요약이 없는 구버전 압축 슬롯 — 렌더 후 비동기로 요약을 채워 넣는다
  needsSummary?: boolean;
  objectCount?: number;
  mountainCount?: number;
}

export interface HistoryEntryView {
  savedAt: string;
  label: string;
  summary: string;
}

export interface LoadGamePanelCallbacks {
  onClose: () => void;
  onLoad: (slotId: string) => void;
  // 파일 백업 — 브라우저 데이터가 지워져도 진행을 지킬 수 있게 한다
  onExportSave: () => Promise<object | null>;
  onImportSave: (save: object) => void;
  onResolveSummary?: (slotId: string) => Promise<string | null>;
  // 자동 백업 이력(닉네임별 최신 15개) 복구
  onShowHistory?: () => HistoryEntryView[];
  onRecoverHistory?: (savedAt: string) => void;
  // 자동저장 슬롯(실수 이탈 대비) 복구 — 수동 저장과 별개의 독립 슬롯
  onShowAutosave?: () => HistoryEntryView[];
  onRecoverAutosave?: (savedAt: string) => void;
}

// 마지막 불러오기 실패 사유 — 패널이 다시 열릴 때 빨간 배너로 보여준다 (타이틀 화면에선 HUD 메시지가 가려지기 때문)
let pendingNotice: string | null = null;

export function setLoadPanelNotice(notice: string | null) {
  pendingNotice = notice;
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
            ${pendingNotice ? `<p class="load-panel-notice">⚠ ${escapeHtml(pendingNotice)}</p>` : ""}
          </div>
          <div class="save-file-actions">
            <button data-export-save>파일로 백업</button>
            <button data-import-save>파일 가져오기</button>
            ${callbacks.onShowAutosave ? `<button class="autosave-recover-button" data-show-autosave>자동저장 복구</button>` : ""}
            ${callbacks.onShowHistory ? `<button data-show-history>백업 이력</button>` : ""}
            <button class="icon-button" data-close>닫기</button>
          </div>
        </header>
        <input type="file" accept=".json,application/json" data-import-input style="display:none" />
        <div class="save-history" data-autosave-panel hidden></div>
        <div class="save-history" data-history-panel hidden></div>
        ${
          saves.length > 0
            ? `<div class="save-list">
                ${saves
                  .map(
                    (slot, index) => `<article class="save-card">
                      <div>
                        <strong>${index === 0 ? "최근 저장" : `저장 ${index + 1}`} · ${escapeHtml(slot.label)}</strong>
                        <p data-slot-summary="${index}">${escapeHtml(slot.needsSummary ? "요약 불러오는 중…" : slot.summary)}</p>
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
  const autosavePanel = panelEl.querySelector<HTMLElement>("[data-autosave-panel]");
  panelEl.querySelector<HTMLButtonElement>("[data-show-autosave]")?.addEventListener("click", () => {
    if (!autosavePanel || !callbacks.onShowAutosave) return;
    if (!autosavePanel.hidden) { autosavePanel.hidden = true; return; }
    const entries = callbacks.onShowAutosave();
    autosavePanel.innerHTML = entries.length === 0
      ? `<p class="inventory-subtitle">자동저장이 아직 없습니다. 게임 도중·이탈 시 자동으로 별도 슬롯에 저장됩니다.</p>`
      : `<p class="inventory-subtitle">자동저장 (실수로 나갔을 때 대비) — <strong>직접 저장한 파일을 덮어쓰지 않는 별도 슬롯</strong>입니다. 직전 진행 시점부터 이어서 플레이할 수 있습니다.</p>` +
        entries
          .map(
            (entry) => `<article class="save-card save-autosave-card">
              <div><strong>${escapeHtml(entry.label)}</strong><p>${escapeHtml(entry.summary)}</p></div>
              <button data-recover-autosave="${escapeHtml(entry.savedAt)}">이 자동저장으로 이어하기</button>
            </article>`,
          )
          .join("");
    autosavePanel.hidden = false;
    autosavePanel.querySelectorAll<HTMLButtonElement>("[data-recover-autosave]").forEach((button) => {
      button.addEventListener("click", () => {
        const savedAt = button.dataset.recoverAutosave;
        if (!savedAt || !callbacks.onRecoverAutosave) return;
        autosavePanel.querySelectorAll<HTMLButtonElement>("[data-recover-autosave]").forEach((other) => { other.disabled = true; });
        button.textContent = "불러오는 중…";
        callbacks.onRecoverAutosave(savedAt);
      });
    });
  });
  const historyPanel = panelEl.querySelector<HTMLElement>("[data-history-panel]");
  panelEl.querySelector<HTMLButtonElement>("[data-show-history]")?.addEventListener("click", () => {
    if (!historyPanel || !callbacks.onShowHistory) return;
    if (!historyPanel.hidden) { historyPanel.hidden = true; return; }
    const entries = callbacks.onShowHistory();
    historyPanel.innerHTML = entries.length === 0
      ? `<p class="inventory-subtitle">자동 백업이 아직 없습니다. 저장할 때마다 최신 15개까지 자동 보관됩니다.</p>`
      : `<p class="inventory-subtitle">자동 백업 (닉네임별 최신 15개) — 잘못 덮어썼을 때 과거 시점으로 되돌릴 수 있습니다.</p>` +
        entries
          .map(
            (entry) => `<article class="save-card save-history-card">
              <div><strong>${escapeHtml(entry.label)}</strong><p>${escapeHtml(entry.summary)}</p></div>
              <button data-recover-history="${escapeHtml(entry.savedAt)}">이 시점으로 복구</button>
            </article>`,
          )
          .join("");
    historyPanel.hidden = false;
    historyPanel.querySelectorAll<HTMLButtonElement>("[data-recover-history]").forEach((button) => {
      button.addEventListener("click", () => {
        const savedAt = button.dataset.recoverHistory;
        if (!savedAt || !callbacks.onRecoverHistory) return;
        historyPanel.querySelectorAll<HTMLButtonElement>("[data-recover-history]").forEach((other) => { other.disabled = true; });
        button.textContent = "복구 중…";
        callbacks.onRecoverHistory(savedAt);
      });
    });
  });
  const importInput = panelEl.querySelector<HTMLInputElement>("[data-import-input]");
  panelEl.querySelector<HTMLButtonElement>("[data-import-save]")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => callbacks.onImportSave(JSON.parse(text) as object));
  });
  saves.forEach((slot, index) => {
    if (!slot.needsSummary || !callbacks.onResolveSummary) return;
    void callbacks.onResolveSummary(slot.id).then((summary) => {
      const summaryEl = panelEl.querySelector(`[data-slot-summary="${index}"]`);
      if (summaryEl && summary) summaryEl.textContent = summary;
    });
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
