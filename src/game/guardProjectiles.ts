import * as THREE from "three";

// 마을 가드의 눈에 보이는 투사체 — 골렘 바위(아치)·궁수 화살·마법사 마법탄(직선).
// 던질 때 노린 지점으로 날아가 착탄: 그 자리에 플레이어가 있으면 피해(이동 회피 가능).
// leaf: main.ts 미import. 던진 가드가 어디서 쏘는지 보이게 하는 게 목적.

export type GuardProjectileKind = "rock" | "arrow" | "magic";

export interface GuardProjectile {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3; // 던질 때 노린 착탄 지점(발밑)
  t: number;
  duration: number;
  damage: number;
  kind: GuardProjectileKind;
}

export interface GuardProjectileContext {
  add(mesh: THREE.Object3D): void;
  remove(mesh: THREE.Object3D): void;
  playerPosition: THREE.Vector3; // 눈높이
  damagePlayer(amount: number, showParticles: boolean, reason: string): boolean;
  impact(position: THREE.Vector3, kind: GuardProjectileKind): void;
}

const SPEED: Record<GuardProjectileKind, number> = { rock: 13, arrow: 24, magic: 18 };
const HIT_RADIUS: Record<GuardProjectileKind, number> = { rock: 2.4, arrow: 2, magic: 2.1 };
const ARC: Record<GuardProjectileKind, number> = { rock: 2.4, arrow: 0, magic: 0.4 }; // 화살은 직선, 바위는 큰 포물선
const REASON: Record<GuardProjectileKind, string> = {
  rock: "마을 골렘이 던진 바위에 맞아 체력이 모두 떨어졌습니다.",
  arrow: "마을 궁수의 화살에 맞아 체력이 모두 떨어졌습니다.",
  magic: "마을 마법사의 마법탄에 맞아 체력이 모두 떨어졌습니다.",
};

function createProjectileMesh(kind: GuardProjectileKind): THREE.Object3D {
  if (kind === "arrow") {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.72 }));
    shaft.rotation.x = Math.PI / 2; // 길이축 → +Z
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.4, roughness: 0.4 }));
    tip.position.z = 0.42;
    tip.rotation.x = Math.PI / 2;
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.002, 0.13), new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.85 }));
    fletch.position.z = -0.32;
    group.add(shaft, tip, fletch);
    return group;
  }
  if (kind === "magic") {
    const group = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), new THREE.MeshBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0x36f28f, emissive: 0x10b981, emissiveIntensity: 1.35, roughness: 0.25 }));
    group.add(halo, core);
    return group;
  }
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: 0x6b6e72, roughness: 0.96, metalness: 0.08, flatShading: true }));
  rock.scale.set(1, 0.85, 1.12);
  return rock;
}

export function spawnGuardProjectile(list: GuardProjectile[], ctx: GuardProjectileContext, from: THREE.Vector3, to: THREE.Vector3, damage: number, kind: GuardProjectileKind): void {
  const mesh = createProjectileMesh(kind);
  mesh.position.copy(from);
  if (kind === "arrow") mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize()); // 진행 방향으로 화살촉
  ctx.add(mesh);
  list.push({ mesh, from: from.clone(), to: to.clone(), t: 0, duration: THREE.MathUtils.clamp(from.distanceTo(to) / SPEED[kind], 0.35, 1.6), damage, kind });
}

export function updateGuardProjectiles(list: GuardProjectile[], ctx: GuardProjectileContext, delta: number): void {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.t += delta / p.duration;
    if (p.t >= 1) {
      ctx.impact(p.to, p.kind);
      const r = HIT_RADIUS[p.kind];
      if ((ctx.playerPosition.x - p.to.x) ** 2 + (ctx.playerPosition.z - p.to.z) ** 2 < r * r) ctx.damagePlayer(p.damage, true, REASON[p.kind]);
      ctx.remove(p.mesh);
      list.splice(i, 1);
      continue;
    }
    p.mesh.position.set(
      THREE.MathUtils.lerp(p.from.x, p.to.x, p.t),
      THREE.MathUtils.lerp(p.from.y, p.to.y, p.t) + Math.sin(p.t * Math.PI) * ARC[p.kind],
      THREE.MathUtils.lerp(p.from.z, p.to.z, p.t),
    );
    if (p.kind === "rock") { p.mesh.rotation.x += delta * 6; p.mesh.rotation.z += delta * 4; }
    else if (p.kind === "magic") p.mesh.rotation.y += delta * 9;
  }
}
