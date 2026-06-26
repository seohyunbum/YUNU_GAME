// 장착 정령 미니 뱃지 — 화면 좌측 상단에 작고 귀엽게 표시(소환수 우측 표시의 ~1/3 크기).
// 등급이 높을수록 화려(테두리·발광·둥둥 애니메이션 강도 차등). leaf(ui): main 미import.
let el: HTMLElement | null = null;
let lastKey = "";

export interface SpiritBadgeView {
  emoji: string;
  color: string;
  glow: string;
  label: string;
  level: number;
  gradeIndex: number; // 0(일반)~4(전설) — 화려함 차등
}

function ensureDom(): HTMLElement {
  if (el) return el;
  el = document.createElement("div");
  el.className = "spirit-badge hidden";
  el.setAttribute("data-spirit-badge", "");
  document.body.appendChild(el);
  return el;
}

// renderHud 에서 매번 호출 — 변경 시에만 DOM 갱신(매 프레임 innerHTML 방지).
export function updateSpiritBadge(view: SpiritBadgeView | null): void {
  const node = ensureDom();
  if (!view) {
    if (lastKey !== "") { lastKey = ""; node.classList.add("hidden"); node.innerHTML = ""; }
    return;
  }
  const key = `${view.emoji}|${view.color}|${view.label}|${view.level}|${view.gradeIndex}`;
  if (key === lastKey) return;
  lastKey = key;
  node.classList.remove("hidden");
  // gradeIndex 0~4 → 발광 강도·테두리 두께 차등
  const ring = 1 + view.gradeIndex; // px
  const shadow = 6 + view.gradeIndex * 5; // px blur
  node.style.borderColor = view.color;
  node.style.borderWidth = `${ring}px`;
  node.style.boxShadow = `0 0 ${shadow}px ${view.glow}`;
  node.classList.toggle("spirit-badge-shiny", view.gradeIndex >= 3); // 영웅·전설은 반짝 애니메이션
  node.innerHTML = `<span class="spirit-badge-emoji">${view.emoji}</span><span class="spirit-badge-lv" style="color:${view.color}">Lv${view.level}</span>`;
  node.title = `${view.label} 정령 Lv${view.level}`;
}
