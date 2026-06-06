// 큰 순간 배너 — 화면 중앙에 스케일-바운스로 등장했다 사라지는 축하 텍스트.
// (Web Animations API 사용 — 별도 CSS 불필요)

export type BannerKind = "levelup" | "rare" | "epic" | "victory";

const KIND_STYLE: Record<BannerKind, { color: string; glow: string }> = {
  levelup: { color: "#ffe066", glow: "rgba(255,210,60,0.65)" },
  rare: { color: "#9fe8ff", glow: "rgba(120,210,255,0.6)" },
  epic: { color: "#ffd34d", glow: "rgba(255,200,60,0.72)" },
  victory: { color: "#ffd9d9", glow: "rgba(255,120,120,0.6)" },
};

export function createBannerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:absolute",
    "top:24%",
    "left:50%",
    "transform:translate(-50%,-50%)",
    "font-size:clamp(28px,6vw,64px)",
    "font-weight:800",
    "letter-spacing:0.02em",
    "text-align:center",
    "pointer-events:none",
    "opacity:0",
    "z-index:30",
    "white-space:nowrap",
  ].join(";");
  return el;
}

export function showBanner(el: HTMLDivElement, text: string, kind: BannerKind) {
  const style = KIND_STYLE[kind];
  el.textContent = text;
  el.style.color = style.color;
  el.style.textShadow = `0 2px 12px rgba(0,0,0,0.55), 0 0 24px ${style.glow}`;
  el.animate(
    [
      { opacity: 0, transform: "translate(-50%,-50%) scale(0.6)" },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1.12)", offset: 0.18 },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1.0)", offset: 0.3 },
      { opacity: 1, transform: "translate(-50%,-50%) scale(1.0)", offset: 0.7 },
      { opacity: 0, transform: "translate(-50%,-58%) scale(1.0)" },
    ],
    { duration: 1800, easing: "ease-out" },
  );
}
