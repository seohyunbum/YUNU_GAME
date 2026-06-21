import { renderControlsGuide } from "./controlsGuide";
import { renderSaveControls, renderTitleScreen, type TitlePlayerClassView } from "./titleScreen";

export type ClassChoiceViewModel = TitlePlayerClassView;

export interface GameUiElements {
  container: HTMLElement;
  uiRoot: HTMLElement;
  statsEl: HTMLElement;
  objectiveEl: HTMLElement;
  coachEl: HTMLElement;
  promptEl: HTMLElement;
  hotbarEl: HTMLElement;
  messageEl: HTMLElement;
  panelEl: HTMLElement;
  bossBarEl: HTMLElement;
  saveControlsEl: HTMLElement;
  titleScreenEl: HTMLElement;
}

export interface GameUiSetupOptions {
  lavaLaneCount: number;
  playerClasses: ClassChoiceViewModel[];
}

export interface GameUiCallbacks {
  onNewGame(): void;
  onQuickAction(action: string): void; // 좌상단 퀵버튼(가방/캐릭터/파티)
  onSaveGame(): void;
  onLoadGame(): void;
  onTitleNew(): void;
  onClassChoice(choice: string | undefined): void;
  onQualityChoice(mode: string | undefined): void;
  onTitleLoad(): void;
  onShowMiniGame(): void;
  onShowLavaMiniGame(): void;
  onShowSmithingMiniGame(): void;
  onHideMiniGame(): void;
  onStartMiniGame(event: MouseEvent): void;
  onResetMiniGame(event: MouseEvent): void;
  onHideLavaMiniGame(): void;
  onStartLavaMiniGame(event: MouseEvent): void;
  onResetLavaMiniGame(event: MouseEvent): void;
  onHideSmithingMiniGame(): void;
  onStartSmithingMiniGame(event: MouseEvent): void;
  onResetSmithingMiniGame(event: MouseEvent): void;
  onBindSmithingMiniGameEvents(): void;
  onRenderTitlePoints(): void;
  onRenderClassSelection(): void;
  onRenderMiniGame(): void;
  onRenderLavaMiniGame(): void;
  onRenderSmithingMiniGame(): void;
}

export function setupGameUi(elements: GameUiElements, options: GameUiSetupOptions, callbacks: GameUiCallbacks) {
  const {
    container,
    uiRoot,
    statsEl,
    objectiveEl,
    coachEl,
    promptEl,
    hotbarEl,
    messageEl,
    panelEl,
    bossBarEl,
    saveControlsEl,
    titleScreenEl,
  } = elements;

  uiRoot.className = "game-ui";
  statsEl.className = "stats";
  objectiveEl.className = "objective";
  coachEl.className = "coach-beacon hidden";
  promptEl.className = "prompt";
  hotbarEl.className = "hotbar";
  messageEl.className = "message";
  panelEl.className = "panel-layer";
  bossBarEl.className = "boss-bar hidden";
  saveControlsEl.className = "save-controls";
  renderSaveControls(saveControlsEl);
  const controlsGuideEl = document.createElement("div"); // 좌측 상단 조작법 가이드 (인게임 전용 — .title-active 시 CSS 로 숨김)
  controlsGuideEl.className = "controls-guide";
  renderControlsGuide(controlsGuideEl);
  controlsGuideEl.addEventListener("click", (event) => { // 퀵버튼(가방/캐릭터/파티) 위임 처리
    const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-quick-action]");
    if (btn?.dataset.quickAction) callbacks.onQuickAction(btn.dataset.quickAction);
  });
  titleScreenEl.className = "title-screen";
  renderTitleScreen(titleScreenEl, options);
  uiRoot.innerHTML = '<div class="crosshair"></div>';
  uiRoot.classList.add("title-active");
  uiRoot.append(bossBarEl, objectiveEl, coachEl, statsEl, saveControlsEl, controlsGuideEl, promptEl, hotbarEl, messageEl, panelEl, titleScreenEl);
  container.appendChild(uiRoot);

  const bindButton = (root: HTMLElement, selector: string, callback: (event: MouseEvent) => void) => {
    root.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", (event) => {
      event.stopPropagation();
      callback(event);
    });
  };

  bindButton(saveControlsEl, "[data-new-game]", callbacks.onNewGame);
  bindButton(saveControlsEl, "[data-save-game]", callbacks.onSaveGame);
  bindButton(saveControlsEl, "[data-load-game]", callbacks.onLoadGame);
  bindButton(titleScreenEl, "[data-title-new]", callbacks.onTitleNew);
  titleScreenEl.querySelectorAll<HTMLButtonElement>("[data-class-choice]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onClassChoice(button.dataset.classChoice);
    });
  });
  titleScreenEl.querySelectorAll<HTMLButtonElement>("[data-quality]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      callbacks.onQualityChoice(button.dataset.quality);
    });
  });
  bindButton(titleScreenEl, "[data-title-load]", callbacks.onTitleLoad);
  bindButton(titleScreenEl, "[data-title-mini]", callbacks.onShowMiniGame);
  bindButton(titleScreenEl, "[data-title-lava]", callbacks.onShowLavaMiniGame);
  bindButton(titleScreenEl, "[data-title-smith]", callbacks.onShowSmithingMiniGame);
  bindButton(titleScreenEl, "[data-mini-back]", callbacks.onHideMiniGame);
  bindButton(titleScreenEl, "[data-mini-start]", callbacks.onStartMiniGame);
  bindButton(titleScreenEl, "[data-mini-reset]", callbacks.onResetMiniGame);
  bindButton(titleScreenEl, "[data-lava-back]", callbacks.onHideLavaMiniGame);
  bindButton(titleScreenEl, "[data-lava-start]", callbacks.onStartLavaMiniGame);
  bindButton(titleScreenEl, "[data-lava-reset]", callbacks.onResetLavaMiniGame);
  bindButton(titleScreenEl, "[data-smith-back]", callbacks.onHideSmithingMiniGame);
  bindButton(titleScreenEl, "[data-smith-start]", callbacks.onStartSmithingMiniGame);
  bindButton(titleScreenEl, "[data-smith-reset]", callbacks.onResetSmithingMiniGame);

  callbacks.onBindSmithingMiniGameEvents();
  callbacks.onRenderTitlePoints();
  callbacks.onRenderClassSelection();
  callbacks.onRenderMiniGame();
  callbacks.onRenderLavaMiniGame();
  callbacks.onRenderSmithingMiniGame();
}

// 불러오기류 버튼(타이틀·HUD 저장컨트롤) 공통 busy 표시 — 복원이 수 초 걸려 중복 클릭을 막고 진행 중임을 보여준다.
export function setLoadButtonsBusy(busy: boolean) {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-load-game], [data-title-load]")) {
    button.disabled = busy;
    if (busy && !button.dataset.idleLabel) button.dataset.idleLabel = button.textContent ?? "불러오기";
    button.textContent = busy ? "불러오는 중…" : button.dataset.idleLabel ?? "불러오기";
  }
}
