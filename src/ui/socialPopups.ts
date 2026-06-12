// 전역 소셜 팝업 — 친구 요청/파티 초대를 타이틀이든 인게임이든 화면 위에 띄운다.
// 큐 방식: 동시에 여러 개가 오면 순서대로 하나씩 보여 준다.

interface PopupRequest {
  title: string;
  body: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept(): void;
  onDecline(): void;
}

const queue: PopupRequest[] = [];
let showing = false;

export function showSocialPopup(request: PopupRequest) {
  queue.push(request);
  if (!showing) showNext();
}

function showNext() {
  const request = queue.shift();
  if (!request) {
    showing = false;
    return;
  }
  showing = true;
  document.exitPointerLock?.(); // 인게임 시점 고정 중에도 버튼을 누를 수 있게
  const overlay = document.createElement("div");
  overlay.className = "social-popup";
  overlay.innerHTML = `
      <section class="social-popup-card">
        <strong>${escapeHtml(request.title)}</strong>
        <p>${escapeHtml(request.body)}</p>
        <div class="social-popup-actions">
          <button class="accept" data-popup-accept>${escapeHtml(request.acceptLabel)}</button>
          <button data-popup-decline>${escapeHtml(request.declineLabel)}</button>
        </div>
      </section>
    `;
  document.body.appendChild(overlay);
  const finish = (accepted: boolean) => {
    overlay.remove();
    if (accepted) request.onAccept();
    else request.onDecline();
    showNext();
  };
  overlay.querySelector("[data-popup-accept]")!.addEventListener("click", () => finish(true));
  overlay.querySelector("[data-popup-decline]")!.addEventListener("click", () => finish(false));
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 단방향 알림 토스트 — 답할 필요 없는 소식(친구 수락 등)을 잠깐 보여 준다
export function showSocialToast(text: string) {
  const toast = document.createElement("div");
  toast.className = "social-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 30);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3_200);
}
