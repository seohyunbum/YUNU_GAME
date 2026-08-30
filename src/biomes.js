/* =========================================================================
 * biomes.js — 지형 공식과 색 팔레트 모음
 *
 * 지역이 서른 곳이 넘어가면 지역마다 높이 함수를 손으로 쓸 수 없다.
 * 여기 있는 공장(factory)들을 world.js 의 지역 표에서 불러 쓴다.
 *   height: B.dunes({ amp: 9 })        → 모래언덕
 *   color:  B.paint(B.SAND)            → 모래색 세 톤
 * 모든 높이 함수는 (x, z, api, d) 를 받는다. api 는 terrain.js 가 주는 잡음 도구.
 * ========================================================================= */
(function (L) {
  'use strict';

  // ------------------------------------------------------------------ 팔레트
  const PAL = {
    GRASS: [0x2c6e3a, 0x3f8f43, 0x57a34a],
    SPRING: [0x57a34a, 0x76c25c, 0x9ad46f],
    AUTUMN: [0x8a5a2a, 0xb06a24, 0xc98a2e],
    WINTER: [0xdfe9ee, 0xf2f6f8, 0xc9d8de],
    SAND: [0xc9ad78, 0xd9c08a, 0xe4cd9e],
    DUNE: [0xd9c08a, 0xe4cd9e, 0xf0dcae],
    ROCK: [0x5a5e60, 0x6c6e68, 0x77797a],
    DARKROCK: [0x33383c, 0x3a3d40, 0x44484c],
    LAVAROCK: [0x2a2020, 0x3a2b28, 0x4a332c],
    WASTE: [0x585c3f, 0x6a6f4a, 0x7c7a52],
    CONCRETE: [0x77797a, 0x8f9296, 0xa3a8ac],
    SEAFLOOR: [0x9a8f68, 0xb5a97c, 0xc9b98a],
    MUD: [0x4a4030, 0x5c5138, 0x6b5f42],
    AMETHYST: [0x4a3a5e, 0x5c4a72, 0x6b5686],
    COAL: [0x2a2d30, 0x33373a, 0x3d4145],
  };

  /** 팔레트에서 잡음으로 한 색 고르기 */
  function paint(pal, opts) {
    const scale = (opts && opts.scale) || 0.07;
    const slopeColor = opts && opts.slope;
    const high = opts && opts.high;      // {y, pal}
    return function (x, z, h, slope, api) {
      if (slopeColor && slope > (opts.slopeAt || 3.2)) {
        return slopeColor[Math.floor(api.valueNoise(x * 0.1, z * 0.1) * slopeColor.length) % slopeColor.length];
      }
      if (high && h > high.y) {
        return high.pal[Math.floor(api.valueNoise(x * 0.09, z * 0.09) * high.pal.length) % high.pal.length];
      }
      const n = api.valueNoise(x * scale, z * scale);
      return pal[Math.min(pal.length - 1, Math.floor(n * pal.length))];
    };
  }

  /** 물 밑은 다른 색으로 */
  function paintWater(dryPal, wetPal, waterY) {
    return function (x, z, h, slope, api) {
      const pal = h < waterY ? wetPal : dryPal;
      const n = api.valueNoise(x * 0.07, z * 0.07);
      return pal[Math.min(pal.length - 1, Math.floor(n * pal.length))];
    };
  }

  // ------------------------------------------------------------------ 높이 공식
  /** 완만한 들판 */
  function plains(o) {
    o = o || {};
    const base = o.base === undefined ? 2 : o.base;
    const amp = o.amp === undefined ? 8 : o.amp;
    const scale = o.scale || 70;
    return function (x, z, api) {
      return base + (api.fbm(x, z, 3, scale) - 0.5) * amp;
    };
  }

  /** 모래언덕 — 물결처럼 이어지는 능선 */
  function dunes(o) {
    o = o || {};
    const amp = o.amp === undefined ? 11 : o.amp;
    const base = o.base === undefined ? 3 : o.base;
    return function (x, z, api) {
      const ridge = Math.sin(x * 0.018 + api.fbm(x, z, 2, 120) * 4) * 0.5 + 0.5;
      const ridge2 = Math.sin(z * 0.014 - api.fbm(x, z, 2, 90) * 3) * 0.5 + 0.5;
      return base + (ridge * 0.6 + ridge2 * 0.4) * amp + (api.fbm(x, z, 3, 40) - 0.5) * 4;
    };
  }

  /** 분지 — 가운데가 낮게 파인다(늪·바다·호수) */
  function basin(o) {
    o = o || {};
    const floor = o.floor === undefined ? -8 : o.floor;
    const rimH = o.rim === undefined ? 4 : o.rim;
    const R = o.r || 200;
    const humps = o.humps === undefined ? 0.6 : o.humps;
    return function (x, z, api, d) {
      const t = api.clamp(d / R, 0, 1);
      let h = api.lerp(floor, rimH, api.smooth(t));
      h += (api.fbm(x, z, 3, 46) - 0.5) * 6;
      if (humps) {
        const hump = api.fbm(x + 700, z - 200, 2, 30);
        if (hump > 0.64) h += (hump - 0.64) * 26 * humps;   // 발 디딜 둔덕
      }
      return h;
    };
  }

  /** 봉우리 — 가운데가 솟는다 */
  function peak(o) {
    o = o || {};
    const top = o.top === undefined ? 80 : o.top;
    const R = o.r || 300;
    const rough = o.rough === undefined ? 16 : o.rough;
    return function (x, z, api, d) {
      const t = api.clamp(1 - d / R, 0, 1);
      return Math.pow(t, o.power || 1.9) * top + (api.fbm(x, z, 4, 50) - 0.5) * rough * (0.35 + t);
    };
  }

  /** 협곡 — 한 축을 따라 깊게 파인 골짜기 */
  function canyon(o) {
    o = o || {};
    const floorY = o.floor === undefined ? -24 : o.floor;
    const rimBase = o.rim === undefined ? 22 : o.rim;
    const axisX = o.axisX;                 // 이 x 를 중심으로 세로로 뻗는다
    const halfBase = o.half || 34;
    const flatHalf = o.flatHalf || 20;
    return function (x, z, api) {
      const rim = rimBase + (api.fbm(x, z, 3, 60) - 0.5) * 18;
      const half = halfBase + (api.fbm(z * 0.6, 120, 2, 55) - 0.5) * 30;
      const dx = Math.abs(x - axisX);
      const floor = floorY + (dx < flatHalf ? 0 : (api.fbm(x, z, 2, 22) - 0.5) * 4);
      if (dx < half) return floor + Math.pow(dx / half, 2.4) * (rim - floor);
      return rim + (api.fbm(x + 300, z, 2, 40) - 0.5) * 10;
    };
  }

  /** 평평한 대지 — 연구소·구역처럼 지어 올린 시설이 서는 자리 */
  function mesa(o) {
    o = o || {};
    const top = o.top === undefined ? 6 : o.top;
    const R = o.r || 150;
    const padR = o.pad || R * 0.55;
    return function (x, z, api, d) {
      const outside = (api.fbm(x, z, 3, 70) - 0.5) * 9;
      if (d < padR) return top;                       // 딱 평평한 부지
      const t = api.clamp((d - padR) / (R - padR), 0, 1);
      return api.lerp(top, outside, api.smooth(t));
    };
  }

  /** 구덩이 — 운석 구덩이 · 오염 지대 · 붕괴한 구역 */
  function crater(o) {
    o = o || {};
    const depth = o.depth === undefined ? -18 : o.depth;
    const rim = o.rim === undefined ? 12 : o.rim;
    const R = o.r || 160;
    return function (x, z, api, d) {
      const t = api.clamp(d / R, 0, 1);
      // 가운데는 푹 파이고 테두리는 솟았다가 다시 낮아진다
      const shape = t < 0.55
        ? api.lerp(depth, rim, api.smooth(t / 0.55))
        : api.lerp(rim, 2, api.smooth((t - 0.55) / 0.45));
      return shape + (api.fbm(x, z, 3, 34) - 0.5) * 6;
    };
  }

  /** 섬 — 물에 둘러싸인 모래 언덕 */
  function island(o) {
    o = o || {};
    const top = o.top === undefined ? 14 : o.top;
    const R = o.r || 150;
    const sea = o.sea === undefined ? -10 : o.sea;
    return function (x, z, api, d) {
      const t = api.clamp(1 - d / (R * 0.62), 0, 1);
      const h = api.lerp(sea, top, api.smooth(t));
      return h + (api.fbm(x, z, 3, 40) - 0.5) * 5 * t;
    };
  }

  /** 용암 지대 — 굳은 바위 사이로 갈라진 틈 */
  function lavaField(o) {
    o = o || {};
    const base = o.base === undefined ? 4 : o.base;
    return function (x, z, api) {
      const crack = Math.abs(api.fbm(x, z, 3, 55) - 0.5);
      let h = base + (api.fbm(x + 300, z, 3, 40) - 0.5) * 12;
      if (crack < 0.06) h -= 7;      // 갈라진 틈(용암이 흐른다)
      return h;
    };
  }

  // ------------------------------------------------------------------ 분위기
  function amb(o) {
    return Object.assign({
      fog: 0xb6d8ef, fogNear: 150, fogFar: 700, sun: 1.0, hemi: 1.0,
    }, o || {});
  }

  const AMB = {
    sunny: amb({}),
    spring: amb({ fog: 0xcbe8d6, fogNear: 160, fogFar: 800, sun: 1.05, hemi: 1.05, sky: 0xdcf0e4 }),
    summer: amb({ fog: 0xcfe9f6, fogNear: 180, fogFar: 900, sun: 1.15, hemi: 1.0, sky: 0xe6f4ff }),
    autumn: amb({ fog: 0xe0c79a, fogNear: 120, fogFar: 620, sun: 0.95, hemi: 0.95, sky: 0xf0d9a8,
      hemiSky: 0xf0d0a0, hemiGround: 0x7a5a2a }),
    winter: amb({ fog: 0xdfeaf2, fogNear: 90, fogFar: 560, sun: 0.85, hemi: 1.0, sky: 0xdfeef7,
      hemiSky: 0xdfeef7, hemiGround: 0x9fb0bc, snow: true }),
    desert: amb({ fog: 0xe8d8a8, fogNear: 200, fogFar: 1000, sun: 1.3, hemi: 1.05, sky: 0xffeec0,
      hemiSky: 0xffe9b8, hemiGround: 0x9a7a44 }),
    lava: amb({ fog: 0x4a2a22, fogNear: 40, fogFar: 260, sun: 0.5, hemi: 0.45, sky: 0x6a2a18,
      hemiSky: 0xff7a3a, hemiGround: 0x30150e }),
    sea: amb({ fog: 0xa8d8ea, fogNear: 120, fogFar: 800, sun: 1.1, hemi: 1.0, sky: 0xd8f0ff }),
    toxic: amb({ fog: 0x7a8a4a, fogNear: 50, fogFar: 300, sun: 0.7, hemi: 0.7, sky: 0x9aa85a,
      hemiSky: 0xc0d070, hemiGround: 0x4a5230 }),
    facility: amb({ fog: 0x8d9aa4, fogNear: 70, fogFar: 420, sun: 0.8, hemi: 0.8, sky: 0xa9b8c2 }),
    haunted: amb({ fog: 0x4a4a58, fogNear: 34, fogFar: 220, sun: 0.42, hemi: 0.45, sky: 0x5a5a6e,
      hemiSky: 0x8a8aa0, hemiGround: 0x2a2a34 }),
    underground: amb({ fog: 0x2f353c, fogNear: 28, fogFar: 150, sun: 0.35, hemi: 0.32, sky: 0x3b4450,
      dark: true, hemiSky: 0x6a5a4a, hemiGround: 0x241f1c }),
  };

  L.BIOME = {
    PAL, paint, paintWater, AMB, amb,
    plains, dunes, basin, peak, canyon, mesa, crater, island, lavaField,
  };
})(window.LEGO);
