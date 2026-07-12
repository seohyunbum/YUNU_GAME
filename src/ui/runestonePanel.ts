// 마석 장착 전용 창 — leaf(main.ts import 금지, view model + 콜백만).
// 슬롯 그리드(14칸, 잠긴 칸은 열쇠로 해금) + 보유 마석(클릭해 장착) + 조합(하위 3→상위 1) + 합산 버프 요약.
import { initItemTooltips } from "./itemTooltip";

export interface RuneSlotView {
  index: number;
  unlocked: boolean;
  item: string | null; // 장착된 마석 id(없으면 null)
  itemName: string;
  itemDesc: string; // "힘 +12" 등 짧은 표기
  color: string; // 종류 색(빈칸/잠금은 회색)
  unlockCost: number | null; // 이 칸을 열기 위한 열쇠 수(잠긴 '다음' 칸에만 표시)
  canUnlock: boolean; // 열쇠 충분 + 바로 다음 잠금 칸
}
export interface RuneOwnedView {
  item: string;
  name: string;
  desc: string;
  color: string;
  count: number;
  canEquip: boolean; // 빈 슬롯 존재
}
export interface RuneComboView {
  item: string; // 재료(하위) id
  name: string;
  outputName: string;
  color: string;
  have: number;
  need: number;
}
export interface RunestonePanelView {
  slots: RuneSlotView[];
  keys: number; // 보유 마석열쇠 수
  unlockedCount: number;
  maxSlots: number;
  owned: RuneOwnedView[];
  combos: RuneComboView[];
  bonusLines: string[]; // 현재 합산 버프 요약("공격력 +24" 등)
}
export interface RunestonePanelCallbacks {
  onUnlockSlot(): void;
  onEquip(item: string): void; // 첫 빈 슬롯에 장착
  onUnequip(slotIndex: number): void;
  onCombine(item: string): void; // 재료 3개 소비 → 상위 1개
  onClose(): void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

export function renderRunestonePanelView(panelEl: HTMLElement, view: RunestonePanelView, callbacks: RunestonePanelCallbacks): void {
  const slotCells = view.slots
    .map((s) => {
      if (!s.unlocked) {
        const lock = s.unlockCost !== null
          ? `<button class="rune-slot-unlock${s.canUnlock ? " ready" : ""}" data-unlock="${s.canUnlock ? "1" : ""}" ${s.canUnlock ? "" : "disabled"}>🔒<br><span>열쇠 ${s.unlockCost}</span></button>`
          : `<div class="rune-slot-lockedfar">🔒</div>`;
        return `<div class="rune-slot locked">${lock}</div>`;
      }
      if (!s.item) return `<div class="rune-slot empty" title="비어 있음"><span class="rune-slot-plus">＋</span></div>`;
      return `<button class="rune-slot filled" data-unequip="${s.index}" data-item="${escapeHtml(s.item)}" style="--rc:${s.color}" title="클릭하면 해제">
          <span class="rune-slot-gem"></span>
          <span class="rune-slot-name">${escapeHtml(s.itemName)}</span>
          <span class="rune-slot-desc">${escapeHtml(s.itemDesc)}</span>
        </button>`;
    })
    .join("");

  const ownedCards = view.owned.length === 0
    ? `<p class="rune-empty-note">보유한 마석이 없습니다. 상자·사냥·요새 보상에서 낮은 확률로 얻을 수 있어요.</p>`
    : view.owned
        .map((o) => `<button class="rune-owned${o.canEquip ? "" : " full"}" data-equip="${escapeHtml(o.item)}" data-item="${escapeHtml(o.item)}" style="--rc:${o.color}" ${o.canEquip ? "" : "disabled"} title="${o.canEquip ? "클릭해 장착" : "빈 슬롯 없음"}">
            <span class="rune-owned-gem"></span>
            <span class="rune-owned-name">${escapeHtml(o.name)}${o.count > 1 ? ` ×${o.count}` : ""}</span>
            <span class="rune-owned-desc">${escapeHtml(o.desc)}</span>
          </button>`)
        .join("");

  const comboCards = view.combos.length === 0
    ? `<p class="rune-empty-note">같은 종류의 마석이 3개 모이면 상위 등급으로 조합할 수 있어요.</p>`
    : view.combos
        .map((c) => `<button class="rune-combo" data-combine="${escapeHtml(c.item)}" style="--rc:${c.color}" title="${escapeHtml(c.name)} 3개 → ${escapeHtml(c.outputName)} 1개">
            <span>${escapeHtml(c.name)} <b>${c.have}/${c.need}</b></span>
            <span class="rune-combo-arrow">→ ${escapeHtml(c.outputName)}</span>
          </button>`)
        .join("");

  panelEl.innerHTML = `
      <section class="panel runestone-panel">
        <header>
          <div>
            <h2>🔮 마석</h2>
            <p class="inventory-subtitle">슬롯 ${view.unlockedCount}/${view.maxSlots} 해금 · 🔑 마석열쇠 ${view.keys}개</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="rune-body">
          <div class="rune-slots-wrap">
            <div class="inventory-label">장착 슬롯 (클릭해 해제)</div>
            <div class="rune-slot-grid">${slotCells}</div>
            ${view.bonusLines.length ? `<div class="rune-bonus-summary">현재 버프 — ${view.bonusLines.map(escapeHtml).join(" · ")}</div>` : `<div class="rune-bonus-summary muted">장착한 마석이 없습니다.</div>`}
          </div>
          <div class="rune-owned-wrap">
            <div class="inventory-label">보유 마석 (클릭해 장착)</div>
            <div class="rune-owned-grid">${ownedCards}</div>
            <div class="inventory-label" style="margin-top:10px;">조합 (하위 3개 → 상위 1개)</div>
            <div class="rune-combo-grid">${comboCards}</div>
          </div>
        </div>
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelector<HTMLButtonElement>("[data-unlock='1']")?.addEventListener("click", callbacks.onUnlockSlot);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.equip) callbacks.onEquip(b.dataset.equip); }));
  panelEl.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.unequip); if (Number.isInteger(i)) callbacks.onUnequip(i); }));
  panelEl.querySelectorAll<HTMLButtonElement>("[data-combine]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.combine) callbacks.onCombine(b.dataset.combine); }));
  initItemTooltips();
}
