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
  const THREE = await import("three");

  const { EAGLE_CLAW_COOLDOWN, EAGLE_CLAW_DAMAGE, EAGLE_RAM_DAMAGE, HUNGER_HP_REGEN, HUNGER_MAX, IRON_GUARD_ARMOR, IRON_GUARD_DURATION_SECONDS, MANA_REGEN_PER_SECOND, NIGHT_PREDATOR_MAX_COUNT, RANGED_ATTACK_COOLDOWN, TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST, WIND_CUTTER_COOLDOWN, WIND_CUTTER_DAMAGE } = constants;
  const { HEAL_ITEMS, SHIELD_DEFENSE, SHIELD_DURABILITY, WEAPON_DAMAGE } = items;
  const { CLASS_PASSIVES, DEFAULT_SUMMONER_PET_PROGRESS, summonerPetDamage } = classPassives;
  const { PLAYER_CLASSES } = classes;
  const { calculateCombatDamage, calculateIncomingPlayerDamage } = combat;
  const { useHotbarItem } = hotbarUse;
  const { canReceiveRecipeOutput } = inventoryCapacity;
  const { shouldFireRangedDuringInteract } = interactionPriority;
  const { BOSS_STATS, isPredatorMonster, predatorStatsForMonster } = monsters;
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
    // 변종 몬스터 공격 계수 0.65
    assert(predatorStatsForMonster("red_wolf").attackDamage === 24, `red wolf attack should scale at 0.65/level (got ${predatorStatsForMonster("red_wolf").attackDamage})`);
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
      hasSmelter: false, bossChapter: 0, fieldBossQuest: null,
      completedStepIds: progress.completedStepIds, achievedStepIds: progress.achievedStepIds,
    });
    latchAchievedObjectives(progress, makeSnapshot(true));
    assert(progress.achievedStepIds.includes("place_workbench"), "placing the workbench should latch the step as achieved");
    const afterPickup = currentObjective(makeSnapshot(false));
    assert(afterPickup.id === "place_workbench" && afterPickup.completed === true, "picking the workbench back up must not un-complete the quest");
    assert(claimTutorialObjective(progress, afterPickup) !== null, "latched quest should remain claimable for its reward");
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
    assert(spawned.hp === 216 && spawned.armor === 24 && spawned.attackDamage === 13, `field boss should use boss-formula stats for Lv 18 (hp ${spawned.hp}, armor ${spawned.armor}, atk ${spawned.attackDamage})`);
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
    const fakeSession = { onPresences: (cb) => { presencesCb = cb; }, sendPresence: (data) => sent.push(data) };
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
        getObject: (id) => objects.get(id),
        removeObject: (id) => { objects.delete(id); events.push(["remove", id]); },
        removeObjectSilent: (id) => { objects.delete(id); events.push(["removeSilent", id]); },
        hitFeedback: (target, damage, killed) => events.push(["hit", target.id, damage, killed]),
        showMessage: (text) => events.push(["msg", text]),
        gainExperience: (amount) => events.push(["xp", amount]),
        creditHostKill: (target) => events.push(["credit", target.id]),
        rollLoot: (item, count) => { events.push(["loot", item, count]); return count; },
        recordFieldBossDefeat: (id) => events.push(["bossDefeat", id]),
        damageLocalPlayer: (amount, name) => { events.push(["playerHit", amount, name]); return state.nextPlayerHitKills; },
        animateWalkCycle: () => {},
        refreshSpatialObject: () => {},
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
    const { TRAINING_MIN_LEVEL, TRAINING_REWARDS, TRAINING_GAMES, normalizeTrainingStats, liftDrainPerSecond, liftClickPower, targetSpeed, targetWobble, targetTolerance, blockWindowMs, blockFakeChance, calmZoneRatio } = training;
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
    assert(calls.some(([kind, k, visual, damage]) => kind === "projectile" && k === "tnt" && visual === "magic" && damage === 61), "fireball should fire a magic-visual tnt projectile with scaled damage");

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
    assert(low.some((reward) => reward.item === "meat" && reward.count === 2), "level 1 supply should give 2 meat");
    assert(!low.some((reward) => reward.item === "iron"), "level 1 supply should not give iron");
    const mid = rollHomeSupply(30, noBonus);
    assert(mid.some((reward) => reward.item === "iron"), "level 30 supply should add iron");
    const top = rollHomeSupply(100, noBonus);
    assert(top.some((reward) => reward.item === "diamond" && reward.count === 2), "level 100 supply should add diamonds");
    assert(top.some((reward) => reward.item === "obsidian"), "level 100 supply should add obsidian");
    const bonus = rollHomeSupply(100, () => 0.01);
    assert(bonus.length === top.length + 1, "supply bonus line should appear on a lucky roll");
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
        "party presence: send cadence, same-map avatar spawn/lerp, cross-map markers, stale prune",
        "social directory: like search, friend request/accept persistence, offline rejection, party invite delivery",
        "party join flow: indoor-host wait notice, summon on emergence, reset clears stale summons",
        "party summon flow runs on guest sessions only (host never pulled)",
        "party world sync: host snapshots, guest diff/lerp, attack intercept, host-authoritative kills, shared xp/loot/boss, mobHit",
        "nickname validation (length/charset/profanity/reserved/duplicate) and one-time immutability",
        "training ground difficulty curves, rewards, and clamps",
        "skill damage scales with level bonus",
        "second skill table covers all classes with designed names",
        "second skill execution: fireball, burning strike+dot, burning shield aura, healing rain, rapid fire",
        "predators face the player while chasing (+X-front yaw)",
        "hit feedback: hit stop, knockback, squash punch, fov kick, tone layers",
        "tutorial step completion latches across condition regression",
      ],
    }, null, 2));
  }
} finally {
  await server.close();
}
