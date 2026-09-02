/* =========================================================================
 * fantasyKits.js — 판타지 지역 빌더
 *   tower(마법사 탑) · castle(수정 성) · nest(용의 둥지) ·
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

    // 안뜰: 옥좌 단상 · 수정 첨탑 · 횃불 · 마법진
    const dais = T.mesh(L.box(26, 2.4, 20), F.stone, 'matte');
    T.put(group, dais, cx, baseY + 1.2, cz - 26);
    const throne = T.mesh(L.box(6, 10, 4), F.magic, 'plastic');
    T.put(group, throne, cx, baseY + 7.4, cz - 32);
    const crown = T.mesh(L.box(7, 1.4, 5), F.gold, 'metal');
    T.put(group, crown, cx, baseY + 12.8, cz - 32);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      place(group, FA.crystalSpire(16 + (i % 3) * 7, i % 2 ? F.arcane : F.magic),
        cx + Math.cos(a) * 30, baseY, cz + Math.sin(a) * 30, 0, colliders, 2.4);
    }
    const circle = FA.magicCircle(14, F.arcane);
    place(group, circle, cx, baseY, cz, 0);
    spins.push(circle);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const x = cx + Math.cos(a) * 46, z = cz + Math.sin(a) * 46;
      const torch = FA.torchPost(0xffd166);
      place(group, torch, x, baseY, z, 0, colliders, 0.8);
      spins.push(torch);
    }
    place(group, FA.treasureChest(), cx - 10, baseY + 2.4, cz - 24, 0.4, colliders, 2.6);
    place(group, FA.treasureChest(), cx + 10, baseY + 2.4, cz - 24, -0.4, colliders, 2.6);

    // 성 밖
    for (let i = 0; i < 16; i++) {
      const s = spot(cx, cz, i, 41, S + 20, R.r * 0.9);
      place(group, i % 3 === 0 ? FA.runeStone(F.arcane) : T.rock(1 + rnd(i, 42), F.stone),
        s.x, h(s.x, s.z), s.z, rnd(i, 43) * 6, colliders, 2);
      spawns.push({ x: s.x, z: s.z });
    }
    spawns.push({ x: cx, z: cz - 14, boss: true });
    entryPortal(group, ctx, colliders, F.arcane, spins);
    return { colliders, spawns, spins };
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
