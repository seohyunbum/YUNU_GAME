// 엔딩 크레딧 프리뷰 — 크레딧 오버레이만 단독 렌더해 스크린샷 QA 한다.
// (스크린샷 타이밍에 크레딧이 화면 중앙에 오도록 스크롤 속도를 당긴다)
import { showEndingScreen } from "../../src/ui/endingScreen";
import "../../src/style.css";

const speedup = document.createElement("style");
speedup.textContent = ".ending-roll { animation-duration: 9s; }";
document.head.appendChild(speedup);

const host = document.createElement("div");
host.style.cssText = "position:fixed;inset:0;";
document.body.appendChild(host);
showEndingScreen(host, () => {});

(window as unknown as { endingPreviewReady: boolean }).endingPreviewReady = true;
