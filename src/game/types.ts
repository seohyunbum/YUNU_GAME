import * as THREE from "three";
import type { BedTier } from "./constants";

export type ItemId = string;
export type TerrainKind = "grass" | "dirt" | "stone" | "ore" | "snow" | "swamp" | "lava" | "savanna";
export type BiomeKind = "bamboo" | "mountain" | "mushroom" | "swamp" | "snow" | "lava" | "graveyard" | "savanna" | "flower";
export type GuardMode = "melee" | "ranged";
export type AnimalKind = "horse" | "cow" | "pig" | "chicken";
export type PredatorKind = "wolf" | "lion" | "spider" | "boar" | "snake" | "bat" | "scorpion" | "bear" | "zombie" | "ghost" | "drake";
export type BossKind = "dragon" | "fire_dragon" | "red_dragon" | "laser_dragon" | "dark_dragon" | "immortal";
export type HouseKind = "home" | "blacksmith" | "twoStory";
export type QualityMode = "high" | "balanced" | "performance";
export type PlayerClassId = "warrior" | "healer" | "mage" | "summoner" | "gunner" | "tanker";
export type WorldMapId = "starter_valley" | "dragon_plains" | "bamboo_frontier" | "mushroom_glen" | "toxic_swamp" | "mountain_ridge" | "graveyard" | "snowfield" | "dragon_lands";
export type ObjectType =
  | "smallTree"
  | "bigTree"
  | "chest"
  | "cave"
  | "fortressGate"
  | "caveExit"
  | "graveHand"
  | "houseExit"
  | "trainingGround"
  | "trainingRig"
  | "homeStorage"
  | "homeSupply"
  | "dirtPatch"
  | "terrainPatch"
  | "water"
  | "droppedItem"
  | "bed"
  | "buildingBlock"
  | "grinder"
  | "antHill"
  | "wildPredator"
  | "eagleSummon"
  | "summonerPet"
  | "dragon"
  | "jammini"
  | "legoHazard"
  | "ore"
  | "mineChest"
  | "miner"
  | "animal"
  | "villager"
  | "villageKing"
  | "villageFence"
  | "villageShop"
  | "villageSellShop"
  | "blacksmith"
  | "blacksmithNpc"
  | "villageHouse"
  | "villageKnight"
  | "villageArcher"
  | "villageMage"
  | "villageGolem"
  | "foodStorage"
  | "mountain"
  | "train"
  | "workbench"
  | "extendedWorkbench"
  | "smelter"
  | "specialSmelter";
export type PanelType = "inventory" | "book" | "homeStorage" | "training" | "workbench" | "smelter" | "grinder" | "trade" | "shop" | "sellShop" | "loadGame" | "saveOverwrite" | "cheat" | "map" | "character" | null;
export type TrainingKind = "hp" | "attack" | "armor" | "mana";

export interface TrainingStats {
  hp: number;
  attack: number;
  armor: number;
  mana: number;
}

export type LocationMode = "overworld" | "cave" | "house";


export interface Slot {
  item: ItemId | null;
  count: number;
  durabilityUsed?: number;
}

export interface WalkPartSetup {
  object: THREE.Object3D;
  side: number;
  axis: "x" | "z";
}

export interface WalkCycle {
  phase: number;
  speed: number;
  amplitude: number;
  lift: number;
  parts: (WalkPartSetup & { baseRotation: number; baseY: number })[];
}

export type HandActionMode = "use" | "melee" | "bow" | "magic";

export interface CombatProjectile {
  kind: "arrow" | "magic" | "tnt" | "wind";
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  explosionRadius?: number;
}

export interface AreaSkillEffect {
  mesh: THREE.Object3D;
  expiresAt: number;
  nextTickAt: number;
  radius: number;
  damage: number;
  damagedThisTick: Set<string>;
}

export interface CollisionSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  halfWidth: number;
  height: number;
}

export interface WorldObject {
  id: string;
  type: ObjectType;
  name: string;
  root: THREE.Object3D;
  outlines?: THREE.Object3D[]; // 카툰 아웃라인 메시들 — 거리 게이트(updateVisibilityCulling)로 토글. PC(high) 전용, 없으면 undefined.
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
  expiresAt?: number;
  mineRich?: boolean;
  chestTier?: number; // 필드 상자 등급 0 일반 / 1 황금 / 2 다이아 / 3 흑요석
  caveReturn?: THREE.Vector3;
  collidable?: boolean;
  collisionRadius?: number;
  collisionHeight?: number;
  collisionSegments?: CollisionSegment[];
  villageId?: string;
  foodRemaining?: number;
  angryUntil?: number;
  attackCooldown?: number;
  skillCooldown?: number; // 마을 골렘 바위 던지기 등 별도 스킬 쿨다운(초)
  digDepth?: number;
  maxDigDepth?: number;
  terrainKind?: TerrainKind;
  requiresPickaxe?: boolean;
  terrainRadius?: number;
  guardMode?: GuardMode;
  attackRange?: number;
  attackDamage?: number;
  attackInterval?: number;
  animalKind?: AnimalKind;
  wanderAngle?: number;
  wanderTarget?: THREE.Vector3;
  wanderPause?: number;
  fleeUntil?: number;
  fleeFrom?: THREE.Vector3;
  homePosition?: THREE.Vector3;
  roamRadius?: number;
  enterable?: boolean;
  houseChestRich?: boolean;
  houseKind?: HouseKind;
  playerOwned?: boolean;
  homeBed?: boolean;
  bedTier?: BedTier;
  trainingKind?: TrainingKind;
  lockedStation?: boolean;
  harvestProgress?: number;
  antMeatRemaining?: number;
  predatorKind?: PredatorKind;
  bossKind?: BossKind;
  fieldBossId?: string;
  speedBonus?: number; // 추격 속도 가산(필드 보스 개별 상향용) — predatorAi 에서 aggro 속도에 더함
  fortressMonster?: boolean; // 몬스터 요새 동굴에 스폰된 몬스터 — 동굴 전용 AI 대상(오버월드 포식자와 구분)
  fortressBoss?: boolean; // 몬스터 요새 동굴의 끝 보스 — 처치 시 흑요석·전직의서 확정 드랍
  fortressLevel?: number; // 드랍 수량 산정용 — 스폰된 맵 레벨대
  partyTransient?: boolean; // 파티 동기화로 빌려 온 호스트 월드의 뷰 — 세이브/worldState 에 영속 금지
  regionId?: string;
  monsterId?: string;
  monsterLevel?: number;
  lootTier?: number;
  hazardExpiresAt?: number;
  hazardArmedAt?: number;
  hazardThrownAt?: number;
  ultimateUntil?: number;
  ultimateTick?: number;
  trainAngle?: number;
  trainRadius?: number;
  trainSpeed?: number;
  trainDirection?: number;
  trainPause?: number;
  droppedItem?: ItemId;
  droppedCount?: number;
  walkCycle?: WalkCycle;
}

export interface SavedVector {
  x: number;
  y: number;
  z: number;
}

export interface SavedObject {
  type: ObjectType;
  name: string;
  position: SavedVector;
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
  expiresRemainingMs?: number;
  mineRich?: boolean;
  chestTier?: number;
  caveReturn?: SavedVector | null;
  collidable?: boolean;
  collisionRadius?: number;
  collisionHeight?: number;
  villageId?: string;
  foodRemaining?: number;
  angryRemainingMs?: number;
  attackCooldown?: number;
  digDepth?: number;
  maxDigDepth?: number;
  terrainKind?: TerrainKind;
  requiresPickaxe?: boolean;
  terrainRadius?: number;
  guardMode?: GuardMode;
  attackRange?: number;
  attackDamage?: number;
  attackInterval?: number;
  animalKind?: AnimalKind;
  homePosition?: SavedVector;
  roamRadius?: number;
  enterable?: boolean;
  houseChestRich?: boolean;
  houseKind?: HouseKind;
  playerOwned?: boolean;
  bedTier?: BedTier;
  lockedStation?: boolean;
  harvestProgress?: number;
  antMeatRemaining?: number;
  predatorKind?: PredatorKind;
  bossKind?: BossKind;
  regionId?: string;
  monsterId?: string;
  monsterLevel?: number;
  lootTier?: number;
  hazardRemainingMs?: number;
  trainAngle?: number;
  trainRadius?: number;
  trainSpeed?: number;
  trainDirection?: number;
  trainPause?: number;
  droppedItem?: ItemId;
  droppedCount?: number;
  rotationY?: number;
}

export interface SavedWorldState {
  mountains: { position: SavedVector; radius: number; height: number }[];
  objects: SavedObject[];
}

export interface TutorialProgress {
  completedStepIds: string[]; // 보상까지 수령한 단계
  achievedStepIds: string[]; // 조건을 한 번이라도 달성한 단계 (재료 회수 등으로 조건이 풀려도 유지)
}

export interface SavedGame {
  version: number;
  buildId?: string;
  migratedFromVersion?: number;
  savedAt: string;
  player: {
    position: SavedVector;
    previousPosition: SavedVector;
    yaw: number;
    pitch: number;
    health: number;
    maxHealth: number;
    level: number;
    experience: number;
    playerClass?: PlayerClassId;
    jobTier?: number; // 전직 차수 (0=미전직, 1=1차…). 구세이브엔 없음 → 0.
    mana?: number;
    maxMana?: number;
    classSkillCooldownRemainingMs?: number;
    secondSkillCooldownRemainingMs?: number;
    thirdSkillCooldownRemainingMs?: number;
    companionProgress?: CompanionProgress;
    tutorial?: TutorialProgress;
    hunger?: number;
    hungerTimer?: number;
    worldTimeSeconds?: number;
    worldMapId?: WorldMapId;
    bossChapter?: number;
    defeatedFieldBosses?: string[];
    totalSteps: number;
    playSeconds: number;
    chestStepBank: number;
    caveStepBank: number;
    equippedArmor: ItemId | null;
    equippedShield?: ItemId | null;
    equippedNecklace?: ItemId | null;
    shieldDurabilityUsed?: number;
    ironGuardRemainingMs?: number;
    locationMode: LocationMode;
    currentHouseKind?: HouseKind;
    currentHouseBedTier?: BedTier;
    currentHouseOwned?: boolean;
    homeStorage?: Slot[];
    homeSupplyCooldownSeconds?: number; // 레거시(단일 쿨타임) — 마이그레이션 입력용
    homeSupplyCooldowns?: Record<string, number>; // 집 종류별 보급 쿨타임
    trainingStats?: TrainingStats;
    trainingTries?: TrainingStats; // 종목별 최고단계 달성 시도수(랭킹 타이브레이크). 레거시 세이브엔 없음
    craftLevel?: number;
    craftExperience?: number;
    craftStatPoints?: number;
    arcadePoints?: number; // 미니게임/판매 포인트 — 세이브에 포함해 로드 시 롤백(판매→로드 복제 익스플로잇 차단). 구세이브엔 없을 수 있음(optional)
    craftStatAlloc?: { hp: number; mana: number; attack: number; defense: number };
    caveReturnPosition: SavedVector | null;
    houseReturnPosition?: SavedVector | null;
    toolUses?: Record<ItemId, number>;
    selectedHotbarIndex: number;
    hotbar: Slot[];
    bagSlots: Slot[];
    craftSlots: Slot[];
    workbenchSlots?: Slot[];
  };
  mountains: { position: SavedVector; radius: number; height: number }[];
  objects: SavedObject[];
  worldStates?: Partial<Record<WorldMapId, SavedWorldState>>;
}

export interface SaveSlot {
  id: string;
  savedAt: string;
  label: string;
  description?: string;
  save?: SavedGame; // 즉시 사용 가능한 세이브 (레거시 항목/방금 만든 슬롯)
  packed?: string; // 압축 저장본 — resolveSlotSave 로 해제
}

export interface StoredSaveSlot {
  id?: string;
  savedAt?: string;
  label?: string;
  description?: string;
  save?: PartialSavedGame;
  packed?: string;
}

export type PartialSavedGame = Partial<Omit<SavedGame, "player">> & {
  player?: Partial<SavedGame["player"]>;
};

export interface SummonerPetProgress {
  level: number;
  experience: number;
}

export interface CompanionProgress {
  summoner: SummonerPetProgress;
}

export interface Recipe {
  id: string;
  name: string;
  output: ItemId;
  count: number;
  ingredients: Record<ItemId, number>;
  note: string;
  extendedOnly?: boolean;
}

export interface TradeOffer {
  id: string;
  name: string;
  give: Record<ItemId, number>;
  receive: Record<ItemId, number>;
}

export interface PointShopOffer {
  id: string;
  name: string;
  cost: number;
  receive: Record<ItemId, number>;
  note: string;
}

export interface SellShopOffer {
  id: string;
  item: ItemId;
  points: number;
  shopUnitPrice: number;
  note: string;
}

export interface MiniGameState {
  active: boolean;
  playing: boolean;
  gameOver: boolean;
  score: number;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  paddleY: number;
}

export interface LavaHazard {
  id: number;
  lane: number;
  y: number;
  length: number;
  speed: number;
  special?: boolean;
  waveId: number;
}

export interface LavaMiniGameState {
  active: boolean;
  playing: boolean;
  gameOver: boolean;
  score: number;
  playerLane: number;
  hazards: LavaHazard[];
  spawnTimer: number;
  spawnInterval: number;
  fallSpeed: number;
  stage: number;
  wavesUntilSpecial: number;
  nextHazardId: number;
  nextWaveId: number;
}

export type SmithingMaterial = "copper" | "iron" | "gold" | "diamond";

export interface SmithingProduct {
  id: string;
  material: SmithingMaterial;
  name: string;
  kind: "dagger" | "sword" | "axe" | "pickaxe" | "armor";
}

export interface SmithingMiniGameState {
  active: boolean;
  playing: boolean;
  gameOver: boolean;
  score: number;
  successCount: number;
  timeLeft: number;
  order: SmithingProduct;
  currentProduct: SmithingProduct | null;
  hits: number;
  message: string;
}

export interface HouseBuildOption {
  id: string;
  name: string;
  description: string;
  ingredients: Record<ItemId, number>;
  houseKind: HouseKind;
  variant: number;
  craftXp: number;
  bedTier: BedTier;
}

export interface BiomeConfig {
  kind: BiomeKind;
  center: THREE.Vector3;
  radius: number;
}
