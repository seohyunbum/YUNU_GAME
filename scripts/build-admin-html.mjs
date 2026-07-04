// 바탕화면 어드민 페이지 생성기 — balanceTuning 레지스트리(단일 진실)에서 admin/balance-admin.html 을 생성한다.
// 게임과 완전 분리된 독립 HTML(더블클릭으로 브라우저 실행) — Firebase REST 로 직접 읽고/쓴다.
// 사용: npm run build:admin  (레지스트리를 바꾸면 재실행 — verify 의 check:admin 이 신선도를 강제)
//       node scripts/build-admin-html.mjs --check  → 재생성 결과와 파일 비교(불일치 시 실패)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { BALANCE_TUNABLES } = await server.ssrLoadModule("/src/game/balanceTuning.ts");
  const { FIREBASE_CONFIG } = await server.ssrLoadModule("/src/onlineConfig.ts");
  const dbUrl = FIREBASE_CONFIG?.databaseURL?.replace(/\/$/, "");
  if (!dbUrl) throw new Error("FIREBASE_CONFIG.databaseURL missing");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>YUNU 밸런스 관리자</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 24px; font-family: "Segoe UI", Pretendard, sans-serif; background: #16211b; color: #f3ead6; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { opacity: 0.8; font-size: 13px; margin-bottom: 16px; }
  .status { padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); margin-bottom: 14px; font-size: 13px; }
  .status.ok { background: rgba(90, 200, 120, 0.15); }
  .status.err { background: rgba(220, 90, 90, 0.18); }
  section { margin-bottom: 18px; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 10px 14px; }
  h3 { margin: 4px 0 8px; font-size: 14px; color: #f4d488; border-bottom: 1px solid rgba(255,255,255,0.14); padding-bottom: 4px; }
  .row { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(160px, 1.3fr) 90px 34px; gap: 10px; align-items: center; padding: 4px 6px; border-radius: 6px; font-size: 13px; }
  .row.overridden { background: rgba(244, 212, 136, 0.13); }
  .row.overridden .lbl { color: #f4d488; font-weight: 700; }
  .lbl small { opacity: 0.6; font-weight: 400; }
  input[type="number"] { width: 84px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); border-radius: 6px; color: #f3ead6; padding: 4px 6px; }
  button { padding: 9px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.07); color: #f3ead6; cursor: pointer; font-size: 13px; }
  button.primary { background: #f4d488; color: #1a2b1f; font-weight: 700; }
  .row button { padding: 2px 9px; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; position: sticky; bottom: 0; padding: 12px 0; background: linear-gradient(transparent, #16211b 30%); }
  .actions .bottom-status { flex-basis: 100%; padding: 8px 12px; border-radius: 8px; font-size: 13px; background: rgba(255,255,255,0.06); min-height: 18px; }
  .actions .bottom-status.ok { background: rgba(90, 200, 120, 0.2); }
  .actions .bottom-status.err { background: rgba(220, 90, 90, 0.22); }
  button:disabled { opacity: 0.5; cursor: wait; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🛠 YUNU 밸런스 관리자</h1>
  <div class="sub">게임과 별개로 동작하는 관리자 페이지입니다. 값을 조정하고 <strong>전체 적용</strong>을 누르면 모든 기기가 <strong>다음 접속(새로고침)</strong>부터 반영됩니다. 노란색 = 기본값과 다른 항목.</div>
  <div class="status" id="status">전역 밸런스를 불러오는 중…</div>
  <div id="groups"></div>
  <div class="actions">
    <div class="bottom-status" id="statusBottom">버튼을 누르면 여기와 상단에 결과가 표시됩니다.</div>
    <button id="reload">↻ 현재 전역값 다시 불러오기</button>
    <button id="resetAll">모든 항목 기본값으로(화면만)</button>
    <button class="primary" id="publish">🌐 전체 적용 (모든 기기)</button>
    <button id="wipe">🌐 전역 초기화 (기본값 복귀)</button>
  </div>
</div>
<script>
const DB_URL = ${JSON.stringify(dbUrl)};
const BAL_PATH = DB_URL + "/users/__balance__/global.json";
const TUNABLES = ${JSON.stringify(BALANCE_TUNABLES, null, 1)};
const byKey = new Map(TUNABLES.map((t) => [t.key, t]));
const values = new Map(TUNABLES.map((t) => [t.key, t.def]));

function clampVal(t, v) { return Math.min(t.max, Math.max(t.min, v)); }
function setStatus(text, cls) {
  const top = document.getElementById("status"); top.textContent = text; top.className = "status" + (cls ? " " + cls : "");
  const bottom = document.getElementById("statusBottom"); bottom.textContent = text; bottom.className = "bottom-status" + (cls ? " " + cls : "");
}
function setBusy(busy) { for (const id of ["reload", "resetAll", "publish", "wipe"]) document.getElementById(id).disabled = busy; }

function render() {
  const groups = new Map();
  for (const t of TUNABLES) { if (!groups.has(t.group)) groups.set(t.group, []); groups.get(t.group).push(t); }
  document.getElementById("groups").innerHTML = [...groups.entries()].map(([g, ts]) => \`
    <section><h3>\${g}</h3>\${ts.map((t) => \`
      <label class="row" data-row="\${t.key}">
        <span class="lbl">\${t.label} <small>(기본 \${t.def})</small></span>
        <input type="range" data-slider="\${t.key}" min="\${t.min}" max="\${t.max}" step="\${t.step}" />
        <input type="number" data-number="\${t.key}" min="\${t.min}" max="\${t.max}" step="\${t.step}" />
        <button type="button" data-reset="\${t.key}" title="기본값으로">↺</button>
      </label>\`).join("")}</section>\`).join("");
  for (const t of TUNABLES) {
    document.querySelector(\`[data-slider="\${t.key}"]\`).addEventListener("input", (e) => setVal(t.key, Number(e.target.value)));
    document.querySelector(\`[data-number="\${t.key}"]\`).addEventListener("change", (e) => setVal(t.key, Number(e.target.value)));
    document.querySelector(\`[data-reset="\${t.key}"]\`).addEventListener("click", () => setVal(t.key, t.def));
    syncRow(t.key);
  }
}

function setVal(key, v) {
  const t = byKey.get(key);
  if (!t || !Number.isFinite(v)) return;
  values.set(key, clampVal(t, v));
  syncRow(key);
}

function syncRow(key) {
  const t = byKey.get(key); const v = values.get(key);
  document.querySelector(\`[data-slider="\${key}"]\`).value = String(v);
  document.querySelector(\`[data-number="\${key}"]\`).value = String(v);
  document.querySelector(\`[data-row="\${key}"]\`).classList.toggle("overridden", Math.abs(v - t.def) > 1e-9);
}

async function loadGlobal() {
  setStatus("전역 밸런스를 불러오는 중…");
  setBusy(true);
  try {
    const res = await fetch(BAL_PATH);
    const data = res.ok ? await res.json() : null;
    for (const t of TUNABLES) {
      const raw = data && typeof data[t.key] === "number" && Number.isFinite(data[t.key]) ? clampVal(t, data[t.key]) : t.def;
      values.set(t.key, raw);
      syncRow(t.key);
    }
    const overridden = TUNABLES.filter((t) => Math.abs(values.get(t.key) - t.def) > 1e-9).length;
    setStatus(overridden > 0 ? \`불러오기 완료 — 현재 전역 오버라이드 \${overridden}개 적용 중.\` : "불러오기 완료 — 현재 전 기기가 코드 기본값을 사용 중입니다.", "ok");
  } catch (e) {
    setStatus("불러오기 실패 — 인터넷 연결을 확인해 주세요. (기본값으로 표시됨)", "err");
  } finally { setBusy(false); }
}

document.getElementById("reload").addEventListener("click", loadGlobal);
document.getElementById("resetAll").addEventListener("click", () => { for (const t of TUNABLES) { values.set(t.key, t.def); syncRow(t.key); } setStatus("화면의 모든 항목을 기본값으로 되돌렸습니다. 반영하려면 전체 적용을 누르세요."); });
document.getElementById("publish").addEventListener("click", async () => {
  const payload = {};
  for (const t of TUNABLES) { const v = values.get(t.key); if (Math.abs(v - t.def) > 1e-9) payload[t.key] = v; }
  setStatus("전체 적용 중…");
  setBusy(true);
  try {
    const res = await fetch(BAL_PATH, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
    setStatus(\`✅ 전체 적용 완료 — 오버라이드 \${Object.keys(payload).length}개 저장. 모든 기기가 다음 접속(새로고침)부터 이 밸런스를 사용합니다.\`, "ok");
  } catch (e) {
    setStatus("❌ 전체 적용 실패 — 인터넷 연결을 확인해 주세요.", "err");
  } finally { setBusy(false); }
});
document.getElementById("wipe").addEventListener("click", async () => {
  if (!confirm("전역 밸런스를 초기화할까요? 모든 기기가 코드 기본값으로 돌아갑니다.")) return;
  setStatus("전역 초기화 중…");
  setBusy(true);
  try {
    const res = await fetch(BAL_PATH, { method: "DELETE" });
    if (!res.ok) throw new Error(String(res.status));
    for (const t of TUNABLES) { values.set(t.key, t.def); syncRow(t.key); }
    setStatus("✅ 전역 초기화 완료 — 모든 기기가 코드 기본값으로 복귀합니다.", "ok");
  } catch (e) {
    setStatus("❌ 전역 초기화 실패 — 인터넷 연결을 확인해 주세요.", "err");
  } finally { setBusy(false); }
});

render();
loadGlobal();
</script>
</body>
</html>
`;

  mkdirSync("admin", { recursive: true });
  if (process.argv.includes("--check")) {
    const current = readFileSync("admin/balance-admin.html", "utf-8");
    if (current !== html) {
      console.error("✗ admin/balance-admin.html 이 레지스트리와 불일치 — `npm run build:admin` 으로 재생성 후 커밋하세요.");
      process.exit(1);
    }
    console.log(`✓ admin html 최신 (튜너블 ${BALANCE_TUNABLES.length}개)`);
  } else {
    writeFileSync("admin/balance-admin.html", html);
    console.log(`✓ admin/balance-admin.html 생성 (튜너블 ${BALANCE_TUNABLES.length}개) — 바탕화면 사본도 갱신하세요.`);
  }
} finally {
  await server.close();
}
