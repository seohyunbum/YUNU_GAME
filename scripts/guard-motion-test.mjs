// 마을 경비병 공격 모션 — 어깨 피벗 스윙 골든 (monster-motion-test 패턴).
//   1) buildStrikeArm: 무기·팔을 피벗 자식으로 재부모화하되 world 좌표 보존(손에서 분리 없음)
//   2) animateGuardStrike: 공격 발동 시 피벗이 실제로 스윙(rotation.x≠0), 종료 시 0 원복(누적 없음)
//   3) 미발동/미태깅 경비도 크래시 없이 통과
//   4) 실모델(마법사·궁수) 이 strikeArm 노출 + 무기 world 좌표가 설계값과 일치(오프셋 회귀 가드)
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const THREE = await server.ssrLoadModule("three"); // 재부모화 instanceof 일치
  const motion = await server.ssrLoadModule("/src/game/guardMotion.ts");
  const guardVisuals = await server.ssrLoadModule("/src/game/guardVisuals.ts");

  // ── 1) buildStrikeArm — world 좌표 보존 재부모화 ──
  {
    const group = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshBasicMaterial());
    arm.position.set(0.5, 1.0, 0.02);
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshBasicMaterial());
    weapon.position.set(0.72, 1.08, 0.08);
    group.add(arm, weapon);
    group.updateMatrixWorld(true);
    const before = new THREE.Vector3(); weapon.getWorldPosition(before);
    const pivot = motion.buildStrikeArm(group, [0.5, 1.3, 0.05], [arm, weapon]);
    assert.equal(group.userData.strikeArm, pivot, "strikeArm 태그");
    assert.equal(weapon.parent, pivot, "무기가 피벗 자식으로 재부모화");
    assert.equal(arm.parent, pivot, "팔이 피벗 자식으로 재부모화");
    group.updateMatrixWorld(true);
    const after = new THREE.Vector3(); weapon.getWorldPosition(after);
    assert.ok(before.distanceTo(after) < 1e-6, `재부모화 후 무기 world 좌표 보존(Δ${before.distanceTo(after)})`);
  }

  // ── 2) animateGuardStrike — 스윙 후 원복 ──
  {
    const group = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshBasicMaterial());
    arm.position.set(0.5, 1.0, 0);
    group.add(arm);
    motion.buildStrikeArm(group, [0.5, 1.3, 0], [arm]);
    const guard = { root: group };
    motion.triggerGuardStrike(guard, 0, "melee");
    motion.animateGuardStrike(guard, 420 * 0.6); // 도약 구간
    assert.ok(Math.abs(group.userData.strikeArm.rotation.x) > 0.2, `공격 시 팔 스윙(rotation.x=${group.userData.strikeArm.rotation.x.toFixed(2)})`);
    motion.animateGuardStrike(guard, 420 + 10); // 종료
    assert.ok(Math.abs(group.userData.strikeArm.rotation.x) < 1e-6, "종료 시 팔 원복(누적 없음)");
    // ranged/heavy 프로파일도 스윙
    motion.triggerGuardStrike(guard, 0, "heavy");
    motion.animateGuardStrike(guard, 720 * 0.6);
    assert.ok(Math.abs(group.userData.strikeArm.rotation.x) > 0.3, "heavy(골렘) 스윙 더 큼");
  }

  // ── 3) 미태깅/미발동 안전 ──
  {
    const bare = { root: new THREE.Group() };
    motion.animateGuardStrike(bare, 100); // strikeArm 없음 — 예외 없이 통과해야
    const g2 = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshBasicMaterial());
    g2.add(a); motion.buildStrikeArm(g2, [0, 1, 0], [a]);
    motion.animateGuardStrike({ root: g2 }, 100); // 미발동(strikeAt=0) → rest
    assert.ok(Math.abs(g2.userData.strikeArm.rotation.x) < 1e-6, "미발동은 휴식 포즈");
  }

  // ── 4) 실모델 — 마법사·궁수 strikeArm 노출 + 무기 world 좌표 설계값 ──
  for (const [type, weaponIdx, expected] of [
    ["villageMage", 4, [0.72, 1.08, 0.08]], // staff = 피벗 자식 중 3번째(arm,hand,staff...) → getWorldPosition 로 검증
    ["villageArcher", 4, [0.72, 1.28, 0.18]], // bowTop
  ]) {
    const visual = guardVisuals.createRangedGuardVisual(type);
    const pivot = visual.group.userData.strikeArm;
    assert.ok(pivot instanceof THREE.Object3D, `${type} strikeArm 노출`);
    assert.ok(pivot.children.length >= 4, `${type} 피벗에 팔+손+무기 묶임(${pivot.children.length})`);
    visual.group.updateMatrixWorld(true);
    // 무기 파츠 하나(피벗 자식 중 하나)의 world 좌표가 설계값 근처인지 — 오프셋 재부모화 정확성
    let matched = false;
    for (const child of pivot.children) {
      const wp = new THREE.Vector3(); child.getWorldPosition(wp);
      if (wp.distanceTo(new THREE.Vector3(expected[0], expected[1], expected[2])) < 0.02) matched = true;
    }
    assert.ok(matched, `${type} 무기 world 좌표가 설계값 ${JSON.stringify(expected)} 보존`);
  }

  console.log("✓ guard-motion-test: 피벗 재부모화 world 보존 · 스윙·원복 · 미태깅 안전 · 실모델 배선 전부 통과");
} finally {
  await server.close();
}
