/* =========================================================================
 * terrain.js — 브릭으로 쌓아 만드는 지형 (오픈월드의 바닥)
 *
 * 생각 방식은 실제 레고 지형과 같다:
 *   · 땅은 "판 한 장"이 아니라 4x4 스터드 브릭을 계단처럼 쌓아 만든다
 *   · 한 칸의 높이는 브릭 한 단(1.2)씩 딱 떨어진다 → 걸어 올라가는 계단이 된다
 *   · 옆 칸보다 높으면 그 차이만큼 옆면을 채워 속이 비어 보이지 않게 한다
 *
 * 넓은 세상을 한 번에 만들면 무거우니 80x80 스터드 "청크"로 나눠서,
 * 플레이어 근처만 만들어 보여주고 멀어지면 숨긴다(스트리밍).
 * 한 청크 = InstancedMesh 하나 = 드로우콜 하나.
 * ========================================================================= */
(function (L) {
  'use strict';

  const STEP = 1.2;          // 브릭 한 단 높이 = 지형의 수직 격자
  const PITCH = 4;           // 지형 브릭 한 칸 = 4x4 스터드
  const CHUNK = 80;          // 청크 한 변(스터드)
  const CELLS = CHUNK / PITCH;

  // ------------------------------------------------------------------ 잡음
  // 라이브러리 없이 쓰는 결정적 값잡음(같은 좌표면 언제나 같은 높이).
  function hash2(ix, iz) {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function valueNoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  /** 여러 배율을 겹쳐 자연스러운 굴곡 만들기 */
  function fbm(x, z, octaves, scale) {
    let sum = 0, amp = 1, norm = 0, f = 1 / (scale || 60);
    for (let i = 0; i < (octaves || 3); i++) {
      sum += valueNoise(x * f, z * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /** 0..1 로 부드럽게 떨어지는 가중치 (지역 경계를 자연스럽게 잇는다) */
  function falloff(d, r, edge) {
    if (d >= r) return 0;
    const inner = r - (edge || r * 0.35);
    if (d <= inner) return 1;
    return smooth(1 - (d - inner) / (r - inner));
  }

  // ------------------------------------------------------------------ Terrain
  /**
   * @param {object} o
   *   regions: 지역 목록. 각 지역은 {id, cx, cz, r, edge, height(x,z,api), color(...)}
   *   flatZones: 지형을 만들지 않을 사각형(도시처럼 직접 지은 곳) [{x0,x1,z0,z1,y}]
   */
  function Terrain(o) {
    this.regions = o.regions || [];
    this.flatZones = o.flatZones || [];
    this.paths = o.paths || [];   // 지역을 잇는 흙길(지형을 눌러 평평하게 만든다)
    this.viewRadius = o.viewRadius || 300;
    this.chunks = new Map();
    this.scene = o.scene;
    // 윗면만 스터드가 있는 진짜 브릭 재질(옆면은 매끈)
    this.material = L.terrainBrickMaterial();
    // three r150 의 InstancedMesh 는 "인스턴스를 고려한 바운딩 구"가 없다.
    // 그대로 두면 원점 근처의 작은 구로 절두체 컬링돼서 먼 지형이 통째로 사라진다.
    // → 청크마다 자기 중심에 놓고, 청크를 감쌀 만큼 큰 구를 직접 달아준다.
    this._geo = L.terrainBrickGeometry(PITCH, 1, PITCH);
    this._geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 150);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._buildQueue = [];
    this.api = { fbm, valueNoise, clamp, lerp, smooth, STEP };
    this.stats = { built: 0, visible: 0 };
  }

  Terrain.prototype.PITCH = PITCH;
  Terrain.prototype.STEP = STEP;

  /** 이 좌표가 도시처럼 "직접 지은 평지" 안인가 */
  Terrain.prototype.flatZoneAt = function (x, z) {
    for (let i = 0; i < this.flatZones.length; i++) {
      const f = this.flatZones[i];
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f;
    }
    return null;
  };

  /**
   * 흙길: 선분에서의 거리와 그 지점의 길 높이를 준다.
   * 길은 지형을 평평하게 눌러서 실제로 걸어 다닐 수 있는 통로가 된다.
   */
  Terrain.prototype.pathAt = function (x, z) {
    let best = null;
    for (let i = 0; i < this.paths.length; i++) {
      const p = this.paths[i];
      const dx = p.bx - p.ax, dz = p.bz - p.az;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((x - p.ax) * dx + (z - p.az) * dz) / len2;
      t = clamp(t, 0, 1);
      const px = p.ax + dx * t, pz = p.az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < p.width * 2.2 && (!best || d < best.d)) {
        best = { d, t, path: p, y: lerp(p.ay, p.by, smooth(t)) };
      }
    }
    return best;
  };

  /** 지역 찾기(가장 가까운, 반경 안) */
  Terrain.prototype.regionAt = function (x, z) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      const d = Math.hypot(x - r.cx, z - r.cz);
      if (d < r.r && d < bestD) { best = r; bestD = d; }
    }
    return best;
  };

  /** 지형의 원시 높이(격자에 맞추기 전) */
  Terrain.prototype.rawHeight = function (x, z) {
    // 기본 들판: 완만한 구릉
    let h = (fbm(x, z, 3, 90) - 0.5) * 9;
    h += (fbm(x + 500, z - 300, 2, 240) - 0.5) * 7;
    for (let i = 0; i < this.regions.length; i++) {
      const rg = this.regions[i];
      if (!rg.height) continue;
      const d = Math.hypot(x - rg.cx, z - rg.cz);
      const w = falloff(d, rg.r, rg.edge);
      if (w > 0) h = lerp(h, rg.height(x, z, this.api, d), w);
    }
    // 흙길은 지형을 눌러 평평하게 만든다
    const road = this.pathAt(x, z);
    if (road) {
      const w = falloff(road.d, road.path.width * 2.2, road.path.width * 1.3);
      if (w > 0) h = lerp(h, road.y, w);
    }
    // 도시 평지 쪽으로 부드럽게 내려앉는다
    for (let i = 0; i < this.flatZones.length; i++) {
      const f = this.flatZones[i];
      const dx = Math.max(f.x0 - x, 0, x - f.x1);
      const dz = Math.max(f.z0 - z, 0, z - f.z1);
      const d = Math.hypot(dx, dz);
      const pad = f.blend || 40;
      if (d < pad) h = lerp(f.y || 0, h, smooth(d / pad));
    }
    return h;
  };

  /** 칸 중심으로 스냅한 격자 높이 — 실제로 보이는 브릭 윗면과 정확히 같다 */
  Terrain.prototype.heightAt = function (x, z) {
    const f = this.flatZoneAt(x, z);
    if (f) return f.y || 0;
    const cx = Math.floor(x / PITCH) * PITCH + PITCH / 2;
    const cz = Math.floor(z / PITCH) * PITCH + PITCH / 2;
    return Math.round(this.rawHeight(cx, cz) / STEP) * STEP;
  };

  /** 부드러운 높이(카메라 흔들림 방지용 — 네 칸 평균) */
  Terrain.prototype.smoothHeightAt = function (x, z) {
    const h0 = this.heightAt(x, z);
    const h1 = this.heightAt(x + PITCH, z);
    const h2 = this.heightAt(x - PITCH, z);
    const h3 = this.heightAt(x, z + PITCH);
    const h4 = this.heightAt(x, z - PITCH);
    return (h0 * 2 + h1 + h2 + h3 + h4) / 6;
  };

  Terrain.prototype._key = function (ci, cj) { return ci + ',' + cj; };

  /** 청크 하나를 브릭으로 쌓는다 */
  Terrain.prototype.buildChunk = function (ci, cj) {
    const x0 = ci * CHUNK, z0 = cj * CHUNK;
    const cells = [];
    for (let gx = 0; gx < CELLS; gx++) {
      for (let gz = 0; gz < CELLS; gz++) {
        const x = x0 + gx * PITCH + PITCH / 2;
        const z = z0 + gz * PITCH + PITCH / 2;
        if (this.flatZoneAt(x, z)) continue;
        const h = this.heightAt(x, z);
        // 옆 칸보다 얼마나 높은가 → 그만큼 옆면을 채운다
        let lowest = h;
        const n1 = this.heightAt(x + PITCH, z);
        const n2 = this.heightAt(x - PITCH, z);
        const n3 = this.heightAt(x, z + PITCH);
        const n4 = this.heightAt(x, z - PITCH);
        lowest = Math.min(n1, n2, n3, n4);
        const depth = clamp(h - lowest + STEP, STEP, 26);
        cells.push({ x, z, h, depth });
      }
    }
    if (!cells.length) return null;

    const inst = new THREE.InstancedMesh(this._geo, this.material, cells.length);
    const originX = x0 + CHUNK / 2, originZ = z0 + CHUNK / 2;
    const m = this._m, q = this._q, p = this._p, s = this._s, c = this._c;
    q.identity();
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      // 인스턴스 좌표는 청크 중심 기준(컬링용 바운딩 구가 맞아떨어지게)
      p.set(cell.x - originX, cell.h - cell.depth / 2, cell.z - originZ);
      s.set(1, cell.depth, 1);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      // 색: 지역이 정하고, 없으면 들판 초록
      const rg = this.regionAt(cell.x, cell.z);
      const slope = Math.abs(cell.depth - STEP);
      let hex;
      const onPath = this.pathAt(cell.x, cell.z);
      if (onPath && onPath.d < onPath.path.width) {
        // 다져진 흙길 색 (가장자리는 자갈)
        hex = onPath.d < onPath.path.width * 0.7 ? 0xa08c62 : 0x8d8378;
      } else if (rg && rg.color) {
        hex = rg.color(cell.x, cell.z, cell.h, slope, this.api);
      } else {
        hex = this.plainsColor(cell.x, cell.z, cell.h, slope);
      }
      inst.setColorAt(i, c.setHex(hex));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.position.set(originX, 0, originZ);
    inst.receiveShadow = true;
    inst.castShadow = false;
    inst.matrixAutoUpdate = false;
    inst.updateMatrix();
    inst.frustumCulled = true;
    this.scene.add(inst);
    this.stats.built++;
    return inst;
  };

  /** 기본 들판 색 — 초록 두 톤 + 경사면은 흙/돌 */
  Terrain.prototype.plainsColor = function (x, z, h, slope) {
    if (slope > 3.2) return h > 12 ? 0x8a8d87 : 0x7c6a4e;
    const n = valueNoise(x * 0.06, z * 0.06);
    if (h > 16) return 0x8a8d87;
    return n > 0.62 ? 0x4b9f4a : (n > 0.32 ? 0x3f8f43 : 0x57a34a);
  };

  /**
   * 플레이어 근처 청크를 만들고/보이고, 먼 것은 숨긴다.
   * budget = 한 프레임에 새로 만들 수 있는 청크 수(끊김 방지)
   */
  Terrain.prototype.update = function (px, pz, budget) {
    const R = this.viewRadius;
    const ci0 = Math.floor((px - R) / CHUNK), ci1 = Math.floor((px + R) / CHUNK);
    const cj0 = Math.floor((pz - R) / CHUNK), cj1 = Math.floor((pz + R) / CHUNK);
    let made = 0;
    const maxMake = budget === undefined ? 2 : budget;
    let visible = 0;

    for (let ci = ci0; ci <= ci1; ci++) {
      for (let cj = cj0; cj <= cj1; cj++) {
        const cx = ci * CHUNK + CHUNK / 2, cz = cj * CHUNK + CHUNK / 2;
        const d = Math.hypot(cx - px, cz - pz);
        if (d > R + CHUNK) continue;
        const key = this._key(ci, cj);
        let chunk = this.chunks.get(key);
        if (chunk === undefined) {
          if (made >= maxMake) continue;   // 다음 프레임에 마저 만든다
          chunk = this.buildChunk(ci, cj);
          this.chunks.set(key, chunk);
          made++;
        }
        if (chunk) { chunk.visible = true; visible++; }
      }
    }
    // 시야 밖 청크 숨기기
    this.chunks.forEach((chunk, key) => {
      if (!chunk || !chunk.visible) return;
      const parts = key.split(',');
      const cx = parseInt(parts[0], 10) * CHUNK + CHUNK / 2;
      const cz = parseInt(parts[1], 10) * CHUNK + CHUNK / 2;
      if (Math.hypot(cx - px, cz - pz) > R + CHUNK * 1.5) chunk.visible = false;
    });
    this.stats.visible = visible;
  };

  L.Terrain = Terrain;
  L.terrainNoise = { fbm, valueNoise, hash2, clamp, lerp, smooth, falloff };
})(window.LEGO);
