/* =========================================================================
 * world.js — 오픈월드 정본: 지역이 어디에 있고, 지형이 어떤 모양이고,
 *            어떤 몬스터가 나오고, 분위기(빛·안개)가 어떤지.
 *
 *   레고 시티(안전지대) 를 가운데 두고 사방으로 사냥터가 있다.
 *     북  : 좀비 마을
 *     서  : 깊은 동굴 협곡
 *     동  : 높은 산 (설산 정상 보스)
 *     남동: 늪지대 폐가
 *   흙길이 도시 성문에서 각 사냥터까지 이어진다(지형을 눌러 만든 진짜 길).
 *
 * 지형은 terrain.js 가 청크로 스트리밍하고, 지역 소품은 가까이 갔을 때
 * 한 번 지어서 그룹째 켜고 끈다.
 * ========================================================================= */
(function (L) {
  'use strict';

  // 도시가 차지하는 평지(여기는 terrain 이 건드리지 않는다)
  const CITY_ZONE = { x0: -110, x1: 110, z0: -250, z1: 70, y: 0.55, blend: 55 };

  /** 지역 정본 */
  const REGIONS = [
    {
      id: 'city', name: '레고 시티', label: '안전지대', cx: 0, cz: -90, r: 190,
      safe: true, icon: '🏙️',
      ambience: { fog: 0xb6d8ef, fogNear: 120, fogFar: 420, sun: 1.0, hemi: 1.0 },
    },
    {
      id: 'zombie', name: '좀비 마을', label: '사냥터 · 쉬움', cx: 0, cz: -430, r: 155,
      edge: 60, icon: '🧟', level: 1,
      boss: { type: 'zombie', name: '좀비 두목', scale: 2.4, hpMul: 6, speedMul: 0.8 },
      particles: 'none',
      spawn: { types: ['zombie', 'zombie', 'zombie', 'slime'], max: 11, near: 46, far: 96 },
      height: function (x, z, api, d) {
        const n = api.fbm(x, z, 3, 70) - 0.5;
        let h = 3 + n * 9;
        // 마을 안쪽은 평평한 흙바닥
        const t = api.clamp(1 - d / 95, 0, 1);
        h = api.lerp(h, 1.2 + n * 2.4, api.smooth(t));
        return h;
      },
      color: function (x, z, h, slope, api) {
        if (slope > 3) return 0x6b5a3e;
        const n = api.valueNoise(x * 0.07, z * 0.07);
        if (n > 0.66) return 0x6d7a49;         // 마른 풀
        if (n > 0.34) return 0x5c6b40;
        return 0x6b5f42;                        // 흙
      },
      ambience: {
        fog: 0x7c8767, fogNear: 44, fogFar: 210, sun: 0.66, hemi: 0.6, sky: 0x8a9376,
        hemiSky: 0xa8b28c, hemiGround: 0x4a4a33,
      },
    },
    {
      id: 'cave', name: '깊은 동굴 협곡', label: '사냥터 · 보통', cx: -380, cz: -60, r: 175,
      edge: 65, icon: '💎', level: 2, floorY: -24,
      boss: { type: 'crystal', name: '크리스탈 골렘 왕', scale: 2.2, hpMul: 5, speedMul: 0.8 },
      particles: 'dust',
      spawn: { types: ['crystal', 'bat', 'bat', 'golem'], max: 10, near: 44, far: 92 },
      height: function (x, z, api, d) {
        const rim = 20 + (api.fbm(x, z, 3, 55) - 0.5) * 16;
        // 협곡 폭이 들쭉날쭉해야 자연스럽다(좁아졌다 넓어졌다)
        const gorgeHalf = 30 + (api.fbm(z * 0.6, 120, 2, 46) - 0.5) * 26;
        const dx = Math.abs(x + 380);
        // 갱도가 놓이는 한가운데(±20)는 평평하게 유지한다
        const floor = -24 + (dx < 20 ? 0 : (api.fbm(x, z, 2, 22) - 0.5) * 4);
        if (dx < gorgeHalf) {
          const t = dx / gorgeHalf;
          return floor + Math.pow(t, 2.4) * (rim - floor);
        }
        return rim + (api.fbm(x + 300, z, 2, 40) - 0.5) * 10;
        void d;
      },
      color: function (x, z, h, slope, api) {
        if (h < -14) return api.valueNoise(x * 0.1, z * 0.1) > 0.6 ? 0x44484c : 0x3a3d40;
        if (h < 6) return 0x4f5357;
        if (slope > 4) return 0x5c6064;
        return api.valueNoise(x * 0.08, z * 0.08) > 0.55 ? 0x6c6e68 : 0x5a5e60;
      },
      ambience: {
        fog: 0x2f353c, fogNear: 28, fogFar: 150, sun: 0.4, hemi: 0.34, sky: 0x3b4450, dark: true,
        hemiSky: 0x6a5a4a, hemiGround: 0x241f1c,
      },
    },
    {
      id: 'mount', name: '높은 산', label: '사냥터 · 어려움', cx: 400, cz: -260, r: 200,
      edge: 80, icon: '🏔️', level: 3,
      boss: { type: 'dragon', name: '브릭 드래곤', scale: 1, hpMul: 1, speedMul: 1 },
      particles: 'snow',
      spawn: { types: ['ice', 'ice', 'bat', 'golem'], max: 9, near: 48, far: 100 },
      height: function (x, z, api, d) {
        const t = api.clamp(1 - d / 200, 0, 1);
        let h = Math.pow(t, 1.8) * 76;
        h += (api.fbm(x, z, 4, 42) - 0.5) * 15 * (0.35 + t);
        return h;
      },
      color: function (x, z, h, slope, api) {
        if (h > 46) return api.valueNoise(x * 0.09, z * 0.09) > 0.35 ? 0xf2f6f8 : 0xdfe9ee;
        if (h > 34) return api.valueNoise(x * 0.09, z * 0.09) > 0.6 ? 0xe6eef2 : 0x8f9296;
        if (h > 16 || slope > 4) return api.valueNoise(x * 0.07, z * 0.07) > 0.5 ? 0x77797a : 0x6c6e68;
        return api.valueNoise(x * 0.07, z * 0.07) > 0.5 ? 0x3f8f43 : 0x2c6e3a;
      },
      ambience: {
        fog: 0xd2e6f2, fogNear: 70, fogFar: 320, sun: 1.3, hemi: 0.9, sky: 0xbcd8ea, snow: true,
        hemiSky: 0xdfeef7, hemiGround: 0x9fb0bc,
      },
    },
    {
      id: 'swamp', name: '늪지대 폐가', label: '사냥터 · 보통', cx: 300, cz: 230, r: 165,
      edge: 65, icon: '🪵', level: 2, waterY: -3.2,
      boss: { type: 'toxic', name: '늪의 왕', scale: 3.0, hpMul: 6, speedMul: 0.9 },
      particles: 'firefly',
      spawn: { types: ['toxic', 'toxic', 'wisp', 'zombie'], max: 11, near: 42, far: 92 },
      height: function (x, z, api, d) {
        const n = api.fbm(x, z, 3, 46);
        // 대부분은 물에 잠긴 진창(-9.5 ~ -1.5), 군데군데 마른 둔덕
        let h = -9.5 + n * 8;
        const hump = api.fbm(x + 700, z - 200, 2, 28);
        if (hump > 0.62) h += (hump - 0.62) * 22;    // 발 디딜 둔덕
        // 폐가가 선 가운데 언덕
        const t = api.clamp(1 - d / 48, 0, 1);
        h = api.lerp(h, 2.4 + n * 2, api.smooth(t));
        return h;
      },
      color: function (x, z, h, slope, api) {
        if (h < -4.4) return 0x2d3f2c;          // 물 밑 진흙
        if (h < -2.6) return 0x3a4b32;
        if (slope > 3) return 0x4a4030;
        return api.valueNoise(x * 0.08, z * 0.08) > 0.5 ? 0x44603a : 0x38512f;
      },
      ambience: {
        fog: 0x60806a, fogNear: 30, fogFar: 165, sun: 0.55, hemi: 0.62, sky: 0x6d8a72,
        hemiSky: 0x9ec0a2, hemiGround: 0x2f3f2c,
      },
    },
  ];

  /** 도시 성문에서 각 사냥터로 이어지는 흙길 */
  const PATHS = [
    // 북문 → 좀비 마을
    { ax: 0, az: -248, ay: 0.55, bx: 0, bz: -340, by: 4, width: 9 },
    { ax: 0, az: -340, ay: 4, bx: 0, bz: -430, by: 1.2, width: 9 },
    // 서문 → 동굴 협곡 (협곡 바닥까지 내려가는 비탈)
    { ax: -108, az: -50, ay: 0.55, bx: -250, bz: -58, by: 8, width: 9 },
    { ax: -250, az: -58, ay: 8, bx: -330, bz: -60, by: -6, width: 10 },
    { ax: -330, az: -60, ay: -6, bx: -380, bz: -62, by: -24, width: 11 },
    // 동문 → 높은 산 (지그재그 등산로)
    { ax: 108, az: -150, ay: 0.55, bx: 250, bz: -200, by: 10, width: 9 },
    { ax: 250, az: -200, ay: 10, bx: 330, bz: -160, by: 26, width: 8 },
    { ax: 330, az: -160, ay: 26, bx: 340, bz: -300, by: 46, width: 8 },
    { ax: 340, az: -300, ay: 46, bx: 420, bz: -300, by: 62, width: 7 },
    { ax: 420, az: -300, ay: 62, bx: 400, bz: -258, by: 76, width: 7 },
    // 남문 → 늪지대
    { ax: 20, az: 68, ay: 0.55, bx: 170, bz: 150, by: 2, width: 9 },
    { ax: 170, az: 150, ay: 2, bx: 290, bz: 200, by: -1.5, width: 9 },
  ];

  function World(scene, city) {
    this.scene = scene;
    this.city = city;
    this.regions = REGIONS;
    this.byId = {};
    for (let i = 0; i < REGIONS.length; i++) this.byId[REGIONS[i].id] = REGIONS[i];

    this.terrain = new L.Terrain({
      scene,
      regions: REGIONS.filter((r) => !!r.height),
      flatZones: [CITY_ZONE],
      paths: PATHS,
      viewRadius: 330,
    });

    this.gates = this._buildGates();
    this.content = {};       // regionId → {group, data, built}
    this.current = this.byId.city;
    this.previous = null;
    this.colliders = city ? city.colliders : [];
    this._tmp = new THREE.Vector3();
  }

  /** 도시 성문 표지판 — 아이가 길을 잃지 않게 방향과 이름을 적어둔다 */
  World.prototype._buildGates = function () {
    const g = new THREE.Group();
    const signs = [
      { x: 0, z: -244, ry: 0, text: 'ZOMBIE VILLAGE ^', label: '좀비 마을' },
      { x: -104, z: -50, ry: Math.PI / 2, text: '< CRYSTAL CAVE', label: '동굴 협곡' },
      { x: 104, z: -150, ry: -Math.PI / 2, text: 'FROST PEAK >', label: '높은 산' },
      { x: 24, z: 64, ry: Math.PI, text: 'SWAMP RUIN v', label: '늪지대 폐가' },
    ];
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      const post = L.parts.signPost(s.text, 17);
      post.position.set(s.x, 0.55, s.z);
      post.rotation.y = s.ry;
      g.add(post);
      // 옆에 노란 등불을 세워 밤에도 눈에 띄게
      const lamp = L.parts.lantern(0xffd166);
      lamp.position.set(s.x + 5, 0.55, s.z);
      g.add(lamp);
    }
    g.updateMatrixWorld(true);
    g.traverse((o) => { o.matrixAutoUpdate = false; });
    this.scene.add(g);
    return g;
  };

  World.prototype.heightAt = function (x, z) {
    return this.terrain.heightAt(x, z);
  };

  World.prototype.regionAt = function (x, z) {
    let best = null, bestScore = Infinity;
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      const d = Math.hypot(x - r.cx, z - r.cz);
      if (d < r.r && d < bestScore) { best = r; bestScore = d; }
    }
    return best || null;
  };

  /** 지역 소품을 처음 갈 때 한 번 짓고, 이후로는 켜고 끈다 */
  World.prototype._ensureContent = function (region) {
    if (!region || !L.REGION_BUILDERS[region.id]) return null;
    let c = this.content[region.id];
    if (c) return c;
    const group = new THREE.Group();
    const self = this;
    const ctx = {
      region,
      heightAt: function (x, z) { return self.terrain.heightAt(x, z); },
      terrain: this.terrain,
    };
    const data = L.REGION_BUILDERS[region.id](group, ctx);
    group.updateMatrixWorld(true);
    group.traverse((o) => { o.matrixAutoUpdate = false; });
    this.scene.add(group);
    c = { group, data };
    this.content[region.id] = c;
    // 지역 소품의 충돌 상자를 전역 목록에 더한다
    if (data && data.colliders) {
      for (let i = 0; i < data.colliders.length; i++) this.colliders.push(data.colliders[i]);
    }
    return c;
  };

  /**
   * 플레이어 위치에 맞춰 지형 청크와 지역 소품을 켠다.
   * @returns {object|null} 지역이 바뀌었으면 새 지역
   */
  World.prototype.update = function (px, pz, dt, chunkBudget) {
    this.terrain.update(px, pz, chunkBudget);

    // 가까운 지역의 소품을 준비/표시
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (!L.REGION_BUILDERS[r.id]) continue;
      const d = Math.hypot(px - r.cx, pz - r.cz);
      if (d < r.r + 150) {
        const c = this._ensureContent(r);
        if (c) c.group.visible = true;
      } else {
        const c = this.content[r.id];
        if (c) c.group.visible = false;
      }
    }

    // 도시 소품은 도시 근처에서만
    if (this.city && this.city.group) {
      this.city.group.visible = Math.hypot(px - 0, pz + 90) < 420;
    }

    const now = this.regionAt(px, pz);
    if (now !== this.current) {
      this.previous = this.current;
      this.current = now;
      return now;
    }
    return null;
  };

  /** 현재 지역의 분위기(없으면 들판 기본값) */
  World.prototype.ambience = function () {
    const r = this.current;
    if (r && r.ambience) return r.ambience;
    return { fog: 0xb6d8ef, fogNear: 110, fogFar: 400, sun: 1.0, hemi: 1.0 };
  };

  World.prototype.isSafe = function () {
    return !!(this.current && this.current.safe);
  };

  /** 물에 잠긴 곳인가(늪) — 이동 속도와 발소리에 쓴다 */
  World.prototype.waterDepthAt = function (x, z, y) {
    const r = this.regionAt(x, z);
    if (!r || r.waterY === undefined) return 0;
    return Math.max(0, r.waterY - y);
  };

  /** 동굴 갱도 안인가(횃불을 켠다) */
  World.prototype.inTunnel = function (x, z, y) {
    const c = this.content.cave;
    if (!c || !c.data || !c.data.tunnel) return false;
    const t = c.data.tunnel;
    return Math.abs(x - t.x) < t.halfW && z > t.z0 && z < t.z1 && y < t.ceilY;
  };

  /**
   * 몬스터를 낼 자리 하나 고르기: 플레이어에게서 near~far 사이,
   * 지역 안, 물속/절벽이 아닌 곳.
   */
  World.prototype.pickSpawn = function (px, pz, region, out) {
    if (!region || !region.spawn) return null;
    const s = region.spawn;
    for (let tries = 0; tries < 14; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = s.near + Math.random() * (s.far - s.near);
      const x = px + Math.cos(a) * d;
      const z = pz + Math.sin(a) * d;
      if (Math.hypot(x - region.cx, z - region.cz) > region.r * 0.95) continue;
      const y = this.terrain.heightAt(x, z);
      // 너무 가파른 곳(벽면)은 피한다
      const slope = Math.max(
        Math.abs(y - this.terrain.heightAt(x + 5, z)),
        Math.abs(y - this.terrain.heightAt(x, z + 5)));
      if (slope > 4) continue;
      out.set(x, y, z);
      return out;
    }
    return null;
  };

  /** 이 지역에서 나올 몬스터 종류 하나 */
  World.prototype.pickType = function (region) {
    if (!region || !region.spawn) return null;
    const t = region.spawn.types;
    return t[Math.floor(Math.random() * t.length)];
  };

  L.CITY_ZONE = CITY_ZONE;
  L.WORLD_REGIONS = REGIONS;
  L.WORLD_PATHS = PATHS;
  L.World = World;
})(window.LEGO);
