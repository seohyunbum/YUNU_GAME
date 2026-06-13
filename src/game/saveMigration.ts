import {
  BASE_MAX_MANA,
  BASE_PLAYER_MAX_HEALTH,
  BASE_BAG_SLOT_COUNT,
  DAY_LENGTH_SECONDS,
  EXPANDED_BAG_SLOT_COUNT,
  EXTENDED_WORKBENCH_SLOT_COUNT,
  HUNGER_MAX,
  HUNGER_TICK_SECONDS,
  IRON_GUARD_DURATION_SECONDS,
  PLAYER_HEIGHT,
  SAVE_BUILD_ID,
  SAVE_VERSION,
  WORLD_SIZE,
} from "./constants";
import { DURABLE_TOOL_TABLES, SHIELD_DEFENSE, SHIELD_DURABILITY } from "./items";
import { PLAYER_CLASSES } from "./classes";
import { DEFAULT_SUMMONER_PET_PROGRESS } from "./classPassives";
import { DEFAULT_WORLD_MAP_ID, isWorldMapId } from "./worldMaps";
import { normalizeBossChapter } from "./bossChapters";
import { HOME_STORAGE_SLOTS, HOME_SUPPLY_COOLDOWN_SECONDS } from "./homeBase";
import { normalizeTrainingStats } from "./training";
import { normalizeDefeatedFieldBosses } from "./fieldBosses";
import type { CompanionProgress, HouseKind, ItemId, LocationMode, PartialSavedGame, PlayerClassId, SavedGame, SavedObject, SavedVector, SavedWorldState, Slot, TutorialProgress, WorldMapId } from "./types";

const DEFAULT_POSITION: SavedVector = { x: 0, y: PLAYER_HEIGHT, z: 12 };
const DEFAULT_WORLD_TIME = DAY_LENGTH_SECONDS * (8 / 24);
const MAX_CLASS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function experienceForNextLevel(level: number) {
  return Math.floor(22.5 * Math.pow(Math.max(1, Math.floor(level)), 1.35));
}

// 현재 레벨/경험치에서 levelUps 만큼 레벨을 올리는 데 필요한 총 경험치 (경험치병 등 즉시 레벨업용)
export function experienceForLevelUps(currentLevel: number, currentExperience: number, levelUps: number) {
  let needed = 0;
  let level = currentLevel;
  let experience = currentExperience;
  for (let i = 0; i < levelUps; i += 1) {
    needed += experienceForNextLevel(level) - experience;
    experience = 0;
    level += 1;
  }
  return Math.max(0, needed);
}

export function levelStatBonus(level: number) {
  return Math.max(0, Math.floor(level) - 1);
}

export function maxHealthForLevel(level: number) {
  return BASE_PLAYER_MAX_HEALTH + levelStatBonus(level) * 2; // 레벨당 HP +2 (방어/공격은 levelStatBonus 그대로 +1)
}

export function supportedSaveVersion(save: PartialSavedGame) {
  const version = typeof save.version === "number" && Number.isFinite(save.version) ? Math.floor(save.version) : 1;
  if (version < 1 || version > SAVE_VERSION) throw new Error(`Unsupported save version: ${version}`);
  return version;
}

export function savedNumber(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
}

export function savedInteger(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  return Math.floor(savedNumber(value, fallback, min, max));
}

export function isSavedVector(value: unknown): value is SavedVector {
  if (!value || typeof value !== "object") return false;
  const vector = value as Partial<SavedVector>;
  return typeof vector.x === "number" && Number.isFinite(vector.x) && typeof vector.y === "number" && Number.isFinite(vector.y) && typeof vector.z === "number" && Number.isFinite(vector.z);
}

export function savedVector(value: unknown, fallback: SavedVector = DEFAULT_POSITION): SavedVector {
  if (!isSavedVector(value)) return { ...fallback };
  return {
    x: savedNumber(value.x, fallback.x, -WORLD_SIZE * 2, WORLD_SIZE * 2),
    y: savedNumber(value.y, fallback.y, -2000, 2000),
    z: savedNumber(value.z, fallback.z, -WORLD_SIZE * 2, WORLD_SIZE * 2),
  };
}

export function toSavedVector(vector: { x: number; y: number; z: number }): SavedVector {
  return { x: vector.x, y: vector.y, z: vector.z };
}

export function savedLocationMode(value: unknown): LocationMode {
  return value === "cave" || value === "house" || value === "overworld" ? value : "overworld";
}

export function savedHouseKind(value: unknown): HouseKind {
  return value === "blacksmith" || value === "twoStory" || value === "home" ? value : "home";
}

export function isPlayerClassId(value: unknown): value is PlayerClassId {
  return typeof value === "string" && value in PLAYER_CLASSES;
}

export function isDurableTool(item: ItemId | null) {
  return Boolean(item && DURABLE_TOOL_TABLES.some((table) => table[item]));
}

export function normalizeSavedMountains(source: unknown) {
  if (!Array.isArray(source)) return [];
  return source
    .filter((mountain): mountain is { position: SavedVector; radius?: number; height?: number } => Boolean(mountain) && typeof mountain === "object" && isSavedVector((mountain as { position?: unknown }).position))
    .map((mountain) => ({
      position: savedVector(mountain.position, { x: 0, y: 0, z: 0 }),
      radius: savedNumber(mountain.radius, 20, 4, 160),
      height: savedNumber(mountain.height, 8, 1, 80),
    }));
}

export function normalizeSavedObjects(source: unknown) {
  if (!Array.isArray(source)) return [];
  return source.filter((object): object is SavedObject => {
    if (!object || typeof object !== "object") return false;
    const candidate = object as Partial<SavedObject>;
    return typeof candidate.type === "string" && isSavedVector(candidate.position);
  });
}

export function normalizeSavedWorldState(source: unknown): SavedWorldState {
  const state = source && typeof source === "object" ? source as Partial<SavedWorldState> : {};
  return {
    mountains: normalizeSavedMountains(state.mountains),
    objects: normalizeSavedObjects(state.objects),
  };
}

export function normalizeSavedWorldStates(source: unknown) {
  const result: Partial<Record<WorldMapId, SavedWorldState>> = {};
  if (!source || typeof source !== "object") return result;
  for (const [id, state] of Object.entries(source)) {
    if (isWorldMapId(id)) result[id] = normalizeSavedWorldState(state);
  }
  return result;
}

export function normalizeCompanionProgress(source: unknown): CompanionProgress {
  const companion = source && typeof source === "object" ? source as Partial<CompanionProgress> : {};
  const summoner = companion.summoner && typeof companion.summoner === "object" ? companion.summoner as Partial<CompanionProgress["summoner"]> : {};
  return {
    summoner: {
      level: savedInteger(summoner.level, DEFAULT_SUMMONER_PET_PROGRESS.level, 1, 999),
      experience: savedInteger(summoner.experience, DEFAULT_SUMMONER_PET_PROGRESS.experience, 0, Number.POSITIVE_INFINITY),
    },
  };
}

export function normalizeTutorialProgress(source: unknown): TutorialProgress {
  const progress = source && typeof source === "object" ? source as Partial<TutorialProgress> : {};
  const completedStepIds = Array.isArray(progress.completedStepIds) ? progress.completedStepIds.filter((id): id is string => typeof id === "string") : [];
  const achievedStepIds = Array.isArray(progress.achievedStepIds) ? progress.achievedStepIds.filter((id): id is string => typeof id === "string") : [];
  return { completedStepIds: [...new Set(completedStepIds)], achievedStepIds: [...new Set([...achievedStepIds, ...completedStepIds])] };
}

function isSlotLike(value: unknown): value is Slot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<Slot>;
  return (typeof slot.item === "string" || slot.item === null || slot.item === undefined) && typeof slot.count === "number" && Number.isFinite(slot.count);
}

export function normalizeSavedSlots(source: unknown, minLength: number, fallback: Slot[] = [], legacyToolUses: Record<ItemId, number> = {}) {
  const sourceSlots = Array.isArray(source) && source.length > 0 ? source.filter(isSlotLike) : fallback;
  const targetLength = Math.max(minLength, sourceSlots.length);
  const normalized: Slot[] = [];

  for (const slot of sourceSlots) {
    if (!slot.item || slot.count <= 0) {
      normalized.push({ item: null, count: 0 });
      continue;
    }

    if (isDurableTool(slot.item)) {
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

export function migrateSaveData(save: PartialSavedGame): SavedGame {
  if (!save.player) throw new Error("Save is missing player data.");
  const incomingVersion = supportedSaveVersion(save);

  const player = save.player;
  const hotbarFallback: Slot[] = [
    { item: "tutorial_book", count: 1 },
    ...Array.from({ length: 7 }, () => ({ item: null, count: 0 })),
  ];
  const bagSource = Array.isArray(player.bagSlots) ? player.bagSlots : [];
  const bagTargetLength = bagSource.length > BASE_BAG_SLOT_COUNT ? EXPANDED_BAG_SLOT_COUNT : BASE_BAG_SLOT_COUNT;
  const migratedLevel = savedInteger(player.level, 1, 1, 999);
  const migratedExperience = savedInteger(player.experience, 0, 0, Number.POSITIVE_INFINITY);
  const migratedMaxHealth = Math.max(
    savedInteger(player.maxHealth, BASE_PLAYER_MAX_HEALTH, 1, 9999),
    maxHealthForLevel(migratedLevel),
  );
  const migratedHealth = Math.min(
    migratedMaxHealth,
    savedInteger(player.health, migratedMaxHealth, 1, migratedMaxHealth),
  );
  const migratedPlayerClass = isPlayerClassId(player.playerClass) ? player.playerClass : "warrior";
  const migratedMaxMana = savedNumber(player.maxMana, BASE_MAX_MANA, 1, 9999);
  const migratedMana = savedNumber(player.mana, migratedMaxMana, 0, migratedMaxMana);
  const migratedClassCooldown = savedNumber(player.classSkillCooldownRemainingMs, 0, 0, MAX_CLASS_COOLDOWN_MS);
  const migratedShield = player.equippedShield && SHIELD_DEFENSE[player.equippedShield] ? player.equippedShield : null;
  const migratedShieldDurability = migratedShield ? savedInteger(player.shieldDurabilityUsed, 0, 0, SHIELD_DURABILITY[migratedShield] ?? 0) : 0;
  const playerPosition = savedVector(player.position, DEFAULT_POSITION);
  const migratedWorldMapId = isWorldMapId(player.worldMapId) ? player.worldMapId : DEFAULT_WORLD_MAP_ID;
  const migratedMountains = normalizeSavedMountains(save.mountains);
  const migratedObjects = normalizeSavedObjects(save.objects);
  const migratedWorldStates = normalizeSavedWorldStates(save.worldStates);
  if (!migratedWorldStates[migratedWorldMapId]) migratedWorldStates[migratedWorldMapId] = { mountains: migratedMountains, objects: migratedObjects };

  return {
    version: SAVE_VERSION,
    buildId: SAVE_BUILD_ID,
    migratedFromVersion: incomingVersion === SAVE_VERSION ? undefined : incomingVersion,
    savedAt: typeof save.savedAt === "string" ? save.savedAt : new Date().toISOString(),
    player: {
      position: playerPosition,
      previousPosition: savedVector(player.previousPosition, playerPosition),
      yaw: savedNumber(player.yaw, 0, -Math.PI * 8, Math.PI * 8),
      pitch: savedNumber(player.pitch, 0, -1.32, 1.32),
      health: migratedHealth,
      maxHealth: migratedMaxHealth,
      level: migratedLevel,
      experience: migratedExperience,
      playerClass: migratedPlayerClass,
      mana: migratedMana,
      maxMana: migratedMaxMana,
      classSkillCooldownRemainingMs: migratedClassCooldown,
      secondSkillCooldownRemainingMs: savedNumber(player.secondSkillCooldownRemainingMs, 0, 0, MAX_CLASS_COOLDOWN_MS),
      companionProgress: normalizeCompanionProgress(player.companionProgress),
      tutorial: normalizeTutorialProgress(player.tutorial),
      hunger: savedNumber(player.hunger, HUNGER_MAX, 0, HUNGER_MAX),
      hungerTimer: savedNumber(player.hungerTimer, 0, 0, HUNGER_TICK_SECONDS),
      worldTimeSeconds: savedNumber(player.worldTimeSeconds, DEFAULT_WORLD_TIME, 0, DAY_LENGTH_SECONDS),
      worldMapId: migratedWorldMapId,
      bossChapter: normalizeBossChapter(player.bossChapter),
      defeatedFieldBosses: normalizeDefeatedFieldBosses(player.defeatedFieldBosses),
      totalSteps: savedNumber(player.totalSteps, 0, 0),
      chestStepBank: savedNumber(player.chestStepBank, 0, 0),
      caveStepBank: savedNumber(player.caveStepBank, 0, 0),
      equippedArmor: player.equippedArmor ?? null,
      equippedShield: migratedShield,
      shieldDurabilityUsed: migratedShieldDurability,
      ironGuardRemainingMs: savedNumber(player.ironGuardRemainingMs, 0, 0, IRON_GUARD_DURATION_SECONDS * 1000),
      locationMode: savedLocationMode(player.locationMode),
      currentHouseKind: savedHouseKind(player.currentHouseKind),
      currentHouseOwned: player.currentHouseOwned === true,
      trainingStats: normalizeTrainingStats(player.trainingStats),
      homeStorage: normalizeSavedSlots(player.homeStorage, HOME_STORAGE_SLOTS, [], player.toolUses),
      homeSupplyCooldownSeconds: savedNumber(player.homeSupplyCooldownSeconds, 0, 0, HOME_SUPPLY_COOLDOWN_SECONDS),
      caveReturnPosition: isSavedVector(player.caveReturnPosition) ? savedVector(player.caveReturnPosition, DEFAULT_POSITION) : null,
      houseReturnPosition: isSavedVector(player.houseReturnPosition) ? savedVector(player.houseReturnPosition, DEFAULT_POSITION) : null,
      toolUses: {},
      selectedHotbarIndex: savedInteger(player.selectedHotbarIndex, 0, 0, 7),
      hotbar: normalizeSavedSlots(player.hotbar, 8, hotbarFallback, player.toolUses),
      bagSlots: normalizeSavedSlots(bagSource, bagTargetLength, [], player.toolUses),
      craftSlots: normalizeSavedSlots(player.craftSlots, 4, [], player.toolUses),
      workbenchSlots: normalizeSavedSlots(player.workbenchSlots, EXTENDED_WORKBENCH_SLOT_COUNT, [], player.toolUses),
    },
    mountains: migratedMountains,
    objects: migratedObjects,
    worldStates: migratedWorldStates,
  };
}
