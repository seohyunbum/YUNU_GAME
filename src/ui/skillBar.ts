import { PLAYER_CLASSES } from "../game/classes";
import { SECOND_SKILLS, THIRD_SKILLS } from "../game/classSkills";
import type { PlayerClassId } from "../game/types";

// 직업별 세 스킬(R 1차 / T 2차 / F 3차=전직 해금)에 어울리는 아이콘. 스킬 동작 기준으로 선정.
const SKILL_ICONS: Record<PlayerClassId, { primary: string; second: string; third: string }> = {
  warrior: { primary: "⚔️", second: "🔥", third: "🌋" }, // 무거운공격 / 불타는 공격 / 대지가르기
  healer: { primary: "💚", second: "🌧️", third: "✨" }, // 천상치유 / 치유의 비 / 심판의 빛
  mage: { primary: "💣", second: "☄️", third: "🌠" }, // TNT발사 / 파이어볼 / 메테오
  summoner: { primary: "🦅", second: "🌪️", third: "🍃" }, // 독수리소환술 / 바람 정령 / 정령 폭풍
  gunner: { primary: "🔫", second: "💨", third: "🎯" }, // 강탄 / 속사 / 관통 강탄
  tanker: { primary: "🛡️", second: "♨️", third: "📣" }, // 철벽방어 / 불타는 방패 / 불굴의 함성
};

export interface SkillSlotView {
  icon: string;
  name: string;
  hotkey: string;
  total: number; // 쿨타임(초)
  until: number; // 쿨타임 종료 시각 (performance.now() ms 기준). 0 또는 과거면 사용 가능.
}

/**
 * 현재 직업의 클래스 스킬을 스킬바 슬롯으로 변환.
 * 기본 2슬롯(R 1차, T 2차). jobTier>=1(1차 전직)이면 3슬롯(F 3차)이 추가된다.
 * 각 슬롯의 until 은 서로 다른 필드에서 오므로 쿨타임이 독립적으로 표시된다.
 */
export function buildSkillSlots(playerClass: PlayerClassId, classUntil: number, secondUntil: number, thirdUntil: number, jobTier: number): SkillSlotView[] {
  const icons = SKILL_ICONS[playerClass];
  const primary = PLAYER_CLASSES[playerClass];
  const second = SECOND_SKILLS[playerClass];
  const slots: SkillSlotView[] = [
    { icon: icons.primary, name: primary.skillName, hotkey: "R", total: primary.cooldown, until: classUntil },
    { icon: icons.second, name: second.name, hotkey: "T", total: second.cooldown, until: secondUntil },
  ];
  if (jobTier >= 1) {
    const third = THIRD_SKILLS[playerClass];
    slots.push({ icon: icons.third, name: third.name, hotkey: "F", total: third.cooldown, until: thirdUntil });
  }
  return slots;
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
  const SKILL_CODES = ["KeyR", "KeyT", "KeyF"];
  for (let i = 0; i < 3; i += 1) {
    const tile = document.createElement("div");
    tile.className = "skill-tile";
    tile.innerHTML =
      '<span class="skill-hotkey"></span>' +
      '<span class="skill-icon"></span>' +
      '<span class="skill-cd"></span>' +
      '<span class="skill-cd-text"></span>' +
      '<span class="skill-name"></span>';
    // 스킬 아이콘 탭/클릭 = 해당 스킬 발동(데스크톱 R/T/F 키 경로 재사용 — 합성 keydown). 터치·데스크톱 공통.
    const code = SKILL_CODES[i];
    tile.addEventListener("click", () => { window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true })); window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true })); }); // keyup 동반 — 합성 keydown 이 this.keys 에 영구 잔류하지 않도록
    bar.appendChild(tile);
  }
  parent.appendChild(bar);
  return bar;
}

/** 슬롯 데이터를 타일에 반영하고 쿨타임 틱을 가동한다. */
export function renderSkillBar(barEl: HTMLElement, slots: SkillSlotView[]): void {
  const tiles = barEl.querySelectorAll<HTMLElement>(".skill-tile");
  tiles.forEach((tile, index) => {
    const slot = slots[index];
    if (!slot) {
      tile.style.display = "none"; // 미해금 슬롯(전직 전 3번째 등)은 숨긴다
      return;
    }
    tile.style.display = "";
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
