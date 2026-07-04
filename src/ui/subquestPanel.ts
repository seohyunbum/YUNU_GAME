// 서브퀘스트 패널 — 퀘스트 카드(.objective) 아래. 레벨 20+ 에서만 노출.
// leaf: main.ts import 금지. game/subquests 의 순수 포매터/메타만 참조. 상태를 받아 markup 렌더(입력 처리는 위임).
import {
  SUBQUEST_MIN_LEVEL,
  RARITY_META,
  subquestTitle,
  canRefreshSubquests,
  refreshCooldownRemainingMs,
  type SubquestState,
  type SubquestDef,
} from "../game/subquests";

function esc(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function rarityStyle(def: SubquestDef): string {
  const m = RARITY_META[def.rarity];
  return `background:${m.bg};border-color:${m.border};color:${m.text};`;
}

function choiceCard(def: SubquestDef, index: number, names: Record<string, string>): string {
  const m = RARITY_META[def.rarity];
  return (
    `<button type="button" class="subquest-card" data-subquest-pick="${index}" style="${rarityStyle(def)}">` +
    `<span class="subquest-rarity" style="color:${m.border}">${m.label}</span>` +
    `<strong>${esc(subquestTitle(def, names))}</strong>` +
    `<span class="subquest-reward">🎁 ${esc(def.reward.label)}</span>` +
    `</button>`
  );
}

function selectedCard(state: SubquestState, names: Record<string, string>): string {
  const def = state.selected!;
  const m = RARITY_META[def.rarity];
  const pct = Math.round((Math.min(state.progress, def.target) / def.target) * 100);
  const done = state.progress >= def.target;
  return (
    `<div class="subquest-card subquest-active" style="${rarityStyle(def)}">` +
    `<span class="subquest-rarity" style="color:${m.border}">${m.label}</span>` +
    `<strong>${esc(subquestTitle(def, names))}</strong>` +
    `<span class="subquest-progress-text">${done ? "✅ 완료 — 보상 지급!" : `진행 ${Math.min(state.progress, def.target)}/${def.target}`}</span>` +
    `<span class="subquest-bar"><i style="width:${pct}%;background:${m.border}"></i></span>` +
    `<span class="subquest-reward">🎁 ${esc(def.reward.label)}</span>` +
    `<button type="button" class="subquest-abandon" data-subquest-abandon>선택 미션 포기</button>` +
    `</div>`
  );
}

// state 를 받아 el.innerHTML 갱신. 레벨 미달이면 숨김.
export function renderSubquestPanel(el: HTMLElement, state: SubquestState, names: Record<string, string>, now: number, level: number): void {
  if (level < SUBQUEST_MIN_LEVEL || !state.choices) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  let body: string;
  if (state.selected) {
    body = selectedCard(state, names);
  } else {
    const cards = state.choices.map((def, i) => choiceCard(def, i, names)).join("");
    const canRefresh = canRefreshSubquests(now, state.lastRefreshEpoch);
    const remainSec = Math.ceil(refreshCooldownRemainingMs(now, state.lastRefreshEpoch) / 1000);
    const refreshLabel = canRefresh ? "🔄 새로고침" : `🔄 새로고침 (${Math.floor(remainSec / 60)}:${String(remainSec % 60).padStart(2, "0")})`;
    body =
      `<div class="subquest-choices">${cards}</div>` +
      `<button type="button" class="subquest-refresh" data-subquest-refresh ${canRefresh ? "" : "disabled"}>${refreshLabel}</button>`;
  }
  el.innerHTML = `<div class="subquest-title">🎯 서브 퀘스트</div>${body}`;
}
