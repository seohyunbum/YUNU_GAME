/* =========================================================================
 * regionKits.js — 매개변수로 찍어내는 지역 빌더들
 *
 * 지역이 마흔 곳이라 한 곳씩 손으로 지을 수 없다. 여기 있는 빌더 열셋이
 * world.js 의 `build: { kind: ..., ... }` 를 받아 지역을 조립한다.
 *   forest(season) · beach · desert · sea(wrecked) · island · lava · pyramid
 *   mine(ore, depth, crystals, drips) · facility(code, theme, ...) · sewer
 *   arena · museum · haunted
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;
  const P2 = L.P2;
  const T = L.parts;
  const T2 = L.parts2;
  const N = L.terrainNoise;

  function rnd(i, j) { return N.hash2(Math.round(i * 131 + 7), Math.round(j * 977 + 13)); }

  function place(group, obj, x, y, z, ry, colliders, hx, hz) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    group.add(obj);
    if (colliders && hx) colliders.push({ x, z, hx, hz: hz === undefined ? hx : hz });
    return obj;
  }

  /** 지역 둘레에 고르게 흩뿌릴 좌표 하나 */
  function spot(cx, cz, i, seed, rMin, rMax) {
    const a = rnd(i, seed) * Math.PI * 2;
    const r = rMin + rnd(i, seed + 1) * (rMax - rMin);
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a };
  }

  /** 넓은잎 나무 — 계절 색을 받는다 */
  function leafTree(scale, pal) {
    const s = scale || 1;
    const g = new THREE.Group();
    const trunk = T.mesh(L.cyl(0.9 * s, 1.15 * s, 7 * s, 8), C.brown, 'matte');
    T.put(g, trunk, 0, 3.4 * s, 0);
    const inst = new THREE.InstancedMesh(L.box(1, 0.45, 1), L.studAllMaterial(0xffffff, 2), 22);
    inst.frustumCulled = false;
    inst.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < 22; i++) {
      const t = (i + 0.5) / 22;
      const phi = Math.acos(1 - 1.5 * t);
      const th = i * 2.39996323;
      const rr = (4.2 - t * 1.6) * s;
      e.set(0.05 * ((i % 5) - 2), th, 0.05 * ((i % 3) - 1));
      q.setFromEuler(e);
      pv.set(Math.sin(phi) * Math.cos(th) * rr, (7.5 + Math.cos(phi) * 2.6) * s, Math.sin(phi) * Math.sin(th) * rr);
      sv.set(2.4 * s, 1.1 * s, 2.4 * s);
      m.compose(pv, q, sv);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHex(pal[i % pal.length]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    g.add(inst);
    return g;
  }

  // ================================================================= 계절 숲
  function buildForest(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const season = (ctx.opt && ctx.opt.season) || 'spring';
    const pal = season === 'autumn' ? [0xb06a24, 0xc98a2e, 0x8a5a2a, 0xc9502e]
      : (season === 'winter' ? [0xf2f6f8, 0xdfe9ee, 0x2c6e3a]
        : (season === 'mushroom' ? [0x4a6b3a, 0x3f5c33, 0x6b4a72]
          : [0x57a34a, 0x76c25c, 0x9ad46f, 0xf0a8d0]));

    for (let i = 0; i < 26; i++) {
      const s = spot(cx, cz, i, 201, 40, R.r * 0.85);
      const y = h(s.x, s.z);
      const tree = season === 'winter'
        ? T.pineTree(1.1 + rnd(i, 202) * 0.8, true)
        : (season === 'mushroom'
          ? T.mushroom(2.2 + rnd(i, 205) * 2.2, i % 3 === 0 ? C.purple : (i % 3 === 1 ? C.red : 0xd9b23c))
          : leafTree(1.0 + rnd(i, 203) * 0.8, pal));
      place(group, tree, s.x, y, s.z, rnd(i, 204) * 6, colliders, 2);
      if (i % 3 === 0) spawns.push({ x: s.x, z: s.z });
    }
    // 쉼터: 통나무집 + 모닥불 + 텐트
    const cab = T2.logCabin(16, 13);
    place(group, cab, cx + 30, h(cx + 30, cz - 20) - 0.3, cz - 20, 0.5, colliders, 10, 9);
    const fire = T.campfire();
    place(group, fire, cx + 14, h(cx + 14, cz + 6), cz + 6, 0, colliders, 2.4);
    place(group, T.tent(season === 'winter' ? C.blue : C.red), cx - 6, h(cx - 6, cz + 16), cz + 16, 0.6, colliders, 4, 5);
    // 계절 소품
    for (let i = 0; i < 12; i++) {
      const s = spot(cx, cz, i, 211, 30, R.r * 0.7);
      const y = h(s.x, s.z);
      if (season === 'winter') {
        place(group, T2.snowman(0.8 + rnd(i, 212) * 0.5), s.x, y, s.z, rnd(i, 213) * 6, colliders, 2);
      } else if (season === 'mushroom') {
        place(group, T.mushroom(0.9 + rnd(i, 215) * 1.2, i % 2 ? C.magenta : 0x9a63e6),
          s.x, y, s.z, rnd(i, 216) * 6, colliders, 1.5);
      } else if (season === 'autumn') {
        const pile = T.mesh(L.box(5, 1.2, 5), 0xb06a24, 'matte');
        place(group, pile, s.x, y + 0.6, s.z, rnd(i, 214) * 6);
      } else {
        for (let k = 0; k < 5; k++) {
          const f = T.mesh(L.cyl(0.5, 0.5, 0.4, 6), k % 2 ? 0xf0a8d0 : 0xf2cd37);
          place(group, f, s.x + k * 1.4, y + 0.5, s.z + (k % 2) * 1.2);
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      const s = spot(cx, cz, i, 221, 50, R.r * 0.8);
      place(group, T.rock(0.9 + rnd(i, 222), season === 'winter' ? 0x8f9296 : 0x6c6e68),
        s.x, h(s.x, s.z), s.z, rnd(i, 223) * 6, colliders, 2);
    }
    if (R.entry) {
      place(group, T.signPost(season === 'winter' ? 'WINTER PLAIN'
        : (season === 'autumn' ? 'AUTUMN WOODS'
          : (season === 'mushroom' ? 'MUSHROOM WOOD' : 'SPRING FIELD')), 15),
        R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    }
    return { colliders, spawns, fire };
  }

  // ================================================================= 여름 해변
  function buildBeach(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz, waterY = R.waterY;

    for (let i = 0; i < 18; i++) {
      const s = spot(cx, cz, i, 231, 40, R.r * 0.8);
      const y = h(s.x, s.z);
      if (y < waterY) continue;
      place(group, T2.palmTree(0.9 + rnd(i, 232) * 0.7), s.x, y, s.z, rnd(i, 233) * 6, colliders, 1.6);
    }
    // 파라솔과 모래성
    for (let i = 0; i < 6; i++) {
      const s = spot(cx, cz, i, 241, 30, R.r * 0.5);
      const y = h(s.x, s.z);
      if (y < waterY + 0.5) continue;
      const g2 = new THREE.Group();
      const pole = T.mesh(L.cyl(0.24, 0.24, 7, 6), C.white, 'matte');
      T.put(g2, pole, 0, 3.5, 0);
      const top = T.mesh(new THREE.ConeGeometry(4.5, 2.2, 8), i % 2 ? C.red : C.azure);
      T.put(g2, top, 0, 7.4, 0);
      place(group, g2, s.x, y, s.z, 0, colliders, 1);
    }
    for (let i = 0; i < 4; i++) {
      const s = spot(cx, cz, i, 251, 20, R.r * 0.45);
      const y = h(s.x, s.z);
      const castle = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const lvl = L.plate(P2.sandDark, 6 - k * 1.2, 6 - k * 1.2, { height: 1.2 });
        T.put(castle, lvl, 0, 0.6 + k * 1.2, 0);
      }
      const flag = T.mesh(L.box(0.16, 2, 1.4), C.red);
      T.put(castle, flag, 0, 6.6, 0.6);
      place(group, castle, s.x, y, s.z, rnd(i, 252) * 6, colliders, 3);
    }
    // 부두 + 보트 + 부표
    const px = cx, pz0 = cz + 20;
    for (let i = 0; i < 6; i++) {
      place(group, T2.pierSection(14, 8), px, waterY + 3, pz0 + i * 14, 0);
    }
    place(group, T2.boat(C.white), cx + 14, waterY + 1.4, cz + 60, 0.5, colliders, 4, 7);
    for (let i = 0; i < 6; i++) {
      const s = spot(cx, cz, i, 261, R.r * 0.5, R.r * 0.9);
      if (h(s.x, s.z) > waterY) continue;
      place(group, T2.buoy(i % 2 ? C.red : C.yellow), s.x, waterY - 0.6, s.z);
    }
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 271, 30, R.r * 0.8);
      spawns.push({ x: s.x, z: s.z });
    }
    if (R.entry) place(group, T.signPost('SUMMER BEACH', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, water: makeWater(group, cx, cz, R.r * 1.05, waterY, 0x2f86a8) };
  }

  /** 지역을 덮는 수면 하나 */
  function makeWater(group, cx, cz, r, y, color) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshPhongMaterial({
      color: color === undefined ? 0x2f86a8 : color, emissive: 0x0d2b38,
      specular: 0xcfeeff, shininess: 180, transparent: true, opacity: 0.76, side: THREE.DoubleSide,
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, y, cz);
    group.add(water);
    return water;
  }

  // ================================================================= 사막
  function buildDesert(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;

    const salt = !!(ctx.opt && ctx.opt.salt);
    for (let i = 0; i < 26; i++) {
      const s = spot(cx, cz, i, 301, 30, R.r * 0.9);
      // 소금 사막에는 선인장 대신 소금 결정이 솟아 있다
      const piece = salt
        ? T.crystal(0.9 + rnd(i, 304) * 0.9, 0xf2f2ec)
        : T2.cactus(0.8 + rnd(i, 302) * 0.7);
      place(group, piece, s.x, h(s.x, s.z), s.z, rnd(i, 303) * 6, colliders, 1.4);
      if (i % 3 === 0) spawns.push({ x: s.x, z: s.z });
    }
    for (let i = 0; i < 14; i++) {
      const s = spot(cx, cz, i, 311, 40, R.r * 0.9);
      place(group, T.rock(1.1 + rnd(i, 312) * 1.4, salt ? 0xdcdcd2 : P2.sandDark),
        s.x, h(s.x, s.z), s.z, rnd(i, 313) * 6, colliders, 2.4);
    }
    // 오아시스
    const oy = h(cx + 40, cz + 30);
    const oasis = makeWater(group, cx + 40, cz + 30, 22, oy + 0.4, 0x2f86a8);
    void oasis;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = cx + 40 + Math.cos(a) * 26, z = cz + 30 + Math.sin(a) * 26;
      place(group, T2.palmTree(1.0 + rnd(i, 321) * 0.6), x, h(x, z), z, rnd(i, 322) * 6, colliders, 1.6);
    }
    // 대상(隊商) 야영지
    place(group, T.tent(C.tan), cx - 40, h(cx - 40, cz - 20), cz - 20, 0.4, colliders, 4, 5);
    place(group, T.tent(0xb06a24), cx - 52, h(cx - 52, cz - 8), cz - 8, -0.7, colliders, 4, 5);
    const fire = T.campfire();
    place(group, fire, cx - 46, h(cx - 46, cz - 32), cz - 32, 0, colliders, 2.4);
    for (let i = 0; i < 6; i++) {
      const x = cx - 60 + i * 5, z = cz - 40;
      place(group, i % 2 ? T.crate(1) : T.barrel(1), x, h(x, z), z, rnd(i, 331) * 3, colliders, 1.2);
    }
    // 부러진 오벨리스크
    for (let i = 0; i < 4; i++) {
      const s = spot(cx, cz, i, 341, 60, R.r * 0.7);
      const ob = new THREE.Group();
      const shaft = T.mesh(L.box(3, 14 - i * 2, 3), P2.sandBrick, 'matte');
      T.put(ob, shaft, 0, (14 - i * 2) / 2, 0);
      const cap = T.mesh(new THREE.ConeGeometry(2.2, 3, 4), C.gold, 'metal');
      T.put(ob, cap, 0, 14 - i * 2 + 1.5, 0);
      place(group, ob, s.x, h(s.x, s.z), s.z, rnd(i, 342) * 6, colliders, 2.2);
    }
    if (R.entry) place(group, T.signPost(salt ? 'SALT FLAT' : 'DESERT', 13), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, fire };
  }

  // ================================================================= 바다 · 부두
  function buildSea(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz, waterY = R.waterY;
    const wrecked = !!(ctx.opt && ctx.opt.wrecked);

    // 등대
    const lx = cx - R.r * 0.5, lz = cz - R.r * 0.35;
    place(group, T2.lighthouse(), lx, h(lx, lz), lz, 0, colliders, 7);
    // 긴 부두
    for (let i = 0; i < 10; i++) {
      place(group, T2.pierSection(14, 9), cx, waterY + 3.2, cz - 60 + i * 14, 0);
    }
    // 배 · 부표 · 화물
    place(group, T2.boat(wrecked ? 0x6a6f4a : C.white), cx + 16, waterY + 1.4, cz + 20, 0.6, colliders, 4, 7);
    if (!wrecked) place(group, T2.boat(C.azure), cx - 18, waterY + 1.4, cz - 10, -0.4, colliders, 4, 7);
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 401, R.r * 0.4, R.r * 0.92);
      if (h(s.x, s.z) > waterY) continue;
      place(group, T2.buoy(i % 3 === 0 ? C.yellow : C.red), s.x, waterY - 0.6, s.z);
    }
    for (let i = 0; i < 10; i++) {
      const x = cx - 12 + (i % 5) * 6, z = cz + 74 + Math.floor(i / 5) * 6;
      place(group, i % 2 ? T.crate(1.1) : T.barrel(1.1), x, Math.max(h(x, z), waterY), z, rnd(i, 402) * 3, colliders, 1.3);
    }
    if (wrecked) {
      for (let i = 0; i < 3; i++) {
        const s = spot(cx, cz, i, 411, 40, R.r * 0.7);
        place(group, T2.shipwreck(0.9 + rnd(i, 412) * 0.6), s.x, Math.max(h(s.x, s.z), waterY - 3), s.z,
          rnd(i, 413) * 6, colliders, 8, 12);
      }
      for (let i = 0; i < 8; i++) {
        const s = spot(cx, cz, i, 421, 30, R.r * 0.8);
        place(group, T2.radBarrel(), s.x, Math.max(h(s.x, s.z), waterY), s.z, 0, colliders, 1.1);
      }
      place(group, T2.hazardSign('CLOSED SEA', C.black), cx + 10, h(cx + 10, cz + 96), cz + 96, Math.PI, colliders, 1);
    }
    for (let i = 0; i < 12; i++) {
      const s = spot(cx, cz, i, 431, 40, R.r * 0.85);
      spawns.push({ x: s.x, z: s.z });
    }
    if (R.entry) place(group, T.signPost(wrecked ? 'CLOSED SEA' : 'HARBOR', 14), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, water: makeWater(group, cx, cz, R.r * 1.05, waterY, wrecked ? 0x3f5f5a : 0x2f86a8) };
  }

  // ================================================================= 무인도
  function buildIsland(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz, waterY = R.waterY;

    for (let i = 0; i < 16; i++) {
      const s = spot(cx, cz, i, 501, 20, R.r * 0.5);
      const y = h(s.x, s.z);
      if (y < waterY + 1) continue;
      place(group, T2.palmTree(1.0 + rnd(i, 502) * 0.8), s.x, y, s.z, rnd(i, 503) * 6, colliders, 1.6);
    }
    place(group, T2.shipwreck(1.2), cx + R.r * 0.32, waterY + 1, cz - R.r * 0.2, 1.1, colliders, 9, 13);
    const fire = T.campfire();
    place(group, fire, cx, h(cx, cz) , cz, 0, colliders, 2.4);
    place(group, T.tent(C.tan), cx + 10, h(cx + 10, cz + 8), cz + 8, 0.5, colliders, 4, 5);
    // 보물 상자
    const chest = T.crate(1.4);
    const gold = T.mesh(L.box(2.4, 0.6, 2.4), C.gold, 'metal');
    T.put(chest, gold, 0, 3.2, 0);
    place(group, chest, cx - 8, h(cx - 8, cz + 6), cz + 6, 0.3, colliders, 2);
    // 바위 아치
    const arch = new THREE.Group();
    for (const sx of [-1, 1]) {
      const leg = T.mesh(L.box(5, 16, 6), 0x8f8676, 'matte');
      T.put(arch, leg, sx * 8, 8, 0);
    }
    const top = T.mesh(L.box(22, 5, 6), 0x8f8676, 'matte');
    T.put(arch, top, 0, 17, 0);
    place(group, arch, cx - R.r * 0.34, h(cx - R.r * 0.34, cz + R.r * 0.2), cz + R.r * 0.2, 0.6, colliders, 11, 4);
    if (ctx.opt && ctx.opt.volcano) {
      // 섬 한가운데가 화산이다
      const cone = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const ring = T.mesh(L.cyl(18 - i * 2.2, 20 - i * 2.2, 4.5, 12), i % 2 ? P2.obsidian : 0x3a2b28, 'matte');
        T.put(cone, ring, 0, 2.2 + i * 4.5, 0);
      }
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(5, 16), new THREE.MeshBasicMaterial({ color: P2.lavaDeep }));
      mouth.rotation.x = -Math.PI / 2;
      T.put(cone, mouth, 0, 33.6, 0);
      place(group, cone, cx, h(cx, cz), cz, 0, colliders, 16);
      for (let i = 0; i < 5; i++) {
        const s = spot(cx, cz, i, 521, 30, R.r * 0.45);
        place(group, T2.lavaPool(7 + rnd(i, 522) * 8), s.x, h(s.x, s.z) - 0.5, s.z, 0);
      }
    }
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 511, 20, R.r * 0.5);
      spawns.push({ x: s.x, z: s.z });
    }
    if (R.entry) place(group, T.signPost('LOST ISLAND', 14), R.entry.x, Math.max(h(R.entry.x, R.entry.z), waterY + 0.5), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, fire, water: makeWater(group, cx, cz, R.r * 1.15, waterY, 0x2f86a8) };
  }

  // ================================================================= 용암 지대
  function buildLava(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const pools = [];

    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 601, 30, R.r * 0.85);
      const pool = T2.lavaPool(10 + rnd(i, 602) * 14);
      place(group, pool, s.x, h(s.x, s.z) - 0.6, s.z, rnd(i, 603) * 6);
      pools.push(pool);
      spawns.push({ x: s.x + 20, z: s.z + 12 });
    }
    for (let i = 0; i < 24; i++) {
      const s = spot(cx, cz, i, 611, 25, R.r * 0.9);
      place(group, T.rock(1.0 + rnd(i, 612) * 1.5, P2.obsidian), s.x, h(s.x, s.z), s.z, rnd(i, 613) * 6, colliders, 2.4);
    }
    for (let i = 0; i < 14; i++) {
      const s = spot(cx, cz, i, 621, 40, R.r * 0.9);
      place(group, T.deadTree(0.9 + rnd(i, 622) * 0.6, i + 60), s.x, h(s.x, s.z), s.z, rnd(i, 623) * 6, colliders, 1.6);
    }
    // 분화구 언덕 하나
    const cone = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const ring = T.mesh(L.cyl(20 - i * 2.2, 22 - i * 2.2, 4, 12), i % 2 ? P2.obsidian : 0x3a2b28, 'matte');
      T.put(cone, ring, 0, 2 + i * 4, 0);
    }
    const crater = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({ color: P2.lavaDeep }));
    crater.rotation.x = -Math.PI / 2;
    T.put(cone, crater, 0, 33.4, 0);
    place(group, cone, cx, h(cx, cz), cz, 0, colliders, 18);
    if (R.entry) place(group, T2.hazardSign('LAVA FIELD', C.black), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, pools };
  }

  // ================================================================= 피라미드
  function buildPyramid(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    // 계단 피라미드 — 층마다 링 하나를 InstancedMesh 로
    const levels = 18, step = 4, blockH = 3.2;
    const blocks = [];
    for (let lv = 0; lv < levels; lv++) {
      const half = (levels - lv) * step;
      const n = Math.max(1, Math.round((half * 2) / step));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const edge = (i === 0 || j === 0 || i === n - 1 || j === n - 1);
          if (!edge && lv < levels - 1) continue;      // 겉면만
          blocks.push({
            x: -half + step / 2 + i * step,
            y: blockH / 2 + lv * blockH,
            z: -half + step / 2 + j * step,
            tone: (i + j + lv) % 3,
          });
        }
      }
    }
    const inst = new THREE.InstancedMesh(L.terrainBrickGeometry(step, blockH, step),
      L.terrainBrickMaterial(), blocks.length);
    inst.frustumCulled = false;
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const tones = [0xe4cd9e, 0xd9c08a, 0xc9ad78];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      pv.set(b.x, b.y, b.z);
      m.compose(pv, q, sv);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHex(tones[b.tone]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    place(group, inst, cx, baseY, cz, 0, colliders, levels * step * 0.55);

    // 입구 — 검은 통로와 횃불
    const doorway = T.mesh(L.box(10, 12, 6), 0x1a1512, 'matte');
    place(group, doorway, cx, baseY + 6, cz + levels * step + 1, 0);
    for (const sx of [-1, 1]) {
      place(group, T.lantern(0xffb03a), cx + sx * 9, baseY, cz + levels * step + 4, 0, colliders, 0.6);
      const ob = new THREE.Group();
      const shaft = T.mesh(L.box(3.4, 18, 3.4), P2.sandBrick, 'matte');
      T.put(ob, shaft, 0, 9, 0);
      const cap = T.mesh(new THREE.ConeGeometry(2.4, 3.6, 4), C.gold, 'metal');
      T.put(ob, cap, 0, 19.8, 0);
      place(group, ob, cx + sx * 26, baseY, cz + levels * step + 16, 0, colliders, 2.4);
    }
    // 파수꾼 석상
    for (const sx of [-1, 1]) {
      place(group, T2.statue(P2.sandBrick), cx + sx * 16, baseY, cz + levels * step + 12, sx > 0 ? -0.3 : 0.3, colliders, 2.6);
    }
    spawns.push({ x: cx, z: cz + levels * step + 20, boss: true });
    for (let i = 0; i < 12; i++) {
      const s = spot(cx, cz, i, 701, levels * step + 20, R.r * 0.9);
      place(group, T2.cactus(0.8 + rnd(i, 702) * 0.6), s.x, h(s.x, s.z), s.z, rnd(i, 703) * 6, colliders, 1.4);
      spawns.push({ x: s.x, z: s.z });
    }
    if (R.entry) place(group, T.signPost('PYRAMID', 13), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns };
  }

  // ================================================================= 광산
  function buildMine(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const o = ctx.opt || {};
    const cx = R.cx, cz = R.cz;
    const floorY = (o.depth === undefined ? -18 : o.depth);
    const ore = o.ore === undefined ? 0xdcbe61 : o.ore;

    // 입구 권양탑
    const mouthZ = cz + R.r * 0.55;
    place(group, T2.mineHead(P2.rust), cx, h(cx, mouthZ), mouthZ, 0, colliders, 6);
    place(group, T.signPost(o.oreName || 'MINE', 15), cx + 16, h(cx + 16, mouthZ + 12), mouthZ + 12, Math.PI, colliders, 1);

    // 갱도 — 천장을 덮어 진짜 굴을 만든다
    const segs = 16, segLen = 9, halfW = 12;
    const ceilY = floorY + 16;
    for (let i = 0; i < segs; i++) {
      const z = mouthZ - 16 - i * segLen;
      const wob = Math.sin(i * 0.5) * 6;
      const slab = T.mesh(L.box(halfW * 2 + 10, 3, segLen + 0.4), P.caveStone || 0x3a3d40, 'matte');
      T.put(group, slab, cx + wob, ceilY, z);
      for (const sx of [-1, 1]) {
        const wall = T.mesh(L.box(4.5, 19, segLen + 0.4), sx > 0 ? 0x3a3d40 : 0x4a4c48, 'matte');
        T.put(group, wall, cx + wob + sx * (halfW + 2), ceilY - 8.5, z);
      }
      if (i % 3 === 1) T.put(group, T.mineSupport(19, 12), cx + wob, floorY, z);
      if (i % 2 === 0) {
        place(group, T2.oreRock(0.8 + rnd(i, 801) * 0.5, ore), cx + wob + (rnd(i, 802) - 0.5) * 16, floorY, z + 3, 0, colliders, 2);
      }
      if (o.crystals && i % 3 === 0) {
        T.put(group, T.crystal(1.0 + rnd(i, 803) * 0.8, ore), cx + wob + (rnd(i, 804) - 0.5) * 18, floorY, z);
      }
      if (o.drips) {
        T.put(group, T.dripstone(3 + (i % 4) * 1.4, false, 0x4a4c48), cx + wob + (rnd(i, 805) - 0.5) * 16, ceilY - 3.2, z);
        T.put(group, T.dripstone(2.6 + (i % 3), true, 0x3a3d40), cx + wob + (rnd(i, 806) - 0.5) * 18, floorY + 1.3, z + 4);
      }
      if (i % 4 === 2) T.put(group, T.lantern(0xffb03a), cx + wob + (i % 8 ? 9 : -9), floorY, z);
      spawns.push({ x: cx + wob, z });
    }
    place(group, T.mineRail(segs * segLen), cx, floorY, mouthZ - 16 - (segs * segLen) / 2, 0);
    place(group, T.mineCart(), cx + 3, floorY, mouthZ - 40, 0.1, colliders, 2.4);

    // 막장 — 광석이 잔뜩 박힌 방
    const endZ = mouthZ - 16 - segs * segLen - 18;
    const hall = new THREE.Group();
    const hallR = 26;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const wall = T.mesh(L.box(11, 22, 11), i % 2 ? 0x3a3d40 : 0x4a4c48, 'matte');
      T.put(hall, wall, Math.cos(a) * hallR, 11, Math.sin(a) * hallR, 0, a, 0);
      colliders.push({ x: cx + Math.cos(a) * hallR, z: endZ + Math.sin(a) * hallR, hx: 5.5, hz: 5.5 });
    }
    const dome = T.mesh(new THREE.ConeGeometry(hallR + 5, 16, 12), 0x3a3d40, 'matte');
    T.put(hall, dome, 0, 26, 0);
    for (let i = 0; i < 10; i++) {
      const a = rnd(i, 811) * Math.PI * 2, r = 6 + rnd(i, 812) * 16;
      T.put(hall, T2.oreRock(1.1 + rnd(i, 813) * 0.8, ore), Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    if (o.crystals) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        T.put(hall, T.crystal(1.6, ore), Math.cos(a) * 14, 0, Math.sin(a) * 14);
      }
    }
    hall.position.set(cx, floorY, endZ);
    group.add(hall);
    spawns.push({ x: cx, z: endZ, boss: true });

    // 바깥 광석 바위 · 상자
    for (let i = 0; i < 16; i++) {
      const s = spot(cx, cz, i, 821, 40, R.r * 0.9);
      place(group, T2.oreRock(0.9 + rnd(i, 822) * 0.9, ore), s.x, h(s.x, s.z), s.z, rnd(i, 823) * 6, colliders, 2);
      spawns.push({ x: s.x, z: s.z });
    }
    for (let i = 0; i < 8; i++) {
      const s = spot(cx, cz, i, 831, 20, 60);
      place(group, i % 2 ? T.crate(1) : T.barrel(1), s.x, h(s.x, s.z), s.z, rnd(i, 832) * 3, colliders, 1.2);
    }
    return { colliders, spawns, tunnel: { x: cx, z0: endZ - 30, z1: mouthZ, halfW: halfW + 6, floorY, ceilY } };
  }

  // ================================================================= 시설 · 구역
  /**
   * 시설 실내 — 진짜로 걸어 들어갈 수 있는 건물.
   * 벽은 문 자리를 비운 채 세우고, 벽마다 충돌 상자를 따로 넣는다.
   * (건물 하나를 통짜 충돌 상자로 막으면 안으로 들어갈 수가 없다)
   *
   *        뒷방(중앙 제어실 · 보스)
   *   실험실 | 복도 | 격리실
   *   제어실 | 복도 | 창고
   *            현관
   */
  function facilityInterior(group, colliders, spawns, screens, o, cx, cz, baseY) {
    const accent = o.accent === undefined ? 0x0055bf : o.accent;
    const wallColor = o.burnt ? 0x4a3a34 : (o.theme === 'toxic' ? 0x8f9a86 : P2.concrete);
    const W = 70, D = 54, H = 15, TH = 2;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
    const lights = [];

    /** z 방향으로 뻗는 벽 (gapW > 0 이면 그 자리에 문을 낸다) */
    function wallAlongZ(x, za, zb, gapC, gapW, color) {
      const parts = [];
      if (gapW > 0) {
        if (gapC - gapW / 2 > za) parts.push([za, gapC - gapW / 2]);
        if (gapC + gapW / 2 < zb) parts.push([gapC + gapW / 2, zb]);
      } else parts.push([za, zb]);
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i][0], b = parts[i][1];
        if (b - a < 0.5) continue;
        const m = T.mesh(L.box(TH, H, b - a), color || wallColor, 'matte');
        T.put(group, m, x, baseY + H / 2, (a + b) / 2);
        colliders.push({ x, z: (a + b) / 2, hx: TH / 2 + 0.4, hz: (b - a) / 2 });
      }
      if (gapW > 0) {
        const lintel = T.mesh(L.box(TH + 0.4, 3, gapW), P2.concreteDark, 'matte');
        T.put(group, lintel, x, baseY + H - 1.5, gapC);
      }
    }

    /** x 방향으로 뻗는 벽 */
    function wallAlongX(z, xa, xb, gapC, gapW, color) {
      const parts = [];
      if (gapW > 0) {
        if (gapC - gapW / 2 > xa) parts.push([xa, gapC - gapW / 2]);
        if (gapC + gapW / 2 < xb) parts.push([gapC + gapW / 2, xb]);
      } else parts.push([xa, xb]);
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i][0], b = parts[i][1];
        if (b - a < 0.5) continue;
        const m = T.mesh(L.box(b - a, H, TH), color || wallColor, 'matte');
        T.put(group, m, (a + b) / 2, baseY + H / 2, z);
        colliders.push({ x: (a + b) / 2, z, hx: (b - a) / 2, hz: TH / 2 + 0.4 });
      }
      if (gapW > 0) {
        const lintel = T.mesh(L.box(gapW, 3, TH + 0.4), P2.concreteDark, 'matte');
        T.put(group, lintel, gapC, baseY + H - 1.5, z);
      }
    }

    /**
     * 천장 등 — 발광 판 + (lamp 가 참이면) 실제 광원 하나.
     * 실제 광원은 방마다 하나면 충분하다(지역이 꺼지면 같이 꺼진다).
     */
    function ceilLight(x, z, lamp) {
      const panel = new THREE.Mesh(L.box(5, 0.4, 2.4), new THREE.MeshBasicMaterial({
        color: o.burnt ? 0x6a5a4a : 0xfff3c4,
      }));
      T.put(group, panel, x, baseY + H - 1.2, z);
      const box = T.mesh(L.box(5.6, 0.6, 3), P2.concreteDark, 'matte', { shadow: false });
      T.put(group, box, x, baseY + H - 0.7, z);
      lights.push(panel);
      if (lamp && !o.burnt) {
        const light = new THREE.PointLight(0xffe9c0, 1.5, 60, 1.4);
        light.position.set(x, baseY + H - 2, z);
        group.add(light);
      }
    }

    // 바닥 · 천장
    const floor = T.mesh(L.box(W, 1.2, D), P2.concreteDark, 'matte');
    T.put(group, floor, cx, baseY - 0.6, cz);
    const ceil = T.mesh(L.box(W + 2, 1.6, D + 2), P2.concrete, 'matte');
    T.put(group, ceil, cx, baseY + H + 0.8, cz);

    // 바깥 벽 (정면에 현관문 구멍)
    wallAlongX(z1, x0, x1, cx, 9);
    wallAlongX(z0, x0, x1, 0, 0);
    wallAlongZ(x0, z0, z1, 0, 0);
    wallAlongZ(x1, z0, z1, 0, 0);

    // 복도 벽 — 방으로 들어가는 문 넷
    const CH = 7;                       // 복도 반폭
    const backZ = z0 + 18;              // 뒷방 경계
    wallAlongZ(cx - CH, backZ, z1 - TH, cz + 12, 8);
    wallAlongZ(cx - CH, backZ, z1 - TH, cz - 10, 8);
    wallAlongZ(cx + CH, backZ, z1 - TH, cz + 12, 8);
    wallAlongZ(cx + CH, backZ, z1 - TH, cz - 10, 8);
    // 좌우 방을 앞뒤로 나누는 벽
    wallAlongX(cz + 2, x0, cx - CH, cx - 20, 7);
    wallAlongX(cz + 2, cx + CH, x1, cx + 20, 7);
    // 뒷방으로 들어가는 큰 문
    wallAlongX(backZ, x0, x1, cx, 12);

    // 현관 방폭문 틀 + 시설 코드
    T.put(group, T2.blastDoor(9, 12, accent), cx, baseY + 6, z1 + 0.4);
    const plate = L.signPanel(o.code || 'FACILITY', 14, 3, '#17222b',
      '#' + ('000000' + accent.toString(16)).slice(-6));
    T.put(group, plate, cx, baseY + 13.4, z1 + 1.3);

    // 천장 등
    for (let i = 0; i < 5; i++) ceilLight(cx, z1 - 6 - i * 9, i === 2);
    ceilLight(cx - 22, cz + 12, true); ceilLight(cx - 22, cz - 12, true);
    ceilLight(cx + 22, cz + 12, true); ceilLight(cx + 22, cz - 12, true);
    ceilLight(cx - 14, backZ - 8, true); ceilLight(cx + 14, backZ - 8, false);

    // ---- 왼앞: 제어실
    const con1 = T2.console(P2.screen);
    T.put(group, con1, cx - 22, baseY, cz + 20);
    screens.push(con1);
    const con2 = T2.console(accent);
    T.put(group, con2, cx - 30, baseY, cz + 12, 0, Math.PI / 2, 0);
    screens.push(con2);
    T.put(group, T2.mapScreen(14, 8, accent), cx - 22, baseY + 8, cz + 24.4);
    T.put(group, T2.locker(0x3f5f7a), cx - 32, baseY, cz + 22);
    T.put(group, T2.locker(0x3f5f7a), cx - 32, baseY, cz + 18);
    spawns.push({ x: cx - 22, z: cz + 16 });

    // ---- 왼뒤: 실험실 (탱크 · 배관 · 표본 캡슐)
    T.put(group, T2.tank(0.7, o.theme === 'toxic' ? 0x9ab08a : P2.steel), cx - 28, baseY, cz - 8);
    T.put(group, T2.tank(0.7, P2.steel), cx - 28, baseY, cz - 18);
    T.put(group, T2.pipe(16, 0.9, P2.steel), cx - 18, baseY + 9, cz - 13, 0, Math.PI / 2, 0);
    for (let i = 0; i < 3; i++) {
      const pod = new THREE.Mesh(L.cyl(2, 2, 8, 12), new THREE.MeshPhongMaterial({
        color: o.theme === 'zombie' ? 0x7fbf3f : P2.screen, transparent: true, opacity: 0.45,
        specular: 0xffffff, shininess: 140,
      }));
      T.put(group, pod, cx - 12, baseY + 4.6, cz - 6 - i * 7);
      const cap = T.mesh(L.cyl(2.3, 2.3, 1, 12), P2.steel, 'metal');
      T.put(group, cap, cx - 12, baseY + 9.1, cz - 6 - i * 7);
      const podBase = T.mesh(L.cyl(2.3, 2.3, 1.2, 12), P2.concreteDark, 'matte');
      T.put(group, podBase, cx - 12, baseY + 0.6, cz - 6 - i * 7);
    }
    spawns.push({ x: cx - 24, z: cz - 12 });

    // ---- 오른앞: 창고
    for (let i = 0; i < 8; i++) {
      const bx = cx + 14 + (i % 4) * 5, bz = cz + 8 + Math.floor(i / 4) * 6;
      T.put(group, i % 3 === 0 ? T.barrel(1, o.theme === 'toxic' ? 0x4b9f4a : undefined) : T.crate(1),
        bx, baseY, bz);
      if (i % 4 === 1) T.put(group, T.crate(0.9), bx, baseY + 2.4, bz);
    }
    for (let i = 0; i < 2; i++) {
      const shelf = T.mesh(L.box(14, 0.5, 3), P2.steel, 'metal');
      T.put(group, shelf, cx + 24, baseY + 3 + i * 4, cz + 20);
    }
    for (const sx of [-1, 1]) {
      const leg = T.mesh(L.box(0.5, 8, 3), P2.steel, 'metal');
      T.put(group, leg, cx + 24 + sx * 6.8, baseY + 4, cz + 20);
    }
    spawns.push({ x: cx + 20, z: cz + 14 });

    // ---- 오른뒤: 격리실 (유리벽 안의 표본)
    const glass = new THREE.Mesh(L.box(24, 11, 0.5), new THREE.MeshPhongMaterial({
      color: P2.glassBlue, transparent: true, opacity: 0.32, specular: 0xffffff, shininess: 160,
    }));
    T.put(group, glass, cx + 21, baseY + 5.5, cz - 4);
    for (let i = 0; i < 2; i++) {
      const frame = T.mesh(L.box(0.6, 11, 0.8), P2.steel, 'metal');
      T.put(group, frame, cx + 9 + i * 24, baseY + 5.5, cz - 4);
    }
    T.put(group, T2.hazardSign('DO NOT ENTER', C.black), cx + 21, baseY, cz - 1);
    const specimen = new THREE.Mesh(L.cyl(3, 3, 11, 14), new THREE.MeshPhongMaterial({
      color: o.theme === 'fire' ? 0xff7a18 : 0x7fbf3f, transparent: true, opacity: 0.4,
      specular: 0xffffff, shininess: 140,
    }));
    T.put(group, specimen, cx + 21, baseY + 6, cz - 14);
    const specBase = T.mesh(L.cyl(3.4, 3.4, 1.2, 14), P2.concreteDark, 'matte');
    T.put(group, specBase, cx + 21, baseY + 0.6, cz - 14);
    spawns.push({ x: cx + 20, z: cz - 12 });

    // ---- 뒷방: 중앙 제어실 겸 보스 자리
    const dais = T.mesh(L.box(26, 1.6, 12), P2.concrete, 'matte');
    T.put(group, dais, cx, baseY + 0.8, backZ - 9);
    T.put(group, T2.mapScreen(26, 12, accent), cx, baseY + 9, z0 + 2.2);
    for (let i = 0; i < 3; i++) {
      const con = T2.console(i === 1 ? P2.screen : accent);
      T.put(group, con, cx - 12 + i * 12, baseY + 1.6, backZ - 12);
      screens.push(con);
    }
    for (const sx of [-1, 1]) T.put(group, T2.locker(0x3f5f7a), cx + sx * 30, baseY, backZ - 6);
    spawns.push({ x: cx, z: backZ - 8, boss: true });

    return {
      indoor: { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, y0: baseY - 2, y1: baseY + H + 3 },
      lights,
    };
  }

  function buildFacility(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const o = ctx.opt || {};
    const cx = R.cx, cz = R.cz;
    const accent = o.accent === undefined ? 0x0055bf : o.accent;
    const wallColor = o.burnt ? 0x4a3a34 : (o.theme === 'toxic' ? 0x8f9a86 : P2.concrete);
    const baseY = h(cx, cz);
    const screens = [];

    // ---- 본관 실내 (걸어 들어갈 수 있다)
    const inside = facilityInterior(group, colliders, spawns, screens, o, cx, cz, baseY);
    const W = 70, D = 54, H = 15;

    // ---- 바깥 꾸미기: 창문 띠 · 지붕 간판 · 현관 계단과 차양
    for (let i = 0; i < 4; i++) {
      const win = T.mesh(L.box(6, 3, 0.5), P2.glassBlue, 'glass');
      T.put(group, win, cx - 26 + i * 17.5, baseY + 11, cz + D / 2 + 1.1);
    }
    const sign = L.signPanel(o.code || 'FACILITY', 30, 5.5,
      '#' + ('000000' + accent.toString(16)).slice(-6), '#f4f4f2');
    T.put(group, sign, cx, baseY + H + 4, cz + D / 2 + 0.9);
    const signBack = T.mesh(L.box(31, 6.5, 0.8), P2.concreteDark, 'matte');
    T.put(group, signBack, cx, baseY + H + 4, cz + D / 2 + 0.4);
    for (let i = 0; i < 3; i++) {
      const step = T.mesh(L.box(16 - i * 2, 0.7, 2.2), P2.concrete, 'matte');
      T.put(group, step, cx, baseY - 0.3 - i * 0.7, cz + D / 2 + 3 + i * 2.2);
    }
    const canopy = T.mesh(L.box(20, 1, 8), P2.concreteDark, 'matte');
    T.put(group, canopy, cx, baseY + 13.5, cz + D / 2 + 5);
    for (const sx of [-1, 1]) {
      const post = T.mesh(L.box(1.2, 13, 1.2), P2.steel, 'metal');
      T.put(group, post, cx + sx * 8.5, baseY + 6.5, cz + D / 2 + 8.4);
      colliders.push({ x: cx + sx * 8.5, z: cz + D / 2 + 8.4, hx: 1, hz: 1 });
    }
    if (o.broken) {
      const hole = T.mesh(L.box(12, 2, 10), 0x14181c, 'matte');
      T.put(group, hole, cx + 18, baseY + H + 1, cz - 8);
      for (let i = 0; i < 6; i++) {
        T.put(group, T.rock(0.7 + rnd(i, 951) * 0.6, P2.concrete),
          cx + 12 + rnd(i, 952) * 14, baseY, cz - 4 - rnd(i, 953) * 14);
      }
    }
    void W;
    void wallColor;

    // ---- 울타리 + 경고판 + 탐조등
    const fenceR = R.r * 0.55;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.4) continue;             // 정문은 비운다
      const x = cx + Math.cos(a) * fenceR, z = cz + Math.sin(a) * fenceR;
      place(group, T2.chainFence(fenceR * 0.46, 9, o.burnt ? 0x5a4a44 : P2.steel),
        x, h(x, z), z, a + Math.PI / 2, colliders, fenceR * 0.23, 1);
      if (i % 4 === 0) {
        place(group, T2.hazardSign((o.code || 'DANGER'), C.black), x + 4, h(x + 4, z), z, a + Math.PI / 2, colliders, 1);
      }
      if (i % 5 === 2) {
        place(group, T2.searchlight(o.theme === 'toxic' ? 0xa5ca18 : 0xfff3c4), x, h(x, z), z, a, colliders, 1);
      }
    }

    // ---- 탱크·배관 (있으면)
    if (o.tanks) {
      for (let i = 0; i < 4; i++) {
        const x = cx + 34 + (i % 2) * 16, z = cz + 12 + Math.floor(i / 2) * 16;
        place(group, T2.tank(1 + (i % 2) * 0.3, o.theme === 'toxic' ? 0x9ab08a : P2.steel),
          x, h(x, z), z, 0, colliders, 5);
      }
      for (let i = 0; i < 3; i++) {
        const x = cx + 26, z = cz + 10 + i * 16;
        place(group, T2.pipe(28, 1.1, P2.steel), x, h(x, z) + 3, z, Math.PI / 2, colliders, 1.2, 14);
      }
      for (let i = 0; i < 10; i++) {
        const s = spot(cx, cz, i, 901, 30, R.r * 0.6);
        place(group, T2.radBarrel(), s.x, h(s.x, s.z), s.z, 0, colliders, 1.1);
      }
    }
    // ---- 안테나 (있으면)
    if (o.antenna) {
      const ax = cx - 26, az = cz + 24;
      const tower = new THREE.Group();
      for (const [tx, tz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        const leg = T.mesh(L.box(0.7, 30, 0.7), P2.steel, 'metal');
        T.put(tower, leg, tx, 15, tz);
      }
      for (let i = 1; i <= 5; i++) {
        const rung = T.mesh(L.box(4.6, 0.4, 4.6), P2.steel, 'metal');
        T.put(tower, rung, 0, i * 5.5, 0);
      }
      const dish = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
        new THREE.MeshPhongMaterial({ color: 0xb8b8b8, specular: 0xffffff, shininess: 150, side: THREE.DoubleSide }));
      dish.rotation.set(-0.7, 0, 0.2);
      T.put(tower, dish, 0, 33, 0);
      place(group, tower, ax, h(ax, az), az, 0, colliders, 4);
    }
    // ---- 잔해·상자
    for (let i = 0; i < 12; i++) {
      const s = spot(cx, cz, i, 911, 26, R.r * 0.7);
      place(group, i % 3 === 0 ? T2.locker(0x3f5f7a) : (i % 3 === 1 ? T.crate(1.1) : T.barrel(1.1, o.burnt ? 0x3a2b28 : undefined)),
        s.x, h(s.x, s.z), s.z, rnd(i, 912) * 3, colliders, 1.4);
      spawns.push({ x: s.x, z: s.z });
    }
    if (o.fenced) {
      for (let i = 0; i < 6; i++) {
        const x = cx - 20 + i * 8, z = cz + R.r * 0.3;
        place(group, T2.chainFence(8, 11, 0xc9a03a), x, h(x, z), z, 0, colliders, 4, 1);
      }
    }
    if (R.entry) place(group, T2.hazardSign(o.code || 'RESTRICTED', C.black), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, screens, indoor: inside.indoor };
  }

  // ================================================================= 하수도
  function buildSewer(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const floorY = h(cx, cz);

    // 콘크리트 수로 + 덮인 터널
    const segs = 20, segLen = 10, halfW = 11;
    const startZ = cz + R.r * 0.5;
    for (let i = 0; i < segs; i++) {
      const z = startZ - i * segLen;
      const wob = Math.sin(i * 0.42) * 7;
      const floor = T.mesh(L.box(halfW * 2, 1.2, segLen), P2.concreteDark, 'matte');
      T.put(group, floor, cx + wob, floorY - 0.6, z);
      for (const sx of [-1, 1]) {
        const wall = T2.concreteWall(segLen, 14, 2.5, P2.concrete);
        wall.rotation.y = Math.PI / 2;
        T.put(group, wall, cx + wob + sx * halfW, floorY + 7, z);
      }
      const ceil = T.mesh(L.box(halfW * 2 + 5, 2, segLen), P2.concreteDark, 'matte');
      T.put(group, ceil, cx + wob, floorY + 14.5, z);
      if (i % 4 === 1) {
        T.put(group, T2.pipe(10, 1.4, P2.rust), cx + wob - halfW + 2, floorY + 9, z, 0, Math.PI / 2, 0);
      }
      if (i % 5 === 2) T.put(group, T.lantern(0x9bd44b), cx + wob + 7, floorY, z);
      spawns.push({ x: cx + wob, z });
    }
    // 물길
    const water = new THREE.Mesh(new THREE.PlaneGeometry(10, segs * segLen), new THREE.MeshPhongMaterial({
      color: 0x3f5f4a, emissive: 0x16301f, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, floorY + 0.4, startZ - (segs * segLen) / 2);
    group.add(water);
    // 지상 입구
    place(group, T2.concreteWall(20, 10, 3, P2.concrete), cx, h(cx, startZ + 8) + 5, startZ + 8, 0, colliders, 10, 2);
    place(group, T2.blastDoor(8, 9, 0x4b9f4a), cx, h(cx, startZ + 6) + 4.5, startZ + 6, 0);
    place(group, T2.hazardSign('SEWER', C.black), cx + 14, h(cx + 14, startZ + 10), startZ + 10, Math.PI, colliders, 1);
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 1001, 40, R.r * 0.8);
      place(group, i % 2 ? T2.radBarrel() : T.crate(1), s.x, h(s.x, s.z), s.z, rnd(i, 1002) * 3, colliders, 1.2);
    }
    return { colliders, spawns, tunnel: { x: cx, z0: startZ - segs * segLen, z1: startZ, halfW: halfW + 6, floorY, ceilY: floorY + 15 } };
  }

  // ================================================================= 폐공연장
  function buildArena(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    // 계단식 관중석 — 링 하나를 InstancedMesh 로
    const tiers = 9, seatStep = 5;
    const seats = [];
    for (let t = 0; t < tiers; t++) {
      const r = 34 + t * seatStep;
      const n = Math.round((2 * Math.PI * r) / 5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (a > 2.4 && a < 3.9) continue;                 // 무대 쪽은 비운다
        seats.push({ x: Math.cos(a) * r, y: 1.5 + t * 2.4, z: Math.sin(a) * r, a, tone: (i + t) % 3 });
      }
    }
    const inst = new THREE.InstancedMesh(L.box(4.4, 2.4, 4.4), L.mat(0xffffff), seats.length);
    inst.frustumCulled = false;
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const tones = [0xc91a09, 0x0055bf, 0x6c6e68];
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      e.set(0, s.a, 0);
      q.setFromEuler(e);
      pv.set(s.x, s.y, s.z);
      m.compose(pv, q, sv);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.setHex(tones[s.tone]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    place(group, inst, cx, baseY, cz, 0, colliders, 0);

    // 무대 + 부러진 조명탑 + 현수막
    const stage = L.plate(P.plank, 10, 7, { height: 2.4 });
    stage.scale.set(3, 1, 3);
    place(group, stage, cx, baseY + 1.2, cz - 34, 0, colliders, 15, 11);
    const back = T2.concreteWall(34, 20, 2.5, P2.concreteDark);
    place(group, back, cx, baseY + 10, cz - 46, 0, colliders, 17, 2);
    for (const sx of [-1, 1]) {
      const rig = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const leg = T.mesh(L.box(0.8, 22, 0.8), P2.steel, 'metal');
        T.put(rig, leg, (i % 2 ? 1.6 : -1.6), 11, (i < 2 ? 1.6 : -1.6));
      }
      const bar = T.mesh(L.box(0.9, 0.9, 16), P2.steel, 'metal');
      T.put(rig, bar, 0, 21, -6);
      for (let i = 0; i < 3; i++) {
        const lamp = T.mesh(L.box(2, 2.2, 2), C.black, 'matte');
        T.put(rig, lamp, 0, 19.6, -2 - i * 4.5);
        const glow = new THREE.Mesh(L.box(1.6, 0.4, 1.6), new THREE.MeshBasicMaterial({
          color: i === 1 ? 0x333333 : 0xfff3c4,
        }));
        T.put(rig, glow, 0, 18.4, -2 - i * 4.5);
      }
      rig.rotation.z = sx * 0.06;
      place(group, rig, cx + sx * 22, baseY, cz - 40, 0, colliders, 3);
    }
    for (let i = 0; i < 4; i++) {
      const banner = T.mesh(L.box(0.3, 14, 6), i % 2 ? C.red : C.purple, 'matte');
      place(group, banner, cx - 18 + i * 12, baseY + 12, cz - 44.5, 0);
    }
    // 흩어진 의자와 상자
    for (let i = 0; i < 14; i++) {
      const s = spot(cx, cz, i, 1101, 12, 30);
      place(group, T.crate(0.8), s.x, h(s.x, s.z), s.z, rnd(i, 1102) * 3, colliders, 1);
      spawns.push({ x: s.x, z: s.z });
    }
    spawns.push({ x: cx, z: cz - 30, boss: true });
    if (R.entry) place(group, T.signPost('CLOSED ARENA', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns };
  }

  // ================================================================= 유령 미술관
  function buildMuseum(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);
    const W = 52, D = 34, H = 16;

    const hall = new THREE.Group();
    // 바닥 · 벽 · 지붕 (정면은 기둥만 세워 안이 보이게)
    const floor = T.mesh(L.box(W, 1.2, D), 0xdcd8c8, 'matte');
    T.put(hall, floor, 0, 0.6, 0);
    for (let side = 1; side < 4; side++) {
      const along = side % 2 === 0 ? W : D;
      const wall = T2.concreteWall(along, H, 2, 0xdcd8c8);
      const ang = side * Math.PI / 2;
      wall.position.set(Math.sin(ang) * (side % 2 === 0 ? D / 2 : W / 2), H / 2,
        Math.cos(ang) * (side % 2 === 0 ? D / 2 : W / 2));
      wall.rotation.y = ang;
      hall.add(wall);
    }
    for (let i = 0; i < 6; i++) {
      const col2 = T.mesh(L.cyl(1.8, 2.0, H, 12), 0xf0ece0, 'matte');
      T.put(hall, col2, -W / 2 + 4 + i * ((W - 8) / 5), H / 2, D / 2 - 1);
    }
    const roof = T.mesh(L.box(W + 4, 2, D + 4), 0xc9c4b4, 'matte');
    T.put(hall, roof, 0, H + 1, 0);
    const ped = T.mesh(new THREE.ConeGeometry(W * 0.36, 8, 4), 0xc9c4b4, 'matte');
    T.put(hall, ped, 0, H + 6, 0, 0, Math.PI / 4, 0);
    // 그림 · 조각상 · 통제선
    for (let i = 0; i < 6; i++) {
      const p = T2.painting(7, 5, i * 47);
      T.put(hall, p, -W / 2 + 8 + i * 8, 8, -D / 2 + 1.4);
    }
    for (let i = 0; i < 4; i++) {
      T.put(hall, T2.statue(0xdcd8c8), -14 + i * 9, 1.2, 4);
      T.put(hall, T2.ropeStand(), -14 + i * 9, 1.2, 8);
    }
    place(group, hall, cx, baseY, cz, 0, colliders, W / 2 + 1, D / 2 + 1);

    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 1201, 40, R.r * 0.8);
      place(group, T.deadTree(1.0 + rnd(i, 1202) * 0.5, i + 90), s.x, h(s.x, s.z), s.z, rnd(i, 1203) * 6, colliders, 1.6);
      spawns.push({ x: s.x, z: s.z });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = cx + Math.cos(a) * 44, z = cz + Math.sin(a) * 44;
      place(group, T.lantern(0x9fe8ff), x, h(x, z), z, 0, colliders, 0.6);
    }
    spawns.push({ x: cx, z: cz + D / 2 + 14, boss: true });
    if (R.entry) place(group, T.signPost('GHOST MUSEUM', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns };
  }

  // ================================================================= 귀신의 집
  function buildHaunted(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;

    // 큰 저택 — 3층 판잣집을 크게
    const manor = new THREE.Group();
    const W = 30, D = 24, fh = 6;
    for (let f = 0; f < 3; f++) {
      const y = 1.2 + f * fh + fh / 2;
      for (let side = 0; side < 4; side++) {
        const along = side % 2 === 0 ? W : D;
        const wall = T.plankWall(along, fh, 1.0, f === 2 ? P.darkWood : P.rottenWood, true);
        const ang = side * Math.PI / 2;
        wall.position.set(Math.sin(ang) * (side % 2 === 0 ? D / 2 : W / 2), y,
          Math.cos(ang) * (side % 2 === 0 ? D / 2 : W / 2));
        wall.rotation.y = ang;
        manor.add(wall);
      }
      const deck = T.mesh(L.box(W - 1, 0.6, D - 1), P.darkWood, 'matte');
      T.put(manor, deck, 0, y - fh / 2, 0);
      for (const sx of [-1, 1]) {
        T.put(manor, T.boardedWindow(3.2, 3.2), sx * W * 0.28, y, D / 2 + 0.55);
      }
      // 한 층은 불이 켜져 있다
      if (f === 1) {
        const lit = new THREE.Mesh(L.box(3, 3, 0.2), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
        T.put(manor, lit, W / 2 + 0.6, y, -D * 0.2, 0, Math.PI / 2, 0);
      }
    }
    const base = T.mesh(L.box(W + 2, 1.4, D + 2), P.stone, 'matte');
    T.put(manor, base, 0, 0.7, 0);
    T.put(manor, T.brokenRoof(W + 3, D + 3, P.darkWood, true), 0, 1.2 + 3 * fh + 0.4, 0);
    T.put(manor, T.door(3.6, 6, P.darkWood, -0.14), 0, 4.4, D / 2 + 0.6);
    const chim = T.mesh(L.box(3, 9, 3), P.darkStone, 'matte');
    T.put(manor, chim, -W * 0.3, 1.2 + 3 * fh + 4, -D * 0.2, 0, 0, 0.1);
    place(group, manor, cx, h(cx, cz) - 0.4, cz, 0.3, colliders, W / 2 + 1, D / 2 + 1);

    // 삐뚤어진 울타리 · 죽은 나무 · 부서진 석상 · 등불
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.5) continue;
      const x = cx + Math.cos(a) * 64, z = cz + Math.sin(a) * 64;
      place(group, T.crookedFence(16, i % 2 ? 1 : -1), x, h(x, z), z, a + Math.PI / 2, colliders, 8, 1);
    }
    for (let i = 0; i < 18; i++) {
      const s = spot(cx, cz, i, 1301, 34, R.r * 0.85);
      place(group, T.deadTree(1.0 + rnd(i, 1302) * 0.8, i + 120), s.x, h(s.x, s.z), s.z, rnd(i, 1303) * 6, colliders, 1.6);
      spawns.push({ x: s.x, z: s.z });
    }
    for (let i = 0; i < 8; i++) {
      const s = spot(cx, cz, i, 1311, 30, 70);
      const broken = T2.statue(0x8f9296);
      broken.rotation.z = (rnd(i, 1312) - 0.5) * 0.5;
      place(group, broken, s.x, h(s.x, s.z), s.z, rnd(i, 1313) * 6, colliders, 2.4);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * 40, z = cz + Math.sin(a) * 40;
      place(group, T.lantern(0x9fe8ff), x, h(x, z), z, 0, colliders, 0.6);
    }
    spawns.push({ x: cx, z: cz - 30, boss: true });
    if (R.entry) place(group, T.signPost('HAUNTED HOUSE', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns };
  }

  // ================================================================= 전초기지 (야영지·농장·운석 구덩이)
  function buildOutpost(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const theme = (ctx.opt && ctx.opt.theme) || 'camp';
    const cx = R.cx, cz = R.cz;

    // 공통: 망루 + 텐트 + 모닥불 + 짐 + 울타리
    place(group, T.watchtower(), cx + 26, h(cx + 26, cz - 18), cz - 18, 0.4, colliders, 5);
    place(group, T.tent(C.red), cx - 8, h(cx - 8, cz + 10), cz + 10, 0.5, colliders, 4, 5);
    place(group, T.tent(C.blue), cx + 6, h(cx + 6, cz + 18), cz + 18, -0.6, colliders, 4, 5);
    const fire = T.campfire();
    place(group, fire, cx, h(cx, cz + 2), cz + 2, 0, colliders, 2.4);
    for (let i = 0; i < 8; i++) {
      const s = spot(cx, cz, i, 1401, 12, 40);
      place(group, i % 2 ? T.crate(1) : T.barrel(1), s.x, h(s.x, s.z), s.z, rnd(i, 1402) * 3, colliders, 1.2);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.5) continue;
      const x = cx + Math.cos(a) * 60, z = cz + Math.sin(a) * 60;
      place(group, T.crookedFence(16, i % 2 ? 1 : -1), x, h(x, z), z, a + Math.PI / 2, colliders, 8, 1);
    }

    if (theme === 'farm') {
      // 풍차 — 언덕 위 이정표
      const mill = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const ring = T.mesh(L.cyl(4.6 - i * 0.45, 5.2 - i * 0.45, 4.5, 10), i % 2 ? C.white : C.tan, 'matte');
        T.put(mill, ring, 0, 2.2 + i * 4.5, 0);
      }
      const cap = T.mesh(new THREE.ConeGeometry(5.4, 5, 10), C.red);
      T.put(mill, cap, 0, 31, 0);
      const blades = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const blade = T.mesh(L.box(2.6, 20, 0.5), i % 2 ? C.white : P.plank, 'matte');
        blade.rotation.z = i * Math.PI / 2;
        blade.position.set(Math.sin(i * Math.PI / 2) * 10, Math.cos(i * Math.PI / 2) * 10, 0);
        blades.add(blade);
      }
      blades.position.set(0, 27, 6.5);
      mill.add(blades);
      mill.userData.blades = blades;
      place(group, mill, cx - 30, h(cx - 30, cz - 24), cz - 24, 0, colliders, 6);
      for (let i = 0; i < 10; i++) {
        const s = spot(cx, cz, i, 1411, 30, R.r * 0.7);
        place(group, T.hayBale(), s.x, h(s.x, s.z), s.z, rnd(i, 1412) * 3, colliders, 2);
        spawns.push({ x: s.x, z: s.z });
      }
      place(group, T.scarecrow(), cx + 18, h(cx + 18, cz + 40), cz + 40, 0.3, colliders, 1);
      if (R.entry) place(group, T.signPost('WINDMILL HILL', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
      return { colliders, spawns, fire, mill };
    }

    if (theme === 'meteor') {
      // 구덩이 한가운데 박힌 커다란 운석
      const rock = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const chunk = T.mesh(L.box(9 - i, 7 - i * 0.8, 8 - i), i % 2 ? 0x3a3a42 : 0x4a4a52, 'matte');
        T.put(rock, chunk, (i % 3 - 1) * 2.5, 3 + i * 2.2, (i % 2) * 2 - 1, i * 0.3, i, 0.2);
      }
      for (let i = 0; i < 5; i++) {
        const glow = new THREE.Mesh(L.box(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0x63d7e6 }));
        T.put(rock, glow, Math.cos(i * 1.3) * 4, 4 + i * 2, Math.sin(i * 1.3) * 3);
      }
      place(group, rock, cx, h(cx, cz), cz, 0, colliders, 7);
      spawns.push({ x: cx + 16, z: cz + 10, boss: true });
      for (let i = 0; i < 16; i++) {
        const s = spot(cx, cz, i, 1421, 30, R.r * 0.85);
        place(group, T2.oreRock(1.0 + rnd(i, 1422) * 0.9, 0x63d7e6), s.x, h(s.x, s.z), s.z, rnd(i, 1423) * 6, colliders, 2);
        spawns.push({ x: s.x, z: s.z });
      }
      if (R.entry) place(group, T2.hazardSign('METEOR PIT', C.black), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
      return { colliders, spawns, fire };
    }

    for (let i = 0; i < 12; i++) {
      const s = spot(cx, cz, i, 1431, 30, R.r * 0.8);
      spawns.push({ x: s.x, z: s.z });
    }
    if (R.entry) place(group, T.signPost('OUTPOST', 14), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns, fire };
  }

  // ================================================================= 유적 도시
  function buildRuins(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    // 무너진 신전 — 기둥 줄과 반쯤 남은 벽
    const temple = new THREE.Group();
    const floor = T.mesh(L.box(56, 1.6, 40), 0xc9c4b4, 'matte');
    T.put(temple, floor, 0, 0.8, 0);
    for (let i = 0; i < 8; i++) {
      for (const sz of [-1, 1]) {
        const broken = (i * 3 + (sz + 1)) % 5 === 0;
        const hgt = broken ? 6 + (i % 3) * 3 : 18;
        const col2 = T.mesh(L.cyl(1.7, 2.0, hgt, 12), 0xdcd8c8, 'matte');
        T.put(temple, col2, -24 + i * 7, 1.6 + hgt / 2, sz * 15);
        if (!broken) {
          const cap = T.mesh(L.box(4.6, 1.4, 4.6), 0xc9c4b4, 'matte');
          T.put(temple, cap, -24 + i * 7, 1.6 + hgt + 0.7, sz * 15);
        }
      }
    }
    const arch = T.mesh(L.box(56, 2.2, 6), 0xc9c4b4, 'matte');
    T.put(temple, arch, 0, 21, -15);
    place(group, temple, cx, baseY, cz, 0.2, colliders, 28, 20);

    // 무너진 집터 · 부러진 조각상 · 흩어진 블록
    for (let i = 0; i < 14; i++) {
      const s = spot(cx, cz, i, 1501, 46, R.r * 0.85);
      const hut = new THREE.Group();
      const w = 10 + (i % 3) * 4, d = 8 + (i % 2) * 5;
      for (let side = 0; side < 4; side++) {
        if ((i + side) % 3 === 0) continue;          // 한쪽 벽은 무너졌다
        const along = side % 2 === 0 ? w : d;
        const wall = T2.concreteWall(along, 5 + (i % 3), 1.6, 0xc9c4b4);
        const ang = side * Math.PI / 2;
        wall.position.set(Math.sin(ang) * (side % 2 === 0 ? d / 2 : w / 2), 2.5 + (i % 3) / 2,
          Math.cos(ang) * (side % 2 === 0 ? d / 2 : w / 2));
        wall.rotation.y = ang;
        hut.add(wall);
      }
      place(group, hut, s.x, h(s.x, s.z), s.z, rnd(i, 1502) * 6, colliders, w / 2, d / 2);
      spawns.push({ x: s.x + 8, z: s.z + 6 });
    }
    for (let i = 0; i < 8; i++) {
      const s = spot(cx, cz, i, 1511, 40, R.r * 0.7);
      const st = T2.statue(0xdcd8c8);
      st.rotation.z = (rnd(i, 1512) - 0.5) * 0.6;
      place(group, st, s.x, h(s.x, s.z), s.z, rnd(i, 1513) * 6, colliders, 2.4);
    }
    for (let i = 0; i < 16; i++) {
      const s = spot(cx, cz, i, 1521, 30, R.r * 0.9);
      place(group, T.rock(0.9 + rnd(i, 1522) * 1.0, 0xc9c4b4), s.x, h(s.x, s.z), s.z, rnd(i, 1523) * 6, colliders, 2);
    }
    spawns.push({ x: cx, z: cz + 30, boss: true });
    if (R.entry) place(group, T.signPost('RUINED CITY', 15), R.entry.x, h(R.entry.x, R.entry.z), R.entry.z, Math.PI, colliders, 1);
    return { colliders, spawns };
  }

  L.REGION_BUILDERS = L.REGION_BUILDERS || {};
  Object.assign(L.REGION_BUILDERS, {
    forest: buildForest,
    beach: buildBeach,
    desert: buildDesert,
    sea: buildSea,
    island: buildIsland,
    lava: buildLava,
    pyramid: buildPyramid,
    mine: buildMine,
    facility: buildFacility,
    sewer: buildSewer,
    arena: buildArena,
    museum: buildMuseum,
    haunted: buildHaunted,
    outpost: buildOutpost,
    ruins: buildRuins,
  });
})(window.LEGO);
