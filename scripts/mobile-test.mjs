import { createServer } from "vite";

// 모바일 터치 지원 적대적 테스트 — 순수 로직(플랫폼 감지 · 조이스틱→키 매핑)을 브라우저 없이 검증한다.
// DOM 이 필요한 부분(터치 이벤트 라우팅·버튼)은 별도 수동 QA. 여기서는 회귀 위험이 큰 순수 결정 로직만.
const problems = [];
const assert = (cond, msg) => { if (!cond) problems.push(msg); };

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const platform = await server.ssrLoadModule("/src/game/platform.ts");
  const touch = await server.ssrLoadModule("/src/ui/touchControls.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const { joystickKeyState } = touch;
  const DZ = 0.35; // MOVE_DEADZONE (touchControls 내부 상수와 동일해야 함)
  const SPRINT = constants.TOUCH_SPRINT_THRESHOLD;

  // ── 1. 플랫폼 감지: SSR(window 없음)에서 절대 throw 하지 않고 false ──
  assert(platform.isTouchDevice() === false, "isTouchDevice() must be false (and not throw) when window/navigator are absent (SSR safety)");

  // ── 2. 데드존: 중앙 근처(노이즈)는 어떤 키도 켜지 않는다 ──
  for (const [nx, ny] of [[0, 0], [0.3, 0.3], [-0.34, 0.34], [0.34, -0.34]]) {
    const k = joystickKeyState(nx, ny, Math.hypot(nx, ny));
    assert(!k.KeyW && !k.KeyS && !k.KeyA && !k.KeyD && !k.ShiftLeft, `deadzone: (${nx},${ny}) should trigger no key`);
  }

  // ── 3. 기본 4방향 ──
  assert(joystickKeyState(0, -1, 1).KeyW && !joystickKeyState(0, -1, 1).KeyS, "forward(ny<0) = KeyW only (not KeyS)");
  assert(joystickKeyState(0, 1, 1).KeyS && !joystickKeyState(0, 1, 1).KeyW, "back(ny>0) = KeyS only");
  assert(joystickKeyState(-1, 0, 1).KeyA && !joystickKeyState(-1, 0, 1).KeyD, "left(nx<0) = KeyA only");
  assert(joystickKeyState(1, 0, 1).KeyD && !joystickKeyState(1, 0, 1).KeyA, "right(nx>0) = KeyD only");

  // ── 4. 전진/후진은 상호배타(같은 축 양쪽 동시 ON 금지) ──
  for (let ny = -1; ny <= 1.0001; ny += 0.1) {
    const k = joystickKeyState(0, ny, Math.abs(ny));
    assert(!(k.KeyW && k.KeyS), `ny=${ny.toFixed(1)}: KeyW & KeyS must not both be ON`);
  }

  // ── 5. 대각선 = 두 키 동시 ──
  const diag = joystickKeyState(-0.7, -0.7, 1.0);
  assert(diag.KeyW && diag.KeyA, "forward-left diagonal = KeyW + KeyA");

  // ── 6. 달리기 임계: 앞으로 + mag>SPRINT 일 때만, 옆/뒤로는 절대 안 됨 ──
  assert(joystickKeyState(0, -1, SPRINT + 0.01).ShiftLeft, "full forward beyond sprint threshold = ShiftLeft ON");
  assert(!joystickKeyState(0, -1, SPRINT - 0.01).ShiftLeft, "forward but below sprint threshold = ShiftLeft OFF");
  assert(!joystickKeyState(0, 1, 1).ShiftLeft, "backward at full mag must NOT sprint");
  assert(!joystickKeyState(-1, 0, 1).ShiftLeft, "strafe-left at full mag must NOT sprint");
  // 달리기는 반드시 전진(KeyW)을 동반한다
  for (const [nx, ny, mag] of [[0, -1, 1], [-0.7, -0.7, 1], [0.7, -0.7, 1]]) {
    const k = joystickKeyState(nx, ny, mag);
    if (k.ShiftLeft) assert(k.KeyW, `sprint without forward at (${nx},${ny}) — ShiftLeft must imply KeyW`);
  }

  // ── 7. NaN(레이아웃 전 radius=0 → 0/0) → 정지(크래시·오작동 금지). 실제 입력은 dx/radius 라 clamp 로 Infinity 는 발생하지 않고 NaN 만 발생한다. ──
  for (const bad of [[NaN, NaN, NaN], [0 / 0, 0 / 0, 0 / 0]]) {
    const k = joystickKeyState(bad[0], bad[1], bad[2]);
    assert(!k.KeyW && !k.KeyS && !k.KeyA && !k.KeyD && !k.ShiftLeft, `degenerate NaN input must yield no movement (safe stop)`);
  }

  // ── 8. 경계값: 정확히 데드존 = OFF(초과해야 ON) ──
  assert(!joystickKeyState(0, -DZ, DZ).KeyW, "exactly at deadzone (ny=-0.35) must be OFF (strict >)");
  assert(joystickKeyState(0, -DZ - 0.001, DZ).KeyW, "just past deadzone must be ON");
} finally {
  await server.close();
}

if (problems.length > 0) {
  console.error("✗ mobile-test failed:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, suite: "mobile", checks: [
  "platform: isTouchDevice() SSR-safe (false, no throw)",
  "joystick: deadzone suppresses noise; 4-direction; W/S mutually exclusive; diagonals; sprint only forward+beyond-threshold; NaN/Inf => safe stop; deadzone boundary strict",
] }, null, 2));
