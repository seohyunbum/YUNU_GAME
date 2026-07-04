import { SAMURAI_SKILL_COST, SAMURAI_SKILL_COOLDOWN } from "./constants";
import { bal } from "./balanceTuning";
import { isKatanaWeapon } from "./items";
import { partyGuestAttackIntercept } from "./partyWorldSync";
import type { ItemId, PlayerClassId } from "./types";
import type { SecondSkillContext, SecondSkillDef, SkillEffectsContext } from "./classSkills";

// 사무라이 직업 — 순수 데이터·로직 리프(main.ts import 금지).
// 컨셉: 전사보다 한 방은 약하지만 공속 +33% 로 DPS 는 전사보다 소폭 위(2026-07-04 유저 밸런스 결정, 이전엔 ≈ 전사). 카타나(리치 2배) 장착 시 공격 +5%·공속 +10%·이속 +5% 시너지(공속 5→10% 상향 2026-07-04).
// 스킬 4종: 난도(R, 4연격) · 도약(T, 15칸 관통 돌진) · 무한 찌르기(F, 11연속 찌르기·1차 전직 해금) · 월광베기(G, 광역 3연격·4차 해금).

// ===== 패시브·시너지 수치 =====
export const SAMURAI_SWING_MULT = 0.75; // 기본 공격 스윙 시간 ×0.75 = 공격속도 +33% (전사 대비. 0.8→0.75 상향 2026-07-04)
export const SAMURAI_KATANA_ATTACK_BONUS = 0.05; // 카타나 장착 시 공격력 +5%
export const SAMURAI_KATANA_SPEED_BONUS = 0.1; // 카타나 장착 시 공격속도 +10% (스윙 ×1/1.1. 5%→10% 상향 2026-07-04)
export const SAMURAI_KATANA_MOVE_BONUS = 0.05; // 카타나 장착 시 이동속도 +5% (합연산 계층)

// 카타나 시너지 공격 배수 — 사무라이가 카타나를 들었을 때만 1.05, 그 외 1.
export function samuraiKatanaAttackMult(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  return playerClass === "samurai" && isKatanaWeapon(heldItem) ? 1 + bal("samurai_katana_attack", SAMURAI_KATANA_ATTACK_BONUS) : 1;
}

// 기본 공격 스윙(시전시간) 배수 — 작을수록 빠름. 사무라이 ×0.75, 카타나 시너지 시 추가 ×1/1.1. 그 외 직업 1.
export function samuraiSwingMult(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  if (playerClass !== "samurai") return 1;
  return bal("samurai_swing", SAMURAI_SWING_MULT) * (isKatanaWeapon(heldItem) ? 1 / (1 + bal("samurai_katana_speed", SAMURAI_KATANA_SPEED_BONUS)) : 1);
}

// 이동속도 합연산 가산 — additiveMoveSpeedMult 계층에 더하는 비율(사무라이+카타나 0.05, 그 외 0).
export function samuraiKatanaMoveBonus(playerClass: PlayerClassId, heldItem: ItemId | null | undefined): number {
  return playerClass === "samurai" && isKatanaWeapon(heldItem) ? SAMURAI_KATANA_MOVE_BONUS : 0;
}

// 손상 수치 방어 — currentDamage 등 입력이 NaN/±Infinity 로 오염돼도 피해 파이프라인에 퍼뜨리지 않는다.
// (NaN 피해가 target.hp 에 들어가면 `hp <= 0` 이 영원히 false = 불사 몬스터. spirits.ts 세이브 방어와 같은 원칙.)
function finiteOr1(value: number): number {
  return Number.isFinite(value) ? value : 1;
}

// ===== 스킬 수치 =====
// 난도(1스킬): 4연격 × 공격력 90% = 합 ≈ 3.6배 (70%→90% 상향 2026-07-04 2차 — 전사 '불타는 공격' 2배 대비 확실한 주력기, 짧은 쿨다운 유지)
export const SAMURAI_FLURRY_HITS = 4;
export const SAMURAI_FLURRY_INTERVAL_MS = 120;
export function samuraiFlurryHitDamage(currentDamage: number) {
  return Math.max(1, Math.round(finiteOr1(currentDamage) * bal("samurai_flurry_pct", 0.9)));
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
  return Math.max(1, Math.round(finiteOr1(currentDamage) * bal("samurai_dash_pct", 1.5)));
}

// 무한 찌르기(3스킬·1차 전직 해금): 11연속 찌르기 × 공격력 40% = 합 ≈ 4.4배 단일 대상 (약 1.6초 채널)
export const SAMURAI_PIERCE_HITS = 11;
export const SAMURAI_PIERCE_INTERVAL_MS = 145; // 11타 ≈ 1.6초
export function samuraiPierceHitDamage(currentDamage: number) {
  return Math.max(1, Math.round(finiteOr1(currentDamage) * bal("samurai_pierce_pct", 0.4)));
}

// 월광베기(4스킬·4차 전직 해금): 주변 광역 3연격 × 공격력 220% = 합 6.6배 (전사 천검난무 7배보다 약간 아래)
export const SAMURAI_MOONLIGHT_WAVES = 3;
export const SAMURAI_MOONLIGHT_RADIUS = 6.8; // 전사 천검난무와 같은 광역 반경 (EARTH_CLEAVE_RADIUS 4 × 1.7)
export function samuraiMoonlightDamage(currentDamage: number) {
  return Math.max(1, Math.round(finiteOr1(currentDamage) * bal("samurai_moonlight_pct", 2.2)));
}

// ===== 연격 틱 상태 (난도·무한 찌르기 공용 — 휘발, 저장 안 함) =====
interface SamuraiFlurry {
  targetId: string;
  hitsLeft: number;
  hitsTotal: number; // 연격 총 타격 수 — 방어를 스킬 1회당 1번만 부담시키는 armorScale(1/N) 계산용
  damage: number; // 타격당 피해(시전 시점 스냅샷)
  intervalMs: number;
  nextHitAt: number;
}

const activeFlurries: SamuraiFlurry[] = [];

// 연격 등록 — 첫 타는 다음 updateSamuraiFlurries 틱(≈같은 프레임 직후)에 들어간다.
// 오염 입력 방어: NaN hitsLeft 는 `hitsLeft <= 0` 이 영원히 false(무한 연격), NaN nextHitAt 은 `now < nextHitAt` 이
// 영원히 false(매 프레임 타격 = 피해 소방호스)가 되므로 비유한 인자는 등록 자체를 거부한다.
export function registerSamuraiFlurry(targetId: string, damage: number, hits: number, intervalMs: number, now: number) {
  if (!Number.isFinite(damage) || !Number.isFinite(hits) || !Number.isFinite(intervalMs) || !Number.isFinite(now)) return;
  activeFlurries.push({ targetId, hitsLeft: Math.max(1, Math.floor(hits)), hitsTotal: Math.max(1, Math.floor(hits)), damage: Math.max(1, Math.round(damage)), intervalMs: Math.max(1, intervalMs), nextHitAt: now });
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
    if (!partyGuestAttackIntercept(target, flurry.damage, "melee")) context.applyDamage(target, flurry.damage, { armorScale: 1 / flurry.hitsTotal, counter: flurry.hitsLeft <= 1 }); // 조각은 방어 1/N 부담 + 즉시반격은 마지막 조각 1회만(용 11연속 반격 방지). 파티 게스트 동기화 몬스터는 호스트가 판정
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
  const dirLen = Math.hypot(dir.x, dir.z);
  if (!Number.isFinite(dirLen) || dirLen < 1e-6) return { distance: 0, hits: 0 }; // 방향 오염(NaN)·0 벡터 — 이동 없이 종료(위치 NaN 전파 방지)
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
    if (!Number.isFinite(advanced) || advanced < stepLen * SAMURAI_DASH_BLOCK_RATIO) break; // 건물·충돌체에 막힘/위치 오염 — 그 자리에서 정지(관통 금지)
    traveled += advanced;
  }
  if (!Number.isFinite(context.playerPosition.x + context.playerPosition.z)) {
    // dashStep 이 위치를 오염시킨 극단 케이스 — 시작점 복원 + 판정 중단. (NaN 경로는 아래 hypot 비교가 전부 false 가 되어
    // 반경 내 모든 후보를 오폭하므로 반드시 차단.)
    context.playerPosition.x = startX;
    context.playerPosition.z = startZ;
    return { distance: 0, hits: 0 };
  }

  // 시작→도착 선분과의 수직 거리로 경로상의 적에게 1회씩 피해
  const pathX = context.playerPosition.x - startX;
  const pathZ = context.playerPosition.z - startZ;
  const pathLenSq = pathX * pathX + pathZ * pathZ;
  let hits = 0;
  for (const target of candidates) {
    const tx = target.root.position.x;
    const tz = target.root.position.z;
    if (!Number.isFinite(tx + tz)) continue; // 좌표 오염 개체 — 판정 제외
    const rawRadius = target.collisionRadius ?? 0;
    const radius = Number.isFinite(rawRadius) ? rawRadius : 0; // Infinity 반경이면 전 후보 명중이 되므로 0 취급
    const t = pathLenSq > 1e-6 ? Math.max(0, Math.min(1, ((tx - startX) * pathX + (tz - startZ) * pathZ) / pathLenSq)) : 0;
    const closestX = startX + pathX * t;
    const closestZ = startZ + pathZ * t;
    if (Math.hypot(tx - closestX, tz - closestZ) > bal("samurai_dash_width", SAMURAI_DASH_HIT_WIDTH) + radius) continue;
    context.meleeEffects(target);
    if (!partyGuestAttackIntercept(target, damage, "melee")) context.applyDamage(target, damage);
    hits += 1;
  }
  return { distance: Math.sqrt(pathLenSq), hits };
}
