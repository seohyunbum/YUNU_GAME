import * as THREE from "three";
import { createAvatarModel, CLASS_APPEARANCE } from "../avatar";
import { createEagleVisual } from "./creatureVisuals";
import { createArrowProjectile, createMagicProjectile, createFireballProjectile, createTntProjectile, createWindCutterProjectile, OBSIDIAN_PROJECTILE } from "./combatEffects";
import type { PartyMessage, PartySession, PresenceData } from "./party";
import { partyFlowOnPresences } from "./partyFlow";
import { initPartyWorldSync, partyWorldSyncOnPresences, partyWorldSyncTick, type PartyWorldContext } from "./partyWorldSync";
import type { PlayerClassId } from "./types";

// main 의 import 한 줄을 넓히는 것만으로 5차 API 를 쓸 수 있도록 재수출 (라쳇 0줄 전략)
export { isGuardType, partyGuestAttackIntercept, partyGuestOpenIntercept, partyGuestPickupIntercept, partyGuestDropIntercept, partyGuestPlaceIntercept, partyGuestStorageActive, requestSharedStorage, sendStorageTake, sendStorageStore, sendSupplyClaim, partyHostNotifyKill, partyWorldGuestActive } from "./partyWorldSync";

// 파티 3차 — 프레즌스 동기화. 같은 맵의 파티원을 월드에 아바타+닉네임 표찰로 그리고, 지역 지도에 마커를 제공.
// 5.1 — 닉네임 표찰 축소 + 친구 HP바, 보간 개선(순간이동 방지), 원격 공격 모션·투사체, 플레이어 충돌, 파티 힐.
// updatePartyPresence 는 핫패스 — THREE 할당 금지(스폰/제거 시점 제외).

export const PRESENCE_SEND_INTERVAL_MS = 125; // 8Hz
const PRESENCE_STALE_MS = 6_000;
const LERP_PER_SECOND = 12;
// 보간 속도 상한 — 패킷 지연/유실 시 '대시'처럼 튀는 것을 막되, 실제 최고 이동속도(질주 WALK_SPEED*RUN=14)보다
// 높아야 달리는 친구가 뒤처지다 스냅되지 않는다. + 가산 슬랙으로 1~2틱 누락은 부드럽게 흡수.
const REMOTE_MAX_SPEED = 16;
const REMOTE_STEP_SLACK = 0.5;
const REMOTE_SNAP_DISTANCE_SQ = 24 * 24; // 이보다 멀면 진짜 텔레포트로 보고 즉시 이동
const ATTACK_MOTION_MS = 320;
const HP_BAR_WIDTH = 1.3;
const NAMEPLATE_Y = 2.35;
const HP_BAR_Y = NAMEPLATE_Y + 0.34; // 닉네임 위 — 머리/모자 관통 방지

export interface PresenceContext {
  scene: THREE.Scene;
  session(): PartySession | null;
  localPresence(): PresenceData;
  getGroundHeightAt(x: number, z: number): number;
  world?: PartyWorldContext; // 5차 — 호스트 권위 월드 공유 배선 (없으면 프레즌스만 동작)
  onChat?(message: { from: string; text: string; to?: string }): void; // 파티 채팅 수신 → 채팅 UI
}

interface RemoteMember {
  data: PresenceData;
  root: THREE.Group;
  body: THREE.Group | null; // 아바타 본체 (공격 모션용)
  hpFill: THREE.Sprite | null; // 좌측 고정 HP 막대 (scale.x = 비율)
  targetX: number;
  targetZ: number;
  targetYaw: number;
  lastSeenAt: number;
  onLocalMap: boolean;
  actionUntil: number; // 공격 모션 종료 시각
  pet: THREE.Group | null; // 소환사 친구의 패시브 펫(독수리) — hasPet 일 때 로컬에서 따라다니게 렌더
}

interface RemoteProjectile {
  mesh: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mapId: string; // 맵 전환 시 잔존 정리용
}

// GPU 리소스 해제 — 원격 아바타/투사체 제거 시 geometry·material·texture 누수 방지
function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh & THREE.Sprite;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as THREE.Mesh).material;
    for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
      const map = (mat as THREE.SpriteMaterial).map;
      if (map) map.dispose();
      mat.dispose();
    }
  });
}

let context: PresenceContext | null = null;
let hookedSession: PartySession | null = null;
let presenceVisibilityHooked = false; // 모바일 백그라운드/잠금 시 프레즌스 끊김 방지(아래 visibilitychange)
let presenceKeepAlive = 0;
const remotes = new Map<string, RemoteMember>();
const remoteProjectiles: RemoteProjectile[] = [];
let lastSentAt = 0;
let debugProjectilesSeen = 0;
let debugHealReceived = 0;

function makeNameplate(nickname: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "900 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(21, 35, 29, 0.9)";
  ctx.strokeText(nickname, 128, 32);
  ctx.fillStyle = "#a7f3d0";
  ctx.fillText(nickname, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.3, 0.33, 1); // 5.1 — 기존의 절반 크기
  sprite.position.y = NAMEPLATE_Y;
  return sprite;
}

// HP바 — 어두운 배경 + 초록(→빨강) 막대. 캔버스 없이 scale/color 만 갱신해 핫패스 할당 0.
// 두 스프라이트를 회전축(local x=0) 위에 두어, 친구가 방향을 틀거나 내가 그 주위를 돌아도 흔들리지 않는다.
// 막대는 중앙에서 양쪽으로 줄어든다(center depletion) — scale.x 만 줄이면 됨.
function makeHpBar() {
  const group = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x10201a, transparent: true, opacity: 0.78, depthWrite: false }));
  bg.scale.set(HP_BAR_WIDTH, 0.13, 1);
  bg.position.y = HP_BAR_Y;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x49d17f, depthWrite: false }));
  fill.scale.set(HP_BAR_WIDTH * 0.96, 0.1, 1);
  fill.position.set(0, HP_BAR_Y, 0);
  group.add(bg, fill);
  return { group, fill };
}

function updateHpBar(remote: RemoteMember) {
  if (!remote.hpFill) return;
  const max = remote.data.maxHealth ?? 0;
  if (max <= 0) {
    remote.hpFill.visible = false;
    return;
  }
  const ratio = Math.max(0, Math.min(1, (remote.data.health ?? max) / max));
  remote.hpFill.visible = true;
  remote.hpFill.scale.x = HP_BAR_WIDTH * 0.96 * Math.max(0.0001, ratio);
  remote.hpFill.material.color.setHSL(ratio * 0.33, 0.85, 0.5); // 빨강(0) → 초록(0.33)
}

// 소환사 친구의 원격 펫 모델 — 로컬 펫과 같은 독수리(createEagleVisual) + 보라 오라. 위치는 친구 아바타를 로컬에서 따라가므로 추가 동기화 비용 0.
function createRemotePet(): THREE.Group {
  const pet = createEagleVisual();
  pet.scale.setScalar(0.74);
  pet.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 10), new THREE.MeshBasicMaterial({ color: 0x9b6bff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })));
  return pet;
}

function spawnRemote(data: PresenceData, nowMs: number): RemoteMember {
  const classId = (data.playerClass in CLASS_APPEARANCE ? data.playerClass : "warrior") as PlayerClassId;
  const root = new THREE.Group();
  const body = createAvatarModel(undefined, classId, data.armorTier); // 친구 갑옷 티어 반영 (스폰 시점)
  root.add(body);
  let hpFill: THREE.Sprite | null = null;
  if (typeof document !== "undefined") {
    root.add(makeNameplate(data.nickname)); // 노드 테스트 환경 가드
    const bar = makeHpBar();
    root.add(bar.group);
    hpFill = bar.fill;
  }
  root.position.set(data.x, context!.getGroundHeightAt(data.x, data.z), data.z);
  root.rotation.y = data.yaw + Math.PI; // 아바타 모델은 +Z(앞면)로 만들어졌고 플레이어 forward 규약은 -Z → 180° 보정(목 역전 방지)
  context!.scene.add(root);
  const remote: RemoteMember = { data, root, body, hpFill, targetX: data.x, targetZ: data.z, targetYaw: data.yaw, lastSeenAt: nowMs, onLocalMap: true, actionUntil: 0, pet: null };
  updateHpBar(remote);
  return remote;
}

function removeRemote(nickname: string) {
  const remote = remotes.get(nickname);
  if (!remote) return;
  context?.scene.remove(remote.root);
  disposeObject(remote.root); // 아바타·닉네임 표찰(CanvasTexture)·HP바 GPU 리소스 해제
  if (remote.pet) { context?.scene.remove(remote.pet); disposeObject(remote.pet); } // 원격 펫도 정리
  remotes.delete(nickname);
}

export function initPartyPresence(presenceContext: PresenceContext) {
  context = presenceContext;
  initPartyWorldSync({ session: () => presenceContext.session(), localPresence: () => presenceContext.localPresence(), getGroundHeightAt: (x, z) => presenceContext.getGroundHeightAt(x, z), world: presenceContext.world ?? null });
  if (!presenceVisibilityHooked && typeof document !== "undefined") {
    presenceVisibilityHooked = true;
    // 모바일은 백그라운드/화면잠금 시 rAF(updatePartyPresence 송신)가 멈춰 6초 후 파티에서 사라짐.
    document.addEventListener("visibilitychange", () => {
      const send = () => { if (hookedSession && context) hookedSession.sendPresence(context.localPresence()); };
      if (document.hidden) { if (!presenceKeepAlive) presenceKeepAlive = window.setInterval(send, 3000); } // best-effort keepalive
      else { if (presenceKeepAlive) { clearInterval(presenceKeepAlive); presenceKeepAlive = 0; } send(); } // 복귀 즉시 송신 → 파티에서 즉시 복귀
    });
  }
}

export function resetPartyPresence() {
  for (const nickname of [...remotes.keys()]) removeRemote(nickname);
  for (const projectile of remoteProjectiles.splice(0)) {
    context?.scene.remove(projectile.mesh);
    disposeObject(projectile.mesh);
  }
}

function receivePresences(list: PresenceData[], nowMs: number) {
  if (!context) return;
  if (context.session()?.role === "guest") partyFlowOnPresences(list); // 소환 흐름은 게스트 전용
  partyWorldSyncOnPresences(list); // 호스트: 몬스터 타게팅용 게스트 좌표
  const localMapId = context.localPresence().mapId;
  for (const data of list) {
    if (!data.inGame || data.mapId !== localMapId) {
      // 다른 맵/타이틀 — 아바타는 숨기되 지도용 데이터는 유지
      const existing = remotes.get(data.nickname);
      if (existing) {
        existing.data = data;
        existing.lastSeenAt = nowMs;
        if (existing.onLocalMap) {
          context.scene.remove(existing.root);
          existing.onLocalMap = false;
        }
      } else {
        remotes.set(data.nickname, { data, root: new THREE.Group(), body: null, hpFill: null, targetX: data.x, targetZ: data.z, targetYaw: data.yaw, lastSeenAt: nowMs, onLocalMap: false, actionUntil: 0, pet: null });
      }
      continue;
    }
    const existing = remotes.get(data.nickname);
    if (!existing) {
      remotes.set(data.nickname, spawnRemote(data, nowMs));
      continue;
    }
    if (!existing.onLocalMap) {
      // 같은 맵으로 넘어옴 — 아바타 재부착 (위치는 즉시 — 다른 맵에서 온 것이라 보간 의미 없음)
      removeRemote(data.nickname);
      remotes.set(data.nickname, spawnRemote(data, nowMs));
      continue;
    }
    existing.data = data;
    existing.targetX = data.x;
    existing.targetZ = data.z;
    existing.targetYaw = data.yaw;
    existing.lastSeenAt = nowMs;
    updateHpBar(existing);
  }
}

// 게임 채널 수신 (5.1) — 원격 공격 모션·투사체, 파티 힐
function receiveGame(message: PartyMessage) {
  if (!context) return;
  if (message.type === "chat") {
    context.onChat?.({ from: message.from, text: message.text, to: message.to });
    return;
  }
  if (message.type === "playerAttack") {
    const remote = remotes.get(message.nickname);
    if (!remote || !remote.onLocalMap) return; // 같은 맵에서 보이는 친구의 공격만 — 실내/타맵 공격의 허공 투사체 차단
    remote.actionUntil = performance.now() + ATTACK_MOTION_MS;
    if ((message.kind === "ranged" || message.kind === "skill") && message.visual && message.ox !== undefined) spawnRemoteProjectile(message);
    return;
  }
  if (message.type === "partyHeal") {
    const me = context.localPresence();
    if (message.recipient === me.nickname && me.inGame && message.mapId === me.mapId) {
      context.world?.healLocalPlayer?.(message.amount);
      debugHealReceived += message.amount;
    }
  }
  if (message.type === "partyEmpower") {
    const me = context.localPresence();
    if (message.recipient === me.nickname && me.inGame && message.mapId === me.mapId) context.world?.empowerLocalPlayer?.(message.durationMs);
  }
  if (message.type === "partyRally") {
    const me = context.localPresence();
    if (message.recipient === me.nickname && me.inGame && message.mapId === me.mapId) context.world?.rallyLocalPlayer?.(message.durationMs);
  }
}

function spawnRemoteProjectile(message: Extract<PartyMessage, { type: "playerAttack" }>) {
  if (typeof document === "undefined") return;
  const dir = new THREE.Vector3(message.dx ?? 0, message.dy ?? 0, message.dz ?? -1);
  if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
  dir.normalize();
  const visual = message.visual ?? "arrow";
  const obsidian = message.obsidian === true; // 날카로운 흑요석 궁극 — 붉은 투사체(구버전은 이 필드 무시 → 정상 magic/arrow 렌더)
  const mesh = visual === "tnt" ? createTntProjectile(dir) : visual === "wind" ? createWindCutterProjectile(dir) : visual === "fireball" ? createFireballProjectile(dir) : visual === "magic" ? createMagicProjectile(dir, obsidian ? OBSIDIAN_PROJECTILE : undefined) : createArrowProjectile(dir, obsidian);
  mesh.position.set(message.ox ?? 0, message.oy ?? 1.4, message.oz ?? 0);
  const speed = message.speed ?? (visual === "magic" ? 29 : visual === "tnt" ? 18 : 41); // 권위 샷과 같은 속도·수명 (없으면 visual 기본)
  const life = message.life ?? (visual === "tnt" ? 2.1 : 1.6);
  context!.scene.add(mesh);
  remoteProjectiles.push({ mesh, vx: dir.x * speed, vy: dir.y * speed, vz: dir.z * speed, life, mapId: message.mapId });
  debugProjectilesSeen += 1;
}

// 직업별 원격 공격 모션 — 아바타에 팔 피벗이 없어 본체(body) 회전으로 직업 특성을 표현한다.
// 모두가 "앞으로 숙이던" 단일 모션 대신 근접=옆으로 휘두르기(비틀기), 사격=앞으로 겨눔, 시전=위로 젖힘.
// rotation 은 호출자의 Euler(또는 {x,y,z})를 직접 변형 — 할당 없음(핫패스 안전). p: 0→1 진행도.
export function applyAttackMotion(rotation: { x: number; y: number; z: number }, playerClass: string, p: number) {
  const swing = Math.sin(p * Math.PI); // 0 → 1 → 0 봉우리
  if (playerClass === "warrior" || playerClass === "tanker") {
    rotation.x = -swing * 0.3; // 앞으로 베어내며
    rotation.y = -swing * 0.45; // 몸통 비틀기 = 휘두르기
    rotation.z = swing * 0.2; // 대각선 스윙 느낌
  } else if (playerClass === "gunner") {
    rotation.x = -swing * 0.16; // 살짝 앞으로 겨누고
    rotation.y = 0;
    rotation.z = -swing * 0.1; // 반동
  } else if (playerClass === "healer" || playerClass === "mage" || playerClass === "summoner") {
    rotation.x = swing * 0.28; // 위로 젖혀 시전(앞으로 숙이지 않음)
    rotation.y = 0;
    rotation.z = 0;
  } else {
    rotation.x = -swing * 0.4; // 알 수 없는 직업 — 기본 전조
    rotation.y = 0;
    rotation.z = 0;
  }
}

export function updatePartyPresence(nowMs: number, delta: number) {
  if (!context) return;
  partyWorldSyncTick(nowMs, delta); // 5차 — 세션 유무/역할 판단은 내부에서
  const session = context.session();
  if (!session) {
    if (remotes.size > 0 || remoteProjectiles.length > 0) resetPartyPresence();
    return;
  }
  if (hookedSession !== session) {
    hookedSession = session;
    resetPartyPresence();
    session.onPresences((list) => receivePresences(list, performance.now()));
    if (typeof session.onGame === "function") session.onGame((message) => receiveGame(message)); // 구형 mock 가드

  }
  if (nowMs - lastSentAt >= PRESENCE_SEND_INTERVAL_MS) {
    lastSentAt = nowMs;
    session.sendPresence(context.localPresence());
  }
  updateRemoteProjectiles(delta);
  const alpha = Math.min(1, delta * LERP_PER_SECOND);
  const maxStep = REMOTE_MAX_SPEED * delta + REMOTE_STEP_SLACK; // 질주(14)보다 높은 상한 + 슬랙 — 정상 이동은 안 걸리고 패킷 점프만 제한
  for (const [nickname, remote] of remotes) {
    if (nowMs - remote.lastSeenAt > PRESENCE_STALE_MS) {
      removeRemote(nickname);
      continue;
    }
    if (!remote.onLocalMap) { if (remote.pet) { context.scene.remove(remote.pet); disposeObject(remote.pet); remote.pet = null; } continue; } // 다른 맵으로 가면 펫 숨김
    const root = remote.root;
    const dx = remote.targetX - root.position.x;
    const dz = remote.targetZ - root.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > REMOTE_SNAP_DISTANCE_SQ) {
      root.position.x = remote.targetX; // 진짜 텔레포트 — 즉시
      root.position.z = remote.targetZ;
    } else {
      let stepX = dx * alpha;
      let stepZ = dz * alpha;
      const stepLen = Math.hypot(stepX, stepZ);
      if (stepLen > maxStep && stepLen > 0.0001) {
        const scale = maxStep / stepLen; // 한 프레임 이동량 제한 — 순간이동/대시 방지
        stepX *= scale;
        stepZ *= scale;
      }
      root.position.x += stepX;
      root.position.z += stepZ;
    }
    root.position.y = context.getGroundHeightAt(root.position.x, root.position.z);
    let yawDelta = (remote.targetYaw + Math.PI) - root.rotation.y; // +Math.PI: 스폰과 동일한 모델 정면 보정(목 역전 방지)
    yawDelta = ((yawDelta + Math.PI) % (Math.PI * 2)) - Math.PI;
    root.rotation.y += yawDelta * alpha;
    if (remote.body) {
      if (remote.actionUntil > nowMs) {
        applyAttackMotion(remote.body.rotation, remote.data.playerClass, 1 - (remote.actionUntil - nowMs) / ATTACK_MOTION_MS); // 직업별 공격 모션
      } else if (remote.body.rotation.x !== 0 || remote.body.rotation.y !== 0 || remote.body.rotation.z !== 0) {
        remote.body.rotation.set(0, 0, 0); // 모션 종료 — 자세 복귀
      }
    }
    // 소환사 친구의 패시브 펫 — hasPet 변화에 생성/제거 + 아바타를 살짝 뒤·위에서 호버하며 따라감(로컬 시뮬, 동기화 비용 0)
    if (remote.data.hasPet && !remote.pet) { remote.pet = createRemotePet(); context.scene.add(remote.pet); }
    else if (!remote.data.hasPet && remote.pet) { context.scene.remove(remote.pet); disposeObject(remote.pet); remote.pet = null; }
    if (remote.pet) {
      const ptx = root.position.x - Math.sin(root.rotation.y) * 0.4, ptz = root.position.z - Math.cos(root.rotation.y) * 0.4;
      remote.pet.position.x += (ptx - remote.pet.position.x) * alpha;
      remote.pet.position.z += (ptz - remote.pet.position.z) * alpha;
      remote.pet.position.y += ((root.position.y + 1.55 + Math.sin(nowMs / 380) * 0.12) - remote.pet.position.y) * Math.min(1, delta * 6);
      remote.pet.rotation.y = root.rotation.y;
    }
  }
  publishPresenceDebug();
}

// DEV 디버그 (E2E 검증용) — 원격 아바타 HP바 존재·공격 모션·투사체·파티 힐 수신 확인 + 테스트 트리거
function publishPresenceDebug() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const now = performance.now();
  (window as unknown as Record<string, unknown>).__partyPresence = {
    remotes: [...remotes.values()].filter((remote) => remote.onLocalMap).map((remote) => ({ nickname: remote.data.nickname, health: remote.data.health, maxHealth: remote.data.maxHealth, hasHpBar: Boolean(remote.hpFill), attacking: remote.actionUntil > now })),
    projectiles: remoteProjectiles.length,
    projectilesSeen: debugProjectilesSeen,
    healReceived: debugHealReceived,
    testAttack: (kind: "melee" | "ranged" | "skill" = "ranged", visual: "arrow" | "magic" | "wind" | "tnt" = "arrow") => notifyPartyAttack(kind, new THREE.Vector3(context?.localPresence().x ?? 0, 1.4, context?.localPresence().z ?? 0), new THREE.Vector3(0, 0, -1), visual),
    testHeal: (amount = 5) => partyHealNearby(amount, 999),
  };
}

function updateRemoteProjectiles(delta: number) {
  const localMapId = context?.localPresence().mapId;
  for (let index = remoteProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = remoteProjectiles[index];
    projectile.mesh.position.x += projectile.vx * delta;
    projectile.mesh.position.y += projectile.vy * delta;
    projectile.mesh.position.z += projectile.vz * delta;
    projectile.life -= delta;
    if (projectile.life <= 0 || projectile.mapId !== localMapId) {
      // 수명 만료 또는 내가 맵을 옮김 — 새 맵에 고아 투사체가 떠다니지 않게 즉시 제거
      context?.scene.remove(projectile.mesh);
      disposeObject(projectile.mesh);
      remoteProjectiles.splice(index, 1);
    }
  }
}

// ── 5.1 외부 API: 공격 브로드캐스트 / 충돌 / 파티 힐 ───────────────────────────

// 로컬 공격을 파티에 알린다 — 친구 화면에 모션·투사체가 보이게. (게스트→호스트, 호스트→게스트 전원)
// 동굴/집·타이틀(inGame=false)에서는 보내지 않는다 — 야외 친구 화면에 허공 투사체가 생기는 것을 막는다.
export function notifyPartyAttack(kind: "melee" | "ranged" | "skill", origin?: THREE.Vector3, direction?: THREE.Vector3, visual?: "arrow" | "magic" | "wind" | "tnt" | "fireball", speed?: number, life?: number, obsidian?: boolean) {
  const session = context?.session();
  if (!session || !context) return;
  const me = context.localPresence();
  if (!me.inGame) return;
  session.sendGame({ type: "playerAttack", nickname: me.nickname, mapId: me.mapId, kind, visual, obsidian: obsidian || undefined, speed, life, ox: origin?.x, oy: origin?.y, oz: origin?.z, dx: direction?.x, dy: direction?.y, dz: direction?.z });
}

// 플레이어 이동 시 같은 맵 파티원과 겹치지 않게 밀어낸다 (resolveCollisions 의 충돌 루프 안에서 호출). 밀어냈으면 true.
export function pushOutOfPartyMembers(position: THREE.Vector3, selfRadius: number): boolean {
  const combined = selfRadius + 0.42;
  let moved = false;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = position.x - remote.root.position.x;
    const dz = position.z - remote.root.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= 0.0001 || distSq >= combined * combined) continue;
    const distance = Math.sqrt(distSq);
    const push = combined - distance;
    position.x += (dx / distance) * push;
    position.z += (dz / distance) * push;
    moved = true;
  }
  return moved;
}

// 힐러용: 같은 맵 사정거리 내 파티원 (있으면 스킬 발동 허용 판정에 사용)
export function partyHasNearbyMember(x: number, z: number, radius: number): boolean {
  const radiusSq = radius * radius;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = remote.root.position.x - x;
    const dz = remote.root.position.z - z;
    if (dx * dx + dz * dz <= radiusSq) return true;
  }
  return false;
}

// 힐러 스킬: 사정거리 내 파티원 전원에게 partyHeal 송신 (대상이 자기 HP 에 적용)
export function partyHealNearby(amount: number, radius: number): number {
  const session = context?.session();
  if (!session || !context) return 0;
  const me = context.localPresence();
  if (!me.inGame) return 0; // 동굴/집·타이틀에서는 야외 친구를 힐하지 않는다 (좌표공간 불일치)
  const radiusSq = radius * radius;
  let healed = 0;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = remote.root.position.x - me.x;
    const dz = remote.root.position.z - me.z;
    if (dx * dx + dz * dz > radiusSq) continue;
    session.sendGame({ type: "partyHeal", recipient: remote.data.nickname, amount, mapId: me.mapId });
    healed += 1;
  }
  return healed;
}

// 힐러 3스킬(심판의 빛): 사정거리 내 파티원 전원에게 공격·방어 버프(partyEmpower) 송신.
export function partyEmpowerNearby(durationMs: number, radius: number): number {
  const session = context?.session();
  if (!session || !context) return 0;
  const me = context.localPresence();
  if (!me.inGame) return 0;
  const radiusSq = radius * radius;
  let count = 0;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = remote.root.position.x - me.x;
    const dz = remote.root.position.z - me.z;
    if (dx * dx + dz * dz > radiusSq) continue;
    session.sendGame({ type: "partyEmpower", recipient: remote.data.nickname, durationMs, mapId: me.mapId });
    count += 1;
  }
  return count;
}

// 탱커 3스킬(불굴의 함성): 사정거리 내 파티원 전원에게 방어 버프(partyRally) 송신.
export function partyRallyNearby(durationMs: number, radius: number): number {
  const session = context?.session();
  if (!session || !context) return 0;
  const me = context.localPresence();
  if (!me.inGame) return 0;
  const radiusSq = radius * radius;
  let count = 0;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = remote.root.position.x - me.x;
    const dz = remote.root.position.z - me.z;
    if (dx * dx + dz * dz > radiusSq) continue;
    session.sendGame({ type: "partyRally", recipient: remote.data.nickname, durationMs, mapId: me.mapId });
    count += 1;
  }
  return count;
}

// 지역 지도 마커 — 현재 맵에 있는 파티원만
export function partyMapMarkers(localMapId: string): { nickname: string; x: number; z: number }[] {
  const markers: { nickname: string; x: number; z: number }[] = [];
  for (const remote of remotes.values()) {
    if (remote.data.inGame && remote.data.mapId === localMapId) markers.push({ nickname: remote.data.nickname, x: remote.data.x, z: remote.data.z });
  }
  return markers;
}

export function remotePartyCount() {
  return remotes.size;
}
