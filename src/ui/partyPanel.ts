import { createDirectory, filterUsers, type DirectoryUser, type PartyDirectory } from "../game/directory";
import { beginGuestJoinFlow, hostOnGuestJoined, resetPartyFlow } from "../game/partyFlow";
import { electSuccessor, normalizePartyCode, PartySession, PARTY_MAX_MEMBERS, type PartyEvents, type PartyMember } from "../game/party";
import { showSocialPopup, showSocialToast } from "./socialPopups";

// 파티 패널 (4차) — 친구 기반 초대 흐름.
// 검색 → 유저 목록 → 친구추가 요청(접속 중일 때만) → 상대 팝업 승인 → 친구 →
// 친구 클릭 → 파티 요청 → 상대 팝업 수락 → 합류(동시 시작 또는 소환).
// 디렉터리 미설정(배포본에서 Firebase 키 없음)이면 기존 초대 코드 방식만 노출.

let activeSession: PartySession | null = null;
let lastMembers: PartyMember[] = [];
let lastStatus = "";
let directory: PartyDirectory | null = null;
let directoryReady = false;
let myNickname = "";
let knownRosterSize = 1;
const pendingOutgoingInvites = new Set<string>(); // 내가 보낸 파티 요청 — 교차 초대 감지용

export function currentPartySession() {
  return activeSession;
}

// 세션별 이벤트 — 어느 세션의 콜백인지 식별해, 옛 세션의 늦은 콜백(특히 onClosed)이
// 새 파티 상태를 망가뜨리지 않게 한다. bind 전(생성자의 동기 콜백)은 통과시킨다.
function makeSessionEvents() {
  let self: PartySession | null = null;
  const isCurrent = () => self === null || self === activeSession;
  const events: PartyEvents = {
    onStatus: (text: string) => {
      if (isCurrent()) setStatus(text);
    },
    onRoster: (members: PartyMember[]) => {
      if (!isCurrent()) return;
      lastMembers = members;
      // 호스트: 새 게스트가 들어왔고 아직 타이틀이면 함께 게임 시작
      if (activeSession?.role === "host" && members.length > knownRosterSize) {
        const newest = members[members.length - 1];
        if (newest && !newest.isHost) {
          pendingOutgoingInvites.delete(newest.nickname); // 초대를 수락해 들어옴
          hostOnGuestJoined(newest.nickname);
        }
      }
      knownRosterSize = members.length;
      renderMembers(members);
    },
    onError: (text: string) => {
      if (isCurrent()) setStatus(text, true);
    },
    onClosed: () => {
      if (!isCurrent()) return;
      activeSession = null;
      lastMembers = [];
      knownRosterSize = 1;
      pendingOutgoingInvites.clear();
      resetPartyFlow(); // 잔존 소환 대기 제거 — 다음 파티에서 엉뚱한 소환 방지
      refreshPanelViews();
    },
    // C4 — 방장 이탈: 죽은 세션을 버리고, roster 기준 결정적 후계(닉네임 최소)를 모두가 동일 계산.
    // 승자는 같은 코드로 재호스팅, 나머지는 약간 늦게 재접속 → 현재 게임을 끊김 없이 이어 간다(재시작·재소환 없음).
    onHostLost: () => {
      if (!isCurrent()) return;
      const code = self?.code ?? null;
      const successor = electSuccessor(lastMembers);
      activeSession = null;
      knownRosterSize = 1;
      pendingOutgoingInvites.clear();
      resetPartyFlow();
      if (!code || !successor) {
        lastMembers = [];
        setStatus("방장과의 연결이 끊어졌습니다.", true);
        refreshPanelViews();
        return;
      }
      const amWinner = successor === myNickname;
      setStatus(amWinner ? "방장이 나갔어요 — 내가 새 방장이 됩니다…" : `방장이 나갔어요 — ${successor} 님이 새 방장이 됩니다…`);
      // 승자가 먼저 코드를 선점(1.5s)한 뒤 나머지가 재접속(3s). 실패하면 runMigration 이 스스로 치유한다.
      setTimeout(() => {
        if (activeSession) return; // 그 사이 다른 경로로 파티가 생겼으면 중단
        runMigration(code, amWinner);
      }, amWinner ? 1_500 : 3_000);
    },
  };
  return {
    events,
    bind(session: PartySession) {
      self = session;
      return session;
    },
  };
}

// C4 — 승계 자가치유: 같은 코드로 호스트 선점(승자) 또는 합류(나머지)를 시도하고, 실패하면 역할을 바꿔 재시도한다.
// 승자가 선점에 실패(경합 패배) → 게스트로 합류. 게스트가 합류 실패(호스트 아직/영영 안 뜸) → 몇 번 재시도 후 직접 호스트 떠맡기.
// 이로써 승자가 승계 도중 죽어도 남은 인원이 고립되지 않고, 더블클레임의 패자도 게스트로 안착한다.
function runMigration(code: string, amWinner: boolean, attempt = 0) {
  const scoped = makeSessionEvents();
  const session = amWinner
    ? PartySession.hostWithCode(code, myNickname, scoped.events)
    : PartySession.join(code, myNickname, scoped.events);
  activeSession = scoped.bind(session);
  knownRosterSize = activeSession.members().length;
  session.whenReady().then(
    () => {
      if (amWinner) showSocialToast("내가 새 방장이 되었어요. 친구를 다시 초대할 수 있어요.");
      refreshPanelViews();
    },
    () => {
      if (activeSession && !activeSession.isClosed()) return; // 다른 세션이 이미 자리 잡았으면 중단
      activeSession = null;
      if (amWinner) {
        runMigration(code, false, 0); // 코드 선점 실패(경합 패배) → 게스트로 합류
      } else if (attempt < 3) {
        setTimeout(() => {
          if (!activeSession) runMigration(code, false, attempt + 1); // 호스트가 아직 안 떴을 수 있음 — 재시도
        }, 1_500);
      } else {
        runMigration(code, true, 0); // 여러 번 합류 실패 = 승자가 죽음 → 내가 호스트를 떠맡는다
      }
    },
  );
}

export function initPartyLobby(getNickname: () => string) {
  // DEV/E2E 전용 — 디렉터리 팝업 DOM 을 거치지 않고 세션/승계 로직을 직접 구동·관측 (프로덕션 영향 없음)
  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__partyTest = {
      host: () => {
        myNickname = myNickname || getNickname();
        if (!activeSession || activeSession.isClosed()) {
          const scoped = makeSessionEvents();
          activeSession = scoped.bind(PartySession.host(myNickname, scoped.events));
          knownRosterSize = 1;
        }
        return activeSession?.code ?? null;
      },
      join: (code: string, from = "방장") => {
        myNickname = myNickname || getNickname();
        joinInvitedParty(from, code);
      },
      leave: () => activeSession?.close(),
      state: () => ({
        role: activeSession?.role ?? null,
        code: activeSession?.code ?? null,
        closed: activeSession ? activeSession.isClosed() : true,
        members: lastMembers.map((member) => member.nickname),
        count: lastMembers.length,
      }),
    };
  }
  document.querySelector("[data-title-party]")?.addEventListener("click", () => openPartyLobby(getNickname()));
  // 인게임 진입점 — O 키로 파티 패널 토글 (입력창·닉네임 모달 위에서는 무시)
  document.addEventListener("keydown", (event) => {
    if (event.code !== "KeyO" || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (document.querySelector(".nickname-overlay")) return;
    const open = document.querySelector(".party-overlay");
    if (open) {
      open.remove();
      return;
    }
    document.exitPointerLock?.();
    openPartyLobby(getNickname());
  });
  // 디렉터리는 패널과 무관하게 항상 연결 — 팝업(친구/파티 요청)을 어디서든 받기 위해
  void (async () => {
    const created = await createDirectory();
    if (!created) return;
    directory = created;
    const tryConnect = () => {
      const nickname = getNickname();
      if (!nickname) {
        setTimeout(tryConnect, 500);
        return;
      }
      myNickname = nickname;
      void created
        .connect(nickname, {
          onFriendRequest: (from) =>
            showSocialPopup({
              title: "친구 요청",
              body: `${from} 님이 친구가 되고 싶어 해요!`,
              acceptLabel: "승인",
              declineLabel: "거절",
              onAccept: () => {
                void created.respondFriendRequest(from, true).then(() => {
                  showSocialToast(`${from} 님과 친구가 되었어요!`);
                  refreshPanelViews();
                });
              },
              onDecline: () => void created.respondFriendRequest(from, false),
            }),
          onFriendAccepted: (by) => {
            showSocialToast(`${by} 님이 친구 요청을 승인했어요!`);
            refreshPanelViews();
          },
          onPartyInvite: (from, code) => {
            // 교차 초대(둘이 동시에 파티 요청) — 닉네임 사전순 작은 쪽 방을 살려 교착을 깬다
            if (pendingOutgoingInvites.has(from) && activeSession?.role === "host") {
              if (myNickname < from) {
                showSocialToast(`${from} 님과 서로 초대했어요 — 상대가 내 파티로 들어옵니다.`);
                return;
              }
              showSocialToast(`${from} 님과 서로 초대했어요 — ${from} 님 파티로 들어갑니다.`);
              joinInvitedParty(from, code);
              return;
            }
            const leaveNote = activeSession && lastMembers.length > 1 ? " (수락하면 지금 파티에서 나가게 돼요)" : "";
            showSocialPopup({
              title: "파티 요청",
              body: `${from} 님이 파티에 초대했어요!${leaveNote}`,
              acceptLabel: "수락",
              declineLabel: "거절",
              onAccept: () => joinInvitedParty(from, code),
              onDecline: () => {},
            });
          },
          onUsersChanged: () => refreshPanelViews(),
          onFriendsChanged: () => refreshPanelViews(),
        })
        .then(() => {
          directoryReady = true;
          refreshPanelViews();
        })
        .catch(() => {
          // 디렉터리 연결 실패 — 조용히 멈추지 말고 초대 코드 폴백으로 전환
          directory = null;
          directoryReady = false;
          setStatus("온라인 친구 서버에 연결하지 못했어요. 초대 코드로는 함께할 수 있어요.", true);
        });
    };
    tryConnect();
  })();
}

function setStatus(text: string, isError = false) {
  lastStatus = text;
  const statusEl = document.querySelector<HTMLElement>("[data-party-status]");
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function renderMembers(members: PartyMember[]) {
  const membersEl = document.querySelector<HTMLElement>("[data-party-members]");
  if (!membersEl) return;
  membersEl.innerHTML = members
    .map((member) => `<li>${member.isHost ? "👑 " : ""}${escapeHtml(member.nickname)}${member.isHost ? " (방장)" : ""}</li>`)
    .join("");
  const room = document.querySelector<HTMLElement>("[data-party-room]");
  if (room) room.hidden = members.length === 0 && !activeSession;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 초대 수락 — 새 세션의 welcome 이 확인된 뒤에야 기존 파티를 떠난다 (합류 실패 시 기존 파티 유지)
function joinInvitedParty(from: string, code: string) {
  const normalized = normalizePartyCode(code);
  if (!normalized) return;
  const previous = activeSession;
  const scoped = makeSessionEvents();
  const next = scoped.bind(PartySession.join(normalized, myNickname, scoped.events));
  next.whenReady().then(
    () => {
      activeSession = next;
      lastMembers = next.members();
      knownRosterSize = lastMembers.length;
      pendingOutgoingInvites.clear();
      previous?.close();
      beginGuestJoinFlow(from);
      refreshPanelViews();
    },
    () => {
      pendingOutgoingInvites.delete(from); // 실패 시에도 전이 상태를 정리 (성공 경로와 대칭)
      setStatus(`${from} 님의 파티에 들어가지 못했어요.${previous ? " 기존 파티는 그대로예요." : ""}`, true);
    },
  );
}

// 파티 요청 — 세션이 없으면 방을 만들고, 피어 서버에 열린 뒤 초대를 보낸다
async function requestParty(friend: string) {
  if (!directory) return;
  if (activeSession && activeSession.role === "guest") {
    setStatus("게스트는 파티 초대를 보낼 수 없어요. 방장에게 부탁하세요.", true);
    return;
  }
  if (!activeSession) {
    const scoped = makeSessionEvents();
    activeSession = scoped.bind(PartySession.host(myNickname, scoped.events));
    knownRosterSize = 1;
  }
  const session = activeSession;
  pendingOutgoingInvites.add(friend); // 클릭 즉시 등록 — 교차 초대 감지의 레이스 창을 닫는다
  setStatus(`${friend} 님에게 파티 요청을 보내는 중…`);
  try {
    await session.whenReady();
  } catch {
    pendingOutgoingInvites.delete(friend);
    // 기다리는 동안 다른 파티로 갈아탔다면(교차 초대 합류 등) 내 방이 닫힌 건 정상 — 에러 아님
    if (activeSession === session) setStatus("파티 방을 여는 데 실패했어요. 잠시 후 다시 시도해 주세요.", true);
    return;
  }
  if (activeSession !== session) return; // 대기 중 파티가 바뀌었으면 죽은 방 코드로 초대하지 않는다
  const result = await directory.sendPartyInvite(friend, session.code);
  if (result !== "sent") pendingOutgoingInvites.delete(friend);
  if (result === "sent") {
    setStatus(`${friend} 님에게 파티 요청을 보냈어요. 수락을 기다리는 중…`);
  } else if (result === "offline") setStatus(`${friend} 님이 지금 게임에 접속해 있지 않아 파티 요청을 보낼 수 없어요.`, true);
  else setStatus("파티 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.", true);
  refreshPanelViews();
}

async function requestFriend(target: DirectoryUser) {
  if (!directory) return;
  if (!target.online) {
    setStatus(`${target.nickname} 님이 지금 게임에 접속해 있지 않아 친구 요청을 보낼 수 없어요.`, true);
    return;
  }
  const result = await directory.sendFriendRequest(target.nickname);
  if (result === "sent") setStatus(`${target.nickname} 님에게 친구 요청을 보냈어요!`);
  else if (result === "offline") setStatus(`${target.nickname} 님이 지금 게임에 접속해 있지 않아 친구 요청을 보낼 수 없어요.`, true);
  else if (result === "already") setStatus(`${target.nickname} 님과는 이미 친구예요.`);
  else if (result === "self") setStatus("자기 자신에게는 보낼 수 없어요.", true);
  else setStatus("친구 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.", true);
}

async function refreshPanelViews() {
  renderMembers(lastMembers);
  const friendsEl = document.querySelector<HTMLElement>("[data-friend-list]");
  const usersEl = document.querySelector<HTMLElement>("[data-user-list]");
  if (!friendsEl || !usersEl || !directory || !directoryReady) return;
  const searchValue = document.querySelector<HTMLInputElement>("[data-user-search]")?.value ?? "";
  const [users, friends] = await Promise.all([directory.listUsers(), directory.listFriends()]);
  const friendSet = new Set(friends);
  const onlineByName = new Map(users.map((user) => [user.nickname, user.online]));

  friendsEl.innerHTML =
    friends.length === 0
      ? '<li class="party-empty">아직 친구가 없어요. 아래 유저 목록에서 친구를 찾아보세요!</li>'
      : friends
          .sort()
          .map((friend) => {
            const online = onlineByName.get(friend) ?? false;
            return `<li class="party-row" data-friend-row="${escapeHtml(friend)}">
                <span class="presence-dot${online ? " online" : ""}"></span>
                <span class="party-row-name">${escapeHtml(friend)}</span>
                <span class="party-row-actions">
                  <button data-party-request="${escapeHtml(friend)}" ${online ? "" : "disabled"}>파티 요청</button>
                  <button disabled title="준비 중">귓속말</button>
                </span>
              </li>`;
          })
          .join("");

  const visible = filterUsers(users, searchValue).filter((user) => !friendSet.has(user.nickname));
  usersEl.innerHTML =
    visible.length === 0
      ? '<li class="party-empty">표시할 유저가 없어요.</li>'
      : visible
          .map(
            (user) => `<li class="party-row">
              <span class="presence-dot${user.online ? " online" : ""}"></span>
              <span class="party-row-name">${escapeHtml(user.nickname)}</span>
              <span class="party-row-actions"><button data-friend-request="${escapeHtml(user.nickname)}" ${user.online ? "" : "disabled"}>친구추가 요청</button></span>
            </li>`,
          )
          .join("");

  usersEl.querySelectorAll<HTMLButtonElement>("[data-friend-request]").forEach((button) => {
    button.addEventListener("click", () => {
      const nickname = button.dataset.friendRequest as string;
      void requestFriend({ nickname, online: onlineByName.get(nickname) ?? false });
    });
  });
  friendsEl.querySelectorAll<HTMLButtonElement>("[data-party-request]").forEach((button) => {
    button.addEventListener("click", () => void requestParty(button.dataset.partyRequest as string));
  });
}

function openPartyLobby(nickname: string) {
  if (document.querySelector(".party-overlay")) return;
  myNickname = nickname;
  const overlay = document.createElement("div");
  overlay.className = "party-overlay";
  const social = directory
    ? `
        <input class="party-search" data-user-search type="text" placeholder="🔍 닉네임 검색" autocomplete="off" />
        <div class="inventory-label">내 친구</div>
        <ul class="party-list" data-friend-list></ul>
        <div class="inventory-label">모든 유저</div>
        <ul class="party-list" data-user-list></ul>`
    : `
        <p class="party-hint">온라인 친구 기능은 설정이 필요해요 (docs/party-system.md 참고). 지금은 초대 코드로만 함께할 수 있어요.</p>
        <button data-party-host>방 만들기</button>
        <div class="party-join-row">
          <input data-party-code maxlength="7" placeholder="초대 코드 입력" autocomplete="off" />
          <button data-party-join>참가</button>
        </div>`;
  overlay.innerHTML = `
      <section class="party-modal">
        <header>
          <h2>파티 (최대 ${PARTY_MAX_MEMBERS}명 · 단축키 O)</h2>
          <button class="icon-button" data-party-close>닫기</button>
        </header>
        <div class="party-room" data-party-room ${activeSession ? "" : "hidden"}>
          <div class="inventory-label">현재 파티</div>
          <ul class="party-members" data-party-members></ul>
          <button data-party-leave>파티 나가기</button>
        </div>
        <div class="party-social">${social}</div>
        <p class="party-status" data-party-status></p>
      </section>
    `;
  document.body.appendChild(overlay);

  overlay.querySelector("[data-party-close]")!.addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-party-leave]")!.addEventListener("click", () => {
    activeSession?.close();
    setStatus("파티에서 나왔습니다.");
  });
  overlay.querySelector<HTMLInputElement>("[data-user-search]")?.addEventListener("input", () => void refreshPanelViews());
  overlay.querySelector<HTMLInputElement>("[data-user-search]")?.addEventListener("keydown", (event) => event.stopPropagation());

  // 레거시 초대 코드 폴백 (디렉터리 미설정 시)
  overlay.querySelector("[data-party-host]")?.addEventListener("click", () => {
    if (activeSession && !activeSession.isClosed()) return; // zombie(이미 닫힌) 세션이면 새로 만들도록 통과
    const scoped = makeSessionEvents();
    activeSession = scoped.bind(PartySession.host(nickname, scoped.events));
    setStatus(`방을 만들었어요. 초대 코드: ${activeSession.code}`);
    refreshPanelViews();
  });
  overlay.querySelector("[data-party-join]")?.addEventListener("click", () => {
    if (activeSession && !activeSession.isClosed()) return; // zombie 세션이면 새로 참가하도록 통과
    const input = overlay.querySelector<HTMLInputElement>("[data-party-code]")!;
    const code = normalizePartyCode(input.value);
    if (!code) {
      setStatus("초대 코드는 영문/숫자 6자리예요.", true);
      return;
    }
    const scoped = makeSessionEvents();
    activeSession = scoped.bind(PartySession.join(code, nickname, scoped.events));
    refreshPanelViews();
  });

  setStatus(lastStatus);
  renderMembers(lastMembers);
  void refreshPanelViews();
}
