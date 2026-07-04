import { SAMURAI_SKILL_COST, SAMURAI_SKILL_COOLDOWN } from "./constants";
import { isKatanaWeapon } from "./items";
import { partyGuestAttackIntercept } from "./partyWorldSync";
import type { ItemId, PlayerClassId } from "./types";
import type { SecondSkillContext, SecondSkillDef, SkillEffectsContext } from "./classSkills";

// 사무라이 직업 — 순수 데이터·로직 리프(main.ts import 금지).
// 컨셉: 전사보다 한 방은 약하지만 공속 +33% 로 DPS 는 전사보다 소폭 위(2026-07-04 유저 밸런스 결정, 이전엔 ≈ 전사). 카타나(리치 2배) 장착 시 공·공속·이속 +5% 시너지.
// 스킬 4종: 난도(R, 4연격) · 도약(T, 15칸 관통 돌진) · 무한 찌르기(F, 11연속 찌르기·1차 전직 해금) · 월광베기(G, 광역 3연격·4차 해금).

// ===== 패시브·시너지 수치 =====
export const SAMURAI_SWING_MULT = 0.75; // 기본 공격 스윙 시간 ×0.75 = 공격속도 +33% (전사 대비. 0.8→0.75 상향 2026-07-04)
export const SAMURAI_KATANA_ATTACK_BONUS = 0.05; // 카타나 장착 시 공격력 +5%
export const SAMURAI_KATANA_SPEED_BONUS = 0.05; // 카타나 장착 시 공격속도 +5% (스윙 ×1/1.05)
export const SAMURAI_KATANA_MOVE_BONUS = 0.05; // 카타나 장착 시 이동속도 +5% (합연산 계층)

// 카타나 시너지 공격 배수 — 사무라이가 카타나를 들었을 때만 1.05, 그 외 1.
export function samuraiKatanaAttackMult(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  return playerClass === "samurai" && isKatanaWeapon(heldItem) ? 1 + SAMURAI_KATANA_ATTACK_BONUS : 1;
}

// 기본 공격 스윙(시전시간) 배수 — 작을수록 빠름. 사무라이 ×0.8, 카타나 시너지 시 추가 ×1/1.05. 그 외 직업 1.
export function samuraiSwingMult(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  if (playerClass !== "samurai") return 1;
  return SAMURAI_SWING_MULT * (isKatanaWeapon(heldItem) ? 1 / (1 + SAMURAI_KATANA_SPEED_BONUS) : 1);
}

// 이동속도 합연산 가산 — additiveMoveSpeedMult 계층에 더하는 비율(사무라이+카타나 0.05, 그 외 0).
export function samuraiKatanaMoveBonus(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  return playerClass === "samurai" && isKatanaWeapon(heldItem) ? SAMURAI_KATANA_MOVE_BONUS : 0;
}

// ===== 스킬 수치 =====
// 난도(1스킬): 4연격 × 공격력 70% = 합 ≈ 2.8배 (55%→70% 상향 2026-07-04 — 전사 '불타는 공격' 2배보다 확실히 위, 짧은 쿨다운 유지)
export const SAMURAI_FLURRY_HITS = 4;
export const SAMURAI_FLURRY_INTERVAL_MS = 120;
export function samuraiFlurryHitDamage(currentDamage: number) {
  return Math.max(1, Math.round(currentDamage * 0.7));
}

// 도약(2스킬): 최대 15칸 돌진, 경로 폭(중심선 좌/우 반폭) 3.0 안의 모든 적에게 1회씩 공격력 150% 피해.
// 건물·지형 충돌체에 막히면 정지하되, 몬스터·보스 등 생명체는 **관통**한다(2026-07-04) — main 의 dashStep 이
// SAMURAI_DASH_PASSTHROUGH_TYPES 를 충돌 해석에서 제외해 보장. 관통한 적도 경로 선분 판정으로 피해를 입는다.
export const SAMURAI_DASH_RANGE = 15;
export const SAMURAI_DASH_STEP = 0.5; // 충돌 해석 스텝 — MOVEMENT_COLLISION_STEP 보다 약간 크게(동기 일괄 처리)
export const SAMURAI_DASH_HIT_WIDTH = 3.0; // 경로 중심선 좌/우 수직 반폭 — 휩쓰는 광역기 느낌 강화(유저 요청 2026-07-04: 1.5→3.0, 좌·우 각 +1.5칸)
export const SAMURAI_DASH_BLOCK_RATIO = 0.4; // 스텝 전진량이 이 비율 미만이면 막힌 것으로 보고 정지
// 도약이 관통하는 생명체 타입 — 건물·지형·설치물은 미포함(막힘 유지)
export const SAMURAI_DASH_PASSTHROUGH_TYPES: ReadonlySet<string> = new Set(["wildPredator", "dragon", "jammini", "animal", "eagleSummon", "summonerPet", "graveHand"]);
export function samuraiDashDamage(currentDamage: number) {
  return Math.max(1, Math.round(currentDamage * 1.5));
}

// 무한 찌르기(3스킬·1차 전직 해금): 11연속 찌르기 × 공격력 40% = 합 ≈ 4.4배 단일 대상 (약 1.6초 채널)
export const SAMURAI_PIERCE_HITS = 11;
export const SAMURAI_PIERCE_INTERVAL_MS = 145; // 11타 ≈ 1.6초
export function samuraiPierceHitDamage(currentDamage: number) {
  return Math.max(1, Math.round(currentDamage * 0.4));
}

// 월광베기(4스킬·4차 전직 해금): 주변 광역 3연격 × 공격력 220% = 합 6.6배 (전사 천검난무 7배보다 약간 아래)
export const SAMURAI_MOONLIGHT_WAVES = 3;
export const SAMURAI_MOONLIGHT_RADIUS = 6.8; // 전사 천검난무와 같은 광역 반경 (EARTH_CLEAVE_RADIUS 4 × 1.7)
export function samuraiMoonlightDamage(currentDamage: number) {
  return Math.max(1, Math.round(currentDamage * 2.2));
}

// ===== 연격 틱 상태 (난도·무한 찌르기 공용 — 휘발, 저장 안 함) =====
interface SamuraiFlurry {
  targetId: string;
  hitsLeft: number;
  damage: number; // 타격당 피해(시전 시점 스냅샷)
  intervalMs: number;
  nextHitAt: number;
}

const activeFlurries: SamuraiFlurry[] = [];

// 연격 등록 — 첫 타는 다음 updateSamuraiFlurries 틱(≈같은 프레임 직후)에 들어간다.
export function registerSamuraiFlurry(targetId: string, damage: number, hits: number, intervalMs: number, now: number) {
  activeFlurries.push({ targetId, hitsLeft: hits, damage, intervalMs, nextHitAt: now });
}

export function resetSamuraiEffects() {
  activeFlurries.length = 0;
}

export function activeSamuraiFlurryCount() {
  return activeFlurries.length;
}

// 매 프레임 틱 — classSkills.updateSecondSkillEffects 에서 호출. 핫패스: 할당·clone 금지.
export function updateSamuraiFlurries(context: SkillEffectsContext) {
  const now = context.now();
  for (let index = activeFlurries.length - 1; index >= 0; index -= 1) {
    const flurry = activeFlurries[index];
    if (now < flurry.nextHitAt) continue;
    const target = context.getObject(flurry.targetId);
    if (!target || (target.hp ?? 0) <= 0) {
      activeFlurries.splice(index, 1); // 대상이 사라지면 남은 연격 취소
      continue;
    }
    context.meleeEffects(target);
    if (!partyGuestAttackIntercept(target, flurry.damage, "melee")) context.applyDamage(target, flurry.damage); // 파티 게스트의 동기화 몬스터는 호스트가 판정
    flurry.hitsLeft -= 1;
    flurry.nextHitAt = now + flurry.intervalMs;
    if (flurry.hitsLeft <= 0) activeFlurries.splice(index, 1);
  }
}

// ===== 1스킬 '난도' — 전방 대상 4연격. main 의 classSkillHandlers 에서 호출(배선만). =====
export function useSamuraiPrimarySkill(context: SecondSkillContext, trySpendPrimary: (skill: SecondSkillDef) => boolean) {
  const target = context.lookCombatTarget();
  if (!target) {
    context.showMessage("난도: 정면의 몬스터를 바라보고 사용하세요.");
    return;
  }
  if (!trySpendPrimary({ name: "난도", summary: "", manaCost: SAMURAI_SKILL_COST, cooldown: SAMURAI_SKILL_COOLDOWN })) return;
  context.castImpact();
  const hit = Math.max(1, Math.round(samuraiFlurryHitDamage(context.currentDamage()) * context.skillDamageMult()));
  registerSamuraiFlurry(target.id, hit, SAMURAI_FLURRY_HITS, SAMURAI_FLURRY_INTERVAL_MS, context.now());
  context.playHandAction("melee");
  context.skillSound("melee");
  context.showMessage(`난도! 전방의 적을 ${SAMURAI_FLURRY_HITS}연격 — 타격당 ${hit} 피해.`);
}

// ===== 2스킬 '도약' — 전방 돌진. 이동은 main 이 주입한 dashStep(충돌 해석 포함)으로만 수행. =====
export function performSamuraiDash(context: SecondSkillContext, damage: number): { distance: number; hits: number } {
  const dir = context.forwardXZ();
  const dirLen = Math.hypot(dir.x, dir.z) || 1;
  const dx = dir.x / dirLen;
  const dz = dir.z / dirLen;
  const startX = context.playerPosition.x;
  const startZ = context.playerPosition.z;
  // 경로 피해 후보는 돌진 전에 수집(돌진은 동기 처리라 대상 위치 불변)
  const candidates = context.nearbyCombatTargets(SAMURAI_DASH_RANGE + 3);

  let traveled = 0;
  while (traveled < SAMURAI_DASH_RANGE) {
    const stepLen = Math.min(SAMURAI_DASH_STEP, SAMURAI_DASH_RANGE - traveled);
    const beforeX = context.playerPosition.x;
    const beforeZ = context.playerPosition.z;
    context.dashStep(dx * stepLen, dz * stepLen); // main: 이동 + 경계 클램프 + 충돌 해석(밀어내기)
    const advanced = (context.playerPosition.x - beforeX) * dx + (context.playerPosition.z - beforeZ) * dz;
    if (advanced < stepLen * SAMURAI_DASH_BLOCK_RATIO) break; // 건물·충돌체에 막힘 — 그 자리에서 정지(관통 금지)
    traveled += advanced;
  }

  // 시작→도착 선분과의 수직 거리로 경로상의 적에게 1회씩 피해
  const pathX = context.playerPosition.x - startX;
  const pathZ = context.playerPosition.z - startZ;
  const pathLenSq = pathX * pathX + pathZ * pathZ;
  let hits = 0;
  for (const target of candidates) {
    const tx = target.root.position.x;
    const tz = target.root.position.z;
    const t = pathLenSq > 1e-6 ? Math.max(0, Math.min(1, ((tx - startX) * pathX + (tz - startZ) * pathZ) / pathLenSq)) : 0;
    const closestX = startX + pathX * t;
    const closestZ = startZ + pathZ * t;
    if (Math.hypot(tx - closestX, tz - closestZ) > SAMURAI_DASH_HIT_WIDTH + (target.collisionRadius ?? 0)) continue;
    context.meleeEffects(target);
    if (!partyGuestAttackIntercept(target, damage, "melee")) context.applyDamage(target, damage);
    hits += 1;
  }
  return { distance: Math.sqrt(pathLenSq), hits };
}
