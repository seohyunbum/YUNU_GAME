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
  const trading = await server.ssrLoadModule("/src/game/trading.ts");

  const { ITEM_NAMES, WEAPON_DAMAGE } = items;
  const { MINI_RECIPES, WORKBENCH_RECIPES } = recipes;
  const { PLAYER_CLASSES } = classes;
  const { POINT_SHOP_OFFERS, TRADE_OFFERS, BLACKSMITH_TRADE_OFFERS } = trading;

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
  }

  // 3. 무기: WEAPON_DAMAGE 키가 이름을 갖고 데미지 >= 1
  for (const [id, dmg] of Object.entries(WEAPON_DAMAGE)) {
    if (!isItem(id)) problems.push(`weapon '${id}': no ITEM_NAMES entry`);
    if (!(typeof dmg === "number" && dmg >= 1)) problems.push(`weapon '${id}': damage ${dmg} < 1`);
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
      checks: ["recipe items exist", "class starter/skill valid", "weapons named", "trade/shop items exist"],
    }, null, 2));
  }
} finally {
  await server.close();
}
