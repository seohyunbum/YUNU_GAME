import { normalizePartyCode, PartySession, PARTY_MAX_MEMBERS, type PartyMember } from "../game/party";

// 파티 로비 모달 — 방 만들기 / 코드 참가 / 로스터 표시.
// 3차: 모달을 닫아도 세션은 유지된다(게임 중 동기화). 이벤트 핸들러는 항상
// "지금 떠 있는" 모달 DOM 을 document 에서 찾아 갱신한다(재오픈 대응).

let activeSession: PartySession | null = null;
let lastMembers: PartyMember[] = [];
let lastStatus = "";

export function currentPartySession() {
  return activeSession;
}

export function initPartyLobby(getNickname: () => string) {
  document.querySelector("[data-title-party]")?.addEventListener("click", () => openPartyLobby(getNickname()));
}

function setStatus(text: string, isError = false) {
  lastStatus = text;
  const statusEl = document.querySelector<HTMLElement>("[data-party-status]");
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function renderMembers(members: PartyMember[]) {
  lastMembers = members;
  const membersEl = document.querySelector<HTMLElement>("[data-party-members]");
  if (!membersEl) return;
  membersEl.innerHTML = members
    .map((member) => `<li>${member.isHost ? "👑 " : ""}${member.nickname}${member.isHost ? " (방장)" : ""}</li>`)
    .join("");
}

function showRoomView() {
  const home = document.querySelector<HTMLElement>("[data-party-home]");
  const room = document.querySelector<HTMLElement>("[data-party-room]");
  if (home) home.hidden = true;
  if (room) room.hidden = false;
  const codeLine = document.querySelector<HTMLElement>("[data-party-code-line]");
  const codeValue = document.querySelector<HTMLElement>("[data-party-code-value]");
  if (codeLine && codeValue && activeSession?.role === "host") {
    codeValue.textContent = activeSession.code;
    codeLine.hidden = false;
  }
}

const sessionEvents = {
  onStatus: (text: string) => setStatus(text),
  onRoster: (members: PartyMember[]) => renderMembers(members),
  onError: (text: string) => setStatus(text, true),
  onClosed: () => {
    activeSession = null;
    lastMembers = [];
    const home = document.querySelector<HTMLElement>("[data-party-home]");
    const room = document.querySelector<HTMLElement>("[data-party-room]");
    const codeLine = document.querySelector<HTMLElement>("[data-party-code-line]");
    const membersEl = document.querySelector<HTMLElement>("[data-party-members]");
    if (home) home.hidden = false;
    if (room) room.hidden = true;
    if (codeLine) codeLine.hidden = true;
    if (membersEl) membersEl.innerHTML = "";
  },
};

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
          <p class="party-hint">같은 주소로 접속한 친구에게 초대 코드를 알려 주세요. 방장이 게임을 진행하는 호스트가 됩니다. 창을 닫아도 파티는 유지됩니다.</p>
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
  const codeInput = overlay.querySelector<HTMLInputElement>("[data-party-code]")!;

  // 이미 파티 중이면 방 화면 + 최근 상태 복원
  if (activeSession) {
    showRoomView();
    renderMembers(lastMembers);
    setStatus(lastStatus);
  }

  overlay.querySelector("[data-party-host]")!.addEventListener("click", () => {
    if (activeSession) return;
    activeSession = PartySession.host(nickname, sessionEvents);
    showRoomView();
  });
  overlay.querySelector("[data-party-join]")!.addEventListener("click", () => {
    if (activeSession) return;
    const code = normalizePartyCode(codeInput.value);
    if (!code) {
      setStatus("초대 코드는 영문/숫자 6자리예요. 다시 확인해 주세요.", true);
      return;
    }
    activeSession = PartySession.join(code, nickname, sessionEvents);
    showRoomView();
  });
  overlay.querySelector("[data-party-copy]")!.addEventListener("click", () => {
    void navigator.clipboard?.writeText(activeSession?.code ?? "").then(() => setStatus("초대 코드를 복사했습니다!"));
  });
  overlay.querySelector("[data-party-leave]")!.addEventListener("click", () => {
    activeSession?.close();
    setStatus("파티에서 나왔습니다.");
  });
  overlay.querySelector("[data-party-close]")!.addEventListener("click", () => overlay.remove());
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") overlay.querySelector<HTMLButtonElement>("[data-party-join]")!.click();
    event.stopPropagation();
  });
}
