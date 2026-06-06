// verify:full 사전 점검 — visual-check 은 dev 서버(127.0.0.1:5173)가 떠 있어야 동작한다.
// 서버가 없으면 playwright 가 암호 같은 타임아웃으로 죽으므로, 먼저 행동 가능한 메시지를 준다.
const url = "http://127.0.0.1:5173/";

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 3000);

try {
  await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  console.log(`✓ dev 서버 응답 확인: ${url}`);
} catch {
  clearTimeout(timer);
  console.error(`✗ dev 서버(${url})에 연결할 수 없습니다.`);
  console.error("  visual-check 전에 다른 터미널에서 'npm run dev' 를 먼저 실행하세요.");
  process.exit(1);
}
