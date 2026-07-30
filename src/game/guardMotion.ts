import * as THREE from "three";
import type { WorldObject } from "./types";

// 마을 경비병 공격 모션 — 무기 팔을 "어깨 피벗"으로 묶어 정면(+Z)으로 내려치기/내지르기.
// 경비 모델 정면 = +Z (눈이 z=+0.27). 어깨 피벗을 x축으로 돌리면 팔 끝이 앞으로 스윙된다.
// 걷기 사이클은 다리(walkParts)만 흔들고 팔은 안 건드리므로 스윙과 축이 겹치지 않는다.

// 무기 팔 파츠(팔·손·무기)를 어깨 지점의 피벗 그룹으로 묶는다 — 무기가 손에서 분리되지 않고 함께 스윙된다.
// parts 는 원래 group 직속이며 group-로컬 좌표다. 피벗을 shoulder 에 두고 각 파츠에서 shoulder 를 빼
// world 변환을 보존한 채 재부모화한다(healer 지팡이 분리 사고와 동일한 해법).
export function buildStrikeArm(group: THREE.Group, shoulder: readonly [number, number, number], parts: THREE.Object3D[]): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(shoulder[0], shoulder[1], shoulder[2]);
  for (const part of parts) {
    part.position.set(part.position.x - shoulder[0], part.position.y - shoulder[1], part.position.z - shoulder[2]);
    pivot.add(part); // group 에서 자동 제거되고 pivot 자식이 됨(로컬 회전은 보존)
  }
  group.add(pivot);
  group.userData.strikeArm = pivot;
  return pivot;
}

export type GuardStrikeKind = "melee" | "heavy" | "ranged";

interface StrikeProfile {
  duration: number; // ms
  windupAngle: number; // 예열에 팔을 젖히는 x회전(뒤로/위로)
  strikeAngle: number; // 도약에 앞으로 내려치는 x회전
}
// 근접=빠른 내려치기, heavy(골렘)=느리고 크게, ranged(활·시전)=작게 당겼다 내지름.
const PROFILES: Record<GuardStrikeKind, StrikeProfile> = {
  melee: { duration: 420, windupAngle: -0.55, strikeAngle: 1.15 },
  heavy: { duration: 720, windupAngle: -0.5, strikeAngle: 1.45 },
  ranged: { duration: 360, windupAngle: -0.32, strikeAngle: 0.6 },
};

const WINDUP_END = 0.4;

// 공격 발동 — 스윙 시작 시각·종류만 기록(무할당).
export function triggerGuardStrike(guard: WorldObject, now: number, kind: GuardStrikeKind) {
  guard.root.userData.guardStrikeAt = now;
  guard.root.userData.guardStrikeKind = kind;
}

// 매 프레임 스윙 — 예열(젖힘) → 도약(내려침) → 원복(0). 어깨 피벗 rotation.x 만 만진다(무할당).
export function animateGuardStrike(guard: WorldObject, now: number) {
  const pivot = guard.root.userData.strikeArm;
  if (!(pivot instanceof THREE.Object3D)) return;
  const startedAt = Number(guard.root.userData.guardStrikeAt ?? -1e9); // 미발동 센티넬(-1e9) — 부팅 초반 now<duration 에도 헛스윙 방지
  const kind = (guard.root.userData.guardStrikeKind as GuardStrikeKind) ?? "melee";
  const profile = PROFILES[kind] ?? PROFILES.melee;
  const elapsed = now - startedAt;
  if (elapsed >= profile.duration) {
    pivot.rotation.x = 0; // 휴식 포즈(파츠 로컬 회전은 그대로) — 누적 없음
    return;
  }
  const phase = THREE.MathUtils.clamp(elapsed / profile.duration, 0, 1);
  const windup = phase < WINDUP_END ? Math.sin((phase / WINDUP_END) * (Math.PI / 2)) : Math.max(0, 1 - (phase - WINDUP_END) / 0.2);
  const strike = phase <= WINDUP_END ? 0 : Math.sin(((phase - WINDUP_END) / (1 - WINDUP_END)) * Math.PI);
  pivot.rotation.x = windup * profile.windupAngle + strike * profile.strikeAngle;
}
