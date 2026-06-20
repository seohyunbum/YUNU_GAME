import * as THREE from "three";
import { rollChestLoot } from "./chestLoot";
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

// 6차 — 동기화 대상 마을 경비 4종 (야생 몬스터와 함께 호스트 권위로 공유)
export function isGuardType(type: string | undefined): boolean {
  return type === "villageKnight" || type === "villageArcher" || type === "villageMage" || type === "villageGolem";
}

// 7차 — 정적 공유 오브젝트 (동굴 입구·보물 상자). 이동·hp 없음 → 보간/판정 제외.
export function isStaticShareType(type: string | undefined): boolean {
  return type === "cave" || type === "chest" || type === "mineChest";
}

// 8차 — 파티 공유 드롭 아이템·설치물(제련대·침대·제작대·분쇄기). 위치 고정·hp 없음 → 정적 취급, 줍기/회수는 pickupRequest.
const SHARED_STATION_TYPES = new Set(["smelter", "specialSmelter", "workbench", "extendedWorkbench", "grinder", "bed"]);
export function isSharedGroundType(type: string | undefined): boolean {
  return type === "droppedItem" || (type !== undefined && SHARED_STATION_TYPES.has(type));
}
// 설치물 타입 → 회수 시 받는 아이템 id (pickupSharedObject 와 일치). 줍기 전 공간 확인용.
const STATION_PICKUP_ITEM: Record<string, string> = { smelter: "smelter", specialSmelter: "special_smelter", workbench: "crafting_table", extendedWorkbench: "extended_workbench", grinder: "grinder", bed: "bed" };

// main 이 제공하는 월드 능력 — 게스트 렌더/판정 반영과 호스트 판정에 필요한 최소 집합
export interface PartyWorldContext {
  entityContext: EntitySpawnContext;
  activeRegions(): readonly Region[];
  mapXpScale(): number;
  hostGameHour?(): number; // 호스트 시계(시 0~24) — mobs 스냅샷에 piggyback 해 게스트 밤/낮 동기(없으면 시간 미동기)
  setSyncedHour?(hour: number): void; // 게스트: 호스트 시각 수신 적용
  predators(): Iterable<WorldObject>;
  guards(): Iterable<WorldObject>; // 6차 — 마을 경비 4종
  spawnGuard(type: string, x: number, z: number, villageId: string): WorldObject; // 게스트 측 경비 렌더 생성
  enrageVillage(villageId: string, message: string): void; // 게스트 공격이 마을 전체를 각성
  // 7차 — 정적 오브젝트 공유 (동굴 입구·보물 상자)
  chests(): Iterable<WorldObject>;
  caves(): Iterable<WorldObject>;
  spawnChest(x: number, z: number, mineRich: boolean, opened: boolean, chestTier?: number): WorldObject;
  spawnCave(x: number, z: number): WorldObject;
  markChestOpened(id: string): number | null; // 호스트: 상자 개봉 표시(틴트·만료) — 유효하면 등급(0~3), 무효면 null
  grantChestLoot(items: { item: string; count: number }[]): void; // 게스트: 개봉 전리품 수령
  // 8차 — 파티 공유 드롭·설치물
  sharedGroundObjects(): Iterable<WorldObject>; // 호스트: 동기화할 드롭아이템 + 설치물(제련대·침대 등)
  spawnDroppedItemView(item: string, count: number, x: number, z: number): WorldObject; // 게스트: 동기화 드롭 렌더
  spawnStationView(objType: string, x: number, z: number, bedTier?: string): WorldObject; // 게스트: 동기화 설치물 렌더
  pickupSharedObject(id: string): { item: string; count: number }[] | null; // 호스트: 제거 + 들어있던 아이템 반환(무효면 null)
  hostSpawnDroppedGround(item: string, count: number, x: number, z: number): void; // 호스트: 게스트 dropRequest 로 드롭 생성
  canAddItem(item: ItemId, count: number): boolean; // 줍기 전 인벤토리 공간 확인(비파괴) — 없으면 요청 안 보냄(호스트가 객체 유지 → 유실 방지)
  receivePickupItems(items: { item: string; count: number }[]): { item: string; count: number }[]; // 받아 넣고, 못 넣은 것 반환(호스트 월드에 되돌려 떨어뜨리기용)
  getObject(id: string): WorldObject | undefined;
  removeObject(id: string): void; // 리스폰 큐 정상 등록 (호스트 처치)
  removeObjectSilent(id: string): void; // 리스폰 큐 미등록 (동기화 몬스터·합류 정리)
  hitFeedback(target: WorldObject, damage: number, killed: boolean): void;
  showMessage(text: string): void;
  gainExperience(amount: number): void;
  creditHostKill(target: WorldObject, creditQuest: boolean): void; // 호스트 처치 크레딧 (펫/플레이어 XP + 필드보스 기록). creditQuest=호스트가 직접 막타 → 사냥 카운터 증가
  creditQuestKill(): void; // 게스트: 내가 막타친 야생 처치 → 내 사냥 퀘스트 카운터(+1)
  rollLoot(item: ItemId, count: number, source: "guard" | "predator"): number; // 처치자 전리품 — 확률 롤 포함(보상 소스별 튜닝), 획득 수량 반환
  recordFieldBossDefeat(id: string): void;
  damageLocalPlayer(amount: number, sourceName: string): boolean; // true = 사망
  healLocalPlayer?(amount: number): void; // 5.1 — 파티 힐 수신 적용
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
  type?: string; // 6차 — 마을 경비면 type/villageId 로 복원
  villageId?: string;
  homeX?: number; // 경비 정위치 (추격 중 합류 시 복원 위치가 어긋나지 않게)
  homeZ?: number;
  objType?: string; // 7차 — 정적 오브젝트(cave/chest) 복원용
  opened?: boolean; // 상자 개봉 상태 복원 (탈퇴 후 재개봉=이중 전리품 방지)
  chestTier?: number; // 상자 등급
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
const openRequestCooldown = new Map<string, number>(); // 게스트: 호스트상자 id → 재요청 억제 만료시각 (호스트 무응답 시 스팸·유령사운드 방지)
const mobTargets = new Map<string, MobTargetState>(); // 보간 목표 (호스트 id 키)
const pendingHitsByHostId = new Map<string, number[]>(); // 낙관적 타격 시각 — 스냅샷 역행 방지
const clearedMobsByMap = new Map<string, ClearedMobDescriptor[]>();
const sweepScratch: string[] = []; // applyMobsSnapshot 비동기화 제거용 재사용 버퍼 (할당 0)
let debugXpGained = 0;
let debugLastKill: { name: string; killer: string; xp: number } | null = null;
let debugLastSentIds: string[] = [];
let debugAttackRequests = 0;
let debugChestLootGot = 0;

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
  // combat.ts 본 경로와 동일 공식 — 경비는 방어 완전차단(0뎀) 허용, 야생/보스는 최소 1 보장
  const guard = isGuardType(target.type);
  const raw = target.armor ? calculateCombatDamage(power, target.armor) : Math.floor(power);
  const damage = guard ? Math.max(0, raw) : Math.max(1, raw);
  target.hp = (target.hp ?? 10) - damage; // damage 0(완전차단)이면 불변
  if (!guard) target.angryUntil = performance.now() + PREDATOR_RETALIATE_MS; // 동기화 경비 각성은 호스트 권위 (게스트 측 설정은 staleness 1프레임 오작동 유발)
  world.hitFeedback(target, damage, target.hp <= 0);
  if (kind !== "dot" && kind !== "pet") world.showMessage(damage > 0 ? `${target.name}에게 ${damage} 피해. 남은 체력 ${Math.max(0, Math.ceil(target.hp))}.` : `${target.name}의 방어력이 공격을 막았습니다.`);
  if (damage > 0) {
    const pending = pendingHitsByHostId.get(hostId) ?? [];
    pending.push(performance.now());
    pendingHitsByHostId.set(hostId, pending);
  }
  session.sendGame({ type: "attackRequest", targetId: hostId, power: Math.round(power), kind }); // 막힌 타격도 호스트 enrage 를 위해 전송
  return true;
}

// 게스트 상자 개봉 가로채기 (7차) — 동기화 상자면 호스트에 개봉 요청. true 반환 시 로컬 개봉 생략(전리품은 chestLoot 로).
export function partyGuestOpenIntercept(target: WorldObject): boolean {
  const session = init?.session() ?? null;
  if (!init?.world || !session || session.role !== "guest") return false;
  const hostId = hostIdByLocalId.get(target.id);
  if (!hostId) return false; // 동기화 상자가 아니면 로컬 개봉 유지
  const now = performance.now();
  const until = openRequestCooldown.get(hostId);
  if (until !== undefined && now < until) return true; // 쿨다운 중 — 재전송·재사운드 억제(로컬 개봉은 계속 차단)
  openRequestCooldown.set(hostId, now + 1500);
  session.sendGame({ type: "openRequest", objectId: hostId });
  return true;
}

// 8차 — 게스트가 동기화된 드롭/설치물을 줍기·회수 → 호스트에 요청. true 반환 시 로컬 처리 생략(아이템은 pickupGrant 로 받음).
export function partyGuestPickupIntercept(target: WorldObject): boolean {
  const session = init?.session() ?? null;
  if (!init?.world || !session || session.role !== "guest") return false;
  const hostId = hostIdByLocalId.get(target.id);
  if (!hostId) return false; // 동기화 객체가 아니면 로컬 처리 유지(내 로컬 드롭/설치물)
  if (target.lockedStation) return false; // 잠긴 설치물(대장간 등)은 회수 불가 → 가로채지 않고 로컬 USE 경로(openStation)로. pickupRequest 미전송.
  // ★유실 방지 — 인벤토리에 못 받으면 요청을 보내지 않는다(호스트가 객체를 제거하지 않음). false 반환 → 로컬 경로가 '공간 부족' 안내 후 객체 유지(솔로와 동일 동작).
  const wantItem = (target.droppedItem ?? STATION_PICKUP_ITEM[target.type]) as ItemId | undefined;
  if (wantItem && !init.world.canAddItem(wantItem, target.droppedItem ? (target.droppedCount ?? 1) : 1)) return false;
  const now = performance.now();
  const until = openRequestCooldown.get(hostId);
  if (until !== undefined && now < until) return true; // 쿨다운 중 — 재전송 억제(로컬 처리는 계속 차단)
  openRequestCooldown.set(hostId, now + 1500);
  session.sendGame({ type: "pickupRequest", objectId: hostId });
  return true;
}

// 8차 — 게스트가 아이템을 떨어뜨리면 호스트 월드에 생성 요청(전원 동기화 → 누구나 줍기). true 시 로컬 드롭 생략.
export function partyGuestDropIntercept(item: string, count: number, x: number, z: number): boolean {
  const session = init?.session() ?? null;
  if (!init?.world || !session || session.role !== "guest" || !partyWorldGuestActive()) return false;
  session.sendGame({ type: "dropRequest", item, count, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
  return true;
}

// 호스트 처치 알림 — combat.ts·summonerPet 의 처치 지점들이 호출한다 (호스트 역할일 때만 브로드캐스트).
// 동기화 범위(wildPredator)와 XP 공유 범위를 일치시킨다 — 용·잼미니는 각자 로컬이므로 공유하면 이중 취득이 된다.
export function partyHostNotifyKill(target: WorldObject) {
  if (target.type !== "wildPredator" && !isGuardType(target.type)) return; // 야생 몬스터 + 마을 경비만 (용/잼미니는 추후)
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
  if (isStaticShareType(descriptor.objType)) {
    // 파티 탈퇴 후 자기 동굴·상자 복원 (정상 로컬 오브젝트로). 열었던 상자는 열린 채로 복원.
    world.refreshSpatialObject(descriptor.objType === "cave" ? world.spawnCave(descriptor.x, descriptor.z) : world.spawnChest(descriptor.x, descriptor.z, descriptor.objType === "mineChest", descriptor.opened === true, descriptor.chestTier ?? 0));
    return;
  }
  if (isGuardType(descriptor.type)) {
    // 파티 탈퇴 후 자기 마을 경비 복원 — 추격하던 위치가 아니라 정위치(homePosition)로
    world.refreshSpatialObject(world.spawnGuard(descriptor.type!, descriptor.homeX ?? descriptor.x, descriptor.homeZ ?? descriptor.z, descriptor.villageId ?? "home-village"));
    return;
  }
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
  // 6차 — 마을 경비도 같은 스냅샷에 (정적 스탯이라 type/villageId/위치/hp 만, 공격모션은 미전송)
  for (const guard of world.guards()) {
    list.push({
      id: guard.id,
      name: guard.name ?? "경비",
      type: guard.type,
      villageId: guard.villageId,
      guardMode: guard.guardMode,
      x: Math.round(guard.root.position.x * 10) / 10,
      z: Math.round(guard.root.position.z * 10) / 10,
      yaw: Math.round(guard.root.rotation.y * 100) / 100,
      hp: Math.ceil(guard.hp ?? 1),
      armor: guard.armor || undefined,
    });
  }
  // 7차 — 정적 오브젝트(동굴 입구·보물 상자). 위치 고정·hp 무의미(더미 1), 개봉 상태만 추적.
  for (const chest of world.chests()) {
    list.push({ id: chest.id, name: chest.name ?? "상자", objType: chest.type, opened: chest.opened === true, chestTier: chest.chestTier ?? 0, x: Math.round(chest.root.position.x * 10) / 10, z: Math.round(chest.root.position.z * 10) / 10, yaw: Math.round(chest.root.rotation.y * 100) / 100, hp: 1 });
  }
  for (const cave of world.caves()) {
    list.push({ id: cave.id, name: cave.name ?? "동굴 입구", objType: "cave", x: Math.round(cave.root.position.x * 10) / 10, z: Math.round(cave.root.position.z * 10) / 10, yaw: Math.round(cave.root.rotation.y * 100) / 100, hp: 1 });
  }
  // 8차 — 파티 공유 드롭 아이템 + 설치물(제련대·침대·제작대·분쇄기). 위치 고정.
  for (const obj of world.sharedGroundObjects?.() ?? []) {
    list.push({ id: obj.id, name: obj.name ?? "아이템", objType: obj.type, item: obj.droppedItem, count: obj.droppedCount, bedTier: obj.bedTier as string | undefined, x: Math.round(obj.root.position.x * 10) / 10, z: Math.round(obj.root.position.z * 10) / 10, yaw: Math.round(obj.root.rotation.y * 100) / 100, hp: 1 });
  }
  debugLastSentIds = list.map((entry) => entry.id);
  return { type: "mobs", mapId: init!.localPresence().mapId, list, hour: init!.world!.hostGameHour?.() };
}

function handleGameMessage(message: PartyMessage, from?: string) {
  if (!init?.world) return;
  if (message.type === "attackRequest" && hookedSession?.role === "host") {
    // 호스트가 실내/타이틀이면 판정 보류 — 스냅샷(정정 채널)이 멈춘 동안의 처치는 리스폰 큐를 우회하게 된다
    if (!init.localPresence().inGame) return;
    debugAttackRequests += 1;
    hostApplyGuestAttack(message.targetId, message.power, from ?? "파티원");
  } else if (message.type === "openRequest" && hookedSession?.role === "host") {
    // 호스트 권위 상자 개봉 — 1회 롤해 요청 게스트에게만 전달, 개봉 상태는 스냅샷으로 전파
    if (!init.localPresence().inGame) return;
    const openedTier = init.world.markChestOpened(message.objectId);
    if (openedTier !== null) hookedSession.sendGame({ type: "chestLoot", opener: from ?? "파티원", items: rollChestLoot(openedTier) });
  } else if (message.type === "chestLoot") {
    if (message.opener === init.localPresence().nickname) {
      init.world.grantChestLoot(message.items);
      debugChestLootGot += 1;
    }
  } else if (message.type === "pickupRequest" && hookedSession?.role === "host") {
    // 8차 — 게스트가 호스트의 드롭/설치물을 줍기 요청. 호스트가 제거 + 들어있던 아이템을 요청자에게만 지급(제거는 스냅샷으로 전파).
    if (!init.localPresence().inGame) return;
    const items = init.world.pickupSharedObject(message.objectId);
    if (items && items.length > 0) hookedSession.sendGame({ type: "pickupGrant", nickname: from ?? "파티원", items });
  } else if (message.type === "pickupGrant") {
    if (message.nickname === init.localPresence().nickname) {
      const leftover = init.world.receivePickupItems(message.items); // 넣을 수 있는 만큼 인벤토리에 넣고
      if (leftover.length > 0 && hookedSession) { const me = init.localPresence(); for (const it of leftover) hookedSession.sendGame({ type: "dropRequest", item: it.item, count: it.count, x: me.x, z: me.z }); } // 못 넣은 건 호스트 월드에 되돌려 떨어뜨림(어떤 경우에도 유실 0)
    }
  } else if (message.type === "dropRequest" && hookedSession?.role === "host") {
    // 8차 — 게스트가 떨어뜨린 아이템을 호스트 월드에 생성(스냅샷으로 전원에 보임 → 누구나 줍기).
    if (!init.localPresence().inGame) return;
    init.world.hostSpawnDroppedGround(message.item, message.count, message.x, message.z);
  } else if (message.type === "mobs") { if (message.hour != null) init!.world!.setSyncedHour?.(message.hour); applyMobsSnapshot(message.mapId, message.list); }
  else if (message.type === "partyKill") onPartyKill(message);
  else if (message.type === "mobHit") onMobHit(message.nickname, message.amount, message.name, message.mapId);
}

// ── 호스트: 게스트 공격 판정 ───────────────────────────────────────────────
function hostApplyGuestAttack(targetId: string, power: number, killer: string) {
  const world = init!.world!;
  const target = world.getObject(targetId);
  const guard = isGuardType(target?.type);
  if (!target || (target.type !== "wildPredator" && !guard)) return; // 이미 죽었거나 무효 — 무시 (스냅샷이 정정)
  const nowMs = performance.now();
  // combat.ts 본 경로와 동일 공식 — 경비는 방어 완전차단(0뎀) 허용, 야생/보스는 최소 1
  const raw = target.armor ? calculateCombatDamage(power, target.armor) : Math.floor(power);
  const damage = guard ? Math.max(0, raw) : Math.max(1, raw);
  target.hp = (target.hp ?? 10) - damage; // damage 0(완전차단)이면 불변
  // 경비: 마을 전체 각성(반격은 호스트 guardAi 가 다음 틱에). 단 이미 각성 중이면 추격만 연장 — 매 타격 enrageVillage 는
  // 메시지 폭주 + 전 경비 attackCooldown 0.5 리셋(공격 굶김)을 부른다. 야생은 보복 타이머.
  if (guard && target.villageId) {
    if (!target.angryUntil || target.angryUntil < nowMs) world.enrageVillage(target.villageId, `${killer} 님이 ${target.name}을(를) 공격하자`);
    else target.angryUntil = nowMs + 12_000;
  } else if (!guard) target.angryUntil = nowMs + PREDATOR_RETALIATE_MS;
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
    lootItem: guard ? "iron" : undefined, // 경비 처치자(게스트)에게 철 지급
    lootCount: guard ? 1 : undefined,
  };
  world.creditHostKill(target, killer === init!.localPresence().nickname); // 펫/플레이어 XP + 필드보스 기록. 사냥 카운터는 호스트가 직접 막타쳤을 때만(게스트 막타는 게스트가 자기 카운터 증가)
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
  // 비동기화 로컬 야생 몬스터 제거 — 매 동기화 스냅샷마다 수행한다.
  // (합류 직후의 seedOverworld 잔여나 게이트 엇갈림으로 끼어든 로컬 몬스터가 호스트 것과 겹쳐
  //  "친구는 잡았는데 나는 살아있는" 분리 현상의 원인 — 단발 가드로는 첫 정리 이후 끼어든 것을 못 치움.)
  const firstClear = clearedForMapId !== me.mapId;
  if (firstClear) clearedForMapId = me.mapId;
  // 비동기화 로컬 야생 몬스터 제거 — 매 동기화 스냅샷마다(끼어든 seedOverworld 잔여·리스폰을 항상 정리해 분리 현상 차단).
  // 제너레이터를 직접 순회하고 제거는 루프 뒤로 미뤄(순회 중 변형 회피), 정상 동기화 시 할당 0(스크래치 재사용).
  // 첫 정리 때만 복원 정보를 자체 보관한다 (리스폰 큐는 clearWorld 에 와이프되므로 쓰지 않는다). 필드 보스는 ensure 가 다시 세우므로 제외.
  const stored = firstClear ? clearedMobsByMap.get(me.mapId) ?? [] : null;
  sweepScratch.length = 0;
  for (const predator of world.predators()) {
    if (hostIdByLocalId.has(predator.id)) continue; // 이미 동기화된 몬스터
    if (stored && !predator.fieldBossId) stored.push({ kind: predator.predatorKind, monsterId: predator.monsterId, regionId: predator.regionId, x: predator.root.position.x, z: predator.root.position.z });
    sweepScratch.push(predator.id);
  }
  // 6차 — 비동기화 로컬 경비도 제거(겹침 방지). 탈퇴 후 자기 마을 복원을 위해 type/villageId/정위치 보관.
  for (const guard of world.guards()) {
    if (hostIdByLocalId.has(guard.id)) continue;
    if (stored) stored.push({ type: guard.type, villageId: guard.villageId, x: guard.root.position.x, z: guard.root.position.z, homeX: guard.homePosition?.x, homeZ: guard.homePosition?.z });
    sweepScratch.push(guard.id);
  }
  // 7차 — 비동기화 로컬 동굴·상자도 제거(겹침 방지). 제너레이터 직접 순회로 할당 0(predator/guard 루프와 동일).
  // 탈퇴 후 복원을 위해 objType/위치 보관 — 상자는 opened 도 보관해 재개봉(이중 전리품)을 막는다.
  for (const stat of world.chests()) {
    if (hostIdByLocalId.has(stat.id)) continue;
    if (stored) stored.push({ objType: stat.type, opened: stat.opened === true, chestTier: stat.chestTier ?? 0, x: stat.root.position.x, z: stat.root.position.z });
    sweepScratch.push(stat.id);
  }
  for (const stat of world.caves()) {
    if (hostIdByLocalId.has(stat.id)) continue;
    if (stored) stored.push({ objType: stat.type, x: stat.root.position.x, z: stat.root.position.z });
    sweepScratch.push(stat.id);
  }
  for (const id of sweepScratch) world.removeObjectSilent(id);
  sweepScratch.length = 0;
  if (stored) {
    if (stored.length > 256) stored.length = 256; // 복원 보관 상한 (야생~48 + 경비~17 + 정적 누적분 여유)
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
    if (isStaticShareType(snap.objType) || isSharedGroundType(snap.objType)) {
      // 정적 오브젝트 — 위치 고정. 상자는 개봉 상태 변화만 반영(틴트). 드롭/설치물은 존재만(제거는 스냅샷 누락으로 처리).
      if (snap.objType !== "cave" && snap.opened && !existing.opened) world.markChestOpened(existing.id);
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
  let object: WorldObject;
  if (isStaticShareType(snap.objType)) {
    // 7차 정적 오브젝트 — 동굴 입구·보물 상자. 호스트 위치 그대로 렌더.
    object = snap.objType === "cave" ? world.spawnCave(snap.x, snap.z) : world.spawnChest(snap.x, snap.z, snap.objType === "mineChest", snap.opened === true, snap.chestTier ?? 0);
    object.partyTransient = true;
    object.collidable = false; // 위치 비결정 — 게스트 지형의 물·건물과 겹칠 수 있어 이동 충돌은 끔. 입구는 시각 참조·상호작용(개봉/진입)만.
    object.root.rotation.y = snap.yaw;
    object.root.position.y = init!.getGroundHeightAt(snap.x, snap.z);
    world.refreshSpatialObject(object);
    syncedByHostId.set(snap.id, object);
    hostIdByLocalId.set(object.id, snap.id);
    return;
  }
  if (isSharedGroundType(snap.objType)) {
    // 8차 — 파티 공유 드롭/설치물. 호스트 위치 그대로 렌더(상호작용은 줍기/회수=pickupRequest, 사용은 로컬).
    object = snap.objType === "droppedItem" ? world.spawnDroppedItemView(snap.item ?? "stone", snap.count ?? 1, snap.x, snap.z) : world.spawnStationView(snap.objType!, snap.x, snap.z, snap.bedTier);
    object.partyTransient = true;
    object.collidable = false; // 위치 비결정 — 이동 충돌은 끔. 줍기/사용 등 상호작용만.
    object.root.rotation.y = snap.yaw;
    object.root.position.y = init!.getGroundHeightAt(snap.x, snap.z);
    world.refreshSpatialObject(object);
    syncedByHostId.set(snap.id, object);
    hostIdByLocalId.set(object.id, snap.id);
    return;
  }
  if (isGuardType(snap.type)) {
    // 마을 경비 — main 의 spawnKnight/Golem/RangedGuard 위임(정적 스탯·비주얼). spawnGuard 가 내부에서 접지.
    object = world.spawnGuard(snap.type!, snap.x, snap.z, snap.villageId ?? "party-guard");
  } else {
    object = spawnPredator(world.entityContext, new THREE.Vector3(snap.x, 0, snap.z), snap.kind as PredatorKind | undefined);
    const regions = world.activeRegions();
    const region = getRegionById(snap.regionId, regions) ?? regionAtPosition(object.root.position, regions) ?? regions[0];
    if (snap.monsterId && region) applyPredatorMonsterDefinition(object, region, snap.monsterId as MonsterId);
    if (snap.fieldBossId) {
      const def = fieldBossById(snap.fieldBossId);
      if (def) applyFieldBossDefinition(object, def);
    }
  }
  object.partyTransient = true; // 세이브/worldState 에 영속되지 않는다 (호스트 월드의 뷰일 뿐)
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
  openRequestCooldown.delete(hostId);
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
function onPartyKill(message: { name: string; xp: number; killer: string; mapId: string; kind?: string; fieldBossId?: string; lootItem?: string; lootCount?: number }) {
  const world = init!.world!;
  const me = init!.localPresence();
  const isKiller = message.killer === me.nickname;
  if (me.inGame && me.mapId === message.mapId) {
    world.gainExperience(message.xp);
    debugXpGained += message.xp;
    // 필드보스 토벌 기록도 같은 맵에서 함께 싸운 경우에만 공유 — 다른 맵 게스트의 보스 콘텐츠를 지우지 않는다
    if (message.fieldBossId) world.recordFieldBossDefeat(message.fieldBossId);
  }
  // 내가 막타친 야생동물이면 사냥 퀘스트 카운터(+1). 경비(kind 없음·lootItem='iron')는 사냥 카운터 대상 아님.
  if (isKiller && message.kind) world.creditQuestKill();
  // 처치자 전리품 — 경비는 lootItem("iron"), 야생은 kind→predatorLootForKind
  let lootItem: ItemId | undefined;
  let lootCount = message.lootCount ?? 1;
  if (message.lootItem) lootItem = message.lootItem as ItemId;
  else if (message.kind) {
    const loot = predatorLootForKind(message.kind as PredatorKind);
    lootItem = loot.item;
    lootCount = loot.count;
  }
  if (isKiller && lootItem) {
    const granted = world.rollLoot(lootItem, lootCount, message.lootItem ? "guard" : "predator"); // 경비 철은 guard 소스, 야생은 predator 소스 (운영 튜닝 일치)
    world.showMessage(granted > 0 ? `${message.name}을 쓰러뜨리고 ${ITEM_NAMES[lootItem] ?? lootItem} ${granted}개를 얻었습니다. (+${message.xp} XP)` : `${message.name}을 쓰러뜨렸지만 재료는 나오지 않았습니다. (+${message.xp} XP)`);
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
    // E2E: 호스트가 자기 옆에 테스트 경비를 스폰하고 마을을 각성 (마을 경비 동기화 검증용)
    spawnTestGuard: () => {
      if (!init?.world || hookedSession?.role !== "host") return false;
      const me = init.localPresence();
      const guard = init.world.spawnGuard("villageGolem", me.x + 4, me.z + 1, "test-village");
      init.world.enrageVillage("test-village", "테스트");
      return guard.id;
    },
    // E2E: 호스트가 자기 옆에 테스트 보물 상자를 스폰 (동굴·상자 공유 검증용)
    spawnTestChest: () => {
      if (!init?.world || hookedSession?.role !== "host") return false;
      const me = init.localPresence();
      return init.world.spawnChest(me.x + 3, me.z + 1, false, false).id;
    },
    chestLootGot: debugChestLootGot,
    // E2E: 게스트가 특정 호스트 id 의 동기화 상자를 개봉 요청 (호스트 위임 루프 검증)
    openSyncedChest: (hostId: string) => {
      const object = syncedByHostId.get(hostId);
      return object && (object.type === "chest" || object.type === "mineChest") ? partyGuestOpenIntercept(object) : false;
    },
  };
}
