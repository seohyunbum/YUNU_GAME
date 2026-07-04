import { BALANCE_TUNABLES, bal, balanceSnapshot, clearLocalOverrides, publishGlobalBalance, resetGlobalBalance, setLocalOverride } from "../game/balanceTuning";

// F8 어드민 밸런스 패널 — 숨김(조작 안내 미표기). 슬라이더 조정 = 로컬(localStorage) 즉시 반영,
// "전체 적용" = Firebase 저장(모든 기기 부팅 시 반영, 화이트리스트+클램프 방어). leaf: main.ts import 금지.
// 전체 적용/초기화는 아이 오조작 방지용 PIN 게이트(보안 목적 아님 — 번들에 노출되어도 클램프가 안전망).

const ADMIN_PIN = "7777";

export function renderAdminPanel(panelEl: HTMLElement, callbacks: { onClose(): void; showMessage(text: string): void }): void {
  const groups = new Map<string, typeof BALANCE_TUNABLES[number][]>();
  for (const tunable of BALANCE_TUNABLES) {
    if (!groups.has(tunable.group)) groups.set(tunable.group, []);
    groups.get(tunable.group)!.push(tunable);
  }
  const snapshot = new Map(balanceSnapshot().map((entry) => [entry.key, entry]));
  const rows = [...groups.entries()].map(([group, tunables]) => `
      <section class="admin-group">
        <h3>${group}</h3>
        ${tunables.map((tunable) => {
          const entry = snapshot.get(tunable.key)!;
          const overridden = entry.local !== undefined || entry.global !== undefined;
          return `
          <label class="admin-row${overridden ? " overridden" : ""}" data-admin-row="${tunable.key}">
            <span class="admin-label">${tunable.label}${entry.global !== undefined ? " 🌐" : ""}</span>
            <input type="range" data-admin-slider="${tunable.key}" min="${tunable.min}" max="${tunable.max}" step="${tunable.step}" value="${entry.effective}" />
            <input type="number" data-admin-number="${tunable.key}" min="${tunable.min}" max="${tunable.max}" step="${tunable.step}" value="${entry.effective}" />
            <button type="button" data-admin-reset="${tunable.key}" title="기본값(${tunable.def})으로">↺</button>
          </label>`;
        }).join("")}
      </section>`).join("");

  panelEl.innerHTML = `
    <div class="panel admin-panel">
      <div class="panel-header">
        <h2>🛠 밸런스 튜닝 (관리자)</h2>
        <button class="icon-button" data-admin-close>닫기</button>
      </div>
      <p class="admin-hint">슬라이더 = <strong>이 기기에서 즉시 적용</strong>(실험, 새로고침에도 유지). 마음에 들면 <strong>전체 적용</strong>으로 모든 기기에 반영하세요. 🌐 = 전역 적용된 값.</p>
      <div class="admin-scroll">${rows}</div>
      <div class="admin-actions">
        <button type="button" data-admin-clear-local>이 기기 실험값 모두 초기화</button>
        <button type="button" data-admin-publish>🌐 전체 적용 (모든 기기)</button>
        <button type="button" data-admin-reset-global>🌐 전역 초기화 (기본값 복귀)</button>
      </div>
    </div>`;

  panelEl.querySelector<HTMLButtonElement>("[data-admin-close]")?.addEventListener("click", callbacks.onClose);

  const syncRow = (key: string) => {
    const tunable = BALANCE_TUNABLES.find((entry) => entry.key === key)!;
    const value = bal(key, tunable.def);
    const slider = panelEl.querySelector<HTMLInputElement>(`[data-admin-slider="${key}"]`);
    const number = panelEl.querySelector<HTMLInputElement>(`[data-admin-number="${key}"]`);
    if (slider) slider.value = String(value);
    if (number) number.value = String(value);
    panelEl.querySelector(`[data-admin-row="${key}"]`)?.classList.toggle("overridden", Math.abs(value - tunable.def) > 1e-9);
  };

  for (const tunable of BALANCE_TUNABLES) {
    const apply = (raw: string) => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return;
      setLocalOverride(tunable.key, value);
      syncRow(tunable.key);
    };
    panelEl.querySelector<HTMLInputElement>(`[data-admin-slider="${tunable.key}"]`)?.addEventListener("input", (event) => apply((event.target as HTMLInputElement).value));
    panelEl.querySelector<HTMLInputElement>(`[data-admin-number="${tunable.key}"]`)?.addEventListener("change", (event) => apply((event.target as HTMLInputElement).value));
    panelEl.querySelector<HTMLButtonElement>(`[data-admin-reset="${tunable.key}"]`)?.addEventListener("click", () => { setLocalOverride(tunable.key, null); syncRow(tunable.key); });
  }

  panelEl.querySelector<HTMLButtonElement>("[data-admin-clear-local]")?.addEventListener("click", () => {
    clearLocalOverrides();
    for (const tunable of BALANCE_TUNABLES) syncRow(tunable.key);
    callbacks.showMessage("이 기기의 밸런스 실험값을 모두 초기화했습니다 (전역 적용값·기본값으로 복귀).");
  });

  const pinOk = () => {
    const input = typeof prompt === "function" ? prompt("관리자 PIN (오조작 방지)") : null;
    if (input === ADMIN_PIN) return true;
    if (input !== null) callbacks.showMessage("PIN 이 일치하지 않습니다.");
    return false;
  };

  panelEl.querySelector<HTMLButtonElement>("[data-admin-publish]")?.addEventListener("click", () => {
    if (!pinOk()) return;
    void publishGlobalBalance().then((ok) => {
      callbacks.showMessage(ok ? "🌐 전체 적용 완료 — 모든 기기가 다음 접속(새로고침)부터 이 밸런스를 사용합니다." : "전체 적용 실패 — 네트워크 상태를 확인해 주세요.");
      if (ok) for (const tunable of BALANCE_TUNABLES) syncRow(tunable.key);
    });
  });

  panelEl.querySelector<HTMLButtonElement>("[data-admin-reset-global]")?.addEventListener("click", () => {
    if (!pinOk()) return;
    void resetGlobalBalance().then((ok) => {
      callbacks.showMessage(ok ? "🌐 전역 밸런스를 초기화했습니다 — 모든 기기가 코드 기본값으로 복귀합니다." : "전역 초기화 실패 — 네트워크 상태를 확인해 주세요.");
      if (ok) for (const tunable of BALANCE_TUNABLES) syncRow(tunable.key);
    });
  });
}
