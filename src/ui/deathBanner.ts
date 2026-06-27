// 사망 알림 배너 — 화면 중앙에 "💀 사망했습니다"를 크게 띄우고 ~3.6초 페이드아웃. leaf(main 미import).
// 사망이 transient HUD 메시지로만 떠 잘 인지 안 되던 문제 보완. reason 은 textContent 로 넣어 XSS 안전.
let bannerEl: HTMLElement | null = null;

export function flashDeathBanner(reason: string): void {
  if (!bannerEl) {
    bannerEl = document.createElement("div");
    bannerEl.className = "death-banner";
    bannerEl.innerHTML = `<div class="death-banner-title">💀 사망했습니다</div><div class="death-banner-reason"></div><div class="death-banner-sub">아이템 일부를 죽은 자리에 떨어뜨렸고, 다시 부활했습니다.</div>`;
    document.body.appendChild(bannerEl);
  }
  const reasonEl = bannerEl.querySelector<HTMLElement>(".death-banner-reason");
  if (reasonEl) reasonEl.textContent = reason;
  bannerEl.classList.remove("death-banner-show");
  void bannerEl.offsetWidth; // 리플로우 강제 → 연속 사망에도 애니메이션 재시작
  bannerEl.classList.add("death-banner-show");
}
