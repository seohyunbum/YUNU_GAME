"use client";

import {
  applyAction,
  autoPlayAi,
  advancePhase,
  createGame,
  getPlayerView,
  isDuoCitizenProtectedFromConversion,
  type Faction,
  type GameAction,
  type GameState,
  type Phase,
  type PlayerView,
  type PublicCharacter,
  type RoleId,
  type Winner,
} from "@/lib/game";
import {
  createOnlineHost,
  joinOnlineRoom,
  type OnlineGameSession,
  type OnlineSnapshot,
  type OnlineStatus,
} from "./onlineAdapter";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type LandingDialog = "solo" | "online" | "create" | "join" | "rules" | null;
type LogTab = "talk" | "events";

interface RoleCopy {
  name: string;
  factionName: string;
  symbol: string;
  description: string;
  ability: string;
}

const ROLE_COPY: Record<RoleId, RoleCopy> = {
  citizen: {
    name: "시민",
    factionName: "시민 진영",
    symbol: "C",
    description: "말과 표정 속 모순을 찾고, 위험한 세력을 모두 몰아내세요.",
    ability: "밤에는 행동하지 않습니다. 낮 토론과 투표가 가장 강한 무기입니다.",
  },
  mafia: {
    name: "마피아",
    factionName: "마피아 진영",
    symbol: "M",
    description: "정체를 숨기고 밤의 합의로 시민을 한 명씩 제거하세요.",
    ability: "밤 살해에 투표하고, 아침에는 시민의 외형을 복제할 수 있습니다.",
  },
  bomber: {
    name: "폭탄마",
    factionName: "마피아 진영",
    symbol: "B",
    description: "끝까지 의심을 견디세요. 처형되는 순간 원탁 전체가 흔들립니다.",
    ability: "낮 투표로 사망하면 자신에게 투표한 생존자 모두가 피해를 받습니다.",
  },
  cult_leader: {
    name: "교주",
    factionName: "교주 진영",
    symbol: "L",
    description: "단 한 번의 포교로 균형을 바꾸고 새로운 다수를 만드세요.",
    ability: "게임 중 한 번, 밤에 시민 한 명을 신도로 포교할 수 있습니다.",
  },
  cultist: {
    name: "신도",
    factionName: "교주 진영",
    symbol: "F",
    description: "교주와 함께 살아남아 원탁의 수적 우위를 차지하세요.",
    ability: "별도 능력은 없지만 교주 진영의 승리를 위해 토론과 투표를 이끕니다.",
  },
};

const PHASE_COPY: Record<
  Phase,
  { title: string; kicker: string; description: string; icon: string }
> = {
  "role-reveal": {
    title: "정체 확인",
    kicker: "비밀 유지",
    description: "역할 카드를 혼자 확인하세요.",
    icon: "I",
  },
  night: {
    title: "깊은 밤",
    kicker: "도시는 잠듭니다",
    description: "밤의 능력을 선택할 시간입니다.",
    icon: "N",
  },
  dawn: {
    title: "새벽",
    kicker: "사건 공개",
    description: "지난밤의 결과가 공개됩니다.",
    icon: "D",
  },
  morning: {
    title: "아침",
    kicker: "가면의 시간",
    description: "마피아가 외형을 바꿀 수 있습니다.",
    icon: "M",
  },
  discussion: {
    title: "낮 토론",
    kicker: "진실과 거짓",
    description: "의심을 말하고 질문을 던지세요.",
    icon: "T",
  },
  voting: {
    title: "최종 투표",
    kicker: "한 표의 무게",
    description: "가장 의심스러운 생존자를 지목하세요.",
    icon: "V",
  },
  dusk: {
    title: "해질녘",
    kicker: "판결 집행",
    description: "원탁의 선택이 집행됩니다.",
    icon: "S",
  },
  ended: {
    title: "게임 종료",
    kicker: "최종 결과",
    description: "도시의 운명이 결정되었습니다.",
    icon: "E",
  },
};

const WINNER_NAME: Record<Winner, string> = {
  citizen: "시민 진영",
  mafia: "마피아 진영",
  cult: "교주 진영",
  draw: "무승부",
};

function randomSeed() {
  return Math.floor(Math.random() * 2_147_483_646) + 1;
}

function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "알 수 없는 문제가 발생했습니다.";
}

function findPublicCharacter(view: PlayerView, id: string | null) {
  if (!id) return null;
  return view.characters.find((character) => character.id === id) ?? null;
}

function hasSubmittedAction(game: GameState, view: PlayerView) {
  const selfId = view.self.id;
  if (game.phase === "night") {
    if (view.self.roleId === "mafia" || view.self.roleId === "bomber") {
      return game.pending.nightKillVotes[selfId] !== undefined;
    }
    if (view.self.roleId === "cult_leader" && !game.cultConversionUsed) {
      return game.pending.cultConvertTarget !== undefined;
    }
  }
  if (game.phase === "morning" && view.self.roleId === "mafia") {
    return game.pending.disguiseChoices[selfId] !== undefined;
  }
  if (game.phase === "voting") {
    return game.pending.dayVotes[selfId] !== undefined;
  }
  return false;
}

function actionLabel(phase: Phase, roleId: RoleId) {
  if (phase === "night" && (roleId === "mafia" || roleId === "bomber")) {
    return "살해 대상으로 지목";
  }
  if (phase === "night" && roleId === "cult_leader") {
    return "이 인물을 포교";
  }
  if (phase === "voting") return "이 인물에게 투표";
  return "선택 확정";
}

export default function MafiaGame() {
  const [dialog, setDialog] = useState<LandingDialog>(null);
  const [playerName, setPlayerName] = useState("당신");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [game, setGame] = useState<GameState | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [talkText, setTalkText] = useState("");
  const [logTab, setLogTab] = useState<LogTab>("talk");
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [disguise, setDisguise] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlineSession, setOnlineSession] =
    useState<OnlineGameSession | null>(null);
  const [onlineStatus, setOnlineStatus] =
    useState<OnlineStatus>("disconnected");
  const [guestConnected, setGuestConnected] = useState(false);
  const [onlineName, setOnlineName] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = useMemo(() => {
    if (!game || !viewerId) return null;
    return getPlayerView(game, viewerId, revision);
  }, [game, revision, viewerId]);

  const selectedCharacter = useMemo(
    () => (view ? findPublicCharacter(view, selectedId) : null),
    [selectedId, view],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2800);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const adoptSnapshot = useCallback((snapshot: OnlineSnapshot) => {
    setGame(snapshot.game);
    setViewerId(snapshot.viewerId);
    setRevision(snapshot.revision);
    setSelectedId(null);
    if (snapshot.game.phase === "ended") setRoleRevealed(true);
  }, []);

  useEffect(() => {
    if (!onlineSession) return;

    return onlineSession.subscribe((event) => {
      if (event.type === "snapshot") adoptSnapshot(event.snapshot);
      if (event.type === "status") setOnlineStatus(event.status);
      if (event.type === "host-ended") {
        onlineSession.close();
        setOnlineStatus("closed");
        setGuestConnected(false);
        setOnlineName("");
        setGame(null);
        setViewerId(null);
        setRevision(0);
        setSelectedId(null);
        setRoleRevealed(false);
        setOnlineSession(null);
        setDialog(null);
        setError(event.message);
      }
      if (event.type === "guest") {
        setGuestConnected(event.connected);
        setOnlineName(event.name ?? "");
      }
      if (event.type === "error") setError(event.message);
      if (event.type === "notice") showNotice(event.message);
    });
  }, [adoptSnapshot, onlineSession, showNotice]);

  useEffect(() => {
    if (!view || !game || !roleRevealed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.isContentEditable
      ) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const seat = Number(event.key);
      if (seat >= 1 && seat <= 9) {
        const character = view.characters.find(
          (candidate) => candidate.seat === seat && candidate.alive,
        );
        if (character) setSelectedId(character.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, roleRevealed, view]);

  const startLocalGame = useCallback(
    (name: string) => {
      try {
        const initial = createGame({
          mode: "solo",
          hostName: name.trim() || "당신",
          seed: randomSeed(),
        });
        const ready = autoPlayAi(initial);
        setGame(ready);
        setViewerId(ready.humanIds[0]);
        setRevision(1);
        setDialog(null);
        setSelectedId(null);
        setRoleRevealed(false);
        setError(null);
      } catch (caught) {
        setError(describeError(caught));
      }
    },
    [],
  );

  const submitSoloAction = useCallback(
    (action: GameAction) => {
      if (!game) return;
      try {
        const next = autoPlayAi(applyAction(game, action));
        setGame(next);
        setRevision((value) => value + 1);
        setSelectedId(null);
        setError(null);
      } catch (caught) {
        setError(describeError(caught));
      }
    },
    [game],
  );

  const submitAction = useCallback(
    (action: GameAction) => {
      if (onlineSession) {
        try {
          onlineSession.dispatch(action);
        } catch (caught) {
          setError(describeError(caught));
        }
        return;
      }
      submitSoloAction(action);
    },
    [onlineSession, submitSoloAction],
  );

  const continueSolo = useCallback(() => {
    if (!game) return;
    try {
      const completed = autoPlayAi(game);
      const next = autoPlayAi(advancePhase(completed));
      setGame(next);
      setRevision((value) => value + 1);
      setSelectedId(null);
      setError(null);
    } catch (caught) {
      setError(describeError(caught));
    }
  }, [game]);

  const continuePhase = useCallback(() => {
    if (onlineSession) {
      try {
        onlineSession.advance();
      } catch (caught) {
        setError(describeError(caught));
      }
      return;
    }
    continueSolo();
  }, [continueSolo, onlineSession]);

  const resetGame = useCallback(() => {
    onlineSession?.close();
    setOnlineSession(null);
    setOnlineStatus("disconnected");
    setGuestConnected(false);
    setOnlineName("");
    setGame(null);
    setViewerId(null);
    setRevision(0);
    setSelectedId(null);
    setRoleRevealed(false);
    setDialog(null);
    setError(null);
  }, [onlineSession]);

  const createRoom = useCallback(async () => {
    try {
      setError(null);
      setOnlineStatus("connecting");
      const session = await createOnlineHost(playerName.trim() || "방장");
      setOnlineSession(session);
      setOnlineStatus(session.status);
    } catch (caught) {
      setOnlineStatus("disconnected");
      setError(describeError(caught));
    }
  }, [playerName]);

  const joinRoom = useCallback(async () => {
    const code = normalizeRoomCode(roomCodeInput);
    if (code.length !== 6) {
      setError("방 코드는 영문·숫자 6자리로 입력해 주세요.");
      return;
    }
    try {
      setError(null);
      setOnlineStatus("connecting");
      const session = await joinOnlineRoom(
        code,
        playerName.trim() || "참가자",
      );
      setOnlineSession(session);
      setOnlineStatus(session.status);
    } catch (caught) {
      setOnlineStatus("disconnected");
      setError(describeError(caught));
    }
  }, [playerName, roomCodeInput]);

  const startOnlineGame = useCallback(() => {
    if (!onlineSession || onlineSession.role !== "host") return;
    try {
      onlineSession.start(playerName.trim() || "방장");
      setRoleRevealed(false);
    } catch (caught) {
      setError(describeError(caught));
    }
  }, [onlineSession, playerName]);

  if (!game || !view) {
    return (
      <Landing
        dialog={dialog}
        setDialog={setDialog}
        playerName={playerName}
        setPlayerName={setPlayerName}
        roomCodeInput={roomCodeInput}
        setRoomCodeInput={(value) =>
          setRoomCodeInput(normalizeRoomCode(value))
        }
        startLocalGame={startLocalGame}
        createRoom={createRoom}
        joinRoom={joinRoom}
        onlineSession={onlineSession}
        onlineStatus={onlineStatus}
        guestConnected={guestConnected}
        onlineName={onlineName}
        startOnlineGame={startOnlineGame}
        error={error}
        clearError={() => setError(null)}
        resetOnline={() => {
          onlineSession?.close();
          setOnlineSession(null);
          setOnlineStatus("disconnected");
          setGuestConnected(false);
          setOnlineName("");
        }}
      />
    );
  }

  const selfRole = ROLE_COPY[view.self.roleId];
  const phaseCopy = PHASE_COPY[game.phase];
  const submitted = hasSubmittedAction(game, view);
  const isOnlineGuest =
    onlineSession !== null && onlineSession.role === "guest";

  return (
    <main className="app-shell game">
      <header className="game-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            IX
          </span>
          <span className="brand-copy">
            <strong>밤의 의회</strong>
            <small>NINE AT THE TABLE</small>
          </span>
        </div>
        <div className="phase-lockup" aria-live="polite">
          <span className="phase-icon" aria-hidden="true">
            {phaseCopy.icon}
          </span>
          <span>
            <strong>
              {game.day}일차 · {phaseCopy.title}
            </strong>
            <small>{phaseCopy.kicker}</small>
          </span>
        </div>
        <button className="quiet-button" type="button" onClick={resetGame}>
          게임 나가기
        </button>
      </header>

      <div className="game-grid">
        <aside className="side-stack left" aria-label="내 역할 정보">
          <section className="panel">
            <div className="panel-header">
              <h2>비밀 역할</h2>
              <span>나만 볼 수 있음</span>
            </div>
            <RoleCard roleId={view.self.roleId} faction={view.self.faction} />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>같은 편 정보</h2>
              <span>{selfRole.factionName}</span>
            </div>
            <PartnerCard view={view} />
          </section>

          <section className="panel keyboard-help">
            <kbd>1</kbd>–<kbd>9</kbd> 좌석 선택 · <kbd>Esc</kbd> 선택 해제
          </section>
        </aside>

        <section className="panel board-panel" aria-label="아홉 명의 원탁">
          <div className="round-table">
            <div className="table-center" aria-hidden="true">
              <div className="table-day">
                <span>{phaseCopy.kicker}</span>
                <strong>{phaseCopy.title}</strong>
                <small>{phaseCopy.description}</small>
              </div>
            </div>

            {view.characters.map((character) => (
              <PlayerCard
                key={character.id}
                character={character}
                isSelf={character.id === view.self.id}
                selected={character.id === selectedId}
                onSelect={() =>
                  setSelectedId((current) =>
                    current === character.id ? null : character.id,
                  )
                }
              />
            ))}
          </div>
        </section>

        <aside className="side-stack right" aria-label="행동 및 게임 기록">
          <ActionPanel
            game={game}
            view={view}
            selected={selectedCharacter}
            submitted={submitted}
            disguise={disguise}
            setDisguise={setDisguise}
            talkText={talkText}
            setTalkText={setTalkText}
            submitAction={submitAction}
            continuePhase={continuePhase}
            isOnlineGuest={isOnlineGuest}
            onNotice={showNotice}
          />

          <LogPanel view={view} tab={logTab} setTab={setLogTab} />
        </aside>
      </div>

      {!roleRevealed && (
        <RoleReveal view={view} onConfirm={() => setRoleRevealed(true)} />
      )}

      {view.winner && (
        <WinnerDialog
          winner={view.winner}
          reason={view.winnerReason}
          onRestart={() => {
            if (onlineSession) {
              if (onlineSession.role === "host") startOnlineGame();
              else showNotice("재경기는 방장이 시작할 수 있습니다.");
            } else {
              startLocalGame(playerName);
            }
          }}
          onExit={resetGame}
        />
      )}

      {notice && (
        <div className="status-banner" role="status">
          {notice}
        </div>
      )}
      {error && (
        <button
          className="error-banner"
          type="button"
          role="alert"
          onClick={() => setError(null)}
        >
          {error} · 눌러서 닫기
        </button>
      )}
    </main>
  );
}

function Landing({
  dialog,
  setDialog,
  playerName,
  setPlayerName,
  roomCodeInput,
  setRoomCodeInput,
  startLocalGame,
  createRoom,
  joinRoom,
  onlineSession,
  onlineStatus,
  guestConnected,
  onlineName,
  startOnlineGame,
  error,
  clearError,
  resetOnline,
}: {
  dialog: LandingDialog;
  setDialog: (dialog: LandingDialog) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  startLocalGame: (name: string) => void;
  createRoom: () => Promise<void>;
  joinRoom: () => Promise<void>;
  onlineSession: OnlineGameSession | null;
  onlineStatus: OnlineStatus;
  guestConnected: boolean;
  onlineName: string;
  startOnlineGame: () => void;
  error: string | null;
  clearError: () => void;
  resetOnline: () => void;
}) {
  const submitSolo = (event: FormEvent) => {
    event.preventDefault();
    startLocalGame(playerName);
  };

  return (
    <main className="app-shell landing">
      <header className="landing-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            IX
          </span>
          <span className="brand-copy">
            <strong>밤의 의회</strong>
            <small>NINE AT THE TABLE</small>
          </span>
        </div>
        <div className="header-note">
          <span className="live-dot" aria-hidden="true" />
          9인 · 3진영 · 한 번의 선택
        </div>
      </header>

      <section className="landing-main">
        <div className="hero-copy">
          <p className="eyebrow">Noir social deduction</p>
          <h1 className="hero-title">
            믿지 마라
            <span>살아남아라</span>
          </h1>
          <p className="hero-lede">
            시민, 마피아와 폭탄마, 그리고 교주와 신도. 아홉 개의
            얼굴이 같은 원탁에 앉습니다. 말 한마디와 한 표로 밤의 진실을
            찾아내세요.
          </p>
          <ul className="rule-strip" aria-label="게임 특징">
            <li>AI 8명과 솔로 플레이</li>
            <li>2인 온라인 협력·대결</li>
            <li>설치와 API 키 불필요</li>
          </ul>
          <div className="landing-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setDialog("solo")}
            >
              솔로 게임 시작
              <span className="button-kicker">1 PLAYER</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setDialog("online")}
            >
              온라인 듀오
              <span className="button-kicker">2 PLAYERS</span>
            </button>
            <button
              className="quiet-button"
              type="button"
              onClick={() => setDialog("rules")}
            >
              규칙 보기
            </button>
          </div>
        </div>

        <div className="hero-emblem-wrap" aria-hidden="true">
          <div className="hero-emblem">
            <div className="emblem-hat" />
            <div className="emblem-face" />
            <div className="emblem-eyes" />
            <div className="emblem-collar" />
            <div className="emblem-seal">THE<br />NINTH</div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>추천 구성 · 시민 5 · 마피아 2 · 교주 1 · 신도 1</span>
        <span className="role-teaser" aria-label="세 진영">
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      </footer>

      {dialog === "solo" && (
        <div className="overlay" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="solo-title"
            onSubmit={submitSolo}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Solo game</p>
                <h2 id="solo-title">혼자 원탁에 앉기</h2>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={() => setDialog(null)}
              >
                ×
              </button>
            </div>
            <div className="field">
              <label htmlFor="solo-name">게임에서 사용할 이름</label>
              <input
                id="solo-name"
                className="text-input"
                value={playerName}
                maxLength={12}
                autoFocus
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </div>
            <p className="action-hint">
              나머지 여덟 명은 행동 기록을 기억하고 서로 의심하는 규칙 기반
              AI가 맡습니다.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDialog(null)}
              >
                취소
              </button>
              <button className="primary-button" type="submit">
                역할 배정받기
              </button>
            </div>
          </form>
        </div>
      )}

      {dialog === "online" && (
        <div className="overlay" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="online-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Online duo</p>
                <h2 id="online-title">둘이 원탁에 앉기</h2>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={() => setDialog(null)}
              >
                ×
              </button>
            </div>
            <div className="mode-options">
              <button
                className="mode-option"
                type="button"
                onClick={() => setDialog("create")}
              >
                <span className="mode-icon" aria-hidden="true">H</span>
                <span>
                  <strong>새 방 만들기</strong>
                  <small>6자리 코드를 가족에게 알려주세요.</small>
                </span>
                <span className="mode-arrow" aria-hidden="true">→</span>
              </button>
              <button
                className="mode-option"
                type="button"
                onClick={() => setDialog("join")}
              >
                <span className="mode-icon" aria-hidden="true">J</span>
                <span>
                  <strong>방 코드로 참가</strong>
                  <small>받은 코드로 방장에게 직접 연결합니다.</small>
                </span>
                <span className="mode-arrow" aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {(dialog === "create" || dialog === "join") && (
        <div className="overlay" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Private room</p>
                <h2 id="room-title">
                  {dialog === "create" ? "비밀 방 만들기" : "비밀 방 참가"}
                </h2>
              </div>
              <button
                className="close-button"
                type="button"
                aria-label="닫기"
                onClick={() => {
                  resetOnline();
                  setDialog(null);
                }}
              >
                ×
              </button>
            </div>

            {!onlineSession ? (
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="online-name">게임에서 사용할 이름</label>
                  <input
                    id="online-name"
                    className="text-input"
                    value={playerName}
                    maxLength={12}
                    autoFocus
                    onChange={(event) => setPlayerName(event.target.value)}
                  />
                </div>
                {dialog === "join" && (
                  <div className="field">
                    <label htmlFor="room-code">6자리 방 코드</label>
                    <input
                      id="room-code"
                      className="text-input room-code-input"
                      value={roomCodeInput}
                      minLength={6}
                      maxLength={6}
                      autoComplete="off"
                      inputMode="text"
                      placeholder="A7K9Q2"
                      onChange={(event) =>
                        setRoomCodeInput(event.target.value)
                      }
                    />
                  </div>
                )}
                <button
                  className="primary-button"
                  type="button"
                  disabled={onlineStatus === "connecting"}
                  onClick={() => {
                    if (dialog === "create") void createRoom();
                    else void joinRoom();
                  }}
                >
                  {onlineStatus === "connecting"
                    ? "연결 준비 중…"
                    : dialog === "create"
                      ? "방 코드 만들기"
                      : "방 참가하기"}
                </button>
              </div>
            ) : (
              <div className="waiting-room">
                <p className="action-hint">
                  {onlineSession.role === "host"
                    ? "아래 코드를 함께할 사람에게 알려주세요."
                    : "방장과 보안 연결을 확인하고 있습니다."}
                </p>
                <div
                  className="room-code"
                  aria-label={`방 코드 ${onlineSession.roomCode}`}
                >
                  {onlineSession.roomCode}
                </div>
                <div className="connection-status" aria-live="polite">
                  {!guestConnected && <span className="spinner" />}
                  {guestConnected
                    ? `${onlineName || "참가자"} 님이 원탁에 앉았습니다.`
                    : onlineSession.role === "host"
                      ? "참가자를 기다리는 중…"
                      : onlineStatus === "connected"
                        ? "방장의 게임 시작을 기다리는 중…"
                        : "방장에게 연결 중…"}
                </div>
                {onlineSession.role === "host" && (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!guestConnected}
                    onClick={startOnlineGame}
                  >
                    두 사람의 역할 배정
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {dialog === "rules" && (
        <RulesDialog onClose={() => setDialog(null)} />
      )}

      {error && (
        <button
          className="error-banner"
          type="button"
          role="alert"
          onClick={clearError}
        >
          {error} · 눌러서 닫기
        </button>
      )}
    </main>
  );
}

function RoleCard({
  roleId,
  faction,
}: {
  roleId: RoleId;
  faction: Faction;
}) {
  const role = ROLE_COPY[roleId];
  return (
    <div className="role-card" data-faction={faction}>
      <div className="role-symbol" aria-hidden="true">{role.symbol}</div>
      <h3>{role.name}</h3>
      <p>{role.ability}</p>
      <span className="faction-label">{role.factionName}</span>
    </div>
  );
}

function PartnerCard({ view }: { view: PlayerView }) {
  if (!view.partner) {
    return (
      <div className="partner-card">
        <span className="partner-dot" aria-hidden="true">—</span>
        <span>
          <strong>확인된 동료 없음</strong>
          <small>누구도 쉽게 믿지 마세요.</small>
        </span>
      </div>
    );
  }

  return (
    <div className="partner-card">
      <span className="partner-dot" aria-hidden="true">
        {view.partner.name.slice(0, 1)}
      </span>
      <span>
        <strong>{view.partner.name}</strong>
        <small>
          {ROLE_COPY[view.partner.roleId].name} ·{" "}
          {view.partner.alive ? "생존" : "사망"}
        </small>
      </span>
    </div>
  );
}

function PlayerCard({
  character,
  isSelf,
  selected,
  onSelect,
}: {
  character: PublicCharacter;
  isSelf: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const health = Math.max(0, Math.min(2, character.hp));
  return (
    <button
      className={[
        "player-card",
        `seat-${character.seat}`,
        character.alive ? "" : "dead",
        isSelf ? "self" : "",
        character.isDisguisedDouble ? "double" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      aria-pressed={selected}
      aria-label={`${character.seat}번 좌석 ${character.displayName}, ${
        character.alive ? `체력 ${health}` : "사망"
      }${character.isDisguisedDouble ? ", 같은 외형이 둘" : ""}`}
      disabled={!character.alive}
      onClick={onSelect}
    >
      <span
        className={`avatar avatar-${character.seat}`}
        aria-hidden="true"
      >
        <span className="avatar-hair" />
        <span className="avatar-eyes" />
      </span>
      <span className="player-meta">
        <span className="player-seat">SEAT {character.seat}</span>
        <span className="player-name">{character.displayName}</span>
        <span className="health" aria-hidden="true">
          {[0, 1].map((index) => (
            <span
              key={index}
              className={`heart ${index < health ? "" : "empty"}`}
            />
          ))}
        </span>
      </span>
    </button>
  );
}

function ActionPanel({
  game,
  view,
  selected,
  submitted,
  disguise,
  setDisguise,
  talkText,
  setTalkText,
  submitAction,
  continuePhase,
  isOnlineGuest,
  onNotice,
}: {
  game: GameState;
  view: PlayerView;
  selected: PublicCharacter | null;
  submitted: boolean;
  disguise: boolean;
  setDisguise: (value: boolean) => void;
  talkText: string;
  setTalkText: (value: string) => void;
  submitAction: (action: GameAction) => void;
  continuePhase: () => void;
  isOnlineGuest: boolean;
  onNotice: (message: string) => void;
}) {
  const self = view.self;
  const isMafiaNight =
    game.phase === "night" &&
    (self.roleId === "mafia" || self.roleId === "bomber");
  const isCultNight =
    game.phase === "night" &&
    self.roleId === "cult_leader" &&
    !game.cultConversionUsed;
  const isMafiaMorning =
    game.phase === "morning" && self.roleId === "mafia";
  const canTarget = isMafiaNight || isCultNight || game.phase === "voting";
  const isProtectedDuoCitizen =
    isCultNight &&
    selected !== null &&
    isDuoCitizenProtectedFromConversion(game, selected.id);
  const validSelected = (
    selected &&
    selected.alive &&
    selected.id !== self.id &&
    !isProtectedDuoCitizen &&
    !(
      (isMafiaNight || isCultNight) &&
      selected.id === view.partner?.id
    )
  )
    ? selected
    : null;

  const sendTargetAction = () => {
    if (!validSelected) {
      onNotice("원탁에서 행동 대상을 먼저 선택해 주세요.");
      return;
    }
    if (isMafiaNight) {
      submitAction({
        type: "night-kill",
        actorId: self.id,
        targetId: validSelected.id,
      });
    } else if (isCultNight) {
      submitAction({
        type: "cult-convert",
        actorId: self.id,
        targetId: validSelected.id,
      });
    } else if (game.phase === "voting") {
      submitAction({
        type: "vote",
        actorId: self.id,
        targetId: validSelected.id,
      });
    }
  };

  const sendTalk = (event: FormEvent) => {
    event.preventDefault();
    const text = talkText.trim();
    if (!text) return;
    submitAction({
      type: "talk",
      actorId: self.id,
      text,
      targetId: selected?.id,
    });
    setTalkText("");
  };

  const actionTitle =
    game.phase === "night"
      ? "밤의 선택"
      : game.phase === "morning"
        ? "외형 위장"
        : game.phase === "discussion"
          ? "의견 말하기"
          : game.phase === "voting"
            ? "의심 투표"
            : "단계 진행";

  return (
    <section className="panel action-panel">
      <div className="panel-header">
        <h2>{actionTitle}</h2>
        <span>{submitted ? "선택 완료" : PHASE_COPY[game.phase].kicker}</span>
      </div>
      <div className="action-body">
        {canTarget && (
          <>
            <p className="action-hint">
              {submitted
                ? "선택이 기록되었습니다. 단계가 넘어가기 전까지는 다시 선택할 수 없습니다."
                : isMafiaNight
                  ? "제거할 생존자를 원탁에서 고르세요. 마피아 동료의 표와 합의됩니다."
                  : isCultNight
                    ? game.mode === "duo"
                      ? "포교할 시민을 고르세요. 시민 진영 듀오 참가자 2명은 보호 대상입니다."
                      : "포교할 시민을 고르거나 이번 기회를 포기할 수 있습니다."
                    : "가장 의심스러운 생존자를 고르세요. 최다 득표자는 체력 1을 잃습니다."}
            </p>
            <div className="selected-target" aria-live="polite">
              선택 대상
              <span>
                {validSelected
                  ? `${validSelected.seat}번 ${validSelected.displayName}`
                  : "선택하지 않음"}
              </span>
            </div>
            <div className="action-buttons">
              <button
                className={isMafiaNight ? "danger-button" : "primary-button"}
                type="button"
                disabled={!validSelected || submitted || !self.alive}
                onClick={sendTargetAction}
              >
                {actionLabel(game.phase, self.roleId)}
              </button>
              {isCultNight && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={submitted || !self.alive}
                  onClick={() =>
                    submitAction({
                      type: "cult-convert",
                      actorId: self.id,
                      targetId: null,
                    })
                  }
                >
                  이번 게임의 포교 포기
                </button>
              )}
            </div>
          </>
        )}

        {game.phase === "night" && !isMafiaNight && !isCultNight && (
          <p className="action-hint">
            당신에게 필요한 밤 행동은 없습니다. 다른 이들의 선택은 보이지
            않습니다.
          </p>
        )}

        {game.phase === "morning" && (
          <>
            {isMafiaMorning && self.alive ? (
              <>
                <p className="action-hint">
                  생존 시민 한 명의 외형을 무작위로 복제합니다. 원본도 그대로
                  남아 같은 얼굴이 둘 보입니다.
                </p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={disguise}
                    disabled={submitted}
                    onChange={(event) => setDisguise(event.target.checked)}
                  />
                  오늘 시민의 외형을 복제합니다
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={submitted}
                  onClick={() =>
                    submitAction({
                      type: "disguise",
                      actorId: self.id,
                      use: disguise,
                    })
                  }
                >
                  위장 선택 확정
                </button>
              </>
            ) : (
              <p className="action-hint">
                도시가 깨어나는 동안 주변의 얼굴을 잘 살펴보세요. 같은 외형이
                둘이라면 그중 한 명은 위장한 마피아입니다.
              </p>
            )}
          </>
        )}

        {game.phase === "discussion" && (
          <form onSubmit={sendTalk}>
            <label className="field">
              <span>원탁에 남길 발언</span>
              <textarea
                className="talk-input"
                value={talkText}
                maxLength={180}
                placeholder={
                  selected
                    ? `${selected.displayName} 님에게 질문하거나 의심을 말해보세요.`
                    : "지난밤의 사건과 투표를 근거로 의견을 말해보세요."
                }
                disabled={!self.alive}
                onChange={(event) => setTalkText(event.target.value)}
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!talkText.trim() || !self.alive}
            >
              발언하기
            </button>
          </form>
        )}

        {(game.phase === "dawn" || game.phase === "dusk") && (
          <p className="action-hint">
            공개 사건 기록을 확인한 뒤 다음 단계로 진행하세요.
          </p>
        )}

        {game.phase !== "ended" && (
          <>
            <hr className="action-divider" />
            <button
              className="secondary-button"
              type="button"
              disabled={
                (isMafiaNight || isCultNight || isMafiaMorning) &&
                self.alive &&
                !submitted
              }
              onClick={continuePhase}
            >
              {isOnlineGuest ? "방장에게 단계 진행 요청" : "다음 단계로"}
            </button>
            {isOnlineGuest && (
              <p className="action-hint">
                온라인 게임의 최종 단계 전환은 방장이 동기화합니다.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LogPanel({
  view,
  tab,
  setTab,
}: {
  view: PlayerView;
  tab: LogTab;
  setTab: (tab: LogTab) => void;
}) {
  const characterNames = useMemo(
    () =>
      new Map(
        view.characters.map((character) => [
          character.id,
          character.displayName,
        ]),
      ),
    [view.characters],
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>원탁 기록</h2>
        <span>공개 정보</span>
      </div>
      <div className="log-tabs" role="tablist" aria-label="원탁 기록 종류">
        <button
          className={`log-tab ${tab === "talk" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "talk"}
          onClick={() => setTab("talk")}
        >
          대화
        </button>
        <button
          className={`log-tab ${tab === "events" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={tab === "events"}
          onClick={() => setTab("events")}
        >
          사건
        </button>
      </div>
      <div className="log-list" role="log" aria-live="polite">
        {tab === "talk" ? (
          view.messages.length ? (
            [...view.messages].reverse().map((message) => (
              <div
                key={message.id}
                className={`log-entry ${message.kind === "system" ? "system" : ""}`}
              >
                <span className="log-speaker">
                  {message.speakerId
                    ? characterNames.get(message.speakerId) ?? "알 수 없음"
                    : "기록"}
                </span>
                <span>{message.text}</span>
              </div>
            ))
          ) : (
            <p className="empty-state">아직 원탁에 남은 발언이 없습니다.</p>
          )
        ) : view.publicEvents.length ? (
          [...view.publicEvents].reverse().map((event) => (
            <div key={event.id} className="log-entry system">
              <span className="log-speaker">{event.day}일</span>
              <span>{event.text}</span>
            </div>
          ))
        ) : (
          <p className="empty-state">공개된 사건이 아직 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function RoleReveal({
  view,
  onConfirm,
}: {
  view: PlayerView;
  onConfirm: () => void;
}) {
  const role = ROLE_COPY[view.self.roleId];
  return (
    <div className="overlay">
      <section
        className="modal role-reveal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-reveal-title"
      >
        <p className="eyebrow">Eyes only · 비밀 유지</p>
        <div className="role-reveal-seal" aria-hidden="true">
          {role.symbol}
        </div>
        <p className="faction-label">{role.factionName}</p>
        <h2 id="role-reveal-title">{role.name}</h2>
        <p className="role-description">{role.description}</p>
        {view.partner && (
          <div className="partner-reveal">
            같은 편 · {view.partner.name} ({ROLE_COPY[view.partner.roleId].name})
          </div>
        )}
        <button className="primary-button" type="button" onClick={onConfirm}>
          확인했습니다 · 게임 입장
        </button>
      </section>
    </div>
  );
}

function WinnerDialog({
  winner,
  reason,
  onRestart,
  onExit,
}: {
  winner: Winner;
  reason: string | null;
  onRestart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="overlay">
      <section
        className="modal win-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-title"
      >
        <p className="eyebrow">The table has spoken</p>
        <h2 id="winner-title" className="winner-word">
          {WINNER_NAME[winner]}
        </h2>
        <p className="role-description">
          {reason ?? "마지막 판결로 도시의 운명이 결정되었습니다."}
        </p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onExit}>
            첫 화면으로
          </button>
          <button className="primary-button" type="button" onClick={onRestart}>
            같은 구성으로 재경기
          </button>
        </div>
      </section>
    </div>
  );
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">How to play</p>
            <h2 id="rules-title">원탁의 규칙</h2>
          </div>
          <button
            className="close-button"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="form-grid">
          <p className="action-hint">
            9명은 시민 5명, 일반 마피아와 폭탄마, 교주와 신도로 시작합니다.
            각 인물의 체력은 2입니다.
          </p>
          <p className="action-hint">
            밤에는 마피아가 합의한 한 명을 즉시 제거합니다. 교주는 게임 중
            한 번 시민을 포교할 수 있으며, 마피아 포교는 실패합니다. 시민
            진영 온라인 듀오 참가자 2명은 포교할 수 없습니다.
          </p>
          <p className="action-hint">
            낮 최다 득표자는 체력 1을 잃습니다. 동률이면 아무도 피해를 받지
            않습니다. 폭탄마가 투표로 사망하면 자신에게 투표한 생존자들이
            함께 피해를 받습니다.
          </p>
          <p className="action-hint">
            마피아 진영과 교주 진영이 모두 전멸하면 시민 진영이 승리합니다.
            시민 진영과 교주 진영이 모두 전멸하면 마피아 진영이 승리합니다.
            마피아 진영이 전멸하고 교주 진영 인원이 시민 진영 인원 이상이면
            교주 진영이 승리합니다. 모든 생존자가 사망하면 무승부입니다.
          </p>
        </div>
        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            이해했습니다
          </button>
        </div>
      </section>
    </div>
  );
}
