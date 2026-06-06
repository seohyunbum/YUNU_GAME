import {
  BASE_MAX_MANA,
  BASE_PLAYER_MAX_HEALTH,
  DAY_LENGTH_SECONDS,
  EXTENDED_WORKBENCH_SLOT_COUNT,
  HUNGER_MAX,
  HUNGER_TICK_SECONDS,
  PLAYER_HEIGHT,
  SAVE_BUILD_ID,
  SAVE_VERSION,
  WORLD_SIZE,
} from "./constants";
import { DURABLE_TOOL_TABLES } from "./items";
import { PLAYER_CLASSES } from "./classes";
import type { HouseKind, ItemId, LocationMode, PartialSavedGame, PlayerClassId, SavedGame, SavedObject, SavedVector, Slot } from "./types";

const DEFAULT_POSITION: SavedVector = { x: 0, y: PLAYER_HEIGHT, z: 12 };
const DEFAULT_WORLD_TIME = DAY_LENGTH_SECONDS * (8 / 24);
const MAX_CLASS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function experienceForNextLevel(level: number) {
  return Math.floor(45 * Math.pow(Math.max(1, Math.floor(level)), 1.35));
}

export function levelStatBonus(level: number) {
  return Math.max(0, Math.floor(level) - 1);
}

export function maxHealthForLevel(level: number) {
  return BASE_PLAYER_MAX_HEALTH + levelStatBonus(level);
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
  const playerPosition = savedVector(player.position, DEFAULT_POSITION);

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
      hunger: savedNumber(player.hunger, HUNGER_MAX, 0, HUNGER_MAX),
      hungerTimer: savedNumber(player.hungerTimer, 0, 0, HUNGER_TICK_SECONDS),
      worldTimeSeconds: savedNumber(player.worldTimeSeconds, DEFAULT_WORLD_TIME, 0, DAY_LENGTH_SECONDS),
      totalSteps: savedNumber(player.totalSteps, 0, 0),
      chestStepBank: savedNumber(player.chestStepBank, 0, 0),
      caveStepBank: savedNumber(player.caveStepBank, 0, 0),
      equippedArmor: player.equippedArmor ?? null,
      locationMode: savedLocationMode(player.locationMode),
      currentHouseKind: savedHouseKind(player.currentHouseKind),
      caveReturnPosition: isSavedVector(player.caveReturnPosition) ? savedVector(player.caveReturnPosition, DEFAULT_POSITION) : null,
      houseReturnPosition: isSavedVector(player.houseReturnPosition) ? savedVector(player.houseReturnPosition, DEFAULT_POSITION) : null,
      toolUses: {},
      selectedHotbarIndex: savedInteger(player.selectedHotbarIndex, 0, 0, 7),
      hotbar: normalizeSavedSlots(player.hotbar, 8, hotbarFallback, player.toolUses),
      bagSlots: normalizeSavedSlots(bagSource, bagSource.length, [], player.toolUses),
      craftSlots: normalizeSavedSlots(player.craftSlots, 4, [], player.toolUses),
      workbenchSlots: normalizeSavedSlots(player.workbenchSlots, EXTENDED_WORKBENCH_SLOT_COUNT, [], player.toolUses),
    },
    mountains: normalizeSavedMountains(save.mountains),
    objects: normalizeSavedObjects(save.objects),
  };
}
