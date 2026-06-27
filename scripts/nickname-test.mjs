// 닉네임 검증 적대적 테스트 — 띄어쓰기/특수기호 허용 + 위험문자 차단 + 비속어 우회 검출.
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const { validateNickname } = await server.ssrLoadModule("/src/game/nickname.ts");
  const ok = (raw, taken = []) => validateNickname(raw, taken);

  // ── 정상(기존 호환) ──
  assert.equal(ok("용용이").ok, true, "한글 통과");
  assert.equal(ok("Tom99").ok, true, "영숫자 통과");

  // ── 띄어쓰기 허용 + 정규화 ──
  assert.deepEqual(ok("철수 영희"), { ok: true, name: "철수 영희" }, "내부 공백 허용");
  assert.deepEqual(ok("  철수  "), { ok: true, name: "철수" }, "양끝 공백 트림");
  assert.deepEqual(ok("철수   영희"), { ok: true, name: "철수 영희" }, "연속 공백 1칸 정규화");

  // ── 특수기호 허용 ──
  for (const n of ["철수!", "Tom@99", "a-b_c", "별★", "톰^_^", "메롱~", "(용사)", "100%", "a+b=c", "별,달"]) {
    assert.equal(ok(n).ok, true, `특수기호 허용: ${n}`);
  }

  // ── Firebase 키 금지문자 차단 ──
  for (const bad of ["a.b", "a#b", "a$b", "a[b", "a]b", "a/b"]) {
    assert.equal(ok(bad).ok, false, `Firebase 금지문자 차단: ${bad}`);
  }
  // ── HTML 특수문자 차단(렌더 방어) ──
  for (const bad of ["a<b", "a>b", "a&b", 'a"b', "a'b"]) {
    assert.equal(ok(bad).ok, false, `HTML 특수문자 차단: ${bad}`);
  }
  // ── 제어문자 차단(공백류는 공백으로 정규화되므로 비공백 제어문자로 검증) ──
  const ctrl = (code) => "a" + String.fromCharCode(code) + "b";
  assert.equal(ok(ctrl(0)).ok, false, "NUL(0) 차단");
  assert.equal(ok(ctrl(7)).ok, false, "BEL(7) 차단");
  assert.equal(ok(ctrl(27)).ok, false, "ESC(27) 차단");
  assert.equal(ok(ctrl(127)).ok, false, "DEL(127) 차단");

  // ── 길이 ──
  assert.equal(ok("a").ok, false, "2글자 미만 거부");
  assert.equal(ok("12345678901").ok, false, "10글자 초과 거부");
  assert.equal(ok("     ").ok, false, "공백만 → 트림 후 빈 문자열 거부");

  // ── 비속어 우회(공백·기호 삽입) 검출 ──
  for (const bad of ["시 발", "시*발", "병_신", "ㅅ.ㅂ", "f u c k", "s-h-i-t"]) {
    assert.equal(ok(bad).ok, false, `우회 비속어 검출: ${bad}`);
  }

  // ── 예약어 우회(공백·기호 삽입) 검출 ──
  assert.equal(ok("a d m i n").ok, false, "예약어 admin 우회 차단");
  assert.equal(ok("관 리 자").ok, false, "예약어 관리자 우회 차단");

  // ── 중복(정규화 기준) ──
  assert.equal(ok("철 수", ["철수"]).ok, false, "정규화 중복 차단(공백 차이)");
  assert.equal(ok("철수!", ["철수"]).ok, false, "정규화 중복 차단(기호 차이)");
  assert.equal(ok("영희", ["철수"]).ok, true, "다른 이름은 통과");

  console.log("nickname-test: OK (spaces/symbols allowed, dangerous chars blocked, profanity bypass caught)");
} finally {
  await server.close();
}
