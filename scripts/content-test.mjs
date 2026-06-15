// 콘텐츠 불변식 테스트 (AGENTS.md P0) — 데이터 일관성을 기계가 강제한다.
// "레시피 재료가 실존하는가", "클래스 시작장비가 실존하는가" 같은 누락을 typecheck 가
// 못 잡는 자리에서 잡는다. 브라우저 불필요 (vite ssrLoadModule) → verify 에 포함.
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const problems = [];

try {
  const items = await server.ssrLoadModule("/src/game/items.ts");
  const recipes = await server.ssrLoadModule("/src/game/recipes.ts");
  const classes = await server.ssrLoadModule("/src/game/classes.ts");
  const classPassives = await server.ssrLoadModule("/src/game/classPassives.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const monsters = await server.ssrLoadModule("/src/game/monsters.ts");
  const regions = await server.ssrLoadModule("/src/game/regions.ts");
  const trading = await server.ssrLoadModule("/src/game/trading.ts");
  const recipeGuide = await server.ssrLoadModule("/src/game/recipeGuide.ts");
  const worldMaps = await server.ssrLoadModule("/src/game/worldMaps.ts");
  const worldData = await server.ssrLoadModule("/src/game/worldData.ts");
  const objectives = await server.ssrLoadModule("/src/objectives.ts");
  const bossChapters = await server.ssrLoadModule("/src/game/bossChapters.ts");
  const fieldBosses = await server.ssrLoadModule("/src/game/fieldBosses.ts");

  const { DURABLE_TOOL_TABLES, HEAL_ITEMS, ITEM_NAMES, SHIELD_DEFENSE, SHIELD_DURABILITY, WEAPON_DAMAGE, repairMaterialFor, repairPerMaterial, toolMaxDurability } = items;
  const { MINI_RECIPES, WORKBENCH_RECIPES } = recipes;
  const { PLAYER_CLASSES } = classes;
  const { CLASS_PASSIVES, summonerPetDamage, experienceForNextPetLevel } = classPassives;
  const { HUNGER_HP_REGEN, HUNGER_MAX } = constants;
  const { BOSS_STATS, MONSTER_DEFS, isPredatorMonster } = monsters;
  const { BOSS_PROGRESSION, FINAL_BOSS_CHAPTER } = bossChapters;
  const { REGIONS } = regions;
  const { POINT_SHOP_OFFERS, TRADE_OFFERS, BLACKSMITH_TRADE_OFFERS } = trading;
  const { buildRecipeGuideEntries, buildRecipeGuideEntriesForStations } = recipeGuide;
  const { WORLD_MAPS, DEFAULT_WORLD_MAP_ID, regionsForWorldMap, canTeleportToWorldMap } = worldMaps;
  const { biomesForWorldMap, waterZonesForWorldMap } = worldData;
  const { TUTORIAL_STEPS } = objectives;

  const isItem = (id) => Object.prototype.hasOwnProperty.call(ITEM_NAMES, id);

  // 1. 레시피: 재료·산출물이 실존 아이템인가
  for (const r of [...MINI_RECIPES, ...WORKBENCH_RECIPES]) {
    if (!isItem(r.output)) problems.push(`recipe '${r.id}': output '${r.output}' is not a known item`);
    for (const ing of Object.keys(r.ingredients)) {
      if (!isItem(ing)) problems.push(`recipe '${r.id}': ingredient '${ing}' is not a known item`);
    }
  }

  // 2. 클래스: 시작장비 실존 + 스킬 수치 유효 (새 직업 누락 방지)
  for (const [id, c] of Object.entries(PLAYER_CLASSES)) {
    if (!isItem(c.starterItem)) problems.push(`class '${id}': starterItem '${c.starterItem}' is not a known item`);
    if (!(typeof c.manaCost === "number" && c.manaCost >= 0)) problems.push(`class '${id}': invalid manaCost`);
    if (!(typeof c.cooldown === "number" && c.cooldown > 0)) problems.push(`class '${id}': invalid cooldown`);
    if (!c.name || !c.skillName) problems.push(`class '${id}': missing name/skillName`);

    const passive = CLASS_PASSIVES[id];
    if (!passive) {
      problems.push(`class '${id}': missing passive`);
    } else {
      if (!passive.label || !passive.summary) problems.push(`class '${id}': passive missing label/summary`);
      if (!(typeof passive.armorBonus === "number" && passive.armorBonus >= 0)) problems.push(`class '${id}': invalid armorBonus`);
      if (!(typeof passive.rangedCooldownScale === "number" && passive.rangedCooldownScale > 0)) problems.push(`class '${id}': invalid rangedCooldownScale`);
      if (!(typeof passive.manaRegenScale === "number" && passive.manaRegenScale > 0)) problems.push(`class '${id}': invalid manaRegenScale`);
      if (!(typeof passive.healthRegenPerSec === "number" && passive.healthRegenPerSec >= 0)) problems.push(`class '${id}': invalid healthRegenPerSec`);
    }
  }

  const summonerPet = CLASS_PASSIVES.summoner?.pet;
  if (!summonerPet) {
    problems.push("summoner: missing passive pet");
  } else {
    const shareTotal = summonerPet.playerXpShare + summonerPet.petXpShare;
    if (Math.abs(shareTotal - 1) > 0.0001) problems.push(`summoner pet: xp shares total ${shareTotal}, expected 1`);
    if (summonerPet.baseDamage !== 2) problems.push(`summoner pet: baseDamage ${summonerPet.baseDamage}, expected 2`);
    if (summonerPet.attackInterval <= 0 || summonerPet.attackRange <= 0) problems.push("summoner pet: invalid attack timing/range");
    if (
      !(summonerPet.flightAhead > 0 && summonerPet.flightSide > 0 && Number.isFinite(summonerPet.flightRise))
    ) {
      problems.push("summoner pet: invalid flight screen placement");
    }
    if (summonerPetDamage({ level: 1, experience: 0 }) !== 2) problems.push("summoner pet: level 1 damage should be 2");
    if (experienceForNextPetLevel(1) <= 0) problems.push("summoner pet: next level xp should be positive");
  }

  if (!Array.isArray(HUNGER_HP_REGEN)) {
    problems.push("hunger regen: table should be an array");
  } else {
    if (HUNGER_HP_REGEN.length !== HUNGER_MAX + 1) {
      problems.push(`hunger regen: table length ${HUNGER_HP_REGEN.length}, expected ${HUNGER_MAX + 1}`);
    }
    if (HUNGER_HP_REGEN[0] !== 0 || HUNGER_HP_REGEN[1] !== 0) {
      problems.push("hunger regen: hunger 0 and 1 should not heal");
    }
    for (const [level, regen] of HUNGER_HP_REGEN.entries()) {
      if (!(typeof regen === "number" && regen >= 0)) problems.push(`hunger regen: level ${level} invalid value ${regen}`);
      if (level > 0 && regen < HUNGER_HP_REGEN[level - 1]) {
        problems.push(`hunger regen: level ${level} is lower than previous level`);
      }
    }
  }

  // 3. 무기: WEAPON_DAMAGE 키가 이름을 갖고 데미지 >= 1
  for (const [id, dmg] of Object.entries(WEAPON_DAMAGE)) {
    if (!isItem(id)) problems.push(`weapon '${id}': no ITEM_NAMES entry`);
    if (!(typeof dmg === "number" && dmg >= 1)) problems.push(`weapon '${id}': damage ${dmg} < 1`);
  }

  for (const [id, defense] of Object.entries(SHIELD_DEFENSE)) {
    if (!isItem(id)) problems.push(`shield '${id}': no ITEM_NAMES entry`);
    if (!(typeof defense === "number" && defense > 0)) problems.push(`shield '${id}': defense ${defense} <= 0`);
    const durability = SHIELD_DURABILITY[id];
    if (!(typeof durability === "number" && durability > 0)) problems.push(`shield '${id}': invalid durability ${durability}`);
  }

  for (const [id, heal] of Object.entries(HEAL_ITEMS)) {
    if (!isItem(id)) problems.push(`heal item '${id}': no ITEM_NAMES entry`);
    if (!(typeof heal === "number" && heal > 0)) problems.push(`heal item '${id}': heal ${heal} <= 0`);
  }

  const guide = buildRecipeGuideEntries({ wood: 3, hammer: 1, iron: 1, stone: 1, obsidian: 1 });
  if (!guide.some((entry) => entry.id.endsWith(":crafting_table") && entry.canMake)) {
    problems.push("recipe guide: crafting_table should be visible and craftable from wood 3 + hammer 1");
  }
  if (!guide.some((entry) => entry.id.includes(":mirror") && entry.station.includes("확장 제작대"))) {
    problems.push("recipe guide: extended-only recipes should show the extended workbench station");
  }
  if (!guide.some((entry) => entry.id.includes("smelt_iron") && entry.station.includes("제련대"))) {
    problems.push("recipe guide: smelter conversions should be listed");
  }
  if (!guide.some((entry) => entry.id.includes("smelt_obsidian") && entry.station.includes("특수 제련대"))) {
    problems.push("recipe guide: special smelter obsidian conversion should be listed");
  }
  if (!guide.some((entry) => entry.id.includes("grind_stone") && entry.station.includes("분쇄기"))) {
    problems.push("recipe guide: grinder conversions should be listed");
  }
  const miniGuide = buildRecipeGuideEntriesForStations({ wood: 3, hammer: 1 }, ["mini"]);
  if (!miniGuide.every((entry) => entry.stationKey === "mini")) problems.push("recipe guide: mini filter should only list mini recipes");
  if (!miniGuide.some((entry) => entry.id === "mini:crafting_table" && entry.canMake)) problems.push("recipe guide: mini filter should directly craft crafting_table");

  if (!Array.isArray(TUTORIAL_STEPS) || TUTORIAL_STEPS.length < 8) problems.push("tutorial: expected a multi-step early-game guide");
  const tutorialIds = new Set();
  let previousRewardExperience = 0;
  for (const step of TUTORIAL_STEPS) {
    if (!step.id || tutorialIds.has(step.id)) problems.push(`tutorial: invalid or duplicate step id '${step.id}'`);
    tutorialIds.add(step.id);
    if (!step.reward || !(step.reward.experience >= 0) || !step.reward.label) problems.push(`tutorial '${step.id}': invalid reward`);
    for (const item of Object.keys(step.reward.items ?? {})) if (!isItem(item)) problems.push(`tutorial '${step.id}': unknown reward item '${item}'`);
    // 보상 점증 불변식: 뒤 퀘스트일수록 경험치 보상이 같거나 커야 한다
    if (step.reward.experience < previousRewardExperience) {
      problems.push(`tutorial '${step.id}': reward experience ${step.reward.experience} dropped below previous step (${previousRewardExperience})`);
    }
    previousRewardExperience = step.reward.experience;
    if (!step.reward.label.includes(`경험치 ${step.reward.experience}`)) {
      problems.push(`tutorial '${step.id}': reward label does not match experience ${step.reward.experience}`);
    }
  }

  for (const region of REGIONS) {
    if (!region.id || !region.name) problems.push("region: missing id/name");
    if (!(region.radius > 0 && region.level > 0 && region.lootTier >= 1)) problems.push(`region '${region.id}': invalid radius/level/lootTier`);
    let predatorCount = 0;
    for (const entry of region.monsters) {
      if (!MONSTER_DEFS[entry.id]) problems.push(`region '${region.id}': unknown monster '${entry.id}'`);
      if (!(entry.weight > 0)) problems.push(`region '${region.id}': monster '${entry.id}' has invalid weight`);
      if (MONSTER_DEFS[entry.id] && isPredatorMonster(entry.id)) predatorCount += 1;
    }
    if (predatorCount <= 0) problems.push(`region '${region.id}': needs at least one predator-spawnable monster`);
  }

  if (!WORLD_MAPS.some((map) => map.id === DEFAULT_WORLD_MAP_ID)) problems.push("world maps: missing default map");
  for (const map of WORLD_MAPS) {
    const activeRegions = regionsForWorldMap(map.id);
    if (activeRegions.length <= 0) problems.push(`world map '${map.id}': needs at least one active region`);
    if (!canTeleportToWorldMap(map.levelRange[0], map)) problems.push(`world map '${map.id}': should be reachable at its minimum level`);
    if (biomesForWorldMap(map.id).length <= 0) problems.push(`world map '${map.id}': needs themed biome data`);
    if (waterZonesForWorldMap(map.id).length <= 0) problems.push(`world map '${map.id}': needs water-zone data`);
    for (const region of activeRegions) {
      if (!REGIONS.some((candidate) => candidate.id === region.id)) problems.push(`world map '${map.id}': unknown region '${region.id}'`);
    }
  }

  // 필드 보스: 최종맵 제외 모든 맵에 정확히 1마리, 맵 최대 레벨 스탯, 유효한 베이스 몬스터/보상
  {
    const { FIELD_BOSSES } = fieldBosses;
    let previousReward = 0;
    for (const map of WORLD_MAPS) {
      const defs = FIELD_BOSSES.filter((def) => def.mapId === map.id);
      if (map.id === "dragon_lands") {
        if (defs.length !== 0) problems.push("field boss: dragon_lands must not have a field boss");
        continue;
      }
      if (defs.length !== 1) problems.push(`field boss: map '${map.id}' should have exactly one boss (got ${defs.length})`);
    }
    for (const def of [...FIELD_BOSSES].sort((a, b) => a.level - b.level)) {
      const map = WORLD_MAPS.find((candidate) => candidate.id === def.mapId);
      if (!map) {
        problems.push(`field boss '${def.id}': unknown map '${def.mapId}'`);
        continue;
      }
      if (def.level !== map.levelRange[1] + 8) problems.push(`field boss '${def.id}': level ${def.level} should equal map max + 8 = ${map.levelRange[1] + 8}`);
      if (!MONSTER_DEFS[def.monsterId] || !MONSTER_DEFS[def.monsterId].predatorKind) problems.push(`field boss '${def.id}': base monster '${def.monsterId}' must be a predator`);
      for (const item of Object.keys(def.rewardItems)) if (!isItem(item)) problems.push(`field boss '${def.id}': unknown reward item '${item}'`);
      if (def.rewardExperience < previousReward) problems.push(`field boss '${def.id}': reward should escalate with level`);
      previousReward = def.rewardExperience;
      if (!def.rewardLabel.includes(`경험치 ${def.rewardExperience}`)) problems.push(`field boss '${def.id}': reward label mismatch`);
    }
  }

  // 내 집 보급 상자: 모든 레벨 구간의 보상이 실존 아이템이어야 한다
  {
    const homeBase = await server.ssrLoadModule("/src/game/homeBase.ts");
    for (const level of [1, 15, 30, 55, 85, 130]) {
      for (const reward of homeBase.rollHomeSupply(level, () => 0.01)) {
        if (!isItem(reward.item)) problems.push(`home supply (level ${level}): unknown item '${reward.item}'`);
        if (!(reward.count > 0)) problems.push(`home supply (level ${level}): non-positive count for '${reward.item}'`);
      }
    }
  }

  // 수리 시스템: 모든 내구도 도구는 실존하는 수리 재료를 반환하고, 회복량은 양수여야 한다
  for (const table of DURABLE_TOOL_TABLES) {
    for (const tool of Object.keys(table)) {
      const material = repairMaterialFor(tool);
      if (!material) problems.push(`repair: durable tool '${tool}' has no repair material`);
      else if (!isItem(material)) problems.push(`repair: tool '${tool}' repair material '${material}' is not a known item`);
      if (!(repairPerMaterial(tool) > 0)) problems.push(`repair: tool '${tool}' repair amount must be positive`);
      if (repairPerMaterial(tool) * 2 < toolMaxDurability(tool)) problems.push(`repair: tool '${tool}' should fully repair within 2 materials`);
    }
  }
  if (repairMaterialFor("iron_sword") !== null) problems.push("repair: combat weapons have no durability and must not be repairable");

  // 경험치병은 치트(F4) 전용: 제작 레시피·상점·거래 어디에도 나오면 안 된다
  if ([...MINI_RECIPES, ...WORKBENCH_RECIPES].some((r) => r.output === "xp_bottle")) {
    problems.push("xp_bottle: must not be craftable (cheat-only item)");
  }
  for (const o of [...TRADE_OFFERS, ...BLACKSMITH_TRADE_OFFERS, ...POINT_SHOP_OFFERS]) {
    if (Object.keys(o.receive ?? {}).includes("xp_bottle")) problems.push(`xp_bottle: must not be obtainable from '${o.id}' (cheat-only item)`);
  }

  // 아이템 5단계 등급(itemTier): 모든 아이템이 유효 등급으로 분류되고, 앵커 아이템 등급이 기준과 일치
  {
    const { itemTier, ITEM_TIER } = items;
    const TIERS = ["common", "uncommon", "rare", "epic", "legendary"];
    for (const id of Object.keys(ITEM_NAMES)) {
      if (!TIERS.includes(itemTier(id))) problems.push(`itemTier('${id}') = ${itemTier(id)} is not a valid tier`);
    }
    for (const id of Object.keys(ITEM_TIER)) {
      if (!isItem(id)) problems.push(`ITEM_TIER has unknown item '${id}'`);
      if (id !== undefined && itemTier(id) === "common") problems.push(`ITEM_TIER['${id}'] should not resolve to common (listed = non-common)`);
    }
    const anchors = { wood: "common", meat: "common", iron: "uncommon", gold: "rare", diamond: "rare", dragon_horn: "epic", obsidian_sword: "epic", sharp_obsidian_staff: "legendary", sharp_obsidian_gun: "legendary", sharp_obsidian_shield: "legendary", xp_bottle: "legendary" };
    for (const [id, tier] of Object.entries(anchors)) {
      if (itemTier(id) !== tier) problems.push(`itemTier('${id}') = ${itemTier(id)}, expected ${tier}`);
    }
    // 레전더리 = 최종 흑요석 무기 3종 + 경험치병
    const legendary = Object.keys(ITEM_NAMES).filter((id) => itemTier(id) === "legendary").sort();
    const expectedLegendary = ["sharp_obsidian_gun", "sharp_obsidian_shield", "sharp_obsidian_staff", "xp_bottle"];
    if (JSON.stringify(legendary) !== JSON.stringify(expectedLegendary)) problems.push(`legendary set mismatch: ${JSON.stringify(legendary)}`);
    // 에픽·레전더리 무기 공격력 상향(기본 ×1.3 반올림) — 최고등급 위상 보장
    const boosted = { obsidian_dagger: 7, obsidian_sword: 13, arcane_staff: 12, sharp_obsidian_staff: 16, sharp_obsidian_gun: 14, sharp_obsidian_shield: 10 };
    for (const [id, dmg] of Object.entries(boosted)) {
      if (WEAPON_DAMAGE[id] !== dmg) problems.push(`weapon boost: ${id} damage ${WEAPON_DAMAGE[id]}, expected ${dmg}`);
      if (itemTier(id) !== "epic" && itemTier(id) !== "legendary") problems.push(`weapon boost: ${id} should be epic/legendary, got ${itemTier(id)}`);
    }
    // 등급 서열: 에픽 무기 > 직전 희귀, 레전더리 > 에픽
    if (!(WEAPON_DAMAGE.obsidian_sword > WEAPON_DAMAGE.diamond_sword)) problems.push("obsidian_sword should exceed diamond_sword");
    if (!(WEAPON_DAMAGE.arcane_staff > WEAPON_DAMAGE.crystal_staff)) problems.push("arcane_staff should exceed crystal_staff");
    if (!(WEAPON_DAMAGE.sharp_obsidian_staff > WEAPON_DAMAGE.arcane_staff)) problems.push("legendary staff should exceed epic arcane_staff");
    if (!(WEAPON_DAMAGE.sharp_obsidian_gun > WEAPON_DAMAGE.rifle)) problems.push("legendary gun should exceed rifle");
  }

  // 보스 챕터 진행표: 모든 보스를 정확히 1회씩 포함 + 챕터/권장레벨 단조 증가
  const bossKinds = Object.keys(BOSS_STATS);
  if (BOSS_PROGRESSION.length !== bossKinds.length) {
    problems.push(`boss progression: covers ${BOSS_PROGRESSION.length} bosses, expected ${bossKinds.length}`);
  }
  const seenBossKinds = new Set();
  for (const [index, step] of BOSS_PROGRESSION.entries()) {
    if (!BOSS_STATS[step.kind]) problems.push(`boss progression: unknown boss '${step.kind}'`);
    if (seenBossKinds.has(step.kind)) problems.push(`boss progression: duplicate boss '${step.kind}'`);
    seenBossKinds.add(step.kind);
    if (step.chapter !== index + 1) problems.push(`boss progression: '${step.kind}' chapter ${step.chapter}, expected ${index + 1}`);
    if (!(step.recommendedLevel > 0)) problems.push(`boss progression: '${step.kind}' invalid recommendedLevel`);
    if (index > 0 && step.recommendedLevel <= BOSS_PROGRESSION[index - 1].recommendedLevel) {
      problems.push(`boss progression: '${step.kind}' recommendedLevel should rise past the previous chapter`);
    }
  }
  if (FINAL_BOSS_CHAPTER !== BOSS_PROGRESSION.length) problems.push("boss progression: FINAL_BOSS_CHAPTER mismatch");
  // 도달성 불변식: 권장 레벨에서 그 보스의 맵으로 실제 텔레포트가 가능해야 한다
  for (const step of BOSS_PROGRESSION) {
    const map = WORLD_MAPS.find((candidate) => candidate.id === step.mapId);
    if (!map) {
      problems.push(`boss progression: '${step.kind}' references unknown map '${step.mapId}'`);
      continue;
    }
    if (!canTeleportToWorldMap(step.recommendedLevel, map)) {
      problems.push(`boss progression: '${step.kind}' recommended level ${step.recommendedLevel} cannot reach map '${step.mapId}' (gate Lv ${map.levelRange[0] - 20})`);
    }
  }

  // 4. 거래/상점: 주고받는 아이템이 실존 + 상점 가격 > 0
  for (const o of [...TRADE_OFFERS, ...BLACKSMITH_TRADE_OFFERS]) {
    for (const id of [...Object.keys(o.give), ...Object.keys(o.receive)]) {
      if (!isItem(id)) problems.push(`trade '${o.id}': '${id}' is not a known item`);
    }
  }
  for (const o of POINT_SHOP_OFFERS) {
    for (const id of Object.keys(o.receive)) if (!isItem(id)) problems.push(`shop '${o.id}': '${id}' is not a known item`);
    if (!(o.cost > 0)) problems.push(`shop '${o.id}': cost ${o.cost} <= 0`);
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`CONTENT ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      ok: true,
      checks: ["recipe items exist", "recipe guide searchable", "tutorial steps valid", "class starter/skill/passive valid", "hunger regen table valid", "weapons/shields/heal items named", "regions/monsters valid", "world maps valid", "boss progression valid", "field bosses valid", "trade/shop items exist"],
    }, null, 2));
  }
} finally {
  await server.close();
}
