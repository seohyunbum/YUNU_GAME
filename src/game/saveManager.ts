import { SAVE_BUILD_ID, SAVE_VERSION } from "./constants";
import type {
  HouseKind,
  ItemId,
  LocationMode,
  PlayerClassId,
  SavedGame,
  SavedVector,
  Slot,
  WorldObject,
} from "./types";

interface VectorLike {
  x: number;
  y: number;
  z: number;
}

export interface SaveDataSnapshot {
  nowMs: number;
  savedAt?: string;
  player: {
    position: VectorLike;
    previousPosition: VectorLike;
    bodyPosition: VectorLike | null;
    yaw: number;
    pitch: number;
    health: number;
    maxHealth: number;
    level: number;
    experience: number;
    playerClass: PlayerClassId;
    mana: number;
    maxMana: number;
    classSkillCooldownUntil: number;
    hunger: number;
    hungerTimer: number;
    worldTimeSeconds: number;
    totalSteps: number;
    chestStepBank: number;
    caveStepBank: number;
    equippedArmor: ItemId | null;
    locationMode: LocationMode;
    currentHouseKind: HouseKind;
    caveReturnPosition: VectorLike | null;
    houseReturnPosition: VectorLike | null;
    toolUses: Record<ItemId, number>;
    selectedHotbarIndex: number;
    hotbar: readonly Slot[];
    bagSlots: readonly Slot[];
    craftSlots: readonly Slot[];
    workbenchSlots: readonly Slot[];
  };
  mountains: readonly { position: VectorLike; radius: number; height: number }[];
  objects: Iterable<WorldObject>;
  excludedObjectIds: readonly string[];
}

export function toSavedVector(vector: VectorLike): SavedVector {
  return { x: vector.x, y: vector.y, z: vector.z };
}

export function cloneSlots(slots: readonly Slot[]): Slot[] {
  return slots.map((slot) => ({
    item: slot.item,
    count: slot.count,
    ...(slot.durabilityUsed && slot.durabilityUsed > 0 ? { durabilityUsed: slot.durabilityUsed } : {}),
  }));
}

function shouldPersistObject(object: WorldObject, excludedObjectIds: ReadonlySet<string>) {
  return (
    !excludedObjectIds.has(object.id) &&
    object.type !== "caveExit" &&
    object.type !== "houseExit" &&
    object.type !== "legoHazard" &&
    object.type !== "eagleSummon"
  );
}

export function createSaveData(snapshot: SaveDataSnapshot): SavedGame {
  const excludedObjectIds = new Set(snapshot.excludedObjectIds);
  const savedPlayerPosition = snapshot.player.bodyPosition ?? snapshot.player.position;
  const previousPosition = snapshot.player.bodyPosition ?? snapshot.player.previousPosition;

  return {
    version: SAVE_VERSION,
    buildId: SAVE_BUILD_ID,
    savedAt: snapshot.savedAt ?? new Date().toISOString(),
    player: {
      position: toSavedVector(savedPlayerPosition),
      previousPosition: toSavedVector(previousPosition),
      yaw: snapshot.player.yaw,
      pitch: snapshot.player.pitch,
      health: snapshot.player.health,
      maxHealth: snapshot.player.maxHealth,
      level: snapshot.player.level,
      experience: snapshot.player.experience,
      playerClass: snapshot.player.playerClass,
      mana: snapshot.player.mana,
      maxMana: snapshot.player.maxMana,
      classSkillCooldownRemainingMs: Math.max(0, snapshot.player.classSkillCooldownUntil - snapshot.nowMs),
      hunger: snapshot.player.hunger,
      hungerTimer: snapshot.player.hungerTimer,
      worldTimeSeconds: snapshot.player.worldTimeSeconds,
      totalSteps: snapshot.player.totalSteps,
      chestStepBank: snapshot.player.chestStepBank,
      caveStepBank: snapshot.player.caveStepBank,
      equippedArmor: snapshot.player.equippedArmor,
      locationMode: snapshot.player.locationMode,
      currentHouseKind: snapshot.player.currentHouseKind,
      caveReturnPosition: snapshot.player.caveReturnPosition ? toSavedVector(snapshot.player.caveReturnPosition) : null,
      houseReturnPosition: snapshot.player.houseReturnPosition ? toSavedVector(snapshot.player.houseReturnPosition) : null,
      toolUses: { ...snapshot.player.toolUses },
      selectedHotbarIndex: snapshot.player.selectedHotbarIndex,
      hotbar: cloneSlots(snapshot.player.hotbar),
      bagSlots: cloneSlots(snapshot.player.bagSlots),
      craftSlots: cloneSlots(snapshot.player.craftSlots),
      workbenchSlots: cloneSlots(snapshot.player.workbenchSlots),
    },
    mountains: snapshot.mountains.map((mountain) => ({
      position: toSavedVector(mountain.position),
      radius: mountain.radius,
      height: mountain.height,
    })),
    objects: [...snapshot.objects]
      .filter((object) => shouldPersistObject(object, excludedObjectIds))
      .map((object) => ({
        type: object.type,
        name: object.name,
        position: toSavedVector(object.root.position),
        hp: object.hp,
        armor: object.armor,
        ore: object.ore,
        opened: object.opened,
        mineRich: object.mineRich,
        caveReturn: object.caveReturn ? toSavedVector(object.caveReturn) : null,
        collidable: object.collidable,
        collisionRadius: object.collisionRadius,
        collisionHeight: object.collisionHeight,
        villageId: object.villageId,
        foodRemaining: object.foodRemaining,
        angryRemainingMs: object.angryUntil && object.angryUntil > snapshot.nowMs ? object.angryUntil - snapshot.nowMs : undefined,
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
        homePosition: object.homePosition ? toSavedVector(object.homePosition) : undefined,
        roamRadius: object.roamRadius,
        enterable: object.enterable,
        houseChestRich: object.houseChestRich,
        houseKind: object.houseKind,
        lockedStation: object.lockedStation,
        harvestProgress: object.harvestProgress,
        antMeatRemaining: object.antMeatRemaining,
        predatorKind: object.predatorKind,
        bossKind: object.bossKind,
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
