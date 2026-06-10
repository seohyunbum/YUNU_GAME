import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CLASS_APPEARANCE, DEFAULT_AVATAR_APPEARANCE, createAvatarModel, createEagleAvatarModel, createMirrorModel } from "./avatar";
import { getRewardTuning, type RewardSource } from "./operatorConfig";
import { claimTutorialObjective, currentObjective, DEFAULT_TUTORIAL_PROGRESS, type TutorialObjective } from "./objectives";
import {
  ASSET_PALETTE,
  VISUAL_THEME,
  applyStylizedMeshDefaults,
  gameMaterial,
  makeGlowMaterial,
  makeMetalMaterial,
  makeToonMaterial,
} from "./visuals";
import { createCloudLayer, createStylizedGround } from "./game/environmentVisuals";
import {
  createBedVisual as createPlaceableBedVisual,
  createBuildingBlockVisual as createPlaceableBuildingBlockVisual,
  createGrinderVisual as createPlaceableGrinderVisual,
  createSmelterVisual as createPlaceableSmelterVisual,
  createWorkbenchVisual as createPlaceableWorkbenchVisual,
} from "./game/placeableVisuals";
import {
  spawnBed as spawnBedObject,
  spawnBuildingBlock as spawnBuildingBlockObject,
  spawnGrinder as spawnGrinderObject,
  spawnSmelter as spawnSmelterObject,
  spawnWorkbench as spawnWorkbenchObject,
} from "./game/placeableSpawns";
import {
  applyShadowQuality,
  precompileSceneShaders,
  registerDistanceCulledVisual,
  refreshTrackedVisualVisibility,
  shouldHideInvisibleMeshFromRender,
  shouldShowPerformanceHiddenVisual,
  updateDistanceCulledVisuals,
} from "./game/renderPerformance";
import {
  createChestVisual,
  createTrainVisual,
  createVillageHouseVisual,
} from "./game/structureVisuals";
import {
  createHeldItemModel as createHeldItemVisualModel,
  heldItemMaterialColor as resolveHeldItemMaterialColor,
} from "./game/heldItemVisuals";
import { createBucketVisual as createBucketVisualModel } from "./game/bucketVisuals";
import {
  createBuildingSign as createBuildingSignModel,
  type BuildingSignKind,
} from "./game/buildingSigns";
import { createEagleVisual } from "./game/creatureVisuals";
import { createRangedGuardVisual } from "./game/guardVisuals";
import { createBiomeDecor, type BiomeDecorContext } from "./game/biomeDecor";
import {
  spawnAnimal as spawnAnimalEntity,
  spawnDragon as spawnDragonEntity,
  spawnJammini as spawnJamminiEntity,
  spawnPredator as spawnPredatorEntity,
  type EntitySpawnContext,
} from "./game/entitySpawns";
import {
  applyMeleeDragonAttack,
  applyMeleePredatorAttack,
  applyProjectileDamage as applyProjectileDamageWithContext,
  calculateCombatDamage as calculateDamage,
  calculateIncomingPlayerDamage,
  rollDragonLoot as rollDragonLootItem,
  type ProjectileDamageContext,
} from "./game/combat";
import { applyBossDefeat, bossLockMessage, FINAL_BOSS_CHAPTER, isBossUnlocked, nextBossTarget, normalizeBossChapter } from "./game/bossChapters";
import { createGraveTrapState, updateGraveTrap, type GraveTrapContext } from "./game/graveTrap";
import { createFinaleState, startFinale, updateFinale, type FinaleContext } from "./game/finale";
import { showEndingScreen } from "./ui/endingScreen";
import {
  createArrowProjectile,
  createMagicProjectile,
  createTntProjectile,
  spawnDamageParticles,
  spawnDragonClawBurst,
  spawnDragonFireBurst,
  spawnEnemyHitParticles,
  spawnExplosionVisual,
  spawnMagicTrail,
  spawnMeleeSlashTrail,
  spawnProjectileImpact,
  spawnTntTrail,
  spawnWindCutterTrail,
  type CombatEffectContext,
} from "./game/combatEffects";
import { celebrateLevelUp, celebrateRareDrop } from "./game/juice";
import { createBannerElement } from "./ui/banner";
import {
  ARCADE_POINTS_KEY,
  BASE_BAG_SLOT_COUNT,
  BASE_MAX_MANA,
  BASE_PLAYER_MAX_HEALTH,
  BOW_DAMAGE,
  BUILDING_BLOCK_REACH,
  BUILDING_BLOCK_SIZE,
  CAVE_CENTER_Z,
  CAVE_END_Z,
  CAVE_LENGTH,
  CAVE_START_Z,
  CAVE_STEP_INTERVAL,
  CAVE_WIDTH,
  CHEST_STEP_INTERVAL,
  CLOUD_COUNT,
  CROUCH_HEIGHT,
  DAY_LENGTH_SECONDS,
  DRAGON_BOSS_BAR_DISTANCE,
  EAGLE_ARMOR,
  GUNNER_SKILL_COST,
  GUNNER_SKILL_COOLDOWN,
  GUNNER_SKILL_DAMAGE,
  EAGLE_MAX_HP,
  EAGLE_POSSESSION_DURATION_SECONDS,
  EAGLE_RAM_DAMAGE,
  EXPANDED_BAG_SLOT_COUNT,
  EXTENDED_WORKBENCH_SLOT_COUNT,
  FIELD_ANIMAL_COUNT,
  GRAVITY,
  HEALER_HEAL_AMOUNT,
  HEALER_SKILL_COOLDOWN,
  HEALER_SKILL_COST,
  HOUSE_CENTER_Z,
  HUNGER_HP_REGEN,
  HUNGER_MAX,
  HUNGER_TICK_SECONDS,
  INTERACT_DISTANCE,
  JAMMINI_FIELD_COUNT,
  JAMMINI_MAX_HP,
  JUMP_SPEED,
  LAVA_DRAGON_CHECK_SECONDS,
  LAVA_DRAGON_SPAWN_CHANCE,
  LAVA_LANE_COUNT,
  LAVA_PLAYER_HIT_BOTTOM,
  LAVA_PLAYER_HIT_TOP,
  LAVA_SCORE_PER_CLEAR,
  LEGO_ARM_DELAY_MS,
  LEGO_HAZARD_DURATION_MS,
  LEGO_HAZARD_TRIGGER_RADIUS,
  LOOK_TARGET_REFRESH_SECONDS,
  MAGE_TNT_COOLDOWN,
  MAGE_TNT_COST,
  MAGE_TNT_DAMAGE,
  MAGE_TNT_RADIUS,
  MAX_MOUSE_EVENT_DELTA,
  MANA_REGEN_PER_SECOND,
  MINI_GAME_BALL_RADIUS,
  MINI_GAME_PADDLE_HEIGHT,
  MINI_GAME_PADDLE_WIDTH,
  MOVEMENT_COLLISION_STEP,
  MOVEMENT_HUD_MIN_INTERVAL,
  MOUSE_SENSITIVITY_X,
  MOUSE_SENSITIVITY_Y,
  NIGHT_PREDATOR_MAX_COUNT,
  NIGHT_PREDATOR_MIN_PLAYER_DISTANCE,
  NIGHT_PREDATOR_SPAWN_SECONDS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PRONE_HEIGHT,
  PROJECTILE_MAX_LIFE,
  RANGED_ATTACK_COOLDOWN,
  RUN_MULTIPLIER,
  SAVE_KEY,
  SMITHING_HITS_REQUIRED,
  SMITHING_ROUND_SECONDS,
  SMITHING_SUCCESS_POINTS,
  SPATIAL_CELL_SIZE,
  SPRINT_LOOK_TARGET_REFRESH_SECONDS,
  SPRINT_VISIBILITY_CHANGES_PER_PASS,
  SPRINT_VISIBILITY_CULL_INTERVAL,
  SUMMONER_SKILL_COOLDOWN,
  SUMMONER_SKILL_COST,
  TRAIN_RADIUS,
  VILLAGER_ROAM_SOFT_LIMIT,
  VILLAGER_TARGET_REACHED_DISTANCE,
  VILLAGER_WALK_SPEED,
  VISIBILITY_CHANGES_PER_PASS,
  VISIBILITY_CULL_INTERVAL,
  WALK_SPEED,
  WARRIOR_EXPLOSION_DAMAGE,
  WARRIOR_EXPLOSION_RADIUS,
  WARRIOR_EXPLOSION_SECONDS,
  WARRIOR_SKILL_COOLDOWN,
  WARRIOR_SKILL_COST,
  WORKBENCH_SLOT_COUNT,
  WORLD_SIZE,
} from "./game/constants";
import type {
  AnimalKind,
  AreaSkillEffect,
  BossKind,
  CollisionSegment,
  CombatProjectile,
  HandActionMode,
  HouseKind,
  ItemId,
  LavaHazard,
  LavaMiniGameState,
  LocationMode,
  MiniGameState,
  ObjectType,
  PanelType,
  PartialSavedGame,
  PlayerClassId,
  PredatorKind,
  QualityMode,
  Recipe,
  SaveSlot,
  SavedGame,
  SavedObject,
  SavedVector,
  Slot,
  SmithingMaterial,
  SmithingMiniGameState,
  SmithingProduct,
  TerrainKind,
  WalkCycle,
  WalkPartSetup,
  WorldMapId,
  WorldObject,
} from "./game/types";
import { applyPredatorMonsterDefinition, BOSS_STATS, predatorExperienceReward, predatorKindForMonster, predatorStatsForMonster, PREDATOR_STATS, type MonsterId } from "./game/monsters";
import { REGIONS, chooseRegionPredatorMonster, maybeWarnRegionLevel, randomPointInRegion, regionAtPosition, regionLootChanceScale, type RegionWarningState } from "./game/regions";
import { DEFAULT_WORLD_MAP_ID, WORLD_MAPS, canTeleportToWorldMap, getWorldMapById, regionsForWorldMap, worldMapLockReason } from "./game/worldMaps";
import { clearWorldStateStore, installWorldStates, rememberWorldState, type WorldStateStore } from "./game/worldStateStore";
import { updatePredatorAi, type PredatorAiContext } from "./game/predatorAi";
import { PLAYER_CLASSES } from "./game/classes";
import { CLASS_PASSIVES, experienceForNextPetLevel, summonerPetDamage } from "./game/classPassives";
import { SummonerCompanionController, type SummonerPetContext } from "./game/summonerPet";
import { BIOME_TERRAIN_PLANS, WATER_RADIUS_MULTIPLIER, biomesForWorldMap, waterZonesForWorldMap, type WaterZone } from "./game/worldData";
import {
  ARMOR_VALUE,
  AXE_POWER,
  DEFAULT_TOOL_DURABILITY,
  DURABLE_TOOL_TABLES,
  GRINDABLE_MATERIALS,
  HARVEST_HARDNESS,
  ITEM_NAMES,
  MELEE_WEAPON_DAMAGE,
  PICKAXE_POWER,
  PLACEABLE_TYPES,
  POWDER_BY_MINERAL,
  RAW_MATERIALS,
  REFINED_BY_RAW,
  SHOVEL_POWER,
  SPECIAL_SMELTER_MATERIALS,
  TOOL_DURABILITY,
  WEAPON_DAMAGE,
  RANGED_WEAPONS,
  RANGED_PROJECTILE,
} from "./game/items";
import { MINI_RECIPES, WORKBENCH_RECIPES } from "./game/recipes";
import {
  BLACKSMITH_TRADE_OFFERS,
  POINT_EXCHANGE_OFFERS,
  POINT_SHOP_OFFERS,
  SELL_SHOP_OFFERS,
  TRADE_OFFERS,
} from "./game/trading";
import { SMITHING_PRODUCTS } from "./game/smithing";
import { HOUSE_BUILD_OPTIONS } from "./game/housing";
import { TUTORIAL_SECTIONS } from "./game/tutorial";
import { spawnObject, type SpawnContext } from "./game/spawnContext";
import { useHotbarItem, type HotbarUseContext } from "./game/hotbarUse";
import { canReceiveRecipeOutput } from "./game/inventoryCapacity";
import { buildRecipeGuideEntriesForStations } from "./game/recipeGuide";
import { bestShieldItem, consumeShieldHit, equipmentArmorValue as equipmentArmorValueWithShield, ironGuardMessage, ironGuardUntil as activateIronGuardUntil, isShieldItem, shouldAutoEquipShield, tankerHudStatus, TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST } from "./game/tanker";
import { experienceForLevelUps, migrateSaveData as migratePartialSaveData } from "./game/saveMigration";
import { createSaveData as createSaveDataFromSnapshot } from "./game/saveManager";
import {
  copySavedSlot,
  fromSavedVector as restoreVectorFromSave,
  restoreSlots,
} from "./game/saveRestore";
import {
  backupLatestSave as backupLatestSaveInRepository,
  createSaveSlot as createRepositorySaveSlot,
  readSaveSlots as readRepositorySaveSlots,
  writeJsonStorage as writeRepositoryJsonStorage,
  writeSaveSlots as writeRepositorySaveSlots,
} from "./game/saveRepository";
import { createHudRenderCache, renderHudView } from "./ui/hudRenderer";
import { renderInventoryPanel as renderInventoryPanelView } from "./ui/inventoryPanel";
import { renderLoadGamePanel as renderLoadGamePanelView } from "./ui/loadGamePanel";
import { renderRegionMapPanel } from "./ui/mapPanel";
import { setupGameUi } from "./ui/setupUi";
import { renderWorkbenchPanel as renderWorkbenchPanelView } from "./ui/workbenchPanel";
import { currentAudioProfile as resolveAudioProfile, type AudioProfile } from "./game/audioProfile";
import { shouldFireRangedDuringInteract } from "./game/interactionPriority";
import { eagleSkillStatus as formatEagleSkillStatus, possessedEagleDamage, tryEagleClaw, tryEagleWindCutter, type EagleActionContext } from "./game/eaglePossession";
import { applyOverworldTimeOfDay } from "./game/timeOfDay";
import "./style.css";

class WildernessGame {
  private readonly container: HTMLDivElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1200);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly objects = new Map<string, WorldObject>();
  private readonly spawnContext: SpawnContext = {
    addWorldObject: (type, name, root, extra) => this.addWorldObject(type, name, root, extra),
  };
  private readonly entitySpawnContext: EntitySpawnContext = {
    addWorldObject: (type, name, root, extra) => this.addWorldObject(type, name, root, extra),
    getGroundHeightAt: (x, z) => this.getGroundHeightAt(x, z),
    createWalkCycle: (parts, amplitude, speed, lift) => this.createWalkCycle(parts, amplitude, speed, lift),
    predatorStats: (kind) => this.predatorStats(kind),
    predatorAggroRange: (kind) => this.predatorAggroRange(kind),
    bossStats: (kind) => this.bossStats(kind),
  };
  private readonly raycastTargets: THREE.Object3D[] = [];
  private readonly raycastTargetsByObject = new Map<string, THREE.Object3D[]>();
  private readonly objectIdsByType = new Map<ObjectType, Set<string>>();
  private readonly respawnQueue: { dueAt: number; type: ObjectType; position: THREE.Vector3; villageId?: string; predatorKind?: PredatorKind; monsterId?: MonsterId; regionId?: string }[] = []; private suppressRespawn = false;
  private readonly spatialBuckets = new Map<string, Set<string>>();
  private readonly spatialKeysByObject = new Map<string, Set<string>>();
  private readonly waterObjects: WorldObject[] = [];
  private readonly waterRippleMeshes: THREE.Object3D[] = [];
  private readonly waterSurfaceMeshes: THREE.Mesh[] = [];
  private readonly mountains: { position: THREE.Vector3; radius: number; height: number }[] = [];
  private readonly mountainMeshes: THREE.Object3D[] = [];
  private readonly biomeMeshes: THREE.Object3D[] = [];
  private readonly biomeDecorContext: BiomeDecorContext = {
    biomes: biomesForWorldMap(DEFAULT_WORLD_MAP_ID),
    clearBiomeMeshes: () => this.clearBiomeMeshes(),
    addBiomeMesh: (object) => this.addBiomeMesh(object),
    randomPointInCircle: (center, radius) => this.randomPointInCircle(center, radius),
    isPointInWater: (point, margin) => this.isNearWater(point, margin),
  };
  private readonly treeVertexMaterial = gameMaterial(0xffffff, { vertexColors: true, roughness: 0.84, metalness: 0 });
  private readonly invisibleTargetMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  private readonly cartoonOutlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x0d1422,
    side: THREE.BackSide,
    depthWrite: false,
  });
  private readonly contactShadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x132015,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  private readonly sharedMaterials = new WeakSet<THREE.Material>([
    this.treeVertexMaterial,
    this.invisibleTargetMaterial,
    this.cartoonOutlineMaterial,
    this.contactShadowMaterial,
  ]);
  private readonly cloudLayer = new THREE.Group();
  private readonly sky = new Sky();
  private readonly sunPosition = new THREE.Vector3();
  private waterNormalTexture: THREE.Texture | null = null;
  private readonly ambientLight = new THREE.HemisphereLight(0xeaf7ff, 0x49623d, 2.2);
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
  private readonly fillLight = new THREE.DirectionalLight(0xffedd5, 0.72);
  private readonly moonLight = new THREE.DirectionalLight(0x8dbbff, 0.18);
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
  private readonly bagSlots: Slot[] = Array.from({ length: BASE_BAG_SLOT_COUNT }, () => ({ item: null, count: 0 }));
  private readonly craftSlots: Slot[] = Array.from({ length: 4 }, () => ({ item: null, count: 0 }));
  private readonly workbenchSlots: Slot[] = Array.from({ length: EXTENDED_WORKBENCH_SLOT_COUNT }, () => ({ item: null, count: 0 }));
  private readonly uiRoot = document.createElement("div");
  private readonly statsEl = document.createElement("div");
  private readonly objectiveEl = document.createElement("div");
  private readonly promptEl = document.createElement("div");
  private readonly hotbarEl = document.createElement("div");
  private readonly messageEl = document.createElement("div");
  private readonly panelEl = document.createElement("div");
  private readonly bossBarEl = document.createElement("div");
  private readonly saveControlsEl = document.createElement("div");
  private readonly titleScreenEl = document.createElement("div");
  private readonly mirrorView = new THREE.Group();
  private readonly handGroup = new THREE.Group();
  private readonly handClothMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly heldItemGroup = new THREE.Group();
  private heldItemKey: ItemId | null = null;
  private selectedHotbarIndex = 0;
  private selectedCraftItem: ItemId | null = null;
  private pendingStorageMove: { source: "hotbar" | "bag"; index: number } | null = null;
  private currentPanel: PanelType = null;
  private currentStationId: string | null = null;
  private currentWorldMapId: WorldMapId = DEFAULT_WORLD_MAP_ID;
  private bossChapter = 0;
  private activeRegions = regionsForWorldMap(DEFAULT_WORLD_MAP_ID);
  private activeBiomes = biomesForWorldMap(DEFAULT_WORLD_MAP_ID);
  private activeWaterZones = waterZonesForWorldMap(DEFAULT_WORLD_MAP_ID);
  private readonly worldStates: WorldStateStore = {};
  private readonly tutorialProgress = { completedStepIds: [...DEFAULT_TUTORIAL_PROGRESS.completedStepIds] };
  private regionWarningState: RegionWarningState = { regionId: null, lastWarnAt: 0 };
  private yaw = 0;
  private pitch = 0;
  private pendingMouseX = 0;
  private pendingMouseY = 0;
  private playerPosition = new THREE.Vector3(0, PLAYER_HEIGHT, 12);
  private previousPosition = this.playerPosition.clone();
  private verticalVelocity = 0;
  private isGrounded = true;
  private fallPeakFeetY = 0;
  private fallDamageArmed = false;
  private jumpWasDown = false;
  private totalSteps = 0;
  private chestStepBank = 0;
  private caveStepBank = 0;
  private antStepBank = 0;
  private worldTimeSeconds = DAY_LENGTH_SECONDS * (8 / 24);
  private timeHudTimer = 0;
  private health = BASE_PLAYER_MAX_HEALTH;
  private maxHealth = BASE_PLAYER_MAX_HEALTH;
  private level = 1;
  private experience = 0;
  private playerClass: PlayerClassId = "warrior";
  private pendingPlayerClass: PlayerClassId | null = null;
  private mana = BASE_MAX_MANA;
  private maxMana = BASE_MAX_MANA;
  private classSkillCooldownUntil = 0;
  private healItemCooldownUntil = 0;
  private possessedEagleId: string | null = null; private eaglePossessionEndsAt = 0;
  private eagleClawCooldownUntil = 0; private windCutterCooldownUntil = 0;
  private readonly summonerCompanion = new SummonerCompanionController();
  private playerBodyPosition: THREE.Vector3 | null = null;
  private hunger = HUNGER_MAX;
  private hungerTimer = 0;
  private starvationTimer = 0;
  private starvationNoticeTimer = 0;
  private dragonSpawnTimer = 0;
  private lastDamageTaken = 0;
  private lastDamageBlocked = false;
  private readonly projectileDamageContext: ProjectileDamageContext = {
    playerPosition: this.playerPosition,
    playImpactSound: (kind) => this.playImpactSound(kind),
    showMessage: (text) => this.showMessage(text),
    grantAnimalLoot: (target, actionLabel) => this.grantAnimalLoot(target, actionLabel),
    removeObject: (id) => this.removeObject(id),
    grantExperienceForTarget: (target) => this.grantExperienceForTarget(target),
    renderHud: () => this.renderHud(),
    rollRewardChance: (baseChance, source, item) => this.rollRewardChance(baseChance, source, item),
    grantRewardItem: (item, baseCount, source) => this.grantRewardItem(item, baseCount, source),
    bossStats: (kind) => this.bossStats(kind),
    bossLockMessage: (kind) => bossLockMessage(kind ?? "dragon", this.bossChapter),
    recordBossDefeat: (kind) => {
      const result = applyBossDefeat(this.bossChapter, kind ?? "dragon");
      this.bossChapter = result.bossChapter;
      if (result.message) this.showMessage(result.message);
      if (result.message && result.bossChapter === FINAL_BOSS_CHAPTER) startFinale(this.finaleContext);
    },
    dragonCounterAttack: (target) => this.dragonCounterAttack(target),
    playTone: (frequency, duration, type, volume) => this.playTone(frequency, duration, type, volume),
    updateBossBar: () => this.updateBossBar(),
    rollDragonLoot: () => rollDragonLootItem(),
    enrageVillage: (villageId, message) => this.enrageVillage(villageId, message),
    isVillageGuard: (target) => this.isVillageGuard(target),
    damagePlayer: (amount, showParticles, deathReason, ignoreArmor) => this.damagePlayer(amount, showParticles, deathReason, ignoreArmor),
    getLastDamage: () => ({ blocked: this.lastDamageBlocked, taken: this.lastDamageTaken }),
    now: () => performance.now(),
  };
  private readonly graveTrapContext: GraveTrapContext = {
    state: createGraveTrapState(),
    playerPosition: this.playerPosition,
    locationMode: () => this.locationMode,
    worldMapId: () => this.currentWorldMapId,
    now: () => performance.now(),
    graveHands: () => this.objectsOfType("graveHand"),
    getObject: (id) => this.objects.get(id),
    removeObject: (id) => this.removeObject(id),
    addWorldObject: (type, name, root, extra) => this.addWorldObject(type, name, root, extra),
    addCaveDressing: (object) => {
      applyStylizedMeshDefaults(object);
      this.scene.add(object);
      this.caveObjectIds.push(`loose-${object.uuid}`);
    },
    spawnZombie: (position) => spawnPredatorEntity(this.entitySpawnContext, position, "zombie"),
    enterUnderground: (point) => {
      this.caveReturnPosition = this.playerPosition.clone();
      this.clearCaveObjects();
      this.locationMode = "cave";
      this.setCaveAtmosphere();
      this.playerPosition.set(point.x, PLAYER_HEIGHT, point.z);
      this.settlePlayerAfterTeleport();
      this.playTransitionSound("enter");
    },
    getGroundHeightAt: (x, z) => this.getGroundHeightAt(x, z),
    runWalkCycle: (object, delta, movementSpeed) => this.animateWalkCycle(object, delta, movementSpeed),
    refreshSpatialObject: (object) => this.refreshSpatialObject(object),
    damagePlayer: (amount, showParticles, deathReason) => this.damagePlayer(amount, showParticles, deathReason),
    showMessage: (text) => this.showMessage(text),
    renderHud: () => this.renderHud(),
  };
  private readonly finaleContext: FinaleContext = {
    state: createFinaleState(), effects: () => this.combatEffectContext, playerPosition: this.playerPosition,
    cameraForward: () => ({ x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }), now: () => performance.now(),
    playTone: (frequency, duration, type, volume) => this.playTone(frequency, duration, type, volume),
    showCredits: () => showEndingScreen(this.uiRoot, () => this.renderHud()), showMessage: (text) => this.showMessage(text),
  };
  private equippedArmor: ItemId | null = null;
  private equippedShield: ItemId | null = null; private shieldDurabilityUsed = 0; private ironGuardUntil = 0;
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
  private shadowRefreshTimer = 0;
  private shadowRefreshInterval = 0.4;
  private visibilityCullTimer = 0;
  private visibilityCullCursor = 0;
  private movementHudTimer = 0;
  private lastHudStepCount = 0;
  private readonly sprintHiddenVisuals: THREE.Object3D[] = [];
  private readonly outlineVisuals: THREE.Object3D[] = [];
  private sprintRenderOptimized = false;
  private performanceSampleTimer = 0;
  private performanceSampleFrames = 0;
  private performanceSampleSum = 0;
  private performanceSlowFrames = 0;
  private performanceHitchFrames = 0;
  private performanceWarmupTimer = 0;
  private lastRawFrameDelta = 0;
  private readonly hudRenderCache = createHudRenderCache();
  private qualityMode: QualityMode = "high";
  private ctrlWBlocked = false;
  private arcadePoints = this.loadArcadePoints();
  private readonly miniGameKeys = new Set<string>();
  private readonly miniGame: MiniGameState = {
    active: false,
    playing: false,
    gameOver: false,
    score: 0,
    ballX: 0.5,
    ballY: 0.5,
    ballVX: 0.42,
    ballVY: 0.2,
    paddleY: 0.375,
  };
  private readonly lavaGame: LavaMiniGameState = {
    active: false,
    playing: false,
    gameOver: false,
    score: 0,
    playerLane: 2,
    hazards: [],
    spawnTimer: 0,
    spawnInterval: 0.92,
    fallSpeed: 0.42,
    stage: 1,
    wavesUntilSpecial: 6,
    nextHazardId: 1,
    nextWaveId: 1,
  };
  private readonly smithingGame: SmithingMiniGameState = {
    active: false,
    playing: false,
    gameOver: false,
    score: 0,
    successCount: 0,
    timeLeft: SMITHING_ROUND_SECONDS,
    order: SMITHING_PRODUCTS[0],
    currentProduct: null,
    hits: 0,
    message: "시작을 누르면 주민의 제작 의뢰가 들어옵니다.",
  };
  private smithingLastRenderedSecond = SMITHING_ROUND_SECONDS;
  private readonly damageParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }[] = [];
  private readonly projectiles: CombatProjectile[] = [];
  private readonly combatEffectContext: CombatEffectContext = {
    scene: this.scene,
    camera: this.camera,
    playerPosition: this.playerPosition,
    damageParticles: this.damageParticles,
    getGroundHeightAt: (x, z) => this.getGroundHeightAt(x, z),
  };
  private readonly eagleActionContext: EagleActionContext = {
    possessedEagleId: () => this.possessedEagleId, selectedItem: () => this.hotbar[this.selectedHotbarIndex]?.item, levelBonus: () => this.levelStatBonus(),
    clawCooldownUntil: () => this.eagleClawCooldownUntil, windCutterCooldownUntil: () => this.windCutterCooldownUntil,
    setClawCooldownUntil: (value) => { this.eagleClawCooldownUntil = value; }, setWindCutterCooldownUntil: (value) => { this.windCutterCooldownUntil = value; },
    target: () => this.eagleCombatTarget(), scene: this.scene, camera: this.camera, projectiles: this.projectiles, combatEffectContext: this.combatEffectContext,
    applyDamage: (target, damage, kind) => this.applyProjectileDamage(target, damage, kind), playHandAction: (mode) => this.playHandAction(mode), playMeleeWhoosh: () => this.playMeleeWhoosh(),
    playTone: (frequency, duration, type, volume) => this.playTone(frequency, duration, type, volume), showMessage: (text) => this.showMessage(text), renderHud: () => this.renderHud(),
  };
  private readonly bannerEl = createBannerElement();
  private readonly juiceDeps = {
    context: this.combatEffectContext,
    banner: this.bannerEl,
    playTone: (frequency: number, duration?: number, type?: OscillatorType, volume?: number) => this.playTone(frequency, duration, type, volume),
  };
  private readonly summonerPetContext: SummonerPetContext = {
    playerPosition: this.playerPosition,
    playerClass: () => this.playerClass,
    possessedEagleId: () => this.possessedEagleId,
    yaw: () => this.yaw,
    elapsedTime: () => this.clock.elapsedTime,
    now: () => performance.now(),
    getObject: (id) => this.objects.get(id),
    addWorldObject: (type, name, root, extra) => this.addWorldObject(type, name, root, extra),
    removeObject: (id) => this.removeObject(id),
    refreshSpatialObject: (object) => this.refreshSpatialObject(object),
    getGroundHeightAt: (x, z) => this.getGroundHeightAt(x, z),
    objectsNear: (point, radius) => this.objectsNear(point, radius),
    spawnHitEffect: (target) => spawnEnemyHitParticles(this.combatEffectContext, target),
    playTone: (frequency, duration, type, volume) => this.playTone(frequency, duration, type, volume),
    showMessage: (text) => this.showMessage(text),
    getPetProgress: () => this.summonerCompanion.petProgress(),
    itemName: (item) => ITEM_NAMES[item] ?? item,
    rollRewardChance: (baseChance, source, item) => this.rollRewardChance(baseChance, source, item),
    grantRewardItem: (item, baseCount, source) => this.grantRewardItem(item, baseCount, source),
    experienceRewardFor: (target) => this.experienceRewardFor(target),
    gainPlayerExperience: (amount) => this.gainExperience(amount),
    celebratePetLevel: (level) => celebrateLevelUp(this.juiceDeps, level),
    renderHud: () => this.renderHud(),
  };
  private readonly predatorAiContext: PredatorAiContext = { locationMode: () => this.locationMode, playerPosition: this.playerPosition, activeRegions: () => this.activeRegions, predators: () => this.objectsOfType("wildPredator"), predatorAggroRange: (kind) => this.predatorAggroRange(kind), predatorStrikeRange: (kind) => this.predatorStrikeRange(kind), predatorStats: (kind, monsterId) => this.predatorStats(kind, monsterId), getGroundHeightAt: (x, z) => this.getGroundHeightAt(x, z), refreshSpatialObject: (object) => this.refreshSpatialObject(object), animateWalkCycle: (object, delta, speed) => this.animateWalkCycle(object, delta, speed), damagePlayer: (amount, showParticles, reason) => this.damagePlayer(amount, showParticles, reason) };
  private readonly hotbarUseContext: HotbarUseContext = {
    currentPanel: () => this.currentPanel,
    health: () => this.health,
    maxHealth: () => this.maxHealth,
    hunger: () => this.hunger,
    healItemCooldownUntil: () => this.healItemCooldownUntil,
    now: () => performance.now(),
    setHealth: (value) => { this.health = value; },
    setHunger: (value) => { this.hunger = value; },
    setHealItemCooldownUntil: (value) => { this.healItemCooldownUntil = value; },
    resetStarvationTimer: () => { this.starvationTimer = 0; },
    openPanel: (panel) => this.openPanel(panel),
    fireRangedWeapon: (item) => this.fireRangedWeapon(item),
    useSelectedBucketOnLook: () => this.useSelectedBucketOnLook(null, true),
    useDragonSpawnItem: () => this.useDragonSpawnItem(),
    showMirrorView: () => this.showMirrorView(),
    removeItem: (item, count) => this.removeItem(item, count),
    grantLevels: (count) => this.gainExperience(experienceForLevelUps(this.level, this.experience, count)),
    equipArmor: (item) => { this.equippedArmor = item; },
    equipShield: (item) => { this.equippedShield = item; this.shieldDurabilityUsed = 0; },
    playHandAction: () => this.playHandAction(),
    spawnHealEffect: () => this.spawnHealEffect(this.playerPosition),
    playTone: (frequency, duration, type, volume) => this.playTone(frequency, duration, type, volume),
    showMessage: (text) => this.showMessage(text),
    renderHud: () => this.renderHud(),
  };
  private readonly areaSkillEffects: AreaSkillEffect[] = [];
  private actionMode: HandActionMode = "use";
  private rangedCooldown = 0;
  private gameStarted = false;
  private nightSpawnTimer = 0; private expirySweepTimer = 0;
  private mirrorViewTimer = 0;
  private mirrorAvatar: THREE.Object3D | null = null;
  private audioContext: AudioContext | null = null;
  private bgmMasterGain: GainNode | null = null;
  private sfxMasterGain: GainNode | null = null;
  private nextBgmNoteAt = 0;
  private bgmStep = 0;
  private nextAmbientCueAt = 0;
  private footstepDistance = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    if (import.meta.env.DEV) {
      (window as typeof window & { __wildernessGame?: WildernessGame }).__wildernessGame = this;
    }
    this.setupRenderer();
    this.setupScene();
    setupGameUi(
      {
        container: this.container,
        uiRoot: this.uiRoot,
        statsEl: this.statsEl,
        objectiveEl: this.objectiveEl,
        promptEl: this.promptEl,
        hotbarEl: this.hotbarEl,
        messageEl: this.messageEl,
        panelEl: this.panelEl,
        bossBarEl: this.bossBarEl,
        saveControlsEl: this.saveControlsEl,
        titleScreenEl: this.titleScreenEl,
      },
      {
        lavaLaneCount: LAVA_LANE_COUNT,
        playerClasses: Object.entries(PLAYER_CLASSES).map(([id, playerClass]) => ({
          id,
          name: playerClass.name,
          skillName: playerClass.skillName,
          tagline: playerClass.tagline,
          passiveLabel: CLASS_PASSIVES[id as PlayerClassId].label,
          passiveSummary: CLASS_PASSIVES[id as PlayerClassId].summary,
        })),
      },
      {
        onNewGame: () => this.newGame(),
        onSaveGame: () => this.saveGame(),
        onLoadGame: () => this.loadGame(),
        onTitleNew: () => this.startGame("new"),
        onClassChoice: (choice) => {
          if (!this.isPlayerClassId(choice)) return;
          this.pendingPlayerClass = choice;
          this.titleScreenEl.querySelector<HTMLElement>("[data-class-select]")?.classList.remove("needs-choice");
          this.renderClassSelection();
          this.playTone(520, 0.06, "triangle", 0.018);
        },
        onTitleLoad: () => this.startGame("load"),
        onShowMiniGame: () => this.showMiniGame(),
        onShowLavaMiniGame: () => this.showLavaMiniGame(),
        onShowSmithingMiniGame: () => this.showSmithingMiniGame(),
        onHideMiniGame: () => this.hideMiniGame(),
        onStartMiniGame: (event) => {
          this.startMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onResetMiniGame: (event) => {
          this.startMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onHideLavaMiniGame: () => this.hideLavaMiniGame(),
        onStartLavaMiniGame: (event) => {
          this.startLavaMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onResetLavaMiniGame: (event) => {
          this.startLavaMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onHideSmithingMiniGame: () => this.hideSmithingMiniGame(),
        onStartSmithingMiniGame: (event) => {
          this.startSmithingMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onResetSmithingMiniGame: (event) => {
          this.startSmithingMiniGameRound();
          this.releaseMiniGameButtonFocus(event);
        },
        onBindSmithingMiniGameEvents: () => this.bindSmithingMiniGameEvents(),
        onRenderTitlePoints: () => this.renderTitlePoints(),
        onRenderClassSelection: () => this.renderClassSelection(),
        onRenderMiniGame: () => this.renderMiniGame(),
        onRenderLavaMiniGame: () => this.renderLavaMiniGame(),
        onRenderSmithingMiniGame: () => this.renderSmithingMiniGame(),
      },
    );
    this.setupEvents();
    this.seedOverworld();
    precompileSceneShaders(this.renderer, this.scene, this.camera);
    this.renderHud();
    this.animate();
  }

  private loadArcadePoints() {
    const raw = Number(localStorage.getItem(ARCADE_POINTS_KEY) ?? 0);
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  }

  private saveArcadePoints() {
    localStorage.setItem(ARCADE_POINTS_KEY, String(Math.max(0, Math.floor(this.arcadePoints))));
    this.renderTitlePoints();
  }

  private setupRenderer() {
    this.renderer.setPixelRatio(this.pixelRatioForQuality());
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = false;
    this.renderer.domElement.className = "game-canvas";
    this.container.appendChild(this.renderer.domElement);
    this.uiRoot.appendChild(this.bannerEl);
    this.camera.position.copy(this.playerPosition);
  }

  private setupScene() {
    this.scene.background = new THREE.Color(0xaed8ff);
    this.scene.fog = new THREE.Fog(0xaed8ff, 70, 460);
    this.setupSkyDome();

    this.scene.add(this.ambientLight);
    this.sunLight.position.set(80, 140, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.camera.left = -165;
    this.sunLight.shadow.camera.right = 165;
    this.sunLight.shadow.camera.top = 165;
    this.sunLight.shadow.camera.bottom = -165;
    this.sunLight.shadow.bias = -0.00012;
    this.sunLight.shadow.normalBias = 0.035;
    applyShadowQuality(this.sunLight, this.qualityMode);
    this.scene.add(this.sunLight);
    this.fillLight.position.set(-90, 62, -120);
    this.scene.add(this.fillLight);
    this.moonLight.position.set(-80, 70, 110);
    this.scene.add(this.moonLight);
    this.scene.add(this.camera);
    this.createFirstPersonHand();
    this.setupMirrorView();

    this.groundMesh = createStylizedGround(WORLD_SIZE, (point, margin) => this.isNearWater(point, margin));
    this.groundMesh.name = "grassland";
    this.scene.add(this.groundMesh);

    this.gridHelper = new THREE.GridHelper(WORLD_SIZE, 90, 0x40794d, 0x78b36a);
    this.gridHelper.position.y = 0.012;
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);
    createCloudLayer(this.scene, this.cloudLayer, CLOUD_COUNT, WORLD_SIZE);
    this.applyTimeOfDay();
  }

  private setupSkyDome() {
    this.sky.scale.setScalar(WORLD_SIZE * 2.2);
    const uniforms = this.sky.material.uniforms;
    uniforms.turbidity.value = 7.2;
    uniforms.rayleigh.value = 2.85;
    uniforms.mieCoefficient.value = 0.0045;
    uniforms.mieDirectionalG.value = 0.72;
    this.scene.add(this.sky);
  }

  private pixelRatioForQuality(mode: QualityMode = this.qualityMode) {
    const cap = mode === "high" ? 1.35 : mode === "balanced" ? 1.12 : 1;
    return Math.min(window.devicePixelRatio, cap);
  }

  private setupMirrorView() {
    const mirrorFrame = createMirrorModel(1.35);
    mirrorFrame.position.set(0, 1.25, -0.08);
    this.mirrorView.add(mirrorFrame);
    this.refreshMirrorAvatar();
    this.mirrorView.position.set(0, -0.18, -3.4);
    this.mirrorView.rotation.set(0, 0, 0);
    this.mirrorView.visible = false;
    this.camera.add(this.mirrorView);
  }

  private refreshMirrorAvatar() {
    if (this.mirrorAvatar) {
      this.mirrorView.remove(this.mirrorAvatar);
      this.mirrorAvatar = null;
    }
    const model = this.possessedEagleId
      ? createEagleAvatarModel()
      : createAvatarModel(DEFAULT_AVATAR_APPEARANCE, this.playerClass);
    model.position.set(0, -0.48, 0.22);
    model.rotation.y = 0;
    model.scale.setScalar(this.possessedEagleId ? 0.5 : 0.64);
    this.mirrorView.add(model);
    this.mirrorAvatar = model;
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
    applyOverworldTimeOfDay({ hour: this.gameHour(), scene: this.scene, sky: this.sky, ambientLight: this.ambientLight, sunLight: this.sunLight, fillLight: this.fillLight, moonLight: this.moonLight, cloudLayer: this.cloudLayer, sunPosition: this.sunPosition, mood: this.currentWorldMapId === "graveyard" ? "graveyard" : "default" });
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
    const upperArmMat = new THREE.MeshStandardMaterial({ color: 0x2f4668, roughness: 0.78 });
    const forearmMat = new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.75 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x243b5a, roughness: 0.75 });
    this.handClothMaterials.length = 0;
    this.handClothMaterials.push(upperArmMat, forearmMat, sleeveMat);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.28), upperArmMat);
    upperArm.position.set(0.47, -0.34, -1.0);
    upperArm.rotation.set(-0.48, -0.14, 0.18);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.34), forearmMat);
    forearm.position.set(0.36, -0.4, -1.18);
    forearm.rotation.set(-0.46, -0.2, 0.16);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.12), sleeveMat);
    sleeve.position.set(0.27, -0.45, -1.35);
    sleeve.rotation.set(-0.38, -0.22, 0.13);
    this.refreshHandColor();

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

  private refreshHandColor() {
    const shirt = CLASS_APPEARANCE[this.playerClass]?.shirtColor ?? DEFAULT_AVATAR_APPEARANCE.shirtColor;
    for (const material of this.handClothMaterials) material.color.setHex(shirt);
  }

  private setOverworldAtmosphere() {
    this.applyTimeOfDay();
    if (this.groundMesh) this.groundMesh.visible = true;
    if (this.gridHelper) this.gridHelper.visible = false;
    this.sky.visible = true;
    this.cloudLayer.visible = true;
    for (const mesh of this.biomeMeshes) mesh.visible = true;
  }

  private setCaveAtmosphere() {
    this.scene.background = new THREE.Color(0x1b1e23);
    this.scene.fog = new THREE.Fog(0x1b1e23, 32, 158);
    this.ambientLight.intensity = 1.22;
    this.sunLight.intensity = 0.2;
    this.fillLight.intensity = 0.68;
    this.moonLight.intensity = 0.16;
    if (this.groundMesh) this.groundMesh.visible = false;
    if (this.gridHelper) this.gridHelper.visible = false;
    this.sky.visible = false;
    this.cloudLayer.visible = false;
    for (const mesh of this.biomeMeshes) mesh.visible = false;
  }

  private setHouseAtmosphere() {
    this.scene.background = new THREE.Color(0x1a1510);
    this.scene.fog = new THREE.Fog(0x1a1510, 18, 82);
    this.ambientLight.intensity = 1.15;
    this.sunLight.intensity = 0.18;
    this.fillLight.intensity = 0.55;
    this.moonLight.intensity = 0;
    if (this.groundMesh) this.groundMesh.visible = false;
    if (this.gridHelper) this.gridHelper.visible = false;
    this.sky.visible = false;
    this.cloudLayer.visible = false;
    for (const mesh of this.biomeMeshes) mesh.visible = false;
  }

  private renderTitlePoints() {
    this.titleScreenEl.querySelectorAll<HTMLElement>("[data-title-points], [data-mini-points], [data-lava-points], [data-smith-points]").forEach((element) => {
      element.textContent = String(this.arcadePoints);
    });
    this.renderHud();
  }

  private isPlayerClassId(value: unknown): value is PlayerClassId {
    return typeof value === "string" && value in PLAYER_CLASSES;
  }

  private renderClassSelection() {
    this.titleScreenEl.querySelectorAll<HTMLButtonElement>("[data-class-choice]").forEach((button) => {
      const selected = button.dataset.classChoice === this.pendingPlayerClass;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  private miniGameScreen() {
    return this.titleScreenEl.querySelector<HTMLElement>("[data-mini-game]");
  }

  private lavaGameScreen() {
    return this.titleScreenEl.querySelector<HTMLElement>("[data-lava-game]");
  }

  private smithingGameScreen() {
    return this.titleScreenEl.querySelector<HTMLElement>("[data-smithing-game]");
  }

  private showMiniGame() {
    this.ensureAudio();
    this.hideLavaMiniGame(false);
    this.hideSmithingMiniGame(false);
    this.miniGame.active = true;
    this.miniGame.gameOver = false;
    this.miniGame.playing = false;
    this.resetMiniGameBall();
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.add("mini-hidden");
    this.miniGameScreen()?.classList.remove("hidden");
    this.renderMiniGame();
    this.playTone(520, 0.08, "triangle", 0.025);
  }

  private hideMiniGame(renderTitle = true) {
    this.miniGame.active = false;
    this.miniGame.playing = false;
    this.miniGameKeys.clear();
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.remove("mini-hidden");
    this.miniGameScreen()?.classList.add("hidden");
    if (renderTitle) this.renderTitlePoints();
  }

  private showLavaMiniGame() {
    this.ensureAudio();
    this.hideMiniGame(false);
    this.hideSmithingMiniGame(false);
    this.lavaGame.active = true;
    this.lavaGame.playing = false;
    this.lavaGame.gameOver = false;
    this.resetLavaMiniGame();
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.add("mini-hidden");
    this.lavaGameScreen()?.classList.remove("hidden");
    this.renderLavaMiniGame();
    this.playTone(380, 0.08, "triangle", 0.025);
  }

  private hideLavaMiniGame(renderTitle = true) {
    this.lavaGame.active = false;
    this.lavaGame.playing = false;
    this.lavaGameScreen()?.classList.add("hidden");
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.remove("mini-hidden");
    if (renderTitle) this.renderTitlePoints();
  }

  private showSmithingMiniGame() {
    this.ensureAudio();
    this.hideMiniGame(false);
    this.hideLavaMiniGame(false);
    this.smithingGame.active = true;
    this.smithingGame.playing = false;
    this.smithingGame.gameOver = false;
    this.resetSmithingMiniGame(false);
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.add("mini-hidden");
    this.smithingGameScreen()?.classList.remove("hidden");
    this.renderSmithingMiniGame();
    this.playTone(460, 0.08, "triangle", 0.025);
  }

  private hideSmithingMiniGame(renderTitle = true) {
    this.smithingGame.active = false;
    this.smithingGame.playing = false;
    this.smithingGameScreen()?.classList.add("hidden");
    this.titleScreenEl.querySelector<HTMLElement>(".title-menu")?.classList.remove("mini-hidden");
    if (renderTitle) this.renderTitlePoints();
  }

  private releaseMiniGameButtonFocus(event?: Event) {
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) target.blur();
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.titleScreenEl.contains(active)) active.blur();
  }

  private clickFocusedMiniGameStart(selector: string) {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || !this.titleScreenEl.contains(active) || !active.matches(selector)) return;
    active.click();
  }

  private bindSmithingMiniGameEvents() {
    const screen = this.smithingGameScreen();
    if (!screen) return;
    screen.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (target.closest("[data-smith-hammer]")) {
        event.stopPropagation();
        this.hammerSmithingOre();
        return;
      }
      if (target.closest("[data-smith-deliver]")) {
        event.stopPropagation();
        this.deliverSmithingProduct();
      }
    });
    screen.addEventListener("contextmenu", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest("[data-smith-product]")) return;
      event.preventDefault();
      event.stopPropagation();
      this.discardSmithingProduct();
    });
    screen.addEventListener("dragstart", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-smith-product]") : null;
      if (!target || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "smithing-product");
    });
    const trash = screen.querySelector<HTMLElement>("[data-smith-trash]");
    trash?.addEventListener("dragover", (event) => {
      event.preventDefault();
      trash.classList.add("drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    trash?.addEventListener("dragleave", () => trash.classList.remove("drag-over"));
    trash?.addEventListener("drop", (event) => {
      event.preventDefault();
      trash.classList.remove("drag-over");
      this.discardSmithingProduct();
    });
  }

  private resetMiniGameBall() {
    const direction = Math.random() < 0.5 ? -1 : 1;
    this.miniGame.score = 0;
    this.miniGame.ballX = 0.5;
    this.miniGame.ballY = 0.5;
    this.miniGame.ballVX = direction * 0.44;
    this.miniGame.ballVY = THREE.MathUtils.randFloat(-0.24, 0.24);
    this.miniGame.paddleY = 0.5 - MINI_GAME_PADDLE_HEIGHT / 2;
  }

  private startMiniGameRound() {
    this.ensureAudio();
    this.resetMiniGameBall();
    this.miniGame.active = true;
    this.miniGame.playing = true;
    this.miniGame.gameOver = false;
    this.renderMiniGame();
    this.playTone(660, 0.1, "triangle", 0.03);
  }

  private endMiniGameRound() {
    if (!this.miniGame.playing) return;
    this.miniGame.playing = false;
    this.miniGame.gameOver = true;
    this.arcadePoints += this.miniGame.score;
    this.saveArcadePoints();
    this.miniGameKeys.clear();
    this.releaseMiniGameButtonFocus();
    this.renderMiniGame();
    this.playTone(150, 0.18, "sawtooth", 0.03);
  }

  private renderMiniGame() {
    const state = this.miniGame;
    this.titleScreenEl.querySelector<HTMLElement>("[data-mini-score]")!.textContent = String(state.score);
    this.titleScreenEl.querySelector<HTMLElement>("[data-mini-points]")!.textContent = String(this.arcadePoints);
    const stateText = state.playing
      ? "진행 중"
      : state.gameOver
        ? `게임 종료: ${state.score}P 획득`
        : "위/아래 화살표 또는 시작 버튼으로 준비";
    this.titleScreenEl.querySelector<HTMLElement>("[data-mini-state]")!.textContent = stateText;
    const startButton = this.titleScreenEl.querySelector<HTMLButtonElement>("[data-mini-start]");
    if (startButton) startButton.disabled = state.playing;
    const paddleTop = `${state.paddleY * 100}%`;
    const paddleHeight = `${MINI_GAME_PADDLE_HEIGHT * 100}%`;
    this.titleScreenEl.querySelectorAll<HTMLElement>("[data-mini-paddle-left], [data-mini-paddle-right]").forEach((paddle) => {
      paddle.style.top = paddleTop;
      paddle.style.height = paddleHeight;
    });
    const ball = this.titleScreenEl.querySelector<HTMLElement>("[data-mini-ball]");
    if (ball) {
      ball.style.left = `${state.ballX * 100}%`;
      ball.style.top = `${state.ballY * 100}%`;
    }
  }

  private handleMiniGameKeyDown(event: KeyboardEvent) {
    if (!this.miniGame.active) return false;
    if (event.code === "Escape") {
      this.blockBrowserShortcut(event);
      this.hideMiniGame();
      return true;
    }
    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      this.blockBrowserShortcut(event);
      this.miniGameKeys.add(event.code);
      return true;
    }
    if (event.code === "Space" || event.code === "Enter") {
      this.blockBrowserShortcut(event);
      if (!this.miniGame.playing && !event.repeat) this.clickFocusedMiniGameStart("[data-mini-start], [data-mini-reset]");
      return true;
    }
    return false;
  }

  private handleMiniGameKeyUp(event: KeyboardEvent) {
    if (!this.miniGame.active) return false;
    if (event.code === "ArrowUp" || event.code === "ArrowDown") {
      this.blockBrowserShortcut(event);
      this.miniGameKeys.delete(event.code);
      return true;
    }
    return false;
  }

  private updateMiniGame(delta: number) {
    if (!this.miniGame.active || !this.miniGame.playing) return;
    const state = this.miniGame;
    const paddleDirection = (this.miniGameKeys.has("ArrowDown") ? 1 : 0) - (this.miniGameKeys.has("ArrowUp") ? 1 : 0);
    if (paddleDirection !== 0) {
      state.paddleY = THREE.MathUtils.clamp(state.paddleY + paddleDirection * delta * 0.9, 0, 1 - MINI_GAME_PADDLE_HEIGHT);
    }

    state.ballX += state.ballVX * delta;
    state.ballY += state.ballVY * delta;

    if (state.ballY - MINI_GAME_BALL_RADIUS <= 0) {
      state.ballY = MINI_GAME_BALL_RADIUS;
      state.ballVY = Math.abs(state.ballVY);
      this.playTone(360, 0.035, "triangle", 0.016);
    }
    if (state.ballY + MINI_GAME_BALL_RADIUS >= 1) {
      state.ballY = 1 - MINI_GAME_BALL_RADIUS;
      state.ballVY = -Math.abs(state.ballVY);
      this.playTone(360, 0.035, "triangle", 0.016);
    }

    const paddleMin = state.paddleY - MINI_GAME_BALL_RADIUS * 0.7;
    const paddleMax = state.paddleY + MINI_GAME_PADDLE_HEIGHT + MINI_GAME_BALL_RADIUS * 0.7;
    const inPaddleY = state.ballY >= paddleMin && state.ballY <= paddleMax;
    const leftFace = 0.035 + MINI_GAME_PADDLE_WIDTH;
    const rightFace = 0.965 - MINI_GAME_PADDLE_WIDTH;
    if (state.ballVX < 0 && state.ballX - MINI_GAME_BALL_RADIUS <= leftFace && state.ballX > 0 && inPaddleY) {
      this.bounceMiniGameBall(1, leftFace + MINI_GAME_BALL_RADIUS);
    }
    if (state.ballVX > 0 && state.ballX + MINI_GAME_BALL_RADIUS >= rightFace && state.ballX < 1 && inPaddleY) {
      this.bounceMiniGameBall(-1, rightFace - MINI_GAME_BALL_RADIUS);
    }

    if (state.ballX < -MINI_GAME_BALL_RADIUS || state.ballX > 1 + MINI_GAME_BALL_RADIUS) {
      this.endMiniGameRound();
      return;
    }
    this.renderMiniGame();
  }

  private bounceMiniGameBall(direction: 1 | -1, nextX: number) {
    const state = this.miniGame;
    state.ballX = nextX;
    const center = state.paddleY + MINI_GAME_PADDLE_HEIGHT / 2;
    const relative = THREE.MathUtils.clamp((state.ballY - center) / (MINI_GAME_PADDLE_HEIGHT / 2), -1, 1);
    const speed = Math.min(1.65, Math.hypot(state.ballVX, state.ballVY) * 1.045 + 0.012);
    const angle = relative * 0.86;
    state.ballVX = direction * Math.cos(angle) * speed;
    state.ballVY = Math.sin(angle) * speed;
    state.score += 10;
    this.playTone(620 + Math.min(420, state.score * 0.5), 0.04, "square", 0.022);
  }

  private resetLavaMiniGame() {
    const state = this.lavaGame;
    state.score = 0;
    state.playerLane = 2;
    state.hazards = [];
    state.spawnTimer = 0.45;
    state.spawnInterval = 0.92;
    state.fallSpeed = 0.42;
    state.stage = 1;
    state.wavesUntilSpecial = 5;
    state.nextHazardId = 1;
    state.nextWaveId = 1;
  }

  private startLavaMiniGameRound() {
    this.ensureAudio();
    this.resetLavaMiniGame();
    this.lavaGame.active = true;
    this.lavaGame.playing = true;
    this.lavaGame.gameOver = false;
    this.renderLavaMiniGame();
    this.playTone(420, 0.1, "triangle", 0.03);
  }

  private endLavaMiniGameRound() {
    if (!this.lavaGame.playing) return;
    this.lavaGame.playing = false;
    this.lavaGame.gameOver = true;
    this.arcadePoints += this.lavaGame.score;
    this.saveArcadePoints();
    this.releaseMiniGameButtonFocus();
    this.renderLavaMiniGame();
    this.playTone(120, 0.18, "sawtooth", 0.03);
  }

  private renderLavaMiniGame() {
    const state = this.lavaGame;
    const scoreEl = this.titleScreenEl.querySelector<HTMLElement>("[data-lava-score]");
    if (!scoreEl) return;
    scoreEl.textContent = String(state.score);
    this.titleScreenEl.querySelector<HTMLElement>("[data-lava-points]")!.textContent = String(this.arcadePoints);
    this.titleScreenEl.querySelector<HTMLElement>("[data-lava-stage]")!.textContent = String(state.stage);
    const stateText = state.playing
      ? "진행 중: 좌/우 화살표로 이동"
      : state.gameOver
        ? `게임 종료: ${state.score}P 획득`
        : "좌/우 화살표 또는 시작 버튼으로 준비";
    this.titleScreenEl.querySelector<HTMLElement>("[data-lava-state]")!.textContent = stateText;
    const startButton = this.titleScreenEl.querySelector<HTMLButtonElement>("[data-lava-start]");
    if (startButton) startButton.disabled = state.playing;

    const player = this.titleScreenEl.querySelector<HTMLElement>("[data-lava-player]");
    if (player) {
      player.dataset.lane = String(state.playerLane);
      player.style.left = `${((state.playerLane + 0.5) / LAVA_LANE_COUNT) * 100}%`;
    }

    const hazards = this.titleScreenEl.querySelector<HTMLElement>("[data-lava-hazards]");
    if (hazards) {
      hazards.innerHTML = state.hazards
        .map(
          (hazard) =>
            `<div class="lava-stream${hazard.special ? " special" : ""}" style="left:${(hazard.lane / LAVA_LANE_COUNT) * 100}%;width:${100 / LAVA_LANE_COUNT}%;top:${hazard.y * 100}%;height:${hazard.length * 100}%"></div>`,
        )
        .join("");
    }
  }

  private handleLavaMiniGameKeyDown(event: KeyboardEvent) {
    if (!this.lavaGame.active) return false;
    if (event.code === "Escape") {
      this.blockBrowserShortcut(event);
      this.hideLavaMiniGame();
      return true;
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      this.blockBrowserShortcut(event);
      if (this.lavaGame.playing && !event.repeat) {
        const movement = event.code === "ArrowLeft" ? -1 : 1;
        this.lavaGame.playerLane = THREE.MathUtils.clamp(this.lavaGame.playerLane + movement, 0, LAVA_LANE_COUNT - 1);
        this.renderLavaMiniGame();
      }
      return true;
    }
    if (event.code === "Space" || event.code === "Enter") {
      this.blockBrowserShortcut(event);
      if (!this.lavaGame.playing && !event.repeat) this.clickFocusedMiniGameStart("[data-lava-start], [data-lava-reset]");
      return true;
    }
    return false;
  }

  private handleLavaMiniGameKeyUp(event: KeyboardEvent) {
    if (!this.lavaGame.active) return false;
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      this.blockBrowserShortcut(event);
      return true;
    }
    return false;
  }

  private updateLavaMiniGame(delta: number) {
    const state = this.lavaGame;
    if (!state.active || !state.playing) return;

    state.spawnTimer -= delta;
    while (state.spawnTimer <= 0) {
      this.spawnLavaWave();
      state.spawnTimer += state.spawnInterval;
    }

    for (const hazard of state.hazards) hazard.y += hazard.speed * delta;

    const hit = state.hazards.some(
      (hazard) =>
        hazard.lane === state.playerLane &&
        hazard.y + hazard.length >= LAVA_PLAYER_HIT_TOP &&
        hazard.y <= LAVA_PLAYER_HIT_BOTTOM,
    );
    if (hit) {
      this.endLavaMiniGameRound();
      return;
    }

    const clearedSpecialWaves = new Set<number>();
    const remaining: LavaHazard[] = [];
    for (const hazard of state.hazards) {
      if (hazard.y > 1.08) {
        state.score += LAVA_SCORE_PER_CLEAR;
        if (hazard.special) clearedSpecialWaves.add(hazard.waveId);
      } else {
        remaining.push(hazard);
      }
    }
    state.hazards = remaining;

    for (const waveId of clearedSpecialWaves) {
      if (state.hazards.some((hazard) => hazard.waveId === waveId)) continue;
      state.stage += 1;
      state.fallSpeed = Math.min(1.28, state.fallSpeed + 0.08);
      state.spawnInterval = Math.max(0.44, state.spawnInterval * 0.9);
      this.playTone(760, 0.08, "triangle", 0.026);
    }

    this.renderLavaMiniGame();
  }

  private spawnLavaWave() {
    const state = this.lavaGame;
    const waveId = state.nextWaveId;
    state.nextWaveId += 1;

    if (state.wavesUntilSpecial <= 0) {
      const safeLaneCandidates = this.shuffledLavaLanes();
      for (const safeLane of safeLaneCandidates) {
        const wave = Array.from({ length: LAVA_LANE_COUNT }, (_, lane) => lane)
          .filter((lane) => lane !== safeLane)
          .map((lane) => ({
            lane,
            y: -0.76,
            length: 0.72,
            speed: state.fallSpeed * 1.08,
          }));
        if (!this.lavaWaveLeavesSafeSpace(wave)) continue;
        for (const hazard of wave) {
          state.hazards.push({
            ...hazard,
            id: state.nextHazardId,
            special: true,
            waveId,
          });
          state.nextHazardId += 1;
        }
        state.wavesUntilSpecial = THREE.MathUtils.randInt(5, 8);
        this.playTone(230, 0.16, "sawtooth", 0.026);
        return;
      }
      return;
    }

    const length = THREE.MathUtils.randFloat(0.24, 0.34);
    const speed = state.fallSpeed;
    for (const lane of this.shuffledLavaLanes()) {
      const wave = [{ lane, y: -0.3, length, speed }];
      if (!this.lavaWaveLeavesSafeSpace(wave)) continue;
      state.hazards.push({
        ...wave[0],
        id: state.nextHazardId,
        waveId,
      });
      state.nextHazardId += 1;
      state.wavesUntilSpecial -= 1;
      return;
    }
  }

  private shuffledLavaLanes() {
    return Array.from({ length: LAVA_LANE_COUNT }, (_, lane) => lane).sort(() => Math.random() - 0.5);
  }

  private lavaWaveLeavesSafeSpace(candidates: Pick<LavaHazard, "lane" | "y" | "length" | "speed">[]) {
    const maxCandidateTime = candidates.reduce((maxTime, hazard) => {
      const exitTime = (LAVA_PLAYER_HIT_BOTTOM - hazard.y) / Math.max(0.001, hazard.speed);
      return Math.max(maxTime, exitTime);
    }, 0.6);
    const maxTime = THREE.MathUtils.clamp(maxCandidateTime + 0.18, 0.8, 4.2);
    for (let timeAhead = 0; timeAhead <= maxTime; timeAhead += 0.08) {
      const occupiedLanes = this.lavaOccupiedLanesAt(timeAhead, candidates);
      if (occupiedLanes.size >= LAVA_LANE_COUNT) return false;
    }
    return true;
  }

  private lavaOccupiedLanesAt(timeAhead: number, candidates: Pick<LavaHazard, "lane" | "y" | "length" | "speed">[] = []) {
    const occupied = new Set<number>();
    for (const hazard of [...this.lavaGame.hazards, ...candidates]) {
      const y = hazard.y + hazard.speed * timeAhead;
      if (y + hazard.length >= LAVA_PLAYER_HIT_TOP && y <= LAVA_PLAYER_HIT_BOTTOM) occupied.add(hazard.lane);
    }
    return occupied;
  }

  private resetSmithingMiniGame(fullReset = true) {
    const state = this.smithingGame;
    if (fullReset) {
      state.score = 0;
      state.successCount = 0;
      state.timeLeft = SMITHING_ROUND_SECONDS;
      this.smithingLastRenderedSecond = SMITHING_ROUND_SECONDS;
    }
    state.order = this.randomSmithingProduct();
    state.currentProduct = null;
    state.hits = 0;
    state.message = fullReset ? "구리, 철, 금, 다이아몬드 광석을 두드려 의뢰품을 만드세요." : "시작하면 120초 타이머가 흐릅니다.";
  }

  private startSmithingMiniGameRound() {
    this.ensureAudio();
    this.smithingGame.active = true;
    this.smithingGame.playing = true;
    this.smithingGame.gameOver = false;
    this.resetSmithingMiniGame(true);
    this.renderSmithingMiniGame();
    this.playTone(520, 0.1, "triangle", 0.03);
  }

  private endSmithingMiniGameRound() {
    const state = this.smithingGame;
    if (!state.playing) return;
    state.playing = false;
    state.gameOver = true;
    state.timeLeft = 0;
    this.arcadePoints += state.score;
    this.saveArcadePoints();
    state.message = `완료! ${state.successCount}개 납품, ${state.score}P 획득.`;
    this.releaseMiniGameButtonFocus();
    this.renderSmithingMiniGame();
    this.playTone(160, 0.2, "sawtooth", 0.03);
  }

  private randomSmithingProduct(material?: SmithingMaterial) {
    const pool = material ? SMITHING_PRODUCTS.filter((product) => product.material === material) : SMITHING_PRODUCTS;
    return pool[THREE.MathUtils.randInt(0, pool.length - 1)];
  }

  private smithingMaterialName(material: SmithingMaterial) {
    return material === "copper" ? "구리" : material === "iron" ? "철" : material === "gold" ? "금" : "다이아몬드";
  }

  private smithingProductIcon(product: SmithingProduct) {
    if (product.kind === "dagger") return "칼";
    if (product.kind === "sword") return "검";
    if (product.kind === "axe") return "도끼";
    if (product.kind === "pickaxe") return "곡괭이";
    return "갑옷";
  }

  private hammerSmithingOre() {
    const state = this.smithingGame;
    if (!state.active) return;
    if (!state.playing) {
      state.message = "시작 버튼을 눌러 대장간 게임을 시작하세요.";
      this.renderSmithingMiniGame();
      return;
    }
    if (state.currentProduct) {
      state.message = state.currentProduct.id === state.order.id ? "의뢰품이 완성되었습니다. 주민에게 주세요!" : "의뢰품이 아닙니다. 우클릭하거나 쓰레기통에 버리세요.";
      this.renderSmithingMiniGame();
      return;
    }
    state.hits += 1;
    this.playTone(240 + state.hits * 70, 0.045, "square", 0.022);
    if (state.hits < SMITHING_HITS_REQUIRED) {
      state.message = `망치질 ${state.hits}/${SMITHING_HITS_REQUIRED}. 조금만 더 두드리세요.`;
      this.renderSmithingMiniGame();
      return;
    }
    state.currentProduct = this.randomSmithingProduct(state.order.material);
    state.message = state.currentProduct.id === state.order.id
      ? `${state.currentProduct.name} 완성! 주민에게 주면 50P를 얻습니다.`
      : `${state.currentProduct.name}이 나왔습니다. 의뢰품이 아니면 버리고 다시 제작하세요.`;
    this.playTone(state.currentProduct.id === state.order.id ? 760 : 420, 0.09, "triangle", 0.03);
    this.renderSmithingMiniGame();
  }

  private discardSmithingProduct() {
    const state = this.smithingGame;
    if (!state.active || !state.currentProduct) return;
    state.currentProduct = null;
    state.hits = 0;
    state.message = "버렸습니다. 새 광석을 다시 두드리세요.";
    this.playTone(190, 0.08, "sawtooth", 0.02);
    this.renderSmithingMiniGame();
  }

  private deliverSmithingProduct() {
    const state = this.smithingGame;
    if (!state.active) return;
    if (!state.playing) {
      state.message = "시작 버튼을 눌러 대장간 게임을 시작하세요.";
      this.renderSmithingMiniGame();
      return;
    }
    if (!state.currentProduct) {
      state.message = "먼저 광석을 두드려 제작품을 만들어야 합니다.";
      this.renderSmithingMiniGame();
      return;
    }
    if (state.currentProduct.id !== state.order.id) {
      state.message = `주민: 저는 ${state.order.name}을 부탁했어요. 이건 쓰레기통에 버려 주세요.`;
      this.playTone(130, 0.09, "sawtooth", 0.022);
      this.renderSmithingMiniGame();
      return;
    }
    state.successCount += 1;
    state.score += SMITHING_SUCCESS_POINTS;
    state.message = `${state.order.name} 납품 성공! +${SMITHING_SUCCESS_POINTS}P. 다음 의뢰가 들어왔습니다.`;
    state.currentProduct = null;
    state.hits = 0;
    state.order = this.randomSmithingProduct();
    this.playTone(860, 0.12, "triangle", 0.04);
    this.renderSmithingMiniGame();
  }

  private updateSmithingMiniGame(delta: number) {
    const state = this.smithingGame;
    if (!state.active || !state.playing) return;
    const previousSecond = Math.ceil(state.timeLeft);
    state.timeLeft = Math.max(0, state.timeLeft - delta);
    if (state.timeLeft <= 0) {
      this.endSmithingMiniGameRound();
      return;
    }
    const nextSecond = Math.ceil(state.timeLeft);
    if (nextSecond !== previousSecond || nextSecond !== this.smithingLastRenderedSecond) {
      this.smithingLastRenderedSecond = nextSecond;
      const timeEl = this.smithingGameScreen()?.querySelector<HTMLElement>("[data-smith-time]");
      if (timeEl) timeEl.textContent = String(nextSecond);
    }
  }

  private renderSmithingMiniGame() {
    const state = this.smithingGame;
    const screen = this.smithingGameScreen();
    if (!screen) return;
    screen.querySelector<HTMLElement>("[data-smith-score]")!.textContent = String(state.score);
    screen.querySelector<HTMLElement>("[data-smith-success]")!.textContent = String(state.successCount);
    this.smithingLastRenderedSecond = Math.ceil(state.timeLeft);
    screen.querySelector<HTMLElement>("[data-smith-time]")!.textContent = String(this.smithingLastRenderedSecond);
    screen.querySelector<HTMLElement>("[data-smith-points]")!.textContent = String(this.arcadePoints);
    screen.querySelector<HTMLElement>("[data-smith-order]")!.textContent = state.playing || state.gameOver ? state.order.name : "대기 중";
    screen.querySelector<HTMLElement>("[data-smith-message]")!.textContent = state.message;
    const stateText = state.playing ? "진행 중" : state.gameOver ? `게임 종료: ${state.score}P 획득` : "시작 대기";
    screen.querySelector<HTMLElement>("[data-smith-state]")!.textContent = stateText;
    const startButton = screen.querySelector<HTMLButtonElement>("[data-smith-start]");
    if (startButton) startButton.disabled = state.playing;
    const oreLabel = screen.querySelector<HTMLElement>("[data-smith-ore-label]");
    if (oreLabel) oreLabel.textContent = state.playing ? `${this.smithingMaterialName(state.order.material)} 광석` : "광석";
    const hitMark = screen.querySelector<HTMLElement>("[data-smith-hit-mark]");
    if (hitMark) hitMark.style.width = `${THREE.MathUtils.clamp(state.hits / SMITHING_HITS_REQUIRED, 0, 1) * 100}%`;
    const productSlot = screen.querySelector<HTMLElement>("[data-smith-product-slot]");
    if (productSlot) {
      productSlot.innerHTML = state.currentProduct
        ? `<div class="smithing-product ${state.currentProduct.id === state.order.id ? "match" : "miss"}" draggable="true" data-smith-product>
            <span>${this.smithingProductIcon(state.currentProduct)}</span>
            <strong>${state.currentProduct.name}</strong>
          </div>`
        : `<div class="smithing-product empty"><span>?</span><strong>제작 전</strong></div>`;
    }
    screen.querySelector<HTMLButtonElement>("[data-smith-deliver]")!.disabled = !state.playing || !state.currentProduct;
  }

  private handleSmithingMiniGameKeyDown(event: KeyboardEvent) {
    if (!this.smithingGame.active) return false;
    if (event.code === "Escape") {
      this.blockBrowserShortcut(event);
      this.hideSmithingMiniGame();
      return true;
    }
    if (event.code === "Space" || event.code === "Enter") {
      this.blockBrowserShortcut(event);
      if (this.smithingGame.playing) this.hammerSmithingOre();
      else if (!event.repeat) this.clickFocusedMiniGameStart("[data-smith-start], [data-smith-reset]");
      return true;
    }
    if (event.code === "Backspace" || event.code === "Delete") {
      this.blockBrowserShortcut(event);
      this.discardSmithingProduct();
      return true;
    }
    return false;
  }

  private setupEvents() {
    window.addEventListener("resize", () => this.resize());
    this.objectiveEl.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest(".objective-card")) return;
      const completedTutorial = claimTutorialObjective(this.tutorialProgress, this.currentObjectiveView());
      if (!completedTutorial) { this.showMessage("아직 완료되지 않은 목표입니다. 마우스를 올리면 상세 설명을 볼 수 있습니다."); return; }
      if (completedTutorial.reward.experience > 0) this.gainExperience(completedTutorial.reward.experience);
      for (const [item, count] of Object.entries(completedTutorial.reward.items ?? {})) if (!this.addItem(item as ItemId, count ?? 0)) this.spawnDroppedItem(item as ItemId, count ?? 0, this.playerPosition.clone());
      this.showMessage(`튜토리얼 완료: ${completedTutorial.title}. 보상: ${completedTutorial.reward.label}`);
      this.renderHud();
    });
    this.renderer.domElement.addEventListener("click", () => {
      if (!this.gameStarted) return;
      if (this.currentPanel === null) this.requestGamePointerLock();
    });
    this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    this.renderer.domElement.addEventListener("mousedown", (event) => {
      if (this.currentPanel !== null) return;
      if (event.button === 2) {
        event.preventDefault();
        if (this.possessedEagleId) { tryEagleWindCutter(this.eagleActionContext); return; }
        if (this.placeSelectedBuildingBlock()) return;
        if (this.useSelectedBucketOnLook(this.getLookTarget(), true)) return;
        if (this.sleepInLookedBed()) return;
        if (this.tradeWithExactLookedNpc()) return;
        if (this.useLookedWorkbench()) return;
        if (this.useLookedSmelter()) return;
        if (this.useLookedGrinder()) return;
        if (this.tradeWithLookedNpc()) return;
        if (this.useLookedShop()) return;
        if (this.useLookedSellShop()) return;
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
    document.addEventListener("pointerlockchange", () => {
      this.pendingMouseX = 0;
      this.pendingMouseY = 0;
      this.renderHud();
    });
    document.addEventListener("mousemove", (event) => this.handleMouseMove(event));
    window.addEventListener("keydown", (event) => this.handleKeyDown(event), { capture: true });
    window.addEventListener("keyup", (event) => this.handleKeyUp(event), { capture: true });
  }

  private requestGamePointerLock() {
    const canvas = this.renderer.domElement as HTMLCanvasElement & {
      requestPointerLock(options?: { unadjustedMovement?: boolean }): Promise<void> | void;
    };
    try {
      const result = canvas.requestPointerLock({ unadjustedMovement: true });
      if (result instanceof Promise) {
        result.catch(() => {
          if (this.currentPanel === null && document.pointerLockElement !== this.renderer.domElement) this.renderer.domElement.requestPointerLock();
        });
      }
    } catch {
      this.renderer.domElement.requestPointerLock();
    }
  }

  private seedOverworld() {
    this.biomeDecorContext.biomes = this.activeBiomes;
    for (let i = 0; i < 8; i += 1) this.spawnMountain(this.randomGroundPoint(), THREE.MathUtils.randFloat(15, 34), THREE.MathUtils.randFloat(4, 14));
    this.spawnBiomeTerrains();
    createBiomeDecor(this.biomeDecorContext);
    if (this.currentWorldMapId === "dragon_lands") { this.spawnInitialLavaDragons(); this.spawnBossProgression(); }
    const mapDef = getWorldMapById(this.currentWorldMapId);
    for (let i = 0; i < Math.round(1144 * (mapDef.treeScale ?? 1)); i += 1) this.spawnTree(Math.random() < 0.78 ? "smallTree" : "bigTree", this.randomGroundPoint());
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
    for (const waterZone of this.activeWaterZones) this.spawnWaterBody(waterZone.center.clone(), this.waterZoneRadius(waterZone), waterZone.name);
    this.spawnTrain(0.1);
    for (let i = 0; i < 6; i += 1) this.spawnChest(this.randomGroundPoint(), false);
    for (let i = 0; i < Math.round(3 * (mapDef.caveScale ?? 1)); i += 1) this.spawnCave(this.randomGroundPoint());
    for (let i = 0; i < (this.currentWorldMapId === DEFAULT_WORLD_MAP_ID ? FIELD_ANIMAL_COUNT : Math.ceil(FIELD_ANIMAL_COUNT * 0.45)); i += 1) spawnAnimalEntity(this.entitySpawnContext, this.randomGroundPoint());
    if (this.currentWorldMapId === DEFAULT_WORLD_MAP_ID) this.spawnStarterAnimalHerds();
    for (let i = 0; i < (this.currentWorldMapId === DEFAULT_WORLD_MAP_ID ? JAMMINI_FIELD_COUNT : Math.ceil(JAMMINI_FIELD_COUNT * 0.4)); i += 1) spawnJamminiEntity(this.entitySpawnContext, this.randomGroundPoint());
    for (let i = 0; i < (this.currentWorldMapId === DEFAULT_WORLD_MAP_ID ? 36 : 48); i += 1) {
      const region = this.activeRegions[Math.floor(Math.random() * this.activeRegions.length)];
      const point = this.randomPredatorSpawnPoint(region);
      if (!region || !point) continue;
      const monsterId = chooseRegionPredatorMonster(region);
      const predator = spawnPredatorEntity(this.entitySpawnContext, point, predatorKindForMonster(monsterId));
      applyPredatorMonsterDefinition(predator, region, monsterId);
    }
    this.spawnVillage(new THREE.Vector3(58, 0, -76));
    this.spawnVillage(new THREE.Vector3(-96, 0, 120));
    this.spawnVillage(new THREE.Vector3(245, 0, 138), 16, true);
  }

  private spawnStarterAnimalHerds() {
    const herds: { center: THREE.Vector3; radius: number; animals: AnimalKind[] }[] = [
      { center: new THREE.Vector3(72, 0, 24), radius: 18, animals: ["cow", "cow", "pig", "pig"] },
      { center: new THREE.Vector3(-78, 0, 44), radius: 17, animals: ["horse", "cow", "pig"] },
      { center: new THREE.Vector3(34, 0, 94), radius: 16, animals: ["cow", "pig", "chicken"] },
    ];

    for (const herd of herds) {
      for (const animal of herd.animals) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const point = this.randomPointInCircle(herd.center, herd.radius);
          if (Math.hypot(point.x, point.z - 12) < 52) continue;
          if (this.isNaturalSpawnBlocked(point, 4)) continue;
          let occupied = false;
          for (const object of this.objectsNear(point, 4)) {
      if (object.type !== "animal" && object.type !== "wildPredator" && object.type !== "jammini") {
              occupied = true;
              break;
            }
          }
          if (occupied) continue;
          spawnAnimalEntity(this.entitySpawnContext, point, animal);
          break;
        }
      }
    }
  }

  private spawnInitialLavaDragons() {
    for (const biome of this.activeBiomes) {
      if (biome.kind !== "lava" || Math.random() >= LAVA_DRAGON_SPAWN_CHANCE) continue;
      const point = this.randomPointInCircle(biome.center, biome.radius * 0.64);
      spawnDragonEntity(this.entitySpawnContext, point);
    }
  }

  private spawnBossProgression() {
    const placements: { kind: BossKind; position: THREE.Vector3 }[] = [
      { kind: "fire_dragon", position: new THREE.Vector3(305, 0, -268) },
      { kind: "red_dragon", position: new THREE.Vector3(-310, 0, -245) },
      { kind: "laser_dragon", position: new THREE.Vector3(295, 0, 250) },
      { kind: "dark_dragon", position: new THREE.Vector3(-410, 0, -372) },
      { kind: "immortal", position: new THREE.Vector3(420, 0, -392) },
    ];
    for (const placement of placements) {
      const point = placement.position.clone();
      point.y = this.getGroundHeightAt(point.x, point.z);
      let occupied = false;
      for (const object of this.objectsNear(point, 14)) {
        if (object.type !== "dragon") continue;
        occupied = true;
        break;
      }
      if (!occupied) spawnDragonEntity(this.entitySpawnContext, point, placement.kind);
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement || this.currentPanel !== null) return;
    if (!Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return;
    this.rotateCameraByMouse(
      THREE.MathUtils.clamp(event.movementX, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA),
      THREE.MathUtils.clamp(event.movementY, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA),
    );
  }

  private applyMouseLook() {
    if (document.pointerLockElement !== this.renderer.domElement || this.currentPanel !== null) {
      this.pendingMouseX = 0;
      this.pendingMouseY = 0;
      return;
    }
    if (this.pendingMouseX === 0 && this.pendingMouseY === 0) return;
    const movementX = this.pendingMouseX;
    const movementY = this.pendingMouseY;
    this.pendingMouseX = 0;
    this.pendingMouseY = 0;
    this.rotateCameraByMouse(movementX, movementY);
  }

  private rotateCameraByMouse(movementX: number, movementY: number) {
    this.yaw -= movementX * MOUSE_SENSITIVITY_X;
    this.pitch -= movementY * MOUSE_SENSITIVITY_Y;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.32, 1.32);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.handleMiniGameKeyDown(event)) return;
    if (this.handleLavaMiniGameKeyDown(event)) return;
    if (this.handleSmithingMiniGameKeyDown(event)) return;
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
    if (event.code === "KeyM") this.togglePanel("map");
    if (event.code === "KeyE") this.interact();
    if (event.code === "KeyR" && !event.repeat) this.useClassSkill();
    if (event.code === "KeyX" && !event.repeat && this.possessedEagleId) { this.endEaglePossession(false); this.showMessage("독수리 빙의를 해제했습니다."); }
    if (event.code === "KeyP") this.showMessage("설치는 인벤토리에서 아이템을 아래 드롭존으로 드래그하세요.");
    if (event.code.startsWith("Digit") && !event.repeat) this.selectHotbarByKey(event.code);
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (this.handleMiniGameKeyUp(event)) return;
    if (this.handleLavaMiniGameKeyUp(event)) return;
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
    useHotbarItem(this.hotbar[this.selectedHotbarIndex]?.item, this.hotbarUseContext);
  }

  private isBucketItem(item: ItemId | null | undefined) {
    return item === "bucket" || item === "water_bucket" || item === "lava_bucket";
  }

  private isRangedWeapon(item: ItemId | null | undefined): item is ItemId {
    return !!item && RANGED_WEAPONS.has(item);
  }

  private useDragonSpawnItem() {
    if (this.locationMode !== "overworld") {
      this.showMessage("용 스폰은 야생 필드에서만 사용할 수 있습니다.");
      return;
    }
    const point = this.pointInFront(13);
    if (Math.abs(point.x) > WORLD_SIZE / 2 - 12 || Math.abs(point.z) > WORLD_SIZE / 2 - 12) {
      this.showMessage("월드 가장자리에는 용을 소환할 수 없습니다.");
      return;
    }
    if (this.isNearWater(point, 5)) {
      this.showMessage("물가에는 용을 소환할 수 없습니다. 넓은 땅으로 이동해 주세요.");
      return;
    }
    for (const object of this.objectsNear(point, 7)) {
      if (object.type === "droppedItem" || object.type === "legoHazard" || object.type === "terrainPatch") continue;
      const radius = Math.max(object.collisionRadius ?? 0, object.terrainRadius ?? 0);
      if (radius <= 0) continue;
      if (Math.hypot(point.x - object.root.position.x, point.z - object.root.position.z) < radius + 4.8) {
        this.showMessage("앞쪽 공간이 좁아서 용을 소환할 수 없습니다.");
        return;
      }
    }
    const slot = this.hotbar[this.selectedHotbarIndex];
    if (!slot || slot.item !== "dragon_spawn" || slot.count <= 0) return;
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    const spawnPoint = point.clone();
    spawnPoint.y = this.getGroundHeightAt(spawnPoint.x, spawnPoint.z);
    spawnDragonEntity(this.entitySpawnContext, spawnPoint);
    this.playHandAction();
    this.playTone(120, 0.2, "sawtooth", 0.04);
    this.showMessage("용 스폰 아이템을 사용했습니다. 앞쪽에 용 보스가 소환되었습니다!");
    this.updateBossBar();
    this.renderHud();
  }

  private useSelectedBucketOnLook(target: WorldObject | null = null, forceMessage = false) {
    const item = this.hotbar[this.selectedHotbarIndex]?.item;
    if (!this.isBucketItem(item)) return false;
    const liquid = this.bucketLiquidTarget(target);
    if (!liquid) {
      if (forceMessage) this.showMessage("양동이는 물가나 용암지대 가까이에서 사용할 수 있습니다.");
      return forceMessage;
    }

    if (item === "bucket") {
      if (liquid.kind === "water") {
        if (!this.transformSelectedItem("bucket", "water_bucket")) return true;
        this.playHandAction();
        this.playTone(620, 0.08, "triangle", 0.03);
        this.showMessage("양동이에 물을 담았습니다. 용암지대에서 사용하면 흑요석을 만들 수 있습니다.");
        return true;
      }
      if (!this.transformSelectedItem("bucket", "lava_bucket")) return true;
      this.playHandAction();
      this.playTone(260, 0.1, "sawtooth", 0.025);
      this.showMessage("양동이에 용암을 담았습니다. 물가에서 사용하면 흑요석을 만들 수 있습니다.");
      return true;
    }

    if (item === "water_bucket" && liquid.kind === "lava") {
      return this.createObsidianFromBucket("water_bucket", liquid.point, "물 양동이를 용암지대에 비워 흑요석을 만들었습니다.");
    }

    if (item === "lava_bucket" && liquid.kind === "water") {
      return this.createObsidianFromBucket("lava_bucket", liquid.point, "용암 양동이를 물가에 비워 흑요석을 만들었습니다.");
    }

    this.showMessage(item === "water_bucket" ? "물 양동이는 용암지대에서 사용하면 흑요석을 만듭니다." : "용암 양동이는 물가에서 사용하면 흑요석을 만듭니다.");
    return true;
  }

  private transformSelectedItem(from: ItemId, to: ItemId) {
    const slot = this.hotbar[this.selectedHotbarIndex];
    if (!slot || slot.item !== from || slot.count <= 0) return false;
    if (slot.count === 1) {
      slot.item = to;
      slot.count = 1;
      slot.durabilityUsed = undefined;
      this.renderHud();
      return true;
    }
    slot.count -= 1;
    if (!this.addItem(to, 1)) {
      slot.count += 1;
      this.renderHud();
      return false;
    }
    this.renderHud();
    return true;
  }

  private createObsidianFromBucket(bucketItem: ItemId, point: THREE.Vector3, message: string) {
    if (!this.transformSelectedItem(bucketItem, "bucket")) return true;
    const spawnPoint = point.clone();
    spawnPoint.y = this.getGroundHeightAt(spawnPoint.x, spawnPoint.z);
    this.spawnOre("obsidian", spawnPoint);
    this.playHandAction();
    this.playTone(190, 0.12, "square", 0.028);
    this.showMessage(`${message} 다이아몬드 곡괭이로 채집할 수 있습니다.`);
    this.renderHud();
    return true;
  }

  private bucketLiquidTarget(target: WorldObject | null) {
    const points = [this.pointInFront(3.4), this.pointInFront(5.1), this.playerPosition.clone()];
    if (target?.type === "terrainPatch" && target.terrainKind === "lava") {
      const point = points.find((candidate) => this.isPointInLava(candidate, 2.5)) ?? target.root.position.clone();
      point.y = this.getGroundHeightAt(point.x, point.z);
      return { kind: "lava" as const, point };
    }
    if (target?.type === "water") {
      const point = points.find((candidate) => this.isPointInWater(candidate, 2.5)) ?? target.root.position.clone();
      point.y = this.getGroundHeightAt(point.x, point.z);
      return { kind: "water" as const, point };
    }
    for (const point of points) {
      if (this.isPointInLava(point, 1.8)) return { kind: "lava" as const, point };
      if (this.isPointInWater(point, 1.8)) return { kind: "water" as const, point };
    }
    return null;
  }

  private isPointInWater(point: THREE.Vector3, margin = 0) {
    if (this.locationMode !== "overworld") return false;
    for (const water of this.waterObjects) {
      const radius = water.terrainRadius ?? 0;
      if (radius > 0 && Math.hypot(point.x - water.root.position.x, point.z - water.root.position.z) <= radius + margin) return true;
    }
    return false;
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
    this.syncEquippedShield(item);

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
    this.syncEquippedShield(item);
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
    if (item === "building_block") return this.placeBuildingBlockFromSlot(slot);
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    this.syncEquippedArmor(item);
    this.syncEquippedShield(item);
    this.spawnPlaceableItem(item);
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private placeItemFromInventory(item: ItemId) {
    if (!PLACEABLE_TYPES[item]) return false;
    if (item === "building_block") return this.placeBuildingBlockFromInventory();
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
    if (item === "crafting_table") spawnWorkbenchObject(this.spawnContext, position, false);
    if (item === "extended_workbench") spawnWorkbenchObject(this.spawnContext, position, true);
    if (item === "smelter") spawnSmelterObject(this.spawnContext, position, false);
    if (item === "special_smelter") spawnSmelterObject(this.spawnContext, position, true);
    if (item === "grinder") spawnGrinderObject(this.spawnContext, position);
    if (item === "bed") spawnBedObject(this.spawnContext, position, this.yaw);
    if (item === "building_block") spawnBuildingBlockObject(this.spawnContext, position);
    this.playHandAction();
    this.showMessage(`${ITEM_NAMES[item] ?? item}를 설치했습니다. 좌클릭/E로 회수하고 우클릭으로 사용합니다.`);
    this.playTone(420, 0.09, "triangle", 0.035);
  }

  private placeSelectedBuildingBlock() {
    const slot = this.hotbar[this.selectedHotbarIndex];
    if (slot?.item !== "building_block") return false;
    this.placeBuildingBlockFromSlot(slot);
    return true;
  }

  private placeBuildingBlockFromSlot(slot: Slot | null | undefined) {
    if (!slot || slot.item !== "building_block" || slot.count <= 0) return false;
    const placement = this.buildingBlockPlacement();
    if (!placement) return false;
    slot.count -= 1;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
      slot.durabilityUsed = undefined;
    }
    spawnBuildingBlockObject(this.spawnContext, placement);
    this.playHandAction();
    this.playTone(360, 0.07, "triangle", 0.028);
    this.playTone(180, 0.045, "square", 0.016);
    this.showMessage("쌓기블록을 설치했습니다. 옆면이나 윗면을 보고 우클릭하면 이어 붙일 수 있습니다.");
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private placeBuildingBlockFromInventory() {
    const placement = this.buildingBlockPlacement();
    if (!placement) return false;
    if (!this.removeItem("building_block", 1)) {
      this.showMessage("설치할 쌓기블록을 찾지 못했습니다.");
      return false;
    }
    spawnBuildingBlockObject(this.spawnContext, placement);
    this.playHandAction();
    this.playTone(360, 0.07, "triangle", 0.028);
    this.showMessage("쌓기블록을 설치했습니다.");
    this.renderPanel();
    this.renderHud();
    return true;
  }

  private buildingBlockPlacement() {
    if (this.locationMode !== "overworld") {
      this.showMessage("쌓기블록은 현재 야생 필드에서만 설치할 수 있습니다.");
      return null;
    }

    const hit = this.buildingBlockPlacementHit();
    const placement = hit ? this.attachedBuildingBlockPosition(hit.target, hit.normal) : this.groundBuildingBlockPosition();
    if (!placement || !this.canPlaceBuildingBlockAt(placement, Boolean(hit))) return null;
    return placement;
  }

  private buildingBlockPlacementHit() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.nearbyRaycastTargets(), true);
    for (const hit of hits) {
      if (hit.distance > BUILDING_BLOCK_REACH) continue;
      const objectId = this.findObjectId(hit.object);
      if (!objectId) continue;
      const target = this.objects.get(objectId);
      if (target?.type !== "buildingBlock" || !hit.face) continue;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      return { target, normal };
    }
    return null;
  }

  private attachedBuildingBlockPosition(target: WorldObject, normal: THREE.Vector3) {
    const position = target.root.position.clone();
    const axis = Math.abs(normal.y) > Math.abs(normal.x) && Math.abs(normal.y) > Math.abs(normal.z) ? "y" : Math.abs(normal.x) >= Math.abs(normal.z) ? "x" : "z";
    if (axis === "y") {
      if (normal.y < 0) {
        this.showMessage("쌓기블록은 아래쪽으로는 붙이지 않습니다. 옆면이나 윗면을 바라봐 주세요.");
        return null;
      }
      position.y += BUILDING_BLOCK_SIZE;
      return position;
    }
    if (axis === "x") position.x += Math.sign(normal.x || 1) * BUILDING_BLOCK_SIZE;
    else position.z += Math.sign(normal.z || 1) * BUILDING_BLOCK_SIZE;
    return position;
  }

  private groundBuildingBlockPosition() {
    const position = this.pointInFront(3.25);
    position.x = Math.round(position.x / BUILDING_BLOCK_SIZE) * BUILDING_BLOCK_SIZE;
    position.z = Math.round(position.z / BUILDING_BLOCK_SIZE) * BUILDING_BLOCK_SIZE;
    position.y = this.getOverworldHeightAt(position.x, position.z);
    return position;
  }

  private canPlaceBuildingBlockAt(position: THREE.Vector3, attached: boolean) {
    const groundY = this.getOverworldHeightAt(position.x, position.z);
    if (Math.abs(position.x) > WORLD_SIZE / 2 - 2 || Math.abs(position.z) > WORLD_SIZE / 2 - 2) {
      this.showMessage("월드 가장자리에는 쌓기블록을 놓을 수 없습니다.");
      return false;
    }
    if (position.y < groundY - 0.05) {
      this.showMessage("땅 아래에는 쌓기블록을 놓을 수 없습니다.");
      return false;
    }
    if (!attached && (this.isPointInWater(position, 0.5) || this.isPointInLava(position, 0.5))) {
      this.showMessage("물이나 용암 위에는 첫 쌓기블록을 바로 놓을 수 없습니다. 옆에서 이어 붙여 다리를 만들 수는 있습니다.");
      return false;
    }
    const blockTop = position.y + BUILDING_BLOCK_SIZE;
    const playerFeet = this.playerPosition.y - this.currentPlayerHeight();
    const playerTop = this.playerPosition.y;
    if (
      Math.abs(position.x - this.playerPosition.x) < BUILDING_BLOCK_SIZE * 0.78 &&
      Math.abs(position.z - this.playerPosition.z) < BUILDING_BLOCK_SIZE * 0.78 &&
      blockTop > playerFeet + 0.08 &&
      position.y < playerTop - 0.08
    ) {
      this.showMessage("내 몸과 겹치는 위치에는 쌓기블록을 놓을 수 없습니다.");
      return false;
    }

    for (const object of this.objectsNear(position, 2.4)) {
      if (object.type === "droppedItem" || object.type === "legoHazard" || object.type === "terrainPatch" || object.type === "dirtPatch" || object.type === "water") continue;
      const objectBottom = object.root.position.y;
      const objectTop = objectBottom + (object.collisionHeight ?? 0);
      const verticalOverlap = blockTop > objectBottom + 0.08 && position.y < objectTop - 0.08;
      if (!verticalOverlap) continue;
      if (object.type === "buildingBlock") {
        if (Math.abs(position.x - object.root.position.x) < 0.5 && Math.abs(position.z - object.root.position.z) < 0.5) {
          this.showMessage("이미 그 칸에는 쌓기블록이 있습니다.");
          return false;
        }
        continue;
      }
      const radius = object.collisionRadius ?? object.terrainRadius ?? 0;
      if (radius <= 0) continue;
      if (Math.hypot(position.x - object.root.position.x, position.z - object.root.position.z) < radius + 0.62) {
        this.showMessage("다른 오브젝트와 겹쳐서 쌓기블록을 놓을 수 없습니다.");
        return false;
      }
    }
    return true;
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

  private useLookedShop() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "villageShop" ? exactTarget : this.nearbyObjectInView(["villageShop"]);
    if (target?.type !== "villageShop") return false;
    this.openPointShop(target);
    this.playHandAction();
    return true;
  }

  private openPointShop(target: WorldObject) {
    this.currentStationId = target.id;
    this.openPanel("shop");
  }

  private useLookedSellShop() {
    const exactTarget = this.getLookTarget();
    const target = exactTarget?.type === "villageSellShop" ? exactTarget : this.nearbyObjectInView(["villageSellShop"]);
    if (target?.type !== "villageSellShop") return false;
    this.openSellShop(target);
    this.playHandAction();
    return true;
  }

  private openSellShop(target: WorldObject) {
    this.currentStationId = target.id;
    this.openPanel("sellShop");
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
    this.renderer.setPixelRatio(this.pixelRatioForQuality());
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const rawDelta = this.clock.getDelta();
    this.lastRawFrameDelta = rawDelta;
    const delta = Math.min(rawDelta, 0.05);
    this.update(delta);
    const preferFastRender = this.gameStarted && this.isSprinting();
    this.setSprintRenderOptimizations(preferFastRender);
    this.renderer.render(this.scene, this.camera);
  };

  private setSprintRenderOptimizations(active: boolean) {
    if (this.sprintRenderOptimized === active) return;
    this.sprintRenderOptimized = active;
    this.shadowRefreshTimer = 0;
    if (active) this.renderer.shadowMap.needsUpdate = false;
  }

  private update(delta: number) {
    if (!this.gameStarted) {
      this.updateMiniGame(delta);
      this.updateLavaMiniGame(delta);
      this.updateSmithingMiniGame(delta);
      this.updateTimeOfDay(delta);
      this.updateAudio(delta);
      this.updateVisualEffects(delta);
      this.updateTitleCamera();
      this.updateTrains(delta);
      this.updateAnimals(delta);
      this.updateVillagers(delta);
      return;
    }
    this.applyMouseLook();
    this.updateAdaptiveQuality(delta);
    this.updateTimeOfDay(delta);
    this.updateAudio(delta);
    this.updateVisualEffects(delta);
    this.updateTrains(delta);
    this.updateAnimals(delta);
    this.updateVillagers(delta);
    this.updateAnts(delta);
    this.updatePredators(delta);
    updateGraveTrap(this.graveTrapContext, delta);
    updateFinale(this.finaleContext);
    this.updateDragons(delta);
    this.updateJamminis(delta);
    this.updateLegoHazards(delta);
    this.updateNightSpawns(delta); this.expirySweepTimer += delta; if (this.expirySweepTimer >= 1) { const now = performance.now(); this.expirySweepTimer = 0; for (const object of [...this.objects.values()]) if (object.expiresAt !== undefined && object.expiresAt <= now && (object.type === "chest" || object.type === "mineChest" || object.type === "cave")) this.removeObject(object.id); }
    this.updateMovement(delta);
    if (this.locationMode === "overworld") this.regionWarningState = maybeWarnRegionLevel(this.regionWarningState, this.playerPosition, this.level, performance.now(), (message) => this.showMessage(message), this.activeRegions);
    this.updateVisibilityCulling(delta);
    this.summonerCompanion.update(this.summonerPetContext, delta);
    this.updateEnvironmentHazards(delta);
    this.updateKnights(delta);
    this.updateHand(delta);
    this.updateMirrorView(delta);
    this.updateHunger(delta);
    this.updateMana(delta);
    this.updateProjectiles(delta);
    this.updateAreaSkillEffects(delta);
    this.updateDamageParticles(delta);
    this.updateMessages(delta);
    this.updatePrompt(delta);
    this.updateBossBar();
  }

  private updateTitleCamera() {
    this.handGroup.visible = false;
    const t = this.clock.elapsedTime * 0.08;
    const focus = new THREE.Vector3(58, 2.8, -76);
    const cameraX = focus.x + Math.cos(t) * 42;
    const cameraZ = focus.z + Math.sin(t) * 30 + 18;
    const cameraY = 7.6 + Math.sin(t * 0.7) * 0.8;
    this.camera.position.set(cameraX, cameraY, cameraZ);
    this.camera.lookAt(focus);
  }

  private updateAdaptiveQuality(delta: number) {
    if (!this.gameStarted || this.currentPanel !== null) return;
    const measuredDelta = Math.min(this.lastRawFrameDelta || delta, 0.25);
    if (this.performanceWarmupTimer < 3) {
      this.performanceWarmupTimer += measuredDelta;
      this.performanceSampleTimer = 0;
      this.performanceSampleFrames = 0;
      this.performanceSampleSum = 0;
      this.performanceSlowFrames = 0;
      this.performanceHitchFrames = 0;
      return;
    }
    this.performanceSampleTimer += measuredDelta;
    this.performanceSampleFrames += 1;
    this.performanceSampleSum += measuredDelta;
    if (measuredDelta > 0.0334) this.performanceSlowFrames += 1;
    if (measuredDelta > 0.05) this.performanceHitchFrames += 1;
    if (this.performanceSampleTimer < 2.5) return;
    const averageFrame = this.performanceSampleSum / Math.max(1, this.performanceSampleFrames);
    const slowRatio = this.performanceSlowFrames / Math.max(1, this.performanceSampleFrames);
    if (this.qualityMode === "high" && (averageFrame > 0.034 || slowRatio > 0.1 || this.performanceHitchFrames > 2)) {
      this.applyQualityMode("balanced");
    } else if (this.qualityMode === "balanced" && (averageFrame > 0.045 || slowRatio > 0.18 || this.performanceHitchFrames > 4)) {
      this.applyQualityMode("performance");
    }
    this.performanceSampleTimer = 0;
    this.performanceSampleFrames = 0;
    this.performanceSampleSum = 0;
    this.performanceSlowFrames = 0;
    this.performanceHitchFrames = 0;
  }

  private applyQualityMode(mode: QualityMode) {
    if (this.qualityMode === mode) return;
    this.qualityMode = mode;
    this.shadowRefreshInterval = mode === "high" ? 0.4 : mode === "balanced" ? 0.65 : 1.1;
    this.renderer.setPixelRatio(this.pixelRatioForQuality(mode));
    applyShadowQuality(this.sunLight, mode);
    refreshTrackedVisualVisibility(this.outlineVisuals, this.qualityMode, false);
    this.renderer.shadowMap.needsUpdate = true;
  }

  private updateVisualEffects(delta: number) {
    const time = this.clock.elapsedTime;
    this.shadowRefreshTimer += delta;
    if (this.isSprinting()) this.shadowRefreshTimer = 0;
    if (!this.isSprinting() && this.shadowRefreshTimer >= this.shadowRefreshInterval) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowRefreshTimer = 0;
    }
    for (let index = 0; index < this.waterRippleMeshes.length; index += 1) {
      const ripple = this.waterRippleMeshes[index];
      ripple.rotation.z += delta * 0.08;
      const pulse = 0.96 + Math.sin(time * 0.9 + index * 0.13) * 0.018;
      ripple.scale.set(pulse, pulse, pulse);
    }
    for (const surface of this.waterSurfaceMeshes) {
      const root = surface.parent;
      surface.position.y = 0.11 + Math.sin(time * 1.1 + (root?.position.x ?? 0) * 0.03) * 0.018;
      if (surface.material instanceof THREE.ShaderMaterial) {
        surface.material.uniforms.time.value += delta;
        surface.material.uniforms.sunDirection.value.copy(this.sunPosition).normalize();
      }
    }
  }

  private updateVisibilityCulling(delta: number) {
    if (this.locationMode !== "overworld") return;
    this.visibilityCullTimer += delta;
    const interval = this.isSprinting() ? SPRINT_VISIBILITY_CULL_INTERVAL : VISIBILITY_CULL_INTERVAL;
    if (this.visibilityCullTimer < interval) return;
    this.visibilityCullTimer = 0;

    const playerX = this.playerPosition.x;
    const playerZ = this.playerPosition.z;
    const objects = Array.from(this.objects.values());
    if (objects.length === 0) {
      this.visibilityCullCursor = 0;
      return;
    }
    if (this.visibilityCullCursor >= objects.length) this.visibilityCullCursor = 0;
    const maxChanges = this.isSprinting() ? SPRINT_VISIBILITY_CHANGES_PER_PASS : VISIBILITY_CHANGES_PER_PASS;
    let scanned = 0;
    let changes = 0;
    while (scanned < objects.length && changes < maxChanges) {
      const object = objects[(this.visibilityCullCursor + scanned) % objects.length];
      scanned += 1;
      const distance = this.visibilityDistanceForType(object.type);
      if (distance === Infinity) {
        if (!object.root.visible) {
          object.root.visible = true;
          changes += 1;
        }
        continue;
      }
      const dx = object.root.position.x - playerX;
      const dz = object.root.position.z - playerZ;
      const visible = dx * dx + dz * dz <= distance * distance;
      if (object.root.visible !== visible) {
        object.root.visible = visible;
        changes += 1;
      }
    }
    this.visibilityCullCursor = (this.visibilityCullCursor + scanned) % objects.length;
    if (changes >= maxChanges && scanned < objects.length) this.visibilityCullTimer = interval;
    const fogFar = this.scene.fog instanceof THREE.Fog ? this.scene.fog.far : 480;
    updateDistanceCulledVisuals(this.biomeMeshes, this.playerPosition, fogFar);
    updateDistanceCulledVisuals(this.mountainMeshes, this.playerPosition, fogFar);
  }

  private visibilityDistanceForType(type: ObjectType) {
    switch (type) {
      case "smallTree":
      case "bigTree":
      case "terrainPatch":
      case "dirtPatch":
        return 235;
      case "animal":
      case "wildPredator":
      case "jammini":
      case "legoHazard":
      case "droppedItem":
      case "ore":
      case "chest":
      case "mineChest":
      case "antHill":
        return 175;
      case "villageFence":
      case "villageHouse":
      case "foodStorage":
      case "blacksmith":
      case "villageShop":
      case "villageSellShop":
      case "villager":
      case "blacksmithNpc":
      case "villageKnight":
      case "villageArcher":
      case "villageMage":
      case "villageKing":
      case "villageGolem":
        return 275;
      case "water":
      case "cave":
      case "workbench":
      case "extendedWorkbench":
      case "smelter":
      case "specialSmelter":
      case "grinder":
      case "bed":
      case "buildingBlock":
        return 240;
      case "mountain":
      case "train":
      case "dragon":
      case "eagleSummon":
      case "summonerPet":
        return 420;
      case "caveExit":
      case "houseExit":
      case "miner":
        return Infinity;
      default:
        return 260;
    }
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
      if (this.damagePlayer(1, false, "굶주림으로 체력이 모두 떨어졌습니다.", true)) {
        this.starvationNoticeTimer = 0;
        return;
      }
    }
    if (this.starvationNoticeTimer >= 5) {
      this.starvationNoticeTimer = 0;
      this.showMessage("너무 배고파서 체력이 줄고 있습니다. 고기를 먹어야 합니다.");
    }
  }

  private isPointInLava(point: THREE.Vector3, margin = 0) {
    if (this.locationMode !== "overworld") return false;
    for (const object of this.objectsNear(point, 10 + margin)) {
      if (object.terrainKind !== "lava") continue;
      const radius = object.terrainRadius ?? 0;
      if (radius <= 0) continue;
      if (Math.hypot(point.x - object.root.position.x, point.z - object.root.position.z) <= radius * 0.92 + margin) return true;
    }
    return this.priorityBiomeAt(point, margin)?.kind === "lava";
  }

  private updateMana(delta: number) {
    const hungerLevel = Math.min(HUNGER_HP_REGEN.length - 1, Math.max(0, Math.floor(this.hunger)));
    const healthRegen = CLASS_PASSIVES[this.playerClass].healthRegenPerSec + HUNGER_HP_REGEN[hungerLevel];
    if (healthRegen > 0 && this.health < this.maxHealth) {
      const previousHealth = Math.floor(this.health);
      this.health = Math.min(this.maxHealth, this.health + healthRegen * delta);
      if (Math.floor(this.health) !== previousHealth) this.renderHud();
    }
    if (this.mana >= this.maxMana) return;
    const previous = Math.floor(this.mana);
    const manaRegenScale = CLASS_PASSIVES[this.playerClass].manaRegenScale;
    this.mana = Math.min(this.maxMana, this.mana + MANA_REGEN_PER_SECOND * manaRegenScale * delta);
    if (Math.floor(this.mana) !== previous) this.renderHud();
  }

  private classSkillCooldownRemaining() {
    return Math.max(0, (this.classSkillCooldownUntil - performance.now()) / 1000);
  }

  private trySpendClassSkill(cost: number, cooldownSeconds: number) {
    if (this.currentPanel !== null) return false;
    const remaining = this.classSkillCooldownRemaining();
    if (remaining > 0) {
      this.showMessage(`${PLAYER_CLASSES[this.playerClass].skillName} 쿨타임 ${Math.ceil(remaining)}초 남았습니다.`);
      return false;
    }
    if (this.mana < cost) {
      this.showMessage(`마나가 부족합니다. 필요 ${cost}, 현재 ${Math.floor(this.mana)}.`);
      return false;
    }
    this.mana = Math.max(0, this.mana - cost);
    this.classSkillCooldownUntil = performance.now() + cooldownSeconds * 1000;
    this.renderHud();
    return true;
  }

  // 데이터주도 스킬 디스패치 — Record<PlayerClassId> 라 새 직업을 추가하면
  // 여기에 핸들러를 안 넣는 한 컴파일 에러가 난다(누락 방지). (AGENTS.md §1, 거버넌스 P2)
  private readonly classSkillHandlers: Record<PlayerClassId, () => void> = {
    warrior: () => this.useWarriorSkill(),
    healer: () => this.useHealerSkill(),
    mage: () => this.useMageSkill(),
    summoner: () => this.useSummonerSkill(),
    gunner: () => this.useGunnerSkill(),
    tanker: () => this.useTankerSkill(),
  };

  private useClassSkill() {
    if (!this.gameStarted || this.currentPanel !== null) return;
    if (this.possessedEagleId) { tryEagleClaw(this.eagleActionContext); return; }
    this.classSkillHandlers[this.playerClass]?.();
  }

  private useHealerSkill() {
    if (this.health >= this.maxHealth) {
      this.showMessage("이미 체력이 가득합니다.");
      return;
    }
    if (!this.trySpendClassSkill(HEALER_SKILL_COST, HEALER_SKILL_COOLDOWN)) return;
    const previous = this.health;
    this.health = Math.min(this.maxHealth, this.health + HEALER_HEAL_AMOUNT);
    this.spawnHealEffect(this.playerPosition);
    this.playHandAction("magic");
    this.playTone(720, 0.14, "triangle", 0.03);
    this.playTone(960, 0.18, "sine", 0.018);
    this.showMessage(`천상치유! 체력 ${Math.ceil(this.health - previous)} 회복.`);
    this.renderHud();
  }

  private useSummonerSkill() {
    if (this.possessedEagleId) {
      this.showMessage("이미 독수리에 빙의 중입니다.");
      return;
    }
    if (!this.trySpendClassSkill(SUMMONER_SKILL_COST, SUMMONER_SKILL_COOLDOWN)) return;
    this.playerBodyPosition = this.playerPosition.clone();
    const spawnPosition = this.playerPosition.clone();
    spawnPosition.y = this.getGroundHeightAt(spawnPosition.x, spawnPosition.z) + 1.6;
    const eagle = this.spawnEagleSummon(spawnPosition);
    this.possessedEagleId = eagle.id; this.eaglePossessionEndsAt = performance.now() + EAGLE_POSSESSION_DURATION_SECONDS * 1000;
    this.eagleClawCooldownUntil = 0; this.windCutterCooldownUntil = 0;
    this.playerPosition.y = this.getGroundHeightAt(this.playerPosition.x, this.playerPosition.z) + PLAYER_HEIGHT + 0.55;
    this.camera.position.copy(this.playerPosition);
    this.syncPossessedEagle();
    this.playHandAction("magic");
    this.playTone(860, 0.18, "triangle", 0.032);
    this.showMessage("\uBE59\uC758 \uC870\uC791: \uC88C\uD074\uB9AD/E \uBC15\uCE58\uAE30, R \uD560\uD034\uAE30, \uC6B0\uD074\uB9AD \uC708\uB4DC\uCEE4\uD130, X \uBE59\uC758 \uD574\uC81C.");
    this.showMessage("독수리소환술! 독수리에 빙의했습니다. 독수리가 쓰러지면 본체로 돌아갑니다.");
    this.renderHud();
  }

  private useWarriorSkill() {
    if (!this.trySpendClassSkill(WARRIOR_SKILL_COST, WARRIOR_SKILL_COOLDOWN)) return;
    const target = this.getLookTarget();
    const position = target && this.isCombatTarget(target) ? target.root.position.clone() : this.pointInFront(4.5);
    position.y = this.getGroundHeightAt(position.x, position.z) + 0.08;
    this.spawnWarriorExplosion(position);
    this.playHandAction("melee");
    spawnMeleeSlashTrail(this.combatEffectContext);
    this.playMeleeWhoosh();
    this.showMessage(`무거운공격! ${WARRIOR_EXPLOSION_SECONDS}초 동안 폭발 지대가 생성됩니다.`);
  }

  private useMageSkill() {
    if (!this.trySpendClassSkill(MAGE_TNT_COST, MAGE_TNT_COOLDOWN)) return;
    this.fireTntSkill();
    this.showMessage("TNT발사!");
  }

  private useGunnerSkill() {
    if (!this.trySpendClassSkill(GUNNER_SKILL_COST, GUNNER_SKILL_COOLDOWN)) return;
    this.fireStrongShot();
    this.showMessage(`강탄! ${GUNNER_SKILL_DAMAGE} 피해의 강한 탄환을 발사했습니다.`);
  }

  private useTankerSkill() {
    if (!this.trySpendClassSkill(TANKER_SKILL_COST, TANKER_SKILL_COOLDOWN)) return;
    this.ironGuardUntil = activateIronGuardUntil(performance.now());
    this.playHandAction("melee"); this.playTone(220, 0.16, "triangle", 0.03); this.showMessage(ironGuardMessage()); this.renderHud();
  }

  private fireStrongShot() {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    const origin = this.camera.position.clone().addScaledVector(direction, 0.86).addScaledVector(right, 0.2).addScaledVector(up, -0.16);
    const projectile: CombatProjectile = {
      kind: "arrow",
      mesh: createArrowProjectile(direction),
      velocity: direction.multiplyScalar(58),
      damage: GUNNER_SKILL_DAMAGE,
      radius: 0.22,
      life: PROJECTILE_MAX_LIFE,
    };
    projectile.mesh.position.copy(origin);
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    this.playHandAction("bow");
    this.playBowShotSound();
  }

  private spawnHealEffect(position: THREE.Vector3) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.035, 10, 42),
      new THREE.MeshBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(position).setY(position.y - PLAYER_HEIGHT + 0.08);
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 24;
    this.scene.add(ring);
    this.damageParticles.push({ mesh: ring, velocity: new THREE.Vector3(0, 0.18, 0), life: 0.55, maxLife: 0.55 });
    for (let index = 0; index < 20; index += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(THREE.MathUtils.randFloat(0.035, 0.075), 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      particle.position.copy(position).add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.7), THREE.MathUtils.randFloat(-1.1, 0.35), THREE.MathUtils.randFloatSpread(0.7)));
      particle.renderOrder = 24;
      this.scene.add(particle);
      this.damageParticles.push({ mesh: particle, velocity: new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.25), THREE.MathUtils.randFloat(0.65, 1.35), THREE.MathUtils.randFloatSpread(0.25)), life: 0.62, maxLife: 0.62 });
    }
  }

  private updateMovement(delta: number) {
    if (this.currentPanel !== null) return;
    this.movementHudTimer += delta;
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
    const wasGrounded = this.isGrounded;
    const playerHeight = this.currentPlayerHeight();
    const movingHorizontally = direction.lengthSq() > 0;
    if (wasGrounded) {
      this.fallPeakFeetY = this.playerPosition.y - playerHeight;
      this.fallDamageArmed = false;
    }
    let sprinting = false;
    if (movingHorizontally) {
      direction.normalize();
      sprinting = this.isSprinting();
      let speed = WALK_SPEED * (sprinting ? RUN_MULTIPLIER : 1);
      if (this.keys.has("KeyC")) speed *= 0.38;
      else if (this.isShiftDown() && !sprinting) speed *= 0.62;
      const horizontalDistance = speed * delta;
      const movementSteps = Math.max(1, Math.ceil(horizontalDistance / MOVEMENT_COLLISION_STEP));
      const stepDistance = horizontalDistance / movementSteps;
      for (let step = 0; step < movementSteps; step += 1) {
        nextPosition.addScaledVector(direction, stepDistance);
        this.clampPlayerHorizontalPosition(nextPosition);
        this.resolveCollisions(nextPosition, playerHeight);
      }
    }
    if (!movingHorizontally) {
      this.clampPlayerHorizontalPosition(nextPosition);
      this.resolveCollisions(nextPosition, playerHeight);
    }

    this.verticalVelocity -= GRAVITY * delta;
    nextPosition.y += this.verticalVelocity * delta;
    const groundHeight = this.getGroundHeightAt(nextPosition.x, nextPosition.z, { forPlayer: true });
    const groundedY = groundHeight + playerHeight;
    let landedThisFrame = false;
    let landedFallDistance = 0;
    if (nextPosition.y <= groundedY) {
      landedThisFrame = !wasGrounded || this.fallDamageArmed;
      landedFallDistance = landedThisFrame ? Math.max(0, this.fallPeakFeetY - groundHeight) : 0;
      nextPosition.y = groundedY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.fallPeakFeetY = groundHeight;
      this.fallDamageArmed = false;
    } else {
      this.isGrounded = false;
      this.fallPeakFeetY = Math.max(this.fallPeakFeetY, nextPosition.y - playerHeight);
      this.fallDamageArmed = true;
    }

    this.playerPosition.copy(nextPosition);
    this.camera.position.copy(this.playerPosition);
    this.syncPossessedEagle();

    const horizontalMoved = Math.hypot(this.playerPosition.x - this.previousPosition.x, this.playerPosition.z - this.previousPosition.z);
    if (landedThisFrame) {
      this.playLandingSound();
      if (this.applyFallDamage(landedFallDistance)) return;
    }
    if (horizontalMoved > 0.01 && this.isGrounded && movingHorizontally) this.updateFootsteps(horizontalMoved, sprinting);

    const moved = this.playerPosition.distanceTo(this.previousPosition);
    if (moved > 0) {
      const previousStepCount = Math.floor(this.totalSteps);
      this.totalSteps += moved;
      if (this.locationMode === "overworld") this.checkStepEvents(moved);
      this.previousPosition.copy(this.playerPosition);
      const currentStepCount = Math.floor(this.totalSteps);
      if (
        currentStepCount !== previousStepCount ||
        currentStepCount !== this.lastHudStepCount ||
        this.movementHudTimer >= MOVEMENT_HUD_MIN_INTERVAL
      ) {
        this.lastHudStepCount = currentStepCount;
        this.movementHudTimer = 0;
        this.renderHud();
      }
    }
  }

  private clampPlayerHorizontalPosition(position: THREE.Vector3) {
    if (this.locationMode === "overworld") {
      position.x = THREE.MathUtils.clamp(position.x, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
      position.z = THREE.MathUtils.clamp(position.z, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
    }
    if (this.locationMode === "cave") {
      position.x = THREE.MathUtils.clamp(position.x, -CAVE_WIDTH / 2 + 1.1, CAVE_WIDTH / 2 - 1.1);
      position.z = THREE.MathUtils.clamp(position.z, CAVE_END_Z + 3.5, CAVE_START_Z + 3.5);
    }
    if (this.locationMode === "house") {
      position.x = THREE.MathUtils.clamp(position.x, -5.2, 5.2);
      position.z = THREE.MathUtils.clamp(position.z, HOUSE_CENTER_Z - 5.4, HOUSE_CENTER_Z + 5.4);
    }
  }

  private updateEnvironmentHazards(delta: number) {
    if (this.locationMode !== "overworld" || !this.isPointInLava(this.playerPosition)) {
      this.dragonSpawnTimer = 0;
      return;
    }
    this.checkLavaDragonSpawn(delta);
  }

  private checkLavaDragonSpawn(delta: number) {
    for (const dragon of this.objectsOfType("dragon")) {
      if ((dragon.bossKind ?? "dragon") === "dragon") return;
    }
    this.dragonSpawnTimer += delta;
    if (this.dragonSpawnTimer < LAVA_DRAGON_CHECK_SECONDS) return;
    this.dragonSpawnTimer = 0;
    if (Math.random() >= LAVA_DRAGON_SPAWN_CHANCE) return;
    const lavaBiome = this.priorityBiomeAt(this.playerPosition, 2);
    if (lavaBiome?.kind !== "lava") return;
    const point = this.randomPointInCircle(lavaBiome.center, lavaBiome.radius * 0.62);
    point.y = this.getGroundHeightAt(point.x, point.z);
    spawnDragonEntity(this.entitySpawnContext, point);
    this.showMessage("용암 위의 하늘이 갈라지며 용이 나타났습니다!");
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
      if (Math.random() < 0.2 * (getWorldMapById(this.currentWorldMapId).caveScale ?? 1)) {
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

  private resolveCollisions(position: THREE.Vector3, playerHeight = this.currentPlayerHeight()) {
    for (let pass = 0; pass < 3; pass += 1) {
      let changed = false;
      for (const object of this.objectsNear(position, 7)) {
        if (!object.collidable) continue;
        if (object.collisionSegments?.length) {
          if (this.resolveSegmentCollisions(position, object, playerHeight)) changed = true;
          continue;
        }
        const radius = object.collisionRadius ?? 1;
        const combined = radius + PLAYER_RADIUS;
        const dx = position.x - object.root.position.x;
        const dz = position.z - object.root.position.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq <= 0.0001 || distanceSq >= combined * combined) continue;

        const obstacleTop = object.root.position.y + (object.collisionHeight ?? 1);
        const feetY = position.y - playerHeight;
        if (object.type === "buildingBlock" && feetY >= obstacleTop - 0.08) continue;
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

  private resolveSegmentCollisions(position: THREE.Vector3, object: WorldObject, playerHeight = this.currentPlayerHeight()) {
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
      const feetY = position.y - playerHeight;
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

  private getGroundHeightAt(x: number, z: number, options: { forPlayer?: boolean } = {}) {
    let height = 0;
    if (this.locationMode === "cave") height = 0;
    else if (this.locationMode === "house") height = this.getHouseGroundHeightAt(x, z, options.forPlayer ?? false);
    else height = this.getOverworldHeightAt(x, z);
    if (options.forPlayer) height = Math.max(height, this.getBuildingBlockSupportHeightAt(x, z, height));
    return height;
  }

  private getBuildingBlockSupportHeightAt(x: number, z: number, baseHeight: number) {
    if (this.locationMode !== "overworld") return baseHeight;
    const currentFeetY = this.playerPosition.y - this.currentPlayerHeight();
    let supportHeight = baseHeight;
    for (const block of this.objectsNear(new THREE.Vector3(x, currentFeetY, z), BUILDING_BLOCK_SIZE * 1.6)) {
      if (block.type !== "buildingBlock") continue;
      if (Math.abs(x - block.root.position.x) > BUILDING_BLOCK_SIZE * 0.5) continue;
      if (Math.abs(z - block.root.position.z) > BUILDING_BLOCK_SIZE * 0.5) continue;
      const top = block.root.position.y + BUILDING_BLOCK_SIZE;
      if (currentFeetY < top - 0.45) continue;
      supportHeight = Math.max(supportHeight, top);
    }
    return supportHeight;
  }

  private getHouseGroundHeightAt(x: number, z: number, forPlayer = false) {
    if (this.currentHouseKind !== "twoStory") return 0;
    const localZ = z - HOUSE_CENTER_Z;
    const stairHeight = this.getTwoStoryStairHeightAt(x, localZ);
    if (stairHeight !== null) return stairHeight;
    if (localZ >= -1.7 || Math.abs(x) >= 5.15) return 0;
    if (!forPlayer) return 2.55;

    const currentFeetY = this.playerPosition.y - this.currentPlayerHeight();
    const isAlreadyOnUpperFloor = currentFeetY > 2.15;
    const isComingFromStairs = this.isTwoStoryStairZone(this.playerPosition.x, this.playerPosition.z);
    return isAlreadyOnUpperFloor || isComingFromStairs ? 2.55 : 0;
  }

  private getTwoStoryStairHeightAt(x: number, localZ: number) {
    if (x <= -4.75 || x >= -2.05 || localZ > 2.65 || localZ < -1.85) return null;
    const t = THREE.MathUtils.clamp((2.65 - localZ) / 4.5, 0, 1);
    return 2.55 * t;
  }

  private isTwoStoryStairZone(x: number, z: number) {
    if (this.currentHouseKind !== "twoStory") return false;
    return this.getTwoStoryStairHeightAt(x, z - HOUSE_CENTER_Z) !== null;
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
    for (const train of this.objectsOfType("train")) {
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
      this.refreshSpatialObject(train);
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
    const point = new THREE.Vector3(x, 0, z);
    for (const object of this.objectsNear(point, 14)) {
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
      object.type === "buildingBlock" ||
      object.type === "chest" ||
      object.type === "mineChest" ||
      object.type === "cave"
    );
  }

  private followTrain(train: WorldObject) {
    const rideOffset = new THREE.Vector3(0, PLAYER_HEIGHT + 0.55, -0.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), train.root.rotation.y);
    this.playerPosition.copy(train.root.position).add(rideOffset);
    this.settlePlayerAfterTeleport();
  }

  private updateAnimals(delta: number) {
    if (this.locationMode !== "overworld") return;
    const now = performance.now();
    for (const animal of this.objectsOfType("animal")) {
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
      this.refreshSpatialObject(animal);
      animal.root.rotation.y = -angle + Math.PI / 2;
      this.animateWalkCycle(animal, delta, speed);
    }
  }

  private updateVillagers(delta: number) {
    if (this.locationMode !== "overworld") return;
    for (const villager of this.objectsOfType("villager")) {
      if (!villager.homePosition) continue;
      if ((villager.wanderPause ?? 0) > 0) {
        villager.wanderPause = Math.max(0, (villager.wanderPause ?? 0) - delta);
        this.animateWalkCycle(villager, delta, 0);
        continue;
      }

      const position = villager.root.position;
      const roamRadius = villager.roamRadius ?? 14;
      const distanceFromHome = position.distanceTo(villager.homePosition);
      const targetDistance = villager.wanderTarget ? Math.hypot(villager.wanderTarget.x - position.x, villager.wanderTarget.z - position.z) : Infinity;
      const targetDistanceFromHome = villager.wanderTarget ? Math.hypot(villager.wanderTarget.x - villager.homePosition.x, villager.wanderTarget.z - villager.homePosition.z) : Infinity;
      const needsReturnTarget = distanceFromHome > roamRadius * 1.08 && targetDistanceFromHome > roamRadius * VILLAGER_ROAM_SOFT_LIMIT;
      if (!villager.wanderTarget || targetDistance < VILLAGER_TARGET_REACHED_DISTANCE || needsReturnTarget) {
        if (targetDistance < VILLAGER_TARGET_REACHED_DISTANCE) villager.wanderPause = THREE.MathUtils.randFloat(0.8, 2.2);
        villager.wanderTarget = this.chooseVillagerWanderTarget(villager);
      }

      if (!villager.wanderTarget) {
        this.animateWalkCycle(villager, delta, 0);
        continue;
      }

      const directionX = villager.wanderTarget.x - position.x;
      const directionZ = villager.wanderTarget.z - position.z;
      const distance = Math.hypot(directionX, directionZ);
      if (distance < VILLAGER_TARGET_REACHED_DISTANCE) {
        villager.wanderTarget = undefined;
        villager.wanderPause = THREE.MathUtils.randFloat(0.8, 2.2);
        this.animateWalkCycle(villager, delta, 0);
        continue;
      }

      const step = Math.min(distance, VILLAGER_WALK_SPEED * delta);
      const next = position.clone();
      next.x += (directionX / distance) * step;
      next.z += (directionZ / distance) * step;
      next.y = this.getOverworldHeightAt(next.x, next.z);
      villager.root.position.copy(next);
      this.refreshSpatialObject(villager);
      const angle = Math.atan2(directionZ, directionX);
      villager.root.rotation.y = this.lerpAngle(villager.root.rotation.y, -angle + Math.PI / 2, Math.min(1, delta * 6));
      this.animateWalkCycle(villager, delta, VILLAGER_WALK_SPEED);
    }
  }

  private chooseVillagerWanderTarget(villager: WorldObject) {
    if (!villager.homePosition) return undefined;
    const home = villager.homePosition;
    const roamRadius = villager.roamRadius ?? 14;
    const distanceFromHome = villager.root.position.distanceTo(home);
    const returnHome = distanceFromHome > roamRadius * VILLAGER_ROAM_SOFT_LIMIT;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const radius = returnHome ? THREE.MathUtils.randFloat(0.8, roamRadius * 0.46) : THREE.MathUtils.randFloat(1.6, roamRadius * 0.78);
      const angle = Math.random() * Math.PI * 2;
      const target = home.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      target.y = this.getOverworldHeightAt(target.x, target.z);
      if (!this.isVillagerWanderTargetBlocked(target, villager)) return target;
    }

    const fallback = home.clone();
    fallback.y = this.getOverworldHeightAt(fallback.x, fallback.z);
    return fallback;
  }

  private isVillagerWanderTargetBlocked(target: THREE.Vector3, villager: WorldObject) {
    if (this.isNaturalSpawnBlocked(target, 0.8)) return true;
    for (const object of this.objectsNear(target, 4)) {
      if (object.id === villager.id) continue;
      if (!object.collidable) continue;
      if (object.type === "villager" || object.type === "animal") continue;
      const radius = Math.max(object.collisionRadius ?? 0, object.terrainRadius ?? 0, 0.7);
      if (Math.hypot(target.x - object.root.position.x, target.z - object.root.position.z) < radius + 0.7) return true;
    }
    return false;
  }

  private lerpAngle(current: number, target: number, alpha: number) {
    const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
    return current + delta * alpha;
  }

  private updateAnts(delta: number) {
    for (const hill of this.objectsOfType("antHill")) {
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
    updatePredatorAi(this.predatorAiContext, delta);
  }

  private updateDragons(_delta: number) {
    if (this.locationMode !== "overworld") return;
    for (const dragon of this.objectsOfType("dragon")) {
      const toPlayer = this.playerPosition.clone().sub(dragon.root.position);
      const angle = Math.atan2(toPlayer.z, toPlayer.x);
      dragon.root.rotation.y = -angle + Math.PI / 2;
      dragon.root.position.y = this.getGroundHeightAt(dragon.root.position.x, dragon.root.position.z) + 0.18 + Math.sin(this.clock.elapsedTime * 1.3 + dragon.root.position.x * 0.02) * 0.18;
      dragon.root.children.forEach((child) => {
        if (child.userData.dragonWing) child.rotation.z = (child.userData.baseZ ?? 0) + Math.sin(this.clock.elapsedTime * 4.8) * 0.18 * (child.position.z < 0 ? -1 : 1);
        if (child.userData.dragonTail) child.rotation.y = Math.sin(this.clock.elapsedTime * 2.2) * 0.18;
      });
      this.refreshSpatialObject(dragon);
    }
  }

  private updateJamminis(delta: number) {
    if (this.locationMode !== "overworld") return;
    const now = performance.now();
    for (const jammini of this.objectsOfType("jammini")) {
      const toPlayer = this.playerPosition.clone().sub(jammini.root.position);
      const distance = Math.hypot(toPlayer.x, toPlayer.z);
      const aggroRange = jammini.attackRange ?? 18;
      const aggroed = distance <= aggroRange || (jammini.angryUntil ?? 0) > now;
      if (!aggroed && Math.random() < 0.012) jammini.wanderAngle = Math.random() * Math.PI * 2;
      const angle = aggroed ? Math.atan2(toPlayer.z, toPlayer.x) : (jammini.wanderAngle ?? 0);
      if (!aggroed || distance > 10) {
        const next = jammini.root.position.clone();
        next.x += Math.cos(angle) * (aggroed ? 1.25 : 0.45) * delta;
        next.z += Math.sin(angle) * (aggroed ? 1.25 : 0.45) * delta;
        if (!this.isNaturalSpawnBlocked(next, 2)) {
          next.y = this.getGroundHeightAt(next.x, next.z);
          jammini.root.position.copy(next);
          this.refreshSpatialObject(jammini);
        }
      }
      jammini.root.rotation.y = -angle + Math.PI / 2;
      this.animateWalkCycle(jammini, delta, aggroed ? 0.55 : 0.22);
      jammini.attackCooldown = Math.max(0, (jammini.attackCooldown ?? 0) - delta);
      if (!aggroed) continue;

      if ((jammini.ultimateUntil ?? 0) > now) {
        jammini.ultimateTick = Math.max(0, (jammini.ultimateTick ?? 0) - delta);
        if ((jammini.ultimateTick ?? 0) <= 0) {
          jammini.ultimateTick = 0.75;
          this.scatterLegoRing(jammini.root.position, 8);
        }
        continue;
      }

      if ((jammini.attackCooldown ?? 0) <= 0) {
        const useUltimate = Math.random() < 0.18 && distance <= 14;
        if (useUltimate) {
          jammini.ultimateUntil = now + 10_000;
          jammini.ultimateTick = 0;
          jammini.attackCooldown = 16;
          this.showMessage("잼미니가 궁극기: 레고 폭풍을 시작했습니다!");
          this.playTone(330, 0.2, "sawtooth", 0.026);
        } else {
          jammini.attackCooldown = 2.2;
          const throwAngle = Math.atan2(toPlayer.z, toPlayer.x) + THREE.MathUtils.randFloatSpread(1.15);
          const throwDistance = THREE.MathUtils.randFloat(1.25, 2.8);
          const target = this.playerPosition.clone().add(new THREE.Vector3(Math.cos(throwAngle) * throwDistance, 0, Math.sin(throwAngle) * throwDistance));
          target.y = this.getGroundHeightAt(target.x, target.z) + 0.03;
          this.spawnLegoHazard(target, jammini.root.position);
          this.showMessage("잼미니가 레고를 던졌습니다. 노란 경고 표시를 보고 피하세요!");
          this.playTone(560, 0.06, "square", 0.02);
        }
      }
    }
  }

  private updateLegoHazards(_delta: number) {
    if (this.locationMode !== "overworld") return;
    const now = performance.now();
    for (const lego of [...this.objectsOfType("legoHazard")]) {
      if ((lego.hazardExpiresAt ?? 0) <= now) {
        this.removeObject(lego.id);
        continue;
      }
      this.animateLegoHazard(lego, now);
      if ((lego.hazardArmedAt ?? 0) > now) continue;
      if (Math.hypot(lego.root.position.x - this.playerPosition.x, lego.root.position.z - this.playerPosition.z) > LEGO_HAZARD_TRIGGER_RADIUS) continue;
      this.damagePlayer(5, true, "바닥의 레고를 밟아 체력이 모두 떨어졌습니다.");
      this.removeObject(lego.id);
      this.showMessage("레고를 밟았습니다. 피해 5.");
    }
  }

  private animateLegoHazard(lego: WorldObject, now: number) {
    const thrownAt = lego.hazardThrownAt ?? now;
    const armedAt = lego.hazardArmedAt ?? thrownAt;
    const progress = THREE.MathUtils.clamp((now - thrownAt) / Math.max(1, armedAt - thrownAt), 0, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    lego.root.traverse((child) => {
      if (child.userData.legoFalling) {
        const start = child.userData.start as THREE.Vector3 | undefined;
        const end = child.userData.end as THREE.Vector3 | undefined;
        if (start && end) child.position.lerpVectors(start, end, eased);
        child.rotation.x += 0.2;
        child.rotation.z += 0.14;
        child.visible = progress < 0.98;
      }
      if (child.userData.legoWarning) {
        const pulse = 1 + Math.sin(this.clock.elapsedTime * 12) * 0.12;
        child.scale.setScalar((now < armedAt ? 1.32 : 1) * pulse);
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.set(now < armedAt ? 0xfff3c4 : 0xff4d3d);
          child.material.opacity = now < armedAt ? 0.72 : 0.46;
        }
      }
    });
  }

  private predatorAggroRange(kind: PredatorKind = "wolf") {
    return this.predatorStats(kind).aggroRange;
  }

  private predatorStrikeRange(kind: PredatorKind = "wolf") {
    return this.predatorStats(kind).strikeRange;
  }

  private predatorStats(kind: PredatorKind = "wolf", monsterId?: MonsterId) {
    return monsterId ? predatorStatsForMonster(monsterId, kind) : PREDATOR_STATS[kind] ?? PREDATOR_STATS.wolf;
  }

  private bossStats(kind: BossKind | undefined = "dragon") {
    return BOSS_STATS[kind ?? "dragon"] ?? BOSS_STATS.dragon;
  }

  private updateNightSpawns(delta: number) {
    if (this.locationMode !== "overworld") return;
    const now = performance.now();
    for (let index = this.respawnQueue.length - 1; index >= 0; index -= 1) {
      const entry = this.respawnQueue[index]; if (entry.dueAt > now) continue; if (entry.position.distanceTo(this.playerPosition) < 42) { entry.dueAt = now + 10_000; continue; }
      this.respawnQueue.splice(index, 1); const position = entry.position.clone(); position.y = this.getGroundHeightAt(position.x, position.z); const villageId = entry.villageId ?? "respawn-village";
      if (entry.type === "wildPredator") { const region = this.activeRegions.find((candidate) => candidate.id === entry.regionId) ?? regionAtPosition(position, this.activeRegions); const monsterId = (entry.monsterId as MonsterId | undefined) ?? chooseRegionPredatorMonster(region); const predator = spawnPredatorEntity(this.entitySpawnContext, this.randomPredatorSpawnPoint(region) ?? position, entry.predatorKind ?? predatorKindForMonster(monsterId)); applyPredatorMonsterDefinition(predator, region ?? regionAtPosition(predator.root.position, this.activeRegions) ?? this.activeRegions[0] ?? REGIONS[REGIONS.length - 1], monsterId); }
      else if (entry.type === "jammini") spawnJamminiEntity(this.entitySpawnContext, position);
      else if (entry.type === "villageKnight") this.spawnKnight(position, villageId); else if (entry.type === "villageGolem") this.spawnGolem(position, villageId); else if (entry.type === "villageArcher" || entry.type === "villageMage") this.spawnRangedGuard(position, villageId, entry.type);
    }
    this.nightSpawnTimer += delta;
    if (this.nightSpawnTimer < NIGHT_PREDATOR_SPAWN_SECONDS) return;
    this.nightSpawnTimer = 0;
    const hour = this.gameHour();
    const isNight = hour >= 20 || hour < 5;
    const region = regionAtPosition(this.playerPosition, this.activeRegions);
    if (!isNight && (!region || region.levelRange[1] < 10)) return;
    let predatorCount = 0; for (const predator of this.objectsOfType("wildPredator")) if (!region || predator.regionId === region.id) predatorCount += 1;
    const maxPredators = isNight ? NIGHT_PREDATOR_MAX_COUNT : NIGHT_PREDATOR_MAX_COUNT + 4;
    if (predatorCount >= maxPredators || Math.random() > (isNight ? 0.36 : 0.3)) return;
    const point = this.randomPredatorSpawnPoint(region);
    if (!point) return;
    const monsterId = chooseRegionPredatorMonster(region);
    const predator = spawnPredatorEntity(this.entitySpawnContext, point, predatorKindForMonster(monsterId));
    applyPredatorMonsterDefinition(predator, region ?? regionAtPosition(point, this.activeRegions) ?? this.activeRegions[0] ?? REGIONS[REGIONS.length - 1], monsterId);
    this.showMessage(isNight ? "밤의 야생동물들이 멀리 숲과 들판에 퍼져 있습니다." : "이 지역의 몬스터들이 멀리 퍼져 있습니다.");
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
    for (const guard of this.objectsOfTypes(["villageKnight", "villageArcher", "villageMage", "villageGolem"])) {
      if (!guard.angryUntil || guard.angryUntil < now) continue;
      const mode = guard.guardMode ?? "melee";
      const range = guard.attackRange ?? (mode === "ranged" ? 18 : 2.05);
      const damage = guard.attackDamage ?? (guard.type === "villageMage" ? 2 : guard.type === "villageGolem" ? 9 : 1);
      const dx = this.playerPosition.x - guard.root.position.x;
      const dz = this.playerPosition.z - guard.root.position.z;
      const centerDistance = Math.hypot(dx, dz);
      const attackDistance =
        mode === "melee"
          ? Math.max(0, centerDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
          : centerDistance;
      let movementSpeed = 0;
      if (mode === "melee" && attackDistance > range) {
        if (centerDistance > 0.01) {
          const chaseSpeed = guard.type === "villageGolem" ? 1.85 : 2.4;
          const step = Math.min(attackDistance - range, chaseSpeed * delta);
          guard.root.position.x += (dx / centerDistance) * step;
          guard.root.position.z += (dz / centerDistance) * step;
          guard.root.position.y = this.getGroundHeightAt(guard.root.position.x, guard.root.position.z);
          this.refreshSpatialObject(guard);
          movementSpeed = step / Math.max(delta, 0.001);
        }
      }
      this.animateWalkCycle(guard, delta, movementSpeed);

      guard.attackCooldown = Math.max(0, (guard.attackCooldown ?? 0) - delta);
      if (guard.attackCooldown > 0) continue;
      const currentCenterDistance = Math.hypot(this.playerPosition.x - guard.root.position.x, this.playerPosition.z - guard.root.position.z);
      const currentAttackDistance =
        mode === "melee"
          ? Math.max(0, currentCenterDistance - (guard.collisionRadius ?? 0.75) - PLAYER_RADIUS)
          : currentCenterDistance;
      if (currentAttackDistance > range) continue;
      guard.attackCooldown = guard.attackInterval ?? (mode === "ranged" ? 1.8 : 1.2);
      const died = this.damagePlayer(
        damage,
        true,
        `${guard.name}의 ${mode === "ranged" ? "원거리 공격" : "근거리 공격"}을 받아 체력이 모두 떨어졌습니다.`,
      );
      this.playHandAction();
      if (died) continue;
      const attackText = this.lastDamageBlocked
        ? `${guard.name}의 공격을 방어구가 완전히 막았습니다.`
        : mode === "ranged"
          ? `${guard.name}의 원거리 공격을 받았습니다. 피해 ${this.lastDamageTaken}.`
          : `${guard.name}가 가까이 붙어 공격했습니다. 피해 ${this.lastDamageTaken}.`;
      this.showMessage(attackText);
      this.renderHud();
    }
  }

  private enrageVillage(villageId: string, message: string) {
    const now = performance.now();
    let guards = 0;
    for (const object of this.objectsOfTypes(["villageKnight", "villageArcher", "villageMage", "villageGolem"])) {
      if (object.villageId !== villageId) continue;
      object.angryUntil = now + 12_000;
      object.attackCooldown = 0.5;
      guards += 1;
    }
    this.showMessage(`${message} 경비 ${guards}명이 추격을 시작했습니다.`);
  }

  private updateHand(delta: number) {
    this.updateHeldItem();
    this.actionTimer = Math.max(0, this.actionTimer - delta);
    this.rangedCooldown = Math.max(0, this.rangedCooldown - delta);

    const duration = this.actionMode === "melee" ? 0.42 : this.actionMode === "bow" || this.actionMode === "magic" ? 0.34 : 0.34;
    const progress = this.actionTimer > 0 ? THREE.MathUtils.clamp(1 - this.actionTimer / duration, 0, 1) : 1;
    const swing = this.actionTimer > 0 ? Math.sin(progress * Math.PI) : 0;

    if (this.actionMode === "melee") {
      const sweep = this.actionTimer > 0 ? Math.sin(progress * Math.PI * 1.12) : 0;
      this.handGroup.position.set(0.22 * sweep, -0.06 - 0.08 * swing, -0.14 - 0.18 * swing);
      this.handGroup.rotation.set(-0.35 - 0.52 * swing, 0.18 - 0.95 * sweep, -0.15 - 0.82 * sweep);
    } else if (this.actionMode === "bow") {
      const draw = this.actionTimer > 0 ? Math.sin(progress * Math.PI) : 0;
      this.handGroup.position.set(-0.04 * draw, -0.03 - 0.03 * draw, -0.08 + 0.08 * draw);
      this.handGroup.rotation.set(-0.24 - 0.28 * draw, 0.34, -0.08 + 0.16 * draw);
    } else if (this.actionMode === "magic") {
      const pulse = this.actionTimer > 0 ? Math.sin(progress * Math.PI) : 0;
      this.handGroup.position.set(0.06 * pulse, -0.04 - 0.04 * pulse, -0.1 - 0.2 * pulse);
      this.handGroup.rotation.set(-0.46 * pulse, 0.28 + 0.24 * pulse, -0.12 * pulse);
    } else {
      this.handGroup.position.set(0.09 * swing, -0.05 * swing, -0.12 * swing);
      this.handGroup.rotation.set(-0.62 * swing, 0.2 * swing, -0.15 * swing);
    }

    if (this.actionTimer <= 0) this.actionMode = "use";
  }

  private playHandAction(mode: HandActionMode = "use") {
    this.actionMode = mode;
    this.actionTimer = mode === "melee" ? 0.42 : 0.34;
  }

  private updateHeldItem() {
    const item = this.hotbar[this.selectedHotbarIndex]?.item ?? null;
    const visibleItem = item === "tutorial_book" ? null : item;
    if (visibleItem === this.heldItemKey) return;
    this.heldItemKey = visibleItem;
    this.heldItemGroup.clear();
    if (!visibleItem) return;
    this.heldItemGroup.add(createHeldItemVisualModel(visibleItem));
  }

  private showMirrorView() {
    this.refreshMirrorAvatar();
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

  private updateMessages(delta: number) {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= delta;
    if (this.messageTimer <= 0) this.messageEl.textContent = "";
  }

  private updatePrompt(delta: number, force = false) {
    this.promptRefreshTimer -= delta;
    if (!force && this.promptRefreshTimer > 0) return;
    this.promptRefreshTimer = this.isSprinting() ? SPRINT_LOOK_TARGET_REFRESH_SECONDS : LOOK_TARGET_REFRESH_SECONDS;
    const exactTarget = this.getLookTarget();
    const target =
      this.nearbyObjectInView(["bed", "workbench", "extendedWorkbench", "smelter", "specialSmelter", "grinder", "villageShop", "villageSellShop", "dragon", "jammini"]) ??
      exactTarget ??
      this.nearbyDroppedItemInView();
    if (target?.id === this.lastTargetId) return;
    this.lastTargetId = target?.id ?? null;

    const lockText =
      document.pointerLockElement === this.renderer.domElement
        ? "WASD 이동 | Shift+W 달리기 | Shift 웅크리기 | C 엎드리기 | Space 점프 | E/좌클릭 상호작용 | 우클릭 사용 | R 직업스킬"
        : "화면 클릭: 1인칭 시점 고정";

    const bucketItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (!target && this.isRangedWeapon(bucketItem)) {
      this.promptEl.textContent = `${bucketItem && RANGED_PROJECTILE[bucketItem] === "magic" ? "좌클릭/E/숫자키: 마법 발사" : "좌클릭/E/숫자키: 발사"} | ${lockText}`;
      return;
    }
    if (!target && bucketItem === "dragon_spawn") {
      this.promptEl.textContent = "좌클릭/E/숫자키: 앞쪽에 용 소환 | " + lockText;
      return;
    }
    if (!target && bucketItem === "building_block") {
      this.promptEl.textContent = "우클릭: 앞쪽 땅에 쌓기블록 놓기 | 블록 면을 보고 우클릭: 이어 붙이기 | " + lockText;
      return;
    }
    if (!target && this.isBucketItem(bucketItem)) {
      const liquid = this.bucketLiquidTarget(null);
      if (liquid?.kind === "water" && bucketItem === "bucket") {
        this.promptEl.textContent = "\uc88c\ud074\ub9ad/E: \uc591\ub3d9\uc774\uc5d0 \ubb3c \ub2f4\uae30 | " + lockText;
        return;
      }
      if (liquid?.kind === "lava" && bucketItem === "bucket") {
        this.promptEl.textContent = "\uc88c\ud074\ub9ad/E: \uc591\ub3d9\uc774\uc5d0 \uc6a9\uc554 \ub2f4\uae30 | " + lockText;
        return;
      }
      if (liquid?.kind === "lava" && bucketItem === "water_bucket") {
        this.promptEl.textContent = "\uc88c\ud074\ub9ad/E: \ubb3c \uc591\ub3d9\uc774 \ube44\uc6b0\uae30 -> \ud751\uc694\uc11d \uc0dd\uc131 | " + lockText;
        return;
      }
      if (liquid?.kind === "water" && bucketItem === "lava_bucket") {
        this.promptEl.textContent = "\uc88c\ud074\ub9ad/E: \uc6a9\uc554 \uc591\ub3d9\uc774 \ube44\uc6b0\uae30 -> \ud751\uc694\uc11d \uc0dd\uc131 | " + lockText;
        return;
      }
    }

    if (!target) {
      this.promptEl.textContent = lockText;
      return;
    }

    const action = this.actionTextFor(target);
    this.promptEl.textContent = `${action} | ${lockText}`;
  }

  private actionTextFor(target: WorldObject) {
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (this.isRangedWeapon(selectedItem) && this.isCombatTarget(target)) return selectedItem && RANGED_PROJECTILE[selectedItem] === "magic" ? "좌클릭/E: 마법 발사" : "좌클릭/E: 발사";
    if (target.type === "smallTree") return "E: 작은 나무 캐기";
    if (target.type === "bigTree") return "E: 큰 나무 캐기(도끼 필요)";
    if (target.type === "chest") return target.opened ? "이미 연 상자" : "E: 상자 열기";
    if (target.type === "droppedItem") return `좌클릭/E: ${target.name} 줍기`;
    if (target.type === "buildingBlock") return selectedItem === "building_block" ? "좌클릭/E: 쌓기블록 회수 | 우클릭: 바라보는 면에 이어 붙이기" : "좌클릭/E: 쌓기블록 회수";
    if (target.type === "bed") return "좌클릭/E/우클릭: 잠자기";
    if (target.type === "cave") return "E: 동굴 들어가기";
    if (target.type === "caveExit") return "E: 동굴 나가기";
    if (target.type === "houseExit") return "E: 집 밖으로 나가기";
    if (target.type === "train") return this.ridingTrainId === target.id ? "E: 기차에서 내리기" : "E: 기차 타기";
    if (target.type === "water") return target.name;
    if (target.type === "dirtPatch") return target.digDepth === target.maxDigDepth ? "돌층: 더 팔 수 없음" : "E: 흙 파기";
    if (target.type === "terrainPatch") {
      if (target.terrainKind === "lava") {
        if (selectedItem === "bucket") return "\uc88c\ud074\ub9ad/E: \uc591\ub3d9\uc774\uc5d0 \uc6a9\uc554 \ub2f4\uae30";
        if (selectedItem === "water_bucket") return "\uc88c\ud074\ub9ad/E: \ubb3c \uc591\ub3d9\uc774 \ube44\uc6b0\uae30 -> \ud751\uc694\uc11d \uc0dd\uc131";
        return "용암 지대: 너무 뜨거워서 팔 수 없음";
      }
      if (target.digDepth === target.maxDigDepth) return target.requiresPickaxe ? "암반: 더 캘 수 없음" : "돌층: 더 팔 수 없음";
      return target.requiresPickaxe ? `E: ${target.name} 캐기(곡괭이 필요)` : `E: ${target.name} 파기`;
    }
    if (target.type === "ore") return `E: ${target.name} 캐기`;
    if (target.type === "mineChest") return target.opened ? "이미 연 광산 상자" : "E: 광산 상자 열기";
    if (target.type === "miner") return "E: 광부와 대화";
    if (target.type === "animal") return `E: ${target.name} 사냥`;
    if (target.type === "villager") return "좌클릭/E: 주민 공격 | 우클릭: 거래";
    if (target.type === "blacksmithNpc") return "좌클릭/E/우클릭: 대장장이 거래";
    if (target.type === "villageShop") return "좌클릭/E/우클릭: 마을 상점 열기";
    if (target.type === "villageSellShop") return "좌클릭/E/우클릭: 마을 판매소 열기";
    if (target.type === "blacksmith") return "E: 대장간 들어가기";
    if (target.type === "villageHouse") return target.enterable ? "E: 주민 집 들어가기" : target.name;
    if (this.isVillageGuard(target)) return `E: ${target.name} 공격`;
    if (target.type === "foodStorage") return "E: 식량창고 열기";
    if (target.type === "workbench" || target.type === "extendedWorkbench") return "좌클릭/E: 제작대 회수 | 우클릭: 제작대 사용";
    if (target.type === "smelter" || target.type === "specialSmelter") return "좌클릭/E: 제련대 회수 | 우클릭: 제련대 사용";
    if (target.type === "grinder") return "좌클릭/E: 분쇄기 회수 | 우클릭: 분쇄기 사용";
    if (target.type === "antHill") return target.antMeatRemaining === 0 ? "빈 개미굴" : "좌클릭/E: 개미굴에서 고기 얻기";
    if (target.type === "wildPredator") return `좌클릭/E: ${target.name} 공격`;
    if (target.type === "dragon") return `좌클릭/E: ${target.name} 공격(보스)`;
    if (target.type === "jammini") return "좌클릭/E: 잼미니 공격";
    if (target.type === "legoHazard") return "레고 장판: 밟으면 피해 5";
    return "E: 상호작용";
  }

  private interact() {
    if (this.ridingTrainId) {
      this.leaveTrain();
      return;
    }
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    const selectedItemIsRanged = this.isRangedWeapon(selectedItem);
    const exactTarget = this.getLookTarget();
    const target =
      exactTarget?.type === "blacksmithNpc"
        ? exactTarget
        : this.nearbyObjectInView(["bed", "workbench", "extendedWorkbench", "smelter", "specialSmelter", "grinder", "villageShop", "villageSellShop", "antHill", "wildPredator", "dragon", "jammini"]) ?? exactTarget;
    if (!this.possessedEagleId && selectedItemIsRanged && shouldFireRangedDuringInteract(true, Boolean(target), target ? this.isCombatTarget(target) : false)) {
      this.fireRangedWeapon(selectedItem);
      return;
    }
    if (!target) {
      if (this.useSelectedBucketOnLook(null, this.isBucketItem(this.hotbar[this.selectedHotbarIndex]?.item))) return;
      if (this.hotbar[this.selectedHotbarIndex]?.item === "dragon_spawn") {
        this.useDragonSpawnItem();
        return;
      }
      const droppedItem = this.nearbyDroppedItemInView();
      if (droppedItem) {
        this.playHandAction();
        this.pickUpDroppedItem(droppedItem);
        return;
      }
      this.showMessage("가까이 보고 있는 대상이 없습니다.");
      return;
    }

    if (this.useSelectedBucketOnLook(target)) return;
    this.playHandAction();
    if (this.isCombatTarget(target)) this.playMeleeAttackEffects(target);
    if (target.type === "droppedItem") {
      this.pickUpDroppedItem(target);
      return;
    }
    if (target.type === "bed") {
      this.pickUpBed(target);
      return;
    }
    if (target.type === "buildingBlock") {
      this.pickUpBuildingBlock(target);
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
    if (target.type === "dragon") {
      this.attackDragon(target);
      return;
    }
    if (target.type === "jammini") {
      this.attackJammini(target);
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
    if (target.type === "villageShop") {
      this.openPointShop(target);
      return;
    }
    if (target.type === "villageSellShop") {
      this.openSellShop(target);
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

  private pickUpBuildingBlock(target: WorldObject) {
    if (target.type !== "buildingBlock") return;
    if (!this.addItem("building_block", 1)) return;
    this.removeObject(target.id);
    this.playHandAction();
    this.playTone(240, 0.06, "triangle", 0.025);
    this.showMessage("쌓기블록을 회수해서 인벤토리에 넣었습니다.");
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
      this.playWoodHitSound(false);
      if (axe) this.consumeDurability(axe, "작은 나무를 쳤습니다.");
      return;
    }
    const woodCount = this.grantRewardItem("wood", 1, "tree");
    this.playWoodHitSound(true);
    if (axe) this.consumeDurability(axe, "작은 나무를 캤습니다.");
    this.removeObject(target.id);
    this.showMessage("작은 나무를 캐서 나무 1개를 얻었습니다.");
    this.showMessage(`작은 나무를 캐서 나무 ${woodCount}개를 얻었습니다.`);
  }

  private harvestBigTree(target: WorldObject) {
    const axe = this.activeTool(AXE_POWER);
    if (!axe) {
      this.showMessage("큰 나무는 도끼가 있어야 캘 수 있습니다.");
      return;
    }
    const axePower = AXE_POWER[axe] ?? 0;
    if (!this.advanceHarvest(target, "wood", HARVEST_HARDNESS.wood + 5, axePower, "큰 나무")) {
      this.playWoodHitSound(false);
      this.consumeDurability(axe, "큰 나무를 쳤습니다.");
      return;
    }
    const woodCount = this.grantRewardItem("wood", 5, "tree");
    this.playWoodHitSound(true);
    this.consumeDurability(axe, "큰 나무를 베었습니다.");
    this.removeObject(target.id);
    this.showMessage("큰 나무를 베어 나무 5개를 얻었습니다.");
    this.showMessage(`큰 나무를 베어 나무 ${woodCount}개를 얻었습니다.`);
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
        this.showMessage(`${target.name}은 곡괭이로만 캘 수 있습니다. 제작대에서 막대기 2개 + 돌 4개로 돌 곡괭이를 만드세요.`);
        return;
      }
      const progress = pickaxePower >= 3 ? 2 : 1;
      target.digDepth = Math.min(maxDepth, currentDepth + progress);
      const loot = target.terrainKind === "ore" ? this.rollSurfaceOre() : "stone";
      const rewardCount = this.grantRewardItem(loot, target.terrainKind === "stone" ? 2 : 1, "dig");
      this.playDigSound("stone");
      this.consumeDurability(pickaxe, `${target.name}을 캤습니다.`);
      this.updateDirtPatchVisual(target);
      this.showMessage(target.digDepth >= maxDepth ? `${target.name}을 끝까지 캐서 암반이 드러났습니다.` : `곡괭이로 ${target.name}을 캐서 ${ITEM_NAMES[loot]}을 얻었습니다.`);
      this.showMessage(`${ITEM_NAMES[loot] ?? loot} ${rewardCount}개를 얻었습니다.`);
      return;
    }

    const shovel = this.bestTool(SHOVEL_POWER);
    const shovelPower = shovel ? SHOVEL_POWER[shovel] ?? 0 : 0;
    const progress = shovelPower > 0 ? 2 : 1;
    target.digDepth = Math.min(maxDepth, currentDepth + progress);
    const dirtCount = this.grantRewardItem("dirt", shovelPower > 0 ? 2 : 1, "dig");
    this.playDigSound("dirt");
    if (shovel) this.consumeDurability(shovel, "땅을 팠습니다.");
    this.updateDirtPatchVisual(target);

    if (target.digDepth >= maxDepth) {
      this.showMessage("흙을 파다가 돌층이 나왔습니다. 더 이상 팔 수 없습니다.");
    } else {
      this.showMessage(shovelPower > 0 ? "삽으로 흙을 빠르게 팠습니다." : "손으로 흙을 팠습니다.");
    }
    this.showMessage(`흙 ${dirtCount}개를 얻었습니다.`);
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
    target.opened = true; target.expiresAt = performance.now() + 8_000;
    this.tintObject(target.root, 0x6a5940);
    this.playChestSound();

    const loot: string[] = [];
    if (Math.random() < 0.5 && this.addItem("hammer", 1)) loot.push("망치");
    if (Math.random() < 0.02 && this.addItem("smelter", 1)) loot.push("제련대");
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
    this.settlePlayerAfterTeleport();
    this.createCaveInterior();
    precompileSceneShaders(this.renderer, this.scene, this.camera);
    this.playTransitionSound("enter");
    this.showMessage("동굴 안으로 들어왔습니다. 돌과 석탄을 찾아보세요.");
    this.renderHud();
  }

  private leaveCave() {
    this.locationMode = "overworld";
    this.clearCaveObjects();
    this.setOverworldAtmosphere();
    this.playerPosition.copy(this.caveReturnPosition ?? new THREE.Vector3(0, PLAYER_HEIGHT, 12));
    this.settlePlayerAfterTeleport();
    this.playTransitionSound("exit");
    this.showMessage("다시 야생으로 나왔습니다.");
    this.renderHud();
  }

  private boardTrain(train: WorldObject) {
    this.ridingTrainId = train.id;
    this.followTrain(train);
    this.playTransitionSound("train");
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
      this.settlePlayerAfterTeleport();
    }
    this.playTransitionSound("train");
    this.showMessage("기차에서 내렸습니다.");
    this.renderHud();
  }

  private enterHouse(target: WorldObject) {
    this.houseReturnPosition = this.playerPosition.clone();
    this.clearHouseObjects();
    this.locationMode = "house";
    this.setHouseAtmosphere();
    this.playerPosition.set(0, PLAYER_HEIGHT, HOUSE_CENTER_Z + 3.7);
    this.settlePlayerAfterTeleport();
    const houseKind = target.type === "blacksmith" ? "blacksmith" : target.houseKind ?? "home";
    this.currentHouseKind = houseKind;
    if (target.houseChestRich === undefined) target.houseChestRich = houseKind === "blacksmith" || Math.random() < 0.01;
    this.createHouseInterior(target.houseChestRich, houseKind);
    precompileSceneShaders(this.renderer, this.scene, this.camera);
    this.playTransitionSound("enter");
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
    this.settlePlayerAfterTeleport();
    this.playTransitionSound("exit");
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
      this.playOreBreakSound(false);
      this.consumeDurability(pickaxe, `${ITEM_NAMES[target.ore]}을 캤습니다.`);
      return;
    }
    const oreCount = this.grantRewardItem(target.ore, target.ore === "stone" ? 2 : 1, "ore");
    this.playOreBreakSound(true);
    this.consumeDurability(pickaxe, `${ITEM_NAMES[target.ore]}을 캤습니다.`);
    this.removeObject(target.id);
    this.showMessage(`${ITEM_NAMES[target.ore]}을 얻었습니다.`);
    this.showMessage(`${ITEM_NAMES[target.ore] ?? target.ore} ${oreCount}개를 얻었습니다.`);
  }

  private openMineChest(target: WorldObject) {
    if (target.opened) {
      this.showMessage("이미 연 광산 상자입니다.");
      return;
    }
    target.opened = true; target.expiresAt = performance.now() + 8_000;
    this.tintObject(target.root, 0x4f4636);

    const rolls = Math.random() < 0.05 ? THREE.MathUtils.randInt(2, 3) : 1;
    const loot: string[] = [];
    for (let i = 0; i < rolls; i += 1) {
      const item = this.rollMineMineral();
      if (this.addItem(item, 1)) loot.push(ITEM_NAMES[item]);
    }
    this.showMessage(`광산 상자에서 ${loot.join(", ")}를 얻었습니다.`);
  }

  private grantAnimalLoot(target: WorldObject, actionLabel: string) {
    const rewards: string[] = [];
    if (target.animalKind !== "chicken" && this.rollRewardChance(1, "animal", "leather")) {
      const baseLeather = target.animalKind === "pig" ? 1 : THREE.MathUtils.randInt(1, 2);
      const leatherCount = this.grantRewardItem("leather", baseLeather, "animal");
      if (leatherCount > 0) rewards.push(`가죽 ${leatherCount}개`);
    }
    const meatChance = target.animalKind === "pig" || target.animalKind === "chicken" ? 1 : 0.35;
    if (this.rollRewardChance(meatChance, "animal", "meat")) {
      const baseMeat = target.animalKind === "chicken" ? 1 : THREE.MathUtils.randInt(1, 2);
      const meatCount = this.grantRewardItem("meat", baseMeat, "animal");
      if (meatCount > 0) rewards.push(`고기 ${meatCount}개`);
    }
    this.showMessage(`${target.name}을 ${actionLabel}. ${rewards.length > 0 ? rewards.join(", ") : "재료는 나오지 않았습니다."}`);
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
    this.grantAnimalLoot(target, "사냥했습니다");
    this.removeObject(target.id);
    this.grantExperienceForTarget(target);
  }

  private attackPredator(target: WorldObject) {
    applyMeleePredatorAttack(this.projectileDamageContext, target, this.currentDamage());
  }

  private attackDragon(target: WorldObject) {
    applyMeleeDragonAttack(this.projectileDamageContext, target, this.currentDamage());
  }

  private dragonCounterAttack(target: WorldObject) {
    const stats = this.bossStats(target.bossKind);
    const distance = Math.hypot(target.root.position.x - this.playerPosition.x, target.root.position.z - this.playerPosition.z);
    const claw = distance <= 5.2 && Math.random() < 0.55;
    if (claw) {
      spawnDragonClawBurst(this.combatEffectContext, target.root.position);
      this.damagePlayer(stats.clawDamage, true, `${stats.name}의 손톱 공격을 받아 체력이 모두 떨어졌습니다.`);
      this.showMessage(this.lastDamageBlocked ? "용의 손톱 공격을 방어구가 막았습니다." : `용의 손톱 공격! 피해 ${this.lastDamageTaken}.`);
      return;
    }
    spawnDragonFireBurst(this.combatEffectContext, this.playerPosition.clone());
    this.damagePlayer(stats.fireDamage, true, `${stats.name}의 원거리 공격을 받아 체력이 모두 떨어졌습니다.`);
    this.showMessage(this.lastDamageBlocked ? "용의 불 공격을 방어구가 막았습니다." : `용이 하늘에서 불을 쏟았습니다! 피해 ${this.lastDamageTaken}.`);
  }

  private experienceRewardFor(target: WorldObject) {
    if (target.type === "animal") {
      if (target.animalKind === "chicken") return 4;
      if (target.animalKind === "pig" || target.animalKind === "cow") return 6;
      return 8;
    }

    if (target.type === "wildPredator") return predatorExperienceReward(target.predatorKind, target.monsterLevel);

    if (target.type === "jammini") return 75;

    if (target.type === "dragon") {
      const rewards: Record<BossKind, number> = {
        dragon: 500,
        fire_dragon: 900,
        red_dragon: 1300,
        laser_dragon: 1800,
        dark_dragon: 2400,
        immortal: 3500,
      };
      return rewards[target.bossKind ?? "dragon"];
    }

    if (target.type === "villageGolem") return 280;
    if (target.type === "villageMage" || target.type === "villageArcher") return 125;
    if (target.type === "villageKnight") return 110;
    return 0;
  }

  private grantExperienceForTarget(target: WorldObject) {
    this.summonerCompanion.awardExperience(Math.round(this.experienceRewardFor(target) * (getWorldMapById(this.currentWorldMapId).xpScale ?? 1)), this.summonerPetContext);
  }

  private gainExperience(amount: number) {
    const gained = Math.max(0, Math.floor(amount));
    if (gained <= 0) return;

    this.experience += gained;
    let levelUps = 0;
    while (this.experience >= this.experienceForNextLevel(this.level)) {
      this.experience -= this.experienceForNextLevel(this.level);
      this.level += 1;
      levelUps += 1;
    }

    if (levelUps > 0) {
      const previousMaxHealth = this.maxHealth;
      this.maxHealth = Math.max(this.maxHealth, this.maxHealthForLevel());
      this.health = Math.min(this.maxHealth, this.health + Math.max(0, this.maxHealth - previousMaxHealth));
      this.showMessage(`레벨업! Lv ${this.level}. 체력/방어/공격이 ${levelUps}씩 올랐습니다.`);
      celebrateLevelUp(this.juiceDeps, this.level);
    }

    this.renderHud();
  }

  private attackJammini(target: WorldObject) {
    if (target.type !== "jammini") return;
    const damage = this.currentDamage();
    target.hp = (target.hp ?? JAMMINI_MAX_HP) - damage;
    target.angryUntil = performance.now() + 12_000;
    this.playTone(420, 0.08, "square", 0.025);
    if (target.hp > 0) {
      this.showMessage(`잼미니에게 ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}/${JAMMINI_MAX_HP}.`);
      return;
    }
    const plasticCount = this.grantRewardItem("plastic_block", 1, "jammini");
    this.removeObject(target.id);
    this.showMessage(`잼미니를 물리쳤습니다. 레고 조각 ${plasticCount}개를 얻었습니다.`);
    this.grantExperienceForTarget(target);
  }

  private harvestAntHill(target: WorldObject) {
    if (target.type !== "antHill") return;
    const remaining = target.antMeatRemaining ?? 5;
    if (remaining <= 0) {
      this.showMessage("개미굴은 비어 있습니다.");
      return;
    }
    target.antMeatRemaining = remaining - 1;
    const meatCount = this.grantRewardItem("meat", 1, "antHill");
    this.playTone(480, 0.08, "triangle", 0.03);
    this.showMessage(`개미굴에서 고기 ${meatCount}개를 얻었습니다. 남은 횟수 ${target.antMeatRemaining}/5.`);
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
    const attack = this.currentDamage();
    const defense = target.armor ?? 0;
    const damage = this.calculateCombatDamage(attack, defense);
    if (damage <= 0) {
      if (target.villageId) this.enrageVillage(target.villageId, `${target.name}을 공격하자 경비들이 달려옵니다.`);
      this.showMessage(`${target.name}의 방어력 ${defense}이 공격력 ${attack}을 완전히 막았습니다.`);
      return;
    }
    target.hp = (target.hp ?? 10) - damage;
    if (target.villageId) this.enrageVillage(target.villageId, `${target.name}을 공격하자 경비들이 달려듭니다.`);
    if (target.hp > 0) {
      const range = target.attackRange ?? (target.guardMode === "ranged" ? 18 : 2.05);
      if (target.root.position.distanceTo(this.playerPosition) <= range) {
        const counterDamage = target.attackDamage ?? 1;
        if (this.damagePlayer(counterDamage, true, `${target.name}의 반격을 받아 체력이 모두 떨어졌습니다.`)) return;
        this.showMessage(
          this.lastDamageBlocked
            ? `${target.name}에게 ${damage} 피해. 내 방어구가 반격을 막았습니다.`
            : `${target.name}에게 ${damage} 피해. 반격 피해 ${this.lastDamageTaken}.`,
        );
      } else {
        this.showMessage(`${target.name}에게 ${damage} 피해. 아직 너무 멀어서 반격은 닿지 않았습니다.`);
      }
      return;
    }
    const ironCount = this.rollRewardChance(1, "guard", "iron") ? this.grantRewardItem("iron", 1, "guard") : 0;
    this.removeObject(target.id);
    this.showMessage(ironCount > 0 ? `${target.name}을 물리치고 철 ${ironCount}개를 얻었습니다.` : `${target.name}을 물리쳤지만 철은 나오지 않았습니다.`);
    this.grantExperienceForTarget(target);
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
    const bonus = this.levelStatBonus();
    if (this.possessedEagleId) return possessedEagleDamage(EAGLE_RAM_DAMAGE, this.hotbar[this.selectedHotbarIndex]?.item, bonus);
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (selectedItem && !this.isRangedWeapon(selectedItem) && WEAPON_DAMAGE[selectedItem]) return WEAPON_DAMAGE[selectedItem] + bonus;
    return Math.max(1, this.bestPower(MELEE_WEAPON_DAMAGE)) + bonus;
  }

  private currentRangedDamage(item: ItemId) {
    const base = WEAPON_DAMAGE[item] ?? BOW_DAMAGE;
    return base + this.levelStatBonus();
  }

  private eagleCombatTarget() {
    const exactTarget = this.getLookTarget();
    if (exactTarget && this.isCombatTarget(exactTarget)) return exactTarget;
    return this.nearbyObjectInView(["animal", "wildPredator", "dragon", "jammini", "villager", "villageKing", "villageKnight", "villageArcher", "villageMage", "villageGolem"]);
  }

  private displayedAttackPower() {
    if (this.possessedEagleId) return possessedEagleDamage(EAGLE_RAM_DAMAGE, this.hotbar[this.selectedHotbarIndex]?.item, this.levelStatBonus());
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (selectedItem && this.isRangedWeapon(selectedItem)) return this.currentRangedDamage(selectedItem);
    return this.currentDamage();
  }

  private levelStatBonus(level = this.level) {
    return Math.max(0, Math.floor(level) - 1);
  }

  private maxHealthForLevel(level = this.level) {
    return BASE_PLAYER_MAX_HEALTH + this.levelStatBonus(level);
  }

  private experienceForNextLevel(level = this.level) {
    return Math.floor(22.5 * Math.pow(Math.max(1, Math.floor(level)), 1.35));
  }

  private equipmentArmorValue() {
    return equipmentArmorValueWithShield(this.equippedArmor, this.equippedShield, this.playerClass, this.ironGuardUntil, performance.now());
  }

  private equippedArmorValue() {
    return this.equipmentArmorValue() + this.levelStatBonus();
  }

  private calculateCombatDamage(attackPower: number, defense: number) {
    return calculateDamage(attackPower, defense);
  }

  private fireRangedWeapon(item: ItemId) {
    if (this.rangedCooldown > 0) return;
    this.rangedCooldown = RANGED_ATTACK_COOLDOWN * CLASS_PASSIVES[this.playerClass].rangedCooldownScale;
    const kind: CombatProjectile["kind"] = RANGED_PROJECTILE[item] ?? "arrow";
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    const origin = this.camera.position
      .clone()
      .addScaledVector(direction, 0.82)
      .addScaledVector(right, 0.2)
      .addScaledVector(up, -0.18);
    const speed = kind === "magic" ? 29 : 41;
    const projectile: CombatProjectile = {
      kind,
      mesh: kind === "magic" ? createMagicProjectile(direction) : createArrowProjectile(direction),
      velocity: direction.multiplyScalar(speed),
      damage: this.currentRangedDamage(item),
      radius: kind === "magic" ? 0.36 : 0.16,
      life: PROJECTILE_MAX_LIFE,
    };
    projectile.mesh.position.copy(origin);
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    this.playHandAction(kind === "magic" ? "magic" : "bow");
    if (kind === "magic") this.playMagicShotSound();
    else this.playBowShotSound();
  }




  private fireTntSkill() {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    const origin = this.camera.position
      .clone()
      .addScaledVector(direction, 0.92)
      .addScaledVector(right, 0.16)
      .addScaledVector(up, -0.12);
    const projectile: CombatProjectile = {
      kind: "tnt",
      mesh: createTntProjectile(direction),
      velocity: direction.multiplyScalar(24),
      damage: MAGE_TNT_DAMAGE,
      radius: 0.42,
      life: 2.1,
      explosionRadius: MAGE_TNT_RADIUS,
    };
    projectile.mesh.position.copy(origin);
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    this.playHandAction("magic");
    this.playTone(220, 0.08, "square", 0.024);
    this.playTone(760, 0.1, "triangle", 0.018);
  }

  private spawnEagleSummon(position: THREE.Vector3) {
    const root = createEagleVisual();
    root.position.copy(position);
    const eagle = this.addWorldObject("eagleSummon", "소환 독수리", root, {
      hp: EAGLE_MAX_HP,
      armor: EAGLE_ARMOR,
      collidable: false,
      collisionRadius: 0.75,
      collisionHeight: 1.4,
    });
    return eagle;
  }

  private syncPossessedEagle() {
    if (!this.possessedEagleId) return;
    const eagle = this.objects.get(this.possessedEagleId);
    if (!eagle) {
      this.endEaglePossession(false);
      return;
    }
    eagle.root.position.set(this.playerPosition.x, Math.max(0.4, this.playerPosition.y - PLAYER_HEIGHT + 1.15), this.playerPosition.z);
    eagle.root.rotation.y = this.yaw;
    const flap = Math.sin(this.clock.elapsedTime * 13) * 0.48;
    eagle.root.traverse((child) => {
      const side = child.userData.flapSide;
      if (typeof side === "number") child.rotation.z = side * (0.36 + flap);
    });
    this.refreshSpatialObject(eagle);
    if (this.eaglePossessionEndsAt > 0 && performance.now() >= this.eaglePossessionEndsAt) { this.endEaglePossession(false); this.showMessage("독수리 빙의 시간이 끝났습니다."); }
  }

  private endEaglePossession(showNotice: boolean) {
    const eagleId = this.possessedEagleId;
    const eagle = eagleId ? this.objects.get(eagleId) : null;
    if (eagle) this.playerPosition.set(eagle.root.position.x, this.getGroundHeightAt(eagle.root.position.x, eagle.root.position.z) + PLAYER_HEIGHT, eagle.root.position.z);
    else this.playerPosition.y = this.getGroundHeightAt(this.playerPosition.x, this.playerPosition.z) + PLAYER_HEIGHT;
    if (eagleId) this.removeObject(eagleId);
    this.possessedEagleId = null; this.eaglePossessionEndsAt = 0;
    this.eagleClawCooldownUntil = 0; this.windCutterCooldownUntil = 0;
    this.playerBodyPosition = null;
    this.settlePlayerAfterTeleport();
    if (showNotice) this.showMessage("독수리가 쓰러져 본체로 돌아왔습니다.");
    this.renderHud();
  }

  private damagePossessedEagle(amount: number, showParticles: boolean, ignoreArmor = false) {
    const eagle = this.possessedEagleId ? this.objects.get(this.possessedEagleId) : null;
    if (!eagle) {
      this.endEaglePossession(false);
      return false;
    }
    const armor = ignoreArmor ? 0 : EAGLE_ARMOR;
    const damage = ignoreArmor ? Math.max(1, Math.floor(amount)) : this.calculateCombatDamage(amount, armor);
    this.lastDamageTaken = damage;
    this.lastDamageBlocked = damage <= 0;
    if (damage <= 0) {
      this.showMessage(`독수리 방어력 ${armor}이 공격 ${amount}을 막았습니다.`);
      return false;
    }
    eagle.hp = Math.max(0, (eagle.hp ?? EAGLE_MAX_HP) - damage);
    if (showParticles) spawnEnemyHitParticles(this.combatEffectContext, eagle);
    if (showParticles) this.playTone(130, 0.08, "sawtooth", 0.024);
    if (eagle.hp <= 0) {
      this.endEaglePossession(true);
      return false;
    }
    this.showMessage(`독수리가 ${damage} 피해를 받았습니다. 남은 체력 ${Math.ceil(eagle.hp)}/${EAGLE_MAX_HP}.`);
    this.renderHud();
    return false;
  }

  private spawnWarriorExplosion(position: THREE.Vector3) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, WARRIOR_EXPLOSION_RADIUS, 48),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(WARRIOR_EXPLOSION_RADIUS * 0.18, WARRIOR_EXPLOSION_RADIUS * 0.62, 0.42, 28, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.position.y = 0.2;
    group.add(ring, core);
    group.position.copy(position);
    group.renderOrder = 18;
    this.scene.add(group);
    this.areaSkillEffects.push({
      mesh: group,
      expiresAt: performance.now() + WARRIOR_EXPLOSION_SECONDS * 1000,
      nextTickAt: 0,
      radius: WARRIOR_EXPLOSION_RADIUS,
      damage: WARRIOR_EXPLOSION_DAMAGE,
      damagedThisTick: new Set<string>(),
    });
    spawnExplosionVisual(this.combatEffectContext, position, WARRIOR_EXPLOSION_RADIUS * 0.55);
    this.playExplosionSound();
  }

  private updateAreaSkillEffects(delta: number) {
    const now = performance.now();
    for (let index = this.areaSkillEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.areaSkillEffects[index];
      effect.mesh.rotation.y += delta * 1.4;
      const materialTargets: THREE.Material[] = [];
      effect.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materialTargets.push(...materials);
        }
      });
      const remainingRatio = THREE.MathUtils.clamp((effect.expiresAt - now) / (WARRIOR_EXPLOSION_SECONDS * 1000), 0, 1);
      for (const material of materialTargets) {
        if ("opacity" in material) material.opacity = Math.max(0.12, remainingRatio * 0.36);
      }
      if (effect.nextTickAt <= 0 || now >= effect.nextTickAt) {
        effect.damagedThisTick.clear();
        spawnExplosionVisual(this.combatEffectContext, effect.mesh.position, effect.radius * 0.38);
        this.applyAreaDamage(effect.mesh.position, effect.radius, effect.damage, effect.damagedThisTick, "tnt");
        effect.nextTickAt = now + 1000;
      }
      if (now < effect.expiresAt) continue;
      this.scene.remove(effect.mesh);
      this.disposeObject3D(effect.mesh);
      this.areaSkillEffects.splice(index, 1);
    }
  }

  private applyAreaDamage(position: THREE.Vector3, radius: number, damage: number, damagedThisTick = new Set<string>(), kind: CombatProjectile["kind"] = "tnt") {
    const targets = [...this.objectsNear(position, radius + 6)];
    for (const target of targets) {
      if (!this.isCombatTarget(target)) continue;
      if (damagedThisTick.has(target.id)) continue;
      const targetRadius = Math.max(target.collisionRadius ?? 0.7, target.type === "dragon" ? 2.4 : 0.7);
      const distance = Math.hypot(target.root.position.x - position.x, target.root.position.z - position.z);
      if (distance > radius + targetRadius) continue;
      damagedThisTick.add(target.id);
      spawnEnemyHitParticles(this.combatEffectContext, target, target.root.position.clone().add(new THREE.Vector3(0, 1.0, 0)));
      this.applyProjectileDamage(target, damage, kind);
    }
  }

  private explodeTntProjectile(position: THREE.Vector3, damage: number, radius: number) {
    const impact = position.clone();
    impact.y = Math.max(impact.y, this.getGroundHeightAt(impact.x, impact.z) + 0.2);
    spawnExplosionVisual(this.combatEffectContext, impact, radius);
    this.applyAreaDamage(impact, radius, damage, new Set<string>(), "tnt");
    this.playExplosionSound();
  }


  private playExplosionSound() {
    this.playTone(82, 0.18, "sawtooth", 0.045);
    this.playTone(164, 0.11, "square", 0.025);
    this.playTone(520, 0.05, "triangle", 0.015);
  }

  private updateProjectiles(delta: number) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= delta;
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      if (projectile.kind === "magic") spawnMagicTrail(this.combatEffectContext, projectile.mesh.position);
      if (projectile.kind === "wind") {
        projectile.mesh.rotation.z += delta * 8;
        spawnWindCutterTrail(this.combatEffectContext, projectile.mesh.position);
      }
      if (projectile.kind === "tnt") {
        projectile.mesh.rotation.x += delta * 5.5;
        projectile.mesh.rotation.z += delta * 3.2;
        spawnTntTrail(this.combatEffectContext, projectile.mesh.position);
      }
      const target = this.projectileHitTarget(projectile);
      if (target) {
        if (projectile.kind === "tnt") {
          this.explodeTntProjectile(projectile.mesh.position, projectile.damage, projectile.explosionRadius ?? MAGE_TNT_RADIUS);
        } else {
          spawnEnemyHitParticles(this.combatEffectContext, target, projectile.mesh.position);
          spawnProjectileImpact(this.combatEffectContext, projectile.mesh.position, projectile.kind);
          this.applyProjectileDamage(target, projectile.damage, projectile.kind);
        }
        this.removeProjectile(index);
        continue;
      }
      if (projectile.life <= 0) {
        if (projectile.kind === "tnt") this.explodeTntProjectile(projectile.mesh.position, projectile.damage, projectile.explosionRadius ?? MAGE_TNT_RADIUS);
        this.removeProjectile(index);
      }
    }
  }


  private projectileHitTarget(projectile: CombatProjectile) {
    const point = projectile.mesh.position;
    for (const target of this.objectsNear(point, 5.5)) {
      if (!this.isCombatTarget(target)) continue;
      const targetHeight =
        target.type === "dragon"
          ? Math.min((target.collisionHeight ?? 5.4) * 0.56, 4.8)
          : target.type === "villageGolem"
            ? 2.4
            : target.type === "animal" || target.type === "wildPredator"
              ? 0.95
              : 1.45;
      const center = target.root.position.clone();
      center.y += targetHeight;
      const targetRadius = Math.max(target.collisionRadius ?? 0.7, target.type === "dragon" ? 2.4 : 0.7);
      if (center.distanceTo(point) <= targetRadius + projectile.radius + 0.35) return target;
    }
    return null;
  }

  private applyProjectileDamage(target: WorldObject, attackPower: number, kind: CombatProjectile["kind"]) {
    applyProjectileDamageWithContext(this.projectileDamageContext, target, attackPower, kind);
  }

  private isCombatTarget(target: WorldObject) {
    return (
      target.type === "animal" ||
      target.type === "wildPredator" ||
      target.type === "dragon" ||
      target.type === "jammini" ||
      target.type === "villager" ||
      target.type === "villageKing" ||
      this.isVillageGuard(target)
    );
  }

  private playMeleeAttackEffects(target: WorldObject) {
    this.playHandAction("melee");
    spawnMeleeSlashTrail(this.combatEffectContext);
    spawnEnemyHitParticles(this.combatEffectContext, target);
    this.playMeleeWhoosh();
  }






  private playBowShotSound() {
    this.playTone(190, 0.045, "triangle", 0.03);
    this.playTone(520, 0.055, "square", 0.012);
  }

  private playMagicShotSound() {
    this.playTone(760, 0.1, "triangle", 0.032);
    this.playTone(410, 0.16, "sine", 0.018);
  }

  private playMeleeWhoosh() {
    this.playTone(440, 0.045, "sawtooth", 0.018);
    this.playTone(230, 0.075, "triangle", 0.014);
  }

  private playImpactSound(kind: CombatProjectile["kind"]) {
    if (kind === "tnt") {
      this.playExplosionSound();
      return;
    }
    if (kind === "magic") {
      this.playTone(620, 0.06, "triangle", 0.028);
      this.playTone(160, 0.05, "sawtooth", 0.018);
      return;
    }
    if (kind === "wind") {
      this.playTone(780, 0.055, "triangle", 0.024);
      this.playTone(260, 0.065, "sine", 0.014);
      return;
    }
    this.playTone(140, 0.055, "square", 0.024);
  }

  private consumeShieldDurability() {
    const result = consumeShieldHit(this.equippedShield, this.shieldDurabilityUsed);
    this.equippedShield = result.equippedShield; this.shieldDurabilityUsed = result.shieldDurabilityUsed;
    if (result.brokenItem) { this.removeItem(result.brokenItem, 1); this.showMessage(`${ITEM_NAMES[result.brokenItem] ?? result.brokenItem}이 부서졌습니다.`); }
  }

  private damagePlayer(amount: number, showParticles = true, deathReason = "체력이 모두 떨어졌습니다.", ignoreArmor = false) {
    if (this.possessedEagleId) return this.damagePossessedEagle(amount, showParticles, ignoreArmor);
    const armor = ignoreArmor ? 0 : this.equippedArmorValue();
    const damage = ignoreArmor ? Math.max(1, Math.floor(amount)) : calculateIncomingPlayerDamage(amount, armor);
    if (!ignoreArmor && this.equippedShield) this.consumeShieldDurability();
    this.lastDamageTaken = damage;
    this.lastDamageBlocked = damage <= 0;
    if (damage <= 0) {
      if (showParticles) this.playTone(180, 0.07, "square", 0.018);
      this.showMessage(`방어력 ${armor}이 공격력 ${amount}을 완전히 막았습니다.`);
      this.renderHud();
      return false;
    }
    if (showParticles) spawnDamageParticles(this.combatEffectContext);
    if (showParticles) this.playTone(90, 0.12, "sawtooth", 0.03);
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
      this.settlePlayerAfterTeleport();
      this.showMessage(`사망 원인: ${deathReason} 튜토리얼 책, 직업 기본무기, 구급상자를 제외한 아이템이 죽은 자리에 떨어졌습니다.`);
      this.renderHud();
      return true;
    }
    this.renderHud();
    return false;
  }

  private fallDamageForDistance(distance: number) {
    if (distance < 2.1) return 0;
    return Math.max(1, Math.floor((distance - 1.7) * 1.2));
  }

  private applyFallDamage(distance: number) {
    const damage = this.fallDamageForDistance(distance);
    if (damage <= 0) return false;
    const died = this.damagePlayer(damage, true, "높은 곳에서 떨어져 체력이 모두 떨어졌습니다.", true);
    if (!died) this.showMessage(`높은 곳에서 떨어져 ${damage} 피해를 입었습니다.`);
    return died;
  }

  private resetFallTracking() {
    this.fallPeakFeetY = this.playerPosition.y - this.currentPlayerHeight();
    this.fallDamageArmed = false;
  }

  private settlePlayerAfterTeleport() {
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.resetFallTracking();
  }

  private dropInventoryOnDeath(position: THREE.Vector3) {
    position.y = this.getOverworldHeightAt(position.x, position.z) + 0.08;
    const starterItem = PLAYER_CLASSES[this.playerClass]?.starterItem ?? "iron_sword";
    const protectedItems = new Set<ItemId>(["tutorial_book", "medkit", starterItem]);
    for (const slot of this.allStorageSlots()) {
      if (!slot.item || slot.count <= 0) continue;
      if (protectedItems.has(slot.item)) {
        if (slot.item === "tutorial_book") slot.count = 1;
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
    this.equippedShield = isShieldItem(starterItem) ? starterItem : null; this.shieldDurabilityUsed = 0; this.ironGuardUntil = 0;
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

  private updateAudio(_delta: number) {
    if (!this.audioContext || !this.bgmMasterGain) return;
    const context = this.audioContext;
    if (context.state === "suspended") return;
    const profile = this.currentAudioProfile();
    this.bgmMasterGain.gain.setTargetAtTime(profile.master, context.currentTime, 1.2);

    if (this.nextBgmNoteAt <= 0 || this.nextBgmNoteAt < context.currentTime - 0.5) this.nextBgmNoteAt = context.currentTime + 0.05;
    while (this.nextBgmNoteAt < context.currentTime + 0.38) {
      this.scheduleBgmStep(profile, this.nextBgmNoteAt);
      this.nextBgmNoteAt += profile.beat;
      this.bgmStep += 1;
    }

    if (this.nextAmbientCueAt <= 0) this.nextAmbientCueAt = context.currentTime + THREE.MathUtils.randFloat(2.4, 5.4);
    if (context.currentTime >= this.nextAmbientCueAt) {
      this.scheduleAmbientCue(profile);
      this.nextAmbientCueAt = context.currentTime + THREE.MathUtils.randFloat(profile.ambient === "day" ? 3.6 : 4.8, profile.ambient === "cave" ? 8.5 : 7.2);
    }
  }

  private currentAudioProfile() {
    const hour = this.gameHour();
    const nearLava = this.locationMode === "overworld" && this.isPointInLava(this.playerPosition, 9);
    return resolveAudioProfile(hour, this.locationMode, nearLava, this.currentWorldMapId === "graveyard");
  }

  private scheduleBgmStep(profile: AudioProfile, startTime: number) {
    const step = this.bgmStep % 16;
    const note = profile.melody[step % profile.melody.length];
    if (step % 2 === 0) {
      this.playToneAt(this.noteFrequency(profile.root, note + 12), startTime, profile.beat * 0.72, "triangle", profile.lead, this.bgmMasterGain);
    }
    if (step % 4 === 0) {
      this.playToneAt(this.noteFrequency(profile.root, profile.chord[(step / 4) % profile.chord.length] - 12), startTime, profile.beat * 1.8, "sine", profile.bass, this.bgmMasterGain);
    }
    if (step % 8 === 0) {
      for (const semitone of profile.chord) {
        this.playToneAt(this.noteFrequency(profile.root, semitone), startTime + 0.02, profile.beat * 4.6, "sine", profile.pad, this.bgmMasterGain);
      }
    }
  }

  private scheduleAmbientCue(profile: AudioProfile) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    if (profile.ambient === "day") {
      const base = THREE.MathUtils.randFloat(980, 1320);
      this.playToneAt(base, now, 0.055, "sine", 0.008, this.bgmMasterGain);
      this.playToneAt(base * 1.19, now + 0.08, 0.045, "triangle", 0.006, this.bgmMasterGain);
      this.playToneAt(base * 0.92, now + 0.16, 0.05, "sine", 0.006, this.bgmMasterGain);
      return;
    }
    if (profile.ambient === "night") {
      const base = THREE.MathUtils.randFloat(330, 430);
      this.playToneAt(base, now, 0.2, "sine", 0.006, this.bgmMasterGain);
      this.playToneAt(base * 0.78, now + 0.24, 0.28, "sine", 0.005, this.bgmMasterGain);
      return;
    }
    if (profile.ambient === "cave") {
      this.playToneAt(120, now, 0.42, "sine", 0.01, this.bgmMasterGain);
      this.playToneAt(720 + Math.random() * 180, now + 0.34, 0.045, "triangle", 0.006, this.bgmMasterGain);
      return;
    }
    if (profile.ambient === "lava") {
      this.playToneAt(74, now, 0.35, "sawtooth", 0.012, this.bgmMasterGain);
      this.playToneAt(130, now + 0.16, 0.18, "triangle", 0.007, this.bgmMasterGain);
      return;
    }
    this.playToneAt(520, now, 0.08, "triangle", 0.005, this.bgmMasterGain);
  }

  private noteFrequency(root: number, semitone: number) {
    return root * 2 ** (semitone / 12);
  }

  private ensureAudio() {
    if (this.audioContext) {
      void this.audioContext.resume();
      return;
    }
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    this.audioContext = new AudioContextCtor();
    this.bgmMasterGain = this.audioContext.createGain();
    this.sfxMasterGain = this.audioContext.createGain();
    this.bgmMasterGain.gain.value = 0.0001;
    this.sfxMasterGain.gain.value = 0.78;
    this.bgmMasterGain.connect(this.audioContext.destination);
    this.sfxMasterGain.connect(this.audioContext.destination);
    this.nextBgmNoteAt = this.audioContext.currentTime + 0.08;
    this.nextAmbientCueAt = this.audioContext.currentTime + 2.2;
  }

  private playTone(frequency: number, duration = 0.08, type: OscillatorType = "sine", volume = 0.03) {
    this.ensureAudio();
    if (!this.audioContext) return;
    this.playToneAt(frequency, this.audioContext.currentTime, duration, type, volume, this.sfxMasterGain);
  }

  private playToneAt(frequency: number, startTime: number, duration = 0.08, type: OscillatorType = "sine", volume = 0.03, destination: AudioNode | null) {
    if (!this.audioContext || !destination) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const attack = Math.min(0.035, duration * 0.22);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(attack + 0.01, duration));
    oscillator.connect(gain).connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.04);
  }

  private playCraftSound() {
    this.playTone(520, 0.065, "triangle", 0.042);
    this.playTone(720, 0.09, "sine", 0.032);
    this.playTone(960, 0.085, "triangle", 0.026);
  }

  private playChestSound() {
    this.playTone(210, 0.045, "triangle", 0.026);
    this.playTone(360, 0.06, "square", 0.012);
    this.playTone(620, 0.07, "triangle", 0.014);
  }

  private playWoodHitSound(done = false) {
    this.playTone(done ? 170 : 140, 0.045, "triangle", 0.026);
    this.playTone(done ? 310 : 230, 0.035, "square", 0.01);
  }

  private playDigSound(surface: "dirt" | "stone" = "dirt") {
    if (surface === "stone") {
      this.playTone(118, 0.05, "square", 0.025);
      this.playTone(260, 0.035, "triangle", 0.012);
      return;
    }
    this.playTone(96, 0.045, "triangle", 0.02);
    this.playTone(150, 0.03, "sine", 0.01);
  }

  private playOreBreakSound(done = false) {
    this.playTone(done ? 180 : 145, 0.055, "square", 0.026);
    this.playTone(done ? 540 : 360, done ? 0.09 : 0.045, "triangle", done ? 0.018 : 0.011);
  }

  private playSmeltSound() {
    this.playTone(180, 0.12, "sawtooth", 0.022);
    this.playTone(420, 0.08, "triangle", 0.016);
    this.playTone(760, 0.09, "sine", 0.012);
  }

  private playGrindSound() {
    this.playTone(120, 0.055, "sawtooth", 0.035);
    this.playTone(95, 0.07, "square", 0.018);
    this.playTone(300, 0.035, "triangle", 0.012);
  }

  private playTransitionSound(kind: "enter" | "exit" | "train" = "enter") {
    if (kind === "train") {
      this.playTone(150, 0.08, "triangle", 0.024);
      this.playTone(240, 0.12, "square", 0.012);
      return;
    }
    this.playTone(kind === "enter" ? 360 : 520, 0.08, "triangle", 0.02);
    this.playTone(kind === "enter" ? 220 : 660, 0.1, "sine", 0.012);
  }

  private updateFootsteps(distance: number, sprinting: boolean) {
    this.footstepDistance += distance;
    const interval = sprinting ? 1.05 : 1.55;
    while (this.footstepDistance >= interval) {
      this.footstepDistance -= interval;
      this.playFootstepSound(sprinting);
    }
  }

  private playFootstepSound(sprinting: boolean) {
    const surface = this.currentFootstepSurface();
    const boost = sprinting ? 1.15 : 1;
    if (surface === "water") {
      this.playTone(170 + Math.random() * 30, 0.045, "sine", 0.026 * boost);
      this.playTone(310 + Math.random() * 80, 0.025, "triangle", 0.012 * boost);
      return;
    }
    if (surface === "stone") {
      this.playTone(130 + Math.random() * 35, 0.035, "square", 0.02 * boost);
      this.playTone(240 + Math.random() * 70, 0.025, "triangle", 0.008 * boost);
      return;
    }
    if (surface === "wood") {
      this.playTone(190 + Math.random() * 45, 0.04, "triangle", 0.022 * boost);
      this.playTone(95, 0.035, "sine", 0.008 * boost);
      return;
    }
    this.playTone(115 + Math.random() * 35, 0.035, "triangle", 0.017 * boost);
    this.playTone(72, 0.026, "sine", 0.006 * boost);
  }

  private playLandingSound() {
    const surface = this.currentFootstepSurface();
    if (surface === "water") {
      this.playTone(145, 0.08, "sine", 0.035);
      this.playTone(340, 0.04, "triangle", 0.016);
      return;
    }
    this.playTone(surface === "stone" ? 95 : 82, 0.08, surface === "stone" ? "square" : "sine", 0.028);
  }

  private currentFootstepSurface() {
    if (this.locationMode === "house") return "wood";
    if (this.locationMode === "cave") return "stone";
    if (this.isPointInWater(this.playerPosition, 0.4)) return "water";
    const biome = this.priorityBiomeAt(this.playerPosition, 1);
    if (this.isPointInLava(this.playerPosition, 1) || biome?.kind === "mountain") return "stone";
    return "grass";
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
    for (const object of this.objectsNear(this.playerPosition, maxRange + 2)) {
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

    for (const object of this.objectsNear(this.playerPosition, maxDistance + 3)) {
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

    for (const object of this.objectsNear(this.playerPosition, 4.4)) {
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
    this.pendingStorageMove = null;
    if (this.currentPanel !== null && document.pointerLockElement) document.exitPointerLock();
    this.renderPanel();
    this.renderHud();
  }

  private openPanel(panel: Exclude<PanelType, null>) {
    this.currentPanel = panel;
    this.pendingStorageMove = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderPanel();
    this.renderHud();
  }

  private closePanel() {
    this.currentPanel = null;
    this.currentStationId = null;
    this.pendingStorageMove = null;
    this.renderPanel();
    this.renderHud();
  }

  private startGame(mode: "new" | "load") {
    if (mode === "load") {
      const saves = this.readSaveSlots();
      if (saves.length === 0) {
        this.showMessage("불러올 저장 파일이 없습니다.");
        return;
      }
      if (saves.length > 1) {
        this.hideMiniGame(false);
        this.hideLavaMiniGame(false);
        this.hideSmithingMiniGame(false);
        this.openPanel("loadGame");
        return;
      }
      this.loadSaveSlot(saves[0].id);
      return;
    }

    if (!this.pendingPlayerClass) {
      this.showMessage("새로 시작하려면 먼저 직업을 선택하세요.");
      this.titleScreenEl.querySelector<HTMLElement>("[data-class-select]")?.classList.add("needs-choice");
      return;
    }
    this.playerClass = this.pendingPlayerClass;
    this.refreshHandColor();
    this.enterGameplayMode();
    this.resetGameState();
    this.seedOverworld();
    precompileSceneShaders(this.renderer, this.scene, this.camera);
    this.showMessage("새 게임을 시작했습니다.");
    this.renderPanel();
    this.renderHud();
  }

  private enterGameplayMode() {
    this.gameStarted = true;
    this.hideMiniGame(false);
    this.hideLavaMiniGame(false);
    this.hideSmithingMiniGame(false);
    this.titleScreenEl.classList.add("hidden");
    this.uiRoot.classList.remove("title-active");
    this.handGroup.visible = true;
    this.ensureAudio();
  }

  private newGame() {
    if (!window.confirm("타이틀 화면으로 돌아갈까요? 저장하지 않은 진행은 사라지고, 저장된 게임은 그대로 남습니다.")) return;
    this.gameStarted = false; this.currentPanel = null; this.renderPanel();
    document.exitPointerLock?.();
    this.handGroup.visible = false; this.pendingPlayerClass = this.playerClass;
    this.renderClassSelection(); this.renderTitlePoints();
    this.titleScreenEl.classList.remove("hidden"); this.uiRoot.classList.add("title-active");
  }

  private saveGame() {
    try {
      const save = this.createSaveData();
      backupLatestSaveInRepository();
      writeRepositoryJsonStorage(SAVE_KEY, save);
      const existingSaves = this.readSaveSlots().filter((slot) => slot.savedAt !== save.savedAt);
      const requestedSaves = [this.createSaveSlot(save), ...existingSaves];
      const storedCount = this.writeSaveSlots(requestedSaves);
      const trimmedText = requestedSaves.length > storedCount ? ` 최근 ${storedCount}개 저장만 보관했습니다.` : "";
      this.showMessage(`저장 완료: ${this.formatSaveDate(save.savedAt)}.${trimmedText}`);
    } catch (error) {
      console.error(error);
      this.showMessage("저장에 실패했습니다. 브라우저 저장 공간을 확인해보세요.");
    }
  }

  private loadGame() {
    const saves = this.readSaveSlots();
    if (saves.length === 0) {
      this.showMessage("불러올 저장 파일이 없습니다.");
      return;
    }

    if (saves.length > 1) {
      this.openPanel("loadGame");
      return;
    }

    this.loadSaveSlot(saves[0].id);
  }

  private loadSaveSlot(slotId: string) {
    const slot = this.readSaveSlots().find((candidate) => candidate.id === slotId);
    if (!slot) {
      this.showMessage("선택한 저장 파일을 찾지 못했습니다.");
      this.renderPanel();
      return;
    }

    const fallbackSave = this.gameStarted ? this.createSaveData() : null;
    try {
      backupLatestSaveInRepository();
      writeRepositoryJsonStorage(SAVE_KEY, slot.save);
      this.enterGameplayMode();
      this.currentPanel = null;
      this.restoreSaveData(slot.save);
      precompileSceneShaders(this.renderer, this.scene, this.camera);
      this.showMessage(`불러오기 완료: ${this.formatSaveDate(slot.save.savedAt)}`);
    } catch (error) {
      console.error(error);
      if (fallbackSave) {
        try {
          this.restoreSaveData(fallbackSave);
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }
      this.showMessage("저장 파일을 불러오지 못했습니다.");
    }
  }

  private createSaveSlot(save: SavedGame): SaveSlot {
    return createRepositorySaveSlot(save, (savedAt) => this.formatSaveDate(savedAt));
  }

  private readSaveSlots(): SaveSlot[] {
    return readRepositorySaveSlots({
      migrateSaveData: (save) => this.migrateSaveData(save),
      formatSaveDate: (savedAt) => this.formatSaveDate(savedAt),
    });
  }

  private writeSaveSlots(slots: SaveSlot[]) {
    return writeRepositorySaveSlots(slots);
  }

  private formatSaveDate(savedAt: string) {
    const date = new Date(savedAt);
    return Number.isNaN(date.getTime()) ? savedAt : date.toLocaleString();
  }

  private saveSummary(save: SavedGame) {
    const hour = (((save.player.worldTimeSeconds ?? DAY_LENGTH_SECONDS * (8 / 24)) / DAY_LENGTH_SECONDS) * 24) % 24;
    const location = save.player.locationMode === "cave" ? "동굴" : save.player.locationMode === "house" ? "집 안" : "야생";
    const className = PLAYER_CLASSES[save.player.playerClass ?? "warrior"]?.name ?? "전사";
    const filledSlots = [...save.player.hotbar, ...save.player.bagSlots].filter((slot) => slot.item && slot.count > 0).length;
    return `${className} · Lv ${save.player.level} · 체력 ${save.player.health}/${save.player.maxHealth} · 마나 ${Math.floor(save.player.mana ?? BASE_MAX_MANA)}/${save.player.maxMana ?? BASE_MAX_MANA} · 배고픔 ${save.player.hunger ?? HUNGER_MAX}/${HUNGER_MAX} · ${this.timeOfDayName(hour)} ${this.gameClockText(hour)} · ${location} · 걸음 ${Math.floor(save.player.totalSteps)} · 아이템칸 ${filledSlots}`;
  }

  private createSaveData(): SavedGame {
    const now = performance.now();
    return createSaveDataFromSnapshot({
      nowMs: now,
      player: {
        position: this.playerPosition,
        previousPosition: this.previousPosition,
        bodyPosition: this.playerBodyPosition,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        maxHealth: this.maxHealth,
        level: this.level,
        experience: this.experience,
        playerClass: this.playerClass,
        mana: this.mana,
        maxMana: this.maxMana,
        classSkillCooldownUntil: this.classSkillCooldownUntil,
        companionProgress: this.summonerCompanion.companionProgress(),
        tutorial: this.tutorialProgress,
        hunger: this.hunger,
        hungerTimer: this.hungerTimer,
        worldTimeSeconds: this.worldTimeSeconds,
        worldMapId: this.currentWorldMapId,
        bossChapter: this.bossChapter,
        totalSteps: this.totalSteps,
        chestStepBank: this.chestStepBank,
        caveStepBank: this.caveStepBank,
        equippedArmor: this.equippedArmor,
        equippedShield: this.equippedShield,
        shieldDurabilityUsed: this.shieldDurabilityUsed,
        ironGuardUntil: this.ironGuardUntil,
        locationMode: this.locationMode,
        currentHouseKind: this.currentHouseKind,
        caveReturnPosition: this.caveReturnPosition,
        houseReturnPosition: this.houseReturnPosition,
        toolUses: { ...this.toolUses },
        selectedHotbarIndex: this.selectedHotbarIndex,
        hotbar: this.hotbar,
        bagSlots: this.bagSlots,
        craftSlots: this.craftSlots,
        workbenchSlots: this.workbenchSlots,
      },
      mountains: this.mountains,
      objects: this.objects.values(),
      excludedObjectIds: [...this.caveObjectIds, ...this.houseObjectIds],
      worldStates: this.worldStates,
    });
  }

  private migrateSaveData(save: PartialSavedGame): SavedGame {
    return migratePartialSaveData(save);
  }

  private restoreSaveData(sourceSave: SavedGame | PartialSavedGame) {
    const save = this.migrateSaveData(sourceSave);
    this.resetGameState({ reseed: false });
    this.currentWorldMapId = save.player.worldMapId ?? DEFAULT_WORLD_MAP_ID;
    this.bossChapter = normalizeBossChapter(save.player.bossChapter);
    this.activeRegions = regionsForWorldMap(this.currentWorldMapId);
    this.activeBiomes = biomesForWorldMap(this.currentWorldMapId); this.activeWaterZones = waterZonesForWorldMap(this.currentWorldMapId); this.biomeDecorContext.biomes = this.activeBiomes;
    installWorldStates(this.worldStates, save.worldStates, this.currentWorldMapId, { mountains: save.mountains, objects: save.objects });
    const worldState = this.worldStates[this.currentWorldMapId] ?? { mountains: save.mountains, objects: save.objects };
    for (const mountain of worldState.mountains) this.spawnMountain(this.fromSavedVector(mountain.position), mountain.radius, mountain.height);
    createBiomeDecor(this.biomeDecorContext);
    let skippedObjects = 0;
    for (const savedObject of worldState.objects) {
      try {
        this.restoreWorldObject(savedObject);
      } catch (error) {
        skippedObjects += 1;
        console.warn("Skipped incompatible saved object.", error, savedObject);
      }
    }
    this.ensureVillageShops();

    restoreSlots(this.hotbar, save.player.hotbar);
    this.ensureHotbarSize();
    restoreSlots(this.bagSlots, save.player.bagSlots);
    for (let index = 0; index < this.craftSlots.length; index += 1) {
      copySavedSlot(this.craftSlots[index], save.player.craftSlots[index]);
    }
    for (let index = 0; index < this.workbenchSlots.length; index += 1) {
      copySavedSlot(this.workbenchSlots[index], save.player.workbenchSlots?.[index]);
    }

    this.playerPosition.copy(this.fromSavedVector(save.player.position));
    this.previousPosition.copy(this.fromSavedVector(save.player.previousPosition));
    this.yaw = save.player.yaw;
    this.pitch = save.player.pitch;
    this.level = Math.max(1, Math.floor(save.player.level));
    this.experience = Math.max(0, Math.floor(save.player.experience));
    this.maxHealth = Math.max(save.player.maxHealth, this.maxHealthForLevel());
    this.health = Math.min(save.player.health, this.maxHealth);
    this.playerClass = save.player.playerClass ?? "warrior";
    this.pendingPlayerClass = this.playerClass;
    this.refreshHandColor();
    this.maxMana = save.player.maxMana ?? BASE_MAX_MANA;
    this.mana = Math.min(save.player.mana ?? this.maxMana, this.maxMana);
    this.classSkillCooldownUntil = performance.now() + (save.player.classSkillCooldownRemainingMs ?? 0);
    this.possessedEagleId = null; this.eaglePossessionEndsAt = 0;
    this.eagleClawCooldownUntil = 0; this.windCutterCooldownUntil = 0;
    this.summonerCompanion.restore(save.player.companionProgress);
    this.tutorialProgress.completedStepIds.splice(0, this.tutorialProgress.completedStepIds.length, ...(save.player.tutorial?.completedStepIds ?? []));
    this.playerBodyPosition = null;
    this.renderClassSelection();
    this.hunger = save.player.hunger ?? HUNGER_MAX;
    this.hungerTimer = save.player.hungerTimer ?? 0;
    this.worldTimeSeconds = save.player.worldTimeSeconds ?? DAY_LENGTH_SECONDS * (8 / 24);
    this.timeHudTimer = 0;
    this.starvationTimer = 0;
    this.starvationNoticeTimer = 0;
    this.dragonSpawnTimer = 0;
    this.totalSteps = save.player.totalSteps;
    this.lastHudStepCount = Math.floor(this.totalSteps);
    this.movementHudTimer = 0;
    this.chestStepBank = save.player.chestStepBank;
    this.caveStepBank = save.player.caveStepBank;
    this.equippedArmor = save.player.equippedArmor;
    this.equippedShield = save.player.equippedShield ?? null;
    this.shieldDurabilityUsed = save.player.shieldDurabilityUsed ?? 0;
    this.ironGuardUntil = performance.now() + (save.player.ironGuardRemainingMs ?? 0);
    this.locationMode = save.player.locationMode;
    this.currentHouseKind = save.player.currentHouseKind ?? "home";
    this.caveReturnPosition = save.player.caveReturnPosition ? this.fromSavedVector(save.player.caveReturnPosition) : null;
    this.houseReturnPosition = save.player.houseReturnPosition ? this.fromSavedVector(save.player.houseReturnPosition) : null;
    Object.keys(this.toolUses).forEach((item) => delete this.toolUses[item]);
    Object.assign(this.toolUses, save.player.toolUses ?? {});
    this.selectedHotbarIndex = Math.min(save.player.selectedHotbarIndex, this.hotbar.length - 1);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.settlePlayerAfterTeleport();
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
    if (skippedObjects > 0) this.showMessage(`현재 버전과 맞지 않는 저장 오브젝트 ${skippedObjects}개는 건너뛰었습니다.`);
  }

  private resetGameState(options: { reseed?: boolean } = {}) {
    const reseed = options.reseed ?? true;
    this.closePanel();
    this.setSprintRenderOptimizations(false);
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
    this.bagSlots.splice(0, this.bagSlots.length, ...Array.from({ length: BASE_BAG_SLOT_COUNT }, () => ({ item: null, count: 0 })));
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
    this.pendingMouseX = 0;
    this.pendingMouseY = 0;
    this.playerPosition.set(0, PLAYER_HEIGHT, 12);
    this.currentWorldMapId = DEFAULT_WORLD_MAP_ID;
    this.activeRegions = regionsForWorldMap(this.currentWorldMapId);
    this.activeBiomes = biomesForWorldMap(this.currentWorldMapId); this.activeWaterZones = waterZonesForWorldMap(this.currentWorldMapId); this.biomeDecorContext.biomes = this.activeBiomes;
    clearWorldStateStore(this.worldStates);
    this.regionWarningState = { regionId: null, lastWarnAt: 0 };
    this.previousPosition.copy(this.playerPosition);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.jumpWasDown = false;
    this.totalSteps = 0;
    this.chestStepBank = 0;
    this.caveStepBank = 0;
    this.antStepBank = 0;
    this.bossChapter = 0;
    this.level = 1;
    this.experience = 0;
    this.health = BASE_PLAYER_MAX_HEALTH;
    this.maxHealth = BASE_PLAYER_MAX_HEALTH;
    this.maxMana = BASE_MAX_MANA;
    this.mana = this.maxMana;
    this.classSkillCooldownUntil = 0;
    this.healItemCooldownUntil = 0;
    this.possessedEagleId = null; this.eaglePossessionEndsAt = 0;
    this.eagleClawCooldownUntil = 0; this.windCutterCooldownUntil = 0;
    this.summonerCompanion.reset();
    this.tutorialProgress.completedStepIds.splice(0);
    this.playerBodyPosition = null;
    this.hunger = HUNGER_MAX;
    this.hungerTimer = 0;
    this.worldTimeSeconds = DAY_LENGTH_SECONDS * (8 / 24);
    this.timeHudTimer = 0;
    this.starvationTimer = 0;
    this.starvationNoticeTimer = 0;
    this.equippedArmor = null;
    this.equippedShield = null; this.shieldDurabilityUsed = 0; this.ironGuardUntil = 0;
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
    this.actionMode = "use";
    this.rangedCooldown = 0;
    this.footstepDistance = 0;
    this.movementHudTimer = 0;
    this.lastHudStepCount = 0;
    this.shadowRefreshTimer = 0;
    this.shadowRefreshInterval = 0.4;
    this.performanceSampleTimer = 0;
    this.performanceSampleFrames = 0;
    this.performanceSampleSum = 0;
    this.performanceSlowFrames = 0;
    this.performanceHitchFrames = 0;
    this.qualityMode = "high";
    this.visibilityCullTimer = 0;
    this.visibilityCullCursor = 0;
    this.performanceWarmupTimer = 0;
    this.performanceSampleTimer = 0;
    this.performanceSampleFrames = 0;
    this.performanceSampleSum = 0;
    this.performanceSlowFrames = 0;
    this.performanceHitchFrames = 0;
    this.renderer.setPixelRatio(this.pixelRatioForQuality());
    applyShadowQuality(this.sunLight, this.qualityMode);
    refreshTrackedVisualVisibility(this.outlineVisuals, this.qualityMode, false);
    this.renderer.shadowMap.needsUpdate = true;
    this.nightSpawnTimer = 0;
    this.applyClassStarterLoadout();
    this.setOverworldAtmosphere();
    this.settlePlayerAfterTeleport();
    this.camera.rotation.set(0, 0, 0, "YXZ");
    this.panelEl.innerHTML = "";
    if (reseed) this.renderHud();
  }

  private applyClassStarterLoadout() {
    const starterItem = PLAYER_CLASSES[this.playerClass]?.starterItem ?? "iron_sword";
    this.hotbar[1] = { item: starterItem, count: 1 };
    this.hotbar[2] = { item: "medkit", count: 15 };
    if (isShieldItem(starterItem)) { this.equippedShield = starterItem; this.shieldDurabilityUsed = 0; }
    this.selectedHotbarIndex = 1;
  }

  private clearWorld() {
    this.suppressRespawn = true; this.clearCaveObjects();
    this.clearHouseObjects();
    this.clearBiomeMeshes();
    this.clearAreaSkillEffects();
    this.clearDamageParticles();
    this.clearProjectiles();
    for (const id of [...this.objects.keys()]) this.removeObject(id);
    for (const mesh of this.mountainMeshes) this.scene.remove(mesh);
    this.mountainMeshes.splice(0, this.mountainMeshes.length);
    this.mountains.splice(0, this.mountains.length);
    this.raycastTargets.splice(0, this.raycastTargets.length);
    this.raycastTargetsByObject.clear();
    this.objectIdsByType.clear();
    this.spatialBuckets.clear();
    this.spatialKeysByObject.clear();
    this.waterObjects.splice(0, this.waterObjects.length);
    this.waterRippleMeshes.splice(0, this.waterRippleMeshes.length);
    this.waterSurfaceMeshes.splice(0, this.waterSurfaceMeshes.length);
    this.sprintHiddenVisuals.splice(0, this.sprintHiddenVisuals.length);
    this.outlineVisuals.splice(0, this.outlineVisuals.length);
    this.sprintRenderOptimized = false;
    this.caveObjectIds.splice(0, this.caveObjectIds.length);
    this.objects.clear();
    this.respawnQueue.splice(0, this.respawnQueue.length); this.suppressRespawn = false;
  }

  private clearAreaSkillEffects() {
    for (const effect of this.areaSkillEffects) {
      this.scene.remove(effect.mesh);
      this.disposeObject3D(effect.mesh);
    }
    this.areaSkillEffects.splice(0, this.areaSkillEffects.length);
  }

  private clearDamageParticles() {
    for (const particle of this.damageParticles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      if (particle.mesh.material instanceof THREE.Material) particle.mesh.material.dispose();
    }
    this.damageParticles.splice(0, this.damageParticles.length);
  }

  private removeProjectile(index: number) {
    const projectile = this.projectiles[index];
    if (!projectile) return;
    this.scene.remove(projectile.mesh);
    this.disposeObject3D(projectile.mesh);
    this.projectiles.splice(index, 1);
  }

  private clearProjectiles() {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) this.removeProjectile(index);
  }

  private disposeObject3D(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!this.sharedMaterials.has(material)) material.dispose();
      }
    });
  }

  private ensureVillageShops() {
    const villages = new Map<string, { center: THREE.Vector3; hasFoodStorage: boolean; hasShop: boolean; hasSellShop: boolean }>();
    for (const object of this.objects.values()) {
      if (!object.villageId) continue;
      const entry = villages.get(object.villageId) ?? { center: object.root.position.clone(), hasFoodStorage: false, hasShop: false, hasSellShop: false };
      if (object.type === "foodStorage") {
        entry.center.copy(object.root.position);
        entry.hasFoodStorage = true;
      }
      if (object.type === "villageShop") entry.hasShop = true;
      if (object.type === "villageSellShop") entry.hasSellShop = true;
      villages.set(object.villageId, entry);
    }
    for (const [villageId, village] of villages) {
      if (!village.hasFoodStorage) continue;
      if (!village.hasShop) {
        const position = village.center.clone().add(new THREE.Vector3(10, 0, 8));
        position.y = this.getGroundHeightAt(position.x, position.z);
        this.spawnVillageShop(position, villageId);
      }
      if (!village.hasSellShop) {
        const position = village.center.clone().add(new THREE.Vector3(10, 0, -8));
        position.y = this.getGroundHeightAt(position.x, position.z);
        this.spawnVillageSellShop(position, villageId);
      }
    }
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
    if (savedObject.type === "bed") object = spawnBedObject(this.spawnContext, position, savedObject.rotationY ?? 0);
    if (savedObject.type === "buildingBlock") object = spawnBuildingBlockObject(this.spawnContext, position);
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
    if (savedObject.type === "animal") object = spawnAnimalEntity(this.entitySpawnContext, position, savedObject.animalKind);
    if (savedObject.type === "villager") object = this.spawnVillager(position, villageId, savedObject.homePosition ? this.fromSavedVector(savedObject.homePosition) : position, savedObject.roamRadius);
    if (savedObject.type === "blacksmithNpc") object = this.spawnBlacksmithNpc(position, villageId);
    if (savedObject.type === "villageKnight") object = this.spawnKnight(position, villageId);
    if (savedObject.type === "villageArcher" || savedObject.type === "villageMage") object = this.spawnRangedGuard(position, villageId, savedObject.type);
    if (savedObject.type === "villageGolem") object = this.spawnGolem(position, villageId);
    if (savedObject.type === "foodStorage" || savedObject.type === "villageHouse") {
      object = this.spawnVillageHouse(position, savedObject.name, savedObject.type === "foodStorage", villageId, savedObject.houseKind === "twoStory" ? 3 : 0);
    }
    if (savedObject.type === "blacksmith") object = this.spawnBlacksmith(position, villageId);
    if (savedObject.type === "villageShop") object = this.spawnVillageShop(position, villageId);
    if (savedObject.type === "villageSellShop") object = this.spawnVillageSellShop(position, villageId);
    if (savedObject.type === "workbench" || savedObject.type === "extendedWorkbench") object = spawnWorkbenchObject(this.spawnContext, position, savedObject.type === "extendedWorkbench");
    if (savedObject.type === "smelter" || savedObject.type === "specialSmelter") object = spawnSmelterObject(this.spawnContext, position, savedObject.type === "specialSmelter");
    if (savedObject.type === "grinder") object = spawnGrinderObject(this.spawnContext, position);
    if (savedObject.type === "antHill") object = this.spawnAntHill(position, savedObject.antMeatRemaining);
    if (savedObject.type === "wildPredator") object = spawnPredatorEntity(this.entitySpawnContext, position, savedObject.predatorKind);
    if (savedObject.type === "dragon") object = spawnDragonEntity(this.entitySpawnContext, position, savedObject.bossKind);
    if (savedObject.type === "jammini") object = spawnJamminiEntity(this.entitySpawnContext, position);
    if (savedObject.type === "legoHazard") object = this.spawnLegoHazard(position);
    if (savedObject.type === "villageKing") object = this.spawnKing(position, villageId);
    if (savedObject.type === "villageFence") {
      const radius = savedObject.terrainRadius ?? 20;
      object = this.spawnVillageFence(position, radius, villageId);
      this.spawnVillageGroundDecor(position.clone(), Math.max(8, radius - 2), radius > 30);
    }

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
    object.bossKind = savedObject.bossKind;
    object.regionId = savedObject.regionId;
    object.monsterId = savedObject.monsterId;
    object.monsterLevel = savedObject.monsterLevel;
    object.lootTier = savedObject.lootTier; object.expiresAt = savedObject.expiresRemainingMs !== undefined ? performance.now() + savedObject.expiresRemainingMs : object.opened && (object.type === "chest" || object.type === "mineChest") ? performance.now() + 8_000 : object.expiresAt;
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

  private markVisualOnly(root: THREE.Object3D) {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.skipRaycastTarget = true;
    });
  }

  private paintGeometry(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    const vertexCount = geometry.attributes.position.count;
    const paint = new THREE.Color(color);
    const colors: number[] = [];
    for (let index = 0; index < vertexCount; index += 1) colors.push(paint.r, paint.g, paint.b);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }

  private fromSavedVector(vector: SavedVector | null | undefined, fallback = new THREE.Vector3()): THREE.Vector3 {
    return restoreVectorFromSave(vector, fallback);
  }

  private renderHud() {
    const armor = this.equippedArmorValue();
    const equipmentArmor = this.equipmentArmorValue();
    const statBonus = this.levelStatBonus();
    const attack = this.displayedAttackPower();
    const healthValue = Math.max(0, Math.ceil(this.health));
    const manaValue = Math.floor(this.mana);
    const hour = this.gameHour();
    const playerClass = PLAYER_CLASSES[this.playerClass];
    const passive = CLASS_PASSIVES[this.playerClass];
    const skillCooldown = this.classSkillCooldownRemaining();
    const eagle = this.possessedEagleId ? this.objects.get(this.possessedEagleId) : null;
    const eagleSkillStatus = eagle ? formatEagleSkillStatus(this.eagleClawCooldownUntil, this.windCutterCooldownUntil) : undefined;
    const petProgress = this.summonerCompanion.petProgress();
    const petStatus =
      this.playerClass === "summoner"
        ? `펫 Lv ${petProgress.level} · ${petProgress.experience}/${experienceForNextPetLevel(petProgress.level)} XP · 공격 ${summonerPetDamage(petProgress)}`
        : undefined;
    const tankerStatus = tankerHudStatus(this.equippedShield, this.shieldDurabilityUsed, this.ironGuardUntil, performance.now());
    renderHudView(
      {
        statsEl: this.statsEl,
        objectiveEl: this.objectiveEl,
        hotbarEl: this.hotbarEl,
      },
      this.hudRenderCache,
      {
        level: this.level,
        className: playerClass.name,
        attack,
        armor,
        health: healthValue,
        maxHealth: this.maxHealth,
        mana: manaValue,
        maxMana: this.maxMana,
        hunger: this.hunger,
        maxHunger: HUNGER_MAX,
        experience: this.experience,
        requiredExperience: this.experienceForNextLevel(),
        skillStatus: skillCooldown > 0 ? `${Math.ceil(skillCooldown)}초` : `R ${playerClass.skillName}`,
        passiveStatus: passive.label,
        petStatus: this.playerClass === "tanker" ? tankerStatus : petStatus,
        equipmentArmor,
        equippedGearLabel: [this.equippedArmor, this.equippedShield].filter((item): item is ItemId => Boolean(item)).map((item) => ITEM_NAMES[item] ?? item).join(" · ") || undefined,
        statBonus,
        eagleHp: eagle ? eagle.hp ?? EAGLE_MAX_HP : undefined,
        eagleMaxHp: EAGLE_MAX_HP,
        eagleSkillStatus,
        timeLabel: `${this.timeOfDayName(hour)} ${this.gameClockText(hour)}`,
        locationLabel: this.locationMode === "cave" ? "동굴" : this.locationMode === "house" ? "집 안" : "야생",
        arcadePoints: this.arcadePoints,
        totalSteps: this.totalSteps,
        objective: this.currentObjectiveView(),
        selectedHotbarIndex: this.selectedHotbarIndex,
        hotbar: this.hotbar.map((slot) => ({
          label: slot.item ? `${this.shortName(slot.item)} ${slot.count}` : "",
        })),
      },
      (index) => {
        this.selectedHotbarIndex = index;
        this.renderHud();
      },
    );
  }

  private updateBossBar() {
    let dragon: WorldObject | null = null;
    let nearestDistance = Infinity;
    if (this.locationMode === "overworld") {
      for (const candidate of this.objectsOfType("dragon")) {
        const centerDistance = Math.hypot(candidate.root.position.x - this.playerPosition.x, candidate.root.position.z - this.playerPosition.z);
        const surfaceDistance = Math.max(0, centerDistance - (candidate.collisionRadius ?? 0));
        if (surfaceDistance <= DRAGON_BOSS_BAR_DISTANCE && surfaceDistance < nearestDistance) {
          dragon = candidate;
          nearestDistance = surfaceDistance;
        }
      }
    }
    if (!dragon) {
      this.bossBarEl.classList.add("hidden");
      this.bossBarEl.innerHTML = "";
      return;
    }
    const stats = this.bossStats(dragon.bossKind);
    const hp = Math.max(0, Math.ceil(dragon.hp ?? stats.maxHp));
    const ratio = THREE.MathUtils.clamp(hp / stats.maxHp, 0, 1);
    this.bossBarEl.classList.remove("hidden");
    const html = `
      <div class="boss-title">${stats.name}${isBossUnlocked(dragon.bossKind ?? "dragon", this.bossChapter) ? "" : " · 봉인됨"}</div>
      <div class="boss-meter"><span style="width:${(ratio * 100).toFixed(1)}%"></span></div>
      <div class="boss-hp">${hp}/${stats.maxHp}</div>
    `;
    if (this.bossBarEl.innerHTML !== html) this.bossBarEl.innerHTML = html;
  }

  private currentObjectiveView(): TutorialObjective {
    return currentObjective({
      health: this.health,
      hunger: this.hunger,
      wood: this.countItem("wood"),
      hammer: this.countItem("hammer"),
      craftingTable: this.countItem("crafting_table"),
      leather: this.countItem("leather"),
      stone: this.countItem("stone"),
      hasWorkbench: this.hasWorldObjectType("workbench", "extendedWorkbench"),
      hasPickaxe: ["stone_pickaxe", "copper_pickaxe", "iron_pickaxe", "diamond_pickaxe"].some((item) => this.countItem(item) > 0),
      hasBag: this.bagSlots.length >= EXPANDED_BAG_SLOT_COUNT,
      hasBasicWeapon: ["wood_dagger", "wood_sword", "stone_dagger", "stone_sword"].some((item) => this.countItem(item as ItemId) > 0),
      hasBasicArmor: Boolean(this.equippedArmor) || ["leather_armor", "copper_armor", "iron_armor"].some((item) => this.countItem(item as ItemId) > 0),
      hasSmelter: this.hasWorldObjectType("smelter", "specialSmelter"),
      smelter: this.countItem("smelter"),
      bossChapter: this.bossChapter,
      completedStepIds: this.tutorialProgress.completedStepIds,
    });
  }

  private hasWorldObjectType(...types: ObjectType[]) {
    return types.some((type) => (this.objectIdsByType.get(type)?.size ?? 0) > 0);
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
    if (this.currentPanel === "shop") this.renderPointShopPanel();
    if (this.currentPanel === "sellShop") this.renderSellShopPanel();
    if (this.currentPanel === "loadGame") this.renderLoadGamePanel();
    if (this.currentPanel === "cheat") this.renderCheatPanel();
    if (this.currentPanel === "map") this.renderRegionMapPanel();
  }

  private renderRegionMapPanel() {
    const nextBossKind = nextBossTarget(this.bossChapter)?.kind;
    const bosses = [...this.objectsOfType("dragon")].map((dragon) => ({ name: this.bossStats(dragon.bossKind).name, x: dragon.root.position.x, z: dragon.root.position.z, sealed: !isBossUnlocked(dragon.bossKind ?? "dragon", this.bossChapter), next: (dragon.bossKind ?? "dragon") === nextBossKind }));
    renderRegionMapPanel(this.panelEl, { regions: this.activeRegions, currentRegionId: regionAtPosition(this.playerPosition, this.activeRegions)?.id ?? null, player: { x: this.playerPosition.x, z: this.playerPosition.z, yaw: this.yaw, level: this.level }, worldSize: WORLD_SIZE, waterZones: this.activeWaterZones.map((zone) => ({ center: zone.center, radius: this.waterZoneRadius(zone), name: zone.name })), worldMaps: WORLD_MAPS.map((map) => ({ map, current: map.id === this.currentWorldMapId, canTeleport: canTeleportToWorldMap(this.level, map), lockReason: worldMapLockReason(this.level, map) })), bosses }, { onClose: () => this.closePanel(), onTeleport: (mapId) => this.teleportToWorldMap(mapId) });
  }

  private teleportToWorldMap(mapId: string) {
    const map = getWorldMapById(mapId);
    if (map.id === this.currentWorldMapId) return;
    if (!canTeleportToWorldMap(this.level, map)) { this.showMessage(worldMapLockReason(this.level, map)); this.renderRegionMapPanel(); return; }
    rememberWorldState(this.worldStates, this.currentWorldMapId, this.createSaveData().worldStates?.[this.currentWorldMapId]);
    this.currentWorldMapId = map.id; this.activeRegions = regionsForWorldMap(map.id); this.activeBiomes = biomesForWorldMap(map.id); this.activeWaterZones = waterZonesForWorldMap(map.id); this.biomeDecorContext.biomes = this.activeBiomes; this.regionWarningState = { regionId: null, lastWarnAt: 0 };
    this.locationMode = "overworld"; this.clearWorld(); const worldState = this.worldStates[map.id];
    if (worldState) { for (const mountain of worldState.mountains) this.spawnMountain(this.fromSavedVector(mountain.position), mountain.radius, mountain.height); createBiomeDecor(this.biomeDecorContext); for (const savedObject of worldState.objects) this.restoreWorldObject(savedObject); this.ensureVillageShops(); } else this.seedOverworld();
    this.playerPosition.copy(map.spawn); this.playerPosition.y = this.getOverworldHeightAt(map.spawn.x, map.spawn.z) + PLAYER_HEIGHT;
    this.previousPosition.copy(this.playerPosition); this.setOverworldAtmosphere(); this.settlePlayerAfterTeleport(); this.closePanel();
    this.showMessage(`${map.name}으로 텔레포트했습니다. 이 맵의 권장 레벨은 Lv ${map.levelRange[0]}-${map.levelRange[1]}입니다.`);
  }

  private renderInventoryPanel() {
    const slotView = (slot: Slot, source: "hotbar" | "bag", index: number, extraClass = "") => ({
      item: slot.item,
      label: slot.item ? this.shortName(slot.item) : "",
      count: slot.count,
      source,
      index,
      extraClass,
      moveSelected: this.pendingStorageMove?.source === source && this.pendingStorageMove.index === index,
    });
    const bagSlots = this.bagSlots.map((slot, index) => slotView(slot, "bag", index));

    const itemCounts = this.itemCounts();
    renderInventoryPanelView(
      this.panelEl,
      {
        hotbarCount: this.hotbar.length,
        hotbar: this.hotbar.map((slot, index) => slotView(slot, "hotbar", index, " hotbar-cell")),
        bagLabel: this.bagSlots.length >= EXPANDED_BAG_SLOT_COUNT ? "40칸" : "기본 8칸",
        bagSlots,
        craftSlots: this.craftSlots.map((slot) => ({
          item: slot.item,
          label: slot.item ? this.shortName(slot.item) : "",
          count: slot.count,
        })),
        materials: Object.entries(itemCounts)
          .filter(([item]) => item !== "tutorial_book")
          .map(([item, count]) => ({
            item,
            label: this.shortName(item),
            count,
            selected: this.selectedCraftItem === item,
          })),
        houseBuildOptions: HOUSE_BUILD_OPTIONS.map((option) => ({
          id: option.id,
          name: option.name,
          description: option.description,
          ingredientsLabel: this.formatItemBundle(option.ingredients),
          canBuild: this.hasIngredients(option.ingredients) && this.locationMode === "overworld",
        })),
        recipeGuide: buildRecipeGuideEntriesForStations(itemCounts, ["mini"]),
      },
      {
        onClose: () => this.closePanel(),
        onSelectItem: (item) => {
          this.selectedCraftItem = item;
          this.renderInventoryPanel();
        },
        onCraftSlotClick: (index) => this.handleCraftSlotClick(index),
        onMiniCraft: () => this.craftMiniRecipe(),
        onClearCraft: () => this.clearCraftSlots(),
        onBuildHouse: (id) => this.buildPlayerHouse(id),
        onCraftGuide: (guideId) => { const recipe = MINI_RECIPES.find((candidate) => guideId === `mini:${candidate.id}`); if (!recipe || !this.canCraft(recipe)) return; if (!canReceiveRecipeOutput(this.allStorageSlots(), recipe, (item) => this.isDurableTool(item), recipe.ingredients)) { this.showMessage("인벤토리에 제작 결과물을 넣을 공간이 없습니다. 빈 칸을 만든 뒤 제작하세요."); return; } for (const [item, count] of Object.entries(recipe.ingredients)) this.removeItem(item, count); this.addCraftedOutput(recipe); this.showMessage(`제작 완료! ${recipe.name}을 만들었습니다.`); this.renderPanel(); this.renderHud(); },
        bindDragDrop: () => this.bindInventoryDragDrop(),
      },
    );
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
          <p>제련대 1개 + 망치 1개 -> 특수 제련대 1개</p>
          <p>망치 2개 + 철 6개 -> 분쇄기 1개</p>
          <p>다이아몬드 가루 6개 + 제련된 나무 6개 + 돌 6개 -> 거울 1개</p>
          <p>제련된 나무 3개 + 막대기 2개 -> 날카로운 나무 도끼</p>
          <p>일반 나무 3개 + 막대기 2개 -> 약한 나무 도끼</p>
          <p>돌 4개 + 막대기 2개 -> 돌 곡괭이</p>
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
    const recipes = this.workbenchRecipesForStation(isExtended);
    const currentRecipe = this.workbenchRecipeFromSlots(isExtended);
    const gridSize = isExtended ? "6x6" : "3x3";
    const resultLabel = currentRecipe ? `${currentRecipe.name} ${currentRecipe.count}` : "조합 대기";
    renderWorkbenchPanelView(
      this.panelEl,
      {
        isExtended,
        gridSize,
        resultLabel,
        resultReady: currentRecipe !== null,
        slots: this.activeWorkbenchSlots(isExtended).map((slot) => ({
          item: slot.item,
          label: slot.item ? this.shortName(slot.item) : "",
          count: slot.count,
        })),
        materials: Object.entries(this.itemCounts())
          .filter(([item]) => item !== "tutorial_book")
          .map(([item, count]) => ({
            item,
            label: this.shortName(item),
            count,
            selected: this.selectedCraftItem === item,
          })),
        recipes: recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          ingredientsLabel: Object.entries(recipe.ingredients)
            .map(([item, count]) => `${ITEM_NAMES[item] ?? item} ${count}`)
            .join(" + "),
          outputLabel: `${ITEM_NAMES[recipe.output] ?? recipe.output} ${recipe.count}`,
          note: recipe.note,
          canCraft: this.canCraft(recipe),
        })),
      },
      {
        onClose: () => this.closePanel(),
        onSelectItem: (item) => {
          this.selectedCraftItem = item;
          this.renderWorkbenchPanel();
        },
        onSlotClick: (index) => this.handleWorkbenchSlotClick(index),
        onCraft: () => this.craftWorkbenchSlots(),
        onClear: () => this.clearWorkbenchSlots(),
        onFillRecipe: (recipeId) => this.fillWorkbenchRecipe(recipeId),
        onCraftRecipe: (recipeId) => this.craftWorkbenchRecipe(recipeId),
        bindDragDrop: () => this.bindInventoryDragDrop(),
      },
    );
  }

  private renderSmelterPanel() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isSpecial = station?.type === "specialSmelter";
    const rawItems = this.smelterMaterials(isSpecial);
    this.panelEl.innerHTML = `
      <section class="panel smelter-panel">
        <header>
          <h2>${isSpecial ? "특수 제련대" : "제련대"}</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${rawItems
            .map((item) => {
              const output = this.smeltOutputFor(item);
              const disabled = this.countItem(item) <= 0 ? "disabled" : "";
              return `<article class="recipe-card">
                <div>
                  <strong>${ITEM_NAMES[item]} 제련</strong>
                  <p>${ITEM_NAMES[item]} 1 -> ${ITEM_NAMES[output]} 1</p>
                </div>
                <button data-smelt="${item}" ${disabled}>제련</button>
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

  private renderPointShopPanel() {
    this.panelEl.innerHTML = `
      <section class="panel shop-panel">
        <header>
          <div>
            <h2>마을 상점</h2>
            <p class="inventory-subtitle">미니게임 포인트로 아이템을 사고, 용 전리품을 포인트로 바꿉니다. 현재 보유 ${this.arcadePoints}P</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes shop-list">
          ${POINT_SHOP_OFFERS.map((offer) => {
            const receive = this.formatItemBundle(offer.receive);
            const disabled = this.arcadePoints >= offer.cost ? "" : "disabled";
            return `<article class="recipe-card shop-card">
              <div>
                <strong>${offer.name}</strong>
                <p>${offer.cost}P -> ${receive}</p>
                <small>${offer.note}</small>
              </div>
              <button data-shop-buy="${offer.id}" ${disabled}>구매</button>
            </article>`;
          }).join("")}
        </div>
        <h3 class="shop-section-title">용 전리품 교환</h3>
        <div class="recipes shop-list">
          ${POINT_EXCHANGE_OFFERS.map((offer) => {
            const owned = this.countItem(offer.item);
            const disabled = owned > 0 ? "" : "disabled";
            return `<article class="recipe-card shop-card">
              <div>
                <strong>${offer.name}</strong>
                <p>${ITEM_NAMES[offer.item]} 1개 -> ${offer.points}P</p>
                <small>보유 ${owned}개</small>
              </div>
              <button data-shop-exchange="${offer.id}" ${disabled}>교환</button>
            </article>`;
          }).join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-shop-buy]").forEach((button) => {
      button.addEventListener("click", () => this.buyFromPointShop(button.dataset.shopBuy ?? ""));
    });
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-shop-exchange]").forEach((button) => {
      button.addEventListener("click", () => this.exchangeDragonLootForPoints(button.dataset.shopExchange ?? ""));
    });
  }

  private renderSellShopPanel() {
    this.panelEl.innerHTML = `
      <section class="panel shop-panel">
        <header>
          <div>
            <h2>마을 판매소</h2>
            <p class="inventory-subtitle">상점 가격보다 조금 낮은 가격으로 아이템을 팔아 미니게임 포인트를 받습니다. 현재 보유 ${this.arcadePoints}P</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes shop-list">
          ${SELL_SHOP_OFFERS.map((offer) => {
            const owned = this.countItem(offer.item);
            const disabled = owned > 0 ? "" : "disabled";
            return `<article class="recipe-card shop-card">
              <div>
                <strong>${ITEM_NAMES[offer.item] ?? offer.item}</strong>
                <p>${ITEM_NAMES[offer.item] ?? offer.item} 1개 -> ${offer.points}P</p>
                <small>상점 기준 ${offer.shopUnitPrice}P보다 낮은 매입가 · 보유 ${owned}개</small>
              </div>
              <button data-sell-offer="${offer.id}" ${disabled}>판매</button>
            </article>`;
          }).join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-sell-offer]").forEach((button) => {
      button.addEventListener("click", () => this.sellToVillageShop(button.dataset.sellOffer ?? ""));
    });
  }

  private renderLoadGamePanel() {
    const saves = this.readSaveSlots();
    renderLoadGamePanelView(
      this.panelEl,
      saves.map((slot) => ({
        id: slot.id,
        label: slot.label,
        summary: this.saveSummary(slot.save),
        objectCount: slot.save.objects.length,
        mountainCount: slot.save.mountains.length,
      })),
      {
        onClose: () => this.closePanel(),
        onLoad: (slotId) => this.loadSaveSlot(slotId),
      },
    );
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
        this.pendingStorageMove = null;
        event.dataTransfer.effectAllowed = "move";
        const payload = JSON.stringify({
          item,
          source: element.dataset.slotSource ?? null,
          index: element.dataset.slotIndex ?? null,
        });
        event.dataTransfer.setData("application/json", payload);
        event.dataTransfer.setData("text/plain", payload);
      });
    });

    this.panelEl.querySelectorAll<HTMLElement>("[data-slot-source][data-slot-index]").forEach((element) => {
      const targetSource = element.dataset.slotSource;
      const targetIndex = Number(element.dataset.slotIndex);
      if (!this.isStorageSlotSource(targetSource) || !Number.isInteger(targetIndex)) return;
      element.addEventListener("dragover", (event) => {
        event.preventDefault();
        element.classList.add("drag-over");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      element.addEventListener("dragleave", () => element.classList.remove("drag-over"));
      element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drag-over");
        const raw = event.dataTransfer?.getData("application/json") || event.dataTransfer?.getData("text/plain");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as { source?: string | null; index?: string | null };
          if (!this.isStorageSlotSource(payload.source) || payload.index === null || payload.index === undefined) return;
          this.swapStorageSlots(payload.source, Number(payload.index), targetSource, targetIndex);
        } catch {
          this.showMessage("아이템 위치를 바꾸지 못했습니다.");
        }
      });
      element.addEventListener("click", () => this.handleStorageSlotClick(targetSource, targetIndex));
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
      const raw = event.dataTransfer?.getData("application/json") || event.dataTransfer?.getData("text/plain");
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

  private handleStorageSlotClick(source: "hotbar" | "bag", index: number) {
    const slot = this.inventorySlotBySource(source, index);
    if (!slot) return;
    if (!this.pendingStorageMove) {
      if (!slot.item) return;
      this.pendingStorageMove = { source, index };
      this.renderInventoryPanel();
      this.showMessage("옮길 아이템을 선택했습니다. 이동할 핫바/가방 칸을 누르세요.");
      return;
    }
    const pending = this.pendingStorageMove;
    this.pendingStorageMove = null;
    if (pending.source === source && pending.index === index) {
      this.renderInventoryPanel();
      return;
    }
    this.swapStorageSlots(pending.source, pending.index, source, index);
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
    this.pendingStorageMove = null;
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
    for (const object of this.objectsNear(position, radius + 12)) {
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
      if (!canReceiveRecipeOutput(this.allStorageSlots(), recipe, (item) => this.isDurableTool(item))) {
        this.showMessage("인벤토리에 제작 결과물을 넣을 공간이 없습니다. 빈 칸을 만든 뒤 제작하세요.");
        return;
      }
      this.clearCraftSlots(false);
      this.addItem(recipe.output, recipe.count);
      this.playCraftSound();
      this.showMessage(`제작 완료! ${recipe.name}을 만들었습니다.`);
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

    if (!canReceiveRecipeOutput(this.allStorageSlots(), recipe, (item) => this.isDurableTool(item))) {
      this.showMessage("인벤토리에 제작 결과물을 넣을 공간이 없습니다. 빈 칸을 만든 뒤 제작하세요.");
      return;
    }
    this.clearWorkbenchSlots(false, false);
    this.addCraftedOutput(recipe);
    this.showMessage(`제작 완료! ${recipe.name}을 만들었습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private fillWorkbenchRecipe(recipeId: string) {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isExtended = station?.type === "extendedWorkbench";
    const recipe = this.workbenchRecipesForStation(isExtended).find((item) => item.id === recipeId);
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
    return this.workbenchRecipesForStation(isExtended).find((recipe) =>
      this.countsMatchExactly(counts, recipe.ingredients),
    );
  }

  private workbenchRecipesForStation(isExtended = false) {
    return WORKBENCH_RECIPES.filter((recipe) => isExtended || !recipe.extendedOnly);
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
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isExtended = station?.type === "extendedWorkbench";
    const recipe = this.workbenchRecipesForStation(isExtended).find((item) => item.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return;
    if (!canReceiveRecipeOutput(this.allStorageSlots(), recipe, (item) => this.isDurableTool(item), recipe.ingredients)) {
      this.showMessage("인벤토리에 제작 결과물을 넣을 공간이 없습니다. 빈 칸을 만든 뒤 제작하세요.");
      return;
    }

    for (const [item, count] of Object.entries(recipe.ingredients)) this.removeItem(item, count);
    this.addCraftedOutput(recipe);
    this.showMessage(`제작 완료! ${recipe.name}을 만들었습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private addCraftedOutput(recipe: Recipe) {
    this.playCraftSound();
    if (recipe.output === "bag") {
      this.unlockBag();
      return true;
    }
    if (!this.addItem(recipe.output, recipe.count)) return false;
    this.autoEquip(recipe.output);
    return true;
  }

  private smeltItem(item: ItemId) {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isSpecial = station?.type === "specialSmelter";
    if (!this.smelterMaterials(isSpecial).includes(item)) {
      this.showMessage("이 재료는 현재 제련대에서 제련할 수 없습니다.");
      return;
    }
    const output = this.smeltOutputFor(item);
    if (!output || !this.removeItem(item, 1)) {
      this.showMessage("제련할 재료가 없습니다.");
      return;
    }
    this.addItem(output, 1);
    this.playSmeltSound();
    this.showMessage(`${ITEM_NAMES[item]}을 ${ITEM_NAMES[output]}으로 제련했습니다.`);
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
    this.playGrindSound();
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

  private buyFromPointShop(offerId: string) {
    const offer = POINT_SHOP_OFFERS.find((candidate) => candidate.id === offerId);
    if (!offer) return;
    if (this.arcadePoints < offer.cost) {
      this.showMessage(`포인트가 부족합니다. 필요 ${offer.cost}P, 보유 ${this.arcadePoints}P.`);
      return;
    }

    const added: { item: ItemId; count: number }[] = [];
    for (const [item, count] of Object.entries(offer.receive)) {
      if (this.addItem(item, count)) {
        added.push({ item, count });
        continue;
      }
      for (const rollback of added) this.removeItem(rollback.item, rollback.count);
      this.showMessage("인벤토리 공간이 부족해서 구매할 수 없습니다.");
      this.renderPanel();
      return;
    }

    this.arcadePoints -= offer.cost;
    this.saveArcadePoints();
    this.playTone(720, 0.12, "triangle", 0.035);
    this.showMessage(`상점 구매 완료: ${this.formatItemBundle(offer.receive)} 획득. 남은 포인트 ${this.arcadePoints}P.`);
    this.renderPanel();
    this.renderHud();
  }

  private sellToVillageShop(offerId: string) {
    const offer = SELL_SHOP_OFFERS.find((candidate) => candidate.id === offerId);
    if (!offer) return;
    if (!this.removeItem(offer.item, 1)) {
      this.showMessage(`${ITEM_NAMES[offer.item] ?? offer.item}이 없어 판매할 수 없습니다.`);
      this.renderPanel();
      return;
    }

    this.arcadePoints += offer.points;
    this.saveArcadePoints();
    this.playTone(640, 0.12, "triangle", 0.035);
    this.showMessage(`판매 완료: ${ITEM_NAMES[offer.item] ?? offer.item} 1개를 ${offer.points}P에 팔았습니다. 현재 포인트 ${this.arcadePoints}P.`);
    this.renderPanel();
    this.renderHud();
  }

  private exchangeDragonLootForPoints(offerId: string) {
    const offer = POINT_EXCHANGE_OFFERS.find((candidate) => candidate.id === offerId);
    if (!offer) return;
    if (!this.removeItem(offer.item, 1)) {
      this.showMessage(`${ITEM_NAMES[offer.item]}이 없어 교환할 수 없습니다.`);
      this.renderPanel();
      return;
    }
    this.arcadePoints += offer.points;
    this.saveArcadePoints();
    this.playTone(860, 0.16, "triangle", 0.04);
    this.showMessage(`${ITEM_NAMES[offer.item]}을 ${offer.points}P로 교환했습니다. 현재 포인트 ${this.arcadePoints}P.`);
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

  private grantRewardItem(item: ItemId, baseCount: number, source: RewardSource) {
    const count = this.rewardQuantity(item, baseCount, source);
    if (!this.addItem(item, count)) return 0;
    if (count > 0) celebrateRareDrop(this.juiceDeps, item);
    return count;
  }

  private rewardQuantity(item: ItemId, baseCount: number, source: RewardSource) {
    const base = Math.max(0, Math.floor(baseCount));
    if (base <= 0) return 0;
    const tuning = getRewardTuning(source, item);
    const scaledBase = base * tuning.quantityMultiplier;
    const minCount = Math.max(1, Math.floor(scaledBase * tuning.minRandomMultiplier));
    const maxCount = Math.max(minCount, Math.floor(scaledBase * tuning.maxRandomMultiplier));
    return THREE.MathUtils.randInt(minCount, maxCount);
  }

  private rollRewardChance(baseChance: number, source: RewardSource, item: ItemId) {
    const tuning = getRewardTuning(source, item);
    const combatRegionScale = source === "predator" || source === "jammini" || source === "boss" || source === "guard" ? regionLootChanceScale(regionAtPosition(this.playerPosition, this.activeRegions)) : 1;
    const chance = THREE.MathUtils.clamp(baseChance * tuning.chanceMultiplier * combatRegionScale, 0, 1);
    return Math.random() < chance;
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
        this.syncEquippedShield(item);
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
    if (this.bagSlots.length < EXPANDED_BAG_SLOT_COUNT) {
      while (this.bagSlots.length < EXPANDED_BAG_SLOT_COUNT) this.bagSlots.push({ item: null, count: 0 });
      this.showMessage("가방을 만들었습니다. 인벤토리 가방 공간 40칸이 열렸습니다.");
    } else {
      this.addItem("leather", 2);
      this.showMessage("이미 가방이 있어 보너스 가죽을 돌려받았습니다.");
    }
  }

  private autoEquip(item: ItemId) {
    if (ARMOR_VALUE[item]) {
      const current = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
      if (ARMOR_VALUE[item] > current) this.equippedArmor = item;
    }
    if (shouldAutoEquipShield(item, this.equippedShield)) { this.equippedShield = item; this.shieldDurabilityUsed = 0; }
  }

  private syncEquippedArmor(removedItem: ItemId) {
    if (this.equippedArmor !== removedItem || this.countItem(removedItem) > 0) return;
    this.equippedArmor = Object.keys(this.itemCounts()).reduce<ItemId | null>((best, item) => {
      if (!ARMOR_VALUE[item]) return best;
      if (!best || ARMOR_VALUE[item] > (ARMOR_VALUE[best] ?? 0)) return item;
      return best;
    }, null);
  }

  private syncEquippedShield(removedItem: ItemId) {
    if (this.equippedShield !== removedItem || this.countItem(removedItem) > 0) return;
    this.equippedShield = bestShieldItem(this.itemCounts());
    this.shieldDurabilityUsed = 0;
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
      new THREE.ConeGeometry(radius, height, 28),
      gameMaterial(0x75816e, { roughness: 0.94, metalness: 0 }),
    );
    mountain.position.set(position.x, height / 2 - 0.1, position.z);
    mountain.scale.y = 0.9;
    applyStylizedMeshDefaults(mountain, { castShadow: false, receiveShadow: true });
    this.scene.add(mountain);
    registerDistanceCulledVisual(mountain);
    this.mountainMeshes.push(mountain);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.36, height * 0.32, 28),
      gameMaterial(0xe4f2f0, { roughness: 0.9, metalness: 0 }),
    );
    cap.position.set(position.x, height * 0.82, position.z);
    applyStylizedMeshDefaults(cap, { castShadow: false, receiveShadow: true });
    this.scene.add(cap);
    registerDistanceCulledVisual(cap);
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
      gameMaterial(0x5b6f6f, { roughness: 0.96 }),
    );
    basinWall.position.y = -depth / 2 + 0.02;
    const basinFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.7, radius * 0.78, 0.08, 42),
      gameMaterial(VISUAL_THEME.waterDeep, { roughness: 0.88, metalness: 0.02 }),
    );
    basinFloor.position.y = -depth + 0.04;
    const water = new Water(new THREE.CircleGeometry(radius, 72), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: this.getWaterNormalTexture(),
      sunDirection: this.sunPosition.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: VISUAL_THEME.waterDeep,
      distortionScale: 2.8,
      alpha: 0.76,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.userData.waterSurface = true;
    water.position.y = 0.13;
    const shore = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.05, 42),
      gameMaterial(0xc8b06a, { roughness: 0.92, metalness: 0 }),
    );
    shore.position.y = 0.035;
    const rippleMaterial = gameMaterial(0xbcecff, { transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0.02 });
    for (const scale of [0.36, 0.62, 0.86]) {
      const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius * scale, 0.018, 6, 64), rippleMaterial);
      ripple.rotation.x = Math.PI / 2;
      ripple.position.y = 0.18 + scale * 0.01;
      ripple.userData.waterRipple = true;
      group.add(ripple);
    }
    const stoneMaterial = gameMaterial(0x8a8f86, { roughness: 0.95 });
    const reedMaterial = gameMaterial(0x6f8f3e, { roughness: 0.88 });
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + THREE.MathUtils.randFloat(-0.08, 0.08);
      if (i % 3 === 0) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, THREE.MathUtils.randFloat(0.58, 1.1), 6), reedMaterial);
        reed.position.set(Math.cos(angle) * radius * 0.98, 0.38, Math.sin(angle) * radius * 0.98);
        reed.rotation.z = THREE.MathUtils.randFloat(-0.18, 0.18);
        group.add(reed);
      } else {
        const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.18, 0.42)), stoneMaterial);
        pebble.position.set(Math.cos(angle) * radius * 1.05, 0.13, Math.sin(angle) * radius * 1.05);
        pebble.scale.y = THREE.MathUtils.randFloat(0.35, 0.65);
        group.add(pebble);
      }
    }
    group.add(basinWall, basinFloor, shore, water);
    group.position.copy(position);
    return this.addWorldObject("water", name, group, {
      terrainRadius: radius,
      collisionRadius: 0,
      collisionHeight: 0,
    });
  }

  private getWaterNormalTexture() {
    if (this.waterNormalTexture) return this.waterNormalTexture;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Failed to create water normal canvas.");
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const waveA = Math.sin((x + y * 0.62) * 0.23);
        const waveB = Math.cos((x * 0.5 - y) * 0.31);
        const value = 128 + Math.floor((waveA + waveB) * 34);
        const index = (y * size + x) * 4;
        image.data[index] = THREE.MathUtils.clamp(value + 18, 0, 255);
        image.data[index + 1] = THREE.MathUtils.clamp(value, 0, 255);
        image.data[index + 2] = 255;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.needsUpdate = true;
    this.waterNormalTexture = texture;
    return texture;
  }

  private spawnDroppedItem(item: ItemId, count: number, position: THREE.Vector3) {
    position.y = this.getGroundHeightAt(position.x, position.z) + 0.08;
    const group = new THREE.Group();
    const groundShadow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.012, 24),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    groundShadow.position.y = 0.012;
    group.add(groundShadow);
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
      group.add(createPlaceableSmelterVisual(item === "special_smelter", 0.42));
    } else if (item === "grinder") {
      group.add(createPlaceableGrinderVisual(0.4));
    } else if (item === "mirror") {
      group.add(createMirrorModel(0.48));
    } else if (item === "crafting_table" || item === "extended_workbench") {
      group.add(createPlaceableWorkbenchVisual(item === "extended_workbench", 0.38));
    } else if (item === "bed") {
      group.add(createPlaceableBedVisual(0.34));
    } else if (item === "building_block") {
      const block = createPlaceableBuildingBlockVisual(0.42);
      block.position.y = 0.02;
      group.add(block);
    } else if (item === "bow" || item === "magic_wand") {
      const model = createHeldItemVisualModel(item);
      model.position.y = 0.16;
      model.rotation.set(-Math.PI / 2, 0, 0.35);
      model.scale.setScalar(item === "bow" ? 0.92 : 0.82);
      group.add(model);
    } else if (this.isBucketItem(item)) {
      const bucket = createBucketVisualModel(item, 0.62);
      bucket.position.y = 0.04;
      group.add(bucket);
    } else {
      const color = resolveHeldItemMaterialColor(item);
      const mesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.72, metalness: 0.08 }),
      );
      mesh.position.y = 0.18;
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.018, 6, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 }),
      );
      rim.position.y = 0.18;
      rim.rotation.x = Math.PI / 2;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.18, 5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.12 }),
      );
      shard.position.set(0.16, 0.18, -0.13);
      shard.rotation.set(0.4, 0.6, -0.3);
      const shardB = shard.clone();
      shardB.position.set(-0.14, 0.13, 0.12);
      shardB.scale.setScalar(0.72);
      group.add(mesh, rim, shard, shardB);
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
    const visual = createTrainVisual(TRAIN_RADIUS);
    this.addBiomeMesh(visual.track);
    const train = spawnObject(this.spawnContext, {
      type: "train",
      name: visual.name,
      root: visual.group,
      extra: {
        collidable: false,
        collisionRadius: visual.collisionRadius,
        collisionHeight: visual.collisionHeight,
        trainAngle: angle,
        trainRadius: TRAIN_RADIUS,
        trainSpeed: visual.trainSpeed,
        trainDirection: visual.trainDirection,
        trainPause: visual.trainPause,
      },
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
    for (const biome of this.activeBiomes) {
      const center = biome.center.clone();
      center.y = this.getGroundHeightAt(center.x, center.z);
      const plan = BIOME_TERRAIN_PLANS[biome.kind];
      for (const patch of plan.patches) {
        const point = patch.offset ? center.clone().add(new THREE.Vector3(patch.offset[0], 0, patch.offset[1])) : center;
        this.spawnTerrainPatch(point, patch.terrain, biome.radius * patch.radiusScale, patch.raised, "terrainPatch", true);
      }
      if (!plan.mountains) continue;
      for (let i = 0; i < plan.mountains.count; i += 1) {
        this.spawnMountain(this.randomPointInCircle(biome.center, biome.radius * 0.72), THREE.MathUtils.randFloat(plan.mountains.height[0], plan.mountains.height[1]), THREE.MathUtils.randFloat(plan.mountains.radius[0], plan.mountains.radius[1]));
      }
    }
  }

  private addBiomeMesh(object: THREE.Object3D) {
    applyStylizedMeshDefaults(object, { castShadow: false, receiveShadow: false });
    this.scene.add(object);
    registerDistanceCulledVisual(object);
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
    const isBig = type === "bigTree";
    const size = isBig ? 2.28 : 1.92;
    const trunkHeight = isBig ? 2.22 * size : 1.28 * size;
    const trunkRadius = isBig ? 0.22 * size : 0.15 * size;
    const geometries: THREE.BufferGeometry[] = [];
    const trunk = this.paintGeometry(new THREE.CylinderGeometry(trunkRadius * 0.72, trunkRadius, trunkHeight, 10), isBig ? ASSET_PALETTE.woodDark : ASSET_PALETTE.wood);
    trunk.translate(0, trunkHeight / 2, 0);
    geometries.push(trunk);

    if (isBig) {
      const lowerLeaves = this.paintGeometry(new THREE.ConeGeometry(1.28 * size, 2.04 * size, 14), ASSET_PALETTE.leafDark);
      lowerLeaves.rotateY(Math.PI / 4);
      lowerLeaves.translate(0, trunkHeight + 0.88 * size, 0);
      const upperLeaves = this.paintGeometry(new THREE.ConeGeometry(0.86 * size, 1.54 * size, 14), ASSET_PALETTE.leaf);
      upperLeaves.rotateY(Math.PI / 4 + 0.16);
      upperLeaves.translate(0, trunkHeight + 1.7 * size, 0);
      const brightEdge = this.paintGeometry(new THREE.ConeGeometry(0.52 * size, 0.62 * size, 12), ASSET_PALETTE.leafLight);
      brightEdge.rotateY(Math.PI / 4 + 0.32);
      brightEdge.translate(-0.28 * size, trunkHeight + 2.08 * size, 0.18 * size);
      const lowGlow = this.paintGeometry(new THREE.SphereGeometry(0.28 * size, 9, 7), 0x83ed70);
      lowGlow.scale(1.25, 0.72, 0.9);
      lowGlow.translate(0.42 * size, trunkHeight + 1.08 * size, 0.18 * size);
      geometries.push(lowerLeaves, upperLeaves, brightEdge, lowGlow);
    } else {
      const leaf = this.paintGeometry(new THREE.SphereGeometry(0.76 * size, 14, 10), ASSET_PALETTE.leafLight);
      leaf.scale(1.12, 0.84, 1);
      leaf.translate(0, trunkHeight + 0.34 * size, 0);
      const highlight = this.paintGeometry(new THREE.SphereGeometry(0.34 * size, 10, 8), 0xd8ff8a);
      highlight.scale(1.05, 0.72, 0.95);
      highlight.translate(-0.22 * size, trunkHeight + 0.64 * size, 0.16 * size);
      const blossomColors = [0xffd1e8, 0xfff1a8, 0xffffff];
      geometries.push(leaf, highlight);
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2 + 0.3;
        const blossom = this.paintGeometry(new THREE.SphereGeometry(0.085 * size, 8, 6), blossomColors[i]);
        blossom.scale(1, 0.85, 1);
        blossom.translate(Math.cos(angle) * 0.52 * size, trunkHeight + 0.5 * size + i * 0.08 * size, Math.sin(angle) * 0.42 * size);
        geometries.push(blossom);
      }
    }
    const visual = new THREE.Mesh(mergeGeometries(geometries), this.treeVertexMaterial);
    group.add(visual);
    this.markVisualOnly(group);
    const interactionTarget = new THREE.Mesh(
      new THREE.CylinderGeometry(isBig ? 1.35 : 0.92, isBig ? 1.55 : 1.05, isBig ? 5.8 : 3.2, 8),
      this.invisibleTargetMaterial,
    );
    interactionTarget.position.y = isBig ? 2.9 : 1.6;
    group.add(interactionTarget);
    group.position.copy(position);
    return this.addWorldObject(type, isBig ? "큰 나무" : "작은 나무", group, {
      collidable: true,
      collisionRadius: isBig ? 2.55 : 1.55,
      collisionHeight: isBig ? 9.5 : 4.45,
    });
  }

  private spawnChest(position: THREE.Vector3, mineRich: boolean) {
    const visual = createChestVisual(mineRich);
    this.mergeStaticMeshes(visual.group);
    visual.group.position.copy(position);
    return spawnObject(this.spawnContext, {
      type: visual.type,
      name: visual.name,
      root: visual.group,
      extra: {
        mineRich: visual.mineRich, expiresAt: performance.now() + 300_000,
        collidable: true,
        collisionRadius: visual.collisionRadius,
        collisionHeight: visual.collisionHeight,
      },
    });
  }

  private spawnCave(position: THREE.Vector3) {
    const group = new THREE.Group();
    const darkStone = makeToonMaterial(0x262b31, { roughness: 0.96 });
    const midStone = makeToonMaterial(ASSET_PALETTE.stoneDark, { roughness: 0.95 });
    const lightStone = makeToonMaterial(ASSET_PALETTE.stone, { roughness: 0.92 });
    const mossMaterial = makeToonMaterial(ASSET_PALETTE.moss, { roughness: 0.94 });
    const woodMaterial = makeToonMaterial(ASSET_PALETTE.woodDark, { roughness: 0.84 });
    const metalMaterial = makeMetalMaterial(ASSET_PALETTE.steelDark, { metalness: 0.22, roughness: 0.5 });
    const warmGlowMaterial = makeGlowMaterial(0xffd58a, 0xd97706, { emissiveIntensity: 1.15, roughness: 0.34 });
    const crystalMaterial = makeGlowMaterial(ASSET_PALETTE.magicCyan, 0x38bdf8, { emissiveIntensity: 0.72, roughness: 0.42 });

    const entrance = new THREE.Mesh(
      new THREE.TorusGeometry(2.18, 0.38, 12, 24),
      darkStone,
    );
    entrance.position.set(0, 1.72, -0.2);
    entrance.scale.set(1.08, 1.18, 0.92);
    group.add(entrance);

    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(1.72, 1.18, 2.3, 28, 1, true),
      makeToonMaterial(0x11151b, { roughness: 1, side: THREE.DoubleSide }),
    );
    tunnel.position.set(0, 1.45, -0.76);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.scale.x = 1.08;
    const darkness = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0x03070c, side: THREE.DoubleSide }),
    );
    darkness.position.set(0, 1.48, 0.02);
    group.add(tunnel, darkness);

    const archRocks = [
      { x: -2.05, y: 0.62, s: 1.2 },
      { x: -2.0, y: 1.42, s: 1.08 },
      { x: -1.58, y: 2.24, s: 1.0 },
      { x: -0.78, y: 2.88, s: 0.92 },
      { x: 0.02, y: 3.13, s: 1.06 },
      { x: 0.82, y: 2.88, s: 0.92 },
      { x: 1.58, y: 2.22, s: 1.0 },
      { x: 2.02, y: 1.42, s: 1.08 },
      { x: 2.08, y: 0.62, s: 1.2 },
    ];
    archRocks.forEach((setup, index) => {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(setup.s),
        index % 3 === 0 ? lightStone : index % 2 === 0 ? midStone : darkStone,
      );
      rock.position.set(setup.x, setup.y, THREE.MathUtils.randFloat(-0.18, 0.36));
      rock.rotation.set(THREE.MathUtils.randFloatSpread(0.42), THREE.MathUtils.randFloatSpread(0.72), THREE.MathUtils.randFloatSpread(0.48));
      rock.scale.set(THREE.MathUtils.randFloat(0.82, 1.18), THREE.MathUtils.randFloat(0.72, 1.24), THREE.MathUtils.randFloat(0.72, 1.16));
      group.add(rock);
    });

    for (let i = 0; i < 12; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const rubble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.32, 0.68)),
        i % 3 === 0 ? lightStone : midStone,
      );
      rubble.position.set(side * THREE.MathUtils.randFloat(1.5, 2.9), THREE.MathUtils.randFloat(0.13, 0.42), THREE.MathUtils.randFloat(-0.5, 1.12));
      rubble.scale.y = THREE.MathUtils.randFloat(0.45, 0.78);
      group.add(rubble);
    }

    const moss = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.12, 0.18),
      mossMaterial,
    );
    moss.position.set(-0.18, 2.98, 0.18);
    moss.rotation.z = -0.08;
    const threshold = new THREE.Mesh(
      new THREE.BoxGeometry(3.7, 0.16, 0.72),
      midStone,
    );
    threshold.position.set(0, 0.04, 0.74);
    threshold.rotation.x = 0.04;
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 1.15, 7),
      woodMaterial,
    );
    signPost.position.set(-2.95, 0.72, 0.72);
    signPost.rotation.z = 0.06;
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.34, 0.1),
      woodMaterial,
    );
    signBoard.position.set(-2.78, 1.2, 0.74);
    signBoard.rotation.z = -0.1;

    for (const x of [-1.3, -0.62, 0.28, 0.98]) {
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, THREE.MathUtils.randFloat(0.55, 1.1), 6),
        mossMaterial,
      );
      vine.position.set(x, 2.42, 0.42);
      vine.rotation.z = THREE.MathUtils.randFloatSpread(0.2);
      group.add(vine);
    }

    for (const setup of [
      { x: -1.78, y: 1.46, z: 0.58 },
      { x: 1.78, y: 1.46, z: 0.58 },
    ]) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 14), metalMaterial);
      hook.position.set(setup.x, setup.y + 0.24, setup.z);
      hook.rotation.x = Math.PI / 2;
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.32, 8), metalMaterial);
      cage.position.set(setup.x, setup.y, setup.z);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), warmGlowMaterial);
      flame.position.set(setup.x, setup.y, setup.z);
      const light = new THREE.PointLight(0xffbd73, 1.35, 8.5, 1.6);
      light.position.set(setup.x, setup.y + 0.1, setup.z);
      group.add(hook, cage, flame, light);
    }

    for (const setup of [
      { x: -1.18, z: 0.9, h: 0.58 },
      { x: -0.86, z: 0.68, h: 0.38 },
      { x: 2.38, z: 0.42, h: 0.5 },
    ]) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.14, setup.h, 6), crystalMaterial);
      crystal.position.set(setup.x, 0.12 + setup.h / 2, setup.z);
      crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.2);
      group.add(crystal);
    }
    const crystalLight = new THREE.PointLight(0x8fd7ff, 0.7, 6.5, 1.9);
    crystalLight.position.set(-1.05, 0.62, 0.78);
    group.add(moss, threshold, signPost, signBoard, crystalLight);
    this.mergeStaticMeshes(group);
    group.position.copy(position);
    return this.addWorldObject("cave", "동굴 입구", group, {
      caveReturn: position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 5)), expiresAt: performance.now() + 600_000,
      collidable: true,
      collisionRadius: 3.05,
      collisionHeight: 4.25,
    });
  }

  private createCaveInterior() {
    const shell = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(CAVE_WIDTH, CAVE_LENGTH, 2, 18),
      new THREE.MeshStandardMaterial({ color: 0x393a38, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, CAVE_CENTER_Z);
    shell.add(floor);

    for (let i = 0; i < 22; i += 1) {
      const z = CAVE_START_Z - 8 - (i / 21) * (CAVE_LENGTH - 20);
      const dirt = new THREE.Mesh(
        new THREE.CircleGeometry(THREE.MathUtils.randFloat(1.4, 2.8), 14),
        new THREE.MeshStandardMaterial({ color: 0x6b523d, roughness: 1 }),
      );
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 5), 0.01, z + THREE.MathUtils.randFloatSpread(4));
      dirt.scale.z = THREE.MathUtils.randFloat(0.55, 1.25);
      shell.add(dirt);
    }

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(CAVE_WIDTH + 2.5, 0.75, CAVE_LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x454a4f, roughness: 1 }),
    );
    ceiling.position.set(0, 4.35, CAVE_CENTER_Z);
    shell.add(ceiling);

    for (let i = 0; i < 46; i += 1) {
      const z = CAVE_START_Z - (i / 45) * CAVE_LENGTH;
      for (const side of [-1, 1]) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(1.0, 2.7)),
          new THREE.MeshStandardMaterial({ color: THREE.MathUtils.randInt(0, 1) === 0 ? 0x5a636a : 0x464d54, roughness: 1 }),
        );
        rock.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 0.4, CAVE_WIDTH / 2 + 1.4), THREE.MathUtils.randFloat(0.8, 3.1), z + THREE.MathUtils.randFloatSpread(2.7));
        rock.scale.y = THREE.MathUtils.randFloat(0.9, 1.85);
        shell.add(rock);
      }
      if (i % 3 === 0) {
        const overhead = new THREE.Mesh(
          new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.8, 1.8)),
          new THREE.MeshStandardMaterial({ color: 0x4d535a, roughness: 1 }),
        );
        overhead.position.set(THREE.MathUtils.randFloatSpread(CAVE_WIDTH - 3), THREE.MathUtils.randFloat(3.2, 4.15), z);
        overhead.scale.y = THREE.MathUtils.randFloat(0.45, 0.9);
        shell.add(overhead);
      }
    }

    const torchWood = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.84 });
    const torchFlame = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xea8a22, emissiveIntensity: 1.1, roughness: 0.38 });
    const caveCrystal = new THREE.MeshStandardMaterial({ color: 0xa7e8ff, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.5 });
    for (let i = 0; i < 8; i += 1) {
      const z = CAVE_START_Z - 12 - (i / 7) * (CAVE_LENGTH - 28);
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (CAVE_WIDTH / 2 - 0.9);
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.74, 7), torchWood);
      bracket.position.set(x, 1.28, z);
      bracket.rotation.z = side * 0.72;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), torchFlame);
      flame.position.set(x - side * 0.28, 1.62, z);
      const light = new THREE.PointLight(0xffbd73, 1.5, 22, 1.55);
      light.position.set(x - side * 0.45, 1.78, z);
      shell.add(bracket, flame, light);
    }

    for (let i = 0; i < 9; i += 1) {
      const z = CAVE_START_Z - 18 - (i / 8) * (CAVE_LENGTH - 36);
      const side = i % 2 === 0 ? 1 : -1;
      const cluster = new THREE.Group();
      for (let shard = 0; shard < 3; shard += 1) {
        const height = THREE.MathUtils.randFloat(0.32, 0.78);
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.12, height, 6), caveCrystal);
        crystal.position.set(THREE.MathUtils.randFloatSpread(0.45), height / 2, THREE.MathUtils.randFloatSpread(0.38));
        crystal.rotation.z = THREE.MathUtils.randFloatSpread(0.18);
        cluster.add(crystal);
      }
      cluster.position.set(side * THREE.MathUtils.randFloat(CAVE_WIDTH / 2 - 2.7, CAVE_WIDTH / 2 - 1.3), 0.02, z + THREE.MathUtils.randFloatSpread(2.4));
      shell.add(cluster);
    }

    const entranceLight = new THREE.PointLight(0xffe3b0, 1.65, 26, 1.4);
    entranceLight.position.set(0, 2.1, CAVE_START_Z - 5);
    const deepGuideLight = new THREE.PointLight(0x9fd8ff, 1.0, 28, 1.7);
    deepGuideLight.position.set(0, 1.9, CAVE_END_Z + 10);
    shell.add(entranceLight, deepGuideLight);
    applyStylizedMeshDefaults(shell);
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
    applyStylizedMeshDefaults(room);
    this.scene.add(room);
    this.houseObjectIds.push(`loose-${room.uuid}`);

    const exitId = this.addWorldObject("houseExit", "문으로 나가기", this.createHouseExit(new THREE.Vector3(0, 0, HOUSE_CENTER_Z + 5.2))).id;
    const chest = this.spawnChest(new THREE.Vector3(2.4, 0, HOUSE_CENTER_Z - 3.15), houseKind === "blacksmith" || chestRich);
    this.houseObjectIds.push(exitId, chest.id);
    if (houseKind === "blacksmith") {
      const workbench = spawnWorkbenchObject(this.spawnContext, new THREE.Vector3(-3.15, 0, HOUSE_CENTER_Z + 1.9), true);
      const smelter = spawnSmelterObject(this.spawnContext, new THREE.Vector3(0, 0, HOUSE_CENTER_Z - 2.55), true);
      const grinder = spawnGrinderObject(this.spawnContext, new THREE.Vector3(3.15, 0, HOUSE_CENTER_Z + 1.7));
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
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: colorByOre[ore] ?? 0x888888,
      emissive: ore === "diamond" ? 0x1f9fb0 : ore === "gold" ? 0x7c4a03 : ore === "obsidian" ? 0x35144f : 0x000000,
      emissiveIntensity: ore === "diamond" ? 0.55 : ore === "gold" ? 0.16 : ore === "obsidian" ? 0.22 : 0,
      roughness: 0.48,
      metalness: ore === "gold" || ore === "iron" || ore === "copper" ? 0.24 : 0.04,
    });
    for (let i = 0; i < (ore === "stone" ? 2 : 4); i += 1) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.08 + i * 0.012, 0.24 + i * 0.035, 5), accentMaterial);
      shard.position.set(THREE.MathUtils.randFloatSpread(0.48), 0.14 + i * 0.02, THREE.MathUtils.randFloatSpread(0.42));
      shard.rotation.set(THREE.MathUtils.randFloatSpread(0.7), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloatSpread(0.5));
      mesh.add(shard);
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
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff1a8, emissive: 0xf59e0b, emissiveIntensity: 0.9, roughness: 0.3 }),
    );
    lamp.position.set(0, 2.17, 0.3);
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 0.9 }),
    );
    beard.position.set(0, 1.69, 0.2);
    beard.scale.set(1, 0.55, 0.65);
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 5), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 }));
      eye.position.set(x, 1.89, 0.29);
      group.add(eye);
    }
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.86 });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), armMaterial);
      arm.position.set(side * 0.55, 1.02, 0.04);
      arm.rotation.z = side * -0.28;
      group.add(arm);
    }
    const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.9, 7), new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.86 }));
    pickHandle.position.set(0.66, 1.05, 0.18);
    pickHandle.rotation.z = -0.72;
    const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.08), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.3, roughness: 0.45 }));
    pickHead.position.set(0.88, 1.38, 0.18);
    pickHead.rotation.z = -0.72;
    group.add(body, head, helmet, lamp, beard, pickHandle, pickHead);
    group.position.copy(position);
    const object = this.addWorldObject("miner", "광부", group, {
      collidable: true,
      collisionRadius: 0.65,
      collisionHeight: 2.2,
    });
    this.caveObjectIds.push(object.id);
    return object;
  }

  private spawnLegoHazard(position: THREE.Vector3, thrownFrom?: THREE.Vector3) {
    position.y = this.getGroundHeightAt(position.x, position.z) + 0.045;
    const fromPlayer = position.clone().sub(this.playerPosition).setY(0);
    const playerDistance = fromPlayer.length();
    if (playerDistance < 1.05) {
      const direction = playerDistance > 0.05 ? fromPlayer.multiplyScalar(1 / playerDistance) : new THREE.Vector3(Math.cos(Math.random() * Math.PI * 2), 0, Math.sin(Math.random() * Math.PI * 2));
      position.addScaledVector(direction, 1.05 - playerDistance);
      position.y = this.getGroundHeightAt(position.x, position.z) + 0.045;
    }
    const now = performance.now();
    const group = new THREE.Group();
    const color = [0xef4444, 0xfacc15, 0x2563eb, 0x22c55e][THREE.MathUtils.randInt(0, 3)];
    const material = gameMaterial(color, { roughness: 0.38, metalness: 0.02 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.32), material);
    body.position.y = 0.08;
    group.add(body);
    for (const x of [-0.13, 0.13]) {
      for (const z of [-0.08, 0.08]) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.055, 10), material);
        stud.position.set(x, 0.19, z);
        group.add(stud);
      }
    }
    const warning = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.018, 6, 36),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    warning.userData.legoWarning = true;
    warning.rotation.x = Math.PI / 2;
    warning.position.y = 0.025;
    const landingDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 28),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    landingDot.userData.legoWarning = true;
    landingDot.rotation.x = -Math.PI / 2;
    landingDot.position.y = 0.018;
    const falling = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), material.clone());
    const throwStart = thrownFrom
      ? thrownFrom.clone().sub(position).setY(Math.max(1.3, thrownFrom.y - position.y + 1.35))
      : new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.2), 1.45, THREE.MathUtils.randFloatSpread(1.2));
    falling.userData.legoFalling = true;
    falling.userData.start = throwStart;
    falling.userData.end = new THREE.Vector3(0, 0.32, 0);
    falling.position.copy(throwStart);
    group.add(warning, landingDot, falling);
    group.position.copy(position);
    return this.addWorldObject("legoHazard", "바닥 레고", group, {
      hazardThrownAt: now,
      hazardArmedAt: now + LEGO_ARM_DELAY_MS,
      hazardExpiresAt: now + LEGO_HAZARD_DURATION_MS,
      collisionRadius: LEGO_HAZARD_TRIGGER_RADIUS,
      collisionHeight: 0.22,
    });
  }

  private scatterLegoRing(center: THREE.Vector3, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.12);
      const radius = THREE.MathUtils.randFloat(2.0, 3.45);
      const point = new THREE.Vector3(center.x + Math.cos(angle) * radius, 0, center.z + Math.sin(angle) * radius);
      this.spawnLegoHazard(point, center);
    }
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
    const pebbleMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4b35, roughness: 0.98 });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x4f8d3e, roughness: 0.95 });
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.2;
      const radius = THREE.MathUtils.randFloat(0.55, 0.95);
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.035, 0.075)), pebbleMaterial);
      pebble.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius);
      group.add(pebble);
      if (i % 2 === 0) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, THREE.MathUtils.randFloat(0.24, 0.38), 5), grassMaterial);
        blade.position.set(Math.cos(angle + 0.2) * (radius + 0.08), 0.18, Math.sin(angle + 0.2) * (radius + 0.08));
        blade.rotation.z = THREE.MathUtils.randFloatSpread(0.35);
        group.add(blade);
      }
    }
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
    this.spawnVillageGroundDecor(position.clone(), ringRadius + 5, special);
    for (let i = 0; i < houseCount; i += 1) {
      const angle = (i / houseCount) * Math.PI * 2 + (special ? 0.16 : 0.32);
      const offset = new THREE.Vector3(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
      this.spawnVillageHouse(position.clone().add(offset), special ? "큰 마을 집" : "주민의 집", false, villageId, i % 4);
    }
    if (Math.random() < 0.5) {
      this.spawnBlacksmith(position.clone().add(new THREE.Vector3(-ringRadius * 0.62, 0, ringRadius * 0.54)), villageId);
    }
    this.spawnVillageShop(position.clone().add(new THREE.Vector3(ringRadius * 0.58, 0, ringRadius * 0.46)), villageId);
    this.spawnVillageSellShop(position.clone().add(new THREE.Vector3(ringRadius * 0.58, 0, -ringRadius * 0.46)), villageId);

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
    this.mergeStaticMeshes(well);
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

  private spawnVillageGroundDecor(position: THREE.Vector3, radius: number, special: boolean) {
    const group = new THREE.Group();
    const pathMaterial = gameMaterial(0xcaa06a, { roughness: 0.92, metalness: 0 });
    const edgeMaterial = gameMaterial(0x8f6b45, { roughness: 0.94, metalness: 0 });
    const bannerMaterial = gameMaterial(special ? 0x6d28d9 : 0x2563eb, { roughness: 0.66 });
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(special ? 5.4 : 4.2, special ? 5.7 : 4.5, 0.08, 36), pathMaterial);
    plaza.position.set(position.x, position.y + 0.035, position.z);
    group.add(plaza);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const length = radius * 0.92;
      const path = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.06, length), pathMaterial);
      path.position.set(position.x + Math.sin(angle) * length * 0.5, position.y + 0.045, position.z + Math.cos(angle) * length * 0.5);
      path.rotation.y = angle;
      const edgeA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, length), edgeMaterial);
      const edgeB = edgeA.clone();
      edgeA.position.set(-1.42, 0.03, 0);
      edgeB.position.set(1.42, 0.03, 0);
      path.add(edgeA, edgeB);
      group.add(path);
    }
    for (let i = 0; i < (special ? 10 : 6); i += 1) {
      const angle = (i / (special ? 10 : 6)) * Math.PI * 2 + 0.18;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.8, 8), gameMaterial(0x5b341d, { roughness: 0.82 }));
      pole.position.set(position.x + Math.cos(angle) * (radius * 0.58), position.y + 0.9, position.z + Math.sin(angle) * (radius * 0.58));
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.04), bannerMaterial);
      banner.position.set(0.28, 0.42, 0);
      banner.rotation.z = -0.08;
      pole.add(banner);
      group.add(pole);
    }
    this.mergeStaticMeshes(group);
    this.addBiomeMesh(group);
  }

  private spawnVillageFence(position: THREE.Vector3, radius: number, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const wood = gameMaterial(VISUAL_THEME.barkDark, { roughness: 0.88 });
    const darkWood = gameMaterial(0x2c1a11, { roughness: 0.86 });
    const stone = gameMaterial(0x8a806f, { roughness: 0.95 });
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
    this.mergeStaticMeshes(group);
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

  private createBuildingSign(label: string, kind: BuildingSignKind, width = 2.2, height = 0.82) {
    return createBuildingSignModel(label, kind, width, height);
  }

  private spawnVillageHouse(position: THREE.Vector3, name: string, isStorage: boolean, villageId: string, variant = Math.floor(Math.random() * 4)) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const visual = createVillageHouseVisual(name, isStorage, variant);
    this.mergeStaticMeshes(visual.group);
    visual.group.position.copy(position);
    return spawnObject(this.spawnContext, {
      type: visual.type,
      name: visual.name,
      root: visual.group,
      extra: {
        collidable: true,
        collisionRadius: visual.collisionRadius,
        collisionHeight: visual.collisionHeight,
        villageId,
        enterable: visual.enterable,
        houseKind: visual.houseKind,
        foodRemaining: visual.foodRemaining,
      },
    });
  }

  private spawnVillageShop(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const shop = new THREE.Group();
    const wood = gameMaterial(0x8b5a2b, { roughness: 0.82 });
    const darkWood = gameMaterial(0x4b2e1c, { roughness: 0.88 });
    const clothGreen = gameMaterial(0x059669, { roughness: 0.74 });
    const clothCream = gameMaterial(0xfff3c4, { roughness: 0.8 });
    const coin = gameMaterial(0xfacc15, { metalness: 0.18, roughness: 0.36 });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.82, 1.45), wood);
    counter.position.set(0, 0.55, 0.28);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.16, 1.7), darkWood);
    counterTop.position.set(0, 1.03, 0.28);
    const backShelf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.55, 0.42), darkWood);
    backShelf.position.set(0, 1.15, -1.22);
    const shelfPlank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.48), wood);
    shelfPlank.position.set(0, 1.66, -0.98);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.95, 0.18, 2.55), clothGreen);
    canopy.position.set(0, 2.58, -0.08);
    canopy.rotation.x = -0.08;
    for (let index = 0; index < 5; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 2.62), index % 2 === 0 ? clothCream : clothGreen);
      stripe.position.set(-1.92 + index * 0.96, 2.7, -0.08);
      stripe.rotation.x = canopy.rotation.x;
      shop.add(stripe);
    }
    for (const x of [-2.18, 2.18]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.38, 8), darkWood);
      post.position.set(x, 1.25, 0.86);
      shop.add(post);
    }
    for (const x of [-1.45, -0.45, 0.55, 1.55]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.52), gameMaterial(x < 0 ? 0xb45309 : 0x166534, { roughness: 0.86 }));
      crate.position.set(x, 1.38, -0.82);
      shop.add(crate);
    }
    for (let index = 0; index < 9; index += 1) {
      const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), coin);
      coinMesh.position.set(-0.7 + index * 0.18, 1.14 + (index % 3) * 0.035, 0.86);
      coinMesh.rotation.x = Math.PI / 2;
      shop.add(coinMesh);
    }
    const sign = this.createBuildingSign("상점", "shop", 2.2, 0.72);
    sign.position.set(0, 2.05, 1.24);
    shop.add(counter, counterTop, backShelf, shelfPlank, canopy, sign);
    this.mergeStaticMeshes(shop);
    shop.position.copy(position);
    return this.addWorldObject("villageShop", "마을 상점", shop, {
      collidable: true,
      collisionRadius: 2.6,
      collisionHeight: 2.9,
      villageId,
    });
  }

  private spawnVillageSellShop(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const shop = new THREE.Group();
    const wood = gameMaterial(0x8b4a22, { roughness: 0.84 });
    const darkWood = gameMaterial(0x3f2415, { roughness: 0.9 });
    const clothAmber = gameMaterial(0xf59e0b, { roughness: 0.76 });
    const clothCream = gameMaterial(0xfff1c2, { roughness: 0.82 });
    const coin = gameMaterial(0xfacc15, { metalness: 0.2, roughness: 0.34 });
    const brass = gameMaterial(0xb7791f, { metalness: 0.24, roughness: 0.44 });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.82, 1.48), wood);
    counter.position.set(0, 0.55, 0.34);
    const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.38, 0.12), darkWood);
    frontPanel.position.set(0, 0.77, 1.14);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.16, 1.74), darkWood);
    counterTop.position.set(0, 1.04, 0.34);
    const backShelf = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.32, 0.44), darkWood);
    backShelf.position.set(0, 1.08, -1.1);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.2, 2.62), clothAmber);
    canopy.position.set(0, 2.58, -0.04);
    canopy.rotation.x = -0.08;

    for (let index = 0; index < 5; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.7), index % 2 === 0 ? clothCream : clothAmber);
      stripe.position.set(-2 + index, 2.71, -0.04);
      stripe.rotation.x = canopy.rotation.x;
      shop.add(stripe);
    }
    for (const x of [-2.25, 2.25]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.42, 8), darkWood);
      post.position.set(x, 1.26, 0.9);
      shop.add(post);
    }
    for (const x of [-1.55, -0.58, 0.62, 1.58]) {
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.55), gameMaterial(x < 0 ? 0x9a3412 : 0x7c2d12, { roughness: 0.88 }));
      basket.position.set(x, 1.34, -0.72);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.58), gameMaterial(0xfde68a, { roughness: 0.74 }));
      lid.position.set(x, 1.6, -0.72);
      shop.add(basket, lid);
    }

    const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.72, 8), brass);
    scalePost.position.set(-1.25, 1.42, 0.8);
    const scaleBeam = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.045, 0.045), brass);
    scaleBeam.position.set(-1.25, 1.8, 0.8);
    for (const side of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), brass);
      chain.position.set(-1.25 + side * 0.38, 1.63, 0.8);
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.055, 18), brass);
      pan.position.set(-1.25 + side * 0.38, 1.47, 0.8);
      shop.add(chain, pan);
    }
    for (let index = 0; index < 7; index += 1) {
      const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 16), coin);
      coinMesh.position.set(0.42 + index * 0.18, 1.14 + (index % 3) * 0.035, 0.88);
      coinMesh.rotation.x = Math.PI / 2;
      shop.add(coinMesh);
    }

    const sign = this.createBuildingSign("판매소", "sell", 2.55, 0.72);
    sign.position.set(0, 2.05, 1.24);
    shop.add(counter, frontPanel, counterTop, backShelf, canopy, scalePost, scaleBeam, sign);
    this.mergeStaticMeshes(shop);
    shop.position.copy(position);
    return this.addWorldObject("villageSellShop", "마을 판매소", shop, {
      collidable: true,
      collisionRadius: 2.65,
      collisionHeight: 2.9,
      villageId,
    });
  }

  private spawnBlacksmith(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const forge = new THREE.Group();
    const width = 6.4;
    const depth = 5.1;
    const stone = new THREE.MeshStandardMaterial({ color: 0x718091, roughness: 0.82, metalness: 0.08 });
    const darkRoof = new THREE.MeshStandardMaterial({ color: 0x252b38, roughness: 0.78, metalness: 0.08 });
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
    const sign = this.createBuildingSign("\ub300\uc7a5\uac04", "blacksmith", 2.75, 0.82);
    sign.position.set(0, 2.42, depth / 2 + 0.16);
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.42), new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.45, roughness: 0.4 }));
    anvil.position.set(width * 0.24, 0.55, depth / 2 + 0.08);
    const hotChimneyBand = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.82), ember);
    hotChimneyBand.position.set(width * 0.25, 3.34, -depth * 0.12);
    const sideEmblem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34),
      new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xc2410c, emissiveIntensity: 0.38, roughness: 0.36 }),
    );
    sideEmblem.position.set(-width * 0.38, 1.86, depth / 2 + 0.08);
    sideEmblem.scale.set(1, 0.72, 0.2);
    forge.add(hut, roof, chimney, forgeGlow, sign, anvil, hotChimneyBand, sideEmblem);
    this.mergeStaticMeshes(forge);
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
    const skin = makeToonMaterial(ASSET_PALETTE.skin, { roughness: 0.74 });
    const tunic = makeToonMaterial(ASSET_PALETTE.clothGreen, { roughness: 0.82 });
    const apron = makeToonMaterial(ASSET_PALETTE.wallCream, { roughness: 0.86 });
    const leather = makeToonMaterial(ASSET_PALETTE.leather, { roughness: 0.86 });
    const dark = makeToonMaterial(ASSET_PALETTE.ink, { roughness: 0.7 });
    const straw = makeToonMaterial(ASSET_PALETTE.straw, { roughness: 0.9 });
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
      makeToonMaterial(ASSET_PALETTE.wood, { roughness: 0.9 }),
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
    const steel = makeMetalMaterial(ASSET_PALETTE.steel, { metalness: 0.45, roughness: 0.38 });
    const darkSteel = makeMetalMaterial(ASSET_PALETTE.steelDark, { metalness: 0.45, roughness: 0.42 });
    const blue = makeToonMaterial(ASSET_PALETTE.clothBlue, { roughness: 0.68 });
    const gold = makeMetalMaterial(ASSET_PALETTE.gold, { metalness: 0.35, roughness: 0.36 });
    const skin = makeToonMaterial(ASSET_PALETTE.skin, { roughness: 0.8 });
    const leather = makeToonMaterial(ASSET_PALETTE.leatherDark, { roughness: 0.85 });
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
      makeMetalMaterial(0xd8dee8, { metalness: 0.6, roughness: 0.28 }),
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
      hp: 90,
      armor: 15,
      collidable: true,
      collisionRadius: 0.78,
      collisionHeight: 2.42,
      villageId, homePosition: position.clone(),
      guardMode: "melee",
      attackRange: 2.05,
      attackDamage: 8,
      walkCycle: this.createWalkCycle(walkParts, 0.38, 8, 0.025),
    });
  }

  private spawnGolem(position: THREE.Vector3, villageId: string) {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const group = new THREE.Group();
    const stone = makeToonMaterial(ASSET_PALETTE.stone, { roughness: 0.92, metalness: 0.1 });
    const darkStone = makeToonMaterial(ASSET_PALETTE.stoneDark, { roughness: 0.96, metalness: 0.08 });
    const moss = makeToonMaterial(ASSET_PALETTE.moss, { roughness: 0.92 });
    const glow = makeGlowMaterial(ASSET_PALETTE.magicCyan, 0x16a6c7, { emissiveIntensity: 1.4, roughness: 0.22 });

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
      hp: 180,
      armor: 25,
      collidable: true,
      collisionRadius: 1.45,
      collisionHeight: 3.9,
      villageId, homePosition: position.clone(),
      guardMode: "melee",
      attackRange: 2.55,
      attackDamage: 14,
      attackInterval: 5,
    });
  }

  private spawnRangedGuard(position: THREE.Vector3, villageId: string, type: "villageArcher" | "villageMage") {
    position.y = this.getGroundHeightAt(position.x, position.z);
    const visual = createRangedGuardVisual(type);
    visual.group.position.copy(position);
    return spawnObject(this.spawnContext, {
      type,
      name: visual.name,
      root: visual.group,
      extra: {
        hp: visual.hp,
        armor: visual.armor,
        collidable: true,
        collisionRadius: visual.collisionRadius,
        collisionHeight: visual.collisionHeight,
        villageId, homePosition: position.clone(),
        guardMode: "ranged",
        attackRange: visual.attackRange,
        attackDamage: visual.attackDamage,
        walkCycle: this.createWalkCycle(visual.walkParts, visual.walk.amplitude, visual.walk.speed, visual.walk.lift),
      },
    });
  }

  private *objectsOfType(type: ObjectType) {
    const ids = this.objectIdsByType.get(type);
    if (!ids) return;
    for (const id of ids) {
      const object = this.objects.get(id);
      if (object) yield object;
    }
  }

  private *objectsOfTypes(types: readonly ObjectType[]) {
    for (const type of types) yield* this.objectsOfType(type);
  }

  private spatialCell(value: number) {
    return Math.floor(value / SPATIAL_CELL_SIZE);
  }

  private spatialKey(cellX: number, cellZ: number) {
    return `${cellX},${cellZ}`;
  }

  private spatialRadiusForObject(object: WorldObject) {
    const baseRadius = Math.max(object.collisionRadius ?? 0, object.terrainRadius ?? 0, 0.85);
    if (object.collisionSegments?.length) return Math.max(baseRadius, object.terrainRadius ?? 0);
    return baseRadius;
  }

  private spatialKeysForObject(object: WorldObject) {
    const radius = this.spatialRadiusForObject(object);
    const minX = this.spatialCell(object.root.position.x - radius);
    const maxX = this.spatialCell(object.root.position.x + radius);
    const minZ = this.spatialCell(object.root.position.z - radius);
    const maxZ = this.spatialCell(object.root.position.z + radius);
    const keys = new Set<string>();
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) keys.add(this.spatialKey(cellX, cellZ));
    }
    return keys;
  }

  private sameSpatialKeys(a: Set<string> | undefined, b: Set<string>) {
    if (!a || a.size !== b.size) return false;
    for (const key of b) {
      if (!a.has(key)) return false;
    }
    return true;
  }

  private registerSpatialObject(object: WorldObject) {
    const keys = this.spatialKeysForObject(object);
    this.spatialKeysByObject.set(object.id, keys);
    for (const key of keys) {
      let bucket = this.spatialBuckets.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        this.spatialBuckets.set(key, bucket);
      }
      bucket.add(object.id);
    }
  }

  private unregisterSpatialObject(id: string) {
    const keys = this.spatialKeysByObject.get(id);
    if (!keys) return;
    for (const key of keys) {
      const bucket = this.spatialBuckets.get(key);
      if (!bucket) continue;
      bucket.delete(id);
      if (bucket.size === 0) this.spatialBuckets.delete(key);
    }
    this.spatialKeysByObject.delete(id);
  }

  private refreshSpatialObject(object: WorldObject) {
    const nextKeys = this.spatialKeysForObject(object);
    const currentKeys = this.spatialKeysByObject.get(object.id);
    if (this.sameSpatialKeys(currentKeys, nextKeys)) return;
    this.unregisterSpatialObject(object.id);
    this.spatialKeysByObject.set(object.id, nextKeys);
    for (const key of nextKeys) {
      let bucket = this.spatialBuckets.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        this.spatialBuckets.set(key, bucket);
      }
      bucket.add(object.id);
    }
  }

  private *objectsNear(point: THREE.Vector3, radius: number) {
    const minX = this.spatialCell(point.x - radius);
    const maxX = this.spatialCell(point.x + radius);
    const minZ = this.spatialCell(point.z - radius);
    const maxZ = this.spatialCell(point.z + radius);
    const seen = new Set<string>();
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const bucket = this.spatialBuckets.get(this.spatialKey(cellX, cellZ));
        if (!bucket) continue;
        for (const id of bucket) {
          if (seen.has(id)) continue;
          seen.add(id);
          const object = this.objects.get(id);
          if (object) yield object;
        }
      }
    }
  }

  private isRaycastableType(type: ObjectType) {
    return type !== "villageFence" && type !== "water" && type !== "mountain" && type !== "eagleSummon" && type !== "summonerPet";
  }

  private shouldMergeStaticType(type: ObjectType) {
    return new Set<ObjectType>([
      "chest",
      "mineChest",
      "cave",
      "villageFence",
      "villageHouse",
      "foodStorage",
      "blacksmith",
      "villageShop",
      "villageSellShop",
      "workbench",
      "extendedWorkbench",
      "smelter",
      "specialSmelter",
      "grinder",
      "bed",
      "buildingBlock",
    ]).has(type);
  }

  private materialMergeKey(material: THREE.Material) {
    if (material instanceof THREE.MeshStandardMaterial) {
      return [
        "standard",
        material.color.getHexString(),
        material.emissive.getHexString(),
        material.emissiveIntensity.toFixed(3),
        material.roughness.toFixed(3),
        material.metalness.toFixed(3),
        material.transparent ? 1 : 0,
        material.opacity.toFixed(3),
      ].join(":");
    }
    if (material instanceof THREE.MeshBasicMaterial) {
      return [
        "basic",
        material.color.getHexString(),
        material.map?.uuid ?? "no-map",
        material.transparent ? 1 : 0,
        material.opacity.toFixed(3),
        material.depthWrite ? 1 : 0,
        material.colorWrite ? 1 : 0,
      ].join(":");
    }
    return material.uuid;
  }

  private mergeStaticMeshes(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverseGroupMatrix = group.matrixWorld.clone().invert();
    const buckets = new Map<
      string,
      {
        material: THREE.Material;
        entries: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[];
      }
    >();

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
      if (child.userData.skipStaticMerge || this.isInvisibleMesh(child)) return;
      child.updateMatrixWorld(true);
      const clonedGeometry = child.geometry.clone();
      const geometry = clonedGeometry.index ? clonedGeometry.toNonIndexed() : clonedGeometry;
      if (geometry !== clonedGeometry) clonedGeometry.dispose();
      geometry.applyMatrix4(inverseGroupMatrix.clone().multiply(child.matrixWorld));
      const key = this.materialMergeKey(child.material);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { material: child.material, entries: [] };
        buckets.set(key, bucket);
      }
      bucket.entries.push({ mesh: child, geometry });
    });

    for (const { material, entries } of buckets.values()) {
      if (entries.length < 2) {
        for (const entry of entries) entry.geometry.dispose();
        continue;
      }
      const merged = mergeGeometries(
        entries.map((entry) => entry.geometry),
        false,
      );
      if (!merged) {
        for (const entry of entries) entry.geometry.dispose();
        continue;
      }
      for (const entry of entries) {
        entry.mesh.parent?.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.geometry.dispose();
      }
      group.add(new THREE.Mesh(merged, material));
    }
  }

  private addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra: Partial<WorldObject> = {}) {
    const id = `${type}-${crypto.randomUUID()}`;
    root.userData.objectId = id;
    if (root instanceof THREE.Group && this.shouldMergeStaticType(type)) this.mergeStaticMeshes(root);
    const raycastMeshes: THREE.Object3D[] = [];
    const raycastable = this.isRaycastableType(type);
    root.traverse((child) => {
      child.userData.objectId = id;
      if (child instanceof THREE.Mesh) {
        if (shouldHideInvisibleMeshFromRender(child)) child.visible = false;
        if (raycastable && !child.userData.skipRaycastTarget) {
          this.raycastTargets.push(child);
          raycastMeshes.push(child);
        }
      }
    });
    applyStylizedMeshDefaults(root, this.shadowOptionsForType(type));
    this.addCartoonOutlines(root, type);
    this.addContactShadow(root, type, extra);
    this.scene.add(root);
    const object: WorldObject = { id, type, name, root, ...extra };
    this.objects.set(id, object);
    let typeSet = this.objectIdsByType.get(type);
    if (!typeSet) {
      typeSet = new Set<string>();
      this.objectIdsByType.set(type, typeSet);
    }
    typeSet.add(id);
    this.registerSpatialObject(object);
    this.raycastTargetsByObject.set(id, raycastMeshes);
    if (type === "water") {
      this.waterObjects.push(object);
      this.cacheWaterVisuals(object.root);
    }
    return object;
  }

  private shadowOptionsForType(type: ObjectType) {
    const noShadowTypes = new Set<ObjectType>([
      "smallTree",
      "bigTree",
      "water",
      "terrainPatch",
      "dirtPatch",
      "ore",
      "droppedItem",
      "antHill",
      "legoHazard",
    ]);
    if (noShadowTypes.has(type)) return { castShadow: false, receiveShadow: false };
    const receiveOnlyTypes = new Set<ObjectType>(["villageFence", "villageHouse", "foodStorage", "blacksmith", "villageShop", "villageSellShop", "cave", "caveExit", "houseExit", "buildingBlock"]);
    if (receiveOnlyTypes.has(type)) return { castShadow: false, receiveShadow: true };
    return { castShadow: true, receiveShadow: true };
  }

  private shouldOutlineType(type: ObjectType) {
    return !new Set<ObjectType>(["water", "terrainPatch", "dirtPatch", "mountain", "caveExit", "houseExit", "smallTree", "bigTree", "villageFence", "buildingBlock"]).has(type);
  }

  private cacheWaterVisuals(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData.waterRipple) this.waterRippleMeshes.push(child);
      if (child.userData.waterSurface) this.waterSurfaceMeshes.push(child);
    });
  }

  private uncacheWaterVisuals(root: THREE.Object3D) {
    const ripples = new Set<THREE.Object3D>();
    const surfaces = new Set<THREE.Mesh>();
    root.traverse((child) => {
      if (child.userData.waterRipple) ripples.add(child);
      if (child instanceof THREE.Mesh && child.userData.waterSurface) surfaces.add(child);
    });
    for (let index = this.waterRippleMeshes.length - 1; index >= 0; index -= 1) {
      if (ripples.has(this.waterRippleMeshes[index])) this.waterRippleMeshes.splice(index, 1);
    }
    for (let index = this.waterSurfaceMeshes.length - 1; index >= 0; index -= 1) {
      if (surfaces.has(this.waterSurfaceMeshes[index])) this.waterSurfaceMeshes.splice(index, 1);
    }
  }

  private outlineScaleForType(type: ObjectType) {
    if (type === "smallTree" || type === "bigTree") return 1.05;
    if (type === "animal" || type === "wildPredator" || type === "eagleSummon" || type === "summonerPet" || type === "jammini" || type === "villager" || type === "villageKnight" || type === "villageArcher" || type === "villageMage" || type === "blacksmithNpc") return 1.085;
    if (type === "dragon") return 1.035;
    if (type === "villageGolem") return 1.065;
    if (type === "droppedItem" || type === "ore") return 1.12;
    return 1.06;
  }

  private addCartoonOutlines(root: THREE.Object3D, type: ObjectType) {
    if (!this.shouldOutlineType(type)) return;
    const targets: THREE.Mesh[] = [];
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh) return;
      if (child.userData.isCartoonOutline) return;
      if (this.isInvisibleMesh(child)) return;
      targets.push(child);
    });

    const scale = this.outlineScaleForType(type);
    for (const mesh of targets) {
      const outline = new THREE.Mesh(mesh.geometry, this.cartoonOutlineMaterial);
      outline.name = `${mesh.name || "mesh"}-outline`;
      outline.position.copy(mesh.position);
      outline.quaternion.copy(mesh.quaternion);
      outline.scale.copy(mesh.scale).multiplyScalar(scale);
      outline.renderOrder = -2;
      outline.castShadow = false;
      outline.receiveShadow = false;
      outline.userData.skipRaycastTarget = true;
      outline.userData.isCartoonOutline = true;
      outline.visible = shouldShowPerformanceHiddenVisual(outline, this.qualityMode, false);
      mesh.parent?.add(outline);
      this.outlineVisuals.push(outline);
      this.sprintHiddenVisuals.push(outline);
    }
  }

  private isInvisibleMesh(mesh: THREE.Mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return materials.some((material) => {
      if (material instanceof THREE.MeshBasicMaterial && material.colorWrite === false) return true;
      return material.transparent && material.opacity < 0.08;
    });
  }

  private shouldAddContactShadow(type: ObjectType) {
    return new Set<ObjectType>([
      "chest",
      "mineChest",
      "cave",
      "animal",
      "wildPredator",
      "eagleSummon",
      "summonerPet",
      "dragon",
      "jammini",
      "legoHazard",
      "miner",
      "villager",
      "blacksmithNpc",
      "villageKnight",
      "villageArcher",
      "villageMage",
      "villageKing",
      "villageGolem",
      "villageShop",
      "villageSellShop",
      "foodStorage",
      "villageHouse",
      "blacksmith",
      "workbench",
      "extendedWorkbench",
      "smelter",
      "specialSmelter",
      "grinder",
      "bed",
      "buildingBlock",
      "train",
    ]).has(type);
  }

  private addContactShadow(root: THREE.Object3D, type: ObjectType, extra: Partial<WorldObject>) {
    if (!this.shouldAddContactShadow(type)) return;
    const radius = Math.max(0.55, extra.collisionRadius ?? extra.terrainRadius ?? (type === "train" ? 4.8 : 1));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 28), this.contactShadowMaterial);
    shadow.name = "painted-contact-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.018;
    shadow.scale.set(radius * 1.24, radius * 0.78, 1);
    shadow.renderOrder = -3;
    shadow.userData.skipRaycastTarget = true;
    root.add(shadow);
    this.sprintHiddenVisuals.push(shadow);
  }

  private removeObject(id: string) {
    const object = this.objects.get(id);
    if (!object) return;
    if (!this.suppressRespawn && this.locationMode === "overworld") {
      const position = (object.homePosition ?? object.root.position).clone(); const dueAt = performance.now() + (object.type === "wildPredator" || object.type === "jammini" ? 45_000 : 90_000);
      if (object.type === "wildPredator" || object.type === "jammini" || object.type === "villageKnight" || object.type === "villageArcher" || object.type === "villageMage" || object.type === "villageGolem") this.respawnQueue.push({ dueAt, type: object.type, position, villageId: object.villageId, predatorKind: object.predatorKind, monsterId: object.monsterId as MonsterId | undefined, regionId: object.regionId });
    }
    this.summonerCompanion.forgetObject(id);
    this.scene.remove(object.root);
    this.objects.delete(id);
    this.objectIdsByType.get(object.type)?.delete(id);
    this.unregisterSpatialObject(id);
    this.raycastTargetsByObject.delete(id);
    if (object.type === "water") {
      this.uncacheWaterVisuals(object.root);
      const waterIndex = this.waterObjects.findIndex((water) => water.id === id);
      if (waterIndex >= 0) this.waterObjects.splice(waterIndex, 1);
    }
    for (let i = this.raycastTargets.length - 1; i >= 0; i -= 1) {
      if (this.findObjectId(this.raycastTargets[i]) === id) this.raycastTargets.splice(i, 1);
    }
    this.disposeObject3D(object.root);
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
      if (Math.hypot(point.x, point.z - 12) < 64) continue;
      if (!this.isNaturalSpawnBlocked(point, 5)) return point;
    }
    return fallback;
  }

  private randomPredatorSpawnPoint(region: ReturnType<typeof regionAtPosition> = regionAtPosition(this.playerPosition, this.activeRegions)) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = region
        ? randomPointInRegion(region)
        : new THREE.Vector3(THREE.MathUtils.randFloatSpread(WORLD_SIZE - 90), 0, THREE.MathUtils.randFloatSpread(WORLD_SIZE - 90));
      point.y = this.getGroundHeightAt(point.x, point.z);
      const minDistance = region ? Math.min(NIGHT_PREDATOR_MIN_PLAYER_DISTANCE, Math.max(28, region.radius * 0.52)) : NIGHT_PREDATOR_MIN_PLAYER_DISTANCE;
      if (point.distanceTo(this.playerPosition) < minDistance) continue;
      if (region ? this.isNearWater(point, 8) || this.isPointInLava(point, 2) : this.isNaturalSpawnBlocked(point, 8)) continue;
      let blocked = false;
      for (const object of this.objectsNear(point, 12)) {
        if (object.type === "wildPredator" || object.type === "animal") continue;
        const radius = Math.max(object.collisionRadius ?? 0, object.terrainRadius ?? 0);
        if (radius <= 0) continue;
        if (Math.hypot(point.x - object.root.position.x, point.z - object.root.position.z) < radius + 5) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return point;
    }
    return null;
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
    if (this.isNearWater(point, margin)) return true;
    if (this.overlapsPriorityBiome(point, 0, margin)) return true;
    return false;
  }

  private isNearWater(point: THREE.Vector3, margin = 0) {
    if (this.overlapsPriorityBiome(point, 0, margin)) return false;
    for (const waterZone of this.activeWaterZones) {
      if (Math.hypot(point.x - waterZone.center.x, point.z - waterZone.center.z) < this.waterZoneRadius(waterZone) + margin) return true;
    }
    return false;
  }

  private isPriorityTerrainReserved(point: THREE.Vector3, radius: number, _terrainKind: TerrainKind) {
    for (const waterZone of this.activeWaterZones) {
      if (Math.hypot(point.x - waterZone.center.x, point.z - waterZone.center.z) < this.waterZoneRadius(waterZone) + radius + 2) return true;
    }
    return Boolean(this.overlapsPriorityBiome(point, radius, 2));
  }

  private waterZoneRadius(waterZone: WaterZone) {
    return waterZone.radius * WATER_RADIUS_MULTIPLIER;
  }

  private restoredWaterRadius(position: THREE.Vector3, radius: number, name: string) {
    const zone = this.activeWaterZones.find((waterZone) => waterZone.name === name && Math.hypot(position.x - waterZone.center.x, position.z - waterZone.center.z) < 3);
    if (!zone) return radius;
    return radius <= zone.radius * 1.2 ? this.waterZoneRadius(zone) : radius;
  }

  private overlapsPriorityBiome(point: THREE.Vector3, radius: number, margin = 0) {
    return this.activeBiomes.find((biome) => Math.hypot(point.x - biome.center.x, point.z - biome.center.z) < biome.radius + radius + margin) ?? null;
  }

  private priorityBiomeAt(point: THREE.Vector3, margin = 0) {
    return this.activeBiomes.find((biome) => Math.hypot(point.x - biome.center.x, point.z - biome.center.z) < biome.radius + margin) ?? null;
  }

  private isSavedPriorityTerrainPatch(savedObject: SavedObject, position: THREE.Vector3) {
    const radius = savedObject.terrainRadius ?? 0;
    if (radius < 8) return false;
    const terrainKind = savedObject.terrainKind ?? "grass";
    const biome = this.priorityBiomeAt(position, 2);
    if (!biome) return false;
    return BIOME_TERRAIN_PLANS[biome.kind].patches.some((patch) => patch.terrain === terrainKind);
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
