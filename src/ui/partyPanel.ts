import { normalizePartyCode, PartySession, PARTY_MAX_MEMBERS, type PartyMember } from "../game/party";

// 파티 로비 모달 (2차) — 방 만들기 / 코드 참가 / 로스터 표시.
// 자체 DOM·세션을 관리하고, main 은 타이틀 버튼에 open 만 연결한다.

let activeSession: PartySession | null = null;

export function currentPartySession() {
  return activeSession;
}

export function initPartyLobby(getNickname: () => string) {
  document.querySelector("[data-title-party]")?.addEventListener("click", () => openPartyLobby(getNickname()));
}

function openPartyLobby(nickname: string) {
  if (document.querySelector(".party-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "party-overlay";
  overlay.innerHTML = `
      <section class="party-modal">
        <header>
          <h2>파티 (최대 ${PARTY_MAX_MEMBERS}명)</h2>
          <button class="icon-button" data-party-close>닫기</button>
        </header>
        <div class="party-home" data-party-home>
          <button data-party-host>방 만들기</button>
          <div class="party-join-row">
            <input data-party-code maxlength="7" placeholder="초대 코드 입력" autocomplete="off" />
            <button data-party-join>참가</button>
          </div>
          <p class="party-hint">같은 주소로 접속한 친구에게 초대 코드를 알려 주세요. 방장이 게임을 진행하는 호스트가 됩니다.</p>
        </div>
        <div class="party-room" data-party-room hidden>
          <p class="party-code-line" data-party-code-line hidden>초대 코드: <b data-party-code-value></b> <button data-party-copy>복사</button></p>
          <ul class="party-members" data-party-members></ul>
          <button data-party-leave>파티 나가기</button>
        </div>
        <p class="party-status" data-party-status></p>
      </section>
    `;
  document.body.appendChild(overlay);

  const statusEl = overlay.querySelector<HTMLElement>("[data-party-status]")!;
  const homeEl = overlay.querySelector<HTMLElement>("[data-party-home]")!;
  const roomEl = overlay.querySelector<HTMLElement>("[data-party-room]")!;
  const membersEl = overlay.querySelector<HTMLElement>("[data-party-members]")!;
  const codeLine = overlay.querySelector<HTMLElement>("[data-party-code-line]")!;
  const codeValue = overlay.querySelector<HTMLElement>("[data-party-code-value]")!;
  const codeInput = overlay.querySelector<HTMLInputElement>("[data-party-code]")!;

  const setStatus = (text: string, isError = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  };
  const renderMembers = (members: PartyMember[]) => {
    membersEl.innerHTML = members
      .map((member) => `<li>${member.isHost ? "👑 " : ""}${member.nickname}${member.isHost ? " (방장)" : ""}</li>`)
      .join("");
  };
  const showRoom = () => {
    homeEl.hidden = true;
    roomEl.hidden = false;
  };
  const events = {
    onStatus: (text: string) => setStatus(text),
    onRoster: (members: PartyMember[]) => renderMembers(members),
    onError: (text: string) => setStatus(text, true),
    onClosed: () => {
      activeSession = null;
      homeEl.hidden = false;
      roomEl.hidden = true;
      codeLine.hidden = true;
      membersEl.innerHTML = "";
    },
  };

  overlay.querySelector("[data-party-host]")!.addEventListener("click", () => {
    if (activeSession) return;
    activeSession = PartySession.host(nickname, events);
    codeValue.textContent = activeSession.code;
    codeLine.hidden = false;
    showRoom();
  });
  overlay.querySelector("[data-party-join]")!.addEventListener("click", () => {
    if (activeSession) return;
    const code = normalizePartyCode(codeInput.value);
    if (!code) {
      setStatus("초대 코드는 영문/숫자 6자리예요. 다시 확인해 주세요.", true);
      return;
    }
    activeSession = PartySession.join(code, nickname, events);
    showRoom();
  });
  overlay.querySelector("[data-party-copy]")!.addEventListener("click", () => {
    void navigator.clipboard?.writeText(activeSession?.code ?? "").then(() => setStatus("초대 코드를 복사했습니다!"));
  });
  overlay.querySelector("[data-party-leave]")!.addEventListener("click", () => {
    activeSession?.close();
    setStatus("파티에서 나왔습니다.");
  });
  overlay.querySelector("[data-party-close]")!.addEventListener("click", () => {
    overlay.remove(); // 세션은 유지한 채 창만 닫는다 — 다시 열면 로스터가 보이도록 2차에선 단순화: 세션도 종료
    activeSession?.close();
  });
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") overlay.querySelector<HTMLButtonElement>("[data-party-join]")!.click();
    event.stopPropagation();
  });
}
