import { WORLD_SIZE } from "../game/constants";
import type { WorldObject } from "../game/types";

// leaf: 우측 상단 상시 미니맵 + 나침반(N/E/S/W). 길 찾기 보조.
// 좌표 규약은 지도 패널(mapPanel)과 동일 — 위=북(-z), 아래=남(+z), 우=동(+x), 좌=서(-x). yaw 0 = 북.
// tick 이름은 hotpath 스캐너(update*/animate*)에 안 걸리게 의도적으로 비-update. THREE 할당 없음(순수 DOM/SVG).

interface MinimapPoint { x: number; z: number }
export interface MinimapContext {
  active(): boolean; // 게임 중 + 야외 + 패널 닫힘일 때만 표시
  playerX(): number;
  playerZ(): number;
  yaw(): number;
  homes(): MinimapPoint[];
  dragons(): Iterable<WorldObject>;
  fieldBosses(): Iterable<WorldObject>; // wildPredator 중 fieldBossId 가 있는 것만 보스로
  caves(): Iterable<WorldObject>;
  fortresses(): Iterable<WorldObject>; // 몬스터 요새 입구(fortressGate) — 디펜스 아레나 진입점, 맵당 1개
}

const SIZE = 152;
const HALF = SIZE / 2;
const SCALE = SIZE / WORLD_SIZE;
const proj = (v: number) => HALF + Math.max(-WORLD_SIZE / 2, Math.min(WORLD_SIZE / 2, v)) * SCALE;

let root: HTMLDivElement | null = null;
let dynamicGroup: SVGGElement | null = null;
let markerSvg = "";
let markerTimer = 0;

function ensureDom() {
  if (root) return;
  root = document.createElement("div");
  root.setAttribute("data-minimap", "");
  root.style.cssText = `position:fixed;top:14px;right:14px;width:${SIZE}px;height:${SIZE}px;z-index:40;pointer-events:none;`;
  const halo = `paint-order="stroke" stroke="#0c1812" stroke-width="3" stroke-linejoin="round"`;
  root.innerHTML = `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" style="display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));">
    <rect x="1.5" y="1.5" width="${SIZE - 3}" height="${SIZE - 3}" rx="14" fill="rgba(16,28,22,0.72)" stroke="#f4d488" stroke-width="2.5" />
    <line x1="${HALF}" y1="10" x2="${HALF}" y2="${SIZE - 10}" stroke="#f4d488" stroke-width="1" opacity="0.18" />
    <line x1="10" y1="${HALF}" x2="${SIZE - 10}" y2="${HALF}" stroke="#f4d488" stroke-width="1" opacity="0.18" />
    <g id="mm-dyn"></g>
    <text x="${HALF}" y="15" text-anchor="middle" fill="#ffe24a" font-size="12" font-weight="900" ${halo}>N</text>
    <text x="${HALF}" y="${SIZE - 6}" text-anchor="middle" fill="#fff7d6" font-size="11" font-weight="800" ${halo}>S</text>
    <text x="${SIZE - 8}" y="${HALF + 4}" text-anchor="middle" fill="#fff7d6" font-size="11" font-weight="800" ${halo}>E</text>
    <text x="9" y="${HALF + 4}" text-anchor="middle" fill="#fff7d6" font-size="11" font-weight="800" ${halo}>W</text>
  </svg>`;
  document.body.appendChild(root);
  dynamicGroup = root.querySelector("#mm-dyn");
}

function dot(cx: number, cy: number, r: number, fill: string, stroke = "#0c1812") {
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" />`;
}
function diamond(cx: number, cy: number, r: number, fill: string) {
  return `<path d="M ${cx.toFixed(1)} ${(cy - r).toFixed(1)} L ${(cx + r).toFixed(1)} ${cy.toFixed(1)} L ${cx.toFixed(1)} ${(cy + r).toFixed(1)} L ${(cx - r).toFixed(1)} ${cy.toFixed(1)} Z" fill="${fill}" stroke="#111827" stroke-width="1.2" />`;
}
function fortress(cx: number, cy: number) {
  // 보라 성벽 + 붉은 깃발 — 몬스터 요새 입구. 동굴(원형)·보스(마름모)·집과 한눈에 구분되게 사각+깃발 형태.
  const s = 3.4;
  const wall = `<rect x="${(cx - s).toFixed(1)}" y="${(cy - s).toFixed(1)}" width="${(s * 2).toFixed(1)}" height="${(s * 2).toFixed(1)}" rx="0.6" fill="#a855f7" stroke="#1f1033" stroke-width="1.2" />`;
  const pole = `<line x1="${cx.toFixed(1)}" y1="${(cy - s).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy - s - 6.5).toFixed(1)}" stroke="#1f1033" stroke-width="1.1" />`;
  const flag = `<path d="M ${cx.toFixed(1)} ${(cy - s - 6.5).toFixed(1)} L ${(cx + 5).toFixed(1)} ${(cy - s - 4.7).toFixed(1)} L ${cx.toFixed(1)} ${(cy - s - 2.9).toFixed(1)} Z" fill="#f43f5e" stroke="#1f1033" stroke-width="0.8" stroke-linejoin="round" />`;
  return wall + pole + flag;
}

function buildMarkers(ctx: MinimapContext): string {
  let svg = "";
  for (const cave of ctx.caves()) svg += dot(proj(cave.root.position.x), proj(cave.root.position.z), 2.4, "#3f2d20", "#0a0705");
  for (const fort of ctx.fortresses()) svg += fortress(proj(fort.root.position.x), proj(fort.root.position.z));
  for (const home of ctx.homes()) {
    const hx = proj(home.x), hy = proj(home.z);
    svg += `<rect x="${(hx - 3).toFixed(1)}" y="${(hy - 1.5).toFixed(1)}" width="6" height="5" fill="#fef3c7" stroke="#0c1812" stroke-width="1" /><path d="M ${(hx - 4).toFixed(1)} ${(hy - 1).toFixed(1)} L ${hx.toFixed(1)} ${(hy - 5).toFixed(1)} L ${(hx + 4).toFixed(1)} ${(hy - 1).toFixed(1)} Z" fill="#34d399" stroke="#0c1812" stroke-width="1" />`;
  }
  for (const boss of ctx.dragons()) svg += diamond(proj(boss.root.position.x), proj(boss.root.position.z), 4, "#f87171");
  for (const fb of ctx.fieldBosses()) if (fb.fieldBossId) svg += diamond(proj(fb.root.position.x), proj(fb.root.position.z), 3.4, "#fb923c");
  return svg;
}

export function tickMinimap(ctx: MinimapContext, delta: number) {
  if (!ctx.active()) {
    if (root) root.style.display = "none";
    return;
  }
  ensureDom();
  root!.style.display = "block";
  markerTimer -= delta;
  if (markerTimer <= 0) {
    markerTimer = 0.3; // 마커(집/보스/동굴)는 ~3Hz 갱신, 플레이어는 매 프레임
    markerSvg = buildMarkers(ctx);
  }
  const px = proj(ctx.playerX());
  const pz = proj(ctx.playerZ());
  const yaw = ctx.yaw();
  const fx = -Math.sin(yaw), fy = -Math.cos(yaw); // 바라보는 방향(맵 좌표) — yaw 0 = 북(위)
  const gx = -fy, gy = fx;
  const tip = `${(px + fx * 9).toFixed(1)},${(pz + fy * 9).toFixed(1)}`;
  const left = `${(px + gx * 5 - fx * 3).toFixed(1)},${(pz + gy * 5 - fy * 3).toFixed(1)}`;
  const right = `${(px - gx * 5 - fx * 3).toFixed(1)},${(pz - gy * 5 - fy * 3).toFixed(1)}`;
  dynamicGroup!.innerHTML = `${markerSvg}<circle cx="${px.toFixed(1)}" cy="${pz.toFixed(1)}" r="2.6" fill="#fff7d6" stroke="#111827" stroke-width="1.4" /><polygon points="${tip} ${left} ${right}" fill="#ffe24a" stroke="#111827" stroke-width="1.4" stroke-linejoin="round" />`;
}
