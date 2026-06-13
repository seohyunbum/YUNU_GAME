// 운영자 계정 리포트 (오프라인 CLI)
//
// 이 게임은 중앙 서버가 없는 클라이언트(브라우저 localStorage) + P2P 게임이라,
// "전체 계정"은 각 머신의 브라우저에만 존재한다. 이 도구는 현재 머신의 Edge/Chrome
// localStorage 를 읽어 등록된 모든 닉네임의 세이브(최고 레벨·직업·걸음수·세이브 수·
// 저장 기록 범위)와 자동 백업 이력, 친구 목록을 집계해 콘솔 + JSON 으로 출력한다.
//
// 사용:
//   npm run admin-report                 # Edge+Chrome 자동 스냅샷 → 집계
//   npm run admin-report -- --browser edge
//   npm run admin-report -- --snapshot <leveldb_dir>   # 미리 만든 스냅샷 사용
//   npm run admin-report -- --json out.json            # JSON 저장 경로 지정
//
// 주의: 실제 플레이타임(벽시계)은 게임이 기록하지 않는다. 활동량은 누적 걸음수와
// 저장 기록 시각 범위로 추정한다. 출력 JSON 은 플레이어 데이터라 admin-reports/ (gitignore) 에 저장된다.

import { ClassicLevel } from "classic-level";
import { inflateRawSync } from "node:zlib";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const browserArg = (getArg("--browser") ?? "all").toLowerCase();
const snapshotArg = getArg("--snapshot");
const jsonArg = getArg("--json");

const CLASS_KO = { warrior: "전사", healer: "힐러", mage: "마법사", summoner: "소환사", gunner: "거너", tanker: "탱커" };

function browserSources() {
  const local = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? "", "AppData", "Local");
  const all = [
    { name: "Edge", dir: join(local, "Microsoft", "Edge", "User Data", "Default", "Local Storage", "leveldb") },
    { name: "Chrome", dir: join(local, "Google", "Chrome", "User Data", "Default", "Local Storage", "leveldb") },
  ];
  return all.filter((b) => browserArg === "all" || b.name.toLowerCase() === browserArg);
}

// 잠긴 라이브 DB 를 직접 못 열기에 파일들을 임시 폴더로 복사한다(LOCK 제외).
function snapshotLeveldb(srcDir) {
  let files;
  try { files = readdirSync(srcDir); } catch { return null; }
  const tmp = mkdtempSync(join(tmpdir(), "yunu-admin-"));
  let copied = 0;
  for (const f of files) {
    if (f === "LOCK") continue;
    try { copyFileSync(join(srcDir, f), join(tmp, f)); copied += 1; } catch { /* skip busy/odd file */ }
  }
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
function saveFrom(rec) {
  if (!rec || typeof rec !== "object") return null;
  if (rec.packed) return unpack(rec.packed);
  if (rec.save) return rec.save;
  if (rec.player) return rec;
  return null;
}
function originOf(k) { return k.includes("127.0.0.1") ? "로컬:127.0.0.1:5173" : k.includes("seohyunbum.github.io") ? "배포:github.io" : k.includes("localhost") ? "로컬:localhost" : "기타"; }

// accounts: nickname -> aggregate
const accounts = new Map();
const ensure = (nick) => {
  const key = nick || "(닉네임 미설정)";
  if (!accounts.has(key)) accounts.set(key, { nickname: key, saves: new Map(), sources: new Set(), registeredOn: new Set(), friends: new Set() });
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
  // 1차: origin -> { nickname }
  const originNick = new Map();
  const pending = []; // {origin, type, value}
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
      if (k.includes("directory-friends-v1") && nick) { const pairs = JSON.parse(v); if (Array.isArray(pairs)) pairs.forEach((p) => { if (Array.isArray(p)) p.forEach((n) => { if (n && n !== nick) ensure(nick).friends.add(n); }); }); continue; }
    } catch { /* skip malformed */ }
  }
  await db.close();
}

// ── 실행 ──
const sources = snapshotArg ? [{ name: "스냅샷", dir: resolve(snapshotArg), temp: false }]
  : browserSources().map((b) => { const t = snapshotLeveldb(b.dir); return t ? { name: b.name, dir: t, temp: true } : null; }).filter(Boolean);

if (sources.length === 0) { console.error("읽을 수 있는 브라우저 localStorage 를 찾지 못했습니다. --snapshot <dir> 로 직접 지정하세요."); process.exit(1); }

for (const s of sources) await readSource(s.name, s.dir);
for (const s of sources) if (s.temp) { try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* ignore */ } }

const rows = [...accounts.values()].map((a) => {
  const saves = [...a.saves.values()].sort((x, y) => new Date(x.savedAt) - new Date(y.savedAt));
  const top = saves.reduce((m, sv) => (sv.level > (m?.level ?? -1) ? sv : m), null);
  const maxSteps = saves.reduce((m, sv) => Math.max(m, sv.steps), 0);
  const byClass = {};
  for (const sv of saves) byClass[sv.cls] = Math.max(byClass[sv.cls] ?? 0, sv.level);
  return {
    nickname: a.nickname,
    topLevel: top?.level ?? 0,
    topClass: top ? (CLASS_KO[top.cls] ?? top.cls) : "-",
    byClass: Object.fromEntries(Object.entries(byClass).map(([c, l]) => [CLASS_KO[c] ?? c, l])),
    saveCount: saves.length,
    maxSteps,
    firstSavedAt: saves[0]?.savedAt ?? null,
    lastSavedAt: saves[saves.length - 1]?.savedAt ?? null,
    sources: [...a.sources],
    registered: a.registeredOn.size > 0,
    friends: [...a.friends],
  };
}).sort((x, y) => y.topLevel - x.topLevel);

// ── 콘솔 출력 ──
const now = new Date();
console.log("\n" + "=".repeat(72));
console.log(`  YUNU_GAME 운영자 계정 리포트 — ${now.toLocaleString()}`);
console.log(`  데이터 출처: ${sources.map((s) => s.name).join(", ")}  ·  집계 계정 ${rows.length}명`);
console.log("=".repeat(72));
if (rows.length === 0) console.log("  (집계된 계정이 없습니다)");
for (const r of rows) {
  console.log(`\n■ ${r.nickname}${r.registered ? "" : "  (레지스트리 미등록)"}`);
  console.log(`   최고 레벨   : Lv ${r.topLevel} (${r.topClass})`);
  console.log(`   직업별 최고 : ${Object.entries(r.byClass).map(([c, l]) => `${c} Lv${l}`).join(", ") || "-"}`);
  console.log(`   세이브 수   : ${r.saveCount}개 (백업 이력 포함)`);
  console.log(`   누적 걸음수 : ${r.maxSteps.toLocaleString()} (활동량 지표)`);
  console.log(`   저장 기록   : ${r.firstSavedAt ? new Date(r.firstSavedAt).toLocaleString() : "-"} → ${r.lastSavedAt ? new Date(r.lastSavedAt).toLocaleString() : "-"}`);
  console.log(`   플레이 환경 : ${r.sources.join(", ") || "-"}`);
  if (r.friends.length) console.log(`   친구        : ${r.friends.join(", ")}`);
}
console.log("\n" + "-".repeat(72));
console.log("※ 실제 플레이타임은 게임이 기록하지 않습니다. 활동량은 누적 걸음수·저장 시각 범위로 추정한 값입니다.");
console.log("※ 중앙 서버가 없어 '이 머신의 브라우저에서 플레이된 계정'만 집계됩니다.");

// ── JSON 저장 (플레이어 데이터 → gitignore 폴더) ──
const outDir = resolve("admin-reports");
mkdirSync(outDir, { recursive: true });
const stamp = now.toISOString().replace(/[:.]/g, "-");
const outPath = jsonArg ? resolve(jsonArg) : join(outDir, `admin-report-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ generatedAt: now.toISOString(), sources: sources.map((s) => s.name), accountCount: rows.length, accounts: rows }, null, 2), "utf8");
console.log(`\n📄 JSON 저장: ${outPath}`);
