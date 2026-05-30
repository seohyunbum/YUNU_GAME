import * as THREE from "three";
import { DEFAULT_AVATAR_APPEARANCE, createAvatarModel, createMirrorModel } from "./avatar";
import { currentObjective } from "./objectives";
import "./style.css";

const WORLD_SIZE = 900;
const PLAYER_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.15;
const PRONE_HEIGHT = 0.68;
const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 7;
const RUN_MULTIPLIER = 2;
const GRAVITY = 24;
const JUMP_SPEED = 8.5;
const HUNGER_MAX = 5;
const HUNGER_TICK_SECONDS = 300;
const DAY_LENGTH_SECONDS = 3600;
const CLOUD_COUNT = 34;
const INTERACT_DISTANCE = 5.2;
const CHEST_STEP_INTERVAL = 100;
const CAVE_STEP_INTERVAL = 500;
const CAVE_START_Z = -780;
const CAVE_LENGTH = 190;
const CAVE_WIDTH = 16;
const CAVE_END_Z = CAVE_START_Z - CAVE_LENGTH;
const CAVE_CENTER_Z = (CAVE_START_Z + CAVE_END_Z) / 2;
const HOUSE_CENTER_Z = -1240;
const TRAIN_RADIUS = 238;
const SAVE_KEY = "ai-game-lab:wilderness-save-v1";
const SAVE_VERSION = 2;
const LOOK_TARGET_REFRESH_SECONDS = 0.08;
const WORKBENCH_SLOT_COUNT = 9;
const EXTENDED_WORKBENCH_SLOT_COUNT = 36;

type ItemId = string;
type TerrainKind = "grass" | "dirt" | "stone" | "ore" | "snow" | "swamp" | "lava";
type GuardMode = "melee" | "ranged";
type AnimalKind = "horse" | "cow" | "pig" | "chicken";
type PredatorKind = "wolf" | "lion" | "spider";
type HouseKind = "home" | "blacksmith" | "twoStory";
type ObjectType =
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
  | "grinder"
  | "antHill"
  | "wildPredator"
  | "ore"
  | "mineChest"
  | "miner"
  | "animal"
  | "villager"
  | "villageKing"
  | "villageFence"
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
type PanelType = "inventory" | "book" | "workbench" | "smelter" | "grinder" | "trade" | "cheat" | null;
type LocationMode = "overworld" | "cave" | "house";

interface Slot {
  item: ItemId | null;
  count: number;
  durabilityUsed?: number;
}

interface WalkPartSetup {
  object: THREE.Object3D;
  side: number;
  axis: "x" | "z";
}

interface WalkCycle {
  phase: number;
  speed: number;
  amplitude: number;
  lift: number;
  parts: (WalkPartSetup & { baseRotation: number; baseY: number })[];
}

interface CollisionSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  halfWidth: number;
  height: number;
}

interface WorldObject {
  id: string;
  type: ObjectType;
  name: string;
  root: THREE.Object3D;
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
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
  trainAngle?: number;
  trainRadius?: number;
  trainSpeed?: number;
  trainDirection?: number;
  trainPause?: number;
  droppedItem?: ItemId;
  droppedCount?: number;
  walkCycle?: WalkCycle;
}

interface SavedVector {
  x: number;
  y: number;
  z: number;
}

interface SavedObject {
  type: ObjectType;
  name: string;
  position: SavedVector;
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
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
  trainAngle?: number;
  trainRadius?: number;
  trainSpeed?: number;
  trainDirection?: number;
  trainPause?: number;
  droppedItem?: ItemId;
  droppedCount?: number;
  rotationY?: number;
}

interface SavedGame {
  version: number;
  savedAt: string;
  player: {
    position: SavedVector;
    previousPosition: SavedVector;
    yaw: number;
    pitch: number;
    health: number;
    maxHealth: number;
    hunger?: number;
    hungerTimer?: number;
    worldTimeSeconds?: number;
    totalSteps: number;
    chestStepBank: number;
    caveStepBank: number;
    equippedArmor: ItemId | null;
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
}

type PartialSavedGame = Partial<Omit<SavedGame, "player">> & {
  player?: Partial<SavedGame["player"]>;
};

interface Recipe {
  id: string;
  name: string;
  output: ItemId;
  count: number;
  ingredients: Record<ItemId, number>;
  note: string;
}

interface TradeOffer {
  id: string;
  name: string;
  give: Record<ItemId, number>;
  receive: Record<ItemId, number>;
}

interface HouseBuildOption {
  id: string;
  name: string;
  description: string;
  ingredients: Record<ItemId, number>;
  houseKind: HouseKind;
  variant: number;
}

interface BiomeConfig {
  kind: "bamboo" | "mountain" | "mushroom" | "swamp" | "snow" | "lava";
  center: THREE.Vector3;
  radius: number;
}

const BIOMES: BiomeConfig[] = [
  { kind: "bamboo", center: new THREE.Vector3(185, 0, -115), radius: 44 },
  { kind: "mountain", center: new THREE.Vector3(-210, 0, -160), radius: 58 },
  { kind: "mushroom", center: new THREE.Vector3(165, 0, 190), radius: 38 },
  { kind: "swamp", center: new THREE.Vector3(-205, 0, 170), radius: 46 },
  { kind: "snow", center: new THREE.Vector3(20, 0, -250), radius: 54 },
  { kind: "lava", center: new THREE.Vector3(305, 0, -268), radius: 48 },
];

const WATER_ZONES = [
  { center: new THREE.Vector3(-58, 0, -46), radius: 23, name: "호수" },
  { center: new THREE.Vector3(112, 0, 78), radius: 17, name: "작은 호수" },
  { center: new THREE.Vector3(-330, 0, 315), radius: 68, name: "바다" },
] as const;
const WATER_RADIUS_MULTIPLIER = 2;

const ITEM_NAMES: Record<ItemId, string> = {
  tutorial_book: "튜토리얼 책",
  wood: "나무",
  stick: "나무 막대기",
  hammer: "망치",
  crafting_table: "제작대",
  extended_workbench: "확장 제작대",
  smelter: "재련대",
  special_smelter: "특수 재련대",
  grinder: "분쇄기",
  mirror: "거울",
  bag: "가방",
  leather: "가죽",
  meat: "고기",
  bed: "침대",
  dirt: "흙",
  stone: "돌",
  coal: "석탄",
  copper: "구리",
  iron: "철",
  gold: "금",
  diamond: "다이아몬드",
  obsidian: "흑요석",
  stone_powder: "돌 가루",
  coal_powder: "석탄 가루",
  copper_powder: "구리 가루",
  iron_powder: "철 가루",
  gold_powder: "금 가루",
  diamond_powder: "다이아몬드 가루",
  obsidian_powder: "흑요석 가루",
  mineral_compound: "광물 혼합물",
  refined_wood: "재련된 나무",
  refined_stone: "재련된 돌",
  refined_copper: "재련된 구리",
  refined_iron: "재련된 철",
  refined_gold: "재련된 금",
  refined_diamond: "재련된 다이아몬드",
  sharp_obsidian: "날카로운 흑요석",
  weak_wood_axe: "약한 나무 도끼",
  sharp_wood_axe: "날카로운 나무 도끼",
  stone_axe: "돌 도끼",
  copper_axe: "구리 도끼",
  iron_axe: "철 도끼",
  gold_axe: "금 도끼",
  diamond_axe: "다이아몬드 도끼",
  wood_shovel: "나무 삽",
  stone_shovel: "돌 삽",
  copper_shovel: "구리 삽",
  iron_shovel: "철 삽",
  gold_shovel: "금 삽",
  diamond_shovel: "다이아몬드 삽",
  wood_pickaxe: "나무 곡괭이",
  stone_pickaxe: "돌 곡괭이",
  copper_pickaxe: "구리 곡괭이",
  iron_pickaxe: "철 곡괭이",
  gold_pickaxe: "금 곡괭이",
  diamond_pickaxe: "다이아몬드 곡괭이",
  wood_dagger: "나무 단검",
  stone_dagger: "돌 단검",
  copper_dagger: "구리 단검",
  iron_dagger: "철 단검",
  gold_dagger: "금 단검",
  diamond_dagger: "다이아몬드 단검",
  obsidian_dagger: "날카로운 흑요석 단검",
  wood_sword: "나무 검",
  stone_sword: "돌 검",
  copper_sword: "구리 검",
  iron_sword: "철 검",
  gold_sword: "금 검",
  diamond_sword: "다이아몬드 검",
  obsidian_sword: "날카로운 흑요석 검",
  leather_armor: "가죽 갑옷",
  copper_armor: "구리 갑옷",
  iron_armor: "철 갑옷",
  gold_armor: "금 갑옷",
  diamond_armor: "다이아몬드 갑옷",
  obsidian_armor: "흑요석 갑옷",
};

const RAW_MATERIALS: ItemId[] = ["wood", "stone", "copper", "iron", "gold", "diamond"];
const SPECIAL_SMELTER_MATERIALS: ItemId[] = [...RAW_MATERIALS, "obsidian"];
const GRINDABLE_MATERIALS: ItemId[] = ["stone", "coal", "copper", "iron", "gold", "diamond", "obsidian"];
const REFINED_BY_RAW: Record<ItemId, ItemId> = {
  wood: "refined_wood",
  stone: "refined_stone",
  copper: "refined_copper",
  iron: "refined_iron",
  gold: "refined_gold",
  diamond: "refined_diamond",
};
const POWDER_BY_MINERAL: Record<ItemId, ItemId> = {
  stone: "stone_powder",
  coal: "coal_powder",
  copper: "copper_powder",
  iron: "iron_powder",
  gold: "gold_powder",
  diamond: "diamond_powder",
  obsidian: "obsidian_powder",
};

const MATERIALS = [
  { raw: "wood", refined: "refined_wood", prefix: "wood", name: "나무", dagger: 5 },
  { raw: "stone", refined: "refined_stone", prefix: "stone", name: "돌", dagger: 10 },
  { raw: "copper", refined: "refined_copper", prefix: "copper", name: "구리", dagger: 20 },
  { raw: "iron", refined: "refined_iron", prefix: "iron", name: "철", dagger: 30 },
  { raw: "gold", refined: "refined_gold", prefix: "gold", name: "금", dagger: 25 },
  { raw: "diamond", refined: "refined_diamond", prefix: "diamond", name: "다이아몬드", dagger: 40 },
] as const;

const WEAPON_DAMAGE: Record<ItemId, number> = {
  wood_dagger: 5,
  stone_dagger: 10,
  copper_dagger: 20,
  iron_dagger: 30,
  gold_dagger: 25,
  diamond_dagger: 40,
  obsidian_dagger: 50,
  wood_sword: 10,
  stone_sword: 20,
  copper_sword: 40,
  iron_sword: 60,
  gold_sword: 50,
  diamond_sword: 80,
  obsidian_sword: 100,
  weak_wood_axe: 3,
  sharp_wood_axe: 6,
  stone_axe: 8,
  copper_axe: 12,
  iron_axe: 16,
  gold_axe: 14,
  diamond_axe: 22,
};

const ARMOR_VALUE: Record<ItemId, number> = {
  leather_armor: 5,
  copper_armor: 10,
  iron_armor: 15,
  gold_armor: 12,
  diamond_armor: 25,
  obsidian_armor: 35,
};

const AXE_POWER: Record<ItemId, number> = {
  weak_wood_axe: 1,
  sharp_wood_axe: 2,
  stone_axe: 2,
  copper_axe: 3,
  iron_axe: 4,
  gold_axe: 3,
  diamond_axe: 5,
};

const PICKAXE_POWER: Record<ItemId, number> = {
  wood_pickaxe: 1,
  stone_pickaxe: 2,
  copper_pickaxe: 3,
  iron_pickaxe: 4,
  gold_pickaxe: 3,
  diamond_pickaxe: 5,
};

const SHOVEL_POWER: Record<ItemId, number> = {
  wood_shovel: 1,
  stone_shovel: 2,
  copper_shovel: 3,
  iron_shovel: 4,
  gold_shovel: 3,
  diamond_shovel: 5,
};

const HARVEST_HARDNESS: Record<ItemId, number> = {
  wood: 3,
  stone: 4,
  coal: 4,
  copper: 5,
  iron: 7,
  gold: 8,
  diamond: 10,
  obsidian: 14,
};

const DURABLE_TOOL_TABLES = [AXE_POWER, PICKAXE_POWER, SHOVEL_POWER];
const DEFAULT_TOOL_DURABILITY = 10;
const TOOL_DURABILITY: Record<ItemId, number> = {
  weak_wood_axe: 10,
  sharp_wood_axe: 10,
  wood_pickaxe: 10,
  wood_shovel: 10,
  stone_axe: 20,
  stone_pickaxe: 20,
  stone_shovel: 20,
  copper_axe: 30,
  copper_pickaxe: 30,
  copper_shovel: 30,
  iron_axe: 45,
  iron_pickaxe: 45,
  iron_shovel: 45,
  gold_axe: 25,
  gold_pickaxe: 25,
  gold_shovel: 25,
  diamond_axe: 80,
  diamond_pickaxe: 80,
  diamond_shovel: 80,
};

const PLACEABLE_TYPES: Record<ItemId, ObjectType> = {
  crafting_table: "workbench",
  extended_workbench: "extendedWorkbench",
  smelter: "smelter",
  special_smelter: "specialSmelter",
  grinder: "grinder",
  bed: "bed",
};

const MINI_RECIPES: Recipe[] = [
  {
    id: "stick",
    name: "나무 막대기",
    output: "stick",
    count: 2,
    ingredients: { wood: 1 },
    note: "미니 제작대에서 나무를 막대기로 쪼갭니다.",
  },
  {
    id: "crafting_table",
    name: "제작대",
    output: "crafting_table",
    count: 1,
    ingredients: { wood: 3, hammer: 1 },
    note: "재료 위치와 상관없이 나무 3개와 망치 1개를 조합합니다.",
  },
  {
    id: "special_smelter",
    name: "특수 재련대",
    output: "special_smelter",
    count: 1,
    ingredients: { smelter: 1, hammer: 1 },
    note: "재련대와 망치를 조합합니다.",
  },
];

const WORKBENCH_RECIPES: Recipe[] = [
  {
    id: "mirror",
    name: "거울",
    output: "mirror",
    count: 1,
    ingredients: { diamond_powder: 6, refined_wood: 6, stone: 6 },
    note: "내 캐릭터 모습을 확인할 수 있습니다. 향후 멀티플레이 캐릭터 표시에도 쓰일 모델입니다.",
  },
  {
    id: "grinder",
    name: "분쇄기",
    output: "grinder",
    count: 1,
    ingredients: { hammer: 2, iron: 6 },
    note: "광물을 가루로 만들 수 있는 설치형 도구입니다.",
  },
  {
    id: "mineral_compound",
    name: "광물 혼합물",
    output: "mineral_compound",
    count: 1,
    ingredients: { stone_powder: 2, iron_powder: 1, coal_powder: 1 },
    note: "가루 광물로 만드는 제작 재료입니다.",
  },
  {
    id: "powder_iron_dagger",
    name: "철 가루 단검",
    output: "iron_dagger",
    count: 1,
    ingredients: { iron_powder: 3, stick: 1 },
    note: "분쇄한 철 가루를 압축해 만든 단검입니다.",
  },
  {
    id: "extended_workbench",
    name: "확장 제작대",
    output: "extended_workbench",
    count: 1,
    ingredients: { crafting_table: 2 },
    note: "제작대 2개를 합쳐 더 큰 제작대로 만듭니다.",
  },
  {
    id: "bag",
    name: "가방",
    output: "bag",
    count: 1,
    ingredients: { leather: 13 },
    note: "인벤토리 가방 공간 40칸을 엽니다.",
  },
  {
    id: "bed",
    name: "침대",
    output: "bed",
    count: 1,
    ingredients: { leather: 3, wood: 3, stick: 3 },
    note: "필드에 설치한 뒤 우클릭으로 자면 체력이 회복됩니다.",
  },
  {
    id: "weak_wood_axe",
    name: "약한 나무 도끼",
    output: "weak_wood_axe",
    count: 1,
    ingredients: { wood: 3, stick: 2 },
    note: "큰 나무를 캘 수 있는 첫 도끼입니다.",
  },
  {
    id: "sharp_wood_axe",
    name: "날카로운 나무 도끼",
    output: "sharp_wood_axe",
    count: 1,
    ingredients: { refined_wood: 3, stick: 2 },
    note: "재련된 나무로 만든 더 좋은 도끼입니다.",
  },
  {
    id: "special_smelter",
    name: "특수 재련대",
    output: "special_smelter",
    count: 1,
    ingredients: { smelter: 1, hammer: 1 },
    note: "흑요석을 재련할 수 있습니다.",
  },
  {
    id: "obsidian_dagger",
    name: "날카로운 흑요석 단검",
    output: "obsidian_dagger",
    count: 1,
    ingredients: { sharp_obsidian: 1, stick: 1 },
    note: "데미지 50.",
  },
  {
    id: "obsidian_sword",
    name: "날카로운 흑요석 검",
    output: "obsidian_sword",
    count: 1,
    ingredients: { sharp_obsidian: 2, stick: 1 },
    note: "데미지 100.",
  },
  {
    id: "leather_armor",
    name: "가죽 갑옷",
    output: "leather_armor",
    count: 1,
    ingredients: { leather: 8 },
    note: "방어력 +5.",
  },
];

const TRADE_OFFERS: TradeOffer[] = [
  { id: "meat_for_iron", name: "고기와 철 교환", give: { meat: 2 }, receive: { iron: 1 } },
  { id: "iron_powder_for_meat", name: "철 가루와 고기 교환", give: { iron_powder: 3 }, receive: { meat: 2 } },
  { id: "copper_powder_for_leather", name: "구리 가루와 가죽 교환", give: { copper_powder: 4 }, receive: { leather: 1 } },
  { id: "coal_powder_for_wood", name: "석탄 가루와 나무 교환", give: { coal_powder: 3 }, receive: { wood: 2 } },
  { id: "diamond_powder_for_gold", name: "다이아몬드 가루와 금 교환", give: { diamond_powder: 1 }, receive: { gold: 3 } },
];

const BLACKSMITH_TRADE_OFFERS: TradeOffer[] = [
  { id: "stone_powder_for_hammer", name: "돌 가루로 망치 교환", give: { stone_powder: 20 }, receive: { hammer: 1 } },
  { id: "copper_powder_for_hammer", name: "구리 가루로 망치 교환", give: { copper_powder: 10 }, receive: { hammer: 1 } },
  { id: "iron_powder_for_hammer", name: "철 가루로 망치 교환", give: { iron_powder: 5 }, receive: { hammer: 1 } },
  { id: "diamond_powder_for_hammer", name: "다이아몬드 가루로 망치 교환", give: { diamond_powder: 1 }, receive: { hammer: 1 } },
  { id: "stone_powder_for_workbench", name: "돌 가루로 제작대 교환", give: { stone_powder: 50 }, receive: { crafting_table: 1 } },
  { id: "copper_powder_for_workbench", name: "구리 가루로 제작대 교환", give: { copper_powder: 25 }, receive: { crafting_table: 1 } },
  { id: "iron_powder_for_workbench", name: "철 가루로 제작대 교환", give: { iron_powder: 12 }, receive: { crafting_table: 1 } },
  { id: "diamond_powder_for_workbench", name: "다이아몬드 가루로 제작대 교환", give: { diamond_powder: 3 }, receive: { crafting_table: 1 } },
  { id: "iron_powder_for_grinder", name: "철/구리 가루로 분쇄기 교환", give: { iron_powder: 18, copper_powder: 12 }, receive: { grinder: 1 } },
  { id: "gold_powder_for_extended_workbench", name: "금/철 가루로 확장 제작대 교환", give: { gold_powder: 8, iron_powder: 8 }, receive: { extended_workbench: 1 } },
  { id: "diamond_powder_for_extended_workbench", name: "다이아몬드 가루로 확장 제작대 교환", give: { diamond_powder: 4, stone_powder: 20 }, receive: { extended_workbench: 1 } },
  { id: "stone_powder_for_smelter", name: "돌/석탄 가루로 제련대 교환", give: { stone_powder: 70, coal_powder: 10 }, receive: { smelter: 1 } },
  { id: "iron_powder_for_smelter", name: "철/석탄 가루로 제련대 교환", give: { iron_powder: 20, coal_powder: 5 }, receive: { smelter: 1 } },
  { id: "obsidian_powder_for_special_smelter", name: "흑요석/다이아몬드 가루로 특수 제련대 교환", give: { obsidian_powder: 6, diamond_powder: 2 }, receive: { special_smelter: 1 } },
];

const HOUSE_BUILD_OPTIONS: HouseBuildOption[] = [
  {
    id: "wood_cabin",
    name: "작은 통나무집",
    description: "가장 기본적인 내 집입니다. 내부에는 상자 하나가 있습니다.",
    ingredients: { wood: 120, stick: 60, stone: 40, hammer: 2 },
    houseKind: "home",
    variant: 0,
  },
  {
    id: "stone_house",
    name: "튼튼한 돌집",
    description: "돌과 철을 많이 쓰는 단단한 집입니다.",
    ingredients: { wood: 120, stone: 150, iron: 24, hammer: 3 },
    houseKind: "home",
    variant: 1,
  },
  {
    id: "two_story_house",
    name: "이층집",
    description: "계단으로 2층까지 오르내릴 수 있는 큰 집입니다.",
    ingredients: { wood: 240, refined_wood: 80, stone: 180, iron: 40, hammer: 4 },
    houseKind: "twoStory",
    variant: 3,
  },
];

for (const material of MATERIALS) {
  if (material.prefix !== "wood") {
    WORKBENCH_RECIPES.push({
      id: `${material.prefix}_axe`,
      name: `${material.name} 도끼`,
      output: `${material.prefix}_axe`,
      count: 1,
      ingredients: { [material.refined]: 3, stick: 2 },
      note: "큰 나무를 더 빠르게 캘 수 있습니다.",
    });
  }

  WORKBENCH_RECIPES.push(
    {
      id: `${material.prefix}_pickaxe`,
      name: `${material.name} 곡괭이`,
      output: `${material.prefix}_pickaxe`,
      count: 1,
      ingredients: material.prefix === "stone" ? { stone: 3, stick: 2 } : { [material.refined]: 3, stick: 2 },
      note: material.prefix === "diamond" ? "흑요석을 캘 수 있습니다." : "광물을 캘 수 있습니다.",
    },
    {
      id: `${material.prefix}_shovel`,
      name: `${material.name} 삽`,
      output: `${material.prefix}_shovel`,
      count: 1,
      ingredients: material.prefix === "wood" ? { wood: 1, stick: 2 } : { [material.refined]: 1, stick: 2 },
      note: "흙을 더 빠르게 팔 수 있습니다.",
    },
    {
      id: `${material.prefix}_dagger`,
      name: `${material.name} 단검`,
      output: `${material.prefix}_dagger`,
      count: 1,
      ingredients: { [material.refined]: 1, stick: 1 },
      note: `데미지 ${material.dagger}.`,
    },
    {
      id: `${material.prefix}_sword`,
      name: `${material.name} 검`,
      output: `${material.prefix}_sword`,
      count: 1,
      ingredients: { [material.refined]: 2, stick: 1 },
      note: `데미지 ${material.dagger * 2}.`,
    },
  );
}

WORKBENCH_RECIPES.push(
  {
    id: "copper_armor",
    name: "구리 갑옷",
    output: "copper_armor",
    count: 1,
    ingredients: { copper: 8 },
    note: "방어력 +10.",
  },
  {
    id: "iron_armor",
    name: "철 갑옷",
    output: "iron_armor",
    count: 1,
    ingredients: { iron: 8 },
    note: "방어력 +15.",
  },
  {
    id: "gold_armor",
    name: "금 갑옷",
    output: "gold_armor",
    count: 1,
    ingredients: { gold: 8 },
    note: "방어력 +12. 멋지지만 튼튼함은 철보다 낮습니다.",
  },
  {
    id: "diamond_armor",
    name: "다이아몬드 갑옷",
    output: "diamond_armor",
    count: 1,
    ingredients: { diamond: 8 },
    note: "방어력 +25.",
  },
  {
    id: "obsidian_armor",
    name: "흑요석 갑옷",
    output: "obsidian_armor",
    count: 1,
    ingredients: { obsidian: 8 },
    note: "방어력 +35.",
  },
);

const TUTORIAL_SECTIONS = [
  "이 게임은 3D 1인칭 야생 생존 게임입니다. 화면을 클릭하면 마우스로 시점을 돌릴 수 있고, WASD로 움직입니다.",
  "시점이 고정된 뒤에는 E키 또는 마우스 좌클릭으로 보고 있는 대상과 상호작용할 수 있습니다.",
  "처음부터 하단 핫바는 8칸입니다. 책은 튜토리얼입니다. I를 눌러 인벤토리, B를 눌러 책을 엽니다.",
  "인벤토리의 집짓기 버튼으로 내 집을 지을 수 있습니다. 작은 통나무집, 튼튼한 돌집, 이층집은 각각 필요한 재료가 다릅니다.",
  "이층집은 내부 계단을 따라 2층으로 오르내릴 수 있습니다.",
  "우클릭은 설치물 사용과 주민/대장장이 거래입니다. 버리기와 설치는 인벤토리에서 아이템을 아래 드롭존으로 드래그앤드롭합니다.",
  "설치한 침대, 제작대, 재련대, 분쇄기는 좌클릭 또는 E로 회수하고 우클릭으로 사용합니다.",
  "작은 나무는 맨손으로 캘 수 있고 나무 1개를 줍니다. 큰 나무는 도끼가 필요하고 나무 5개를 줍니다.",
  "작은 나무도 한 번에 캐지지 않고 기본 3번 휘둘러야 합니다. 고급 도구를 손에 들면 필요한 횟수가 줄어듭니다.",
  "상자는 100걸음마다 50% 확률로 주변에 생깁니다. 상자 안에는 망치가 50%, 재련대가 2% 확률로 들어 있습니다.",
  "인벤토리의 2x2 미니 제작칸은 재료 위치와 상관없이 조합만 맞으면 제작됩니다. 나무 3개와 망치 1개로 제작대를 만듭니다.",
  "제작대를 설치한 뒤 E로 상호작용하면 레시피북이 열립니다. 제작대 2개를 합치면 확장 제작대가 됩니다.",
  "재련대는 나무, 돌, 구리, 철, 금, 다이아몬드를 재련된 재료로 바꿉니다. 특수 재련대는 흑요석을 날카로운 흑요석으로 바꿉니다.",
  "분쇄기는 망치 2개와 철 6개로 만들고, 돌/석탄/구리/철/금/다이아몬드/흑요석을 가루로 바꿉니다. 가루는 제작과 주민 거래에 씁니다.",
  "거울은 다이아몬드 가루 6개, 재련된 나무 6개, 돌 6개로 만들며 내 캐릭터 모습을 확인합니다.",
  "대장간 안의 대장장이는 광물 가루를 망치, 제작대, 확장 제작대, 제련대, 특수 제련대, 분쇄기 같은 제작 도구로 교환해줍니다.",
  "재련된 나무 3개와 막대기 2개는 날카로운 나무 도끼가 됩니다. 일반 나무 3개와 막대기 2개는 약한 나무 도끼가 됩니다.",
  "동굴은 500걸음마다 20% 확률로 주변에 생깁니다. 동굴 안은 좁고 긴 돌 통로이며, 끝 출구나 입구로 야생에 돌아올 수 있습니다.",
  "동굴에는 돌, 석탄, 구리, 철이 나오고 금, 다이아몬드, 흑요석은 드물게 나옵니다. 광물은 모두 곡괭이로만 캘 수 있습니다.",
  "흙과 잔디 지형은 손으로도 팔 수 있습니다. 삽을 만들면 더 깊이, 더 빠르게 팔 수 있고 돌층이 나오면 더 팔 수 없습니다.",
  "광산 상자는 구리 50%, 철 20%, 금 10%, 다이아몬드 5%, 석탄 15% 확률로 광물이 나옵니다. 5% 확률로 여러 광물이 같이 나옵니다.",
  "가방은 가죽 13개로 제작대에서 만듭니다. 가방을 만들면 인벤토리 가방 공간 40칸이 열립니다.",
  "침대는 제작대에서 가죽 3개, 나무 3개, 나무 막대기 3개로 만듭니다. 설치한 침대는 우클릭으로 잠시 자서 체력을 회복합니다.",
  "갑옷은 제작대에서 해당 재료 8개로 만듭니다. 예: 가죽 8개는 가죽 갑옷, 구리 8개는 구리 갑옷입니다.",
  "흑요석은 다이아몬드 곡괭이로만 캘 수 있습니다. 흑요석 단검 데미지는 50, 흑요석 검 데미지는 100입니다.",
  "플레이어 기본 체력은 10, 방어력은 0입니다. 갑옷을 만들면 자동으로 가장 좋은 갑옷을 입습니다.",
  "마을에는 주민, 집, 식량창고, 마을기사, 수호신 골렘이 있습니다. 주민은 체력 10이고 마을 안에서 천천히 움직입니다.",
  "마을마다 수호신 골렘이 1마리 있습니다. 골렘은 체력 100, 근거리 피해 9, 공격 간격 5초입니다.",
  "집이 15채 이상인 큰 마을에는 1% 확률로 왕이 나타납니다. 마을 주변에는 울타리가 둘러져 있습니다.",
  "마을에는 50% 확률로 대장간이 있습니다. 대장간 안의 특수 제련대, 확장 제작대, 분쇄기는 회수할 수 없지만 사용할 수 있습니다.",
  "밤에는 늑대, 사자, 거미 같은 위험한 야생동물이 나타납니다. 저녁에는 100걸음마다 10% 확률로 개미굴이 생기고, 개미굴에서 고기를 최대 5번 얻을 수 있습니다.",
  "죽으면 튜토리얼 책을 제외한 모든 아이템이 죽은 자리에 떨어집니다. 다시 찾아가면 주울 수 있습니다.",
  "식량창고를 털거나 주민, 기사, 골렘을 공격하면 기사와 골렘이 반격합니다.",
  "잔디와 흙은 손이나 삽으로 팔 수 있고, 돌 지형과 광석 지형은 곡괭이로만 캘 수 있습니다.",
  "Shift+W를 누르면 달리기, Shift만 누르면 웅크리기, C를 누르면 엎드리기 상태가 됩니다.",
  "기차가 선로를 따라 움직입니다. 가까이서 E를 누르면 타고, 다시 E를 누르면 내립니다.",
  "말, 소, 돼지, 닭은 천천히 돌아다니며 공격받으면 잠시 도망갑니다.",
  "호수와 바다 같은 물 지형이 있습니다. 물가 주변에서 방향을 잡아 탐험할 수 있습니다.",
  "도끼, 삽, 곡괭이는 재료별 내구도가 있습니다. 나무 10회, 돌 20회, 구리 30회, 철 45회, 금 25회, 다이아몬드 80회 사용하면 부서집니다.",
  "주민 집은 들어갈 수 있습니다. 집 안에는 일반 상자 또는 광산 상자가 하나 있습니다.",
  "일반 마을기사는 가까이 붙어야 공격합니다. 궁수와 마법사는 집이 10채 이상인 큰 마을에서만 나타납니다.",
  "대나무숲, 산악, 버섯, 늪, 눈 지형은 색과 식물이 다릅니다. 특히 대나무 지형에는 대나무가 아주 빽빽합니다.",
  "용암 지대는 검은 암석과 뜨거운 용암으로 이루어진 위험 지역입니다. 오래 밟고 있으면 체력이 줄어듭니다.",
  "테스트용 치트가 필요하면 F4를 눌러 원하는 아이템을 바로 받을 수 있습니다.",
  "왼쪽 위 버튼이나 Ctrl+S로 저장, Ctrl+L로 불러오기, N으로 새로시작을 할 수 있습니다.",
];

class WildernessGame {
  private readonly container: HTMLDivElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1200);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly objects = new Map<string, WorldObject>();
  private readonly raycastTargets: THREE.Object3D[] = [];
  private readonly raycastTargetsByObject = new Map<string, THREE.Object3D[]>();
  private readonly waterObjects: WorldObject[] = [];
  private readonly mountains: { position: THREE.Vector3; radius: number; height: number }[] = [];
  private readonly mountainMeshes: THREE.Object3D[] = [];
  private readonly biomeMeshes: THREE.Object3D[] = [];
  private readonly cloudLayer = new THREE.Group();
  private readonly ambientLight = new THREE.HemisphereLight(0xeaf7ff, 0x49623d, 2.2);
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
  private groundMesh: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private readonly hotbar: Slot[] = [
    { item: "tutorial_book", count: 1 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
  ];
  private readonly bagSlots: Slot[] = [];
  private readonly craftSlots: Slot[] = Array.from({ length: 4 }, () => ({ item: null, count: 0 }));
  private readonly workbenchSlots: Slot[] = Array.from({ length: EXTENDED_WORKBENCH_SLOT_COUNT }, () => ({ item: null, count: 0 }));
  private readonly uiRoot = document.createElement("div");
  private readonly statsEl = document.createElement("div");
  private readonly objectiveEl = document.createElement("div");
  private readonly promptEl = document.createElement("div");
  private readonly hotbarEl = document.createElement("div");
  private readonly messageEl = document.createElement("div");
  private readonly panelEl = document.createElement("div");
  private readonly saveControlsEl = document.createElement("div");
  private readonly titleScreenEl = document.createElement("div");
  private readonly mirrorView = new THREE.Group();
  private readonly handGroup = new THREE.Group();
  private readonly heldItemGroup = new THREE.Group();
  private heldItemKey: ItemId | null = null;
  private selectedHotbarIndex = 0;
  private selectedCraftItem: ItemId | null = null;
  private currentPanel: PanelType = null;
  private currentStationId: string | null = null;
  private yaw = 0;
  private pitch = 0;
  private playerPosition = new THREE.Vector3(0, PLAYER_HEIGHT, 12);
  private previousPosition = this.playerPosition.clone();
  private verticalVelocity = 0;
  private isGrounded = true;
  private jumpWasDown = false;
  private totalSteps = 0;
  private chestStepBank = 0;
  private caveStepBank = 0;
  private antStepBank = 0;
  private worldTimeSeconds = DAY_LENGTH_SECONDS * (8 / 24);
  private timeHudTimer = 0;
  private health = 10;
  private maxHealth = 10;
  private hunger = HUNGER_MAX;
  private hungerTimer = 0;
  private starvationTimer = 0;
  private starvationNoticeTimer = 0;
  private lavaDamageTimer = 0;
  private equippedArmor: ItemId | null = null;
  private locationMode: LocationMode = "overworld";
  private currentHouseKind: HouseKind = "home";
  private caveReturnPosition: THREE.Vector3 | null = null;
  private houseReturnPosition: THREE.Vector3 | null = null;
  private caveObjectIds: string[] = [];
  private houseObjectIds: string[] = [];
  private ridingTrainId: string | null = null;
  private readonly toolUses: Record<ItemId, number> = {};
  private messageTimer = 0;
  private lastTargetId: string | null = null;
  private promptRefreshTimer = 0;
  private actionTimer = 0;
  private ctrlWBlocked = false;
  private readonly damageParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }[] = [];
  private gameStarted = false;
  private nightSpawnTimer = 0;
  private mirrorViewTimer = 0;
  private audioContext: AudioContext | null = null;
  private bgmOscillator: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.setupRenderer();
    this.setupScene();
    this.setupUi();
    this.setupEvents();
    this.seedOverworld();
    this.renderHud();
    this.animate();
  }

  private setupRenderer() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.domElement.className = "game-canvas";
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.copy(this.playerPosition);
  }

  private setupScene() {
    this.scene.background = new THREE.Color(0xaed8ff);
    this.scene.fog = new THREE.Fog(0xaed8ff, 70, 460);

    this.scene.add(this.ambientLight);
    this.sunLight.position.set(80, 140, 40);
    this.scene.add(this.sunLight);
    this.scene.add(this.camera);
    this.createFirstPersonHand();
    this.setupMirrorView();

    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x5fa85c, roughness: 0.95 }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.name = "grassland";
    this.scene.add(this.groundMesh);

    this.gridHelper = new THREE.GridHelper(WORLD_SIZE, 90, 0x40794d, 0x78b36a);
    this.gridHelper.position.y = 0.012;
    this.scene.add(this.gridHelper);
    this.createCloudLayer();
    this.applyTimeOfDay();
  }

  private createCloudLayer() {
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });

    for (let i = 0; i < CLOUD_COUNT; i += 1) {
      const cloud = new THREE.Group();
      const puffCount = THREE.MathUtils.randInt(3, 6);
      for (let puffIndex = 0; puffIndex < puffCount; puffIndex += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(1.8, 4.6), 12, 8), baseMaterial.clone());
        puff.scale.set(THREE.MathUtils.randFloat(1.5, 2.7), THREE.MathUtils.randFloat(0.32, 0.62), THREE.MathUtils.randFloat(0.8, 1.4));
        puff.position.set(THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloatSpread(1.4), THREE.MathUtils.randFloatSpread(5.2));
        puff.castShadow = false;
        puff.receiveShadow = false;
        cloud.add(puff);
      }
      cloud.position.set(THREE.MathUtils.randFloatSpread(WORLD_SIZE * 0.92), THREE.MathUtils.randFloat(48, 84), THREE.MathUtils.randFloatSpread(WORLD_SIZE * 0.92));
      cloud.userData.speed = THREE.MathUtils.randFloat(0.45, 1.15);
      cloud.userData.drift = THREE.MathUtils.randFloat(-0.1, 0.1);
      cloud.userData.wrap = WORLD_SIZE * 0.56;
      this.cloudLayer.add(cloud);
    }

    this.scene.add(this.cloudLayer);
  }

  private setupMirrorView() {
    const mirrorFrame = createMirrorModel(1.35);
    mirrorFrame.position.set(0, 1.25, -0.08);
    const avatar = createAvatarModel(DEFAULT_AVATAR_APPEARANCE);
    avatar.position.set(0, -0.48, 0.22);
    avatar.rotation.y = 0;
    avatar.scale.setScalar(0.64);
    this.mirrorView.add(mirrorFrame, avatar);
    this.mirrorView.position.set(0, -0.18, -3.4);
    this.mirrorView.rotation.set(0, 0, 0);
    this.mirrorView.visible = false;
    this.camera.add(this.mirrorView);
  }

  private updateTimeOfDay(delta: number) {
    this.worldTimeSeconds = (this.worldTimeSeconds + delta) % DAY_LENGTH_SECONDS;
    const wrap = WORLD_SIZE * 0.56;
    for (const cloud of this.cloudLayer.children) {
      cloud.position.x += (cloud.userData.speed ?? 0.8) * delta;
      cloud.position.z += (cloud.userData.drift ?? 0) * delta;
      if (cloud.position.x > wrap) cloud.position.x = -wrap;
      if (cloud.position.x < -wrap) cloud.position.x = wrap;
      if (cloud.position.z > wrap) cloud.position.z = -wrap;
      if (cloud.position.z < -wrap) cloud.position.z = wrap;
    }

    if (this.locationMode === "overworld") this.applyTimeOfDay();
    this.timeHudTimer += delta;
    if (this.timeHudTimer >= 1) {
      this.timeHudTimer = 0;
      this.renderHud();
    }
  }

  private applyTimeOfDay() {
    if (this.locationMode !== "overworld") return;
    const hour = this.gameHour();
    const stops = [
      { hour: 0, sky: 0x06101f, fog: 0x050814, ambient: 0.36, sun: 0.02, cloud: 0x8695b6, opacity: 0.45, fogFar: 310 },
      { hour: 4.6, sky: 0x233659, fog: 0x182944, ambient: 0.64, sun: 0.12, cloud: 0xaab7d6, opacity: 0.58, fogFar: 340 },
      { hour: 6.2, sky: 0xf0a269, fog: 0xb7816b, ambient: 1.4, sun: 1.15, cloud: 0xffd5aa, opacity: 0.76, fogFar: 410 },
      { hour: 8.5, sky: 0x9fd8ff, fog: 0x9fd8ff, ambient: 2.0, sun: 2.25, cloud: 0xffffff, opacity: 0.84, fogFar: 465 },
      { hour: 13.0, sky: 0xaed8ff, fog: 0xaed8ff, ambient: 2.25, sun: 2.7, cloud: 0xffffff, opacity: 0.86, fogFar: 480 },
      { hour: 17.8, sky: 0xf19a65, fog: 0xa86f68, ambient: 1.45, sun: 1.05, cloud: 0xffc49d, opacity: 0.74, fogFar: 405 },
      { hour: 20.4, sky: 0x14213d, fog: 0x101827, ambient: 0.56, sun: 0.07, cloud: 0x8796b7, opacity: 0.5, fogFar: 320 },
      { hour: 24, sky: 0x06101f, fog: 0x050814, ambient: 0.36, sun: 0.02, cloud: 0x8695b6, opacity: 0.45, fogFar: 310 },
    ];
    const nextIndex = stops.findIndex((stop) => hour <= stop.hour);
    const after = stops[Math.max(1, nextIndex)];
    const before = stops[Math.max(0, Math.max(1, nextIndex) - 1)];
    const span = Math.max(0.001, after.hour - before.hour);
    const rawT = THREE.MathUtils.clamp((hour - before.hour) / span, 0, 1);
    const t = rawT * rawT * (3 - 2 * rawT);
    const skyColor = new THREE.Color(before.sky).lerp(new THREE.Color(after.sky), t);
    const fogColor = new THREE.Color(before.fog).lerp(new THREE.Color(after.fog), t);
    const cloudColor = new THREE.Color(before.cloud).lerp(new THREE.Color(after.cloud), t);
    const ambientIntensity = THREE.MathUtils.lerp(before.ambient, after.ambient, t);
    const sunIntensity = THREE.MathUtils.lerp(before.sun, after.sun, t);
    const fogFar = THREE.MathUtils.lerp(before.fogFar, after.fogFar, t);

    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(fogColor, 70, fogFar);
    this.ambientLight.intensity = ambientIntensity;
    this.ambientLight.color.copy(new THREE.Color(0xeaf7ff).lerp(skyColor, 0.24));
    this.ambientLight.groundColor.copy(new THREE.Color(0x39542c).lerp(fogColor, 0.22));
    this.sunLight.intensity = sunIntensity;
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
    this.sunLight.position.set(Math.cos(sunAngle) * 120, Math.max(-28, Math.sin(sunAngle) * 150), 55);

    const cloudOpacity = THREE.MathUtils.lerp(before.opacity, after.opacity, t);
    this.cloudLayer.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.copy(cloudColor);
        child.material.opacity = cloudOpacity;
        child.material.needsUpdate = true;
      }
    });
    if (this.bgmOscillator && this.audioContext && this.bgmGain) {
      const night = hour >= 20 || hour < 5;
      this.bgmOscillator.frequency.setTargetAtTime(night ? 72 : 96, this.audioContext.currentTime, 0.8);
      this.bgmGain.gain.setTargetAtTime(night ? 0.024 : 0.016, this.audioContext.currentTime, 0.8);
    }
  }

  private gameHour() {
    return (this.worldTimeSeconds / DAY_LENGTH_SECONDS) * 24;
  }

  private timeOfDayName(hour = this.gameHour()) {
    if (hour < 4.5) return "밤";
    if (hour < 7) return "새벽";
    if (hour < 11) return "아침";
    if (hour < 17) return "낮";
    if (hour < 20) return "저녁";
    return "밤";
  }

  private gameClockText(hour = this.gameHour()) {
    const totalMinutes = Math.floor(hour * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
    return `${hours}시`;
  }

  private createFirstPersonHand() {
    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x2f4668, roughness: 0.78 }),
    );
    upperArm.position.set(0.47, -0.34, -1.0);
    upperArm.rotation.set(-0.48, -0.14, 0.18);

    const forearm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.75 }),
    );
    forearm.position.set(0.36, -0.4, -1.18);
    forearm.rotation.set(-0.46, -0.2, 0.16);

    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.1, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x243b5a, roughness: 0.75 }),
    );
    sleeve.position.set(0.27, -0.45, -1.35);
    sleeve.rotation.set(-0.38, -0.22, 0.13);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.09, 0.13),
      new THREE.MeshStandardMaterial({ color: 0xd5a16f, roughness: 0.7 }),
    );
    hand.position.set(0.22, -0.48, -1.48);
    hand.rotation.set(-0.28, -0.18, 0.1);

    this.heldItemGroup.position.set(0.18, -0.5, -1.52);
    this.heldItemGroup.rotation.set(-0.34, -0.22, -0.12);
    this.handGroup.add(upperArm, forearm, sleeve, hand, this.heldItemGroup);
    this.handGroup.position.set(0, 0, 0);
    this.camera.add(this.handGroup);
  }

  private setOverworldAtmosphere() {
    this.applyTimeOfDay();
    if (this.groundMesh) this.groundMesh.visible = true;
    if (this.gridHelper) this.gridHelper.visible = true;
    this.cloudLayer.visible = true;
    for (const mesh of this.biomeMeshes) mesh.visible = true;
  }

  private setCaveAtmosphere() {
    this.scene.background = new THREE.Color(0x08090b);
    this.scene.fog = new THREE.Fog(0x08090b, 18, 96);
    this.ambientLight.intensity = 0.7;
    this.sunLight.intensity = 0.08;
    if (this.groundMesh) this.groundMesh.visible = false;
    if (this.gridHelper) this.gridHelper.visible = false;
    this.cloudLayer.visible = false;
    for (const mesh of this.biomeMeshes) mesh.visible = false;
  }

  private setHouseAtmosphere() {
    this.scene.background = new THREE.Color(0x1a1510);
    this.scene.fog = new THREE.Fog(0x1a1510, 18, 82);
    this.ambientLight.intensity = 1.15;
    this.sunLight.intensity = 0.18;
    if (this.groundMesh) this.groundMesh.visible = false;
    if (this.gridHelper) this.gridHelper.visible = false;
    this.cloudLayer.visible = false;
    for (const mesh of this.biomeMeshes) mesh.visible = false;
  }

  private setupUi() {
    this.uiRoot.className = "game-ui";
    this.statsEl.className = "stats";
    this.objectiveEl.className = "objective";
    this.promptEl.className = "prompt";
    this.hotbarEl.className = "hotbar";
    this.messageEl.className = "message";
    this.panelEl.className = "panel-layer";
    this.saveControlsEl.className = "save-controls";
    this.saveControlsEl.innerHTML = `
      <button data-new-game>새로시작</button>
      <button data-save-game>저장</button>
      <button data-load-game>불러오기</button>
    `;
    this.titleScreenEl.className = "title-screen";
    this.titleScreenEl.innerHTML = `
      <div class="title-village-scene" aria-hidden="true">
        <div class="title-sun"></div>
        <div class="title-hut title-hut-a"></div>
        <div class="title-hut title-hut-b"></div>
        <div class="title-king"></div>
        <div class="title-crowd">
          ${Array.from({ length: 10 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}
        </div>
      </div>
      <div class="title-menu">
        <h1>AI 야생 마을</h1>
        <p>마을, 동굴, 기차, 밤의 야생동물을 탐험하는 1인칭 생존 게임</p>
        <div class="title-actions">
          <button data-title-new>새로시작</button>
          <button data-title-load>불러오기</button>
        </div>
      </div>
    `;
    this.uiRoot.innerHTML = '<div class="crosshair"></div>';
    this.uiRoot.append(this.objectiveEl, this.statsEl, this.saveControlsEl, this.promptEl, this.hotbarEl, this.messageEl, this.panelEl, this.titleScreenEl);
    this.container.appendChild(this.uiRoot);

    this.saveControlsEl.querySelector<HTMLButtonElement>("[data-new-game]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.newGame();
    });
    this.saveControlsEl.querySelector<HTMLButtonElement>("[data-save-game]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.saveGame();
    });
    this.saveControlsEl.querySelector<HTMLButtonElement>("[data-load-game]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.loadGame();
    });
    this.titleScreenEl.querySelector<HTMLButtonElement>("[data-title-new]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.startGame("new");
    });
    this.titleScreenEl.querySelector<HTMLButtonElement>("[data-title-load]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.startGame("load");
    });
  }

  private setupEvents() {
    window.addEventListener("resize", () => this.resize());
    this.renderer.domElement.addEventListener("click", () => {
      if (!this.gameStarted) return;
      if (this.currentPanel === null) this.renderer.domElement.requestPointerLock();
    });
    this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    this.renderer.domElement.addEventListener("mousedown", (event) => {
      if (this.currentPanel !== null) return;
      if (event.button === 2) {
        event.preventDefault();
        if (this.sleepInLookedBed()) return;
        if (this.tradeWithExactLookedNpc()) return;
        if (this.useLookedWorkbench()) return;
        if (this.useLookedSmelter()) return;
        if (this.useLookedGrinder()) return;
        if (this.tradeWithLookedNpc()) return;
        this.showMessage("우클릭은 설치물 사용과 주민/대장장이 거래에만 쓰입니다. 버리기/설치는 인벤토리에서 드래그앤드롭하세요.");
        return;
      }
      if (event.button === 0) {
        if (document.pointerLockElement === this.renderer.domElement) {
          this.interact();
          return;
        }
        if (this.nearbyObjectInView(["bed", "workbench", "extendedWorkbench"]) || this.getLookTarget() || this.nearbyDroppedItemInView()) this.interact();
      }
    });
    document.addEventListener("pointerlockchange", () => this.renderHud());
    document.addEventListener("mousemove", (event) => this.handleMouseMove(event));
    window.addEventListener("keydown", (event) => this.handleKeyDown(event), { capture: true });
    window.addEventListener("keyup", (event) => this.handleKeyUp(event), { capture: true });
  }

  private seedOverworld() {
    for (let i = 0; i < 8; i += 1) this.spawnMountain(this.randomGroundPoint(), THREE.MathUtils.randFloat(15, 34), THREE.MathUtils.randFloat(4, 14));
    this.spawnBiomeTerrains();
    this.createBiomeDecor();
    for (let i = 0; i < 1144; i += 1) this.spawnTree(Math.random() < 0.78 ? "smallTree" : "bigTree", this.randomGroundPoint());
    for (const point of [
      new THREE.Vector3(-10, 0, -8),
      new THREE.Vector3(-16, 0, 4),
      new THREE.Vector3(14, 0, -12),
      new THREE.Vector3(22, 0, 9),
      new THREE.Vector3(-26, 0, 18),
      new THREE.Vector3(34, 0, -22),
      new THREE.Vector3(-38, 0, -18),
      new THREE.Vector3(9, 0, 28),
    ]) {
      point.y = this.getGroundHeightAt(point.x, point.z);
      this.spawnTree("smallTree", point);
    }
    this.spawnTree("bigTree", new THREE.Vector3(28, this.getGroundHeightAt(28, 34), 34));
    this.spawnTree("bigTree", new THREE.Vector3(-32, this.getGroundHeightAt(-32, 30), 30));
    for (let i = 0; i < 26; i += 1) this.spawnDirtPatch(this.randomGroundPoint());
    for (let i = 0; i < 28; i += 1) this.spawnTerrainPatch(this.randomGroundPoint(), "grass", THREE.MathUtils.randFloat(2, 3.4), false);
    for (let i = 0; i < 16; i += 1) this.spawnTerrainPatch(this.randomGroundPoint(), Math.random() < 0.72 ? "stone" : "ore", THREE.MathUtils.randFloat(1.8, 3), true);
    for (const waterZone of WATER_ZONES) this.spawnWaterBody(waterZone.center.clone(), this.waterZoneRadius(waterZone), waterZone.name);
    this.spawnTrain(0.1);
    for (let i = 0; i < 6; i += 1) this.spawnChest(this.randomGroundPoint(), false);
    for (let i = 0; i < 3; i += 1) this.spawnCave(this.randomGroundPoint());
    for (let i = 0; i < 28; i += 1) this.spawnAnimal(this.randomGroundPoint());
    this.spawnVillage(new THREE.Vector3(58, 0, -76));
    this.spawnVillage(new THREE.Vector3(-96, 0, 120));
    this.spawnVillage(new THREE.Vector3(245, 0, 138), 16, true);
  }

  private handleMouseMove(event: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement || this.currentPanel !== null) return;
    this.yaw -= event.movementX * 0.0024;
    this.pitch -= event.movementY * 0.002;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.32, 1.32);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyW") {
      this.ctrlWBlocked = true;
      this.blockBrowserShortcut(event);
      return;
    }
    if (event.ctrlKey && event.code === "KeyS") {
      this.blockBrowserShortcut(event);
      this.saveGame();
      return;
    }
    if (event.ctrlKey && event.code === "KeyL") {
      this.blockBrowserShortcut(event);
      this.loadGame();
      return;
    }
    this.keys.add(event.code);
    if (event.code === "Escape") {
      this.closePanel();
      return;
    }
    if (event.code === "F4") {
      event.preventDefault();
      this.togglePanel("cheat");
      return;
    }
    if (event.code === "KeyN" && this.currentPanel === null) this.newGame();
    if (event.code === "KeyI") this.togglePanel("inventory");
    if (event.code === "KeyB") this.togglePanel("book");
    if (event.code === "KeyE") this.interact();
    if (event.code === "KeyP") this.showMessage("설치는 인벤토리에서 아이템을 아래 드롭존으로 드래그하세요.");
    if (event.code.startsWith("Digit") && !event.repeat) this.selectHotbarByKey(event.code);
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (event.code === "KeyW" && this.ctrlWBlocked) {
      this.blockBrowserShortcut(event);
      this.ctrlWBlocked = false;
    }
    this.keys.delete(event.code);
  }

  private blockBrowserShortcut(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private selectHotbarByKey(code: string) {
    const number = Number(code.replace("Digit", ""));
    if (Number.isInteger(number) && number >= 1 && number <= this.hotbar.length) {
      this.selectedHotbarIndex = number - 1;
      this.renderHud();
      this.useSelectedHotbarItem();
    }
  }

  private useSelectedHotbarItem() {
    const item = this.hotbar[this.selectedHotbarIndex]?.item;
    if (!item) return;
    if (item === "tutorial_book") {
      this.openPanel("book");
      return;
    }
    if (this.currentPanel !== null) return;
    if (PLACEABLE_TYPES[item]) {
      this.showMessage("설치 아이템은 인벤토리에서 아래 드롭존으로 드래그하면 설치됩니다.");
      return;
    }
    if (item === "mirror") {
      this.showMirrorView();
      return;
    }
    if (item === "meat") {
      if (this.hunger >= HUNGER_MAX) {
        this.showMessage("배고픔이 이미 가득 차 있습니다.");
        return;
      }
      if (this.removeItem("meat", 1)) {
        this.hunger = Math.min(HUNGER_MAX, this.hunger + 1);
        if (this.hunger > 0) this.starvationTimer = 0;
        this.playHandAction();
        this.showMessage(`고기를 먹어 배고픔이 회복되었습니다. 배고픔 ${this.hunger}/${HUNGER_MAX}.`);
        this.renderHud();
      }
      return;
    }
    if (ARMOR_VALUE[item]) {
      this.equippedArmor = item;
      this.showMessage(`${ITEM_NAMES[item] ?? item}을 착용했습니다.`);
      this.renderHud();
    }
  }

  private dropItemFromSlot(slot: Slot | null | undefined) {
    if (!slot?.item || slot.count <= 0) return false;
    const item = slot.item;
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
    }
    this.syncEquippedArmor(item);

    const position = this.pointInFront(2.0);
    this.spawnDroppedItem(item, 1, position);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}을 바닥에 내려놓았습니다. 가까이서 바라보고 E 또는 좌클릭하면 다시 주울 수 있습니다.`);
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private dropItemFromInventory(item: ItemId) {
    if (!this.removeItem(item, 1)) {
      this.showMessage("내려놓을 아이템을 찾지 못했습니다.");
      return false;
    }
    this.syncEquippedArmor(item);
    const position = this.pointInFront(2.0);
    this.spawnDroppedItem(item, 1, position);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}을 바닥에 내려놓았습니다. 가까이서 바라보고 E 또는 좌클릭하면 다시 주울 수 있습니다.`);
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private placeItemFromSlot(slot: Slot | null | undefined) {
    if (!slot?.item || slot.count <= 0 || !PLACEABLE_TYPES[slot.item]) return false;
    const item = slot.item;
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    this.syncEquippedArmor(item);
    this.spawnPlaceableItem(item);
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private placeItemFromInventory(item: ItemId) {
    if (!PLACEABLE_TYPES[item]) return false;
    if (!this.removeItem(item, 1)) {
      this.showMessage("설치할 아이템을 찾지 못했습니다.");
      return false;
    }
    this.spawnPlaceableItem(item);
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private spawnPlaceableItem(item: ItemId) {
    const position = this.pointInFront(4);
    if (item === "crafting_table") this.spawnWorkbench(position, false);
    if (item === "extended_workbench") this.spawnWorkbench(position, true);
    if (item === "smelter") this.spawnSmelter(position, false);
    if (item === "special_smelter") this.spawnSmelter(position, true);
    if (item === "grinder") this.spawnGrinder(position);
    if (item === "bed") this.spawnBed(position, this.yaw);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}를 설치했습니다. 좌클릭/E로 회수하고 우클릭으로 사용합니다.`);
    this.playTone(420, 0.09, "triangle", 0.035);
  }

  private sleepInLookedBed() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "bed" ? exactTarget : this.nearbyObjectInView(["bed"]);
    if (target?.type !== "bed") return false;
    this.sleepInBed(target);
    return true;
  }

  private useLookedWorkbench() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "workbench" || exactTarget?.type === "extendedWorkbench" ? exactTarget : this.nearbyObjectInView(["workbench", "extendedWorkbench"]);
    if (target?.type !== "workbench" && target?.type !== "extendedWorkbench") return false;
    this.openStation("workbench", target.id);
    this.playHandAction();
    return true;
  }

  private useLookedSmelter() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "smelter" || exactTarget?.type === "specialSmelter" ? exactTarget : this.nearbyObjectInView(["smelter", "specialSmelter"]);
    if (target?.type !== "smelter" && target?.type !== "specialSmelter") return false;
    this.openStation("smelter", target.id);
    this.playHandAction();
    return true;
  }

  private useLookedGrinder() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "grinder" ? exactTarget : this.nearbyObjectInView(["grinder"]);
    if (target?.type !== "grinder") return false;
    this.openStation("grinder", target.id);
    this.playHandAction();
    return true;
  }

  private tradeWithLookedNpc() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "villager" || exactTarget?.type === "blacksmithNpc" ? exactTarget : this.nearbyObjectInView(["villager", "blacksmithNpc"]);
    if (target?.type !== "villager" && target?.type !== "blacksmithNpc") return false;
    this.openTrade(target);
    this.playHandAction();
    return true;
  }

  private tradeWithExactLookedNpc() {
    const target = this.getLookTarget();
    if (target?.type !== "villager" && target?.type !== "blacksmithNpc") return false;
    this.openTrade(target);
    this.playHandAction();
    return true;
  }

  private openTrade(target: WorldObject) {
    this.currentStationId = target.id;
    this.openPanel("trade");
  }

  private pickUpDroppedItem(target: WorldObject) {
    const item = target.droppedItem;
    const count = target.droppedCount ?? 1;
    if (!item) return;
    if (!this.addItem(item, count)) {
      this.showMessage("인벤토리 공간이 부족해서 주울 수 없습니다.");
      return;
    }
    this.removeObject(target.id);
    this.playTone(520, 0.06, "triangle", 0.025);
    this.showMessage(`${ITEM_NAMES[item] ?? item}을 다시 주웠습니다.`);
    this.renderHud();
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    this.updateTimeOfDay(delta);
    this.updateTrains(delta);
    this.updateAnimals(delta);
    this.updateVillagers(delta);
    this.updateAnts(delta);
    this.updatePredators(delta);
    this.updateNightSpawns(delta);
    this.updateMovement(delta);
    this.updateEnvironmentHazards(delta);
    this.updateKnights(delta);
    this.updateHand(delta);
    this.updateMirrorView(delta);
    this.updateHunger(delta);
    this.updateDamageParticles(delta);
    this.updateMessages(delta);
    this.updatePrompt(delta);
  }

  private updateHunger(delta: number) {
    this.hungerTimer += delta;
    while (this.hungerTimer >= HUNGER_TICK_SECONDS) {
      this.hungerTimer -= HUNGER_TICK_SECONDS;
      if (this.hunger > 0) {
        this.hunger -= 1;
        this.showMessage(this.hunger > 0 ? `배고픔이 줄었습니다. ${this.hunger}/${HUNGER_MAX}` : "배고픔이 0입니다. 고기를 먹지 않으면 체력이 줄어듭니다.");
        this.renderHud();
      }
    }

    if (this.hunger > 0) {
      this.starvationTimer = 0;
      this.starvationNoticeTimer = 0;
      return;
    }

    this.starvationTimer += delta;
    this.starvationNoticeTimer += delta;
    while (this.starvationTimer >= 1) {
      this.starvationTimer -= 1;
      if (this.damagePlayer(1, false, "굶주림으로 체력이 모두 떨어졌습니다.")) {
        this.starvationNoticeTimer = 0;
        return;
      }
    }
    if (this.starvationNoticeTimer >= 5) {
      this.starvationNoticeTimer = 0;
      this.showMessage("너무 배고파서 체력이 줄고 있습니다. 고기를 먹어야 합니다.");
    }
  }

  private isPointInLava(point: THREE.Vector3) {
    for (const object of this.objects.values()) {
      if (object.terrainKind !== "lava") continue;
      const radius = object.terrainRadius ?? 0;
      if (radius <= 0) continue;
      if (Math.hypot(point.x - object.root.position.x, point.z - object.root.position.z) <= radius * 0.92) return true;
    }
    return false;
  }

  private updateMovement(delta: number) {
    if (this.currentPanel !== null) return;
    if (this.ridingTrainId) {
      const train = this.objects.get(this.ridingTrainId);
      if (train) this.followTrain(train);
      return;
    }

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (this.keys.has("KeyW")) direction.add(forward);
    if (this.keys.has("KeyS")) direction.sub(forward);
    if (this.keys.has("KeyD")) direction.add(right);
    if (this.keys.has("KeyA")) direction.sub(right);

    const jumpDown = this.keys.has("Space");
    if (jumpDown && !this.jumpWasDown && this.isGrounded) {
      this.verticalVelocity = JUMP_SPEED;
      this.isGrounded = false;
    }
    this.jumpWasDown = jumpDown;

    const nextPosition = this.playerPosition.clone();
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const sprinting = this.isSprinting();
      let speed = WALK_SPEED * (sprinting ? RUN_MULTIPLIER : 1);
      if (this.keys.has("KeyC")) speed *= 0.38;
      else if (this.isShiftDown() && !sprinting) speed *= 0.62;
      nextPosition.addScaledVector(direction, speed * delta);
      if (this.locationMode === "overworld") {
        nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
        nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
      }
    }
    if (this.locationMode === "cave") {
      nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -CAVE_WIDTH / 2 + 1.1, CAVE_WIDTH / 2 - 1.1);
      nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, CAVE_END_Z + 3.5, CAVE_START_Z + 3.5);
    }
    if (this.locationMode === "house") {
      nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -5.2, 5.2);
      nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, HOUSE_CENTER_Z - 5.4, HOUSE_CENTER_Z + 5.4);
    }
    this.resolveCollisions(nextPosition);

    this.verticalVelocity -= GRAVITY * delta;
    nextPosition.y += this.verticalVelocity * delta;
    const groundHeight = this.getGroundHeightAt(nextPosition.x, nextPosition.z);
    const groundedY = groundHeight + this.currentPlayerHeight();
    if (nextPosition.y <= groundedY) {
      nextPosition.y = groundedY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.playerPosition.copy(nextPosition);
    this.camera.position.copy(this.playerPosition);

    const moved = this.playerPosition.distanceTo(this.previousPosition);
    if (moved > 0) {
      this.totalSteps += moved;
      if (this.locationMode === "overworld") this.checkStepEvents(moved);
      this.previousPosition.copy(this.playerPosition);
      this.renderHud();
    }
  }

  private updateEnvironmentHazards(delta: number) {
    if (this.locationMode !== "overworld") {
      this.lavaDamageTimer = 0;
      return;
    }
    if (!this.isPointInLava(this.playerPosition)) {
      this.lavaDamageTimer = 0;
      return;
    }
    this.lavaDamageTimer += delta;
    if (this.lavaDamageTimer < 1) return;
    this.lavaDamageTimer = 0;
    if (this.damagePlayer(2, true, "용암 지역의 열기에 체력이 모두 떨어졌습니다.")) return;
    this.showMessage("용암 지역은 너무 뜨겁습니다. 체력이 줄었습니다.");
  }

  private currentPlayerHeight() {
    if (this.keys.has("KeyC")) return PRONE_HEIGHT;
    if (this.isShiftDown() && !this.isSprinting()) return CROUCH_HEIGHT;
    return PLAYER_HEIGHT;
  }

  private isShiftDown() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  private isSprinting() {
    return this.isShiftDown() && this.keys.has("KeyW");
  }

  private checkStepEvents(moved: number) {
    this.chestStepBank += moved;
    this.caveStepBank += moved;
    this.antStepBank += moved;

    while (this.chestStepBank >= CHEST_STEP_INTERVAL) {
      this.chestStepBank -= CHEST_STEP_INTERVAL;
      if (Math.random() < 0.5) {
        this.spawnChest(this.pointNearPlayer(18, 30), false);
        this.showMessage("발자국 소리를 따라가 보니 상자가 생겼습니다. (100걸음 50%)");
      }
    }

    while (this.caveStepBank >= CAVE_STEP_INTERVAL) {
      this.caveStepBank -= CAVE_STEP_INTERVAL;
      if (Math.random() < 0.2) {
        this.spawnCave(this.pointNearPlayer(26, 44));
        this.showMessage("멀리 동굴 입구가 보입니다. (500걸음 20%)");
      }
    }

    while (this.antStepBank >= CHEST_STEP_INTERVAL) {
      this.antStepBank -= CHEST_STEP_INTERVAL;
      const hour = this.gameHour();
      if (hour >= 17 && hour < 20 && Math.random() < 0.1) {
        this.spawnAntHill(this.pointNearPlayer(12, 24));
        this.showMessage("저녁 풀숲 사이로 개미굴과 개미들이 보입니다. (100걸음 10%)");
      }
    }
  }

  private resolveCollisions(position: THREE.Vector3) {
    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      for (const object of this.objects.values()) {
        if (!object.collidable) continue;
        if (object.collisionSegments?.length) {
          if (this.resolveSegmentCollisions(position, object)) changed = true;
          continue;
        }
        const radius = object.collisionRadius ?? 1;
        const combined = radius + PLAYER_RADIUS;
        const dx = position.x - object.root.position.x;
        const dz = position.z - object.root.position.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq <= 0.0001 || distanceSq >= combined * combined) continue;

        const obstacleTop = object.root.position.y + (object.collisionHeight ?? 1);
        const feetY = position.y - this.currentPlayerHeight();
        if (feetY > obstacleTop + 0.12) continue;

        const distance = Math.sqrt(distanceSq);
        const push = combined - distance;
        position.x += (dx / distance) * push;
        position.z += (dz / distance) * push;
        changed = true;
      }
      if (!changed) break;
    }
  }

  private resolveSegmentCollisions(position: THREE.Vector3, object: WorldObject) {
    let changed = false;
    const segments = object.collisionSegments ?? [];
    for (const segment of segments) {
      const startX = object.root.position.x + segment.start.x;
      const startZ = object.root.position.z + segment.start.z;
      const endX = object.root.position.x + segment.end.x;
      const endZ = object.root.position.z + segment.end.z;
      const dx = endX - startX;
      const dz = endZ - startZ;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq <= 0.0001) continue;

      const t = THREE.MathUtils.clamp(((position.x - startX) * dx + (position.z - startZ) * dz) / lengthSq, 0, 1);
      const closestX = startX + dx * t;
      const closestZ = startZ + dz * t;
      const awayX = position.x - closestX;
      const awayZ = position.z - closestZ;
      const distanceSq = awayX * awayX + awayZ * awayZ;
      const combined = segment.halfWidth + PLAYER_RADIUS;
      if (distanceSq >= combined * combined) continue;

      const segmentGroundY = object.root.position.y + Math.max(segment.start.y, segment.end.y);
      const obstacleTop = segmentGroundY + segment.height;
      const feetY = position.y - this.currentPlayerHeight();
      if (feetY > obstacleTop + 0.12) continue;

      const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
      let normalX = awayX / distance;
      let normalZ = awayZ / distance;
      if (!Number.isFinite(normalX) || !Number.isFinite(normalZ)) {
        normalX = position.x - object.root.position.x;
        normalZ = position.z - object.root.position.z;
        const normalLength = Math.hypot(normalX, normalZ) || 1;
        normalX /= normalLength;
        normalZ /= normalLength;
      }
      const push = combined - distance;
      position.x += normalX * push;
      position.z += normalZ * push;
      changed = true;
    }
    return changed;
  }

  private getGroundHeightAt(x: number, z: number) {
    if (this.locationMode === "cave") return 0;
    if (this.locationMode === "house") return this.getHouseGroundHeightAt(x, z);
    return this.getOverworldHeightAt(x, z);
  }

  private getHouseGroundHeightAt(x: number, z: number) {
    if (this.currentHouseKind !== "twoStory") return 0;
    const localZ = z - HOUSE_CENTER_Z;
    if (localZ < -1.7 && Math.abs(x) < 5.15) return 2.55;
    if (x > -4.75 && x < -2.05 && localZ <= 2.65 && localZ >= -1.85) {
      const t = THREE.MathUtils.clamp((2.65 - localZ) / 4.5, 0, 1);
      return 2.55 * t;
    }
    return 0;
  }

  private getOverworldHeightAt(x: number, z: number) {
    let height = 0;
    for (const mountain of this.mountains) {
      const distance = Math.hypot(x - mountain.position.x, z - mountain.position.z);
      if (distance > mountain.radius) continue;
      const t = 1 - distance / mountain.radius;
      height = Math.max(height, mountain.height * t * t * (3 - 2 * t));
    }
    height -= this.getWaterDepthAt(x, z);
    return height;
  }

  private getWaterDepthAt(x: number, z: number) {
    let depth = 0;
    for (const object of this.waterObjects) {
      const radius = object.terrainRadius ?? 0;
      if (radius <= 0) continue;
      const distance = Math.hypot(x - object.root.position.x, z - object.root.position.z);
      if (distance >= radius) continue;
      const edgeT = 1 - distance / radius;
      const smooth = edgeT * edgeT * (3 - 2 * edgeT);
      depth = Math.max(depth, this.waterDepthForRadius(radius) * smooth);
    }
    return depth;
  }

  private waterDepthForRadius(radius: number) {
    return THREE.MathUtils.clamp(radius * 0.045, 1.35, 3.4);
  }

  private updateTrains(delta: number) {
    for (const train of this.objects.values()) {
      if (train.type !== "train") continue;
      const currentRadius = train.trainRadius ?? TRAIN_RADIUS;
      const speed = train.trainSpeed ?? 0.08;
      train.trainDirection = train.trainDirection ?? 1;
      train.trainPause = Math.max(0, (train.trainPause ?? 0) - delta);
      if (train.trainPause > 0) continue;

      const currentAngle = train.trainAngle ?? 0;
      const nextAngle = currentAngle + speed * train.trainDirection * delta;
      let nextRadius = currentRadius;

      if (this.isTrainPathBlocked(train, nextAngle, nextRadius)) {
        const radiusCandidates = [
          currentRadius + 18,
          currentRadius - 18,
          TRAIN_RADIUS + 34,
          TRAIN_RADIUS - 34,
          TRAIN_RADIUS + 58,
        ].filter((radius) => radius > 70 && radius < WORLD_SIZE / 2 - 40);
        const openRadius = radiusCandidates.find((radius) => !this.isTrainPathBlocked(train, nextAngle, radius));
        if (openRadius !== undefined) {
          nextRadius = openRadius;
        } else {
          train.trainPause = 0.7;
          train.trainDirection *= -1;
          continue;
        }
      } else if (Math.abs(currentRadius - TRAIN_RADIUS) > 0.5) {
        const easedRadius = THREE.MathUtils.lerp(currentRadius, TRAIN_RADIUS, Math.min(1, delta * 0.35));
        if (!this.isTrainPathBlocked(train, nextAngle, easedRadius)) nextRadius = easedRadius;
      }

      train.trainAngle = nextAngle;
      train.trainRadius = nextRadius;
      this.positionTrain(train, nextAngle, nextRadius);
    }
    if (this.ridingTrainId) {
      const train = this.objects.get(this.ridingTrainId);
      if (train) this.followTrain(train);
    }
  }

  private positionTrain(train: WorldObject, angle: number, radius: number) {
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    train.root.position.set(x, this.getOverworldHeightAt(x, z), z);
    train.root.rotation.y = (train.trainDirection ?? 1) >= 0 ? -angle - Math.PI / 2 : -angle + Math.PI / 2;
  }

  private isTrainPathBlocked(train: WorldObject, angle: number, radius: number) {
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    for (const object of this.objects.values()) {
      if (object.id === train.id || !this.isTrainObstacle(object)) continue;
      const clearance = (object.collisionRadius ?? 1) + 3.1;
      if (Math.hypot(object.root.position.x - x, object.root.position.z - z) < clearance) return true;
    }
    return false;
  }

  private isTrainObstacle(object: WorldObject) {
    return (
      object.type === "villageHouse" ||
      object.type === "blacksmith" ||
      object.type === "foodStorage" ||
      object.type === "workbench" ||
      object.type === "extendedWorkbench" ||
      object.type === "smelter" ||
      object.type === "specialSmelter" ||
      object.type === "grinder" ||
      object.type === "chest" ||
      object.type === "mineChest" ||
      object.type === "cave"
    );
  }

  private followTrain(train: WorldObject) {
    const rideOffset = new THREE.Vector3(0, PLAYER_HEIGHT + 0.55, -0.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), train.root.rotation.y);
    this.playerPosition.copy(train.root.position).add(rideOffset);
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
  }

  private updateAnimals(delta: number) {
    if (this.locationMode !== "overworld") return;
    const now = performance.now();
    for (const animal of this.objects.values()) {
      if (animal.type !== "animal") continue;
      const fleeing = (animal.fleeUntil ?? 0) > now;
      if (!fleeing && Math.random() < 0.012) animal.wanderAngle = Math.random() * Math.PI * 2;
      const angle = fleeing
        ? Math.atan2(animal.root.position.z - (animal.fleeFrom?.z ?? this.playerPosition.z), animal.root.position.x - (animal.fleeFrom?.x ?? this.playerPosition.x))
        : (animal.wanderAngle ?? 0);
      const baseSpeed = animal.animalKind === "chicken" ? 1.25 : animal.animalKind === "horse" ? 1.55 : 1.1;
      const speed = fleeing ? baseSpeed * 6.15 : baseSpeed * 0.48;
      const next = animal.root.position.clone();
      next.x += Math.cos(angle) * speed * delta;
      next.z += Math.sin(angle) * speed * delta;
      next.x = THREE.MathUtils.clamp(next.x, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6);
      next.z = THREE.MathUtils.clamp(next.z, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6);
      next.y = this.getGroundHeightAt(next.x, next.z);
      animal.root.position.copy(next);
      animal.root.rotation.y = -angle + Math.PI / 2;
      this.animateWalkCycle(animal, delta, speed);
    }
  }

  private updateVillagers(delta: number) {
    if (this.locationMode !== "overworld") return;
    for (const villager of this.objects.values()) {
      if (villager.type !== "villager" || !villager.homePosition) continue;
      if (Math.random() < 0.006) villager.wanderAngle = Math.random() * Math.PI * 2;
      const distanceFromHome = villager.root.position.distanceTo(villager.homePosition);
      const angle =
        distanceFromHome > (villager.roamRadius ?? 14)
          ? Math.atan2(villager.homePosition.z - villager.root.position.z, villager.homePosition.x - villager.root.position.x)
          : (villager.wanderAngle ?? 0);
      const next = villager.root.position.clone();
      next.x += Math.cos(angle) * 0.34 * delta;
      next.z += Math.sin(angle) * 0.34 * delta;
      next.y = this.getOverworldHeightAt(next.x, next.z);
      villager.root.position.copy(next);
      villager.root.rotation.y = -angle + Math.PI / 2;
      this.animateWalkCycle(villager, delta, 0.34);
    }
  }

  private updateAnts(delta: number) {
    for (const hill of this.objects.values()) {
      if (hill.type !== "antHill") continue;
      hill.root.children.forEach((child, index) => {
        if (index < 2) return;
        child.rotation.y += delta * 8;
        const angle = Math.atan2(child.position.z, child.position.x) + delta * (0.9 + index * 0.05);
        const radius = Math.hypot(child.position.x, child.position.z);
        child.position.x = Math.cos(angle) * radius;
        child.position.z = Math.sin(angle) * radius;
      });
    }
  }

  private updatePredators(delta: number) {
    for (const predator of this.objects.values()) {
      if (predator.type !== "wildPredator") continue;
      const toPlayer = this.playerPosition.clone().sub(predator.root.position);
      const distance = Math.hypot(toPlayer.x, toPlayer.z);
      if (distance > 34) {
        predator.wanderAngle = (predator.wanderAngle ?? 0) + THREE.MathUtils.randFloatSpread(0.08);
      }
      const angle =
        distance < 30
          ? Math.atan2(toPlayer.z, toPlayer.x)
          : predator.wanderAngle ?? 0;
      const speed = predator.predatorKind === "spider" ? 2.2 : predator.predatorKind === "lion" ? 3.3 : 2.8;
      const next = predator.root.position.clone();
      next.x += Math.cos(angle) * speed * delta;
      next.z += Math.sin(angle) * speed * delta;
      next.y = this.getGroundHeightAt(next.x, next.z);
      predator.root.position.copy(next);
      predator.root.rotation.y = -angle + Math.PI / 2;
      this.animateWalkCycle(predator, delta, distance < 30 ? 0.82 : 0.36);
      predator.attackCooldown = Math.max(0, (predator.attackCooldown ?? 0) - delta);
      if (distance < (predator.predatorKind === "spider" ? 1.7 : 2.2) && (predator.attackCooldown ?? 0) <= 0) {
        predator.attackCooldown = predator.predatorKind === "lion" ? 1.15 : 1.45;
        this.damagePlayer(predator.predatorKind === "lion" ? 3 : 2, true, `${predator.name}에게 공격받아 체력이 모두 떨어졌습니다.`);
      }
    }
  }

  private updateNightSpawns(delta: number) {
    if (this.locationMode !== "overworld") return;
    this.nightSpawnTimer += delta;
    if (this.nightSpawnTimer < 10) return;
    this.nightSpawnTimer = 0;
    const hour = this.gameHour();
    const isNight = hour >= 20 || hour < 5;
    if (!isNight) return;
    const predatorCount = [...this.objects.values()].filter((object) => object.type === "wildPredator").length;
    if (predatorCount >= 10 || Math.random() > 0.45) return;
    this.spawnPredator(this.pointNearPlayer(26, 42));
    this.showMessage("밤의 야생동물이 근처에서 움직입니다.");
  }

  private createWalkCycle(parts: WalkPartSetup[], amplitude = 0.42, speed = 8, lift = 0.035): WalkCycle {
    return {
      phase: Math.random() * Math.PI * 2,
      speed,
      amplitude,
      lift,
      parts: parts.map((part) => ({
        ...part,
        baseRotation: part.axis === "x" ? part.object.rotation.x : part.object.rotation.z,
        baseY: part.object.position.y,
      })),
    };
  }

  private animateWalkCycle(object: WorldObject, delta: number, movementSpeed: number) {
    const cycle = object.walkCycle;
    if (!cycle) return;
    const moving = movementSpeed > 0.03;
    if (moving) cycle.phase += delta * cycle.speed * THREE.MathUtils.clamp(movementSpeed, 0.4, 3.2);
    const stride = moving ? Math.sin(cycle.phase) * cycle.amplitude : 0;

    for (const part of cycle.parts) {
      const targetRotation = part.baseRotation + stride * part.side;
      const stepLift = moving ? Math.max(0, Math.sin(cycle.phase) * part.side) * cycle.lift : 0;
      if (part.axis === "x") part.object.rotation.x = THREE.MathUtils.lerp(part.object.rotation.x, targetRotation, 0.45);
      else part.object.rotation.z = THREE.MathUtils.lerp(part.object.rotation.z, targetRotation, 0.45);
      part.object.position.y = THREE.MathUtils.lerp(part.object.position.y, part.baseY + stepLift, 0.35);
    }
  }

  private isVillageGuard(object: WorldObject) {
    return object.type === "villageKnight" || object.type === "villageArcher" || object.type === "villageMage" || object.type === "villageGolem";
  }

  private updateKnights(delta: number) {
    const now = performance.now();
    for (const guard of this.objects.values()) {
      if (!this.isVillageGuard(guard) || !guard.angryUntil || guard.angryUntil < now) continue;
      const mode = guard.guardMode ?? "melee";
      const range = guard.attackRange ?? (mode === "ranged" ? 18 : 2.05);
      const damage = guard.attackDamage ?? (guard.type === "villageMage" ? 2 : guard.type === "villageGolem" ? 9 : 1);
      const distance = guard.root.position.distanceTo(this.playerPosition);
      let movementSpeed = 0;
      if (mode === "melee" && distance > range) {
        const direction = this.playerPosition.clone().sub(guard.root.position);
        direction.y = 0;
        if (direction.lengthSq() > 0.01) {
          direction.normalize();
          const chaseSpeed = guard.type === "villageGolem" ? 1.85 : 2.4;
          const step = Math.min(distance - range, chaseSpeed * delta);
          guard.root.position.addScaledVector(direction, step);
          guard.root.position.y = this.getGroundHeightAt(guard.root.position.x, guard.root.position.z);
          movementSpeed = step / Math.max(delta, 0.001);
        }
      }
      this.animateWalkCycle(guard, delta, movementSpeed);

      guard.attackCooldown = Math.max(0, (guard.attackCooldown ?? 0) - delta);
      if (guard.attackCooldown > 0) continue;
      if (guard.root.position.distanceTo(this.playerPosition) > range) continue;
      guard.attackCooldown = guard.attackInterval ?? (mode === "ranged" ? 1.8 : 1.2);
      const died = this.damagePlayer(
        damage,
        true,
        `${guard.name}의 ${mode === "ranged" ? "원거리 공격" : "근거리 공격"}을 받아 체력이 모두 떨어졌습니다.`,
      );
      this.playHandAction();
      if (died) continue;
      const attackText = mode === "ranged" ? `${guard.name}의 원거리 공격을 받았습니다. 피해 ${damage}.` : `${guard.name}가 가까이 붙어 공격했습니다. 피해 ${damage}.`;
      this.showMessage(attackText);
      this.renderHud();
    }
  }

  private enrageVillage(villageId: string, message: string) {
    const now = performance.now();
    let guards = 0;
    for (const object of this.objects.values()) {
      if (!this.isVillageGuard(object) || object.villageId !== villageId) continue;
      object.angryUntil = now + 12_000;
      object.attackCooldown = 0.5;
      guards += 1;
    }
    this.showMessage(`${message} 경비 ${guards}명이 추격을 시작했습니다.`);
  }

  private updateHand(delta: number) {
    this.updateHeldItem();
    this.actionTimer = Math.max(0, this.actionTimer - delta);
    const swing = this.actionTimer > 0 ? Math.sin((1 - this.actionTimer / 0.34) * Math.PI) : 0;
    this.handGroup.position.set(0.09 * swing, -0.05 * swing, -0.12 * swing);
    this.handGroup.rotation.set(-0.62 * swing, 0.2 * swing, -0.15 * swing);
  }

  private playHandAction() {
    this.actionTimer = 0.34;
  }

  private updateHeldItem() {
    const item = this.hotbar[this.selectedHotbarIndex]?.item ?? null;
    const visibleItem = item === "tutorial_book" ? null : item;
    if (visibleItem === this.heldItemKey) return;
    this.heldItemKey = visibleItem;
    this.heldItemGroup.clear();
    if (!visibleItem) return;
    this.heldItemGroup.add(this.createHeldItemModel(visibleItem));
  }

  private showMirrorView() {
    this.mirrorViewTimer = 8;
    this.mirrorView.visible = true;
    this.playHandAction();
    this.playTone(720, 0.1, "triangle", 0.025);
    this.showMessage("거울에 비친 내 모습을 확인합니다. 이 캐릭터 모델은 향후 멀티플레이어 표시와 커스터마이즈에 재사용됩니다.");
  }

  private updateMirrorView(delta: number) {
    if (this.mirrorViewTimer <= 0) {
      this.mirrorView.visible = false;
      return;
    }
    this.mirrorViewTimer -= delta;
    this.mirrorView.visible = true;
    this.mirrorView.rotation.y = Math.sin(performance.now() * 0.0015) * 0.06;
  }

  private createHeldItemModel(item: ItemId) {
    const group = new THREE.Group();
    const materialColor = this.heldItemMaterialColor(item);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.78 });
    const headMaterial = new THREE.MeshStandardMaterial({
      color: materialColor,
      metalness: item.includes("iron") || item.includes("gold") || item.includes("diamond") || item.includes("copper") ? 0.32 : 0.08,
      roughness: item.includes("diamond") ? 0.28 : 0.55,
      emissive: item.includes("obsidian") ? 0x14051d : item.includes("diamond") ? 0x0a4d55 : 0x000000,
      emissiveIntensity: item.includes("obsidian") || item.includes("diamond") ? 0.35 : 0,
    });

    const addHandle = (height = 0.56) => {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, height, 8), handleMaterial);
      handle.position.y = height / 2;
      handle.rotation.z = 0.12;
      group.add(handle);
      return handle;
    };

    if (item === "hammer") {
      addHandle(0.46);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.15), headMaterial);
      head.position.set(0.02, 0.48, 0);
      group.add(head);
    } else if (AXE_POWER[item]) {
      addHandle(0.58);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), headMaterial);
      blade.position.set(0.12, 0.5, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.055), headMaterial);
      back.position.set(-0.08, 0.47, 0);
      group.add(blade, back);
    } else if (PICKAXE_POWER[item]) {
      addHandle(0.62);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.08), headMaterial);
      head.position.set(0.02, 0.57, 0);
      head.rotation.z = -0.06;
      group.add(head);
    } else if (SHOVEL_POWER[item]) {
      addHandle(0.58);
      const scoop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 14), headMaterial);
      scoop.position.set(0.02, 0.58, 0);
      scoop.scale.z = 0.55;
      group.add(scoop);
    } else if (item.endsWith("_dagger") || item.endsWith("_sword")) {
      const sword = item.endsWith("_sword");
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), handleMaterial);
      handle.position.y = 0.1;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(sword ? 0.32 : 0.22, 0.04, 0.06), handleMaterial);
      guard.position.y = 0.23;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(sword ? 0.1 : 0.08, sword ? 0.62 : 0.38, 0.035), headMaterial);
      blade.position.y = sword ? 0.56 : 0.43;
      group.add(handle, guard, blade);
    } else if (item === "bed") {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.5), handleMaterial);
      base.position.y = 0.16;
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.44), new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 }));
      mat.position.y = 0.23;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 }));
      cover.position.set(0, 0.28, 0.08);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.86 }));
      pillow.position.set(0, 0.29, -0.14);
      group.add(base, mat, cover, pillow);
    } else if (item === "mirror") {
      const mirror = createMirrorModel(0.45);
      mirror.position.y = 0.34;
      mirror.rotation.x = -0.16;
      group.add(mirror);
    } else if (item === "smelter" || item === "special_smelter") {
      const smelter = this.createSmelterVisual(item === "special_smelter", 0.22);
      smelter.position.y = 0.08;
      group.add(smelter);
    } else if (item === "crafting_table" || item === "extended_workbench") {
      const workbench = this.createWorkbenchVisual(item === "extended_workbench", 0.2);
      workbench.position.y = 0.08;
      group.add(workbench);
    } else if (PLACEABLE_TYPES[item]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), headMaterial);
      block.position.y = 0.16;
      group.add(block);
    } else {
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), headMaterial);
      pebble.position.y = 0.18;
      group.add(pebble);
    }

    group.rotation.set(0.15, -0.35, -0.22);
    group.scale.setScalar(0.78);
    return group;
  }

  private heldItemMaterialColor(item: ItemId) {
    if (item.includes("obsidian")) return 0x25102f;
    if (item.includes("diamond")) return 0x6ee7f2;
    if (item.includes("gold")) return 0xe5b83e;
    if (item.includes("iron")) return 0xb8b7b0;
    if (item.includes("copper")) return 0xb87345;
    if (item.includes("stone")) return 0x8a8f93;
    if (item.includes("leather")) return 0x8a4f2d;
    if (item.includes("wood") || item.includes("stick")) return 0x8b5a2b;
    if (item === "bed") return 0xb91c1c;
    if (item === "mirror") return 0xa7d8ff;
    if (item === "smelter" || item === "special_smelter") return item === "special_smelter" ? 0x6d3a9c : 0x545b5f;
    return 0x9ca3af;
  }

  private updateMessages(delta: number) {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= delta;
    if (this.messageTimer <= 0) this.messageEl.textContent = "";
  }

  private updatePrompt(delta: number, force = false) {
    this.promptRefreshTimer -= delta;
    if (!force && this.promptRefreshTimer > 0) return;
    this.promptRefreshTimer = LOOK_TARGET_REFRESH_SECONDS;
    const exactTarget = this.getLookTarget();
    const target =
      this.nearbyObjectInView(["bed", "workbench", "extendedWorkbench", "smelter", "specialSmelter", "grinder"]) ??
      exactTarget ??
      this.nearbyDroppedItemInView();
    if (target?.id === this.lastTargetId) return;
    this.lastTargetId = target?.id ?? null;

    const lockText =
      document.pointerLockElement === this.renderer.domElement
        ? "WASD 이동 | Shift+W 달리기 | Shift 웅크리기 | C 엎드리기 | Space 점프 | E/좌클릭 상호작용 | 우클릭 침대 자기/제작대 사용/선택 아이템 내려놓기"
        : "화면 클릭: 1인칭 시점 고정";

    if (!target) {
      this.promptEl.textContent = lockText;
      return;
    }

    const action = this.actionTextFor(target);
    this.promptEl.textContent = `${action} | ${lockText}`;
  }

  private actionTextFor(target: WorldObject) {
    if (target.type === "smallTree") return "E: 작은 나무 캐기";
    if (target.type === "bigTree") return "E: 큰 나무 캐기(도끼 필요)";
    if (target.type === "chest") return target.opened ? "이미 연 상자" : "E: 상자 열기";
    if (target.type === "droppedItem") return `좌클릭/E: ${target.name} 줍기`;
    if (target.type === "bed") return "좌클릭/E/우클릭: 잠자기";
    if (target.type === "cave") return "E: 동굴 들어가기";
    if (target.type === "caveExit") return "E: 동굴 나가기";
    if (target.type === "houseExit") return "E: 집 밖으로 나가기";
    if (target.type === "train") return this.ridingTrainId === target.id ? "E: 기차에서 내리기" : "E: 기차 타기";
    if (target.type === "water") return target.name;
    if (target.type === "dirtPatch") return target.digDepth === target.maxDigDepth ? "돌층: 더 팔 수 없음" : "E: 흙 파기";
    if (target.type === "terrainPatch") {
      if (target.terrainKind === "lava") return "용암 지대: 너무 뜨거워서 팔 수 없음";
      if (target.digDepth === target.maxDigDepth) return target.requiresPickaxe ? "암반: 더 캘 수 없음" : "돌층: 더 팔 수 없음";
      return target.requiresPickaxe ? `E: ${target.name} 캐기(곡괭이 필요)` : `E: ${target.name} 파기`;
    }
    if (target.type === "ore") return `E: ${target.name} 캐기`;
    if (target.type === "mineChest") return target.opened ? "이미 연 광산 상자" : "E: 광산 상자 열기";
    if (target.type === "miner") return "E: 광부와 대화";
    if (target.type === "animal") return `E: ${target.name} 사냥`;
    if (target.type === "villager") return "좌클릭/E: 주민 공격 | 우클릭: 거래";
    if (target.type === "blacksmithNpc") return "좌클릭/E/우클릭: 대장장이 거래";
    if (target.type === "blacksmith") return "E: 대장간 들어가기";
    if (target.type === "villageHouse") return target.enterable ? "E: 주민 집 들어가기" : target.name;
    if (this.isVillageGuard(target)) return `E: ${target.name} 공격`;
    if (target.type === "foodStorage") return "E: 식량창고 열기";
    if (target.type === "workbench" || target.type === "extendedWorkbench") return "좌클릭/E: 제작대 회수 | 우클릭: 제작대 사용";
    if (target.type === "smelter" || target.type === "specialSmelter") return "좌클릭/E: 재련대 회수 | 우클릭: 재련대 사용";
    if (target.type === "grinder") return "좌클릭/E: 분쇄기 회수 | 우클릭: 분쇄기 사용";
    if (target.type === "antHill") return target.antMeatRemaining === 0 ? "빈 개미굴" : "좌클릭/E: 개미굴에서 고기 얻기";
    if (target.type === "wildPredator") return `좌클릭/E: ${target.name} 공격`;
    return "E: 상호작용";
  }

  private interact() {
    if (this.ridingTrainId) {
      this.leaveTrain();
      return;
    }
    const exactTarget = this.getLookTarget();
    const target =
      exactTarget?.type === "blacksmithNpc"
        ? exactTarget
        : this.nearbyObjectInView(["bed", "workbench", "extendedWorkbench", "smelter", "specialSmelter", "grinder", "antHill", "wildPredator"]) ?? exactTarget;
    if (!target) {
      const droppedItem = this.nearbyDroppedItemInView();
      if (droppedItem) {
        this.playHandAction();
        this.pickUpDroppedItem(droppedItem);
        return;
      }
      this.showMessage("가까이 보고 있는 대상이 없습니다.");
      return;
    }

    this.playHandAction();
    if (target.type === "droppedItem") {
      this.pickUpDroppedItem(target);
      return;
    }
    if (target.type === "bed") {
      this.pickUpBed(target);
      return;
    }
    if (target.type === "workbench" || target.type === "extendedWorkbench") {
      this.pickUpWorkbench(target);
      return;
    }
    if (target.type === "smelter" || target.type === "specialSmelter") {
      this.pickUpSmelter(target);
      return;
    }
    if (target.type === "grinder") {
      this.pickUpGrinder(target);
      return;
    }
    if (target.type === "antHill") {
      this.harvestAntHill(target);
      return;
    }
    if (target.type === "wildPredator") {
      this.attackPredator(target);
      return;
    }
    if (target.type === "smallTree") this.harvestSmallTree(target);
    if (target.type === "bigTree") this.harvestBigTree(target);
    if (target.type === "chest") this.openChest(target);
    if (target.type === "cave") this.enterCave(target);
    if (target.type === "caveExit") this.leaveCave();
    if (target.type === "houseExit") this.leaveHouse();
    if (target.type === "train") this.boardTrain(target);
    if (target.type === "dirtPatch") this.digDirt(target);
    if (target.type === "terrainPatch") this.digTerrain(target);
    if (target.type === "ore") this.mineOre(target);
    if (target.type === "mineChest") this.openMineChest(target);
    if (target.type === "miner") this.showMessage("광부: 이 동굴 어딘가에 광산이 있을지도 몰라. 아주 드물지만!");
    if (target.type === "animal") this.attackAnimal(target);
    if (target.type === "villager") this.attackVillager(target);
    if (target.type === "blacksmithNpc") {
      this.openTrade(target);
      return;
    }
    if ((target.type === "villageHouse" || target.type === "blacksmith") && target.enterable) this.enterHouse(target);
    if (this.isVillageGuard(target)) this.attackKnight(target);
    if (target.type === "foodStorage") this.openFoodStorage();
    this.renderHud();
  }

  private sleepInBed(target: WorldObject) {
    if (target.type !== "bed") return;
    const healed = this.maxHealth - this.health;
    this.health = this.maxHealth;
    this.starvationTimer = 0;
    this.playHandAction();
    this.showMessage(healed > 0 ? `침대에서 잠시 쉬어 체력을 ${healed} 회복했습니다.` : "침대에서 잠시 쉬었습니다. 체력은 이미 가득합니다.");
    this.renderHud();
  }

  private pickUpBed(target: WorldObject) {
    if (target.type !== "bed") return;
    if (!this.addItem("bed", 1)) return;
    this.removeObject(target.id);
    this.playHandAction();
    this.showMessage("침대를 회수해서 인벤토리에 넣었습니다.");
    this.renderHud();
  }

  private pickUpWorkbench(target: WorldObject) {
    if (target.type !== "workbench" && target.type !== "extendedWorkbench") return;
    if (target.lockedStation) {
      this.openStation("workbench", target.id);
      this.showMessage("대장간의 제작 도구는 회수할 수 없지만 사용할 수 있습니다.");
      return;
    }
    const item: ItemId = target.type === "extendedWorkbench" ? "extended_workbench" : "crafting_table";
    this.clearWorkbenchSlots(true, false);
    if (!this.addItem(item, 1)) return;
    this.removeObject(target.id);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}를 회수해서 인벤토리에 넣었습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private pickUpSmelter(target: WorldObject) {
    if (target.type !== "smelter" && target.type !== "specialSmelter") return;
    if (target.lockedStation) {
      this.openStation("smelter", target.id);
      this.showMessage("대장간의 제련 도구는 회수할 수 없지만 사용할 수 있습니다.");
      return;
    }
    const item: ItemId = target.type === "specialSmelter" ? "special_smelter" : "smelter";
    if (!this.addItem(item, 1)) return;
    this.removeObject(target.id);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}를 회수해서 인벤토리에 넣었습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private pickUpGrinder(target: WorldObject) {
    if (target.type !== "grinder") return;
    if (target.lockedStation) {
      this.openStation("grinder", target.id);
      this.showMessage("대장간의 분쇄기는 회수할 수 없지만 사용할 수 있습니다.");
      return;
    }
    if (!this.addItem("grinder", 1)) return;
    this.removeObject(target.id);
    this.playHandAction();
    this.showMessage("분쇄기를 회수해서 인벤토리에 넣었습니다.");
    this.renderHud();
  }

  private harvestSmallTree(target: WorldObject) {
    const axe = this.selectedTool(AXE_POWER);
    const axePower = axe ? AXE_POWER[axe] ?? 0 : 0;
    if (!this.advanceHarvest(target, "wood", HARVEST_HARDNESS.wood, axePower, "작은 나무")) {
      if (axe) this.consumeDurability(axe, "작은 나무를 쳤습니다.");
      return;
    }
    this.addItem("wood", 1);
    if (axe) this.consumeDurability(axe, "작은 나무를 캤습니다.");
    this.removeObject(target.id);
    this.showMessage("작은 나무를 캐서 나무 1개를 얻었습니다.");
  }

  private harvestBigTree(target: WorldObject) {
    const axe = this.activeTool(AXE_POWER);
    if (!axe) {
      this.showMessage("큰 나무는 도끼가 있어야 캘 수 있습니다.");
      return;
    }
    const axePower = AXE_POWER[axe] ?? 0;
    if (!this.advanceHarvest(target, "wood", HARVEST_HARDNESS.wood + 5, axePower, "큰 나무")) {
      this.consumeDurability(axe, "큰 나무를 쳤습니다.");
      return;
    }
    this.addItem("wood", 5);
    this.consumeDurability(axe, "큰 나무를 베었습니다.");
    this.removeObject(target.id);
    this.showMessage("큰 나무를 베어 나무 5개를 얻었습니다.");
  }

  private advanceHarvest(target: WorldObject, material: ItemId, baseHits: number, toolPower: number, label: string) {
    const requiredHits = Math.max(1, baseHits - toolPower);
    target.harvestProgress = (target.harvestProgress ?? 0) + 1;
    if (target.harvestProgress >= requiredHits) {
      target.harvestProgress = 0;
      return true;
    }
    const remaining = requiredHits - target.harvestProgress;
    const toolText = toolPower > 0 ? "장비 덕분에 더 빠르게 캐고 있습니다." : "맨손으로는 조금 더 휘둘러야 합니다.";
    this.showMessage(`${label}: ${target.harvestProgress}/${requiredHits}번 쳤습니다. ${ITEM_NAMES[material] ?? material} 채집까지 ${remaining}번 남았습니다. ${toolText}`);
    return false;
  }

  private digDirt(target: WorldObject) {
    this.digTerrain(target);
  }

  private digTerrain(target: WorldObject) {
    if (target.terrainKind === "lava") {
      this.showMessage("용암 지대는 너무 뜨거워서 팔 수 없습니다.");
      return;
    }
    const maxDepth = target.maxDigDepth ?? 3;
    const currentDepth = target.digDepth ?? 0;
    if (currentDepth >= maxDepth) {
      this.showMessage(target.requiresPickaxe ? "단단한 암반이 나와서 더 이상 캘 수 없습니다." : "돌층이 나와서 더 이상 손이나 삽으로 팔 수 없습니다.");
      return;
    }

    if (target.requiresPickaxe) {
      const pickaxe = this.bestTool(PICKAXE_POWER);
      const pickaxePower = pickaxe ? PICKAXE_POWER[pickaxe] ?? 0 : 0;
      if (!pickaxe) {
        this.showMessage(`${target.name}은 곡괭이로만 캘 수 있습니다. 제작대에서 막대기 2개 + 돌 3개로 돌 곡괭이를 만드세요.`);
        return;
      }
      const progress = pickaxePower >= 3 ? 2 : 1;
      target.digDepth = Math.min(maxDepth, currentDepth + progress);
      const loot = target.terrainKind === "ore" ? this.rollSurfaceOre() : "stone";
      this.addItem(loot, target.terrainKind === "stone" ? 2 : 1);
      this.consumeDurability(pickaxe, `${target.name}을 캤습니다.`);
      this.updateDirtPatchVisual(target);
      this.showMessage(target.digDepth >= maxDepth ? `${target.name}을 끝까지 캐서 암반이 드러났습니다.` : `곡괭이로 ${target.name}을 캐서 ${ITEM_NAMES[loot]}을 얻었습니다.`);
      return;
    }

    const shovel = this.bestTool(SHOVEL_POWER);
    const shovelPower = shovel ? SHOVEL_POWER[shovel] ?? 0 : 0;
    const progress = shovelPower > 0 ? 2 : 1;
    target.digDepth = Math.min(maxDepth, currentDepth + progress);
    this.addItem("dirt", shovelPower > 0 ? 2 : 1);
    if (shovel) this.consumeDurability(shovel, "땅을 팠습니다.");
    this.updateDirtPatchVisual(target);

    if (target.digDepth >= maxDepth) {
      this.showMessage("흙을 파다가 돌층이 나왔습니다. 더 이상 팔 수 없습니다.");
    } else {
      this.showMessage(shovelPower > 0 ? "삽으로 흙을 빠르게 팠습니다." : "손으로 흙을 팠습니다.");
    }
  }

  private rollSurfaceOre(): ItemId {
    const roll = Math.random() * 100;
    if (roll < 48) return "copper";
    if (roll < 74) return "iron";
    if (roll < 88) return "coal";
    if (roll < 96) return "gold";
    return "diamond";
  }

  private openChest(target: WorldObject) {
    if (target.opened) {
      this.showMessage("이미 연 상자입니다.");
      return;
    }
    target.opened = true;
    this.tintObject(target.root, 0x6a5940);

    const loot: string[] = [];
    if (Math.random() < 0.5 && this.addItem("hammer", 1)) loot.push("망치");
    if (Math.random() < 0.02 && this.addItem("smelter", 1)) loot.push("재련대");
    if (Math.random() < 0.45 && this.addItem("wood", THREE.MathUtils.randInt(1, 3))) loot.push("나무");
    if (Math.random() < 0.35 && this.addItem("stick", THREE.MathUtils.randInt(1, 2))) loot.push("나무 막대기");
    if (Math.random() < 0.38 && this.addItem("stone", THREE.MathUtils.randInt(1, 3))) loot.push("돌");
    if (Math.random() < 0.15 && this.addItem("leather", 1)) loot.push("가죽");

    this.showMessage(loot.length > 0 ? `상자에서 ${loot.join(", ")}를 얻었습니다.` : "상자가 비어 있었습니다.");
  }

  private enterCave(target: WorldObject) {
    this.caveReturnPosition = target.caveReturn?.clone() ?? this.playerPosition.clone();
    this.clearCaveObjects();
    this.locationMode = "cave";
    this.setCaveAtmosphere();
    this.playerPosition.set(0, PLAYER_HEIGHT, CAVE_START_Z);
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.createCaveInterior();
    this.showMessage("동굴 안으로 들어왔습니다. 돌과 석탄을 찾아보세요.");
    this.renderHud();
  }

  private leaveCave() {
    this.locationMode = "overworld";
    this.clearCaveObjects();
    this.setOverworldAtmosphere();
    this.playerPosition.copy(this.caveReturnPosition ?? new THREE.Vector3(0, PLAYER_HEIGHT, 12));
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.showMessage("다시 야생으로 나왔습니다.");
    this.renderHud();
  }

  private boardTrain(train: WorldObject) {
    this.ridingTrainId = train.id;
    this.followTrain(train);
    this.showMessage("기차에 탔습니다. E를 누르면 내립니다.");
    this.renderHud();
  }

  private leaveTrain() {
    const train = this.ridingTrainId ? this.objects.get(this.ridingTrainId) : null;
    this.ridingTrainId = null;
    if (train) {
      const side = new THREE.Vector3(2.4, PLAYER_HEIGHT, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), train.root.rotation.y);
      this.playerPosition.copy(train.root.position).add(side);
      this.playerPosition.y = this.getGroundHeightAt(this.playerPosition.x, this.playerPosition.z) + PLAYER_HEIGHT;
      this.previousPosition.copy(this.playerPosition);
      this.camera.position.copy(this.playerPosition);
    }
    this.showMessage("기차에서 내렸습니다.");
    this.renderHud();
  }

  private enterHouse(target: WorldObject) {
    this.houseReturnPosition = this.playerPosition.clone();
    this.clearHouseObjects();
    this.locationMode = "house";
    this.setHouseAtmosphere();
    this.playerPosition.set(0, PLAYER_HEIGHT, HOUSE_CENTER_Z + 3.7);
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    const houseKind = target.type === "blacksmith" ? "blacksmith" : target.houseKind ?? "home";
    this.currentHouseKind = houseKind;
    if (target.houseChestRich === undefined) target.houseChestRich = houseKind === "blacksmith" || Math.random() < 0.01;
    this.createHouseInterior(target.houseChestRich, houseKind);
    this.showMessage(
      houseKind === "blacksmith"
        ? "대장간 안으로 들어왔습니다. 고정 제작 도구와 광산상자가 있습니다."
        : houseKind === "twoStory"
          ? "이층집 안으로 들어왔습니다. 계단으로 2층을 오르내릴 수 있습니다."
          : "주민 집 안으로 들어왔습니다. 집 안에는 상자가 하나 있습니다.",
    );
    this.renderHud();
  }

  private leaveHouse() {
    this.locationMode = "overworld";
    this.currentHouseKind = "home";
    this.clearHouseObjects();
    this.setOverworldAtmosphere();
    this.playerPosition.copy(this.houseReturnPosition ?? new THREE.Vector3(0, PLAYER_HEIGHT, 12));
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.showMessage("집 밖으로 나왔습니다.");
    this.renderHud();
  }

  private mineOre(target: WorldObject) {
    if (!target.ore) return;
    const pickaxe = this.bestTool(PICKAXE_POWER);
    const pickaxePower = pickaxe ? PICKAXE_POWER[pickaxe] ?? 0 : 0;
    if (target.ore === "obsidian" && pickaxePower < 5) {
      this.showMessage("흑요석은 다이아몬드 곡괭이로만 캘 수 있습니다.");
      return;
    }
    if (!pickaxe) {
      this.showMessage("돌과 석탄을 포함한 광물은 곡괭이로만 캘 수 있습니다.");
      return;
    }
    const requiredBaseHits = HARVEST_HARDNESS[target.ore] ?? 5;
    if (!this.advanceHarvest(target, target.ore, requiredBaseHits, pickaxePower, ITEM_NAMES[target.ore] ?? "광물")) {
      this.consumeDurability(pickaxe, `${ITEM_NAMES[target.ore]}을 캤습니다.`);
      return;
    }
    this.addItem(target.ore, target.ore === "stone" ? 2 : 1);
    this.consumeDurability(pickaxe, `${ITEM_NAMES[target.ore]}을 캤습니다.`);
    this.removeObject(target.id);
    this.showMessage(`${ITEM_NAMES[target.ore]}을 얻었습니다.`);
  }

  private openMineChest(target: WorldObject) {
    if (target.opened) {
      this.showMessage("이미 연 광산 상자입니다.");
      return;
    }
    target.opened = true;
    this.tintObject(target.root, 0x4f4636);

    const rolls = Math.random() < 0.05 ? THREE.MathUtils.randInt(2, 3) : 1;
    const loot: string[] = [];
    for (let i = 0; i < rolls; i += 1) {
      const item = this.rollMineMineral();
      if (this.addItem(item, 1)) loot.push(ITEM_NAMES[item]);
    }
    this.showMessage(`광산 상자에서 ${loot.join(", ")}를 얻었습니다.`);
  }

  private attackAnimal(target: WorldObject) {
    const damage = this.currentDamage();
    target.hp = (target.hp ?? 8) - damage;
    target.fleeUntil = performance.now() + 6_000;
    target.fleeFrom = this.playerPosition.clone();
    if (target.hp > 0) {
      this.showMessage(`${target.name}에게 ${damage} 피해. 놀라서 천천히 도망갑니다. 남은 체력 ${target.hp}.`);
      return;
    }
    if (target.animalKind !== "chicken") this.addItem("leather", target.animalKind === "pig" ? 1 : THREE.MathUtils.randInt(1, 2));
    if (target.animalKind === "pig" || target.animalKind === "chicken" || Math.random() < 0.35) this.addItem("meat", target.animalKind === "chicken" ? 1 : THREE.MathUtils.randInt(1, 2));
    this.removeObject(target.id);
    this.showMessage(`${target.name}을 사냥해 재료를 얻었습니다.`);
  }

  private attackPredator(target: WorldObject) {
    if (target.type !== "wildPredator") return;
    const damage = this.currentDamage();
    target.hp = (target.hp ?? 10) - damage;
    this.playTone(120, 0.08, "square", 0.035);
    if (target.hp > 0) {
      this.showMessage(`${target.name}에게 ${damage} 피해. 남은 체력 ${target.hp}.`);
      return;
    }
    const loot = target.predatorKind === "spider" ? "coal" : "meat";
    this.addItem(loot, target.predatorKind === "lion" ? 3 : 1);
    this.removeObject(target.id);
    this.showMessage(`${target.name}를 물리치고 ${ITEM_NAMES[loot]}을 얻었습니다.`);
  }

  private harvestAntHill(target: WorldObject) {
    if (target.type !== "antHill") return;
    const remaining = target.antMeatRemaining ?? 5;
    if (remaining <= 0) {
      this.showMessage("개미굴은 비어 있습니다.");
      return;
    }
    target.antMeatRemaining = remaining - 1;
    this.addItem("meat", 1);
    this.playTone(480, 0.08, "triangle", 0.03);
    this.showMessage(`개미굴에서 고기 1개를 얻었습니다. 남은 횟수 ${target.antMeatRemaining}/5.`);
  }

  private attackVillager(target: WorldObject) {
    const damage = this.currentDamage();
    target.hp = (target.hp ?? 10) - damage;
    if (target.villageId) this.enrageVillage(target.villageId, "주민을 공격하자 마을 수호자들이 반격합니다.");
    if (target.hp > 0) {
      this.showMessage(`주민에게 ${damage} 피해. 남은 체력 ${target.hp}.`);
      return;
    }
    this.removeObject(target.id);
    this.showMessage("주민이 쓰러졌습니다. 마을 수호자들이 계속 추격합니다.");
  }

  private attackKnight(target: WorldObject) {
    const damage = Math.max(1, this.currentDamage() - (target.armor ?? 0));
    target.hp = (target.hp ?? 10) - damage;
    if (target.villageId) this.enrageVillage(target.villageId, `${target.name}을 공격하자 경비들이 달려듭니다.`);
    if (target.hp > 0) {
      const range = target.attackRange ?? (target.guardMode === "ranged" ? 18 : 2.05);
      if (target.root.position.distanceTo(this.playerPosition) <= range) {
        const counterDamage = target.attackDamage ?? 1;
        if (this.damagePlayer(counterDamage, true, `${target.name}의 반격을 받아 체력이 모두 떨어졌습니다.`)) return;
        this.showMessage(`${target.name}에게 ${damage} 피해. 반격 피해 ${counterDamage}.`);
      } else {
        this.showMessage(`${target.name}에게 ${damage} 피해. 아직 너무 멀어서 반격은 닿지 않았습니다.`);
      }
      return;
    }
    this.addItem("iron", 1);
    this.removeObject(target.id);
    this.showMessage(`${target.name}을 물리치고 철 1개를 얻었습니다.`);
  }

  private openFoodStorage() {
    const target = this.getLookTarget();
    if (!target || target.type !== "foodStorage") return;
    const remaining = target.foodRemaining ?? 10;
    if (remaining <= 0) {
      this.showMessage("이 마을 식량창고의 고기는 이미 모두 가져갔습니다.");
      return;
    }
    const amount = Math.min(remaining, THREE.MathUtils.randInt(2, 4));
    target.foodRemaining = remaining - amount;
    this.addItem("meat", amount);
    if (target.villageId) this.enrageVillage(target.villageId, "식량창고에서 고기를 가져오자 마을 수호자들이 공격합니다.");
    this.showMessage(`식량창고에서 고기 ${amount}개를 얻었습니다. 수호자들이 공격합니다. 남은 고기 ${target.foodRemaining}/10.`);
  }

  private openStation(panel: "workbench" | "smelter" | "grinder", stationId: string) {
    this.currentStationId = stationId;
    this.togglePanel(panel);
  }

  private rollMineMineral(): ItemId {
    const roll = Math.random() * 100;
    if (roll < 50) return "copper";
    if (roll < 70) return "iron";
    if (roll < 80) return "gold";
    if (roll < 85) return "diamond";
    return "coal";
  }

  private currentDamage() {
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (selectedItem && WEAPON_DAMAGE[selectedItem]) return WEAPON_DAMAGE[selectedItem];
    return Math.max(1, this.bestPower(WEAPON_DAMAGE));
  }

  private damagePlayer(amount: number, showParticles = true, deathReason = "체력이 모두 떨어졌습니다.") {
    if (showParticles) this.spawnDamageParticles();
    if (showParticles) this.playTone(90, 0.12, "sawtooth", 0.03);
    const armor = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    const damage = Math.max(1, amount - Math.floor(armor / 10));
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      const deathPosition = this.locationMode === "overworld" ? this.playerPosition.clone() : (this.caveReturnPosition ?? this.houseReturnPosition ?? new THREE.Vector3(0, PLAYER_HEIGHT, 12)).clone();
      this.dropInventoryOnDeath(deathPosition);
      this.health = this.maxHealth;
      this.hunger = HUNGER_MAX;
      this.hungerTimer = 0;
      this.starvationTimer = 0;
      if (this.locationMode === "cave") {
        this.locationMode = "overworld";
        this.clearCaveObjects();
        this.setOverworldAtmosphere();
      }
      if (this.locationMode === "house") {
        this.locationMode = "overworld";
        this.currentHouseKind = "home";
        this.clearHouseObjects();
        this.setOverworldAtmosphere();
      }
      this.playerPosition.set(0, PLAYER_HEIGHT, 12);
      this.previousPosition.copy(this.playerPosition);
      this.camera.position.copy(this.playerPosition);
      this.showMessage(`사망 원인: ${deathReason} 튜토리얼 책을 제외한 아이템이 죽은 자리에 떨어졌습니다.`);
      this.renderHud();
      return true;
    }
    this.renderHud();
    return false;
  }

  private dropInventoryOnDeath(position: THREE.Vector3) {
    position.y = this.getOverworldHeightAt(position.x, position.z) + 0.08;
    for (const slot of this.allStorageSlots()) {
      if (!slot.item || slot.count <= 0) continue;
      if (slot.item === "tutorial_book") {
        slot.count = 1;
        slot.durabilityUsed = undefined;
        continue;
      }
      const scatter = new THREE.Vector3(THREE.MathUtils.randFloatSpread(2.6), 0, THREE.MathUtils.randFloatSpread(2.6));
      this.spawnDroppedItem(slot.item, slot.count, position.clone().add(scatter));
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    if (!this.hotbar.some((slot) => slot.item === "tutorial_book")) this.hotbar[0] = { item: "tutorial_book", count: 1 };
    this.equippedArmor = null;
  }

  private spawnDamageParticles() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    for (let i = 0; i < 22; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff1f35,
        transparent: true,
        opacity: THREE.MathUtils.randFloat(0.65, 0.95),
        depthTest: false,
      });
      const particle = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.025, 0.06), 8, 6), material);
      particle.position
        .copy(this.camera.position)
        .addScaledVector(forward, THREE.MathUtils.randFloat(0.7, 1.15))
        .addScaledVector(right, THREE.MathUtils.randFloatSpread(0.85))
        .addScaledVector(up, THREE.MathUtils.randFloatSpread(0.55));
      particle.renderOrder = 20;
      const velocity = right
        .clone()
        .multiplyScalar(THREE.MathUtils.randFloatSpread(0.95))
        .addScaledVector(up, THREE.MathUtils.randFloatSpread(0.7))
        .addScaledVector(forward, THREE.MathUtils.randFloat(0.25, 0.75));
      this.scene.add(particle);
      this.damageParticles.push({ mesh: particle, velocity, life: 0.48, maxLife: 0.48 });
    }
  }

  private updateDamageParticles(delta: number) {
    for (let index = this.damageParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.damageParticles[index];
      particle.life -= delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const material = particle.mesh.material;
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = Math.max(0, particle.life / particle.maxLife);
      if (particle.life > 0) continue;
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      if (particle.mesh.material instanceof THREE.Material) particle.mesh.material.dispose();
      this.damageParticles.splice(index, 1);
    }
  }

  private ensureAudio() {
    if (this.audioContext) {
      void this.audioContext.resume();
      return;
    }
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    this.audioContext = new AudioContextCtor();
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 92;
    gain.gain.value = 0.018;
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    this.bgmOscillator = oscillator;
    this.bgmGain = gain;
  }

  private playTone(frequency: number, duration = 0.08, type: OscillatorType = "sine", volume = 0.03) {
    this.ensureAudio();
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private getLookTarget() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.nearbyRaycastTargets(), true);
    for (const hit of hits) {
      const objectId = this.findObjectId(hit.object);
      if (!objectId) continue;
      const target = this.objects.get(objectId);
      if (!target) continue;
      if (hit.distance <= INTERACT_DISTANCE) return target;
    }
    return null;
  }

  private nearbyRaycastTargets() {
    const maxRange = INTERACT_DISTANCE + 2.5;
    const targets: THREE.Object3D[] = [];
    for (const object of this.objects.values()) {
      const meshes = this.raycastTargetsByObject.get(object.id);
      if (!meshes || meshes.length === 0) continue;
      const radius = Math.max(object.collisionRadius ?? 1.4, object.terrainRadius ?? 0);
      const dx = object.root.position.x - this.playerPosition.x;
      const dz = object.root.position.z - this.playerPosition.z;
      if (dx * dx + dz * dz > (maxRange + radius) * (maxRange + radius)) continue;
      targets.push(...meshes);
    }
    return targets;
  }

  private nearbyObjectInView(types: readonly ObjectType[], maxDistance = INTERACT_DISTANCE + 1.2) {
    const allowedTypes = new Set<ObjectType>(types);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best: WorldObject | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const object of this.objects.values()) {
      if (!allowedTypes.has(object.type)) continue;
      const radius = Math.max(object.collisionRadius ?? object.terrainRadius ?? 0.75, 0.75);
      const height = Math.max(object.collisionHeight ?? 1, 0.5);
      const center = object.root.position.clone();
      center.y += Math.min(height * 0.55, 1.35);

      const toObject = center.sub(this.camera.position);
      const distanceSquared = toObject.lengthSq();
      if (distanceSquared <= 0.0001) continue;
      const distance = Math.sqrt(distanceSquared);
      if (distance > maxDistance + radius) continue;

      const direction = toObject.clone().multiplyScalar(1 / distance);
      const facing = direction.dot(forward);
      if (facing <= 0) continue;

      const rayDistance = distance * facing;
      if (rayDistance > maxDistance + radius * 0.5) continue;
      const perpendicularDistance = Math.sqrt(Math.max(0, distanceSquared - rayDistance * rayDistance));
      if (perpendicularDistance > radius + 0.9) continue;

      const score = rayDistance + perpendicularDistance * 0.7 - radius * 0.2;
      if (score >= bestScore) continue;
      best = object;
      bestScore = score;
    }

    return best;
  }

  private nearbyDroppedItemInView() {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best: WorldObject | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const object of this.objects.values()) {
      if (object.type !== "droppedItem") continue;
      const toItem = object.root.position.clone().sub(this.camera.position);
      const distance = toItem.length();
      if (distance > 3.2) continue;
      const direction = toItem.normalize();
      const facing = direction.dot(forward);
      if (facing < 0.18 && distance > 1.35) continue;
      const score = distance - facing * 0.7;
      if (score >= bestScore) continue;
      best = object;
      bestScore = score;
    }

    return best;
  }

  private findObjectId(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.objectId === "string") return current.userData.objectId;
      current = current.parent;
    }
    return null;
  }

  private togglePanel(panel: Exclude<PanelType, null>) {
    this.currentPanel = this.currentPanel === panel ? null : panel;
    if (this.currentPanel !== null && document.pointerLockElement) document.exitPointerLock();
    this.renderPanel();
    this.renderHud();
  }

  private openPanel(panel: Exclude<PanelType, null>) {
    this.currentPanel = panel;
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderPanel();
    this.renderHud();
  }

  private closePanel() {
    this.currentPanel = null;
    this.currentStationId = null;
    this.renderPanel();
    this.renderHud();
  }

  private startGame(mode: "new" | "load") {
    this.gameStarted = true;
    this.titleScreenEl.classList.add("hidden");
    this.ensureAudio();
    if (mode === "new") {
      this.resetGameState();
      this.seedOverworld();
      this.showMessage("새 게임을 시작했습니다.");
      this.renderPanel();
      this.renderHud();
      return;
    }
    this.loadGame();
  }

  private newGame() {
    if (!window.confirm("현재 진행 중인 게임을 새로 시작할까요? 저장된 게임은 삭제되지 않습니다.")) return;
    this.resetGameState();
    this.seedOverworld();
    this.showMessage("새 게임을 시작했습니다.");
    this.renderPanel();
    this.renderHud();
  }

  private saveGame() {
    try {
      const save = this.createSaveData();
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      this.showMessage(`저장 완료: ${new Date(save.savedAt).toLocaleString()}`);
    } catch (error) {
      console.error(error);
      this.showMessage("저장에 실패했습니다. 브라우저 저장 공간을 확인해보세요.");
    }
  }

  private loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      this.showMessage("불러올 저장 파일이 없습니다.");
      return;
    }

    try {
      const save = this.migrateSaveData(JSON.parse(raw) as PartialSavedGame);
      this.restoreSaveData(save);
      this.showMessage(`불러오기 완료: ${new Date(save.savedAt).toLocaleString()}`);
    } catch (error) {
      console.error(error);
      this.showMessage("저장 파일을 불러오지 못했습니다.");
    }
  }

  private createSaveData(): SavedGame {
    const now = performance.now();
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      player: {
        position: this.toSavedVector(this.playerPosition),
        previousPosition: this.toSavedVector(this.previousPosition),
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        maxHealth: this.maxHealth,
        hunger: this.hunger,
        hungerTimer: this.hungerTimer,
        worldTimeSeconds: this.worldTimeSeconds,
        totalSteps: this.totalSteps,
        chestStepBank: this.chestStepBank,
        caveStepBank: this.caveStepBank,
        equippedArmor: this.equippedArmor,
        locationMode: this.locationMode,
        currentHouseKind: this.currentHouseKind,
        caveReturnPosition: this.caveReturnPosition ? this.toSavedVector(this.caveReturnPosition) : null,
        houseReturnPosition: this.houseReturnPosition ? this.toSavedVector(this.houseReturnPosition) : null,
        toolUses: { ...this.toolUses },
        selectedHotbarIndex: this.selectedHotbarIndex,
        hotbar: this.cloneSlots(this.hotbar),
        bagSlots: this.cloneSlots(this.bagSlots),
        craftSlots: this.cloneSlots(this.craftSlots),
        workbenchSlots: this.cloneSlots(this.workbenchSlots),
      },
      mountains: this.mountains.map((mountain) => ({
        position: this.toSavedVector(mountain.position),
        radius: mountain.radius,
        height: mountain.height,
      })),
      objects: [...this.objects.values()]
        .filter((object) => !this.caveObjectIds.includes(object.id) && !this.houseObjectIds.includes(object.id) && object.type !== "caveExit" && object.type !== "houseExit")
        .map((object) => ({
          type: object.type,
          name: object.name,
          position: this.toSavedVector(object.root.position),
          hp: object.hp,
          armor: object.armor,
          ore: object.ore,
          opened: object.opened,
          mineRich: object.mineRich,
          caveReturn: object.caveReturn ? this.toSavedVector(object.caveReturn) : null,
          collidable: object.collidable,
          collisionRadius: object.collisionRadius,
          collisionHeight: object.collisionHeight,
          villageId: object.villageId,
          foodRemaining: object.foodRemaining,
          angryRemainingMs: object.angryUntil && object.angryUntil > now ? object.angryUntil - now : undefined,
          attackCooldown: object.attackCooldown,
          digDepth: object.digDepth,
          maxDigDepth: object.maxDigDepth,
          terrainKind: object.terrainKind,
          requiresPickaxe: object.requiresPickaxe,
          terrainRadius: object.terrainRadius,
          guardMode: object.guardMode,
          attackRange: object.attackRange,
          attackDamage: object.attackDamage,
          attackInterval: object.attackInterval,
          animalKind: object.animalKind,
          homePosition: object.homePosition ? this.toSavedVector(object.homePosition) : undefined,
          roamRadius: object.roamRadius,
          enterable: object.enterable,
          houseChestRich: object.houseChestRich,
          houseKind: object.houseKind,
          lockedStation: object.lockedStation,
          harvestProgress: object.harvestProgress,
          antMeatRemaining: object.antMeatRemaining,
          predatorKind: object.predatorKind,
          trainAngle: object.trainAngle,
          trainRadius: object.trainRadius,
          trainSpeed: object.trainSpeed,
          trainDirection: object.trainDirection,
          trainPause: object.trainPause,
          droppedItem: object.droppedItem,
          droppedCount: object.droppedCount,
          rotationY: object.root.rotation.y,
        })),
    };
  }

  private migrateSaveData(save: PartialSavedGame): SavedGame {
    if (!save.player) throw new Error("Save is missing player data.");
    if (save.version !== 1 && save.version !== SAVE_VERSION) throw new Error("Unsupported save version.");

    const player = save.player;
    const hotbarFallback: Slot[] = [
      { item: "tutorial_book", count: 1 },
      ...Array.from({ length: 7 }, () => ({ item: null, count: 0 })),
    ];
    const bagSource = Array.isArray(player.bagSlots) ? player.bagSlots : [];

    return {
      version: SAVE_VERSION,
      savedAt: typeof save.savedAt === "string" ? save.savedAt : new Date().toISOString(),
      player: {
        position: player.position ?? this.toSavedVector(new THREE.Vector3(0, PLAYER_HEIGHT, 12)),
        previousPosition: player.previousPosition ?? player.position ?? this.toSavedVector(new THREE.Vector3(0, PLAYER_HEIGHT, 12)),
        yaw: typeof player.yaw === "number" ? player.yaw : 0,
        pitch: typeof player.pitch === "number" ? player.pitch : 0,
        health: typeof player.health === "number" ? player.health : 10,
        maxHealth: typeof player.maxHealth === "number" ? player.maxHealth : 10,
        hunger: typeof player.hunger === "number" ? player.hunger : HUNGER_MAX,
        hungerTimer: typeof player.hungerTimer === "number" ? player.hungerTimer : 0,
        worldTimeSeconds: typeof player.worldTimeSeconds === "number" ? player.worldTimeSeconds : DAY_LENGTH_SECONDS * (8 / 24),
        totalSteps: typeof player.totalSteps === "number" ? player.totalSteps : 0,
        chestStepBank: typeof player.chestStepBank === "number" ? player.chestStepBank : 0,
        caveStepBank: typeof player.caveStepBank === "number" ? player.caveStepBank : 0,
        equippedArmor: player.equippedArmor ?? null,
        locationMode: player.locationMode ?? "overworld",
        currentHouseKind: player.currentHouseKind ?? "home",
        caveReturnPosition: player.caveReturnPosition ?? null,
        houseReturnPosition: player.houseReturnPosition ?? null,
        toolUses: {},
        selectedHotbarIndex: typeof player.selectedHotbarIndex === "number" ? player.selectedHotbarIndex : 0,
        hotbar: this.normalizeSavedSlots(player.hotbar, 8, hotbarFallback, player.toolUses),
        bagSlots: this.normalizeSavedSlots(bagSource, bagSource.length, [], player.toolUses),
        craftSlots: this.normalizeSavedSlots(player.craftSlots, 4, [], player.toolUses),
        workbenchSlots: this.normalizeSavedSlots(player.workbenchSlots, EXTENDED_WORKBENCH_SLOT_COUNT, [], player.toolUses),
      },
      mountains: Array.isArray(save.mountains) ? save.mountains : [],
      objects: Array.isArray(save.objects) ? save.objects : [],
    };
  }

  private restoreSaveData(save: SavedGame) {
    if (save.version !== SAVE_VERSION) throw new Error("Unsupported save version.");
    this.resetGameState({ reseed: false });

    for (const mountain of save.mountains) {
      this.spawnMountain(this.fromSavedVector(mountain.position), mountain.radius, mountain.height);
    }
    this.createBiomeDecor();

    for (const savedObject of save.objects) {
      this.restoreWorldObject(savedObject);
    }

    this.hotbar.splice(0, this.hotbar.length, ...this.cloneSlots(save.player.hotbar));
    this.ensureHotbarSize();
    this.bagSlots.splice(0, this.bagSlots.length, ...this.cloneSlots(save.player.bagSlots));
    for (let index = 0; index < this.craftSlots.length; index += 1) {
      const savedSlot = save.player.craftSlots[index] ?? { item: null, count: 0 };
      this.craftSlots[index].item = savedSlot.item;
      this.craftSlots[index].count = savedSlot.count;
      this.craftSlots[index].durabilityUsed = savedSlot.durabilityUsed;
    }
    for (let index = 0; index < this.workbenchSlots.length; index += 1) {
      const savedSlot = save.player.workbenchSlots?.[index] ?? { item: null, count: 0 };
      this.workbenchSlots[index].item = savedSlot.item;
      this.workbenchSlots[index].count = savedSlot.count;
      this.workbenchSlots[index].durabilityUsed = savedSlot.durabilityUsed;
    }

    this.playerPosition.copy(this.fromSavedVector(save.player.position));
    this.previousPosition.copy(this.fromSavedVector(save.player.previousPosition));
    this.yaw = save.player.yaw;
    this.pitch = save.player.pitch;
    this.health = save.player.health;
    this.maxHealth = save.player.maxHealth;
    this.hunger = save.player.hunger ?? HUNGER_MAX;
    this.hungerTimer = save.player.hungerTimer ?? 0;
    this.worldTimeSeconds = save.player.worldTimeSeconds ?? DAY_LENGTH_SECONDS * (8 / 24);
    this.timeHudTimer = 0;
    this.starvationTimer = 0;
    this.starvationNoticeTimer = 0;
    this.lavaDamageTimer = 0;
    this.totalSteps = save.player.totalSteps;
    this.chestStepBank = save.player.chestStepBank;
    this.caveStepBank = save.player.caveStepBank;
    this.equippedArmor = save.player.equippedArmor;
    this.locationMode = save.player.locationMode;
    this.currentHouseKind = save.player.currentHouseKind ?? "home";
    this.caveReturnPosition = save.player.caveReturnPosition ? this.fromSavedVector(save.player.caveReturnPosition) : null;
    this.houseReturnPosition = save.player.houseReturnPosition ? this.fromSavedVector(save.player.houseReturnPosition) : null;
    Object.keys(this.toolUses).forEach((item) => delete this.toolUses[item]);
    Object.assign(this.toolUses, save.player.toolUses ?? {});
    this.selectedHotbarIndex = Math.min(save.player.selectedHotbarIndex, this.hotbar.length - 1);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.camera.position.copy(this.playerPosition);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    if (this.locationMode === "cave") {
      this.setCaveAtmosphere();
      this.createCaveInterior();
    } else if (this.locationMode === "house") {
      this.setHouseAtmosphere();
      this.createHouseInterior(false, this.currentHouseKind);
    } else {
      this.setOverworldAtmosphere();
    }

    this.renderPanel();
    this.renderHud();
  }

  private resetGameState(options: { reseed?: boolean } = {}) {
    const reseed = options.reseed ?? true;
    this.closePanel();
    this.clearWorld();
    this.keys.clear();
    this.hotbar.splice(
      0,
      this.hotbar.length,
      { item: "tutorial_book", count: 1 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
      { item: null, count: 0 },
    );
    this.bagSlots.splice(0, this.bagSlots.length);
    for (const slot of this.craftSlots) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    for (const slot of this.workbenchSlots) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    this.selectedHotbarIndex = 0;
    this.selectedCraftItem = null;
    this.currentPanel = null;
    this.currentStationId = null;
    this.yaw = 0;
    this.pitch = 0;
    this.playerPosition.set(0, PLAYER_HEIGHT, 12);
    this.previousPosition.copy(this.playerPosition);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpWasDown = false;
    this.totalSteps = 0;
    this.chestStepBank = 0;
    this.caveStepBank = 0;
    this.antStepBank = 0;
    this.health = 10;
    this.maxHealth = 10;
    this.hunger = HUNGER_MAX;
    this.hungerTimer = 0;
    this.worldTimeSeconds = DAY_LENGTH_SECONDS * (8 / 24);
    this.timeHudTimer = 0;
    this.starvationTimer = 0;
    this.starvationNoticeTimer = 0;
    this.lavaDamageTimer = 0;
    this.equippedArmor = null;
    this.locationMode = "overworld";
    this.currentHouseKind = "home";
    this.caveReturnPosition = null;
    this.houseReturnPosition = null;
    this.ridingTrainId = null;
    Object.keys(this.toolUses).forEach((item) => delete this.toolUses[item]);
    this.messageTimer = 0;
    this.lastTargetId = null;
    this.promptRefreshTimer = 0;
    this.actionTimer = 0;
    this.nightSpawnTimer = 0;
    this.setOverworldAtmosphere();
    this.camera.position.copy(this.playerPosition);
    this.camera.rotation.set(0, 0, 0, "YXZ");
    this.panelEl.innerHTML = "";
    if (reseed) this.renderHud();
  }

  private clearWorld() {
    this.clearCaveObjects();
    this.clearHouseObjects();
    this.clearBiomeMeshes();
    this.clearDamageParticles();
    for (const id of [...this.objects.keys()]) this.removeObject(id);
    for (const mesh of this.mountainMeshes) this.scene.remove(mesh);
    this.mountainMeshes.splice(0, this.mountainMeshes.length);
    this.mountains.splice(0, this.mountains.length);
    this.raycastTargets.splice(0, this.raycastTargets.length);
    this.raycastTargetsByObject.clear();
    this.waterObjects.splice(0, this.waterObjects.length);
    this.caveObjectIds.splice(0, this.caveObjectIds.length);
    this.objects.clear();
  }

  private clearDamageParticles() {
    for (const particle of this.damageParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      if (particle.mesh.material instanceof THREE.Material) particle.mesh.material.dispose();
    }
    this.damageParticles.splice(0, this.damageParticles.length);
  }

  private restoreWorldObject(savedObject: SavedObject) {
    const position = this.fromSavedVector(savedObject.position);
    const villageId = savedObject.villageId ?? `loaded-village-${crypto.randomUUID()}`;
    let object: WorldObject | null = null;

    if (savedObject.type === "smallTree" || savedObject.type === "bigTree") object = this.spawnTree(savedObject.type, position);
    if (savedObject.type === "chest" || savedObject.type === "mineChest") object = this.spawnChest(position, savedObject.type === "mineChest" || Boolean(savedObject.mineRich));
    if (savedObject.type === "cave") object = this.spawnCave(position);
    if (savedObject.type === "water") object = this.spawnWaterBody(position, this.restoredWaterRadius(position, savedObject.terrainRadius ?? 12, savedObject.name), savedObject.name);
    if (savedObject.type === "droppedItem") object = this.spawnDroppedItem(savedObject.droppedItem ?? "tutorial_book", savedObject.droppedCount ?? 1, position);
    if (savedObject.type === "bed") object = this.spawnBed(position, savedObject.rotationY ?? 0);
    if (savedObject.type === "train") object = this.spawnTrain(savedObject.trainAngle ?? 0);
    if (savedObject.type === "dirtPatch") object = this.spawnDirtPatch(position);
    if (savedObject.type === "terrainPatch") {
      object = this.spawnTerrainPatch(
        position,
        savedObject.terrainKind ?? "grass",
        savedObject.terrainRadius ?? 2.6,
        Boolean(savedObject.requiresPickaxe),
        "terrainPatch",
        this.isSavedPriorityTerrainPatch(savedObject, position),
      );
    }
    if (savedObject.type === "ore") object = this.spawnOre(savedObject.ore ?? "stone", position);
    if (savedObject.type === "miner") object = this.spawnMiner(position);
    if (savedObject.type === "animal") object = this.spawnAnimal(position, savedObject.animalKind);
    if (savedObject.type === "villager") object = this.spawnVillager(position, villageId, savedObject.homePosition ? this.fromSavedVector(savedObject.homePosition) : position, savedObject.roamRadius);
    if (savedObject.type === "blacksmithNpc") object = this.spawnBlacksmithNpc(position, villageId);
    if (savedObject.type === "villageKnight") object = this.spawnKnight(position, villageId);
    if (savedObject.type === "villageArcher" || savedObject.type === "villageMage") object = this.spawnRangedGuard(position, villageId, savedObject.type);
    if (savedObject.type === "villageGolem") object = this.spawnGolem(position, villageId);
    if (savedObject.type === "foodStorage" || savedObject.type === "villageHouse") {
      object = this.spawnVillageHouse(position, savedObject.name, savedObject.type === "foodStorage", villageId, savedObject.houseKind === "twoStory" ? 3 : 0);
    }
    if (savedObject.type === "blacksmith") object = this.spawnBlacksmith(position, villageId);
    if (savedObject.type === "workbench" || savedObject.type === "extendedWorkbench") object = this.spawnWorkbench(position, savedObject.type === "extendedWorkbench");
    if (savedObject.type === "smelter" || savedObject.type === "specialSmelter") object = this.spawnSmelter(position, savedObject.type === "specialSmelter");
    if (savedObject.type === "grinder") object = this.spawnGrinder(position);
    if (savedObject.type === "antHill") object = this.spawnAntHill(position, savedObject.antMeatRemaining);
    if (savedObject.type === "wildPredator") object = this.spawnPredator(position, savedObject.predatorKind);
    if (savedObject.type === "villageKing") object = this.spawnKing(position, villageId);
    if (savedObject.type === "villageFence") object = this.spawnVillageFence(position, savedObject.terrainRadius ?? 20, villageId);

    if (!object) return;
    object.name = savedObject.name;
    if (savedObject.hp !== undefined) object.hp = savedObject.hp;
    object.armor = savedObject.armor;
    object.ore = savedObject.ore;
    object.opened = savedObject.opened;
    object.mineRich = savedObject.mineRich;
    object.caveReturn = savedObject.caveReturn ? this.fromSavedVector(savedObject.caveReturn) : undefined;
    if (savedObject.type !== "villageFence") {
      object.collidable = savedObject.collidable;
      object.collisionRadius = savedObject.collisionRadius;
      object.collisionHeight = savedObject.collisionHeight;
    }
    object.villageId = savedObject.villageId;
    object.foodRemaining = savedObject.foodRemaining;
    object.attackCooldown = savedObject.attackCooldown;
    object.digDepth = savedObject.digDepth;
    object.maxDigDepth = savedObject.maxDigDepth;
    object.terrainKind = savedObject.terrainKind;
    object.requiresPickaxe = savedObject.requiresPickaxe;
    object.terrainRadius = savedObject.terrainRadius;
    object.guardMode = savedObject.guardMode;
    object.attackRange = savedObject.attackRange;
    object.attackDamage = savedObject.attackDamage;
    object.attackInterval = savedObject.attackInterval;
    object.animalKind = savedObject.animalKind;
    object.homePosition = savedObject.homePosition ? this.fromSavedVector(savedObject.homePosition) : undefined;
    object.roamRadius = savedObject.roamRadius;
    object.enterable = savedObject.enterable;
    object.houseChestRich = savedObject.houseChestRich;
    object.houseKind = savedObject.houseKind;
    object.lockedStation = savedObject.lockedStation;
    object.harvestProgress = savedObject.harvestProgress;
    object.antMeatRemaining = savedObject.antMeatRemaining;
    object.predatorKind = savedObject.predatorKind;
    object.trainAngle = savedObject.trainAngle;
    object.trainRadius = savedObject.trainRadius;
    object.trainSpeed = savedObject.trainSpeed;
    object.trainDirection = savedObject.trainDirection;
    object.trainPause = savedObject.trainPause;
    object.droppedItem = savedObject.droppedItem ?? object.droppedItem;
    object.droppedCount = savedObject.droppedCount ?? object.droppedCount;
    object.root.position.copy(position);
    if (savedObject.rotationY !== undefined) object.root.rotation.y = savedObject.rotationY;
    if (object.type === "train") this.positionTrain(object, object.trainAngle ?? 0, object.trainRadius ?? TRAIN_RADIUS);
    if (savedObject.angryRemainingMs) object.angryUntil = performance.now() + savedObject.angryRemainingMs;
    if (object.opened && (object.type === "chest" || object.type === "mineChest")) this.tintObject(object.root, object.type === "mineChest" ? 0x4f4636 : 0x6a5940);
    if (object.type === "dirtPatch" || object.type === "terrainPatch") this.updateDirtPatchVisual(object);
  }

  private toSavedVector(vector: THREE.Vector3): SavedVector {
    return { x: vector.x, y: vector.y, z: vector.z };
  }

  private fromSavedVector(vector: SavedVector): THREE.Vector3 {
    return new THREE.Vector3(vector.x, vector.y, vector.z);
  }

  private cloneSlots(slots: Slot[]): Slot[] {
    return slots.map((slot) => ({
      item: slot.item,
      count: slot.count,
      ...(slot.durabilityUsed && slot.durabilityUsed > 0 ? { durabilityUsed: slot.durabilityUsed } : {}),
    }));
  }

  private normalizeSavedSlots(source: Slot[] | undefined, minLength: number, fallback: Slot[] = [], legacyToolUses: Record<ItemId, number> = {}) {
    const sourceSlots = source && source.length > 0 ? source : fallback;
    const targetLength = Math.max(minLength, sourceSlots.length);
    const normalized: Slot[] = [];

    for (const slot of sourceSlots) {
      if (!slot.item || slot.count <= 0) {
        normalized.push({ item: null, count: 0 });
        continue;
      }

      if (this.isDurableTool(slot.item)) {
        const toolCount = Math.max(1, Math.floor(slot.count));
        for (let index = 0; index < toolCount; index += 1) {
          const legacyUses = index === 0 ? legacyToolUses[slot.item] ?? 0 : 0;
          const durabilityUsed = Math.max(0, Math.floor(slot.durabilityUsed ?? legacyUses));
          normalized.push({ item: slot.item, count: 1, ...(durabilityUsed > 0 ? { durabilityUsed } : {}) });
        }
        continue;
      }

      normalized.push({ item: slot.item, count: Math.floor(slot.count) });
    }

    while (normalized.length < targetLength) normalized.push({ item: null, count: 0 });
    return normalized.slice(0, targetLength);
  }

  private renderHud() {
    const armor = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    const location = this.locationMode === "cave" ? "동굴" : this.locationMode === "house" ? "집 안" : "야생";
    const hour = this.gameHour();
    this.statsEl.textContent = `체력 ${this.health}/${this.maxHealth} | 배고픔 ${this.hunger}/${HUNGER_MAX} | 방어 ${armor} | 걸음 ${Math.floor(this.totalSteps)} | ${this.timeOfDayName(hour)} ${this.gameClockText(hour)} | ${location}`;
    this.objectiveEl.textContent = this.currentObjectiveText();

    this.hotbarEl.innerHTML = this.hotbar
      .map((slot, index) => {
        const label = slot.item ? `${this.shortName(slot.item)} ${slot.count}` : "";
        const selected = index === this.selectedHotbarIndex ? " selected" : "";
        return `<button class="slot${selected}" data-hotbar="${index}"><span>${index + 1}</span>${label}</button>`;
      })
      .join("");

    this.hotbarEl.querySelectorAll<HTMLButtonElement>("[data-hotbar]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedHotbarIndex = Number(button.dataset.hotbar);
        this.renderHud();
      });
    });
  }

  private currentObjectiveText() {
    return currentObjective({
      health: this.health,
      hunger: this.hunger,
      wood: this.countItem("wood"),
      hammer: this.countItem("hammer"),
      craftingTable: this.countItem("crafting_table"),
      leather: this.countItem("leather"),
      hasWorkbench: this.hasWorldObjectType("workbench", "extendedWorkbench"),
      hasPickaxe: ["stone_pickaxe", "copper_pickaxe", "iron_pickaxe", "diamond_pickaxe"].some((item) => this.countItem(item) > 0),
      hasBag: this.bagSlots.length > 0,
      hasSmelter: this.hasWorldObjectType("smelter", "specialSmelter"),
      smelter: this.countItem("smelter"),
    });
  }

  private hasWorldObjectType(...types: ObjectType[]) {
    return [...this.objects.values()].some((object) => types.includes(object.type));
  }

  private renderPanel() {
    if (this.currentPanel === null) {
      this.panelEl.innerHTML = "";
      return;
    }

    if (this.currentPanel === "inventory") this.renderInventoryPanel();
    if (this.currentPanel === "book") this.renderBookPanel();
    if (this.currentPanel === "workbench") this.renderWorkbenchPanel();
    if (this.currentPanel === "smelter") this.renderSmelterPanel();
    if (this.currentPanel === "grinder") this.renderGrinderPanel();
    if (this.currentPanel === "trade") this.renderTradePanel();
    if (this.currentPanel === "cheat") this.renderCheatPanel();
  }

  private renderInventoryPanel() {
    const slotHtml = (slot: Slot, extraClass = "", source?: "hotbar" | "bag" | "craft", index?: number) => {
      const targetAttrs = source !== undefined && index !== undefined ? ` data-slot-source="${source}" data-slot-index="${index}"` : "";
      const dragAttrs =
        slot.item && source !== undefined && index !== undefined
          ? ` draggable="true" data-drop-item="${slot.item}"`
          : "";
      return `<div class="mini-slot inventory-cell${extraClass}"${targetAttrs}${dragAttrs}>${
        slot.item ? `<span class="slot-name">${this.shortName(slot.item)}</span><span class="slot-count">${slot.count}</span>` : ""
      }</div>`;
    };

    const itemButtons = Object.entries(this.itemCounts())
      .filter(([item]) => item !== "tutorial_book")
      .map(([item, count]) => {
        const selected = this.selectedCraftItem === item ? " selected" : "";
        return `<button class="item-button item-slot${selected}" draggable="true" data-drop-item="${item}" data-select-item="${item}">
          <span class="slot-name">${this.shortName(item)}</span>
          <span class="slot-count">${count}</span>
        </button>`;
      })
      .join("");

    const craftSlots = this.craftSlots
      .map((slot, index) => {
        const label = slot.item ? `<span class="slot-name">${this.shortName(slot.item)}</span><span class="slot-count">${slot.count}</span>` : "";
        const dragAttrs = slot.item ? ` draggable="true" data-drop-item="${slot.item}" data-slot-source="craft" data-slot-index="${index}"` : "";
        return `<button class="craft-slot inventory-cell" data-craft-slot="${index}"${dragAttrs}>${label}</button>`;
      })
      .join("");

    const bagGrid =
      this.bagSlots.length > 0
        ? this.bagSlots.map((slot, index) => slotHtml(slot, "", "bag", index)).join("")
        : Array.from({ length: 40 }, () => '<div class="mini-slot inventory-cell locked-slot"></div>').join("");
    const buildOptions = HOUSE_BUILD_OPTIONS.map((option) => {
      const disabled = this.hasIngredients(option.ingredients) && this.locationMode === "overworld" ? "" : "disabled";
      return `<article class="recipe-card house-build-card">
        <div>
          <strong>${option.name}</strong>
          <p>${option.description}</p>
          <small>${this.formatItemBundle(option.ingredients)}</small>
        </div>
        <button data-build-house="${option.id}" ${disabled}>집짓기</button>
      </article>`;
    }).join("");

    this.panelEl.innerHTML = `
      <section class="panel inventory-panel">
        <header>
          <div>
            <h2>인벤토리</h2>
            <p class="inventory-subtitle">재료 위치는 상관없고 조합만 맞으면 제작됩니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="inventory-layout">
          <section class="craft-board house-build-panel">
            <div class="inventory-label">집짓기</div>
            <div class="recipes house-build-list">${buildOptions}</div>
          </section>
          <section class="inventory-board">
            <div class="inventory-label">하단 핫바 ${this.hotbar.length}칸</div>
            <div class="inventory-hotbar inventory-grid">${this.hotbar.map((slot, index) => slotHtml(slot, " hotbar-cell", "hotbar", index)).join("")}</div>
            <div class="inventory-label">가방 ${this.bagSlots.length > 0 ? "40칸" : "잠김"}</div>
            <div class="bag-grid inventory-grid">${bagGrid}</div>
          </section>

          <section class="craft-board">
            <div class="inventory-label">미니 제작대 2x2</div>
            <div class="crafting-flow">
              <div class="craft-grid inventory-craft-grid">${craftSlots}</div>
              <div class="craft-arrow">→</div>
              <div class="craft-result">제작</div>
            </div>
            <div class="panel-actions">
              <button data-mini-craft>제작</button>
              <button data-clear-craft>재료 빼기</button>
            </div>
            <div class="inventory-label">재료 선택</div>
            <div class="item-list item-slot-grid">${itemButtons || '<div class="empty-inventory">비어 있음</div>'}</div>
            <div class="ground-drop-zone" data-ground-drop>여기로 드래그하면 일반 아이템은 버리고 설치 아이템은 설치</div>
          </section>
        </div>
      </section>
    `;

    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-select-item]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedCraftItem = button.dataset.selectItem ?? null;
        this.renderInventoryPanel();
      });
    });
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-slot]").forEach((button) => {
      button.addEventListener("click", () => this.handleCraftSlotClick(Number(button.dataset.craftSlot)));
    });
    this.panelEl.querySelector<HTMLButtonElement>("[data-mini-craft]")?.addEventListener("click", () => this.craftMiniRecipe());
    this.panelEl.querySelector<HTMLButtonElement>("[data-clear-craft]")?.addEventListener("click", () => this.clearCraftSlots());
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-build-house]").forEach((button) => {
      button.addEventListener("click", () => this.buildPlayerHouse(button.dataset.buildHouse ?? ""));
    });
    this.bindInventoryDragDrop();
  }

  private renderBookPanel() {
    this.panelEl.innerHTML = `
      <section class="panel book-panel">
        <header>
          <h2>튜토리얼 책</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <ol>${TUTORIAL_SECTIONS.map((line) => `<li>${line}</li>`).join("")}</ol>
        <h3>핵심 레시피</h3>
        <div class="recipe-lines">
          <p>모든 제작 레시피는 재료를 넣는 위치와 상관없이 조합만 맞으면 됩니다.</p>
          <p>나무 1개 -> 나무 막대기 2개</p>
          <p>나무 3개 + 망치 1개 -> 제작대 1개</p>
          <p>제작대 2개 -> 확장 제작대 1개</p>
          <p>재련대 1개 + 망치 1개 -> 특수 재련대 1개</p>
          <p>망치 2개 + 철 6개 -> 분쇄기 1개</p>
          <p>다이아몬드 가루 6개 + 재련된 나무 6개 + 돌 6개 -> 거울 1개</p>
          <p>재련된 나무 3개 + 막대기 2개 -> 날카로운 나무 도끼</p>
          <p>일반 나무 3개 + 막대기 2개 -> 약한 나무 도끼</p>
          <p>돌 3개 + 막대기 2개 -> 돌 곡괭이</p>
          <p>날카로운 흑요석 1개 + 막대기 1개 -> 흑요석 단검</p>
          <p>날카로운 흑요석 2개 + 막대기 1개 -> 흑요석 검</p>
        </div>
      </section>
    `;
    this.bindPanelBasics();
  }

  private renderWorkbenchPanel() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isExtended = station?.type === "extendedWorkbench";
    const recipes = WORKBENCH_RECIPES.filter((recipe) => isExtended || recipe.id !== "obsidian_armor");
    const currentRecipe = this.workbenchRecipeFromSlots(isExtended);
    const gridSize = isExtended ? "6x6" : "3x3";
    const workbenchSlots = this.activeWorkbenchSlots(isExtended)
      .map((slot, index) => {
        const label = slot.item ? `<span class="slot-name">${this.shortName(slot.item)}</span><span class="slot-count">${slot.count}</span>` : "";
        const dragAttrs = slot.item ? ` draggable="true" data-drop-item="${slot.item}" data-slot-source="workbench" data-slot-index="${index}"` : "";
        return `<button class="craft-slot inventory-cell" data-workbench-slot="${index}"${dragAttrs}>${label}</button>`;
      })
      .join("");
    const itemButtons = Object.entries(this.itemCounts())
      .filter(([item]) => item !== "tutorial_book")
      .map(([item, count]) => {
        const selected = this.selectedCraftItem === item ? " selected" : "";
        return `<button class="item-button item-slot${selected}" draggable="true" data-drop-item="${item}" data-select-item="${item}">
          <span class="slot-name">${this.shortName(item)}</span>
          <span class="slot-count">${count}</span>
        </button>`;
      })
      .join("");
    const resultLabel = currentRecipe ? `${currentRecipe.name} ${currentRecipe.count}` : "조합 대기";
    this.panelEl.innerHTML = `
      <section class="panel workbench-panel">
        <header>
          <div>
            <h2>${isExtended ? "확장 제작대" : "제작대"}</h2>
            <p class="inventory-subtitle">${gridSize} 제작 공간입니다. 재료 위치는 상관없고 조합만 맞으면 제작됩니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="workbench-layout">
          <section class="workbench-crafting-board">
            <div class="inventory-label">제작 공간 ${gridSize}</div>
            <div class="workbench-crafting-flow">
              <div class="workbench-grid${isExtended ? " extended" : ""}">${workbenchSlots}</div>
              <div class="craft-arrow">→</div>
              <div class="craft-result${currentRecipe ? " ready" : ""}">${resultLabel}</div>
            </div>
            <div class="panel-actions">
              <button data-workbench-craft>제작</button>
              <button data-clear-workbench>재료 빼기</button>
            </div>
            <div class="inventory-label">재료 선택</div>
            <div class="item-list item-slot-grid">${itemButtons || '<div class="empty-inventory">비어 있음</div>'}</div>
            <div class="ground-drop-zone" data-ground-drop>여기로 드래그하면 일반 아이템은 버리고 설치 아이템은 설치</div>
          </section>

          <section class="recipe-book-board">
            <div class="inventory-label">제작대 레시피북</div>
            <div class="recipes">
              ${recipes
                .map((recipe) => {
                  const canCraft = this.canCraft(recipe);
                  const ingredients = Object.entries(recipe.ingredients)
                    .map(([item, count]) => `${ITEM_NAMES[item] ?? item} ${count}`)
                    .join(" + ");
                  return `<article class="recipe-card">
                    <div>
                      <strong>${recipe.name}</strong>
                      <p>${ingredients} -> ${ITEM_NAMES[recipe.output] ?? recipe.output} ${recipe.count}</p>
                      <small>${recipe.note}</small>
                    </div>
                    <div class="recipe-actions">
                      <button data-fill-recipe="${recipe.id}" ${canCraft ? "" : "disabled"}>재료 넣기</button>
                      <button data-recipe="${recipe.id}" ${canCraft ? "" : "disabled"}>바로 제작</button>
                    </div>
                  </article>`;
                })
                .join("")}
            </div>
          </section>
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-select-item]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedCraftItem = button.dataset.selectItem ?? null;
        this.renderWorkbenchPanel();
      });
    });
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-workbench-slot]").forEach((button) => {
      button.addEventListener("click", () => this.handleWorkbenchSlotClick(Number(button.dataset.workbenchSlot)));
    });
    this.panelEl.querySelector<HTMLButtonElement>("[data-workbench-craft]")?.addEventListener("click", () => this.craftWorkbenchSlots());
    this.panelEl.querySelector<HTMLButtonElement>("[data-clear-workbench]")?.addEventListener("click", () => this.clearWorkbenchSlots());
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-fill-recipe]").forEach((button) => {
      button.addEventListener("click", () => this.fillWorkbenchRecipe(button.dataset.fillRecipe ?? ""));
    });
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-recipe]").forEach((button) => {
      button.addEventListener("click", () => this.craftWorkbenchRecipe(button.dataset.recipe ?? ""));
    });
    this.bindInventoryDragDrop();
  }

  private renderSmelterPanel() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isSpecial = station?.type === "specialSmelter";
    const rawItems = this.smelterMaterials(isSpecial);
    this.panelEl.innerHTML = `
      <section class="panel smelter-panel">
        <header>
          <h2>${isSpecial ? "특수 재련대" : "재련대"}</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${rawItems
            .map((item) => {
              const output = this.smeltOutputFor(item);
              const disabled = this.countItem(item) <= 0 ? "disabled" : "";
              return `<article class="recipe-card">
                <div>
                  <strong>${ITEM_NAMES[item]} 재련</strong>
                  <p>${ITEM_NAMES[item]} 1 -> ${ITEM_NAMES[output]} 1</p>
                </div>
                <button data-smelt="${item}" ${disabled}>재련</button>
              </article>`;
            })
            .join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-smelt]").forEach((button) => {
      button.addEventListener("click", () => this.smeltItem(button.dataset.smelt ?? ""));
    });
  }

  private renderGrinderPanel() {
    this.panelEl.innerHTML = `
      <section class="panel smelter-panel">
        <header>
          <h2>분쇄기</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${GRINDABLE_MATERIALS.map((item) => {
            const output = POWDER_BY_MINERAL[item];
            const disabled = this.countItem(item) <= 0 ? "disabled" : "";
            return `<article class="recipe-card">
              <div>
                <strong>${ITEM_NAMES[item]} 분쇄</strong>
                <p>${ITEM_NAMES[item]} 1 -> ${ITEM_NAMES[output]} 2</p>
              </div>
              <button data-grind="${item}" ${disabled}>분쇄</button>
            </article>`;
          }).join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-grind]").forEach((button) => {
      button.addEventListener("click", () => this.grindItem(button.dataset.grind ?? ""));
    });
  }

  private renderTradePanel() {
    const trade = this.currentTradeCatalog();
    this.panelEl.innerHTML = `
      <section class="panel trade-panel">
        <header>
          <div>
            <h2>${trade.title}</h2>
            <p class="inventory-subtitle">${trade.subtitle}</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${trade.offers.map((offer) => {
            const give = this.formatItemBundle(offer.give);
            const receive = this.formatItemBundle(offer.receive);
            const disabled = this.hasIngredients(offer.give) ? "" : "disabled";
            return `<article class="recipe-card">
              <div>
                <strong>${offer.name}</strong>
                <p>${give} -> ${receive}</p>
              </div>
              <button data-trade="${offer.id}" ${disabled}>거래</button>
            </article>`;
          }).join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-trade]").forEach((button) => {
      button.addEventListener("click", () => this.performTrade(button.dataset.trade ?? ""));
    });
  }

  private currentTradeCatalog() {
    const partner = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    if (partner?.type === "blacksmithNpc") {
      return {
        title: "대장장이 거래",
        subtitle: "광물 가루를 제작 도구로 교환합니다. 희귀 가루일수록 더 높은 가치로 계산됩니다.",
        offers: BLACKSMITH_TRADE_OFFERS,
      };
    }
    return {
      title: "주민 거래",
      subtitle: "가루 광물과 재료를 마을 물자로 교환합니다.",
      offers: TRADE_OFFERS,
    };
  }

  private renderCheatPanel() {
    const items = Object.entries(ITEM_NAMES)
      .map(
        ([item, name]) => `<article class="cheat-card">
          <div>
            <strong>${name}</strong>
            <small>${item}</small>
          </div>
          <div class="cheat-actions">
            <button data-cheat-item="${item}" data-cheat-count="1">+1</button>
            <button data-cheat-item="${item}" data-cheat-count="10">+10</button>
          </div>
        </article>`,
      )
      .join("");

    this.panelEl.innerHTML = `
      <section class="panel cheat-panel">
        <header>
          <div>
            <h2>F4 치트 아이템</h2>
            <p class="muted">테스트용입니다. 원하는 아이템을 바로 인벤토리에 넣습니다.</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="cheat-grid">${items}</div>
      </section>
    `;

    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-cheat-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = button.dataset.cheatItem;
        const count = Number(button.dataset.cheatCount ?? "1");
        if (!item || !Number.isFinite(count)) return;
        if (this.addItem(item, count)) this.showMessage(`치트: ${ITEM_NAMES[item] ?? item} ${count}개를 얻었습니다.`);
        this.renderCheatPanel();
        this.renderHud();
      });
    });
  }

  private bindPanelBasics() {
    this.panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", () => this.closePanel());
  }

  private bindInventoryDragDrop() {
    this.panelEl.querySelectorAll<HTMLElement>("[data-drop-item]").forEach((element) => {
      element.addEventListener("dragstart", (event) => {
        const item = element.dataset.dropItem;
        if (!item || !event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            item,
            source: element.dataset.slotSource ?? null,
            index: element.dataset.slotIndex ?? null,
          }),
        );
      });
    });

    this.panelEl.querySelectorAll<HTMLElement>("[data-slot-source][data-slot-index]").forEach((element) => {
      const targetSource = element.dataset.slotSource;
      const targetIndex = Number(element.dataset.slotIndex);
      if (!this.isStorageSlotSource(targetSource) || !Number.isInteger(targetIndex)) return;
      element.addEventListener("dragover", (event) => {
        const raw = event.dataTransfer?.getData("application/json");
        if (!raw) {
          event.preventDefault();
          element.classList.add("drag-over");
          return;
        }
        try {
          const payload = JSON.parse(raw) as { source?: string | null; index?: string | null };
          if (!this.isStorageSlotSource(payload.source) || payload.index === null || payload.index === undefined) return;
          event.preventDefault();
          element.classList.add("drag-over");
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        } catch {
          // Ignore malformed drag payloads from outside the inventory.
        }
      });
      element.addEventListener("dragleave", () => element.classList.remove("drag-over"));
      element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drag-over");
        const raw = event.dataTransfer?.getData("application/json");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as { source?: string | null; index?: string | null };
          if (!this.isStorageSlotSource(payload.source) || payload.index === null || payload.index === undefined) return;
          this.swapStorageSlots(payload.source, Number(payload.index), targetSource, targetIndex);
        } catch {
          this.showMessage("아이템 위치를 바꾸지 못했습니다.");
        }
      });
    });

    const dropZone = this.panelEl.querySelector<HTMLElement>("[data-ground-drop]");
    if (!dropZone) return;
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
      const raw = event.dataTransfer?.getData("application/json");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as { item?: ItemId; source?: string | null; index?: string | null };
        if (payload.source && payload.index !== null && payload.index !== undefined) {
          const slot = this.inventorySlotBySource(payload.source, Number(payload.index));
          if (payload.item && PLACEABLE_TYPES[payload.item]) this.placeItemFromSlot(slot);
          else this.dropItemFromSlot(slot);
          return;
        }
        if (payload.item) {
          if (PLACEABLE_TYPES[payload.item]) this.placeItemFromInventory(payload.item);
          else this.dropItemFromInventory(payload.item);
        }
      } catch {
        this.showMessage("아이템을 내려놓지 못했습니다.");
      }
    });
  }

  private inventorySlotBySource(source: string, index: number) {
    if (!Number.isInteger(index) || index < 0) return null;
    if (source === "hotbar") return this.hotbar[index] ?? null;
    if (source === "bag") return this.bagSlots[index] ?? null;
    if (source === "craft") return this.craftSlots[index] ?? null;
    if (source === "workbench") return this.workbenchSlots[index] ?? null;
    return null;
  }

  private isStorageSlotSource(source: string | null | undefined): source is "hotbar" | "bag" {
    return source === "hotbar" || source === "bag";
  }

  private swapStorageSlots(source: string, sourceIndex: number, targetSource: string, targetIndex: number) {
    if (!this.isStorageSlotSource(source) || !this.isStorageSlotSource(targetSource)) return;
    if (source === targetSource && sourceIndex === targetIndex) return;
    const sourceSlot = this.inventorySlotBySource(source, sourceIndex);
    const targetSlot = this.inventorySlotBySource(targetSource, targetIndex);
    if (!sourceSlot || !targetSlot) return;
    const sourceCopy = this.copySlot(sourceSlot);
    const targetCopy = this.copySlot(targetSlot);
    this.assignSlot(sourceSlot, targetCopy);
    this.assignSlot(targetSlot, sourceCopy);
    this.showMessage("핫바와 가방 아이템 위치를 바꿨습니다.");
    this.renderInventoryPanel();
    this.renderHud();
  }

  private copySlot(slot: Slot): Slot {
    return {
      item: slot.item,
      count: slot.count,
      ...(slot.durabilityUsed && slot.durabilityUsed > 0 ? { durabilityUsed: slot.durabilityUsed } : {}),
    };
  }

  private assignSlot(target: Slot, source: Slot) {
    target.item = source.item;
    target.count = source.count;
    target.durabilityUsed = source.durabilityUsed;
  }

  private buildPlayerHouse(optionId: string) {
    const option = HOUSE_BUILD_OPTIONS.find((candidate) => candidate.id === optionId);
    if (!option) return;
    if (this.locationMode !== "overworld") {
      this.showMessage("집은 야생 필드에서만 지을 수 있습니다.");
      return;
    }
    if (!this.hasIngredients(option.ingredients)) {
      this.showMessage(`집짓기 재료가 부족합니다. 필요 재료: ${this.formatItemBundle(option.ingredients)}`);
      return;
    }
    const position = this.pointInFront(7.5);
    if (!this.isBuildSiteClear(position, option.houseKind === "twoStory" ? 4.8 : 4.0)) {
      this.showMessage("이 위치에는 집을 지을 수 없습니다. 물, 용암, 지형 경계, 기존 구조물에서 조금 떨어져 주세요.");
      return;
    }
    for (const [item, count] of Object.entries(option.ingredients)) this.removeItem(item, count);
    const house = this.spawnVillageHouse(position, option.name, false, `player-house-${crypto.randomUUID()}`, option.variant);
    house.houseKind = option.houseKind;
    house.name = option.name;
    house.houseChestRich = false;
    this.showMessage(`${option.name}을 지었습니다. 문을 보고 E를 누르면 들어갈 수 있습니다.`);
    this.renderInventoryPanel();
    this.renderHud();
  }

  private isBuildSiteClear(position: THREE.Vector3, radius: number) {
    if (Math.abs(position.x) > WORLD_SIZE / 2 - radius - 4 || Math.abs(position.z) > WORLD_SIZE / 2 - radius - 4) return false;
    if (this.isNaturalSpawnBlocked(position, radius + 1.5)) return false;
    for (const object of this.objects.values()) {
      if (object.type === "droppedItem") continue;
      const objectRadius = Math.max(object.collisionRadius ?? 0, object.terrainRadius ?? 0.75);
      if (objectRadius <= 0) continue;
      const distance = Math.hypot(position.x - object.root.position.x, position.z - object.root.position.z);
      if (distance < radius + objectRadius + 2) return false;
    }
    return true;
  }

  private handleCraftSlotClick(index: number) {
    const slot = this.craftSlots[index];
    if (!slot) return;

    if (slot.item) {
      this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
      this.renderInventoryPanel();
      this.renderHud();
      return;
    }

    if (!this.selectedCraftItem) {
      this.showMessage("먼저 보유 아이템을 선택하세요.");
      return;
    }

    if (!this.removeItem(this.selectedCraftItem, 1)) {
      this.showMessage("선택한 아이템이 부족합니다.");
      return;
    }

    slot.item = this.selectedCraftItem;
    slot.count = 1;
    if (this.countItem(this.selectedCraftItem) <= 0) this.selectedCraftItem = null;
    this.renderInventoryPanel();
    this.renderHud();
  }

  private craftMiniRecipe() {
    const counts = this.craftCounts();
    const recipe = MINI_RECIPES.find((item) => this.countsMatchExactly(counts, item.ingredients));
    if (recipe) {
      this.clearCraftSlots(false);
      this.addItem(recipe.output, recipe.count);
      this.showMessage(`${recipe.name} 제작 완료.`);
      this.renderPanel();
      this.renderHud();
      return;
    }

    this.showMessage("맞는 미니 제작 레시피가 없습니다.");
  }

  private handleWorkbenchSlotClick(index: number) {
    const slot = this.workbenchSlots[index];
    if (!slot) return;

    if (slot.item && this.selectedCraftItem === slot.item) {
      if (!this.removeItem(this.selectedCraftItem, 1)) {
        this.showMessage("선택한 아이템이 부족합니다.");
        return;
      }
      slot.count += 1;
      this.renderWorkbenchPanel();
      this.renderHud();
      return;
    }

    if (slot.item) {
      this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
      this.renderWorkbenchPanel();
      this.renderHud();
      return;
    }

    if (!this.selectedCraftItem) {
      this.showMessage("먼저 보유 아이템을 선택하세요.");
      return;
    }

    if (!this.removeItem(this.selectedCraftItem, 1)) {
      this.showMessage("선택한 아이템이 부족합니다.");
      return;
    }

    slot.item = this.selectedCraftItem;
    slot.count = 1;
    if (this.countItem(this.selectedCraftItem) <= 0) this.selectedCraftItem = null;
    this.renderWorkbenchPanel();
    this.renderHud();
  }

  private craftWorkbenchSlots() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const recipe = this.workbenchRecipeFromSlots(station?.type === "extendedWorkbench");
    if (!recipe) {
      this.showMessage("맞는 제작대 레시피가 없습니다.");
      return;
    }

    this.clearWorkbenchSlots(false, false);
    this.addCraftedOutput(recipe);
    this.showMessage(`${recipe.name} 제작 완료.`);
    this.renderPanel();
    this.renderHud();
  }

  private fillWorkbenchRecipe(recipeId: string) {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isExtended = station?.type === "extendedWorkbench";
    const recipe = WORKBENCH_RECIPES.find((item) => item.id === recipeId && (isExtended || item.id !== "obsidian_armor"));
    if (!recipe) return;

    this.clearWorkbenchSlots(true, false);
    if (!this.canCraft(recipe)) {
      this.showMessage("레시피에 필요한 재료가 부족합니다.");
      this.renderPanel();
      this.renderHud();
      return;
    }

    for (const [item, count] of Object.entries(recipe.ingredients)) {
      this.removeItem(item, count);
      if (!this.placeWorkbenchIngredient(item, count, isExtended)) this.addItem(item, count);
    }
    this.showMessage(`${recipe.name} 재료를 ${isExtended ? "6x6" : "3x3"} 제작 공간에 넣었습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private placeWorkbenchIngredient(item: ItemId, count: number, isExtended = false) {
    const slots = this.activeWorkbenchSlots(isExtended);
    const slot = slots.find((candidate) => candidate.item === item) ?? slots.find((candidate) => !candidate.item);
    if (!slot) return false;
    slot.item = item;
    slot.count += count;
    return true;
  }

  private workbenchRecipeFromSlots(isExtended = false) {
    const counts = this.workbenchCounts(isExtended);
    return WORKBENCH_RECIPES.filter((recipe) => isExtended || recipe.id !== "obsidian_armor").find((recipe) =>
      this.countsMatchExactly(counts, recipe.ingredients),
    );
  }

  private activeWorkbenchSlots(isExtended = false) {
    return this.workbenchSlots.slice(0, this.workbenchSlotCount(isExtended));
  }

  private workbenchSlotCount(isExtended = false) {
    return isExtended ? EXTENDED_WORKBENCH_SLOT_COUNT : WORKBENCH_SLOT_COUNT;
  }

  private clearCraftSlots(returnItems = true) {
    for (const slot of this.craftSlots) {
      if (returnItems && slot.item) this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
    }
    this.renderPanel();
    this.renderHud();
  }

  private clearWorkbenchSlots(returnItems = true, render = true) {
    for (const slot of this.workbenchSlots) {
      if (returnItems && slot.item) this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
    }
    if (!render) return;
    this.renderPanel();
    this.renderHud();
  }

  private craftWorkbenchRecipe(recipeId: string) {
    const recipe = WORKBENCH_RECIPES.find((item) => item.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return;

    for (const [item, count] of Object.entries(recipe.ingredients)) this.removeItem(item, count);
    this.addCraftedOutput(recipe);
    this.showMessage(`${recipe.name} 제작 완료.`);
    this.renderPanel();
    this.renderHud();
  }

  private addCraftedOutput(recipe: Recipe) {
    if (recipe.output === "bag") {
      this.unlockBag();
      return;
    }
    this.addItem(recipe.output, recipe.count);
    this.autoEquip(recipe.output);
  }

  private smeltItem(item: ItemId) {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isSpecial = station?.type === "specialSmelter";
    if (!this.smelterMaterials(isSpecial).includes(item)) {
      this.showMessage("이 재료는 현재 재련대에서 재련할 수 없습니다.");
      return;
    }
    const output = this.smeltOutputFor(item);
    if (!output || !this.removeItem(item, 1)) {
      this.showMessage("재련할 재료가 없습니다.");
      return;
    }
    this.addItem(output, 1);
    this.showMessage(`${ITEM_NAMES[item]}을 ${ITEM_NAMES[output]}으로 재련했습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private grindItem(item: ItemId) {
    if (!GRINDABLE_MATERIALS.includes(item)) {
      this.showMessage("이 재료는 분쇄할 수 없습니다.");
      return;
    }
    const output = POWDER_BY_MINERAL[item];
    if (!output || !this.removeItem(item, 1)) {
      this.showMessage("분쇄할 재료가 없습니다.");
      return;
    }
    this.addItem(output, 2);
    this.playTone(160, 0.07, "sawtooth", 0.04);
    this.showMessage(`${ITEM_NAMES[item]}을 ${ITEM_NAMES[output]} 2개로 분쇄했습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private performTrade(offerId: string) {
    const offer = this.currentTradeCatalog().offers.find((candidate) => candidate.id === offerId);
    if (!offer) return;
    if (!this.hasIngredients(offer.give)) {
      this.showMessage("거래에 필요한 물건이 부족합니다.");
      return;
    }
    for (const [item, count] of Object.entries(offer.give)) this.removeItem(item, count);
    for (const [item, count] of Object.entries(offer.receive)) this.addItem(item, count);
    this.playTone(620, 0.12, "triangle", 0.035);
    this.showMessage(`거래 완료: ${this.formatItemBundle(offer.receive)} 획득.`);
    this.renderPanel();
    this.renderHud();
  }

  private formatItemBundle(bundle: Record<ItemId, number>) {
    return Object.entries(bundle)
      .map(([item, count]) => `${ITEM_NAMES[item] ?? item} ${count}`)
      .join(" + ");
  }

  private smelterMaterials(isSpecial = false) {
    return isSpecial ? SPECIAL_SMELTER_MATERIALS : RAW_MATERIALS;
  }

  private smeltOutputFor(item: ItemId) {
    return item === "obsidian" ? "sharp_obsidian" : REFINED_BY_RAW[item];
  }

  private canCraft(recipe: Recipe) {
    return this.hasIngredients(recipe.ingredients);
  }

  private hasIngredients(ingredients: Record<ItemId, number>) {
    return Object.entries(ingredients).every(([item, count]) => this.countItem(item) >= count);
  }

  private countsMatchExactly(counts: Record<ItemId, number>, ingredients: Record<ItemId, number>) {
    const countEntries = Object.entries(counts).filter(([, count]) => count > 0);
    const ingredientEntries = Object.entries(ingredients);
    return countEntries.length === ingredientEntries.length && ingredientEntries.every(([item, count]) => counts[item] === count);
  }

  private craftCounts() {
    return this.slotCounts(this.craftSlots);
  }

  private workbenchCounts(isExtended = false) {
    return this.slotCounts(this.activeWorkbenchSlots(isExtended));
  }

  private slotCounts(slots: Slot[]) {
    const counts: Record<ItemId, number> = {};
    for (const slot of slots) {
      if (!slot.item) continue;
      counts[slot.item] = (counts[slot.item] ?? 0) + slot.count;
    }
    return counts;
  }

  private addItem(item: ItemId, count: number) {
    if (item === "bag") {
      this.unlockBag();
      return true;
    }

    if (this.isDurableTool(item)) {
      for (let index = 0; index < count; index += 1) {
        const emptySlot = this.allStorageSlots().find((slot) => !slot.item);
        if (!emptySlot) {
          this.showMessage(`${ITEM_NAMES[item] ?? item}을 넣을 공간이 없습니다.`);
          return index > 0;
        }
        emptySlot.item = item;
        emptySlot.count = 1;
        emptySlot.durabilityUsed = 0;
      }
      this.renderHud();
      return true;
    }

    let remaining = count;
    for (const slot of this.allStorageSlots()) {
      if (slot.item === item) {
        slot.count += remaining;
        this.autoEquip(item);
        this.renderHud();
        return true;
      }
    }

    for (const slot of this.allStorageSlots()) {
      if (!slot.item) {
        slot.item = item;
        slot.count = remaining;
        slot.durabilityUsed = undefined;
        this.autoEquip(item);
        this.renderHud();
        return true;
      }
    }

    this.showMessage(`${ITEM_NAMES[item] ?? item}을 넣을 공간이 없습니다.`);
    return false;
  }

  private removeItem(item: ItemId, count: number) {
    if (count <= 0) return true;
    if (this.countItem(item) < count) return false;

    let remaining = count;
    for (const slot of this.allStorageSlots()) {
      if (slot.item !== item) continue;
      const taken = Math.min(slot.count, remaining);
      slot.count -= taken;
      remaining -= taken;
      if (slot.count <= 0) {
        slot.item = null;
        slot.count = 0;
        slot.durabilityUsed = undefined;
      }
      if (remaining <= 0) {
        this.syncEquippedArmor(item);
        this.renderHud();
        return true;
      }
    }
    return false;
  }

  private countItem(item: ItemId) {
    return this.allStorageSlots()
      .filter((slot) => slot.item === item)
      .reduce((sum, slot) => sum + slot.count, 0);
  }

  private itemCounts() {
    const counts: Record<ItemId, number> = {};
    for (const slot of this.allStorageSlots()) {
      if (!slot.item) continue;
      counts[slot.item] = (counts[slot.item] ?? 0) + slot.count;
    }
    return counts;
  }

  private allStorageSlots() {
    return [...this.hotbar, ...this.bagSlots];
  }

  private ensureHotbarSize() {
    while (this.hotbar.length < 8) this.hotbar.push({ item: null, count: 0 });
  }

  private unlockBag() {
    if (this.bagSlots.length === 0) {
      this.bagSlots.push(...Array.from({ length: 40 }, () => ({ item: null, count: 0 })));
      this.showMessage("가방을 만들었습니다. 인벤토리 가방 공간 40칸이 열렸습니다.");
    } else {
      this.addItem("leather", 2);
      this.showMessage("이미 가방이 있어 보너스 가죽을 돌려받았습니다.");
    }
  }

  private autoEquip(item: ItemId) {
    if (!ARMOR_VALUE[item]) return;
    const current = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    if (ARMOR_VALUE[item] > current) this.equippedArmor = item;
  }

  private syncEquippedArmor(removedItem: ItemId) {
    if (this.equippedArmor !== removedItem || this.countItem(removedItem) > 0) return;
    this.equippedArmor = Object.keys(this.itemCounts()).reduce<ItemId | null>((best, item) => {
      if (!ARMOR_VALUE[item]) return best;
      if (!best || ARMOR_VALUE[item] > (ARMOR_VALUE[best] ?? 0)) return item;
      return best;
    }, null);
  }

  private bestPower(table: Record<ItemId, number>) {
    return Object.keys(this.itemCounts()).reduce((best, item) => Math.max(best, table[item] ?? 0), 0);
  }

  private bestTool(table: Record<ItemId, number>) {
    return Object.keys(this.itemCounts()).reduce<ItemId | null>((best, item) => {
      if (!table[item]) return best;
      if (!best || table[item] > (table[best] ?? 0)) return item;
      return best;
    }, null);
  }

  private selectedTool(table: Record<ItemId, number>) {
    const item = this.hotbar[this.selectedHotbarIndex]?.item;
    return item && table[item] ? item : null;
  }

  private activeTool(table: Record<ItemId, number>) {
    return this.selectedTool(table) ?? this.bestTool(table);
  }

  private consumeDurability(item: ItemId | null, reason: string) {
    if (!item || !DURABLE_TOOL_TABLES.some((table) => table[item])) return;
    const slot = this.findDurableToolSlot(item);
    if (!slot) return;
    const maxUses = TOOL_DURABILITY[item] ?? DEFAULT_TOOL_DURABILITY;
    slot.durabilityUsed = (slot.durabilityUsed ?? 0) + 1;
    const remaining = maxUses - slot.durabilityUsed;
    if (remaining > 0) {
      if (remaining <= Math.min(5, Math.ceil(maxUses * 0.2))) {
        this.showMessage(`${reason} ${ITEM_NAMES[item]} 내구도 ${remaining}/${maxUses}.`);
      }
      return;
    }
    slot.item = null;
    slot.count = 0;
    slot.durabilityUsed = undefined;
    this.syncEquippedArmor(item);
    this.renderHud();
    this.showMessage(`${ITEM_NAMES[item]}의 내구도가 다해 부서졌습니다.`);
  }

  private isDurableTool(item: ItemId | null) {
    return Boolean(item && DURABLE_TOOL_TABLES.some((table) => table[item]));
  }

  private findDurableToolSlot(item: ItemId) {
    const selectedSlot = this.hotbar[this.selectedHotbarIndex];
    if (selectedSlot?.item === item) return selectedSlot;
    return this.allStorageSlots().find((slot) => slot.item === item) ?? null;
  }

  private shortName(item: ItemId) {
    const name = ITEM_NAMES[item] ?? item;
    return name.length > 6 ? `${name.slice(0, 6)}` : name;
  }

  private showMessage(text: string) {
    this.messageEl.textContent = text;
    this.messageEl.classList.remove("message-pop");
    void this.messageEl.offsetWidth;
    this.messageEl.classList.add("message-pop");
    this.messageTimer = 5.2;
  }

  private spawnMountain(position: THREE.Vector3, radius: number, height: number) {
    position.y = 0;
    this.mountains.push({ position: position.clone(), radius, height });
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 18),
      new THREE.MeshStandardMaterial({ color: 0x6f7f67, roughness: 1 }),
    );
    mountain.position.set(position.x, height / 2 - 0.1, position.z);
    mountain.scale.y = 0.9;
    this.scene.add(mountain);
    this.mountainMeshes.push(mountain);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.36, height * 0.32, 18),
      new THREE.MeshStandardMaterial({ color: 0xd8e5dc, roughness: 0.95 }),
    );
    cap.position.set(position.x, height * 0.82, position.z);
    this.scene.add(cap);
    this.mountainMeshes.push(cap);
  }

  private spawnDirtPatch(position: THREE.Vector3) {
    return this.spawnTerrainPatch(position, "dirt", 2.3, false, "dirtPatch");
  }

  private spawnWaterBody(position: THREE.Vector3, radius: number, name: string) {
    if (this.overlapsPriorityBiome(position, radius, 2)) return null;
    position.y = this.getGroundHeightAt(position.x, position.z);
    const depth = this.waterDepthForRadius(radius);
    const group = new THREE.Group();
    const basinWall = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.98, radius * 0.68, depth, 42, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x5b6f6f, roughness: 0.96 }),
    );
    basinWall.position.y = -depth / 2 + 0.02;
    const basinFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius * 0.78, 0.08, 42),
      new THREE.MeshStandardMaterial({ color: 0x41524f, roughness: 1 }),
    );
    basinFloor.position.y = -depth + 0.04;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * THREE.MathUtils.randFloat(0.72, 1.18), 0.08, 42),
      new THREE.MeshStandardMaterial({ color: 0x238fc8, roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.66 }),
    );
    water.position.y = 0.11;
    const shore = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.05, 42),
      new THREE.MeshStandardMaterial({ color: 0xc8b06a, roughness: 0.92 }),
    );
    shore.position.y = 0.035;
    group.add(basinWall, basinFloor, shore, water);
    group.position.copy(position);
    return this.addWorldObject("water", name, group, {
      terrainRadius: radius,
      collisionRadius: 0,
      collisionHeight: 0,
    });
  }

  private spawnDroppedItem(item: ItemId, count: number, position: THREE.Vector3) {
    position.y = this.getGroundHeightAt(position.x, position.z) + 0.08;
    const group = new THREE.Group();
    if (item === "tutorial_book") {
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.06, 0.72),
        new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: 0.78 }),
      );
      pages.position.y = 0.08;
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.04, 0.78),
        new THREE.MeshStandardMaterial({ color: 0x4169a8, roughness: 0.68 }),
      );
      cover.position.y = 0.13;
      const spine = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x27456f, roughness: 0.7 }),
      );
      spine.position.set(-0.32, 0.12, 0);
      const title = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.012, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x6b4d03, emissiveIntensity: 0.2, roughness: 0.5 }),
      );
      title.position.set(0.07, 0.155, 0.04);
      group.add(pages, cover, spine, title);
    } else if (item === "smelter" || item === "special_smelter") {
      group.add(this.createSmelterVisual(item === "special_smelter", 0.42));
    } else if (item === "grinder") {
      group.add(this.createGrinderVisual(0.4));
    } else if (item === "mirror") {
      group.add(createMirrorModel(0.48));
    } else if (item === "crafting_table" || item === "extended_workbench") {
      group.add(this.createWorkbenchVisual(item === "extended_workbench", 0.38));
    } else if (item === "bed") {
      group.add(this.createBedVisual(0.34));
    } else {
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22),
        new THREE.MeshStandardMaterial({ color: this.heldItemMaterialColor(item), roughness: 0.78 }),
      );
      mesh.position.y = 0.18;
      group.add(mesh);
    }
    const pickupTarget = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    pickupTarget.position.y = 0.34;
    group.add(pickupTarget);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.position.copy(position);
    return this.addWorldObject("droppedItem", ITEM_NAMES[item] ?? item, group, {
      droppedItem: item,
      droppedCount: count,
      collisionRadius: 0.8,
      collisionHeight: 0.8,
    });
  }

  private spawnTrain(angle = 0) {
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(TRAIN_RADIUS, 0.22, 10, 180),
      new THREE.MeshStandardMaterial({ color: 0x34383d, metalness: 0.45, roughness: 0.48 }),
    );
    track.rotation.x = Math.PI / 2;
    track.position.y = 0.08;
    this.addBiomeMesh(track);

    const group = new THREE.Group();
    const engine = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 1.35, 1.55),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.62, metalness: 0.08 }),
    );
    engine.position.y = 0.95;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.25, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x263f75, roughness: 0.56, metalness: 0.12 }),
    );
    cabin.position.set(-0.75, 1.65, 0);
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.48, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x9bd7ff, emissive: 0x1d4f72, emissiveIntensity: 0.25, roughness: 0.22 }),
    );
    window.position.set(-0.18, 1.78, 0.73);
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.45, roughness: 0.48 }),
    );
    chimney.position.set(1.0, 1.9, 0);
    const cowcatcher = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.45, roughness: 0.4 }),
    );
    cowcatcher.position.set(1.95, 0.6, 0);
    cowcatcher.rotation.z = -Math.PI / 2;
    group.add(engine, cabin, window, chimney, cowcatcher);
    for (const x of [-1.0, 0.95]) {
      for (const z of [-0.68, 0.68]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.16, 18),
          new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.35, roughness: 0.5 }),
        );
        wheel.position.set(x, 0.34, z);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
      }
    }
    const train = this.addWorldObject("train", "탑승 가능한 기차", group, {
      collidable: false,
      collisionRadius: 1.9,
      collisionHeight: 2.4,
      trainAngle: angle,
      trainRadius: TRAIN_RADIUS,
      trainSpeed: 0.075,
      trainDirection: 1,
      trainPause: 0,
    });
    this.positionTrain(train, angle, TRAIN_RADIUS);
    return train;
  }

  private spawnTerrainPatch(
    position: THREE.Vector3,
    terrainKind: TerrainKind,
    radius: number,
    requiresPickaxe: boolean,
    objectType: "terrainPatch" | "dirtPatch" = "terrainPatch",
    allowPriorityOverlap = false,
  ) {
    if (!allowPriorityOverlap && this.isPriorityTerrainReserved(position, radius, terrainKind)) return null;
    const group = new THREE.Group();
    const colorByTerrain: Record<TerrainKind, number> = {
      grass: 0x4f8f49,
      dirt: 0x8a5a32,
      stone: 0x7d858b,
      ore: 0x5c6670,
      snow: 0xdcecf1,
      swamp: 0x4f6b52,
      lava: 0xe64a19,
    };
    const nameByTerrain: Record<string, string> = {
      grass: "잔디 지형",
      dirt: "흙 지역",
      stone: "돌 지형",
      ore: "광석 지형",
      snow: "눈 지형",
      swamp: "늪 흙",
    };
    nameByTerrain.lava = "용암 지대";
    const patch = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.16, 24),
      new THREE.MeshStandardMaterial({
        color: colorByTerrain[terrainKind],
        roughness: terrainKind === "lava" ? 0.42 : 1,
        emissive: terrainKind === "lava" ? 0xff3d00 : 0x000000,
        emissiveIntensity: terrainKind === "lava" ? 0.72 : 0,
      }),
    );
    patch.userData.digSurface = true;
    patch.position.y = 0.05;
    const hole = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.36, radius * 0.44, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x2f241c, roughness: 1 }),
    );
    hole.userData.digHole = true;
    hole.position.y = 0.075;
    hole.visible = false;
    group.add(patch, hole);
    group.position.copy(position);
    const object = this.addWorldObject(objectType, nameByTerrain[terrainKind], group, {
      digDepth: 0,
      maxDigDepth: requiresPickaxe ? 4 : 3,
      terrainKind,
      requiresPickaxe,
      terrainRadius: radius,
      collisionRadius: 0,
      collisionHeight: 0,
    });
    this.updateDirtPatchVisual(object);
    return object;
  }

  private updateDirtPatchVisual(target: WorldObject) {
    const depth = target.digDepth ?? 0;
    const maxDepth = target.maxDigDepth ?? 3;
    const kind = target.terrainKind ?? "dirt";
    const baseColors: Record<TerrainKind, number> = {
      grass: 0x4f8f49,
      dirt: 0x8a5a32,
      stone: 0x7d858b,
      ore: 0x5c6670,
      snow: 0xdcecf1,
      swamp: 0x4f6b52,
      lava: 0xe64a19,
    };
    const midColors: Record<TerrainKind, number> = {
      grass: 0x73512f,
      dirt: 0x7b4d2a,
      stone: 0x697178,
      ore: 0x4f5962,
      snow: 0xb6c9cf,
      swamp: 0x59633f,
      lava: 0x9f2d15,
    };
    const color = depth >= maxDepth ? 0x777b80 : depth > 0 ? midColors[kind] : baseColors[kind];
    target.root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.userData.digHole) {
          child.visible = depth > 0;
          child.material.color.set(depth >= maxDepth ? 0x3f4448 : 0x2f241c);
          const scale = 0.8 + depth * 0.28;
          child.scale.set(scale, 1, scale);
          child.position.y = 0.04 - depth * 0.04;
        } else {
          child.material.color.set(color);
          child.position.y = 0.05 - depth * 0.05;
          if (child.userData.digSurface) child.scale.setScalar(Math.max(0.74, 1 - depth * 0.055));
        }
      }
    });
  }

  private spawnBiomeTerrains() {
    for (const biome of BIOMES) {
      const center = biome.center.clone();
      center.y = this.getGroundHeightAt(center.x, center.z);
      if (biome.kind === "bamboo") {
        this.spawnTerrainPatch(center, "grass", biome.radius, false, "terrainPatch", true);
      }
      if (biome.kind === "mountain") {
        this.spawnTerrainPatch(center, "stone", biome.radius * 0.55, true, "terrainPatch", true);
        this.spawnTerrainPatch(center.clone().add(new THREE.Vector3(18, 0, -12)), "ore", biome.radius * 0.24, true, "terrainPatch", true);
        for (let i = 0; i < 4; i += 1) {
          this.spawnMountain(this.randomPointInCircle(biome.center, biome.radius * 0.72), THREE.MathUtils.randFloat(18, 34), THREE.MathUtils.randFloat(7, 17));
        }
      }
      if (biome.kind === "mushroom") {
        this.spawnTerrainPatch(center, "dirt", biome.radius, false, "terrainPatch", true);
      }
      if (biome.kind === "swamp") {
        this.spawnTerrainPatch(center, "swamp", biome.radius, false, "terrainPatch", true);
      }
      if (biome.kind === "snow") {
        this.spawnTerrainPatch(center, "snow", biome.radius, false, "terrainPatch", true);
        this.spawnTerrainPatch(center.clone().add(new THREE.Vector3(-14, 0, 11)), "stone", biome.radius * 0.24, true, "terrainPatch", true);
      }
      if (biome.kind === "lava") {
        this.spawnTerrainPatch(center, "lava", biome.radius, false, "terrainPatch", true);
        this.spawnTerrainPatch(center.clone().add(new THREE.Vector3(16, 0, -10)), "stone", biome.radius * 0.36, true, "terrainPatch", true);
        for (let i = 0; i < 3; i += 1) {
          this.spawnMountain(this.randomPointInCircle(biome.center, biome.radius * 0.72), THREE.MathUtils.randFloat(11, 22), THREE.MathUtils.randFloat(4, 10));
        }
      }
    }
  }

  private createBiomeDecor() {
    this.clearBiomeMeshes();
    for (const biome of BIOMES) {
      if (biome.kind === "bamboo") this.createBambooBiome(biome);
      if (biome.kind === "mushroom") this.createMushroomBiome(biome);
      if (biome.kind === "swamp") this.createSwampBiome(biome);
      if (biome.kind === "snow") this.createSnowBiome(biome);
      if (biome.kind === "mountain") this.createMountainBiomeDecor(biome);
      if (biome.kind === "lava") this.createLavaBiome(biome);
    }
  }

  private createBambooBiome(biome: BiomeConfig) {
    const group = new THREE.Group();
    for (let i = 0; i < 575; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.92);
      const height = THREE.MathUtils.randFloat(8.1, 15.6);
      const bamboo = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.085, height, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c9b35, roughness: 0.72 }),
      );
      stem.position.set(point.x, point.y + height / 2, point.z);
      const joint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0xd7bf55, roughness: 0.8 }),
      );
      joint.position.set(point.x, point.y + height * 0.62, point.z);
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.58, 1.05, 6),
        new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.8 }),
      );
      leaf.position.set(point.x + THREE.MathUtils.randFloatSpread(0.32), point.y + height + 0.28, point.z + THREE.MathUtils.randFloatSpread(0.32));
      bamboo.add(stem, joint, leaf);
      group.add(bamboo);
    }
    this.addBiomeMesh(group);
  }

  private createMushroomBiome(biome: BiomeConfig) {
    const group = new THREE.Group();
    for (let i = 0; i < 34; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.86);
      const height = THREE.MathUtils.randFloat(0.7, 2.4);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12 * height, 0.18 * height, height, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8d2b4, roughness: 0.86 }),
      );
      stem.position.set(point.x, point.y + height / 2, point.z);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 * height, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0xb93848 : 0x7b4ab0, roughness: 0.78 }),
      );
      cap.position.set(point.x, point.y + height, point.z);
      group.add(stem, cap);
    }
    this.addBiomeMesh(group);
  }

  private createSwampBiome(biome: BiomeConfig) {
    const group = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.72);
      const pond = new THREE.Mesh(
        new THREE.CylinderGeometry(THREE.MathUtils.randFloat(3.2, 6.8), THREE.MathUtils.randFloat(3.2, 6.8), 0.05, 24),
        new THREE.MeshStandardMaterial({ color: 0x365f62, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.7 }),
      );
      pond.position.set(point.x, point.y + 0.035, point.z);
      group.add(pond);
    }
    for (let i = 0; i < 18; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.88);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, THREE.MathUtils.randFloat(1.2, 2.4), 7),
        new THREE.MeshStandardMaterial({ color: 0x4b3824, roughness: 1 }),
      );
      trunk.position.set(point.x, point.y + 0.8, point.z);
      trunk.rotation.z = THREE.MathUtils.randFloat(-0.28, 0.28);
      group.add(trunk);
    }
    this.addBiomeMesh(group);
  }

  private createSnowBiome(biome: BiomeConfig) {
    const group = new THREE.Group();
    for (let i = 0; i < 34; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.86);
      const height = THREE.MathUtils.randFloat(1.8, 3.5);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, height * 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x5b321f, roughness: 0.9 }),
      );
      trunk.position.set(point.x, point.y + height * 0.3, point.z);
      const snowTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.72, height, 9),
        new THREE.MeshStandardMaterial({ color: 0xe9f5f7, roughness: 0.9 }),
      );
      snowTop.position.set(point.x, point.y + height * 0.78, point.z);
      group.add(trunk, snowTop);
    }
    this.addBiomeMesh(group);
  }

  private createMountainBiomeDecor(biome: BiomeConfig) {
    const group = new THREE.Group();
    for (let i = 0; i < 28; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.9);
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.7, 2.1)),
        new THREE.MeshStandardMaterial({ color: 0x697178, roughness: 1 }),
      );
      rock.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.4, 1.1), point.z);
      rock.scale.y = THREE.MathUtils.randFloat(0.55, 1.25);
      group.add(rock);
    }
    this.addBiomeMesh(group);
  }

  private createLavaBiome(biome: BiomeConfig) {
    const group = new THREE.Group();
    const lavaMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff2d00,
      emissiveIntensity: 1.05,
      roughness: 0.36,
      metalness: 0.05,
    });
    const crustMaterial = new THREE.MeshStandardMaterial({ color: 0x23201e, roughness: 0.95 });
    const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.5 });

    for (let i = 0; i < 11; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.82);
      const poolRadius = THREE.MathUtils.randFloat(2.4, 6.8);
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(poolRadius, poolRadius * THREE.MathUtils.randFloat(0.72, 1.1), 0.08, 28), lavaMaterial);
      pool.position.set(point.x, point.y + 0.12, point.z);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(poolRadius * 1.1, poolRadius * 1.05, 0.12, 28), crustMaterial);
      rim.position.set(point.x, point.y + 0.06, point.z);
      group.add(rim, pool);
    }

    for (let i = 0; i < 46; i += 1) {
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.92);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.45, 1.55)), crustMaterial);
      rock.position.set(point.x, point.y + THREE.MathUtils.randFloat(0.22, 0.85), point.z);
      rock.scale.y = THREE.MathUtils.randFloat(0.45, 1.05);
      const ember = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.05, 0.14), 8, 6), emberMaterial);
      ember.position.set(point.x + THREE.MathUtils.randFloatSpread(0.45), point.y + THREE.MathUtils.randFloat(0.18, 0.75), point.z + THREE.MathUtils.randFloatSpread(0.45));
      group.add(rock, ember);
    }

    this.addBiomeMesh(group);
  }

  private addBiomeMesh(object: THREE.Object3D) {
    this.scene.add(object);
    this.biomeMeshes.push(object);
  }

  private clearBiomeMeshes() {
    for (const mesh of this.biomeMeshes) this.scene.remove(mesh);
    this.biomeMeshes.splice(0, this.biomeMeshes.length);
  }

  private randomPointInCircle(center: THREE.Vector3, radius: number) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    const point = new THREE.Vector3(center.x + Math.cos(angle) * distance, 0, center.z + Math.sin(angle) * distance);
    point.y = this.getGroundHeightAt(point.x, point.z);
    return point;
  }

  private spawnTree(type: "smallTree" | "bigTree", position: THREE.Vector3) {
    const group = new THREE.Group();
    const size = type === "bigTree" ? 2.25 : 1.84;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * size, 0.24 * size, type === "bigTree" ? 2.25 * size : 1.2 * size, 8),
      new THREE.MeshStandardMaterial({ color: type === "bigTree" ? 0x5b321f : 0xa36231, roughness: 0.9 }),
    );
    trunk.position.y = type === "bigTree" ? 1.12 * size : 0.6 * size;
    const leaves = new THREE.Mesh(
      type === "bigTree" ? new THREE.ConeGeometry(1.05 * size, 2.3 * size, 10) : new THREE.SphereGeometry(0.95 * size, 10, 8),
      new THREE.MeshStandardMaterial({ color: type === "bigTree" ? 0x14532d : 0x75c94c, roughness: 0.85 }),
    );
    leaves.position.y = type === "bigTree" ? 2.85 * size : 1.45 * size;
    group.add(trunk, leaves);
    if (type === "bigTree") {
      const secondLeaves = new THREE.Mesh(
        new THREE.ConeGeometry(0.82 * size, 1.7 * size, 10),
        new THREE.MeshStandardMaterial({ color: 0x0f3f25, roughness: 0.85 }),
      );
      secondLeaves.position.y = 4.0 * size;
      group.add(secondLeaves);
    } else {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.12, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf6d365, roughness: 0.6 }),
      );
      marker.position.y = 0.08;
      group.add(marker);
    }
    group.position.copy(position);
    return this.addWorldObject(type, type === "bigTree" ? "큰 나무" : "작은 나무", group, {
      collidable: false,
      collisionRadius: type === "bigTree" ? 2.55 : 1.85,
      collisionHeight: type === "bigTree" ? 9.5 : 4.7,
    });
  }

  private spawnChest(position: THREE.Vector3, mineRich: boolean) {
    const group = new THREE.Group();
    const woodColor = mineRich ? 0x5a3e2c : 0x8b5a2b;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.8, 1),
      new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.75 }),
    );
    base.position.y = 0.4;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.34, 1.06),
      new THREE.MeshStandardMaterial({ color: mineRich ? 0x6a4931 : 0xa46933, roughness: 0.72 }),
    );
    lid.position.y = 0.96;
    lid.scale.y = 0.72;
    const frontBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.12, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd6b35a, metalness: 0.3, roughness: 0.5 }),
    );
    frontBand.position.set(0, 0.84, 0.55);
    const sideBandA = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.08, 1.12),
      new THREE.MeshStandardMaterial({ color: 0xc79f45, metalness: 0.28, roughness: 0.52 }),
    );
    sideBandA.position.set(-0.52, 0.58, 0);
    const sideBandB = sideBandA.clone();
    sideBandB.position.x = 0.52;
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.28, 0.1),
      new THREE.MeshStandardMaterial({ color: mineRich ? 0x9ad1ff : 0xfacc15, metalness: 0.45, roughness: 0.38 }),
    );
    lock.position.set(0, 0.58, 0.58);
    group.add(base, lid, frontBand, sideBandA, sideBandB, lock);
    group.position.copy(position);
    return this.addWorldObject(mineRich ? "mineChest" : "chest", mineRich ? "광산 상자" : "상자", group, {
      mineRich,
      collidable: true,
      collisionRadius: 0.95,
      collisionHeight: 0.95,
    });
  }

  private spawnCave(position: THREE.Vector3) {
    const group = new THREE.Group();
    const entrance = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.45, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.95 }),
    );
    entrance.position.y = 1.9;
    entrance.rotation.y = Math.PI / 2;
    group.add(entrance);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.65, 1.2)),
        new THREE.MeshStandardMaterial({ color: 0x5e6468, roughness: 1 }),
      );
      rock.position.set(Math.cos(angle) * 2.2, 1.6 + Math.sin(angle) * 1.25, THREE.MathUtils.randFloat(-0.25, 0.35));
      group.add(rock);
    }
    group.position.copy(position);
    return this.addWorldObject("cave", "동굴 입구", group, {
      caveReturn: position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 5)),
      collidable: true,
      collisionRadius: 2.4,
      collisionHeight: 3.8,
    });
  }

  private createCaveInterior() {
    const shell = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(CAVE_WIDTH, CAVE_LENGTH, 2, 18),
      new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, CAVE_CENTER_Z);
    shell.add(floor);

    for (let i = 0; i < 22; i += 1) {
      const z = CAVE_START_Z - 8 - (i / 21) * (CAVE_LENGTH - 20);
      const dirt = new THREE.Mesh(
        new THREE.CircleGeometry(THREE.MathUtils.randFloat(1.4, 2.8), 14),
        new THREE.MeshStandardMaterial({ color: 0x594534, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 5), 0.01, z + THREE.MathUtils.randFloatSpread(4));
      dirt.scale.z = THREE.MathUtils.randFloat(0.55, 1.25);
      shell.add(dirt);
    }

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(CAVE_WIDTH + 2.5, 0.75, CAVE_LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x34383d, roughness: 1 }),
    );
    ceiling.position.set(0, 4.35, CAVE_CENTER_Z);
    shell.add(ceiling);

    for (let i = 0; i < 46; i += 1) {
      const z = CAVE_START_Z - (i / 45) * CAVE_LENGTH;
      for (const side of [-1, 1]) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(1.0, 2.7)),
          new THREE.MeshStandardMaterial({ color: THREE.MathUtils.randInt(0, 1) === 0 ? 0x4b5055 : 0x373b40, roughness: 1 }),
        );
        rock.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 0.4, CAVE_WIDTH / 2 + 1.4), THREE.MathUtils.randFloat(0.8, 3.1), z + THREE.MathUtils.randFloatSpread(2.7));
        rock.scale.y = THREE.MathUtils.randFloat(0.9, 1.85);
        shell.add(rock);
      }
      if (i % 3 === 0) {
        const overhead = new THREE.Mesh(
          new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.8, 1.8)),
          new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 1 }),
        );
        overhead.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 3), THREE.MathUtils.randFloat(3.2, 4.15), z);
        overhead.scale.y = THREE.MathUtils.randFloat(0.45, 0.9);
        shell.add(overhead);
      }
    }
    this.scene.add(shell);
    this.caveObjectIds.push(`loose-${shell.uuid}`);

    const entranceId = this.addWorldObject("caveExit", "입구로 나가기", this.createExitPortal(new THREE.Vector3(0, 0, CAVE_START_Z + 2))).id;
    const deepExitId = this.addWorldObject("caveExit", "동굴 끝 출구", this.createExitPortal(new THREE.Vector3(0, 0, CAVE_END_Z + 4))).id;
    this.caveObjectIds.push(entranceId, deepExitId);

    for (let i = 0; i < 34; i += 1) this.spawnOre("stone", this.randomCavePoint());
    for (let i = 0; i < 20; i += 1) this.spawnOre("coal", this.randomCavePoint());
    for (let i = 0; i < 12; i += 1) this.spawnOre(Math.random() < 0.62 ? "copper" : "iron", this.randomCavePoint());
    for (let i = 0; i < 3; i += 1) if (Math.random() < 0.52) this.spawnOre("gold", this.randomCavePoint());
    for (let i = 0; i < 2; i += 1) if (Math.random() < 0.28) this.spawnOre("diamond", this.randomCavePoint());
    for (let i = 0; i < 2; i += 1) if (Math.random() < 0.2) this.spawnOre("obsidian", this.randomCavePoint());
    if (Math.random() < 0.1) this.spawnMiner(this.randomCavePoint());

    if (Math.random() < 0.001) {
      for (let i = 0; i < 8; i += 1) {
        const chest = this.spawnChest(this.randomCavePoint(), true);
        this.caveObjectIds.push(chest.id);
      }
      for (let i = 0; i < 30; i += 1) this.spawnOre(this.rollMineMineral(), this.randomCavePoint());
      for (let i = 0; i < 3; i += 1) if (Math.random() < 0.35) this.spawnOre("obsidian", this.randomCavePoint());
      this.showMessage("엄청 드문 광산을 발견했습니다. 광산 상자가 많습니다!");
    }
  }

  private createExitPortal(position: THREE.Vector3) {
    const group = new THREE.Group();
    const portal = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 3.2, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x243a52, roughness: 0.6 }),
    );
    portal.position.y = 1.6;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2.4, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x8fd7ff, emissive: 0x3e91c2, emissiveIntensity: 0.9 }),
    );
    glow.position.y = 1.55;
    group.add(portal, glow);
    group.position.copy(position);
    return group;
  }

  private createHouseInterior(chestRich: boolean, houseKind: HouseKind = "home") {
    const room = new THREE.Group();
    const twoStory = houseKind === "twoStory";
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.16, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.88 }),
    );
    floor.position.set(0, -0.08, HOUSE_CENTER_Z);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.18, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x4b3322, roughness: 0.9 }),
    );
    ceiling.position.set(0, twoStory ? 6.25 : 3.65, HOUSE_CENTER_Z);
    room.add(floor, ceiling);

    for (const wall of [
      { x: 0, z: -5.75, w: 11.5, d: 0.2 },
      { x: 0, z: 5.75, w: 11.5, d: 0.2 },
      { x: -5.75, z: 0, w: 0.2, d: 11.5 },
      { x: 5.75, z: 0, w: 0.2, d: 11.5 },
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.w, twoStory ? 6.0 : 3.5, wall.d),
        new THREE.MeshStandardMaterial({ color: 0x9b7655, roughness: 0.82 }),
      );
      mesh.position.set(wall.x, twoStory ? 3.0 : 1.75, HOUSE_CENTER_Z + wall.z);
      room.add(mesh);
    }

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.55, 1.25),
      new THREE.MeshStandardMaterial({ color: houseKind === "blacksmith" ? 0x5b3428 : 0x3d5a80, roughness: 0.75 }),
    );
    bed.position.set(-3.15, 0.38, HOUSE_CENTER_Z - 2.9);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.18, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5d3a22, roughness: 0.84 }),
    );
    table.position.set(2.9, 1.0, HOUSE_CENTER_Z - 2.0);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xb45309, emissiveIntensity: 0.7, roughness: 0.42 }),
    );
    lamp.position.set(2.9, 1.42, HOUSE_CENTER_Z - 2.0);
    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.65, 0.04, 24),
      new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.8 }),
    );
    rug.position.set(0, 0.02, HOUSE_CENTER_Z + 0.4);
    rug.scale.z = 0.6;
    room.add(bed, table, lamp, rug);
    if (twoStory) {
      const upperFloor = new THREE.Mesh(
        new THREE.BoxGeometry(10.8, 0.18, 4.05),
        new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.86 }),
      );
      upperFloor.position.set(0, 2.55, HOUSE_CENTER_Z - 3.55);
      const upperRug = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.05, 1.45),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.8 }),
      );
      upperRug.position.set(1.6, 2.66, HOUSE_CENTER_Z - 3.55);
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.22, 0.92),
        new THREE.MeshStandardMaterial({ color: 0x5d3a22, roughness: 0.84 }),
      );
      desk.position.set(3.2, 3.05, HOUSE_CENTER_Z - 4.4);
      const bedUpper = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 0.45, 1.05),
        new THREE.MeshStandardMaterial({ color: 0x2f5f9f, roughness: 0.75 }),
      );
      bedUpper.position.set(-1.2, 2.88, HOUSE_CENTER_Z - 4.55);
      room.add(upperFloor, upperRug, desk, bedUpper);

      for (let i = 0; i < 9; i += 1) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.18, 0.52),
          new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.86 }),
        );
        const t = i / 8;
        step.position.set(-3.25, 0.18 + t * 2.45, HOUSE_CENTER_Z + 2.3 - t * 4.0);
        room.add(step);
      }
      for (const x of [-4.45, 4.45]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.72, 4.0),
          new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.84 }),
        );
        rail.position.set(x, 3.0, HOUSE_CENTER_Z - 3.55);
        room.add(rail);
      }
    }
    this.scene.add(room);
    this.houseObjectIds.push(`loose-${room.uuid}`);

    const exitId = this.addWorldObject("houseExit", "문으로 나가기", this.createHouseExit(new THREE.Vector3(0, 0, HOUSE_CENTER_Z + 5.2))).id;
    const chest = this.spawnChest(new THREE.Vector3(2.4, 0, HOUSE_CENTER_Z - 3.15), houseKind === "blacksmith" || chestRich);
    this.houseObjectIds.push(exitId, chest.id);
    if (houseKind === "blacksmith") {
      const workbench = this.spawnWorkbench(new THREE.Vector3(-3.15, 0, HOUSE_CENTER_Z + 1.9), true);
      const smelter = this.spawnSmelter(new THREE.Vector3(0, 0, HOUSE_CENTER_Z - 2.55), true);
      const grinder = this.spawnGrinder(new THREE.Vector3(3.15, 0, HOUSE_CENTER_Z + 1.7));
      const smith = this.spawnBlacksmithNpc(new THREE.Vector3(0, 0, HOUSE_CENTER_Z + 1.35));
      for (const station of [workbench, smelter, grinder]) {
        station.lockedStation = true;
        this.houseObjectIds.push(station.id);
      }
      this.houseObjectIds.push(smith.id);
    }
  }

  private createHouseExit(position: THREE.Vector3) {
    const group = new THREE.Group();
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.7, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.85 }),
    );
    door.position.y = 1.35;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 2.0, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0x92400e, emissiveIntensity: 0.65, roughness: 0.5 }),
    );
    glow.position.y = 1.25;
    group.add(door, glow);
    group.position.copy(position);
    return group;
  }

  private spawnOre(ore: ItemId, position: THREE.Vector3) {
    const colorByOre: Record<ItemId, number> = {
      stone: 0x8a8f93,
      coal: 0x202225,
      copper: 0xb66f39,
      iron: 0xb8aca0,
      gold: 0xe3ba32,
      diamond: 0x66d9e8,
      obsidian: 0x24152f,
    };
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75),
      new THREE.MeshStandardMaterial({
        color: colorByOre[ore] ?? 0x888888,
        emissive: ore === "diamond" ? 0x144d55 : 0x000000,
        emissiveIntensity: ore === "diamond" ? 0.35 : 0,
        roughness: 0.9,
      }),
    );
    mesh.position.copy(position);
    let collisionRadius = 0.75;
    let collisionHeight = 1.35;
    if (this.locationMode === "cave") {
      const onWall = Math.random() < 0.68;
      if (onWall) {
        const side = position.x < 0 ? -1 : position.x > 0 ? 1 : Math.random() < 0.5 ? -1 : 1;
        mesh.position.x = side * (CAVE_WIDTH / 2 - 0.25);
        mesh.position.y = THREE.MathUtils.randFloat(0.75, 2.75);
        mesh.scale.set(0.78, 0.95, 0.28);
        mesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        collisionRadius = 0.55;
        collisionHeight = 0.95;
      } else {
        mesh.position.y = 0.16;
        mesh.scale.set(1.05, 0.32, 1.05);
        collisionRadius = 0.78;
        collisionHeight = 0.35;
      }
    } else {
      mesh.position.y = this.getGroundHeightAt(position.x, position.z) + 0.16;
      mesh.scale.set(0.96, 0.36, 0.96);
      collisionHeight = 0.42;
    }
    const object = this.addWorldObject("ore", ITEM_NAMES[ore] ?? ore, mesh, {
      ore,
      collidable: true,
      collisionRadius,
      collisionHeight,
    });
    if (this.locationMode === "cave") this.caveObjectIds.push(object.id);
    return object;
  }

  private spawnMiner(position: THREE.Vector3) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x5b6c77, roughness: 0.85 }),
    );
    body.position.y = 1;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32),
      new THREE.MeshStandardMaterial({ color: 0xd3a06d, roughness: 0.8 }),
    );
    head.position.y = 1.85;
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.7 }),
    );
    helmet.position.y = 2.15;
    group.add(body, head, helmet);
    group.position.copy(position);
    const object = this.addWorldObject("miner", "광부", group, {
      collidable: true,
      collisionRadius: 0.65,
      collisionHeight: 2.2,
    });
    this.caveObjectIds.push(object.id);
    return object;
  }

  private spawnAnimal(position: THREE.Vector3, preferredType?: AnimalKind) {
    const group = new THREE.Group();
    const roll = Math.random();
    const animalType: AnimalKind = preferredType ?? (roll < 0.32 ? "cow" : roll < 0.58 ? "horse" : roll < 0.82 ? "pig" : "chicken");
    const isChicken = animalType === "chicken";
    const isPig = animalType === "pig";
    const isHorse = animalType === "horse";
    const walkParts: WalkPartSetup[] = [];
    const bodyColor = isHorse ? 0x9a6338 : animalType === "cow" ? 0xf2eee4 : isPig ? 0xf2a5b5 : 0xf2e6bf;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(isChicken ? 0.68 : isHorse ? 1.85 : 1.5, isChicken ? 0.56 : isHorse ? 0.82 : 0.74, isChicken ? 0.5 : 0.62),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9 }),
    );
    body.position.y = isChicken ? 0.48 : isHorse ? 1.05 : 0.88;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(isChicken ? 0.42 : isHorse ? 0.52 : 0.6, isChicken ? 0.38 : 0.48, isChicken ? 0.38 : 0.48),
      new THREE.MeshStandardMaterial({ color: isHorse ? 0x8a512e : animalType === "cow" ? 0xd9c7ae : isPig ? 0xf5b4c0 : 0xf6e7c8, roughness: 0.9 }),
    );
    head.position.set(isChicken ? 0.42 : isHorse ? 1.18 : 0.96, isChicken ? 0.86 : isHorse ? 1.36 : 1.05, 0);
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(isChicken ? 0.18 : 0.28, isHorse ? 0.78 : 0.35, isChicken ? 0.18 : 0.36),
      new THREE.MeshStandardMaterial({ color: isHorse ? 0x8a512e : animalType === "cow" ? 0xd9c7ae : isPig ? 0xf5b4c0 : 0xf6e7c8, roughness: 0.9 }),
    );
    neck.position.set(isChicken ? 0.24 : 0.86, isChicken ? 0.68 : isHorse ? 1.22 : 1.0, 0);
    neck.rotation.z = isHorse ? -0.35 : -0.12;
    group.add(body, neck, head);
    const legXs = isChicken ? [-0.18, 0.18] : [-0.58, 0.58];
    const legZs = isChicken ? [0] : [-0.23, 0.23];
    for (const x of legXs) {
      for (const z of legZs) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(isChicken ? 0.06 : 0.16, isChicken ? 0.36 : isHorse ? 0.95 : 0.72, isChicken ? 0.06 : 0.16),
          new THREE.MeshStandardMaterial({ color: isChicken ? 0xd97706 : isHorse ? 0x4d2f20 : 0x3c332d, roughness: 0.92 }),
        );
        leg.position.set(x, isChicken ? 0.18 : isHorse ? 0.48 : 0.36, z);
        walkParts.push({ object: leg, side: (x >= 0 ? 1 : -1) * (z >= 0 ? 1 : -1), axis: "z" });
        group.add(leg);
      }
    }
    const tail = new THREE.Mesh(
      new THREE.CylinderGeometry(isChicken ? 0.04 : 0.035, isChicken ? 0.08 : 0.06, isChicken ? 0.32 : isHorse ? 0.9 : 0.55, 7),
      new THREE.MeshStandardMaterial({ color: isChicken ? 0xffffff : isHorse ? 0x2b1a12 : isPig ? 0xf28aa2 : 0xddd6c9, roughness: 0.9 }),
    );
    tail.position.set(isChicken ? -0.42 : isHorse ? -1.05 : -0.82, isChicken ? 0.67 : isHorse ? 1.08 : 0.83, 0);
    tail.rotation.z = isChicken ? 0.8 : 1.1;
    group.add(tail);
    for (const z of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(isChicken ? 0.035 : 0.045, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 }),
      );
      eye.position.set(head.position.x + (isChicken ? 0.21 : 0.29), head.position.y + 0.08, z);
      group.add(eye);
    }
    const nose = new THREE.Mesh(
      isChicken ? new THREE.ConeGeometry(0.11, 0.24, 4) : new THREE.BoxGeometry(isPig ? 0.28 : 0.2, isPig ? 0.18 : 0.12, isPig ? 0.28 : 0.18),
      new THREE.MeshStandardMaterial({ color: isChicken ? 0xf59e0b : isPig ? 0xe8798f : 0x2f2118, roughness: 0.76 }),
    );
    nose.position.set(head.position.x + (isChicken ? 0.32 : 0.34), head.position.y - (isChicken ? 0.02 : 0.04), 0);
    if (isChicken) nose.rotation.z = -Math.PI / 2;
    group.add(nose);
    if (animalType === "cow") {
      const spot = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.06, 0.64),
        new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 0.9 }),
      );
      spot.position.set(-0.18, 1.27, 0);
      group.add(spot);
    }
    if (isChicken) {
      const comb = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.75 }),
      );
      comb.position.set(0.43, 1.11, 0);
      group.add(comb);
    }
    group.position.copy(position);
    const nameByAnimal: Record<AnimalKind, string> = { horse: "말", cow: "소", pig: "돼지", chicken: "닭" };
    return this.addWorldObject("animal", nameByAnimal[animalType], group, {
      hp: isHorse ? 10 : isChicken ? 3 : 8,
      animalKind: animalType,
      wanderAngle: Math.random() * Math.PI * 2,
      collidable: true,
      collisionRadius: isChicken ? 0.45 : isHorse ? 1.15 : 0.95,
      collisionHeight: isChicken ? 0.95 : isHorse ? 1.75 : 1.35,
      walkCycle: this.createWalkCycle(walkParts, isChicken ? 0.72 : 0.42, isChicken ? 10 : 7.5, isChicken ? 0.05 : 0.035),
    });
  }

  private spawnPredator(position: THREE.Vector3, preferredType?: PredatorKind) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const predatorKind = preferredType ?? (Math.random() < 0.5 ? "wolf" : Math.random() < 0.72 ? "spider" : "lion");
    const group = new THREE.Group();
    const walkParts: WalkPartSetup[] = [];
    const isSpider = predatorKind === "spider";
    const color = predatorKind === "lion" ? 0xb77935 : predatorKind === "wolf" ? 0x6b7280 : 0x27272a;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(isSpider ? 1.15 : predatorKind === "lion" ? 1.9 : 1.45, isSpider ? 0.32 : 0.72, isSpider ? 0.9 : 0.56),
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
    );
    body.position.y = isSpider ? 0.42 : 0.82;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(isSpider ? 0.46 : 0.5, isSpider ? 0.28 : 0.42, isSpider ? 0.5 : 0.42),
      new THREE.MeshStandardMaterial({ color: predatorKind === "lion" ? 0xc88a45 : color, roughness: 0.84 }),
    );
    head.position.set(isSpider ? 0.72 : 0.98, isSpider ? 0.46 : 0.95, 0);
    group.add(body, head);
    const legCount = isSpider ? 8 : 4;
    for (let index = 0; index < legCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(isSpider ? 0.08 : 0.14, isSpider ? 0.12 : 0.62, isSpider ? 0.62 : 0.14),
        new THREE.MeshStandardMaterial({ color: isSpider ? 0x111827 : 0x2f2a25, roughness: 0.9 }),
      );
      leg.position.set(isSpider ? -0.36 + row * 0.28 : side * (row < 1 ? 0.48 : -0.48), isSpider ? 0.24 : 0.34, side * (isSpider ? 0.52 : 0.22));
      leg.rotation.x = side * (isSpider ? 0.55 : 0);
      walkParts.push({ object: leg, side: side * (row % 2 === 0 ? 1 : -1), axis: isSpider ? "z" : "x" });
      group.add(leg);
    }
    for (const z of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff7ed, roughness: 0.35 }));
      eye.position.set(head.position.x + 0.26, head.position.y + 0.04, z);
      group.add(eye);
    }
    if (predatorKind === "lion") {
      const mane = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0x7c3f18, roughness: 0.9 }));
      mane.position.set(0.82, 0.95, 0);
      mane.scale.set(0.8, 0.9, 0.8);
      group.add(mane);
    }
    group.position.copy(position);
    const nameByKind: Record<PredatorKind, string> = { wolf: "늑대", lion: "사자", spider: "거미" };
    return this.addWorldObject("wildPredator", nameByKind[predatorKind], group, {
      hp: predatorKind === "lion" ? 24 : predatorKind === "wolf" ? 14 : 10,
      predatorKind,
      collidable: true,
      collisionRadius: isSpider ? 0.78 : predatorKind === "lion" ? 1.2 : 0.9,
      collisionHeight: isSpider ? 0.7 : 1.25,
      wanderAngle: Math.random() * Math.PI * 2,
      attackDamage: predatorKind === "lion" ? 3 : 2,
      walkCycle: this.createWalkCycle(walkParts, isSpider ? 0.9 : 0.55, isSpider ? 10 : 8, isSpider ? 0.045 : 0.035),
    });
  }

  private spawnAntHill(position: THREE.Vector3, remaining = 5) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const dirt = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.96 });
    const mound = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.5, 14), dirt);
    mound.position.y = 0.25;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x1f130c, roughness: 1 }));
    hole.position.y = 0.52;
    group.add(mound, hole);
    for (let i = 0; i < 7; i += 1) {
      const ant = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 }));
      const angle = (i / 7) * Math.PI * 2;
      ant.position.set(Math.cos(angle) * THREE.MathUtils.randFloat(0.35, 0.7), 0.56, Math.sin(angle) * THREE.MathUtils.randFloat(0.35, 0.7));
      group.add(ant);
    }
    group.position.copy(position);
    return this.addWorldObject("antHill", "개미굴", group, {
      antMeatRemaining: remaining,
      collisionRadius: 0.95,
      collisionHeight: 0.6,
    });
  }

  private spawnVillage(position: THREE.Vector3, houseCount = 5, special = false) {
    const villageId = `village-${crypto.randomUUID()}`;
    position.y = this.getGroundHeightAt(position.x, position.z);
    this.spawnVillageHouse(position.clone().add(new THREE.Vector3(0, 0, 0)), "마을 식량창고", true, villageId);

    const ringRadius = special ? 27 : 18;
    this.spawnVillageFence(position.clone(), ringRadius + 7, villageId);
    for (let i = 0; i < houseCount; i += 1) {
      const angle = (i / houseCount) * Math.PI * 2 + (special ? 0.16 : 0.32);
      const offset = new THREE.Vector3(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
      this.spawnVillageHouse(position.clone().add(offset), special ? "큰 마을 집" : "주민의 집", false, villageId, i % 4);
    }
    if (Math.random() < 0.5) {
      this.spawnBlacksmith(position.clone().add(new THREE.Vector3(-ringRadius * 0.62, 0, ringRadius * 0.54)), villageId);
    }

    const well = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.9, 14),
      new THREE.MeshStandardMaterial({ color: 0x8b8f94, roughness: 1 }),
    );
    base.position.y = 0.45;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: 0x4aa3df, roughness: 0.45, metalness: 0.1 }),
    );
    water.position.y = 0.94;
    const roofA = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.2, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x5c3b24, roughness: 0.9 }),
    );
    roofA.position.set(-1.15, 1.75, 0);
    const roofB = roofA.clone();
    roofB.position.x = 1.15;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x5c3b24, roughness: 0.9 }),
    );
    beam.position.y = 2.75;
    well.add(base, water, roofA, roofB, beam);
    well.position.copy(position.clone().add(new THREE.Vector3(-1, 0, -9)));
    this.addWorldObject("villageHouse", "마을 우물", well, { collidable: true, collisionRadius: 1.55, collisionHeight: 1.0, villageId });

    for (let i = 0; i < (special ? 12 : 7); i += 1) {
      this.spawnVillager(position.clone().add(new THREE.Vector3(THREE.MathUtils.randFloat(-ringRadius, ringRadius), 0, THREE.MathUtils.randFloat(-ringRadius, ringRadius))), villageId, position.clone(), ringRadius);
    }
    const meleeCount = special ? 5 : 3;
    for (let i = 0; i < meleeCount; i += 1) {
      const angle = (i / meleeCount) * Math.PI * 2;
      this.spawnKnight(position.clone().add(new THREE.Vector3(Math.cos(angle) * 8, 0, Math.sin(angle) * 8)), villageId);
    }
    if (special && houseCount >= 10) {
      this.spawnRangedGuard(position.clone().add(new THREE.Vector3(0, 0, -21)), villageId, "villageArcher");
      this.spawnRangedGuard(position.clone().add(new THREE.Vector3(14, 0, 18)), villageId, "villageArcher");
      this.spawnRangedGuard(position.clone().add(new THREE.Vector3(-18, 0, 12)), villageId, "villageMage");
    }
    if (houseCount >= 15 && Math.random() < 0.01) this.spawnKing(position.clone().add(new THREE.Vector3(0, 0, 6)), villageId);
    this.spawnGolem(position.clone().add(new THREE.Vector3(-5, 0, 5)), villageId);
  }

  private spawnVillageFence(position: THREE.Vector3, radius: number, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.9 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.88 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x7a6f62, roughness: 0.96 });
    const segments = 36;
    const collisionSegments: CollisionSegment[] = [];
    const gateIndices = new Set([0, 1, segments - 1, segments / 2 - 1, segments / 2, segments / 2 + 1]);

    const makePost = (x: number, z: number, height: number) => {
      const groundY = this.getGroundHeightAt(position.x + x, position.z + z) - position.y;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, height, 0.34), wood);
      post.position.set(x, groundY + height / 2 - 0.05, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.34, 4), darkWood);
      cap.position.set(x, groundY + height + 0.08, z);
      cap.rotation.y = Math.PI / 4;
      group.add(post, cap);
    };
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      if (gateIndices.has(i)) {
        makePost(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.95);
        continue;
      }
      const nextAngle = ((i + 1) / segments) * Math.PI * 2;
      const start = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const end = new THREE.Vector3(Math.cos(nextAngle) * radius, 0, Math.sin(nextAngle) * radius);
      start.y = this.getGroundHeightAt(position.x + start.x, position.z + start.z) - position.y;
      end.y = this.getGroundHeightAt(position.x + end.x, position.z + end.z) - position.y;
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const length = Math.hypot(end.x - start.x, end.z - start.z);
      const chordAngle = Math.atan2(end.z - start.z, end.x - start.x);

      const base = new THREE.Mesh(new THREE.BoxGeometry(length + 0.08, 0.58, 0.5), stone);
      base.position.set(mid.x, mid.y + 0.28, mid.z);
      base.rotation.y = -chordAngle;
      const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.18, 0.18, 0.22), darkWood);
      lowerRail.position.set(mid.x, mid.y + 0.84, mid.z);
      lowerRail.rotation.y = -chordAngle;
      const upperRail = new THREE.Mesh(new THREE.BoxGeometry(length + 0.18, 0.18, 0.22), darkWood);
      upperRail.position.set(mid.x, mid.y + 1.28, mid.z);
      upperRail.rotation.y = -chordAngle;
      group.add(base, lowerRail, upperRail);
      makePost(start.x, start.z, 1.7);
      makePost(end.x, end.z, 1.7);
      collisionSegments.push({ start, end, halfWidth: 0.38, height: 1.62 });
    }
    group.position.copy(position);
    return this.addWorldObject("villageFence", "마을 울타리", group, {
      collidable: true,
      collisionRadius: 0,
      collisionHeight: 1.65,
      collisionSegments,
      terrainRadius: radius,
      villageId,
    });
  }

  private spawnKing(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const robe = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.76 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.32, roughness: 0.35 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd1a17a, roughness: 0.78 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.5), robe);
    body.position.y = 0.98;
    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.18, 0.08), new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.82 }));
    cape.position.set(0, 1.02, -0.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), skin);
    head.position.y = 1.8;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.34, 7), gold);
    crown.position.y = 2.18;
    const scepter = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.05, 8), gold);
    scepter.position.set(0.58, 1.08, 0.18);
    scepter.rotation.z = -0.18;
    group.add(cape, body, head, crown, scepter);
    group.position.copy(position);
    return this.addWorldObject("villageKing", "왕", group, {
      hp: 35,
      armor: 8,
      collidable: true,
      collisionRadius: 0.72,
      collisionHeight: 2.35,
      villageId,
    });
  }

  private spawnVillageHouse(position: THREE.Vector3, name: string, isStorage: boolean, villageId: string, variant = Math.floor(Math.random() * 4)) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const house = new THREE.Group();
    const isTwoStory = !isStorage && variant % 4 === 3;
    const houseStyles = [
      { width: 4.6, depth: 4.1, wall: 0x9f7650, roof: 0x6f3d2b, roofHeight: 1.65, chimneyX: 0.24, bodyHeight: 2.7 },
      { width: 5.3, depth: 3.8, wall: 0x8f6847, roof: 0x42526b, roofHeight: 1.35, chimneyX: -0.22, bodyHeight: 2.7 },
      { width: 4.2, depth: 4.9, wall: 0xa66a3f, roof: 0x5b341d, roofHeight: 1.9, chimneyX: 0.1, bodyHeight: 2.7 },
      { width: 5.6, depth: 4.9, wall: 0x8b6f47, roof: 0x334155, roofHeight: 1.55, chimneyX: 0.25, bodyHeight: 4.85 },
    ];
    const style = isStorage ? { width: 7.1, depth: 5.5, wall: 0x8a5a32, roof: 0xb45309, roofHeight: 1.45, chimneyX: 0.28, bodyHeight: 2.7 } : houseStyles[variant % houseStyles.length];
    const width = style.width;
    const depth = style.depth;
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(width, style.bodyHeight, depth),
      new THREE.MeshStandardMaterial({ color: style.wall, roughness: 0.8 }),
    );
    hut.position.y = style.bodyHeight / 2;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(width, depth) * 0.76, style.roofHeight, 4),
      new THREE.MeshStandardMaterial({ color: style.roof, roughness: 0.85 }),
    );
    roof.position.y = style.bodyHeight + style.roofHeight * 0.5;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.45, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x4b2e1c, roughness: 0.85 }),
    );
    door.position.set(0, 0.72, depth / 2 + 0.045);
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x9bd7ff, emissive: 0x1d4f72, emissiveIntensity: 0.18, roughness: 0.25 });
    const windowA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.48, 0.08), windowMaterial);
    windowA.position.set(-width * 0.28, 1.52, depth / 2 + 0.052);
    const windowB = windowA.clone();
    windowB.position.x = width * 0.28;
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 1.05, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x5b3428, roughness: 0.9 }),
    );
    chimney.position.set(width * style.chimneyX, style.bodyHeight + 0.68, -depth * 0.18);
    house.add(hut, roof, door, windowA, windowB, chimney);
    if (isStorage) {
      const doubleDoor = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.75, 0.1), new THREE.MeshStandardMaterial({ color: 0x3f2415, roughness: 0.88 }));
      doubleDoor.position.set(0, 0.88, depth / 2 + 0.07);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.42, 0.1), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x7c2d12, emissiveIntensity: 0.12, roughness: 0.62 }));
      sign.position.set(0, 2.35, depth / 2 + 0.09);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.12, 0.72), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82 }));
      awning.position.set(0, 2.0, depth / 2 + 0.42);
      house.add(doubleDoor, sign, awning);
      for (const x of [-2.8, 2.8]) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.62, 0.8), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 }));
        crate.position.set(x, 0.31, depth / 2 + 0.72);
        const sack = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 7), new THREE.MeshStandardMaterial({ color: 0xd6b171, roughness: 0.95 }));
        sack.position.set(x * 0.82, 0.34, depth / 2 + 0.98);
        sack.scale.set(0.82, 1.05, 0.72);
        house.add(crate, sack);
      }
    } else {
      if (isTwoStory) {
        const secondBand = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, 0.12, depth * 1.04), new THREE.MeshStandardMaterial({ color: 0x4b2e1c, roughness: 0.84 }));
        secondBand.position.y = 2.55;
        const upperWindowA = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.08), windowMaterial);
        upperWindowA.position.set(-width * 0.24, 3.55, depth / 2 + 0.058);
        const upperWindowB = upperWindowA.clone();
        upperWindowB.position.x = width * 0.24;
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.15, 0.72), new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.86 }));
        balcony.position.set(0, 2.62, depth / 2 + 0.45);
        const balconyRail = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.42, 0.1), new THREE.MeshStandardMaterial({ color: 0x3f2718, roughness: 0.84 }));
        balconyRail.position.set(0, 2.92, depth / 2 + 0.78);
        house.add(secondBand, upperWindowA, upperWindowB, balcony, balconyRail);
      }
      if (variant % 3 === 1) {
        const porch = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.16, 0.92), new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 }));
        porch.position.set(0, 0.12, depth / 2 + 0.55);
        const railA = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x4b2e1c, roughness: 0.86 }));
        railA.position.set(0, 0.68, depth / 2 + 0.96);
        house.add(porch, railA);
      }
      if (variant % 3 === 2) {
        const sideShed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.45, 1.55), new THREE.MeshStandardMaterial({ color: 0x7c5132, roughness: 0.84 }));
        sideShed.position.set(-width / 2 - 0.55, 0.72, -0.25);
        const planter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: 0x5b341d, roughness: 0.9 }));
        planter.position.set(width * 0.28, 0.55, depth / 2 + 0.14);
        house.add(sideShed, planter);
      }
    }
    house.position.copy(position);
    return this.addWorldObject(isStorage ? "foodStorage" : "villageHouse", name, house, {
      collidable: true,
      collisionRadius: Math.max(width, depth) * 0.56,
      collisionHeight: isTwoStory ? 6.2 : 3.4,
      villageId,
      enterable: !isStorage,
      houseKind: isTwoStory ? "twoStory" : "home",
      foodRemaining: isStorage ? 10 : undefined,
    });
  }

  private spawnBlacksmith(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const forge = new THREE.Group();
    const width = 6.4;
    const depth = 5.1;
    const stone = new THREE.MeshStandardMaterial({ color: 0x6b7076, roughness: 0.88 });
    const darkRoof = new THREE.MeshStandardMaterial({ color: 0x2f2f34, roughness: 0.82 });
    const ember = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xb45309, emissiveIntensity: 0.8, roughness: 0.45 });
    const hut = new THREE.Mesh(new THREE.BoxGeometry(width, 2.9, depth), stone);
    hut.position.y = 1.45;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.78, 1.55, 4), darkRoof);
    roof.position.y = 3.42;
    roof.rotation.y = Math.PI / 4;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.65, 0.7), darkRoof);
    chimney.position.set(width * 0.25, 4.0, -depth * 0.12);
    const forgeGlow = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.44, 0.1), ember);
    forgeGlow.position.set(-width * 0.18, 0.9, depth / 2 + 0.06);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.38, 0.08), new THREE.MeshStandardMaterial({ color: 0x3f2415, roughness: 0.78 }));
    sign.position.set(0, 2.35, depth / 2 + 0.08);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.42), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.45, roughness: 0.4 }));
    anvil.position.set(width * 0.24, 0.55, depth / 2 + 0.08);
    forge.add(hut, roof, chimney, forgeGlow, sign, anvil);
    forge.position.copy(position);
    return this.addWorldObject("blacksmith", "대장간", forge, {
      collidable: true,
      collisionRadius: Math.max(width, depth) * 0.58,
      collisionHeight: 3.5,
      villageId,
      enterable: true,
      houseChestRich: true,
      houseKind: "blacksmith",
    });
  }

  private spawnBlacksmithNpc(position: THREE.Vector3, villageId = `blacksmith-${crypto.randomUUID()}`) {
    position.y = this.locationMode === "house" ? 0 : this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc58b64, roughness: 0.78 });
    const sootSkin = new THREE.MeshStandardMaterial({ color: 0x8d5b3d, roughness: 0.82 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82 });
    const apron = new THREE.MeshStandardMaterial({ color: 0x4a2d1a, roughness: 0.9 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.86 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8c1cc, metalness: 0.45, roughness: 0.34 });
    const ember = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xc2410c, emissiveIntensity: 0.8, roughness: 0.45 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.08, 0.52), shirt);
    torso.position.y = 1.05;
    const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.86, 0.055), apron);
    apronFront.position.set(0, 0.98, 0.3);
    const apronNeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.07), leather);
    apronNeck.position.set(0, 1.43, 0.31);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.58), leather);
    belt.position.y = 0.58;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), skin);
    head.position.y = 1.84;
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), dark);
    beard.position.set(0, 1.68, 0.19);
    beard.scale.set(1.05, 0.7, 0.72);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    hair.position.y = 1.95;
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.09, 0.06), steel);
    goggles.position.set(0, 1.86, 0.31);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), sootSkin);
    nose.position.set(0, 1.78, 0.34);
    group.add(torso, apronFront, apronNeck, belt, head, beard, hair, goggles, nose);

    for (const x of [-0.12, 0.12]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dark);
      lens.position.set(x, 1.86, 0.35);
      group.add(lens);
    }

    for (const side of [-1, 1]) {
      const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.22), shirt);
      upperArm.position.set(side * 0.6, 1.08, 0.02);
      upperArm.rotation.z = side * -0.22;
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.46, 10), sootSkin);
      forearm.position.set(side * 0.72, 0.73, 0.08);
      forearm.rotation.z = side * -0.18;
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), dark);
      glove.position.set(side * 0.76, 0.48, 0.12);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.58, 0.22), dark);
      leg.position.set(side * 0.2, 0.28, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.32), leather);
      boot.position.set(side * 0.2, 0.04, 0.06);
      group.add(upperArm, forearm, glove, leg, boot);
    }

    const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 8), leather);
    hammerHandle.position.set(0.83, 0.55, 0.2);
    hammerHandle.rotation.z = -0.72;
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.16), steel);
    hammerHead.position.set(1.02, 0.78, 0.2);
    hammerHead.rotation.z = -0.72;
    const coalDust = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.04), ember);
    coalDust.position.set(-0.15, 1.28, 0.335);
    group.add(hammerHandle, hammerHead, coalDust);

    group.position.copy(position);
    return this.addWorldObject("blacksmithNpc", "대장장이", group, {
      collidable: true,
      collisionRadius: 0.62,
      collisionHeight: 2.25,
      villageId,
    });
  }

  private spawnVillager(position: THREE.Vector3, villageId: string, homePosition = position.clone(), roamRadius = 14) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xd1a17a, roughness: 0.78 });
    const tunic = new THREE.MeshStandardMaterial({ color: 0x5f8c6b, roughness: 0.82 });
    const apron = new THREE.MeshStandardMaterial({ color: 0xd9c7a3, roughness: 0.86 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.86 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
    const straw = new THREE.MeshStandardMaterial({ color: 0xd7a84f, roughness: 0.9 });
    const walkParts: WalkPartSetup[] = [];

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.0, 0.42), tunic);
    torso.position.y = 0.93;
    const apronFront = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.04), apron);
    apronFront.position.set(0, 0.96, 0.24);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.47), leather);
    belt.position.y = 0.66;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10), skin);
    head.position.y = 1.67;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
    hair.position.y = 1.75;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
    nose.position.set(0, 1.67, 0.31);
    const smile = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.018), dark);
    smile.position.set(0, 1.57, 0.31);
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.055, 18), straw);
    hatBrim.position.y = 1.93;
    const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.34, 18), straw);
    hatTop.position.y = 2.1;
    group.add(torso, apronFront, belt, head, hair, nose, smile, hatBrim, hatTop);

    for (const x of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), dark);
      eye.position.set(x, 1.7, 0.29);
      group.add(eye);
    }

    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.18), tunic);
      sleeve.position.set(side * 0.48, 0.98, 0);
      sleeve.rotation.z = side * -0.18;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
      hand.position.set(side * 0.55, 0.68, 0.04);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), leather);
      leg.position.set(side * 0.17, 0.28, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.26), dark);
      boot.position.set(side * 0.17, 0.04, 0.04);
      walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
      group.add(sleeve, hand, leg, boot);
    }

    const sidePouch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.12), leather);
    sidePouch.position.set(-0.43, 0.68, 0.18);
    const basket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x9b6a38, roughness: 0.9 }),
    );
    basket.position.set(0.52, 0.52, 0.16);
    basket.rotation.z = -0.2;
    group.add(sidePouch, basket);
    group.position.copy(position);
    return this.addWorldObject("villager", "주민", group, {
      hp: 10,
      collidable: true,
      collisionRadius: 0.58,
      collisionHeight: 2.15,
      villageId,
      homePosition: homePosition.clone(),
      roamRadius,
      wanderAngle: Math.random() * Math.PI * 2,
      walkCycle: this.createWalkCycle(walkParts, 0.34, 7, 0.025),
    });
  }

  private spawnKnight(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xaab5bf, metalness: 0.45, roughness: 0.38 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.45, roughness: 0.42 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2f5f9f, roughness: 0.68 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf3c969, metalness: 0.35, roughness: 0.36 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xceb08c, roughness: 0.8 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x5a3823, roughness: 0.85 });
    const walkParts: WalkPartSetup[] = [];

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.52), steel);
    torso.position.y = 1.02;
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.055), darkSteel);
    chestPlate.position.set(0, 1.12, 0.3);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.07), gold);
    crest.position.set(0, 1.18, 0.34);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.11, 0.58), leather);
    belt.position.y = 0.58;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 10), skin);
    neck.position.y = 1.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), skin);
    head.position.y = 1.93;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.72), darkSteel);
    helmet.position.y = 2.02;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.09), steel);
    visor.position.set(0, 1.93, 0.31);
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.08), blue);
    plume.position.set(0, 2.34, -0.04);
    group.add(torso, chestPlate, crest, belt, neck, head, helmet, visor, plume);

    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), darkSteel);
      pauldron.position.set(side * 0.62, 1.52, 0);
      pauldron.scale.set(1.25, 0.58, 0.9);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), steel);
      arm.position.set(side * 0.68, 1.0, 0.02);
      arm.rotation.z = side * -0.12;
      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), darkSteel);
      gauntlet.position.set(side * 0.73, 0.58, 0.06);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.24), steel);
      leg.position.set(side * 0.23, 0.27, 0);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.34), darkSteel);
      boot.position.set(side * 0.23, 0.03, 0.06);
      walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
      group.add(pauldron, arm, gauntlet, leg, boot);
    }

    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.95, 0.68),
      blue,
    );
    shield.position.set(-0.75, 1.05, 0.22);
    shield.rotation.z = 0.05;
    const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), gold);
    shieldBoss.position.set(-0.86, 1.06, 0.22);
    shieldBoss.scale.set(0.55, 1, 1);
    const swordBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.82, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xd8dee8, metalness: 0.6, roughness: 0.28 }),
    );
    swordBlade.position.set(0.78, 1.12, 0.26);
    swordBlade.rotation.z = -0.22;
    const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), gold);
    swordGuard.position.set(0.7, 0.78, 0.24);
    swordGuard.rotation.z = -0.22;
    const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), leather);
    swordGrip.position.set(0.64, 0.62, 0.22);
    swordGrip.rotation.z = -0.22;
    group.add(shield, shieldBoss, swordBlade, swordGuard, swordGrip);
    group.position.copy(position);
    return this.addWorldObject("villageKnight", "마을기사", group, {
      hp: 10,
      armor: 5,
      collidable: true,
      collisionRadius: 0.78,
      collisionHeight: 2.42,
      villageId,
      guardMode: "melee",
      attackRange: 2.05,
      attackDamage: 1,
      walkCycle: this.createWalkCycle(walkParts, 0.38, 8, 0.025),
    });
  }

  private spawnGolem(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x7e878c, roughness: 0.92, metalness: 0.1 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x4d555a, roughness: 0.96, metalness: 0.08 });
    const moss = new THREE.MeshStandardMaterial({ color: 0x2f7a38, roughness: 0.92 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x9ff8ff, emissive: 0x16a6c7, emissiveIntensity: 1.4, roughness: 0.22 });

    const addBlock = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      group.add(mesh);
      return mesh;
    };

    addBlock(new THREE.BoxGeometry(1.78, 2.18, 0.98), stone, 0, 1.62, 0, 0.02, 0, 0.03);
    addBlock(new THREE.BoxGeometry(1.32, 0.78, 1.04), darkStone, 0, 1.28, 0.04, 0, 0, -0.02);
    const chestCore = addBlock(new THREE.OctahedronGeometry(0.28), glow, 0, 1.95, 0.56);
    chestCore.scale.set(0.85, 1.15, 0.35);
    addBlock(new THREE.BoxGeometry(0.64, 0.34, 0.62), darkStone, 0, 2.82, 0);
    addBlock(new THREE.BoxGeometry(1.04, 0.86, 0.82), stone, 0, 3.24, 0.02, -0.02, 0.02, 0);
    addBlock(new THREE.BoxGeometry(1.12, 0.16, 0.18), darkStone, 0, 3.38, 0.45);
    addBlock(new THREE.BoxGeometry(0.82, 0.18, 0.24), darkStone, 0, 2.88, 0.4);

    for (const x of [-0.26, 0.26]) {
      const eye = addBlock(new THREE.BoxGeometry(0.16, 0.12, 0.08), glow, x, 3.28, 0.48);
      eye.scale.z = 0.55;
    }

    for (const side of [-1, 1]) {
      addBlock(new THREE.BoxGeometry(0.86, 0.42, 0.78), darkStone, side * 1.18, 2.38, 0, 0, 0, side * 0.12);
      addBlock(new THREE.BoxGeometry(0.42, 1.18, 0.44), stone, side * 1.42, 1.68, 0, 0, 0, side * 0.14);
      addBlock(new THREE.BoxGeometry(0.5, 1.02, 0.48), darkStone, side * 1.5, 0.85, 0.04, 0, 0, side * -0.1);
      addBlock(new THREE.BoxGeometry(0.74, 0.48, 0.64), stone, side * 1.56, 0.28, 0.08, 0, side * 0.04, side * -0.05);
      addBlock(new THREE.BoxGeometry(0.54, 1.0, 0.55), stone, side * 0.52, 0.58, 0, 0, 0, side * 0.04);
      addBlock(new THREE.BoxGeometry(0.7, 0.28, 0.72), darkStone, side * 0.54, 0.08, 0.14);
      addBlock(new THREE.ConeGeometry(0.16, 0.46, 4), darkStone, side * 1.2, 2.84, 0.03, 0, side * 0.55, side * -0.22);
      addBlock(new THREE.BoxGeometry(0.08, 0.42, 0.08), glow, side * 1.14, 2.32, 0.43, 0, 0, side * 0.1);
      addBlock(new THREE.BoxGeometry(0.08, 0.38, 0.08), glow, side * 1.55, 1.22, 0.34, 0, 0, side * -0.1);
    }

    addBlock(new THREE.BoxGeometry(1.1, 0.08, 1.04), moss, -0.18, 2.72, 0.04);
    addBlock(new THREE.BoxGeometry(0.14, 0.74, 0.08), moss, -0.66, 2.28, 0.54, 0, 0, -0.08);
    addBlock(new THREE.BoxGeometry(0.1, 0.58, 0.08), moss, 0.58, 2.16, 0.54, 0, 0, 0.12);
    addBlock(new THREE.BoxGeometry(0.78, 0.1, 0.1), glow, 0, 1.54, 0.58);
    addBlock(new THREE.BoxGeometry(0.1, 0.5, 0.08), glow, 0, 1.18, 0.58);
    addBlock(new THREE.ConeGeometry(0.1, 0.38, 4), darkStone, -0.42, 3.82, 0.02, 0, 0.2, 0);
    addBlock(new THREE.ConeGeometry(0.1, 0.38, 4), darkStone, 0.42, 3.82, 0.02, 0, -0.2, 0);
    group.position.copy(position);
    return this.addWorldObject("villageGolem", "마을 수호신 골렘", group, {
      hp: 100,
      armor: 0,
      collidable: true,
      collisionRadius: 1.45,
      collisionHeight: 3.9,
      villageId,
      guardMode: "melee",
      attackRange: 2.55,
      attackDamage: 9,
      attackInterval: 5,
    });
  }

  private spawnRangedGuard(position: THREE.Vector3, villageId: string, type: "villageArcher" | "villageMage") {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const isMage = type === "villageMage";
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xceb08c, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x5a3823, roughness: 0.86 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.82 });
    const walkParts: WalkPartSetup[] = [];

    if (isMage) {
      const robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.62, 1.32, 8),
        new THREE.MeshStandardMaterial({ color: 0x5b3f8f, roughness: 0.78 }),
      );
      robe.position.y = 0.92;
      const robeFront = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 1.08, 0.035),
        new THREE.MeshStandardMaterial({ color: 0x8b6fd2, roughness: 0.7 }),
      );
      robeFront.position.set(0, 0.96, 0.5);
      const sash = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.08, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.2, roughness: 0.48 }),
      );
      sash.position.set(0, 0.66, 0.32);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), skin);
      head.position.y = 1.78;
      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.42, 10),
        new THREE.MeshStandardMaterial({ color: 0xd9dce8, roughness: 0.92 }),
      );
      beard.position.set(0, 1.48, 0.25);
      beard.rotation.x = -0.25;
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.78, 16),
        new THREE.MeshStandardMaterial({ color: 0x3b2671, roughness: 0.76 }),
      );
      hat.position.y = 2.18;
      hat.rotation.z = -0.1;
      const hatBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.36, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.44 }),
      );
      hatBand.position.y = 1.92;
      group.add(robe, robeFront, sash, head, beard, hat, hatBand);

      for (const x of [-0.1, 0.1]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x91f2ff, emissive: 0x187aa0, emissiveIntensity: 0.75, roughness: 0.25 }),
        );
        eye.position.set(x, 1.8, 0.27);
        group.add(eye);
      }

      for (const side of [-1, 1]) {
        const sleeve = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.7, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x4f347f, roughness: 0.78 }),
        );
        sleeve.position.set(side * 0.5, 1.02, 0.02);
        sleeve.rotation.z = side * -0.28;
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
        hand.position.set(side * 0.62, 0.7, 0.1);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), dark);
        foot.position.set(side * 0.2, 0.08, 0.1);
        const robeHem = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.36, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x4f347f, roughness: 0.8 }),
        );
        robeHem.position.set(side * 0.18, 0.27, 0.02);
        walkParts.push({ object: robeHem, side, axis: "x" }, { object: foot, side, axis: "x" });
        group.add(sleeve, hand, robeHem, foot);
      }

      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.55, 8), wood);
      staff.position.set(0.72, 1.08, 0.08);
      staff.rotation.z = -0.16;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x8fd7ff, emissive: 0x2467ff, emissiveIntensity: 1.35, roughness: 0.22 }),
      );
      orb.position.set(0.84, 1.88, 0.08);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.015, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.75 }),
      );
      halo.position.copy(orb.position);
      halo.rotation.x = Math.PI / 2;
      group.add(staff, orb, halo);
    } else {
      const tunic = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 1.08, 0.44),
        new THREE.MeshStandardMaterial({ color: 0x4f6f4a, roughness: 0.82 }),
      );
      tunic.position.y = 0.92;
      const leatherVest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.78, 0.05), leather);
      leatherVest.position.set(0, 1.0, 0.25);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.48), leather);
      belt.position.y = 0.62;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), skin);
      head.position.y = 1.72;
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.76),
        new THREE.MeshStandardMaterial({ color: 0x2f5731, roughness: 0.82 }),
      );
      hood.position.y = 1.81;
      const hoodPeak = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.24, 4),
        new THREE.MeshStandardMaterial({ color: 0x264c2a, roughness: 0.82 }),
      );
      hoodPeak.position.set(0, 1.78, 0.35);
      hoodPeak.rotation.x = Math.PI / 2;
      group.add(tunic, leatherVest, belt, head, hood, hoodPeak);

      for (const x of [-0.09, 0.09]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
        eye.position.set(x, 1.73, 0.27);
        group.add(eye);
      }

      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.72, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x3e5f3c, roughness: 0.82 }),
        );
        arm.position.set(side * 0.52, 1.0, 0.04);
        arm.rotation.z = side * (side > 0 ? -0.52 : 0.28);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
        hand.position.set(side * 0.62, 0.7, 0.14);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), leather);
        leg.position.set(side * 0.18, 0.25, 0);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.26), dark);
        boot.position.set(side * 0.18, 0.04, 0.04);
        walkParts.push({ object: leg, side, axis: "x" }, { object: boot, side, axis: "x" });
        group.add(arm, hand, leg, boot);
      }

      const bowTop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.78, 8), wood);
      bowTop.position.set(0.72, 1.28, 0.18);
      bowTop.rotation.z = -0.42;
      bowTop.rotation.x = 0.1;
      const bowBottom = bowTop.clone();
      bowBottom.position.set(0.52, 0.72, 0.18);
      bowBottom.rotation.z = 0.42;
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 1.16, 6),
        new THREE.MeshBasicMaterial({ color: 0xe5e7eb }),
      );
      string.position.set(0.62, 1.0, 0.29);
      string.rotation.z = -0.08;
      const arrow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.82, 6),
        new THREE.MeshStandardMaterial({ color: 0xddd6c9, roughness: 0.7 }),
      );
      arrow.position.set(0.58, 1.02, 0.35);
      arrow.rotation.z = Math.PI / 2;
      const quiver = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.62, 10),
        new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.85 }),
      );
      quiver.position.set(-0.42, 1.08, -0.26);
      quiver.rotation.z = 0.36;
      for (const offset of [-0.08, 0, 0.08]) {
        const quiverArrow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 5), wood);
        quiverArrow.position.set(-0.44 + offset, 1.43, -0.22);
        quiverArrow.rotation.z = 0.28;
        group.add(quiverArrow);
      }
      group.add(bowTop, bowBottom, string, arrow, quiver);
    }
    group.position.copy(position);
    return this.addWorldObject(type, isMage ? "마을 마법사" : "마을 궁수", group, {
      hp: isMage ? 8 : 9,
      armor: isMage ? 2 : 3,
      collidable: true,
      collisionRadius: isMage ? 0.68 : 0.64,
      collisionHeight: isMage ? 2.35 : 2.1,
      villageId,
      guardMode: "ranged",
      attackRange: isMage ? 22 : 18,
      attackDamage: isMage ? 2 : 1,
      walkCycle: this.createWalkCycle(walkParts, isMage ? 0.28 : 0.36, isMage ? 6.5 : 7.5, 0.022),
    });
  }

  private createBedVisual(scale = 1) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a25, roughness: 0.82 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4b2e1c, roughness: 0.88 });
    const mattress = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 });
    const blanket = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 });
    const pillow = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.86 });
    const seam = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.82 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 2.65), wood);
    frame.position.y = 0.22;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 2.82), darkWood);
    base.position.y = 0.11;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 2.44), mattress);
    mat.position.y = 0.42;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.09, 1.35), blanket);
    cover.position.set(0, 0.6, 0.42);
    const pillowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.44), pillow);
    pillowMesh.position.set(0, 0.63, -0.86);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.86, 0.18), darkWood);
    headboard.position.set(0, 0.47, -1.5);
    const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 0.16), darkWood);
    footboard.position.set(0, 0.28, 1.5);
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 2.7), darkWood);
    leftRail.position.set(-0.91, 0.26, 0);
    const rightRail = leftRail.clone();
    rightRail.position.x = 0.91;
    const blanketFold = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.045, 0.08), seam);
    blanketFold.position.set(0, 0.66, -0.22);
    const pillowStripe = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.025, 0.045), mattress);
    pillowStripe.position.set(0, 0.735, -0.72);
    group.add(base, frame, mat, cover, blanketFold, pillowMesh, pillowStripe, headboard, footboard, leftRail, rightRail);

    for (const x of [-0.68, 0.68]) {
      for (const z of [-1.18, 1.18]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), darkWood);
        leg.position.set(x, -0.04, z);
        group.add(leg);
      }
    }

    group.scale.setScalar(scale);
    return group;
  }

  private spawnBed(position: THREE.Vector3, rotationY = 0) {
    const group = this.createBedVisual();
    group.position.copy(position);
    group.rotation.y = rotationY;
    return this.addWorldObject("bed", "침대", group, {
      collidable: true,
      collisionRadius: 1.45,
      collisionHeight: 0.9,
    });
  }

  private spawnWorkbench(position: THREE.Vector3, extended: boolean) {
    const group = this.createWorkbenchVisual(extended);
    group.position.copy(position);
    return this.addWorldObject(extended ? "extendedWorkbench" : "workbench", extended ? "확장 제작대" : "제작대", group, {
      collidable: true,
      collisionRadius: extended ? 1.35 : 1.15,
      collisionHeight: extended ? 1.38 : 1.05,
    });
  }

  private createWorkbenchVisual(extended: boolean, scale = 1) {
    const group = new THREE.Group();
    const baseMaterial = new THREE.MeshStandardMaterial({ color: extended ? 0x5f3f2c : 0x8a5a33, roughness: 0.78 });
    const topMaterial = new THREE.MeshStandardMaterial({ color: extended ? 0xc9964e : 0xd1a35a, roughness: 0.62 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: extended ? 0x4a2d1c : 0x5b351f, roughness: 0.8 });
    const lineMaterial = new THREE.MeshStandardMaterial({ color: extended ? 0xf6d58a : 0x3f2415, roughness: 0.58 });
    const size = extended ? 2.1 : 1.65;
    const height = extended ? 1.05 : 0.85;

    const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.92, height, size * 0.92), baseMaterial);
    body.position.y = height / 2;

    const top = new THREE.Mesh(new THREE.BoxGeometry(size, 0.14, size), topMaterial);
    top.position.y = height + 0.08;

    const trim = new THREE.Mesh(new THREE.BoxGeometry(size * 1.04, 0.12, size * 1.04), trimMaterial);
    trim.position.y = height + 0.02;

    const legHeight = height * 0.72;
    for (const x of [-size * 0.34, size * 0.34]) {
      for (const z of [-size * 0.34, size * 0.34]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, legHeight, 0.16), trimMaterial);
        leg.position.set(x, legHeight / 2 - 0.02, z);
        group.add(leg);
      }
    }

    const divisions = extended ? 6 : 3;
    for (let index = 1; index < divisions; index += 1) {
      const offset = -size / 2 + (size / divisions) * index;
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, size * 0.88), lineMaterial);
      vertical.position.set(offset, height + 0.16, 0);
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(size * 0.88, 0.018, 0.018), lineMaterial);
      horizontal.position.set(0, height + 0.165, offset);
      group.add(vertical, horizontal);
    }

    if (extended) {
      const sideBand = new THREE.Mesh(new THREE.BoxGeometry(size * 0.82, 0.1, 0.08), lineMaterial);
      sideBand.position.set(0, height * 0.62, size * 0.49);
      group.add(sideBand);
    }

    group.add(body, trim, top);
    group.scale.setScalar(scale);
    return group;
  }

  private spawnSmelter(position: THREE.Vector3, special: boolean) {
    const group = this.createSmelterVisual(special);
    group.position.copy(position);
    return this.addWorldObject(special ? "specialSmelter" : "smelter", special ? "특수 재련대" : "재련대", group, {
      collidable: true,
      collisionRadius: 1.18,
      collisionHeight: 2.05,
    });
  }

  private spawnGrinder(position: THREE.Vector3) {
    const group = this.createGrinderVisual();
    group.position.copy(position);
    return this.addWorldObject("grinder", "분쇄기", group, {
      collidable: true,
      collisionRadius: 1.15,
      collisionHeight: 1.4,
    });
  }

  private createGrinderVisual(scale = 1) {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x5f666d, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2f3439, roughness: 0.82 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.25, roughness: 0.45 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.92, 0.22, 14), dark);
    base.position.y = 0.11;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 0.62, 14), stone);
    bowl.position.y = 0.52;
    const topStone = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 14), stone);
    topStone.position.y = 0.92;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.08, 10), iron);
    axle.position.y = 0.94;
    axle.rotation.z = Math.PI / 2;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.72), iron);
    handle.position.set(0.66, 0.94, 0);
    const hopper = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.42, 4), dark);
    hopper.position.set(-0.28, 1.23, 0);
    hopper.rotation.y = Math.PI / 4;
    group.add(base, bowl, topStone, axle, handle, hopper);
    group.scale.setScalar(scale);
    return group;
  }

  private createSmelterVisual(special: boolean, scale = 1) {
    const group = new THREE.Group();
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: special ? 0x3b2948 : 0x5a6266, roughness: 0.88 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: special ? 0x17111f : 0x1f2528, roughness: 0.92 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: special ? 0x9c6bd3 : 0x8f989f, metalness: 0.28, roughness: 0.48 });
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: special ? 0xc084fc : 0xff9f43,
      emissive: special ? 0x7c2dff : 0xff5a1f,
      emissiveIntensity: special ? 1.65 : 1.45,
      roughness: 0.34,
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.86, 0.18, 10), darkMaterial);
    base.position.y = 0.09;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.76, 1.14, 10), stoneMaterial);
    body.position.y = 0.74;

    const topBand = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.045, 8, 28), metalMaterial);
    topBand.position.y = 1.34;
    topBand.rotation.x = Math.PI / 2;

    const bottomBand = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.035, 8, 28), metalMaterial);
    bottomBand.position.y = 0.25;
    bottomBand.rotation.x = Math.PI / 2;

    const mouthFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.09), metalMaterial);
    mouthFrame.position.set(0, 0.72, 0.66);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.12), darkMaterial);
    mouth.position.set(0, 0.72, 0.72);

    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.04), glowMaterial);
    fire.position.set(0, 0.68, 0.79);

    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.08), darkMaterial);
    grate.position.set(0, 0.48, 0.75);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.68, 10), darkMaterial);
    chimney.position.set(-0.26, 1.72, -0.18);

    const chimneyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.1, 10), metalMaterial);
    chimneyCap.position.set(-0.26, 2.1, -0.18);

    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), metalMaterial);
    vent.position.set(0.28, 1.42, 0.48);

    for (const x of [-0.42, 0.42]) {
      for (const z of [-0.42, 0.42]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), darkMaterial);
        foot.position.set(x, 0.02, z);
        group.add(foot);
      }
    }

    group.add(base, body, topBand, bottomBand, mouthFrame, mouth, fire, grate, chimney, chimneyCap, vent);
    group.scale.setScalar(scale);
    return group;
  }

  private addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra: Partial<WorldObject> = {}) {
    const id = `${type}-${crypto.randomUUID()}`;
    root.userData.objectId = id;
    const raycastMeshes: THREE.Object3D[] = [];
    root.traverse((child) => {
      child.userData.objectId = id;
      if (child instanceof THREE.Mesh) {
        this.raycastTargets.push(child);
        raycastMeshes.push(child);
      }
    });
    this.scene.add(root);
    const object: WorldObject = { id, type, name, root, ...extra };
    this.objects.set(id, object);
    this.raycastTargetsByObject.set(id, raycastMeshes);
    if (type === "water") this.waterObjects.push(object);
    return object;
  }

  private removeObject(id: string) {
    const object = this.objects.get(id);
    if (!object) return;
    this.scene.remove(object.root);
    this.objects.delete(id);
    this.raycastTargetsByObject.delete(id);
    if (object.type === "water") {
      const waterIndex = this.waterObjects.findIndex((water) => water.id === id);
      if (waterIndex >= 0) this.waterObjects.splice(waterIndex, 1);
    }
    for (let i = this.raycastTargets.length - 1; i >= 0; i -= 1) {
      if (this.findObjectId(this.raycastTargets[i]) === id) this.raycastTargets.splice(i, 1);
    }
  }

  private clearCaveObjects() {
    for (const id of this.caveObjectIds) {
      if (id.startsWith("loose-")) {
        const loose = this.scene.children.find((child) => `loose-${child.uuid}` === id);
        if (loose) this.scene.remove(loose);
      } else {
        this.removeObject(id);
      }
    }
    this.caveObjectIds = [];
  }

  private clearHouseObjects() {
    for (const id of this.houseObjectIds) {
      if (id.startsWith("loose-")) {
        const loose = this.scene.children.find((child) => `loose-${child.uuid}` === id);
        if (loose) this.scene.remove(loose);
      } else {
        this.removeObject(id);
      }
    }
    this.houseObjectIds = [];
  }

  private tintObject(root: THREE.Object3D, color: number) {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(color);
      }
    });
  }

  private randomGroundPoint() {
    let fallback = new THREE.Vector3();
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const point = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(WORLD_SIZE - 80),
        0,
        THREE.MathUtils.randFloatSpread(WORLD_SIZE - 80),
      );
      point.y = this.getGroundHeightAt(point.x, point.z);
      if (attempt === 0) fallback = point;
      if (!this.isNaturalSpawnBlocked(point, 5)) return point;
    }
    return fallback;
  }

  private pointNearPlayer(min: number, max: number) {
    let fallback = new THREE.Vector3();
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(min, max);
      const point = new THREE.Vector3(
        this.playerPosition.x + Math.cos(angle) * radius,
        0,
        this.playerPosition.z + Math.sin(angle) * radius,
      );
      point.y = this.getGroundHeightAt(point.x, point.z);
      if (attempt === 0) fallback = point;
      if (!this.isNaturalSpawnBlocked(point, 6)) return point;
    }
    return fallback;
  }

  private isNaturalSpawnBlocked(point: THREE.Vector3, margin = 0) {
    for (const waterZone of WATER_ZONES) {
      if (Math.hypot(point.x - waterZone.center.x, point.z - waterZone.center.z) < this.waterZoneRadius(waterZone) + margin) return true;
    }
    if (this.overlapsPriorityBiome(point, 0, margin)) return true;
    return false;
  }

  private isPriorityTerrainReserved(point: THREE.Vector3, radius: number, _terrainKind: TerrainKind) {
    for (const waterZone of WATER_ZONES) {
      if (Math.hypot(point.x - waterZone.center.x, point.z - waterZone.center.z) < this.waterZoneRadius(waterZone) + radius + 2) return true;
    }
    return Boolean(this.overlapsPriorityBiome(point, radius, 2));
  }

  private waterZoneRadius(waterZone: (typeof WATER_ZONES)[number]) {
    return waterZone.radius * WATER_RADIUS_MULTIPLIER;
  }

  private restoredWaterRadius(position: THREE.Vector3, radius: number, name: string) {
    const zone = WATER_ZONES.find((waterZone) => waterZone.name === name && Math.hypot(position.x - waterZone.center.x, position.z - waterZone.center.z) < 3);
    if (!zone) return radius;
    return radius <= zone.radius * 1.2 ? this.waterZoneRadius(zone) : radius;
  }

  private overlapsPriorityBiome(point: THREE.Vector3, radius: number, margin = 0) {
    return BIOMES.find((biome) => Math.hypot(point.x - biome.center.x, point.z - biome.center.z) < biome.radius + radius + margin) ?? null;
  }

  private priorityBiomeAt(point: THREE.Vector3, margin = 0) {
    return BIOMES.find((biome) => Math.hypot(point.x - biome.center.x, point.z - biome.center.z) < biome.radius + margin) ?? null;
  }

  private isSavedPriorityTerrainPatch(savedObject: SavedObject, position: THREE.Vector3) {
    const radius = savedObject.terrainRadius ?? 0;
    if (radius < 8) return false;
    const terrainKind = savedObject.terrainKind ?? "grass";
    const biome = this.priorityBiomeAt(position, 2);
    if (!biome) return false;
    if (biome.kind === "bamboo") return terrainKind === "grass";
    if (biome.kind === "mountain") return terrainKind === "stone" || terrainKind === "ore";
    if (biome.kind === "mushroom") return terrainKind === "dirt";
    if (biome.kind === "swamp") return terrainKind === "swamp";
    if (biome.kind === "snow") return terrainKind === "snow" || terrainKind === "stone";
    if (biome.kind === "lava") return terrainKind === "lava" || terrainKind === "stone";
    return false;
  }

  private pointInFront(distance: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const point = new THREE.Vector3(
      this.playerPosition.x + forward.x * distance,
      0,
      this.playerPosition.z + forward.z * distance,
    );
    point.y = this.getGroundHeightAt(point.x, point.z);
    return point;
  }

  private randomCavePoint() {
    return new THREE.Vector3(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 4), 0, THREE.MathUtils.randFloat(CAVE_END_Z + 14, CAVE_START_Z - 12));
  }
}

const gameRoot = document.querySelector<HTMLDivElement>("#game");
if (!gameRoot) throw new Error("Game root element was not found.");

new WildernessGame(gameRoot);
