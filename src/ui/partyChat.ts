// 파티 채팅 — Enter 로 입력창을 열고 파티원에게 메시지 전송. 귓속말은 /w <닉> <메시지> 또는 @<닉> <메시지>.
// leaf: main.ts 를 import 하지 않는다 (DOM mount + 좁은 콜백만 받는다).

export interface ChatMessage {
  type: "chat";
  from: string;
  text: string;
  to?: string; // 귓속말 대상 닉네임 (없으면 파티 전체)
}

export interface PartyChatOptions {
  mount: HTMLElement;
  isPartyActive(): boolean;
  isInGame(): boolean;
  getMembers(): string[]; // 파티원 닉네임(본인 포함)
  myNickname(): string;
  send(message: ChatMessage): void;
  exitPointerLock?(): void;
}

export interface PartyChatHandle {
  appendIncoming(message: { from: string; text: string; to?: string }): void;
  tryOpen(): boolean; // 파티 인게임이면 입력창을 열고 true. 아니면 false (Enter 가 게임에서 무시되도록).
  isOpen(): boolean;
}

const MAX_LEN = 120;
const MAX_LINES = 50;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 입력 파싱 (순수 — 골든 테스트 가능). 빈 메시지/모르는 대상은 error. 그 외 {text, to?}.
export function parseChatInput(raw: string, members: string[], myNickname: string): { text: string; to?: string } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "" };
  let to: string | undefined;
  let body = trimmed;
  const wMatch = /^\/(?:w|귓)\s+(\S+)\s+([\s\S]+)$/.exec(trimmed);
  const atMatch = /^@(\S+)\s+([\s\S]+)$/.exec(trimmed);
  if (wMatch) { to = wMatch[1]; body = wMatch[2]; } else if (atMatch) { to = atMatch[1]; body = atMatch[2]; }
  if (to !== undefined) {
    if (to === myNickname) return { error: "자기 자신에게는 귓속말할 수 없어요." };
    if (!members.includes(to)) return { error: `'${to}' 님은 파티에 없습니다.` };
  }
  body = body.trim().slice(0, MAX_LEN);
  if (!body) return { error: "" };
  return to !== undefined ? { text: body, to } : { text: body };
}

export function setupPartyChat(opts: PartyChatOptions): PartyChatHandle {
  const root = document.createElement("div");
  root.className = "party-chat";
  const log = document.createElement("div");
  log.className = "party-chat-log";
  const input = document.createElement("input");
  input.className = "party-chat-input hidden";
  input.type = "text";
  input.maxLength = MAX_LEN + 24; // 귓속말 접두( /w 닉 ) 여유
  input.placeholder = "메시지 입력 · /w 닉 으로 귓속말 · Esc 취소";
  input.autocomplete = "off";
  root.append(log, input);
  opts.mount.appendChild(root);

  let open = false;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;

  const wake = () => {
    log.classList.remove("faded");
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => log.classList.add("faded"), 7_000);
  };

  const pushLine = (html: string) => {
    const line = document.createElement("div");
    line.className = "party-chat-line";
    line.innerHTML = html;
    log.appendChild(line);
    while (log.childElementCount > MAX_LINES) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
    wake();
  };

  const systemLine = (text: string) => pushLine(`<span class="party-chat-sys">${escapeHtml(text)}</span>`);
  const renderLine = (from: string, text: string, to?: string) => {
    if (to) pushLine(`<span class="party-chat-line--whisper"><span class="party-chat-from">${escapeHtml(from)}→${escapeHtml(to)}</span> ${escapeHtml(text)}</span>`);
    else pushLine(`<span class="party-chat-from">${escapeHtml(from)}</span> ${escapeHtml(text)}`);
  };

  const close = () => {
    open = false;
    input.value = "";
    input.classList.add("hidden");
    input.blur();
  };

  const submit = () => {
    const parsed = parseChatInput(input.value, opts.getMembers(), opts.myNickname());
    if ("error" in parsed) {
      if (parsed.error) systemLine(parsed.error);
      close();
      return;
    }
    const me = opts.myNickname();
    opts.send({ type: "chat", from: me, text: parsed.text, to: parsed.to });
    renderLine(me, parsed.text, parsed.to); // 보낸 사람은 로컬에서 즉시 표시 (네트워크는 상대에게만 전달)
    close();
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") { event.preventDefault(); submit(); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  input.addEventListener("blur", () => { if (open) close(); });

  return {
    appendIncoming(message) {
      renderLine(message.from, message.text, message.to);
    },
    tryOpen() {
      if (open) return true;
      if (!opts.isPartyActive() || !opts.isInGame()) return false;
      if (typeof document !== "undefined" && document.querySelector(".party-overlay")) return false; // 파티 패널 열려 있으면 무시
      open = true;
      opts.exitPointerLock?.();
      input.classList.remove("hidden");
      input.focus();
      wake();
      return true;
    },
    isOpen() {
      return open;
    },
  };
}
