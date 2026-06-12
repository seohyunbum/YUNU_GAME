import * as THREE from "three";
import { calculateCombatDamage } from "./combat";
import { PREDATOR_RETALIATE_MS } from "./constants";
import { spawnPredator, type EntitySpawnContext } from "./entitySpawns";
import { applyFieldBossDefinition, fieldBossById } from "./fieldBosses";
import { ITEM_NAMES } from "./items";
import { applyPredatorMonsterDefinition, experienceRewardForTarget, predatorLootForKind, type MonsterId } from "./monsters";
import type { MobSnapshot, PartyMessage, PartySession, PresenceData } from "./party";
// predatorAi ↔ partyWorldSync 는 함수 수준 순환 — 양쪽 모두 호출 시점이 런타임이라 안전 (모듈 초기화 시 미사용)
import { animatePredatorAttackMotion, triggerPredatorAttackMotion } from "./predatorAi";
import { getRegionById, regionAtPosition, type Region } from "./regions";
import type { ItemId, PredatorKind, WorldObject } from "./types";

// 파티 5차 — 호스트 권위 월드 공유.
// 호스트가 자기 맵의 야생 몬스터(필드 보스 포함)를 시뮬레이션하고 8Hz 풀스냅샷으로 브로드캐스트한다.
// 게스트는 스냅샷 diff 로 스폰·보간·제거만 하고(로컬 AI/스폰 게이트 OFF), 공격은 attackRequest 로
// 호스트에 보낸 뒤 판정 결과(hp 는 다음 스냅샷, 처치는 partyKill)를 받는다. 처치 경험치는 같은 맵
// 파티원 전원에게 100% 지급, 전리품은 처치자에게만 지급(드랍 오브젝트 동기화 회피, 자동 획득).
// 시드 동기화(lockstep)는 월드 난수가 비시드라 불가능 — docs/party-system.md §10.
//
// 게이트는 스냅샷 기반: 게스트라도 "호스트와 같은 맵 + 스냅샷이 신선(2초)"할 때만 로컬 시뮬을 멈춘다.
// 호스트가 다른 맵/실내/타이틀/백그라운드면 게이트가 풀려 게스트는 자기 월드에서 로컬 사냥을 계속한다.

export const MOB_SYNC_INTERVAL_MS = 125; // 8Hz — 프레즌스와 같은 주기
export const MOB_SYNC_STALE_MS = 2_000; // 스냅샷이 이만큼 끊기면 동기화 해제 (호스트 실내/백그라운드/이탈)
const MOB_LERP_PER_SECOND = 9;
const PENDING_HIT_TTL_MS = 600; // 낙관적 타격이 권위 스냅샷에 반영되길 기다리는 최대 시간
const MOB_SEND_MAX_BUFFERED = 262_144; // 적체된 게스트에게는 스냅샷을 건너뛴다 (HOL 방지)
const RESTORE_PER_TICK = 4; // 로컬 몬스터 복원 스태거 (일괄 스폰 히치 방지)

// main 이 제공하는 월드 능력 — 게스트 렌더/판정 반영과 호스트 판정에 필요한 최소 집합
export interface PartyWorldContext {
  entityContext: EntitySpawnContext;
  activeRegions(): readonly Region[];
  mapXpScale(): number;
  predators(): Iterable<WorldObject>;
  getObject(id: string): WorldObject | undefined;
  removeObject(id: string): void; // 리스폰 큐 정상 등록 (호스트 처치)
  removeObjectSilent(id: string): void; // 리스폰 큐 미등록 (동기화 몬스터·합류 정리)
  hitFeedback(target: WorldObject, damage: number, killed: boolean): void;
  showMessage(text: string): void;
  gainExperience(amount: number): void;
  creditHostKill(target: WorldObject): void; // 호스트 처치 크레딧 (펫/플레이어 XP + 필드보스 기록)
  rollLoot(item: ItemId, count: number): number; // 처치자 전리품 — 확률 롤 포함, 획득 수량 반환
  recordFieldBossDefeat(id: string): void;
  damageLocalPlayer(amount: number, sourceName: string): boolean; // true = 사망
  animateWalkCycle(object: WorldObject, delta: number, speed: number): void;
  refreshSpatialObject(object: WorldObject): void;
}

export interface PartyWorldSyncInit {
  session(): PartySession | null;
  localPresence(): PresenceData;
  getGroundHeightAt(x: number, z: number): number;
  world: PartyWorldContext | null;
}

// 합류 시 치운 로컬 몬스터의 복원 정보 — 리스폰 큐 대신 자체 보관 (clearWorld 와이프에 면역)
interface ClearedMobDescriptor {
  kind?: PredatorKind;
  monsterId?: string;
  regionId?: string;
  x: number;
  z: number;
}

interface MobTargetState {
  x: number;
  z: number;
  yaw: number;
  lastAtkAt: number; // 마지막으로 재생한 공격 모션의 시작 시각 (중복 트리거 방지)
}

let init: PartyWorldSyncInit | null = null;
let hookedSession: PartySession | null = null;
let lastMobSendAt = 0;
let lastMobsMapId: string | null = null; // 마지막 스냅샷의 호스트 맵
let lastMobsAt = 0; // 마지막 스냅샷 수신 시각
let clearedForMapId: string | null = null; // 게스트: 이 맵의 로컬 몬스터를 정리했는가
let mobHitGraceUntil = 0; // 사망 직후 적체된 mobHit 일괄 적용(연쇄 사망) 방지
let knownPresences: PresenceData[] = [];
const syncedByHostId = new Map<string, WorldObject>(); // 게스트: 호스트 id → 로컬 오브젝트
const hostIdByLocalId = new Map<string, string>();
const mobTargets = new Map<string, MobTargetState>(); // 보간 목표 (호스트 id 키)
const pendingHitsByHostId = new Map<string, number[]>(); // 낙관적 타격 시각 — 스냅샷 역행 방지
const clearedMobsByMap = new Map<string, ClearedMobDescriptor[]>();
let debugXpGained = 0;
let debugLastKill: { name: string; killer: string; xp: number } | null = null;
let debugLastSentIds: string[] = [];
let debugAttackRequests = 0;

export function initPartyWorldSync(initArg: PartyWorldSyncInit) {
  init = initArg;
  resetPartyWorldSync();
  clearedMobsByMap.clear(); // 페이지 수명 단위 초기화 — 세션 간에는 보존 (복원용)
}

export function resetPartyWorldSync() {
  for (const object of syncedByHostId.values()) init?.world?.removeObjectSilent(object.id);
  syncedByHostId.clear();
  hostIdByLocalId.clear();
  mobTargets.clear();
  pendingHitsByHostId.clear();
  clearedForMapId = null;
  lastMobsMapId = null;
  lastMobsAt = 0;
  mobHitGraceUntil = 0;
  knownPresences = [];
  lastMobSendAt = 0;
}

// 게스트 모드 여부 — main 의 스폰/리스폰/필드보스 ensure 게이트와 predatorAi 가 이 값으로 로컬 시뮬을 멈춘다.
// "호스트와 같은 맵 + 스냅샷 신선" 일 때만 true: 호스트가 다른 맵·실내·타이틀이면 게스트 자기 월드가 살아난다.
export function partyWorldGuestActive(): boolean {
  if (!init?.world || init.session()?.role !== "guest") return false;
  return lastMobsMapId === init.localPresence().mapId && performance.now() - lastMobsAt < MOB_SYNC_STALE_MS;
}

// 프레즌스 수신 훅 (partyPresence 가 호출) — 호스트는 게스트 위치를 몬스터 타게팅에 쓴다
export function partyWorldSyncOnPresences(list: PresenceData[]) {
  knownPresences = list;
}

// 호스트 몬스터 AI 가 노릴 수 있는 파티원 좌표 (호스트와 같은 맵 + 인게임만, 패널 보호 플래그 포함)
export function partyHostCombatTargets(): { x: number; z: number; nickname: string; panelOpen: boolean }[] {
  if (!init?.world || hookedSession?.role !== "host") return [];
  const mapId = init.localPresence().mapId;
  return knownPresences
    .filter((entry) => entry.inGame && entry.mapId === mapId)
    .map((entry) => ({ x: entry.x, z: entry.z, nickname: entry.nickname, panelOpen: entry.panelOpen ?? false }));
}

// 호스트 몬스터가 게스트를 타격 — 해당 게스트에게 mobHit 전달
export function partyDamageRemotePlayer(nickname: string, amount: number, sourceName: string) {
  if (!init || hookedSession?.role !== "host") return;
  hookedSession.sendGame({ type: "mobHit", nickname, amount, name: sourceName, mapId: init.localPresence().mapId });
}

// 게스트 공격 가로채기 — 동기화 몬스터에만 개입한다. true 반환 시 로컬 판정 생략.
// 낙관적 표시(체력 감소·타격감·메시지)를 즉시 보여 주고, 권위 hp 는 다음 스냅샷이 덮어쓴다.
export function partyGuestAttackIntercept(target: WorldObject, power: number, kind: string): boolean {
  const world = init?.world;
  const session = init?.session() ?? null;
  if (!world || !session || session.role !== "guest") return false;
  const hostId = hostIdByLocalId.get(target.id);
  if (!hostId) return false; // 동기화 대상이 아니면 (자기 월드 몬스터) 로컬 판정 유지
  // combat.ts 본 경로와 동일 공식 — 필드 보스만 armor (DOT 포함, 메시지 억제만 dot 차등)
  const damage = target.armor ? Math.max(1, calculateCombatDamage(power, target.armor)) : Math.max(1, Math.floor(power));
  target.hp = (target.hp ?? 10) - damage;
  target.angryUntil = performance.now() + PREDATOR_RETALIATE_MS;
  world.hitFeedback(target, damage, target.hp <= 0);
  if (kind !== "dot" && kind !== "pet") world.showMessage(`${target.name}에게 ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.`);
  const pending = pendingHitsByHostId.get(hostId) ?? [];
  pending.push(performance.now());
  pendingHitsByHostId.set(hostId, pending);
  session.sendGame({ type: "attackRequest", targetId: hostId, power: Math.round(power), kind });
  return true;
}

// 호스트 처치 알림 — combat.ts·summonerPet 의 처치 지점들이 호출한다 (호스트 역할일 때만 브로드캐스트).
// 동기화 범위(wildPredator)와 XP 공유 범위를 일치시킨다 — 용·잼미니는 각자 로컬이므로 공유하면 이중 취득이 된다.
export function partyHostNotifyKill(target: WorldObject) {
  if (target.type !== "wildPredator") return; // 6차에서 용/잼미니 동기화 시 함께 해제
  if (!init?.world || hookedSession?.role !== "host") return;
  const me = init.localPresence();
  hookedSession.sendGame({
    type: "partyKill",
    name: target.name ?? "몬스터",
    xp: killExperience(target),
    killer: me.nickname,
    mapId: me.mapId,
    kind: target.predatorKind,
    fieldBossId: target.fieldBossId,
  });
}

function killExperience(target: WorldObject) {
  return Math.round(experienceRewardForTarget(target) * (init?.world?.mapXpScale() ?? 1));
}

// 매 프레임 — partyPresence.updatePartyPresence 가 호출 (main.ts 0줄)
export function partyWorldSyncTick(nowMs: number, delta: number) {
  if (!init) return;
  const session = init.session();
  if (session !== hookedSession) {
    resetPartyWorldSync();
    hookedSession = session;
    // world 미배선(프레즌스 전용 사용처·구형 테스트 mock)이면 게임 채널을 걸지 않는다
    if (init.world && session && typeof session.onGame === "function") session.onGame((message, from) => handleGameMessage(message, from));
  }
  processLocalRestore(); // 동기화가 풀린 맵의 로컬 몬스터 복원 (세션 없어도 동작)
  if (!session || !init.world) {
    publishDebug(session); // 세션 종료 후에도 디버그 훅은 최신 상태(빈 목록)를 보여 준다
    return;
  }
  if (session.role === "host") {
    if (nowMs - lastMobSendAt >= MOB_SYNC_INTERVAL_MS && init.localPresence().inGame) {
      lastMobSendAt = nowMs;
      session.sendGame(collectMobs(), MOB_SEND_MAX_BUFFERED);
    }
  } else {
    // 스냅샷이 끊기면(호스트 실내/백그라운드/이탈) 동기화 몬스터를 치우고 로컬 시뮬로 복귀 준비
    if (clearedForMapId !== null && nowMs - lastMobsAt > MOB_SYNC_STALE_MS) {
      clearSyncedMobs();
      clearedForMapId = null;
    }
    if (init.localPresence().inGame) guestLerpTick(delta); // 실내(동굴/집)에서는 보간·재접지 정지
  }
  publishDebug(session);
}

// 동기화가 풀린 상태에서, 합류 때 치운 로컬 몬스터를 현재 맵에 스태거 복원한다
function processLocalRestore() {
  const world = init?.world;
  if (!world) return;
  const me = init!.localPresence();
  if (!me.inGame || partyWorldGuestActive()) return;
  const stored = clearedMobsByMap.get(me.mapId);
  if (!stored || stored.length === 0) {
    if (stored) clearedMobsByMap.delete(me.mapId);
    return;
  }
  for (let count = 0; count < RESTORE_PER_TICK && stored.length > 0; count += 1) spawnLocalMob(stored.pop()!);
  if (stored.length === 0) clearedMobsByMap.delete(me.mapId);
}

function spawnLocalMob(descriptor: ClearedMobDescriptor) {
  const world = init!.world!;
  const object = spawnPredator(world.entityContext, new THREE.Vector3(descriptor.x, 0, descriptor.z), descriptor.kind);
  const regions = world.activeRegions();
  const region = getRegionById(descriptor.regionId, regions) ?? regionAtPosition(object.root.position, regions) ?? regions[0];
  if (descriptor.monsterId && region) applyPredatorMonsterDefinition(object, region, descriptor.monsterId as MonsterId);
  world.refreshSpatialObject(object);
}

function collectMobs(): PartyMessage {
  const world = init!.world!;
  const now = performance.now();
  const list: MobSnapshot[] = [];
  for (const predator of world.predators()) {
    const snap: MobSnapshot = {
      id: predator.id,
      name: predator.name ?? "몬스터",
      monsterId: predator.monsterId,
      kind: predator.predatorKind,
      regionId: predator.regionId,
      fieldBossId: predator.fieldBossId,
      x: Math.round(predator.root.position.x * 10) / 10,
      z: Math.round(predator.root.position.z * 10) / 10,
      yaw: Math.round(predator.root.rotation.y * 100) / 100,
      hp: Math.ceil(predator.hp ?? 1),
      armor: predator.armor || undefined,
    };
    // 진행 중인 공격 모션 — 게스트도 같은 전조(웅크림·도약)를 본다 (userData 부재 = 테스트 mock 가드)
    const userData = predator.root.userData ?? {};
    const attackStartedAt = Number(userData.attackStartedAt ?? 0);
    const attackDuration = Number(userData.attackDuration ?? 0);
    if (attackDuration > 0 && now - attackStartedAt < attackDuration) {
      snap.atk = Math.round(now - attackStartedAt);
      snap.afx = Math.round(Number(userData.attackForwardX ?? 0) * 100) / 100;
      snap.afz = Math.round(Number(userData.attackForwardZ ?? 0) * 100) / 100;
    }
    list.push(snap);
  }
  debugLastSentIds = list.map((entry) => entry.id);
  return { type: "mobs", mapId: init!.localPresence().mapId, list };
}

function handleGameMessage(message: PartyMessage, from?: string) {
  if (!init?.world) return;
  if (message.type === "attackRequest" && hookedSession?.role === "host") {
    // 호스트가 실내/타이틀이면 판정 보류 — 스냅샷(정정 채널)이 멈춘 동안의 처치는 리스폰 큐를 우회하게 된다
    if (!init.localPresence().inGame) return;
    debugAttackRequests += 1;
    hostApplyGuestAttack(message.targetId, message.power, from ?? "파티원");
  } else if (message.type === "mobs") applyMobsSnapshot(message.mapId, message.list);
  else if (message.type === "partyKill") onPartyKill(message);
  else if (message.type === "mobHit") onMobHit(message.nickname, message.amount, message.name, message.mapId);
}

// ── 호스트: 게스트 공격 판정 ───────────────────────────────────────────────
function hostApplyGuestAttack(targetId: string, power: number, killer: string) {
  const world = init!.world!;
  const target = world.getObject(targetId);
  if (!target || target.type !== "wildPredator") return; // 이미 죽었거나 무효 — 무시 (스냅샷이 정정)
  // combat.ts 본 경로와 동일 공식 — 필드 보스만 armor (게스트 낙관 표시와도 일치)
  const damage = target.armor ? Math.max(1, calculateCombatDamage(power, target.armor)) : Math.max(1, Math.floor(power));
  target.hp = (target.hp ?? 10) - damage;
  target.angryUntil = performance.now() + PREDATOR_RETALIATE_MS;
  world.hitFeedback(target, damage, target.hp <= 0);
  if (target.hp > 0) return;
  const kill = {
    type: "partyKill" as const,
    name: target.name ?? "몬스터",
    xp: killExperience(target),
    killer,
    mapId: init!.localPresence().mapId,
    kind: target.predatorKind,
    fieldBossId: target.fieldBossId,
  };
  world.creditHostKill(target); // 호스트도 같은 맵 100% 지급 규칙 — 펫/플레이어 XP + 필드보스 기록
  world.removeObject(target.id);
  world.showMessage(`${killer} 님이 ${kill.name}을(를) 쓰러뜨렸습니다!`);
  debugLastKill = { name: kill.name, killer, xp: kill.xp };
  hookedSession!.sendGame(kill);
}

// ── 게스트: 스냅샷 반영 ────────────────────────────────────────────────────
function applyMobsSnapshot(mapId: string, list: MobSnapshot[]) {
  const world = init!.world!;
  const me = init!.localPresence();
  lastMobsMapId = mapId; // 게이트 판정용 — 불일치 스냅샷도 기록해야 즉시 로컬 시뮬로 복귀한다
  lastMobsAt = performance.now();
  if (!me.inGame) return;
  if (mapId !== me.mapId) {
    // 호스트와 다른 맵 — 동기화 몬스터를 치우고 (자기 맵 로컬 사냥 허용) 복귀 시 재정리하도록 리셋
    if (syncedByHostId.size > 0) clearSyncedMobs();
    clearedForMapId = null;
    return;
  }
  // 새 게임/세이브 로드(clearWorld)가 월드를 비웠으면 북키핑을 실존 오브젝트와 동기화
  let wiped = false;
  for (const [hostId, object] of [...syncedByHostId]) {
    if (world.getObject(object.id) !== object) {
      removeSyncedMob(hostId);
      wiped = true;
    }
  }
  if (wiped) clearedForMapId = null;
  if (clearedForMapId !== me.mapId) {
    clearedForMapId = me.mapId;
    // 합류(또는 맵 복귀) 시 로컬 몬스터 정리 — 복원 정보를 자체 보관한다 (리스폰 큐는 clearWorld 에 와이프되므로 쓰지 않는다).
    // 필드 보스는 ensure 가 다시 세우므로 복원 목록에서 제외.
    const stored = clearedMobsByMap.get(me.mapId) ?? [];
    for (const predator of [...world.predators()]) {
      if (hostIdByLocalId.has(predator.id)) continue;
      if (!predator.fieldBossId) stored.push({ kind: predator.predatorKind, monsterId: predator.monsterId, regionId: predator.regionId, x: predator.root.position.x, z: predator.root.position.z });
      world.removeObjectSilent(predator.id);
    }
    if (stored.length > 60) stored.length = 60; // 재정리 중복 누적 상한
    clearedMobsByMap.set(me.mapId, stored);
  }
  const now = performance.now();
  const seen = new Set<string>();
  for (const snap of list) {
    seen.add(snap.id);
    const existing = syncedByHostId.get(snap.id);
    if (!existing) {
      spawnSyncedMob(snap, now);
      continue;
    }
    const targetState = mobTargets.get(snap.id)!;
    targetState.x = snap.x;
    targetState.z = snap.z;
    targetState.yaw = snap.yaw;
    applyMobAttackMotion(existing, targetState, snap, now);
    // 권위 hp — 단, 우리 타격이 아직 호스트 판정에 반영되지 않았으면(왕복 지연) 상향 되돌림은 보류한다
    const pending = pendingHitsByHostId.get(snap.id);
    if (pending) {
      const fresh = pending.filter((at) => now - at <= PENDING_HIT_TTL_MS);
      if (fresh.length > 0) {
        pendingHitsByHostId.set(snap.id, fresh);
        existing.hp = Math.min(existing.hp ?? snap.hp, snap.hp);
      } else {
        pendingHitsByHostId.delete(snap.id);
        existing.hp = snap.hp;
      }
    } else {
      existing.hp = snap.hp;
    }
    if (snap.armor !== undefined) existing.armor = snap.armor;
  }
  for (const hostId of [...syncedByHostId.keys()]) if (!seen.has(hostId)) removeSyncedMob(hostId);
}

function applyMobAttackMotion(object: WorldObject, targetState: MobTargetState, snap: MobSnapshot, now: number) {
  if (snap.atk === undefined) return;
  const startedAtLocal = now - snap.atk;
  if (Math.abs(startedAtLocal - targetState.lastAtkAt) <= 80) return; // 같은 모션의 후속 스냅샷
  targetState.lastAtkAt = startedAtLocal;
  // 전방 0,0 = 제자리 모션 — 위치는 스냅샷 보간이 책임지므로 이중 변위를 피한다
  triggerPredatorAttackMotion(object, startedAtLocal, 0, 0);
}

function spawnSyncedMob(snap: MobSnapshot, now: number) {
  const world = init!.world!;
  const object = spawnPredator(world.entityContext, new THREE.Vector3(snap.x, 0, snap.z), snap.kind as PredatorKind | undefined);
  object.partyTransient = true; // 세이브/worldState 에 영속되지 않는다 (호스트 월드의 뷰일 뿐)
  const regions = world.activeRegions();
  const region = getRegionById(snap.regionId, regions) ?? regionAtPosition(object.root.position, regions) ?? regions[0];
  if (snap.monsterId && region) applyPredatorMonsterDefinition(object, region, snap.monsterId as MonsterId);
  if (snap.fieldBossId) {
    const def = fieldBossById(snap.fieldBossId);
    if (def) applyFieldBossDefinition(object, def);
  }
  object.name = snap.name;
  object.hp = snap.hp;
  if (snap.armor !== undefined) object.armor = snap.armor;
  object.root.rotation.y = snap.yaw;
  object.root.position.y = init!.getGroundHeightAt(snap.x, snap.z);
  world.refreshSpatialObject(object);
  syncedByHostId.set(snap.id, object);
  hostIdByLocalId.set(object.id, snap.id);
  const targetState: MobTargetState = { x: snap.x, z: snap.z, yaw: snap.yaw, lastAtkAt: 0 };
  mobTargets.set(snap.id, targetState);
  applyMobAttackMotion(object, targetState, snap, now);
}

function removeSyncedMob(hostId: string) {
  const object = syncedByHostId.get(hostId);
  syncedByHostId.delete(hostId);
  mobTargets.delete(hostId);
  pendingHitsByHostId.delete(hostId);
  if (!object) return;
  hostIdByLocalId.delete(object.id);
  init?.world?.removeObjectSilent(object.id);
}

function clearSyncedMobs() {
  for (const hostId of [...syncedByHostId.keys()]) removeSyncedMob(hostId);
}

function guestLerpTick(delta: number) {
  const world = init!.world!;
  const now = performance.now();
  const alpha = Math.min(1, delta * MOB_LERP_PER_SECOND);
  for (const [hostId, object] of syncedByHostId) {
    if (world.getObject(object.id) !== object) continue; // clearWorld 직후 — 다음 스냅샷의 liveness 정리 대기
    const target = mobTargets.get(hostId);
    if (!target) continue;
    const root = object.root;
    const moveDistance = Math.hypot(target.x - root.position.x, target.z - root.position.z);
    root.position.x += (target.x - root.position.x) * alpha;
    root.position.z += (target.z - root.position.z) * alpha;
    root.position.y = init!.getGroundHeightAt(root.position.x, root.position.z);
    let yawDelta = target.yaw - root.rotation.y;
    yawDelta = ((yawDelta + Math.PI) % (Math.PI * 2)) - Math.PI;
    root.rotation.y += yawDelta * alpha;
    animatePredatorAttackMotion(object, now);
    world.refreshSpatialObject(object);
    world.animateWalkCycle(object, delta, moveDistance > 0.08 ? 0.82 : 0.18);
  }
}

// ── 게스트: 처치/피격 이벤트 ───────────────────────────────────────────────
function onPartyKill(message: { name: string; xp: number; killer: string; mapId: string; kind?: string; fieldBossId?: string }) {
  const world = init!.world!;
  const me = init!.localPresence();
  const isKiller = message.killer === me.nickname;
  if (me.inGame && me.mapId === message.mapId) {
    world.gainExperience(message.xp);
    debugXpGained += message.xp;
    // 필드보스 토벌 기록도 같은 맵에서 함께 싸운 경우에만 공유 — 다른 맵 게스트의 보스 콘텐츠를 지우지 않는다
    if (message.fieldBossId) world.recordFieldBossDefeat(message.fieldBossId);
  }
  if (isKiller && message.kind) {
    const loot = predatorLootForKind(message.kind as PredatorKind);
    const granted = world.rollLoot(loot.item, loot.count);
    world.showMessage(granted > 0 ? `${message.name}을 쓰러뜨리고 ${ITEM_NAMES[loot.item] ?? loot.item} ${granted}개를 얻었습니다. (+${message.xp} XP)` : `${message.name}을 쓰러뜨렸지만 재료는 나오지 않았습니다. (+${message.xp} XP)`);
  } else if (!isKiller) {
    world.showMessage(`${message.killer} 님이 ${message.name}을(를) 쓰러뜨렸습니다! (+${message.xp} XP)`);
  }
  debugLastKill = { name: message.name, killer: message.killer, xp: message.xp };
}

function onMobHit(nickname: string, amount: number, sourceName: string, mapId: string) {
  const me = init!.localPresence();
  if (nickname !== me.nickname || !me.inGame || mapId !== me.mapId) return;
  // 숨긴 탭(rAF 정지 — 싱글플레이라면 월드가 멈췄을 상황)의 피격은 버린다
  if (typeof document !== "undefined" && document.hidden) return;
  const now = performance.now();
  if (now < mobHitGraceUntil) return; // 사망 직후 적체분 일괄 적용(연쇄 사망) 방지
  if (init!.world!.damageLocalPlayer(amount, sourceName)) mobHitGraceUntil = now + 3_000;
}

// ── DEV 디버그 (E2E 검증용) ────────────────────────────────────────────────
function publishDebug(session: PartySession | null) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__partyWorld = {
    role: session?.role ?? "none",
    guestActive: partyWorldGuestActive(),
    syncedHostIds: [...syncedByHostId.keys()],
    sentIds: debugLastSentIds,
    xpGained: debugXpGained,
    lastKill: debugLastKill,
    attackRequests: debugAttackRequests,
    clearedStash: [...clearedMobsByMap.entries()].map(([mapId, list]) => `${mapId}:${list.length}`),
    // E2E: 게스트가 가장 가까운 동기화 몬스터를 공격 (전체 G→H→브로드캐스트 루프 검증)
    attackNearest: (power = 60) => {
      const me = init?.localPresence();
      let best: WorldObject | null = null;
      let bestDistance = Infinity;
      for (const object of syncedByHostId.values()) {
        const d = Math.hypot(object.root.position.x - (me?.x ?? 0), object.root.position.z - (me?.z ?? 0));
        if (d < bestDistance) {
          bestDistance = d;
          best = object;
        }
      }
      return best ? partyGuestAttackIntercept(best, power, "ranged") : false;
    },
  };
}
