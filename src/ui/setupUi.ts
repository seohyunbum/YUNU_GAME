import { renderSaveControls, renderTitleScreen, type TitlePlayerClassView } from "./titleScreen";

export type ClassChoiceViewModel = TitlePlayerClassView;

export interface GameUiElements {
  container: HTMLElement;
  uiRoot: HTMLElement;
  statsEl: HTMLElement;
  objectiveEl: HTMLElement;
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
  onSaveGame(): void;
  onLoadGame(): void;
  onTitleNew(): void;
  onClassChoice(choice: string | undefined): void;
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
  promptEl.className = "prompt";
  hotbarEl.className = "hotbar";
  messageEl.className = "message";
  panelEl.className = "panel-layer";
  bossBarEl.className = "boss-bar hidden";
  saveControlsEl.className = "save-controls";
  renderSaveControls(saveControlsEl);
  titleScreenEl.className = "title-screen";
  renderTitleScreen(titleScreenEl, options);
  uiRoot.innerHTML = '<div class="crosshair"></div>';
  uiRoot.classList.add("title-active");
  uiRoot.append(bossBarEl, objectiveEl, statsEl, saveControlsEl, promptEl, hotbarEl, messageEl, panelEl, titleScreenEl);
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
