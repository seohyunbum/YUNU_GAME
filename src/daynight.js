/* =========================================================================
 * daynight.js — 하루가 흐른다 (해 · 노을 · 밤 · 달빛 · 별)
 *
 *  t = 0 자정 · 0.25 해뜸 · 0.5 한낮 · 0.75 해짐
 *  한 바퀴에 CYCLE 초. game.js 는 매 프레임 update(dt) 하고,
 *  나온 값(dir · sunMul · hemiMul · tint …)을 지역 분위기 위에 곱한다.
 *
 * 해·달·별은 하늘 돔처럼 카메라를 따라다니는 무리에 담는다.
 * ========================================================================= */
(function (L) {
  'use strict';

  const CYCLE = 600;        // 한 바퀴 = 10분
  const START = 0.30;       // 아침에서 시작
  const R_SKY = 2100;       // 해·달·별을 놓는 거리 (하늘 돔 2400 보다 안쪽)

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /** 별밭 — 점 하나가 브릭 하나처럼 보이게 큼직하게 */
  function starField() {
    const N = 540;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // 지평선 아래 별은 어차피 안 보이니 위쪽 반구에만 뿌린다
      const u = Math.random() * 2 - 1;
      const y = Math.abs(u) * 0.92 + 0.06;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r * R_SKY;
      pos[i * 3 + 1] = y * R_SKY;
      pos[i * 3 + 2] = Math.sin(a) * r * R_SKY;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R_SKY * 1.2);
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 16, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  /** 브릭 달 — 하얀 공에 회색 크레이터 몇 개 */
  function moonMesh() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(L.sph(58, 16), new THREE.MeshBasicMaterial({
      color: 0xf4f2e0, fog: false,
    }));
    g.add(ball);
    const crater = [[-18, 14, 12], [16, -6, 16], [6, 26, 9], [-8, -22, 11]];
    for (let i = 0; i < crater.length; i++) {
      const c = new THREE.Mesh(L.sph(crater[i][2], 10), new THREE.MeshBasicMaterial({
        color: 0xd4d2c0, fog: false,
      }));
      c.position.set(crater[i][0], crater[i][1], 52);
      g.add(c);
    }
    const halo = new THREE.Mesh(L.sph(96, 14), new THREE.MeshBasicMaterial({
      color: 0xbfd8ff, transparent: true, opacity: 0.16, fog: false, depthWrite: false,
    }));
    g.add(halo);
    g.userData.halo = halo;
    return g;
  }

  /** 브릭 해 — 노란 공 + 후광 */
  function sunMesh() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(L.sph(66, 16), new THREE.MeshBasicMaterial({
      color: 0xfff3c4, fog: false,
    }));
    const halo = new THREE.Mesh(L.sph(120, 14), new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.22, fog: false, depthWrite: false,
    }));
    g.add(ball, halo);
    g.userData.halo = halo;
    return g;
  }

  function DayNight(scene) {
    this.t = START;
    this.cycle = CYCLE;
    this.frozen = false;              // 디버그·스모크에서 시간을 세울 때

    // 바깥에서 읽는 값들
    this.dir = new THREE.Vector3(0.4, 0.85, 0.34);   // 빛이 오는 쪽(위치 방향)
    this.sunUp = 1;                    // 해의 높이 (-1 ~ 1)
    this.day = 1;                      // 1 = 한낮, 0 = 한밤
    this.night = 0;
    this.dusk = 0;                     // 노을·새벽일 때 1에 가까워진다
    this.sunMul = 1;                   // 지역 분위기에 곱하는 값
    this.hemiMul = 1;
    this.ambientMul = 1;
    this.lightColor = new THREE.Color(0xffeec8);
    this.tint = new THREE.Color(0xffffff);       // 하늘 돔 색에 곱한다
    this.fogTint = new THREE.Color(0xffffff);

    const g = new THREE.Group();
    g.matrixAutoUpdate = true;
    g.frustumCulled = false;
    g.renderOrder = -0.9;              // 하늘 돔(-1) 바로 다음
    scene.add(g);
    this.group = g;

    this.stars = starField();
    this.stars.renderOrder = -0.9;
    g.add(this.stars);
    this.moon = moonMesh();
    this.moon.renderOrder = -0.85;
    this.moon.frustumCulled = false;
    g.add(this.moon);
    this.sunDisc = sunMesh();
    this.sunDisc.renderOrder = -0.85;
    this.sunDisc.frustumCulled = false;
    g.add(this.sunDisc);

    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
    this.update(0);
  }

  /** 시간을 흘리고 하늘을 다시 계산한다 */
  DayNight.prototype.update = function (dt) {
    if (!this.frozen && dt) {
      this.t += dt / this.cycle;
      this.t -= Math.floor(this.t);
    }
    const a = (this.t - 0.25) * Math.PI * 2;
    const s = Math.sin(a), c = Math.cos(a);
    this.sunUp = s;

    // 낮 기운: 지평선 언저리에서 천천히 넘어가게 넓은 띠를 준다(노을이 1분쯤 간다)
    this.day = clamp01((s + 0.28) / 0.56);
    this.night = 1 - this.day;
    // 노을·새벽: 해가 지평선 언저리일 때
    this.dusk = clamp01(1 - Math.abs(s) / 0.30) * clamp01(this.day * 1.6);

    // 빛이 오는 쪽 — 낮엔 해, 밤엔 달(해의 반대편)
    const nightSide = this.day < 0.06;
    const sx = c * 0.82, sy = s, sz = c * 0.30 + 0.22;
    if (nightSide) this.dir.set(-sx, -sy, -sz).normalize();
    else this.dir.set(sx, Math.max(0.12, sy), sz).normalize();

    // 빛 세기 — 밤에도 달빛이 조금 남는다(아이가 앞을 볼 수 있게)
    this.sunMul = 0.20 + 0.80 * this.day;
    this.hemiMul = 0.34 + 0.66 * this.day;
    this.ambientMul = 0.5 + 0.5 * this.day;

    // 빛 색 — 달빛(푸른) → 노을(주황) → 한낮(따뜻한 흰)
    this._c1.setHex(0x9fbcf0);                  // 달빛
    this._c2.setHex(0xffeec8);                  // 햇빛
    this.lightColor.copy(this._c1).lerp(this._c2, this.day);
    this._c2.setHex(0xff9a52);                  // 노을
    this.lightColor.lerp(this._c2, this.dusk * 0.75);

    // 하늘·안개에 곱할 색
    this._c1.setHex(0x2b3766);                  // 밤 하늘
    this.tint.set(1, 1, 1).lerp(this._c1, this.night * 0.86);
    this._c2.setHex(0xffb07a);
    this.tint.lerp(this._c2, this.dusk * 0.55);
    this._c1.setHex(0x353f5e);
    this.fogTint.set(1, 1, 1).lerp(this._c1, this.night * 0.8);
    this._c2.setHex(0xffa878);
    this.fogTint.lerp(this._c2, this.dusk * 0.45);

    // 해·달·별 자리
    this.sunDisc.position.set(sx, sy, sz).normalize().multiplyScalar(R_SKY);
    this.sunDisc.visible = s > -0.12;
    this.moon.position.set(-sx, -sy, -sz).normalize().multiplyScalar(R_SKY);
    this.moon.visible = s < 0.12;
    this.moon.userData.halo.material.opacity = 0.10 + 0.12 * this.night;
    this.stars.material.opacity = Math.pow(this.night, 1.4) * 0.95;
    this.stars.visible = this.stars.material.opacity > 0.02;
    this.stars.rotation.z = a * 0.5;
  };

  /** 카메라를 따라다닌다(하늘 돔과 같은 규칙) */
  DayNight.prototype.follow = function (camPos) {
    this.group.position.copy(camPos);
  };

  /** 지금이 언제인지 — HUD 에 그대로 쓴다 */
  DayNight.prototype.phase = function () {
    const t = this.t;
    if (t < 0.22 || t >= 0.85) return { icon: '🌙', name: '밤' };
    if (t < 0.30) return { icon: '🌅', name: '새벽' };
    if (t < 0.40) return { icon: '🌤️', name: '아침' };
    if (t < 0.68) return { icon: '🌞', name: '낮' };
    if (t < 0.78) return { icon: '🌇', name: '해질녘' };
    return { icon: '🌆', name: '땅거미' };
  };

  /** 시계 글자 (07:30 처럼) */
  DayNight.prototype.clock = function () {
    const m = Math.floor(this.t * 24 * 60);
    const hh = Math.floor(m / 60), mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  };

  /** 시간 맞추기 (0=자정, 0.5=한낮) */
  DayNight.prototype.setTime = function (t) {
    this.t = ((t % 1) + 1) % 1;
    this.update(0);
  };

  L.DayNight = DayNight;
})(window.LEGO);
