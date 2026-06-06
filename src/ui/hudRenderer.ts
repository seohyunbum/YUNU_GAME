export interface HudRenderElements {
  statsEl: HTMLElement;
  objectiveEl: HTMLElement;
  hotbarEl: HTMLElement;
}

export interface HudRenderCache {
  statsMarkup: string;
  objectiveText: string;
  hotbarMarkup: string;
}

export interface HudHotbarSlotView {
  label: string;
}

export interface HudViewModel {
  level: number;
  className: string;
  attack: number;
  armor: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  hunger: number;
  maxHunger: number;
  experience: number;
  requiredExperience: number;
  skillStatus: string;
  passiveStatus: string;
  petStatus?: string;
  equipmentArmor: number;
  statBonus: number;
  eagleHp?: number;
  eagleMaxHp: number;
  timeLabel: string;
  locationLabel: string;
  arcadePoints: number;
  totalSteps: number;
  objectiveText: string;
  selectedHotbarIndex: number;
  hotbar: HudHotbarSlotView[];
}

export function createHudRenderCache(): HudRenderCache {
  return {
    statsMarkup: "",
    objectiveText: "",
    hotbarMarkup: "",
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatsMarkup(view: HudViewModel) {
  const xpRatio = clamp01(view.experience / Math.max(1, view.requiredExperience));
  const healthRatio = clamp01(view.health / Math.max(1, view.maxHealth));
  const manaRatio = clamp01(view.mana / Math.max(1, view.maxMana));
  const hungerRatio = clamp01(view.hunger / Math.max(1, view.maxHunger));
  const eagleMarkup =
    view.eagleHp === undefined
      ? ""
      : `<span>독수리 ${Math.ceil(view.eagleHp)}/${view.eagleMaxHp}</span>`;

  return `
      <div class="xp-vertical" title="경험치 ${view.experience}/${view.requiredExperience}">
        <span style="height: ${(xpRatio * 100).toFixed(1)}%"></span>
      </div>
      <div class="stats-content">
        <div class="stats-heading">
          <strong>Lv ${view.level}</strong>
          <span>${escapeHtml(view.className)}</span>
          <span>공격 ${view.attack}</span>
          <span>방어 ${view.armor}</span>
        </div>
        <div class="stat-bar health-bar">
          <span style="width: ${(healthRatio * 100).toFixed(1)}%"></span>
          <b>체력 ${view.health}/${view.maxHealth}</b>
        </div>
        <div class="stat-bar mana-bar">
          <span style="width: ${(manaRatio * 100).toFixed(1)}%"></span>
          <b>마나 ${view.mana}/${view.maxMana}</b>
        </div>
        <div class="stat-bar hunger-bar">
          <span style="width: ${(hungerRatio * 100).toFixed(1)}%"></span>
          <b>배고픔 ${view.hunger}/${view.maxHunger}</b>
        </div>
        <div class="stats-detail">
          <span>EXP ${view.experience}/${view.requiredExperience}</span>
          <span>스킬 ${escapeHtml(view.skillStatus)}</span>
          <span>패시브 ${escapeHtml(view.passiveStatus)}</span>
          ${view.petStatus ? `<span>${escapeHtml(view.petStatus)}</span>` : ""}
          <span>장비 방어 ${view.equipmentArmor}</span>
          <span>레벨 보너스 +${view.statBonus}</span>
          ${eagleMarkup}
        </div>
        <div class="stats-detail muted">
          <span>${escapeHtml(view.timeLabel)}</span>
          <span>${escapeHtml(view.locationLabel)}</span>
          <span>${view.arcadePoints}P</span>
          <span>걸음 ${Math.floor(view.totalSteps)}</span>
        </div>
      </div>
    `;
}

function renderHotbarMarkup(view: HudViewModel) {
  return view.hotbar
    .map((slot, index) => {
      const selected = index === view.selectedHotbarIndex ? " selected" : "";
      return `<button class="slot${selected}" data-hotbar="${index}"><span>${index + 1}</span>${escapeHtml(slot.label)}</button>`;
    })
    .join("");
}

export function renderHudView(
  elements: HudRenderElements,
  cache: HudRenderCache,
  view: HudViewModel,
  onHotbarSelect: (index: number) => void,
) {
  const statsMarkup = renderStatsMarkup(view);
  if (cache.statsMarkup !== statsMarkup) {
    elements.statsEl.innerHTML = statsMarkup;
    cache.statsMarkup = statsMarkup;
  }

  if (cache.objectiveText !== view.objectiveText) {
    elements.objectiveEl.textContent = view.objectiveText;
    cache.objectiveText = view.objectiveText;
  }

  const hotbarMarkup = renderHotbarMarkup(view);
  if (cache.hotbarMarkup === hotbarMarkup) return;
  elements.hotbarEl.innerHTML = hotbarMarkup;
  cache.hotbarMarkup = hotbarMarkup;

  elements.hotbarEl.querySelectorAll<HTMLButtonElement>("[data-hotbar]").forEach((button) => {
    button.addEventListener("click", () => onHotbarSelect(Number(button.dataset.hotbar)));
  });
}
