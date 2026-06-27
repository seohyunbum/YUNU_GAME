import {
  blockFakeChance,
  blockWindowMs,
  calmZoneRatio,
  canShootTarget,
  liftClickPower,
  liftDrainPerSecond,
  targetSpeed,
  targetTolerance,
  targetWobble,
  TRAINING_GAMES,
  TRAINING_REWARDS,
} from "../game/training";
import type { TrainingKind } from "../game/types";
import type { TrainingLeaderboard } from "../game/progressSync";

// 훈련장 미니게임 패널 — 자체 rAF 루프로 동작하고, 패널 DOM 이 사라지면 스스로 멈춘다.
// 성공할 때마다 onSuccess 를 호출하고(스탯 반영은 main), 난이도는 getCount() 횟수로 다시 읽는다.

export interface TrainingPanelCallbacks {
  getCount(kind: TrainingKind): number;
  onSuccess(kind: TrainingKind): void;
  onFail(kind: TrainingKind): void; // 실패/리셋 1회 = 시도 1회(랭킹 시도수 집계)
  onClose(): void;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderTrainingPanel(panelEl: HTMLElement, kind: TrainingKind, callbacks: TrainingPanelCallbacks) {
  const game = TRAINING_GAMES[kind];
  panelEl.innerHTML = `
      <section class="panel training-panel" data-training-root>
        <header>
          <div>
            <h2>훈련장 · ${escapeHtml(game.name)}</h2>
            <p class="inventory-subtitle">${escapeHtml(game.howTo)}</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="training-status">
          <span>훈련 ${callbacks.getCount(kind)}회 완료</span>
          <span>성공 보상: ${escapeHtml(game.statLabel)} +${TRAINING_REWARDS[kind]}</span>
        </div>
        <div class="training-stage" data-stage></div>
        <p class="training-feedback" data-feedback>준비되면 시작!</p>
        <div class="training-leaderboard" data-training-leaderboard style="margin-top:10px;padding:10px 12px;border:0.5px solid rgba(255,255,255,0.16);border-radius:8px"><div style="opacity:0.65;font-size:13px">🏆 TOP 5 불러오는 중…</div></div>
      </section>
    `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  const root = panelEl.querySelector<HTMLElement>("[data-training-root]")!;
  const stage = panelEl.querySelector<HTMLElement>("[data-stage]")!;
  const feedback = panelEl.querySelector<HTMLElement>("[data-feedback]")!;

  const setFeedback = (text: string, good?: boolean) => {
    feedback.textContent = text;
    feedback.classList.toggle("good", Boolean(good));
  };
  const celebrate = () => {
    callbacks.onSuccess(kind);
    root.querySelector(".training-status span")!.textContent = `훈련 ${callbacks.getCount(kind)}회 완료`;
    setFeedback(`성공! ${TRAINING_GAMES[kind].statLabel} +${TRAINING_REWARDS[kind]} — 다음 판은 더 어려워집니다!`, true);
  };

  if (kind === "hp") runLift();
  else if (kind === "attack") runTarget();
  else if (kind === "armor") runBlock();
  else runMeditation();

  // ── 역기들기: 연타로 게이지를 채운다. 자연 감소가 연타 속도를 요구한다 ──
  function runLift() {
    stage.innerHTML = `
        <div class="lift-arena">
          <div class="lift-bar"><div class="lift-fill" data-fill></div></div>
          <button class="lift-button" data-lift>💪 클릭 연타!</button>
        </div>
      `;
    const fill = stage.querySelector<HTMLElement>("[data-fill]")!;
    let power = 12;
    let last = performance.now();
    stage.querySelector("[data-lift]")!.addEventListener("mousedown", () => {
      power = Math.min(100, power + liftClickPower(callbacks.getCount(kind)));
    });
    const tick = () => {
      if (!root.isConnected) return;
      const now = performance.now();
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 성공 판정을 감소보다 먼저 — 클릭 캡(100)이 검사 전에 깎이면 영원히 성공 불가
      if (power >= 100) {
        celebrate();
        power = 12;
      }
      power = Math.max(0, power - liftDrainPerSecond(callbacks.getCount(kind)) * delta);
      fill.style.height = `${power}%`;
      fill.classList.toggle("high", power > 70);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 과녁맞추기: 과녁이 좌우 왕복(+불규칙). 가운데 조준선에서 클릭 ──
  function runTarget() {
    stage.innerHTML = `
        <div class="target-arena" data-arena>
          <div class="target-center-line"></div>
          <div class="target-disc" data-disc>🎯</div>
        </div>
        <p class="training-hint">클릭 또는 스페이스로 발사!</p>
      `;
    const disc = stage.querySelector<HTMLElement>("[data-disc]")!;
    const arena = stage.querySelector<HTMLElement>("[data-arena]")!;
    let phase = Math.random() * Math.PI * 2;
    let last = performance.now();
    let position = 0;
    let lastShotAt = -Infinity;
    const shoot = () => {
      if (!root.isConnected) return;
      const now = performance.now();
      if (!canShootTarget(now, lastShotAt)) return; // 0.5초 최소 간격 — 난타·꾹누르기·연타 악용 차단(클릭·스페이스 공통)
      lastShotAt = now;
      const count = callbacks.getCount(kind);
      if (Math.abs(position) <= targetTolerance(count)) {
        celebrate();
        phase = Math.random() * Math.PI * 2;
      } else {
        setFeedback(position > 0 ? "빗나감! 과녁이 오른쪽에 있었어요." : "빗나감! 과녁이 왼쪽에 있었어요.");
        callbacks.onFail(kind);
      }
    };
    arena.addEventListener("mousedown", shoot);
    const keyHandler = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !root.isConnected) return;
      event.preventDefault();
      shoot();
    };
    window.addEventListener("keydown", keyHandler);
    const tick = () => {
      if (!root.isConnected) {
        window.removeEventListener("keydown", keyHandler);
        return;
      }
      const now = performance.now();
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const count = callbacks.getCount(kind);
      phase += delta * targetSpeed(count) * Math.PI;
      position = Math.sin(phase) * 0.92 + Math.sin(phase * 2.7 + 1.3) * targetWobble(count) * 0.4;
      position = Math.max(-1, Math.min(1, position));
      disc.style.left = `${50 + position * 46}%`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 방패막기: '막아!' 신호 순간에만 클릭. 가짜 신호에 속으면 실패 ──
  function runBlock() {
    stage.innerHTML = `
        <div class="block-arena" data-arena>
          <div class="block-signal" data-signal>기다리세요…</div>
          <div class="block-progress" data-progress>0 / 3</div>
        </div>
      `;
    const signal = stage.querySelector<HTMLElement>("[data-signal]")!;
    const progress = stage.querySelector<HTMLElement>("[data-progress]")!;
    const arena = stage.querySelector<HTMLElement>("[data-arena]")!;
    let state: "idle" | "fake" | "go" = "idle";
    let goAt = 0;
    let blocked = 0;
    let scheduled = 0;
    const schedule = () => {
      state = "idle";
      signal.textContent = "기다리세요…";
      signal.className = "block-signal";
      scheduled = performance.now() + 700 + Math.random() * 1600;
    };
    schedule();
    const block = () => {
      const count = callbacks.getCount(kind);
      if (state === "go" && performance.now() - goAt <= blockWindowMs(count)) {
        blocked += 1;
        progress.textContent = `${blocked} / 3`;
        if (blocked >= 3) {
          celebrate();
          blocked = 0;
          progress.textContent = "0 / 3";
        } else setFeedback(`막았다! (${blocked}/3)`, true);
        schedule();
      } else {
        blocked = 0;
        progress.textContent = "0 / 3";
        setFeedback(state === "fake" ? "가짜 신호에 속았어요! 처음부터." : "너무 빨랐어요! 처음부터.");
        callbacks.onFail(kind);
        schedule();
      }
    };
    arena.addEventListener("mousedown", block);
    const keyHandler = (event: KeyboardEvent) => { // 방어 훈련도 스페이스로 막기(클릭과 동일)
      if (event.code !== "Space" || !root.isConnected) return;
      event.preventDefault();
      block();
    };
    window.addEventListener("keydown", keyHandler);
    const tick = () => {
      if (!root.isConnected) { window.removeEventListener("keydown", keyHandler); return; }
      const now = performance.now();
      const count = callbacks.getCount(kind);
      if (state === "idle" && now >= scheduled) {
        if (Math.random() < blockFakeChance(count)) {
          state = "fake";
          signal.textContent = "💤 흔들기…";
          signal.className = "block-signal fake";
          scheduled = now + 450 + Math.random() * 350;
        } else {
          state = "go";
          goAt = now;
          signal.textContent = "🛡 막아!";
          signal.className = "block-signal go";
        }
      } else if (state === "fake" && now >= scheduled) {
        schedule();
      } else if (state === "go" && now - goAt > blockWindowMs(count)) {
        blocked = 0;
        progress.textContent = "0 / 3";
        setFeedback("늦었어요! 처음부터.");
        callbacks.onFail(kind);
        schedule();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 명상호흡: 진동하는 바늘이 고요 구역 안일 때 클릭, 3회 모으기 ──
  function runMeditation() {
    stage.innerHTML = `
        <div class="calm-arena" data-arena>
          <div class="calm-zone" data-zone></div>
          <div class="calm-needle" data-needle></div>
        </div>
        <div class="block-progress" data-progress>0 / 3</div>
      `;
    const needle = stage.querySelector<HTMLElement>("[data-needle]")!;
    const zone = stage.querySelector<HTMLElement>("[data-zone]")!;
    const progress = stage.querySelector<HTMLElement>("[data-progress]")!;
    const arena = stage.querySelector<HTMLElement>("[data-arena]")!;
    let phase = Math.random() * Math.PI * 2;
    let last = performance.now();
    let position = 0;
    let gathered = 0;
    const gather = () => {
      const count = callbacks.getCount(kind);
      if (Math.abs(position) <= calmZoneRatio(count)) {
        gathered += 1;
        progress.textContent = `${gathered} / 3`;
        if (gathered >= 3) {
          celebrate();
          gathered = 0;
          progress.textContent = "0 / 3";
        } else setFeedback(`호흡이 모입니다… (${gathered}/3)`, true);
      } else {
        gathered = 0;
        progress.textContent = "0 / 3";
        setFeedback("마음이 흔들렸어요! 처음부터.");
        callbacks.onFail(kind);
      }
    };
    arena.addEventListener("mousedown", gather);
    const keyHandler = (event: KeyboardEvent) => { // 명상 훈련도 스페이스로 호흡 모으기(클릭과 동일)
      if (event.code !== "Space" || !root.isConnected) return;
      event.preventDefault();
      gather();
    };
    window.addEventListener("keydown", keyHandler);
    const tick = () => {
      if (!root.isConnected) { window.removeEventListener("keydown", keyHandler); return; }
      const now = performance.now();
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const count = callbacks.getCount(kind);
      phase += delta * (1.4 + count * 0.1) * Math.PI;
      position = Math.sin(phase) * Math.sin(phase * 0.37 + 0.8);
      needle.style.left = `${50 + position * 46}%`;
      zone.style.width = `${calmZoneRatio(count) * 2 * 46}%`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// 패널을 다시 그리지 않고(rAF 미니게임 유지) 종목 TOP5 영역만 채운다. main 이 fetch 후 호출.
export function fillTrainingLeaderboard(panelEl: HTMLElement, kind: TrainingKind, board: TrainingLeaderboard | null, myNickname: string) {
  const el = panelEl.querySelector<HTMLElement>("[data-training-leaderboard]");
  if (!el) return;
  const title = `<div style="font-weight:600;margin-bottom:6px">🏆 ${escapeHtml(TRAINING_GAMES[kind].name)} TOP 5 <span style="opacity:0.6;font-weight:400;font-size:12px">(단계 · 시도수)</span></div>`;
  if (!board) { el.innerHTML = `${title}<div style="opacity:0.65;font-size:13px">불러오는 중…</div>`; return; }
  if (board.top.length === 0) { el.innerHTML = `${title}<div style="opacity:0.65;font-size:13px">아직 기록이 없어요. 1등에 도전!</div>`; return; }
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  const rows = board.top
    .map((entry, i) => {
      const self = entry.nickname === myNickname;
      return `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:13px${self ? ";font-weight:600" : ""}"><span>${medals[i] ?? `${i + 1}.`} ${escapeHtml(entry.nickname)}${self ? " (나)" : ""}</span><strong>${entry.stage}단계 · ${entry.tries}회</strong></div>`;
    })
    .join("");
  const mine = board.myRank && board.myRank > board.top.length ? `<div style="opacity:0.65;font-size:12px;margin-top:4px">내 순위 ${board.myRank}위 / 총 ${board.total}명</div>` : "";
  el.innerHTML = `${title}${rows}${mine}`;
}
