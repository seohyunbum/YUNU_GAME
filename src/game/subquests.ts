// 서브퀘스트 — 레벨 20+ 에서 퀘스트창 아래에 뜨는 선택형 도전. 3개 랜덤 오퍼 중 하나 수락 → 진행 → 완료 보상.
// leaf: main.ts import 금지. 순수 로직 + 데이터. 진행 판정은 이벤트 증가(kill/chest/supply/caveBoss)와
// 폴링(gather = 수락 후 추가 채집량)을 함께 쓴다. 상태는 SavedGame 에 직렬화되어 리로드/재접속에도 유지된다.
import type { ItemId } from "./types";

export const SUBQUEST_MIN_LEVEL = 20;
export const SUBQUEST_REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5분에 1회 새로고침
export const SUBQUEST_OFFER_COUNT = 3;

export type SubquestKind = "kill" | "gather" | "craft" | "chest" | "supply" | "caveBoss" | "enterCave" | "enterFortress" | "dragon";
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
  craft: { label: "제작 납품", verb: "제작" },
  chest: { label: "보물상자", verb: "개봉" },
  supply: { label: "보급상자", verb: "수령" },
  caveBoss: { label: "동굴의 주인", verb: "처치" },
  enterCave: { label: "동굴 탐험", verb: "입장" },
  enterFortress: { label: "몬스터 요새", verb: "입장" },
  dragon: { label: "용 사냥", verb: "처치" },
};

// 종류×희귀도 목표 수치. (보스·용·제작은 부담이 커 완만하게)
const TARGETS: Record<SubquestKind, Record<SubquestRarity, number>> = {
  kill: { common: 5, rare: 12, epic: 25, legendary: 50 },
  gather: { common: 10, rare: 15, epic: 20, legendary: 25 },
  craft: { common: 1, rare: 2, epic: 3, legendary: 4 },
  chest: { common: 1, rare: 3, epic: 6, legendary: 12 },
  supply: { common: 1, rare: 2, epic: 4, legendary: 8 },
  caveBoss: { common: 1, rare: 2, epic: 3, legendary: 5 },
  enterCave: { common: 1, rare: 2, epic: 3, legendary: 5 },
  enterFortress: { common: 1, rare: 1, epic: 2, legendary: 3 },
  dragon: { common: 1, rare: 1, epic: 2, legendary: 3 },
};

// gather(채집) 아이템 풀. 흔한 채집물 → 희귀 광물 순.
const GATHER_ITEMS: Record<SubquestRarity, ItemId[]> = {
  common: ["wood", "stone", "meat", "leather"],
  rare: ["coal", "iron", "gold"],
  epic: ["iron", "gold", "refined_iron"],
  legendary: ["diamond", "refined_iron", "gold"],
};

// craft(제작 납품) 아이템 풀 — 만들어서 바치는 소모/생활 제작품(스테이션류 제외).
const CRAFT_ITEMS: Record<SubquestRarity, ItemId[]> = {
  common: ["leather_bandage", "meat_stew"],
  rare: ["medkit", "meat_stew"],
  epic: ["advanced_medkit", "medkit"],
  legendary: ["advanced_medkit"],
};

// 아이템 제출형 보상 배수(하위호환 export). gather 난이도 계수와 동일.
export const SUBMISSION_REWARD_MULT = 1.6;

// 종류별 난이도 계수 — 희귀도 기본 보상(경험치·아이템 수량)에 곱해 "난이도에 따른 보상"을 정밀 차등.
const KIND_DIFFICULTY: Record<SubquestKind, number> = {
  supply: 0.9, // 보급상자 열기(쉬움)
  enterCave: 0.8, // 동굴 입장(쉬움·일회성)
  kill: 1.0,
  chest: 1.15, // 보물상자 찾기
  enterFortress: 1.3, // 요새 입장(위험)
  gather: SUBMISSION_REWARD_MULT, // 재료 제출(1.6)
  craft: 2.0, // 제작 납품(제작 비용)
  caveBoss: 2.2, // 요새 보스(어려움)
  dragon: 3.0, // 용(최상 난이도)
};

// 희귀도별 기본 경험치.
const BASE_XP: Record<SubquestRarity, number> = { common: 300, rare: 700, epic: 1400, legendary: 2800 };

// 희귀도별 보상 아이템 번들 풀(다양화) — 롤마다 하나를 뽑아 난이도 계수로 수량 스케일.
const REWARD_ITEM_POOLS: Record<SubquestRarity, Partial<Record<ItemId, number>>[]> = {
  common: [{ medkit: 2 }, { meat: 6 }, { leather: 4 }, { coal: 6 }, { stone: 8 }],
  rare: [{ medkit: 3, iron: 5 }, { refined_iron: 3 }, { gold: 4 }, { coal: 10, medkit: 2 }],
  epic: [{ advanced_medkit: 2, diamond: 2 }, { refined_diamond: 2 }, { sharp_obsidian: 1, gold: 3 }, { diamond: 3, refined_iron: 3 }],
  legendary: [{ advanced_medkit: 3, refined_diamond: 2, sharp_obsidian: 1 }, { sharp_obsidian: 2, diamond: 5 }, { refined_diamond: 3, advanced_medkit: 2 }],
};

export function itemDisplayName(item: ItemId, names: Record<string, string>): string {
  return names[item] ?? item;
}

// 오퍼 제목 — UI 표시용(아이템명 주입).
export function subquestTitle(def: SubquestDef, names: Record<string, string>): string {
  const k = KIND_META[def.kind];
  switch (def.kind) {
    case "gather":
      return def.item ? `${names[def.item] ?? def.item} ${def.target}개 ${k.verb}` : `재료 ${def.target}개 ${k.verb}`;
    case "craft":
      return def.item ? `${names[def.item] ?? def.item} ${def.target}개 ${k.verb}·납품` : `제작품 ${def.target}개 ${k.verb}`;
    case "kill":
      return `몬스터 ${def.target}마리 ${k.verb}`;
    case "chest":
      return `보물상자 ${def.target}개 ${k.verb}`;
    case "supply":
      return `보급상자 ${def.target}회 ${k.verb}`;
    case "caveBoss":
      return `동굴의 주인 ${def.target}회 ${k.verb}`;
    case "enterCave":
      return `동굴 ${def.target}곳 ${k.verb}`;
    case "enterFortress":
      return `몬스터 요새 ${def.target}곳 ${k.verb}`;
    case "dragon":
      return `용 ${def.target}마리 ${k.verb}`;
    default:
      return `${k.label} ${def.target}회`;
  }
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

const ALL_KINDS: readonly SubquestKind[] = ["kill", "gather", "craft", "chest", "supply", "caveBoss", "enterCave", "enterFortress", "dragon"];

// 오퍼 1개 생성 — names 는 보상 라벨용.
// 보상 = 희귀도 기본(경험치 BASE_XP·아이템 번들 REWARD_ITEM_POOLS) × 종류 난이도 계수(KIND_DIFFICULTY).
// → "퀘스트 난이도에 따른 보상 밸런스"를 희귀도 × 종류 두 축으로 정밀 차등.
export function rollSubquest(index: number, names: Record<string, string>): SubquestDef {
  const kind = pick(ALL_KINDS);
  const rarity = rollRarity();
  const target = TARGETS[kind][rarity];
  const item = kind === "gather" ? pick(GATHER_ITEMS[rarity]) : kind === "craft" ? pick(CRAFT_ITEMS[rarity]) : undefined;
  const mult = KIND_DIFFICULTY[kind];
  const bundle = pick(REWARD_ITEM_POOLS[rarity]);
  const items: Partial<Record<ItemId, number>> = {};
  for (const [it, count] of Object.entries(bundle)) items[it as ItemId] = Math.max(1, Math.round((count as number) * mult));
  const experience = Math.round(BASE_XP[rarity] * mult);
  const reward: SubquestReward = { experience, items, label: rewardLabel({ experience, items }, names) };
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

// 제출형(보유 수량 폴링) 종류 — 진행을 이벤트가 아니라 인벤토리 보유량으로 본다.
function isSubmissionKind(kind: SubquestKind): boolean {
  return kind === "gather" || kind === "craft";
}

// 이벤트 발생 시 진행 증가(선택 중이고 종류가 맞을 때만). kill/chest/supply/caveBoss/enterCave/enterFortress/dragon 용.
// 제출형(gather/craft)은 이벤트가 아니라 보유량 폴링으로 진행하므로 제외. 반환: 진행이 바뀌었는가.
export function bumpSubquestOnEvent(state: SubquestState, kind: SubquestKind, amount = 1): boolean {
  if (!state.selected || state.selected.kind !== kind || isSubmissionKind(state.selected.kind)) return false;
  if (state.progress >= state.selected.target) return false;
  state.progress = Math.min(state.selected.target, state.progress + amount);
  return true;
}

// 제출형(gather/craft) 진행 폴링 — 이장에게 바칠 재료·제작품을 현재 보유 수량만큼 진행으로 본다(제출 시 소비되므로 보유량 기준).
export function pollSubquestGather(state: SubquestState, currentCount: number): boolean {
  if (!state.selected || !isSubmissionKind(state.selected.kind)) return false;
  const next = Math.min(state.selected.target, Math.max(0, currentCount));
  if (next === state.progress) return false;
  state.progress = next;
  return true;
}

// 제출형(gather/craft) 이면 이장에게 바칠 {item, count}, 아니면 null.
export function subquestSubmission(def: SubquestDef): { item: ItemId; count: number } | null {
  return isSubmissionKind(def.kind) && def.item ? { item: def.item, count: def.target } : null;
}
