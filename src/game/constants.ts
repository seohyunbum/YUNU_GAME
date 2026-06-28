export const WORLD_SIZE = 1800;
export const PLAYER_HEIGHT = 1.7;
export const CROUCH_HEIGHT = 1.15;
export const PRONE_HEIGHT = 0.68;
export const PLAYER_RADIUS = 0.42;
export const WALK_SPEED = 7;
export const RUN_MULTIPLIER = 2;
export const GRAVITY = 24;
export const JUMP_SPEED = 8.5;
export const HUNGER_MAX = 5;
export const HUNGER_TICK_SECONDS = 600; // 배고픔 1 감소 간격 — 종전 300s 의 2배로 완화
export const HUNGER_HP_REGEN = [0, 0, 0.005, 0.015, 0.03, 0.05] as const;

// 침대 등급별 휴식 회복 — 이층집·직접제작침대 > 돌집 > 통나무집. mult = 평소 회복 배수, floorPerSec = 레벨 무관 초당 최소 회복(최대체력 대비). 완전회복까지 ≈ 1/floorPerSec 초.
// (직접제작=일반 침대는 회복이 과해 이층집과 동일 수준으로 하향 — crafted = twoStory.)
export type BedTier = "wood" | "stone" | "twoStory" | "crafted";
export const BED_REST_PROFILE: Record<BedTier, { mult: number; floorPerSec: number }> = {
  wood: { mult: 4, floorPerSec: 0.08 },
  stone: { mult: 5, floorPerSec: 0.1 },
  twoStory: { mult: 6, floorPerSec: 0.12 },
  crafted: { mult: 6, floorPerSec: 0.12 },
};
export const DAY_LENGTH_SECONDS = 3600;
export const CLOUD_COUNT = 34;
export const INTERACT_DISTANCE = 5.2;
export const CHEST_STEP_INTERVAL = 100;
export const CAVE_STEP_INTERVAL = 500;
export const CAVE_START_Z = -780;
export const CAVE_LENGTH = 190;
export const CAVE_WIDTH = 16;
export const CAVE_END_Z = CAVE_START_Z - CAVE_LENGTH;
// 몬스터 요새 디펜스 아레나(siege) — 동굴 인스턴스(locationMode="cave") 안의 정사각 아레나.
// 경계는 물리충돌이 아니라 위치 클램프라 폭 확장이 안전하다.
export const ARENA_HALF = 17; // 정사각 아레나 반폭(34×34)
export const ARENA_CENTER_Z = CAVE_START_Z - CAVE_LENGTH / 2; // 동굴 인스턴스 중앙 ≈ -875
export const SIEGE_WAVE_CLEAR_DELAY = 4; // 웨이브 전멸 후 다음 웨이브까지(초)
export const SIEGE_MAX_ALIVE = 12; // 동시 생존 상한(perf) — 초과분은 다음 스폰으로 이연
export const SIEGE_SPAWN_STAGGER = 0.22; // 스폰 간 최소 간격(초) — 히치 방지
export const CAVE_CENTER_Z = (CAVE_START_Z + CAVE_END_Z) / 2;
export const HOUSE_CENTER_Z = -1240;
export const TRAIN_RADIUS = 476;
export const SAVE_KEY = "ai-game-lab:wilderness-save-v1";
export const SAVE_LIST_KEY = "ai-game-lab:wilderness-saves-v1";
export const SAVE_BACKUP_KEY = "ai-game-lab:wilderness-save-backup-v1";
export const SAVE_HISTORY_KEY = "ai-game-lab:wilderness-save-history-v1"; // 닉네임별 자동 백업 링
export const SAVE_HISTORY_PER_NICKNAME = 8; // 닉네임당 최신 백업 보관 개수(15→8) — 다맵 세이브 localStorage quota 압박 완화(세이브 크기 축소와 병행)
export const SAVE_AUTOSAVE_KEY = "ai-game-lab:wilderness-autosave-v1"; // 별도 자동저장 슬롯 — 수동 저장/슬롯을 절대 덮어쓰지 않는다
export const SAVE_AUTOSAVE_PER_NICKNAME = 1; // 닉네임당 자동저장 1개 슬롯만 — 계속 덮어쓰기(별도 파일 누적 방지)
export const AUTOSAVE_INTERVAL_SECONDS = 60; // 게임 도중 자동저장 주기
export const SAVE_WRITE_TEST_KEY = "ai-game-lab:wilderness-save-write-test";
export const ARCADE_POINTS_KEY = "ai-game-lab:arcade-points-v1";
export const PREDATOR_KILLS_KEY = "ai-game-lab:predator-kills-v1"; // 누적 몬스터 처치 수 — 리로드/세션 넘어 유지(플레이 처음부터)
export const BEST_FORTRESS_STAGE_KEY = "ai-game-lab:best-fortress-stage-v1"; // 몬스터 요새 최고 클리어 단계(쉬움) — 리로드/세션·새 게임 넘어 영구 유지(닉네임당 전역 기록)
export const BEST_FORTRESS_BASELEVEL_KEY = "ai-game-lab:best-fortress-baselevel-v1"; // 최고 단계 기록 당시의 baseLevel(쉬움 — 랭킹 행에 'Lv N' 표기용)
export const BEST_FORTRESS_STAGE_HARD_KEY = "ai-game-lab:best-fortress-stage-hard-v1"; // 몬스터 요새 최고 클리어 단계(어려움) — 난이도별 랭킹 분리
export const BEST_FORTRESS_BASELEVEL_HARD_KEY = "ai-game-lab:best-fortress-baselevel-hard-v1"; // 최고 단계 기록 당시 baseLevel(어려움)
export const BEST_TRAINING_KEY = "ai-game-lab:best-training-v1"; // 훈련 종목별 계정 최고기록(랭킹용 best-ever) — 활성 훈련치(캐릭터별)와 분리, 닉네임당 영구 유지
export const QUALITY_MODE_KEY = "ai-game-lab:quality-mode-v1"; // 사용자가 고른 그래픽 품질(high/balanced/performance) — 유지 + 자동 다운그레이드보다 우선
export const SAVE_VERSION = 14;
export const SAVE_BUILD_ID = "2026-06-26-spirits";
export const MAX_SAVE_SLOTS = 12; // 명명 수동 슬롯 상한(20→12) — 20은 다맵 대형세이브×사본수로 localStorage quota 를 터뜨려 옛 저장이 떨궈짐(공간부족 신고). 세이브 크기 44%↓ 와 함께 12로 조여 안정 보관(원래 10보다는 여유).
export const LOOK_TARGET_REFRESH_SECONDS = 0.08;
export const SPRINT_LOOK_TARGET_REFRESH_SECONDS = 0.2;
export const BASE_BAG_SLOT_COUNT = 8;
export const EXPANDED_BAG_SLOT_COUNT = 40;
export const MEGA_BAG_SLOT_COUNT = 64; // 확장 가방 — 기본 가방(40) 위로 +24칸
export const WORKBENCH_SLOT_COUNT = 9;
export const EXTENDED_WORKBENCH_SLOT_COUNT = 36;
export const SPATIAL_CELL_SIZE = 18;
export const MOUSE_SENSITIVITY_X = 0.0024;
export const MOUSE_SENSITIVITY_Y = 0.002;
// 터치 시점 드래그 — 손가락 px 델타를 rotateCameraByMouse 에 넣을 때 곱하는 배율(마우스 대비). 조정 가능.
export const TOUCH_SENSITIVITY_X = 1.15;
export const TOUCH_SENSITIVITY_Y = 1.05;
// 모바일 렌더 해상도 상한(devicePixelRatio). 0.75=흐릿/픽셀튐 → 1.0 으로 상향(선명도↑, 약간의 GPU 부하). performance 모드 cap(1.0)과 함께 실효 pixelRatio≈1.0.
export const MOBILE_PIXEL_RATIO_CAP = 1.0;
// 모바일 가상 조이스틱을 최대로 밀었을 때 달리기(Shift)로 전환되는 기준(0~1).
export const TOUCH_SPRINT_THRESHOLD = 0.85;
export const MAX_MOUSE_EVENT_DELTA = 4096;
export const NIGHT_PREDATOR_SPAWN_SECONDS = 16;
export const NIGHT_PREDATOR_MAX_COUNT = 8;
export const NIGHT_PREDATOR_MIN_PLAYER_DISTANCE = 70;
export const PREDATOR_RETALIATE_MS = 30_000;
export const CAVE_MAX_ENTRIES = 5; // 동굴 입장 가능 횟수 — 이만큼 들어가면 만료(10분 타이머와 별개, 둘 중 먼저 도달 시 사라짐). 동굴 내부는 플레이어별 인스턴스라 횟수도 플레이어별.
// 야생 몹 밀도 배수 — 초기 시딩·로드 탑업·런타임 야간 캡이 공유(드리프트 방지).
export const WILDLIFE_DENSITY_MUL_HIGH = 2.4; // 고품질/보통 (구 2.0)
export const WILDLIFE_DENSITY_MUL_PERF = 0.85; // 저사양 — 1.5→0.85 하향(포식자 1마리 ~27 메시=27 draw call 이라 저사양 렉 주범). 시작맵 60×0.85≈51마리.
// 맵별 목표 포식자 수(시딩=로드 탑업 공통 기준). 시작맵 60 / 그 외 78 에 밀도 배수.
export function wildlifePredatorTarget(isDefaultMap: boolean, performanceMode: boolean): number {
  return Math.round((isDefaultMap ? 60 : 78) * (performanceMode ? WILDLIFE_DENSITY_MUL_PERF : WILDLIFE_DENSITY_MUL_HIGH));
}
export const FIELD_ANIMAL_COUNT = 40;
export const JAMMINI_FIELD_COUNT = 4;
export const LAVA_DRAGON_SPAWN_CHANCE = 0.005;
export const LAVA_DRAGON_CHECK_SECONDS = 8;
export const DRAGON_MAX_HP = 1000; // 보스 대폭 상향: 체력 +100% (500→1000)
export const DRAGON_ARMOR = 65; // 보스 대폭 상향: 방어 +30% (50→65)
export const DRAGON_BOSS_BAR_DISTANCE = 1;
export const JAMMINI_MAX_HP = 50;
export const LEGO_ARM_DELAY_MS = 900;
export const LEGO_HAZARD_DURATION_MS = 10_000;
export const LEGO_HAZARD_TRIGGER_RADIUS = 0.72;
export const MINI_GAME_PADDLE_HEIGHT = 0.25;
export const MINI_GAME_PADDLE_WIDTH = 0.026;
export const MINI_GAME_BALL_RADIUS = 0.025;
export const LAVA_LANE_COUNT = 5;
export const LAVA_PLAYER_HIT_TOP = 0.74;
export const LAVA_PLAYER_HIT_BOTTOM = 0.96;
export const LAVA_SCORE_PER_CLEAR = 2;
export const SMITHING_ROUND_SECONDS = 120;
export const SMITHING_SUCCESS_POINTS = 50;
export const SMITHING_HITS_REQUIRED = 3;
export const VILLAGER_WALK_SPEED = 0.442; // 주민 이동속도 +30% (0.34 → 0.442)
export const VILLAGER_TARGET_REACHED_DISTANCE = 0.55;
export const VILLAGER_ROAM_SOFT_LIMIT = 0.82;
export const BOW_DAMAGE = 2;
export const MAGIC_WAND_DAMAGE = 4;
export const PROJECTILE_MAX_LIFE = 1.6; // 원거리 사거리 단축(2.2→1.6): 화살 ≈66, 마법 ≈46 — 몬스터 어그로 범위와 격차 축소
export const RANGED_ATTACK_COOLDOWN = 0.42;
export const GUN_FIRE_RATE_SCALE = 0.55; // 총 계열 연사 보정 — 발사 쿨다운 ×0.55 (≈1.8배 발사속도)
export const MAGIC_AOE_RADIUS = 1.8; // 마법 투사체 착탄 시 소형 범위 피해 반경(주 대상 주변 추가타)
export const BASE_MAX_MANA = 100;
export const MANA_REGEN_PER_SECOND = 1;
export const HEALER_HEAL_AMOUNT = 15;
export const HEALER_SKILL_COST = 35;
export const HEALER_SKILL_COOLDOWN = 30;
export const SUMMONER_SKILL_COST = 55;
export const SUMMONER_SKILL_COOLDOWN = 60;
export const EAGLE_MAX_HP = 65;
export const EAGLE_ARMOR = 8;
export const EAGLE_POSSESSION_DURATION_SECONDS = 30;
export const EAGLE_RAM_DAMAGE = 5;
export const EAGLE_CLAW_DAMAGE = 20;
export const EAGLE_CLAW_COOLDOWN = 14;
export const WIND_CUTTER_DAMAGE = 35;
export const WIND_CUTTER_COOLDOWN = 40;
export const EAGLE_ATTACK = EAGLE_RAM_DAMAGE;
export const WARRIOR_SKILL_COST = 35;
export const WARRIOR_SKILL_COOLDOWN = 30;
export const WARRIOR_EXPLOSION_SECONDS = 10;
export const WARRIOR_EXPLOSION_DAMAGE = 20;
export const WARRIOR_EXPLOSION_RADIUS = 4.2;
export const MAGE_TNT_COST = 15;
export const MAGE_TNT_COOLDOWN = 11;
export const MAGE_TNT_DAMAGE = 20;
export const MAGE_TNT_RADIUS = PLAYER_RADIUS * 7.2;
export const GUNNER_SKILL_COST = 45;
export const GUNNER_SKILL_COOLDOWN = 30;
export const GUNNER_SKILL_DAMAGE = 100;
export const TANKER_SKILL_COST = 30;
export const TANKER_SKILL_COOLDOWN = 90;
export const IRON_GUARD_DURATION_SECONDS = 100;
export const IRON_GUARD_ARMOR = 15;
export const PISTOL_DAMAGE = 4;
export const BASE_PLAYER_MAX_HEALTH = 10;
export const BUILDING_BLOCK_SIZE = 1;
export const BUILDING_BLOCK_REACH = 6.2;
export const VISIBILITY_CULL_INTERVAL = 0.35;
export const SPRINT_VISIBILITY_CULL_INTERVAL = 0.5;
export const VISIBILITY_CHANGES_PER_PASS = 160;
export const SPRINT_VISIBILITY_CHANGES_PER_PASS = 70;
export const SPRINT_SHADOW_REFRESH_INTERVAL = 1.4;
export const MOVEMENT_COLLISION_STEP = 0.32;
export const MOVEMENT_HUD_MIN_INTERVAL = 0.18;
// 아웃라인 거리 게이트 — 이 거리 밖 객체는 본체는 보이되 아웃라인(외곽선)만 끔(PC=high 전용; 모바일은 아웃라인 자체 off).
// 먼 외곽선은 서브픽셀이라 체감 품질 손실 ~0. 마을이 스폰서 ~95m → 85면 스폰뷰 마을 외곽선 off, 마을 진입 시 복귀. HUD 로 튜닝.
export const OUTLINE_VISIBILITY_DISTANCE = 85;
// 수동 저장 디바운스 — 직전 저장 완료 후 이 시간(ms) 내 재요청은 무시(버튼 연타·이중발화로 같은-초 중복 슬롯이 생겨 다른 캐릭터 슬롯이 trim 유실되던 크리티컬 버그 방지).
export const SAVE_DEBOUNCE_MS = 1500;
