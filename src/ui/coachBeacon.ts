// 초보 온보딩 코치 — 1챕터(첫걸음~가방) 동안 HUD 하단에 "지금 할 행동 1개"를 큼직하게 안내.
// + 핵심 스텝(제작대 제작/설치/가방)은 활성으로 바뀌는 순간 클리어 가이드를 1회 자동으로 띄운다.
// 모든 상태는 휘발(세이브 무관) → 회귀·소급 리스크 0. XSS 안전(textContent).
import type { TutorialObjective } from "../objectives";

// 활성 시 objectiveGuide 팝업을 1회 자동 노출할 핵심 스텝 (놓치면 진행이 막히는 필수 절차)
export const ONBOARDING_GUIDE_STEPS = new Set<string>(["craft_workbench_item", "place_workbench", "craft_bag"]);

export interface CoachHint {
  key: string;
  action: string;
  accent?: boolean;
}

// 1챕터 스텝별 "다음 행동 1개" — HUD 코치 비콘에 큼직하게 표시. 체인을 벗어나면 비콘은 자동으로 사라진다.
export const COACH_HINTS: Record<string, CoachHint> = {
  first_steps: { key: "WASD", action: "움직여서 주변을 둘러보세요" },
  gather_wood: { key: "E", action: "작은 나무를 바라보고 눌러 나무를 모으세요" },
  find_hammer: { key: "E", action: "걷다 보면 나오는 상자를 열어 망치를 구하세요" },
  craft_workbench_item: { key: "I", action: "가방을 열고 2x2에 나무3+망치1을 넣어 제작대를 만드세요", accent: true },
  place_workbench: { key: "우클릭", action: "가방에서 제작대를 우클릭해 바닥에 설치하세요", accent: true },
  stock_meat: { key: "좌클릭", action: "동물을 사냥해 고기를 모으고, 배고프면 핫바에서 드세요" },
  gather_leather: { key: "좌클릭", action: "동물을 사냥해 가죽 7개를 모으세요 (가방 재료)" },
  craft_bag: { key: "I", action: "제작대에서 가죽 7개로 가방을 만드세요 (8칸 → 40칸)", accent: true },
};

export interface OnboardingCoachState {
  shownGuides: Set<string>;
  lastCoachKey: string;
  coachDismissed: boolean;
  hintedFull: boolean;
}

export function createOnboardingState(): OnboardingCoachState {
  return { shownGuides: new Set(), lastCoachKey: "", coachDismissed: false, hintedFull: false };
}

// 새 게임/로드 시 호출 — "playthrough 마다 새 상태" 보장(같은 세션 재시작에서도 안내가 다시 작동). 필드는 readonly 라 제자리 초기화.
export function resetOnboardingState(state: OnboardingCoachState): void {
  state.shownGuides.clear();
  state.lastCoachKey = "";
  state.coachDismissed = false;
  state.hintedFull = false;
}

function renderCoachBeacon(el: HTMLElement, hint: CoachHint | null, onDismiss: () => void): void {
  el.innerHTML = "";
  if (!hint) {
    el.classList.add("hidden");
    el.classList.remove("coach-accent");
    return;
  }
  el.classList.remove("hidden");
  el.classList.toggle("coach-accent", Boolean(hint.accent));
  const tag = document.createElement("span");
  tag.className = "coach-tag";
  tag.textContent = "다음 할 일";
  const kbd = document.createElement("kbd");
  kbd.textContent = hint.key;
  const label = document.createElement("span");
  label.className = "coach-action";
  label.textContent = hint.action;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "coach-close";
  close.textContent = "✕";
  close.title = "안내 끄기";
  close.addEventListener("click", onDismiss);
  close.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }, { passive: false });
  el.append(tag, kbd, label, close);
}

// renderHud 에서 매 프레임 호출하는 단일 진입점 — 상태가 바뀔 때만 DOM 갱신(매 프레임 innerHTML 방지).
// main.ts 를 얇게 유지하기 위해 자동 팝업 판정 + 비콘 렌더를 모두 여기서 처리한다.
export function updateOnboardingCoach(
  ov: TutorialObjective,
  state: OnboardingCoachState,
  coachEl: HTMLElement,
  showGuide: (q: { title: string; detail: string; progress: string; rewardLabel: string; touch: boolean }) => void,
  touch: boolean,
): void {
  if (!ov.completed && ONBOARDING_GUIDE_STEPS.has(ov.id) && !state.shownGuides.has(ov.id)) {
    state.shownGuides.add(ov.id);
    showGuide({ title: ov.title, detail: ov.detail, progress: ov.progress, rewardLabel: ov.reward.label, touch });
  }
  const key = `${ov.id}:${ov.completed}:${state.coachDismissed}`;
  if (key === state.lastCoachKey) return;
  state.lastCoachKey = key;
  const inChapterOne = Boolean(COACH_HINTS[ov.id]);
  const hint: CoachHint | null = state.coachDismissed
    ? null
    : ov.completed
      ? (inChapterOne ? { key: "Q", action: `보상 받기 — ${ov.title}`, accent: true } : null)
      : COACH_HINTS[ov.id] ?? null;
  renderCoachBeacon(coachEl, hint, () => { state.coachDismissed = true; state.lastCoachKey = ""; renderCoachBeacon(coachEl, null, () => {}); });
}
