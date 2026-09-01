/* =========================================================================
 * places2.js — 새 지역들(사막·바다·시설·광산·유령)에 쓰는 브릭 부품
 * places.js 와 같은 규칙: 순수 팩토리, 팔레트 색, 각진 브릭 형태.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const P = L.P;
  const T = L.parts;
  const mesh = T.mesh, put = T.put;

  const P2 = {
    concrete: 0x9aa0a4,
    concreteDark: 0x6f7579,
    steel: 0x8f989c,
    rust: 0x8a4a20,
    hazard: 0xf2cd37,
    glassBlue: 0x2c5f86,
    screen: 0x63d7e6,
    lava: 0xff5a10,
    lavaDeep: 0xffa53a,
    obsidian: 0x241f2a,
    palm: 0x2f7a3f,
    sandBrick: 0xe4cd9e,
    sandDark: 0xc9ad78,
    velvet: 0x720e0f,
  };

  // ---------------------------------------------------------------- 식물
  /** 야자수 — 휘어진 줄기 + 잎 여섯 장 */
  function palmTree(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const seg = mesh(L.cyl(0.55 * s, 0.7 * s, 2.2 * s, 8), C.brown, 'matte');
      put(g, seg, Math.sin(i * 0.35) * 1.5 * s, (1.1 + i * 2.0) * s, 0, 0, 0, Math.sin(i * 0.35) * 0.18);
    }
    const top = (1.1 + 6 * 2.0) * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = mesh(L.box(6.5 * s, 0.35 * s, 1.6 * s), i % 2 ? P2.palm : 0x4b9f4a, 'matte');
      put(g, frond, Math.cos(a) * 3.2 * s + Math.sin(6 * 0.35) * 1.5 * s, top, Math.sin(a) * 3.2 * s,
        0, a, -0.32);
    }
    const nut = mesh(L.sph(0.5 * s, 8), C.brown, 'matte');
    put(g, nut, Math.sin(6 * 0.35) * 1.5 * s, top - 0.8 * s, 0.6 * s);
    return g;
  }

  /** 선인장 */
  function cactus(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    const body = mesh(L.cyl(1.0 * s, 1.2 * s, 7 * s, 8), 0x4b9f4a);
    put(g, body, 0, 3.5 * s, 0);
    for (const sx of [-1, 1]) {
      const arm = mesh(L.cyl(0.6 * s, 0.7 * s, 3 * s, 7), 0x4b9f4a);
      put(g, arm, sx * 1.6 * s, (3 + sx * 0.6) * s, 0, 0, 0, Math.PI / 2);
      const up = mesh(L.cyl(0.6 * s, 0.6 * s, 2.4 * s, 7), 0x4b9f4a);
      put(g, up, sx * 3.0 * s, (4.2 + sx * 0.6) * s, 0);
    }
    const flower = mesh(L.sph(0.5 * s, 8), C.magenta);
    put(g, flower, 0, 7.2 * s, 0);
    return g;
  }

  /** 눈사람 — 겨울 지역 */
  function snowman(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    const b1 = mesh(L.sph(2.0 * s, 12), 0xf2f6f8);
    put(g, b1, 0, 1.9 * s, 0);
    const b2 = mesh(L.sph(1.5 * s, 12), 0xf2f6f8);
    put(g, b2, 0, 4.6 * s, 0);
    const b3 = mesh(L.sph(1.1 * s, 12), 0xf2f6f8);
    put(g, b3, 0, 6.6 * s, 0);
    const hat = mesh(L.cyl(0.8 * s, 0.8 * s, 1.4 * s, 10), C.black, 'matte');
    put(g, hat, 0, 8.0 * s, 0);
    const brim = mesh(L.cyl(1.4 * s, 1.4 * s, 0.2 * s, 10), C.black, 'matte');
    put(g, brim, 0, 7.4 * s, 0);
    const nose = mesh(new THREE.ConeGeometry(0.25 * s, 1.2 * s, 6), C.orange);
    put(g, nose, 0, 6.6 * s, 1.2 * s, Math.PI / 2, 0, 0);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(L.sph(0.2 * s, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      put(g, eye, sx * 0.45 * s, 7.0 * s, 0.95 * s);
      const arm = mesh(L.cyl(0.16 * s, 0.16 * s, 3.4 * s, 5), P.rottenWood, 'matte');
      put(g, arm, sx * 2.2 * s, 4.8 * s, 0, 0, 0, sx * 1.1);
    }
    return g;
  }

  /** 통나무집 — 계절 숲의 쉼터 */
  function logCabin(w, d) {
    const g = new THREE.Group();
    const h = 7;
    const base = mesh(L.box(w + 1.5, 1.0, d + 1.5), P.stone, 'matte');
    put(g, base, 0, 0.5, 0);
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const y = 1.2 + i * (h / rows);
      for (let side = 0; side < 4; side++) {
        const along = side % 2 === 0 ? w : d;
        const log = mesh(L.cyl(h / rows * 0.52, h / rows * 0.52, along, 8), i % 2 ? C.brown : P.reddish || 0x7c503a, 'matte');
        const ang = side * Math.PI / 2;
        log.rotation.z = Math.PI / 2;
        log.rotation.y = ang;
        put(g, log, Math.sin(ang) * (side % 2 === 0 ? d / 2 : w / 2), y,
          Math.cos(ang) * (side % 2 === 0 ? d / 2 : w / 2));
        log.rotation.set(0, ang, Math.PI / 2);
      }
    }
    const roof = T.brokenRoof(w + 3, d + 3, P.plank, false);
    put(g, roof, 0, 1.2 + h, 0);
    const dr = T.door(3, 5, P.darkWood, 0);
    put(g, dr, 0, 3.6, d / 2 + 0.4);
    const win = new THREE.Mesh(L.box(2.6, 2.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    put(g, win, w / 2 + 0.3, 4.4, 0, 0, Math.PI / 2, 0);
    const chim = mesh(L.box(2, 6, 2), P.stone, 'matte');
    put(g, chim, w * 0.3, 1.2 + h + 3, -d * 0.25);
    return g;
  }

  // ---------------------------------------------------------------- 바다
  /** 부두 한 칸 */
  function pierSection(len, w) {
    const g = new THREE.Group();
    const deck = mesh(L.box(w || 8, 0.6, len), P.plank, 'matte');
    put(g, deck, 0, 0, 0);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < Math.max(2, Math.round(len / 8)); i++) {
        const post = mesh(L.cyl(0.5, 0.5, 8, 7), P.rottenWood, 'matte');
        put(g, post, sx * ((w || 8) / 2 - 0.8), -4, (i + 0.5) * (len / Math.max(2, Math.round(len / 8))) - len / 2);
      }
    }
    return g;
  }

  /** 부표 */
  function buoy(color) {
    const g = new THREE.Group();
    const body = mesh(L.cyl(1.1, 1.4, 3.2, 10), color === undefined ? C.red : color);
    put(g, body, 0, 1.6, 0);
    const top = mesh(L.cyl(0.3, 0.3, 1.6, 6), C.darkGray, 'metal');
    put(g, top, 0, 3.8, 0);
    const lamp = new THREE.Mesh(L.sph(0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    put(g, lamp, 0, 4.7, 0);
    return g;
  }

  /** 작은 배 */
  function boat(color) {
    const g = new THREE.Group();
    const hull = mesh(L.box(5, 2.2, 12), color === undefined ? C.white : color);
    put(g, hull, 0, 1.1, 0);
    const bow = mesh(new THREE.ConeGeometry(2.5, 4, 4), color === undefined ? C.white : color);
    put(g, bow, 0, 1.1, 7.2, Math.PI / 2, Math.PI / 4, 0);
    const deck = L.plate(P.plank, 4, 8, { height: 0.4 });
    put(g, deck, 0, 2.3, -1);
    const cabin = mesh(L.box(3.4, 2.6, 3.4), C.blue);
    put(g, cabin, 0, 3.6, -3);
    const glass = mesh(L.box(3.5, 1.2, 3.5), P2.glassBlue, 'glass');
    put(g, glass, 0, 4.2, -3);
    return g;
  }

  /** 난파선 — 기울어진 선체와 부러진 돛대 */
  function shipwreck(scale) {
    const s = scale || 1;
    const g = new THREE.Group();
    const hull = mesh(L.box(9 * s, 6 * s, 26 * s), P.rottenWood, 'matte');
    put(g, hull, 0, 3 * s, 0, 0.18, 0, 0.42);
    const deck = L.plate(P.darkWood, 8, 20, { height: 0.6 });
    put(g, deck, 0, 6.2 * s, 0);
    deck.rotation.set(0.18, 0, 0.42);
    const mast = mesh(L.cyl(0.7 * s, 0.9 * s, 16 * s, 8), P.darkWood, 'matte');
    put(g, mast, -1.5 * s, 10 * s, 2 * s, 0.2, 0, 0.5);
    const yard = mesh(L.box(12 * s, 0.6 * s, 0.6 * s), P.darkWood, 'matte');
    put(g, yard, -3 * s, 15 * s, 2 * s, 0, 0, 0.5);
    const sail = mesh(L.box(0.3 * s, 7 * s, 9 * s), C.white, 'matte');
    put(g, sail, -4 * s, 11 * s, 2 * s, 0, 0, 0.5);
    for (let i = 0; i < 4; i++) {
      const rib = mesh(L.box(10 * s, 0.5 * s, 0.7 * s), P.rottenWood, 'matte');
      put(g, rib, 0, (1.5 + i * 1.6) * s, (-10 + i * 2) * s, 0.18, 0, 0.42);
    }
    return g;
  }

  /** 등대 — 바다의 이정표 */
  function lighthouse() {
    const g = new THREE.Group();
    const base = mesh(L.cyl(6, 7, 4, 12), P.stone, 'matte');
    put(g, base, 0, 2, 0);
    for (let i = 0; i < 7; i++) {
      const band = mesh(L.cyl(5.2 - i * 0.45, 5.6 - i * 0.45, 5, 12), i % 2 ? C.white : C.red);
      put(g, band, 0, 4 + i * 5, 0);
    }
    const deck = mesh(L.cyl(4.6, 4.6, 1, 12), C.darkGray, 'metal');
    put(g, deck, 0, 39, 0);
    const lampRoom = new THREE.Mesh(L.cyl(3.2, 3.2, 5, 10),
      new THREE.MeshPhongMaterial({ color: 0xffe08a, emissive: 0x8a6a10, transparent: true, opacity: 0.85 }));
    put(g, lampRoom, 0, 42, 0);
    const roof = mesh(new THREE.ConeGeometry(4.4, 4, 10), C.red);
    put(g, roof, 0, 46.5, 0);
    return g;
  }

  // ---------------------------------------------------------------- 시설
  /** 콘크리트 벽 판 (이음선 있는) */
  function concreteWall(w, h, d, color) {
    const g = new THREE.Group();
    const body = mesh(L.box(w, h, d), color === undefined ? P2.concrete : color, 'matte');
    put(g, body, 0, 0, 0);
    const rows = Math.max(1, Math.round(h / 3));
    for (let i = 1; i < rows; i++) {
      const seam = mesh(L.box(w + 0.1, 0.18, d + 0.1), P2.concreteDark, 'matte', { shadow: false });
      put(g, seam, 0, -h / 2 + i * (h / rows), 0);
    }
    return g;
  }

  /** 방폭문 — 굵은 금속문 + 경고 줄무늬 */
  function blastDoor(w, h, accent) {
    const g = new THREE.Group();
    const frame = mesh(L.box(w + 1.6, h + 1.2, 1.2), P2.steel, 'metal');
    put(g, frame, 0, 0, 0);
    const leaf = mesh(L.box(w, h, 0.8), P2.concreteDark, 'matte');
    put(g, leaf, 0, 0, 0.4);
    for (let i = 0; i < 4; i++) {
      const stripe = mesh(L.box(w * 0.9, 0.7, 0.2), i % 2 ? (accent || P2.hazard) : C.black, 'matte');
      put(g, stripe, 0, -h / 2 + 1.4 + i * 1.2, 0.85);
    }
    const wheel = mesh(L.cyl(1.2, 1.2, 0.4, 10), P2.steel, 'metal');
    put(g, wheel, 0, 0.5, 1.0, Math.PI / 2, 0, 0);
    return g;
  }

  /** 제어 콘솔 — 화면과 버튼 */
  function console_(accent) {
    const g = new THREE.Group();
    const desk = mesh(L.box(6, 3, 3), P2.concreteDark, 'matte');
    put(g, desk, 0, 1.5, 0);
    const top = mesh(L.box(6.4, 0.4, 3.4), P2.steel, 'metal');
    put(g, top, 0, 3.2, 0);
    const panel = mesh(L.box(6, 3.6, 0.6), P2.steel, 'metal');
    put(g, panel, 0, 5, -1.2, -0.32, 0, 0);
    const screen = new THREE.Mesh(L.box(5, 2.6, 0.2), new THREE.MeshBasicMaterial({
      color: accent === undefined ? P2.screen : accent,
    }));
    put(g, screen, 0, 5.1, -0.85, -0.32, 0, 0);
    for (let i = 0; i < 6; i++) {
      const btn = new THREE.Mesh(L.box(0.4, 0.2, 0.4), new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xc91a09 : (i % 3 === 1 ? 0x4b9f4a : 0xf2cd37),
      }));
      put(g, btn, -2.2 + i * 0.9, 3.5, 0.6);
    }
    g.userData.screen = screen;
    return g;
  }

  /** 대형 화면(전파 지도실의 지도) */
  function mapScreen(w, h, color) {
    const g = new THREE.Group();
    const frame = mesh(L.box(w + 1, h + 1, 0.8), P2.concreteDark, 'matte');
    put(g, frame, 0, 0, 0);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 160;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#06202a'; c2.fillRect(0, 0, 256, 160);
    c2.strokeStyle = color === undefined ? '#63d7e6' : '#' + color.toString(16);
    c2.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      c2.beginPath(); c2.moveTo(i * 42, 0); c2.lineTo(i * 42, 160); c2.stroke();
      c2.beginPath(); c2.moveTo(0, i * 27); c2.lineTo(256, i * 27); c2.stroke();
    }
    c2.fillStyle = c2.strokeStyle;
    for (let i = 0; i < 7; i++) {
      c2.beginPath();
      c2.arc(30 + (i * 61) % 200, 25 + (i * 47) % 110, 6 + (i % 3) * 3, 0, Math.PI * 2);
      c2.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const screen = new THREE.Mesh(L.box(w, h, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
    put(g, screen, 0, 0, 0.5);
    return g;
  }

  /** 배관 */
  function pipe(len, r, color) {
    const g = new THREE.Group();
    const body = mesh(L.cyl(r, r, len, 10), color === undefined ? P2.steel : color, 'metal');
    body.rotation.z = Math.PI / 2;
    put(g, body, 0, 0, 0);
    for (const sx of [-1, 1]) {
      const flange = mesh(L.cyl(r * 1.35, r * 1.35, 0.5, 10), P2.concreteDark, 'matte');
      flange.rotation.z = Math.PI / 2;
      put(g, flange, sx * len / 2, 0, 0);
    }
    return g;
  }

  /** 저장 탱크 */
  function tank(scale, color) {
    const s = scale || 1;
    const g = new THREE.Group();
    const body = mesh(L.cyl(4 * s, 4 * s, 10 * s, 14), color === undefined ? P2.steel : color, 'metal');
    put(g, body, 0, 6 * s, 0);
    const top = mesh(L.cyl(4 * s, 3 * s, 2 * s, 14), P2.concreteDark, 'matte');
    put(g, top, 0, 12 * s, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const leg = mesh(L.box(0.8 * s, 2.4 * s, 0.8 * s), P2.steel, 'metal');
      put(g, leg, Math.cos(a) * 3.2 * s, 1.2 * s, Math.sin(a) * 3.2 * s);
    }
    for (const y of [4, 9]) {
      const band = mesh(L.cyl(4.15 * s, 4.15 * s, 0.4 * s, 14), P2.hazard, 'matte');
      put(g, band, 0, y * s, 0);
    }
    return g;
  }

  /** 경고 표지 */
  function hazardSign(text, color) {
    const g = new THREE.Group();
    const post = mesh(L.box(0.4, 6, 0.4), P2.steel, 'metal');
    put(g, post, 0, 3, 0);
    const board = L.signPanel(text, 9, 3, '#f2cd37', '#17222b');
    board.castShadow = true;
    put(g, board, 0, 6.4, 0.2);
    const back = mesh(L.box(9.4, 3.4, 0.3), color === undefined ? C.black : color, 'matte');
    put(g, back, 0, 6.4, 0);
    return g;
  }

  /** 철망 울타리 한 칸 */
  function chainFence(len, h, color) {
    const g = new THREE.Group();
    const posts = Math.max(2, Math.round(len / 8));
    for (let i = 0; i < posts; i++) {
      const post = mesh(L.box(0.6, h, 0.6), color === undefined ? P2.steel : color, 'metal');
      put(g, post, (i / (posts - 1) - 0.5) * len, h / 2, 0);
    }
    for (const y of [h * 0.25, h * 0.6, h * 0.95]) {
      const rail = mesh(L.box(len, 0.28, 0.28), color === undefined ? P2.steel : color, 'metal');
      put(g, rail, 0, y, 0);
    }
    const netMat = new THREE.MeshPhongMaterial({
      color: 0xb8c0c4, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(L.box(len, h * 0.9, 0.1), netMat);
    net.castShadow = false;
    put(g, net, 0, h * 0.5, 0);
    return g;
  }

  /** 탐조등 */
  function searchlight(color) {
    const g = new THREE.Group();
    const post = mesh(L.box(1.2, 12, 1.2), P2.steel, 'metal');
    put(g, post, 0, 6, 0);
    const head = mesh(L.cyl(1.8, 2.2, 3, 10), P2.concreteDark, 'matte');
    put(g, head, 0, 12.5, 1.2, Math.PI / 2.6, 0, 0);
    const lens = new THREE.Mesh(L.cyl(2.0, 2.0, 0.4, 10),
      new THREE.MeshBasicMaterial({ color: color === undefined ? 0xfff3c4 : color }));
    put(g, lens, 0, 11.6, 2.6, Math.PI / 2.6, 0, 0);
    g.userData.head = head;
    return g;
  }

  /** 사물함 */
  function locker(color) {
    const g = new THREE.Group();
    const body = mesh(L.box(3, 7, 1.6), color === undefined ? 0x3f5f7a : color, 'matte');
    put(g, body, 0, 3.5, 0);
    for (const sx of [-1, 1]) {
      const seam = mesh(L.box(0.12, 6.6, 0.1), P2.concreteDark, 'matte', { shadow: false });
      put(g, seam, sx * 0.05, 3.5, 0.85);
      const handle = mesh(L.box(0.24, 0.9, 0.2), P2.steel, 'metal');
      put(g, handle, sx * 0.55, 4.2, 0.9);
    }
    return g;
  }

  /** 방사능 드럼통 */
  function radBarrel() {
    const g = T.barrel(1, 0x4b9f4a);
    const band = mesh(L.cyl(1.06, 1.06, 0.6, 12), P2.hazard, 'matte');
    put(g, band, 0, 1.4, 0);
    const glow = new THREE.Mesh(L.cyl(0.9, 0.9, 0.2, 12), new THREE.MeshBasicMaterial({ color: 0xa5ca18 }));
    put(g, glow, 0, 2.65, 0);
    return g;
  }

  // ---------------------------------------------------------------- 용암·광석
  /** 용암 웅덩이 — 빛나는 판 + 굳은 테두리 */
  function lavaPool(r) {
    const g = new THREE.Group();
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({
      color: P2.lava,
    }));
    pool.rotation.x = -Math.PI / 2;
    put(g, pool, 0, 0.3, 0);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 16), new THREE.MeshBasicMaterial({
      color: P2.lavaDeep,
    }));
    inner.rotation.x = -Math.PI / 2;
    put(g, inner, 0, 0.45, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rim = mesh(L.box(r * 0.45, 1.4, r * 0.4), P2.obsidian, 'matte');
      put(g, rim, Math.cos(a) * r, 0.5, Math.sin(a) * r, 0, a, 0);
    }
    g.userData.pool = pool;
    return g;
  }

  /** 광맥 바위 — 색 있는 광석 알갱이가 박힌 돌 */
  function oreRock(scale, oreColor) {
    const s = scale || 1;
    const g = T.rock(s, 0x5a5e60);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const ore = new THREE.Mesh(L.box(0.7 * s, 0.7 * s, 0.7 * s),
        new THREE.MeshPhongMaterial({ color: oreColor, emissive: oreColor, emissiveIntensity: 0.25,
          specular: 0xffffff, shininess: 150 }));
      put(g, ore, Math.cos(a) * 1.4 * s, (1.2 + (i % 3) * 0.9) * s, Math.sin(a) * 1.2 * s, a, a, 0);
    }
    return g;
  }

  /** 광산 입구 권양탑 */
  function mineHead(color) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = mesh(L.box(1.2, 22, 1.2), P.darkWood, 'matte');
        put(g, leg, sx * 5, 11, sz * 5, 0, 0, sx * 0.06);
      }
    }
    for (let i = 1; i <= 4; i++) {
      const rung = mesh(L.box(11, 0.6, 0.6), P.darkWood, 'matte');
      put(g, rung, 0, i * 5, -5);
      const rung2 = mesh(L.box(0.6, 0.6, 11), P.darkWood, 'matte');
      put(g, rung2, 5, i * 5, 0);
    }
    const wheel = mesh(L.cyl(4, 4, 1.2, 14), color === undefined ? P2.rust : color, 'metal');
    put(g, wheel, 0, 23, 0, 0, 0, Math.PI / 2);
    const hub = mesh(L.cyl(1, 1, 1.6, 8), P2.steel, 'metal');
    put(g, hub, 0, 23, 0, 0, 0, Math.PI / 2);
    const roof = T.brokenRoof(13, 13, P.plank, true);
    put(g, roof, 0, 24.5, 0);
    return g;
  }

  // ---------------------------------------------------------------- 유령·미술관
  /** 액자 — 미술관 벽에 걸리는 그림 */
  function painting(w, h, hue) {
    const g = new THREE.Group();
    const frame = mesh(L.box(w + 1, h + 1, 0.5), C.gold, 'metal');
    put(g, frame, 0, 0, 0);
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#e8e0c8'; c2.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 9; i++) {
      c2.fillStyle = 'hsl(' + ((hue || 0) + i * 24) % 360 + ',55%,' + (35 + (i % 4) * 12) + '%)';
      c2.fillRect((i * 37) % 100, (i * 53) % 96, 26 + (i % 3) * 14, 22 + (i % 4) * 10);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const canvasMesh = new THREE.Mesh(L.box(w, h, 0.2), new THREE.MeshPhongMaterial({ map: tex }));
    put(g, canvasMesh, 0, 0, 0.3);
    return g;
  }

  /** 받침대 위 브릭 조각상 */
  function statue(color) {
    const g = new THREE.Group();
    const base = mesh(L.box(4, 2, 4), P2.concrete, 'matte');
    put(g, base, 0, 1, 0);
    const base2 = mesh(L.box(3, 1, 3), P2.concreteDark, 'matte');
    put(g, base2, 0, 2.5, 0);
    const body = mesh(L.cyl(1.5, 1.1, 5, 6), color === undefined ? 0xdcd8c8 : color, 'matte');
    put(g, body, 0, 5.5, 0);
    const head = mesh(L.sph(1.2, 10), color === undefined ? 0xdcd8c8 : color, 'matte');
    put(g, head, 0, 8.6, 0);
    for (const sx of [-1, 1]) {
      const arm = mesh(L.box(0.7, 3.4, 0.7), color === undefined ? 0xdcd8c8 : color, 'matte');
      put(g, arm, sx * 1.7, 6.2, 0, 0, 0, sx * 0.5);
    }
    return g;
  }

  /** 벨벳 줄(미술관 통제선) */
  function ropeStand() {
    const g = new THREE.Group();
    const base = mesh(L.cyl(1.0, 1.2, 0.5, 10), C.gold, 'metal');
    put(g, base, 0, 0.25, 0);
    const post = mesh(L.cyl(0.28, 0.28, 5, 8), C.gold, 'metal');
    put(g, post, 0, 2.6, 0);
    const knob = mesh(L.sph(0.5, 8), C.gold, 'metal');
    put(g, knob, 0, 5.2, 0);
    return g;
  }

  /** 브릭 카트 — 넓어진 세상을 빠르게 달리는 탈것 */
  function kart(color) {
    const g = new THREE.Group();
    const body = mesh(L.box(7, 2.2, 12), color === undefined ? C.red : color);
    put(g, body, 0, 2.2, 0);
    const nose = mesh(new THREE.ConeGeometry(3.2, 4.5, 4), color === undefined ? C.red : color);
    put(g, nose, 0, 2.2, 7.2, Math.PI / 2, Math.PI / 4, 0);
    const floorPlate = L.plate(C.darkGray, 6, 10, { height: 0.5 });
    put(g, floorPlate, 0, 3.3, -0.5);
    // 좌석 · 등받이 · 핸들
    const seat = mesh(L.box(4.4, 1.2, 4), C.black, 'matte');
    put(g, seat, 0, 4.2, -2.4);
    const backRest = mesh(L.box(4.6, 4.2, 1.0), C.black, 'matte');
    put(g, backRest, 0, 6.0, -4.4);
    const column = mesh(L.cyl(0.32, 0.32, 2.6, 8), P2.steel, 'metal');
    put(g, column, 0, 4.9, 1.4, 0.5, 0, 0);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.26, 8, 16), L.mat(C.black, 'matte'));
    put(g, wheelRim, 0, 5.7, 2.0, 0.5, 0, 0);
    // 바퀴 넷
    const wheels = new THREE.Group();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const tyre = mesh(L.cyl(2.0, 2.0, 1.4, 14), C.black, 'matte');
        tyre.rotation.z = Math.PI / 2;
        tyre.position.set(sx * 4.0, 2.0, sz * 4.2);
        wheels.add(tyre);
        const hub = mesh(L.cyl(0.9, 0.9, 1.5, 10), C.yellow, 'metal');
        hub.rotation.z = Math.PI / 2;
        hub.position.set(sx * 4.05, 2.0, sz * 4.2);
        wheels.add(hub);
      }
    }
    g.add(wheels);
    // 배기구 · 전조등 · 스포일러
    for (const sx of [-1, 1]) {
      const pipe2 = mesh(L.cyl(0.5, 0.5, 3.4, 8), P2.steel, 'metal');
      put(g, pipe2, sx * 3.2, 4.6, -6.2, Math.PI / 2, 0, 0);
      const lamp = new THREE.Mesh(L.cyl(0.8, 0.8, 0.3, 10), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
      put(g, lamp, sx * 2.2, 3.2, 6.4, Math.PI / 2, 0, 0);
    }
    const spoilerPost = mesh(L.box(0.6, 2.4, 0.6), C.darkGray, 'metal');
    put(g, spoilerPost, 0, 6.4, -5.6);
    const spoiler = mesh(L.box(7.5, 0.5, 2), C.yellow);
    put(g, spoiler, 0, 7.6, -5.8);
    g.userData.wheels = wheels;
    return g;
  }

  /**
   * 무기·스킬 받침대 — 세상에 놓여 있어서 찾아가야 얻는 것들.
   * 돌 받침 + 빛기둥 + 위에 떠서 도는 물건 + 이름표.
   */
  function pedestal(itemGroup, color, label) {
    const g = new THREE.Group();
    const col = color === undefined ? 0xffd166 : color;
    // 돌 받침 두 단
    const base1 = mesh(L.box(7, 1.4, 7), P2.concrete, 'matte');
    put(g, base1, 0, 0.7, 0);
    const base2 = mesh(L.box(5.4, 1.2, 5.4), P2.concreteDark, 'matte');
    put(g, base2, 0, 2, 0);
    const pillar = mesh(L.cyl(1.9, 2.3, 4.5, 8), P2.concrete, 'matte');
    put(g, pillar, 0, 4.6, 0);
    const top = L.plate(C.lightGray, 2, 2, { height: 0.6 });
    put(g, top, 0, 7.1, 0);
    // 빛기둥
    const beam = new THREE.Mesh(L.cyl(1.6, 2.4, 16, 12), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.22,
    }));
    put(g, beam, 0, 15, 0);
    const glow = new THREE.Mesh(L.cyl(2.6, 2.6, 0.3, 14), new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.5,
    }));
    put(g, glow, 0, 7.5, 0);
    // 떠 있는 물건
    const hold = new THREE.Group();
    hold.position.set(0, 10.5, 0);
    if (itemGroup) {
      itemGroup.scale.setScalar(1.5);
      hold.add(itemGroup);
    }
    g.add(hold);
    // 이름표
    if (label) {
      const board = L.signPanel(label, 11, 2.6, '#17222b',
        '#' + ('000000' + col.toString(16)).slice(-6));
      put(g, board, 0, 4.8, 2.6);
    }
    const light = new THREE.PointLight(col, 1.1, 34, 1.6);
    light.position.set(0, 9, 0);
    g.add(light);
    g.userData.hold = hold;
    g.userData.beam = beam;
    g.userData.glow = glow;
    g.userData.light = light;
    return g;
  }

  L.P2 = P2;
  L.parts2 = {
    palmTree, cactus, snowman, logCabin,
    pierSection, buoy, boat, shipwreck, lighthouse,
    concreteWall, blastDoor, console: console_, mapScreen, pipe, tank,
    hazardSign, chainFence, searchlight, locker, radBarrel,
    lavaPool, oreRock, mineHead,
    painting, statue, ropeStand, kart, pedestal,
  };
})(window.LEGO);
