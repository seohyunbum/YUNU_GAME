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
    levelsGranted: 0,
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
      grantLevels: (count) => {
        state.levelsGranted += count;
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
  const deathDrop = await server.ssrLoadModule("/src/game/deathDrop.ts");
  const partyChat = await server.ssrLoadModule("/src/ui/partyChat.ts");
  const objectiveClaim = await server.ssrLoadModule("/src/objectiveClaim.ts");
  const regions = await server.ssrLoadModule("/src/game/regions.ts");
  const bossChapters = await server.ssrLoadModule("/src/game/bossChapters.ts");
  const graveTrap = await server.ssrLoadModule("/src/game/graveTrap.ts");
  const predatorAi = await server.ssrLoadModule("/src/game/predatorAi.ts");
  const finale = await server.ssrLoadModule("/src/game/finale.ts");
  const fieldBosses = await server.ssrLoadModule("/src/game/fieldBosses.ts");
  const objectives = await server.ssrLoadModule("/src/objectives.ts");
  const homeBase = await server.ssrLoadModule("/src/game/homeBase.ts");
  const hitFeedback = await server.ssrLoadModule("/src/game/hitFeedback.ts");
  const classSkills = await server.ssrLoadModule("/src/game/classSkills.ts");
  const training = await server.ssrLoadModule("/src/game/training.ts");
  const nickname = await server.ssrLoadModule("/src/game/nickname.ts");
  const party = await server.ssrLoadModule("/src/game/party.ts");
  const partyPresence = await server.ssrLoadModule("/src/game/partyPresence.ts");
  const directoryModule = await server.ssrLoadModule("/src/game/directory.ts");
  const partyFlow = await server.ssrLoadModule("/src/game/partyFlow.ts");
  const partyWorldSync = await server.ssrLoadModule("/src/game/partyWorldSync.ts");
  const tierVisuals = await server.ssrLoadModule("/src/game/tierVisuals.ts");
  const craftLevel = await server.ssrLoadModule("/src/game/craftLevel.ts");
  const saveMigration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const skillBar = await server.ssrLoadModule("/src/ui/skillBar.ts");
  const saveRepo = await server.ssrLoadModule("/src/game/saveRepository.ts");
  const worldMaps = await server.ssrLoadModule("/src/game/worldMaps.ts");
  const THREE = await import("three");

  const { EAGLE_CLAW_COOLDOWN, EAGLE_CLAW_DAMAGE, EAGLE_RAM_DAMAGE, HUNGER_HP_REGEN, HUNGER_MAX, IRON_GUARD_ARMOR, IRON_GUARD_DURATION_SECONDS, MANA_REGEN_PER_SECOND, NIGHT_PREDATOR_MAX_COUNT, RANGED_ATTACK_COOLDOWN, TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST, WIND_CUTTER_COOLDOWN, WIND_CUTTER_DAMAGE } = constants;
  const { HEAL_ITEMS, SHIELD_DEFENSE, SHIELD_DURABILITY, WEAPON_DAMAGE } = items;
  const { CLASS_PASSIVES, DEFAULT_SUMMONER_PET_PROGRESS, summonerPetDamage } = classPassives;
  const { PLAYER_CLASSES } = classes;
  const { calculateCombatDamage, calculateIncomingPlayerDamage } = combat;
  const { useHotbarItem } = hotbarUse;
  const { canReceiveRecipeOutput } = inventoryCapacity;
  const { shouldFireRangedDuringInteract } = interactionPriority;
  const { BOSS_STATS, isPredatorMonster, predatorStatsForMonster, monsterStatsFromLevel } = monsters;
  const { REGIONS } = regions;
  const { BOSS_PROGRESSION, FINAL_BOSS_CHAPTER, applyBossDefeat, bossLockMessage, isBossUnlocked, nextBossTarget, normalizeBossChapter } = bossChapters;
  const { GRAVE_HAND_COUNT, createGraveTrapState, updateGraveTrap } = graveTrap;
  const { animatePredatorAttackMotion, triggerPredatorAttackMotion } = predatorAi;
  const { FINALE_CREDITS_DELAY_MS, MINI_FANFARE_FIREWORKS_MS, createFinaleState, startFinale, startMiniFanfare, updateFinale } = finale;
  const { fieldBossQuestFor, normalizeDefeatedFieldBosses, updateFieldBosses } = fieldBosses;
  const { claimTutorialObjective, currentObjective, latchAchievedObjectives } = objectives;

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
    assert(nextBossTarget(0)?.kind === "dragon" && nextBossTarget(0)?.recommendedLevel === 30, "chapter 0 target should be the first dragon at level 30");
    assert(nextBossTarget(0)?.mapId === "bamboo_frontier", "first chapter boss should live in the bamboo frontier (def 50 needs ~Lv30 gear)");

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
    let panelOpen = false;
    const hand = makeObject("graveHand", 0.4, 0.3);
    hand.root.position.set(0.4, 0, 0.3);
    let hands = [hand];
    let zombie = null;
    const context = {
      state,
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      locationMode: () => mode,
      isPanelOpen: () => panelOpen,
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

    // 패널을 열고 있는 동안에는 좀비가 때리지 못한다
    context.playerPosition.set(zombie.root.position.x, 1.7, zombie.root.position.z + 1);
    panelOpen = true;
    const damageCallsBefore = calls.filter(([kind]) => kind === "damage").length;
    updateGraveTrap(context, 0.016);
    assert(calls.filter(([kind]) => kind === "damage").length === damageCallsBefore, "zombie must not hit the player while a panel is open");
    panelOpen = false;
    updateGraveTrap(context, 0.016);
    assert(calls.filter(([kind]) => kind === "damage").length > damageCallsBefore, "zombie should hit again once the panel closes");
    context.playerPosition.set(0, 1.7, 0);
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

  {
    // 받는 피해 하한 골든: 방어가 아무리 높아도 공격의 15%(올림)는 들어온다 (무적 제거)
    assert(calculateIncomingPlayerDamage(56, 99) === 9, "Lv60 obsidian player should still take 9 from immortal fire");
    assert(calculateIncomingPlayerDamage(46, 200) === 7, "damage floor should hold at any armor");
    assert(calculateIncomingPlayerDamage(74, 149) === 12, "wraith should chip a Lv110 player for 12");
    assert(calculateIncomingPlayerDamage(8, 19) === 3, "early-game damage should match the legacy formula");
    assert(calculateIncomingPlayerDamage(14, 24) === 7, "fire dragon vs iron armor unchanged");
    assert(calculateIncomingPlayerDamage(0, 10) === 0, "zero attack stays zero");
    // 보스 공격 상향 골든
    assert(BOSS_STATS.dragon.fireDamage === 10 && BOSS_STATS.dragon.clawDamage === 11, "dragon attacks should be 10/11");
    assert(BOSS_STATS.immortal.fireDamage === 56 && BOSS_STATS.immortal.clawDamage === 46, "immortal attacks should be 56/46");
    // 변종 몬스터 공격 계수 0.65 (+ 30+ 보정: red_wolf Lv35 → 2+35*0.65+(35-30)*0.2 = 25.75 → 25)
    assert(predatorStatsForMonster("red_wolf").attackDamage === 25, `red wolf attack should scale at 0.65/level + 30+ ramp (got ${predatorStatsForMonster("red_wolf").attackDamage})`);
    // 30+ 보정: 정확히 30에서 0(절벽 없음), 30 미만 무영향, 30 초과만 완만히 증가
    assert(monsterStatsFromLevel(29).attackDamage === Math.floor(2 + 29 * 0.65), "below level 30: no attack bump (unchanged)");
    assert(monsterStatsFromLevel(30).attackDamage === Math.floor(2 + 30 * 0.65), "at exactly level 30: bump is 0 (no cliff)");
    assert(monsterStatsFromLevel(60).attackDamage === Math.floor(2 + 60 * 0.65 + 6), "level 60: +6 attack from the 30+ ramp ((60-30)*0.2)");
    assert(monsterStatsFromLevel(60).attackDamage - Math.floor(2 + 60 * 0.65) <= 7, "the 30+ ramp stays small (<=7 at lvl 60)");
  }

  {
    // 경험치병: 1병 = 15레벨, 소비형, 병이 없으면 아무 일도 없음
    const { state, context } = createHotbarContext();
    useHotbarItem("xp_bottle", context);
    assert(state.levelsGranted === 15, `xp bottle should grant exactly 15 levels (got ${state.levelsGranted})`);
    assert(state.itemCount === 0 && state.removed === 1, "xp bottle should be consumed on use");
    assert(state.hudRenders === 1 && state.tones === 1, "xp bottle should give use feedback");
    useHotbarItem("xp_bottle", context);
    assert(state.levelsGranted === 15, "empty xp bottle stack should not grant more levels");
  }

  {
    // 기획 지정 스탯 오버라이드 골든: 맹견/독사는 레벨 공식 대신 지정 수치를 쓴다
    const hound = predatorStatsForMonster("hound");
    assert(hound.hp === 25 && hound.attackDamage === 6, `hound should keep designed stats (hp ${hound.hp}, atk ${hound.attackDamage})`);
    const viper = predatorStatsForMonster("viper");
    assert(viper.hp === 45 && viper.attackDamage === 8, `viper should keep designed stats (hp ${viper.hp}, atk ${viper.attackDamage})`);
    assert(hound.speed > 0 && hound.cooldown > 0 && viper.strikeRange > 0, "overridden monsters should inherit remaining kind stats");
    // 추격 속도 레벨 스케일: 고레벨일수록 빠르고, 상한 6.2 는 걷기(7)보다 느려 도주 가능
    assert(predatorStatsForMonster("red_wolf").speed > predatorStatsForMonster("wolf").speed * 1.1, "higher-level variants should chase faster");
    assert(predatorStatsForMonster("wraith").speed <= 6.2 && predatorStatsForMonster("ice_spider").speed <= 6.2, "chase speed must cap below player walk speed");
    assert(predatorStatsForMonster("frost_wolf").speed === 6.2, "Lv100 monsters should hit the speed cap");
  }

  {
    // 공격 모션 인지성 골든: 예열은 또렷한 후퇴+떨림+웅크림, 도약은 큰 전진+신장. 끝나면 원상복구.
    for (const kind of ["wolf", "boar", "zombie", "drake", "ghost"]) {
      const fake = { root: new THREE.Group(), predatorKind: kind, name: kind };
      triggerPredatorAttackMotion(fake, 0, 1, 0);
      const duration = Number(fake.root.userData.attackDuration ?? 0);
      assert(duration >= 500, `${kind}: attack motion should run at least 500ms for a readable telegraph (got ${duration})`);

      animatePredatorAttackMotion(fake, duration * 0.25);
      assert(fake.root.position.x < -0.12, `${kind}: windup should visibly pull back (x=${fake.root.position.x.toFixed(2)})`);
      assert(Math.abs(fake.root.rotation.z) > 0.005, `${kind}: windup should tremble`);
      assert(fake.root.scale.y < 1 || kind === "bear", `${kind}: windup should crouch`);

      fake.root.position.set(0, 0, 0);
      animatePredatorAttackMotion(fake, duration * 0.7);
      assert(fake.root.position.x > 0.45, `${kind}: strike should lunge forward (x=${fake.root.position.x.toFixed(2)})`);
      assert(fake.root.scale.x > 1.08, `${kind}: strike should stretch forward`);

      fake.root.position.set(0, 0, 0);
      animatePredatorAttackMotion(fake, duration + 50);
      assert(fake.root.rotation.x === 0 && fake.root.rotation.z === 0, `${kind}: motion should reset cleanly`);
      assert(Math.abs(fake.root.scale.y - 1) < 0.001, `${kind}: scale should restore after the attack`);
    }
  }

  {
    // 엔딩 피날레: 폭죽 파티클 + 팡파레 + 크레딧 1회 표시
    let nowMs = 0;
    let tones = 0;
    let credits = 0;
    const particles = [];
    const sceneStub = { add: () => {} };
    const context = {
      state: createFinaleState(),
      effects: () => ({ scene: sceneStub, camera: null, playerPosition: new THREE.Vector3(), damageParticles: particles, getGroundHeightAt: () => 0 }),
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      cameraForward: () => ({ x: 0, z: -1 }),
      now: () => nowMs,
      playTone: () => {
        tones += 1;
      },
      showCredits: () => {
        credits += 1;
      },
      showMessage: () => {},
    };
    startFinale(context);
    assert(context.state.active, "finale should activate on the final boss kill");
    for (nowMs = 0; nowMs <= FINALE_CREDITS_DELAY_MS + 2_000; nowMs += 100) updateFinale(context);
    assert(particles.length > 120, `finale should launch many firework particles (got ${particles.length})`);
    assert(tones >= 16, `finale should play the victory fanfare (got ${tones} tones)`);
    assert(credits === 1, `ending credits should appear exactly once (got ${credits})`);
  }

  {
    // 퀘스트 래치: 제작대를 설치(조건 달성)했다가 회수해도 "완료" 상태가 유지된다
    const doneIds = ["first_steps", "gather_wood", "find_hammer", "craft_workbench_item"];
    const progress = { completedStepIds: [...doneIds], achievedStepIds: [...doneIds] };
    const makeSnapshot = (hasWorkbench) => ({
      health: 10, hunger: 5, countItem: () => 0, totalSteps: 60, level: 1,
      inCave: false, predatorKills: 0, mapOpened: false, saved: false, shopOpened: false,
      hasWorkbench, hasPickaxe: false, hasBag: false, playerClass: "warrior", classWeaponCount: 0, hasBasicArmor: false,
      hasSmelter: false, bossChapter: 0, defeatedFieldBosses: [],
      completedStepIds: progress.completedStepIds, achievedStepIds: progress.achievedStepIds,
    });
    latchAchievedObjectives(progress, makeSnapshot(true));
    assert(progress.achievedStepIds.includes("place_workbench"), "placing the workbench should latch the step as achieved");
    const afterPickup = currentObjective(makeSnapshot(false));
    assert(afterPickup.id === "place_workbench" && afterPickup.completed === true, "picking the workbench back up must not un-complete the quest");
    assert(claimTutorialObjective(progress, afterPickup) !== null, "latched quest should remain claimable for its reward");
  }

  {
    // 나무 막대기 퀘스트: 돌 곡괭이 '바로 직전' 위치 + 막대기 보유(4) 조건 + 이웃 사이 XP 비감소
    const ids = objectives.TUTORIAL_STEPS.map((s) => s.id);
    const si = ids.indexOf("craft_stick");
    const pi = ids.indexOf("craft_pickaxe");
    assert(si >= 0 && pi >= 0 && si === pi - 1, "craft_stick must sit immediately before craft_pickaxe");
    const stickStep = objectives.TUTORIAL_STEPS[si];
    const snap = (sticks) => ({ countItem: (it) => (it === "stick" ? sticks : 0), achievedStepIds: [], completedStepIds: [] });
    assert(!stickStep.completed(snap(3)) && stickStep.completed(snap(4)), "craft_stick completes at 4 sticks");
    const xp = (id) => objectives.TUTORIAL_STEPS.find((s) => s.id === id).reward.experience;
    assert(xp("craft_shovel") <= xp("craft_stick") && xp("craft_stick") <= xp("craft_pickaxe"), "stick quest XP stays non-decreasing between its neighbors");
    // 보강: 확장 제작대 퀘스트가 졸업(craft_basic_weapon) 바로 직전 + 보유 조건 (거너 소총 등 확장 제작대 필요 대비)
    const ei = ids.indexOf("craft_extended_workbench");
    const gi = ids.indexOf("craft_basic_weapon");
    assert(ei >= 0 && gi >= 0 && ei === gi - 1, "craft_extended_workbench must sit immediately before the graduation quest");
    const extStep = objectives.TUTORIAL_STEPS[ei];
    const extSnap = (n) => ({ countItem: (it) => (it === "extended_workbench" ? n : 0), achievedStepIds: [], completedStepIds: [] });
    assert(!extStep.completed(extSnap(0)) && extStep.completed(extSnap(1)), "extended workbench quest completes when one is owned (requires actually crafting it)");
  }

  {
    // 보스 퀘스트: 튜토리얼 이후 필드보스 + 챕터 드래곤을 권장 레벨 오름차순으로 한 줄에 엮어 다음 미처치 보스를 제시
    const allIds = objectives.TUTORIAL_STEPS.map((s) => s.id);
    const base = (extra) => ({
      health: 10, hunger: 5, countItem: () => 999, totalSteps: 9999, level: 200,
      inCave: false, predatorKills: 99, mapOpened: true, saved: true, shopOpened: true,
      hasWorkbench: true, hasPickaxe: true, hasBag: true, playerClass: "warrior", classWeaponCount: 9, hasBasicArmor: true,
      hasSmelter: true, trainingTotal: 99, trainingKindsDone: 4, bossChapter: 0, defeatedFieldBosses: [],
      completedStepIds: [...allIds], achievedStepIds: [...allIds], ...extra,
    });
    const first = objectives.currentObjective(base({}));
    assert(first.id === "boss_starter_valley" && first.title.includes("권장 Lv 26") && first.completed === false, "lowest-level boss (Lv26 starter field boss) is the first post-tutorial objective, undefeated");
    const defeated = objectives.currentObjective(base({ defeatedFieldBosses: ["boss_starter_valley"] }));
    assert(defeated.id === "boss_starter_valley" && defeated.completed === true && defeated.kind === "tutorial", "defeated-but-unclaimed field boss is claimable for its reward");
    const afterStarter = objectives.currentObjective(base({ defeatedFieldBosses: ["boss_starter_valley"], completedStepIds: [...allIds, "boss_starter_valley"] }));
    assert(afterStarter.id === "boss_progression" && afterStarter.title.includes("챕터 1") && afterStarter.title.includes("권장 Lv 30"), "after the Lv26 field boss, the Lv30 chapter-1 dragon is next (interleaved by level)");
    const afterCh1 = objectives.currentObjective(base({ defeatedFieldBosses: ["boss_starter_valley"], completedStepIds: [...allIds, "boss_starter_valley"], bossChapter: 1 }));
    assert(afterCh1.id === "boss_dragon_plains" && afterCh1.title.includes("권장 Lv 33"), "after chapter 1 dragon, the Lv33 field boss is next — field & chapter bosses interspersed by recommended level");
  }

  {
    // 필드 보스: ensure 스폰은 1회만, 처치 기록이 있으면 스폰 안 함, 보스 공식 스탯 적용
    let spawned = null;
    const defeated = [];
    const context = {
      locationMode: () => "overworld",
      worldMapId: () => "starter_valley",
      defeatedFieldBosses: () => defeated,
      liveFieldBoss: () => spawned,
      spawnPredator: () => {
        spawned = { type: "wildPredator", name: "", root: new THREE.Group() };
        return spawned;
      },
      getGroundHeightAt: () => 0,
    };
    updateFieldBosses(context);
    assert(spawned !== null && spawned.fieldBossId === "boss_starter_valley", "starter valley should spawn its field boss");
    assert(spawned.hp === 304 && spawned.armor === 26 && spawned.attackDamage === 18, `field boss should use boss-formula stats for Lv 26 (mapMax 18 + 8) (hp ${spawned.hp}, armor ${spawned.armor}, atk ${spawned.attackDamage})`);
    const firstBoss = spawned;
    updateFieldBosses(context);
    assert(spawned === firstBoss, "live field boss should not be duplicated");
    spawned = null;
    defeated.push("boss_starter_valley");
    updateFieldBosses(context);
    assert(spawned === null, "defeated field boss should never respawn");

    // 퀘스트 뷰: 처치 전→후 전환 + 최종맵 제외
    const quest = fieldBossQuestFor("starter_valley", []);
    assert(quest && quest.bossName === "멧돼지 대왕" && !quest.defeated, "starter valley quest should target its boss");
    assert(fieldBossQuestFor("starter_valley", ["boss_starter_valley"])?.defeated === true, "quest should flip to defeated for the reward claim");
    assert(fieldBossQuestFor("dragon_lands", []) === null, "final map must not have a field boss quest");
    assert(normalizeDefeatedFieldBosses(["boss_starter_valley", "nope", "boss_starter_valley"]).length === 1, "defeated list should dedupe and drop unknown ids");
  }

  {
    // 미니 팡파레: 짧은 폭죽 + 크레딧 없음 + 자동 종료
    let nowMs = 0;
    let credits = 0;
    const particles = [];
    const context = {
      state: createFinaleState(),
      effects: () => ({ scene: { add: () => {} }, camera: null, playerPosition: new THREE.Vector3(), damageParticles: particles, getGroundHeightAt: () => 0 }),
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      cameraForward: () => ({ x: 0, z: -1 }),
      now: () => nowMs,
      playTone: () => {},
      showCredits: () => {
        credits += 1;
      },
      showMessage: () => {},
    };
    startMiniFanfare(context);
    for (nowMs = 0; nowMs <= MINI_FANFARE_FIREWORKS_MS + 3_000; nowMs += 100) updateFinale(context);
    assert(particles.length > 30, "mini fanfare should still pop fireworks");
    assert(credits === 0, "mini fanfare must not roll the ending credits");
    assert(!context.state.active, "mini fanfare should end on its own");
  }

  {
    // 파티 접속 계층 골든: 초대 코드 형식/정규화 + 프로토콜 인코딩 왕복
    const { generatePartyCode, normalizePartyCode, peerIdForCode, encodePartyMessage, decodePartyMessage, PARTY_CODE_LENGTH, PARTY_MAX_MEMBERS } = party;
    for (let i = 0; i < 30; i += 1) {
      const code = generatePartyCode();
      assert(code.length === PARTY_CODE_LENGTH && !/[0O1I]/.test(code), `invite code must avoid confusable chars (got ${code})`);
      assert(normalizePartyCode(code.toLowerCase()) === code, "lowercase input should normalize to the same code");
    }
    assert(normalizePartyCode(" k7 p2-qx ") === "K7P2QX", "spaces/dashes should be stripped on input");
    assert(normalizePartyCode("ABC") === null && normalizePartyCode("ABC10X") === null, "wrong length or confusable chars are rejected");
    assert(peerIdForCode("K7P2QX") === "yunu-game-K7P2QX", "peer id derives from the code");
    assert(PARTY_MAX_MEMBERS === 4, "party caps at 4 including the host");
    const message = { type: "hello", nickname: "연우용사", protocol: 1 };
    assert(JSON.stringify(decodePartyMessage(encodePartyMessage(message))) === JSON.stringify(message), "party messages roundtrip");
    assert(decodePartyMessage("{broken") === null && decodePartyMessage(42) === null, "malformed messages decode to null");

    // C4 — 호스트 이탈 시 후계 선출: 호스트 제외, 닉네임 사전순 최소(모든 게스트가 동일 계산)
    const { electSuccessor } = party;
    const roster = [{ nickname: "아빠", isHost: true }, { nickname: "연우", isHost: false }, { nickname: "민준", isHost: false }];
    assert(electSuccessor(roster) === "민준", "successor is the lowest-nickname survivor, host excluded");
    assert(electSuccessor([{ nickname: "아빠", isHost: true }, { nickname: "연우", isHost: false }]) === "연우", "sole surviving guest becomes the successor (can re-invite)");
    assert(electSuccessor([{ nickname: "아빠", isHost: true }]) === null, "no survivors -> no successor");
    assert(electSuccessor([]) === null, "empty roster -> no successor");
    const a = electSuccessor([{ nickname: "호스트", isHost: true }, { nickname: "Bob", isHost: false }, { nickname: "Amy", isHost: false }, { nickname: "Cara", isHost: false }]);
    assert(a === "Amy", "election is deterministic across all guests (same roster -> same winner)");
  }

  {
    // 무기·방어구 티어 비주얼 SSOT: 진행 단조 + 다이아<흑요석(최상) + 저티어 무광·고티어 발광/보석
    const { TIER_VISUALS, tierOf, tierVisual, armorTierOf } = tierVisuals;
    const order = ["wood", "stone", "copper", "iron", "gold", "diamond", "obsidian"];
    for (let i = 0; i < order.length; i += 1) assert(TIER_VISUALS[order[i]].rank === i, `tier ${order[i]} has rank ${i}`);
    assert(TIER_VISUALS.diamond.rank < TIER_VISUALS.obsidian.rank, "obsidian outranks diamond (top tier)");
    assert(TIER_VISUALS.obsidian.glow > TIER_VISUALS.diamond.glow && TIER_VISUALS.diamond.glow > TIER_VISUALS.iron.glow, "glow escalates with tier");
    assert(TIER_VISUALS.wood.gem === null && TIER_VISUALS.stone.gem === null, "low tiers have no gem (plain look)");
    assert(TIER_VISUALS.copper.gem !== null && TIER_VISUALS.diamond.gem !== null && TIER_VISUALS.obsidian.gem !== null, "mid+ tiers carry an accent gem");
    assert(TIER_VISUALS.wood.fancy === false && TIER_VISUALS.gold.fancy === true && TIER_VISUALS.obsidian.fancy === true, "gold+ get extra flourish geometry");
    assert(tierOf("diamond_sword") === "diamond" && tierOf("obsidian_dagger") === "obsidian" && tierOf("iron_pickaxe") === "iron", "tierOf extracts the material from item ids");
    assert(tierOf("hammer") === null && tierVisual("hammer").rank === 0, "untiered items fall back to wood-rank visual");
    assert(armorTierOf("leather_armor") === "wood" && armorTierOf("diamond_armor") === "diamond" && armorTierOf("obsidian_armor") === "obsidian", "armorTierOf maps armor ids (leather→wood-rank)");
    assert(armorTierOf(null) === null && armorTierOf(undefined) === null, "no armor → no tier (no overlay)");
  }

  {
    // 사망 드롭: 착용 중인 무기/방어구/방패·보호 아이템은 유지, 그 외는 떨굼
    const { shouldDropSlotOnDeath } = deathDrop;
    const ctx = {
      protectedItems: new Set(["tutorial_book", "medkit", "iron_sword"]),
      equippedArmor: "diamond_armor",
      equippedShield: "iron_shield",
      isWeapon: (item) => item === "obsidian_sword" || item === "iron_sword" || item === "diamond_dagger",
    };
    assert(shouldDropSlotOnDeath("obsidian_sword", true, ctx) === false, "held weapon (selected slot) is kept on death");
    assert(shouldDropSlotOnDeath("obsidian_sword", false, ctx) === true, "the same weapon in a NON-held slot still drops");
    assert(shouldDropSlotOnDeath("dirt", true, ctx) === true, "a non-weapon held in hand still drops (only weapons are kept)");
    assert(shouldDropSlotOnDeath("diamond_armor", false, ctx) === false, "equipped armor is kept on death");
    assert(shouldDropSlotOnDeath("iron_shield", false, ctx) === false, "equipped shield is kept on death");
    assert(shouldDropSlotOnDeath("tutorial_book", false, ctx) === false && shouldDropSlotOnDeath("medkit", false, ctx) === false && shouldDropSlotOnDeath("iron_sword", false, ctx) === false, "protected items (book/medkit/starter) are kept");
    assert(shouldDropSlotOnDeath("gold", false, ctx) === true && shouldDropSlotOnDeath("diamond_pickaxe", false, ctx) === true, "loose materials and non-equipped tools drop");
  }

  {
    // 파티 채팅: 메시지 직렬화 + 귓속말 파싱 (/w, @, 모르는 대상/자기자신/빈문자 거부)
    const { encodePartyMessage, decodePartyMessage } = party;
    const { parseChatInput } = partyChat;
    const broadcast = { type: "chat", from: "연우용사", text: "안녕!" };
    const whisper = { type: "chat", from: "연우용사", text: "비밀", to: "아빠용사" };
    assert(JSON.stringify(decodePartyMessage(encodePartyMessage(broadcast))) === JSON.stringify(broadcast), "broadcast chat roundtrips");
    assert(JSON.stringify(decodePartyMessage(encodePartyMessage(whisper))) === JSON.stringify(whisper), "whisper chat roundtrips (to preserved)");
    const members = ["연우용사", "아빠용사", "민준용사"];
    const me = "연우용사";
    assert(JSON.stringify(parseChatInput("그냥 전체 메시지", members, me)) === JSON.stringify({ text: "그냥 전체 메시지" }), "plain text → broadcast (no to)");
    assert(JSON.stringify(parseChatInput("/w 아빠용사 비밀이야", members, me)) === JSON.stringify({ text: "비밀이야", to: "아빠용사" }), "/w name msg → whisper");
    assert(JSON.stringify(parseChatInput("@민준용사 안녕", members, me)) === JSON.stringify({ text: "안녕", to: "민준용사" }), "@name msg → whisper");
    assert("error" in parseChatInput("/w 없는사람 hi", members, me), "whisper to unknown member is rejected");
    assert("error" in parseChatInput("@연우용사 나에게", members, me), "whisper to self is rejected");
    assert("error" in parseChatInput("   ", members, me), "empty/whitespace is rejected (no-op)");
    assert(parseChatInput("a".repeat(300), members, me).text.length === 120, "message is clamped to 120 chars");
  }

  {
    // 퀘스트 보상 수령(Q/클릭 공용): 완료된 튜토리얼만 1회 지급, 재요청 시 멱등, 비튜토리얼은 거부
    const { claimObjective } = objectiveClaim;
    const progress = { completedStepIds: [], achievedStepIds: [] };
    const objective = { id: "first_steps", kind: "tutorial", completed: true, title: "첫 발걸음", detail: "d", progress: "완료", reward: { experience: 12, items: { wood: 3 }, label: "나무 3" } };
    let xp = 0; const added = []; let drops = 0; let huds = 0;
    const deps = { gainExperience: (n) => { xp += n; }, addItem: (i, c) => { added.push([i, c]); return true; }, dropItem: () => { drops += 1; }, showMessage: () => {}, renderHud: () => { huds += 1; } };
    assert(claimObjective(progress, objective, deps) === true && xp === 12 && added.length === 1 && added[0][0] === "wood" && progress.completedStepIds.includes("first_steps"), "completed tutorial objective grants reward once");
    assert(claimObjective(progress, objective, deps) === false && xp === 12, "claiming again is idempotent (no double reward)");
    assert(claimObjective(progress, { ...objective, id: "boss_progression", kind: "boss" }, deps) === false, "non-tutorial objective cannot be claimed");
    assert(drops === 0 && huds === 1, "reward goes to inventory (no drop) and HUD refreshes once");
  }

  {
    // 소셜 디렉터리 골든: like 검색 + 친구 요청/수락 + 오프라인 거부 + 파티 초대 전달 (BroadcastDirectory)
    const { BroadcastDirectory, filterUsers } = directoryModule;
    const sorted = filterUsers(
      [
        { nickname: "다람쥐", online: false },
        { nickname: "연우용사", online: true },
        { nickname: "연우친구", online: false },
      ],
      "연우",
    );
    assert(sorted.length === 2 && sorted[0].nickname === "연우용사", "like search should match substrings and rank online first");
    assert(filterUsers([{ nickname: "Yunu", online: true }], "yun").length === 1, "search is case-insensitive");

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const makeStorage = () => {
      const store = new Map();
      return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    };
    const sharedStorage = makeStorage();
    const eventsFor = (log) => ({
      onFriendRequest: (from) => log.push(["friend_request", from]),
      onFriendAccepted: (by) => log.push(["friend_accepted", by]),
      onPartyInvite: (from, code) => log.push(["party_invite", from, code]),
      onUsersChanged: () => {},
      onFriendsChanged: () => log.push(["friends_changed"]),
    });
    const logA = [];
    const logB = [];
    const dirA = new BroadcastDirectory(sharedStorage);
    const dirB = new BroadcastDirectory(sharedStorage);
    await dirA.connect("아빠용사", eventsFor(logA));
    await dirB.connect("연우용사", eventsFor(logB));
    await sleep(120);

    const usersSeenByA = await dirA.listUsers();
    assert(usersSeenByA.some((user) => user.nickname === "연우용사" && user.online), "directory should list the other online user");
    assert(!usersSeenByA.some((user) => user.nickname === "아빠용사"), "directory should not list yourself");

    assert((await dirA.sendFriendRequest("아빠용사")) === "self", "self friend request rejected");
    assert((await dirA.sendFriendRequest("유령유저")) === "offline", "offline target rejected with a clear result");

    assert((await dirA.sendFriendRequest("연우용사")) === "sent", "online friend request goes through");
    await sleep(80);
    assert(logB.some(([kind, from]) => kind === "friend_request" && from === "아빠용사"), "target should receive the friend request event");
    await dirB.respondFriendRequest("아빠용사", true);
    await sleep(80);
    assert(logA.some(([kind, by]) => kind === "friend_accepted" && by === "연우용사"), "requester should hear the acceptance");
    assert((await dirA.listFriends()).includes("연우용사") && (await dirB.listFriends()).includes("아빠용사"), "friendship persists for both sides");
    assert((await dirA.sendFriendRequest("연우용사")) === "already", "duplicate friendship rejected");

    assert((await dirA.sendPartyInvite("연우용사", "K7P2QX")) === "sent", "party invite to online friend goes through");
    await sleep(80);
    assert(logB.some(([kind, from, code]) => kind === "party_invite" && from === "아빠용사" && code === "K7P2QX"), "invitee should receive the party invite with the room code");

    dirB.disconnect();
    await sleep(80);
    assert(!(await dirA.isOnline("연우용사")), "disconnect should mark the user offline");
    assert((await dirA.sendPartyInvite("연우용사", "K7P2QX")) === "offline", "party invite to offline friend is blocked");
    dirA.disconnect();
  }

  {
    // 파티 프레즌스 골든: 송신 주기, 같은 맵 아바타 스폰/보간, 다른 맵 분리, 지도 마커, stale 제거
    const { initPartyPresence, updatePartyPresence, resetPartyPresence, partyMapMarkers, remotePartyCount, PRESENCE_SEND_INTERVAL_MS } = partyPresence;
    const sceneAdds = [];
    const sceneRemoves = [];
    const fakeScene = { add: (object) => sceneAdds.push(object), remove: (object) => sceneRemoves.push(object) };
    let presencesCb = null;
    const sent = [];
    const fakeSession = { onPresences: (cb) => { presencesCb = cb; }, onGame: () => {}, sendPresence: (data) => sent.push(data) };
    initPartyPresence({
      scene: fakeScene,
      session: () => fakeSession,
      getGroundHeightAt: () => 2,
      localPresence: () => ({ nickname: "나", mapId: "starter_valley", x: 0, z: 0, yaw: 0, playerClass: "warrior", inGame: true }),
    });
    updatePartyPresence(1_000, 0.016);
    assert(sent.length === 1, "presence should send on first tick");
    updatePartyPresence(1_000 + PRESENCE_SEND_INTERVAL_MS - 20, 0.016);
    assert(sent.length === 1, "presence should respect the send interval");
    updatePartyPresence(1_000 + PRESENCE_SEND_INTERVAL_MS + 5, 0.016);
    assert(sent.length === 2, "presence should send again after the interval");

    presencesCb([{ nickname: "친구", mapId: "starter_valley", x: 10, z: 4, yaw: 1.2, playerClass: "mage", inGame: true }]);
    assert(remotePartyCount() === 1 && sceneAdds.length === 1, "same-map member should spawn an avatar");
    const avatar = sceneAdds[0];
    assert(avatar.position.y === 2, "avatar should stand on local ground height");
    assert(Math.abs(avatar.rotation.y - (1.2 + Math.PI)) < 1e-6, "avatar faces sent yaw + Math.PI (model +Z front vs -Z forward) — no reversed/180 neck");
    // 스폰은 제자리, 이후 이동분이 보간된다
    presencesCb([{ nickname: "친구", mapId: "starter_valley", x: 20, z: 4, yaw: 1.2, playerClass: "mage", inGame: true }]);
    updatePartyPresence(1_400, 0.05);
    assert(avatar.position.x > 10.5 && avatar.position.x < 19.5, "avatar should lerp toward the new target (got " + avatar.position.x.toFixed(2) + ")");
    assert(partyMapMarkers("starter_valley").length === 1 && partyMapMarkers("graveyard").length === 0, "map markers filter by map");

    presencesCb([{ nickname: "친구", mapId: "graveyard", x: -50, z: 30, yaw: 0, playerClass: "mage", inGame: true }]);
    assert(sceneRemoves.length === 1, "moving to another map should remove the avatar from the scene");
    assert(partyMapMarkers("graveyard").length === 1 && partyMapMarkers("starter_valley").length === 0, "marker follows the member's map");

    updatePartyPresence(20_000, 0.016);
    assert(remotePartyCount() === 0, "stale members should be pruned");
    resetPartyPresence();
  }

  {
    // 파티 합류 흐름 골든: 실내 호스트 대기 안내(1회) → 야외 복귀 시 소환 + reset 으로 잔존 소환 제거
    const { initPartyFlow, beginGuestJoinFlow, partyFlowOnPresences, hostOnGuestJoined, resetPartyFlow } = partyFlow;
    const calls = [];
    let inGame = false;
    initPartyFlow({
      isInGame: () => inGame,
      startNewGame: () => {
        inGame = true;
        calls.push(["start"]);
      },
      summonTo: (mapId, x, z) => calls.push(["summon", mapId, x, z]),
      showMessage: (text) => calls.push(["msg", text]),
    });
    const hostIndoors = { nickname: "아빠용사", mapId: "starter_valley", x: 5, z: 5, yaw: 0, playerClass: "warrior", inGame: false };
    beginGuestJoinFlow("아빠용사");
    partyFlowOnPresences([hostIndoors]);
    assert(calls.some(([kind]) => kind === "start"), "indoors host: title guest should start their own game instead of waiting in silence");
    assert(calls.filter(([kind, text]) => kind === "msg" && String(text).includes("동굴")).length === 1, "indoors wait notice should show");
    partyFlowOnPresences([hostIndoors]);
    assert(calls.filter(([kind, text]) => kind === "msg" && String(text).includes("동굴")).length === 1, "wait notice must show only once");
    assert(!calls.some(([kind]) => kind === "summon"), "no summon while the host is indoors");
    partyFlowOnPresences([{ ...hostIndoors, inGame: true, x: 63, z: -37 }]);
    assert(calls.some(([kind, mapId, x, z]) => kind === "summon" && mapId === "starter_valley" && x === 63 && z === -37), "summon fires once the host is outdoors");
    calls.length = 0;
    beginGuestJoinFlow("아빠용사");
    resetPartyFlow();
    partyFlowOnPresences([{ ...hostIndoors, inGame: true }]);
    assert(calls.length === 0, "after reset (party left) no stale summon may fire");
    inGame = false;
    hostOnGuestJoined("연우용사");
    assert(calls.some(([kind]) => kind === "start"), "host on title starts the game when a guest joins");
    calls.length = 0;
    hostOnGuestJoined("연우용사");
    assert(!calls.some(([kind]) => kind === "start"), "host already in game must not restart");
    resetPartyFlow();
  }

  {
    // 게스트 가드 골든: 소환 흐름은 게스트 세션 프레즌스에서만 — 호스트가 게스트 좌표로 끌려가지 않는다
    const { initPartyPresence, updatePartyPresence, resetPartyPresence } = partyPresence;
    const { initPartyFlow, beginGuestJoinFlow, resetPartyFlow } = partyFlow;
    const calls = [];
    initPartyFlow({ isInGame: () => true, startNewGame: () => calls.push("start"), summonTo: () => calls.push("summon"), showMessage: () => {} });
    const fakeScene = { add: () => {}, remove: () => {} };
    let cb = null;
    const makeSession = (role) => ({ role, onPresences: (listener) => { cb = listener; }, sendPresence: () => {} });
    const local = () => ({ nickname: "나", mapId: "graveyard", x: 0, z: 0, yaw: 0, playerClass: "warrior", inGame: true });
    const fromHost = [{ nickname: "아빠용사", mapId: "starter_valley", x: 1, z: 1, yaw: 0, playerClass: "warrior", inGame: true }];
    const hostSession = makeSession("host");
    initPartyPresence({ scene: fakeScene, session: () => hostSession, getGroundHeightAt: () => 0, localPresence: local });
    updatePartyPresence(50_000, 0.016);
    beginGuestJoinFlow("아빠용사");
    cb(fromHost);
    assert(!calls.includes("summon"), "host-role session must not trigger the guest summon flow");
    const guestSession = makeSession("guest");
    initPartyPresence({ scene: fakeScene, session: () => guestSession, getGroundHeightAt: () => 0, localPresence: local });
    updatePartyPresence(51_000, 0.016);
    cb(fromHost);
    assert(calls.includes("summon"), "guest-role session does trigger the summon flow");
    resetPartyFlow();
    resetPartyPresence();
  }

  {
    // 파티 5차 월드 동기화 골든 — 호스트 스냅샷 수집 / 게스트 diff 적용·보간 / 공격 인터셉트 / 호스트 판정·처치 공유 / mobHit / 복원·게이트
    const { initPartyWorldSync, partyWorldSyncTick, partyWorldSyncOnPresences, partyGuestAttackIntercept, partyHostNotifyKill, partyWorldGuestActive, resetPartyWorldSync, MOB_SYNC_INTERVAL_MS, MOB_SYNC_STALE_MS } = partyWorldSync;
    const { decodePartyMessage, encodePartyMessage, PARTY_PROTOCOL_VERSION } = party;
    const { calculateCombatDamage } = combat;
    assert(PARTY_PROTOCOL_VERSION === 2, "world sharing bumps the protocol to v2");
    const mobsMessage = { type: "mobs", mapId: "starter_valley", list: [{ id: "h1", name: "늑대", kind: "wolf", x: 10, z: 4, yaw: 0.5, hp: 30 }] };
    assert(JSON.stringify(decodePartyMessage(encodePartyMessage(mobsMessage))) === JSON.stringify(mobsMessage), "mobs message roundtrips");

    const makeHarness = (role, nickname) => {
      const sent = [];
      let gameCb = null;
      const session = { role, sendGame: (message) => sent.push(message), onGame: (cb) => { gameCb = cb; }, onPresences: () => {} };
      const objects = new Map();
      let nextId = 1;
      const me = { nickname, mapId: "starter_valley", x: 0, z: 0, yaw: 0, playerClass: "warrior", inGame: true, panelOpen: false };
      const events = [];
      const entityContext = {
        addWorldObject: (type, name, root, extra) => { const object = { id: `${role}-${nextId++}`, type, name, root, ...extra }; objects.set(object.id, object); return object; },
        getGroundHeightAt: () => 0,
        createWalkCycle: () => ({ phase: 0, parts: [], amplitude: 0, speed: 0, lift: 0 }),
        predatorStats: () => ({ hp: 30, attackDamage: 3 }),
        predatorAggroRange: () => 10,
        bossStats: () => ({ name: "용", maxHp: 100, armor: 0, fireDamage: 5, attackRange: 10, collisionRadius: 1, collisionHeight: 2, scale: 1, body: 0, belly: 0, wing: 0, glow: 0 }),
      };
      const state = { nextPlayerHitKills: false };
      const world = {
        entityContext,
        activeRegions: () => [{ id: "r1", name: "r1", lootTier: 1, levelRange: [1, 10], center: { x: 0, y: 0, z: 0 }, radius: 500 }],
        mapXpScale: () => 1,
        predators: () => [...objects.values()].filter((object) => object.type === "wildPredator"),
        guards: () => [...objects.values()].filter((object) => ["villageKnight", "villageArcher", "villageMage", "villageGolem"].includes(object.type)),
        spawnGuard: (type, x, z, villageId) => { const object = { id: `${role}-${nextId++}`, type, name: "경비", villageId, armor: 15, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(object.id, object); return object; },
        enrageVillage: (villageId, message) => events.push(["enrage", villageId, message]),
        getObject: (id) => objects.get(id),
        removeObject: (id) => { objects.delete(id); events.push(["remove", id]); },
        removeObjectSilent: (id) => { objects.delete(id); events.push(["removeSilent", id]); },
        hitFeedback: (target, damage, killed) => events.push(["hit", target.id, damage, killed]),
        showMessage: (text) => events.push(["msg", text]),
        gainExperience: (amount) => events.push(["xp", amount]),
        creditHostKill: (target) => events.push(["credit", target.id]),
        rollLoot: (item, count, source) => { events.push(["loot", item, count, source]); return count; },
        recordFieldBossDefeat: (id) => events.push(["bossDefeat", id]),
        damageLocalPlayer: (amount, name) => { events.push(["playerHit", amount, name]); return state.nextPlayerHitKills; },
        animateWalkCycle: () => {},
        refreshSpatialObject: () => {},
        chests: () => [...objects.values()].filter((object) => object.type === "chest" || object.type === "mineChest"),
        caves: () => [...objects.values()].filter((object) => object.type === "cave"),
        spawnChest: (x, z, mineRich, opened) => { const object = { id: `${role}-${nextId++}`, type: mineRich ? "mineChest" : "chest", name: "상자", opened, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(object.id, object); return object; },
        spawnCave: (x, z) => { const object = { id: `${role}-${nextId++}`, type: "cave", name: "동굴", root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(object.id, object); return object; },
        markChestOpened: (id) => { const chest = objects.get(id); if (!chest || chest.opened || (chest.type !== "chest" && chest.type !== "mineChest")) return null; chest.opened = true; events.push(["chestOpened", id]); return chest.chestTier ?? 0; },
        grantChestLoot: (items) => events.push(["chestLoot", items]),
      };
      return { session, objects, me, events, world, sent, state, getGameCb: () => gameCb };
    };

    // ── 호스트: 스냅샷 수집 + 좌표 양자화 ──
    const host = makeHarness("host", "아빠용사");
    initPartyWorldSync({ session: () => host.session, localPresence: () => host.me, getGroundHeightAt: () => 0, world: host.world });
    const boar = host.world.entityContext.addWorldObject("wildPredator", "멧돼지", { position: { x: 10.123, y: 0, z: -4.567 }, rotation: { y: 1.234 } }, { hp: 30, predatorKind: "boar", monsterId: "boar", regionId: "r1" });
    partyWorldSyncTick(1_000, 0.016);
    assert(host.sent.some((message) => message.type === "mobs"), "host broadcasts a mobs snapshot");
    const snapshot = host.sent.find((message) => message.type === "mobs");
    assert(snapshot.list.length === 1 && snapshot.list[0].x === 10.1 && snapshot.list[0].z === -4.6, "snapshot quantizes coordinates to 0.1");
    partyWorldSyncTick(1_000 + MOB_SYNC_INTERVAL_MS - 30, 0.016);
    assert(host.sent.filter((message) => message.type === "mobs").length === 1, "snapshot respects the 8Hz interval");

    // ── 호스트: 게스트 공격 판정 → 처치 시 크레딧+제거+partyKill ──
    host.getGameCb()({ type: "attackRequest", targetId: boar.id, power: 12, kind: "ranged" }, "연우용사");
    assert(boar.hp === 18 && host.events.some(([kind]) => kind === "hit"), "host applies guest damage authoritatively");
    host.getGameCb()({ type: "attackRequest", targetId: boar.id, power: 999, kind: "ranged" }, "연우용사");
    assert(host.events.some(([kind, id]) => kind === "credit" && id === boar.id), "host gets kill credit (pet/player XP + boss record)");
    assert(host.events.some(([kind, id]) => kind === "remove" && id === boar.id), "killed mob enters the host respawn queue path");
    const killBroadcast = host.sent.find((message) => message.type === "partyKill");
    assert(killBroadcast && killBroadcast.killer === "연우용사" && killBroadcast.xp > 0 && killBroadcast.kind === "boar", "host broadcasts partyKill with killer/xp/kind");
    host.getGameCb()({ type: "attackRequest", targetId: boar.id, power: 10, kind: "ranged" }, "연우용사");
    assert(host.sent.filter((message) => message.type === "partyKill").length === 1, "attack on an already-dead mob is ignored");

    // ── 호스트: 처치 알림(combat 훅) + 게스트 타게팅 좌표(panelOpen 포함) ──
    partyWorldSyncOnPresences([{ nickname: "연우용사", mapId: "starter_valley", x: 5, z: 5, yaw: 0, playerClass: "mage", inGame: true, panelOpen: true }, { nickname: "다른맵", mapId: "graveyard", x: 1, z: 1, yaw: 0, playerClass: "mage", inGame: true }]);
    const targets = partyWorldSync.partyHostCombatTargets();
    assert(targets.length === 1 && targets[0].nickname === "연우용사", "combat targets include same-map in-game guests only");
    assert(targets[0].panelOpen === true, "panelOpen flag flows to combat targets (remote panel protection)");
    partyHostNotifyKill({ id: "x", type: "wildPredator", name: "들소", hp: 0, predatorKind: "wolf", monsterLevel: 3, root: { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } } });
    const hostKill = host.sent.filter((message) => message.type === "partyKill").pop();
    assert(hostKill.killer === "아빠용사" && hostKill.xp > 0, "host kill is shared to the party via partyKillNotify");
    partyHostNotifyKill({ id: "d", type: "dragon", name: "용", hp: 0, root: { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } } });
    assert(host.sent.filter((message) => message.type === "partyKill").length === 2, "non-synced kills (dragon/jammini) are NOT broadcast — XP share scope == sync scope");
    partyWorldSync.partyDamageRemotePlayer("연우용사", 4, "늑대");
    const sentMobHit = host.sent.find((message) => message.type === "mobHit");
    assert(sentMobHit && sentMobHit.nickname === "연우용사" && sentMobHit.amount === 4 && sentMobHit.mapId === "starter_valley", "predator strike on a guest sends mobHit with mapId");
    assert(partyWorldGuestActive() === false, "host role is not guest mode");

    // ── 게스트: 스냅샷 diff (로컬 정리→스폰→이동→제거) + 보간 + 스냅샷 기반 게이트 ──
    const guest = makeHarness("guest", "연우용사");
    initPartyWorldSync({ session: () => guest.session, localPresence: () => guest.me, getGroundHeightAt: () => 2, world: guest.world });
    const localWolf = guest.world.entityContext.addWorldObject("wildPredator", "내늑대", { position: { x: 1, y: 0, z: 1 }, rotation: { y: 0 } }, { hp: 10, predatorKind: "wolf" });
    partyWorldSyncTick(2_000, 0.016);
    assert(partyWorldGuestActive() === false, "guest mode stays OFF until a matching snapshot arrives (host may be on title/another map)");
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-1", name: "골든늑대", kind: "wolf", monsterId: "wolf", regionId: "r1", x: 20, z: 8, yaw: 1, hp: 44 }] });
    assert(partyWorldGuestActive() === true, "guest mode turns ON with a fresh same-map snapshot");
    assert(!guest.objects.has(localWolf.id), "first snapshot clears local predators (descriptors stashed for restore)");
    const syncedEntry = [...guest.objects.values()].find((object) => object.type === "wildPredator");
    assert(syncedEntry && syncedEntry.hp === 44 && syncedEntry.name === "골든늑대", "synced mob spawns as a real targetable world object with authoritative stats");
    assert(syncedEntry.partyTransient === true, "synced mob is marked transient so saves/worldState never persist it");
    assert(syncedEntry.root.position.x === 20 && syncedEntry.root.position.y === 2, "synced mob spawns at snapshot x/z and local ground height");
    // #1 불릿프루프: 첫 정리 이후 끼어든 비동기화 로컬 몬스터(seedOverworld 잔여 등)도 다음 스냅샷에 제거되어야 한다
    const strayWolf = guest.world.entityContext.addWorldObject("wildPredator", "끼어든늑대", { position: { x: 5, y: 0, z: 5 }, rotation: { y: 0 } }, { hp: 10, predatorKind: "wolf" });
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-1", name: "골든늑대", kind: "wolf", monsterId: "wolf", regionId: "r1", x: 20, z: 8, yaw: 1, hp: 44 }] });
    assert(!guest.objects.has(strayWolf.id), "stray local monster after first clear is swept on the next snapshot (no separate-monster divergence)");
    assert([...guest.objects.values()].filter((object) => object.type === "wildPredator").length === 1, "only the synced mob remains — guest and host see the same set");
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-1", name: "골든늑대", kind: "wolf", monsterId: "wolf", regionId: "r1", x: 30, z: 8, yaw: 1, hp: 40, atk: 60, afx: 1, afz: 0 }] });
    assert(syncedEntry.hp === 40, "snapshot hp overwrites the local value when no hit is pending");
    assert(Number(syncedEntry.root.userData.attackDuration ?? 0) > 0, "attack motion from the snapshot replays on the guest (telegraph)");
    partyWorldSyncTick(2_200, 0.05);
    assert(syncedEntry.root.position.x > 20.5 && syncedEntry.root.position.x < 29.5, "guest lerps the synced mob toward the new target");

    // ── 게스트: 공격 인터셉트 (낙관적 표시 + attackRequest + pending hp 역행 보호) ──
    const intercepted = partyGuestAttackIntercept(syncedEntry, 10, "melee");
    assert(intercepted === true && syncedEntry.hp === 30, "guest attack is intercepted with an optimistic hp decrease");
    assert(guest.sent.some((message) => message.type === "attackRequest" && message.targetId === "H-1" && message.power === 10), "intercept sends attackRequest with the host mob id");
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-1", name: "골든늑대", kind: "wolf", monsterId: "wolf", regionId: "r1", x: 30, z: 8, yaw: 1, hp: 40 }] });
    assert(syncedEntry.hp === 30, "in-flight snapshot cannot roll the optimistic hp back up while a hit is pending");
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-1", name: "골든늑대", kind: "wolf", monsterId: "wolf", regionId: "r1", x: 30, z: 8, yaw: 1, hp: 25 }] });
    assert(syncedEntry.hp === 25, "authoritative downward corrections always apply");
    assert(partyGuestAttackIntercept(localWolf, 10, "melee") === false, "non-synced (own-world) targets keep local combat");
    // DOT 도 본 전투 공식과 동일 — 필드보스 armor 적용
    syncedEntry.armor = 50;
    const beforeDot = syncedEntry.hp;
    partyGuestAttackIntercept(syncedEntry, 30, "dot");
    assert(beforeDot - syncedEntry.hp === Math.max(1, calculateCombatDamage(30, 50)), "dot damage respects field-boss armor (parity with combat.ts)");
    syncedEntry.armor = 0;

    // ── 게스트: partyKill 수신 (처치자 전리품 + 전원 XP + 같은 맵 한정 필드보스 기록) ──
    guest.getGameCb()({ type: "partyKill", name: "골든늑대", xp: 35, killer: "연우용사", mapId: "starter_valley", kind: "wolf" });
    assert(guest.events.some(([kind, amount]) => kind === "xp" && amount === 35), "killer guest gains the shared xp");
    assert(guest.events.some(([kind]) => kind === "loot"), "killer guest rolls loot locally");
    guest.events.length = 0;
    guest.getGameCb()({ type: "partyKill", name: "보스", xp: 240, killer: "아빠용사", mapId: "starter_valley", fieldBossId: "boss_starter_valley" });
    assert(guest.events.some(([kind, amount]) => kind === "xp" && amount === 240), "non-killer guest still gains full shared xp");
    assert(!guest.events.some(([kind]) => kind === "loot"), "non-killer gets no loot");
    assert(guest.events.some(([kind, id]) => kind === "bossDefeat" && id === "boss_starter_valley"), "shared field boss defeat is recorded on the guest");
    guest.getGameCb()({ type: "partyKill", name: "먼곳보스", xp: 99, killer: "아빠용사", mapId: "graveyard", fieldBossId: "boss_graveyard" });
    assert(!guest.events.some(([kind, amount]) => kind === "xp" && amount === 99), "kills on another map grant no xp");
    assert(!guest.events.some(([kind, id]) => kind === "bossDefeat" && id === "boss_graveyard"), "field boss defeats on another map are NOT recorded (content preserved)");

    // ── 게스트: mobHit (mapId 검증 + 사망 grace) + 스냅샷 제거 ──
    guest.getGameCb()({ type: "mobHit", nickname: "연우용사", amount: 6, name: "늑대", mapId: "starter_valley" });
    assert(guest.events.some(([kind, amount, name]) => kind === "playerHit" && amount === 6 && name === "늑대"), "mobHit for me damages the local player");
    guest.getGameCb()({ type: "mobHit", nickname: "남의닉", amount: 6, name: "늑대", mapId: "starter_valley" });
    guest.getGameCb()({ type: "mobHit", nickname: "연우용사", amount: 6, name: "늑대", mapId: "graveyard" });
    assert(guest.events.filter(([kind]) => kind === "playerHit").length === 1, "mobHit for someone else or another map is ignored");
    guest.state.nextPlayerHitKills = true;
    guest.getGameCb()({ type: "mobHit", nickname: "연우용사", amount: 99, name: "늑대", mapId: "starter_valley" });
    guest.getGameCb()({ type: "mobHit", nickname: "연우용사", amount: 99, name: "늑대", mapId: "starter_valley" });
    assert(guest.events.filter(([kind]) => kind === "playerHit").length === 2, "hits queued behind a death are dropped during the grace window (no chain deaths)");
    guest.state.nextPlayerHitKills = false;
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [] });
    assert(![...guest.objects.values()].some((object) => object.type === "wildPredator"), "mobs absent from the snapshot are removed silently");
    assert(guest.events.some(([kind, id]) => kind === "removeSilent" && id === syncedEntry.id), "synced mob removal bypasses the respawn queue");

    // ── 게스트: 스냅샷 두절 → 게이트 해제 + 보관해 둔 로컬 몬스터 스태거 복원 ──
    await new Promise((resolve) => setTimeout(resolve, MOB_SYNC_STALE_MS + 100));
    assert(partyWorldGuestActive() === false, "stale snapshots (host indoors/background/left) release the guest gate");
    partyWorldSyncTick(3_000, 0.016);
    partyWorldSyncTick(3_016, 0.016);
    const restored = [...guest.objects.values()].filter((object) => object.type === "wildPredator");
    assert(restored.length === 1 && restored[0].predatorKind === "wolf" && !restored[0].partyTransient, "cleared local predators are restored from the stash once sync releases");

    resetPartyWorldSync();
    initPartyWorldSync({ session: () => null, localPresence: () => guest.me, getGroundHeightAt: () => 0, world: null }); // 모듈 상태 완전 분리 — 이후 골든(predator AI)이 게스트 게이트에 걸리지 않게
    assert(partyWorldGuestActive() === false, "detached world sync leaves guest mode");
  }

  {
    // 파티 6차 골든 — 마을 경비 동기화: isGuardType / 호스트 수집 / 게스트 spawnGuard / 게스트 공격→호스트 판정(enrage·철) / 처치 공유
    const { initPartyWorldSync, partyWorldSyncTick, isGuardType, partyHostNotifyKill, resetPartyWorldSync } = partyWorldSync;
    assert(["villageKnight", "villageArcher", "villageMage", "villageGolem"].every(isGuardType), "all four village guard types are guard types");
    assert(!isGuardType("wildPredator") && !isGuardType("villager") && !isGuardType(undefined), "non-guard types are not guard types");

    const makeWorld = (role) => {
      const objects = new Map();
      let nextId = 1;
      const events = [];
      const sent = [];
      let gameCb = null;
      const me = { nickname: role === "host" ? "방장" : "친구", mapId: "starter_valley", x: 0, z: 0, yaw: 0, playerClass: "warrior", inGame: true, panelOpen: false };
      const session = { role, sendGame: (m) => sent.push(m), onGame: (cb) => { gameCb = cb; }, onPresences: () => {} };
      const world = {
        entityContext: { addWorldObject: (type, name, root, extra) => { const o = { id: `${role}-${nextId++}`, type, name, root, ...extra }; objects.set(o.id, o); return o; }, getGroundHeightAt: () => 0, createWalkCycle: () => ({}), predatorStats: () => ({ hp: 30, attackDamage: 3 }), predatorAggroRange: () => 10, bossStats: () => ({}) },
        activeRegions: () => [{ id: "r1", lootTier: 1, center: { x: 0, y: 0, z: 0 }, radius: 500 }],
        mapXpScale: () => 1,
        predators: () => [...objects.values()].filter((o) => o.type === "wildPredator"),
        guards: () => [...objects.values()].filter((o) => isGuardType(o.type)),
        spawnGuard: (type, x, z, villageId) => { const o = { id: `${role}-${nextId++}`, type, name: "경비", villageId, armor: 25, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        enrageVillage: (villageId) => { events.push(["enrage", villageId]); for (const o of objects.values()) if (isGuardType(o.type) && o.villageId === villageId) o.angryUntil = performance.now() + 12_000; },
        getObject: (id) => objects.get(id),
        removeObject: (id) => { objects.delete(id); events.push(["remove", id]); },
        removeObjectSilent: (id) => { objects.delete(id); events.push(["removeSilent", id]); },
        hitFeedback: () => {},
        showMessage: () => {},
        gainExperience: (a) => events.push(["xp", a]),
        creditHostKill: (t) => events.push(["credit", t.id]),
        rollLoot: (item, count, source) => { events.push(["loot", item, count, source]); return count; },
        recordFieldBossDefeat: () => {},
        damageLocalPlayer: () => false,
        animateWalkCycle: () => {},
        refreshSpatialObject: () => {},
        chests: () => [...objects.values()].filter((o) => o.type === "chest" || o.type === "mineChest"),
        caves: () => [...objects.values()].filter((o) => o.type === "cave"),
        spawnChest: (x, z, mineRich, opened) => { const o = { id: `${role}-${nextId++}`, type: mineRich ? "mineChest" : "chest", name: "상자", opened, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        spawnCave: (x, z) => { const o = { id: `${role}-${nextId++}`, type: "cave", name: "동굴", root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        markChestOpened: (id) => { const c = objects.get(id); if (!c || c.opened || (c.type !== "chest" && c.type !== "mineChest")) return null; c.opened = true; events.push(["chestOpened", id]); return c.chestTier ?? 0; },
        grantChestLoot: (items) => events.push(["chestLoot", items]),
      };
      return { session, objects, me, events, sent, world, getGameCb: () => gameCb };
    };

    // ── 호스트: 경비를 스냅샷에 수집 ──
    const host = makeWorld("host");
    const golem = host.world.entityContext.addWorldObject("villageGolem", "마을 골렘", { position: { x: 5, y: 0, z: 5 }, rotation: { y: 0 } }, { hp: 180, armor: 25, villageId: "v1", guardMode: "melee" });
    initPartyWorldSync({ session: () => host.session, localPresence: () => host.me, getGroundHeightAt: () => 0, world: host.world });
    partyWorldSyncTick(1_000, 0.016);
    const golemSnap = host.sent.find((m) => m.type === "mobs")?.list.find((e) => e.id === golem.id);
    assert(golemSnap && golemSnap.type === "villageGolem" && golemSnap.villageId === "v1" && golemSnap.hp === 180, "host snapshot carries the guard with type/villageId/hp");

    // ── 호스트: 약한 공격은 골렘 방어(armor 25)에 완전 차단(0뎀·무처치), 단 마을은 각성 ──
    const weakGuard = host.world.entityContext.addWorldObject("villageGolem", "골렘2", { position: { x: 6, y: 0, z: 6 }, rotation: { y: 0 } }, { hp: 180, armor: 25, villageId: "v2", guardMode: "melee" });
    host.getGameCb()({ type: "attackRequest", targetId: weakGuard.id, power: 3, kind: "ranged" }, "친구"); // gap = 3-25 ≤ -20 → 0뎀
    assert(weakGuard.hp === 180, "weak attack is fully blocked by guard armor (parity with solo) — no chip damage");
    assert(host.events.some(([k, v]) => k === "enrage" && v === "v2"), "even a blocked hit enrages the village");

    // ── 호스트: 게스트 공격 판정 → enrage(최초 1회만) + 처치 시 철 전리품 partyKill ──
    host.getGameCb()({ type: "attackRequest", targetId: golem.id, power: 30, kind: "ranged" }, "친구");
    assert(host.events.filter(([k, v]) => k === "enrage" && v === "v1").length === 1, "guest attack on a guard enrages the village");
    host.getGameCb()({ type: "attackRequest", targetId: golem.id, power: 30, kind: "ranged" }, "친구");
    assert(host.events.filter(([k, v]) => k === "enrage" && v === "v1").length === 1, "already-angry guard is NOT re-enraged (no message spam / cooldown thrash)");
    host.getGameCb()({ type: "attackRequest", targetId: golem.id, power: 9999, kind: "ranged" }, "친구");
    const guardKill = host.sent.find((m) => m.type === "partyKill" && m.lootItem === "iron");
    assert(guardKill && guardKill.killer === "친구" && guardKill.lootCount === 1, "guard kill broadcasts partyKill with iron loot for the killer");
    assert(host.events.some(([k, id]) => k === "remove" && id === golem.id), "killed guard enters the host respawn-queue path");
    host.sent.length = 0;
    partyHostNotifyKill({ id: "g2", type: "villageKnight", name: "마을기사", monsterLevel: 5, root: { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } } });
    assert(host.sent.some((m) => m.type === "partyKill" && m.name === "마을기사"), "host's own guard kill is shared to the party (XP)");
    resetPartyWorldSync();

    // ── 게스트: 스냅샷의 경비를 spawnGuard 로 생성 + partyKill(iron) 수신 ──
    const guest = makeWorld("guest");
    initPartyWorldSync({ session: () => guest.session, localPresence: () => guest.me, getGroundHeightAt: () => 0, world: guest.world });
    partyWorldSyncTick(2_000, 0.016);
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [{ id: "H-G1", name: "마을 골렘", type: "villageGolem", villageId: "v1", guardMode: "melee", x: 8, z: 2, yaw: 0, hp: 150, armor: 25 }] });
    const synced = [...guest.objects.values()].find((o) => o.type === "villageGolem");
    assert(synced && synced.hp === 150 && synced.partyTransient === true, "guest spawns the synced guard via spawnGuard (transient, authoritative hp)");
    guest.events.length = 0;
    guest.getGameCb()({ type: "partyKill", name: "마을 골렘", xp: 40, killer: "친구", mapId: "starter_valley", lootItem: "iron", lootCount: 1 });
    assert(guest.events.some(([k, a]) => k === "xp" && a === 40), "killer guest gains shared xp for the guard");
    assert(guest.events.some(([k, item, , source]) => k === "loot" && item === "iron" && source === "guard"), "killer guest rolls iron loot with the 'guard' reward source (matches solo)");
    resetPartyWorldSync();
    initPartyWorldSync({ session: () => null, localPresence: () => guest.me, getGroundHeightAt: () => 0, world: null });
  }

  {
    // 파티 7차 골든 — 동굴·보물상자 공유: isStaticShareType / 호스트 수집(objType·opened) / 게스트 spawnChest·spawnCave / 개봉 호스트 위임(전리품 1회) / 개봉 중복 방지
    const { initPartyWorldSync, partyWorldSyncTick, isStaticShareType, partyGuestOpenIntercept, resetPartyWorldSync } = partyWorldSync;
    assert(["cave", "chest", "mineChest"].every(isStaticShareType), "cave/chest/mineChest are static share types");
    assert(!isStaticShareType("wildPredator") && !isStaticShareType("villageGolem") && !isStaticShareType(undefined), "mobs/guards are not static share types");

    const makeWorld = (role) => {
      const objects = new Map();
      let nextId = 1;
      const events = [];
      const sent = [];
      let gameCb = null;
      const me = { nickname: role === "host" ? "방장" : "친구", mapId: "starter_valley", x: 0, z: 0, yaw: 0, playerClass: "warrior", inGame: true, panelOpen: false };
      const session = { role, sendGame: (m) => sent.push(m), onGame: (cb) => { gameCb = cb; }, onPresences: () => {} };
      const world = {
        entityContext: { addWorldObject: (type, name, root, extra) => { const o = { id: `${role}-${nextId++}`, type, name, root, ...extra }; objects.set(o.id, o); return o; }, getGroundHeightAt: () => 0, createWalkCycle: () => ({}), predatorStats: () => ({ hp: 30, attackDamage: 3 }), predatorAggroRange: () => 10, bossStats: () => ({}) },
        activeRegions: () => [{ id: "r1", lootTier: 1, center: { x: 0, y: 0, z: 0 }, radius: 500 }],
        mapXpScale: () => 1,
        predators: () => [...objects.values()].filter((o) => o.type === "wildPredator"),
        guards: () => [...objects.values()].filter((o) => ["villageKnight", "villageArcher", "villageMage", "villageGolem"].includes(o.type)),
        chests: () => [...objects.values()].filter((o) => o.type === "chest" || o.type === "mineChest"),
        caves: () => [...objects.values()].filter((o) => o.type === "cave"),
        spawnGuard: (type, x, z, villageId) => { const o = { id: `${role}-${nextId++}`, type, name: "경비", villageId, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        spawnChest: (x, z, mineRich, opened) => { const o = { id: `${role}-${nextId++}`, type: mineRich ? "mineChest" : "chest", name: "상자", opened, root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        spawnCave: (x, z) => { const o = { id: `${role}-${nextId++}`, type: "cave", name: "동굴", root: { position: { x, y: 0, z }, rotation: { y: 0 } } }; objects.set(o.id, o); return o; },
        markChestOpened: (id) => { const c = objects.get(id); if (!c || c.opened || (c.type !== "chest" && c.type !== "mineChest")) return null; c.opened = true; events.push(["chestOpened", id]); return c.chestTier ?? 0; },
        grantChestLoot: (items) => events.push(["chestLoot", items]),
        enrageVillage: () => {},
        getObject: (id) => objects.get(id),
        removeObject: (id) => { objects.delete(id); events.push(["remove", id]); },
        removeObjectSilent: (id) => { objects.delete(id); events.push(["removeSilent", id]); },
        hitFeedback: () => {},
        showMessage: () => {},
        gainExperience: () => {},
        creditHostKill: () => {},
        rollLoot: () => 0,
        recordFieldBossDefeat: () => {},
        damageLocalPlayer: () => false,
        animateWalkCycle: () => {},
        refreshSpatialObject: () => {},
      };
      return { session, objects, me, events, sent, world, getGameCb: () => gameCb };
    };

    // ── 호스트: 상자·동굴을 스냅샷에 수집 ──
    const host = makeWorld("host");
    const chest = host.world.entityContext.addWorldObject("chest", "보물 상자", { position: { x: 7, y: 0, z: 3 }, rotation: { y: 0 } }, { chestTier: 3 });
    host.world.entityContext.addWorldObject("cave", "동굴 입구", { position: { x: -5, y: 0, z: 9 }, rotation: { y: 0 } }, {});
    initPartyWorldSync({ session: () => host.session, localPresence: () => host.me, getGroundHeightAt: () => 0, world: host.world });
    partyWorldSyncTick(1_000, 0.016);
    const snapList = host.sent.find((m) => m.type === "mobs")?.list ?? [];
    assert(snapList.some((e) => e.id === chest.id && e.objType === "chest" && e.opened === false), "host snapshot carries the chest with objType/opened");
    assert(snapList.some((e) => e.objType === "cave"), "host snapshot carries the cave entrance");

    // ── 호스트: 게스트 개봉 요청 → 1회만 개봉 + 요청자에게 chestLoot ──
    host.getGameCb()({ type: "openRequest", objectId: chest.id }, "친구");
    assert(host.events.some(([k, id]) => k === "chestOpened" && id === chest.id), "guest open request opens the chest on the host (authority)");
    const lootMsg = host.sent.find((m) => m.type === "chestLoot");
    assert(lootMsg && lootMsg.opener === "친구", "host sends chestLoot to the requesting guest only");
    assert(lootMsg.items.some((e) => e.item === "obsidian"), "guest-opened tier-3 chest must yield tier-3 loot (obsidian), not tier-0");
    host.getGameCb()({ type: "openRequest", objectId: chest.id }, "친구");
    assert(host.sent.filter((m) => m.type === "chestLoot").length === 1, "already-opened chest cannot be opened again (no double loot)");
    resetPartyWorldSync();

    // ── 게스트: 상자·동굴 스폰 + 개봉 요청 위임 + chestLoot 수령 ──
    const guest = makeWorld("guest");
    initPartyWorldSync({ session: () => guest.session, localPresence: () => guest.me, getGroundHeightAt: () => 0, world: guest.world });
    partyWorldSyncTick(2_000, 0.016);
    guest.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [
      { id: "H-C1", name: "보물 상자", objType: "chest", opened: false, x: 7, z: 3, yaw: 0, hp: 1 },
      { id: "H-CAVE", name: "동굴 입구", objType: "cave", x: -5, z: 9, yaw: 0, hp: 1 },
    ] });
    const syncedChest = [...guest.objects.values()].find((o) => o.type === "chest");
    const syncedCave = [...guest.objects.values()].find((o) => o.type === "cave");
    assert(syncedChest && syncedChest.partyTransient === true, "guest spawns the synced chest (transient)");
    assert(syncedCave && syncedCave.partyTransient === true, "guest spawns the synced cave entrance (transient)");
    assert(syncedChest.collidable === false && syncedCave.collidable === false, "synced statics are non-colliding (host coords on guest terrain — avoid stuck)");
    assert(partyGuestOpenIntercept(syncedChest) === true && guest.sent.some((m) => m.type === "openRequest" && m.objectId === "H-C1"), "guest opening a synced chest sends an openRequest instead of opening locally");
    guest.getGameCb()({ type: "chestLoot", opener: "친구", items: [{ item: "wood", count: 2 }] });
    assert(guest.events.some(([k, items]) => k === "chestLoot" && items[0].item === "wood"), "guest receives chest loot addressed to it");
    guest.events.length = 0;
    guest.getGameCb()({ type: "chestLoot", opener: "다른사람", items: [{ item: "wood", count: 2 }] });
    assert(!guest.events.some(([k]) => k === "chestLoot"), "chest loot addressed to another player is ignored");
    resetPartyWorldSync();

    // ── opened 상태 보존: 게스트 자기 '이미 연' 상자가 합류(sweep) 후 탈퇴 시 열린 채 복원 (재개봉=이중 전리품 차단) ──
    const g2 = makeWorld("guest");
    const localOpenChest = g2.world.spawnChest(11, 4, false, true); // 이미 연 로컬 상자
    let g2session = g2.session;
    initPartyWorldSync({ session: () => g2session, localPresence: () => g2.me, getGroundHeightAt: () => 0, world: g2.world });
    partyWorldSyncTick(3_000, 0.016); // 세션 훅 배선
    g2.getGameCb()({ type: "mobs", mapId: "starter_valley", list: [] }); // firstClear sweep → 로컬 상자 stash(opened) 후 제거
    assert(!g2.objects.has(localOpenChest.id), "joining sweeps the guest's own local chest into the stash");
    g2session = null; // 파티 탈퇴
    partyWorldSyncTick(4_000, 0.016); // 동기화 해제 → 로컬 복원
    const restoredChest = [...g2.objects.values()].find((o) => o.type === "chest");
    assert(restoredChest && restoredChest.opened === true, "an already-opened chest is restored as opened (no re-loot exploit)");
    resetPartyWorldSync();
    initPartyWorldSync({ session: () => null, localPresence: () => guest.me, getGroundHeightAt: () => 0, world: null });
  }

  {
    // 파티 5.1 골든 — 공격 브로드캐스트 / 파티 힐(송신·수신·맵 가드) / 플레이어 충돌 push-out
    const { initPartyPresence, updatePartyPresence, resetPartyPresence, notifyPartyAttack, partyHealNearby, partyHasNearbyMember, pushOutOfPartyMembers, applyAttackMotion } = partyPresence;
    const sent = [];
    let presencesCb = null;
    let gameCb = null;
    const fakeSession = { onPresences: (cb) => { presencesCb = cb; }, onGame: (cb) => { gameCb = cb; }, sendPresence: () => {}, sendGame: (message) => sent.push(message) };
    let healed = 0;
    initPartyPresence({
      scene: { add: () => {}, remove: () => {} },
      session: () => fakeSession,
      getGroundHeightAt: () => 0,
      localPresence: () => ({ nickname: "나", mapId: "starter_valley", x: 0, z: 0, yaw: 0, playerClass: "healer", inGame: true, health: 10, maxHealth: 20 }),
      world: { healLocalPlayer: (amount) => { healed += amount; } },
    });
    updatePartyPresence(1_000, 0.016); // onPresences/onGame 훅
    presencesCb([{ nickname: "친구", mapId: "starter_valley", x: 3, z: 0, yaw: 0, playerClass: "warrior", inGame: true, health: 5, maxHealth: 20 }]);

    // 공격 브로드캐스트 (친구 화면에 모션/투사체용)
    notifyPartyAttack("melee");
    assert(sent.some((message) => message.type === "playerAttack" && message.nickname === "나" && message.kind === "melee"), "notifyPartyAttack broadcasts a playerAttack event");
    sent.length = 0;
    notifyPartyAttack("ranged", new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1), "arrow");
    const atk = sent.find((message) => message.type === "playerAttack");
    assert(atk && atk.kind === "ranged" && atk.visual === "arrow" && atk.oz === 0 && atk.dz === -1, "ranged attack carries origin/direction/visual for the remote projectile");

    // 근처 파티원 탐지 (힐러 발동 판정)
    assert(partyHasNearbyMember(0, 0, 12) === true, "nearby same-map party member is detected within range");
    assert(partyHasNearbyMember(0, 0, 1) === false, "party member outside the radius is not detected");

    // 파티 힐 송신 — 사정거리 내 친구에게 partyHeal
    sent.length = 0;
    const healedCount = partyHealNearby(8, 12);
    assert(healedCount === 1 && sent.some((message) => message.type === "partyHeal" && message.recipient === "친구" && message.amount === 8 && message.mapId === "starter_valley"), "partyHealNearby sends partyHeal to each nearby friend");

    // 파티 힐 수신 — 나에게 온 것만, 같은 맵만 적용
    gameCb({ type: "partyHeal", recipient: "나", amount: 7, mapId: "starter_valley" });
    assert(healed === 7, "partyHeal addressed to me applies a local heal");
    gameCb({ type: "partyHeal", recipient: "다른사람", amount: 7, mapId: "starter_valley" });
    gameCb({ type: "partyHeal", recipient: "나", amount: 7, mapId: "graveyard" });
    assert(healed === 7, "partyHeal for someone else or another map is ignored");

    // 플레이어 충돌 push-out — 친구(3,0)와 겹친 위치에서 밀려난다
    const pos = new THREE.Vector3(3.2, 0, 0);
    pushOutOfPartyMembers(pos, 0.42);
    assert(pos.x > 3.5, "player overlapping a friend is pushed out (no full overlap)");
    const farPos = new THREE.Vector3(40, 0, 40);
    pushOutOfPartyMembers(farPos, 0.42);
    assert(farPos.x === 40 && farPos.z === 40, "a player far from any friend is not nudged");

    // 직업별 원격 공격 모션 — 모두 "앞으로 숙임" 단일 모션이 아니라 직업마다 다른 자세
    const rest = { x: 0, y: 0, z: 0 };
    applyAttackMotion(rest, "warrior", 0); // 진행도 0 → 휴식 자세
    assert(rest.x === 0 && rest.y === 0 && rest.z === 0, "attack motion at progress 0 is the rest pose");
    const warrior = { x: 0, y: 0, z: 0 }, gunner = { x: 0, y: 0, z: 0 }, mage = { x: 0, y: 0, z: 0 };
    applyAttackMotion(warrior, "warrior", 0.5); // 봉우리
    applyAttackMotion(gunner, "gunner", 0.5);
    applyAttackMotion(mage, "mage", 0.5);
    assert(warrior.y < -0.1, "melee swing twists the torso (rotation.y), not just a forward bend");
    assert(mage.x > 0.1, "caster leans back/up (positive rotation.x), opposite of the old forward bend");
    assert(gunner.x < 0 && gunner.y === 0, "gunner leans slightly forward to aim, no torso twist");
    assert(warrior.y !== mage.y && Math.sign(warrior.x) !== Math.sign(mage.x), "each class archetype has a distinct attack pose");
    resetPartyPresence();
  }

  {
    // 닉네임 골든: 길이/문자/비속어/예약어/중복 거부 + 1회 확정 후 불변
    const { validateNickname, confirmNickname, loadNickname } = nickname;
    assert(!validateNickname("a", []).ok, "1글자 닉네임은 거부");
    assert(!validateNickname("열한글자가넘는닉네임임", []).ok, "11글자 닉네임은 거부");
    assert(!validateNickname("연 우", []).ok, "공백 포함 닉네임은 거부");
    assert(!validateNickname("연우!", []).ok, "특수문자 포함 닉네임은 거부");
    assert(!validateNickname("시발맨", []).ok, "비속어 포함 닉네임은 거부");
    assert(!validateNickname("FxCk123", []).ok, "변형 영문 욕설도 거부");
    assert(!validateNickname("admin", []).ok, "시스템 예약어는 거부");
    assert(!validateNickname("연우용사", ["연우용사"]).ok, "중복 닉네임은 거부");
    assert(!validateNickname("Yunu", ["yunu"]).ok, "대소문자만 다른 중복도 거부");
    assert(validateNickname("연우용사", []).ok, "정상 닉네임은 통과");
    const store = new Map();
    const mockStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    const first = confirmNickname("연우짱", mockStorage);
    assert(first.ok && loadNickname(mockStorage) === "연우짱", "확정하면 저장된다");
    const second = confirmNickname("다른이름", mockStorage);
    assert(!second.ok && second.reason.includes("변경할 수 없습니다") && loadNickname(mockStorage) === "연우짱", "확정 후에는 절대 변경 불가");
  }

  {
    // 훈련장 골든: 난이도 단조 증가 + 안전 클램프 + 보상/정규화
    const { TRAINING_MIN_LEVEL, TRAINING_REWARDS, TRAINING_GAMES, normalizeTrainingStats, liftDrainPerSecond, liftClickPower, targetSpeed, targetWobble, targetTolerance, blockWindowMs, blockFakeChance, calmZoneRatio, TARGET_SHOOT_MIN_INTERVAL_MS, canShootTarget } = training;
    assert(TRAINING_MIN_LEVEL === 10, "training unlocks at level 10");
    assert(TRAINING_REWARDS.hp === 2 && TRAINING_REWARDS.attack === 1 && TRAINING_REWARDS.armor === 1 && TRAINING_REWARDS.mana === 2, "training rewards match the spec");
    for (const kind of ["hp", "attack", "armor", "mana"]) assert(TRAINING_GAMES[kind]?.name && TRAINING_GAMES[kind]?.howTo, `training game '${kind}' needs a name and instructions`);
    // 성공할수록 어려워진다 (단조)
    assert(liftDrainPerSecond(10) > liftDrainPerSecond(0) && liftClickPower(10) < liftClickPower(0), "lift gets harder with success count");
    assert(targetSpeed(10) > targetSpeed(0) && targetWobble(10) > targetWobble(0) && targetTolerance(10) < targetTolerance(0), "target gets faster, wobblier, stricter");
    assert(blockWindowMs(10) < blockWindowMs(0) && blockFakeChance(10) > blockFakeChance(0), "block window shrinks and fakes increase");
    assert(calmZoneRatio(10) < calmZoneRatio(0), "calm zone shrinks");
    // 무한 성장해도 플레이 가능한 하한 클램프
    assert(liftClickPower(999) >= 5.5 && targetTolerance(999) >= 0.05 && blockWindowMs(999) >= 240 && calmZoneRatio(999) >= 0.07, "difficulty floors keep games playable");
    const normalized = normalizeTrainingStats({ hp: 3.7, attack: -2, mana: Number.NaN });
    assert(normalized.hp === 3 && normalized.attack === 0 && normalized.armor === 0 && normalized.mana === 0, "training stats normalize to non-negative integers");
    // 과녁 발사 최소 입력 간격 0.5초 — 난타·꾹누르기·연타 악용 차단
    assert(TARGET_SHOOT_MIN_INTERVAL_MS === 500, "target minigame enforces a 0.5s minimum interval per shot");
    assert(canShootTarget(0, -Infinity) === true, "first shot is always allowed");
    assert(canShootTarget(400, 0) === false, "a second shot within 0.5s is blocked (anti-spam/hold)");
    assert(canShootTarget(500, 0) === true && canShootTarget(1000, 500) === true, "a shot at/after 0.5s is allowed");
  }

  {
    // 스킬 스케일링 골든: 일반 공격처럼 스킬도 레벨 보너스에 비례해 강해진다
    const { warriorExplosionDamage, mageTntDamage, gunnerShotDamage, healerHealAmount, fireballDamage, burnTickDamage, thornsTickDamage, healingRainTick, windSpiritDamage, burningStrikeDamage } = classSkills;
    assert(warriorExplosionDamage(0) === 20 && warriorExplosionDamage(50) === 70, "warrior explosion should scale 1.0x level bonus");
    assert(mageTntDamage(0) === 20 && mageTntDamage(50) === 65, "mage tnt should scale 0.9x level bonus");
    assert(gunnerShotDamage(0) === 100 && gunnerShotDamage(50) === 200, "gunner shot should scale 2.0x level bonus");
    assert(healerHealAmount(0) === 15 && healerHealAmount(50) === 65, "healer heal should scale 1.0x level bonus");
    assert(fireballDamage(0) === 45 && fireballDamage(50) === 125, "fireball should scale 1.6x level bonus");
    assert(windSpiritDamage(0) === 35 && windSpiritDamage(50) === 95, "wind spirit should scale 1.2x level bonus");
    assert(burnTickDamage(50) === 29 && thornsTickDamage(50) === 33 && healingRainTick(50) === 22, "dot/aura/rain ticks should scale");
    assert(burningStrikeDamage(40) === 80, "burning strike should double current attack damage");
  }

  {
    // 2스킬 테이블: 6직업 전부 정의 + 기획 지정 이름 + 양수 코스트/쿨다운
    const { SECOND_SKILLS } = classSkills;
    const classIds = Object.keys(PLAYER_CLASSES);
    assert(classIds.every((id) => SECOND_SKILLS[id]), "every class must define a second skill");
    assert(SECOND_SKILLS.mage.name === "파이어볼" && SECOND_SKILLS.warrior.name === "불타는 공격" && SECOND_SKILLS.tanker.name === "불타는 방패", "designed second-skill names must match the spec");
    assert(classIds.every((id) => SECOND_SKILLS[id].manaCost > 0 && SECOND_SKILLS[id].cooldown > 0 && SECOND_SKILLS[id].summary.length > 0), "second skills need cost, cooldown, and summary");
  }

  {
    // 2스킬 실행/지속효과 골든: 파이어볼 발사, 불타는 공격(강타+도트), 불타는 방패(방어+오라), 치유의 비, 속사
    const { useSecondClassSkill, updateSecondSkillEffects, createSkillBuffs, resetSecondSkillEffects, activeBurnCount, burningShieldArmorBonus, rapidFireCooldownScale, BURN_TICKS } = classSkills;
    let nowMs = 10_000;
    const buffs = createSkillBuffs();
    resetSecondSkillEffects(buffs);
    const calls = [];
    const target = { id: "prey-1", type: "wildPredator", name: "늑대", hp: 500, root: { position: { x: 2, y: 0, z: 0 } }, collisionRadius: 0.8 };
    const makeContext = (playerClass, lookTarget) => ({
      playerClass: () => playerClass,
      levelBonus: () => 10,
      currentDamage: () => 30,
      now: () => nowMs,
      buffs,
      trySpend: () => { calls.push(["spend", playerClass]); return true; },
      lookCombatTarget: () => lookTarget ?? null,
      fireSkillProjectile: (kind, visual, damage) => calls.push(["projectile", kind, visual, damage]),
      applyDamage: (object, damage) => calls.push(["damage", object.id, damage]),
      meleeEffects: () => {},
      playHandAction: () => {},
      playTone: () => {},
      showMessage: (text) => calls.push(["message", text]),
      renderHud: () => {},
    });

    useSecondClassSkill(makeContext("mage", null));
    assert(calls.some(([kind, k, visual, damage]) => kind === "projectile" && k === "tnt" && visual === "fireball" && damage === 61), "fireball should fire a fireball-visual tnt projectile with scaled damage");

    calls.length = 0;
    useSecondClassSkill(makeContext("warrior", null));
    assert(!calls.some(([kind]) => kind === "spend"), "burning strike without a target must not spend mana");
    useSecondClassSkill(makeContext("warrior", target));
    assert(calls.some(([kind, id, damage]) => kind === "damage" && id === "prey-1" && damage === 60), "burning strike should hit for 2x current damage");
    assert(activeBurnCount() === 1, "burning strike should register a burn");

    const effectTargets = [target];
    const effectsContext = {
      now: () => nowMs,
      buffs,
      levelBonus: () => 10,
      getObject: (id) => effectTargets.find((candidate) => candidate.id === id && candidate.hp > 0),
      nearbyCombatTargets: () => effectTargets,
      applyDamage: (object, damage) => calls.push(["tick", object.id, damage]),
      heal: (amount) => calls.push(["heal", amount]),
      playerPosition: { x: 0, y: 1.7, z: 0 },
    };
    calls.length = 0;
    for (let step = 0; step < BURN_TICKS + 2; step += 1) {
      nowMs += 1_000;
      updateSecondSkillEffects(effectsContext);
    }
    assert(calls.filter(([kind]) => kind === "tick").length === BURN_TICKS, `burn should tick exactly ${BURN_TICKS} times`);
    assert(activeBurnCount() === 0, "burn should expire after its ticks");
    assert(calls.every(([kind, , damage]) => kind !== "tick" || damage === 9), "burn tick should be scaled (4 + 0.5x10 = 9)");

    // 불타는 방패: 방어 +1 + 1초 간격 오라, 끝나면 0
    calls.length = 0;
    useSecondClassSkill(makeContext("tanker", null));
    assert(burningShieldArmorBonus(buffs, nowMs) === 1, "burning shield should add +1 armor while active");
    nowMs += 1_000;
    updateSecondSkillEffects(effectsContext);
    nowMs += 1_000;
    updateSecondSkillEffects(effectsContext);
    assert(calls.filter(([kind]) => kind === "tick").length === 2, "burning shield aura should tick once per second");
    assert(burningShieldArmorBonus(buffs, nowMs + 60_000) === 0, "burning shield armor should expire");

    // 치유의 비 + 속사
    calls.length = 0;
    useSecondClassSkill(makeContext("healer", null));
    nowMs += 1_000;
    updateSecondSkillEffects(effectsContext);
    assert(calls.some(([kind, amount]) => kind === "heal" && amount === 6), "healing rain should heal scaled amount per second (2 + 0.4x10)");
    useSecondClassSkill(makeContext("gunner", null));
    assert(rapidFireCooldownScale(buffs, nowMs) === 0.5, "rapid fire should halve ranged cooldown while active");
    assert(rapidFireCooldownScale(buffs, nowMs + 60_000) === 1, "rapid fire should expire");
    resetSecondSkillEffects(buffs);
  }

  {
    // 정면 추격 골든: 몬스터 모델은 +X 가 정면 — rotation.y = -atan2(dz, dx) 여야 플레이어를 마주본다
    const { updatePredatorAi } = predatorAi;
    const predator = { root: new THREE.Group(), type: "wildPredator", name: "늑대", predatorKind: "wolf", attackCooldown: 99 };
    predator.root.position.set(10, 0, 5);
    const facingContext = {
      locationMode: () => "overworld",
      isPanelOpen: () => false,
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      activeRegions: () => [],
      predators: () => [predator],
      predatorAggroRange: () => 100,
      predatorStrikeRange: () => 0.1,
      predatorStats: () => ({ speed: 0, attackDamage: 1, cooldown: 1, aggroRange: 100, strikeRange: 0.1, hp: 10 }),
      getGroundHeightAt: () => 0,
      refreshSpatialObject: () => {},
      animateWalkCycle: () => {},
      damagePlayer: () => false,
    };
    updatePredatorAi(facingContext, 0.016);
    const dx = -10;
    const dz = -5;
    assert(Math.abs(predator.root.rotation.y - -Math.atan2(dz, dx)) < 1e-6, "aggroed predator should yaw to face the player");
    const facing = new THREE.Vector3(1, 0, 0).applyEuler(predator.root.rotation);
    const toPlayer = new THREE.Vector3(dx, 0, dz).normalize();
    assert(facing.dot(toPlayer) > 0.999, `predator front (+X) should point at the player (dot ${facing.dot(toPlayer).toFixed(3)})`);
  }

  {
    // 타격감 골든: 히트스톱·넉백·스쿼시 펀치·FOV 킥·사운드 레이어
    const { HIT_STOP_MS, HIT_STOP_SCALE, activePunchCount, hitStopScale, resetHitFeedbackForTest, triggerHitFeedback, updateHitFeedback } = hitFeedback;
    resetHitFeedbackForTest();
    const camera = new THREE.PerspectiveCamera(75, 1.77, 0.1, 100);
    const tones = [];
    const deps = {
      camera,
      playerPosition: new THREE.Vector3(0, 1.7, 0),
      playTone: (frequency) => tones.push(frequency),
      refreshSpatialObject: () => {},
      getGroundHeightAt: () => 0.5,
    };
    const target = { root: new THREE.Group(), type: "wildPredator", name: "늑대", collisionHeight: 1.2 };
    target.root.position.set(2, 0, 0);
    triggerHitFeedback(deps, target, 12, false, 1_000);
    assert(target.root.position.x > 2.3, "hit should knock the monster away from the player");
    assert(target.root.position.y === 0.5, "knockback should re-stick the monster to the ground");
    assert(hitStopScale(1_030) === HIT_STOP_SCALE, "hit stop should slow time right after a hit");
    assert(hitStopScale(1_000 + HIT_STOP_MS + 1) === 1, "hit stop should release after ~70ms");
    assert(tones.length >= 2, "hit should layer at least two tones");
    updateHitFeedback(1_085, camera);
    assert(target.root.scale.x > 1.05 && target.root.scale.y < 1, "squash punch should bulge X and crush Y mid-hit");
    assert(camera.fov < 75, "fov kick should punch in briefly");
    updateHitFeedback(1_400, camera);
    assert(target.root.scale.x === 1 && target.root.scale.y === 1 && activePunchCount() === 0, "punch should restore the base scale");
    assert(camera.fov === 75, "fov should return to base after the kick");
    const killTarget = { root: new THREE.Group(), type: "dragon", name: "용" };
    killTarget.root.position.set(0, 0, 3);
    triggerHitFeedback(deps, killTarget, 40, true, 2_000);
    assert(killTarget.root.position.z === 3, "killing blow should not knock the corpse around");
    assert(hitStopScale(2_000 + HIT_STOP_MS + 20) === HIT_STOP_SCALE, "kill should hold the hit stop longer than a normal hit");
    resetHitFeedbackForTest();
  }

  {
    // 내 집 베이스캠프: 창고 이동, 보급 쿨다운/보상 티어, 정규화 골든값
    const { HOME_STORAGE_SLOTS, HOME_SUPPLY_COOLDOWN_SECONDS, homeSupplyReadyLabel, normalizeHomeStorage, rollHomeSupply, transferSlot } = homeBase;
    assert(HOME_STORAGE_SLOTS === 24, "home storage should have 24 slots");
    assert(HOME_SUPPLY_COOLDOWN_SECONDS === 1800, "supply cooldown should be 30 minutes of play time");

    const storage = normalizeHomeStorage([{ item: "wood", count: 10 }]);
    assert(storage.length === 24 && storage[0].item === "wood" && storage[1].item === null, "normalize should pad to 24 slots");
    const carry = [{ item: "wood", count: 5 }, { item: null, count: 0 }];
    assert(transferSlot(carry[0], storage) && storage[0].count === 15 && carry[0].item === null, "same-item stacks should merge on store");
    const wornTool = { item: "iron_axe", count: 1, durabilityUsed: 9 };
    assert(transferSlot(wornTool, storage) && storage[1].item === "iron_axe" && storage[1].durabilityUsed === 9, "worn tools should keep durability and use an empty slot");
    const fullTarget = [{ item: "stone", count: 1 }];
    assert(!transferSlot({ item: "wood", count: 2 }, fullTarget), "transfer into a full target should fail");
    assert(!transferSlot({ item: null, count: 0 }, storage), "empty source slot should not transfer");

    const noBonus = () => 0.99;
    const low = rollHomeSupply(1, noBonus);
    assert(low.some((reward) => reward.item === "meat" && reward.count === 4), "level 1 supply should give 4 meat (buffed)");
    assert(!low.some((reward) => reward.item === "iron"), "level 1 supply should not give iron");
    const mid = rollHomeSupply(30, noBonus);
    assert(mid.some((reward) => reward.item === "iron") && mid.some((r) => r.item === "xp_bottle"), "level 30 supply adds iron + xp bottle (buffed)");
    const top = rollHomeSupply(100, noBonus);
    assert(top.some((reward) => reward.item === "diamond" && reward.count === 3), "level 100 supply should add diamonds (buffed to 3)");
    assert(top.some((reward) => reward.item === "obsidian"), "level 100 supply should add obsidian");
    assert(top.some((reward) => reward.item === "sharp_obsidian") && top.some((r) => r.item === "obsidian_powder"), "endgame supply yields ultimate-weapon materials (balance vs field obsidian chest)");
    const bonus = rollHomeSupply(100, () => 0.01);
    assert(bonus.length === top.length + 1, "supply bonus line should appear on a lucky roll (still exactly one probabilistic line)");
    assert(homeSupplyReadyLabel(0).includes("준비"), "ready label should say ready");
    assert(homeSupplyReadyLabel(610).includes("11분"), "cooldown label should round up to minutes");
  }

  {
    // 수리 골든값: 등급 재료 매핑 + 50% 회복 + 완전 마모 도구는 재료 2개로 완전 회복
    const { repairMaterialFor, repairPerMaterial, toolMaxDurability } = items;
    assert(repairMaterialFor("iron_pickaxe") === "refined_iron", "iron pickaxe should repair with refined iron");
    assert(repairMaterialFor("weak_wood_axe") === "refined_wood", "weak wood axe should repair with refined wood");
    assert(repairMaterialFor("iron_sword") === null, "combat weapons must not be repairable");
    almostEqual(repairPerMaterial("diamond_axe"), 40, "diamond axe repair per material");
    almostEqual(repairPerMaterial("gold_shovel"), 13, "gold shovel repair per material");
    let durabilityUsed = toolMaxDurability("iron_axe"); // 완전 마모(45) 직전 상태 가정
    durabilityUsed = Math.max(0, durabilityUsed - repairPerMaterial("iron_axe"));
    durabilityUsed = Math.max(0, durabilityUsed - repairPerMaterial("iron_axe"));
    assert(durabilityUsed === 0, "fully worn iron axe should fully recover with 2 materials");
  }

  {
    // 제작 레벨 골든값: XP 공식(재료 양·희귀도 가중)·레벨 곡선·다중 레벨업 이월·스탯 분배 정규화·세이브 마이그레이션
    const { craftXpForRecipe, craftXpForNextLevel, applyCraftXp, normalizeCraftStatAlloc, createCraftStatAlloc } = craftLevel;
    const { migrateSaveData } = saveMigration;
    const recipeCommon = { id: "x", name: "x", output: "wood_pickaxe", count: 1, ingredients: { wood: 3, stick: 2 } };
    const recipeRare = { id: "y", name: "y", output: "diamond_sword", count: 1, ingredients: { diamond: 2, stick: 1 } };
    const recipeBulk = { id: "z", name: "z", output: "stick", count: 4, ingredients: { wood: 1 } };
    assert(craftXpForRecipe(recipeCommon) === 13, `common recipe xp should be 13, got ${craftXpForRecipe(recipeCommon)}`);
    assert(craftXpForRecipe(recipeRare) === 23, `rare recipe xp should be 23 (rarity-weighted), got ${craftXpForRecipe(recipeRare)}`);
    assert(craftXpForRecipe(recipeBulk) === 14, `bulk output recipe xp should be 14, got ${craftXpForRecipe(recipeBulk)}`);
    assert(craftXpForRecipe(recipeRare) > craftXpForRecipe(recipeCommon), "rarer recipe should grant more craft xp");
    assert(craftXpForRecipe({ id: "t", name: "t", output: "wood", count: 1, ingredients: {} }) >= 5, "craft xp should floor at 5");
    const curve = [1, 2, 3, 4, 5].map(craftXpForNextLevel);
    assert(JSON.stringify(curve) === JSON.stringify([18, 44, 75, 109, 145]), `craft level curve golden mismatch: ${JSON.stringify(curve)}`);
    assert(curve.every((v, i) => i === 0 || v > curve[i - 1]), "craft level curve must be strictly increasing");
    const noLevel = applyCraftXp(1, 0, 14);
    assert(noLevel.craftLevel === 1 && noLevel.craftXp === 14 && noLevel.levelsGained === 0, "sub-threshold xp should not level up");
    const multi = applyCraftXp(1, 0, 200);
    assert(multi.craftLevel === 4 && multi.craftXp === 63 && multi.levelsGained === 3, `big xp should multi-level with carryover, got ${JSON.stringify(multi)}`);
    const carry = applyCraftXp(2, 40, 10); // L2 need 44 → 50 ≥44 → L3 (need 75), 6 carry
    assert(carry.craftLevel === 3 && carry.craftXp === 6 && carry.levelsGained === 1, `carryover xp should roll into next level, got ${JSON.stringify(carry)}`);
    const norm = normalizeCraftStatAlloc({ hp: -3, mana: 2.9, attack: Number.NaN, defense: 1 });
    assert(norm.hp === 0 && norm.mana === 2 && norm.attack === 0 && norm.defense === 1, `craft alloc should clamp/floor, got ${JSON.stringify(norm)}`);
    const fresh = createCraftStatAlloc();
    assert(fresh.hp === 0 && fresh.mana === 0 && fresh.attack === 0 && fresh.defense === 0, "fresh craft alloc should be all zero");
    const baseSave = { version: 10, player: { level: 3, playerClass: "warrior" } };
    const migratedFresh = migrateSaveData(baseSave);
    assert(migratedFresh.player.craftLevel === 1 && migratedFresh.player.craftExperience === 0 && migratedFresh.player.craftStatPoints === 0, "pre-craft save should default craft fields");
    assert(migratedFresh.player.craftStatAlloc.hp === 0 && migratedFresh.player.craftStatAlloc.defense === 0, "pre-craft save should default craft alloc to zero");
    const richSave = { version: 11, player: { level: 3, playerClass: "warrior", craftLevel: 5, craftExperience: 30, craftStatPoints: 2, craftStatAlloc: { hp: 4, mana: -1, attack: 2.6, defense: 1 } } };
    const migratedRich = migrateSaveData(richSave);
    assert(migratedRich.player.craftLevel === 5 && migratedRich.player.craftExperience === 30 && migratedRich.player.craftStatPoints === 2, "existing craft progress should survive migration");
    assert(migratedRich.player.craftStatAlloc.hp === 4 && migratedRich.player.craftStatAlloc.mana === 0 && migratedRich.player.craftStatAlloc.attack === 2, "craft alloc should be clamped/floored on migration");
  }

  {
    // 스킬바 골든: 직업별 두 슬롯(R 1차 / T 2차)의 이름·단축키·쿨타임·아이콘 + 쿨타임 독립성
    const { buildSkillSlots } = skillBar;
    const { PLAYER_CLASSES } = classes;
    const { SECOND_SKILLS } = classSkills;
    const CLASS_IDS = ["warrior", "healer", "mage", "summoner", "gunner", "tanker"];
    for (const id of CLASS_IDS) {
      const slots = buildSkillSlots(id, 0, 0);
      assert(slots.length === 2, `${id}: skill bar should have exactly 2 slots`);
      assert(slots[0].hotkey === "R" && slots[1].hotkey === "T", `${id}: slots should be R(primary)/T(second)`);
      assert(slots[0].name === PLAYER_CLASSES[id].skillName, `${id}: primary slot name should match PLAYER_CLASSES.skillName`);
      assert(slots[1].name === SECOND_SKILLS[id].name, `${id}: second slot name should match SECOND_SKILLS.name`);
      assert(slots[0].total === PLAYER_CLASSES[id].cooldown, `${id}: primary total should match class cooldown (${PLAYER_CLASSES[id].cooldown})`);
      assert(slots[1].total === SECOND_SKILLS[id].cooldown, `${id}: second total should match second-skill cooldown (${SECOND_SKILLS[id].cooldown})`);
      assert(typeof slots[0].icon === "string" && slots[0].icon.length > 0, `${id}: primary icon should be a non-empty emoji`);
      assert(typeof slots[1].icon === "string" && slots[1].icon.length > 0, `${id}: second icon should be a non-empty emoji`);
    }
    // 쿨타임 독립성: classUntil 만 바꿔도 second 슬롯 until 은 불변, 그 반대도 마찬가지
    const onlyPrimary = buildSkillSlots("warrior", 5_000, 0);
    assert(onlyPrimary[0].until === 5_000 && onlyPrimary[1].until === 0, "primary cooldown must not leak into the second slot");
    const onlySecond = buildSkillSlots("warrior", 0, 7_000);
    assert(onlySecond[0].until === 0 && onlySecond[1].until === 7_000, "second cooldown must not leak into the primary slot");
    const both = buildSkillSlots("healer", 1_111, 2_222);
    assert(both[0].until === 1_111 && both[1].until === 2_222, "each slot should carry its own independent until timestamp");
    // 아이콘이 직업/슬롯별로 구분되는지(전부 동일 문자열이 아님)
    const allIcons = CLASS_IDS.flatMap((id) => { const s = buildSkillSlots(id, 0, 0); return [s[0].icon, s[1].icon]; });
    assert(new Set(allIcons).size >= 6, "skill icons should be reasonably varied across classes/slots");
  }

  {
    // 저장 슬롯 무결성 (데이터 유실 회귀 가드): 덮어쓰기는 고른 슬롯만 새 저장으로 바꾸고
    // 나머지 슬롯은 그대로 보존해야 한다. 마법사 세이브가 묻지도 않고 사라진 사고의 재발 방지.
    const { writeSaveSlots, readSaveSlots, readStoredSlotList, createSaveSlot, writeLatestSave, backupLatestSave, formatSaveDate: fmt } = saveRepo;
    const { migrateSaveData } = saveMigration;
    const mockStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
    const mkSave = (lvl, cls, ms) => migrateSaveData({ version: 11, savedAt: `2026-06-1${ms}T00:00:0${ms}.000Z`, player: { level: lvl, playerClass: cls, position: { x: lvl, y: 1.7, z: ms } } });
    const opts = (storage) => ({ migrateSaveData, formatSaveDate: fmt, storage });
    const storage = mockStorage();
    const saves = [mkSave(30, "mage", 1), mkSave(29, "warrior", 2), mkSave(20, "healer", 3), mkSave(15, "gunner", 4), mkSave(10, "tanker", 5)];
    const slots = saves.map((s) => createSaveSlot(s, fmt));
    const storedCount = await writeSaveSlots(slots, storage);
    assert(storedCount === 5, `5 distinct saves should all persist, got ${storedCount}`);
    assert(readStoredSlotList(opts(storage)).length === 5, "readStoredSlotList should return all 5 named slots");

    // Finding A 가드: SAVE_KEY(latest)·SAVE_BACKUP 에 명명 슬롯과 다른 별개 저장이 있어도
    // (load 시 persistLatestSaveQuietly 가 만드는 상태) 덮어쓰기가 명명 슬롯을 잃지 않아야 한다.
    await writeLatestSave(mkSave(99, "summoner", 7), storage); // SAVE_KEY = 별개 저장 F
    backupLatestSave(storage); // SAVE_BACKUP = F 로 복제
    await writeLatestSave(mkSave(98, "tanker", 8), storage); // SAVE_KEY = 또다른 별개 G, BACKUP=F
    assert(readSaveSlots(opts(storage)).length >= 6, "merged read should include the distinct latest/backup (the trap)");
    assert(readStoredSlotList(opts(storage)).length === 5, "readStoredSlotList must ignore latest/backup and stay at 5 named slots");

    // 덮어쓰기(onOverwrite 로직 재현): 명명 목록을 id 로 교체 → 기록. 가운데(healer)만 Lv31 마법사로.
    const mageSavedAt = saves[0].savedAt, warriorSavedAt = saves[1].savedAt, gunnerSavedAt = saves[3].savedAt, tankerSavedAt = saves[4].savedAt;
    const replacedId = slots[2].id; // healer
    const newSave = mkSave(31, "mage", 6);
    const list = readStoredSlotList(opts(storage));
    const next = list.some((s) => s.id === replacedId) ? list.map((slot) => (slot.id === replacedId ? createSaveSlot(newSave, fmt) : slot)) : [createSaveSlot(newSave, fmt), ...list].slice(0, 5);
    await writeSaveSlots(next, storage);
    const after = readStoredSlotList(opts(storage));
    const afterTimes = after.map((s) => s.savedAt);
    assert(after.length === 5, `overwrite should keep named slot count at 5, got ${after.length}`);
    assert([mageSavedAt, warriorSavedAt, gunnerSavedAt, tankerSavedAt].every((t) => afterTimes.includes(t)), "overwriting one slot must preserve all OTHER named saves even with a distinct latest present (Finding A guard)");
    assert(afterTimes.includes(newSave.savedAt), "the chosen slot should hold the new save after overwrite");
    assert(!afterTimes.includes(saves[2].savedAt), "the explicitly chosen slot's old save should be the only one replaced");
  }

  {
    // 자동 백업 링: 닉네임당 최신 30개 유지 + 닉네임 격리 + 복구 가능 (세이브 유실 대비)
    const { appendSaveToHistory, readSaveHistory, resolveHistorySave } = saveRepo;
    const { migrateSaveData } = saveMigration;
    const histStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
    const mkH = (lvl, i) => migrateSaveData({ version: 11, savedAt: new Date(Date.UTC(2026, 5, 1, 0, 0, i)).toISOString(), player: { level: lvl, playerClass: "mage", position: { x: lvl, y: 1.7, z: i } } });
    for (let i = 1; i <= 35; i += 1) await appendSaveToHistory(mkH(i, i), "마법사씨", histStorage);
    const hist = readSaveHistory("마법사씨", histStorage);
    assert(hist.length === 30, `history should cap at 30 per nickname, got ${hist.length}`);
    assert(new Date(hist[0].savedAt).getTime() > new Date(hist[1].savedAt).getTime(), "history should be newest-first");
    assert(hist.some((e) => e.savedAt === mkH(35, 35).savedAt), "latest backup must be retained");
    assert(!hist.some((e) => e.savedAt === mkH(1, 1).savedAt), "oldest backup beyond 30 must be evicted");
    await appendSaveToHistory(mkH(99, 99), "전사씨", histStorage);
    assert(readSaveHistory("전사씨", histStorage).length === 1, "other nickname's history is isolated");
    assert(readSaveHistory("마법사씨", histStorage).length === 30, "appending to another nickname must not evict mine");
    const recovered = await resolveHistorySave(hist[0]);
    assert(recovered !== null && recovered.player.playerClass === "mage" && recovered.player.level === 35, "history entry should unpack back to the saved game for recovery");
  }

  {
    // 자동저장 슬롯: 별도 키에만 기록(수동 저장/최신본 절대 미덮어쓰기) + 닉네임당 최신 3개 롤링 + 동기 이탈저장 + 복구
    const { appendSaveToAutosave, appendAutosaveSync, readAutosaveSlots, resolveHistorySave } = saveRepo;
    const { migrateSaveData } = saveMigration;
    const AUTOSAVE_KEY = "ai-game-lab:wilderness-autosave-v1";
    const LIST_KEY = "ai-game-lab:wilderness-saves-v1";
    const LATEST_KEY = "ai-game-lab:wilderness-save-v1";
    const m = new Map();
    const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    // 수동 저장/최신본을 미리 채워두고, 자동저장이 이들을 절대 건드리지 않음을 검증한다.
    storage.setItem(LIST_KEY, '[{"sentinel":"manual-slot"}]');
    storage.setItem(LATEST_KEY, '{"sentinel":"latest"}');
    const mkA = (lvl, i) => migrateSaveData({ version: 11, savedAt: new Date(Date.UTC(2026, 5, 2, 0, 0, i)).toISOString(), player: { level: lvl, playerClass: "gunner", position: { x: lvl, y: 1.7, z: i } } });
    for (let i = 1; i <= 5; i += 1) await appendSaveToAutosave(mkA(i, i), "거너씨", storage);
    const auto = readAutosaveSlots("거너씨", storage);
    assert(auto.length === 3, `autosave should cap at 3 per nickname, got ${auto.length}`);
    assert(new Date(auto[0].savedAt).getTime() > new Date(auto[1].savedAt).getTime(), "autosave list should be newest-first");
    assert(auto.some((e) => e.savedAt === mkA(5, 5).savedAt) && !auto.some((e) => e.savedAt === mkA(1, 1).savedAt), "autosave keeps newest 3, evicts older");
    // 핵심 요구사항: 자동저장이 수동 슬롯/최신본 키를 절대 덮어쓰지 않는다.
    assert(storage.getItem(LIST_KEY) === '[{"sentinel":"manual-slot"}]', "autosave must NEVER touch SAVE_LIST_KEY (manual saves)");
    assert(storage.getItem(LATEST_KEY) === '{"sentinel":"latest"}', "autosave must NEVER touch SAVE_KEY (latest)");
    assert(storage.getItem(AUTOSAVE_KEY) !== null, "autosave writes its own dedicated key");
    // 동기 이탈 저장(beforeunload 경로): raw 저장, 즉시 읽기/복구 가능, 여전히 cap 3.
    appendAutosaveSync(mkA(6, 6), "거너씨", storage);
    const afterSync = readAutosaveSlots("거너씨", storage);
    assert(afterSync.length === 3 && afterSync[0].savedAt === mkA(6, 6).savedAt, "sync exit autosave is stored newest and respects the cap");
    const recovered = await resolveHistorySave(afterSync[0]);
    assert(recovered !== null && recovered.player.playerClass === "gunner" && recovered.player.level === 6, "autosave entry unpacks back for recovery");
    // 닉네임 격리.
    appendAutosaveSync(mkA(99, 99), "마법사씨", storage);
    assert(readAutosaveSlots("마법사씨", storage).length === 1, "autosave is isolated per nickname");
    assert(readAutosaveSlots("거너씨", storage).length === 3, "appending another nickname's autosave must not evict mine");
  }

  {
    // 네비게이션 가드: 우클릭 메뉴 전역 차단 + 뒤로가기 트랩(게임 중 흡수) + 이탈 자동저장 + uninstall
    const nav = await server.ssrLoadModule("/src/game/navigationGuard.ts");
    const makeTarget = () => {
      const listeners = new Map();
      return {
        addEventListener: (type, fn) => { const arr = listeners.get(type) ?? []; arr.push(fn); listeners.set(type, arr); },
        removeEventListener: (type, fn) => { listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)); },
        emit: (type, ev) => (listeners.get(type) ?? []).slice().forEach((f) => f(ev)),
        count: (type) => (listeners.get(type) ?? []).length,
      };
    };
    const win = makeTarget();
    const doc = makeTarget();
    const pushed = [];
    const backs = { n: 0 };
    const fakeWindow = { addEventListener: win.addEventListener, removeEventListener: win.removeEventListener, confirm: () => false };
    const fakeDocument = { addEventListener: doc.addEventListener, removeEventListener: doc.removeEventListener, visibilityState: "visible" };
    const saved = { window: globalThis.window, document: globalThis.document, history: globalThis.history, location: globalThis.location };
    globalThis.window = fakeWindow;
    globalThis.document = fakeDocument;
    globalThis.history = { pushState: (s) => pushed.push(s), back: () => { backs.n += 1; } };
    globalThis.location = { href: "http://test/" };
    try {
      let started = false;
      let autosaves = 0; // 동기 저장(이탈 직전)
      let asyncSaves = 0; // 비동기 저장(탭 전환 등)
      let blockedBacks = 0; // 흡수된 뒤로가기 횟수
      const handle = nav.installNavigationGuard({ getGameStarted: () => started, autosave: () => { asyncSaves += 1; }, autosaveSync: () => { autosaves += 1; }, onBlockedBack: () => { blockedBacks += 1; } });
      assert(pushed.length === 0, "guard does NOT push a trap at install (title-screen back stays normal)");
      let ctxPrevented = false;
      win.emit("contextmenu", { preventDefault: () => { ctxPrevented = true; } });
      assert(ctxPrevented, "contextmenu is always preventDefault'd (browser menu blocked)");
      win.emit("popstate", {});
      assert(pushed.length === 0 && blockedBacks === 0, "popstate at title (not started/armed) does NOT re-trap");
      started = true;
      handle.arm();
      assert(pushed.length === 1, "arm() on game entry pushes exactly one trap");
      handle.arm();
      assert(pushed.length === 1, "arm() is idempotent — single-trap invariant (no duplicate/leak)");
      win.emit("popstate", {});
      assert(pushed.length === 2 && blockedBacks === 1, "in-game back is absorbed: re-pushes trap + notifies onBlockedBack");
      assert(autosaves === 0 && backs.n === 0, "absorbed back neither autosaves nor leaves the page");
      let buPrevented = false;
      win.emit("beforeunload", { preventDefault: () => { buPrevented = true; }, returnValue: "" });
      assert(autosaves === 1 && buPrevented, "beforeunload in-game autosaves (sync) and blocks unload");
      win.emit("pagehide", {});
      assert(autosaves === 2, "pagehide in-game autosaves (sync)");
      fakeDocument.visibilityState = "hidden";
      doc.emit("visibilitychange", {});
      assert(asyncSaves === 1 && autosaves === 2, "visibilitychange:hidden uses async save (no sync jank on tab switch)");
      handle.disarm();
      assert(backs.n === 1, "disarm() removes our trap via one history.back()");
      win.emit("popstate", {});
      assert(pushed.length === 2 && blockedBacks === 1, "after disarm, back is no longer trapped (no re-push, no notify)");
      handle.uninstall();
      assert(win.count("contextmenu") === 0 && win.count("popstate") === 0 && doc.count("visibilitychange") === 0, "uninstall removes all listeners");
    } finally {
      globalThis.window = saved.window;
      globalThis.document = saved.document;
      globalThis.history = saved.history;
      globalThis.location = saved.location;
    }
  }

  {
    // 안전구역: 마을·훈련장 안=차단, 밖=허용; 안의 점은 경계로 밀려남(클램프); 보스 좌표는 모두 안전구역 밖
    const sz = await server.ssrLoadModule("/src/game/safeZones.ts");
    const { isInSafeZone, clampOutOfSafeZones, VILLAGE_CENTERS } = sz;
    assert(VILLAGE_CENTERS.length === 3, "3 village centers (single source of truth)");
    assert(isInSafeZone(58, -76) && isInSafeZone(245, 138) && isInSafeZone(58, 46), "village + training centers are safe zones");
    assert(!isInSafeZone(0, 0) && !isInSafeZone(500, 500), "far points are not safe zones");
    const p = { x: 60, z: -76 }; // 마을1(58,-76)에서 2칸 — 안쪽
    clampOutOfSafeZones(p);
    assert(!isInSafeZone(p.x, p.z), "clamped point is pushed out of every safe zone");
    const pushed = Math.hypot(p.x - 58, p.z + 76);
    assert(pushed >= 27.9 && pushed <= 28.1, `clamped to village safe radius ~28 (got ${pushed.toFixed(2)})`);
    const q = { x: 0, z: 0 };
    clampOutOfSafeZones(q);
    assert(q.x === 0 && q.z === 0, "point outside all safe zones is unchanged by clamp");
    const boss = await server.ssrLoadModule("/src/game/bossChapters.ts");
    const fb = await server.ssrLoadModule("/src/game/fieldBosses.ts");
    for (const s of boss.BOSS_PROGRESSION) assert(!isInSafeZone(s.position[0], s.position[1]), `chapter boss ${s.kind} must NOT be inside a safe zone (else it can't spawn)`);
    for (const f of fb.FIELD_BOSSES) assert(!isInSafeZone(f.position[0], f.position[1]), `field boss ${f.id} must NOT be inside a safe zone`);
  }

  {
    // 챕터 보스 드래곤 리스폰 쿨다운: 처치 직후엔 재스폰 안 하고(부재여도), 10분 경과 후 재등장
    const boss = await server.ssrLoadModule("/src/game/bossChapters.ts");
    const step = boss.BOSS_PROGRESSION[0];
    let spawned = 0, present = false, ready = true;
    const ctx = {
      locationMode: () => "overworld",
      worldMapId: () => step.mapId,
      hasDragonKind: () => present,
      respawnReady: () => ready,
      spawnDragon: () => { spawned += 1; present = true; return {}; },
      getGroundHeightAt: () => 0,
    };
    boss.ensureChapterBoss(ctx);
    assert(spawned === 1 && present, "chapter boss spawns when absent and respawn ready");
    boss.ensureChapterBoss(ctx);
    assert(spawned === 1, "no duplicate spawn while boss present");
    present = false; ready = false; // 처치됨 + 쿨다운 중
    boss.ensureChapterBoss(ctx);
    assert(spawned === 1, "killed boss does NOT instantly respawn during cooldown (was: full-HP respawn next frame)");
    ready = true; // 10분 경과
    boss.ensureChapterBoss(ctx);
    assert(spawned === 2 && present, "boss respawns only after the respawn cooldown elapses");
    assert(boss.DRAGON_RESPAWN_MS === 600000, "dragon respawn cooldown is 10 minutes");
  }

  {
    // 궁극 무기 3종: 각 카테고리 최상위 초과 + 발사 분류 + epic + 확장 제작대 레시피(재료 유효)
    const { ITEM_NAMES, ITEM_RARITY, WEAPON_DAMAGE, SHIELD_DEFENSE, SHIELD_DURABILITY, RANGED_WEAPONS, RANGED_PROJECTILE } = items;
    const recipes = await server.ssrLoadModule("/src/game/recipes.ts");
    const ids = ["sharp_obsidian_shield", "sharp_obsidian_staff", "sharp_obsidian_gun"];
    for (const id of ids) {
      assert(typeof ITEM_NAMES[id] === "string" && ITEM_NAMES[id].length > 0, `${id} must have a name`);
      assert(ITEM_RARITY[id] === "epic", `${id} must be epic`);
    }
    assert(SHIELD_DEFENSE.sharp_obsidian_shield > SHIELD_DEFENSE.iron_shield, "obsidian shield defense > iron");
    assert(SHIELD_DURABILITY.sharp_obsidian_shield > SHIELD_DURABILITY.iron_shield, "obsidian shield durability > iron");
    assert(WEAPON_DAMAGE.sharp_obsidian_shield > WEAPON_DAMAGE.iron_shield, "obsidian shield bash > iron");
    assert(WEAPON_DAMAGE.sharp_obsidian_staff > WEAPON_DAMAGE.arcane_staff, "obsidian staff dmg > arcane (top staff)");
    assert(RANGED_WEAPONS.has("sharp_obsidian_staff") && RANGED_PROJECTILE.sharp_obsidian_staff === "magic", "obsidian staff is ranged + fires magic");
    assert(WEAPON_DAMAGE.sharp_obsidian_gun > WEAPON_DAMAGE.rifle, "obsidian gun dmg > rifle (top gun)");
    assert(RANGED_WEAPONS.has("sharp_obsidian_gun") && RANGED_PROJECTILE.sharp_obsidian_gun === undefined, "obsidian gun is ranged + fires arrow (not magic)");
    for (const id of ids) {
      const r = [...recipes.WORKBENCH_RECIPES].find((x) => x.id === id);
      assert(r && r.output === id && r.extendedOnly === true, `${id} craftable at extended workbench`);
      for (const ing of Object.keys(r.ingredients)) assert(typeof ITEM_NAMES[ing] === "string", `${id} ingredient ${ing} is a known item`);
    }
  }

  {
    // 맵 진입 게이트: 레벨 미달이어도 직전 맵 보스를 처치하면 다음 맵이 열린다.
    const { WORLD_MAPS, canTeleportToWorldMap, getWorldMapById } = worldMaps;
    const dragonPlains = getWorldMapById("dragon_plains"); // 권장 Lv 10~25, 직전 = starter_valley
    const bamboo = getWorldMapById("bamboo_frontier"); // Lv 15~30, 직전 = dragon_plains
    assert(canTeleportToWorldMap(1, getWorldMapById("starter_valley")) === true, "starter valley always accessible");
    // Lv 1 은 dragon_plains(min10) 까지 레벨 격차 9 ≤ 20 이라 원래도 열림 — 격차가 큰 맵으로 검증
    const farMap = WORLD_MAPS.find((m) => m.levelRange[0] - 1 > 20); // Lv1 기준 격차 20 초과인 첫 맵
    assert(farMap, "should have at least one map far above level 1");
    assert(canTeleportToWorldMap(1, farMap) === false, `far map ${farMap.id} should be locked at Lv1 without boss`);
    // 그 far 맵의 직전 맵 보스를 처치하면 열려야 한다
    const farIndex = WORLD_MAPS.findIndex((m) => m.id === farMap.id);
    const prevBossId = `boss_${WORLD_MAPS[farIndex - 1].id}`;
    assert(canTeleportToWorldMap(1, farMap, [prevBossId]) === true, `defeating ${prevBossId} should unlock ${farMap.id} regardless of level`);
    // 직전이 아닌 보스로는 안 열린다 (한 맵만 건너뜀)
    assert(canTeleportToWorldMap(1, farMap, ["boss_starter_valley"]) === false || farIndex === 1, "unlock only applies to the immediate predecessor's boss");
    // dragon_plains 직전(starter) 보스 처치 시 dragon_plains 열림(레벨 무관)
    assert(canTeleportToWorldMap(1, dragonPlains, ["boss_starter_valley"]) === true, "starter boss unlocks dragon_plains");
    void bamboo;
  }

  {
    // Firebase 진행도 발행: users/{닉}.json 에 PATCH(merge), 값 정수화, 닉네임 없으면 skip, 오류 시 false
    const { publishProgress } = await server.ssrLoadModule("/src/game/progressSync.ts");
    let captured = null;
    const mockFetch = async (url, opts) => { captured = { url, opts }; return { ok: true }; };
    const ok = await publishProgress("마법사씨", { level: 31, cls: "mage", steps: 24578.9, playSeconds: 3661.7 }, mockFetch);
    assert(ok === true, "publishProgress returns true on ok response");
    assert(captured.url.includes("/users/") && captured.url.endsWith(".json"), `progress should PATCH users/{nick}.json, got ${captured.url}`);
    const seg = decodeURIComponent(captured.url.split("/users/")[1].replace(/\.json$/, ""));
    assert(seg === "마법사씨", `nickname should be url-encoded in path, decoded=${seg}`);
    assert(captured.opts.method === "PATCH", "progress must use PATCH (merge — preserves online/lastSeen)");
    const sent = JSON.parse(captured.opts.body);
    assert(sent.level === 31 && sent.class === "mage" && sent.steps === 24578 && sent.playSeconds === 3661, `progress body should floor/key correctly: ${captured.opts.body}`);
    assert(typeof sent.progressAt === "number", "progress should include progressAt timestamp");
    const skipped = await publishProgress("", { level: 1, cls: "warrior", steps: 0, playSeconds: 0 }, mockFetch);
    assert(skipped === false, "publishProgress should skip when nickname is empty");
    const onError = await publishProgress("x", { level: 1, cls: "warrior", steps: 0, playSeconds: 0 }, async () => { throw new Error("network"); });
    assert(onError === false, "publishProgress should swallow network errors and return false");
  }

  {
    // 보물상자 4등급: 추첨 경계(74/20/5/1) + 고급 상자일수록 희귀 전리품
    const { rollChestTier, rollChestLoot, chestTierName } = await server.ssrLoadModule("/src/game/chestLoot.ts");
    const { itemRarity } = items;
    assert(rollChestTier(() => 0.005) === 3, "r<0.01 → 흑요석(3)");
    assert(rollChestTier(() => 0.03) === 2, "r<0.06 → 다이아(2)");
    assert(rollChestTier(() => 0.15) === 1, "r<0.26 → 황금(1)");
    assert(rollChestTier(() => 0.5) === 0, "그 외 → 일반(0)");
    assert(chestTierName(0) === "일반 상자" && chestTierName(3) === "흑요석 상자", "등급 이름 매핑");
    const allRng = () => 0; // 모든 chance 통과, 수량=최소, pick=첫 항목
    const idsOf = (t) => new Set(rollChestLoot(t, allRng).map((e) => e.item));
    const t0 = idsOf(0), t1 = idsOf(1), t2 = idsOf(2), t3 = idsOf(3);
    assert(!["diamond", "obsidian", "dragon_scale", "diamond_sword", "obsidian_sword"].some((i) => t0.has(i)), "일반 상자엔 희귀 전리품이 없어야 한다");
    assert(t1.has("gold"), "황금 상자엔 금 재료");
    assert(t2.has("diamond"), "다이아몬드 상자엔 다이아몬드");
    assert(t3.has("obsidian") && t3.has("dragon_scale"), "흑요석 상자엔 흑요석 + 드래곤 재료");
    const rareCount = (s) => [...s].filter((i) => itemRarity(i) !== "common").length;
    assert(rareCount(t0) === 0, "일반 상자 전리품은 모두 common");
    assert(rareCount(t3) >= 3, `흑요석 상자는 rare/epic 다수여야 한다 (got ${rareCount(t3)})`);
    assert(rareCount(t3) >= rareCount(t2) && rareCount(t2) >= rareCount(t1) && rareCount(t1) >= rareCount(t0), "등급이 오를수록 희귀 전리품 수가 비감소");
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
        "monsters hold attacks while a panel is open",
        "attack motion windup/lunge perceptibility golden values",
        "designed stat overrides for hound and viper",
        "xp bottle grants 15 levels and is consumed",
        "incoming damage floor and progressive monster attack scaling",
        "finale fireworks, fanfare, and single credits roll",
        "field boss spawn-once, quest view, and mini fanfare",
        "tool repair material mapping and 50% recovery golden values",
        "home base storage transfer and supply tier golden values",
        "party invite code format/normalization and protocol message roundtrip",
        "gear tier visuals: monotonic progression, diamond<obsidian, low matte / high glow+gem, tierOf/armorTierOf mapping",
        "death drop: keep held weapon + equipped armor/shield + protected items; drop the rest",
        "party chat: message roundtrip + whisper parse (/w, @, unknown/self/empty rejected, length clamp)",
        "quest reward claim (Q/click): completed tutorial grants once, idempotent, non-tutorial rejected",
        "party presence: send cadence, same-map avatar spawn/lerp, cross-map markers, stale prune",
        "social directory: like search, friend request/accept persistence, offline rejection, party invite delivery",
        "party join flow: indoor-host wait notice, summon on emergence, reset clears stale summons",
        "party summon flow runs on guest sessions only (host never pulled)",
        "party world sync: host snapshots, guest diff/lerp, attack intercept, host-authoritative kills, shared xp/loot/boss, mobHit, stray-mob sweep",
        "party 6th: village guard sync — collect/spawnGuard/guest-attack enrage+iron/kill share",
        "party 7th: cave/chest sync — collect/spawn, host-authoritative chest open (single loot to opener)",
        "party 5.1: attack broadcast, party heal send/receive/map-guard, player push-out collision",
        "nickname validation (length/charset/profanity/reserved/duplicate) and one-time immutability",
        "training ground difficulty curves, rewards, and clamps",
        "skill damage scales with level bonus",
        "second skill table covers all classes with designed names",
        "second skill execution: fireball, burning strike+dot, burning shield aura, healing rain, rapid fire",
        "predators face the player while chasing (+X-front yaw)",
        "hit feedback: hit stop, knockback, squash punch, fov kick, tone layers",
        "tutorial step completion latches across condition regression",
        "craft level: xp formula (rarity-weighted), increasing curve, multi-level carryover, alloc clamp, save migration defaults/preserve",
        "skill bar: per-class R/T slots (name/hotkey/total/icon match defs) + independent primary/second cooldown timestamps",
        "save slots: overwrite replaces only the chosen slot and preserves all other saves (data-loss regression guard)",
        "world map gating: level gap OR predecessor field-boss defeat unlocks the next map",
        "save history ring: 30-per-nickname cap, nickname isolation, recover via unpack",
        "autosave slot: dedicated key (never touches manual saves/latest), 3-per-nickname rolling cap, sync exit-save, recover, nickname isolation",
        "navigation guard: global contextmenu block, single-trap back absorb (no install/title trap, arm/disarm, onBlockedBack), beforeunload/pagehide sync + visibilitychange async autosave, uninstall",
        "progress publish: PATCH users/{nick}.json (merge), integer-floored fields, skip/error-safe",
        "treasure chest tiers: roll boundaries (74/20/5/1) + higher tier = rarer loot (monotonic)",
        "ultimate weapons: sharp obsidian shield/staff/gun exceed top of category, correct ranged/projectile class, epic, extended-workbench recipes with valid ingredients",
        "chapter boss respawn: killed dragon does not instantly respawn; re-spawns only after 10-minute cooldown",
        "safe zones: villages + training block monster spawn (isInSafeZone) and movement (clampOutOfSafeZones pushes to boundary); all boss coords clear of safe zones",
      ],
    }, null, 2));
  }
} finally {
  await server.close();
}
