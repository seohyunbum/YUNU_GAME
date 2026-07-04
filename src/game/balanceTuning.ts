import { FIREBASE_CONFIG } from "../onlineConfig";

// 어드민 밸런스 튜닝 — 바탕화면 관리자 페이지(admin/balance-admin.html, build:admin 으로 생성)에서 조정해 전 기기에 배포한다.
// 게임 내 진입점은 없다(F8 패널은 유저 요청으로 제거). leaf(main.ts import 금지).
// 우선순위: 로컬 오버라이드(내 기기 실험, localStorage) > 전역 오버라이드(Firebase, 전체 적용) > 코드 기본값.
// 방어: 레지스트리 화이트리스트 키만 수용 + [min,max] 클램프 — Firebase 가 공개 쓰기라도 게임을 망가뜨릴 수 없다
// (범위 밖/비유한 값은 폐기. spirits/samurai NaN 하드닝과 같은 원칙). 읽기는 bal() 한 곳 — 조회만이라 핫패스 안전.

export interface BalanceTunable {
  key: string;
  label: string;
  group: string;
  def: number;
  min: number;
  max: number;
  step: number;
}

// 튜너블 레지스트리 — 화이트리스트이자 패널 UI 정의. def 는 반드시 코드 기본값과 일치(골든 테스트가 동치 강제).
export const BALANCE_TUNABLES: readonly BalanceTunable[] = [
  // 사무라이
  { key: "samurai_swing", label: "사무라이 공격 스윙 배수(작을수록 빠름)", group: "사무라이", def: 0.75, min: 0.5, max: 1.0, step: 0.01 },
  { key: "samurai_katana_speed", label: "카타나 공속 보너스", group: "사무라이", def: 0.1, min: 0, max: 0.3, step: 0.01 },
  { key: "samurai_katana_attack", label: "카타나 공격 보너스", group: "사무라이", def: 0.05, min: 0, max: 0.3, step: 0.01 },
  { key: "samurai_flurry_pct", label: "난도 타격당 계수", group: "사무라이", def: 0.9, min: 0.3, max: 1.5, step: 0.05 },
  { key: "samurai_dash_pct", label: "도약 피해 계수", group: "사무라이", def: 1.5, min: 0.5, max: 3, step: 0.1 },
  { key: "samurai_dash_width", label: "도약 경로 반폭(칸)", group: "사무라이", def: 3.0, min: 1, max: 6, step: 0.5 },
  { key: "samurai_pierce_pct", label: "무한 찌르기 타격당 계수", group: "사무라이", def: 0.4, min: 0.2, max: 1, step: 0.05 },
  { key: "samurai_moonlight_pct", label: "월광베기 파도당 계수", group: "사무라이", def: 2.2, min: 1, max: 4, step: 0.1 },
  // 전투·성장
  { key: "player_damage_mult", label: "플레이어 공격력 배율(전체)", group: "전투·성장", def: 1, min: 0.5, max: 3, step: 0.05 },
  { key: "monster_damage_mult", label: "몬스터 공격력 배율(전체)", group: "전투·성장", def: 1, min: 0.3, max: 3, step: 0.05 },
  { key: "monster_xp_mult", label: "몬스터 경험치 배율", group: "전투·성장", def: 1, min: 0.5, max: 3, step: 0.05 },
  { key: "drop_chance_mult", label: "드랍 확률 배율", group: "전투·성장", def: 1, min: 0.5, max: 3, step: 0.05 },
  { key: "dragon_hp", label: "드래곤 기본 최대 체력", group: "전투·성장", def: 1000, min: 300, max: 3000, step: 50 },
  { key: "dragon_armor", label: "드래곤 기본 방어", group: "전투·성장", def: 85, min: 20, max: 200, step: 5 },
  // 보급·아이템
  { key: "supply_epic_chance", label: "보급 에픽+ 보너스 확률", group: "보급·아이템", def: 0.2, min: 0, max: 0.6, step: 0.01 },
  { key: "supply_spirit_chance", label: "보급 정령 소환권 확률", group: "보급·아이템", def: 0.11, min: 0, max: 0.5, step: 0.01 },
  { key: "supply_xp_bottle_chance", label: "보급 경험치병 확률", group: "보급·아이템", def: 0.35, min: 0, max: 1, step: 0.05 },
  { key: "spirit_drop_wild", label: "야생 처치 정령권 드랍률", group: "보급·아이템", def: 0.012, min: 0, max: 0.1, step: 0.001 },
  { key: "spirit_drop_boss", label: "보스 처치 정령권 추가 드랍률", group: "보급·아이템", def: 0.03, min: 0, max: 0.3, step: 0.005 },
  // 내구도
  { key: "shield_obsidian_durability", label: "흑요석 방패 내구도", group: "내구도", def: 1000, min: 200, max: 3000, step: 50 },
  { key: "repair_obsidian_shield", label: "흑요석 방패 수리량(재료당)", group: "내구도", def: 300, min: 100, max: 1000, step: 25 },
  // 최종 보스 일리아
  { key: "illia_p1_hp", label: "일리아 1페이즈(봉인) 체력", group: "최종 보스", def: 3000, min: 800, max: 12000, step: 100 },
  { key: "illia_p2_hp", label: "일리아 2페이즈(절망) 체력", group: "최종 보스", def: 4200, min: 1000, max: 16000, step: 100 },
  { key: "illia_armor", label: "일리아 방어(공통 가산)", group: "최종 보스", def: 0, min: -60, max: 120, step: 5 },
  { key: "illia_hit_pct", label: "일리아 피격 피해(최대체력 비율)", group: "최종 보스", def: 0.5, min: 0.1, max: 1, step: 0.05 },
  { key: "illia_telegraph_scale", label: "일리아 예고 시간 배율(높을수록 쉬움)", group: "최종 보스", def: 1, min: 0.6, max: 2, step: 0.1 },
  // 레벨업 성장(직업별) — 레벨 1당 오르는 체력/공격/방어. 기본 = 전 직업 공통(체력 2·공격 1·방어 1, 기존과 동치)
  ...([["warrior", "전사"], ["healer", "힐러"], ["mage", "마법사"], ["summoner", "소환사"], ["gunner", "거너"], ["tanker", "탱커"], ["samurai", "사무라이"]] as const).flatMap(([id, name]) => [
    { key: `levelup_hp_${id}`, label: `${name} 레벨당 체력`, group: "레벨업 성장", def: 2, min: 0, max: 8, step: 0.5 },
    { key: `levelup_attack_${id}`, label: `${name} 레벨당 공격`, group: "레벨업 성장", def: 1, min: 0, max: 5, step: 0.25 },
    { key: `levelup_defense_${id}`, label: `${name} 레벨당 방어`, group: "레벨업 성장", def: 1, min: 0, max: 5, step: 0.25 },
  ]),
];

const LOCAL_KEY = "ai-game-lab:balance-overrides-v1";
const registryByKey = new Map(BALANCE_TUNABLES.map((tunable) => [tunable.key, tunable]));

// 오염 방어 — 화이트리스트 키 + 유한수 + [min,max] 클램프만 통과. Firebase/localStorage 양쪽 공용.
export function sanitizeOverrides(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const tunable = registryByKey.get(key);
    if (!tunable || typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = Math.min(tunable.max, Math.max(tunable.min, value));
  }
  return out;
}

let localOverrides: Record<string, number> = loadLocalOverrides();
let globalOverrides: Record<string, number> = {}; // Firebase 전역(부팅 fetch) — 로컬이 우선

function loadLocalOverrides(): Record<string, number> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_KEY) : null;
    return sanitizeOverrides(raw ? JSON.parse(raw) : null);
  } catch {
    return {};
  }
}

// 현재 유효값 — 로컬 > 전역 > 기본. 미등록 키는 fallback(기본) 그대로(주입 지점 오타 안전망).
export function bal(key: string, fallback: number): number {
  const local = localOverrides[key];
  if (local !== undefined) return local;
  const global = globalOverrides[key];
  if (global !== undefined) return global;
  return fallback;
}

export function balanceSnapshot(): { key: string; def: number; local?: number; global?: number; effective: number }[] {
  return BALANCE_TUNABLES.map((tunable) => ({ key: tunable.key, def: tunable.def, local: localOverrides[tunable.key], global: globalOverrides[tunable.key], effective: bal(tunable.key, tunable.def) }));
}

export function setLocalOverride(key: string, value: number | null): void {
  const tunable = registryByKey.get(key);
  if (!tunable) return;
  if (value === null || !Number.isFinite(value) || Math.abs(value - tunable.def) < 1e-9) delete localOverrides[key];
  else localOverrides[key] = Math.min(tunable.max, Math.max(tunable.min, value));
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localOverrides)); } catch { /* 저장 차단 무시 */ }
}

export function clearLocalOverrides(): void {
  localOverrides = {};
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* 무시 */ }
}

// 부팅 시 전역 오버라이드 fetch — 3초 타임아웃, 실패는 조용히 기본값 유지(오프라인/차단 안전).
// 경로는 users/ 서브트리(__balance__ 예약 닉네임) — 기존 Firebase 공개 규칙(users read/write)을 그대로 사용(별도 규칙 변경 불필요).
export async function loadGlobalBalance(fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch)): Promise<boolean> {
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || !fetchImpl) return false;
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3000) : null;
    const response = await fetchImpl(`${dbUrl}/users/__balance__/global.json`, { signal: controller?.signal });
    if (timer) clearTimeout(timer);
    if (!response.ok) return false;
    globalOverrides = sanitizeOverrides(await response.json());
    return true;
  } catch {
    return false;
  }
}

// "전체 적용" — 현재 로컬 실험값(+기존 전역 유지분)을 Firebase 에 저장 → 모든 기기가 부팅 시 반영.
// 로컬 오버라이드는 전역으로 승격 후 비운다(이후 이 기기도 전역값을 따라 일관).
export async function publishGlobalBalance(fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch)): Promise<boolean> {
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || !fetchImpl) return false;
  const merged = sanitizeOverrides({ ...globalOverrides, ...localOverrides });
  try {
    const response = await fetchImpl(`${dbUrl}/users/__balance__/global.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) });
    if (!response.ok) return false;
    globalOverrides = merged;
    clearLocalOverrides();
    return true;
  } catch {
    return false;
  }
}

// 전역 초기화 — Firebase 오버라이드 삭제(전 기기 기본값 복귀).
export async function resetGlobalBalance(fetchImpl: typeof fetch = typeof fetch !== "undefined" ? fetch : (undefined as unknown as typeof fetch)): Promise<boolean> {
  const dbUrl = FIREBASE_CONFIG?.databaseURL;
  if (!dbUrl || !fetchImpl) return false;
  try {
    const response = await fetchImpl(`${dbUrl}/users/__balance__/global.json`, { method: "DELETE" });
    if (!response.ok) return false;
    globalOverrides = {};
    return true;
  } catch {
    return false;
  }
}

// 테스트 훅 — 모듈 전역 상태 주입/초기화(골든 결정성).
export function __setOverridesForTest(local: Record<string, number>, global: Record<string, number>): void {
  localOverrides = sanitizeOverrides(local);
  globalOverrides = sanitizeOverrides(global);
}
