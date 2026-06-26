import * as THREE from "three";
import { WORLD_SIZE } from "./constants";
import { clampOutOfSafeZones, isInSafeZone } from "./safeZones";
import { partyWorldGuestActive } from "./partyWorldSync";
import { spawnBossBreathStream, spawnBossRoar, spawnDragonClawBurst, spawnDragonFireBurst, spawnGroundShockwave, type CombatEffectContext } from "./combatEffects";
import type { BossKind, LocationMode, WorldObject } from "./types";

// leaf: main.ts 를 import 하지 않는다. 용/드래곤의 부유·방향 + 능동 공격(발톱 / 시그니처 브레스)을 담당.
// 호스트 권위 — 파티 게스트는 스냅샷 보간이므로 AI 를 돌리지 않는다(predatorAi 와 동일).
// updateDragons 는 hotpath 이름이라 THREE 할당 금지 → 할당/VFX 는 비-update 헬퍼(castDragonAttack/resolveDragonBreath)로 격리한다.

interface DragonStats { name: string; fireDamage: number; clawDamage: number; attackRange: number }

export interface DragonAiContext {
  locationMode(): LocationMode;
  isPanelOpen(): boolean;
  playerPosition: THREE.Vector3;
  dragons(): Iterable<WorldObject>;
  elapsed(): number; // clock.elapsedTime — 부유/날갯짓
  now(): number; // performance.now() — 공격 쿨다운/타이밍
  getGroundHeightAt(x: number, z: number): number;
  refreshSpatialObject(object: WorldObject): void;
  effects(): CombatEffectContext;
  bossStats(kind?: BossKind): DragonStats;
  isBossUnlocked(kind: BossKind): boolean;
  monsterChaseSpeedMul(): number; // 난이도 추격속도 배율(쉬움=1)
  damagePlayer(amount: number, showParticles: boolean, deathReason: string, attacker?: WorldObject): boolean;
  showMessage(text: string): void;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
}

// 종류별 브레스 색/쿨다운/배율 — monsters.ts 는 순수 데이터로 두고 전투 튜너블은 여기 집중.
const DRAGON_PROFILES: Record<BossKind, { colors: number[]; cooldown: number; breathMul: number }> = {
  dragon: { colors: [0xfff3a1, 0xff7a1a, 0xdc2626], cooldown: 3.4, breathMul: 1.5 },
  fire_dragon: { colors: [0xfff1c0, 0xff5a1a, 0xb91c1c], cooldown: 3.1, breathMul: 1.6 },
  red_dragon: { colors: [0xffd0d0, 0xff2a2a, 0x7f1d1d], cooldown: 2.9, breathMul: 1.6 },
  laser_dragon: { colors: [0xd0ffff, 0x22d3ee, 0x0ea5e9], cooldown: 2.7, breathMul: 1.7 },
  dark_dragon: { colors: [0xe9d5ff, 0xa855f7, 0x6d28d9], cooldown: 2.5, breathMul: 1.7 },
  immortal: { colors: [0xfff7d6, 0xc7b3ff, 0x8b5cf6], cooldown: 2.3, breathMul: 1.9 },
};

const ATTACK_DURATION = 900; // ms — rear-up(예열) → 내리꽂기(강타). 크게 보이도록 길게.
const WINDUP = 0.4;
const BREATH_DELAY_MS = 620; // 예열 후 브레스 착탄까지(텔레그래프로 회피 가능)
const BREATH_RADIUS = 3.7;
const DRAGON_CHASE_SPEED = 10.9; // 보스 추격 +15% (9.5→10.9). 걷기(7) < 추격 < 달리기(14): 걸으면 따라잡히고 달려야 도망칠 수 있다
const DRAGON_CHASE_STOP = 7; // 덩치가 커서 더 멀리서 멈춰야 시야에 들어오고 타게팅 가능(4.6→7). 발톱은 ≤8 이라 여전히 닿음
export const DRAGON_AGGRO_MS = 9000; // 피격/사거리 진입 시 추격 유지 시간 — 사거리 안이면 매 프레임 갱신(끈질긴 추격)

// 공격 모션 — 루트를 pitch 로 뒤로 젖혔다 앞으로 내리꽂는다(머리 포함 전신 rear-up→strike). 날갯짓 증폭값 반환. (할당 없음)
function dragonAttackBoost(dragon: WorldObject, now: number): number {
  const startedAt = Number(dragon.root.userData.dragonAttackAt ?? 0);
  if (startedAt <= 0) return 0;
  const phase = (now - startedAt) / ATTACK_DURATION;
  if (phase >= 1) {
    dragon.root.userData.dragonAttackAt = 0;
    dragon.root.rotation.x = 0;
    return 0;
  }
  const windup = phase < WINDUP ? Math.sin((phase / WINDUP) * (Math.PI / 2)) : 0;
  const strike = phase >= WINDUP ? Math.sin(((phase - WINDUP) / (1 - WINDUP)) * Math.PI) : 0;
  dragon.root.rotation.x = windup * 0.5 - strike * 0.62;
  return windup + strike;
}

// 예약된 브레스 착탄 — 텔레그래프 시간이 지나면 충격파+화염 + (착탄점 안에 있으면) 데미지. (비-update 이름 → 할당 허용)
function resolveDragonBreath(context: DragonAiContext, dragon: WorldObject, now: number) {
  const at = Number(dragon.root.userData.breathHitAt ?? 0);
  if (at <= 0 || now < at) return;
  dragon.root.userData.breathHitAt = 0;
  const tx = Number(dragon.root.userData.breathTX ?? 0);
  const tz = Number(dragon.root.userData.breathTZ ?? 0);
  const color = Number(dragon.root.userData.breathColor ?? 0xff7a1a);
  const impact = new THREE.Vector3(tx, context.getGroundHeightAt(tx, tz), tz);
  spawnGroundShockwave(context.effects(), impact, color);
  spawnDragonFireBurst(context.effects(), impact);
  if (Math.hypot(context.playerPosition.x - tx, context.playerPosition.z - tz) <= BREATH_RADIUS) {
    context.damagePlayer(Number(dragon.root.userData.breathDmg ?? 12), true, `${String(dragon.root.userData.breathName ?? "용")}의 브레스에 휩싸여 체력이 모두 떨어졌습니다.`, dragon);
  }
}

// 공격 시전 — 근접 발톱(즉시) 또는 시그니처 브레스(텔레그래프 예약). (비-update 이름 → VFX/할당 허용)
function castDragonAttack(context: DragonAiContext, dragon: WorldObject, kind: BossKind, distance: number, now: number) {
  const stats = context.bossStats(kind);
  const profile = DRAGON_PROFILES[kind] ?? DRAGON_PROFILES.dragon;
  dragon.root.userData.dragonAttackAt = now; // 모션 시작
  if (distance <= 8 && Math.random() < 0.5) {
    dragon.attackCooldown = 1.8;
    spawnDragonClawBurst(context.effects(), dragon.root.position);
    context.playTone(150, 0.16, "sawtooth", 0.03);
    context.damagePlayer(stats.clawDamage, true, `${stats.name}의 발톱에 당해 체력이 모두 떨어졌습니다.`, dragon);
    return;
  }
  dragon.attackCooldown = profile.cooldown;
  const mouth = dragon.root.position.clone();
  mouth.y += 3.2;
  spawnBossRoar(context.effects(), new THREE.Vector3(dragon.root.position.x, context.getGroundHeightAt(dragon.root.position.x, dragon.root.position.z), dragon.root.position.z), profile.colors[1]);
  spawnBossBreathStream(context.effects(), mouth, context.playerPosition, profile.colors);
  context.playTone(90, 0.4, "sawtooth", 0.035);
  dragon.root.userData.breathHitAt = now + BREATH_DELAY_MS;
  dragon.root.userData.breathTX = context.playerPosition.x;
  dragon.root.userData.breathTZ = context.playerPosition.z;
  dragon.root.userData.breathDmg = Math.round(stats.fireDamage * profile.breathMul);
  dragon.root.userData.breathColor = profile.colors[1];
  dragon.root.userData.breathName = stats.name;
  context.showMessage(`${stats.name}이(가) 브레스를 내뿜습니다! 착탄 지점에서 벗어나세요.`);
}

export function updateDragons(context: DragonAiContext, delta: number) {
  if (context.locationMode() !== "overworld") return;
  if (partyWorldGuestActive()) return;
  const now = context.now();
  const t = context.elapsed();
  for (const dragon of context.dragons()) {
    const kind = (dragon.bossKind ?? "dragon") as BossKind;
    const unlocked = context.isBossUnlocked(kind);
    const panelOpen = context.isPanelOpen();
    const dxp = context.playerPosition.x - dragon.root.position.x;
    const dzp = context.playerPosition.z - dragon.root.position.z;
    const distance = Math.hypot(dxp, dzp);
    const attackRange = context.bossStats(kind).attackRange;
    // 추격 — 한 번 노리면(피격 또는 사거리 진입) 끈질기게 따라온다. 걷기보다 빨라서 달려야 도망칠 수 있다.
    if (unlocked && !panelOpen && ((dragon.angryUntil ?? 0) > now || distance <= attackRange)) {
      dragon.angryUntil = now + DRAGON_AGGRO_MS; // 사거리 안이면 매 프레임 갱신 → 멀어져도 일정 시간 추격
      if (distance > DRAGON_CHASE_STOP) {
        const step = (DRAGON_CHASE_SPEED * context.monsterChaseSpeedMul() * delta) / Math.max(distance, 0.001);
        dragon.root.position.x = Math.max(-WORLD_SIZE / 2 + 6, Math.min(WORLD_SIZE / 2 - 6, dragon.root.position.x + dxp * step));
        dragon.root.position.z = Math.max(-WORLD_SIZE / 2 + 6, Math.min(WORLD_SIZE / 2 - 6, dragon.root.position.z + dzp * step));
        clampOutOfSafeZones(dragon.root.position); // 마을·훈련장 안엔 못 들어옴 (다른 몬스터와 동일 — 마을은 안전지대 유지)
      }
    }
    dragon.root.rotation.y = -Math.atan2(dzp, dxp);
    dragon.root.position.y = context.getGroundHeightAt(dragon.root.position.x, dragon.root.position.z) + 0.18 + Math.sin(t * 1.3 + dragon.root.position.x * 0.02) * 0.18;
    const boost = dragonAttackBoost(dragon, now);
    for (const child of dragon.root.children) {
      if (child.userData.dragonWing) child.rotation.z = (child.userData.baseZ ?? 0) + Math.sin(t * 4.8) * (0.22 + boost * 0.6);
      else if (child.userData.dragonTail) child.rotation.y = Math.sin(t * 2.2) * (0.18 + boost * 0.4);
    }
    context.refreshSpatialObject(dragon);
    resolveDragonBreath(context, dragon, now);
    dragon.attackCooldown = Math.max(0, (dragon.attackCooldown ?? 0) - delta);
    if (panelOpen || !unlocked || (dragon.root.userData.dragonAttackAt ?? 0) > 0 || (dragon.attackCooldown ?? 0) > 0) continue;
    if (distance <= attackRange && !isInSafeZone(context.playerPosition.x, context.playerPosition.z)) castDragonAttack(context, dragon, kind, distance, now); // 마을 안 플레이어는 공격 못 함
  }
}
