// 마석 시스템 — 골든/불변식 테스트 (illia-test 패턴: vite ssrLoadModule).
//   1) id 파싱 왕복 + 종류/등급 인식
//   2) 버프 합산 — 등급 단조 증가, 종류별 올바른 스탯 누적, pct/flat 구분
//   3) 슬롯 해금 비용 곡선 — 기본 2칸 무료, 이후 증가, 최대 14
//   4) 정규화 — 잠긴 칸 null, 비마석 제거, 길이 14 고정
//   5) 조합 — 하위→상위, 최상위는 null
//   6) 아이템 엔트리 전량(24) + 이름 규칙
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const rune = await server.ssrLoadModule("/src/game/runeStones.ts");

  // ── 1) id 파싱 왕복 ──
  for (const type of rune.RUNE_TYPES) {
    for (const tier of [1, 2, 3, 4]) {
      const id = rune.runeItemId(type, tier);
      assert.equal(rune.isRuneStone(id), true, `${id} 마석 인식`);
      assert.equal(rune.runeTypeOf(id), type);
      assert.equal(rune.runeTierOf(id), tier);
    }
  }
  assert.equal(rune.isRuneStone("rune_key"), false, "열쇠는 마석 아님");
  assert.equal(rune.isRuneStone("diamond"), false);
  assert.equal(rune.isRuneStone("rune_strength_t5"), false, "5등급 없음");
  assert.equal(rune.runeTypeOf("nonsense"), null);

  // ── 2) 버프 합산 ──
  for (const type of rune.RUNE_TYPES) {
    const v1 = rune.runeStoneValue(rune.runeItemId(type, 1));
    const v4 = rune.runeStoneValue(rune.runeItemId(type, 4));
    assert.ok(v4 > v1, `${type} 등급 높을수록 강함`);
  }
  // 힘 마석 3개(T1,T2,T4) 장착 → attack 만 누적, 나머지 0
  const eq = new Array(14).fill(null);
  eq[0] = rune.runeItemId("strength", 1);
  eq[1] = rune.runeItemId("strength", 4);
  const b = rune.aggregateRuneBonuses(eq);
  assert.equal(b.attack, rune.runeStoneValue(eq[0]) + rune.runeStoneValue(eq[1]), "힘 합산");
  assert.equal(b.defense, 0);
  assert.equal(b.maxHp, 0);
  assert.equal(b.movePct, 0);
  // 신속·경험은 pct 누적(소수), flat 은 정수
  const eq2 = new Array(14).fill(null);
  eq2[0] = rune.runeItemId("haste", 2);
  eq2[1] = rune.runeItemId("experience", 3);
  eq2[2] = rune.runeItemId("vitality", 4);
  const b2 = rune.aggregateRuneBonuses(eq2);
  assert.ok(b2.movePct > 0 && b2.movePct < 1, "신속 pct 비율");
  assert.ok(b2.xpPct > 0, "경험 pct");
  assert.ok(Number.isInteger(b2.maxHp) && b2.maxHp > 0, "활력 flat 정수");
  // 빈 장착 = 무버프
  assert.deepEqual(rune.aggregateRuneBonuses(new Array(14).fill(null)), rune.NO_RUNE_BONUSES);

  // ── 3) 슬롯 해금 비용 ──
  assert.equal(rune.runeKeysToUnlockSlot(0), 0);
  assert.equal(rune.runeKeysToUnlockSlot(1), 0, "기본 2칸 무료");
  assert.equal(rune.runeKeysToUnlockSlot(2), 1, "3번째 = 1개");
  assert.equal(rune.runeKeysToUnlockSlot(13), 12, "14번째 = 12개");
  // 다음 해금 비용 = 현재 해금 수의 index 비용
  assert.equal(rune.runeNextUnlockCost(2), 1, "2칸 열려 있음 → 다음(3번째) 1개");
  assert.equal(rune.runeNextUnlockCost(13), 12);
  assert.equal(rune.runeNextUnlockCost(14), null, "최대면 더 못 엶");
  // 비용 곡선 단조 증가
  for (let i = 3; i <= 13; i += 1) assert.ok(rune.runeKeysToUnlockSlot(i) > rune.runeKeysToUnlockSlot(i - 1), "단조 증가");
  // 완전 해금 총합 = 78
  let total = 0;
  for (let i = 2; i <= 13; i += 1) total += rune.runeKeysToUnlockSlot(i);
  assert.equal(total, 78, "완전 해금 78개");
  assert.equal(rune.clampRuneSlotCount(0), 2, "하한 2");
  assert.equal(rune.clampRuneSlotCount(99), 14, "상한 14");
  assert.equal(rune.clampRuneSlotCount(NaN), 2);

  // ── 4) 정규화 ──
  const raw = new Array(14).fill(null);
  raw[0] = rune.runeItemId("strength", 1);
  raw[5] = rune.runeItemId("haste", 2); // 잠긴 칸(슬롯 3까지만 열림)
  raw[1] = "diamond"; // 비마석
  const norm = rune.normalizeEquippedRunes(raw, 3);
  assert.equal(norm.length, 14, "길이 14 고정");
  assert.equal(norm[0], rune.runeItemId("strength", 1), "열린 칸 유지");
  assert.equal(norm[1], null, "비마석 제거");
  assert.equal(norm[5], null, "잠긴 칸 비움");
  assert.deepEqual(rune.normalizeEquippedRunes(undefined, 2), new Array(14).fill(null), "undefined 안전");

  // ── 5) 조합 ──
  assert.equal(rune.runeCombineOutput("strength", 1), rune.runeItemId("strength", 2));
  assert.equal(rune.runeCombineOutput("haste", 3), rune.runeItemId("haste", 4));
  assert.equal(rune.runeCombineOutput("guard", 4), null, "최상위는 조합 불가");
  assert.equal(rune.RUNE_COMBINE_COST, 3);

  // ── 6) 아이템 엔트리 ──
  const entries = rune.allRuneStoneEntries();
  assert.equal(entries.length, 24, "6종 × 4등급");
  assert.equal(entries[0].name, "힘의 마석결정");
  assert.ok(entries.every((e) => rune.isRuneStone(e.id) && e.name.includes("의 ")), "이름 규칙");
  const uniq = new Set(entries.map((e) => e.id));
  assert.equal(uniq.size, 24, "id 중복 없음");

  // ── 7) 세이브 마이그레이션 왕복 — runeSlots·equippedRunes 보존 + 구세이브(필드 없음) 안전 기본값 ──
  const migration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");
  const baseSave = { version: constants.SAVE_VERSION, player: { runeSlots: 7, equippedRunes: (() => { const a = new Array(14).fill(null); a[0] = rune.runeItemId("strength", 2); a[3] = rune.runeItemId("haste", 4); a[9] = rune.runeItemId("guard", 1); return a; })() } };
  const migrated = migration.migrateSaveData(baseSave);
  assert.equal(migrated.player.runeSlots, 7, "해금 슬롯 수 보존");
  assert.equal(migrated.player.equippedRunes.length, 14, "장착 배열 길이 14");
  assert.equal(migrated.player.equippedRunes[0], rune.runeItemId("strength", 2), "열린 슬롯 장착 보존");
  assert.equal(migrated.player.equippedRunes[3], rune.runeItemId("haste", 4));
  assert.equal(migrated.player.equippedRunes[9], null, "슬롯 수(7) 밖의 장착은 제거");
  // 구세이브(필드 없음) → 기본 2슬롯·장착 없음
  const legacy = migration.migrateSaveData({ version: constants.SAVE_VERSION, player: {} });
  assert.equal(legacy.player.runeSlots, rune.RUNE_BASE_SLOTS, "구세이브 기본 2슬롯");
  assert.deepEqual(legacy.player.equippedRunes, new Array(14).fill(null), "구세이브 장착 없음");

  console.log("✓ rune-stones-test: id 파싱 · 버프 합산 · 슬롯 해금 곡선 · 정규화 · 조합 · 엔트리 · 세이브 왕복 전량 통과");
} finally {
  await server.close();
}
