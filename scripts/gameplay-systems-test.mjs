import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function almostEqual(actual, expected, label) {
  if (Math.abs(actual - expected) > 0.0001) failures.push(`${label}: expected ${expected}, got ${actual}`);
}

function createHotbarContext(overrides = {}) {
  const state = {
    panel: null,
    health: 5,
    maxHealth: 20,
    hunger: 3,
    cooldownUntil: 0,
    now: 1_000,
    itemCount: 1,
    removed: 0,
    openedPanel: null,
    handActions: 0,
    healEffects: 0,
    tones: 0,
    messages: [],
    hudRenders: 0,
    equippedShield: null,
    ...overrides,
  };
  return {
    state,
    context: {
      currentPanel: () => state.panel,
      health: () => state.health,
      maxHealth: () => state.maxHealth,
      hunger: () => state.hunger,
      healItemCooldownUntil: () => state.cooldownUntil,
      now: () => state.now,
      setHealth: (value) => {
        state.health = value;
      },
      setHunger: (value) => {
        state.hunger = value;
      },
      setHealItemCooldownUntil: (value) => {
        state.cooldownUntil = value;
      },
      resetStarvationTimer: () => {},
      openPanel: (panel) => {
        state.openedPanel = panel;
      },
      fireRangedWeapon: () => {},
      useSelectedBucketOnLook: () => {},
      useDragonSpawnItem: () => {},
      showMirrorView: () => {},
      removeItem: () => {
        if (state.itemCount <= 0) return false;
        state.itemCount -= 1;
        state.removed += 1;
        return true;
      },
      equipArmor: () => {},
      equipShield: (item) => {
        state.equippedShield = item;
      },
      playHandAction: () => {
        state.handActions += 1;
      },
      spawnHealEffect: () => {
        state.healEffects += 1;
      },
      playTone: () => {
        state.tones += 1;
      },
      showMessage: (text) => {
        state.messages.push(text);
      },
      renderHud: () => {
        state.hudRenders += 1;
      },
    },
  };
}

try {
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const items = await server.ssrLoadModule("/src/game/items.ts");
  const classPassives = await server.ssrLoadModule("/src/game/classPassives.ts");
  const classes = await server.ssrLoadModule("/src/game/classes.ts");
  const combat = await server.ssrLoadModule("/src/game/combat.ts");
  const hotbarUse = await server.ssrLoadModule("/src/game/hotbarUse.ts");
  const inventoryCapacity = await server.ssrLoadModule("/src/game/inventoryCapacity.ts");
  const interactionPriority = await server.ssrLoadModule("/src/game/interactionPriority.ts");
  const monsters = await server.ssrLoadModule("/src/game/monsters.ts");
  const regions = await server.ssrLoadModule("/src/game/regions.ts");
  const bossChapters = await server.ssrLoadModule("/src/game/bossChapters.ts");
  const graveTrap = await server.ssrLoadModule("/src/game/graveTrap.ts");
  const THREE = await import("three");

  const { EAGLE_CLAW_COOLDOWN, EAGLE_CLAW_DAMAGE, EAGLE_RAM_DAMAGE, HUNGER_HP_REGEN, HUNGER_MAX, IRON_GUARD_ARMOR, IRON_GUARD_DURATION_SECONDS, MANA_REGEN_PER_SECOND, NIGHT_PREDATOR_MAX_COUNT, RANGED_ATTACK_COOLDOWN, TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST, WIND_CUTTER_COOLDOWN, WIND_CUTTER_DAMAGE } = constants;
  const { HEAL_ITEMS, SHIELD_DEFENSE, SHIELD_DURABILITY, WEAPON_DAMAGE } = items;
  const { CLASS_PASSIVES, DEFAULT_SUMMONER_PET_PROGRESS, summonerPetDamage } = classPassives;
  const { PLAYER_CLASSES } = classes;
  const { calculateCombatDamage } = combat;
  const { useHotbarItem } = hotbarUse;
  const { canReceiveRecipeOutput } = inventoryCapacity;
  const { shouldFireRangedDuringInteract } = interactionPriority;
  const { isPredatorMonster, predatorStatsForMonster } = monsters;
  const { REGIONS } = regions;
  const { BOSS_PROGRESSION, FINAL_BOSS_CHAPTER, applyBossDefeat, bossLockMessage, isBossUnlocked, nextBossTarget, normalizeBossChapter } = bossChapters;
  const { GRAVE_HAND_COUNT, createGraveTrapState, updateGraveTrap } = graveTrap;

  assert(HEAL_ITEMS.medkit === 15, "medkit should heal 15 HP");
  assert(HUNGER_HP_REGEN.length === HUNGER_MAX + 1, "hunger regen table should cover every hunger level");
  almostEqual(HUNGER_HP_REGEN[5], 0.05, "hunger 5 regen");
  almostEqual(HUNGER_HP_REGEN[4], 0.03, "hunger 4 regen");
  almostEqual(HUNGER_HP_REGEN[3], 0.015, "hunger 3 regen");
  almostEqual(HUNGER_HP_REGEN[2], 0.005, "hunger 2 regen");
  almostEqual(HUNGER_HP_REGEN[1], 0, "hunger 1 regen");
  almostEqual(HUNGER_HP_REGEN[0], 0, "hunger 0 regen");

  almostEqual(CLASS_PASSIVES.warrior.armorBonus, 6, "warrior armor passive");
  almostEqual(RANGED_ATTACK_COOLDOWN * CLASS_PASSIVES.gunner.rangedCooldownScale, 0.252, "gunner ranged cooldown");
  almostEqual(MANA_REGEN_PER_SECOND * CLASS_PASSIVES.mage.manaRegenScale, 2, "mage mana regen");
  almostEqual(CLASS_PASSIVES.healer.healthRegenPerSec + HUNGER_HP_REGEN[5], 0.3, "healer full-hunger regen");
  almostEqual(CLASS_PASSIVES.healer.healthRegenPerSec + HUNGER_HP_REGEN[1], 0.25, "healer low-hunger passive-only regen");
  assert(PLAYER_CLASSES.tanker.starterItem === "iron_shield", "tanker should start with iron shield");
  assert(PLAYER_CLASSES.tanker.manaCost === TANKER_SKILL_COST, "tanker skill mana cost should match constant");
  assert(PLAYER_CLASSES.tanker.cooldown === TANKER_SKILL_COOLDOWN, "tanker skill cooldown should match constant");
  almostEqual(CLASS_PASSIVES.tanker.armorBonus, 8, "tanker armor passive");
  assert(IRON_GUARD_ARMOR === 15 && IRON_GUARD_DURATION_SECONDS === 100, "iron guard should keep the intended armor/duration");
  assert(SHIELD_DEFENSE.iron_shield === 5, "iron shield should add 5 defense");
  assert(SHIELD_DURABILITY.iron_shield === 200, "iron shield should last 200 hits");
  assert(WEAPON_DAMAGE.iron_shield === 3, "iron shield bash should deal 3 damage");
  assert(EAGLE_RAM_DAMAGE === 5, "possessed eagle ram should start from 5 damage");
  assert(EAGLE_CLAW_DAMAGE === 20 && EAGLE_CLAW_COOLDOWN === 30, "possessed eagle claw should keep intended damage/cooldown");
  assert(WIND_CUTTER_DAMAGE === 35 && WIND_CUTTER_COOLDOWN === 40, "possessed eagle wind cutter should keep intended damage/cooldown");
  assert(EAGLE_RAM_DAMAGE + WEAPON_DAMAGE.iron_sword + 4 === 15, "possessed eagle damage should include held weapon and level bonus");
  assert(summonerPetDamage(DEFAULT_SUMMONER_PET_PROGRESS) === 2, "summoner pet starts at 2 damage");
  almostEqual(CLASS_PASSIVES.summoner.pet.flightAhead, 2.2, "summoner pet should fly ahead of the player");
  almostEqual(CLASS_PASSIVES.summoner.pet.flightSide, 1.3, "summoner pet should stay to the side of the crosshair");
  almostEqual(CLASS_PASSIVES.summoner.pet.flightRise, 0.5, "summoner pet should hover above eye height");
  assert(NIGHT_PREDATOR_MAX_COUNT <= 8, "night predator count should stay capped to protect zone performance");
  assert(shouldFireRangedDuringInteract(true, false, false) === true, "ranged interact should fire when no target exists");
  assert(shouldFireRangedDuringInteract(true, true, true) === true, "ranged interact should fire at combat targets");
  assert(shouldFireRangedDuringInteract(true, true, false) === false, "ranged interact should not block chests/workbenches/noncombat targets");
  assert(shouldFireRangedDuringInteract(false, true, true) === false, "melee/tool interact should not use ranged priority");
  assert(
    canReceiveRecipeOutput(
      [{ item: "wood", count: 10 }, { item: "hammer", count: 2 }],
      { id: "crafting_table", name: "제작대", output: "crafting_table", count: 1, ingredients: { wood: 3, hammer: 1 }, note: "" },
      () => false,
    ) === false,
    "crafting should be blocked when output has no stack or empty slot",
  );
  assert(
    canReceiveRecipeOutput(
      [{ item: "wood", count: 3 }, { item: "hammer", count: 1 }],
      { id: "crafting_table", name: "제작대", output: "crafting_table", count: 1, ingredients: { wood: 3, hammer: 1 }, note: "" },
      () => false,
      { wood: 3, hammer: 1 },
    ) === true,
    "direct recipe crafting may use slots freed by consumed ingredients",
  );
  assert(
    canReceiveRecipeOutput(
      [{ item: null, count: 0 }, { item: "wood", count: 1 }],
      { id: "wood_pickaxe", name: "나무 곡괭이", output: "wood_pickaxe", count: 2, ingredients: { wood: 1 }, note: "" },
      (item) => item === "wood_pickaxe",
    ) === false,
    "durable crafted outputs need one empty slot per item",
  );

  for (const region of REGIONS) {
    for (const entry of region.monsters.filter((monster) => isPredatorMonster(monster.id))) {
      const stats = predatorStatsForMonster(entry.id);
      const atLevelAttack = Math.floor(8 + region.level * 0.8);
      const damage = calculateCombatDamage(atLevelAttack, 0);
      const hitsToKill = Math.ceil(stats.hp / Math.max(1, damage));
      assert(hitsToKill <= 18, `${region.name}/${entry.id}: at-level hits to kill ${hitsToKill} should be <= 18`);
      assert(stats.aggroRange <= 28, `${region.name}/${entry.id}: aggro range ${stats.aggroRange} should stay bounded`);
    }
  }

  {
    const { state, context } = createHotbarContext({ health: 5, maxHealth: 20, itemCount: 1 });
    useHotbarItem("medkit", context);
    assert(state.health === 20, `medkit should cap heal at max HP, got ${state.health}`);
    assert(state.itemCount === 0 && state.removed === 1, "medkit should consume one item after successful use");
    assert(state.cooldownUntil === 2_000, `medkit should set 1s cooldown, got ${state.cooldownUntil}`);
    assert(state.handActions === 1 && state.healEffects === 1 && state.tones === 1, "medkit should play use/heal feedback");
    assert(state.hudRenders === 1, "medkit should render HUD after healing");
  }

  {
    const { state, context } = createHotbarContext({ health: 20, maxHealth: 20, itemCount: 1 });
    useHotbarItem("medkit", context);
    assert(state.itemCount === 1 && state.removed === 0, "full HP medkit use should not consume item");
    assert(state.hudRenders === 0, "full HP medkit use should not rerender HUD as a heal");
  }

  {
    const { state, context } = createHotbarContext({ health: 10, maxHealth: 20, itemCount: 1, cooldownUntil: 1_500 });
    useHotbarItem("medkit", context);
    assert(state.health === 10, "medkit should not heal during cooldown");
    assert(state.itemCount === 1 && state.removed === 0, "medkit cooldown should not consume item");
  }

  {
    const { state, context } = createHotbarContext();
    useHotbarItem("iron_shield", context);
    assert(state.equippedShield === "iron_shield", "iron shield hotbar use should equip shield");
    assert(state.itemCount === 1 && state.removed === 0, "equipping shield should not consume item");
    assert(state.hudRenders === 1, "equipping shield should render HUD");
  }

  {
    // 보스 챕터 게이팅 골든 시나리오
    assert(normalizeBossChapter(undefined) === 0, "missing boss chapter should normalize to 0");
    assert(normalizeBossChapter(-3) === 0 && normalizeBossChapter(99) === FINAL_BOSS_CHAPTER, "boss chapter should clamp to 0..final");
    assert(normalizeBossChapter(2.9) === 2, "boss chapter should floor fractional values");
    assert(isBossUnlocked("dragon", 0), "first dragon should be unlocked from the start");
    assert(!isBossUnlocked("fire_dragon", 0), "fire dragon should be sealed before first dragon kill");
    assert(bossLockMessage("dragon", 0) === null, "unlocked boss should have no lock message");
    const fireLock = bossLockMessage("fire_dragon", 0);
    assert(typeof fireLock === "string" && fireLock.includes("봉인"), "sealed boss should explain the seal");
    assert(nextBossTarget(0)?.kind === "dragon" && nextBossTarget(0)?.recommendedLevel === 10, "chapter 0 target should be the first dragon at level 10");

    let chapter = 0;
    const offTarget = applyBossDefeat(chapter, "immortal");
    assert(offTarget.bossChapter === 0 && offTarget.message === null, "defeating a non-target boss should not advance the chapter");
    for (const step of BOSS_PROGRESSION) {
      const result = applyBossDefeat(chapter, step.kind);
      assert(result.bossChapter === chapter + 1, `defeating ${step.kind} should advance to chapter ${chapter + 1}`);
      assert(typeof result.message === "string" && result.message.includes("클리어"), `chapter ${step.chapter} clear should announce progress`);
      chapter = result.bossChapter;
    }
    assert(chapter === FINAL_BOSS_CHAPTER && nextBossTarget(chapter) === null, "clearing every boss should finish the progression");
    const rekill = applyBossDefeat(chapter, "dragon");
    assert(rekill.bossChapter === FINAL_BOSS_CHAPTER && rekill.message === null, "re-killing an earlier boss should not change a finished chapter");
    assert(isBossUnlocked("immortal", FINAL_BOSS_CHAPTER - 1), "final boss should unlock after the four kings");
  }

  {
    // 초록손 무덤 함정 시나리오: 밟으면 지하 진입 → 좀비 사망 시 출구 → 지상 복귀 시 상태 정리
    const makeObject = (type, x, z) => ({
      id: `${type}-${x}-${z}`,
      type,
      name: type,
      hp: 660,
      root: new THREE.Group(),
    });
    const state = createGraveTrapState();
    const calls = [];
    let mode = "overworld";
    const hand = makeObject("graveHand", 0.4, 0.3);
    hand.root.position.set(0.4, 0, 0.3);
    let hands = [hand];
    let zombie = null;
    const context = {
      state,
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      locationMode: () => mode,
      worldMapId: () => "graveyard",
      now: () => 1_000,
      graveHands: () => hands,
      getObject: (id) => (zombie && zombie.id === id && zombie.hp > 0 ? zombie : undefined),
      removeObject: (id) => {
        calls.push(["remove", id]);
        hands = hands.filter((entry) => entry.id !== id);
      },
      addWorldObject: (type, name, root) => {
        calls.push(["add", type]);
        return { id: `${type}-added`, type, name, root };
      },
      addCaveDressing: () => calls.push(["dressing"]),
      spawnZombie: (position) => {
        zombie = makeObject("wildPredator", position.x, position.z);
        zombie.root.position.copy(position);
        return zombie;
      },
      enterUnderground: () => {
        mode = "cave";
        calls.push(["enter"]);
      },
      getGroundHeightAt: () => 0,
      runWalkCycle: () => {},
      refreshSpatialObject: () => {},
      damagePlayer: (amount) => {
        calls.push(["damage", amount]);
        return false;
      },
      showMessage: (text) => calls.push(["message", text]),
      renderHud: () => {},
    };

    updateGraveTrap(context, 0.016);
    assert(state.active && mode === "cave", "stepping on a green hand should pull the player underground");
    assert(calls.some(([kind]) => kind === "enter") && calls.some(([kind]) => kind === "dressing"), "trap should enter underground and build the burrow");
    assert(zombie !== null && state.zombieId === zombie.id, "trap should spawn one burrow zombie");
    assert(hands.length === 0, "triggered hand grave should be consumed");

    updateGraveTrap(context, 0.016);
    assert(!state.exitSpawned, "exit should stay closed while the zombie lives");
    zombie.hp = 0;
    updateGraveTrap(context, 0.016);
    assert(state.exitSpawned, "killing the burrow zombie should open the exit");
    assert(calls.some(([kind, value]) => kind === "add" && value === "caveExit"), "exit portal should be spawned as a caveExit");

    mode = "overworld";
    updateGraveTrap(context, 0.016);
    assert(!state.active && state.zombieId === null, "leaving the burrow should reset the trap state");

    // 손 무덤 자동 충원: 묘지 지상에서 부족분이 채워진다 (플레이어 주변 제외)
    context.playerPosition.set(999, 1.7, 999);
    hands = [];
    const handAddsBefore = calls.filter(([kind, value]) => kind === "add" && value === "graveHand").length;
    updateGraveTrap(context, 0.016);
    const added = calls.filter(([kind, value]) => kind === "add" && value === "graveHand").length - handAddsBefore;
    assert(added > 0 && added <= GRAVE_HAND_COUNT, `graveyard should replenish green hands (added ${added})`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`SYSTEM TEST FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      ok: true,
      checks: [
        "medkit heals, caps, consumes, and respects cooldown",
        "hunger regen curve golden values",
        "class passive golden values",
        "tanker shield and iron guard golden values",
        "ranged interact priority preserves noncombat interactions",
        "crafting output capacity blocks item loss",
        "region predator count and at-level TTK guard",
        "boss chapter gating golden scenario",
        "grave trap pull-in, zombie kill exit, and hand replenish",
      ],
    }, null, 2));
  }
} finally {
  await server.close();
}
