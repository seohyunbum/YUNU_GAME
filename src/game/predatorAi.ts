import * as THREE from "three";
import { WORLD_SIZE } from "./constants";
import { partyDamageRemotePlayer, partyHostCombatTargets, partyWorldGuestActive } from "./partyWorldSync";
import { clampPointToRegion, getRegionById, regionAtPosition, type Region } from "./regions";
import { clampOutOfSafeZones } from "./safeZones";
import { spawnBossRoar, spawnGroundShockwave, type CombatEffectContext } from "./combatEffects";
import type { MonsterId } from "./monsters";
import type { LocationMode, PredatorKind, WorldObject } from "./types";

export interface PredatorAiContext {
  locationMode(): LocationMode;
  isPanelOpen(): boolean;
  playerPosition: THREE.Vector3;
  activeRegions(): readonly Region[];
  predators(): Iterable<WorldObject>;
  predatorAggroRange(kind?: PredatorKind): number;
  predatorStrikeRange(kind?: PredatorKind): number;
  predatorStats(kind?: PredatorKind, monsterId?: MonsterId): { speed: number; cooldown: number; attackDamage: number };
  getGroundHeightAt(x: number, z: number): number;
  refreshSpatialObject(object: WorldObject): void;
  animateWalkCycle(object: WorldObject, delta: number, movementSpeed: number): void;
  damagePlayer(amount: number, showParticles: boolean, deathReason: string): boolean;
  effects(): CombatEffectContext; // 보스 강타/충격파 VFX
  showMessage(text: string): void; // 보스 궁극기 텔레그래프 안내
}

const BOSS_SLAM_COOLDOWN_MS = 9000;
const BOSS_SLAM_TELEGRAPH_MS = 750;
const BOSS_SLAM_RADIUS = 5.5;
const BOSS_SLAM_COLOR = 0xffb703;

// 보스 시그니처 슬램 — 예열(포효 텔레그래프) 예약. (비-update 이름 → VFX 허용)
function castBossSlam(context: PredatorAiContext, predator: WorldObject, now: number) {
  predator.root.userData.slamAt = now + BOSS_SLAM_TELEGRAPH_MS;
  predator.root.userData.slamCdUntil = now + BOSS_SLAM_COOLDOWN_MS;
  spawnBossRoar(context.effects(), predator.root.position, BOSS_SLAM_COLOR);
  context.showMessage(`${predator.name ?? "보스"}가 강력한 내려찍기를 준비합니다! 빠르게 벗어나세요.`);
}

// 슬램 착탄 — 텔레그래프 후 충격파 + 반경 안이면 데미지. (비-update 이름 → VFX 허용)
function resolveBossSlam(context: PredatorAiContext, predator: WorldObject, now: number) {
  const at = Number(predator.root.userData.slamAt ?? 0);
  if (at <= 0 || now < at) return;
  predator.root.userData.slamAt = 0;
  spawnGroundShockwave(context.effects(), predator.root.position, BOSS_SLAM_COLOR);
  const dmg = Math.round((predator.attackDamage ?? 8) * 1.8);
  if (Math.hypot(context.playerPosition.x - predator.root.position.x, context.playerPosition.z - predator.root.position.z) <= BOSS_SLAM_RADIUS) {
    context.damagePlayer(dmg, true, `${predator.name ?? "보스"}의 내려찍기에 맞아 체력이 모두 떨어졌습니다.`);
  }
}

const nextPosition = new THREE.Vector3();

// 종 특성별 공격 모션 — 2단계: 예열(웅크리고 뒤로 빠지며 부르르 떪) → 도약(플레이어 방향으로 실제 전진).
// 후퇴·전진 거리는 월드 단위라 멀리서도 또렷하게 읽힌다. 무거운 종일수록 예열이 길다.
interface AttackMotionProfile {
  duration: number; // ms
  pullBack: number; // 예열 후퇴 거리
  lunge: number; // 도약 전진 거리
  crouch: number; // 예열 웅크림 (y 스케일 감소율)
  rise: number; // 예열 상승 (곰 일어서기, 박쥐 치솟기)
  jump: number; // 도약 수직 이동 (박쥐는 음수 = 내리꽂기)
  pitch: number; // 도약 시 앞으로 숙이는 각
  stretch: number; // 도약 시 전방 신장률
}

const ATTACK_PROFILES: Record<NonNullable<WorldObject["predatorKind"]>, AttackMotionProfile> = {
  spider: { duration: 580, pullBack: 0.32, lunge: 0.85, crouch: 0.32, rise: 0, jump: 0.6, pitch: 0.3, stretch: 0.26 },
  wolf: { duration: 520, pullBack: 0.42, lunge: 1.0, crouch: 0.26, rise: 0, jump: 0.34, pitch: 0.36, stretch: 0.3 },
  lion: { duration: 560, pullBack: 0.48, lunge: 1.15, crouch: 0.28, rise: 0, jump: 0.4, pitch: 0.42, stretch: 0.32 },
  boar: { duration: 640, pullBack: 0.6, lunge: 1.55, crouch: 0.18, rise: 0, jump: 0.12, pitch: 0.2, stretch: 0.46 },
  snake: { duration: 620, pullBack: 0.55, lunge: 1.3, crouch: 0.38, rise: 0, jump: 0.16, pitch: 0.3, stretch: 0.62 },
  bat: { duration: 540, pullBack: 0.2, lunge: 1.05, crouch: 0.08, rise: 0.5, jump: -0.85, pitch: 0.5, stretch: 0.2 },
  scorpion: { duration: 660, pullBack: 0.28, lunge: 0.5, crouch: 0.22, rise: 0, jump: 0.1, pitch: 0.12, stretch: 0.12 },
  bear: { duration: 760, pullBack: 0.3, lunge: 0.75, crouch: 0, rise: 0.55, jump: 0.15, pitch: 0.55, stretch: 0.12 },
  zombie: { duration: 660, pullBack: 0.38, lunge: 0.9, crouch: 0.2, rise: 0, jump: 0.12, pitch: 0.26, stretch: 0.2 },
  ghost: { duration: 580, pullBack: 0.5, lunge: 1.25, crouch: 0.16, rise: 0.2, jump: 0.26, pitch: 0.12, stretch: 0.3 },
  drake: { duration: 580, pullBack: 0.42, lunge: 1.1, crouch: 0.24, rise: 0.25, jump: 0.5, pitch: 0.36, stretch: 0.3 },
};

const WINDUP_END = 0.42;
const GHOST_BASE_OPACITY = 0.52;
const ZOMBIE_ARM_REST = -0.08;

function resetAttackExtras(predator: WorldObject) {
  const tail = predator.root.userData.scorpionTail;
  if (tail instanceof THREE.Object3D) tail.rotation.z = 0;
  const arms = predator.root.userData.zombieArms;
  if (Array.isArray(arms)) {
    for (const arm of arms) if (arm instanceof THREE.Object3D) arm.rotation.z = ZOMBIE_ARM_REST;
  }
  const ghostMaterials = predator.root.userData.ghostMaterials;
  if (Array.isArray(ghostMaterials)) {
    for (const material of ghostMaterials) if (material instanceof THREE.MeshStandardMaterial) material.opacity = GHOST_BASE_OPACITY;
  }
}

export function triggerPredatorAttackMotion(predator: WorldObject, now: number, forwardX = 0, forwardZ = 0) {
  predator.root.userData.attackStartedAt = now;
  predator.root.userData.attackDuration = (ATTACK_PROFILES[predator.predatorKind ?? "wolf"] ?? ATTACK_PROFILES.wolf).duration * (predator.fieldBossId ? 1.3 : 1);
  predator.root.userData.attackForwardX = forwardX;
  predator.root.userData.attackForwardZ = forwardZ;
  if (!predator.root.userData.baseScale) predator.root.userData.baseScale = predator.root.scale.clone();
}

export function animatePredatorAttackMotion(predator: WorldObject, now: number) {
  const startedAt = Number(predator.root.userData.attackStartedAt ?? 0);
  const duration = Number(predator.root.userData.attackDuration ?? 0);
  const baseScale = predator.root.userData.baseScale instanceof THREE.Vector3 ? predator.root.userData.baseScale : predator.root.scale;
  if (duration <= 0 || now - startedAt >= duration) {
    predator.root.rotation.x = 0;
    predator.root.rotation.z = 0;
    predator.root.scale.copy(baseScale);
    resetAttackExtras(predator);
    return;
  }
  const phase = THREE.MathUtils.clamp((now - startedAt) / duration, 0, 1);
  const kind = predator.predatorKind ?? "wolf";
  const profile = ATTACK_PROFILES[kind] ?? ATTACK_PROFILES.wolf;
  // 예열: 0→정점→도약 직후 소멸 / 도약: 예열이 끝나는 지점에서 폭발적으로
  const windup = phase < WINDUP_END ? Math.sin((phase / WINDUP_END) * (Math.PI / 2)) : Math.max(0, 1 - (phase - WINDUP_END) / 0.16);
  const strike = phase <= WINDUP_END ? 0 : Math.sin(((phase - WINDUP_END) / (1 - WINDUP_END)) * Math.PI);
  // 보스급은 모션을 훨씬 크고 묵직하게. 추가로 고렙(50+) 일반 몬스터도 레벨에 비례해 모션을 더 화려·격하게.
  const eliteLevel = Number(predator.monsterLevel ?? 0);
  const eliteBoost = eliteLevel >= 50 ? Math.min(0.5, 0.15 + (eliteLevel - 50) / 150) : 0;
  const bf = (predator.fieldBossId ? 1.5 : 1) + eliteBoost;
  const shake = windup * Math.sin(phase * 46) * 0.085 * bf; // 예열 떨림 — "곧 덤빈다"는 신호
  const forwardX = Number(predator.root.userData.attackForwardX ?? 0);
  const forwardZ = Number(predator.root.userData.attackForwardZ ?? 0);
  const advance = (strike * profile.lunge - windup * profile.pullBack) * (predator.fieldBossId ? 1.25 : 1);

  predator.root.position.x += forwardX * advance;
  predator.root.position.z += forwardZ * advance;
  predator.root.position.y += (windup * profile.rise + strike * profile.jump) * bf;
  predator.root.rotation.x = (windup * 0.14 - strike * profile.pitch - windup * (profile.rise > 0.3 ? 0.5 : 0)) * (predator.fieldBossId ? 1.35 : 1);
  predator.root.rotation.z = shake;
  predator.root.scale.set(
    baseScale.x * (1 + (strike * profile.stretch - windup * 0.1) * bf),
    baseScale.y * (1 + (-windup * profile.crouch + strike * 0.06 + windup * (profile.rise > 0.3 ? 0.16 : 0)) * bf),
    baseScale.z * (1 + strike * profile.stretch * 0.4 * bf),
  );

  if (kind === "scorpion") {
    // 꼬리를 더 치켜들었다가 머리 위로 강하게 내려찍는다
    const tail = predator.root.userData.scorpionTail;
    if (tail instanceof THREE.Object3D) tail.rotation.z = windup * 0.5 - strike * 1.6;
    return;
  }
  if (kind === "zombie") {
    // 양팔을 높이 들었다가 함께 내려친다
    const arms = predator.root.userData.zombieArms;
    if (Array.isArray(arms)) {
      for (const arm of arms) if (arm instanceof THREE.Object3D) arm.rotation.z = ZOMBIE_ARM_REST - windup * 0.95 + strike * 0.8;
    }
    return;
  }
  if (kind === "ghost") {
    // 예열에 깜박이고 도약에 반투명해지며 들이닥친다
    const ghostMaterials = predator.root.userData.ghostMaterials;
    if (Array.isArray(ghostMaterials)) {
      const opacity = GHOST_BASE_OPACITY - strike * 0.32 - windup * Math.abs(Math.sin(phase * 40)) * 0.18;
      for (const material of ghostMaterials) if (material instanceof THREE.MeshStandardMaterial) material.opacity = opacity;
    }
  }
}

export function updatePredatorAi(context: PredatorAiContext, delta: number) {
  if (context.locationMode() !== "overworld") return;
  if (partyWorldGuestActive()) return; // 파티 게스트 — 몬스터는 호스트가 시뮬레이션 (partyWorldSync 가 보간)
  const now = performance.now();
  const partyTargets = partyHostCombatTargets(); // 호스트: 같은 맵 게스트도 어그로/공격 대상
  for (const predator of context.predators()) {
    // 화면 밖(거리컬링으로 root.visible=false)이고 비어그로(angry 아님 + 플레이어가 어그로 범위 밖)면 풀 갱신 스킵.
    // 안 보이는 배회 몬스터의 이동·걷기·공간갱신 비용 제거 — 시각/추격 무영향(재가시·근접 시 즉시 재개).
    if (!predator.root.visible && (predator.angryUntil ?? 0) <= now) {
      const px = context.playerPosition.x - predator.root.position.x;
      const pz = context.playerPosition.z - predator.root.position.z;
      const ar = predator.attackRange ?? context.predatorAggroRange(predator.predatorKind);
      if (px * px + pz * pz > ar * ar) continue;
    }
    let dx = context.playerPosition.x - predator.root.position.x;
    let dz = context.playerPosition.z - predator.root.position.z;
    let distance = Math.hypot(dx, dz);
    let remoteTarget: string | null = null;
    let remotePanelOpen = false;
    for (const candidate of partyTargets) {
      const rdx = candidate.x - predator.root.position.x;
      const rdz = candidate.z - predator.root.position.z;
      const rd = Math.hypot(rdx, rdz);
      if (rd < distance) {
        distance = rd;
        dx = rdx;
        dz = rdz;
        remoteTarget = candidate.nickname;
        remotePanelOpen = candidate.panelOpen;
      }
    }
    const aggroRange = predator.attackRange ?? context.predatorAggroRange(predator.predatorKind);
    const aggroed = distance <= aggroRange || (predator.angryUntil ?? 0) > now;
    if (!aggroed && Math.random() < 0.012) predator.wanderAngle = Math.random() * Math.PI * 2;
    if (!aggroed && distance > aggroRange * 1.8) predator.wanderAngle = (predator.wanderAngle ?? 0) + THREE.MathUtils.randFloatSpread(0.08);
    const angle = aggroed ? Math.atan2(dz, dx) : predator.wanderAngle ?? 0;
    const predatorStats = context.predatorStats(predator.predatorKind, predator.monsterId as MonsterId | undefined);
    const speed = aggroed ? predatorStats.speed : predatorStats.speed * 0.28;
    nextPosition.set(
      THREE.MathUtils.clamp(predator.root.position.x + Math.cos(angle) * speed * delta, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6),
      0,
      THREE.MathUtils.clamp(predator.root.position.z + Math.sin(angle) * speed * delta, -WORLD_SIZE / 2 + 6, WORLD_SIZE / 2 - 6),
    );
    const region = getRegionById(predator.regionId, context.activeRegions()) ?? regionAtPosition(predator.root.position, context.activeRegions());
    if (region) clampPointToRegion(nextPosition, region);
    clampOutOfSafeZones(nextPosition); // 마을·훈련장 진입 차단(추격 중에도)
    nextPosition.y = context.getGroundHeightAt(nextPosition.x, nextPosition.z);
    predator.root.position.copy(nextPosition);
    predator.root.rotation.y = -angle;
    animatePredatorAttackMotion(predator, now);
    clampOutOfSafeZones(predator.root.position); // 도약(lunge)이 안전구역으로 찌르지 못하게 재클램프
    context.refreshSpatialObject(predator);
    context.animateWalkCycle(predator, delta, aggroed ? 0.82 : 0.28);
    predator.attackCooldown = Math.max(0, (predator.attackCooldown ?? 0) - delta);
    if (predator.fieldBossId) resolveBossSlam(context, predator, now); // 예약된 슬램 착탄
    // 인벤토리/제작창 등을 보는 동안에는 공격하지 않는다 — 패널 중엔 이동도 못 하므로 불공정한 피격을 막는다
    // (원격 게스트도 프레즌스의 panelOpen 플래그로 같은 보호를 받는다)
    const canAct = aggroed && (remoteTarget !== null ? !remotePanelOpen : !context.isPanelOpen());
    // 보스 시그니처 슬램(궁극기) — 쿨다운마다 텔레그래프 후 광역 내려찍기
    if (predator.fieldBossId && canAct && distance < 13 && Number(predator.root.userData.slamCdUntil ?? 0) <= now && Number(predator.root.userData.slamAt ?? 0) <= 0) {
      castBossSlam(context, predator, now);
    }
    if (canAct && distance < context.predatorStrikeRange(predator.predatorKind) && (predator.attackCooldown ?? 0) <= 0) {
      predator.attackCooldown = predatorStats.cooldown;
      triggerPredatorAttackMotion(predator, now, dx / Math.max(0.001, distance), dz / Math.max(0.001, distance));
      if (predator.fieldBossId) spawnGroundShockwave(context.effects(), predator.root.position, BOSS_SLAM_COLOR); // 보스 강타 = 지면 충격파
      const attackDamage = predator.attackDamage ?? predatorStats.attackDamage;
      if (remoteTarget !== null) partyDamageRemotePlayer(remoteTarget, attackDamage, predator.name ?? "몬스터");
      else context.damagePlayer(attackDamage, true, `${predator.name}에게 공격받아 체력이 모두 떨어졌습니다.`);
    }
  }
}
