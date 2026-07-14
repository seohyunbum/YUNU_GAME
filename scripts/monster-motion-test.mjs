// 몬스터 공격 모션 — 부위 단위(머리 물기·팔 내려치기) 골든 (illia-test 패턴).
//   1) 공격 시 몸통 이동(도약)은 절반으로 축소, 대신 머리가 앞으로 내질러진다(물기)
//   2) attackArms(팔·사지)는 예열→도약에서 rotation.z 로 후려친다
//   3) 공격 종료 시 머리·팔·몸통이 기준값으로 원복(누적 없음)
//   4) headMesh 없는 몬스터도 안전(크래시 없음)
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const THREE = await server.ssrLoadModule("three"); // predatorAi 와 동일 지정자 → instanceof 일치
  const ai = await server.ssrLoadModule("/src/game/predatorAi.ts");
  const avatar = await server.ssrLoadModule("/src/avatar.ts");

  function makePredator(withParts) {
    const root = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), new THREE.MeshBasicMaterial());
    head.position.set(0.98, 0.95, 0);
    root.add(head);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), new THREE.MeshBasicMaterial());
    arm.rotation.z = 0.1;
    root.add(arm);
    if (withParts) { root.userData.headMesh = head; root.userData.attackArms = [arm]; }
    return { root, head, arm, predatorKind: "wolf", monsterLevel: 0 };
  }

  // ── 1·2) 물기·팔 후려치기 ──
  const p = makePredator(true);
  const headBaseX = p.head.position.x;
  const armBaseZ = p.arm.rotation.z;
  ai.triggerPredatorAttackMotion(p, 0, 1, 0); // 정면(+x)으로 공격
  const duration = Number(p.root.userData.attackDuration);
  assert.ok(duration > 0, "공격 지속시간 설정");

  // 도약(strike) 구간 — phase ~0.7
  ai.animatePredatorAttackMotion(p, duration * 0.7);
  assert.ok(p.head.position.x > headBaseX + 0.1, `머리가 앞으로 내질러짐(물기): ${p.head.position.x} > ${headBaseX}`);
  assert.ok(Math.abs(p.arm.rotation.z - armBaseZ) > 0.3, `팔이 후려침: Δ${(p.arm.rotation.z - armBaseZ).toFixed(2)}`);
  const lungeStrike = Number(p.root.userData.attackLungeX ?? 0);

  // 몸통 도약은 있으나 과하지 않음(머리 리치가 더 큼 = 박치기 아님)
  assert.ok(lungeStrike > 0 && lungeStrike < (p.head.position.x - headBaseX) + 0.6, `몸통 도약이 과하지 않음: lunge ${lungeStrike.toFixed(2)}`);

  // ── 3) 종료 원복 ──
  ai.animatePredatorAttackMotion(p, duration + 10);
  assert.ok(Math.abs(p.head.position.x - headBaseX) < 1e-6, "머리 위치 원복");
  assert.ok(Math.abs(p.arm.rotation.z - armBaseZ) < 1e-6, "팔 회전 원복");
  assert.ok(Math.abs(Number(p.root.userData.attackLungeX ?? 0)) < 1e-6, "몸통 도약 오프셋 원복");
  assert.ok(Math.abs(p.root.rotation.x) < 1e-6 && Math.abs(p.root.rotation.z) < 1e-6, "몸통 회전 원복");

  // ── 4) headMesh/attackArms 없는 몬스터 — 크래시 없이 몸통 모션만 ──
  const bare = makePredator(false);
  ai.triggerPredatorAttackMotion(bare, 0, 1, 0);
  ai.animatePredatorAttackMotion(bare, Number(bare.root.userData.attackDuration) * 0.7); // 예외 없이 통과해야
  ai.animatePredatorAttackMotion(bare, Number(bare.root.userData.attackDuration) + 10);
  assert.ok(Math.abs(bare.head.position.x - 0.98) < 1e-6, "미태깅 머리는 안 건드림");

  // ── 5) 파티 원격 아바타 리깅 — 다리 스윙·팔 뻗기 피벗 + 힐러 소품 손 고정 ──
  // 파티원 이동/공격 모션은 walkLegs(2)·attackArms(2) 피벗을 흔든다. 이 배선이 없으면 통짜 슬라이드로 회귀한다.
  {
    const warrior = avatar.createAvatarModel(undefined, "warrior");
    assert.ok(Array.isArray(warrior.userData.walkLegs) && warrior.userData.walkLegs.length === 2, "walkLegs 2개(양 다리 고관절 피벗)");
    assert.ok(Array.isArray(warrior.userData.attackArms) && warrior.userData.attackArms.length === 2, "attackArms 2개(양 어깨 피벗)");
    const sides = warrior.userData.attackArms.map((p) => p.userData.armSide).sort();
    assert.deepEqual(sides, [-1, 1], "어깨 피벗 좌우 armSide 태그");
    for (const pivot of warrior.userData.attackArms) assert.equal(pivot.children.length, 5, "비힐러 팔 피벗 = 사지 5파츠(소품 없음)");

    // 힐러 지팡이·오브는 오른팔(armSide=1) 피벗에 매달려 공격 스윙에 손과 함께 움직인다(group 직속이면 분리).
    const healer = avatar.createAvatarModel(undefined, "healer");
    const rightArm = healer.userData.attackArms.find((p) => p.userData.armSide === 1);
    assert.ok(rightArm, "힐러 오른팔 피벗 존재");
    assert.equal(rightArm.children.length, 7, "힐러 오른팔 = 사지 5 + 지팡이 + 오브(손에 소품 부착)");
    const staff = rightArm.children[5]; // 사지 5개 뒤 첫 소품
    healer.updateMatrixWorld(true);
    const restPos = new THREE.Vector3(); staff.getWorldPosition(restPos);
    rightArm.rotation.x = 1.2; // 공격 스윙 흉내
    healer.updateMatrixWorld(true);
    const swungPos = new THREE.Vector3(); staff.getWorldPosition(swungPos);
    assert.ok(restPos.distanceTo(swungPos) > 0.1, `팔 스윙 시 지팡이가 손 따라 이동(Δ${restPos.distanceTo(swungPos).toFixed(2)}) — 손에서 분리 안 됨`);
  }

  console.log("✓ monster-motion-test: 머리 물기 · 팔 후려치기 · 몸통 도약 절제 · 원복 · 미태깅 안전 · 파티 아바타 리깅 전부 통과");
} finally {
  await server.close();
}
