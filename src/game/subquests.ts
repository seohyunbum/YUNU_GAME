// 서브퀘스트 — 레벨 20+ 에서 퀘스트창 아래에 뜨는 선택형 도전. 3개 랜덤 오퍼 중 하나 수락 → 진행 → 완료 보상.
// leaf: main.ts import 금지. 순수 로직 + 데이터. 진행 판정은 이벤트 증가(kill/chest/supply/caveBoss)와
// 폴링(gather = 수락 후 추가 채집량)을 함께 쓴다. 상태는 SavedGame 에 직렬화되어 리로드/재접속에도 유지된다.
import type { ItemId } from "./types";

export const SUBQUEST_MIN_LEVEL = 20;
export const SUBQUEST_REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5분에 1회 새로고침
export const SUBQUEST_OFFER_COUNT = 3;

export type SubquestKind = "kill" | "gather" | "chest" | "supply" | "caveBoss";
export type SubquestRarity = "common" | "rare" | "epic" | "legendary";

export interface SubquestReward {
  experience: number;
  items: Partial<Record<ItemId, number>>;
  label: string;
}

export interface SubquestDef {
  id: string;
  kind: SubquestKind;
  rarity: SubquestRarity;
  target: number;
  item?: ItemId; // gather 전용
  reward: SubquestReward;
}

// 선택 중인 서브퀘스트(진행 포함) — choices 는 오퍼 3개(포기 시 그대로 재노출).
export interface SubquestState {
  choices: SubquestDef[] | null;
  selected: SubquestDef | null;
  progress: number; // selected.target 까지
  gatherBaseline: number; // gather: 수락 시점 countItem — 이후 (현재-기준)의 최댓값이 진행도
  lastRefreshEpoch: number; // Date.now() 기준 마지막 새로고침 시각(쿨다운 계산)
}

export function defaultSubquestState(): SubquestState {
  return { choices: null, selected: null, progress: 0, gatherBaseline: 0, lastRefreshEpoch: 0 };
}

export const RARITY_ORDER: readonly SubquestRarity[] = ["common", "rare", "epic", "legendary"];

// 희귀도 메타 — 라벨 + 배경/테두리 색상(UI 배경 처리) + 뽑힘 가중치.
export const RARITY_META: Record<SubquestRarity, { label: string; bg: string; border: string; text: string; weight: number }> = {
  common: { label: "일반", bg: "linear-gradient(180deg,rgba(46,64,52,.94),rgba(30,44,36,.94))", border: "#6b8e6b", text: "#d7ecd7", weight: 52 },
  rare: { label: "희귀", bg: "linear-gradient(180deg,rgba(24,52,86,.94),rgba(15,34,58,.94))", border: "#4a90d9", text: "#cfe4fb", weight: 30 },
  epic: { label: "영웅", bg: "linear-gradient(180deg,rgba(59,38,92,.94),rgba(38,24,64,.94))", border: "#a855f7", text: "#ecd7fb", weight: 14 },
  legendary: { label: "전설", bg: "linear-gradient(180deg,rgba(80,58,16,.95),rgba(56,40,10,.95))", border: "#fbbf24", text: "#fde9b0", weight: 4 },
};

const KIND_META: Record<SubquestKind, { label: string; verb: string }> = {
  kill: { label: "몬스터 사냥", verb: "처치" },
  gather: { label: "재료 채집", verb: "채집" },
  chest: { label: "보물상자", verb: "개봉" },
  supply: { label: "보급상자", verb: "수령" },
  caveBoss: { label: "동굴의 주인", verb: "처치" },
};

// 종류×희귀도 목표 수치. (동굴 주인·보급은 값이 커지면 부담이 크므로 완만)
const TARGETS: Record<SubquestKind, Record<SubquestRarity, number>> = {
  kill: { common: 5, rare: 12, epic: 25, legendary: 50 },
  gather: { common: 10, rare: 15, epic: 20, legendary: 25 },
  chest: { common: 1, rare: 3, epic: 6, legendary: 12 },
  supply: { common: 1, rare: 2, epic: 4, legendary: 8 },
  caveBoss: { common: 1, rare: 2, epic: 3, legendary: 5 },
};

// gather 아이템 풀(희귀도별). 흔한 채집물 → 희귀 광물 순.
const GATHER_ITEMS: Record<SubquestRarity, ItemId[]> = {
  common: ["wood", "stone", "meat", "leather"],
  rare: ["coal", "iron", "gold"],
  epic: ["iron", "gold", "refined_iron"],
  legendary: ["diamond", "refined_iron", "gold"],
};

// 희귀도별 보상(경험치 + 아이템). 레벨 20+ 도전이라 넉넉하되 난이도 차등.
const REWARDS: Record<SubquestRarity, { experience: number; items: Partial<Record<ItemId, number>> }> = {
  common: { experience: 300, items: { medkit: 2 } },
  rare: { experience: 700, items: { medkit: 3, iron: 5 } },
  epic: { experience: 1400, items: { advanced_medkit: 2, diamond: 2 } },
  legendary: { experience: 2800, items: { advanced_medkit: 3, refined_diamond: 2, sharp_obsidian: 1 } },
};

export function itemDisplayName(item: ItemId, names: Record<string, string>): string {
  return names[item] ?? item;
}

// 오퍼 제목 — UI 표시용(아이템명 주입).
export function subquestTitle(def: SubquestDef, names: Record<string, string>): string {
  const k = KIND_META[def.kind];
  if (def.kind === "gather" && def.item) return `${names[def.item] ?? def.item} ${def.target}개 ${k.verb}`;
  if (def.kind === "kill") return `몬스터 ${def.target}마리 ${k.verb}`;
  if (def.kind === "chest") return `보물상자 ${def.target}개 ${k.verb}`;
  if (def.kind === "supply") return `보급상자 ${def.target}회 ${k.verb}`;
  return `동굴의 주인 ${def.target}회 ${k.verb}`;
}

function rewardLabel(reward: { experience: number; items: Partial<Record<ItemId, number>> }, names: Record<string, string>): string {
  const parts = [`경험치 ${reward.experience}`];
  for (const [item, count] of Object.entries(reward.items)) parts.push(`${names[item] ?? item} ${count}개`);
  return parts.join(" + ");
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollRarity(): SubquestRarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + RARITY_META[r].weight, 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= RARITY_META[r].weight;
    if (roll < 0) return r;
  }
  return "common";
}

const ALL_KINDS: readonly SubquestKind[] = ["kill", "gather", "chest", "supply", "caveBoss"];

// 오퍼 1개 생성 — names 는 보상 라벨용.
export function rollSubquest(index: number, names: Record<string, string>): SubquestDef {
  const kind = pick(ALL_KINDS);
  const rarity = rollRarity();
  const target = TARGETS[kind][rarity];
  const item = kind === "gather" ? pick(GATHER_ITEMS[rarity]) : undefined;
  const base = REWARDS[rarity];
  const reward: SubquestReward = { experience: base.experience, items: base.items, label: rewardLabel(base, names) };
  const id = `sq-${index}-${kind}-${rarity}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  return { id, kind, rarity, target, item, reward };
}

// 3개 랜덤 오퍼.
export function rollSubquestChoices(names: Record<string, string>): SubquestDef[] {
  const out: SubquestDef[] = [];
  for (let i = 0; i < SUBQUEST_OFFER_COUNT; i += 1) out.push(rollSubquest(i, names));
  return out;
}

// 저장된(혹은 손상된) 상태를 안전한 SubquestState 로 정규화. 구조가 조금이라도 어긋나면 해당 부분을 기본값으로 대체.
function sanitizeDef(raw: unknown): SubquestDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!ALL_KINDS.includes(r.kind as SubquestKind)) return null;
  if (!RARITY_ORDER.includes(r.rarity as SubquestRarity)) return null;
  const target = typeof r.target === "number" && Number.isFinite(r.target) ? Math.max(1, Math.floor(r.target)) : null;
  if (target === null) return null;
  const rw = r.reward as Record<string, unknown> | undefined;
  if (!rw || typeof rw !== "object" || typeof rw.experience !== "number" || typeof rw.label !== "string" || !rw.items || typeof rw.items !== "object") return null;
  const items: Partial<Record<ItemId, number>> = {};
  for (const [k, v] of Object.entries(rw.items as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v) && v > 0) items[k as ItemId] = Math.floor(v);
  return {
    id: typeof r.id === "string" ? r.id : `sq-${Math.floor(Math.random() * 1e9).toString(36)}`,
    kind: r.kind as SubquestKind,
    rarity: r.rarity as SubquestRarity,
    target,
    item: typeof r.item === "string" ? (r.item as ItemId) : undefined,
    reward: { experience: Math.max(0, Math.floor(rw.experience as number)), items, label: rw.label as string },
  };
}

export function sanitizeSubquestState(raw: unknown): SubquestState {
  const base = defaultSubquestState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const choices = Array.isArray(r.choices) ? r.choices.map(sanitizeDef).filter((d): d is SubquestDef => d !== null).slice(0, SUBQUEST_OFFER_COUNT) : null;
  base.choices = choices && choices.length === SUBQUEST_OFFER_COUNT ? choices : null;
  const selected = sanitizeDef(r.selected);
  // 선택은 반드시 현재 오퍼 중 하나여야 유효(없으면 오퍼 목록 상태로)
  base.selected = selected && base.choices && base.choices.some((c) => c.id === selected.id) ? selected : null;
  base.progress = base.selected && typeof r.progress === "number" && Number.isFinite(r.progress) ? Math.max(0, Math.min(base.selected.target, Math.floor(r.progress))) : 0;
  base.gatherBaseline = typeof r.gatherBaseline === "number" && Number.isFinite(r.gatherBaseline) ? Math.max(0, Math.floor(r.gatherBaseline)) : 0;
  base.lastRefreshEpoch = typeof r.lastRefreshEpoch === "number" && Number.isFinite(r.lastRefreshEpoch) ? Math.max(0, Math.floor(r.lastRefreshEpoch)) : 0;
  return base;
}

export function canRefreshSubquests(now: number, lastRefreshEpoch: number): boolean {
  return now - lastRefreshEpoch >= SUBQUEST_REFRESH_COOLDOWN_MS;
}

export function refreshCooldownRemainingMs(now: number, lastRefreshEpoch: number): number {
  return Math.max(0, SUBQUEST_REFRESH_COOLDOWN_MS - (now - lastRefreshEpoch));
}

export function isSubquestComplete(state: SubquestState): boolean {
  return state.selected !== null && state.progress >= state.selected.target;
}

// 이벤트 발생 시 진행 증가(선택 중이고 종류가 맞을 때만). kill/chest/supply/caveBoss 용. 반환: 진행이 바뀌었는가.
export function bumpSubquestOnEvent(state: SubquestState, kind: SubquestKind, amount = 1): boolean {
  if (!state.selected || state.selected.kind !== kind || state.selected.kind === "gather") return false;
  if (state.progress >= state.selected.target) return false;
  state.progress = Math.min(state.selected.target, state.progress + amount);
  return true;
}

// gather 진행 폴링 — (현재 보유 - 수락 시점 기준)의 최댓값. 만들어 쓰거나 버려도 되돌아가지 않음.
export function pollSubquestGather(state: SubquestState, currentCount: number): boolean {
  if (!state.selected || state.selected.kind !== "gather") return false;
  const gained = Math.max(0, currentCount - state.gatherBaseline);
  const next = Math.min(state.selected.target, Math.max(state.progress, gained));
  if (next === state.progress) return false;
  state.progress = next;
  return true;
}
