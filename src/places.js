/* =========================================================================
 * places.js — 사냥터를 짓는 데 쓰는 공용 브릭 부품들
 *
 * 전부 순수 팩토리다(씬에 직접 넣지 않는다). regions.js 가 이걸 조합해
 * 좀비 마을·늪 폐가·동굴 협곡·높은 산을 짓는다.
 * 색은 bricks.js 팔레트만 쓰고, 형태는 실제 레고 부품처럼 각지게 만든다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  // 지역 소품에 자주 쓰는 추가 색(팔레트 확장 — 여기서만 정의한다)
  const P = {
    rottenWood: 0x5a4632,
    darkWood: 0x3f3227,
    plank: 0x7a5c3a,
    mossGreen: 0x54703f,
    swampGreen: 0x38512f,
    swampWater: 0x2f4a35,
    bone: 0xe8e0c8,
    stone: 0x6c6e68,
    darkStone: 0x4a4c48,
    caveStone: 0x3a3d40,
    crystalCyan: 0x63d7e6,
    crystalPurple: 0x9a63e6,
    ice: 0xb8e4f0,
    snow: 0xf2f6f8,
    pine: 0x1f5b34,
    pineDark: 0x17452a,
    zombieSkin: 0x6f9c4a,
    rust: 0x8a4a20,
  };

  function mesh(geo, color, finish, opts) {
    const m = new THREE.Mesh(geo, L.mat(color, finish));
    if (!opts || opts.shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }

  function put(parent, m, x, y, z, rx, ry, rz) {
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------ 나무들
  /** 죽은 나무 — 잎 없이 뒤틀린 가지 (좀비 마을·늪) */
  function deadTree(scale, seed) {
    const s = scale || 1;
    const g = new THREE.Group();
    const trunk = mesh(L.cyl(0.6 * s, 0.95 * s, 8 * s, 8), P.rottenWood, 'matte');
    put(g, trunk, 0, 4 * s, 0);
    const rnd = (i) => ((Math.sin((seed || 1) * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
    const branches = 5;
    for (let i = 0; i < branches; i++) {
      const a = rnd(i) * Math.PI * 2;
      const len = (2.6 + rnd(i + 9) * 2.4) * s;
      const y = (5 + rnd(i + 3) * 3) * s;
      const br = mesh(L.cyl(0.16 * s, 0.34 * s, len, 6), P.rottenWood, 'matte');
      put(g, br, Math.cos(a) * len * 0.4, y, Math.sin(a) * len * 0.4,
        0.9 * Math.sin(a), 0, -0.9 * Math.cos(a));
      // 잔가지
      const tw = mesh(L.cyl(0.09 * s, 0.16 * s, len * 0.6, 5), P.rottenWood, 'matte');
      put(g, tw, Math.cos(a) * len * 0.75, y + len * 0.35, Math.sin(a) * len * 0.75,
        0.4 * Math.sin(a + 1), 0, -0.4 * Math.cos(a + 1));
    }
    return g;
  }

  /** 침엽수 — 산 아래쪽 숲 (눈 덮인 버전도) */
  function pineTree(scale, snowy) {
    const s = scale || 1;
    const g = new THREE.Group();
    const trunk = mesh(L.cyl(0.55 * s, 0.75 * s, 4.5 * s, 8), C.brown, 'matte');
    put(g, trunk, 0, 2.2 * s, 0);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const r = (4.2 - t * 2.9) * s;
      const h = (3.4 - t * 0.9) * s;
      const cone = mesh(new THREE.ConeGeometry(r, h, 7), i % 2 ? P.pine : P.pineDark, 'matte');
      put(g, cone, 0, (4.2 + i * 2.5) * s, 0, 0, i * 0.5, 0);
      if (snowy) {
        const cap = mesh(new THREE.ConeGeometry(r * 0.72, h * 0.45, 7), P.snow, 'matte');
        put(g, cap, 0, (4.2 + i * 2.5 + h * 0.34) * s, 0, 0, i * 0.5, 0);
      }
    }
    const top = mesh(new THREE.ConeGeometry(0.9 * s, 2.2 * s, 6), snowy ? P.snow : P.pine, 'matte');
    put(g, top, 0, (4.2 + tiers * 2.5) * s, 0);
    return g;
  }

  /** 바위 덩어리 — 브릭을 어긋나게 쌓은 느낌 */
  function rock(scale, color) {
    const s = scale || 1;
    const g = new THREE.Group();
    const col = color === undefined ? P.stone : color;
    const blocks = [
      [0, 0.9, 0, 3.4, 1.8, 3.0, 0.0],
      [0.9, 2.1, -0.4, 2.6, 1.4, 2.2, 0.5],
      [-0.7, 2.6, 0.6, 1.8, 1.2, 1.6, 1.1],
      [0.3, 3.4, 0.1, 1.2, 0.9, 1.1, 0.3],
    ];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const m = mesh(L.box(b[3] * s, b[4] * s, b[5] * s), i % 2 ? col : (col === P.stone ? P.darkStone : col), 'matte');
      put(g, m, b[0] * s, b[1] * s, b[2] * s, 0, b[6], 0);
    }
    return g;
  }

  /** 빛나는 크리스탈 — 동굴/산 (투명 + 자체발광 코어) */
  function crystal(scale, color) {
    const s = scale || 1;
    const col = color === undefined ? P.crystalCyan : color;
    const g = new THREE.Group();
    const shellMat = new THREE.MeshPhongMaterial({
      color: col, specular: 0xffffff, shininess: 200,
      transparent: true, opacity: 0.55,
    });
    const spikes = [[0, 0, 0, 1.0, 4.2], [0.9, 0, 0.5, 0.6, 2.8], [-0.8, 0, 0.4, 0.5, 2.2], [0.2, 0, -0.9, 0.55, 3.0]];
    for (let i = 0; i < spikes.length; i++) {
      const sp = spikes[i];
      const shell = new THREE.Mesh(new THREE.ConeGeometry(sp[3] * s, sp[4] * s, 6), shellMat);
      shell.castShadow = false;
      put(g, shell, sp[0] * s, sp[4] * s * 0.5, sp[2] * s, (i % 2 ? 0.12 : -0.1), i * 0.7, (i % 3 ? 0.1 : -0.14));
      const core = new THREE.Mesh(new THREE.ConeGeometry(sp[3] * 0.45 * s, sp[4] * 0.8 * s, 6),
        new THREE.MeshBasicMaterial({ color: col }));
      put(g, core, sp[0] * s, sp[4] * s * 0.5, sp[2] * s, (i % 2 ? 0.12 : -0.1), i * 0.7, (i % 3 ? 0.1 : -0.14));
    }
    return g;
  }

  /** 종유석(천장) / 석순(바닥) */
  function dripstone(len, up, color) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(len * 0.26, len, 6),
      L.mat(color === undefined ? P.caveStone : color, 'matte'));
    cone.rotation.x = up ? 0 : Math.PI;
    cone.castShadow = true;
    return cone;
  }

  /** 버섯 — 늪/동굴 장식 */
  function mushroom(scale, capColor) {
    const s = scale || 1;
    const g = new THREE.Group();
    const stem = mesh(L.cyl(0.35 * s, 0.5 * s, 2.2 * s, 8), C.tan, 'matte');
    put(g, stem, 0, 1.1 * s, 0);
    const cap = mesh(new THREE.SphereGeometry(1.6 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      capColor === undefined ? C.red : capColor, 'plastic');
    put(g, cap, 0, 2.2 * s, 0);
    for (let i = 0; i < 4; i++) {
      const dot = mesh(L.cyl(0.22 * s, 0.22 * s, 0.1 * s, 8), C.white);
      const a = i * 1.6;
      put(g, dot, Math.cos(a) * 0.8 * s, 2.72 * s, Math.sin(a) * 0.8 * s);
    }
    return g;
  }

  // ------------------------------------------------------------------ 집 부품
  /**
   * 판자 벽 한 장. 안쪽에 어두운 속벽을 대서 널 사이로 하늘이 보이지 않게 한다.
   * ruin=true 면 널 몇 장이 떨어져 나가 구멍이 생긴다.
   */
  function plankWall(w, h, d, color, ruin) {
    const g = new THREE.Group();
    // 속벽(어두운 판) — 집 안이 비어 보이게
    const inner = mesh(L.box(w * 0.98, h, d * 0.55), 0x1d2126, 'matte', { shadow: false });
    put(g, inner, 0, 0, -d * 0.28);
    const rows = Math.max(3, Math.round(h / 1.15));
    const rowH = h / rows;
    for (let i = 0; i < rows; i++) {
      const missing = ruin && ((i * 7 + Math.round(w)) % 6 === 0);
      if (missing) continue;
      const plank = mesh(L.box(w, rowH * 0.99, d), i % 2 ? color : mixWood(color), 'matte');
      put(g, plank, 0, (i + 0.5) * rowH - h / 2, ((i % 2) - 0.5) * d * 0.1);
      // 못 자국
      if (i % 2 === 0) {
        const nail = mesh(L.box(0.16, 0.16, 0.1), 0x2a2f36, 'matte', { shadow: false });
        put(g, nail, -w * 0.42, (i + 0.5) * rowH - h / 2, d * 0.55);
        const nail2 = mesh(L.box(0.16, 0.16, 0.1), 0x2a2f36, 'matte', { shadow: false });
        put(g, nail2, w * 0.42, (i + 0.5) * rowH - h / 2, d * 0.55);
      }
    }
    return g;
  }

  /** 널 색을 한 톤 어둡게 섞어 나뭇결처럼 보이게 */
  function mixWood(color) {
    if (color === P.plank) return P.rottenWood;
    if (color === P.rottenWood) return P.darkWood;
    if (color === P.darkWood) return P.rottenWood;
    return color;
  }

  /** 판자로 막은 창문 */
  function boardedWindow(w, h) {
    const g = new THREE.Group();
    const hole = mesh(L.box(w, h, 0.3), 0x14181c, 'matte', { shadow: false });
    put(g, hole, 0, 0, 0);
    const frame = mesh(L.box(w + 0.5, h + 0.5, 0.22), P.darkWood, 'matte');
    put(g, frame, 0, 0, -0.06);
    for (let i = 0; i < 2; i++) {
      const board = mesh(L.box(w + 1.2, 0.55, 0.2), P.plank, 'matte');
      put(g, board, 0, (i - 0.5) * h * 0.55, 0.2, 0, 0, i ? 0.18 : -0.14);
    }
    return g;
  }

  /** 무너진 지붕: 널이 듬성듬성 빠진 박공지붕 */
  function brokenRoof(w, d, color, ruin) {
    const g = new THREE.Group();
    const slabs = Math.max(3, Math.round(d / 1.6));
    const pitch = 0.57;          // 너무 뾰족하지 않게(실제 집 지붕 각도)
    const ridgeY = w * 0.32;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < slabs; i++) {
        if (ruin && ((i * 31 + (side + 1) * 7) % 5 === 0)) continue;   // 뻥 뚫린 구멍
        const slab = mesh(L.box(w * 0.6, 0.42, d / slabs * 0.94), i % 2 ? color : P.darkWood, 'matte');
        put(g, slab, side * w * 0.25, ridgeY * 0.5, (i + 0.5) * (d / slabs) - d / 2, 0, 0, side * pitch);
      }
    }
    // 용마루
    const ridge = mesh(L.box(0.8, 0.55, d), P.darkWood, 'matte');
    put(g, ridge, 0, ridgeY, 0);
    // 박공(양 끝 삼각 벽)
    for (const sz of [-1, 1]) {
      const gable = mesh(L.box(w * 0.9, ridgeY, 0.5), color, 'matte');
      put(g, gable, 0, ridgeY * 0.5, sz * d * 0.5);
    }
    return g;
  }

  /** 문 (기울어져 매달린) */
  function door(w, h, color, tilt) {
    const g = new THREE.Group();
    const d = plankWall(w, h, 0.3, color === undefined ? P.plank : color, false);
    d.rotation.z = tilt || 0;
    g.add(d);
    const knob = mesh(L.cyl(0.16, 0.16, 0.2, 8), C.gold, 'metal');
    knob.rotation.z = Math.PI / 2;
    put(g, knob, w * 0.32, 0, 0.28);
    return g;
  }

  /** 나무 기둥 + 가로대로 만든 삐뚤어진 울타리 한 칸 */
  function crookedFence(len, tilt) {
    const g = new THREE.Group();
    const posts = Math.max(2, Math.round(len / 3));
    for (let i = 0; i < posts; i++) {
      const p = mesh(L.box(0.42, 3.2, 0.42), P.rottenWood, 'matte');
      put(g, p, (i / (posts - 1) - 0.5) * len, 1.6, 0, 0, 0, ((i * 37) % 7 - 3) * 0.05 * (tilt || 1));
    }
    for (const y of [1.0, 2.3]) {
      const rail = mesh(L.box(len, 0.3, 0.28), P.plank, 'matte');
      put(g, rail, 0, y, 0, 0, 0, 0.02 * (tilt || 1));
    }
    return g;
  }

  /** 우물 — 돌 테두리 + 지붕 + 두레박 */
  function well() {
    const g = new THREE.Group();
    const ring = mesh(L.cyl(2.4, 2.4, 2.2, 12), P.stone, 'matte');
    put(g, ring, 0, 1.1, 0);
    const inner = mesh(L.cyl(1.8, 1.8, 2.3, 12), 0x0d1013, 'matte', { shadow: false });
    put(g, inner, 0, 1.2, 0);
    for (const sx of [-1, 1]) {
      const post = mesh(L.box(0.5, 5, 0.5), P.rottenWood, 'matte');
      put(g, post, sx * 2.0, 3.5, 0);
    }
    const roof = brokenRoof(5.6, 5.2, P.plank, true);
    put(g, roof, 0, 5.6, 0);
    const bar = mesh(L.cyl(0.22, 0.22, 4.4, 8), P.darkWood, 'matte');
    bar.rotation.z = Math.PI / 2;
    put(g, bar, 0, 5.0, 0);
    const rope = mesh(L.cyl(0.07, 0.07, 2.4, 6), C.tan, 'matte');
    put(g, rope, 0, 3.8, 0);
    const bucket = mesh(L.cyl(0.7, 0.55, 1.0, 10), P.rottenWood, 'matte');
    put(g, bucket, 0, 2.4, 0);
    return g;
  }

  /** 나무 표지판 — 지역 이름을 쓴다 */
  function signPost(text, w) {
    const g = new THREE.Group();
    const post = mesh(L.box(0.55, 7, 0.55), P.rottenWood, 'matte');
    put(g, post, 0, 3.5, 0);
    const board = L.signPanel(text, w || 12, 3.2, '#7a5c3a', '#f3e0b6');
    board.castShadow = true;
    put(g, board, 0, 6.2, 0.2);
    const backing = mesh(L.box((w || 12) + 0.6, 3.8, 0.3), P.darkWood, 'matte');
    put(g, backing, 0, 6.2, 0);
    return g;
  }

  /** 등불 (색 있는 불빛 — 실제 광원은 쓰지 않고 발광 재질로) */
  function lantern(color) {
    const g = new THREE.Group();
    const post = mesh(L.box(0.4, 6, 0.4), P.darkWood, 'matte');
    put(g, post, 0, 3, 0);
    const cage = mesh(L.box(1.5, 1.8, 1.5), C.black, 'matte');
    put(g, cage, 0, 6.4, 0);
    const glow = new THREE.Mesh(L.box(1.1, 1.4, 1.1),
      new THREE.MeshBasicMaterial({ color: color === undefined ? 0x9bd44b : color }));
    put(g, glow, 0, 6.4, 0);
    const cap = mesh(L.box(1.9, 0.35, 1.9), C.black, 'matte');
    put(g, cap, 0, 7.4, 0);
    g.userData.glow = glow;
    return g;
  }

  /** 나무 상자 · 통 */
  function crate(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    const body = mesh(L.box(2.2 * s, 2.2 * s, 2.2 * s), P.plank, 'matte');
    put(g, body, 0, 1.1 * s, 0);
    for (const a of [0, Math.PI / 2]) {
      const band = mesh(L.box(2.3 * s, 0.25 * s, 0.25 * s), P.darkWood, 'matte');
      put(g, band, 0, 1.1 * s, 0, 0, a, 0);
      const band2 = mesh(L.box(0.25 * s, 0.25 * s, 2.3 * s), P.darkWood, 'matte');
      put(g, band2, 0, 1.1 * s, 0, 0, a, 0);
    }
    return g;
  }

  function barrel(scale, color) {
    const s = scale || 1;
    const g = new THREE.Group();
    const body = mesh(L.cyl(1.0 * s, 0.85 * s, 2.6 * s, 12), color === undefined ? P.rottenWood : color, 'matte');
    put(g, body, 0, 1.3 * s, 0);
    for (const y of [0.6, 2.0]) {
      const hoop = mesh(L.cyl(1.05 * s, 1.05 * s, 0.2 * s, 12), C.darkGray, 'metal');
      put(g, hoop, 0, y * s, 0);
    }
    return g;
  }

  /** 수레 (바퀴 빠진) */
  function brokenCart() {
    const g = new THREE.Group();
    const bed = mesh(L.box(6, 0.6, 3.4), P.plank, 'matte');
    put(g, bed, 0, 2.0, 0);
    for (const sx of [-1, 1]) {
      const side = mesh(L.box(6, 1.4, 0.35), P.rottenWood, 'matte');
      put(g, side, 0, 2.7, sx * 1.7);
    }
    const wheel = mesh(L.cyl(1.6, 1.6, 0.5, 12), P.darkWood, 'matte');
    put(g, wheel, -1.8, 1.6, 1.9, 0, 0, Math.PI / 2);
    const fallen = mesh(L.cyl(1.6, 1.6, 0.5, 12), P.darkWood, 'matte');
    put(g, fallen, 2.4, 0.3, -3.0, Math.PI / 2, 0.4, 0);
    const axle = mesh(L.cyl(0.25, 0.25, 4.2, 8), P.darkWood, 'matte');
    put(g, axle, -1.8, 1.6, 0, 0, 0, Math.PI / 2);
    const handle = mesh(L.box(0.4, 0.4, 4), P.rottenWood, 'matte');
    put(g, handle, 3.4, 1.6, 0, 0.2, 0, 0);
    return g;
  }

  /** 건초더미 */
  function hayBale() {
    const g = new THREE.Group();
    const body = mesh(L.cyl(1.7, 1.7, 3.0, 12), 0xd9b23c, 'matte');
    body.rotation.z = Math.PI / 2;
    put(g, body, 0, 1.7, 0);
    for (let i = 0; i < 3; i++) {
      const band = mesh(L.cyl(1.75, 1.75, 0.16, 12), 0xb08f2c, 'matte');
      band.rotation.z = Math.PI / 2;
      put(g, band, (i - 1) * 0.9, 1.7, 0);
    }
    return g;
  }

  /** 호박밭용 호박 */
  function pumpkin(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    const body = mesh(L.sph(1.3 * s, 12), C.orange);
    body.scale.y = 0.8;
    put(g, body, 0, 1.05 * s, 0);
    const stem = mesh(L.cyl(0.2 * s, 0.28 * s, 0.7 * s, 6), P.mossGreen, 'matte');
    put(g, stem, 0, 2.0 * s, 0);
    return g;
  }

  /** 광산 레일 + 광차 */
  function mineRail(len) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const rail = mesh(L.box(0.35, 0.3, len), C.darkGray, 'metal');
      put(g, rail, sx * 1.4, 0.5, 0);
    }
    const ties = Math.max(2, Math.round(len / 3));
    for (let i = 0; i < ties; i++) {
      const tie = mesh(L.box(3.6, 0.3, 0.8), P.darkWood, 'matte');
      put(g, tie, 0, 0.2, (i + 0.5) * (len / ties) - len / 2);
    }
    return g;
  }

  function mineCart() {
    const g = new THREE.Group();
    const body = mesh(L.box(3.4, 2.2, 4.6), P.rust, 'matte');
    put(g, body, 0, 2.2, 0);
    const inner = mesh(L.box(2.8, 1.8, 4.0), 0x2a1a12, 'matte', { shadow: false });
    put(g, inner, 0, 2.6, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = mesh(L.cyl(0.7, 0.7, 0.4, 10), C.black, 'matte');
        wheel.rotation.z = Math.PI / 2;
        put(g, wheel, sx * 1.7, 0.7, sz * 1.5);
      }
    }
    // 실린 광석
    for (let i = 0; i < 3; i++) {
      const ore = mesh(L.box(0.9, 0.8, 0.9), i % 2 ? P.crystalCyan : P.stone, 'matte');
      put(g, ore, (i - 1) * 0.9, 3.4, (i % 2) * 0.8 - 0.4, 0.3, i, 0.2);
    }
    return g;
  }

  /** 갱도 지지대(문틀 모양 목재) */
  function mineSupport(w, h) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const post = mesh(L.box(1.0, h, 1.0), P.darkWood, 'matte');
      put(g, post, sx * w / 2, h / 2, 0);
    }
    const top = mesh(L.box(w + 1.6, 1.1, 1.2), P.darkWood, 'matte');
    put(g, top, 0, h, 0);
    const brace1 = mesh(L.box(2.4, 0.7, 0.9), P.rottenWood, 'matte');
    put(g, brace1, -w / 2 + 1.2, h - 1.2, 0, 0, 0, 0.7);
    const brace2 = mesh(L.box(2.4, 0.7, 0.9), P.rottenWood, 'matte');
    put(g, brace2, w / 2 - 1.2, h - 1.2, 0, 0, 0, -0.7);
    return g;
  }

  /** 눈 덮인 바위 */
  function snowRock(scale) {
    const g = rock(scale, 0x8f9296);
    const cap = mesh(L.box(3.0 * (scale || 1), 0.5, 2.6 * (scale || 1)), P.snow, 'matte');
    put(g, cap, 0.2 * (scale || 1), 4.0 * (scale || 1), 0.1 * (scale || 1), 0, 0.4, 0);
    return g;
  }

  /** 산 정상 사당(얼음 신전) */
  function iceShrine() {
    const g = new THREE.Group();
    const base = mesh(L.box(22, 1.6, 22), P.ice, 'plastic');
    put(g, base, 0, 0.8, 0);
    const base2 = mesh(L.box(18, 1.4, 18), P.snow, 'plastic');
    put(g, base2, 0, 2.2, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const col = mesh(L.cyl(1.3, 1.5, 12, 8), P.ice, 'plastic');
        put(g, col, sx * 7, 8.9, sz * 7);
        const cap = mesh(L.box(3.4, 1.0, 3.4), P.snow, 'plastic');
        put(g, cap, sx * 7, 15.2, sz * 7);
      }
    }
    const roof = mesh(new THREE.ConeGeometry(14, 7, 4), P.ice, 'plastic');
    put(g, roof, 0, 19, 0, 0, Math.PI / 4, 0);
    const orb = new THREE.Mesh(L.sph(2.2, 16), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
    put(g, orb, 0, 6.5, 0);
    const altar = mesh(L.box(5, 3, 5), P.snow, 'plastic');
    put(g, altar, 0, 4.4, 0);
    g.userData.orb = orb;
    return g;
  }

  L.P = P;
  L.parts = {
    mesh, put, deadTree, pineTree, rock, crystal, dripstone, mushroom,
    plankWall, mixWood, boardedWindow, brokenRoof, door, crookedFence, well, signPost,
    lantern, crate, barrel, brokenCart, hayBale, pumpkin,
    mineRail, mineCart, mineSupport, snowRock, iceShrine,
  };
})(window.LEGO);
