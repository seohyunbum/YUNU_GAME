// 퀘스트(목표) 상세 클리어 가이드 팝업 — 미완료 퀘스트 카드 탭/클릭 시 표시.
// 특히 모바일: 카드 hover 툴팁이 없어 클리어 방법을 알기 어려운 문제 해소. 자체 인라인 스타일·textContent(XSS 안전).
export function showObjectiveGuide(
  parent: HTMLElement,
  q: { title: string; detail: string; progress: string; rewardLabel: string; touch: boolean; heading?: string },
): void {
  parent.querySelector(".objective-guide")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "objective-guide";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:18px;pointer-events:auto;"; // 부모 .game-ui 가 pointer-events:none 라 명시 auto — 닫기 버튼·배경 클릭이 먹게(버그 수정)
  const box = document.createElement("div");
  box.style.cssText =
    "max-width:min(92vw,440px);max-height:80vh;overflow:auto;background:#16241c;border:2px solid #f4d488;border-radius:14px;padding:18px;color:#fdf6e3;font-size:14px;line-height:1.55;box-shadow:0 8px 30px rgba(0,0,0,.5);";
  const add = (text: string, style: string) => {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = style;
    box.append(d);
  };
  add(`📜 ${q.title}`, "font-weight:800;font-size:16px;color:#ffe24a;margin-bottom:8px;");
  add(q.heading ?? "📋 클리어 방법", "font-weight:700;color:#bfe3b0;margin-bottom:2px;");
  add(q.detail, "margin-bottom:10px;");
  if (q.progress) add(`진행도 — ${q.progress}`, "color:#cbd5e1;margin-bottom:4px;");
  if (q.rewardLabel) add(`🎁 보상 — ${q.rewardLabel}`, "color:#fbbf77;margin-bottom:10px;");
  if (q.touch)
    add(
      "📱 조이스틱=이동 · 화면 드래그=시점 · 👊버튼=채집/공격/상호작용 · 핫바·가방 아이템 탭=사용·설치",
      "font-size:12px;color:#9fb8c8;background:rgba(255,255,255,.05);border-radius:8px;padding:8px;margin-bottom:10px;",
    );
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "닫기";
  btn.style.cssText =
    "width:100%;padding:12px;border:0;border-radius:10px;background:#f4d488;color:#1a2b1f;font-weight:800;font-size:15px;";
  const close = () => overlay.remove();
  btn.addEventListener("click", close);
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false });
  box.append(btn);
  overlay.append(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  parent.append(overlay);
}
