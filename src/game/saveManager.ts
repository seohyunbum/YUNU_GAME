import { SAVE_BUILD_ID, SAVE_VERSION } from "./constants";
import type { BedTier } from "./constants";
import { normalizeBossChapter } from "./bossChapters";
import type {
  HouseKind,
  ItemId,
  LocationMode,
  PlayerClassId,
  SavedGame,
  SavedWorldState,
  SavedVector,
  Slot,
  CompanionProgress,
  TutorialProgress,
  WorldMapId,
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
    craftLevel: number;
    craftExperience: number;
    craftStatPoints: number;
    craftStatAlloc: { hp: number; mana: number; attack: number; defense: number };
    classSkillCooldownUntil: number;
    secondSkillCooldownUntil: number;
    companionProgress: CompanionProgress;
    tutorial: TutorialProgress;
    hunger: number;
    hungerTimer: number;
    worldTimeSeconds: number;
    worldMapId: WorldMapId;
    bossChapter: number;
    defeatedFieldBosses: readonly string[];
    totalSteps: number;
    playSeconds: number;
    chestStepBank: number;
    caveStepBank: number;
    equippedArmor: ItemId | null;
    equippedShield: ItemId | null;
    shieldDurabilityUsed: number;
    ironGuardUntil: number;
    locationMode: LocationMode;
    currentHouseKind: HouseKind;
    currentHouseBedTier: BedTier;
    currentHouseOwned: boolean;
    trainingStats: { hp: number; attack: number; armor: number; mana: number };
    homeStorage: readonly Slot[];
    homeSupplyCooldownSeconds: number;
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
  worldStates?: Partial<Record<WorldMapId, SavedWorldState>>;
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

export function cloneSavedWorldState(state: SavedWorldState): SavedWorldState {
  return {
    mountains: state.mountains.map((mountain) => ({ position: { ...mountain.position }, radius: mountain.radius, height: mountain.height })),
    objects: state.objects.map((object) => ({ ...object, position: { ...object.position }, ...(object.caveReturn ? { caveReturn: { ...object.caveReturn } } : {}), ...(object.homePosition ? { homePosition: { ...object.homePosition } } : {}) })),
  };
}

function shouldPersistObject(object: WorldObject, excludedObjectIds: ReadonlySet<string>) {
  return (
    !excludedObjectIds.has(object.id) &&
    !object.partyTransient && // 파티 동기화 몬스터 — 호스트 월드의 뷰이므로 저장하지 않는다
    object.type !== "caveExit" &&
    object.type !== "houseExit" &&
    object.type !== "trainingGround" &&
    object.type !== "trainingRig" &&
    object.type !== "legoHazard" &&
    object.type !== "eagleSummon" &&
    object.type !== "summonerPet"
  );
}

export function createSavedWorldState(snapshot: Pick<SaveDataSnapshot, "nowMs" | "mountains" | "objects" | "excludedObjectIds">): SavedWorldState {
  const excludedObjectIds = new Set(snapshot.excludedObjectIds);
  return {
    mountains: snapshot.mountains.map((mountain) => ({
      position: toSavedVector(mountain.position),
      radius: mountain.radius,
      height: mountain.height,
    })),
    objects: [...snapshot.objects]
      .filter((object) => shouldPersistObject(object, excludedObjectIds))
      // 필드 보스는 저장하지 않는다 — 처치 기록(defeatedFieldBosses)만 저장하고 스폰은 ensure 가 맡는다
      .filter((object) => !object.fieldBossId)
      .filter((object) => object.expiresAt === undefined || object.expiresAt > snapshot.nowMs)
      .map((object) => ({
        type: object.type,
        name: object.name,
        position: toSavedVector(object.root.position),
        hp: object.hp,
        armor: object.armor,
        ore: object.ore,
        opened: object.opened,
        expiresRemainingMs: object.expiresAt && object.expiresAt > snapshot.nowMs ? object.expiresAt - snapshot.nowMs : undefined,
        mineRich: object.mineRich,
        chestTier: object.chestTier,
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
        playerOwned: object.playerOwned,
        bedTier: object.bedTier,
        lockedStation: object.lockedStation,
        harvestProgress: object.harvestProgress,
        antMeatRemaining: object.antMeatRemaining,
        predatorKind: object.predatorKind,
        bossKind: object.bossKind,
        regionId: object.regionId,
        monsterId: object.monsterId,
        monsterLevel: object.monsterLevel,
        lootTier: object.lootTier,
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

export function createSaveData(snapshot: SaveDataSnapshot): SavedGame {
  const savedPlayerPosition = snapshot.player.bodyPosition ?? snapshot.player.position;
  const previousPosition = snapshot.player.bodyPosition ?? snapshot.player.previousPosition;
  const currentWorldState = createSavedWorldState(snapshot);
  const worldStates = { ...snapshot.worldStates, [snapshot.player.worldMapId]: currentWorldState };

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
      craftLevel: snapshot.player.craftLevel,
      craftExperience: snapshot.player.craftExperience,
      craftStatPoints: snapshot.player.craftStatPoints,
      craftStatAlloc: { ...snapshot.player.craftStatAlloc },
      classSkillCooldownRemainingMs: Math.max(0, snapshot.player.classSkillCooldownUntil - snapshot.nowMs),
      secondSkillCooldownRemainingMs: Math.max(0, snapshot.player.secondSkillCooldownUntil - snapshot.nowMs),
      companionProgress: {
        summoner: { ...snapshot.player.companionProgress.summoner },
      },
      tutorial: { completedStepIds: [...snapshot.player.tutorial.completedStepIds], achievedStepIds: [...snapshot.player.tutorial.achievedStepIds] },
      hunger: snapshot.player.hunger,
      hungerTimer: snapshot.player.hungerTimer,
      worldTimeSeconds: snapshot.player.worldTimeSeconds,
      worldMapId: snapshot.player.worldMapId,
      bossChapter: normalizeBossChapter(snapshot.player.bossChapter),
      defeatedFieldBosses: [...snapshot.player.defeatedFieldBosses],
      totalSteps: snapshot.player.totalSteps,
      playSeconds: snapshot.player.playSeconds,
      chestStepBank: snapshot.player.chestStepBank,
      caveStepBank: snapshot.player.caveStepBank,
      equippedArmor: snapshot.player.equippedArmor,
      equippedShield: snapshot.player.equippedShield,
      shieldDurabilityUsed: snapshot.player.shieldDurabilityUsed,
      ironGuardRemainingMs: Math.max(0, snapshot.player.ironGuardUntil - snapshot.nowMs),
      locationMode: snapshot.player.locationMode,
      currentHouseKind: snapshot.player.currentHouseKind,
      currentHouseBedTier: snapshot.player.currentHouseBedTier,
      currentHouseOwned: snapshot.player.currentHouseOwned,
      trainingStats: { ...snapshot.player.trainingStats },
      homeStorage: cloneSlots(snapshot.player.homeStorage),
      homeSupplyCooldownSeconds: snapshot.player.homeSupplyCooldownSeconds,
      caveReturnPosition: snapshot.player.caveReturnPosition ? toSavedVector(snapshot.player.caveReturnPosition) : null,
      houseReturnPosition: snapshot.player.houseReturnPosition ? toSavedVector(snapshot.player.houseReturnPosition) : null,
      toolUses: { ...snapshot.player.toolUses },
      selectedHotbarIndex: snapshot.player.selectedHotbarIndex,
      hotbar: cloneSlots(snapshot.player.hotbar),
      bagSlots: cloneSlots(snapshot.player.bagSlots),
      craftSlots: cloneSlots(snapshot.player.craftSlots),
      workbenchSlots: cloneSlots(snapshot.player.workbenchSlots),
    },
    mountains: currentWorldState.mountains,
    objects: currentWorldState.objects,
    worldStates,
  };
}
