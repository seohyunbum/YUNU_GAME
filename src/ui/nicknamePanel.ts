import { confirmNickname, loadNickname, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "../game/nickname";

// 최초 실행 닉네임 설정 모달 — 닫기/우회 불가. 확정되면 onReady(nickname) 를 부른다.
// 이미 닉네임이 있으면 모달 없이 즉시 onReady.

export function ensureNickname(onReady: (nickname: string) => void) {
  const existing = loadNickname();
  if (existing) {
    onReady(existing);
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "nickname-overlay";
  overlay.innerHTML = `
      <section class="nickname-modal">
        <h2>모험가 닉네임 정하기</h2>
        <p class="nickname-subtitle">앞으로 파티 친구들에게 보일 이름이에요. 신중하게 정해 주세요!</p>
        <input class="nickname-input" data-nickname-input type="text" maxlength="${NICKNAME_MAX_LENGTH}" placeholder="${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}글자 (한글·영문·숫자·띄어쓰기·기호)" autocomplete="off" />
        <p class="nickname-error" data-nickname-error></p>
        <button class="nickname-confirm" data-nickname-confirm>확정</button>
        <p class="nickname-notice">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2 1 21h22L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><line x1="12" y1="9" x2="12" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="12" cy="17.4" r="1.2" fill="currentColor" /></svg>
          이미 있는 닉네임이나 비속어, 욕 등은 사용 불가합니다. 한번 정한 닉네임은 변경할 수 없습니다.
        </p>
      </section>
    `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>("[data-nickname-input]")!;
  const errorEl = overlay.querySelector<HTMLElement>("[data-nickname-error]")!;
  const confirmButton = overlay.querySelector<HTMLButtonElement>("[data-nickname-confirm]")!;

  const tryConfirm = () => {
    const result = confirmNickname(input.value);
    if (!result.ok) {
      errorEl.textContent = result.reason;
      input.focus();
      return;
    }
    overlay.remove();
    onReady(result.name);
  };

  confirmButton.addEventListener("click", tryConfirm);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") tryConfirm();
    event.stopPropagation(); // 게임 단축키(R/T/E 등)로 새지 않게
  });
  input.addEventListener("input", () => {
    errorEl.textContent = "";
  });
  setTimeout(() => input.focus(), 50);
}
