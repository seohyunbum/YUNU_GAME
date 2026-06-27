export interface TitlePlayerClassView {
  id: string;
  name: string;
  skillName: string;
  tagline: string;
  passiveLabel: string;
  passiveSummary: string;
}

export interface TitleScreenView {
  lavaLaneCount: number;
  playerClasses: TitlePlayerClassView[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

export function renderSaveControls(saveControlsEl: HTMLElement) {
  saveControlsEl.innerHTML = `
      <button data-new-game>새로시작</button>
      <button data-save-game>저장</button>
      <button data-load-game>불러오기</button>
    `;
}

export function renderTitleScreen(titleScreenEl: HTMLElement, view: TitleScreenView) {
  titleScreenEl.innerHTML = `
      <div class="title-shade" aria-hidden="true"></div>
      <div class="title-frame" aria-hidden="true">
        <span></span>
        <span></span>
      </div>
      <div class="title-menu"></div>
      <div class="mini-game-screen hidden" data-mini-game>
        <div class="mini-game-card">
          <header>
            <div>
              <span class="title-kicker">MINI GAME</span>
              <h2>구슬 튕기기</h2>
              <p>위/아래 화살표로 양쪽 막대를 동시에 움직여 구슬이 좌우로 빠지지 않게 막으세요.</p>
            </div>
            <button class="mini-game-close" data-mini-back>타이틀</button>
          </header>
          <div class="mini-game-status">
            <strong>이번 점수 <span data-mini-score>0</span></strong>
            <strong>보유 포인트 <span data-mini-points>0</span>P</strong>
            <span data-mini-state>시작 대기</span>
          </div>
          <div class="marble-arena" data-mini-arena>
            <div class="marble-wall marble-wall-top"></div>
            <div class="marble-wall marble-wall-bottom"></div>
            <div class="marble-paddle left" data-mini-paddle-left></div>
            <div class="marble-paddle right" data-mini-paddle-right></div>
            <div class="marble-ball" data-mini-ball></div>
          </div>
          <div class="mini-game-actions">
            <button data-mini-start>시작</button>
            <button data-mini-reset>다시하기</button>
          </div>
        </div>
      </div>
      <div class="mini-game-screen hidden" data-lava-game>
        <div class="mini-game-card lava-game-card">
          <header>
            <div>
              <span class="title-kicker">MINI GAME</span>
              <h2>용암을 피해라</h2>
              <p>좌/우 화살표로 다섯 칸을 이동하며 위에서 쏟아지는 용암을 피하세요.</p>
            </div>
            <button class="mini-game-close" data-lava-back>타이틀</button>
          </header>
          <div class="mini-game-status">
            <strong>이번 점수 <span data-lava-score>0</span></strong>
            <strong>보유 포인트 <span data-lava-points>0</span>P</strong>
            <strong>단계 <span data-lava-stage>1</span></strong>
            <span data-lava-state>시작 대기</span>
          </div>
          <div class="lava-arena" data-lava-arena>
            <div class="lava-lanes">
              ${Array.from({ length: view.lavaLaneCount }, (_, index) => `<div class="lava-lane" data-lava-lane="${index}"></div>`).join("")}
            </div>
            <div class="lava-hazards" data-lava-hazards></div>
            <div class="lava-player" data-lava-player data-lane="2"></div>
          </div>
          <div class="mini-game-actions">
            <button data-lava-start>시작</button>
            <button data-lava-reset>다시하기</button>
          </div>
        </div>
      </div>
      <div class="mini-game-screen hidden" data-smithing-game>
        <div class="mini-game-card smithing-game-card">
          <header>
            <div>
              <span class="title-kicker">MINI GAME</span>
              <h2>대장간 게임</h2>
              <p>주민이 의뢰한 제작품을 120초 안에 최대한 많이 만들어 납품하세요. 성공할 때마다 50P를 얻습니다.</p>
            </div>
            <button class="mini-game-close" data-smith-back>뒤로</button>
          </header>
          <div class="mini-game-status">
            <strong>이번 점수 <span data-smith-score>0</span>P</strong>
            <strong>성공 <span data-smith-success>0</span>회</strong>
            <strong>남은 시간 <span data-smith-time>120</span>초</strong>
            <strong>보유 포인트 <span data-smith-points>0</span>P</strong>
            <span data-smith-state>시작 대기</span>
          </div>
          <div class="smithing-arena" data-smith-arena>
            <section class="smithing-client">
              <div class="smithing-villager" aria-hidden="true">
                <span class="smithing-head"></span>
                <span class="smithing-body"></span>
              </div>
              <div class="smithing-speech">
                <strong>제작 의뢰</strong>
                <span data-smith-order>대기 중</span>
              </div>
              <button data-smith-deliver>주민에게 주기</button>
            </section>
            <section class="smithing-workbench">
              <button class="smithing-ore" data-smith-hammer type="button">
                <span data-smith-ore-label>광석</span>
                <i data-smith-hit-mark></i>
              </button>
              <div class="smithing-anvil" aria-hidden="true"></div>
              <div class="smithing-product-slot" data-smith-product-slot></div>
              <p data-smith-message>시작을 누르면 주민의 제작 의뢰가 들어옵니다.</p>
            </section>
            <section class="smithing-bin" data-smith-trash>
              <strong>쓰레기통</strong>
              <span>틀린 제작품은 여기로 드래그하거나 우클릭</span>
            </section>
          </div>
          <div class="mini-game-actions">
            <button data-smith-start>시작</button>
            <button data-smith-reset>다시하기</button>
          </div>
        </div>
      </div>
    `;

  titleScreenEl.querySelector<HTMLElement>(".title-menu")!.innerHTML = `
      <div class="title-topbar" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="title-kicker" style="margin-bottom:0;">YUNU GAME LAB</div>
        <span style="font-size:13px;font-weight:800;color:#fde68a;white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.7);">보유 포인트 <b data-title-points>0</b>P</span>
      </div>
      <h1>1인칭 야생 마을</h1>
      <p class="title-nickname">모험가: <b data-player-nickname>이름을 정해 주세요</b></p>
      <div class="class-select" data-class-select>
        <strong>직업 선택</strong>
        <div class="class-grid">
          ${view.playerClasses
            .map(
              (playerClass) => `
                <button class="class-card" data-class-choice="${escapeAttr(playerClass.id)}" type="button">
                  <span>${escapeHtml(playerClass.name)}</span>
                  <b>${escapeHtml(playerClass.skillName)}</b>
                  <small>${escapeHtml(playerClass.tagline)}</small>
                  <em>${escapeHtml(playerClass.passiveLabel)} · ${escapeHtml(playerClass.passiveSummary)}</em>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="difficulty-select" data-difficulty-select>
        <strong>난이도 선택 (게임 중 변경 불가)</strong>
        <div class="difficulty-grid" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;">
          <button class="difficulty-btn" data-difficulty="easy" type="button" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#f3ead6;cursor:pointer;font-size:14px;">😊 쉬움</button>
          <button class="difficulty-btn" data-difficulty="hard" type="button" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#f3ead6;cursor:pointer;font-size:14px;">🔥 어려움</button>
        </div>
        <small style="opacity:.7;">어려움: 몬스터 더 강하고 빠름 · 드랍·경험치 ↓ · 상점 비쌈. 기본은 쉬움.</small>
      </div>
      <div class="quality-select" data-quality-select>
        <strong>그래픽 품질 (렉 줄이기)</strong>
        <div class="quality-grid" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0;">
          <button class="quality-btn" data-quality="high" type="button" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#f3ead6;cursor:pointer;font-size:14px;">고품질</button>
          <button class="quality-btn" data-quality="balanced" type="button" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#f3ead6;cursor:pointer;font-size:14px;">보통</button>
          <button class="quality-btn" data-quality="performance" type="button" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#f3ead6;cursor:pointer;font-size:14px;">⚡ 저사양</button>
        </div>
        <small style="opacity:.7;">저사양: 그림자 끔 · 해상도·시야거리 ↓ → 저사양 노트북도 매끄럽게.</small>
      </div>
      <div class="title-actions">
        <button data-title-new>새로시작</button>
        <button data-title-load>불러오기</button>
        <button data-title-party>파티</button>
        <button data-title-mini>구슬 튕기기</button>
        <button data-title-lava>용암을 피해라</button>
        <button data-title-smith>대장간 게임</button>
      </div>
    `;
}
