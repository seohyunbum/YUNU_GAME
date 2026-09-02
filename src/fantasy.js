/* =========================================================================
 * fantasy.js — 판타지 부품과 지역 빌더
 *
 * 브릭으로 만든 마법 세계: 마법사 탑 · 수정 성 · 용의 둥지 · 요정 숲 ·
 * 지하 던전 · 부유섬. 부품은 places/places2 와 같은 규칙(순수 팩토리·팔레트).
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;
  const P2 = L.P2;
  const T = L.parts;
  const T2 = L.parts2;
  const N = L.terrainNoise;
  const mesh = T.mesh, put = T.put;

  const F = {
    stone: 0x9a958a,
    stoneDark: 0x6f6a62,
    magic: 0x9a63e6,
    magicLight: 0xc79bff,
    arcane: 0x63d7e6,
    gold: 0xdcbe61,
    banner: 0x720e0f,
    grass: 0x3f8f43,
    glow: 0xd8f4ff,
  };

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

  // ================================================================== 부품
  /** 빛나는 룬 무늬 텍스처 */
  const runeCache = new Map();
  function runeTexture(color) {
    if (runeCache.has(color)) return runeCache.get(color);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    const hex = '#' + ('000000' + color.toString(16)).slice(-6);
    g.strokeStyle = hex;
    g.lineWidth = 6;
    g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(128, 128, 84, 0, Math.PI * 2); g.stroke();
    // 룬 글자처럼 보이는 획들
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = 128 + Math.cos(a) * 96, y = 128 + Math.sin(a) * 96;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(-8, -8); g.lineTo(8, 0); g.lineTo(-8, 8);
      if (i % 3 === 0) { g.moveTo(-8, 0); g.lineTo(8, 0); }
      g.stroke();
      g.restore();
    }
    // 가운데 별
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 26 : 62;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    runeCache.set(color, t);
    return t;
  }

  /** 바닥에 그려진 마법진 (돌면서 빛난다) */
  function magicCircle(radius, color) {
    const col = color === undefined ? F.magic : color;
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), new THREE.MeshBasicMaterial({
      map: runeTexture(col), transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    }));
    disc.rotation.x = -Math.PI / 2;
    put(g, disc, 0, 0.3, 0);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.1, 32), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
    }));
    glow.rotation.x = -Math.PI / 2;
    put(g, glow, 0, 0.2, 0);
    g.userData.disc = disc;
    g.userData.spin = true;
    return g;
  }

  /** 마법 관문 — 기둥 둘과 소용돌이 */
  function portalArch(color) {
    const col = color === undefined ? F.magic : color;
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const pillar = mesh(L.box(3.2, 18, 3.2), F.stone, 'matte');
      put(g, pillar, sx * 7, 9, 0);
      const cap = mesh(L.box(4.4, 1.6, 4.4), F.stoneDark, 'matte');
      put(g, cap, sx * 7, 18.6, 0);
      const gem = new THREE.Mesh(L.sph(1.0, 10), new THREE.MeshBasicMaterial({ color: col }));
      put(g, gem, sx * 7, 20, 0);
    }
    const lintel = mesh(L.box(18, 2.6, 3.6), F.stone, 'matte');
    put(g, lintel, 0, 19.5, 0);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(6.2, 28), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    }));
    put(g, swirl, 0, 9.5, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.5, 8, 28),
      new THREE.MeshBasicMaterial({ color: F.magicLight }));
    put(g, ring, 0, 9.5, 0);
    const light = new THREE.PointLight(col, 1.2, 46, 1.6);
    light.position.set(0, 10, 0);
    g.add(light);
    g.userData.swirl = swirl;
    g.userData.ring = ring;
    return g;
  }

  /** 룬이 새겨진 선돌 */
  function runeStone(color) {
    const g = new THREE.Group();
    const body = mesh(L.box(3.2, 11, 1.8), F.stone, 'matte');
    put(g, body, 0, 5.5, 0, 0, 0, 0.05);
    const top = mesh(L.box(3.6, 1.2, 2.2), F.stoneDark, 'matte');
    put(g, top, 0, 11.2, 0);
    for (let i = 0; i < 3; i++) {
      const rune = new THREE.Mesh(L.box(1.5, 1.5, 0.15), new THREE.MeshBasicMaterial({
        color: color === undefined ? F.arcane : color,
      }));
      put(g, rune, 0, 3.4 + i * 2.6, 0.95);
    }
    return g;
  }

  /** 떠 있는 바위섬 — 아래가 뾰족하고 위에 풀이 났다 */
  function floatingRock(scale, grassy) {
    const s = scale || 1;
    const g = new THREE.Group();
    const top = mesh(L.box(9 * s, 3 * s, 8 * s), F.stone, 'matte');
    put(g, top, 0, 0, 0);
    const mid = mesh(L.box(7 * s, 3 * s, 6 * s), F.stoneDark, 'matte');
    put(g, mid, 0.4 * s, -2.6 * s, -0.3 * s);
    const tip = mesh(new THREE.ConeGeometry(3.4 * s, 7 * s, 6), F.stoneDark, 'matte');
    put(g, tip, 0.6 * s, -6.6 * s, -0.4 * s, Math.PI, 0.4, 0);
    if (grassy) {
      const grass = L.plate(F.grass, 3, 3, { height: 1.0 });
      grass.scale.set(3 * s, 1, 2.8 * s);
      put(g, grass, 0, 2 * s, 0);
    }
    return g;
  }

  /** 수정 첨탑 */
  function crystalSpire(h, color) {
    const g = new THREE.Group();
    const col = color === undefined ? F.arcane : color;
    const shell = new THREE.MeshPhongMaterial({
      color: col, specular: 0xffffff, shininess: 200, transparent: true, opacity: 0.55,
    });
    const main = new THREE.Mesh(new THREE.ConeGeometry(h * 0.16, h, 6), shell);
    put(g, main, 0, h / 2, 0);
    const core = new THREE.Mesh(new THREE.ConeGeometry(h * 0.07, h * 0.8, 6),
      new THREE.MeshBasicMaterial({ color: col }));
    put(g, core, 0, h * 0.42, 0);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const side = new THREE.Mesh(new THREE.ConeGeometry(h * 0.09, h * 0.5, 6), shell);
      put(g, side, Math.cos(a) * h * 0.16, h * 0.22, Math.sin(a) * h * 0.16, 0.14, a, 0.1);
    }
    return g;
  }

  /** 보물 상자 */
  function treasureChest() {
    const g = new THREE.Group();
    const body = mesh(L.box(5, 3, 3.6), P.rottenWood, 'matte');
    put(g, body, 0, 1.5, 0);
    const lid = mesh(L.cyl(1.8, 1.8, 5, 10, true), P.darkWood, 'matte');
    lid.rotation.z = Math.PI / 2;
    put(g, lid, 0, 3.1, -0.6, -0.5, 0, 0);
    for (const sx of [-1, 1]) {
      const band = mesh(L.box(0.4, 3.2, 3.8), F.gold, 'metal');
      put(g, band, sx * 1.6, 1.5, 0);
    }
    const lock = mesh(L.box(1.1, 1.2, 0.4), F.gold, 'metal');
    put(g, lock, 0, 2.2, 1.9);
    // 안에 든 금화
    for (let i = 0; i < 5; i++) {
      const coin = mesh(L.cyl(0.55, 0.55, 0.16, 10), F.gold, 'metal');
      put(g, coin, -1.4 + i * 0.7, 3.1, (i % 2) * 0.8 - 0.4, Math.PI / 2, 0, i * 0.4);
    }
    return g;
  }

  /** 횃불 기둥 */
  function torchPost(color) {
    const g = new THREE.Group();
    const post = mesh(L.box(0.9, 7, 0.9), F.stoneDark, 'matte');
    put(g, post, 0, 3.5, 0);
    const bowl = mesh(L.cyl(1.3, 0.8, 1.2, 10), C.darkGray, 'metal');
    put(g, bowl, 0, 7.4, 0);
    const flames = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.55 - i * 0.08, 1.6 + i * 0.4, 5),
        new THREE.MeshBasicMaterial({ color: color === undefined ? (i % 2 ? 0xffc23a : 0xff7a18) : color }));
      f.position.set(Math.cos(i * 1.6) * 0.35, 8.4 + i * 0.25, Math.sin(i * 1.6) * 0.35);
      flames.add(f);
    }
    g.add(flames);
    g.userData.flames = flames;
    return g;
  }

  /** 마법사 탑 — 돌탑에 나선 띠와 원뿔 지붕 */
  function wizardTower(height) {
    const H = height || 60;
    const g = new THREE.Group();
    const levels = Math.round(H / 6);
    for (let i = 0; i < levels; i++) {
      const r = 7.5 - (i / levels) * 2.6;
      const ring = mesh(L.cyl(r, r + 0.4, 6, 12), i % 2 ? F.stone : F.stoneDark, 'matte');
      put(g, ring, 0, 3 + i * 6, 0);
      // 나선으로 도는 창문
      if (i > 0 && i < levels - 1) {
        const a = i * 1.1;
        const win = new THREE.Mesh(L.box(1.6, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
        put(g, win, Math.cos(a) * (r + 0.2), 3 + i * 6, Math.sin(a) * (r + 0.2), 0, -a, 0);
      }
    }
    // 발코니
    const balcony = mesh(L.cyl(9, 9, 1.2, 14), F.stone, 'matte');
    put(g, balcony, 0, H - 8, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const merlon = mesh(L.box(1.4, 2.2, 1.4), F.stoneDark, 'matte');
      put(g, merlon, Math.cos(a) * 8, H - 6.4, Math.sin(a) * 8);
    }
    // 원뿔 지붕과 꼭대기 수정
    const roof = mesh(new THREE.ConeGeometry(7.5, 14, 12), F.magic, 'plastic');
    put(g, roof, 0, H + 2, 0);
    const orb = new THREE.Mesh(L.sph(2.2, 14), new THREE.MeshBasicMaterial({ color: F.magicLight }));
    put(g, orb, 0, H + 11, 0);
    const light = new THREE.PointLight(F.magicLight, 1.4, 90, 1.5);
    light.position.set(0, H + 11, 0);
    g.add(light);
    // 깃발
    for (const sx of [-1, 1]) {
      const pole = mesh(L.box(0.4, 8, 0.4), F.stoneDark, 'matte');
      put(g, pole, sx * 8, H - 3, 0);
      const flag = mesh(L.box(0.2, 3, 4.5), F.banner, 'matte');
      put(g, flag, sx * 8, H - 0.5, 2.4);
    }
    g.userData.orb = orb;
    return g;
  }

  /** 성벽 한 칸 (총안이 있는) */
  function castleWall(len, h, color) {
    const g = new THREE.Group();
    const body = mesh(L.box(len, h, 4), color === undefined ? F.stone : color, 'matte');
    put(g, body, 0, h / 2, 0);
    const merlons = Math.max(2, Math.round(len / 5));
    for (let i = 0; i < merlons; i++) {
      const m = mesh(L.box(2.6, 2.6, 4.6), F.stoneDark, 'matte');
      put(g, m, (i / (merlons - 1) - 0.5) * (len - 3), h + 1.3, 0);
    }
    const walk = mesh(L.box(len, 0.8, 5.6), F.stoneDark, 'matte');
    put(g, walk, 0, h - 0.4, 0);
    return g;
  }

  /** 성탑 */
  function castleTower(h, r, color) {
    const g = new THREE.Group();
    const body = mesh(L.cyl(r, r + 1, h, 12), color === undefined ? F.stone : color, 'matte');
    put(g, body, 0, h / 2, 0);
    const rim = mesh(L.cyl(r + 1.6, r + 1.6, 1.4, 12), F.stoneDark, 'matte');
    put(g, rim, 0, h, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = mesh(L.box(1.6, 2.4, 1.6), F.stoneDark, 'matte');
      put(g, m, Math.cos(a) * (r + 1), h + 1.6, Math.sin(a) * (r + 1));
    }
    const roof = mesh(new THREE.ConeGeometry(r + 2.4, h * 0.42, 12), C.blue, 'plastic');
    put(g, roof, 0, h + 3 + h * 0.21, 0);
    const flag = mesh(L.box(0.2, 2.6, 3.6), F.banner, 'matte');
    put(g, flag, 0, h + h * 0.42 + 5, 1.9);
    const pole = mesh(L.box(0.3, 6, 0.3), F.stoneDark, 'matte');
    put(g, pole, 0, h + h * 0.42 + 5, 0);
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(L.box(1.2, 2.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
      const a = i * 2.1;
      put(g, win, Math.cos(a) * (r + 0.6), 8 + i * 9, Math.sin(a) * (r + 0.6), 0, -a, 0);
    }
    return g;
  }

  /** 용의 둥지 — 통나무와 알 */
  function dragonNest() {
    const g = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const log = mesh(L.cyl(0.9, 1.1, 14, 7), P.rottenWood, 'matte');
      put(g, log, Math.cos(a) * 11, 1.6 + (i % 3) * 0.8, Math.sin(a) * 11, 0, a + Math.PI / 2, 0.1);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const egg = new THREE.Mesh(L.sph(2.6, 14), new THREE.MeshPhongMaterial({
        color: 0xe4cd9e, specular: 0xffffff, shininess: 90,
      }));
      egg.scale.set(1, 1.35, 1);
      put(g, egg, Math.cos(a) * 4, 3, Math.sin(a) * 4, 0.2, a, 0.15);
      const spot2 = mesh(L.box(1.2, 0.4, 1.2), 0x8a4a20, 'matte');
      put(g, spot2, Math.cos(a) * 4, 5.4, Math.sin(a) * 4);
    }
    return g;
  }

  L.F = F;
  L.fantasy = {
    magicCircle, portalArch, runeStone, floatingRock, crystalSpire,
    treasureChest, torchPost, wizardTower, castleWall, castleTower, dragonNest,
  };
})(window.LEGO);
