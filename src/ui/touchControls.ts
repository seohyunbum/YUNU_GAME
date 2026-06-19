import { TOUCH_SPRINT_THRESHOLD } from "../game/constants";

// 모바일 터치 컨트롤(가로 모드) — 좌 조이스틱(이동)·우측 드래그(시점)·화면 버튼(점프/공격/스킬/핫바/메뉴).
// 순수 표현+입력 리프(main.ts import 금지). 게임과는 좁은 콜백으로만 통신.
// 설계 정본: docs/mobile-support-design.md. 데스크톱 동작은 건드리지 않는다(터치 기기에서만 생성).

export interface TouchControlsCallbacks {
  setKey(code: string, pressed: boolean): void; // 이동/점프/달리기 → main 이 keys Set 조작(updateMovement 재사용)
  look(dx: number, dy: number): void; // 시점 드래그 px 델타 → main 이 감도 적용 후 rotateCameraByMouse
  interact(): void; // 공격/상호작용(데스크톱 좌클릭/E 와 동일 경로)
  useSkill(slot: 1 | 2 | 3): void;
  useItem(): void; // 선택한 핫바 아이템 사용(먹기·구급상자·설치·전직 아이템 등) — 데스크톱 숫자키 재사용분
  togglePanel(panel: "inventory" | "map" | "character"): void;
  saveGame(): void; // 데스크톱 Ctrl+S 와 동일 — 모바일은 save-controls 가 숨겨지므로 버튼으로 제공
  isPlaying(): boolean; // 게임 진행 중(타이틀/패널 아님)일 때만 조이스틱·시점 활성
}

export interface TouchControlsHandle {
  destroy(): void;
}

const MOVE_DEADZONE = 0.35; // 조이스틱 정규화 벡터가 이 값을 넘어야 해당 방향 키 ON

// 조이스틱 정규화 벡터(nx,ny ∈ -1..1, 화면 아래가 +y)·크기(mag 0..1) → 이동 키 상태. (순수 — 테스트 가능)
// NaN/Infinity 입력(레이아웃 전 radius=0 등)은 모든 비교가 false 가 되어 "정지"로 안전하게 처리된다.
export function joystickKeyState(nx: number, ny: number, mag: number) {
  return {
    KeyW: ny < -MOVE_DEADZONE,
    KeyS: ny > MOVE_DEADZONE,
    KeyA: nx < -MOVE_DEADZONE,
    KeyD: nx > MOVE_DEADZONE,
    ShiftLeft: ny < -MOVE_DEADZONE && mag > TOUCH_SPRINT_THRESHOLD, // 앞으로 꽉 밀면 달리기
  };
}

function btn(label: string, cls: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `touch-btn ${cls}`;
  b.textContent = label;
  b.setAttribute("aria-label", label);
  return b;
}

// 설치물(제작대/제련대/분쇄기) 탭 시 사용/줍기 컨텍스트 선택창 — 터치 전용, 그 순간만 표시(상시 버튼 없음).
export function showStationChoice(parent: HTMLElement, onUse: () => void, onPickup: () => void): void {
  parent.querySelector(".station-choice")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "station-choice";
  const make = (label: string, fn: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "station-choice-btn";
    b.textContent = label;
    b.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); overlay.remove(); fn(); }, { passive: false });
    return b;
  };
  overlay.append(make("🔨 사용", onUse), make("✋ 줍기", onPickup));
  overlay.addEventListener("touchstart", (e) => { if (e.target === overlay) { e.preventDefault(); overlay.remove(); } }, { passive: false });
  parent.append(overlay);
}

export function createTouchControls(parent: HTMLElement, cb: TouchControlsCallbacks): TouchControlsHandle {
  document.body.classList.add("touch-mode");

  // 시점 드래그 영역(우측 절반) — 버튼들 아래에 깔린다.
  const lookZone = document.createElement("div");
  lookZone.className = "touch-look";

  // 컨트롤 컨테이너 — pointer-events:none, 실제 컨트롤만 auto (빈 곳은 lookZone 으로 통과).
  const controls = document.createElement("div");
  controls.className = "touch-controls";

  const joystick = document.createElement("div");
  joystick.className = "touch-joystick";
  const stick = document.createElement("div");
  stick.className = "touch-stick";
  joystick.appendChild(stick);

  const actions = document.createElement("div");
  actions.className = "touch-actions";
  const attackBtn = btn("공격", "touch-attack");
  // 점프·사용·R/T/F 버튼 제거 — 사용은 핫바 탭(=사용), 스킬은 스킬바 아이콘 탭(skillBar.ts).
  actions.append(attackBtn);

  // 핫바는 기존 데스크톱 핫바(.hotbar)가 이미 탭(click) 가능 + 아이템 아이콘 표시 → 재사용. 별도 생성 안 함.

  const menu = document.createElement("div");
  menu.className = "touch-menu";
  const invBtn = btn("가방", "touch-menu-btn");
  const mapBtn = btn("지도", "touch-menu-btn");
  const charBtn = btn("캐릭터", "touch-menu-btn"); // 캐릭터창(K) — 목걸이 착용·스탯 분배
  const saveBtn = btn("저장", "touch-menu-btn");
  const loadBtn = btn("불러오기", "touch-menu-btn"); // 숨겨진 데스크톱 불러오기 버튼 재사용
  const fsBtn = btn("⛶", "touch-menu-btn"); // 전체화면(주소창 숨김)
  menu.append(invBtn, mapBtn, charBtn, saveBtn, loadBtn, fsBtn);

  controls.append(joystick, actions, menu);
  parent.append(lookZone, controls);

  // ===== 입력 상태(스크래치 — 매 이동마다 할당 금지) =====
  let joystickId: number | null = null;
  let joystickCx = 0;
  let joystickCy = 0;
  let joystickRadius = 60;
  let lookId: number | null = null;
  let lookLastX = 0;
  let lookLastY = 0;
  const moveCodes = ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft"] as const;
  const moveState: Record<string, boolean> = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, ShiftLeft: false };

  function setMove(code: string, on: boolean) {
    if (moveState[code] === on) return;
    moveState[code] = on;
    cb.setKey(code, on);
  }

  function clearMove() {
    for (const code of moveCodes) setMove(code, false);
  }

  function updateJoystick(clientX: number, clientY: number) {
    if (!cb.isPlaying()) {
      clearMove();
      stick.style.transform = "translate(0px, 0px)";
      return;
    }
    let dx = clientX - joystickCx;
    let dy = clientY - joystickCy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, joystickRadius);
    if (dist > 0.0001) {
      dx = (dx / dist) * clamped;
      dy = (dy / dist) * clamped;
    }
    stick.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const nx = dx / joystickRadius; // -1..1
    const ny = dy / joystickRadius; // -1..1 (화면 아래가 +)
    const mag = clamped / joystickRadius;
    const ks = joystickKeyState(nx, ny, mag);
    setMove("KeyW", ks.KeyW);
    setMove("KeyS", ks.KeyS);
    setMove("KeyA", ks.KeyA);
    setMove("KeyD", ks.KeyD);
    setMove("ShiftLeft", ks.ShiftLeft);
  }

  function resetJoystick() {
    joystickId = null;
    stick.style.transform = "translate(0px, 0px)";
    clearMove();
  }

  // ===== 터치 이벤트 — 시작은 요소별, 이동/끝은 window 에서 식별자로 라우팅(멀티터치) =====
  const onJoystickStart = (e: TouchEvent) => {
    e.preventDefault();
    if (joystickId !== null) return;
    const t = e.changedTouches[0];
    joystickId = t.identifier;
    const rect = joystick.getBoundingClientRect();
    joystickCx = rect.left + rect.width / 2;
    joystickCy = rect.top + rect.height / 2;
    joystickRadius = rect.width / 2;
    updateJoystick(t.clientX, t.clientY);
  };

  const onLookStart = (e: TouchEvent) => {
    e.preventDefault();
    if (lookId !== null) return;
    const t = e.changedTouches[0];
    lookId = t.identifier;
    lookLastX = t.clientX;
    lookLastY = t.clientY;
  };

  const onWindowMove = (e: TouchEvent) => {
    let tracked = false; // 조이스틱/시점 터치가 움직일 때만 preventDefault → 패널 목록 스크롤은 방해 안 함
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickId) {
        updateJoystick(t.clientX, t.clientY);
        tracked = true;
      } else if (t.identifier === lookId) {
        // 빠른 스와이프의 시점 점프 방지 — 한 이벤트당 델타를 ±100px 로 제한
        const dx = Math.max(-100, Math.min(100, t.clientX - lookLastX));
        const dy = Math.max(-100, Math.min(100, t.clientY - lookLastY));
        lookLastX = t.clientX;
        lookLastY = t.clientY;
        if (cb.isPlaying()) cb.look(dx, dy);
        tracked = true;
      }
    }
    if (tracked && e.cancelable) e.preventDefault();
  };

  const onWindowEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i += 1) {
      const id = e.changedTouches[i].identifier;
      if (id === joystickId) resetJoystick();
      else if (id === lookId) lookId = null;
    }
  };

  // 한 번만 발동하는 버튼(공격/스킬/핫바/메뉴) — touchstart 로 즉시 반응(클릭 300ms 지연 회피).
  const tap = (el: HTMLElement, fn: () => void) => {
    const handler = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    el.addEventListener("touchstart", handler, { passive: false });
    return () => el.removeEventListener("touchstart", handler);
  };

  joystick.addEventListener("touchstart", onJoystickStart, { passive: false });
  lookZone.addEventListener("touchstart", onLookStart, { passive: false });
  window.addEventListener("touchmove", onWindowMove, { passive: false });
  window.addEventListener("touchend", onWindowEnd, { passive: false });
  window.addEventListener("touchcancel", onWindowEnd, { passive: false });

  // 전체화면(주소창 숨김) — 토글 버튼 + 첫 조작 터치 1회 자동(둘 다 사용자 제스처라 정책 충족, 미지원은 무시)
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  let fsAuto = false;
  const autoFullscreen = () => {
    if (fsAuto || document.fullscreenElement) return;
    fsAuto = true;
    void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  lookZone.addEventListener("touchstart", autoFullscreen, { passive: true });
  joystick.addEventListener("touchstart", autoFullscreen, { passive: true });

  const cleanups = [
    tap(attackBtn, () => cb.interact()),
    tap(invBtn, () => cb.togglePanel("inventory")),
    tap(mapBtn, () => cb.togglePanel("map")),
    tap(charBtn, () => cb.togglePanel("character")),
    tap(saveBtn, () => cb.saveGame()),
    // 불러오기: 숨겨진 데스크톱 [data-load-game] 버튼 재사용(콜백/main.ts 무수정)
    tap(loadBtn, () => (document.querySelector("[data-load-game]") as HTMLElement | null)?.click()),
    tap(fsBtn, toggleFullscreen),
    () => {
      lookZone.removeEventListener("touchstart", autoFullscreen);
      joystick.removeEventListener("touchstart", autoFullscreen);
    },
  ];

  return {
    destroy() {
      joystick.removeEventListener("touchstart", onJoystickStart);
      lookZone.removeEventListener("touchstart", onLookStart);
      window.removeEventListener("touchmove", onWindowMove);
      window.removeEventListener("touchend", onWindowEnd);
      window.removeEventListener("touchcancel", onWindowEnd);
      for (const off of cleanups) off();
      lookZone.remove();
      controls.remove();
      document.body.classList.remove("touch-mode");
    },
  };
}
