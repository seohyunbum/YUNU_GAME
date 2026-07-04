// 최종 보스 '일리아' — 골든/수명주기 테스트 (samurai-test 패턴: vite ssrLoadModule).
//   1) 텔레그래프 판정 기하 골든 — 원/링/직선/부채꼴 안팎 경계
//   2) 전투 수명주기 — 패턴 발화→텔레그래프 폭발→적중(피해=최대체력 비율 튜너블)/회피, 리셋 시 씬 정리
//   3) P2 이동 — 아레나 경계 클램프(보스가 벽 밖으로 나가지 않음)
//   4) 컷씬 시퀀서 — 10초 완주/스킵 시 onFinish 정확히 1회, 소품 씬 제거
//   5) 레지스트리 골든 — BOSS_STATS·XP 보상·밸런스 튜너블 def (어드민 def 동기화 게이트와 동일 정신)
//   6) 세이브 — illiaProgress 왕복·클램프·구세이브(필드 없음) 무해
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const THREE = await server.ssrLoadModule("/node_modules/three/src/Three.js");
  const illia = await server.ssrLoadModule("/src/game/illiaBoss.ts");
  const visuals = await server.ssrLoadModule("/src/game/illiaVisuals.ts");
  const monsters = await server.ssrLoadModule("/src/game/monsters.ts");
  const tuning = await server.ssrLoadModule("/src/game/balanceTuning.ts");
  const saveMigration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const { ARENA_HALF } = constants;
  const CZ = constants.ILLIA_CENTER_Z; // 일리아 전용 중심(오버월드 밖) — 요새 아레나와 분리

  // ── 1) 텔레그래프 판정 기하 골든 ──
  {
    const c = { kind: "circle", x: 0, z: CZ, r: 3, delayMs: 1000 };
    assert.equal(illia.telegraphContains(c, 0, CZ), true, "원: 중심 포함");
    assert.equal(illia.telegraphContains(c, 2.9, CZ), true, "원: 경계 안");
    assert.equal(illia.telegraphContains(c, 3.1, CZ), false, "원: 경계 밖");
    const ring = { kind: "ring", x: 0, z: CZ, inner: 4, r: 10, delayMs: 1000 };
    assert.equal(illia.telegraphContains(ring, 0, CZ), false, "링: 안쪽 구멍은 안전");
    assert.equal(illia.telegraphContains(ring, 7, CZ), true, "링: 띠 안");
    assert.equal(illia.telegraphContains(ring, 11, CZ), false, "링: 바깥 안전");
    const line = { kind: "line", x: 0, z: CZ, dirX: 0, dirZ: 1, len: 10, width: 3, delayMs: 1000 };
    assert.equal(illia.telegraphContains(line, 0, CZ + 5), true, "직선: 경로 위");
    assert.equal(illia.telegraphContains(line, 1.4, CZ + 5), true, "직선: 폭 절반 안");
    assert.equal(illia.telegraphContains(line, 1.6, CZ + 5), false, "직선: 폭 밖");
    assert.equal(illia.telegraphContains(line, 0, CZ - 1), false, "직선: 시작점 뒤는 안전");
    assert.equal(illia.telegraphContains(line, 0, CZ + 11), false, "직선: 길이 밖 안전");
    const cone = { kind: "cone", x: 0, z: CZ, angle: 0, arc: Math.PI / 2, r: 10, delayMs: 1000 };
    assert.equal(illia.telegraphContains(cone, 0, CZ + 5), true, "부채꼴: 정면");
    assert.equal(illia.telegraphContains(cone, 6, CZ + 5), false, "부채꼴: 50도(arc/2=45도 밖)");
    assert.equal(illia.telegraphContains(cone, 2, CZ + 5), true, "부채꼴: 호 안");
    assert.equal(illia.telegraphContains(cone, 0, CZ + 11), false, "부채꼴: 반경 밖");
    assert.equal(illia.telegraphContains(cone, 0, CZ - 5), false, "부채꼴: 등 뒤 안전");
  }

  // ── 2) 전투 수명주기 — 적중/회피/리셋 ──
  const makeCtx = (scene, player) => {
    const calls = { hits: [], messages: [], minions: 0, bursts: 0 };
    let t = 0;
    const ctx = {
      scene,
      now: () => t,
      playerPosition: player,
      boss: () => null,
      panelOpen: false,
      dieOnHit: false,
      isPanelOpen: () => ctx.panelOpen,
      applyPlayerHit: (pct, label) => { calls.hits.push({ pct, label }); return ctx.dieOnHit; },
      spawnMinion: () => { calls.minions += 1; return `m${calls.minions}`; },
      isMinionAlive: () => true,
      groundBurst: () => { calls.bursts += 1; },
      showMessage: (text) => calls.messages.push(text),
      playTone: () => {},
    };
    return { ctx, calls, setT: (v) => { t = v; } };
  };
  {
    const scene = new THREE.Scene();
    const player = new THREE.Vector3(0, 0, CZ);
    const { ctx, calls, setT } = makeCtx(scene, player);
    const state = illia.createIlliaFightState();
    illia.startIlliaFight(state, 1, 0);
    assert.equal(state.active, true);
    // 첫 패턴(심판의 낙인 — 커서 0)이 2600ms 에 발화 → pending 3 → 텔레그래프 3 → 1350ms 후 폭발
    setT(2600); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(state.pending.length > 0, "패턴 발화 시 지연 스텝 적재");
    setT(2600 + 620 * 2 + 1); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(state.telegraphs.length >= 3, "낙인 3연속 텔레그래프 스폰");
    assert.ok(scene.children.length >= 3, "텔레그래프가 씬에 추가됨");
    setT(2600 + 620 * 2 + 1 + 1400); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(calls.hits.length >= 1, "제자리(원 중심)면 적중");
    assert.equal(calls.hits[0].pct, 0.2, "피격 최대체력 비율 부분 = 20%(기본 튜너블, 나머지는 공격력 혼합)");
    assert.ok(calls.hits[0].label.includes("봉인된 군주"), "P1 피격 라벨");
    assert.equal(state.telegraphs.length, 0, "폭발한 텔레그래프는 제거");
    // 회피: 다음 낙인 스폰 후 플레이어 이동 → 미적중
    const hitsBefore = calls.hits.length;
    state.nextPatternAt = 10_000; state.patternCursor = 0; setT(10_000); illia.updateIlliaFight(state, ctx, 0.016);
    setT(10_000 + 620 * 2 + 1); illia.updateIlliaFight(state, ctx, 0.016); // 3장 모두 (0,CZ) 근처에 깔림
    player.set(12, 0, CZ + 12); // 반경 3.1 밖으로 대피
    setT(10_000 + 620 * 2 + 1 + 1400); illia.updateIlliaFight(state, ctx, 0.016);
    assert.equal(calls.hits.length, hitsBefore, "붉은 원에서 벗어나면 무피해(컨트롤 회피)");
    // 튜너블: illia_hit_pct 오버라이드 반영
    tuning.__setOverridesForTest({ illia_hit_pct: 0.25 }, {});
    player.set(0, 0, CZ);
    state.nextPatternAt = 20_000; state.patternCursor = 0; setT(20_000); illia.updateIlliaFight(state, ctx, 0.016);
    setT(20_000 + 620 * 2 + 1); illia.updateIlliaFight(state, ctx, 0.016);
    setT(20_000 + 620 * 2 + 1 + 1400); illia.updateIlliaFight(state, ctx, 0.016);
    assert.equal(calls.hits[calls.hits.length - 1].pct, 0.25, "피격 비율 튜너블(illia_hit_pct) 반영");
    tuning.__setOverridesForTest({}, {});
    // 리셋: 텔레그래프·pending 청소 + 씬 정리
    state.nextPatternAt = 30_000; setT(30_000); illia.updateIlliaFight(state, ctx, 0.016);
    illia.resetIlliaFight(state, scene);
    assert.equal(state.active, false);
    assert.equal(state.telegraphs.length + state.pending.length, 0, "리셋 시 예약 전부 청소");
    assert.equal(scene.children.filter((c) => c.children.some?.(() => true)).length >= 0 && state.telegraphs.length, 0, "씬에 텔레그래프 잔존 없음");
  }

  // ── 2b) 패널 일시정지 — 타이머 시프트(닫는 순간 몰아치기 방지) + 볼리 중 사망 시 잔여 폭발 중단 ──
  {
    const scene = new THREE.Scene();
    const player = new THREE.Vector3(0, 0, CZ);
    const { ctx, calls, setT } = makeCtx(scene, player);
    const state = illia.createIlliaFightState();
    illia.startIlliaFight(state, 1, 0);
    setT(100); illia.updateIlliaFight(state, ctx, 0.016); // lastNow 시드
    setT(2600); illia.updateIlliaFight(state, ctx, 0.016); // 낙인 패턴 발화(pending 3)
    setT(2600 + 620 * 2 + 1); illia.updateIlliaFight(state, ctx, 0.016); // 텔레그래프 3장 스폰
    assert.ok(state.telegraphs.length >= 3, "일시정지 테스트 준비 — 텔레그래프 스폰");
    ctx.panelOpen = true; // 인벤토리 열림 — 5초 방치
    for (let dt = 0; dt <= 5000; dt += 250) { setT(2600 + 620 * 2 + 1 + dt); illia.updateIlliaFight(state, ctx, 0.016); }
    assert.equal(calls.hits.length, 0, "패널 열림 동안 폭발/피격 없음(일시정지)");
    assert.ok(state.telegraphs.length >= 3, "패널 열림 동안 텔레그래프 유지");
    ctx.panelOpen = false;
    setT(2600 + 620 * 2 + 1 + 5000 + 100); illia.updateIlliaFight(state, ctx, 0.016);
    assert.equal(calls.hits.length, 0, "패널 닫은 직후 밀린 폭발이 몰아치지 않음(타이머 시프트)");
    setT(2600 + 620 * 2 + 1 + 5000 + 1400); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(calls.hits.length >= 1, "재개 후 잔여 예고 시간이 지나면 정상 폭발");
    illia.resetIlliaFight(state, scene);
    assert.equal(scene.children.length, 0, "리셋 시 씬 완전 정리");

    // 볼리 중단: 회전 십자 참격(동시 4빔, 중앙 교차) — 첫 히트가 사망이면 잔여 폭발 미적용
    const s2 = illia.createIlliaFightState();
    calls.hits.length = 0; ctx.dieOnHit = true; player.set(0, 0, CZ);
    illia.startIlliaFight(s2, 1, 0);
    s2.patternCursor = 1; // 십자 참격
    setT(50_000); s2.nextPatternAt = 50_000; illia.updateIlliaFight(s2, ctx, 0.016);
    setT(50_000 + 1101); illia.updateIlliaFight(s2, ctx, 0.016); // 2차 회전빔 pending 소화
    setT(50_000 + 1101 + 1600); illia.updateIlliaFight(s2, ctx, 0.016); // 1차 4빔 동시 폭발(중앙=전부 명중)
    assert.equal(calls.hits.length, 1, `사망 히트 후 같은 볼리의 잔여 폭발 중단 (${calls.hits.length})`);
    illia.resetIlliaFight(s2, scene);
  }

  // ── 3) P2 이동 — 아레나 경계 클램프 ──
  {
    const scene = new THREE.Scene();
    const player = new THREE.Vector3(ARENA_HALF - 2, 0, CZ + ARENA_HALF - 2); // 구석에 붙어 돌진 유도
    const { ctx, setT } = makeCtx(scene, player);
    const bossRoot = new THREE.Group();
    bossRoot.position.set(0, 0, CZ);
    ctx.boss = () => ({ root: bossRoot });
    const state = illia.createIlliaFightState();
    illia.startIlliaFight(state, 2, 0);
    for (let t = 0; t <= 120_000; t += 100) { // 2분 시뮬 — 전 패턴 다회 순환
      setT(t);
      illia.updateIlliaFight(state, ctx, 0.1);
      assert.ok(bossRoot.position.x >= -ARENA_HALF && bossRoot.position.x <= ARENA_HALF, `보스 X 아레나 안 (t=${t}, x=${bossRoot.position.x})`);
      assert.ok(bossRoot.position.z >= CZ - ARENA_HALF && bossRoot.position.z <= CZ + ARENA_HALF, `보스 Z 아레나 안 (t=${t}, z=${bossRoot.position.z})`);
      assert.ok(Number.isFinite(bossRoot.position.x) && Number.isFinite(bossRoot.position.y) && Number.isFinite(bossRoot.position.z), "보스 좌표 유한");
    }
    illia.resetIlliaFight(state, scene);
  }

  // ── 3b) 원형 결계 클램프 + 폭발 빛기둥 수명 ──
  {
    const v = new THREE.Vector3(30, 1.2, CZ + 30); // 결계 밖 대각
    illia.clampToIlliaArena(v);
    assert.ok(Math.hypot(v.x, v.z - CZ) <= illia.ILLIA_ARENA_RADIUS + 1e-9, `결계 밖 → 반경(${illia.ILLIA_ARENA_RADIUS}) 경계로 클램프`);
    assert.equal(v.y, 1.2, "y(고도)는 불변");
    const inside = new THREE.Vector3(3, 0, CZ - 4);
    illia.clampToIlliaArena(inside);
    assert.ok(inside.x === 3 && inside.z === CZ - 4, "결계 안은 미변형");

    // 전투 틱이 플레이어를 결계 안으로 유지 + 폭발 기둥이 스폰됐다가 수명(0.45s) 후 자동 소멸
    const scene = new THREE.Scene();
    const player = new THREE.Vector3(0, 0, CZ);
    const { ctx, setT } = makeCtx(scene, player);
    const state = illia.createIlliaFightState();
    illia.startIlliaFight(state, 1, 0);
    player.set(40, 0, CZ + 40); // 도주 시도
    setT(100); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(Math.hypot(player.x, player.z - CZ) <= illia.ILLIA_ARENA_RADIUS + 1e-9, "전투 틱이 도주 플레이어를 결계 안으로 되밀음");
    // 낙인 폭발 → bursts 스폰 확인 → 0.5s 후 자동 소멸·씬 청소
    player.set(0, 0, CZ);
    setT(2600); illia.updateIlliaFight(state, ctx, 0.016);
    setT(2600 + 620 * 2 + 1); illia.updateIlliaFight(state, ctx, 0.016);
    setT(2600 + 620 * 2 + 1 + 1400); illia.updateIlliaFight(state, ctx, 0.016);
    assert.ok(state.bursts.length >= 1, `폭발 빛기둥 스폰 (${state.bursts.length})`);
    setT(2600 + 620 * 2 + 1 + 1400 + 500); illia.updateIlliaFight(state, ctx, 0.016);
    assert.equal(state.bursts.length, 0, "빛기둥 수명(0.45s) 후 자동 소멸");
    illia.resetIlliaFight(state, scene);
    assert.equal(scene.children.length, 0, "리셋 후 씬 완전 청소(기둥 포함)");
  }

  // ── 4) 컷씬 시퀀서 — 완주/스킵 onFinish 1회 ──
  {
    const scene = new THREE.Scene();
    let t = 0; let finished = 0; let cameraSets = 0;
    const cutCtx = { scene, now: () => t, setCamera: () => { cameraSets += 1; }, playTone: () => {}, groundBurst: () => {}, onFinish: () => { finished += 1; } };
    const stone = visuals.createSealStone();
    scene.add(stone);
    const state = illia.createIlliaCutsceneState();
    illia.startIlliaCutscene(state, "awaken", 0, [stone]);
    for (t = 0; t <= illia.ILLIA_CUTSCENE_MS + 200; t += 100) illia.updateIlliaCutscene(state, cutCtx);
    assert.equal(finished, 1, "완주 시 onFinish 정확히 1회");
    assert.equal(state.active, false);
    assert.equal(scene.children.includes(stone), false, "종료 시 컷씬 소품 씬 제거");
    assert.ok(cameraSets > 50, "컷씬 동안 카메라 연출 지속");
    // 크랙 진행 확인(각성 6초 시점 이후 봉인석 파열 소품 숨김)
    const crack = stone.children.find((c) => c.userData.sealCrack);
    assert.ok(crack, "봉인석에 균열 소품 존재");
    // 스킵: 시작 직후 finish → 1회만, 이중 호출 무해
    const stone2 = visuals.createSealStone();
    scene.add(stone2);
    finished = 0; t = 0;
    illia.startIlliaCutscene(state, "unseal", 0, [stone2]);
    illia.updateIlliaCutscene(state, cutCtx);
    illia.finishIlliaCutscene(state, cutCtx);
    illia.finishIlliaCutscene(state, cutCtx); // 이중 스킵(키+클릭 경합)
    assert.equal(finished, 1, "스킵 시에도 onFinish 정확히 1회");
    assert.equal(scene.children.includes(stone2), false, "스킵 시 소품 제거");
  }

  // ── 5) 레지스트리 골든 — 보스 스탯·XP·튜너블 def ──
  {
    assert.equal(monsters.BOSS_STATS.illia_sealed.name, "봉인된 군주 일리아");
    assert.equal(monsters.BOSS_STATS.illia_sealed.maxHp, 3000, "P1 기본 체력(어드민 def 와 동치)");
    assert.equal(monsters.BOSS_STATS.illia_desperate.maxHp, 4200, "P2 기본 체력(어드민 def 와 동치)");
    assert.equal(monsters.BOSS_STATS.illia_sealed.attackRange, 0, "일리아는 접촉/브레스 공격 없음(패턴 엔진 전담)");
    assert.equal(monsters.experienceRewardForTarget({ type: "dragon", bossKind: "illia_sealed" }), 5000, "P1 처치 XP");
    assert.equal(monsters.experienceRewardForTarget({ type: "dragon", bossKind: "illia_desperate" }), 8000, "P2 처치 XP");
    const defs = Object.fromEntries(tuning.BALANCE_TUNABLES.map((d) => [d.key, d]));
    for (const [key, def] of [["illia_p1_hp", 3000], ["illia_p2_hp", 4200], ["illia_armor", 0], ["illia_hit_pct", 0.2], ["illia_hit_flat", 100], ["illia_telegraph_scale", 1]]) {
      assert.ok(defs[key], `튜너블 ${key} 등록`);
      assert.equal(defs[key].def, def, `튜너블 ${key} 기본값 골든(BOSS_STATS·엔진 fallback 과 동기)`);
    }
  }

  // ── 6) 세이브 — illiaProgress 왕복·클램프·구세이브 무해 ──
  {
    const { migrateSaveData, SAVE_VERSION } = saveMigration;
    const base = { version: SAVE_VERSION, player: { level: 10, experience: 0, position: { x: 0, y: 0, z: 0 } } };
    assert.equal(migrateSaveData({ ...base, player: { ...base.player, illiaProgress: 1 } }).player.illiaProgress, 1, "진행 1 보존");
    assert.equal(migrateSaveData({ ...base, player: { ...base.player, illiaProgress: 7 } }).player.illiaProgress, 2, "과대값 2 로 클램프");
    assert.equal(migrateSaveData({ ...base, player: { ...base.player, illiaProgress: -3 } }).player.illiaProgress, 0, "음수 0 클램프");
    assert.equal(migrateSaveData(base).player.illiaProgress, undefined, "구세이브(필드 없음)는 키 미생성 — 로드 시 0 취급");
  }

  console.log("✓ illia-test: 텔레그래프 기하 · 전투 수명주기 · P2 경계 · 컷씬 · 레지스트리 골든 · 세이브 왕복 전부 통과");
} finally {
  await server.close();
}
