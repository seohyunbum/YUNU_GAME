// 캐릭터 정보 창 — 착용 장비 + 스탯 확인, 제작 레벨업으로 얻은 스탯 포인트 분배.
// leaf: main.ts 를 import 하지 않는다 (view model + 콜백만 받는다).
import { initItemTooltips } from "./itemTooltip";
import type { LeaderboardResult } from "../game/progressSync";

export interface CharacterPanelView {
  className: string;
  level: number;
  craftLevel: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  weapon: string;
  armor: string;
  shield: string;
  necklace: string;
  weaponItem: string | null;
  armorItem: string | null;
  shieldItem: string | null;
  necklaceItem: string | null;
  ownedNecklaces: { item: string; name: string; equipped: boolean }[];
  craftStatPoints: number;
  alloc: { hp: number; mana: number; attack: number; defense: number };
  monstersKilled: number; // 누적 처치 몬스터 수(기록)
  bestFortressStage: number; // 몬스터 요새 최고 클리어 단계(0 = 아직 없음)
  leaderboard: LeaderboardResult | null; // 전체 플레이어 랭킹(null = 불러오는 중)
  myNickname: string; // 내 행 강조용
}

export interface CharacterPanelCallbacks {
  onSpend(kind: "hp" | "mana" | "attack" | "defense"): void;
  onEquipNecklace(item: string | null): void;
  onClose(): void;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 착용 아이템이 있을 때만 마우스오버 툴팁용 data-item 속성을 만든다.
function gearInfoAttr(item: string | null) {
  return item ? ` data-item="${escapeHtml(item)}"` : "";
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

// 전체 플레이어 TOP N 렌더(요새 최고 단계 기준). 내 행은 (나) 강조, top 밖이면 내 순위 별도 표시.
function renderLeaderboard(board: LeaderboardResult | null, myNickname: string): string {
  if (board === null) return `<div class="character-necklace-empty">불러오는 중…</div>`;
  if (board.top.length === 0) return `<div class="character-necklace-empty">아직 요새 기록이 없어요. 1등에 도전해 보세요! (오프라인이면 잠시 후 다시 열어보세요)</div>`;
  const rows = board.top
    .map((entry, i) => {
      const self = entry.nickname === myNickname;
      return `<div class="character-gear-row"><span>${RANK_MEDALS[i] ?? `${i + 1}.`} ${escapeHtml(entry.nickname)}${self ? " <b>(나)</b>" : ""}</span><strong>${entry.stage}단계 · ${entry.kills.toLocaleString("ko-KR")}마리</strong></div>`;
    })
    .join("");
  const mine = board.myRank && board.myRank > board.top.length ? `<div class="character-necklace-empty">내 순위 ${board.myRank}위 / 총 ${board.total}명</div>` : "";
  return rows + mine;
}

const STAT_ROWS: { kind: "hp" | "mana" | "attack" | "defense"; label: string; per: number }[] = [
  { kind: "hp", label: "체력", per: 2 },
  { kind: "mana", label: "마나", per: 2 },
  { kind: "attack", label: "공격력", per: 1 },
  { kind: "defense", label: "방어력", per: 1 },
];

export function renderCharacterPanelView(panelEl: HTMLElement, view: CharacterPanelView, callbacks: CharacterPanelCallbacks) {
  const value = (kind: "hp" | "mana" | "attack" | "defense") =>
    kind === "hp" ? `${Math.ceil(view.health)} / ${view.maxHealth}` : kind === "mana" ? `${Math.floor(view.mana)} / ${view.maxMana}` : kind === "attack" ? `${view.attack}` : `${view.defense}`;
  const points = Math.max(0, view.craftStatPoints);
  panelEl.innerHTML = `
      <section class="panel character-panel${points > 0 ? " has-points" : ""}">
        <header>
          <div>
            <h2>캐릭터 정보</h2>
            <p class="inventory-subtitle">${escapeHtml(view.className)} · Lv ${view.level} · 제작 Lv ${view.craftLevel}</p>
          </div>
          <button class="icon-button" data-close>닫기</button>
        </header>
        ${points > 0 ? `<div class="character-points-banner" role="status">🎉 분배할 스탯 포인트 <b>${points}</b>개! 아래 <span class="character-points-plus">＋</span> 버튼으로 능력치를 올리세요</div>` : ""}
        <div class="character-body">
          <div class="character-gear">
            <div class="inventory-label">착용 장비</div>
            <div class="character-gear-row"${gearInfoAttr(view.weaponItem)}><span>🗡️ 무기</span><strong>${escapeHtml(view.weapon)}</strong></div>
            <div class="character-gear-row"${gearInfoAttr(view.armorItem)}><span>🛡️ 방어구</span><strong>${escapeHtml(view.armor)}</strong></div>
            <div class="character-gear-row"${gearInfoAttr(view.shieldItem)}><span>🔰 방패</span><strong>${escapeHtml(view.shield)}</strong></div>
            <div class="character-gear-row"${gearInfoAttr(view.necklaceItem)}><span>📿 목걸이</span><strong>${escapeHtml(view.necklace)}</strong></div>
            ${
              view.ownedNecklaces.length > 0
                ? `<div class="character-necklace-choices">${view.ownedNecklaces
                    .map(
                      (n) =>
                        `<button class="character-necklace-choice${n.equipped ? " equipped" : ""}" data-equip-necklace="${escapeHtml(n.item)}" data-item="${escapeHtml(n.item)}">${escapeHtml(n.name)}${n.equipped ? " ✓" : ""}</button>`,
                    )
                    .join("")}${view.ownedNecklaces.some((n) => n.equipped) ? `<button class="character-necklace-choice" data-equip-necklace="">해제</button>` : ""}</div>`
                : `<div class="character-necklace-empty">보유한 목걸이가 없습니다. 확장 제작대에서 만들거나 흑요석 상자에서 얻으세요.</div>`
            }
          </div>
          <div class="character-stats">
            <div class="inventory-label">스탯 ${points > 0 ? `· 남은 포인트 <b class="character-points">${points}</b>` : ""}</div>
            ${STAT_ROWS.map(
              (row) => `
              <div class="character-stat-row">
                <span class="character-stat-name">${row.label}</span>
                <span class="character-stat-value">${value(row.kind)}</span>
                <span class="character-stat-alloc">제작 +${view.alloc[row.kind] * row.per}</span>
                <button class="character-spend" data-spend="${row.kind}" ${points > 0 ? "" : "disabled"} title="포인트 1 = ${row.label} +${row.per}">+${row.per}</button>
              </div>`,
            ).join("")}
          </div>
        </div>
        <div class="character-gear character-records">
          <div class="inventory-label">📜 기록</div>
          <div class="character-gear-row"><span>🗡️ 잡은 몬스터</span><strong>${view.monstersKilled.toLocaleString("ko-KR")}마리</strong></div>
          <div class="character-gear-row"><span>🏰 요새 최고 단계</span><strong>${view.bestFortressStage > 0 ? `${view.bestFortressStage}단계` : "아직 없음"}</strong></div>
        </div>
        <div class="character-gear character-records">
          <div class="inventory-label">🏆 전체 TOP 3 <span class="character-records-sub">(요새 최고 단계)</span></div>
          ${renderLeaderboard(view.leaderboard, view.myNickname)}
        </div>
        <p class="character-note">제작 레벨이 오르면 포인트를 얻어 위 스탯을 올릴 수 있어요 (체력·마나 +2, 공격·방어 +1).</p>
      </section>
    `;
  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-spend]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onSpend(button.dataset.spend as "hp" | "mana" | "attack" | "defense"));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip-necklace]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipNecklace(button.dataset.equipNecklace ? button.dataset.equipNecklace : null));
  });
  initItemTooltips();
}
