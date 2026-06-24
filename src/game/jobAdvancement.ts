import type { ItemId, PlayerClassId } from "./types";

// 전직(Job Advancement) 시스템 — 순수 데이터·로직만. main.ts import 금지(leaf 규칙).
// 1·2·3차를 데이터로 표현. 2·3차는 신규 스킬을 늘리지 않고 "기존 스킬 강화"(쿨다운 단축) + 스탯 상승으로 확장.
// 설계 정본: docs/job-advancement-design.md

export const MAX_JOB_TIER = 4;

// 전직 아이템 흐름: 전직의서(드랍) → 차수별 전용 전직 아이템(제작) → 사용 → 전직.
//   1차 = 전직의 표식(job_seal), 2차 = 전직의 각서(job_decree), 3차 = 상급 전직의 각서(job_decree_high).
//   각 차수는 해당 전용 아이템 1개를 소비한다(상위 아이템은 하위 아이템·고급 재료로 제작).
export const JOB_CHANGE_TOME: ItemId = "job_change_tome";
export const JOB_SEAL: ItemId = "job_seal"; // 1차 — 표시명 "전직의 표식"
export const JOB_DECREE: ItemId = "job_decree"; // 2차 — "전직의 각서"
export const JOB_DECREE_HIGH: ItemId = "job_decree_high"; // 3차 — "상급 전직의 각서"
// 4차(초월) — 신화 등급 "최상급 전직의 각서" 4종. 소비한 목걸이의 효과가 영구 부여되므로 목걸이별로 분리.
export const JOB_DECREE_ULTIMATE_NECKLACE: Record<ItemId, ItemId> = {
  job_decree_ultimate_strength: "strength_necklace",
  job_decree_ultimate_guardian: "guardian_necklace",
  job_decree_ultimate_swift: "swift_necklace",
  job_decree_ultimate_sage: "sage_necklace",
};
export function isUltimateDecree(item: ItemId | null | undefined): boolean {
  return Boolean(item && item in JOB_DECREE_ULTIMATE_NECKLACE);
}
export const JOB_ADVANCE_ITEMS: readonly ItemId[] = [JOB_SEAL, JOB_DECREE, JOB_DECREE_HIGH, ...Object.keys(JOB_DECREE_ULTIMATE_NECKLACE)];
export function isJobAdvanceItem(item: ItemId | null | undefined): boolean {
  return item === JOB_SEAL || item === JOB_DECREE || item === JOB_DECREE_HIGH || isUltimateDecree(item);
}

export interface JobTierDef {
  tier: 1 | 2 | 3 | 4;
  title: string; // 직업·차수별 칭호 (예: 전사 1차 = "광전사")
  requiredLevel: number; // 전직 가능 최소 레벨
  statLevelBonus: number; // 이 차수가 더하는 "레벨 환산" 보너스 (levelStatBonus 에 누적 가산)
  advanceItem: ItemId; // 이 차수 전직에 사용·소비하는 전용 아이템(4차는 대표값; 실제 판정은 isUltimateDecree)
  unlockThirdSkill?: boolean; // 1차: F 키 3번째 스킬 해금
  unlockFourthSkill?: boolean; // 4차: G 키 4번째(궁극) 스킬 해금
  skillCooldownMult?: number; // 2·3차: 모든 스킬 쿨다운 배율(이 차수에서 곱해짐, 누적) — "기존 스킬 강화"
  allStatMult?: number; // 4차: 모든 능력치 배율(공격·방어·최대체력 등 최종값에 곱, 누적)
  skillDamageMult?: number; // 4차: 기존 스킬 데미지 배율(누적)
  counterChance?: number; // 4차: 상시 반격(피격 완전 반사) 확률
}

// 각 직업의 1·2·3차 정의. 신규 스킬은 1차에서만 추가하고, 2·3차는 스탯↑ + 쿨다운 단축으로 강화한다.
export const JOB_TIERS: Record<PlayerClassId, JobTierDef[]> = {
  warrior: [
    { tier: 1, title: "광전사", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "버서커", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "워로드", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "검신", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
  healer: [
    { tier: 1, title: "사제", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "주교", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "대성자", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "신성자", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
  mage: [
    { tier: 1, title: "원소술사", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "대마법사", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "현자", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "마도신", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
  summoner: [
    { tier: 1, title: "야수술사", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "야수군주", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "정령왕", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "정령신", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
  gunner: [
    { tier: 1, title: "총사", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "저격수", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "총사령관", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "총신", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
  tanker: [
    { tier: 1, title: "수호기사", requiredLevel: 30, statLevelBonus: 5, advanceItem: JOB_SEAL, unlockThirdSkill: true },
    { tier: 2, title: "성기사", requiredLevel: 50, statLevelBonus: 5, advanceItem: JOB_DECREE, skillCooldownMult: 0.85 },
    { tier: 3, title: "불멸기사", requiredLevel: 70, statLevelBonus: 7, advanceItem: JOB_DECREE_HIGH, skillCooldownMult: 0.8 },
    { tier: 4, title: "수호신", requiredLevel: 100, statLevelBonus: 10, advanceItem: "job_decree_ultimate_strength", unlockFourthSkill: true, allStatMult: 1.1, skillDamageMult: 1.1, counterChance: 0.05 },
  ],
};

// 저장된 jobTier 를 0..정의수 범위로 정규화 (구세이브·손상값 방어).
export function normalizeJobTier(value: unknown, classId: PlayerClassId): number {
  const raw = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(raw, JOB_TIERS[classId]?.length ?? 0, MAX_JOB_TIER));
}

// jobTier 까지 누적된 스탯 보너스 합 — 핫패스에서 불릴 수 있어 할당 없이 루프.
export function jobTierStatBonus(classId: PlayerClassId, jobTier: number): number {
  const defs = JOB_TIERS[classId];
  if (!defs) return 0;
  let sum = 0;
  for (let i = 0; i < jobTier && i < defs.length; i += 1) sum += defs[i].statLevelBonus;
  return sum;
}

// jobTier 까지 누적된 스킬 쿨다운 배율 — 2·3차의 "기존 스킬 강화". 미전직/1차는 1.0.
export function jobTierCooldownMult(classId: PlayerClassId, jobTier: number): number {
  const defs = JOB_TIERS[classId];
  if (!defs) return 1;
  let mult = 1;
  for (let i = 0; i < jobTier && i < defs.length; i += 1) mult *= defs[i].skillCooldownMult ?? 1;
  return mult;
}

// jobTier 까지 누적된 전 능력치 배율 — 4차 "모든 능력치 +10%". 미전직~3차는 1.0.
export function jobTierAllStatMult(classId: PlayerClassId, jobTier: number): number {
  const defs = JOB_TIERS[classId];
  if (!defs) return 1;
  let mult = 1;
  for (let i = 0; i < jobTier && i < defs.length; i += 1) mult *= defs[i].allStatMult ?? 1;
  return mult;
}

// jobTier 까지 누적된 스킬 데미지 배율 — 4차 "기존 스킬 +10%". 미전직~3차는 1.0.
export function jobTierSkillDamageMult(classId: PlayerClassId, jobTier: number): number {
  const defs = JOB_TIERS[classId];
  if (!defs) return 1;
  let mult = 1;
  for (let i = 0; i < jobTier && i < defs.length; i += 1) mult *= defs[i].skillDamageMult ?? 1;
  return mult;
}

// 달성한 차수 중 최대 반격 확률 — 4차 상시 반격(피격 완전 반사) 5%. 그 외 0.
export function jobTierCounterChance(classId: PlayerClassId, jobTier: number): number {
  const defs = JOB_TIERS[classId];
  if (!defs) return 0;
  let chance = 0;
  for (let i = 0; i < jobTier && i < defs.length; i += 1) chance = Math.max(chance, defs[i].counterChance ?? 0);
  return chance;
}

// 현재 적용 중인(가장 높은 달성) 차수의 칭호. 미전직이면 null.
export function jobTierTitle(classId: PlayerClassId, jobTier: number): string | null {
  const defs = JOB_TIERS[classId];
  if (!defs || jobTier <= 0) return null;
  const def = defs[Math.min(jobTier, defs.length) - 1];
  return def ? def.title : null;
}

// 다음(미달성) 차수의 정의. 모두 달성했으면 undefined.
export function nextJobTierDef(classId: PlayerClassId, jobTier: number): JobTierDef | undefined {
  return JOB_TIERS[classId]?.[jobTier];
}

export interface AdvanceCheck {
  ok: boolean;
  reason?: string;
  next?: JobTierDef;
}

// 전직 가능 여부 판정 (레벨 + 다음 차수 존재). 아이템 보유/소비는 호출부(main.ts)에서 처리.
export function canAdvanceJob(classId: PlayerClassId, jobTier: number, level: number): AdvanceCheck {
  const next = nextJobTierDef(classId, jobTier);
  if (!next) return { ok: false, reason: "이미 최고 전직 차수에 도달했습니다." };
  if (level < next.requiredLevel) return { ok: false, reason: `${next.tier}차 전직은 레벨 ${next.requiredLevel}부터 가능합니다. (현재 ${Math.floor(level)})`, next };
  return { ok: true, next };
}
