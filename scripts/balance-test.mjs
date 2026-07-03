// 밸런스 도달가능성 테스트 (AGENTS.md P0) — "보스를 의도 레벨에서 잡을 수 있는가"를 기계가 검증.
// 데미지 공식의 armor gap(<=-20 => 0) 때문에, 무기/스킬 수치를 잘못 내리면 보스가 무적이 된다.
// ÷10 같은 변경이 최종 보스를 무적으로 만드는 사고를 자동으로 잡는다.
import { createServer } from "vite";

const FALLBACK_LEVEL = 60; // MONSTER_DEFS 에 의도 레벨이 없는 보스의 안전 기본값

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const problems = [];

try {
  const combat = await server.ssrLoadModule("/src/game/combat.ts");
  const monsters = await server.ssrLoadModule("/src/game/monsters.ts");
  const items = await server.ssrLoadModule("/src/game/items.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");

  const { calculateCombatDamage } = combat;
  const { BOSS_STATS, MONSTER_DEFS } = monsters;
  const { WEAPON_DAMAGE } = items;
  const { GUNNER_SKILL_DAMAGE, MAGE_TNT_DAMAGE, WARRIOR_EXPLOSION_DAMAGE } = constants;

  // 각 보스의 "의도 레벨" — 챕터 보스는 Lv60(용)~300(불멸)로 단계가 넓어, 전부 Lv60 기준으로 재던 종전 모델은
  // 후반 보스 방어 상향을 전부 UNKILLABLE 오탐했다. MONSTER_DEFS 의 bossKind→level 로 보스별 기준 레벨을 잡는다.
  const intendedLevelByBossKind = {};
  for (const def of Object.values(MONSTER_DEFS)) if (def.bossKind) intendedLevelByBossKind[def.bossKind] = def.level;

  const maxWeapon = Math.max(...Object.values(WEAPON_DAMAGE));
  const bestSkill = Math.max(GUNNER_SKILL_DAMAGE, MAGE_TNT_DAMAGE, WARRIOR_EXPLOSION_DAMAGE);

  for (const [bossKind, boss] of Object.entries(BOSS_STATS)) {
    const refLevel = intendedLevelByBossKind[bossKind] ?? FALLBACK_LEVEL;
    const bestWeaponAttack = maxWeapon + (refLevel - 1); // levelStatBonus = level - 1 (전직·훈련·장비 보너스 제외한 보수적 하한)
    const weaponDmg = calculateCombatDamage(bestWeaponAttack, boss.armor);
    const skillDmg = calculateCombatDamage(bestSkill + (refLevel - 1), boss.armor); // 스킬도 레벨 보너스를 받는다(classSkills 의 levelBonus 가산)
    const best = Math.max(weaponDmg, skillDmg);
    if (best <= 0) {
      problems.push(
        `boss '${boss.name}' (armor ${boss.armor}) is UNKILLABLE at intended Lv${refLevel}: best weapon=${bestWeaponAttack}->${weaponDmg} dmg, best skill=${bestSkill + (refLevel - 1)}->${skillDmg} dmg (need attack > ${boss.armor - 20})`,
      );
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`BALANCE ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, checks: ["every boss damageable at its intended level (MONSTER_DEFS bossKind→level)"] }, null, 2));
  }
} finally {
  await server.close();
}
