import { LAVA_LANE_COUNT } from "../game/constants";
import type { LavaMiniGameState } from "../game/types";

/** 용암 피하기 미니게임 HUD 갱신 (title 화면 내 DOM 직접 갱신, 프레임당 호출). */
export function renderLavaMiniGameUI(
  titleScreenEl: HTMLElement,
  state: LavaMiniGameState,
  arcadePoints: number,
): void {
  const scoreEl = titleScreenEl.querySelector<HTMLElement>("[data-lava-score]");
  if (!scoreEl) return;
  scoreEl.textContent = String(state.score);
  titleScreenEl.querySelector<HTMLElement>("[data-lava-points]")!.textContent = String(arcadePoints);
  titleScreenEl.querySelector<HTMLElement>("[data-lava-stage]")!.textContent = String(state.stage);
  const stateText = state.playing
    ? "진행 중: 좌/우 화살표로 이동"
    : state.gameOver
      ? `게임 종료: ${state.score}P 획득`
      : "좌/우 화살표 또는 시작 버튼으로 준비";
  titleScreenEl.querySelector<HTMLElement>("[data-lava-state]")!.textContent = stateText;
  const startButton = titleScreenEl.querySelector<HTMLButtonElement>("[data-lava-start]");
  if (startButton) startButton.disabled = state.playing;

  const player = titleScreenEl.querySelector<HTMLElement>("[data-lava-player]");
  if (player) {
    player.dataset.lane = String(state.playerLane);
    player.style.left = `${((state.playerLane + 0.5) / LAVA_LANE_COUNT) * 100}%`;
  }

  const hazards = titleScreenEl.querySelector<HTMLElement>("[data-lava-hazards]");
  if (hazards) {
    hazards.innerHTML = state.hazards
      .map(
        (hazard) =>
          `<div class="lava-stream${hazard.special ? " special" : ""}" style="left:${(hazard.lane / LAVA_LANE_COUNT) * 100}%;width:${100 / LAVA_LANE_COUNT}%;top:${hazard.y * 100}%;height:${hazard.length * 100}%"></div>`,
      )
      .join("");
  }
}
