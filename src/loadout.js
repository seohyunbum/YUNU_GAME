/* =========================================================================
 * loadout.js — 장착 정본(single source of truth)
 *
 *  오른손(hand: 'right') = 무기 7종   → 키 1~7
 *  왼손(hand: 'left')   = 두루마리 스킬 7종 → 키 E 로 넘기기
 *
 * 처음부터 쓰는 건 검·총·폭탄·파이어볼 넷뿐이다.
 * 나머지는 세상 어딘가의 **받침대**에 놓여 있어서, 그 지역까지 찾아가야 얻는다
 * (`find: { region, dx, dz, where }`). world.js 가 그 자리에 받침대를 세운다.
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;

  /** 오른손 무기 */
  const WEAPONS = [
    {
      id: 'sword', name: '검', emoji: '🗡️', key: '1', hand: 'right',
      damage: 42, cooldown: 0.36, reach: 11, arc: 0.85,
      ammo: null, color: C.silver, hint: '가까운 몬스터를 한 번에 여러 마리 베기',
    },
    {
      id: 'blaster', name: '총', emoji: '🔫', key: '2', hand: 'right',
      damage: 20, cooldown: 0.17, speed: 150, ammoMax: 40, ammoPerPickup: 6,
      color: C.blue, hint: '스터드 탄을 빠르게 연사',
    },
    {
      id: 'bomb', name: '폭탄', emoji: '💣', key: '3', hand: 'right',
      damage: 70, cooldown: 0.95, speed: 52, ammoMax: 10, ammoPerPickup: 1,
      radius: 13, fuse: 1.5, color: C.black, hint: '던지면 터진다. 몰려온 무리에 강함',
    },
    {
      id: 'hammer', name: '망치', emoji: '🔨', key: '4', hand: 'right',
      damage: 95, cooldown: 0.85, reach: 12, arc: 1.0, radius: 11, knock: 6,
      color: 0x8f989c, hint: '내리찍으면 땅이 흔들리고 둘레가 통째로 밀린다',
      find: { region: 'oldmine', dx: 0, dz: -18, where: '폐광 갱도 입구' },
    },
    {
      id: 'flamer', name: '화염 방사기', emoji: '🔥', key: '5', hand: 'right',
      dps: 150, cooldown: 0.09, range: 30, cone: 0.34, ammoMax: 120, ammoPerPickup: 20,
      color: 0xff5a10, hint: '누르고 있으면 불을 계속 뿜는다',
      find: { region: 'lava', dx: 26, dz: 26, where: '용암 지대 분화구 옆' },
    },
    {
      id: 'wand', name: '마법 완드', emoji: '🪄', key: '6', hand: 'right',
      damage: 46, cooldown: 0.3, speed: 90, manaCost: 4, homing: 0.9,
      color: 0x9a63e6, hint: '마나를 조금 쓰고, 몬스터를 따라가는 마법탄을 쏜다',
      find: { region: 'museum', dx: 0, dz: 6, where: '유령 미술관 전시실 안' },
    },
    {
      id: 'laser', name: '레이저 총', emoji: '⚡', key: '7', hand: 'right',
      damage: 34, cooldown: 0.12, speed: 320, ammoMax: 90, ammoPerPickup: 14, pierce: true,
      color: 0x63d7e6, hint: '아주 빠른 광선. 줄지어 선 몬스터를 꿰뚫는다',
      find: { region: 'radio', dx: 0, dz: -18, where: '전파 관제소 중앙 제어실' },
    },
  ];

  /** 왼손 두루마리 스킬 */
  const SKILLS = [
    {
      id: 'fireball', name: '파이어볼', emoji: '🔥', key: 'E', hand: 'left',
      mana: 16, cooldown: 0.62, damage: 60, radius: 7, speed: 78,
      color: 0xff7a18, glow: 0xffe08a, rune: 'fireball',
      hint: '값싸고 빠른 불덩이. 기본 스킬',
    },
    {
      id: 'meteor', name: '메테오', emoji: '☄️', key: 'E', hand: 'left',
      mana: 42, cooldown: 3.4, damage: 150, radius: 20, delay: 1.0, dropHeight: 120,
      color: 0xff5a10, glow: 0xffd166, rune: 'meteor',
      hint: '조준한 곳에 거대한 브릭 운석이 떨어진다',
      find: { region: 'meteorpit', dx: 0, dz: 16, where: '별똥별 구덩이 한가운데' },
    },
    {
      id: 'dragonfire', name: '드래곤 파이어', emoji: '🐲', key: 'E', hand: 'left',
      mana: 55, cooldown: 4.6, dps: 130, duration: 2.4, range: 40, cone: 0.42,
      color: 0xff3b00, glow: 0xffb03a, rune: 'dragon',
      hint: '브릭 드래곤 머리가 불을 계속 뿜는다',
      find: { region: 'volcanoisle', dx: 0, dz: 22, where: '화산섬 분화구 앞' },
    },
    {
      id: 'icestorm', name: '아이스 스톰', emoji: '❄️', key: 'E', hand: 'left',
      mana: 38, cooldown: 3.0, damage: 80, radius: 22, delay: 0.7, slow: 3.0,
      color: 0x9fe8ff, glow: 0xd8f4ff, rune: 'ice',
      hint: '조준한 곳이 얼어붙는다. 맞은 몬스터는 한동안 느려진다',
      find: { region: 'icecave', dx: 0, dz: -30, where: '얼음 동굴 안쪽' },
    },
    {
      id: 'lightning', name: '번개 사슬', emoji: '⚡', key: 'E', hand: 'left',
      mana: 30, cooldown: 1.6, damage: 70, range: 60, chain: 5, chainRange: 22,
      color: 0x9fd8ff, glow: 0xffffff, rune: 'bolt',
      hint: '번개가 몬스터에서 몬스터로 다섯 번 튄다',
      find: { region: 'nosignal', dx: 0, dz: -18, where: '전파 통제 불가 구역 안' },
    },
    {
      id: 'tornado', name: '회오리', emoji: '🌪️', key: 'E', hand: 'left',
      mana: 45, cooldown: 4.0, dps: 60, duration: 4.0, radius: 16, pull: 9, speed: 40,
      color: 0xcfe3ef, glow: 0xffffff, rune: 'tornado',
      hint: '회오리가 앞으로 나아가며 몬스터를 끌어당겨 계속 때린다',
      find: { region: 'desert', dx: 40, dz: 30, where: '사막 오아시스 옆' },
    },
    {
      id: 'heal', name: '치유의 빛', emoji: '💚', key: 'E', hand: 'left',
      mana: 40, cooldown: 12, hearts: 2, radius: 10,
      color: 0x7fe08a, glow: 0xd8ffd8, rune: 'heal',
      hint: '하트를 두 칸 채운다. 위급할 때 쓰자',
      find: { region: 'spring', dx: 0, dz: 0, where: '봄 들판 한가운데' },
    },
  ];

  /** 플레이어 기본 수치 */
  const PLAYER = {
    maxHearts: 5,
    maxMana: 100,
    manaRegen: 7.5,        // 초당
    manaPerStud: 9,
    walkSpeed: 22,
    sprintSpeed: 42,
    eyeHeight: 4.6,
    hurtInvuln: 1.1,       // 피격 후 무적 시간
    pickupRange: 4.2,
    findRange: 11,         // 받침대에 이만큼 다가가면 줍는다
  };

  function byId(list, id) {
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** 처음부터 가진 것 */
  function starters() {
    const out = { sword: true, blaster: true, bomb: true, fireball: true };
    return out;
  }

  /** 세상에 놓을 받침대 목록 (무기·스킬 통틀어) */
  function findables() {
    const out = [];
    for (let i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].find) out.push({ kind: 'weapon', def: WEAPONS[i] });
    }
    for (let i = 0; i < SKILLS.length; i++) {
      if (SKILLS[i].find) out.push({ kind: 'skill', def: SKILLS[i] });
    }
    return out;
  }

  L.WEAPONS = WEAPONS;
  L.SKILLS = SKILLS;
  L.PLAYER = PLAYER;
  L.STARTERS = starters;
  L.FINDABLES = findables;
  L.weaponById = (id) => byId(WEAPONS, id);
  L.skillById = (id) => byId(SKILLS, id);
})(window.LEGO);
