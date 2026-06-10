import * as THREE from "three";

export type ItemId = string;
export type TerrainKind = "grass" | "dirt" | "stone" | "ore" | "snow" | "swamp" | "lava";
export type BiomeKind = "bamboo" | "mountain" | "mushroom" | "swamp" | "snow" | "lava";
export type GuardMode = "melee" | "ranged";
export type AnimalKind = "horse" | "cow" | "pig" | "chicken";
export type PredatorKind = "wolf" | "lion" | "spider";
export type BossKind = "dragon" | "fire_dragon" | "red_dragon" | "laser_dragon" | "dark_dragon" | "immortal";
export type HouseKind = "home" | "blacksmith" | "twoStory";
export type QualityMode = "high" | "balanced" | "performance";
export type PlayerClassId = "warrior" | "healer" | "mage" | "summoner" | "gunner" | "tanker";
export type WorldMapId = "starter_valley" | "bamboo_frontier" | "mushroom_glen" | "toxic_swamp" | "mountain_ridge" | "snowfield" | "dragon_lands";
export type ObjectType =
  | "smallTree"
  | "bigTree"
  | "chest"
  | "cave"
  | "caveExit"
  | "houseExit"
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
export type PanelType = "inventory" | "book" | "workbench" | "smelter" | "grinder" | "trade" | "shop" | "sellShop" | "loadGame" | "cheat" | "map" | null;
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
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
  expiresAt?: number;
  mineRich?: boolean;
  caveReturn?: THREE.Vector3;
  collidable?: boolean;
  collisionRadius?: number;
  collisionHeight?: number;
  collisionSegments?: CollisionSegment[];
  villageId?: string;
  foodRemaining?: number;
  angryUntil?: number;
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
  lockedStation?: boolean;
  harvestProgress?: number;
  antMeatRemaining?: number;
  predatorKind?: PredatorKind;
  bossKind?: BossKind;
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
  completedStepIds: string[];
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
    mana?: number;
    maxMana?: number;
    classSkillCooldownRemainingMs?: number;
    companionProgress?: CompanionProgress;
    tutorial?: TutorialProgress;
    hunger?: number;
    hungerTimer?: number;
    worldTimeSeconds?: number;
    worldMapId?: WorldMapId;
    totalSteps: number;
    chestStepBank: number;
    caveStepBank: number;
    equippedArmor: ItemId | null;
    equippedShield?: ItemId | null;
    shieldDurabilityUsed?: number;
    ironGuardRemainingMs?: number;
    locationMode: LocationMode;
    currentHouseKind?: HouseKind;
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
  save: SavedGame;
}

export interface StoredSaveSlot {
  id?: string;
  savedAt?: string;
  label?: string;
  save?: PartialSavedGame;
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
}

export interface BiomeConfig {
  kind: BiomeKind;
  center: THREE.Vector3;
  radius: number;
}
