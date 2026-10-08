// Firebase DB 규칙 실측(게시 후 수동 실행) — npm run check:firebase-live
// 게시된 database.rules.json 이 라이브 DB 에서 실제로 허용/거부하는지 확인한다. 네트워크·실DB 를 쓰므로 verify 에는 넣지 않는다.
// ⚠ '틀린 ETag(if-match)' 무기록 시험은 쓰지 않는다 — 읽기 공개 경로(users·friends·inbox/{닉})에서는 ETag 검사가 쓰기 규칙보다
//   먼저라, 규칙이 막을 요청도 412 를 돌려준다(2026-10-09 실측: 로그인 없는 실제 쓰기 401, 같은 요청 + 틀린 ETag 412).
// 대신 데이터가 바뀌지 않는 요청만 쓴다:
//   · 허용 확인 = 같은 값 다시 쓰기(기존 사용자·기존 친구 관계) / 없는 키 삭제 / inbox 시험 항목을 쓰고 바로 지우기
//   · 거부 확인 = 실제 쓰기 — 규칙이 막으면(401) 아무것도 기록되지 않는다. 혹시 막히지 않으면 __rules_probe__ 시험 경로에만 남는다.
// 시험 익명 계정 1개를 만들어 쓰고 마지막에 지운다. 기존 사용자 닉네임은 출력하지 않는다.
// 관리자 허용(전역 밸런스 쓰기)은 관리자 토큰이 필요하므로 밸런스 관리자 페이지의 '권한 다시 확인'(같은 '없는 키 삭제' 방식)으로 본다.
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let config;
try {
  config = (await server.ssrLoadModule("/src/onlineConfig.ts")).FIREBASE_CONFIG;
} finally {
  await server.close();
}
if (!config?.databaseURL || !config?.apiKey) throw new Error("FIREBASE_CONFIG missing");
const DB = config.databaseURL.replace(/\/$/, "");
const KEY = config.apiKey;
const PROBE = "__rules_probe__";
const PEER = "__rules_probe_b__";
const TS = { ".sv": "timestamp" };
const nickRules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules.users.$nick;
const knownFields = Object.keys(nickRules).filter((key) => !key.startsWith(".") && !key.startsWith("$"));
const enc = encodeURIComponent;

async function call(method, path, { body, token, ifMatch } = {}) {
  const init = { method, headers: { "Content-Type": "application/json", ...(ifMatch ? { "if-match": ifMatch } : {}) } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return (await fetch(`${DB}/${path}.json${token ? `?auth=${enc(token)}` : ""}`, init)).status;
}
// 현재 값과 ETag — 같은 값 다시 쓰기를 if-match(맞는 ETag)로 감싸, 그사이 본인이 값을 바꿨으면 412 로 쓰지 않게 한다.
async function etagOf(path) {
  return (await fetch(`${DB}/${path}.json`, { headers: { "X-Firebase-ETag": "true" } })).headers.get("etag");
}
async function readStatus(pathWithQuery) {
  return (await fetch(`${DB}/${pathWithQuery}`)).status;
}
async function get(path) {
  return (await fetch(`${DB}/${path}.json`)).json();
}

const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
const account = await signUp.json();
if (!signUp.ok) {
  console.error("✗ 시험 익명 로그인 실패:", account?.error?.message ?? signUp.status, "— Authentication 익명 로그인이 켜져 있는지 확인");
  process.exit(2);
}
const token = account.idToken;
let failed = 0;

try {
  // 기준 데이터 — 알려진 필드가 가장 많은 기존 사용자(동률이면 가장 오래 접속 안 한 사용자)와 기존 친구 관계 하나.
  const users = (await get("users")) ?? {};
  const [nick, original] = Object.entries(users)
    .filter(([key, value]) => key !== "__balance__" && value && typeof value === "object")
    .map(([key, value]) => [key, value, Object.keys(value).filter((field) => knownFields.includes(field)).length])
    .sort((a, b) => b[2] - a[2] || (a[1].lastSeen ?? 0) - (b[1].lastSeen ?? 0))[0];
  // publishProgress 가 보내는 진행도 필드만(접속 필드 online·lastSeen 은 디렉터리 몫이라 제외 — 본인 접속 상태를 건드리지 않는다).
  const sample = Object.fromEntries(Object.entries(original).filter(([field]) => knownFields.includes(field) && field !== "online" && field !== "lastSeen"));
  const friends = (await get("friends")) ?? {};
  const pair = Object.entries(friends).flatMap(([a, list]) => Object.entries(list ?? {}).filter(([, value]) => value === true).map(([b]) => [a, b]))[0];
  const balance = await get("users/__balance__/global");
  const n = enc(nick);
  const onlineEtag = typeof original.online === "boolean" ? await etagOf(`users/${n}/online`) : null;
  console.log(`기준: 기존 사용자 1명(진행도 필드 ${Object.keys(sample).length}개)·기존 친구 관계 ${pair ? 1 : 0}개·전역 밸런스 키 ${Object.keys(balance ?? {}).length}개`);

  const cases = [
    ["허용 · 기존 사용자 진행도 필드를 같은 값으로 PATCH(publishProgress 형태)", 200, () => call("PATCH", `users/${n}`, { body: sample, token })],
    ...(onlineEtag ? [
      ["허용 · 기존 사용자 online 같은 값(디렉터리 접속 형태 · 맞는 ETag)", 200, () => call("PUT", `users/${n}/online`, { body: original.online, token, ifMatch: onlineEtag })],
      ["거부(로그인 없음) · 같은 요청(맞는 ETag — 전제조건 통과 후 규칙이 막음)", 401, () => call("PUT", `users/${n}/online`, { body: original.online, ifMatch: onlineEtag })],
    ] : []),
    ["허용 · 기존 사용자의 없는 필드 삭제(변화 없음)", 200, () => call("DELETE", `users/${n}/__permission_probe__`, { token })],
    ...(pair ? [["허용 · 기존 친구 관계 true 다시 쓰기", 200, () => call("PUT", `friends/${enc(pair[0])}/${enc(pair[1])}`, { body: true, token })]] : []),
    ["허용 · inbox 친구요청 쓰기", 200, () => call("PUT", `inbox/${PROBE}/friendRequests/${PEER}`, { body: TS, token })],
    ["허용 · inbox 친구요청 지우기(처리 후)", 200, () => call("DELETE", `inbox/${PROBE}/friendRequests/${PEER}`, { token })],
    ["허용 · inbox 친구수락 쓰기", 200, () => call("PUT", `inbox/${PROBE}/friendAccepted/${PEER}`, { body: TS, token })],
    ["허용 · inbox 친구수락 지우기", 200, () => call("DELETE", `inbox/${PROBE}/friendAccepted/${PEER}`, { token })],
    ["허용 · inbox 파티초대 {code, ts} 쓰기", 200, () => call("PUT", `inbox/${PROBE}/partyInvites/${PEER}`, { body: { code: "ABC234", ts: TS }, token })],
    ["허용 · inbox 파티초대 지우기", 200, () => call("DELETE", `inbox/${PROBE}/partyInvites/${PEER}`, { token })],
    ["거부 · 모르는 필드", 401, () => call("PUT", `users/${PROBE}/foo`, { body: 1, token })],
    ["거부 · level 에 문자열", 401, () => call("PUT", `users/${PROBE}/level`, { body: "31", token })],
    ["거부 · level 범위 밖(1e9)", 401, () => call("PUT", `users/${PROBE}/level`, { body: 1e9, token })],
    ["거부 · 사용자 노드를 원시값으로", 401, () => call("PUT", `users/${PROBE}`, { body: "x", token })],
    ["거부 · 모르는 훈련 종목", 401, () => call("PUT", `users/${PROBE}/training/speed`, { body: { stage: 1, tries: 1 }, token })],
    ["거부 · 훈련 기록에 tries 없음", 401, () => call("PUT", `users/${PROBE}/training/hp`, { body: { stage: 3 }, token })],
    ["거부 · 21자 닉네임", 401, () => call("PUT", `users/${enc("가".repeat(21))}/online`, { body: true, token })],
    ["거부 · 사용자 노드 통째 삭제", 401, () => call("DELETE", `users/${PROBE}`, { token })],
    ["거부 · 전역 밸런스 없는 키 삭제(관리자 아님)", 401, () => call("DELETE", "users/__balance__/global/__permission_probe__", { token })],
    ["거부 · 전역 밸런스 같은 값 쓰기(관리자 아님)", 401, () => call("PUT", "users/__balance__/global", { body: balance ?? {}, token })],
    ["거부 · 친구 값 false", 401, () => call("PUT", `friends/${PROBE}/${PEER}`, { body: false, token })],
    ["거부 · 친구 관계 삭제", 401, () => call("DELETE", `friends/${PROBE}/${PEER}`, { token })],
    ["거부 · 파티초대에 ts 없음", 401, () => call("PUT", `inbox/${PROBE}/partyInvites/${PEER}`, { body: { code: "ABC234" }, token })],
    ["거부 · inbox 모르는 상자", 401, () => call("PUT", `inbox/${PROBE}/junk/${PEER}`, { body: 1, token })],
    ["거부 · admins 에 자기 등록", 401, () => call("PUT", `admins/${account.localId}`, { body: true, token })],
    ["거부 · 규칙 없는 경로", 401, () => call("PUT", "zz_rules_probe/x", { body: 1, token })],
    ["거부(로그인 없음) · 기존 사용자의 없는 필드 삭제", 401, () => call("DELETE", `users/${n}/__permission_probe__`)],
    ...(pair ? [["거부(로그인 없음) · 기존 친구 관계 true 다시 쓰기", 401, () => call("PUT", `friends/${enc(pair[0])}/${enc(pair[1])}`, { body: true })]] : []),
    ["거부(로그인 없음) · inbox 친구요청 쓰기", 401, () => call("PUT", `inbox/${PROBE}/friendRequests/${PEER}`, { body: TS })],
    ["거부(로그인 없음) · inbox 항목 지우기", 401, () => call("DELETE", `inbox/${PROBE}/friendRequests/${PEER}`)],
    ["거부(로그인 없음) · 전역 밸런스 없는 키 삭제", 401, () => call("DELETE", "users/__balance__/global/__permission_probe__")],
    ["읽기 · users(랭킹·명부)", 200, () => readStatus("users.json?shallow=true")],
    ["읽기 · friends", 200, () => readStatus("friends.json?shallow=true")],
    ["읽기 · inbox/{닉}", 200, () => readStatus(`inbox/${PROBE}.json`)],
    ["읽기 · 전역 밸런스(게임 부팅)", 200, () => readStatus("users/__balance__/global.json")],
    ["읽기 거부 · inbox 전체", 401, () => readStatus("inbox.json?shallow=true")],
    ["읽기 거부 · admins", 401, () => readStatus("admins.json")],
    ["읽기 거부 · 루트", 401, () => readStatus(".json?shallow=true")],
  ];

  for (const [name, expected, run] of cases) {
    const got = await run();
    if (got !== expected) failed += 1;
    console.log(`${got === expected ? "✓" : "✗"} ${got} (기대 ${expected}) ${name}`);
  }

  // 무변경 확인 — 시험 경로에 남은 것이 없고, 기존 사용자·친구 관계·전역 밸런스가 그대로인지.
  for (const path of [`users/${PROBE}`, `friends/${PROBE}`, `inbox/${PROBE}`]) {
    const left = await get(path);
    if (left !== null) failed += 1;
    console.log(`${left === null ? "✓" : "✗"} 남은 값 ${path}: ${JSON.stringify(left)}`);
  }
  const after = await get(`users/${n}`);
  const unchanged = isDeepStrictEqual(after, original);
  const onlyPresenceMoved = !unchanged && isDeepStrictEqual({ ...after, online: 0, lastSeen: 0 }, { ...original, online: 0, lastSeen: 0 });
  if (!unchanged && !onlyPresenceMoved) failed += 1;
  console.log(`${unchanged || onlyPresenceMoved ? "✓" : "✗"} 기존 사용자 데이터 ${unchanged ? "그대로" : onlyPresenceMoved ? "진행도 그대로(접속 상태만 본인 접속으로 바뀜)" : "바뀜!"}`);
  if (pair) {
    const still = (await get(`friends/${enc(pair[0])}/${enc(pair[1])}`)) === true;
    if (!still) failed += 1;
    console.log(`${still ? "✓" : "✗"} 기존 친구 관계 그대로`);
  }
  const balanceAfter = await get("users/__balance__/global");
  const balanceSame = isDeepStrictEqual(balanceAfter, balance);
  if (!balanceSame) failed += 1;
  console.log(`${balanceSame ? "✓" : "✗"} 전역 밸런스 그대로`);
  console.log(failed ? `✗ 불일치 ${failed}건` : `✓ 전 ${cases.length}건 + 무변경 확인 통과`);
} finally {
  const removed = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) });
  console.log(`시험 익명 계정 삭제: HTTP ${removed.status}`);
}
process.exitCode = failed ? 1 : 0;
