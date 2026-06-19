import { TOUCH_SPRINT_THRESHOLD } from "../game/constants";

// 모바일 터치 컨트롤(가로 모드) — 좌 조이스틱(이동)·우측 드래그(시점)·화면 버튼(점프/공격/스킬/핫바/메뉴).
// 순수 표현+입력 리프(main.ts import 금지). 게임과는 좁은 콜백으로만 통신.
// 설계 정본: docs/mobile-support-design.md. 데스크톱 동작은 건드리지 않는다(터치 기기에서만 생성).

export interface TouchControlsCallbacks {
  setKey(code: string, pressed: boolean): void; // 이동/점프/달리기 → main 이 keys Set 조작(updateMovement 재사용)
  look(dx: number, dy: number): void; // 시점 드래그 px 델타 → main 이 감도 적용 후 rotateCameraByMouse
  interact(): void; // 공격/상호작용(데스크톱 좌클릭/E 와 동일 경로)
  useSkill(slot: 1 | 2 | 3): void;
  togglePanel(panel: "inventory" | "map"): void;
  saveGame(): void; // 데스크톱 Ctrl+S 와 동일 — 모바일은 save-controls 가 숨겨지므로 버튼으로 제공
  isPlaying(): boolean; // 게임 진행 중(타이틀/패널 아님)일 때만 조이스틱·시점 활성
}

export interface TouchControlsHandle {
  destroy(): void;
}

const MOVE_DEADZONE = 0.35; // 조이스틱 정규화 벡터가 이 값을 넘어야 해당 방향 키 ON

function btn(label: string, cls: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `touch-btn ${cls}`;
  b.textContent = label;
  b.setAttribute("aria-label", label);
  return b;
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

  const jumpBtn = btn("점프", "touch-jump");

  const actions = document.createElement("div");
  actions.className = "touch-actions";
  const attackBtn = btn("공격", "touch-attack");
  const skillR = btn("R", "touch-skill touch-skill-r");
  const skillT = btn("T", "touch-skill touch-skill-t");
  const skillF = btn("F", "touch-skill touch-skill-f");
  actions.append(skillR, skillT, skillF, attackBtn);

  // 핫바는 기존 데스크톱 핫바(.hotbar)가 이미 탭(click) 가능 + 아이템 아이콘 표시 → 재사용. 별도 생성 안 함.

  const menu = document.createElement("div");
  menu.className = "touch-menu";
  const invBtn = btn("가방", "touch-menu-btn");
  const mapBtn = btn("지도", "touch-menu-btn");
  const saveBtn = btn("저장", "touch-menu-btn");
  menu.append(invBtn, mapBtn, saveBtn);

  controls.append(joystick, jumpBtn, actions, menu);
  parent.append(lookZone, controls);

  // ===== 입력 상태(스크래치 — 매 이동마다 할당 금지) =====
  let joystickId: number | null = null;
  let joystickCx = 0;
  let joystickCy = 0;
  let joystickRadius = 60;
  let lookId: number | null = null;
  let lookLastX = 0;
  let lookLastY = 0;
  let jumpId: number | null = null;
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
    setMove("KeyW", ny < -MOVE_DEADZONE);
    setMove("KeyS", ny > MOVE_DEADZONE);
    setMove("KeyA", nx < -MOVE_DEADZONE);
    setMove("KeyD", nx > MOVE_DEADZONE);
    setMove("ShiftLeft", ny < -MOVE_DEADZONE && mag > TOUCH_SPRINT_THRESHOLD); // 앞으로 꽉 밀면 달리기
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

  const onJumpStart = (e: TouchEvent) => {
    e.preventDefault();
    if (jumpId !== null) return;
    jumpId = e.changedTouches[0].identifier;
    cb.setKey("Space", true);
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
      else if (id === jumpId) {
        cb.setKey("Space", false);
        jumpId = null;
      }
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
  jumpBtn.addEventListener("touchstart", onJumpStart, { passive: false });
  window.addEventListener("touchmove", onWindowMove, { passive: false });
  window.addEventListener("touchend", onWindowEnd, { passive: false });
  window.addEventListener("touchcancel", onWindowEnd, { passive: false });

  const cleanups = [
    tap(attackBtn, () => cb.interact()),
    tap(skillR, () => cb.useSkill(1)),
    tap(skillT, () => cb.useSkill(2)),
    tap(skillF, () => cb.useSkill(3)),
    tap(invBtn, () => cb.togglePanel("inventory")),
    tap(mapBtn, () => cb.togglePanel("map")),
    tap(saveBtn, () => cb.saveGame()),
  ];

  return {
    destroy() {
      joystick.removeEventListener("touchstart", onJoystickStart);
      lookZone.removeEventListener("touchstart", onLookStart);
      jumpBtn.removeEventListener("touchstart", onJumpStart);
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
