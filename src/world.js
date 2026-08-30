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

  /** 지역 정본 — 도시를 가운데 두고 네 겹의 고리로 펼쳐진다 */
  const B = L.BIOME;
  const PAL = B.PAL;

  /** 표를 짧게 쓰기 위한 도우미: 사냥터 하나 */
  function region(o) {
    return Object.assign({
      edge: Math.round((o.r || 260) * 0.34),
      level: 1,
      ambience: B.AMB.sunny,
    }, o);
  }

  const REGIONS = [
    // ================================================================ 안전지대
    region({
      id: 'city', name: '레고 시티', label: '안전지대', cx: 0, cz: -90, r: 240,
      safe: true, icon: '🏙️',
      ambience: B.AMB.sunny,
    }),

    // ================================================================ 첫째 고리 (900)
    region({
      id: 'zombie', name: '좀비 마을', label: '사냥터 · 쉬움', cx: 0, cz: -900, r: 280,
      icon: '🧟', level: 1, entry: { x: 0, z: -682 },
      build: { kind: 'zombie' },
      boss: { type: 'zombie', name: '좀비 두목', scale: 2.4, hpMul: 6, speedMul: 0.8 },
      spawn: { types: ['zombie', 'zombie', 'zombie', 'slime'], max: 11, near: 46, far: 96 },
      height: function (x, z, api, d) {
        const n = api.fbm(x, z, 3, 70) - 0.5;
        return api.lerp(3 + n * 11, 1.2 + n * 2.4, api.smooth(api.clamp(1 - d / 180, 0, 1)));
      },
      color: B.paint([0x6b5f42, 0x5c6b40, 0x6d7a49], { slope: PAL.MUD }),
      ambience: B.amb({ fog: 0x7c8767, fogNear: 60, fogFar: 420, sun: 0.66, hemi: 0.6,
        sky: 0x8a9376, hemiSky: 0xa8b28c, hemiGround: 0x4a4a33 }),
    }),
    region({
      id: 'autumn', name: '가을 숲', label: '사냥터 · 쉬움', cx: 640, cz: -640, r: 280,
      icon: '🍁', level: 1, entry: { x: 470, z: -470 },
      build: { kind: 'forest', season: 'autumn' },
      spawn: { types: ['slime', 'slime', 'bat'], max: 9, near: 46, far: 96 },
      height: B.plains({ base: 4, amp: 14, scale: 80 }),
      color: B.paint(PAL.AUTUMN, { slope: PAL.MUD }),
      ambience: B.AMB.autumn,
    }),
    region({
      id: 'spring', name: '봄 들판', label: '사냥터 · 쉬움', cx: 900, cz: 0, r: 280,
      icon: '🌸', level: 1, entry: { x: 660, z: 0 },
      build: { kind: 'forest', season: 'spring' },
      spawn: { types: ['slime', 'slime', 'wisp'], max: 9, near: 46, far: 96 },
      height: B.plains({ base: 2, amp: 9, scale: 65 }),
      color: B.paint(PAL.SPRING, { slope: PAL.MUD }),
      ambience: B.AMB.spring,
    }),
    region({
      id: 'swamp', name: '늪지대 폐가', label: '사냥터 · 보통', cx: 640, cz: 640, r: 300,
      icon: '🪵', level: 2, waterY: -3.2, entry: { x: 644, z: 892 },
      build: { kind: 'swamp' },
      boss: { type: 'toxic', name: '늪의 왕', scale: 3.0, hpMul: 6, speedMul: 0.9 },
      particles: 'firefly',
      spawn: { types: ['toxic', 'toxic', 'wisp', 'zombie'], max: 11, near: 42, far: 92 },
      height: B.basin({ floor: -9.5, rim: 2, r: 300, humps: 1 }),
      color: B.paintWater([0x44603a, 0x38512f, 0x4a4030], [0x2d3f2c, 0x3a4b32], -4.4),
      ambience: B.amb({ fog: 0x60806a, fogNear: 40, fogFar: 300, sun: 0.55, hemi: 0.62,
        sky: 0x6d8a72, hemiSky: 0x9ec0a2, hemiGround: 0x2f3f2c }),
    }),
    region({
      id: 'summer', name: '여름 해변', label: '사냥터 · 쉬움', cx: 0, cz: 900, r: 300,
      icon: '🏖️', level: 1, waterY: -2.5, entry: { x: 0, z: 660 },
      build: { kind: 'beach' },
      spawn: { types: ['slime', 'wisp', 'toxic'], max: 9, near: 46, far: 96 },
      height: B.basin({ floor: -7, rim: 6, r: 300, humps: 0.4 }),
      color: B.paintWater(PAL.SAND, PAL.SEAFLOOR, -2.5),
      ambience: B.AMB.summer,
    }),
    region({
      id: 'oldmine', name: '폐광', label: '사냥터 · 보통', cx: -640, cz: 640, r: 250,
      icon: '⛏️', level: 2, entry: { x: -470, z: 470 },
      build: { kind: 'mine', ore: 0x6c6e68, oreName: 'ABANDONED MINE', depth: -16 },
      particles: 'dust',
      spawn: { types: ['bat', 'bat', 'golem', 'zombie'], max: 10, near: 44, far: 92 },
      height: B.crater({ depth: -16, rim: 14, r: 250 }),
      color: B.paint(PAL.ROCK, { slope: PAL.DARKROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'cave', name: '깊은 동굴 협곡', label: '사냥터 · 보통', cx: -900, cz: 0, r: 300,
      icon: '💎', level: 2, floorY: -24, entry: { x: -900, z: 262 },
      build: { kind: 'cave' },
      boss: { type: 'crystal', name: '크리스탈 골렘 왕', scale: 2.2, hpMul: 5, speedMul: 0.8 },
      particles: 'dust',
      spawn: { types: ['crystal', 'bat', 'bat', 'golem'], max: 10, near: 44, far: 92 },
      height: B.canyon({ axisX: -900, floor: -24, rim: 24, half: 36, flatHalf: 20 }),
      color: B.paint(PAL.DARKROCK, { high: { y: 6, pal: PAL.ROCK } }),
      ambience: B.AMB.underground,
    }),
    region({
      id: 'winter', name: '겨울 설원', label: '사냥터 · 보통', cx: -640, cz: -640, r: 280,
      icon: '❄️', level: 2, entry: { x: -470, z: -470 },
      build: { kind: 'forest', season: 'winter' },
      particles: 'snow',
      spawn: { types: ['ice', 'bat', 'slime'], max: 9, near: 46, far: 96 },
      height: B.plains({ base: 3, amp: 12, scale: 75 }),
      color: B.paint(PAL.WINTER, { slope: PAL.ROCK }),
      ambience: B.AMB.winter,
    }),

    // ================================================================ 둘째 고리 (1700)
    region({
      id: 'mount', name: '높은 산', label: '사냥터 · 어려움', cx: 650, cz: -1570, r: 390,
      icon: '🏔️', level: 3, entry: { x: 640, z: -1250 },
      build: { kind: 'mount' },
      boss: { type: 'dragon', name: '브릭 드래곤', scale: 1, hpMul: 1, speedMul: 1 },
      particles: 'snow',
      spawn: { types: ['ice', 'ice', 'bat', 'golem'], max: 9, near: 48, far: 100 },
      height: B.peak({ top: 118, r: 390, rough: 20 }),
      color: B.paint(PAL.ROCK, { high: { y: 70, pal: PAL.WINTER }, slope: PAL.DARKROCK }),
      ambience: B.amb({ fog: 0xd2e6f2, fogNear: 120, fogFar: 900, sun: 1.3, hemi: 0.9,
        sky: 0xbcd8ea, hemiSky: 0xdfeef7, hemiGround: 0x9fb0bc, snow: true }),
    }),
    region({
      id: 'desert', name: '사막 지대', label: '사냥터 · 보통', cx: 1570, cz: -650, r: 360,
      icon: '🏜️', level: 2, entry: { x: 1280, z: -650 },
      build: { kind: 'desert' },
      boss: { type: 'sandgolem', name: '사막의 파수꾼', scale: 2.3, hpMul: 5, speedMul: 0.9 },
      spawn: { types: ['sandgolem', 'slime', 'zombie', 'bat'], max: 10, near: 48, far: 100 },
      height: B.dunes({ amp: 13, base: 4 }),
      color: B.paint(PAL.DUNE, { slope: PAL.SAND }),
      ambience: B.AMB.desert,
    }),
    region({
      id: 'sea', name: '바다 · 부두', label: '사냥터 · 보통', cx: 1570, cz: 650, r: 340,
      icon: '🌊', level: 2, waterY: -3, entry: { x: 1280, z: 650 },
      build: { kind: 'sea' },
      spawn: { types: ['toxic', 'wisp', 'slime'], max: 9, near: 46, far: 96 },
      height: B.basin({ floor: -12, rim: 5, r: 340, humps: 0.5 }),
      color: B.paintWater(PAL.SAND, PAL.SEAFLOOR, -3),
      ambience: B.AMB.sea,
    }),
    region({
      id: 'toxicland', name: '오염 지대', label: '사냥터 · 어려움', cx: 650, cz: 1570, r: 290,
      icon: '☢️', level: 3, entry: { x: 650, z: 1280 },
      build: { kind: 'facility', code: 'HAZMAT', theme: 'toxic', tanks: true },
      particles: 'dust',
      boss: { type: 'radslime', name: '오염 덩어리', scale: 3.0, hpMul: 6, speedMul: 0.9 },
      spawn: { types: ['radslime', 'toxic', 'wisp', 'drone'], max: 12, near: 44, far: 94 },
      height: B.crater({ depth: -12, rim: 10, r: 290 }),
      color: B.paint(PAL.WASTE, { slope: PAL.MUD }),
      ambience: B.AMB.toxic,
    }),
    region({
      id: 'sewer', name: '하수도', label: '사냥터 · 보통', cx: -650, cz: 1570, r: 250,
      icon: '🕳️', level: 2, entry: { x: -650, z: 1300 },
      build: { kind: 'sewer' },
      particles: 'dust',
      spawn: { types: ['toxic', 'radslime', 'zombie', 'bat'], max: 11, near: 42, far: 88 },
      height: B.crater({ depth: -14, rim: 8, r: 250 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.DARKROCK }),
      ambience: B.AMB.underground,
    }),
    region({
      id: 'amethyst', name: '자수정 동굴', label: '사냥터 · 보통', cx: -1570, cz: 650, r: 270,
      icon: '🔮', level: 2, entry: { x: -1570, z: 890 },
      build: { kind: 'mine', ore: 0x9a63e6, oreName: 'AMETHYST CAVE', depth: -20, crystals: true },
      particles: 'dust',
      spawn: { types: ['crystal', 'bat', 'golem'], max: 10, near: 44, far: 92 },
      height: B.crater({ depth: -20, rim: 16, r: 270 }),
      color: B.paint(PAL.AMETHYST, { slope: PAL.DARKROCK }),
      ambience: B.AMB.underground,
    }),
    region({
      id: 'goldmine', name: '금광', label: '사냥터 · 어려움', cx: -1570, cz: -650, r: 270,
      icon: '🪙', level: 3, entry: { x: -1570, z: -410 },
      build: { kind: 'mine', ore: 0xdcbe61, oreName: 'GOLD MINE', depth: -18 },
      particles: 'dust',
      spawn: { types: ['golem', 'crystal', 'bat'], max: 10, near: 44, far: 92 },
      height: B.crater({ depth: -18, rim: 15, r: 270 }),
      color: B.paint([0x7a6a48, 0x8f7c52, 0x6c6e68], { slope: PAL.DARKROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'dripstone', name: '점적석 동굴', label: '사냥터 · 보통', cx: -650, cz: -1570, r: 270,
      icon: '🪨', level: 2, entry: { x: -650, z: -1300 },
      build: { kind: 'mine', ore: 0xa3a8ac, oreName: 'DRIPSTONE CAVE', depth: -22, drips: true },
      particles: 'dust',
      spawn: { types: ['bat', 'bat', 'golem', 'crystal'], max: 11, near: 44, far: 92 },
      height: B.crater({ depth: -22, rim: 18, r: 270 }),
      color: B.paint(PAL.DARKROCK, { high: { y: 8, pal: PAL.ROCK } }),
      ambience: B.AMB.underground,
    }),

    // ================================================================ 셋째 고리 (2500)
    region({
      id: 'radio', name: '전파 관제소', label: '시설 · 어려움', cx: 0, cz: -2500, r: 280,
      icon: '📡', level: 3, entry: { x: 0, z: -2230 },
      build: { kind: 'facility', code: 'CONTROL', theme: 'radio', antenna: true, rooms: 3 },
      boss: { type: 'drone', name: '관제 드론 대장', scale: 2.6, hpMul: 6, speedMul: 1 },
      spawn: { types: ['drone', 'drone', 'wisp', 'crystal'], max: 10, near: 46, far: 96 },
      height: B.mesa({ top: 8, r: 280, pad: 150 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'nosignal', name: '전파 통제 불가 구역', label: '시설 · 매우 어려움', cx: 1470, cz: -2020, r: 260,
      icon: '📵', level: 4, entry: { x: 1470, z: -1770 },
      build: { kind: 'facility', code: 'NO SIGNAL', theme: 'radio', broken: true },
      spawn: { types: ['drone', 'wisp', 'ghost', 'crystal'], max: 11, near: 46, far: 96 },
      height: B.mesa({ top: 10, r: 260, pad: 130 }),
      color: B.paint(PAL.ROCK, { slope: PAL.DARKROCK }),
      ambience: B.amb({ fog: 0x6a7a86, fogNear: 40, fogFar: 260, sun: 0.6, hemi: 0.6, sky: 0x7f8f9a }),
    }),
    region({
      id: 'lava', name: '용암 지대', label: '사냥터 · 매우 어려움', cx: 2000, cz: -2900, r: 300,
      icon: '🌋', level: 4, entry: { x: 2000, z: -2620 },
      build: { kind: 'lava' },
      boss: { type: 'flameghost', name: '화염 귀신의 한', scale: 3.0, hpMul: 7, speedMul: 0.9 },
      spawn: { types: ['flameghost', 'golem', 'crystal'], max: 10, near: 46, far: 96 },
      height: B.lavaField({ base: 5 }),
      color: B.paint(PAL.LAVAROCK, { slope: [0x201414] }),
      ambience: B.AMB.lava,
    }),
    region({
      id: 'pyramid', name: '피라미드 유적', label: '사냥터 · 어려움', cx: 2380, cz: -770, r: 300,
      icon: '🔺', level: 3, entry: { x: 2380, z: -490 },
      build: { kind: 'pyramid' },
      boss: { type: 'golem', name: '모래 파수꾼', scale: 2.4, hpMul: 6, speedMul: 0.9 },
      spawn: { types: ['sandgolem', 'zombie', 'slime', 'ghost'], max: 10, near: 46, far: 96 },
      height: B.dunes({ amp: 10, base: 5 }),
      color: B.paint(PAL.SAND, { slope: PAL.DUNE }),
      ambience: B.AMB.desert,
    }),
    region({
      id: 'island', name: '무인도', label: '사냥터 · 보통', cx: 2380, cz: 770, r: 290,
      icon: '🏝️', level: 2, waterY: -4, entry: { x: 2380, z: 1020 },
      build: { kind: 'island' },
      spawn: { types: ['slime', 'toxic', 'wisp'], max: 9, near: 44, far: 92 },
      height: B.island({ top: 16, r: 290, sea: -11 }),
      color: B.paintWater(PAL.SAND, PAL.SEAFLOOR, -4),
      ambience: B.AMB.sea,
    }),
    region({
      id: 'deadsea', name: '폐쇄된 바다', label: '사냥터 · 어려움', cx: 1470, cz: 2020, r: 300,
      icon: '🚢', level: 3, waterY: -3, entry: { x: 1470, z: 2300 },
      build: { kind: 'sea', wrecked: true },
      spawn: { types: ['radslime', 'toxic', 'ghost', 'zombie'], max: 11, near: 46, far: 96 },
      height: B.basin({ floor: -13, rim: 4, r: 300, humps: 0.6 }),
      color: B.paintWater([0x6a6f4a, 0x7c7a52], [0x3a4b32, 0x2d3f2c], -3),
      ambience: B.amb({ fog: 0x6f8a8a, fogNear: 40, fogFar: 300, sun: 0.6, hemi: 0.66, sky: 0x86a0a0 }),
    }),
    region({
      id: 'arena', name: '폐쇄된 공연장', label: '시설 · 어려움', cx: 0, cz: 2500, r: 250,
      icon: '🎪', level: 3, entry: { x: 0, z: 2260 },
      build: { kind: 'arena' },
      boss: { type: 'zombie', name: '무대 위 두목', scale: 2.6, hpMul: 6, speedMul: 0.85 },
      spawn: { types: ['ghost', 'zombie', 'zombie', 'wisp'], max: 12, near: 42, far: 88 },
      height: B.mesa({ top: 6, r: 250, pad: 140 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.haunted,
    }),
    region({
      id: 'museum', name: '유령 미술관', label: '시설 · 어려움', cx: -1470, cz: 2020, r: 250,
      icon: '🖼️', level: 3, entry: { x: -1470, z: 2270 },
      build: { kind: 'museum' },
      boss: { type: 'ghost', name: '미술관 유령', scale: 3.0, hpMul: 7, speedMul: 0.9 },
      spawn: { types: ['ghost', 'ghost', 'wisp', 'zombie'], max: 10, near: 42, far: 88 },
      height: B.mesa({ top: 6, r: 250, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.haunted,
    }),
    region({
      id: 'hauntedhouse', name: '귀신의 집', label: '사냥터 · 어려움', cx: -2380, cz: 770, r: 250,
      icon: '👻', level: 3, entry: { x: -2380, z: 1020 },
      build: { kind: 'haunted' },
      boss: { type: 'ghost', name: '집주인 유령', scale: 3.4, hpMul: 8, speedMul: 0.75 },
      particles: 'firefly',
      spawn: { types: ['ghost', 'ghost', 'wisp', 'bat'], max: 11, near: 42, far: 88 },
      height: B.plains({ base: 3, amp: 10, scale: 60 }),
      color: B.paint([0x4a4a3a, 0x5a5a45, 0x3f4436], { slope: PAL.MUD }),
      ambience: B.AMB.haunted,
    }),
    region({
      id: 'radlab', name: '방사능 연구소', label: '시설 · 매우 어려움', cx: -2380, cz: -770, r: 270,
      icon: '☣️', level: 4, entry: { x: -2380, z: -500 },
      build: { kind: 'facility', code: 'RAD LAB', theme: 'toxic', tanks: true, rooms: 2 },
      particles: 'dust',
      boss: { type: 'radslime', name: '방사능 실험체', scale: 3.2, hpMul: 7, speedMul: 0.85 },
      spawn: { types: ['radslime', 'radslime', 'drone', 'zombie'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 8, r: 270, pad: 140 }),
      color: B.paint(PAL.WASTE, { slope: PAL.CONCRETE }),
      ambience: B.AMB.toxic,
    }),
    region({
      id: 'zombielab', name: '폐쇄된 좀비 연구소', label: '시설 · 매우 어려움', cx: -1470, cz: -2020, r: 270,
      icon: '🧪', level: 4, entry: { x: -1470, z: -1760 },
      build: { kind: 'facility', code: 'BIO LAB', theme: 'zombie', rooms: 2, tanks: true },
      boss: { type: 'zombie', name: '실험체 0호', scale: 2.8, hpMul: 7, speedMul: 0.9 },
      spawn: { types: ['zombie', 'zombie', 'radslime', 'drone'], max: 13, near: 44, far: 92 },
      height: B.mesa({ top: 8, r: 270, pad: 140 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.amb({ fog: 0x5f6a5a, fogNear: 36, fogFar: 240, sun: 0.55, hemi: 0.55, sky: 0x76866f }),
    }),
    region({
      id: 'firelab', name: '화재 감염 연구소', label: '시설 · 매우 어려움', cx: 2900, cz: 2000, r: 270,
      icon: '🔥', level: 4, entry: { x: 2900, z: 2260 },
      build: { kind: 'facility', code: 'BURNT LAB', theme: 'fire', burnt: true, rooms: 2 },
      boss: { type: 'flameghost', name: '불붙은 실험체', scale: 2.8, hpMul: 6, speedMul: 0.95 },
      spawn: { types: ['flameghost', 'zombie', 'ghost', 'crystal'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 270, pad: 140 }),
      color: B.paint([0x4a3a34, 0x5a463c, 0x6a5648], { slope: PAL.LAVAROCK }),
      ambience: B.amb({ fog: 0x6a4a3a, fogNear: 40, fogFar: 260, sun: 0.7, hemi: 0.6, sky: 0x8a5f46 }),
    }),
    region({
      id: 'coalmine', name: '석탄광', label: '사냥터 · 어려움', cx: -2000, cz: 2900, r: 280,
      icon: '🪨', level: 3, entry: { x: -2000, z: 3160 },
      build: { kind: 'mine', ore: 0x2a2d30, oreName: 'COAL MINE', depth: -20 },
      particles: 'dust',
      spawn: { types: ['golem', 'bat', 'zombie'], max: 11, near: 44, far: 92 },
      height: B.crater({ depth: -20, rim: 16, r: 280 }),
      color: B.paint(PAL.COAL, { slope: PAL.DARKROCK }),
      ambience: B.AMB.underground,
    }),
    region({
      id: 'diamondmine', name: '다이아몬드광', label: '사냥터 · 매우 어려움', cx: -2900, cz: -2000, r: 280,
      icon: '💠', level: 4, entry: { x: -2900, z: -1740 },
      build: { kind: 'mine', ore: 0x63d7e6, oreName: 'DIAMOND MINE', depth: -24, crystals: true },
      boss: { type: 'crystal', name: '다이아 골렘', scale: 2.6, hpMul: 7, speedMul: 0.8 },
      particles: 'dust',
      spawn: { types: ['crystal', 'crystal', 'golem', 'bat'], max: 11, near: 44, far: 92 },
      height: B.crater({ depth: -24, rim: 18, r: 280 }),
      color: B.paint([0x3f5560, 0x4a6570, 0x55757f], { slope: PAL.DARKROCK }),
      ambience: B.AMB.underground,
    }),
    region({
      id: 'zombiezone', name: '좀비 폐쇄 구역', label: '시설 · 매우 어려움', cx: -3300, cz: 1500, r: 250,
      icon: '🚧', level: 4, entry: { x: -3300, z: 1740 },
      build: { kind: 'facility', code: 'QUARANTINE', theme: 'zombie', fenced: true },
      spawn: { types: ['zombie', 'zombie', 'zombie', 'drone'], max: 14, near: 42, far: 88 },
      height: B.mesa({ top: 6, r: 250, pad: 130 }),
      color: B.paint(PAL.WASTE, { slope: PAL.CONCRETE }),
      ambience: B.AMB.toxic,
    }),

    // ================================================================ 넷째 고리 — 번호 구역 (3300)
    region({
      id: 'zone1', name: '1구역', label: '구역 · 어려움', cx: 0, cz: -3300, r: 240,
      icon: '①', level: 3, entry: { x: 0, z: -3070 },
      build: { kind: 'facility', code: 'AREA 1', theme: 'zone', accent: 0x0055bf },
      spawn: { types: ['drone', 'zombie', 'crystal'], max: 11, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'zone3', name: '3구역', label: '구역 · 어려움', cx: 2330, cz: -2330, r: 240,
      icon: '③', level: 3, entry: { x: 2330, z: -2100 },
      build: { kind: 'facility', code: 'AREA 3', theme: 'zone', accent: 0x4b9f4a },
      spawn: { types: ['drone', 'golem', 'radslime'], max: 11, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'zone13', name: '13구역', label: '구역 · 매우 어려움', cx: 3300, cz: 0, r: 240,
      icon: '⑬', level: 4, entry: { x: 3070, z: 0 },
      build: { kind: 'facility', code: 'AREA 13', theme: 'zone', accent: 0xc91a09, broken: true },
      boss: { type: 'crystal', name: '13구역 경비 골렘', scale: 2.4, hpMul: 6, speedMul: 0.85 },
      spawn: { types: ['drone', 'drone', 'crystal', 'ghost'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 8, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.DARKROCK }),
      ambience: B.amb({ fog: 0x7a6a6a, fogNear: 40, fogFar: 260, sun: 0.7, hemi: 0.66, sky: 0x8f7c7c }),
    }),
    region({
      id: 'zone75', name: '75구역', label: '구역 · 매우 어려움', cx: 2330, cz: 2330, r: 240,
      icon: '㊆', level: 4, entry: { x: 2330, z: 2560 },
      build: { kind: 'facility', code: 'AREA 75', theme: 'zone', accent: 0xf2cd37 },
      spawn: { types: ['drone', 'radslime', 'crystal'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'zone81', name: '81구역', label: '구역 · 매우 어려움', cx: 0, cz: 3300, r: 240,
      icon: '㊇', level: 4, entry: { x: 0, z: 3070 },
      build: { kind: 'facility', code: 'AREA 81', theme: 'zone', accent: 0x81007b, antenna: true },
      boss: { type: 'wisp', name: '81구역 관측체', scale: 3.0, hpMul: 8, speedMul: 0.8 },
      spawn: { types: ['ghost', 'drone', 'wisp', 'crystal'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 8, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.amb({ fog: 0x5a4a6a, fogNear: 40, fogFar: 260, sun: 0.65, hemi: 0.62, sky: 0x74628a }),
    }),
    region({
      id: 'zone92', name: '92구역', label: '구역 · 매우 어려움', cx: -2330, cz: 2330, r: 240,
      icon: '㊈', level: 4, entry: { x: -2330, z: 2560 },
      build: { kind: 'facility', code: 'AREA 92', theme: 'zone', accent: 0x078bc9 },
      spawn: { types: ['drone', 'crystal', 'ghost'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'zone98', name: '98구역', label: '구역 · 매우 어려움', cx: -3300, cz: 0, r: 240,
      icon: '㊒', level: 4, entry: { x: -3070, z: 0 },
      build: { kind: 'facility', code: 'AREA 98', theme: 'zone', accent: 0xfe8a18, tanks: true },
      spawn: { types: ['radslime', 'drone', 'golem'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.ROCK }),
      ambience: B.AMB.facility,
    }),
    region({
      id: 'zone103', name: '103구역', label: '구역 · 매우 어려움', cx: -2330, cz: -2330, r: 240,
      icon: '㊔', level: 4, entry: { x: -2330, z: -2100 },
      build: { kind: 'facility', code: 'AREA 103', theme: 'zone', accent: 0xa3a8ac, broken: true },
      spawn: { types: ['drone', 'zombie', 'ghost'], max: 12, near: 44, far: 92 },
      height: B.mesa({ top: 7, r: 240, pad: 130 }),
      color: B.paint(PAL.CONCRETE, { slope: PAL.DARKROCK }),
      ambience: B.AMB.facility,
    }),
  ];

  /**
   * 흙길 — 좌표만 적으면 terrain 이 지형 높이에 맞춰 깔아 준다.
   * 도시 여덟 성문에서 첫째 고리로, 거기서 다시 바깥 고리로 이어진다.
   */
  const ROADS = [
    // 도시 → 첫째 고리 (여덟 방향)
    { w: 9, pts: [[0, -248], [0, -450], [0, -682]] },
    { w: 9, pts: [[108, -232], [280, -360], [470, -470]] },
    { w: 9, pts: [[108, -90], [400, -40], [660, 0]] },
    { w: 9, pts: [[108, 60], [340, 420], [560, 760], [644, 892]] },
    { w: 9, pts: [[20, 68], [10, 380], [0, 660]] },
    { w: 9, pts: [[-108, 60], [-280, 300], [-470, 470]] },
    { w: 9, pts: [[-108, -90], [-450, -20], [-760, 120], [-900, 262]] },
    { w: 9, pts: [[-108, -232], [-280, -360], [-470, -470]] },
    // 첫째 고리 → 둘째 고리
    { w: 8, pts: [[0, -1050], [300, -1150], [640, -1250]] },       // 좀비 마을 → 높은 산
    { w: 8, pts: [[900, -140], [1100, -400], [1280, -650]] },      // 봄 들판 → 사막
    { w: 8, pts: [[900, 140], [1100, 400], [1280, 650]] },         // 봄 들판 → 바다
    { w: 8, pts: [[100, 1040], [400, 1180], [650, 1280]] },        // 여름 해변 → 오염 지대
    { w: 8, pts: [[-700, 800], [-680, 1080], [-650, 1300]] },      // 폐광 → 하수도
    { w: 8, pts: [[-1050, 200], [-1350, 560], [-1570, 890]] },     // 동굴 → 자수정
    { w: 8, pts: [[-1050, -160], [-1350, -300], [-1570, -410]] },  // 동굴 → 금광
    { w: 8, pts: [[-660, -840], [-660, -1100], [-650, -1300]] },   // 겨울 → 점적석
    // 둘째 고리 → 셋째 고리
    { w: 7, pts: [[400, -1800], [200, -2000], [0, -2230]] },       // 산 → 전파 관제소
    { w: 7, pts: [[1800, -700], [2100, -600], [2380, -490]] },     // 사막 → 피라미드
    { w: 7, pts: [[1800, 700], [2100, 860], [2380, 1020]] },       // 바다 → 무인도
    { w: 7, pts: [[0, 1240], [0, 1800], [0, 2260]] },              // 여름 해변 → 공연장
  ];

  const PATHS = [];
  for (let i = 0; i < ROADS.length; i++) {
    const r = ROADS[i];
    for (let k = 0; k < r.pts.length - 1; k++) {
      const a = r.pts[k], b = r.pts[k + 1];
      PATHS.push({ ax: a[0], az: a[1], ay: 0, bx: b[0], bz: b[1], by: 0, width: r.w });
    }
  }

  function World(scene, city) {
    this.scene = scene;
    this.city = city;
    this.regions = REGIONS;
    this.byId = {};
    for (let i = 0; i < REGIONS.length; i++) this.byId[REGIONS[i].id] = REGIONS[i];

    const heightRegions = REGIONS.filter((r) => !!r.height);
    // 가까운 지형: 4x4 스터드 브릭, 걸어 다니는 바닥
    this.terrain = new L.Terrain({
      scene,
      regions: heightRegions,
      flatZones: [CITY_ZONE],
      paths: PATHS,
      viewRadius: 420,
    });
    // 먼 지형: 24x24 스터드 큰 판으로 지평선까지. 산이 멀리서도 보이게 하는 층.
    // (살짝 낮게 깔아서 가까운 지형이 항상 이긴다)
    this.farTerrain = new L.Terrain({
      scene,
      regions: heightRegions,
      flatZones: [CITY_ZONE],
      paths: PATHS,
      viewRadius: 1600,
      pitch: 24,
      chunkSize: 480,
      yOffset: -4,
      hideRadius: 560,
      maxChunks: 90,
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
      { x: 0, z: -246, ry: 0, text: 'ZOMBIE VILLAGE', label: '좀비 마을', to: 'zombie' },
      { x: 104, z: -230, ry: -0.7, text: 'AUTUMN WOODS', label: '가을 숲', to: 'autumn' },
      { x: 104, z: -92, ry: -Math.PI / 2, text: 'SPRING FIELD', label: '봄 들판', to: 'spring' },
      { x: 104, z: 58, ry: -2.4, text: 'SWAMP RUIN', label: '늪지대 폐가', to: 'swamp' },
      { x: 22, z: 66, ry: Math.PI, text: 'SUMMER BEACH', label: '여름 해변', to: 'summer' },
      { x: -104, z: 58, ry: 2.4, text: 'OLD MINE', label: '폐광', to: 'oldmine' },
      { x: -104, z: -92, ry: Math.PI / 2, text: 'CRYSTAL CAVE', label: '동굴 협곡', to: 'cave' },
      { x: -104, z: -230, ry: 0.7, text: 'WINTER PLAIN', label: '겨울 설원', to: 'winter' },
    ];
    this.travelPoints = [];
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
      this.travelPoints.push({ x: s.x, z: s.z, to: s.to, label: s.label });
    }
    // 각 사냥터 입구 표지판 → 도시로 돌아가는 지점
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (!r.entry) continue;
      this.travelPoints.push({ x: r.entry.x, z: r.entry.z, to: 'city', label: '레고 시티' });
    }
    g.updateMatrixWorld(true);
    g.traverse((o) => { o.matrixAutoUpdate = false; });
    this.scene.add(g);
    return g;
  };

  /** 빠른 이동: 가까운 표지판 하나 (없으면 null) */
  World.prototype.travelNear = function (x, z, range) {
    const R = range || 15;
    for (let i = 0; i < this.travelPoints.length; i++) {
      const t = this.travelPoints[i];
      if (Math.hypot(x - t.x, z - t.z) < R) return t;
    }
    return null;
  };

  /** 지역 id 의 도착 지점 (도시는 광장) */
  World.prototype.entryOf = function (id) {
    if (id === 'city') return { x: 0, z: 40 };
    const r = this.byId[id];
    return r && r.entry ? r.entry : null;
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
    const kind = region && region.build && region.build.kind;
    if (!kind || !L.REGION_BUILDERS[kind]) return null;
    let c = this.content[region.id];
    if (c) return c;
    const group = new THREE.Group();
    const self = this;
    const ctx = {
      region,
      opt: region.build,                       // 빌더에 넘기는 매개변수
      heightAt: function (x, z) { return self.terrain.heightAt(x, z); },
      terrain: this.terrain,
    };
    const data = L.REGION_BUILDERS[kind](group, ctx);
    group.updateMatrixWorld(true);
    group.traverse((o) => { o.matrixAutoUpdate = false; });
    // 움직이는 소품(모닥불 불꽃 등)은 행렬 갱신을 다시 켜준다
    const moving = [data && data.fire, data && data.camp].concat((data && data.animated) || []);
    for (let i = 0; i < moving.length; i++) {
      if (moving[i]) moving[i].traverse((o) => { o.matrixAutoUpdate = true; });
    }
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
    this.farTerrain.update(px, pz, Math.max(1, Math.round((chunkBudget || 2) / 2)));

    // 가까운 지역의 소품을 준비/표시
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (!r.build || !L.REGION_BUILDERS[r.build.kind]) continue;
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
    return { fog: 0xb6d8ef, fogNear: 180, fogFar: 900, sun: 1.0, hemi: 1.0 };
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
