import { KEY_RECIPES, TUTORIAL_SECTIONS } from "../game/tutorial";

// 튜토리얼 책 패널 — 정적 마크업(섹션별 참고서). leaf: main.ts 를 import 하지 않는다.
// (닫기/ESC 바인딩은 호출부의 bindPanelBasics 가 담당)
export function renderBookPanelMarkup(): string {
  return `
      <section class="panel book-panel">
        <header>
          <h2>📖 튜토리얼 — 초보 안내서</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <p class="book-intro">처음이라면 화면 아래 '현재 퀘스트'만 따라가도 충분해요. 궁금한 건 아래에서 주제별로 찾아보세요.</p>
        ${TUTORIAL_SECTIONS.map(
          (section) =>
            `<section class="book-section"><h3>${section.title}</h3><ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul></section>`,
        ).join("")}
        <section class="book-section">
          <h3>📜 자주 쓰는 레시피</h3>
          <div class="recipe-lines">${KEY_RECIPES.map((line) => `<p>${line}</p>`).join("")}</div>
        </section>
      </section>
    `;
}
