// 운영자 계정 리포트 (오프라인 CLI)
//
// 두 소스를 합쳐 전체 유저를 집계한다:
//  (1) Firebase Realtime DB 디렉터리(onlineConfig.FIREBASE_CONFIG) = 모든 머신의
//      전(全) 유저 명부(nickname · online · lastSeen) + 친구 관계. ← "모든 유저"
//  (2) 현재 머신의 Edge/Chrome localStorage = 이 PC 에서 플레이된 계정의 세이브
//      (최고 레벨 · 직업 · 걸음수 · 세이브 수). ← 레벨 등 상세
//  레벨/세이브는 각 플레이어 PC 에만 있으므로, 원격 유저는 명부 정보만 표시된다.
//
// 사용:
//   npm run admin-report                 # Firebase 전체 유저 + 이 PC 세이브
//   npm run admin-report -- --no-firebase
//   npm run admin-report -- --browser edge
//   npm run admin-report -- --snapshot <leveldb_dir>
//   npm run admin-report -- --json out.json
//
// 출력 JSON 은 플레이어 데이터라 admin-reports/ (gitignore) 에 저장된다.

import { ClassicLevel } from "classic-level";
import { inflateRawSync } from "node:zlib";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const browserArg = (getArg("--browser") ?? "all").toLowerCase();
const snapshotArg = getArg("--snapshot");
const jsonArg = getArg("--json");
const noFirebase = args.includes("--no-firebase");

const CLASS_KO = { warrior: "전사", healer: "힐러", mage: "마법사", summoner: "소환사", gunner: "거너", tanker: "탱커" };

function browserSources() {
  const local = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? "", "AppData", "Local");
  return [
    { name: "Edge", dir: join(local, "Microsoft", "Edge", "User Data", "Default", "Local Storage", "leveldb") },
    { name: "Chrome", dir: join(local, "Google", "Chrome", "User Data", "Default", "Local Storage", "leveldb") },
  ].filter((b) => browserArg === "all" || b.name.toLowerCase() === browserArg);
}
function snapshotLeveldb(srcDir) {
  let files;
  try { files = readdirSync(srcDir); } catch { return null; }
  const tmp = mkdtempSync(join(tmpdir(), "yunu-admin-"));
  let copied = 0;
  for (const f of files) { if (f === "LOCK") continue; try { copyFileSync(join(srcDir, f), join(tmp, f)); copied += 1; } catch { /* skip */ } }
  return copied > 0 ? tmp : null;
}
function decodeValue(buf) {
  if (!buf.length) return "";
  const t = buf[0], b = buf.subarray(1);
  if (t === 0) { const l = b.length - (b.length % 2); return b.toString("utf16le", 0, l); }
  if (t === 1) return b.toString("latin1");
  return buf.toString("utf8");
}
function unpack(b64) { try { return JSON.parse(inflateRawSync(Buffer.from(b64, "base64")).toString("utf8")); } catch { return null; } }
function saveFrom(rec) { if (!rec || typeof rec !== "object") return null; if (rec.packed) return unpack(rec.packed); if (rec.save) return rec.save; if (rec.player) return rec; return null; }
function originOf(k) { return k.includes("127.0.0.1") ? "로컬:127.0.0.1:5173" : k.includes("seohyunbum.github.io") ? "배포:github.io" : k.includes("localhost") ? "로컬:localhost" : "기타"; }

// accounts: nickname -> aggregate
const accounts = new Map();
const ensure = (nick) => {
  const key = nick || "(닉네임 미설정)";
  if (!accounts.has(key)) accounts.set(key, { nickname: key, saves: new Map(), sources: new Set(), registeredOn: new Set(), friends: new Set(), inFirebase: false, online: false, lastSeen: null });
  return accounts.get(key);
};
const addSave = (nick, origin, rec) => {
  const save = saveFrom(rec);
  if (!save?.player || typeof save.savedAt !== "string") return;
  const acc = ensure(nick);
  acc.sources.add(origin);
  if (!acc.saves.has(save.savedAt)) acc.saves.set(save.savedAt, { level: save.player.level ?? 1, cls: save.player.playerClass ?? "?", steps: Math.floor(save.player.totalSteps ?? 0), savedAt: save.savedAt });
};

async function readSource(browserName, dbDir) {
  let db;
  try { db = new ClassicLevel(dbDir, { createIfMissing: false }); } catch (e) { console.error(`  ! ${browserName} DB 열기 실패: ${e.message}`); return; }
  const originNick = new Map();
  const pending = [];
  for await (const [key, value] of db.iterator({ keyEncoding: "buffer", valueEncoding: "buffer" })) {
    const k = key.toString("latin1");
    if (!k.includes("ai-game-lab:")) continue;
    const origin = `${browserName}/${originOf(k)}`;
    const v = decodeValue(value);
    if (k.includes("nickname-v1") && !k.includes("registry")) { originNick.set(origin, v); continue; }
    pending.push({ origin, k, v });
  }
  for (const { origin, k, v } of pending) {
    const nick = originNick.get(origin) ?? null;
    try {
      if (k.includes("nickname-registry-v1")) { const arr = JSON.parse(v); if (Array.isArray(arr)) arr.forEach((n) => { if (typeof n === "string") ensure(n).registeredOn.add(origin); }); continue; }
      if (k.includes("wilderness-saves-v1")) { const arr = JSON.parse(v); if (Array.isArray(arr)) arr.forEach((r) => addSave(nick, origin, r)); continue; }
      if (k.includes("wilderness-save-history-v1")) { const arr = JSON.parse(v); if (Array.isArray(arr)) arr.forEach((r) => addSave(r.nickname || nick, origin, r)); continue; }
      if (k.includes("wilderness-save-v1") || k.includes("wilderness-save-backup-v1")) { addSave(nick, origin, JSON.parse(v)); continue; }
      if (k.includes("directory-friends-v1") && nick) { const pairs = JSON.parse(v); if (Array.isArray(pairs)) pairs.forEach((p) => { if (Array.isArray(p)) p.forEach((n) => { if (n && n !== nick) { ensure(nick).friends.add(n); } }); }); continue; }
    } catch { /* skip */ }
  }
  await db.close();
}

async function fetchFirebaseDirectory() {
  let dbUrl = null;
  try { dbUrl = readFileSync(resolve("src/onlineConfig.ts"), "utf8").match(/databaseURL:\s*"([^"]+)"/)?.[1] ?? null; } catch { /* ignore */ }
  if (!dbUrl) return null;
  try {
    const [users, friends] = await Promise.all([
      fetch(`${dbUrl}/users.json`).then((r) => r.json()),
      fetch(`${dbUrl}/friends.json`).then((r) => r.json()).catch(() => ({})),
    ]);
    return { users: users ?? {}, friends: friends ?? {}, dbUrl };
  } catch (e) {
    console.error(`  ! Firebase 디렉터리 조회 실패: ${e.message}`);
    return null;
  }
}

// ── 실행: 로컬 세이브 ──
const sources = snapshotArg ? [{ name: "스냅샷", dir: resolve(snapshotArg), temp: false }]
  : browserSources().map((b) => { const t = snapshotLeveldb(b.dir); return t ? { name: b.name, dir: t, temp: true } : null; }).filter(Boolean);
for (const s of sources) await readSource(s.name, s.dir);
for (const s of sources) if (s.temp) { try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* ignore */ } }

// ── 실행: Firebase 전체 디렉터리 ──
let fb = null;
if (!noFirebase) {
  fb = await fetchFirebaseDirectory();
  if (fb) {
    for (const [nick, info] of Object.entries(fb.users)) {
      const acc = ensure(nick);
      acc.inFirebase = true;
      acc.online = Boolean(info?.online);
      acc.lastSeen = typeof info?.lastSeen === "number" ? info.lastSeen : acc.lastSeen;
    }
    for (const [nick, others] of Object.entries(fb.friends)) {
      if (others && typeof others === "object") for (const other of Object.keys(others)) ensure(nick).friends.add(other);
    }
  }
}

const rows = [...accounts.values()].map((a) => {
  const saves = [...a.saves.values()].sort((x, y) => new Date(x.savedAt) - new Date(y.savedAt));
  const top = saves.reduce((m, sv) => (sv.level > (m?.level ?? -1) ? sv : m), null);
  const byClass = {};
  for (const sv of saves) byClass[sv.cls] = Math.max(byClass[sv.cls] ?? 0, sv.level);
  return {
    nickname: a.nickname,
    online: a.online,
    lastSeen: a.lastSeen ? new Date(a.lastSeen).toISOString() : null,
    inFirebase: a.inFirebase,
    hasLocalSaves: saves.length > 0,
    topLevel: top?.level ?? null,
    topClass: top ? (CLASS_KO[top.cls] ?? top.cls) : null,
    byClass: Object.fromEntries(Object.entries(byClass).map(([c, l]) => [CLASS_KO[c] ?? c, l])),
    saveCount: saves.length,
    maxSteps: saves.reduce((m, sv) => Math.max(m, sv.steps), 0),
    firstSavedAt: saves[0]?.savedAt ?? null,
    lastSavedAt: saves[saves.length - 1]?.savedAt ?? null,
    sources: [...a.sources],
    friends: [...a.friends],
  };
}).sort((x, y) => Number(y.online) - Number(x.online) || (y.topLevel ?? -1) - (x.topLevel ?? -1) || x.nickname.localeCompare(y.nickname));

// ── 콘솔 ──
const now = new Date();
console.log("\n" + "=".repeat(74));
console.log(`  YUNU_GAME 운영자 전체 유저 리포트 — ${now.toLocaleString()}`);
console.log(`  유저 ${rows.length}명 · 온라인 ${rows.filter((r) => r.online).length}명 · 이 PC 세이브 보유 ${rows.filter((r) => r.hasLocalSaves).length}명`);
console.log(`  소스: ${fb ? "Firebase 디렉터리 + " : ""}${sources.map((s) => s.name).join(", ") || "(로컬 없음)"}`);
console.log("=".repeat(74));
for (const r of rows) {
  const lvl = r.hasLocalSaves ? `Lv ${r.topLevel} (${r.topClass})` : "레벨 정보 없음 (원격 — 세이브는 본인 PC)";
  console.log(`\n${r.online ? "🟢" : "⚪"} ${r.nickname}`);
  console.log(`   최고 레벨   : ${lvl}`);
  if (r.hasLocalSaves) {
    console.log(`   직업별 최고 : ${Object.entries(r.byClass).map(([c, l]) => `${c} Lv${l}`).join(", ")}`);
    console.log(`   세이브/걸음 : ${r.saveCount}개 · ${r.maxSteps.toLocaleString()}걸음 · ${r.sources.join(", ")}`);
  }
  console.log(`   접속        : ${r.online ? "온라인" : "오프라인"}${r.lastSeen ? ` · 최근 ${new Date(r.lastSeen).toLocaleString()}` : ""}`);
  if (r.friends.length) console.log(`   친구        : ${r.friends.join(", ")}`);
}
console.log("\n" + "-".repeat(74));
console.log("※ 전체 유저 명부·접속 상태·친구는 Firebase 중앙 디렉터리에서 가져옵니다.");
console.log("※ 레벨·세이브는 각 플레이어 본인 PC 의 브라우저에만 있어, 이 PC 에서 플레이된 계정만 표시됩니다.");
console.log("※ 실제 플레이타임은 미기록 — 걸음수·저장 시각으로 추정.");

// ── JSON ──
const outDir = resolve("admin-reports");
mkdirSync(outDir, { recursive: true });
const stamp = now.toISOString().replace(/[:.]/g, "-");
const outPath = jsonArg ? resolve(jsonArg) : join(outDir, `admin-report-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ generatedAt: now.toISOString(), source: { firebase: Boolean(fb), browsers: sources.map((s) => s.name) }, userCount: rows.length, onlineCount: rows.filter((r) => r.online).length, users: rows }, null, 2), "utf8");
console.log(`\n📄 JSON 저장: ${outPath}`);
