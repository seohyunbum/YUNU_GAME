/* 브라우저 스모크 테스트 — 오픈월드판.
 * 콘솔 오류 0 · 지형 위 걷기 · 점프 · 지역 이동 · 몬스터 출현 · 전투 ·
 * 쓰러짐/부활 · 드로우콜 예산 · 지역별 스크린샷까지 한 번에 확인한다.
 *
 * 사용법: node scripts/smoke.mjs [출력폴더]
 * (playwright 필요: npm i playwright — 저장소에는 커밋하지 않는다)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(process.argv[2] || resolve(root, '.smoke'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('file://' + resolve(root, 'index.html'));
await page.waitForFunction(() => !!window.LEGO_GAME, null, { timeout: 30000 });
// 소프트웨어 렌더러는 늘 느리다 — 자동 품질 저하를 끄고 최고 품질로 확인한다
await page.evaluate(() => { window.LEGO_GAME.autoQuality = false; });
await page.waitForTimeout(1200);
await page.screenshot({ path: resolve(outDir, '01-start.png') });

await page.evaluate(() => window.LEGO_GAME.start());
await page.waitForTimeout(900);
await page.screenshot({ path: resolve(outDir, '02-city.png') });

// ---------------------------------------------------------------- 지형 위 걷기
await page.keyboard.down('KeyW');
await page.waitForTimeout(1600);
await page.keyboard.up('KeyW');
const walk = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const p = g.player.pos;
  return {
    z: Math.round(p.z),
    onGround: Math.abs(p.y - g.world.heightAt(p.x, p.z)) < 0.6,
    state: g.state,
  };
});
if (walk.z >= 30) throw new Error('W 키로 앞으로 못 갔다: ' + JSON.stringify(walk));
if (!walk.onGround) throw new Error('지면에 붙어 있지 않다: ' + JSON.stringify(walk));
console.log('걷기 확인:', JSON.stringify(walk));

// ---------------------------------------------------------------- 점프
const jump = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const y0 = g.player.pos.y;
  g.jump();
  await new Promise((r) => setTimeout(r, 120));
  const rose = g.player.velY > 0 || g.player.pos.y > y0 + 0.2;
  // 다시 땅에 닿을 때까지
  const t0 = Date.now();
  // 소프트웨어 렌더러에서는 프레임이 느려 게임 시간도 느리게 흐른다 → 넉넉히 기다린다
  while (!g.player.onGround && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
  return { rose, landed: g.player.onGround };
});
if (!jump.rose || !jump.landed) throw new Error('점프가 동작하지 않는다: ' + JSON.stringify(jump));
console.log('점프 확인:', JSON.stringify(jump));

// ---------------------------------------------------------------- 지역 순회
// 좌표는 게임의 지역 표에서 직접 읽는다(지도가 바뀌어도 테스트가 낡지 않게)
const regionIds = await page.evaluate(() =>
  window.LEGO_GAME.world.regions.filter((r) => r.build).map((r) => r.id));
console.log('지역 수:', regionIds.length + 1, '(안전지대 포함)');

const shotOf = { zombie: '03-zombie', cave: '04-cave', mount: '05-mount', swamp: '06-swamp',
  desert: '09-desert', pyramid: '10-pyramid', zone13: '11-zone13', museum: '12-museum' };
const broken = [];
for (const id of regionIds) {
  const info = await page.evaluate((id) => {
    const g = window.LEGO_GAME;
    const r = g.world.byId[id];
    const x = r.cx, z = r.cz + r.r * 0.42;
    try {
      g.player.pos.set(x, g.world.heightAt(x, z), z);
      g.player.eyeY = g.player.pos.y + 4.6;
      g.player.yaw = 0;
      g.player.pitch = 0;
      g.world.update(x, z, 0.016, 60);
      g.enemies.clear();
      const seeded = g.enemies.seedRegion(g.player.pos, g.world.current, 3);
      const c = g.world.content[id];
      return { id, region: g.world.current && g.world.current.id, seeded,
        props: c ? c.group.children.length : 0, ground: g.world.heightAt(x, z) };
    } catch (e) { return { id, error: e.message }; }
  }, id);
  if (info.error || info.props < 3 || !Number.isFinite(info.ground)) broken.push(info);
  if (shotOf[id]) {
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      window.LEGO_GAME.hud.dom.toast.classList.remove('on');
      window.LEGO_GAME.hud.dom.banner.classList.remove('on');
    });
    await page.screenshot({ path: resolve(outDir, shotOf[id] + '.png') });
  } else {
    await page.waitForTimeout(60);
  }
}
if (broken.length) throw new Error('제대로 지어지지 않은 지역: ' + JSON.stringify(broken));
console.log('지역 전부 조립 확인 (' + regionIds.length + '곳)');

// ---------------------------------------------------------------- 전투
const combat = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const zr = g.world.byId.zombie;
  const x = zr.cx, z = zr.cz;
  g.player.pos.set(x, g.world.heightAt(x, z), z);
  g.player.yaw = 0;
  g.player.pitch = 0;
  g.world.update(x, z, 0.016, 100);
  await new Promise((r) => setTimeout(r, 700));   // 카메라가 따라올 시간
  const tz = g.player.pos.z - 16;
  const target = g.enemies.spawnAt('zombie',
    new THREE.Vector3(g.player.pos.x, g.world.heightAt(g.player.pos.x, tz), tz), { region: 'zombie' });
  await new Promise((r) => setTimeout(r, 500));
  const hp0 = target.hp;
  g.hands.setWeapon(1);                            // 총
  for (let i = 0; i < 8; i++) {
    g.player.weaponCd = 0;
    g.attack();
    await new Promise((r) => setTimeout(r, 400));
  }
  return { hpDrop: hp0 - target.hp, ammo: g.player.ammo.blaster };
});
if (combat.hpDrop <= 0) throw new Error('총알이 몬스터를 못 맞혔다: ' + JSON.stringify(combat));
console.log('전투 확인:', JSON.stringify(combat));
await page.screenshot({ path: resolve(outDir, '07-combat.png') });

// ---------------------------------------------------------------- 보스
const boss = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const mr = g.world.byId.mount;
  const x = mr.cx + 12, z = mr.cz + 10;
  g.player.pos.set(x, g.world.heightAt(x, z), z);
  g.player.yaw = -1.2;
  g.world.update(x, z, 0.016, 200);
  // 앞선 순회에서 보스를 한 번 만나 재등장 대기시간이 걸려 있을 수 있다
  g.enemies.bossCooldown = {};
  const t0 = Date.now();
  while (!g.enemies.boss && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 100));
  return { boss: !!g.enemies.boss, type: g.enemies.boss && g.enemies.boss.type };
});
if (!boss.boss) throw new Error('산 정상 보스가 나타나지 않았다');
console.log('보스 확인:', JSON.stringify(boss));
await page.screenshot({ path: resolve(outDir, '08-boss.png') });

// ---------------------------------------------------------------- 쓰러짐 → 부활
const revive = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  g.hurtPlayer(99);
  const downState = g.state;
  g.downTimer = 0.05;          // 느린 렌더러에서 오래 기다리지 않게 바로 깨어나게
  const t0 = Date.now();
  while (g.state !== 'playing' && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 100));
  return {
    downState, state: g.state, hearts: g.player.hearts,
    atCity: Math.hypot(g.player.pos.x, g.player.pos.z - 30) < 5,
    region: g.world.current && g.world.current.id,
  };
});
if (revive.downState !== 'down' || revive.state !== 'playing' || !revive.atCity) {
  throw new Error('쓰러짐/부활 흐름이 깨졌다: ' + JSON.stringify(revive));
}
console.log('부활 확인:', JSON.stringify(revive));

// ---------------------------------------------------------------- 세상 크기 · 빠른 이동
const size = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const d = (a, b) => Math.round(Math.hypot(a.cx - b.cx, a.cz - b.cz));
  const R = g.world.byId;
  return {
    도시_좀비: d(R.city, R.zombie), 도시_동굴: d(R.city, R.cave),
    도시_산: d(R.city, R.mount), 도시_늪: d(R.city, R.swamp),
    가로: Math.round(Math.max(R.zone13.cx + R.zone13.r, R.pyramid.cx + R.pyramid.r) - (R.zone98.cx - R.zone98.r)),
    세로: Math.round((R.zone81.cz + R.zone81.r) - (R.zone1.cz - R.zone1.r)),
  };
});
if (size.도시_좀비 < 800 || size.가로 < 5000) {
  throw new Error('세상이 예상보다 좁다: ' + JSON.stringify(size));
}
console.log('세상 크기:', JSON.stringify(size));

const travel = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  g.regionVisited.zombie = true;
  g.enemies.clear();
  // 북문 표지판 앞으로 가서 T
  g.player.pos.set(0, g.world.heightAt(0, -244), -244);
  await new Promise((r) => setTimeout(r, 300));
  const hint = !!g.world.travelNear(g.player.pos.x, g.player.pos.z, 16);
  g.fastTravel();
  const p = g.player.pos;
  return { hint, x: Math.round(p.x), z: Math.round(p.z), region: g.world.regionAt(p.x, p.z).id };
});
if (!travel.hint || travel.region !== 'zombie') {
  throw new Error('표지판 빠른 이동이 동작하지 않는다: ' + JSON.stringify(travel));
}
console.log('빠른 이동 확인:', JSON.stringify(travel));

// ---------------------------------------------------------------- 성능
const fps = await page.evaluate(async () => {
  let frames = 0;
  const t0 = performance.now();
  await new Promise((res) => {
    function tick() {
      frames++;
      if (performance.now() - t0 > 2500) res();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  return Math.round((frames / (performance.now() - t0)) * 1000);
});
const info = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const r = g.renderer;
  r.info.autoReset = false;
  r.info.reset();
  r.render(g.scene, g.camera);
  const out = { calls: r.info.render.calls, triangles: r.info.render.triangles };
  r.info.autoReset = true;
  out.chunks = g.world.terrain.chunks.size;
  return out;
});

await browser.close();

console.log('FPS(소프트웨어 렌더러 기준):', fps);
console.log('드로우콜:', info.calls, '/ 삼각형:', info.triangles, '/ 지형 청크:', info.chunks);
if (info.calls > 1100) {
  console.error('드로우콜이 예산(1100)을 넘었다: ' + info.calls);
  process.exit(1);
}
if (errors.length) {
  console.error('오류 ' + errors.length + '건:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('오류 없음. 스크린샷:', outDir);
