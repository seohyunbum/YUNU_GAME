import { PLAYER_CLASSES } from "../game/classes";
import { SECOND_SKILLS } from "../game/classSkills";
import type { PlayerClassId } from "../game/types";

// 직업별 두 스킬(R 1차 / T 2차)에 어울리는 아이콘. 스킬 동작 기준으로 선정.
const SKILL_ICONS: Record<PlayerClassId, { primary: string; second: string }> = {
  warrior: { primary: "⚔️", second: "🔥" }, // 무거운공격 / 불타는 공격
  healer: { primary: "💚", second: "🌧️" }, // 천상치유 / 치유의 비
  mage: { primary: "💣", second: "☄️" }, // TNT발사 / 파이어볼
  summoner: { primary: "🦅", second: "🌪️" }, // 독수리소환술 / 바람 정령
  gunner: { primary: "🔫", second: "💨" }, // 강탄 / 속사
  tanker: { primary: "🛡️", second: "♨️" }, // 철벽방어 / 불타는 방패
};

export interface SkillSlotView {
  icon: string;
  name: string;
  hotkey: string;
  total: number; // 쿨타임(초)
  until: number; // 쿨타임 종료 시각 (performance.now() ms 기준). 0 또는 과거면 사용 가능.
}

/**
 * 현재 직업의 두 클래스 스킬(R 1차, T 2차)을 스킬바 슬롯으로 변환.
 * 두 슬롯의 until 은 서로 다른 필드(classSkillCooldownUntil / secondSkillCooldownUntil)에서
 * 오므로 쿨타임이 독립적으로 표시된다.
 */
export function buildSkillSlots(playerClass: PlayerClassId, classUntil: number, secondUntil: number): SkillSlotView[] {
  const icons = SKILL_ICONS[playerClass];
  const primary = PLAYER_CLASSES[playerClass];
  const second = SECOND_SKILLS[playerClass];
  return [
    { icon: icons.primary, name: primary.skillName, hotkey: "R", total: primary.cooldown, until: classUntil },
    { icon: icons.second, name: second.name, hotkey: "T", total: second.cooldown, until: secondUntil },
  ];
}

let ticking = false;

// 쿨타임 숫자/오버레이를 매 프레임 갱신 — HUD 재렌더 주기(이동·마나재생 의존)와 무관하게
// 가만히 서 있어도 매끄럽게 카운트다운된다. 모든 타일이 준비되면 스스로 멈춘다.
function startCooldownTicker(barEl: HTMLElement): void {
  if (ticking) return;
  ticking = true;
  const tick = () => {
    const now = performance.now();
    let active = false;
    const tiles = barEl.querySelectorAll<HTMLElement>(".skill-tile");
    for (const tile of tiles) {
      const until = Number(tile.dataset.until ?? "0");
      const total = Number(tile.dataset.total ?? "0");
      const remaining = Math.max(0, (until - now) / 1000);
      const overlay = tile.querySelector<HTMLElement>(".skill-cd");
      const text = tile.querySelector<HTMLElement>(".skill-cd-text");
      if (remaining > 0.05) {
        active = true;
        tile.classList.add("on-cd");
        if (overlay) overlay.style.transform = `scaleY(${total > 0 ? Math.min(1, remaining / total) : 0})`;
        if (text) text.textContent = String(Math.ceil(remaining));
      } else {
        tile.classList.remove("on-cd");
        if (overlay) overlay.style.transform = "scaleY(0)";
        if (text) text.textContent = "";
      }
    }
    if (active) requestAnimationFrame(tick);
    else ticking = false;
  };
  requestAnimationFrame(tick);
}

/** 스킬바 컨테이너를 1회 생성해 parent(보통 .game-ui)에 붙인다. 핫바 위 중앙에 위치(CSS). */
export function ensureSkillBar(parent: HTMLElement): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "skill-bar";
  for (let i = 0; i < 2; i += 1) {
    const tile = document.createElement("div");
    tile.className = "skill-tile";
    tile.innerHTML =
      '<span class="skill-hotkey"></span>' +
      '<span class="skill-icon"></span>' +
      '<span class="skill-cd"></span>' +
      '<span class="skill-cd-text"></span>' +
      '<span class="skill-name"></span>';
    bar.appendChild(tile);
  }
  parent.appendChild(bar);
  return bar;
}

/** 슬롯 데이터를 타일에 반영하고 쿨타임 틱을 가동한다. */
export function renderSkillBar(barEl: HTMLElement, slots: SkillSlotView[]): void {
  const tiles = barEl.querySelectorAll<HTMLElement>(".skill-tile");
  slots.forEach((slot, index) => {
    const tile = tiles[index];
    if (!tile) return;
    const hotkey = tile.querySelector<HTMLElement>(".skill-hotkey");
    const icon = tile.querySelector<HTMLElement>(".skill-icon");
    const name = tile.querySelector<HTMLElement>(".skill-name");
    if (hotkey) hotkey.textContent = slot.hotkey;
    if (icon) icon.textContent = slot.icon;
    if (name) name.textContent = slot.name;
    tile.title = `${slot.name} (${slot.hotkey}) · 쿨타임 ${slot.total}초`;
    tile.dataset.until = String(slot.until);
    tile.dataset.total = String(slot.total);
  });
  startCooldownTicker(barEl);
}
