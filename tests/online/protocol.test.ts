import { describe, expect, it } from "vitest";
import { createGame, getPlayerView } from "../../lib/game";
import {
  PEER_ID_PREFIX,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  generateRoomCode,
  createResumeToken,
  isGuestMessage,
  isPlayerView,
  isProtocolMessage,
  normalizeRoomCode,
  requireRoomCode,
  roomCodeToPeerId,
  type IntentMessage,
} from "../../lib/online/protocol";

describe("room code", () => {
  it("normalizes separators and casing", () => {
    expect(normalizeRoomCode(" ab-cd e2 ")).toBe("ABCDE2");
    expect(roomCodeToPeerId("AB-CD E2")).toBe(
      `${PEER_ID_PREFIX}abcde2`,
    );
  });

  it("rejects ambiguous glyphs and incorrect lengths", () => {
    expect(normalizeRoomCode("ABC0EF")).toBeNull();
    expect(normalizeRoomCode("ABCOEF")).toBeNull();
    expect(normalizeRoomCode("ABC1EF")).toBeNull();
    expect(normalizeRoomCode("ABCIEF")).toBeNull();
    expect(normalizeRoomCode("ABCDE")).toBeNull();
    expect(() => requireRoomCode("ABC0EF")).toThrow(/6자리/);
  });

  it("generates six characters from the approved alphabet", () => {
    let index = 0;
    const samples = [0, 0.1, 0.3, 0.5, 0.7, 0.999999];
    const code = generateRoomCode(() => samples[index++] ?? 0);

    expect(code).toHaveLength(6);
    expect(
      [...code].every((character) =>
        ROOM_CODE_ALPHABET.includes(character),
      ),
    ).toBe(true);
    expect(code).not.toMatch(/[0O1I]/);
  });

  it("creates unpredictable reconnect tokens", () => {
    const first = createResumeToken();
    const second = createResumeToken();

    expect(first).toMatch(/^resume:[0-9a-f-]{36}$/);
    expect(second).toMatch(/^resume:[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });
});

describe("protocol guards", () => {
  const intent: IntentMessage = {
    protocolVersion: PROTOCOL_VERSION,
    kind: "intent",
    seq: 3,
    actionId: "vote-3",
    sentAt: 100,
    action: { type: "vote", actorId: "guest", targetId: "ai-1" },
  };

  it("accepts a valid guest intent", () => {
    expect(isProtocolMessage(intent)).toBe(true);
    expect(isGuestMessage(intent)).toBe(true);
  });

  it("rejects mismatched versions and malformed payloads", () => {
    expect(
      isProtocolMessage({ ...intent, protocolVersion: 2 }),
    ).toBe(false);
    expect(
      isProtocolMessage({
        ...intent,
        action: { type: "vote", actorId: "guest", targetId: "" },
      }),
    ).toBe(false);
    expect(isProtocolMessage({ ...intent, seq: -1 })).toBe(false);
    expect(isProtocolMessage({ ...intent, actionId: "" })).toBe(false);
  });

  it("validates action correlation identifiers on rejects", () => {
    const reject = {
      protocolVersion: PROTOCOL_VERSION,
      kind: "reject",
      seq: 4,
      actionId: "reject-4",
      sentAt: 200,
      code: "invalid-message",
      detail: "거절",
      rejectedActionId: "guest-action-3",
    };

    expect(isProtocolMessage(reject)).toBe(true);
    expect(
      isProtocolMessage({ ...reject, rejectedActionId: "" }),
    ).toBe(false);
  });

  it("accepts draw as a player-view outcome and rejects unknown outcomes", () => {
    const state = createGame({ mode: "solo", seed: 901 });
    const view = getPlayerView(
      {
        ...state,
        phase: "ended",
        winner: "draw",
        winnerReason: "모든 생존자가 사망하여 무승부로 끝났습니다.",
      },
      state.humanIds[0],
      1,
    );

    expect(isPlayerView(view)).toBe(true);
    expect(isPlayerView({ ...view, winner: "unknown" })).toBe(false);
  });
});
