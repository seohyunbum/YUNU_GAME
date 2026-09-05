/* =========================================================================
 * fantasyKits.js — 판타지 지역 빌더
 *   tower(마법사 탑) · castle(수정 성 — 본채에 들어갈 수 있다) · nest(용의 둥지) ·
 *   fairy(요정 숲) · isles(부유섬)
 * (지하 던전은 facility 빌더의 dungeon 테마를 쓴다)
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;
  const T = L.parts;
  const T2 = L.parts2;
  const FA = L.fantasy;
  const F = L.F;
  const N = L.terrainNoise;

  function rnd(i, j) { return N.hash2(Math.round(i * 131 + 7), Math.round(j * 977 + 13)); }

  function spot(cx, cz, i, seed, rMin, rMax) {
    const a = rnd(i, seed) * Math.PI * 2;
    const r = rMin + rnd(i, seed + 1) * (rMax - rMin);
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a };
  }

  function place(group, obj, x, y, z, ry, colliders, hx, hz) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    group.add(obj);
    if (colliders && hx) colliders.push({ x, z, hx, hz: hz === undefined ? hx : hz });
    return obj;
  }

  /** 입구에 마법 관문을 세운다(모든 판타지 지역 공통) */
  function entryPortal(group, ctx, colliders, color, spins) {
    const R = ctx.region;
    if (!R.entry) return;
    const p = FA.portalArch(color);
    place(group, p, R.entry.x, ctx.heightAt(R.entry.x, R.entry.z), R.entry.z, 0, colliders, 9, 2);
    spins.push(p);
  }

  // ================================================================= 마법사 탑
  function buildTower(group, ctx) {
    const colliders = [], spawns = [], spins = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    // 탑 + 발치의 마법진
    place(group, FA.wizardTower(66), cx, baseY, cz, 0, colliders, 9);
    const circle = FA.magicCircle(18, F.magic);
    place(group, circle, cx, baseY, cz + 26, 0);
    spins.push(circle);

    // 떠 있는 바위들이 탑 주위를 돈다
    const floaters = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 26 + (i % 3) * 9;
      const rock = FA.floatingRock(0.8 + rnd(i, 11) * 0.8, i % 2 === 0);
      place(group, rock, cx + Math.cos(a) * r, baseY + 26 + (i % 4) * 9, cz + Math.sin(a) * r, a);
      floaters.push({ obj: rock, a, r, y: baseY + 26 + (i % 4) * 9, spd: 0.12 + (i % 3) * 0.05 });
    }

    // 선돌 · 횃불 · 보물 상자
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * 34, z = cz + Math.sin(a) * 34;
      place(group, FA.runeStone(F.arcane), x, h(x, z), z, a, colliders, 1.8);
      const tx = cx + Math.cos(a + 0.4) * 22, tz = cz + Math.sin(a + 0.4) * 22;
      const torch = FA.torchPost(F.magicLight);
      place(group, torch, tx, h(tx, tz), tz, 0, colliders, 0.8);
      spins.push(torch);
    }
    place(group, FA.treasureChest(), cx + 14, h(cx + 14, cz + 14), cz + 14, -0.6, colliders, 2.6);
    for (let i = 0; i < 14; i++) {
      const s = spot(cx, cz, i, 21, 44, R.r * 0.85);
      if (i % 3 === 0) place(group, FA.crystalSpire(10 + rnd(i, 22) * 10, F.magic), s.x, h(s.x, s.z), s.z, 0, colliders, 2);
      else place(group, T.rock(1 + rnd(i, 23), F.stone), s.x, h(s.x, s.z), s.z, rnd(i, 24) * 6, colliders, 2);
      spawns.push({ x: s.x, z: s.z });
    }
    spawns.push({ x: cx, z: cz + 30, boss: true });
    entryPortal(group, ctx, colliders, F.magic, spins);
    return { colliders, spawns, spins, floaters };
  }

  // ================================================================= 성의 본채(들어갈 수 있다)
  /**
   * 수정 성 본채 — 현관 홀 · 옥좌의 방 · 감옥 · 보물고.
   * 벽은 조각마다 충돌 상자를 넣고 문 자리는 비운다(통짜로 막으면 못 들어간다).
   * 반환값의 indoor 상자를 world.indoors() 가 읽어 실내등을 켠다.
   */
  function castleKeep(group, colliders, spawns, spins, kx, kz, baseY) {
    const W = 64, D = 44, H = 18, TH = 2;
    const x0 = kx - W / 2, x1 = kx + W / 2, z0 = kz - D / 2, z1 = kz + D / 2;
    const HALL = kz + 6;          // 현관 홀과 안쪽 방들의 경계
    const WING = 14;              // 옥좌의 방 반폭

    function wallX(z, xa, xb, gapC, gapW, color) {
      const parts = [];
      if (gapW > 0) {
        if (gapC - gapW / 2 > xa) parts.push([xa, gapC - gapW / 2]);
        if (gapC + gapW / 2 < xb) parts.push([gapC + gapW / 2, xb]);
      } else parts.push([xa, xb]);
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i][0], b = parts[i][1];
        if (b - a < 0.5) continue;
        const m = T.mesh(L.box(b - a, H, TH), color || F.stone, 'matte');
        T.put(group, m, (a + b) / 2, baseY + H / 2, z);
        colliders.push({ x: (a + b) / 2, z, hx: (b - a) / 2, hz: TH / 2 + 0.4 });
      }
      if (gapW > 0) {
        const arch = T.mesh(L.box(gapW, 3, TH + 0.4), F.stoneDark, 'matte');
        T.put(group, arch, gapC, baseY + H - 1.5, z);
      }
    }
    function wallZ(x, za, zb, gapC, gapW, color) {
      const parts = [];
      if (gapW > 0) {
        if (gapC - gapW / 2 > za) parts.push([za, gapC - gapW / 2]);
        if (gapC + gapW / 2 < zb) parts.push([gapC + gapW / 2, zb]);
      } else parts.push([za, zb]);
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i][0], b = parts[i][1];
        if (b - a < 0.5) continue;
        const m = T.mesh(L.box(TH, H, b - a), color || F.stone, 'matte');
        T.put(group, m, x, baseY + H / 2, (a + b) / 2);
        colliders.push({ x, z: (a + b) / 2, hx: TH / 2 + 0.4, hz: (b - a) / 2 });
      }
      if (gapW > 0) {
        const arch = T.mesh(L.box(TH + 0.4, 3, gapW), F.stoneDark, 'matte');
        T.put(group, arch, x, baseY + H - 1.5, gapC);
      }
    }
    /** 벽에 붙인 횃불 (복도를 막지 않게 벽 쪽으로) */
    function torch(x, z, lamp, color) {
      const t = FA.torchPost(color === undefined ? 0xffb03a : color);
      T.put(group, t, x, baseY, z);
      spins.push(t);
      if (lamp) {
        const fire = new THREE.PointLight(0xffc07a, 1.5, 54, 1.5);
        fire.position.set(x, baseY + 9, z);
        group.add(fire);
      }
    }

    // 바닥 · 천장
    T.put(group, T.mesh(L.box(W, 1.2, D), F.stoneDark, 'matte'), kx, baseY - 0.6, kz);
    T.put(group, T.mesh(L.box(W + 3, 1.8, D + 3), F.stone, 'matte'), kx, baseY + H + 0.9, kz);

    // 바깥 벽 (앞면에 큰 문)
    wallX(z1, x0, x1, kx, 11);
    wallX(z0, x0, x1, 0, 0);
    wallZ(x0, z0, z1, 0, 0);
    wallZ(x1, z0, z1, 0, 0);
    // 안쪽 벽 — 홀에서 옥좌의 방으로, 옥좌의 방에서 감옥·보물고로
    wallX(HALL, x0, x1, kx, 12);
    wallZ(kx - WING, z0, HALL, kz - 8, 9);
    wallZ(kx + WING, z0, HALL, kz - 8, 9);

    // 지붕 위 총안 + 깃발
    for (let i = 0; i < 16; i++) {
      const t2 = i / 15;
      T.put(group, T.mesh(L.box(3, 3, 3), F.stone, 'matte'), x0 + 2 + t2 * (W - 4), baseY + H + 3.2, z1 - 1);
      T.put(group, T.mesh(L.box(3, 3, 3), F.stone, 'matte'), x0 + 2 + t2 * (W - 4), baseY + H + 3.2, z0 + 1);
    }
    for (const sx of [-1, 1]) {
      const pole = T.mesh(L.cyl(0.4, 0.4, 12, 8), F.gold, 'metal');
      T.put(group, pole, kx + sx * 20, baseY + H + 7, kz);
      const flag = T.mesh(L.box(7, 4.5, 0.3), F.banner, 'matte');
      T.put(group, flag, kx + sx * 23.6, baseY + H + 10, kz);
    }

    // ---- 현관 홀: 붉은 융단 · 기둥 · 무기 걸이
    for (let i = 0; i < 5; i++) {
      const rug = T.mesh(L.box(9, 0.24, 6), F.banner, 'matte');
      T.put(group, rug, kx, baseY + 0.14, z1 - 4 - i * 6.4);
    }
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const col = T.mesh(L.cyl(1.7, 1.9, H - 1, 10), F.stone, 'matte');
        T.put(group, col, kx + sx * 12, baseY + (H - 1) / 2, z1 - 6 - i * 7);
        colliders.push({ x: kx + sx * 12, z: z1 - 6 - i * 7, hx: 2, hz: 2 });
      }
      torch(kx + sx * 23, z1 - 7, true);
      const banner = T.mesh(L.box(5, 10, 0.3), F.banner, 'matte');
      T.put(group, banner, kx + sx * 27, baseY + 11, z1 - 12);
    }
    spawns.push({ x: kx + 20, z: z1 - 12 });

    // ---- 옥좌의 방 (가운데 안쪽)
    const tz = z0 + 8;
    const dais = T.mesh(L.box(20, 1.6, 10), F.stone, 'matte');
    T.put(group, dais, kx, baseY + 0.8, tz + 1);
    const step = T.mesh(L.box(24, 0.8, 3), F.stoneDark, 'matte');
    T.put(group, step, kx, baseY + 0.4, tz + 7);
    // 옥좌 — 등받이가 높은 수정 의자
    T.put(group, T.mesh(L.box(7, 12, 1.4), F.magic, 'plastic'), kx, baseY + 7.6, tz - 2);
    T.put(group, T.mesh(L.box(7, 1.6, 5), F.stone, 'matte'), kx, baseY + 4, tz + 0.6);
    for (const sx of [-1, 1]) {
      T.put(group, T.mesh(L.box(1.2, 4, 5), F.gold, 'metal'), kx + sx * 3.1, baseY + 5.6, tz + 0.6);
    }
    T.put(group, T.mesh(L.box(8.4, 1.6, 2), F.gold, 'metal'), kx, baseY + 14, tz - 2);
    // 옥좌 뒤 벽걸이와 수정
    for (const sx of [-1, 1]) {
      const drape = T.mesh(L.box(6, 13, 0.3), F.banner, 'matte');
      T.put(group, drape, kx + sx * 9, baseY + 9.5, z0 + 1.4);
      T.put(group, FA.crystalSpire(9, F.magic), kx + sx * 11, baseY, tz + 2);
      torch(kx + sx * 11.5, tz + 12, sx > 0);
    }
    // 천장 샹들리에 (수정 고리)
    const chand = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xdcbe61 }));
    chand.rotation.x = Math.PI / 2;
    T.put(group, chand, kx, baseY + H - 4, kz - 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(L.sph(0.8, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      T.put(group, candle, kx + Math.cos(a) * 4.5, baseY + H - 3.2, kz - 12 + Math.sin(a) * 4.5);
    }
    const chandLight = new THREE.PointLight(0xffd9a0, 1.4, 50, 1.5);
    chandLight.position.set(kx, baseY + H - 5, kz - 12);
    group.add(chandLight);
    // 보물 상자와 보스 자리
    place(group, FA.treasureChest(), kx - 7, baseY + 1.6, tz + 2, 0.4, colliders, 2.4);
    place(group, FA.treasureChest(), kx + 7, baseY + 1.6, tz + 2, -0.4, colliders, 2.4);
    spawns.push({ x: kx, z: kz - 10 });

    // ---- 감옥 (왼쪽 날개): 쇠창살 방 셋
    const cellX = x0 + 9;
    for (let i = 0; i < 3; i++) {
      const cz2 = z0 + 5 + i * 8;
      // 창살 — 얇은 기둥을 세우고 사이는 지나갈 수 있게 비운다
      for (let k = 0; k < 5; k++) {
        const bar = T.mesh(L.cyl(0.28, 0.28, 11, 6), C.silver, 'metal');
        T.put(group, bar, cellX + 5.5, baseY + 5.5, cz2 - 4.5 + k * 2.2);
      }
      const lintel2 = T.mesh(L.box(1, 1.6, 11), F.stoneDark, 'matte');
      T.put(group, lintel2, cellX + 5.5, baseY + 11.6, cz2);
      colliders.push({ x: cellX + 5.5, z: cz2 + 4.4, hx: 0.8, hz: 1.4 });
      // 짚더미 · 뼈 브릭 · 사슬
      T.put(group, T.mesh(L.box(6, 0.8, 4), C.tan, 'matte'), cellX - 1, baseY + 0.4, cz2);
      const bone = T.mesh(L.cyl(0.5, 0.6, 5, 6), P.bone, 'matte');
      bone.rotation.z = Math.PI / 2;
      T.put(group, bone, cellX + 2, baseY + 0.6, cz2 + 3);
      const chain = T.mesh(L.cyl(0.2, 0.2, 6, 6), C.darkGray, 'metal');
      T.put(group, chain, x0 + 2.6, baseY + 12, cz2 - 2);
      if (i === 1) torch(cellX + 8.5, cz2, true);
      spawns.push({ x: cellX, z: cz2 });
    }
    const jailSign = T.mesh(L.box(7, 2.4, 0.3), F.stoneDark, 'matte');
    T.put(group, jailSign, kx - WING - 1.6, baseY + 13, kz - 8);

    // ---- 보물고 (오른쪽 날개): 금화 더미 · 금괴 · 상자
    const trX = x1 - 10;
    for (let i = 0; i < 5; i++) {
      const gz = z0 + 4 + i * 5.5;
      const pile = T.mesh(L.cyl(3.4 - (i % 2) * 0.8, 4.4, 1.6, 12), F.gold, 'metal');
      T.put(group, pile, trX - (i % 2) * 5, baseY + 0.8, gz);
      const pile2 = T.mesh(L.cyl(1.6, 2.6, 1.2, 12), C.yellow, 'metal');
      T.put(group, pile2, trX - (i % 2) * 5, baseY + 2, gz);
    }
    for (let i = 0; i < 4; i++) {
      const bar2 = T.mesh(L.box(3.4, 1.2, 1.8), F.gold, 'metal');
      T.put(group, bar2, trX + 4, baseY + 0.6 + i * 1.25, z0 + 24 - (i % 2) * 2);
    }
    place(group, FA.treasureChest(), trX, baseY, z0 + 21, -0.3, colliders, 2.4);
    place(group, FA.treasureChest(), trX - 6, baseY, z0 + 21, 0.3, colliders, 2.4);
    T.put(group, FA.crystalSpire(11, F.arcane), trX + 3, baseY, z0 + 4);
    torch(kx + WING + 3.5, kz - 8, true);
    torch(x1 - 3, z0 + 20, false);
    spawns.push({ x: trX, z: z0 + 20 });

    return { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, y0: baseY - 2, y1: baseY + H + 3 };
  }

  // ================================================================= 수정 성
  function buildCastle(group, ctx) {
    const colliders = [], spawns = [], spins = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);
    const S = 62;            // 성벽 한 변의 반길이

    // 네 면 성벽(정문 자리는 비운다) + 모서리 탑
    const segs = [
      { dx: 0, dz: S, len: S * 2, ry: 0, gate: true },
      { dx: 0, dz: -S, len: S * 2, ry: 0 },
      { dx: -S, dz: 0, len: S * 2, ry: Math.PI / 2 },
      { dx: S, dz: 0, len: S * 2, ry: Math.PI / 2 },
    ];
    for (let i = 0; i < segs.length; i++) {
      const g2 = segs[i];
      if (g2.gate) {
        // 문 양옆으로 두 토막
        const half = (g2.len - 22) / 2;
        for (const sx of [-1, 1]) {
          const w = FA.castleWall(half, 16);
          place(group, w, cx + sx * (11 + half / 2), baseY, cz + g2.dz, 0,
            colliders, half / 2, 2.5);
        }
        // 문루
        const arch = T.mesh(L.box(24, 5, 6), F.stone, 'matte');
        T.put(group, arch, cx, baseY + 18, cz + g2.dz);
        for (const sx of [-1, 1]) {
          const post = T.mesh(L.box(4, 18, 6), F.stoneDark, 'matte');
          T.put(group, post, cx + sx * 12, baseY + 9, cz + g2.dz);
          colliders.push({ x: cx + sx * 12, z: cz + g2.dz, hx: 2, hz: 3 });
        }
        const banner = T.mesh(L.box(6, 9, 0.3), F.banner, 'matte');
        T.put(group, banner, cx, baseY + 12, cz + g2.dz + 3.4);
      } else {
        const w = FA.castleWall(g2.len, 16);
        place(group, w, cx + g2.dx, baseY, cz + g2.dz, g2.ry,
          colliders, g2.ry ? 2.5 : g2.len / 2, g2.ry ? g2.len / 2 : 2.5);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        place(group, FA.castleTower(30, 7), cx + sx * S, baseY, cz + sz * S, 0, colliders, 8);
      }
    }

    // 안뜰 안쪽에 본채가 선다(걸어 들어가면 옥좌의 방 · 감옥 · 보물고)
    const indoor = castleKeep(group, colliders, spawns, spins, cx, cz - 26, baseY);

    // 안뜰 앞마당: 마법진 · 수정 첨탑 · 횃불 (본채 자리는 비운다)
    const circle = FA.magicCircle(14, F.arcane);
    place(group, circle, cx, baseY, cz + 20, 0);
    spins.push(circle);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sx2 = cx + Math.cos(a) * 34, sz2 = cz + 22 + Math.sin(a) * 20;
      place(group, FA.crystalSpire(14 + (i % 3) * 7, i % 2 ? F.arcane : F.magic),
        sx2, baseY, sz2, 0, colliders, 2.4);
    }
    // 정문에서 본채 문까지 이어지는 횃불 길
    for (let i = 0; i < 4; i++) {
      for (const sx2 of [-1, 1]) {
        const torch = FA.torchPost(0xffd9a0);
        place(group, torch, cx + sx2 * 9, baseY, cz + 52 - i * 14, 0, colliders, 0.8);
        spins.push(torch);
      }
    }

    // 성 밖
    for (let i = 0; i < 16; i++) {
      const s = spot(cx, cz, i, 41, S + 20, R.r * 0.9);
      place(group, i % 3 === 0 ? FA.runeStone(F.arcane) : T.rock(1 + rnd(i, 42), F.stone),
        s.x, h(s.x, s.z), s.z, rnd(i, 43) * 6, colliders, 2);
      spawns.push({ x: s.x, z: s.z });
    }
    spawns.push({ x: cx, z: cz + 34, boss: true });
    entryPortal(group, ctx, colliders, F.arcane, spins);
    return { colliders, spawns, spins, indoor };
  }

  // ================================================================= 용의 둥지
  function buildNest(group, ctx) {
    const colliders = [], spawns = [], spins = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    place(group, FA.dragonNest(), cx, baseY, cz, 0, colliders, 13);
    const pools = [];
    for (let i = 0; i < 7; i++) {
      const s = spot(cx, cz, i, 51, 24, R.r * 0.7);
      const pool = T2.lavaPool(8 + rnd(i, 52) * 10);
      place(group, pool, s.x, h(s.x, s.z) - 0.5, s.z, 0);
      pools.push(pool);
    }
    // 뼈처럼 흩어진 흰 브릭 · 그슬린 나무 · 보물
    for (let i = 0; i < 18; i++) {
      const s = spot(cx, cz, i, 61, 18, R.r * 0.85);
      if (i % 3 === 0) {
        const bone = T.mesh(L.cyl(0.7, 0.9, 9, 7), P.bone, 'matte');
        place(group, bone, s.x, h(s.x, s.z) + 0.7, s.z, rnd(i, 62) * 6);
        bone.rotation.z = Math.PI / 2;
      } else if (i % 3 === 1) {
        place(group, T.deadTree(0.9 + rnd(i, 63) * 0.6, i + 200), s.x, h(s.x, s.z), s.z, rnd(i, 64) * 6, colliders, 1.6);
      } else {
        place(group, T.rock(1 + rnd(i, 65) * 1.2, 0x3a2b28), s.x, h(s.x, s.z), s.z, rnd(i, 66) * 6, colliders, 2.2);
      }
      spawns.push({ x: s.x, z: s.z });
    }
    place(group, FA.treasureChest(), cx + 18, h(cx + 18, cz + 8), cz + 8, -0.5, colliders, 2.6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * 30, z = cz + Math.sin(a) * 30;
      const torch = FA.torchPost(0xff7a18);
      place(group, torch, x, h(x, z), z, 0, colliders, 0.8);
      spins.push(torch);
    }
    spawns.push({ x: cx, z: cz + 18, boss: true });
    entryPortal(group, ctx, colliders, 0xff5a10, spins);
    return { colliders, spawns, spins, pools };
  }

  // ================================================================= 요정 숲
  function buildFairy(group, ctx) {
    const colliders = [], spawns = [], spins = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;

    // 빛나는 거대 버섯 숲
    for (let i = 0; i < 26; i++) {
      const s = spot(cx, cz, i, 71, 26, R.r * 0.85);
      const cap = i % 3 === 0 ? 0x9a63e6 : (i % 3 === 1 ? 0x63d7e6 : 0xf0a8d0);
      const m = T.mushroom(1.8 + rnd(i, 72) * 2.4, cap);
      // 갓 밑에 빛나는 알
      const glow = new THREE.Mesh(L.sph(0.7, 8), new THREE.MeshBasicMaterial({ color: cap }));
      glow.position.y = 2.4;
      m.add(glow);
      place(group, m, s.x, h(s.x, s.z), s.z, rnd(i, 73) * 6, colliders, 1.8);
      if (i % 3 === 0) spawns.push({ x: s.x, z: s.z });
    }
    // 빛나는 나무 몇 그루
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 81, 40, R.r * 0.8);
      const tree = T.pineTree(1.2 + rnd(i, 82) * 0.8, false);
      const orb = new THREE.Mesh(L.sph(1.4, 10), new THREE.MeshBasicMaterial({ color: 0xd8f4b0 }));
      orb.position.y = 14;
      tree.add(orb);
      place(group, tree, s.x, h(s.x, s.z), s.z, rnd(i, 83) * 6, colliders, 2);
    }
    // 마법진 · 선돌 · 요정 관문
    const circle = FA.magicCircle(16, 0x9ad46f);
    place(group, circle, cx, h(cx, cz), cz, 0);
    spins.push(circle);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = cx + Math.cos(a) * 24, z = cz + Math.sin(a) * 24;
      place(group, FA.runeStone(0x9ad46f), x, h(x, z), z, a, colliders, 1.8);
    }
    place(group, FA.treasureChest(), cx - 12, h(cx - 12, cz + 10), cz + 10, 0.5, colliders, 2.6);
    entryPortal(group, ctx, colliders, 0x9ad46f, spins);
    return { colliders, spawns, spins };
  }

  // ================================================================= 부유섬
  function buildIsles(group, ctx) {
    const colliders = [], spawns = [], spins = [];
    const h = ctx.heightAt, R = ctx.region;
    const cx = R.cx, cz = R.cz;
    const baseY = h(cx, cz);

    // 위로 떠 있는 섬들과 그 사이 계단 돌
    const floaters = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 * 1.6;
      const r = 20 + i * 5;
      const y = baseY + 18 + i * 3.4;
      const rock = FA.floatingRock(1.1 + rnd(i, 91) * 1.1, true);
      place(group, rock, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, a);
      floaters.push({ obj: rock, a, r, y, spd: 0.06 + (i % 4) * 0.03 });
      if (i % 4 === 0) {
        const spire = FA.crystalSpire(12, F.arcane);
        spire.position.set(cx + Math.cos(a) * r, y + 2, cz + Math.sin(a) * r);
        group.add(spire);
      }
    }
    // 땅 위: 관문 · 마법진 · 선돌
    const circle = FA.magicCircle(20, F.arcane);
    place(group, circle, cx, baseY, cz, 0);
    spins.push(circle);
    for (let i = 0; i < 10; i++) {
      const s = spot(cx, cz, i, 101, 30, R.r * 0.8);
      place(group, i % 2 ? FA.runeStone(F.arcane) : FA.crystalSpire(9 + rnd(i, 102) * 8, F.magic),
        s.x, h(s.x, s.z), s.z, rnd(i, 103) * 6, colliders, 2);
      spawns.push({ x: s.x, z: s.z });
    }
    place(group, FA.treasureChest(), cx + 16, h(cx + 16, cz - 10), cz - 10, 0.3, colliders, 2.6);
    spawns.push({ x: cx + 20, z: cz + 12, boss: true });
    entryPortal(group, ctx, colliders, F.arcane, spins);
    return { colliders, spawns, spins, floaters };
  }

  L.REGION_BUILDERS = L.REGION_BUILDERS || {};
  Object.assign(L.REGION_BUILDERS, {
    tower: buildTower,
    castle: buildCastle,
    nest: buildNest,
    fairy: buildFairy,
    isles: buildIsles,
  });
})(window.LEGO);
