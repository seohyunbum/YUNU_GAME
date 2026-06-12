import * as THREE from "three";
import { createAvatarModel, CLASS_APPEARANCE } from "../avatar";
import type { PartySession, PresenceData } from "./party";
import { partyFlowOnPresences } from "./partyFlow";
import type { PlayerClassId } from "./types";

// 파티 3차 — 프레즌스 동기화. 같은 맵의 파티원을 월드에 아바타+닉네임 표찰로 그리고,
// 지역 지도에 위치 마커를 제공한다. 월드 객체(몬스터/아이템) 공유는 4차.
// updatePartyPresence 는 핫패스 — THREE 할당 금지(스폰/제거 시점 제외).

export const PRESENCE_SEND_INTERVAL_MS = 125; // 8Hz
const PRESENCE_STALE_MS = 6_000;
const LERP_PER_SECOND = 9;

export interface PresenceContext {
  scene: THREE.Scene;
  session(): PartySession | null;
  localPresence(): PresenceData;
  getGroundHeightAt(x: number, z: number): number;
}

interface RemoteMember {
  data: PresenceData;
  root: THREE.Group;
  targetX: number;
  targetZ: number;
  targetYaw: number;
  lastSeenAt: number;
  onLocalMap: boolean;
}

let context: PresenceContext | null = null;
let hookedSession: PartySession | null = null;
const remotes = new Map<string, RemoteMember>();
let lastSentAt = 0;

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
  sprite.scale.set(2.6, 0.65, 1);
  sprite.position.y = 2.45;
  return sprite;
}

function spawnRemote(data: PresenceData, nowMs: number): RemoteMember {
  const classId = (data.playerClass in CLASS_APPEARANCE ? data.playerClass : "warrior") as PlayerClassId;
  const root = new THREE.Group();
  const body = createAvatarModel(undefined, classId);
  root.add(body);
  if (typeof document !== "undefined") root.add(makeNameplate(data.nickname)); // 노드 테스트 환경 가드
  root.position.set(data.x, context!.getGroundHeightAt(data.x, data.z), data.z);
  context!.scene.add(root);
  return { data, root, targetX: data.x, targetZ: data.z, targetYaw: data.yaw, lastSeenAt: nowMs, onLocalMap: true };
}

function removeRemote(nickname: string) {
  const remote = remotes.get(nickname);
  if (!remote) return;
  context?.scene.remove(remote.root);
  remotes.delete(nickname);
}

export function initPartyPresence(presenceContext: PresenceContext) {
  context = presenceContext;
}

export function resetPartyPresence() {
  for (const nickname of [...remotes.keys()]) removeRemote(nickname);
}

function receivePresences(list: PresenceData[], nowMs: number) {
  if (!context) return;
  if (context.session()?.role === "guest") partyFlowOnPresences(list); // 소환 흐름은 게스트 전용
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
        remotes.set(data.nickname, { data, root: new THREE.Group(), targetX: data.x, targetZ: data.z, targetYaw: data.yaw, lastSeenAt: nowMs, onLocalMap: false });
      }
      continue;
    }
    const existing = remotes.get(data.nickname);
    if (!existing) {
      remotes.set(data.nickname, spawnRemote(data, nowMs));
      continue;
    }
    if (!existing.onLocalMap) {
      // 같은 맵으로 넘어옴 — 아바타 재부착
      removeRemote(data.nickname);
      remotes.set(data.nickname, spawnRemote(data, nowMs));
      continue;
    }
    existing.data = data;
    existing.targetX = data.x;
    existing.targetZ = data.z;
    existing.targetYaw = data.yaw;
    existing.lastSeenAt = nowMs;
  }
}

export function updatePartyPresence(nowMs: number, delta: number) {
  if (!context) return;
  const session = context.session();
  if (!session) {
    if (remotes.size > 0) resetPartyPresence();
    return;
  }
  if (hookedSession !== session) {
    hookedSession = session;
    resetPartyPresence();
    session.onPresences((list) => receivePresences(list, performance.now()));
  }
  if (nowMs - lastSentAt >= PRESENCE_SEND_INTERVAL_MS) {
    lastSentAt = nowMs;
    session.sendPresence(context.localPresence());
  }
  const alpha = Math.min(1, delta * LERP_PER_SECOND);
  for (const [nickname, remote] of remotes) {
    if (nowMs - remote.lastSeenAt > PRESENCE_STALE_MS) {
      removeRemote(nickname);
      continue;
    }
    if (!remote.onLocalMap) continue;
    const root = remote.root;
    root.position.x += (remote.targetX - root.position.x) * alpha;
    root.position.z += (remote.targetZ - root.position.z) * alpha;
    root.position.y = context.getGroundHeightAt(root.position.x, root.position.z);
    let yawDelta = remote.targetYaw - root.rotation.y;
    yawDelta = ((yawDelta + Math.PI) % (Math.PI * 2)) - Math.PI;
    root.rotation.y += yawDelta * alpha;
  }
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
