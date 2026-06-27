// 정령 가챠 전체화면 연출 — 황금 호루스의 눈(Eye of Horus)이 빛 속에서 깨어나며 등급 색을 드러낸다.
// leaf(ui): main.ts 를 import 하지 않는다. 오디오·완료 콜백은 deps 로 주입. SVG + CSS 클래스 토글 + 타이머로 연출.
import { spiritGradeDef, spiritGradeIndex } from "../game/spirits";
import type { SpiritData } from "../game/types";

export interface GachaDeps {
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  playSample(name: string, volume: number): void; // CC0 공개음(가챠 당첨) — 미로드 시 내부 폴백
  onFinish(): void; // 닫힘 시(확인/건너뛰기 후) — main 이 HUD 갱신 등 처리
}

let overlay: HTMLElement | null = null;
let timers: number[] = [];
let active = false;

// 황금 호루스의 눈 — 피라미드 프레임 + 눈썹/아몬드/홍채/눈물줄기/나선 컬. 이집트 부적 풍의 정령 소환 상징.
const EYE_SVG = `
  <svg viewBox="0 0 440 360" class="gacha-eye-svg" aria-hidden="true">
    <defs>
      <linearGradient id="gachaGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff6cc"/><stop offset="0.42" stop-color="#ecc64f"/><stop offset="1" stop-color="#9a7620"/>
      </linearGradient>
      <radialGradient id="gachaGoldGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#fff3b0" stop-opacity="0.9"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <polygon class="gacha-pyramid" points="220,26 414,326 26,326" fill="none" stroke="url(#gachaGold)" stroke-width="5"/>
    <polygon points="220,62 374,302 66,302" fill="none" stroke="url(#gachaGold)" stroke-width="1.6" opacity="0.4"/>
    <circle cx="220" cy="206" r="120" fill="url(#gachaGoldGlow)" class="gacha-eye-bloom" data-gacha-bloom/>
    <path d="M100 176 Q220 120 340 174" fill="none" stroke="url(#gachaGold)" stroke-width="12" stroke-linecap="round"/>
    <path class="gacha-almond" d="M116 206 Q220 156 326 202 Q220 252 116 206 Z" fill="#070a14" stroke="url(#gachaGold)" stroke-width="5"/>
    <g class="gacha-iris-grp" data-gacha-iris-grp>
      <circle class="gacha-iris" data-gacha-iris cx="214" cy="206" r="36" fill="#3b4250"/>
      <circle cx="214" cy="206" r="15" fill="#05060a"/>
      <circle cx="226" cy="195" r="6" fill="#ffffff" opacity="0.85"/>
    </g>
    <path d="M150 224 L134 300 Q150 318 172 302" fill="none" stroke="url(#gachaGold)" stroke-width="7" stroke-linecap="round"/>
    <path d="M288 222 Q326 258 304 290 Q282 312 268 284 Q261 268 282 266" fill="none" stroke="url(#gachaGold)" stroke-width="7" stroke-linecap="round"/>
  </svg>`;

function ensureDom(): HTMLElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "gacha-overlay hidden";
  overlay.setAttribute("data-gacha", "");
  overlay.innerHTML = `
    <div class="gacha-shade"></div>
    <button class="gacha-skip" data-gacha-skip type="button">건너뛰기 ⏩</button>
    <div class="gacha-stage">
      <div class="gacha-rays" data-gacha-rays></div>
      <div class="gacha-glow" data-gacha-glow></div>
      <div class="gacha-eye" data-gacha-eye>${EYE_SVG}</div>
      <div class="gacha-sparkles" data-gacha-sparkles></div>
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

// 공개 순간 등급 색의 반짝임을 눈 주변에 흩뿌린다(순수 연출, 클릭 차단 없음).
function burstSparkles(host: HTMLElement, color: string) {
  host.innerHTML = "";
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.className = "gacha-spark";
    const ang = (i / 14) * Math.PI * 2 + (i % 2) * 0.3;
    const dist = 90 + (i % 3) * 34;
    s.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    s.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
    s.style.setProperty("--sd", `${0.5 + (i % 4) * 0.12}s`);
    s.style.background = color;
    host.appendChild(s);
  }
}

// 즉시 결과 공개(건너뛰기 또는 연출 종료) — 눈이 깨어나며 등급 색·결과 카드를 띄운다.
function reveal(spirit: SpiritData, deps: GachaDeps) {
  if (!overlay) return;
  const def = spiritGradeDef(spirit.grade);
  const glow = overlay.querySelector<HTMLElement>("[data-gacha-glow]");
  const iris = overlay.querySelector<SVGCircleElement>("[data-gacha-iris]");
  const bloom = overlay.querySelector<SVGCircleElement>("[data-gacha-bloom]");
  const eye = overlay.querySelector<HTMLElement>("[data-gacha-eye]");
  const rays = overlay.querySelector<HTMLElement>("[data-gacha-rays]");
  const sparkles = overlay.querySelector<HTMLElement>("[data-gacha-sparkles]");
  const result = overlay.querySelector<HTMLElement>("[data-gacha-result]");
  const actions = overlay.querySelector<HTMLElement>("[data-gacha-actions]");
  if (glow) { glow.style.background = `radial-gradient(circle, ${def.glow} 0%, transparent 70%)`; glow.classList.add("gacha-glow-on"); }
  if (rays) { rays.style.setProperty("--ray-color", def.glow); rays.classList.add("gacha-rays-on"); }
  if (iris) { iris.setAttribute("fill", def.color); iris.style.filter = `drop-shadow(0 0 10px ${def.glow})`; }
  if (bloom) bloom.style.opacity = "1";
  eye?.classList.add("gacha-eye-open");
  if (sparkles) burstSparkles(sparkles, def.color);
  if (result) {
    result.innerHTML = `<div class="gacha-grade" style="color:${def.color};text-shadow:0 0 18px ${def.glow}">${def.emoji} ${def.label} 정령</div>
      <div class="gacha-stats">공격 +${spirit.baseAttack} · 방어 +${spirit.baseDefense}</div>
      <div class="gacha-hint">캐릭터 창에서 장착하세요</div>`;
    result.classList.remove("hidden");
  }
  actions?.classList.remove("hidden");
  // 공개 효과음 — CC0 파워업(spirit_summon). 미로드 시 deps.playSample 내부 폴백(무음 방지). 고등급은 추가 화음을 덧입힌다.
  const idx = spiritGradeIndex(spirit.grade);
  deps.playSample("spirit_summon", 0.5 + Math.min(0.2, idx * 0.04));
  deps.playTone(523, 0.16, "triangle", 0.04);
  later(() => deps.playTone(659 + idx * 40, 0.22, "triangle", 0.045), 130);
  if (idx >= 4) later(() => deps.playTone(1046 + idx * 40, 0.5, "sawtooth", 0.045), 280); // 전설+ — 화려한 마무리 화음
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

  // 초기화: 눈 닫힘(홍채 어둠), 결과·반짝임 숨김
  const eye = el.querySelector<HTMLElement>("[data-gacha-eye]");
  const glow = el.querySelector<HTMLElement>("[data-gacha-glow]");
  const rays = el.querySelector<HTMLElement>("[data-gacha-rays]");
  const iris = el.querySelector<SVGCircleElement>("[data-gacha-iris]");
  const bloom = el.querySelector<SVGCircleElement>("[data-gacha-bloom]");
  eye?.classList.remove("gacha-eye-open");
  glow?.classList.remove("gacha-glow-on");
  rays?.classList.remove("gacha-rays-on");
  if (iris) { iris.setAttribute("fill", "#3b4250"); iris.style.filter = ""; }
  if (bloom) bloom.style.opacity = "0";
  el.querySelector("[data-gacha-sparkles]")!.innerHTML = "";
  el.querySelector("[data-gacha-result]")?.classList.add("hidden");
  el.querySelector("[data-gacha-actions]")?.classList.add("hidden");
  el.classList.remove("hidden");

  // 버튼 배선(매번 새로 — onclick 덮어쓰기로 단순화)
  const skip = el.querySelector<HTMLButtonElement>("[data-gacha-skip]");
  const confirm = el.querySelector<HTMLButtonElement>("[data-gacha-confirm]");
  if (skip) skip.onclick = () => { if (!active) return; clearTimers(); reveal(spirit, deps); };
  if (confirm) confirm.onclick = () => close(deps);

  // 긴장감 빌드업 — 낮게 두근거리는 심장박동 톤이 점점 빠르고 높아지다가 ~2.7초 후 공개(뽑기 특유의 조마조마함).
  const beat = (freq: number, vol: number) => deps.playTone(freq, 0.14, "sine", vol);
  beat(68, 0.05);
  later(() => beat(72, 0.05), 480);
  later(() => beat(78, 0.055), 900);
  later(() => { beat(86, 0.06); deps.playTone(150, 0.1, "triangle", 0.025); }, 1280);
  later(() => beat(96, 0.065), 1620);
  later(() => beat(110, 0.07), 1900);
  later(() => beat(128, 0.075), 2140);
  later(() => beat(150, 0.08), 2340);
  later(() => beat(178, 0.085), 2520);
  later(() => { if (active) reveal(spirit, deps); }, 2700);
}

export function isGachaActive(): boolean {
  return active;
}
