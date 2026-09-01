/* =========================================================================
 * enemies.js — 브릭 몬스터와 오픈월드 출현 관리
 *
 * 상대는 전부 "브릭으로 만든 것"이다. 브릭 좀비도 사람이 아니라
 * 낡은 브릭을 끼워 만든 인형이고, 쓰러지면 피 없이 브릭이 팝 하고 흩어진다.
 *
 *   들판/좀비 마을 : 브릭 슬라임 · 브릭 좀비
 *   늪지대         : 독 슬라임 · 도깨비불
 *   동굴 협곡      : 브릭 배트 · 브릭 골렘 · 크리스탈 골렘(+보스 크리스탈 왕)
 *   높은 산        : 얼음 골렘 · 브릭 배트 (+정상 보스 브릭 드래곤)
 *
 * 웨이브가 아니라 "지역에 정해진 수만큼 계속 살아 있게" 유지한다.
 * 플레이어에게서 멀어진 몬스터는 조용히 사라진다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;

  const TYPES = {
    slime: {
      name: '브릭 슬라임', hp: 46, speed: 13.5, radius: 2.4, damage: 1, color: C.brightGreen,
      attackRange: 4.6, attackCd: 1.4, flying: false, score: 60, studs: 1, pool: 14,
    },
    zombie: {
      name: '브릭 좀비', hp: 78, speed: 10.5, radius: 2.6, damage: 1, color: P.zombieSkin,
      attackRange: 5.0, attackCd: 1.6, flying: false, score: 95, studs: 1, pool: 16, bar: true,
    },
    toxic: {
      name: '독 슬라임', hp: 92, speed: 11.5, radius: 2.8, damage: 1, color: 0x7fbf3f,
      attackRange: 5.0, attackCd: 1.5, flying: false, score: 120, studs: 2, pool: 12, bar: true,
    },
    wisp: {
      name: '늪 도깨비불', hp: 52, speed: 21, radius: 1.9, damage: 1, color: 0x63d7e6,
      attackRange: 30, attackCd: 1.8, flying: true, hover: 9, score: 140, studs: 1, pool: 10,
      ranged: true, projectile: 34,
    },
    bat: {
      name: '브릭 배트', hp: 58, speed: 19, radius: 2.2, damage: 1, color: C.purple,
      attackRange: 5.4, attackCd: 1.5, flying: true, hover: 11.5, score: 110, studs: 1, pool: 12,
    },
    golem: {
      name: '브릭 골렘', hp: 190, speed: 8.2, radius: 3.6, damage: 1, color: C.darkGray,
      attackRange: 6.2, attackCd: 1.9, flying: false, score: 180, studs: 2, pool: 8, bar: true,
    },
    crystal: {
      name: '크리스탈 골렘', hp: 260, speed: 7.6, radius: 3.9, damage: 1, color: 0x63d7e6,
      attackRange: 6.6, attackCd: 2.0, flying: false, score: 260, studs: 3, pool: 8, bar: true,
    },
    ice: {
      name: '얼음 골렘', hp: 320, speed: 8.8, radius: 4.0, damage: 1, color: P.ice,
      attackRange: 6.8, attackCd: 1.8, flying: false, score: 320, studs: 3, pool: 8, bar: true,
    },
    ghost: {
      name: '브릭 유령', hp: 70, speed: 15, radius: 2.4, damage: 1, color: 0xdfe9ee,
      attackRange: 5.0, attackCd: 1.5, flying: true, hover: 5, score: 150, studs: 1, pool: 14,
    },
    flameghost: {
      name: '화염 귀신', hp: 120, speed: 14, radius: 2.6, damage: 1, color: 0xff5a10,
      attackRange: 30, attackCd: 1.7, flying: true, hover: 6, score: 260, studs: 2, pool: 10,
      ranged: true, projectile: 40, bar: true,
    },
    drone: {
      name: '경비 드론', hp: 95, speed: 20, radius: 2.2, damage: 1, color: 0x8f989c,
      attackRange: 34, attackCd: 1.4, flying: true, hover: 9, score: 200, studs: 1, pool: 14,
      ranged: true, projectile: 58,
    },
    radslime: {
      name: '방사능 슬라임', hp: 140, speed: 12, radius: 3.0, damage: 1, color: 0xa5ca18,
      attackRange: 5.2, attackCd: 1.5, flying: false, score: 220, studs: 2, pool: 12, bar: true,
    },
    sandgolem: {
      name: '모래 골렘', hp: 230, speed: 9, radius: 3.7, damage: 1, color: 0xd9c08a,
      attackRange: 6.4, attackCd: 1.9, flying: false, score: 250, studs: 2, pool: 10, bar: true,
    },
    dragon: {
      name: '브릭 드래곤', hp: 1400, speed: 12, radius: 6.5, damage: 2, color: C.red,
      attackRange: 46, attackCd: 1.25, flying: true, hover: 16, score: 2400, studs: 10,
      pool: 2, boss: true, bar: true, ranged: true, projectile: 52,
    },
  };

  // ------------------------------------------------------------------ 모델
  function buildSlime(tint) {
    const g = new THREE.Group();
    const base = L.plate(tint ? 0x4f8f2f : C.green, 4, 4, { height: 1.6 });
    base.position.y = 0.9;
    const mid = L.plate(tint ? 0x7fbf3f : C.brightGreen, 3, 3, { height: 1.5 });
    mid.position.y = 2.5;
    const top = L.plate(tint ? 0xa5ca18 : C.lime, 2, 2, { height: 1.2 });
    top.position.y = 3.8;
    base.castShadow = mid.castShadow = top.castShadow = true;
    g.add(base, mid, top);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.44, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(side * 0.85, 3.1, 1.5);
      const pupil = new THREE.Mesh(L.sph(0.22, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pupil.position.set(side * 0.85, 3.1, 1.85);
      g.add(eye, pupil);
      const arm = new THREE.Mesh(L.box(0.6, 1.4, 0.6), L.mat(tint ? 0x4f8f2f : C.green));
      arm.position.set(side * 2.4, 2.2, 0);
      arm.rotation.z = side * 0.4;
      g.add(arm);
    }
    const mouth = new THREE.Mesh(L.box(1.5, 0.35, 0.2), L.mat(0x123f22, 'matte'));
    mouth.position.set(0, 2.1, 1.6);
    g.add(mouth);
    if (tint) {
      // 독 거품
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(L.sph(0.45 + (i % 2) * 0.2, 8),
          new THREE.MeshPhongMaterial({ color: 0xa5ca18, transparent: true, opacity: 0.7 }));
        b.position.set(Math.cos(i * 1.6) * 1.6, 4.4 + (i % 2) * 0.8, Math.sin(i * 1.6) * 1.6);
        g.add(b);
      }
    }
    return { group: g, parts: { body: g } };
  }

  /** 브릭 좀비 — 낡은 브릭으로 끼워 만든 인형 (사람이 아니다) */
  function buildZombie() {
    const g = new THREE.Group();
    const skin = P.zombieSkin;
    // 다리 (한쪽이 짧아 절뚝인다)
    const hips = new THREE.Group();
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(L.box(1.5, 3.4, 1.6), L.mat(0x3f4a5a));
      leg.position.set(sx * 1.1, 1.7 + (sx > 0 ? 0.2 : 0), 0);
      leg.castShadow = true;
      hips.add(leg);
      const shoe = new THREE.Mesh(L.box(1.6, 0.6, 2.0), L.mat(0x2a2f36, 'matte'));
      shoe.position.set(sx * 1.1, 0.3, 0.25);
      hips.add(shoe);
    }
    // 몸통(찢어진 옷 + 드러난 브릭)
    const torso = new THREE.Mesh(L.cyl(2.1, 1.7, 3.4, 4), L.mat(0x4a5a3a));
    torso.rotation.y = Math.PI / 4;
    torso.scale.z = 0.62;
    torso.position.y = 5.2;
    torso.castShadow = true;
    const rip = new THREE.Mesh(L.box(1.6, 1.0, 0.2), L.mat(skin));
    rip.position.set(0.3, 4.6, 1.0);
    // 팔을 앞으로 뻗은 자세
    const arms = new THREE.Group();
    for (const sx of [-1, 1]) {
      const upper = new THREE.Mesh(L.box(0.9, 2.6, 0.95), L.mat(0x4a5a3a));
      upper.position.set(sx * 1.9, 5.6, 0.9);
      upper.rotation.x = -1.15;
      upper.castShadow = true;
      arms.add(upper);
      const hand = L.clawHand(skin);
      hand.scale.setScalar(1.15);
      hand.position.set(sx * 1.9, 5.9, 3.0);
      hand.rotation.set(Math.PI / 2, 0, sx * 0.3);
      arms.add(hand);
    }
    // 머리 (초록 미니피그 머리 + 빛나는 눈)
    const head = new THREE.Mesh(L.cyl(1.15, 1.15, 1.8, 12), L.mat(skin));
    head.position.y = 7.9;
    head.castShadow = true;
    const hair = new THREE.Mesh(L.box(2.5, 1.1, 2.5), L.mat(0x2f2a24, 'matte'));
    hair.position.y = 8.9;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      eye.position.set(sx * 0.42, 8.0, 1.05);
      g.add(eye);
    }
    const mouth = new THREE.Mesh(L.box(1.1, 0.28, 0.2), L.mat(0x2a1c10, 'matte'));
    mouth.position.set(0, 7.4, 1.12);
    // 몸에서 떨어져 나간 브릭 몇 개가 떠 있는 느낌
    g.add(hips, torso, rip, arms, head, hair, mouth);
    return { group: g, parts: { hips, arms, head } };
  }

  /** 도깨비불 — 빛나는 구슬 + 도는 브릭 조각 */
  function buildWisp() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(L.sph(1.2, 14), new THREE.MeshBasicMaterial({ color: 0xd8fbff }));
    const halo = new THREE.Mesh(L.sph(2.0, 14), new THREE.MeshPhongMaterial({
      color: 0x63d7e6, transparent: true, opacity: 0.45, emissive: 0x1b5f6a,
    }));
    const ring = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const shard = new THREE.Mesh(L.box(0.8, 0.5, 0.8), L.mat(0x9fe8ff));
      const a = (i / 5) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 3, Math.sin(a * 2) * 0.8, Math.sin(a) * 3);
      ring.add(shard);
    }
    g.add(core, halo, ring);
    return { group: g, parts: { ring, core } };
  }

  function golemBody(colorLow, colorHigh, spikes, spikeColor) {
    const g = new THREE.Group();
    const legs = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(L.box(1.9, 3.2, 2.0), L.mat(colorLow));
      leg.position.set(side * 1.5, 1.7, 0);
      leg.castShadow = true;
      legs.add(leg);
    }
    const torso = L.plate(colorLow, 7, 5, { height: 5.2 });
    torso.position.y = 6.0;
    torso.castShadow = true;
    const chest = L.plate(colorHigh, 5, 4, { height: 1.4 });
    chest.position.y = 8.9;
    const head = new THREE.Mesh(L.box(3.4, 2.8, 3.0), L.mat(colorLow));
    head.position.y = 10.6;
    head.castShadow = true;
    const arms = new THREE.Group();
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(L.box(1.7, 5.6, 1.9), L.mat(colorHigh));
      arm.position.set(side * 4.6, 6.4, 0);
      arm.castShadow = true;
      arms.add(arm);
      const fist = new THREE.Mesh(L.box(2.4, 2.2, 2.4), L.mat(colorLow));
      fist.position.set(side * 4.6, 3.4, 0);
      arms.add(fist);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.box(0.9, 0.55, 0.2), new THREE.MeshBasicMaterial({
        color: spikeColor === undefined ? 0xff7a18 : spikeColor,
      }));
      eye.position.set(side * 0.85, 10.9, 1.55);
      g.add(eye);
    }
    if (spikes) {
      const shellMat = new THREE.MeshPhongMaterial({
        color: spikeColor, specular: 0xffffff, shininess: 180, transparent: true, opacity: 0.62,
      });
      const spots = [[0, 9.6, -1.6, 1.0, 3.4, 0.2], [2.6, 7.4, -1.4, 0.7, 2.4, 0.6],
        [-2.4, 8.0, -1.5, 0.8, 2.8, -0.5], [0, 12.0, 0, 0.6, 2.2, 0]];
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i];
        const cone = new THREE.Mesh(new THREE.ConeGeometry(sp[3], sp[4], 6), shellMat);
        cone.position.set(sp[0], sp[1], sp[2]);
        cone.rotation.set(-0.4, i, sp[5]);
        g.add(cone);
        const core = new THREE.Mesh(new THREE.ConeGeometry(sp[3] * 0.4, sp[4] * 0.8, 6),
          new THREE.MeshBasicMaterial({ color: spikeColor }));
        core.position.copy(cone.position);
        core.rotation.copy(cone.rotation);
        g.add(core);
      }
    }
    g.add(legs, torso, chest, head, arms);
    return { group: g, parts: { legs, arms, head } };
  }

  function buildGolem() { return golemBody(C.darkGray, C.lightGray, false); }
  function buildCrystal() { return golemBody(0x4a5a5e, 0x6c7a7e, true, 0x63d7e6); }
  function buildIce() { return golemBody(0x9fc8d8, P.snow, true, 0xd8f4ff); }

  function buildBat() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(2.2, 2.0, 3.0), L.mat(C.purple));
    body.castShadow = true;
    const head = new THREE.Mesh(L.box(1.7, 1.5, 1.6), L.mat(C.magenta));
    head.position.set(0, 0.5, 1.9);
    const wings = new THREE.Group();
    const wingL = new THREE.Mesh(L.box(4.2, 0.32, 2.4), L.mat(C.purple));
    wingL.position.set(-2.8, 0.6, 0);
    const wingR = wingL.clone();
    wingR.position.x = 2.8;
    wings.add(wingL, wingR);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.3, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      eye.position.set(side * 0.55, 0.7, 2.6);
      g.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 5), L.mat(C.magenta));
      ear.position.set(side * 0.7, 1.7, 1.7);
      g.add(ear);
    }
    const tail = new THREE.Mesh(L.box(0.5, 0.5, 2.2), L.mat(C.purple));
    tail.position.set(0, 0, -2.2);
    g.add(body, head, wings, tail);
    return { group: g, parts: { wings, wingL, wingR } };
  }

  function buildDragon() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(6.0, 5.0, 11.0), L.mat(C.red));
    body.castShadow = true;
    const belly = L.plate(C.orange, 4, 8, { height: 1.2 });
    belly.position.y = -2.4;
    const neck = new THREE.Mesh(L.box(3.2, 3.0, 5.0), L.mat(C.red));
    neck.position.set(0, 2.4, 6.4);
    neck.rotation.x = 0.35;
    const head = new THREE.Group();
    const skull = new THREE.Mesh(L.box(3.4, 2.8, 4.6), L.mat(C.red));
    const snout = new THREE.Mesh(L.box(2.2, 1.6, 2.4), L.mat(C.darkRed));
    snout.position.set(0, -0.5, 3.2);
    const maw = new THREE.Mesh(L.sph(1.1, 10), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
    maw.position.set(0, -0.5, 4.6);
    head.add(skull, snout, maw);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), L.mat(C.gold, 'metal'));
      horn.position.set(side * 1.2, 2.0, -0.8);
      horn.rotation.set(-0.5, 0, side * 0.4);
      head.add(horn);
      const eye = new THREE.Mesh(L.sph(0.42, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
      eye.position.set(side * 1.3, 0.6, 1.9);
      head.add(eye);
    }
    head.position.set(0, 4.3, 10.6);
    const wings = new THREE.Group();
    const wingGeo = L.box(13.0, 0.5, 7.0);
    const wingL = new THREE.Mesh(wingGeo, L.mat(C.darkRed));
    wingL.position.set(-9.0, 2.4, -0.5);
    const wingR = new THREE.Mesh(wingGeo, L.mat(C.darkRed));
    wingR.position.set(9.0, 2.4, -0.5);
    wingL.castShadow = wingR.castShadow = true;
    wings.add(wingL, wingR);
    const tail = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(L.box(3.0 - i * 0.6, 2.4 - i * 0.45, 3.4), L.mat(i % 2 ? C.darkRed : C.red));
      seg.position.set(0, -i * 0.5, -6.5 - i * 3.1);
      tail.add(seg);
    }
    const spikes = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 5), L.mat(C.gold, 'metal'));
      sp.position.set(0, 2.8 - i * 0.15, 3.0 - i * 2.6);
      spikes.add(sp);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(L.box(1.8, 3.0, 2.0), L.mat(C.darkRed));
      leg.position.set(side * 2.4, -3.4, 2.6);
      g.add(leg);
      const claw = new THREE.Mesh(L.box(2.2, 0.8, 2.6), L.mat(C.gold, 'metal'));
      claw.position.set(side * 2.4, -4.8, 3.2);
      g.add(claw);
    }
    g.add(body, belly, neck, head, wings, tail, spikes);
    return { group: g, parts: { wings, wingL, wingR, head, maw, tail } };
  }

  /** 브릭 유령 — 반투명 브릭 인형이 떠 있다(사람이 아니라 천을 씌운 브릭 덩어리) */
  function buildGhost(fire) {
    const g = new THREE.Group();
    const shell = new THREE.MeshPhongMaterial({
      color: fire ? 0xff7a3a : 0xeaf2f6, emissive: fire ? 0x8a2a08 : 0x2a3540,
      transparent: true, opacity: 0.72, specular: 0xffffff, shininess: 120,
    });
    const head = new THREE.Mesh(L.sph(2.0, 14), shell);
    head.position.y = 3.4;
    const body = new THREE.Mesh(L.cyl(1.9, 2.4, 3.4, 12), shell);
    body.position.y = 1.4;
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.6, 10), shell);
    skirt.position.y = -0.6;
    skirt.rotation.x = Math.PI;
    g.add(head, body, skirt);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(L.box(0.9, 2.4, 0.9), shell);
      arm.position.set(side * 2.3, 2.2, 0.4);
      arm.rotation.z = side * 0.5;
      g.add(arm);
      const eye = new THREE.Mesh(L.sph(0.42, 8), new THREE.MeshBasicMaterial({
        color: fire ? 0xffd166 : 0x63d7e6,
      }));
      eye.position.set(side * 0.66, 3.7, 1.7);
      g.add(eye);
    }
    const mouth = new THREE.Mesh(L.box(1.0, 0.6, 0.2), new THREE.MeshBasicMaterial({
      color: fire ? 0xffd166 : 0x63d7e6,
    }));
    mouth.position.set(0, 2.9, 1.85);
    g.add(mouth);
    const crown = new THREE.Group();
    if (fire) {
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8 + (i % 2) * 0.8, 5),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffc23a : 0xff5a10 }));
        f.position.set(Math.cos(i * 1.3) * 1.2, 5.2, Math.sin(i * 1.3) * 1.2);
        crown.add(f);
      }
      g.add(crown);
    }
    return { group: g, parts: { crown, body } };
  }

  /** 경비 드론 — 시설을 지키는 기계 (생물이 아니다) */
  function buildDrone() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(L.box(3.0, 1.6, 3.0), L.mat(0x8f989c, 'metal'));
    body.castShadow = true;
    const dome = new THREE.Mesh(L.sph(1.5, 12), L.mat(0x2c5f86, 'glass'));
    dome.position.y = 0.9;
    const eye = new THREE.Mesh(L.cyl(0.6, 0.6, 0.4, 10), new THREE.MeshBasicMaterial({ color: 0xff3b1a }));
    eye.rotation.x = Math.PI / 2;
    eye.position.set(0, 0.1, 1.6);
    const rotors = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.78;
      const arm = new THREE.Mesh(L.box(2.6, 0.4, 0.5), L.mat(0x6f7579, 'metal'));
      arm.position.set(Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9);
      arm.rotation.y = -a;
      g.add(arm);
      const rotor = new THREE.Mesh(L.box(3.2, 0.12, 0.5), L.mat(0xa3a8ac, 'metal'));
      rotor.position.set(Math.cos(a) * 3.1, 0.9, Math.sin(a) * 3.1);
      rotors.add(rotor);
      const hub = new THREE.Mesh(L.cyl(0.35, 0.35, 0.5, 8), L.mat(0x6f7579, 'metal'));
      hub.position.set(Math.cos(a) * 3.1, 0.75, Math.sin(a) * 3.1);
      g.add(hub);
    }
    const light = new THREE.Mesh(L.box(0.6, 0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0xf2cd37 }));
    light.position.set(0, -0.9, 0);
    g.add(body, dome, eye, rotors, light);
    return { group: g, parts: { rotors, eye } };
  }

  /** 모래 골렘 — 사막·피라미드의 파수꾼 */
  function buildSandGolem() {
    const built = golemBody(0xc9ad78, 0xe4cd9e, false, 0xffd166);
    // 몸에 박힌 금빛 조각
    for (let i = 0; i < 3; i++) {
      const gem = new THREE.Mesh(L.box(0.8, 0.8, 0.4), L.mat(C.gold, 'metal'));
      gem.position.set(-1.4 + i * 1.4, 6.6 + (i % 2) * 1.2, 2.6);
      built.group.add(gem);
    }
    return built;
  }

  const BUILDERS = {
    slime: () => buildSlime(false),
    toxic: () => buildSlime(true),
    zombie: buildZombie,
    wisp: buildWisp,
    bat: buildBat,
    golem: buildGolem,
    crystal: buildCrystal,
    ice: buildIce,
    ghost: () => buildGhost(false),
    flameghost: () => buildGhost(true),
    drone: buildDrone,
    radslime: () => buildSlime(true),
    sandgolem: buildSandGolem,
    dragon: buildDragon,
  };

  // ------------------------------------------------------------------ 체력바
  function hpBar() {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.16), new THREE.MeshBasicMaterial({
      color: 0x1b2a34, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({
      color: 0x4bd44b, side: THREE.DoubleSide,
    }));
    fill.position.z = 0.02;
    g.add(back, fill);
    g.userData.fill = fill;
    return g;
  }

  // ------------------------------------------------------------------ 관리자
  function Enemies(scene, fx, world) {
    this.scene = scene;
    this.fx = fx;
    this.world = world;
    this.list = [];
    this.hooks = { hitPlayer: null, onKill: null };
    this.spawnTimer = 1.5;
    this.boss = null;
    this.bossCooldown = {};
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._spawnPos = new THREE.Vector3();

    for (const id in TYPES) {
      const t = TYPES[id];
      for (let i = 0; i < t.pool; i++) {
        const built = BUILDERS[id]();
        built.group.visible = false;
        scene.add(built.group);
        let bar = null;
        if (t.bar) {
          bar = hpBar();
          bar.visible = false;
          bar.scale.set(t.radius * 2.2, t.radius * 2.2, 1);
          scene.add(bar);
        }
        this.list.push({
          alive: false, type: id, def: t, group: built.group, parts: built.parts, bar,
          hp: t.hp, maxHp: t.hp, pos: new THREE.Vector3(), speed: t.speed, radius: t.radius,
          color: t.color, phase: Math.random() * 6.28, attackTimer: 0, hurt: 0, stagger: 0, slow: 0,
          y0: 0, isBoss: false, region: null,
        });
      }
    }
  }

  Enemies.prototype.aliveCount = function () {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].alive) n++;
    return n;
  };

  Enemies.prototype._free = function (type) {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive && e.type === type) return e;
    }
    return null;
  };

  /** 지정한 자리에 한 마리 내보낸다 */
  Enemies.prototype.spawnAt = function (type, pos, o) {
    o = o || {};
    const e = this._free(type);
    if (!e) return null;
    const t = e.def;
    const lvl = o.level || 1;
    const scale = o.scale || 1;
    e.alive = true;
    e.isBoss = !!o.boss;
    e.region = o.region || null;
    e.maxHp = Math.round(t.hp * (1 + (lvl - 1) * 0.45) * (o.hpMul || 1));
    e.hp = e.maxHp;
    e.radius = t.radius * scale;
    e.speed = t.speed * (o.speedMul || 1);
    e.attackTimer = 0.8;
    e.hurt = 0;
    e.stagger = 0;
    e.slow = 0;
    e.phase = Math.random() * 6.28;
    e.pos.copy(pos);
    e.y0 = t.flying ? (t.hover || 10) : 0;
    if (t.flying) e.pos.y += e.y0;
    e.group.position.copy(e.pos);
    e.group.scale.setScalar(scale);
    e.baseScale = scale;
    e.group.visible = true;
    if (e.bar) {
      e.bar.visible = true;
      e.bar.scale.set(e.radius * 2.2, e.radius * 2.2, 1);
    }
    if (e.isBoss) this.boss = e;
    return e;
  };

  /** 지역 정원을 유지한다 (웨이브 없음 — 사냥터에 계속 돌아다닌다) */
  Enemies.prototype.updateSpawning = function (dt, playerPos, region) {
    if (!region || !region.spawn || region.safe) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 0.85;
    let inRegion = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive && !e.isBoss && e.region === region.id) inRegion++;
    }
    if (inRegion >= region.spawn.max) return;
    const pos = this.world.pickSpawn(playerPos.x, playerPos.z, region, this._spawnPos);
    if (!pos) return;
    const type = this.world.pickType(region);
    this.spawnAt(type, pos, { level: region.level || 1, region: region.id });
  };

  /** 사냥터에 막 들어섰을 때 몇 마리를 바로 풀어 준다(텅 빈 채로 기다리지 않게) */
  Enemies.prototype.seedRegion = function (playerPos, region, count) {
    if (!region || !region.spawn || region.safe) return 0;
    let made = 0;
    for (let i = 0; i < (count || 4); i++) {
      const pos = this.world.pickSpawn(playerPos.x, playerPos.z, region, this._spawnPos);
      if (!pos) continue;
      const e = this.spawnAt(this.world.pickType(region), pos, {
        level: region.level || 1, region: region.id,
      });
      if (e) made++;
    }
    this.spawnTimer = 1.2;
    return made;
  };

  /** 보스: 정해진 자리에 다가가면 나타난다(잡으면 한동안 안 나온다) */
  Enemies.prototype.updateBoss = function (dt, playerPos, region, content) {
    for (const id in this.bossCooldown) {
      if (this.bossCooldown[id] > 0) this.bossCooldown[id] -= dt;
    }
    if (!region || region.safe || !content || !content.data || !content.data.spawns) return;
    if (this.boss && this.boss.alive) return;
    if ((this.bossCooldown[region.id] || 0) > 0) return;
    const spawns = content.data.spawns;
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i];
      if (!s.boss) continue;
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      if (d > 70) continue;
      const y = this.world.heightAt(s.x, s.z);
      const def = region.boss || { type: 'crystal', name: '보스', scale: 2, hpMul: 5, speedMul: 0.8 };
      const boss = this.spawnAt(def.type, this._spawnPos.set(s.x, y, s.z), {
        boss: true, level: (region.level || 1) + 1, region: region.id,
        scale: def.scale, hpMul: def.hpMul, speedMul: def.speedMul,
      });
      if (boss) {
        boss.bossName = def.name;
        this.bossCooldown[region.id] = 150;
      }
      return;
    }
  };

  Enemies.prototype.hitTest = function (pos, r) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const dy = (e.pos.y + e.radius * 0.7) - pos.y;
      const d = Math.sqrt(dx * dx + dy * dy * 0.7 + dz * dz);
      if (d < e.radius + r && d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  Enemies.prototype.damageArea = function (pos, radius, dmg) {
    let hits = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, dy = e.pos.y - pos.y;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < radius + e.radius) {
        const falloff = 1 - Math.min(0.65, d / (radius + e.radius) * 0.65);
        this.damage(e, dmg * falloff, pos);
        hits++;
      }
    }
    return hits;
  };

  Enemies.prototype.damageCone = function (origin, dir, range, cosLimit, dmg) {
    let hits = 0;
    const v = this._v;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      v.set(e.pos.x - origin.x, (e.pos.y + e.radius * 0.5) - origin.y, e.pos.z - origin.z);
      const d = v.length();
      if (d > range + e.radius) continue;
      v.divideScalar(d || 1);
      if (v.dot(dir) >= cosLimit) {
        this.damage(e, dmg, e.pos);
        hits++;
      }
    }
    return hits;
  };

  /** 범위 안 몬스터를 한동안 느리게 (아이스 스톰) */
  Enemies.prototype.slowArea = function (pos, radius, seconds) {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      if (e.pos.distanceTo(pos) < radius + e.radius) {
        e.slow = Math.max(e.slow, seconds);
        n++;
      }
    }
    return n;
  };

  Enemies.prototype.damage = function (e, dmg, from) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.hurt = 0.16;
    if (from) {
      this._v2.set(e.pos.x - from.x, 0, e.pos.z - from.z);
      if (this._v2.lengthSq() > 0.001) {
        this._v2.normalize().multiplyScalar(e.isBoss ? 0.25 : 1.1);
        e.pos.add(this._v2);
      }
      e.stagger = e.isBoss ? 0.05 : 0.18;
    }
    if (e.hp <= 0) this.kill(e);
  };

  Enemies.prototype.kill = function (e) {
    e.alive = false;
    e.group.visible = false;
    if (e.bar) e.bar.visible = false;
    if (this.boss === e) this.boss = null;
    this.fx.debrisBurst(e.pos, e.color, e.isBoss ? 40 : 10, e.isBoss ? 40 : 16);
    this.fx.explode(e.pos, e.isBoss ? 22 : e.radius * 2.2, 0xffd166, 0);
    const studs = e.def.studs * (e.isBoss ? 3 : 1);
    for (let i = 0; i < studs; i++) this.fx.dropStud(e.pos, i % 3 === 2 ? 'ammo' : 'mana');
    if (e.isBoss || Math.random() < 0.07) this.fx.dropStud(e.pos, 'heart');
    if (this.hooks.onKill) this.hooks.onKill(e);
  };

  /** 조용히 사라지기(너무 멀어졌을 때) */
  Enemies.prototype.despawn = function (e) {
    e.alive = false;
    e.group.visible = false;
    if (e.bar) e.bar.visible = false;
    if (this.boss === e) this.boss = null;
  };

  Enemies.prototype.update = function (dt, playerPos, camera) {
    const v = this._v;
    const world = this.world;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) continue;
      const t = e.def;
      e.phase += dt;
      if (e.hurt > 0) e.hurt -= dt;
      if (e.stagger > 0) e.stagger -= dt;
      if (e.slow > 0) e.slow -= dt;

      v.set(playerPos.x - e.pos.x, 0, playerPos.z - e.pos.z);
      const dist = v.length();
      // 너무 멀어지면 사라진다(오픈월드라 계속 쌓이면 안 된다)
      if (dist > 230 && !e.isBoss) { this.despawn(e); continue; }
      if (e.isBoss && dist > 320) { this.despawn(e); this.bossCooldown[e.region] = 20; continue; }
      v.divideScalar(dist || 1);

      const inRange = dist < t.attackRange + 1;
      if (!inRange && e.stagger <= 0) {
        const chill = e.slow > 0 ? 0.35 : 1;          // 얼어붙으면 느려진다
        const sp = e.speed * chill * (t.boss ? (0.7 + Math.sin(e.phase * 0.6) * 0.25) : 1);
        e.pos.x += v.x * sp * dt;
        e.pos.z += v.z * sp * dt;
      }
      if (t.ranged && dist < 26) {
        e.pos.x -= v.x * e.speed * 0.6 * dt;
        e.pos.z -= v.z * e.speed * 0.6 * dt;
        e.pos.x += -v.z * e.speed * 0.5 * dt;
        e.pos.z += v.x * e.speed * 0.5 * dt;
      }

      // ---- 지형을 따라 서고, 나는 놈은 지형 위 일정 높이로
      const ground = world.heightAt(e.pos.x, e.pos.z);
      if (t.flying) {
        e.pos.y = ground + e.y0 + Math.sin(e.phase * (t.boss ? 1.2 : 3.0)) * (t.boss ? 2.2 : 1.3);
        const w = e.parts.wingL, w2 = e.parts.wingR;
        if (w && w2) {
          const flap = Math.sin(e.phase * (t.boss ? 3.2 : 12)) * (t.boss ? 0.5 : 0.8);
          w.rotation.z = flap;
          w2.rotation.z = -flap;
        }
        if (e.parts.ring) {
          e.parts.ring.rotation.y += dt * 2.4;
          e.parts.ring.rotation.x = Math.sin(e.phase) * 0.4;
        }
        if (e.parts.rotors) e.parts.rotors.rotation.y += dt * 24;      // 드론 날개
        if (e.parts.crown) e.parts.crown.rotation.y += dt * 3;         // 화염 귀신 불꽃
        if (e.type === 'ghost' || e.type === 'flameghost') {
          // 유령은 스르르 오르내리며 몸이 늘었다 줄었다 한다
          e.group.scale.set(
            e.baseScale * (1 + Math.sin(e.phase * 2.2) * 0.06),
            e.baseScale * (1 - Math.sin(e.phase * 2.2) * 0.08),
            e.baseScale * (1 + Math.sin(e.phase * 2.2) * 0.06));
        }
        if (t.boss && e.parts.maw) e.parts.maw.scale.setScalar(1 + Math.sin(e.phase * 9) * 0.12);
      } else if (e.type === 'slime' || e.type === 'toxic' || e.type === 'radslime') {
        const hop = Math.abs(Math.sin(e.phase * 4.6));
        e.pos.y = ground + hop * 2.1;
        e.group.scale.set(
          e.baseScale * (1 + hop * 0.12),
          e.baseScale * (1 - hop * 0.18),
          e.baseScale * (1 + hop * 0.12));
      } else {
        e.pos.y = ground;
        const sw = Math.sin(e.phase * (e.type === 'zombie' ? 2.6 : 3.4));
        if (e.parts.legs) e.parts.legs.rotation.x = sw * 0.12;
        if (e.parts.hips) e.parts.hips.rotation.x = sw * 0.16;
        if (e.parts.arms) e.parts.arms.rotation.x = e.type === 'zombie' ? sw * 0.12 : -sw * 0.35;
        if (e.parts.head) e.parts.head.rotation.y = sw * 0.16;
      }

      e.group.position.copy(e.pos);
      e.group.rotation.y = Math.atan2(playerPos.x - e.pos.x, playerPos.z - e.pos.z);
      if (e.slow > 0 && !e.chilled) {
        e.chilled = true;
        e.group.traverse((o) => {
          if (o.isMesh && o.material && o.material.color && !o.userData._c0) {
            o.userData._c0 = o.material.color.getHex();
            o.material = o.material.clone();
            o.material.color.lerp(new THREE.Color(0x9fe8ff), 0.55);
          }
        });
      }
      const selfScaled = (e.type === 'slime' || e.type === 'toxic' || e.type === 'radslime'
        || e.type === 'ghost' || e.type === 'flameghost');
      if (!selfScaled) {
        const hurtScale = e.hurt > 0 ? 1 + e.hurt * 1.2 : 1;
        e.group.scale.setScalar(e.baseScale * hurtScale);
      }

      // ---- 공격
      e.attackTimer -= dt;
      if (dist < t.attackRange && e.attackTimer <= 0) {
        e.attackTimer = t.attackCd;
        if (t.ranged) {
          v.set(playerPos.x - e.pos.x, (playerPos.y - 1) - (e.pos.y + 3), playerPos.z - e.pos.z).normalize();
          this._v2.copy(e.pos);
          this._v2.y += 3;
          this.fx.shoot('enemyfire', this._v2, v, {
            speed: t.projectile || 40, dmg: t.damage, owner: 'enemy', life: 4,
          });
        } else if (this.hooks.hitPlayer) {
          this.hooks.hitPlayer(t.damage, e.pos);
        }
      }

      if (e.bar) {
        e.bar.position.set(e.pos.x, e.pos.y + e.radius * (e.isBoss ? 2.6 : 2.4) + 2, e.pos.z);
        e.bar.lookAt(camera.position);
        const r = Math.max(0, e.hp / e.maxHp);
        e.bar.userData.fill.scale.x = r;
        e.bar.userData.fill.position.x = -(1 - r) * 0.5;
        e.bar.userData.fill.material.color.setHex(r > 0.5 ? 0x4bd44b : (r > 0.25 ? 0xf2cd37 : 0xc91a09));
      }
    }
  };

  /** 근처에 살아있는 몬스터 수 (HUD 표시용) */
  Enemies.prototype.nearbyCount = function (pos, radius) {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive && e.pos.distanceTo(pos) < radius) n++;
    }
    return n;
  };

  Enemies.prototype.clear = function () {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      e.alive = false;
      e.group.visible = false;
      if (e.bar) e.bar.visible = false;
    }
    this.boss = null;
    this.bossCooldown = {};
  };

  L.ENEMY_TYPES = TYPES;
  L.Enemies = Enemies;
})(window.LEGO);
