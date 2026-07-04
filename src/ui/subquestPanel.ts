// 서브퀘스트 패널 — 퀘스트 카드(.objective) 아래. 레벨 20+ 에서만 노출.
// 두 모드: 평상시(passive)=진행 상태 읽기전용, 이장 대화중(dialogOpen)=선택/새로고침/포기/보상수령 인터랙티브.
// leaf: main.ts import 금지. game/subquests 의 순수 포매터/메타만 참조. 상태를 받아 markup 렌더(입력 처리는 위임).
import {
  SUBQUEST_MIN_LEVEL,
  RARITY_META,
  subquestTitle,
  subquestSubmission,
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

function submissionNote(def: SubquestDef, names: Record<string, string>): string {
  const sub = subquestSubmission(def);
  return sub ? `<span class="subquest-submit">📦 제출: ${esc(names[sub.item] ?? sub.item)} ${sub.count}개</span>` : "";
}

function choiceCard(def: SubquestDef, index: number, names: Record<string, string>): string {
  const m = RARITY_META[def.rarity];
  return (
    `<button type="button" class="subquest-card" data-subquest-pick="${index}" style="${rarityStyle(def)}">` +
    `<span class="subquest-rarity" style="color:${m.border}">${m.label}</span>` +
    `<strong>${esc(subquestTitle(def, names))}</strong>` +
    submissionNote(def, names) +
    `<span class="subquest-reward">🎁 ${esc(def.reward.label)}</span>` +
    `</button>`
  );
}

function activeCard(state: SubquestState, names: Record<string, string>, dialogOpen: boolean): string {
  const def = state.selected!;
  const m = RARITY_META[def.rarity];
  const done = state.progress >= def.target;
  const pct = Math.round((Math.min(state.progress, def.target) / def.target) * 100);
  const progressLine = done
    ? (dialogOpen ? "✅ 완료! 아래 버튼으로 보상 수령" : "✅ 완료 — 마을 이장에게 보상 받기")
    : `진행 ${Math.min(state.progress, def.target)}/${def.target}`;
  const action = dialogOpen
    ? (done
        ? `<button type="button" class="subquest-claim" data-subquest-claim>🎁 보상 받기</button>`
        : "") + `<button type="button" class="subquest-abandon" data-subquest-abandon>선택 미션 포기</button>`
    : "";
  return (
    `<div class="subquest-card subquest-active" style="${rarityStyle(def)}">` +
    `<span class="subquest-rarity" style="color:${m.border}">${m.label}</span>` +
    `<strong>${esc(subquestTitle(def, names))}</strong>` +
    submissionNote(def, names) +
    `<span class="subquest-progress-text">${progressLine}</span>` +
    `<span class="subquest-bar"><i style="width:${pct}%;background:${m.border}"></i></span>` +
    `<span class="subquest-reward">🎁 ${esc(def.reward.label)}</span>` +
    action +
    `</div>`
  );
}

// state 를 받아 el.innerHTML 갱신. 레벨 미달이면 숨김. dialogOpen=이장 대화중(인터랙티브).
export function renderSubquestPanel(el: HTMLElement, state: SubquestState, names: Record<string, string>, now: number, level: number, dialogOpen: boolean): void {
  if (level < SUBQUEST_MIN_LEVEL) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.classList.toggle("subquest-dialog", dialogOpen);
  const title = dialogOpen ? "🏘️ 마을 이장 — 서브퀘스트" : "🎯 서브 퀘스트";
  let body: string;
  if (state.selected) {
    body = activeCard(state, names, dialogOpen);
  } else if (dialogOpen) {
    const cards = (state.choices ?? []).map((def, i) => choiceCard(def, i, names)).join("");
    const canRefresh = canRefreshSubquests(now, state.lastRefreshEpoch);
    const remainSec = Math.ceil(refreshCooldownRemainingMs(now, state.lastRefreshEpoch) / 1000);
    const refreshLabel = canRefresh ? "🔄 새로고침" : `🔄 새로고침 (${Math.floor(remainSec / 60)}:${String(remainSec % 60).padStart(2, "0")})`;
    body =
      `<div class="subquest-choices">${cards}</div>` +
      `<button type="button" class="subquest-refresh" data-subquest-refresh ${canRefresh ? "" : "disabled"}>${refreshLabel}</button>`;
  } else {
    body = `<div class="subquest-hint">🏘️ 마을 이장에게 말을 걸어 서브퀘스트를 받으세요.</div>`;
  }
  el.innerHTML = `<div class="subquest-title">${title}</div>${body}`;
}
