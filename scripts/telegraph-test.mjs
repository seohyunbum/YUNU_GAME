// 텔레그래프 엔진(telegraph.ts) — 판정 기하 + 중앙 필드 수명주기 골든.
//   1) telegraphContains: 원/링/직선/부채꼴 안팎 경계
//   2) 중앙 필드: 스폰 → 폭발 전 유지 → 폭발 시 제거 + onDetonate 1회 + groundBurst 호출
//   3) active=false 면 즉시 전부 청소, clearTelegraphField 로 씬 정리
//   4) 데미지 배수 상수 골든
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const THREE = await server.ssrLoadModule("/node_modules/three/src/Three.js");
  const tg = await server.ssrLoadModule("/src/game/telegraph.ts");

  // ── 1) 판정 기하 ──
  {
    const c = { kind: "circle", x: 0, z: 0, r: 3, delayMs: 900 };
    assert.equal(tg.telegraphContains(c, 0, 0), true, "원: 중심 포함");
    assert.equal(tg.telegraphContains(c, 2.9, 0), true, "원: 경계 안");
    assert.equal(tg.telegraphContains(c, 3.1, 0), false, "원: 경계 밖");
    const line = { kind: "line", x: 0, z: 0, dirX: 0, dirZ: 1, len: 10, width: 3, delayMs: 900 };
    assert.equal(tg.telegraphContains(line, 1.4, 5), true, "직선: 폭 절반 안");
    assert.equal(tg.telegraphContains(line, 1.6, 5), false, "직선: 폭 밖");
    assert.equal(tg.telegraphContains(line, 0, -1), false, "직선: 시작 뒤 안전");
    const p = tg.telegraphBurstPoint(line);
    assert.ok(Math.abs(p.z - 5) < 1e-9, "직선 폭발점 = 경로 중앙");
  }

  // ── 2) 중앙 필드 수명주기 ──
  {
    const scene = new THREE.Scene();
    let clock = 1000;
    let bursts = 0, tones = 0;
    const vfx = { scene, now: () => clock, groundBurst: () => { bursts += 1; }, playTone: () => { tones += 1; } };
    const field = tg.createTelegraphField();
    let detonated = 0;
    const spec = { kind: "circle", x: 5, z: 0, r: 3, delayMs: 900 };
    tg.spawnFieldTelegraph(field, scene, spec, clock + 900, 2, () => { detonated += 1; });
    assert.equal(field.list.length, 1, "스폰 → 필드에 1개");
    assert.equal(scene.children.length, 1, "스폰 → 씬에 메시 그룹 추가");
    assert.ok(Math.abs(scene.children[0].position.y - 2.08) < 1e-6, "groundY+0.08 로 지형 보정");

    // 폭발 전: 유지 + 펄스(무할당) — onDetonate 미발화
    clock = 1450; tg.updateTelegraphField(field, vfx, true);
    assert.equal(field.list.length, 1, "폭발 전엔 유지");
    assert.equal(detonated, 0, "폭발 전 onDetonate 미발화");
    assert.equal(scene.children.length, 1, "폭발 전 씬 유지");

    // 폭발 시각 경과: 제거 + onDetonate 1회 + groundBurst + 폭음
    clock = 1901; tg.updateTelegraphField(field, vfx, true);
    assert.equal(detonated, 1, "폭발 시 onDetonate 정확히 1회");
    assert.equal(field.list.length, 0, "폭발 후 필드 비움");
    assert.equal(scene.children.length, 0, "폭발 후 씬에서 그룹 제거");
    assert.equal(bursts, 1, "폭발 시 groundBurst 1회");
    assert.ok(tones >= 1, "폭발 시 폭음 재생");

    // 이월 없음 — 한 번 더 update 해도 재발화 없음
    tg.updateTelegraphField(field, vfx, true);
    assert.equal(detonated, 1, "재update 에도 재발화 없음");
  }

  // ── 3) active=false 즉시 청소 + clearTelegraphField ──
  {
    const scene = new THREE.Scene();
    const vfx = { scene, now: () => 0, groundBurst: () => {}, playTone: () => {} };
    const field = tg.createTelegraphField();
    let fired = 0;
    tg.spawnFieldTelegraph(field, scene, { kind: "circle", x: 0, z: 0, r: 3, delayMs: 900 }, 5000, 0, () => { fired += 1; });
    assert.equal(scene.children.length, 1);
    tg.updateTelegraphField(field, vfx, false); // 비활성(동굴/집 진입 등) → 즉시 청소, onDetonate 미발화
    assert.equal(field.list.length, 0, "active=false → 필드 비움");
    assert.equal(scene.children.length, 0, "active=false → 씬 정리");
    assert.equal(fired, 0, "active=false 청소는 onDetonate 발화 안 함(폭발 아님)");

    tg.spawnFieldTelegraph(field, scene, { kind: "circle", x: 1, z: 1, r: 2, delayMs: 600 }, 5000, 0, () => {});
    tg.clearTelegraphField(field, scene);
    assert.equal(field.list.length, 0, "clear → 필드 비움");
    assert.equal(scene.children.length, 0, "clear → 씬 정리");
  }

  // ── 4) 데미지 배수 골든 ──
  assert.equal(tg.TELEGRAPH_DAMAGE_MULT, 2, "텔레그래프 피격 데미지 배수 = 2");

  console.log("✓ telegraph-test: 판정 기하 · 중앙 필드 수명주기 · 청소 · 데미지 배수 전부 통과");
} finally {
  await server.close();
}
