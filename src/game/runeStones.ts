import type { ItemId } from "./types";

// 마석(rune stone) 시스템 — 순수 로직·데이터 leaf(main.ts import 금지).
// dragonGear.ts 와 같은 "장착 → 패시브 버프" 모델이되, 소지=장착이 아니라 전용 창의 명시적 슬롯에 끼운다.
// 슬롯 14칸(기본 2, 나머지는 열쇠로 해금). 6종 × 4등급 = 24 아이템 + 열쇠 1종. 버프는 장착분 합산으로 main.ts 스탯식에 1항씩 주입.

export type RuneType = "strength" | "guard" | "vitality" | "intellect" | "haste" | "experience";
export type RuneTier = 1 | 2 | 3 | 4; // 마석결정(1) → 마석(2) → 마나석(3) → 마정석(4)

export const RUNE_TYPES: RuneType[] = ["strength", "guard", "vitality", "intellect", "haste", "experience"];
export const RUNE_MAX_SLOTS = 14;
export const RUNE_BASE_SLOTS = 2; // 시작 해금 슬롯 수
export const RUNE_KEY: ItemId = "rune_key"; // 슬롯 해금용 고급 아이템(마석열쇠)

// 등급별 버프 배율 — 상위로 갈수록 가파르게(수집·조합 보상).
const TIER_MULT: Record<RuneTier, number> = { 1: 1, 2: 2.2, 3: 4.5, 4: 9 };
export const RUNE_TIER_LABELS: Record<RuneTier, string> = { 1: "마석결정", 2: "마석", 3: "마나석", 4: "마정석" };

// 종류별 메타 — 버프 대상 스탯·기본 수치·표기. base 는 T1(배율1) 기준 값.
export interface RuneTypeMeta {
  name: string; // "힘" 등(아이템명 = `${name}의 ${tierLabel}`)
  stat: "attack" | "defense" | "maxHp" | "maxMana" | "movePct" | "xpPct";
  base: number; // T1 버프량(flat 은 정수, pct 는 소수 비율)
  color: number; // 패널 칩/아우라 색
}
export const RUNE_TYPE_META: Record<RuneType, RuneTypeMeta> = {
  strength: { name: "힘", stat: "attack", base: 4, color: 0xff5a3c },
  guard: { name: "수호", stat: "defense", base: 3, color: 0x6fa8ff },
  vitality: { name: "활력", stat: "maxHp", base: 14, color: 0x5adf7a },
  intellect: { name: "지능", stat: "maxMana", base: 10, color: 0xa855f7 },
  haste: { name: "신속", stat: "movePct", base: 0.03, color: 0xffd54a },
  experience: { name: "경험", stat: "xpPct", base: 0.06, color: 0x38d6d6 },
};

export function runeItemId(type: RuneType, tier: RuneTier): ItemId {
  return `rune_${type}_t${tier}`;
}
const RUNE_ID_RE = /^rune_(strength|guard|vitality|intellect|haste|experience)_t([1-4])$/;
export function isRuneStone(item: ItemId): boolean {
  return RUNE_ID_RE.test(item);
}
export function runeTypeOf(item: ItemId): RuneType | null {
  const m = RUNE_ID_RE.exec(item);
  return m ? (m[1] as RuneType) : null;
}
export function runeTierOf(item: ItemId): RuneTier | null {
  const m = RUNE_ID_RE.exec(item);
  return m ? (Number(m[2]) as RuneTier) : null;
}

// 단일 마석의 버프량(툴팁·패널 표기용). pct 종류는 소수 비율, flat 은 정수.
export function runeStoneValue(item: ItemId): number {
  const type = runeTypeOf(item);
  const tier = runeTierOf(item);
  if (!type || !tier) return 0;
  const meta = RUNE_TYPE_META[type];
  const raw = meta.base * TIER_MULT[tier];
  return meta.stat === "movePct" || meta.stat === "xpPct" ? raw : Math.round(raw);
}

// 짧은 버프 표기 — 슬롯/보유 카드용("힘 +12", "신속 +6%").
export function runeShortLabel(item: ItemId): string {
  const type = runeTypeOf(item);
  const tier = runeTierOf(item);
  if (!type || !tier) return "";
  const meta = RUNE_TYPE_META[type];
  const v = runeStoneValue(item);
  const amt = meta.stat === "movePct" || meta.stat === "xpPct" ? `+${Math.round(v * 100)}%` : `+${v}`;
  return `${meta.name} ${amt}`;
}
export function runeHexColor(type: RuneType): string {
  return `#${RUNE_TYPE_META[type].color.toString(16).padStart(6, "0")}`;
}

// 장착 마석 합산 버프 — main.ts 스탯식이 1항씩 읽는다(dragonGear 와 동일 정신).
export interface RuneBonuses {
  attack: number;
  defense: number;
  maxHp: number;
  maxMana: number;
  movePct: number; // 이동·공격속도 가산 비율(0.1 = +10%)
  xpPct: number; // 경험치 획득 가산 비율
}
export const NO_RUNE_BONUSES: RuneBonuses = { attack: 0, defense: 0, maxHp: 0, maxMana: 0, movePct: 0, xpPct: 0 };

export function aggregateRuneBonuses(equipped: readonly (ItemId | null)[]): RuneBonuses {
  const b: RuneBonuses = { attack: 0, defense: 0, maxHp: 0, maxMana: 0, movePct: 0, xpPct: 0 };
  for (const item of equipped) {
    if (!item) continue;
    const type = runeTypeOf(item);
    const tier = runeTierOf(item);
    if (!type || !tier) continue;
    const meta = RUNE_TYPE_META[type];
    const value = meta.base * TIER_MULT[tier];
    if (meta.stat === "movePct") b.movePct += value;
    else if (meta.stat === "xpPct") b.xpPct += value;
    else b[meta.stat] += Math.round(value);
  }
  return b;
}

// ── 슬롯 해금 — 기본 2칸, 이후 열쇠로. "뒤로 갈수록 많이 필요": index(0-based) i≥2 슬롯 = i-1 개. ──
// 3번째 슬롯(i=2)=1개, 4번째=2개 … 14번째(i=13)=12개. 완전 해금 총합 = 1+2+…+12 = 78개.
export function runeKeysToUnlockSlot(slotIndex: number): number {
  if (slotIndex < RUNE_BASE_SLOTS) return 0;
  return slotIndex - 1;
}
// 현재 해금 수(unlocked)에서 다음 1칸을 더 열기 위한 열쇠 수. 이미 최대면 null.
export function runeNextUnlockCost(unlocked: number): number | null {
  if (unlocked >= RUNE_MAX_SLOTS) return null;
  return runeKeysToUnlockSlot(unlocked); // 다음 슬롯의 index = 현재 해금 수
}
export function clampRuneSlotCount(n: number): number {
  if (!Number.isFinite(n)) return RUNE_BASE_SLOTS;
  return Math.max(RUNE_BASE_SLOTS, Math.min(RUNE_MAX_SLOTS, Math.floor(n)));
}

// 장착 배열을 슬롯 수에 맞춰 정규화(로드·해금 후) — 길이 14 고정, 잠긴 칸은 항상 null.
export function normalizeEquippedRunes(equipped: readonly (ItemId | null)[] | undefined, slotCount: number): (ItemId | null)[] {
  const slots = clampRuneSlotCount(slotCount);
  const out: (ItemId | null)[] = new Array(RUNE_MAX_SLOTS).fill(null);
  if (equipped) {
    for (let i = 0; i < RUNE_MAX_SLOTS; i += 1) {
      const item = equipped[i];
      if (i < slots && typeof item === "string" && isRuneStone(item)) out[i] = item;
    }
  }
  return out;
}

// ── 조합 — 같은 종류 하위 3개 → 상위 1개. ──
export const RUNE_COMBINE_COST = 3;
export function runeCombineOutput(type: RuneType, fromTier: RuneTier): ItemId | null {
  if (fromTier >= 4) return null;
  return runeItemId(type, (fromTier + 1) as RuneTier);
}

// ── 드롭 — 상자·사냥·요새에서 저확률. 등급은 대부분 T1, 드물게 상위(maxTier 상한). ──
export function randomRuneType(rng: () => number = Math.random): RuneType {
  return RUNE_TYPES[Math.floor(rng() * RUNE_TYPES.length)] ?? "strength";
}
export function rollRuneStoneDrop(rng: () => number = Math.random, maxTier: RuneTier = 2): ItemId {
  const r = rng();
  let tier: RuneTier = 1;
  if (maxTier >= 3 && r < 0.08) tier = 3;
  else if (maxTier >= 2 && r < 0.3) tier = 2;
  return runeItemId(randomRuneType(rng), Math.min(tier, maxTier) as RuneTier);
}

// 아이템명 등록용 — {type,tier,id,name} 전량 나열(items.ts 가 spread).
export function allRuneStoneEntries(): { id: ItemId; name: string; type: RuneType; tier: RuneTier }[] {
  const out: { id: ItemId; name: string; type: RuneType; tier: RuneTier }[] = [];
  for (const type of RUNE_TYPES) {
    for (const tier of [1, 2, 3, 4] as RuneTier[]) {
      out.push({ id: runeItemId(type, tier), name: `${RUNE_TYPE_META[type].name}의 ${RUNE_TIER_LABELS[tier]}`, type, tier });
    }
  }
  return out;
}
