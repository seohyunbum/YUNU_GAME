// 정령 가챠 전체화면 연출 — 이집트의 눈이 서서히 떠지며 공개되는 색이 등급을 결정.
// leaf(ui): main.ts 를 import 하지 않는다. 오디오·완료 콜백은 deps 로 주입. CSS 클래스 토글 + 타이머로 연출.
import { spiritGradeDef, spiritGradeIndex } from "../game/spirits";
import type { SpiritData } from "../game/types";

export interface GachaDeps {
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  onFinish(): void; // 닫힘 시(확인/건너뛰기 후) — main 이 HUD 갱신 등 처리
}

let overlay: HTMLElement | null = null;
let timers: number[] = [];
let active = false;

function ensureDom(): HTMLElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "gacha-overlay hidden";
  overlay.setAttribute("data-gacha", "");
  overlay.innerHTML = `
    <div class="gacha-shade"></div>
    <button class="gacha-skip" data-gacha-skip type="button">건너뛰기 ⏩</button>
    <div class="gacha-stage">
      <div class="gacha-glow" data-gacha-glow></div>
      <div class="gacha-eye" data-gacha-eye>
        <div class="gacha-lid gacha-lid-top"></div>
        <div class="gacha-lid gacha-lid-bottom"></div>
        <div class="gacha-iris" data-gacha-iris></div>
        <div class="gacha-pupil"></div>
      </div>
      <div class="gacha-result hidden" data-gacha-result></div>
    </div>
    <div class="gacha-actions hidden" data-gacha-actions>
      <button class="gacha-confirm" data-gacha-confirm type="button">확인</button>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function later(fn: () => void, ms: number) {
  timers.push(window.setTimeout(fn, ms));
}

// 즉시 결과 공개(건너뛰기 또는 연출 종료) — 눈을 열고 등급 색·결과 카드를 띄운다.
function reveal(spirit: SpiritData, deps: GachaDeps) {
  if (!overlay) return;
  const def = spiritGradeDef(spirit.grade);
  const glow = overlay.querySelector<HTMLElement>("[data-gacha-glow]");
  const iris = overlay.querySelector<HTMLElement>("[data-gacha-iris]");
  const eye = overlay.querySelector<HTMLElement>("[data-gacha-eye]");
  const result = overlay.querySelector<HTMLElement>("[data-gacha-result]");
  const actions = overlay.querySelector<HTMLElement>("[data-gacha-actions]");
  if (glow) { glow.style.background = `radial-gradient(circle, ${def.glow} 0%, transparent 70%)`; glow.classList.add("gacha-glow-on"); }
  if (iris) iris.style.background = `radial-gradient(circle at 50% 45%, #fff 0%, ${def.color} 35%, ${def.color} 70%, #0b1020 100%)`;
  eye?.classList.add("gacha-eye-open");
  if (result) {
    result.innerHTML = `<div class="gacha-grade" style="color:${def.color}">${def.emoji} ${def.label} 정령</div>
      <div class="gacha-stats">공격 +${spirit.baseAttack} · 방어 +${spirit.baseDefense}</div>
      <div class="gacha-hint">캐릭터 창에서 장착하세요</div>`;
    result.classList.remove("hidden");
  }
  actions?.classList.remove("hidden");
  // 공개 효과음 — 등급이 높을수록 화려한 상승 화음
  const idx = spiritGradeIndex(spirit.grade);
  deps.playTone(523, 0.18, "triangle", 0.05);
  later(() => deps.playTone(659 + idx * 40, 0.22, "triangle", 0.05), 120);
  if (idx >= 3) later(() => deps.playTone(880 + idx * 60, 0.4, "sawtooth", 0.05), 260);
}

function close(deps: GachaDeps) {
  clearTimers();
  active = false;
  overlay?.classList.add("hidden");
  deps.onFinish();
}

// 메인 진입점 — 이미 생성된 정령(spirit)의 공개 연출을 띄운다. 정령 추가·저장은 호출 측(main)에서 끝낸 상태.
export function runSpiritGacha(spirit: SpiritData, deps: GachaDeps): void {
  const el = ensureDom();
  clearTimers();
  active = true;

  // 초기화: 눈 감김, 결과 숨김
  const eye = el.querySelector<HTMLElement>("[data-gacha-eye]");
  const glow = el.querySelector<HTMLElement>("[data-gacha-glow]");
  eye?.classList.remove("gacha-eye-open");
  glow?.classList.remove("gacha-glow-on");
  el.querySelector("[data-gacha-result]")?.classList.add("hidden");
  el.querySelector("[data-gacha-actions]")?.classList.add("hidden");
  el.classList.remove("hidden");

  // 버튼 배선(매번 새로 — 직전 핸들러는 cloneNode 대신 onclick 덮어쓰기로 단순화)
  const skip = el.querySelector<HTMLButtonElement>("[data-gacha-skip]");
  const confirm = el.querySelector<HTMLButtonElement>("[data-gacha-confirm]");
  if (skip) skip.onclick = () => { if (!active) return; clearTimers(); reveal(spirit, deps); };
  if (confirm) confirm.onclick = () => close(deps);

  // 긴장감 빌드업 — 낮게 두근거리는 톤이 점점 빨라지다가 ~2.6초 후 공개.
  const beat = (freq: number, vol: number) => deps.playTone(freq, 0.12, "sine", vol);
  beat(160, 0.04);
  later(() => beat(180, 0.045), 700);
  later(() => beat(210, 0.05), 1250);
  later(() => beat(250, 0.055), 1700);
  later(() => beat(300, 0.06), 2050);
  later(() => beat(360, 0.06), 2350);
  later(() => { if (active) reveal(spirit, deps); }, 2700);
}

export function isGachaActive(): boolean {
  return active;
}
