// 엔딩 크레딧 화면 — 반투명 오버레이 위로 크레딧이 스크롤된다 (뒤로 폭죽이 비쳐 보인다).
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const CREDITS: readonly { role: string; name: string }[] = [
  { role: "총괄 디렉터 · 게임 디자인", name: "연우" },
  { role: "개발 총괄", name: "아빠" },
  { role: "AI 프로그래머", name: "Claude Code" },
  { role: "AI 프로그래머", name: "Codex" },
  { role: "특별 출연", name: "잼미니 · 새끼용들 · 마을 기사단" },
  { role: "몬스터 연기", name: "좀비 · 묘지귀신 · 불곰 · 바위전갈" },
  { role: "최종 보스", name: "불멸의 존재" },
  { role: "플레이테스트", name: "연우" },
];

export function showEndingScreen(host: HTMLElement, onClose: () => void) {
  if (host.querySelector(".ending-screen")) return;
  const overlay = document.createElement("div");
  overlay.className = "ending-screen";
  const rows = CREDITS.map((credit) => `<div class="ending-credit"><small>${escapeHtml(credit.role)}</small><strong>${escapeHtml(credit.name)}</strong></div>`).join("");
  overlay.innerHTML = `
    <div class="ending-scroll">
      <div class="ending-roll">
        <h1>🎆 불멸의 존재 토벌 🎆</h1>
        <p class="ending-subtitle">1인칭 야생 마을 — 모든 챕터 클리어</p>
        <h2>만든 사람들</h2>
        ${rows}
        <p class="ending-thanks">그리고, 끝까지 모험한 당신.</p>
        <p class="ending-outro">야생 마을의 이야기는 계속됩니다…</p>
      </div>
    </div>
    <button class="ending-continue" data-ending-close>모험 계속하기</button>
  `;
  host.appendChild(overlay);
  overlay.querySelector<HTMLButtonElement>("[data-ending-close]")?.addEventListener("click", () => {
    overlay.remove();
    onClose();
  });
}
