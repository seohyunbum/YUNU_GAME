// Firebase DB 규칙 ↔ 클라이언트 계약 검사 — database.rules.json(정본)이 실제 쓰기 경로·필드와 맞물리는지 정적으로 대조한다.
// 규칙에 없는 필드를 하나라도 보내면 새 규칙에서 진행도 발행 전체가 조용히 거부되므로(부가 기능이라 오류 표시 없음),
// 필드·경로 목록은 손으로 적지 않고 publishProgress 가 실제로 보내는 본문과 firebaseDirectory.ts 의 경로 문자열에서 뽑는다.
// 규칙 의미론(허용/거부) 실측은 게시 후 '틀린 ETag(if-match)' 무기록 시험으로 한다 — docs/party-system.md §9 DB 규칙.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const rules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules;
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

// 경로 → 규칙 노드. 동적 세그먼트(${...})는 와일드카드($키)로, 고정 세그먼트는 같은 이름(없으면 와일드카드)으로 내려간다.
function ruleNodeFor(path) {
  let node = rules;
  const trail = [];
  for (const segment of path.split("/")) {
    const wildcard = Object.keys(node).find((key) => key.startsWith("$"));
    const next = !segment.startsWith("${") && Object.hasOwn(node, segment) ? segment : wildcard;
    assert.ok(next, `규칙에 경로 없음: ${path} (막힌 곳: /${[...trail, segment].join("/")})`);
    trail.push(next);
    node = node[next];
  }
  return node;
}

function walk(node, path, visit) {
  visit(node, path);
  for (const [key, child] of Object.entries(node)) {
    if (!key.startsWith(".") && child && typeof child === "object") walk(child, `${path}/${key}`, visit);
  }
}

function bounds(validate) {
  const lo = validate.match(/newData\.val\(\) >= (\d+)/);
  const hi = validate.match(/newData\.val\(\) <= (\d+)/);
  return { lo: lo ? Number(lo[1]) : -Infinity, hi: hi ? Number(hi[1]) : Infinity };
}

try {
  const { FIREBASE_CONFIG } = await server.ssrLoadModule("/src/onlineConfig.ts");
  const { publishProgress } = await server.ssrLoadModule("/src/game/progressSync.ts");
  const { TRAINING_KINDS } = await server.ssrLoadModule("/src/game/training.ts");
  const { NICKNAME_MAX_LENGTH } = await server.ssrLoadModule("/src/game/nickname.ts");
  const { PARTY_CODE_LENGTH, generatePartyCode } = await server.ssrLoadModule("/src/game/party.ts");
  const { BALANCE_TUNABLES } = await server.ssrLoadModule("/src/game/balanceTuning.ts");

  // 1. 기본 거부 + 읽기 공개 범위(게임이 실제로 읽는 곳만) + admins 잠금 + 최상위 통째 쓰기 금지
  assert.equal(rules[".read"], false, "루트 읽기 거부");
  assert.equal(rules[".write"], false, "루트 쓰기 거부");
  assert.equal(rules.users[".read"], true, "랭킹·친구 명부·전역 밸런스는 users 공개 읽기에 의존");
  assert.equal(rules.friends[".read"], true, "운영 리포트가 friends 전체를 읽는다");
  assert.equal(rules.inbox.$nick[".read"], true, "수신자는 자기 inbox 를 구독한다");
  assert.equal(rules.inbox[".read"], undefined, "inbox 전체 목록은 읽기 금지");
  assert.deepEqual(rules.admins, { ".read": false, ".write": false }, "admins 는 콘솔에서만 관리");
  for (const top of ["users", "friends", "inbox"]) assert.equal(rules[top][".write"], undefined, `${top} 통째 쓰기 금지`);

  // 2. 모든 쓰기 규칙은 로그인(익명 포함) 필수
  let writeRules = 0;
  walk(rules, "", (node, path) => {
    if (!(".write" in node) || node[".write"] === false) return;
    writeRules += 1;
    assert.match(String(node[".write"]), /^auth != null && /, `${path || "/"} 의 .write 는 로그인 필수`);
  });
  assert.ok(writeRules >= 6, `쓰기 규칙 수 확인(${writeRules})`);

  // 3. users/{닉} — 통째 삭제 금지, 모르는 필드 거부, 닉네임 상한 수용
  const nick = rules.users.$nick;
  assert.match(nick[".write"], /newData\.exists\(\)/, "users/{닉} 통째 삭제 금지");
  const nickMax = Number(nick[".write"].match(/\$nick\.length <= (\d+)/)?.[1]);
  assert.ok(nickMax >= NICKNAME_MAX_LENGTH, `규칙 닉네임 상한(${nickMax}) 은 게임 상한(${NICKNAME_MAX_LENGTH}) 이상`);
  assert.equal(nick.$other?.[".validate"], false, "users/{닉} 의 모르는 필드 거부");

  // 4. publishProgress 가 실제로 보내는 필드 ⊆ 규칙 필드(타입·범위 포함) + ID 토큰 부착
  const fullProgress = {
    level: 118, cls: "samurai", steps: 55122.7, playSeconds: 11594.2,
    bestFortressStage: 10, baseLevel: 18, bestFortressStageHard: 7, baseLevelHard: 10,
    kills: 1858, training: Object.fromEntries(TRAINING_KINDS.map((kind) => [kind, { stage: 12, tries: 30 }])),
  };
  let sent = null;
  let sentUrl = "";
  const ok = await publishProgress("규칙검사", fullProgress, async (url, init) => { sentUrl = url; sent = JSON.parse(init.body); return { ok: true }; }, async () => "tok/en+=");
  assert.equal(ok, true);
  assert.ok(sentUrl.endsWith(`/users/${encodeURIComponent("규칙검사")}.json?auth=${encodeURIComponent("tok/en+=")}`), `ID 토큰을 ?auth= 로 붙인다: ${sentUrl}`);
  for (const [key, value] of Object.entries(sent)) {
    const rule = nick[key];
    assert.ok(rule, `progressSync 가 보내는 users/{닉}/${key} 가 규칙에 없다 → 새 규칙에서 발행 전체 거부`);
    const validate = rule[".validate"] ?? "";
    if (typeof value === "number") {
      assert.match(validate, /newData\.isNumber\(\)/, `${key} 는 숫자 검사`);
      const { lo, hi } = bounds(validate);
      assert.ok(value >= lo && value <= hi, `${key}=${value} 가 규칙 범위 [${lo}, ${hi}] 밖`);
    } else if (typeof value === "string") {
      assert.match(validate, /newData\.isString\(\)/, `${key} 는 문자열 검사`);
    } else {
      assert.equal(key, "training", `객체 필드는 training 뿐: ${key}`);
    }
  }
  const kindRule = nick.training.$kind;
  const ruleKinds = [...kindRule[".validate"].matchAll(/\$kind === '([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(ruleKinds, [...TRAINING_KINDS].sort(), "규칙의 훈련 종목 = TRAINING_KINDS(빠진 종목·낡은 종목 모두 실패)");
  for (const [field, value] of Object.entries(sent.training[TRAINING_KINDS[0]])) {
    assert.ok(kindRule[field], `training/{종목}/${field} 규칙 없음`);
    const { lo, hi } = bounds(kindRule[field][".validate"]);
    assert.ok(value >= lo && value <= hi, `training.${field}=${value} 가 규칙 범위 밖`);
  }
  let plainUrl = "";
  await publishProgress("x", fullProgress, async (url) => { plainUrl = url; return { ok: true }; });
  assert.ok(plainUrl.endsWith(".json"), `토큰이 없으면(Node 기본값) ?auth= 없이 요청: ${plainUrl}`);

  // 5. 디렉터리(SDK)가 다루는 모든 경로가 규칙으로 해석되고, 연결 전에 익명 로그인한다
  const directorySource = readFileSync("src/game/firebaseDirectory.ts", "utf8");
  const paths = [...directorySource.matchAll(/`((?:users|friends|inbox)\/[^`]*)`/g)].map((match) => match[1]);
  assert.ok(paths.length >= 10, `디렉터리 경로 추출 실패(${paths.length}개)`);
  for (const path of paths) ruleNodeFor(path);
  for (const key of ["online", "lastSeen"]) assert.ok(nick[key], `디렉터리가 쓰는 users/{닉}/${key} 규칙 없음`);
  const authAt = directorySource.indexOf("await ensureAnonymousAuth(");
  assert.ok(authAt > 0 && authAt < directorySource.indexOf("getDatabase("), "디렉터리는 DB 연결 전에 익명 로그인한다");

  // 6. friends = true 추가만 / inbox 항목 = 쓰기·삭제(받은 쪽이 처리 후 지움) / 초대 코드 형식 수용
  const friendRule = rules.friends.$nick.$other;
  assert.match(friendRule[".write"], /newData\.exists\(\)/, "친구 관계 삭제 금지");
  assert.equal(friendRule[".validate"], "newData.val() === true", "친구 값은 true 만");
  const inbox = rules.inbox.$nick;
  for (const box of ["friendRequests", "friendAccepted", "partyInvites"]) {
    const item = Object.entries(inbox[box]).find(([key]) => key.startsWith("$"))[1];
    assert.doesNotMatch(item[".write"], /newData\.exists\(\)/, `inbox/${box} 항목은 삭제 가능해야 한다(수신자가 처리 후 지움)`);
  }
  const codeRule = inbox.partyInvites.$from.code[".validate"];
  const [, codeMin, codeMax] = codeRule.match(/length >= (\d+) && newData\.val\(\)\.length <= (\d+)/).map(Number);
  assert.ok(PARTY_CODE_LENGTH >= codeMin && PARTY_CODE_LENGTH <= codeMax, `초대 코드 길이 ${PARTY_CODE_LENGTH} 가 규칙 [${codeMin}, ${codeMax}] 밖`);
  assert.equal(generatePartyCode().length, PARTY_CODE_LENGTH);

  // 7. 전역 밸런스 = 관리자만·숫자만 / 게임에는 쓰기 경로 없음 / 관리자 페이지 쓰기는 모두 ID 토큰
  const balance = rules.users.__balance__;
  assert.equal(balance[".write"], "auth != null && root.child('admins').child(auth.uid).val() === true", "전역 밸런스 쓰기 = admins 등록 신원만");
  assert.match(balance.global.$key[".validate"], /newData\.isNumber\(\)/);
  assert.equal(balance.$other[".validate"], false);
  for (const tunable of BALANCE_TUNABLES) assert.doesNotMatch(tunable.key, /[.#$/[\]]/, `튜너블 키 ${tunable.key} 는 Firebase 키로 쓸 수 없다`);
  assert.doesNotMatch(readFileSync("src/game/balanceTuning.ts", "utf8"), /method:\s*"(PUT|PATCH|POST|DELETE)"/, "게임 클라이언트는 전역 밸런스를 쓰지 않는다");
  const adminHtml = readFileSync("admin/balance-admin.html", "utf8");
  assert.match(adminHtml, /accounts:signUp/, "관리자 페이지는 익명 로그인으로 관리자 ID 를 만든다");
  assert.equal((adminHtml.match(/fetch\(authedUrl\(/g) ?? []).length, 3, "관리자 페이지 쓰기 3곳(권한 확인·전체 적용·초기화)은 ID 토큰을 붙인다");
  assert.doesNotMatch(adminHtml, /fetch\(BAL_PATH,\s*\{\s*method:/, "토큰 없는 관리자 쓰기 금지");

  // 8. Node(테스트·빌드)에서는 익명 로그인을 시도하지 않는다 — window 가 있어도 네트워크 호출 0(실계정 생성 방지)
  const { ensureAnonymousAuth, firebaseIdToken } = await server.ssrLoadModule("/src/game/firebaseAuth.ts");
  const saved = { window: globalThis.window, fetch: globalThis.fetch };
  let networkCalls = 0;
  globalThis.window = {};
  globalThis.fetch = async () => { networkCalls += 1; throw new Error("network blocked in test"); };
  try {
    assert.equal(await ensureAnonymousAuth(FIREBASE_CONFIG), null);
    assert.equal(await firebaseIdToken(FIREBASE_CONFIG), null);
    assert.equal(networkCalls, 0, "Node 에서 익명 로그인 네트워크 호출이 발생했다");
  } finally {
    if (saved.window === undefined) delete globalThis.window;
    else globalThis.window = saved.window;
    globalThis.fetch = saved.fetch;
  }

  console.log(`✓ firebase rules contract — 발행 필드 ${Object.keys(sent).length}개·디렉터리 경로 ${paths.length}개·쓰기 규칙 ${writeRules}개가 database.rules.json 과 일치`);
} finally {
  await server.close();
}
