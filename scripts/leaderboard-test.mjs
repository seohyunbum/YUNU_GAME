// 요새 글로벌 랭킹 — 난이도별(쉬움/어려움) 분리 + 레거시 호환 + 발행 필드 검증.
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const { publishProgress, fetchFortressLeaderboards } = await server.ssrLoadModule("/src/game/progressSync.ts");

  // publishProgress 는 쉬움·어려움 단계/베이스를 모두 PATCH 로 보낸다.
  let captured = null;
  const captureFetch = async (_url, init) => { captured = JSON.parse(init.body); return { ok: true }; };
  const ok = await publishProgress("Tester", {
    level: 30, cls: "warrior", steps: 100, playSeconds: 60,
    bestFortressStage: 7, baseLevel: 20, bestFortressStageHard: 4, baseLevelHard: 35,
    kills: 50, training: {},
  }, captureFetch);
  assert.equal(ok, true);
  assert.equal(captured.fortressStage, 7, "쉬움 단계 발행");
  assert.equal(captured.fortressBase, 20, "쉬움 baseLevel 발행");
  assert.equal(captured.fortressStageHard, 4, "어려움 단계 발행");
  assert.equal(captured.fortressBaseHard, 35, "어려움 baseLevel 발행");

  // fetchFortressLeaderboards — 난이도별 분리 + 레거시(fortressStage 만) = 쉬움.
  const users = {
    Alice: { fortressStage: 10, fortressBase: 25, kills: 200 }, // 레거시/쉬움 전용
    Bob: { fortressStage: 5, fortressBase: 18, fortressStageHard: 8, fortressBaseHard: 40, kills: 100 },
    Cara: { fortressStageHard: 12, fortressBaseHard: 50, kills: 10 }, // 어려움 전용
    Dan: { level: 40 }, // 요새 기록 없음 → 양쪽 제외
  };
  const boardFetch = async () => ({ ok: true, json: async () => users });
  const { easy, hard } = await fetchFortressLeaderboards("Bob", 3, boardFetch);

  // 쉬움: Alice(10) > Bob(5). Cara/Dan 제외.
  assert.deepEqual(easy.top.map((e) => e.nickname), ["Alice", "Bob"], "쉬움 랭킹 순서");
  assert.equal(easy.top[0].stage, 10);
  assert.equal(easy.top[0].baseLevel, 25);
  assert.equal(easy.total, 2);
  assert.equal(easy.myRank, 2, "Bob 의 쉬움 순위 2위");

  // 어려움: Cara(12) > Bob(8). Alice(어려움 0)/Dan 제외.
  assert.deepEqual(hard.top.map((e) => e.nickname), ["Cara", "Bob"], "어려움 랭킹 순서");
  assert.equal(hard.top[0].stage, 12);
  assert.equal(hard.top[0].baseLevel, 50);
  assert.equal(hard.total, 2);
  assert.equal(hard.myRank, 2, "Bob 의 어려움 순위 2위");

  // 레거시 전용 유저(Alice)는 어려움 랭킹에 없다.
  assert.equal(hard.top.find((e) => e.nickname === "Alice"), undefined, "레거시 쉬움 기록은 어려움에 안 섞임");

  console.log("leaderboard-test: OK");
} finally {
  await server.close();
}
