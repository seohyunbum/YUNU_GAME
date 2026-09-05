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
// 프레임이 느린 환경에서도 결과가 같도록 물리를 직접 돌린다(게임 시간 2초 분량)
const jump = await page.evaluate(() => {
  const g = window.LEGO_GAME;
  const y0 = g.player.pos.y;
  g.jump();
  let rose = g.player.velY > 0;
  for (let i = 0; i < 130; i++) {
    g.updatePlayer(0.016);
    if (g.player.pos.y > y0 + 0.2) rose = true;
  }
  return { rose, landed: g.player.onGround, y0: Math.round(y0), y1: Math.round(g.player.pos.y) };
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

// ---------------------------------------------------------------- 무기·스킬 · 받침대
const arsenal = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const out = { weapons: window.LEGO.WEAPONS.length, skills: window.LEGO.SKILLS.length };
  // 잠긴 무기는 들 수 없다
  g.unlocked = window.LEGO.STARTERS();
  g.hud.setUnlocks(g.unlocked);
  g.hands.setWeapon(0);
  g.hands.setWeapon(3);
  out.lockedBlocked = g.hands.currentWeapon().id === 'sword';
  // 받침대까지 가면 얻는다 (폐광의 망치)
  const rg = g.world.byId.oldmine;
  const f = window.LEGO.weaponById('hammer').find;
  const x = rg.cx + f.dx, z = rg.cz + f.dz;
  g.player.pos.set(x, g.world.heightAt(x, z), z);
  g.world.update(x, z, 0.016, 200);
  // 받침대는 소품을 피해 조금 비껴 설 수 있다 — 실제로 선 자리로 걸어간다
  let ped = null;
  for (let i = 0; i < g.world.finds.length; i++) {
    if (g.world.finds[i].id === 'hammer') { ped = g.world.finds[i]; break; }
  }
  out.pedestal = !!ped;
  out.drift = ped ? Math.round(Math.hypot(ped.x - x, ped.z - z)) : -1;
  if (ped) {
    g.player.pos.set(ped.x, g.world.heightAt(ped.x, ped.z), ped.z);
    const fnd = g.world.findNear(g.player.pos.x, g.player.pos.z, window.LEGO.PLAYER.findRange);
    out.reached = !!fnd;
    if (fnd) g.takeFind(fnd);
  }
  out.gotHammer = !!g.unlocked.hammer;
  // 모두 열고 한 번씩 써 본다
  window.LEGO.WEAPONS.forEach((w) => { g.unlocked[w.id] = true; });
  window.LEGO.SKILLS.forEach((k) => { g.unlocked[k.id] = true; });
  g.hud.setUnlocks(g.unlocked);
  await new Promise((res) => setTimeout(res, 300));
  const used = [];
  for (let i = 0; i < window.LEGO.WEAPONS.length; i++) {
    g.hands.setWeapon(i);
    g.player.weaponCd = 0;
    g.player.mana = 100;
    const id = g.hands.currentWeapon().id;
    if (id === 'flamer') { g.input.attackHeld = true; g.updateFlamer(0.1); g.input.attackHeld = false; }
    else g.attack();
    used.push(id);
    await new Promise((res) => setTimeout(res, 120));
  }
  const cast = [];
  for (let i = 0; i < window.LEGO.SKILLS.length; i++) {
    g.hands.setSkill(i);
    g.player.mana = 100;
    g.player.channelTimer = 0;
    const id = g.hands.currentSkill().id;
    g.skillCd[id] = 0;
    g.cast();
    cast.push(id);
    await new Promise((res) => setTimeout(res, 150));
  }
  out.used = used.join(',');
  out.cast = cast.join(',');
  return out;
});
if (arsenal.weapons !== 9 || arsenal.skills !== 7) throw new Error('무기·스킬 수가 다르다: ' + JSON.stringify(arsenal));
if (!arsenal.lockedBlocked) throw new Error('못 찾은 무기를 들 수 있다: ' + JSON.stringify(arsenal));
if (!arsenal.pedestal || !arsenal.reached || !arsenal.gotHammer) {
  throw new Error('받침대에서 못 얻었다: ' + JSON.stringify(arsenal));
}
if (arsenal.drift > 40) throw new Error('받침대가 적힌 자리에서 너무 멀다: ' + JSON.stringify(arsenal));
if (arsenal.used.split(',').length !== 9 || arsenal.cast.split(',').length !== 7) {
  throw new Error('무기·스킬을 다 못 썼다: ' + JSON.stringify(arsenal));
}
console.log('무기·스킬 확인:', JSON.stringify(arsenal));

// ---------------------------------------------------------------- 시설 실내
const indoor = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const r = g.world.byId.zone13;
  // 정문 앞에서 안으로 들어가 본다
  g.player.pos.set(r.cx, g.world.heightAt(r.cx, r.cz + 40), r.cz + 40);
  g.world.update(r.cx, r.cz, 0.016, 200);
  await new Promise((res) => setTimeout(res, 200));
  const outside = g.world.indoors(g.player.pos.x, g.player.pos.z, g.player.pos.y + 4.6);
  // 복도 한가운데로
  g.player.pos.set(r.cx, g.world.heightAt(r.cx, r.cz + 10), r.cz + 10);
  const inside = g.world.indoors(g.player.pos.x, g.player.pos.z, g.player.pos.y + 4.6);
  // 복도 벽을 밀어 본다(뚫고 나가면 안 된다)
  g.player.pos.set(r.cx - 3, g.world.heightAt(r.cx - 3, r.cz), r.cz);
  const x0 = g.player.pos.x;
  for (let i = 0; i < 40; i++) {
    g._tryMove(-1.2, 0);
    window.LEGO.resolveCollision(g.player.pos, 2.0, g.world.colliders);
  }
  const pushed = Math.abs(g.player.pos.x - x0);
  return { outside, inside, pushed: Math.round(pushed) };
});
if (indoor.outside || !indoor.inside || indoor.pushed > 6) {
  throw new Error('시설 실내가 제대로 동작하지 않는다: ' + JSON.stringify(indoor));
}
console.log('시설 실내 확인:', JSON.stringify(indoor));

// ---------------------------------------------------------------- 판타지 지역 · 몬스터
const fantasy = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const out = { built: {}, mobs: {} };
  for (const id of ['wizardtower', 'castle', 'dragonnest', 'fairywood', 'isles', 'dungeon']) {
    const r = g.world.byId[id];
    if (!r) { out.built[id] = -1; continue; }
    const x = r.cx, z = r.cz + r.r * 0.4;
    g.player.pos.set(x, g.world.heightAt(x, z), z);
    g.world.update(x, z, 0.016, 80);
    const c = g.world.content[id];
    out.built[id] = c ? c.group.children.length : 0;
  }
  g.enemies.clear();
  for (const t of ['goblin', 'skeleton']) {
    const e = g.enemies.spawnAt(t, new THREE.Vector3(g.player.pos.x + 6, g.player.pos.y, g.player.pos.z - 10), {});
    out.mobs[t] = !!e;
  }
  await new Promise((res) => setTimeout(res, 200));
  return out;
});
for (const id in fantasy.built) {
  if (fantasy.built[id] < 5) throw new Error('판타지 지역이 안 지어졌다: ' + id + ' ' + JSON.stringify(fantasy));
}
if (!fantasy.mobs.goblin || !fantasy.mobs.skeleton) throw new Error('새 몬스터가 안 나온다: ' + JSON.stringify(fantasy));
console.log('판타지 확인:', JSON.stringify(fantasy));

// ---------------------------------------------------------------- 성 본채 실내
const keep = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const r = g.world.byId.castle;
  // 안뜰(본채 밖)
  g.player.pos.set(r.cx, g.world.heightAt(r.cx, r.cz + 30), r.cz + 30);
  g.world.update(r.cx, r.cz, 0.016, 200);
  await new Promise((res) => setTimeout(res, 200));
  const outside = g.world.indoors(g.player.pos.x, g.player.pos.z, g.player.pos.y + 4.6);
  // 현관 홀 안
  const iz = r.cz - 12;
  g.player.pos.set(r.cx, g.world.heightAt(r.cx, iz), iz);
  const inside = g.world.indoors(g.player.pos.x, g.player.pos.z, g.player.pos.y + 4.6);
  // 바깥 벽을 밀어 본다(뚫고 나가면 안 된다)
  g.player.pos.set(r.cx - 28, g.world.heightAt(r.cx - 28, iz), iz);
  const x0 = g.player.pos.x;
  for (let i = 0; i < 40; i++) {
    g._tryMove(-1.2, 0);
    window.LEGO.resolveCollision(g.player.pos, 2.0, g.world.colliders);
  }
  const pushed = Math.abs(g.player.pos.x - x0);
  // 옥좌의 방까지 걸어 들어갈 수 있나 (문을 지나 안쪽으로)
  const tz = r.cz - 40;
  g.player.pos.set(r.cx, g.world.heightAt(r.cx, tz), tz);
  const throne = g.world.indoors(g.player.pos.x, g.player.pos.z, g.player.pos.y + 4.6);
  return { outside, inside, throne, pushed: Math.round(pushed) };
});
if (keep.outside || !keep.inside || !keep.throne || keep.pushed > 6) {
  throw new Error('성 본채 실내가 제대로 동작하지 않는다: ' + JSON.stringify(keep));
}
console.log('성 본채 확인:', JSON.stringify(keep));

// ---------------------------------------------------------------- 밤낮 · 달빛
const daynight = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  const dn = g.dayNight;
  // 실내에서 재면 손전등이 섞이니 바깥 들판으로 나가서 잰다
  g.player.pos.set(0, g.world.heightAt(0, 400), 400);
  g.world.update(0, 400, 0.016, 200);
  dn.frozen = true;                     // 재는 동안 시간을 세워 둔다
  const read = (t) => {
    dn.setTime(t);
    for (let i = 0; i < 90; i++) g.updateAmbience(0.05);   // 색이 목표까지 따라붙게
    return {
      phase: dn.phase().name,
      day: Math.round(dn.day * 100) / 100,
      sun: Math.round(g.sun.intensity * 100) / 100,
      stars: Math.round(dn.stars.material.opacity * 100) / 100,
      moon: dn.moon.visible,
      sunDisc: dn.sunDisc.visible,
      torch: Math.round(g.torch.intensity * 100) / 100,
      // 하늘·안개에 곱하는 색 — 낮에는 반드시 흰색이어야 한다(어두우면 낮 하늘이 죽는다)
      tint: [dn.tint.r, dn.tint.g, dn.tint.b].map((v) => Math.round(v * 100) / 100),
      sky: Math.round(g.city.anim.sky.material.color.b * 100) / 100,
    };
  };
  const noon = read(0.5);
  const night = read(0.0);
  const dusk = read(0.76);      // 노을 — 낮도 밤도 아닌 사이여야 한다
  dn.frozen = false;
  dn.setTime(0.32);
  for (let i = 0; i < 40; i++) g.updateAmbience(0.05);
  return { noon, night, dusk, clock: dn.clock() };
});
if (daynight.noon.day !== 1 || daynight.night.day !== 0) {
  throw new Error('낮/밤 값이 이상하다: ' + JSON.stringify(daynight));
}
if (!(daynight.night.sun < daynight.noon.sun * 0.5)) {
  throw new Error('밤이 낮보다 어둡지 않다: ' + JSON.stringify(daynight));
}
if (!(daynight.night.stars > 0.5) || !daynight.night.moon || daynight.night.sunDisc) {
  throw new Error('밤 하늘에 별·달이 없다: ' + JSON.stringify(daynight));
}
if (daynight.noon.stars > 0.05 || !daynight.noon.sunDisc) {
  throw new Error('낮인데 별이 보인다: ' + JSON.stringify(daynight));
}
if (daynight.noon.tint.some((v) => v < 0.95)) {
  throw new Error('낮인데 하늘 색조가 흰색이 아니다: ' + JSON.stringify(daynight));
}
if (!(daynight.noon.sky > 0.5) || !(daynight.night.sky < daynight.noon.sky * 0.6)) {
  throw new Error('하늘 돔이 낮/밤을 따라가지 않는다: ' + JSON.stringify(daynight));
}
if (!(daynight.dusk.day > 0.05 && daynight.dusk.day < 0.95)) {
  throw new Error('노을이 낮/밤 사이가 아니다: ' + JSON.stringify(daynight));
}
if (!(daynight.night.torch > 0.6)) {
  throw new Error('밤에 등불이 안 켜진다: ' + JSON.stringify(daynight));
}
console.log('밤낮 확인:', JSON.stringify(daynight));

// ---------------------------------------------------------------- 카트 · 지도
const gear = await page.evaluate(async () => {
  const g = window.LEGO_GAME;
  g.toggleKart();
  const kartOn = g.kart.on && g.kart.group.visible;
  await new Promise((r) => setTimeout(r, 200));
  g.toggleMap();
  const mapOpen = g.state === 'map'
    && !document.getElementById('map-screen').classList.contains('hidden');
  const drawn = document.getElementById('map-canvas').width > 0;
  g.toggleMap();
  g.toggleKart();
  return { kartOn, mapOpen, drawn, back: g.state, kartOff: !g.kart.on };
});
if (!gear.kartOn || !gear.mapOpen || !gear.drawn || gear.back !== 'playing' || !gear.kartOff) {
  throw new Error('카트/지도가 제대로 동작하지 않는다: ' + JSON.stringify(gear));
}
console.log('카트·지도 확인:', JSON.stringify(gear));

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
  // 측정은 항상 같은 자리에서 (도시 광장에서 큰길을 내려다본다)
  g.player.pos.set(0, g.world.heightAt(0, 30), 30);
  g.player.yaw = 0;
  g.player.pitch = -0.06;
  g.world.update(0, 30, 0.016, 200);
  g.wilds.rebuild(0, 30);
  // 카메라는 루프에서만 움직이므로 직접 맞춰 준다(안 그러면 엉뚱한 곳을 잰다)
  g.camera.position.set(0, g.world.heightAt(0, 30) + 4.6, 30);
  g.camera.rotation.set(-0.06, 0, 0);
  g.camera.updateMatrixWorld(true);
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
