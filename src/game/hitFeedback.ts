import * as THREE from "three";
import type { WorldObject } from "./types";

// 타격감 패키지 — 플레이어 공격이 명중했을 때의 피드백을 한곳에서 관리한다.
// 히트스톱(짧은 슬로모) + 넉백 + 스쿼시 펀치 + 데미지 숫자(DOM) + FOV 킥 + 타격음 레이어.
// updateHitFeedback 은 핫패스다 — THREE 할당 금지 (check:hotpath 예산 0).

export interface HitFeedbackDeps {
  camera: THREE.PerspectiveCamera;
  playerPosition: THREE.Vector3;
  playTone(frequency: number, duration?: number, type?: OscillatorType, volume?: number): void;
  refreshSpatialObject(object: WorldObject): void;
  getGroundHeightAt(x: number, z: number): number;
}

interface ScalePunch {
  root: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
  start: number;
}

export const HIT_STOP_MS = 70;
export const KILL_STOP_MS = 130;
export const HIT_STOP_SCALE = 0.12;
const PUNCH_MS = 170;
// 화면 떨림 체감을 낮추기 위해 약하게 유지한다 (기존 2.6도는 과했음)
const FOV_KICK_MS = 90;
const FOV_KICK_AMOUNT = 1.0;
// 무거운 대상(보스·골렘)은 거의 밀리지 않는다 — 타격감은 펀치/숫자가 담당
const HEAVY_TYPES = new Set(["dragon", "villageGolem", "villageKing"]);

const punches: ScalePunch[] = [];
const screenScratch = new THREE.Vector3();
let hitStopUntil = 0;
let fovKickStart = -1;
let fovBase = 0;
let numbersLayer: HTMLDivElement | null = null;

export function hitStopScale(now: number) {
  return now < hitStopUntil ? HIT_STOP_SCALE : 1;
}

function spawnDamageNumber(deps: HitFeedbackDeps, target: WorldObject, damage: number, killed: boolean) {
  if (typeof document === "undefined") return;
  if (!numbersLayer) {
    numbersLayer = document.createElement("div");
    numbersLayer.className = "damage-number-layer";
    document.body.appendChild(numbersLayer);
  }
  screenScratch.copy(target.root.position);
  screenScratch.y += (target.collisionHeight ?? 1.4) * 0.9;
  screenScratch.project(deps.camera);
  if (screenScratch.z > 1) return;
  const element = document.createElement("div");
  element.className = `damage-number${killed ? " kill" : damage >= 25 ? " big" : ""}`;
  element.textContent = killed ? `${damage}` : String(damage);
  element.style.left = `${(screenScratch.x * 0.5 + 0.5) * window.innerWidth + (Math.random() * 36 - 18)}px`;
  element.style.top = `${(-screenScratch.y * 0.5 + 0.5) * window.innerHeight - Math.random() * 14}px`;
  numbersLayer.appendChild(element);
  element.addEventListener("animationend", () => element.remove());
}

export function triggerHitFeedback(
  deps: HitFeedbackDeps,
  target: WorldObject,
  damage: number,
  killed: boolean,
  now = performance.now(),
) {
  hitStopUntil = now + (killed ? KILL_STOP_MS : HIT_STOP_MS);
  if (fovKickStart < 0) fovBase = deps.camera.fov;
  fovKickStart = now;

  // 넉백 — 플레이어 반대 방향으로 살짝 밀리고 지면에 다시 붙인다
  const dx = target.root.position.x - deps.playerPosition.x;
  const dz = target.root.position.z - deps.playerPosition.z;
  const distance = Math.hypot(dx, dz);
  if (!killed && distance > 0.01) {
    const knock = HEAVY_TYPES.has(target.type) ? 0.1 : 0.42;
    target.root.position.x += (dx / distance) * knock;
    target.root.position.z += (dz / distance) * knock;
    target.root.position.y = deps.getGroundHeightAt(target.root.position.x, target.root.position.z);
    deps.refreshSpatialObject(target);
  }

  // 스쿼시 펀치 — 같은 대상이 연타당하면 기존 펀치를 리셋해 base 스케일이 오염되지 않게 한다
  const existing = punches.find((punch) => punch.root === target.root);
  if (existing) existing.start = now;
  else punches.push({ root: target.root, baseX: target.root.scale.x, baseY: target.root.scale.y, baseZ: target.root.scale.z, start: now });

  spawnDamageNumber(deps, target, damage, killed);

  // 타격음 레이어 — 둔탁한 저음 + 데미지 비례 크랙, 처치 시 상승 차임
  deps.playTone(92, 0.07, "square", 0.05);
  deps.playTone(300 + Math.min(45, damage) * 7, 0.05, "triangle", 0.035);
  if (damage >= 25) deps.playTone(170, 0.1, "sawtooth", 0.03);
  if (killed) {
    deps.playTone(523, 0.1, "triangle", 0.04);
    deps.playTone(784, 0.14, "triangle", 0.035);
  }
}

export function updateHitFeedback(now: number, camera: THREE.PerspectiveCamera) {
  for (let index = punches.length - 1; index >= 0; index -= 1) {
    const punch = punches[index];
    const t = (now - punch.start) / PUNCH_MS;
    if (t >= 1) {
      punch.root.scale.set(punch.baseX, punch.baseY, punch.baseZ);
      punches.splice(index, 1);
      continue;
    }
    const crunch = Math.sin(Math.PI * Math.max(0, t)) * 0.16;
    punch.root.scale.set(punch.baseX * (1 + crunch), punch.baseY * (1 - crunch * 0.85), punch.baseZ * (1 + crunch));
  }

  if (fovKickStart >= 0) {
    const t = (now - fovKickStart) / FOV_KICK_MS;
    if (t >= 1) {
      camera.fov = fovBase;
      fovKickStart = -1;
    } else {
      camera.fov = fovBase - FOV_KICK_AMOUNT * Math.sin(Math.PI * Math.max(0, t));
    }
    camera.updateProjectionMatrix();
  }
}

// 테스트 전용 — 내부 상태 초기화
export function resetHitFeedbackForTest() {
  punches.length = 0;
  hitStopUntil = 0;
  fovKickStart = -1;
}

export function activePunchCount() {
  return punches.length;
}
