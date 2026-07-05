import * as THREE from "three";

// 텔레그래프(범위 예고) 엔진 — 일리아 전투에서 태어난 "바닥에 위험 범위를 미리 그려주고 딜레이 후 폭발" 패턴을
// 오버월드 보스·용도 공유하도록 leaf 로 추출. illiaBoss(아레나 전용)·dragonAi·predatorAi 가 함께 쓴다.
// main.ts import 금지. 시각 팩토리 + 판정 기하 + 무할당 펄스 애니메이션 + 중앙 필드 매니저.

// 텔레그래프로 회피 가능해진 스킬(브레스·슬램)이 적중 시 주는 추가 데미지 배수 — "피할 수 있는 대신 더 아프게".
export const TELEGRAPH_DAMAGE_MULT = 2;

export type TelegraphSpec =
  | { kind: "circle"; x: number; z: number; r: number; delayMs: number }
  | { kind: "ring"; x: number; z: number; inner: number; r: number; delayMs: number }
  | { kind: "line"; x: number; z: number; dirX: number; dirZ: number; len: number; width: number; delayMs: number }
  | { kind: "cone"; x: number; z: number; angle: number; arc: number; r: number; delayMs: number };

const fillMaterialBase = new THREE.MeshBasicMaterial({ color: 0xff1f3d, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const shrinkMaterialBase = new THREE.MeshBasicMaterial({ color: 0xff8090, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
export const TELEGRAPH_COLOR_FAR = new THREE.Color(0x99101f); // 예고 시작(어두운 핏빛)
export const TELEGRAPH_COLOR_NEAR = new THREE.Color(0xff4050); // 폭발 직전(밝은 진홍) — lerpColors 로 무할당 보간

export interface TelegraphMeshes { group: THREE.Group; fill: THREE.Mesh; edge: THREE.Mesh | null; shrink: THREE.Mesh | null }

export function telegraphMesh(spec: TelegraphSpec): TelegraphMeshes {
  const group = new THREE.Group();
  let fillGeometry: THREE.BufferGeometry;
  let edgeGeometry: THREE.BufferGeometry | null = null;
  if (spec.kind === "circle") {
    fillGeometry = new THREE.CircleGeometry(spec.r, 30);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 30);
  } else if (spec.kind === "ring") {
    fillGeometry = new THREE.RingGeometry(spec.inner, spec.r, 36);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 36);
  } else if (spec.kind === "cone") {
    fillGeometry = new THREE.CircleGeometry(spec.r, 24, spec.angle - spec.arc / 2, spec.arc);
    edgeGeometry = new THREE.RingGeometry(spec.r - 0.14, spec.r, 24, 1, spec.angle - spec.arc / 2, spec.arc);
  } else {
    fillGeometry = new THREE.PlaneGeometry(spec.width, spec.len);
    edgeGeometry = null;
  }
  const fill = new THREE.Mesh(fillGeometry, fillMaterialBase.clone());
  fill.rotation.x = -Math.PI / 2;
  if (spec.kind === "line") {
    // 라인은 시작점에서 dir 방향으로 len 만큼 — 평면 중심을 절반 지점으로 이동 후 진행각 회전.
    const yaw = Math.atan2(spec.dirX, spec.dirZ);
    group.rotation.y = yaw;
    fill.position.z = spec.len / 2;
  }
  group.add(fill);
  let edge: THREE.Mesh | null = null;
  if (edgeGeometry) {
    edge = new THREE.Mesh(edgeGeometry, edgeMaterial.clone());
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.012;
    group.add(edge);
  }
  // 수축 경고 링 — 영역 바깥(×1.55)에서 경계까지 조여든다(원/링/부채꼴). 직선은 채움 스트로브만.
  let shrink: THREE.Mesh | null = null;
  if (spec.kind !== "line") {
    const outerR = spec.r;
    shrink = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.2, outerR - 0.22), outerR, 40), shrinkMaterialBase.clone());
    shrink.rotation.x = -Math.PI / 2;
    shrink.position.y = 0.02;
    shrink.scale.setScalar(1.55);
    group.add(shrink);
  }
  group.position.set(spec.x, 0.07, spec.z);
  return { group, fill, edge, shrink };
}

// 폭발 연출 기준점 — 직선은 시작점이 아니라 경로 중앙에서 터져야 자연스럽다.
export function telegraphBurstPoint(spec: TelegraphSpec): { x: number; z: number } {
  if (spec.kind === "line") return { x: spec.x + spec.dirX * spec.len * 0.5, z: spec.z + spec.dirZ * spec.len * 0.5 };
  if (spec.kind === "cone") return { x: spec.x + Math.sin(spec.angle) * spec.r * 0.5, z: spec.z + Math.cos(spec.angle) * spec.r * 0.5 };
  return { x: spec.x, z: spec.z };
}

export function telegraphContains(spec: TelegraphSpec, px: number, pz: number): boolean {
  const dx = px - spec.x;
  const dz = pz - spec.z;
  if (spec.kind === "circle") return dx * dx + dz * dz <= spec.r * spec.r;
  if (spec.kind === "ring") { const d2 = dx * dx + dz * dz; return d2 >= spec.inner * spec.inner && d2 <= spec.r * spec.r; }
  if (spec.kind === "cone") {
    const d2 = dx * dx + dz * dz;
    if (d2 > spec.r * spec.r) return false;
    let diff = Math.atan2(dx, dz) - spec.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) <= spec.arc / 2;
  }
  // line: 진행 방향 투영 0..len, 수직 거리 ≤ width/2
  const along = dx * spec.dirX + dz * spec.dirZ;
  if (along < 0 || along > spec.len) return false;
  const perp = Math.abs(dx * spec.dirZ - dz * spec.dirX);
  return perp <= spec.width / 2;
}

// 공유 지오메트리/머티리얼 보존을 위해 edgeMaterial(공유)은 dispose 하지 않는다. fill/shrink 는 clone 이라 개별 dispose.
export function disposeTelegraphGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh) return;
    mesh.geometry.dispose();
    if (mesh.material !== edgeMaterial) (mesh.material as THREE.Material).dispose();
  });
}

// 텔레그래프 펄스 애니메이션(무할당) — 어두운 핏빛→진홍 보간 + 마지막 0.35s 스트로브 + 수축 경고 링.
// illiaBoss·중앙필드 공용. remain = 폭발까지 남은 ms(>0).
export function animateTelegraphMeshes(fill: THREE.Mesh, edge: THREE.Mesh | null, shrink: THREE.Mesh | null, spec: TelegraphSpec, remain: number, now: number): void {
  const progress = 1 - remain / spec.delayMs;
  const fillMaterial = fill.material as THREE.MeshBasicMaterial;
  fillMaterial.color.lerpColors(TELEGRAPH_COLOR_FAR, TELEGRAPH_COLOR_NEAR, progress);
  fillMaterial.opacity = remain < 350 ? 0.5 + Math.sin(now * 0.055) * 0.28 : 0.18 + progress * 0.4;
  if (edge) (edge.material as THREE.MeshBasicMaterial).opacity = remain < 350 ? 0.55 + Math.sin(now * 0.06) * 0.45 : 0.85;
  if (shrink) { const s = 1.55 - progress * 0.55; shrink.scale.set(s, s, s); (shrink.material as THREE.MeshBasicMaterial).opacity = 0.45 + progress * 0.4; }
}

// ── 중앙 텔레그래프 필드 — 오버월드 보스/용 공유(일리아는 IlliaFightState 로 자체 관리). ──
export interface ActiveTelegraph {
  spec: TelegraphSpec;
  detonateAt: number;
  meshes: TelegraphMeshes;
  onDetonate(): void; // 폭발 시 데미지 판정·전용 VFX(스폰 시 클로저로 캡처)
}

export interface TelegraphField { list: ActiveTelegraph[] }

export function createTelegraphField(): TelegraphField {
  return { list: [] };
}

// 텔레그래프 1개 스폰 — spec 위치에 메시를 씬에 추가하고 detonateAt 에 폭발 예약. groundY 로 지형 높이 보정.
export function spawnFieldTelegraph(field: TelegraphField, scene: THREE.Scene, spec: TelegraphSpec, detonateAt: number, groundY: number, onDetonate: () => void): void {
  const meshes = telegraphMesh(spec);
  meshes.group.position.y = groundY + 0.08;
  scene.add(meshes.group);
  field.list.push({ spec, detonateAt, meshes, onDetonate });
}

export interface TelegraphFieldVfx {
  scene: THREE.Scene;
  now(): number;
  groundBurst(x: number, z: number): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
}

// 매 프레임 — 살아있는 텔레그래프는 펄스, 시간이 된 것은 폭발(충격파+onDetonate)시키고 제거. active=false 면 전부 청소.
// update* 접두사(hotpath 스캐너 대상): 본문에 new THREE/clone/Set/Map/innerHTML 금지 — 준수(splice·animate 호출뿐).
export function updateTelegraphField(field: TelegraphField, vfx: TelegraphFieldVfx, active: boolean): void {
  if (!active) { if (field.list.length) clearTelegraphField(field, vfx.scene); return; }
  const now = vfx.now();
  let detonated = false;
  for (let i = field.list.length - 1; i >= 0; i -= 1) {
    const t = field.list[i];
    const remain = t.detonateAt - now;
    if (remain > 0) { animateTelegraphMeshes(t.meshes.fill, t.meshes.edge, t.meshes.shrink, t.spec, remain, now); continue; }
    field.list.splice(i, 1);
    vfx.scene.remove(t.meshes.group);
    disposeTelegraphGroup(t.meshes.group);
    const p = telegraphBurstPoint(t.spec);
    vfx.groundBurst(p.x, p.z);
    t.onDetonate();
    detonated = true;
  }
  if (detonated) { vfx.playTone(42, 0.42, "sawtooth", 0.08); vfx.playTone(300, 0.1, "square", 0.05); } // 볼리당 1회 저역 폭음
}

export function clearTelegraphField(field: TelegraphField, scene: THREE.Scene): void {
  for (const t of field.list) { scene.remove(t.meshes.group); disposeTelegraphGroup(t.meshes.group); }
  field.list.length = 0;
}
