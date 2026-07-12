// 캐릭터 정보 창 — 착용 장비 + 스탯 확인, 제작 레벨업으로 얻은 스탯 포인트 분배.
// leaf: main.ts 를 import 하지 않는다 (view model + 콜백만 받는다).
import { initItemTooltips } from "./itemTooltip";
import type { FortressLeaderboards, LeaderboardResult } from "../game/progressSync";

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
  ownedArmors: { item: string; name: string; equipped: boolean }[]; // 보유 방어구(갑옷) — K창에서 골라 착용(목걸이와 동일)
  ownedShields: { item: string; name: string; equipped: boolean }[]; // 보유 방패 — K창에서 골라 착용
  equippedSpiritLabel: string; // 장착 정령 표시명("없음" 가능)
  equippedSpiritGradeIndex: number; // 장착 정령 등급 인덱스(-1=없음) — 낮은 등급 일괄먹이기 기준
  spirits: { id: string; label: string; emoji: string; color: string; grade: string; gradeIndex: number; attack: number; defense: number; level: number; equipped: boolean }[]; // 보유 정령(등급 높은 순 정렬, 보관함 팝업에서 관리)
  spiritManagerOpen: boolean; // 정령 보관함 팝업(팝업내 팝업) 열림 상태
  canGiftSpirits: boolean; // 파티 중(다른 파티원 존재) — 정령 카드에 🎁 선물 버튼 표시
  dragonGear: { item: string; name: string; equipped: boolean }[]; // 보유 용 장비 + 부위별 착용 여부(K창에서 토글)
  craftStatPoints: number;
  alloc: { hp: number; mana: number; attack: number; defense: number };
  monstersKilled: number; // 누적 처치 몬스터 수(기록)
  bestFortressStageEasy: number; // 내 요새 최고 단계(쉬움, 0 = 아직 없음)
  bestFortressStageHard: number; // 내 요새 최고 단계(어려움)
  leaderboards: FortressLeaderboards | null; // 난이도별 전체 랭킹(null = 불러오는 중)
  myNickname: string; // 내 행 강조용
}

export interface CharacterPanelCallbacks {
  onSpend(kind: "hp" | "mana" | "attack" | "defense"): void;
  onEquipNecklace(item: string | null): void;
  onEquipArmor(item: string | null): void; // 방어구 착용/해제("" = 해제)
  onEquipShield(item: string | null): void; // 방패 착용/해제("" = 해제)
  onEquipDragonGear(item: string): void; // 용 장비 부위 토글(켜짐↔꺼짐)
  onEquipSpirit(id: string | null): void;
  onFeedSpirit(id: string): void;
  onGiftSpirit(id: string): void; // 파티원에게 정령 선물(비장착만)
  onOpenSpiritManager(): void;
  onCloseSpiritManager(): void;
  onFeedAllBelowEquipped(): void;
  onClose(): void;
}

// 정령 보관함 팝업(팝업내 팝업) — 100마리도 한 곳에 스크롤로. 등급 높은 순 카드 그리드 + 낮은 등급 일괄 먹이기.
function renderSpiritModal(view: CharacterPanelView): string {
  const hasEquipped = view.equippedSpiritGradeIndex >= 0;
  const belowCount = view.spirits.filter((s) => !s.equipped && s.gradeIndex < view.equippedSpiritGradeIndex).length;
  const cards = view.spirits
    .map(
      (s) => `<div class="spirit-card${s.equipped ? " equipped" : ""}" style="--sc:${s.color}">
        <div class="spirit-card-emoji">${s.emoji}</div>
        <div class="spirit-card-name" style="color:${s.color}">${escapeHtml(s.label)} <b>Lv${s.level}</b></div>
        <div class="spirit-card-stats">공 +${s.attack} · 방 +${s.defense}</div>
        <div class="spirit-card-actions">${
          s.equipped
            ? `<span class="spirit-card-tag">장착중 ✓</span>`
            : `<button class="spirit-card-equip" data-equip-spirit="${escapeHtml(s.id)}">장착</button>${hasEquipped ? `<button class="spirit-card-feed" data-feed-spirit="${escapeHtml(s.id)}" title="장착 정령에게 먹여 경험치(이 정령은 사라집니다)">🍽️</button>` : ""}${view.canGiftSpirits ? `<button class="spirit-card-feed" data-gift-spirit="${escapeHtml(s.id)}" title="파티원에게 선물(내 목록에서 사라집니다)">🎁</button>` : ""}`
        }</div>
      </div>`,
    )
    .join("");
  return `
    <div class="spirit-modal" data-spirit-modal>
      <div class="spirit-modal-backdrop" data-close-spirit-modal></div>
      <div class="spirit-modal-card">
        <header class="spirit-modal-head">
          <h3>✨ 정령 보관함 <span class="spirit-modal-count">${view.spirits.length}마리</span></h3>
          <button class="icon-button" data-close-spirit-modal>닫기</button>
        </header>
        <div class="spirit-modal-equipped">장착 중: <strong>${escapeHtml(view.equippedSpiritLabel)}</strong></div>
        <div class="spirit-modal-tools">
          ${hasEquipped ? `<button class="spirit-modal-tool" data-equip-spirit="">장착 해제</button>` : ""}
          ${hasEquipped && belowCount > 0 ? `<button class="spirit-modal-tool spirit-bulk-feed" data-feed-below>🍽️ 낮은 등급 일괄 먹이기 (${belowCount}마리)</button>` : ""}
        </div>
        <div class="spirit-modal-grid">${cards}</div>
        <p class="spirit-modal-note">등급 높은 순 정렬 · 🍽️ = 장착 정령에게 먹여 경험치(먹인 정령 소멸)</p>
      </div>
    </div>`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 착용 아이템이 있을 때만 마우스오버 툴팁용 data-item 속성을 만든다.
function gearInfoAttr(item: string | null) {
  return item ? ` data-item="${escapeHtml(item)}"` : "";
}

// 목걸이·방어구·방패 공통 — 한 번에 하나만 착용하는 장비의 선택 버튼 행(현재 착용 표시 + 보유 목록 + 해제).
// attr = data 속성명(data-equip-necklace / data-equip-armor / data-equip-shield). 빈 문자열 버튼 = 해제.
function gearChoiceRow(emoji: string, label: string, currentItem: string | null, currentLabel: string, owned: { item: string; name: string; equipped: boolean }[], attr: string, emptyMsg: string): string {
  const choices =
    owned.length > 0
      ? `<div class="character-necklace-choices">${owned
          .map((n) => `<button class="character-necklace-choice${n.equipped ? " equipped" : ""}" ${attr}="${escapeHtml(n.item)}" data-item="${escapeHtml(n.item)}">${escapeHtml(n.name)}${n.equipped ? " ✓" : ""}</button>`)
          .join("")}${owned.some((n) => n.equipped) ? `<button class="character-necklace-choice" ${attr}="">해제</button>` : ""}</div>`
      : `<div class="character-necklace-empty">${escapeHtml(emptyMsg)}</div>`;
  return `<div class="character-gear-row"${gearInfoAttr(currentItem)}><span>${emoji} ${escapeHtml(label)}</span><strong>${escapeHtml(currentLabel)}</strong></div>${choices}`;
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const DRAGON_GEAR_ICONS: Record<string, string> = { dragon_gloves: "🧤", dragon_boots: "🥾", dragon_cloak: "🧥", dragon_crown: "👑" };

// 전체 플레이어 TOP N 렌더(요새 최고 단계 기준). 내 행은 (나) 강조, top 밖이면 내 순위 별도 표시.
function renderLeaderboard(board: LeaderboardResult | null, myNickname: string): string {
  if (board === null) return `<div class="character-necklace-empty">불러오는 중…</div>`;
  if (board.top.length === 0) return `<div class="character-necklace-empty">아직 요새 기록이 없어요. 1등에 도전해 보세요! (오프라인이면 잠시 후 다시 열어보세요)</div>`;
  const rows = board.top
    .map((entry, i) => {
      const self = entry.nickname === myNickname;
      const lvCtx = entry.baseLevel > 0 ? ` · Lv${entry.baseLevel}` : ""; // 도전 레벨 맥락(같은 단계라도 난이도 차이를 드러냄). 레거시 기록은 생략
      return `<div class="character-gear-row"><span>${RANK_MEDALS[i] ?? `${i + 1}.`} ${escapeHtml(entry.nickname)}${self ? " <b>(나)</b>" : ""}</span><strong>${entry.stage}단계${lvCtx}</strong></div>`;
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
        ${points > 0 ? `<div class="character-points-banner" role="status">🔨 제작을 하면 능력치 포인트를 받아요 — 분배할 포인트 <b>${points}</b>개! 아래 <span class="character-points-plus">＋</span> 버튼으로 체력·공격력 등을 올리세요</div>` : ""}
        <div class="character-body">
          <div class="character-gear">
            <div class="inventory-label">착용 장비</div>
            <div class="character-gear-row"${gearInfoAttr(view.weaponItem)}><span>🗡️ 무기</span><strong>${escapeHtml(view.weapon)}</strong></div>
            ${gearChoiceRow("🛡️", "방어구", view.armorItem, view.armor, view.ownedArmors, "data-equip-armor", "보유한 방어구가 없습니다. 제작대에서 가죽 갑옷부터 만들어 보세요.")}
            ${gearChoiceRow("🔰", "방패", view.shieldItem, view.shield, view.ownedShields, "data-equip-shield", "보유한 방패가 없습니다. 제작대에서 철 방패를 만들거나 상점에서 구하세요.")}
            ${gearChoiceRow("📿", "목걸이", view.necklaceItem, view.necklace, view.ownedNecklaces, "data-equip-necklace", "보유한 목걸이가 없습니다. 확장 제작대에서 만들거나 흑요석 상자에서 얻으세요.")}
            <div class="character-gear-row"><span>🐉 용 장비</span><strong>${view.dragonGear.length > 0 ? `${view.dragonGear.filter((g) => g.equipped).length}/4 착용 중` : "없음"}</strong></div>
            ${
              view.dragonGear.length > 0
                ? `<div class="character-necklace-choices">${view.dragonGear
                    .map((g) => `<button class="character-necklace-choice${g.equipped ? " equipped" : ""}" data-toggle-dragon="${escapeHtml(g.item)}" data-item="${escapeHtml(g.item)}">${escapeHtml(DRAGON_GEAR_ICONS[g.item] ?? "🐉")} ${escapeHtml(g.name)}${g.equipped ? " ✓" : ""}</button>`)
                    .join("")}</div>`
                : `<div class="character-necklace-empty">용 장비(장갑·부츠·망토·왕관)는 확장 제작대에서 용 재료로 제작한 뒤, 여기서 부위를 눌러 착용/해제하세요.</div>`
            }
            <div class="character-gear-row"><span>✨ 정령</span><strong>${escapeHtml(view.equippedSpiritLabel)}</strong></div>
            ${
              view.spirits.length > 0
                ? `<button class="character-spirit-open" data-open-spirit-modal>✨ 정령 보관함 열기 · ${view.spirits.length}마리 보유 ›</button>`
                : `<div class="character-necklace-empty">보유한 정령이 없습니다. '정령 소환권'(전설)을 사냥·상자에서 얻어 사용하세요.</div>`
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
          <div class="character-gear-row"><span>🏰 요새 최고 (😊쉬움)</span><strong>${view.bestFortressStageEasy > 0 ? `${view.bestFortressStageEasy}단계` : "아직 없음"}</strong></div>
          <div class="character-gear-row"><span>🏰 요새 최고 (🔥어려움)</span><strong>${view.bestFortressStageHard > 0 ? `${view.bestFortressStageHard}단계` : "아직 없음"}</strong></div>
        </div>
        <div class="character-gear character-records">
          <div class="inventory-label">🏆 요새 랭킹 TOP 3 <span class="character-records-sub">(단계 · 도전 레벨)</span></div>
          <div class="character-records-sub" style="margin:4px 0 2px;">😊 쉬움</div>
          ${renderLeaderboard(view.leaderboards?.easy ?? null, view.myNickname)}
          <div class="character-records-sub" style="margin:8px 0 2px;">🔥 어려움</div>
          ${renderLeaderboard(view.leaderboards?.hard ?? null, view.myNickname)}
        </div>
        <p class="character-note">제작 레벨이 오르면 포인트를 얻어 위 스탯을 올릴 수 있어요 (체력·마나 +2, 공격·방어 +1).</p>
        ${view.spiritManagerOpen ? renderSpiritModal(view) : ""}
      </section>
    `;
  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-spend]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onSpend(button.dataset.spend as "hp" | "mana" | "attack" | "defense"));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip-spirit]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipSpirit(button.dataset.equipSpirit ? button.dataset.equipSpirit : null));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-feed-spirit]").forEach((button) => {
    button.addEventListener("click", () => { if (button.dataset.feedSpirit) callbacks.onFeedSpirit(button.dataset.feedSpirit); });
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-gift-spirit]").forEach((button) => {
    button.addEventListener("click", () => { if (button.dataset.giftSpirit) callbacks.onGiftSpirit(button.dataset.giftSpirit); });
  });
  panelEl.querySelector<HTMLButtonElement>("[data-open-spirit-modal]")?.addEventListener("click", callbacks.onOpenSpiritManager);
  panelEl.querySelectorAll<HTMLElement>("[data-close-spirit-modal]").forEach((el) => el.addEventListener("click", callbacks.onCloseSpiritManager));
  panelEl.querySelector<HTMLButtonElement>("[data-feed-below]")?.addEventListener("click", callbacks.onFeedAllBelowEquipped);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip-necklace]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipNecklace(button.dataset.equipNecklace ? button.dataset.equipNecklace : null));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip-armor]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipArmor(button.dataset.equipArmor ? button.dataset.equipArmor : null));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-equip-shield]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onEquipShield(button.dataset.equipShield ? button.dataset.equipShield : null));
  });
  panelEl.querySelectorAll<HTMLButtonElement>("[data-toggle-dragon]").forEach((button) => {
    button.addEventListener("click", () => { if (button.dataset.toggleDragon) callbacks.onEquipDragonGear(button.dataset.toggleDragon); });
  });
  initItemTooltips();
}
