// 인게임 좌측 상단(새로시작/저장/불러오기 아래) 고정 조작법 가이드 — 그룹별 키칩으로 직관적 표시.
// 키 바인딩은 main.ts keydown 핸들러와 일치해야 한다 (WASD/Shift/C/Space/E/좌·우클릭/R/T/I/B/M/Q/Enter/O).

const GROUPS: { title: string; items: { key: string; label: string; accent?: boolean }[] }[] = [
  { title: "이동", items: [
    { key: "WASD", label: "이동" },
    { key: "Shift+W", label: "달리기" },
    { key: "Shift", label: "웅크리기" },
    { key: "C", label: "엎드리기" },
    { key: "Space", label: "점프" },
  ] },
  { title: "전투·스킬", items: [
    { key: "좌클릭", label: "공격" },
    { key: "R", label: "직업 스킬" },
    { key: "T", label: "두번째 스킬" },
  ] },
  { title: "상호작용", items: [
    { key: "E", label: "줍기·대화·진입" },
    { key: "우클릭", label: "사용·먹기" },
  ] },
  { title: "메뉴", items: [
    { key: "I", label: "가방" },
    { key: "B", label: "도감" },
    { key: "M", label: "지도" },
    { key: "Q", label: "퀘스트·보상", accent: true },
    { key: "ESC", label: "마우스 커서 보이기 / 창 닫기", accent: true },
  ] },
  { title: "파티", items: [
    { key: "O", label: "파티 초대", accent: true },
    { key: "Enter", label: "파티 채팅", accent: true },
  ] },
];

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderControlsGuide(el: HTMLElement) {
  el.innerHTML =
    `<div class="controls-guide-title">🎮 조작법</div>` +
    GROUPS.map(
      (group) =>
        `<div class="controls-guide-group">` +
        `<div class="controls-guide-grouptitle">${escapeHtml(group.title)}</div>` +
        group.items
          .map(
            (control) =>
              `<span class="control-row${control.accent ? " control-row-accent" : ""}"><kbd>${escapeHtml(control.key)}</kbd>${escapeHtml(control.label)}</span>`,
          )
          .join("") +
        `</div>`,
    ).join("");
}
