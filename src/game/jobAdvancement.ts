import type { ItemId, PlayerClassId } from "./types";

// 전직(Job Advancement) 시스템 — 순수 데이터·로직만. main.ts import 금지(leaf 규칙).
// 1·2·3차를 데이터로 미리 설계하되 지금은 1차만 채운다. 2·3차는 신규 스킬을 무한정
// 늘리지 않고 skillUpgrade(기존 스킬 강화)로 확장하도록 자리를 비워 둔다.
// 설계 정본: docs/job-advancement-design.md

export const MAX_JOB_TIER = 3;

// 전직에 사용하는 아이템 흐름: 전직의서(드랍) → 전직의 인장(제작) → 사용 → 전직.
export const JOB_CHANGE_TOME: ItemId = "job_change_tome";
export const JOB_SEAL: ItemId = "job_seal";

export interface JobTierDef {
  tier: 1 | 2 | 3;
  title: string; // 직업·차수별 칭호 (예: 전사 1차 = "광전사")
  requiredLevel: number; // 전직 가능 최소 레벨
  statLevelBonus: number; // 이 차수가 더하는 "레벨 환산" 보너스 (levelStatBonus 에 가산)
  unlockThirdSkill?: boolean; // 1차: F 키 3번째 스킬 해금
  // 2·3차 확장용 (지금은 미사용) — 신규 스킬 대신 기존 스킬 강화로 표현
  skillUpgrade?: { target: "primary" | "second" | "third"; damageMult?: number; cooldownMult?: number; note?: string };
}

// 각 직업의 차수 목록 — 현재 1차만 정의. 2·3차는 후속 작업에서 push.
export const JOB_TIERS: Record<PlayerClassId, JobTierDef[]> = {
  warrior: [{ tier: 1, title: "광전사", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
  healer: [{ tier: 1, title: "사제", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
  mage: [{ tier: 1, title: "원소술사", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
  summoner: [{ tier: 1, title: "야수술사", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
  gunner: [{ tier: 1, title: "총사", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
  tanker: [{ tier: 1, title: "수호기사", requiredLevel: 30, statLevelBonus: 5, unlockThirdSkill: true }],
};

// 저장된 jobTier 를 0..MAX_JOB_TIER 범위로 정규화 (구세이브·손상값 방어).
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
