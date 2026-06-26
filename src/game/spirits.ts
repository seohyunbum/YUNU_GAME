import type { ItemId, SpiritCollection, SpiritData, SpiritGrade } from "./types";

// 정령(Spirit) 시스템 — 순수 로직/데이터(leaf). 가챠 등급 추첨·능력치 롤·레벨업·먹이·버프 계산.
// 정령은 목걸이처럼 1개 장착해 공격·방어를 올리고, 소환수처럼 경험치로 레벨업한다.
// 레벨업 시 버프 = 초기 롤값 × (1 + 0.02 × (레벨−1)).

// 가챠 토큰(전설 등급 아이템) — 사냥·상자에서 낮은 확률 드랍. 사용 시 가챠 연출 → 정령 1개 획득.
export const SPIRIT_GACHA_ITEM: ItemId = "spirit_gacha_token";

export interface SpiritGradeDef {
  grade: SpiritGrade;
  label: string; // 한글 등급명
  min: number; // 능력치 롤 하한(공격·방어 각각)
  max: number; // 상한
  weight: number; // 가챠 가중치(확률)
  emoji: string; // 정령/등급 대표 이모지(HUD·결과 표시)
  color: string; // 눈 공개 색상 = 등급 색
  glow: string; // 발광/광휘(고등급일수록 화려)
}

// 등급 순서 = 낮음→높음. weight 합 = 100(확률 %). 범위는 +3 계단. 7등급.
export const SPIRIT_GRADES: readonly SpiritGradeDef[] = [
  { grade: "common", label: "일반", min: 0, max: 5, weight: 42, emoji: "⚪", color: "#e8eef2", glow: "rgba(226,232,240,0.5)" },
  { grade: "uncommon", label: "고급", min: 3, max: 8, weight: 27, emoji: "🟢", color: "#4ade80", glow: "rgba(74,222,128,0.7)" },
  { grade: "rare", label: "희귀", min: 6, max: 11, weight: 16, emoji: "🔵", color: "#38bdf8", glow: "rgba(56,189,248,0.8)" },
  { grade: "epic", label: "영웅", min: 9, max: 14, weight: 8, emoji: "🟣", color: "#a855f7", glow: "rgba(168,85,247,0.9)" },
  { grade: "legendary", label: "전설", min: 12, max: 17, weight: 4, emoji: "🟡", color: "#fbbf24", glow: "rgba(251,191,36,1)" },
  { grade: "mythic", label: "신화", min: 15, max: 20, weight: 2, emoji: "🔴", color: "#f43f5e", glow: "rgba(244,63,94,1)" },
  { grade: "transcendent", label: "초월", min: 18, max: 23, weight: 1, emoji: "🌈", color: "#f0abfc", glow: "rgba(240,171,252,1)" },
];

const GRADE_BY_KEY: Record<SpiritGrade, SpiritGradeDef> = Object.fromEntries(SPIRIT_GRADES.map((g) => [g.grade, g])) as Record<SpiritGrade, SpiritGradeDef>;

export function isSpiritGrade(value: unknown): value is SpiritGrade {
  return typeof value === "string" && value in GRADE_BY_KEY;
}

export function spiritGradeDef(grade: SpiritGrade): SpiritGradeDef {
  return GRADE_BY_KEY[grade] ?? SPIRIT_GRADES[0];
}

export function spiritGradeLabel(grade: SpiritGrade): string {
  return spiritGradeDef(grade).label;
}

export function spiritGradeIndex(grade: SpiritGrade): number {
  return SPIRIT_GRADES.findIndex((g) => g.grade === grade);
}

// 가중 추첨 — rand: 0..1 (테스트 주입용). 합이 100이 아니어도 가중 비례로 동작.
export function rollSpiritGrade(rand: number): SpiritGrade {
  const total = SPIRIT_GRADES.reduce((sum, g) => sum + g.weight, 0);
  let r = Math.max(0, Math.min(0.999999, rand)) * total;
  for (const g of SPIRIT_GRADES) {
    if (r < g.weight) return g.grade;
    r -= g.weight;
  }
  return SPIRIT_GRADES[0].grade;
}

// 등급 범위 내 정수 롤 — rand: 0..1.
export function rollSpiritStat(grade: SpiritGrade, rand: number): number {
  const def = spiritGradeDef(grade);
  const span = def.max - def.min;
  return def.min + Math.round(Math.max(0, Math.min(1, rand)) * span);
}

// 정령 1개 생성 — grade 추첨 + 공격·방어 각각 독립 롤. randoms: [gradeRand, atkRand, defRand].
export function createSpirit(id: string, randoms: { grade: number; attack: number; defense: number }): SpiritData {
  const grade = rollSpiritGrade(randoms.grade);
  return {
    id,
    grade,
    baseAttack: rollSpiritStat(grade, randoms.attack),
    baseDefense: rollSpiritStat(grade, randoms.defense),
    level: 1,
    experience: 0,
  };
}

// 레벨 배수 — Lv1=1.0, 레벨당 +2%(초기치 기준 가산).
export function spiritLevelMultiplier(level: number): number {
  return 1 + 0.02 * Math.max(0, Math.floor(level) - 1);
}

export function spiritAttackBonus(spirit: SpiritData | null | undefined): number {
  if (!spirit) return 0;
  return Math.round(spirit.baseAttack * spiritLevelMultiplier(spirit.level));
}

export function spiritDefenseBonus(spirit: SpiritData | null | undefined): number {
  if (!spirit) return 0;
  return Math.round(spirit.baseDefense * spiritLevelMultiplier(spirit.level));
}

// 경험치 곡선 — 소환수와 동일 계열(약간 완만). 레벨↑일수록 더 필요.
export function experienceForNextSpiritLevel(level: number): number {
  return Math.floor(28 * Math.pow(Math.max(1, Math.floor(level)), 1.3));
}

// 경험치 부여(in-place) — 레벨업 수 반환.
export function gainSpiritExperience(spirit: SpiritData, amount: number): number {
  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0) return 0;
  spirit.experience += gained;
  let levelUps = 0;
  while (spirit.experience >= experienceForNextSpiritLevel(spirit.level)) {
    spirit.experience -= experienceForNextSpiritLevel(spirit.level);
    spirit.level += 1;
    levelUps += 1;
  }
  return levelUps;
}

// 미착용 정령을 먹이로 줄 때 주는 경험치 — 등급·레벨이 높을수록 더.
export function spiritFeedExperience(material: SpiritData): number {
  const gradeBonus = (spiritGradeIndex(material.grade) + 1) * 25;
  const levelBonus = (Math.max(1, material.level) - 1) * 15;
  return gradeBonus + levelBonus;
}

export function createSpiritCollection(): SpiritCollection {
  return { owned: [], equippedId: null };
}

// 세이브 복원 — 손상·구버전 값 방어. 알 수 없는 등급은 common, 음수·NaN 정리.
export function normalizeSpiritCollection(saved?: Partial<SpiritCollection> | null): SpiritCollection {
  const ownedRaw = Array.isArray(saved?.owned) ? saved!.owned : [];
  const owned: SpiritData[] = [];
  for (const s of ownedRaw) {
    if (!s || typeof s.id !== "string") continue;
    const grade = isSpiritGrade(s.grade) ? s.grade : "common";
    owned.push({
      id: s.id,
      grade,
      baseAttack: clampStat(s.baseAttack, grade),
      baseDefense: clampStat(s.baseDefense, grade),
      level: Math.max(1, Math.floor(Number(s.level ?? 1)) || 1),
      experience: Math.max(0, Math.floor(Number(s.experience ?? 0)) || 0),
    });
  }
  const equippedId = typeof saved?.equippedId === "string" && owned.some((s) => s.id === saved!.equippedId) ? saved!.equippedId : null;
  return { owned, equippedId };
}

function clampStat(value: unknown, grade: SpiritGrade): number {
  const def = spiritGradeDef(grade);
  const n = Math.floor(Number(value ?? def.min));
  if (!Number.isFinite(n)) return def.min;
  return Math.max(0, Math.min(def.max, n));
}

export function findSpirit(collection: SpiritCollection, id: string | null): SpiritData | null {
  if (!id) return null;
  return collection.owned.find((s) => s.id === id) ?? null;
}

export function equippedSpirit(collection: SpiritCollection): SpiritData | null {
  return findSpirit(collection, collection.equippedId);
}
