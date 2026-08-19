/* =========================================================================
 * regions.js — 사냥터 네 곳을 실제로 짓는다
 *
 *   좀비 마을   : 버려진 판잣집 · 우물 · 호박밭 · 초록 등불
 *   늪지대 폐가 : 물에 잠긴 분지 · 기둥 위 폐가 · 널다리 · 거대 버섯
 *   깊은 동굴 협곡 : 깎아지른 협곡 · 지붕 덮인 갱도 · 빛나는 크리스탈
 *   높은 산     : 침엽수림 → 설산 → 정상 얼음 사당
 *
 * 각 빌더는 (group, ctx) 를 받아 소품을 group 에 넣고
 * { colliders, spawns, ambience, water } 를 돌려준다. 씬에 직접 손대지 않는다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;
  const T = L.parts;
  const N = L.terrainNoise;

  /** 씨앗 기반 난수(같은 세상이 항상 같은 모양이 되도록) */
  function rnd(i, j) { return N.hash2(Math.round(i * 131 + 7), Math.round(j * 977 + 13)); }

  function place(group, obj, x, y, z, ry, colliders, hx, hz) {
    obj.position.set(x, y, z);
    if (ry) obj.rotation.y = ry;
    group.add(obj);
    if (colliders && hx) colliders.push({ x, z, hx, hz: hz === undefined ? hx : hz });
    return obj;
  }

  // ================================================================== 좀비 마을
  /** 버려진 판잣집 한 채 */
  function abandonedHouse(w, d, floors, o) {
    o = o || {};
    const g = new THREE.Group();
    const fh = 5.2;
    const wallColor = o.wall === undefined ? P.plank : o.wall;

    // 주춧돌
    const base = T.mesh(L.box(w + 1.4, 1.2, d + 1.4), P.stone, 'matte');
    T.put(g, base, 0, 0.6, 0);

    for (let f = 0; f < floors; f++) {
      const y = 1.2 + f * fh + fh / 2;
      // 네 벽 (앞면은 문·창 자리를 남긴다)
      for (let side = 0; side < 4; side++) {
        const along = side % 2 === 0 ? w : d;
        const wall = T.plankWall(along, fh, 0.9, wallColor, true);
        const ang = side * Math.PI / 2;
        wall.position.set(Math.sin(ang) * (side % 2 === 0 ? d / 2 : w / 2), y, Math.cos(ang) * (side % 2 === 0 ? d / 2 : w / 2));
        wall.rotation.y = ang;
        g.add(wall);
      }
      // 층 바닥(밖에서 구멍으로 보일 때 속이 안 비게)
      const deck = T.mesh(L.box(w - 0.5, 0.6, d - 0.5), P.darkWood, 'matte');
      T.put(g, deck, 0, y - fh / 2, 0);
      // 모서리 기둥
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = T.mesh(L.box(0.8, fh + 0.4, 0.8), P.darkWood, 'matte');
          T.put(g, post, sx * w / 2, y, sz * d / 2);
        }
      }
      // 창문(판자로 막음)
      const win = T.boardedWindow(2.6, 2.6);
      T.put(g, win, -w * 0.26, y + 0.4, d / 2 + 0.35);
      const win2 = T.boardedWindow(2.6, 2.6);
      T.put(g, win2, w * 0.28, y + 0.4, d / 2 + 0.35);
      if (f > 0) {
        const win3 = T.boardedWindow(2.4, 2.4);
        T.put(g, win3, w / 2 + 0.35, y + 0.4, 0, 0, Math.PI / 2, 0);
      }
    }
    // 문 (경첩 하나 빠져 기울어짐)
    const dr = T.door(3.0, 5.0, P.rottenWood, 0.13);
    T.put(g, dr, 0, 1.2 + 2.5, d / 2 + 0.45);

    // 처마 받침 + 무너진 지붕
    const eave = T.mesh(L.box(w + 2.4, 0.6, d + 2.4), P.darkWood, 'matte');
    T.put(g, eave, 0, 1.2 + floors * fh, 0);
    const roof = T.brokenRoof(w + 1.6, d + 1.6, wallColor, true);
    T.put(g, roof, 0, 1.2 + floors * fh + 0.3, 0);

    // 굴뚝
    const chim = T.mesh(L.box(2.2, 6, 2.2), P.stone, 'matte');
    T.put(g, chim, w * 0.3, 1.2 + floors * fh + 3.2, -d * 0.25, 0, 0, 0.06);
    const chimTop = T.mesh(L.box(2.8, 0.6, 2.8), P.darkStone, 'matte');
    T.put(g, chimTop, w * 0.3, 1.2 + floors * fh + 6.4, -d * 0.25);

    // 이끼(초록 얼룩)
    for (let i = 0; i < 5; i++) {
      const moss = T.mesh(L.box(1.6 + rnd(i, 3) * 2, 0.3, 1.4), P.mossGreen, 'matte');
      T.put(g, moss, (rnd(i, 1) - 0.5) * w, 1.4 + rnd(i, 2) * floors * fh, d / 2 + 0.4, 0, 0, rnd(i, 4) * 0.6);
    }
    return g;
  }

  function buildZombieVillage(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt;
    const cx = ctx.region.cx, cz = ctx.region.cz;

    // 마을 한가운데 우물
    place(group, T.well(), cx, h(cx, cz), cz, 0, colliders, 3);

    // 집 8채를 광장 둘레에 둘러 세운다
    const houses = [
      [-34, -26, 16, 14, 2, 0.5], [10, -40, 18, 15, 2, -0.3], [42, -18, 15, 13, 1, 1.2],
      [40, 24, 17, 15, 2, 2.4], [8, 44, 16, 14, 1, 3.3], [-30, 38, 18, 16, 2, 3.9],
      [-52, 8, 15, 13, 1, 1.6], [-8, -66, 20, 16, 2, 0.15],
    ];
    for (let i = 0; i < houses.length; i++) {
      const [ox, oz, w, d, f, ry] = houses[i];
      const x = cx + ox, z = cz + oz;
      const house = abandonedHouse(w, d, f, { wall: i % 3 === 0 ? P.rottenWood : P.plank });
      place(group, house, x, h(x, z) - 0.4, z, ry, colliders, w / 2 + 1, d / 2 + 1);
      spawns.push({ x: x + Math.cos(ry) * (w + 6), z: z + Math.sin(ry) * (d + 6) });
    }

    // 큰 헛간 — 이 앞이 좀비 두목이 나오는 자리
    const barn = abandonedHouse(26, 20, 2, { wall: 0x7a3b2c });
    place(group, barn, cx + 62, h(cx + 62, cz - 52) - 0.4, cz - 52, -0.6, colliders, 14, 11);
    spawns.push({ x: cx + 62, z: cz - 34, boss: true });

    // 삐뚤어진 울타리로 마을 경계를 두른다
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 86 + rnd(i, 5) * 10;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      // 길목은 비워둔다
      if (Math.abs(a - Math.PI * 0.5) < 0.45) continue;
      place(group, T.crookedFence(14, i % 2 ? 1 : -1), x, h(x, z), z, a + Math.PI / 2, colliders, 7, 1);
    }

    // 죽은 나무 · 호박밭 · 건초 · 상자 · 등불
    for (let i = 0; i < 14; i++) {
      const a = rnd(i, 7) * Math.PI * 2, r = 24 + rnd(i, 8) * 68;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      place(group, T.deadTree(0.9 + rnd(i, 9) * 0.7, i + 1), x, h(x, z), z, rnd(i, 2) * 6, colliders, 1.6);
    }
    for (let i = 0; i < 18; i++) {
      const x = cx - 46 + (i % 6) * 5.5 + rnd(i, 11) * 2;
      const z = cz + 62 + Math.floor(i / 6) * 6;
      place(group, T.pumpkin(0.8 + rnd(i, 12) * 0.5), x, h(x, z), z, rnd(i, 13) * 6);
    }
    for (let i = 0; i < 5; i++) {
      const x = cx + 30 + rnd(i, 14) * 26, z = cz - 12 + rnd(i, 15) * 30;
      place(group, T.hayBale(), x, h(x, z), z, rnd(i, 16) * 3, colliders, 2);
    }
    for (let i = 0; i < 8; i++) {
      const x = cx - 12 + rnd(i, 17) * 40, z = cz - 8 + rnd(i, 18) * 34;
      place(group, i % 2 ? T.crate(1) : T.barrel(1), x, h(x, z), z, rnd(i, 19) * 3, colliders, 1.2);
    }
    place(group, T.brokenCart(), cx + 18, h(cx + 18, cz + 14), cz + 14, 0.7, colliders, 3.5, 2);

    // 마을 광장 모닥불 (아직 누군가 불을 지피고 있다…)
    const fire = T.campfire();
    place(group, fire, cx - 14, h(cx - 14, cz + 16), cz + 16, 0, colliders, 2.4);
    // 호박밭을 지키는 허수아비 둘
    place(group, T.scarecrow(), cx - 40, h(cx - 40, cz + 74), cz + 74, 0.4, colliders, 1);
    place(group, T.scarecrow(), cx - 20, h(cx - 20, cz + 78), cz + 78, -0.8, colliders, 1);
    // 헛간 옆 종탑 — 종을 울려 좀비를 불러 모으던 자리
    place(group, T.bell(), cx + 48, h(cx + 48, cz - 36), cz - 36, 0.6, colliders, 2);

    // 초록 등불 — 으스스한 분위기
    const lanterns = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 30 + (i % 3) * 16;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const lt = T.lantern(0x9bd44b);
      place(group, lt, x, h(x, z), z, 0, colliders, 0.6);
      lanterns.push(lt);
    }

    // 마을 입구 표지판
    const sx = cx, sz = cz + 96;
    place(group, T.signPost('ZOMBIE VILLAGE', 16), sx, h(sx, sz), sz, Math.PI, colliders, 1);

    return {
      colliders, spawns, lanterns, fire,
      ambience: { fog: 0x6f7a5e, fogNear: 40, fogFar: 190, sun: 0.62, hemi: 0.55, sky: 0x8a9376 },
    };
  }

  // ================================================================== 늪 폐가
  /** 기둥 위에 올라선 폐가 (2층 + 현관 + 부러진 굴뚝) */
  function hauntedHouse() {
    const g = new THREE.Group();
    const w = 24, d = 20, stilt = 5;

    // 나무 기둥
    for (const sx of [-1, 0, 1]) {
      for (const sz of [-1, 0, 1]) {
        const post = T.mesh(L.box(1.2, stilt + 2, 1.2), P.rottenWood, 'matte');
        T.put(g, post, sx * (w / 2 - 1.5), (stilt + 2) / 2, sz * (d / 2 - 1.5));
      }
    }
    // 바닥판
    const floor = T.mesh(L.box(w + 2, 1.0, d + 2), P.plank, 'matte');
    T.put(g, floor, 0, stilt + 2.5, 0);

    // 1·2층 벽
    for (let f = 0; f < 2; f++) {
      const y = stilt + 3 + f * 6 + 3;
      for (let side = 0; side < 4; side++) {
        const along = side % 2 === 0 ? w : d;
        const wall = T.plankWall(along, 6, 0.7, f ? P.darkWood : P.rottenWood, true);
        const ang = side * Math.PI / 2;
        wall.position.set(Math.sin(ang) * (side % 2 === 0 ? d / 2 : w / 2), y, Math.cos(ang) * (side % 2 === 0 ? d / 2 : w / 2));
        wall.rotation.y = ang;
        g.add(wall);
      }
      for (const sx of [-1, 1]) {
        const win = T.boardedWindow(3.0, 3.0);
        T.put(g, win, sx * w * 0.28, y, d / 2 + 0.4);
      }
      // 옆면 창 하나는 안에서 불이 켜져 있다
      const lit = new THREE.Mesh(L.box(2.6, 2.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xd8b23c }));
      T.put(g, lit, w / 2 + 0.4, y, -d * 0.2, 0, Math.PI / 2, 0);
      const litFrame = T.mesh(L.box(3.2, 3.2, 0.3), P.darkWood, 'matte');
      T.put(g, litFrame, w / 2 + 0.3, y, -d * 0.2, 0, Math.PI / 2, 0);
    }
    // 현관 + 계단
    const porch = T.mesh(L.box(10, 0.8, 6), P.plank, 'matte');
    T.put(g, porch, 0, stilt + 3.0, d / 2 + 3);
    for (let i = 0; i < 5; i++) {
      const step = T.mesh(L.box(6, 0.7, 1.4), P.rottenWood, 'matte');
      T.put(g, step, 0, stilt + 2.6 - i * 1.3, d / 2 + 6.2 + i * 1.3);
    }
    for (const sx of [-1, 1]) {
      const rail = T.mesh(L.box(0.4, 3.4, 0.4), P.darkWood, 'matte');
      T.put(g, rail, sx * 4.6, stilt + 5, d / 2 + 5.6);
    }
    const dr = T.door(3.4, 5.6, P.darkWood, -0.16);
    T.put(g, dr, 0, stilt + 6.4, d / 2 + 0.5);

    // 지붕 + 굴뚝
    const roof = T.brokenRoof(w + 3, d + 3, P.darkWood, true);
    T.put(g, roof, 0, stilt + 15.4, 0);
    const chim = T.mesh(L.box(2.6, 8, 2.6), P.darkStone, 'matte');
    T.put(g, chim, -w * 0.3, stilt + 19, -d * 0.2, 0, 0, 0.12);

    // 이끼 · 넝쿨
    for (let i = 0; i < 8; i++) {
      const vine = T.mesh(L.box(0.5, 3 + rnd(i, 21) * 4, 0.5), P.swampGreen, 'matte');
      T.put(g, vine, (rnd(i, 22) - 0.5) * w, stilt + 6 + rnd(i, 23) * 8, d / 2 + 0.5);
    }
    return g;
  }

  function buildSwamp(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt;
    const cx = ctx.region.cx, cz = ctx.region.cz;
    const waterY = ctx.region.waterY;

    // 폐가 — 마른 언덕 위
    const house = hauntedHouse();
    place(group, house, cx, h(cx, cz) - 0.5, cz, 0.35, colliders, 14, 12);

    // 널다리: 입구 쪽에서 폐가까지 물 위로
    const bx = cx, bz0 = cz + 96, bz1 = cz + 22;
    const planks = Math.round((bz0 - bz1) / 3);
    for (let i = 0; i < planks; i++) {
      const z = bz1 + i * 3;
      const y = waterY + 1.1 + Math.sin(i * 0.7) * 0.12;
      const plank = T.mesh(L.box(7, 0.5, 2.6), P.plank, 'matte');
      T.put(group, plank, bx + Math.sin(i * 0.35) * 2.5, y, z, 0, Math.sin(i * 0.2) * 0.06, 0);
      if (i % 3 === 0) {
        for (const sx of [-1, 1]) {
          const post = T.mesh(L.box(0.6, 4.5, 0.6), P.rottenWood, 'matte');
          T.put(group, post, bx + Math.sin(i * 0.35) * 2.5 + sx * 3.2, y - 2, z);
        }
      }
    }

    // 죽은 나무 숲 + 늘어진 이끼
    for (let i = 0; i < 22; i++) {
      const a = rnd(i, 31) * Math.PI * 2, r = 26 + rnd(i, 32) * 92;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const tree = T.deadTree(1.0 + rnd(i, 33) * 0.8, i + 20);
      place(group, tree, x, h(x, z) - 0.3, z, rnd(i, 34) * 6, colliders, 1.6);
      for (let k = 0; k < 3; k++) {
        const moss = T.mesh(L.box(0.5, 2.5 + rnd(i + k, 35) * 3, 0.5), P.swampGreen, 'matte');
        T.put(group, moss, x + (rnd(i + k, 36) - 0.5) * 5, h(x, z) + 6 + rnd(i + k, 37) * 3, z + (rnd(i + k, 38) - 0.5) * 5);
      }
    }

    // 거대 버섯 무리
    for (let i = 0; i < 16; i++) {
      const a = rnd(i, 41) * Math.PI * 2, r = 18 + rnd(i, 42) * 86;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      place(group, T.mushroom(0.9 + rnd(i, 43) * 1.4, i % 3 ? C.red : C.purple), x, h(x, z) - 0.2, z, rnd(i, 44) * 6);
    }

    // 갈대 — InstancedMesh 한 개로 촘촘하게
    const reedCount = 420;
    const reeds = new THREE.InstancedMesh(L.box(0.28, 4.5, 0.28), L.mat(P.mossGreen, 'matte'), reedCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3();
    for (let i = 0; i < reedCount; i++) {
      const a = rnd(i, 51) * Math.PI * 2, r = 12 + rnd(i, 52) * 116;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = Math.max(h(x, z), waterY - 0.5);
      e.set(rnd(i, 53) * 0.3 - 0.15, rnd(i, 54) * 6, rnd(i, 55) * 0.3 - 0.15);
      q.setFromEuler(e);
      pv.set(x, y + 2.2, z);
      sv.set(1, 0.7 + rnd(i, 56) * 0.9, 1);
      m.compose(pv, q, sv);
      reeds.setMatrixAt(i, m);
    }
    reeds.instanceMatrix.needsUpdate = true;
    reeds.frustumCulled = false;
    reeds.castShadow = false;
    reeds.receiveShadow = true;
    group.add(reeds);

    // 수련잎 — 물 위에 뜬 초록 원판
    const padCount = 90;
    const pads = new THREE.InstancedMesh(L.cyl(1.6, 1.6, 0.22, 10), L.mat(0x3f8f43, 'matte'), padCount);
    for (let i = 0; i < padCount; i++) {
      const a = rnd(i, 61) * Math.PI * 2, r = 14 + rnd(i, 62) * 110;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (h(x, z) > waterY) continue;
      e.set(0, rnd(i, 63) * 6, 0);
      q.setFromEuler(e);
      pv.set(x, waterY + 0.12, z);
      sv.set(0.6 + rnd(i, 64) * 0.9, 1, 0.6 + rnd(i, 65) * 0.9);
      m.compose(pv, q, sv);
      pads.setMatrixAt(i, m);
    }
    pads.instanceMatrix.needsUpdate = true;
    pads.frustumCulled = false;
    pads.castShadow = false;
    group.add(pads);

    // 물 — 지역을 덮는 둥근 반투명 수면 (어두운 곳에서도 새까매지지 않게 발광 조금)
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(ctx.region.r * 1.05, 48),
      new THREE.MeshPhongMaterial({
        color: 0x3f6b4c, emissive: 0x16301f, specular: 0xcfeccf, shininess: 160,
        transparent: true, opacity: 0.78, side: THREE.DoubleSide,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, waterY, cz);
    water.receiveShadow = false;
    group.add(water);

    // 표지판 + 등불
    place(group, T.signPost('SWAMP RUIN', 15), cx + 4, h(cx + 4, cz + 104), cz + 104, Math.PI, colliders, 1);
    for (let i = 0; i < 6; i++) {
      const z = cz + 30 + i * 12;
      const x = cx + Math.sin(i * 0.9) * 6;
      place(group, T.lantern(0x63d7e6), x, Math.max(h(x, z), waterY + 0.4), z, 0, colliders, 0.6);
    }

    for (let i = 0; i < 10; i++) {
      const a = rnd(i, 71) * Math.PI * 2, r = 30 + rnd(i, 72) * 80;
      spawns.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
    }
    // 폐가 뒤편이 늪의 왕 자리
    spawns.push({ x: cx - 6, z: cz - 34, boss: true });

    return {
      colliders, spawns, water,
      ambience: { fog: 0x5c7a63, fogNear: 26, fogFar: 150, sun: 0.5, hemi: 0.6, sky: 0x6d8a72 },
    };
  }

  // ================================================================== 동굴 협곡
  function buildCave(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt;
    const cx = ctx.region.cx, cz = ctx.region.cz;
    const floorY = ctx.region.floorY;

    // ---- 갱도 입구: 돌 아치 + 목재 지지대
    const mouthZ = cz + 58;
    const mouth = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const sup = T.mineSupport(16, 13);
      T.put(mouth, sup, 0, 0, -i * 9);
    }
    place(group, mouth, cx, h(cx, mouthZ), mouthZ, 0, colliders, 9, 1);

    // ---- 지붕 덮인 갱도: 천장 슬래브 + 기둥 + 종유석
    //     (지형은 위로만 쌓이니, 동굴은 이렇게 "덮어서" 만든다)
    const tunnel = new THREE.Group();
    const segs = 12, segLen = 9, halfW = 13;
    const ceilY = floorY + 17;
    for (let i = 0; i < segs; i++) {
      const z = mouthZ - 14 - i * segLen;
      const wob = Math.sin(i * 0.6) * 5;
      // 천장
      const slab = T.mesh(L.box(halfW * 2 + 10, 3.2, segLen + 0.4), P.caveStone, 'matte');
      T.put(tunnel, slab, cx + wob, ceilY + Math.sin(i * 0.4) * 1.6, z);
      // 양쪽 벽
      for (const sx of [-1, 1]) {
        const wall = T.mesh(L.box(4.5, 20, segLen + 0.4), sx > 0 ? P.caveStone : P.darkStone, 'matte');
        T.put(tunnel, wall, cx + wob + sx * (halfW + 2), ceilY - 9, z);
      }
      // 종유석 / 석순
      if (i % 2 === 0) {
        const drip = T.dripstone(3 + (i % 3) * 1.6, false, P.caveStone);
        T.put(tunnel, drip, cx + wob + (rnd(i, 81) - 0.5) * 16, ceilY - 3.4, z);
        const stalag = T.dripstone(2.4 + (i % 4), true, P.darkStone);
        T.put(tunnel, stalag, cx + wob + (rnd(i, 82) - 0.5) * 18, floorY + 1.2, z + 3);
      }
      // 목재 지지대
      if (i % 4 === 1) {
        const sup = T.mineSupport(20, 13);
        T.put(tunnel, sup, cx + wob, floorY, z);
      }
      // 크리스탈
      if (i % 3 === 0) {
        const cr = T.crystal(0.9 + rnd(i, 83) * 0.9, i % 2 ? P.crystalCyan : P.crystalPurple);
        T.put(tunnel, cr, cx + wob + (rnd(i, 84) - 0.5) * 20, floorY, z + 2);
      }
    }
    group.add(tunnel);

    // ---- 끝방(큰 동굴): 크리스탈 군락 + 보스 자리
    const hallZ = mouthZ - 14 - segs * segLen - 24;
    const hall = new THREE.Group();
    const hallR = 34;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const wall = T.mesh(L.box(12, 26, 12), i % 2 ? P.caveStone : P.darkStone, 'matte');
      T.put(hall, wall, Math.cos(a) * hallR, 13, Math.sin(a) * hallR, 0, a, 0);
      colliders.push({ x: cx + Math.cos(a) * hallR, z: hallZ + Math.sin(a) * hallR, hx: 6, hz: 6 });
    }
    const dome = T.mesh(new THREE.ConeGeometry(hallR + 6, 20, 12), P.caveStone, 'matte');
    T.put(hall, dome, 0, 32, 0);
    for (let i = 0; i < 14; i++) {
      const a = rnd(i, 91) * Math.PI * 2, r = 8 + rnd(i, 92) * 26;
      const cr = T.crystal(1.2 + rnd(i, 93) * 1.6, i % 3 === 0 ? P.crystalPurple : P.crystalCyan);
      T.put(hall, cr, Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    for (let i = 0; i < 6; i++) {
      const drip = T.dripstone(6 + rnd(i, 94) * 5, false, P.caveStone);
      T.put(hall, drip, (rnd(i, 95) - 0.5) * 40, 24, (rnd(i, 96) - 0.5) * 40);
    }
    // 방 한가운데 거대 크리스탈 군락 + 빛나는 웅덩이(보스 자리)
    const bigCluster = new THREE.Group();
    // 가장자리에 둘러 세워 가운데(보스 싸움터)는 비워 둔다
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 13 + (i % 3) * 2.5;
      const cr = T.crystal(1.1 + (i % 3) * 0.5, i % 2 ? P.crystalPurple : P.crystalCyan);
      cr.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      cr.rotation.z = (i % 2 ? 0.14 : -0.12);
      bigCluster.add(cr);
    }
    const core = T.crystal(1.9, P.crystalCyan);
    core.position.set(0, 0, -20);
    bigCluster.add(core);
    T.put(hall, bigCluster, 0, 0.2, 0);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshPhongMaterial({
      color: 0x2f6f86, emissive: 0x1b4f5f, specular: 0xbfe8ff, shininess: 180,
      transparent: true, opacity: 0.72,
    }));
    pool.rotation.x = -Math.PI / 2;
    T.put(hall, pool, 0, 0.12, 0);
    // 벽을 따라 늘어선 광부 등불
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      T.put(hall, T.lantern(0xffb03a), Math.cos(a) * (hallR - 8), 0, Math.sin(a) * (hallR - 8));
    }

    hall.position.set(cx, floorY, hallZ);
    group.add(hall);
    spawns.push({ x: cx, z: hallZ, boss: true });

    // ---- 광산 소품: 레일 · 광차 · 상자 · 등불
    const railLen = segs * segLen;
    place(group, T.mineRail(railLen), cx, floorY, mouthZ - 14 - railLen / 2, 0);
    place(group, T.mineCart(), cx + 3, floorY, mouthZ - 40, 0.1, colliders, 2.4);
    place(group, T.mineCart(), cx - 4, floorY, hallZ + 30, 2.6, colliders, 2.4);
    for (let i = 0; i < 10; i++) {
      const z = mouthZ - 20 - rnd(i, 101) * railLen;
      const x = cx + (rnd(i, 102) - 0.5) * 20;
      place(group, i % 2 ? T.crate(0.9) : T.barrel(0.9), x, floorY, z, rnd(i, 103) * 3, colliders, 1.2);
    }
    for (let i = 0; i < 8; i++) {
      const z = mouthZ - 18 - i * (railLen / 8);
      const x = cx + (i % 2 ? 9 : -9);
      place(group, T.lantern(0xffb03a), x, floorY, z, 0, colliders, 0.5);
    }

    // ---- 협곡 바닥의 바위들
    for (let i = 0; i < 18; i++) {
      const a = rnd(i, 111) * Math.PI * 2, r = 20 + rnd(i, 112) * 90;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      place(group, T.rock(0.8 + rnd(i, 113) * 1.4, P.caveStone), x, h(x, z), z, rnd(i, 114) * 6, colliders, 2);
      if (i % 3 === 0) {
        const cr = T.crystal(0.8 + rnd(i, 115), i % 2 ? P.crystalCyan : P.crystalPurple);
        place(group, cr, x + 4, h(x + 4, z), z + 2, 0);
      }
      spawns.push({ x, z });
    }

    place(group, T.signPost('CRYSTAL CAVE', 15), cx, h(cx, cz + 104), cz + 104, Math.PI, colliders, 1);

    return {
      colliders, spawns,
      // 협곡 안은 어둡다. 갱도 안이면 더 어둡게(game.js 가 횃불을 켠다)
      ambience: { fog: 0x2a2f36, fogNear: 24, fogFar: 130, sun: 0.35, hemi: 0.3, sky: 0x3b4450, dark: true },
      tunnel: { x: cx, z0: hallZ - 40, z1: mouthZ, halfW: halfW + 6, floorY, ceilY },
    };
  }

  // ================================================================== 높은 산
  function buildMountain(group, ctx) {
    const colliders = [], spawns = [];
    const h = ctx.heightAt;
    const cx = ctx.region.cx, cz = ctx.region.cz;

    // 아래쪽 침엽수림 → 위로 갈수록 눈 덮인 나무
    for (let i = 0; i < 70; i++) {
      const a = rnd(i, 121) * Math.PI * 2;
      const r = 60 + rnd(i, 122) * 110;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = h(x, z);
      if (y > 52) continue;
      const tree = T.pineTree(0.9 + rnd(i, 123) * 0.8, y > 30);
      place(group, tree, x, y, z, rnd(i, 124) * 6, colliders, 1.8);
    }
    // 바위 · 눈바위
    for (let i = 0; i < 26; i++) {
      const a = rnd(i, 131) * Math.PI * 2, r = 24 + rnd(i, 132) * 130;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = h(x, z);
      place(group, y > 40 ? T.snowRock(1 + rnd(i, 133)) : T.rock(1 + rnd(i, 134), 0x77797a),
        x, y, z, rnd(i, 135) * 6, colliders, 2.2);
      spawns.push({ x, z });
    }
    // 얼음 크리스탈
    for (let i = 0; i < 14; i++) {
      const a = rnd(i, 141) * Math.PI * 2, r = 20 + rnd(i, 142) * 90;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      place(group, T.crystal(1.1 + rnd(i, 143), P.ice), x, h(x, z), z, rnd(i, 144) * 6);
    }
    // 등산로 깃발 (길을 따라 꽂아둔다 — 길 잃지 않게)
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const a = -1.9 + t * 4.6;
      const r = 120 - t * 96;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const pole = new THREE.Group();
      const stick = T.mesh(L.box(0.4, 7, 0.4), P.darkWood, 'matte');
      T.put(pole, stick, 0, 3.5, 0);
      const flag = T.mesh(L.box(0.2, 2.2, 3.2), i % 2 ? C.red : C.yellow);
      T.put(pole, flag, 0, 6.0, 1.7);
      place(group, pole, x, h(x, z), z, rnd(i, 151) * 6, colliders, 0.5);
    }
    // 나무다리 (갈라진 틈 위)
    const bridge = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const plank = T.mesh(L.box(8, 0.5, 2.4), P.plank, 'matte');
      T.put(bridge, plank, 0, 0, (i - 6.5) * 2.6);
    }
    for (const sx of [-1, 1]) {
      const rail = T.mesh(L.box(0.4, 0.4, 36), P.rottenWood, 'matte');
      T.put(bridge, rail, sx * 3.8, 2.4, 0);
      for (let i = 0; i < 6; i++) {
        const post = T.mesh(L.box(0.5, 2.6, 0.5), P.rottenWood, 'matte');
        T.put(bridge, post, sx * 3.8, 1.3, (i - 2.5) * 7);
      }
    }
    const bx = cx + 40, bz = cz + 46;
    place(group, bridge, bx, h(bx, bz) + 1.2, bz, 0.7);

    // 산길 중턱 망루 — 멀리서도 보이는 이정표
    const twX = cx + 78, twZ = cz + 34;
    place(group, T.watchtower(), twX, h(twX, twZ), twZ, 0.5, colliders, 5);

    // 야영지: 텐트 두 동 + 모닥불 + 짐
    const campX = cx + 30, campZ = cz + 92;
    place(group, T.tent(C.red), campX, h(campX, campZ), campZ, 0.3, colliders, 4, 5);
    place(group, T.tent(C.blue), campX + 12, h(campX + 12, campZ + 6), campZ + 6, -0.6, colliders, 4, 5);
    const camp = T.campfire();
    place(group, camp, campX + 6, h(campX + 6, campZ + 14), campZ + 14, 0, colliders, 2.4);
    for (let i = 0; i < 4; i++) {
      const x = campX + 2 + i * 3.5, z = campZ + 20;
      place(group, i % 2 ? T.crate(0.9) : T.barrel(0.9), x, h(x, z), z, rnd(i, 161) * 3, colliders, 1.2);
    }

    // 정상 얼음 사당
    const shrine = T.iceShrine();
    place(group, shrine, cx, h(cx, cz), cz, 0.4, colliders, 12);
    spawns.push({ x: cx + 18, z: cz + 4, boss: true });

    place(group, T.signPost('FROST PEAK', 14), cx - 6, h(cx - 6, cz + 128), cz + 128, Math.PI, colliders, 1);

    return {
      colliders, spawns, shrine, camp,
      ambience: { fog: 0xcfe3ef, fogNear: 60, fogFar: 280, sun: 1.25, hemi: 0.85, sky: 0xbcd8ea, snow: true },
    };
  }

  L.REGION_BUILDERS = {
    zombie: buildZombieVillage,
    swamp: buildSwamp,
    cave: buildCave,
    mount: buildMountain,
  };
})(window.LEGO);
