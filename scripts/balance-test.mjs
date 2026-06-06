// 밸런스 도달가능성 테스트 (AGENTS.md P0) — "보스를 의도 레벨에서 잡을 수 있는가"를 기계가 검증.
// 데미지 공식의 armor gap(<=-20 => 0) 때문에, 무기/스킬 수치를 잘못 내리면 보스가 무적이 된다.
// ÷10 같은 변경이 최종 보스를 무적으로 만드는 사고를 자동으로 잡는다.
import { createServer } from "vite";

const REF_LEVEL = 60; // 최종 보스 의도 레벨 (docs/boss-chapter-economy-balance.md)

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const problems = [];

try {
  const combat = await server.ssrLoadModule("/src/game/combat.ts");
  const monsters = await server.ssrLoadModule("/src/game/monsters.ts");
  const items = await server.ssrLoadModule("/src/game/items.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");

  const { calculateCombatDamage } = combat;
  const { BOSS_STATS } = monsters;
  const { WEAPON_DAMAGE } = items;
  const { GUNNER_SKILL_DAMAGE, MAGE_TNT_DAMAGE, WARRIOR_EXPLOSION_DAMAGE } = constants;

  const levelBonus = REF_LEVEL - 1; // levelStatBonus = level - 1
  const bestWeaponAttack = Math.max(...Object.values(WEAPON_DAMAGE)) + levelBonus;
  const bestSkill = Math.max(GUNNER_SKILL_DAMAGE, MAGE_TNT_DAMAGE, WARRIOR_EXPLOSION_DAMAGE);

  for (const boss of Object.values(BOSS_STATS)) {
    const weaponDmg = calculateCombatDamage(bestWeaponAttack, boss.armor);
    const skillDmg = calculateCombatDamage(bestSkill, boss.armor); // 스킬은 고정값(레벨 보너스 미적용)
    const best = Math.max(weaponDmg, skillDmg);
    if (best <= 0) {
      problems.push(
        `boss '${boss.name}' (armor ${boss.armor}) is UNKILLABLE: best weapon@L${REF_LEVEL}=${bestWeaponAttack}->${weaponDmg} dmg, best skill=${bestSkill}->${skillDmg} dmg (need attack > ${boss.armor - 20})`,
      );
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`BALANCE ✗ ${p}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, checks: [`every boss damageable at level ${REF_LEVEL}`] }, null, 2));
  }
} finally {
  await server.close();
}
