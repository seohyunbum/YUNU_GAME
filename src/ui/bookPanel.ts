import { TUTORIAL_SECTIONS } from "../game/tutorial";

// 튜토리얼 책 패널 — 정적 마크업. leaf: main.ts 를 import 하지 않는다.
// (닫기/ESC 바인딩은 호출부의 bindPanelBasics 가 담당)
export function renderBookPanelMarkup(): string {
  return `
      <section class="panel book-panel">
        <header>
          <h2>튜토리얼 책</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <ol>${TUTORIAL_SECTIONS.map((line) => `<li>${line}</li>`).join("")}</ol>
        <h3>핵심 레시피</h3>
        <div class="recipe-lines">
          <p>모든 제작 레시피는 재료를 넣는 위치와 상관없이 조합만 맞으면 됩니다.</p>
          <p>나무 1개 -> 나무 막대기 2개</p>
          <p>나무 3개 + 망치 1개 -> 제작대 1개</p>
          <p>제작대 2개 -> 확장 제작대 1개</p>
          <p>제련대 1개 + 망치 1개 -> 특수 제련대 1개</p>
          <p>망치 2개 + 철 6개 -> 분쇄기 1개</p>
          <p>다이아몬드 가루 6개 + 제련된 나무 6개 + 돌 6개 -> 거울 1개</p>
          <p>제련된 나무 3개 + 막대기 2개 -> 날카로운 나무 도끼</p>
          <p>일반 나무 3개 + 막대기 2개 -> 약한 나무 도끼</p>
          <p>돌 4개 + 막대기 2개 -> 돌 곡괭이</p>
          <p>날카로운 흑요석 1개 + 막대기 1개 -> 흑요석 단검</p>
          <p>날카로운 흑요석 2개 + 막대기 1개 -> 흑요석 검</p>
        </div>
      </section>
    `;
}
