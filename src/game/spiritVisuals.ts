import * as THREE from "three";
import { makeToonMaterial } from "../visuals";
import { spiritGradeDef, spiritGradeIndex } from "./spirits";
import type { SpiritGrade } from "./types";

// 장착 정령 동행체(시야 왼쪽 어깨에 떠다니는 귀여운 페어리) — 순수 비주얼 팩토리(leaf).
// 소환수(오른쪽 어깨)와 대칭. 등급이 높을수록 날개 수·발광이 화려. 부수효과·커널 접근 없음.

// 왼쪽 어깨 배치(소환수 flightSide 1.3 의 반대편) + 1/3 크기 느낌. (소환수 scale 0.74 ↔ 정령 0.26)
const SPIRIT_AHEAD = 2.0;
const SPIRIT_SIDE = -1.15; // 음수 = 왼쪽
const SPIRIT_RISE = 0.55;
const SPIRIT_SCALE = 0.26;

function petal(color: THREE.ColorRepresentation): THREE.Mesh {
  // 결정 꽃잎 날개 — 납작한 다이아몬드(4면 콘) + 발광 반투명.
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.95, 4),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.82, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.scale.set(1, 1, 0.16); // 납작하게
  mesh.userData.skipRaycastTarget = true;
  mesh.userData.skipStaticMerge = true;
  return mesh;
}

export function createSpiritCompanionModel(grade: SpiritGrade): THREE.Group {
  const def = spiritGradeDef(grade);
  const idx = spiritGradeIndex(grade);
  const root = new THREE.Group();
  root.userData.spiritCompanion = true;

  const white = makeToonMaterial(0xfff4f6, { roughness: 0.62 });
  const accent = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.15 });
  const eyeMat = makeToonMaterial(0x5b2330, { roughness: 0.4 });

  // 통통한 몸 + 큰 머리
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), white);
  body.scale.set(1, 1.04, 0.92);
  body.position.y = 0.46;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), white);
  head.position.y = 1.08;
  root.add(body, head);

  // 작은 팔다리(둥글둥글)
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), white);
    arm.position.set(s * 0.38, 0.52, 0.08);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white);
    foot.position.set(s * 0.2, 0.06, 0.06);
    root.add(arm, foot);
  }

  // 큰 눈(살짝 세로 타원) + 하이라이트
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), eyeMat);
    eye.scale.set(0.82, 1.18, 0.5);
    eye.position.set(s * 0.19, 1.1, 0.42);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(s * 0.15, 1.16, 0.5);
    root.add(eye, shine);
  }

  // 유니콘 뿔(등급색 결정)
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 6), accent);
  horn.position.y = 1.68;
  horn.userData.skipStaticMerge = true;
  root.add(horn);

  // 길고 뾰족한 귀
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.62, 6), white);
    ear.position.set(s * 0.26, 1.5, -0.05);
    ear.rotation.z = s * 0.5;
    root.add(ear);
  }

  // 결정 꽃잎 날개 — 등급↑일수록 한쪽 날개 수 ↑(3~6). 좌우 피벗을 플랩 애니메이션.
  const perSide = Math.min(6, 3 + Math.floor(idx / 2));
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.12, 1.0, -0.12);
    wing.userData.spiritWing = s;
    for (let i = 0; i < perSide; i += 1) {
      const p = petal(def.color);
      const spread = 0.28 + (i / Math.max(1, perSide - 1)) * 1.0; // 위→옆으로 펼침
      p.position.set(s * Math.sin(spread) * 0.5, Math.cos(spread) * 0.55, -0.1 - i * 0.03);
      p.rotation.z = -s * spread;
      p.scale.multiplyScalar(1 - i * 0.08);
      wing.add(p);
    }
    root.add(wing);
  }

  // 아래로 늘어진 분홍 망토/보석
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), accent);
  cape.position.set(0, 0.16, -0.02);
  cape.rotation.x = Math.PI; // 아래로 뾰족
  root.add(cape);

  // 부드러운 발광 오라(추가블렌딩) — 등급↑일수록 진함
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 12),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.14 + idx * 0.02, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  aura.userData.spiritAura = true;
  aura.userData.skipRaycastTarget = true;
  aura.userData.skipStaticMerge = true;
  aura.position.y = 0.9;
  root.add(aura);

  root.scale.setScalar(SPIRIT_SCALE);
  return root;
}

export interface SpiritCompanionUpdate {
  px: number; py: number; pz: number; // 플레이어(카메라) 위치
  yaw: number;
  elapsed: number;
  delta: number;
}

const _target = new THREE.Vector3(); // 매 프레임 재사용(할당 금지)

// 매 프레임 — 왼쪽 어깨로 따라오며 둥실 + 날개 플랩 + 오라 맥동.
export function updateSpiritCompanion(group: THREE.Group, u: SpiritCompanionUpdate): void {
  const forwardX = -Math.sin(u.yaw), forwardZ = -Math.cos(u.yaw);
  const rightX = Math.cos(u.yaw), rightZ = -Math.sin(u.yaw);
  _target.set(
    u.px + forwardX * SPIRIT_AHEAD + rightX * SPIRIT_SIDE,
    u.py + SPIRIT_RISE + Math.sin(u.elapsed * 2.6) * 0.12,
    u.pz + forwardZ * SPIRIT_AHEAD + rightZ * SPIRIT_SIDE,
  );
  group.position.lerp(_target, Math.min(1, u.delta * 5));
  group.rotation.y = u.yaw + Math.PI; // 플레이어를 바라보게(날개는 뒤로)
  const flap = Math.sin(u.elapsed * 6) * 0.32;
  const auraPulse = (Math.sin(u.elapsed * 3) + 1) * 0.5;
  for (const child of group.children) {
    const wingSide = child.userData.spiritWing;
    if (typeof wingSide === "number") { child.rotation.y = wingSide * (0.3 + flap); continue; }
    if (child.userData.spiritAura && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.scale.setScalar(1 + auraPulse * 0.1);
    }
  }
}

export function disposeSpiritCompanion(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}
