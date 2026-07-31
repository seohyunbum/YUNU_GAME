/* 밸런스 정본 — 숫자를 만지려면 이 파일만 고친다. */
(function (global) {
  'use strict';
  const LW = (global.LW = global.LW || {});

  /** 도로 좌표계: x 는 -halfWidth..halfWidth, y 는 전진 거리(월드 단위). */
  const world = {
    roadHalfWidth: 4.4,
    playerLine: 0, // 스쿼드 선두는 항상 카메라 기준 고정 라인
    cameraBack: 3.2, // 플레이어 뒤로 보이는 거리
    cameraFront: 19, // 플레이어 앞으로 보이는 거리
  };

  const squad = {
    baseCount: 10,
    maxCount: 999,
    basePerRow: 3,
    maxPerRow: 16, // 병력이 늘면 진형이 도로를 채운다 -> 회피가 어려워진다
    spacingX: 0.52,
    spacingY: 0.62,
    maxDrawn: 54, // 이 이상은 그리지 않고 숫자 배지로 표시
    unitRadius: 0.2,
    moveSpeed: 7.6, // 좌우 이동 (월드 단위/초)
    advanceSpeed: 6.4, // 전진 속도
    fireInterval: 0.26,
    damagePerUnit: 1.5,
    maxBulletsPerVolley: 11,
    bulletSpeed: 22,
    bulletRadius: 0.16,
  };

  const enemyKinds = {
    grunt: { hp: 9, speed: 1.7, radius: 0.3, cost: 1, color: '#8d97a8', bounty: 1 },
    runner: { hp: 6, speed: 3.6, radius: 0.26, cost: 1, color: '#c98a4b', bounty: 1 },
    brute: { hp: 36, speed: 1.05, radius: 0.52, cost: 3, color: '#6f7d95', bounty: 4 },
    shooter: { hp: 14, speed: 1.15, radius: 0.32, cost: 2, color: '#a26bb5', bounty: 3, fireInterval: 2.1 },
  };

  const boss = {
    hp: 480,
    radius: 1.35,
    speed: 0.62,
    contactCost: 8, // 보스가 스쿼드에 닿으면 잃는 병력
    spawnInterval: 3.4,
    fireInterval: 1.55,
    boltSpeed: 7.5,
  };

  const enemyBolt = { radius: 0.2, cost: 1, speed: 7.5 };

  const barricade = { hp: 60, halfWidth: 1.15, thickness: 0.5, crushCost: 6 };

  const scaling = {
    /** 구역이 오를수록 적 체력·수량이 는다. */
    enemyHp: (stage) => 1 + 0.26 * (stage - 1),
    enemyCount: (stage) => 1 + 0.14 * (stage - 1),
    bossHp: (stage) => 1 + 0.72 * (stage - 1),
    length: (stage) => 250 + 26 * (stage - 1),
    reward: (stage) => 26 + 12 * (stage - 1),
  };

  /** 구역 테마 — 배경색과 등장 적 구성. 넘어가면 마지막 테마를 반복(엔드리스). */
  const stages = [
    { name: '1구역 · 폐차장', road: '#2a2f3a', side: '#3c3226', kinds: ['grunt'] },
    { name: '2구역 · 고물 야드', road: '#282f3d', side: '#33402c', kinds: ['grunt', 'runner'] },
    { name: '3구역 · 컨테이너 항', road: '#243040', side: '#25404a', kinds: ['grunt', 'runner', 'brute'] },
    { name: '4구역 · 발전소 터', road: '#2c2836', side: '#432c3a', kinds: ['grunt', 'runner', 'shooter'] },
    { name: '5구역 · 지하 통로', road: '#20242e', side: '#2a2c3a', kinds: ['grunt', 'brute', 'shooter'] },
    { name: '6구역 · 사막 국도', road: '#332d26', side: '#5a4a2f', kinds: ['runner', 'brute', 'shooter'] },
    { name: '7구역 · 눈 덮인 다리', road: '#2b323c', side: '#5c6a78', kinds: ['grunt', 'runner', 'brute', 'shooter'] },
    { name: '8구역 · 용광로', road: '#33262a', side: '#5a2c22', kinds: ['runner', 'brute', 'shooter'] },
    { name: '9구역 · 폐허 도심', road: '#262a33', side: '#3a3a44', kinds: ['grunt', 'runner', 'brute', 'shooter'] },
    { name: '10구역 · 사령부', road: '#1e2432', side: '#2d3a52', kinds: ['grunt', 'runner', 'brute', 'shooter'] },
  ];

  const pools = { bullets: 220, bolts: 80, enemies: 90, particles: 220 };

  /** 최대로 불린 병력 대비 생존 비율로 별 2~3개 (승리 자체가 별 1개). */
  const starThresholds = { two: 0.3, three: 0.6 };

  /** 병력이 커지면 적도 함께 몰려온다 — 안 그러면 후반이 그냥 산책이 된다. */
  const pressure = {
    extraWavePer: 20, // 병력 20명마다 웨이브 적이 한 겹 더
    maxExtraWaves: 6,
    enemyHpPerUnit: 1 / 150, // 병력 150명이면 적 체력 +100%
    maxEnemyHpBonus: 4,
    bossHpPerUnit: 1 / 45, // 큰 부대로 가면 보스도 그만큼 단단해진다
    maxBossHpBonus: 20,
    contactPerUnit: 1 / 200, // 큰 부대는 한 번 부딪힐 때 더 많이 잃는다
    maxContactBonus: 5,
  };

  LW.config = {
    world,
    squad,
    enemyKinds,
    boss,
    enemyBolt,
    barricade,
    scaling,
    stages,
    pools,
    starThresholds,
    pressure,
    stageCount: stages.length,
    stageTheme(stage) {
      return stages[Math.min(stage, stages.length) - 1];
    },
    stageName(stage) {
      if (stage <= stages.length) return stages[stage - 1].name;
      return stage + '구역 · 무한 전선';
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
