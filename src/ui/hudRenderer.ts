import { ensureSkillBar, renderSkillBar, type SkillSlotView } from "./skillBar";
import { itemTier } from "../game/items";

export interface HudRenderElements {
  statsEl: HTMLElement;
  objectiveEl: HTMLElement;
  hotbarEl: HTMLElement;
}

export interface HudRenderCache {
  statsMarkup: string;
  objectiveMarkup: string;
  hotbarMarkup: string;
  skillBarEl: HTMLElement | null;
  skillBarSig: string;
}

export interface HudHotbarSlotView {
  label: string;
  item: string | null;
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
  craftLevel: number;
  craftXp: number;
  craftRequiredXp: number;
  craftStatPoints: number;
  skills: SkillSlotView[];
  passiveStatus: string;
  petStatus?: string;
  equipmentArmor: number;
  equippedGearLabel?: string;
  statBonus: number;
  eagleHp?: number;
  eagleMaxHp: number;
  eagleSkillStatus?: string;
  timeLabel: string;
  locationLabel: string;
  arcadePoints: number;
  totalSteps: number;
  objective: {
    title: string;
    detail: string;
    progress: string;
    reward: { label: string };
    completed: boolean;
  };
  selectedHotbarIndex: number;
  hotbar: HudHotbarSlotView[];
  buffs: { icon: string; name: string; secs: number; expiring: boolean; value?: string }[]; // value 있으면 시간 대신 그 문자열 표시(정령 등 상시 버프)
}

export function createHudRenderCache(): HudRenderCache {
  return {
    statsMarkup: "",
    objectiveMarkup: "",
    hotbarMarkup: "",
    skillBarEl: null,
    skillBarSig: "",
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
  const xpPercent = (xpRatio * 100).toFixed(1);
  const healthRatio = clamp01(view.health / Math.max(1, view.maxHealth));
  const manaRatio = clamp01(view.mana / Math.max(1, view.maxMana));
  const hungerRatio = clamp01(view.hunger / Math.max(1, view.maxHunger));
  const eagleMarkup =
    view.eagleHp === undefined
      ? ""
      : `<span>독수리 ${Math.ceil(view.eagleHp)}/${view.eagleMaxHp}</span>`;

  const buffMarkup = view.buffs.length === 0
    ? ""
    : `<div class="buff-bar">${view.buffs
        .map((b) => `<div class="buff-chip${b.expiring ? " buff-expiring" : ""}" title="${escapeHtml(b.name)}"><span class="buff-icon">${b.icon}</span><span class="buff-time">${b.value !== undefined ? escapeHtml(b.value) : b.secs >= 60 ? `${Math.ceil(b.secs / 60)}분` : `${b.secs}초`}</span></div>`)
        .join("")}</div>`;

  return `
      ${buffMarkup}
      <div class="stats-level-card" title="경험치 ${view.experience}/${view.requiredExperience}">
        <span>Lv</span>
        <strong class="${view.level >= 1000 ? "lv-digits-4" : view.level >= 100 ? "lv-digits-3" : ""}">${view.level}</strong>
        <em>${xpPercent}%</em>
      </div>
      <div class="stats-content">
        <div class="stats-heading">
          <span>${escapeHtml(view.className)}</span>
          <span>공격 ${view.attack}</span>
          <span>방어 ${view.armor}</span>
        </div>
        <div class="stat-bar health-bar">
          <span style="width: ${(healthRatio * 100).toFixed(1)}%"></span>
          <b>HP ${Math.ceil(view.health)} / ${view.maxHealth}</b>
        </div>
        <div class="stat-bar mana-bar">
          <span style="width: ${(manaRatio * 100).toFixed(1)}%"></span>
          <b>MP ${Math.floor(view.mana)} / ${view.maxMana}</b>
        </div>
        <div class="stats-sub-bars">
          <div class="stat-bar hunger-bar">
            <span style="width: ${(hungerRatio * 100).toFixed(1)}%${view.hunger <= 2 ? "; background:#e23b3b" : ""}"></span>
            <b>${view.hunger <= 2 ? "⚠️ " : ""}배고픔 ${Math.round(view.hunger)}/${view.maxHunger}</b>
          </div>
          <div class="stat-bar exp-bar">
            <span style="width: ${xpPercent}%"></span>
            <b>EXP ${view.experience}/${view.requiredExperience}</b>
          </div>
        </div>
        <div class="stat-bar craft-bar" title="제작 경험치 ${view.craftXp}/${view.craftRequiredXp}">
          <span style="width: ${(clamp01(view.craftXp / Math.max(1, view.craftRequiredXp)) * 100).toFixed(1)}%"></span>
          <b>🔨 제작 Lv ${view.craftLevel} · ${view.craftXp}/${view.craftRequiredXp}${view.craftStatPoints > 0 ? ` · 포인트 +${view.craftStatPoints} (K)` : ""}</b>
        </div>
        <div class="stats-detail">
          <span>패시브 ${escapeHtml(view.passiveStatus)}</span>
          ${view.petStatus ? `<span>${escapeHtml(view.petStatus)}</span>` : ""}
          <span>장비 방어 ${view.equipmentArmor}${view.equippedGearLabel ? ` · ${escapeHtml(view.equippedGearLabel)}` : ""}</span>
          <span>레벨 보너스 +${view.statBonus}</span>
          ${eagleMarkup}
          ${view.eagleSkillStatus ? `<span>${escapeHtml(view.eagleSkillStatus)}</span>` : ""}
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
      const tier = slot.item ? ` tier-${itemTier(slot.item)}` : "";
      return `<button class="slot${selected}${tier}" data-hotbar="${index}"><span>${index + 1}</span>${escapeHtml(slot.label)}</button>`;
    })
    .join("");
}

function renderObjectiveMarkup(view: HudViewModel) {
  const objective = view.objective;
  const doneClass = objective.completed ? " objective-ready" : "";
  return `
    <button class="objective-card${doneClass}" type="button" title="${escapeHtml(objective.detail)}">
      <span class="objective-head">
        <span class="objective-kicker">${objective.completed ? "🎁 보상 준비 완료!" : "📜 현재 퀘스트"}</span>
        <span class="objective-progress${objective.completed ? " done" : ""}">${objective.completed ? "✅ 완료" : escapeHtml(objective.progress)}</span>
      </span>
      <strong>${escapeHtml(objective.title)}</strong>
      <span class="objective-detail">🧭 ${escapeHtml(objective.detail)}</span>
      <span class="objective-reward">🎁 보상: ${escapeHtml(objective.reward.label)}</span>
      <span class="objective-action${objective.completed ? " ready" : ""}">
        <kbd>Q</kbd>
        <span class="objective-action-text">${objective.completed ? "눌러 보상 받기! (또는 클릭)" : "완료하면 Q로 보상 받기"}</span>
      </span>
    </button>
  `;
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

  const objectiveMarkup = renderObjectiveMarkup(view);
  if (cache.objectiveMarkup !== objectiveMarkup) {
    elements.objectiveEl.innerHTML = objectiveMarkup;
    cache.objectiveMarkup = objectiveMarkup;
  }

  const parent = elements.hotbarEl.parentElement;
  if (parent) {
    const skillBarEl = cache.skillBarEl ?? (cache.skillBarEl = ensureSkillBar(parent));
    const skillSig = view.skills.map((s) => `${s.icon}|${s.name}|${s.hotkey}|${s.total}|${s.until}`).join(";");
    if (cache.skillBarSig !== skillSig) {
      renderSkillBar(skillBarEl, view.skills);
      cache.skillBarSig = skillSig;
    }
  }

  const hotbarMarkup = renderHotbarMarkup(view);
  if (cache.hotbarMarkup === hotbarMarkup) return;
  elements.hotbarEl.innerHTML = hotbarMarkup;
  cache.hotbarMarkup = hotbarMarkup;

  elements.hotbarEl.querySelectorAll<HTMLButtonElement>("[data-hotbar]").forEach((button) => {
    button.addEventListener("click", () => onHotbarSelect(Number(button.dataset.hotbar)));
  });
}
