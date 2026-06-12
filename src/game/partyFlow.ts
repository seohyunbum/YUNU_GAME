import type { PresenceData } from "./party";

// 파티 합류 오케스트레이션 (4차) —
// "수락하면: 양쪽 다 타이틀이면 같이 게임 시작, 내가 인게임이면 친구가 내 화면으로 소환"을 구현한다.
// 실제 게임 능력(시작/소환)은 main 이 context 로 제공하고, 여기서는 시점만 결정한다.

export interface PartyFlowContext {
  isInGame(): boolean;
  startNewGame(): void;
  // 호스트가 있는 맵·좌표 근처로 이동 (맵 레벨 잠금 무시)
  summonTo(mapId: string, x: number, z: number): void;
  showMessage(text: string): void;
}

let context: PartyFlowContext | null = null;
let pendingSummonHost: string | null = null;
let waitNoticeShown = false;

export function initPartyFlow(flowContext: PartyFlowContext) {
  context = flowContext;
}

// 게임이 자동 시작되면 파티 패널이 화면을 덮은 채 남지 않도록 닫는다 (node 테스트 가드)
function closePartyOverlay() {
  if (typeof document !== "undefined") document.querySelector(".party-overlay")?.remove();
}

// 게스트: 파티 요청을 수락해 세션에 합류했을 때 — 호스트의 첫 프레즌스가 오면 그 곁으로 간다.
export function beginGuestJoinFlow(hostNickname: string) {
  pendingSummonHost = hostNickname;
  waitNoticeShown = false;
}

// 호스트: 게스트가 들어왔는데 아직 타이틀이면 함께 게임을 시작한다.
export function hostOnGuestJoined(guestNickname: string) {
  if (!context) return;
  if (!context.isInGame()) {
    closePartyOverlay();
    context.startNewGame();
    context.showMessage(`${guestNickname} 님과 파티 게임을 시작합니다!`);
  }
}

// 프레즌스 수신 훅 — 게스트 합류 흐름에서 호스트 위치가 처음 보이면 소환을 실행한다.
export function partyFlowOnPresences(list: PresenceData[]) {
  if (!context || !pendingSummonHost) return;
  const host = list.find((entry) => entry.nickname === pendingSummonHost && entry.inGame);
  if (!host) {
    // 방장이 동굴/집 안에 있으면 inGame=false 로 온다 — 침묵 대기 대신 안내하고, 타이틀 게스트는 먼저 시작해 둔다
    const indoors = list.find((entry) => entry.nickname === pendingSummonHost);
    if (indoors && !waitNoticeShown) {
      waitNoticeShown = true;
      if (!context.isInGame()) {
        closePartyOverlay();
        context.startNewGame();
      }
      context.showMessage("파티에 들어왔어요! 방장이 동굴이나 집에서 나오면 곁으로 이동합니다.");
    }
    return;
  }
  pendingSummonHost = null;
  if (!context.isInGame()) {
    closePartyOverlay();
    context.startNewGame();
    context.showMessage("파티 게임을 시작합니다! 방장 곁으로 이동할게요.");
  }
  context.summonTo(host.mapId, host.x, host.z);
}

export function resetPartyFlow() {
  pendingSummonHost = null;
  waitNoticeShown = false;
}
