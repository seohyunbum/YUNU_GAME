import * as THREE from "three";
import { attachBossAura } from "./auraVisuals";

// 최종 보스 '일리아' 비주얼 — 백발·붉은 눈·검은 고딕 드레스·대형 흑익(레퍼런스: 수은등풍 타천사).
// 순수 모델 팩토리 leaf(main.ts import 금지). 애니메이션은 illiaBoss.update 가 userData 참조로 구동.

const WHITE_HAIR = 0xe8e6ef;
const PALE_SKIN = 0xf3e9e2;
const GOTHIC_BLACK = 0x14101c;
const FRILL_WHITE = 0xf5f0f7;
const CRIMSON = 0xb3123a;
const CHAIN_IRON = 0x6b7280;

const hairMaterial = new THREE.MeshStandardMaterial({ color: WHITE_HAIR, roughness: 0.55 });
const skinMaterial = new THREE.MeshStandardMaterial({ color: PALE_SKIN, roughness: 0.6 });
const dressMaterial = new THREE.MeshStandardMaterial({ color: GOTHIC_BLACK, roughness: 0.68 });
const frillMaterial = new THREE.MeshStandardMaterial({ color: FRILL_WHITE, roughness: 0.5 });
const featherMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0812, roughness: 0.8, side: THREE.DoubleSide });
const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xd9dee7, metalness: 0.85, roughness: 0.25 });
const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 0.7, roughness: 0.35 });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2038 });
const roseMaterial = new THREE.MeshStandardMaterial({ color: CRIMSON, roughness: 0.4 });
const chainMaterial = new THREE.MeshStandardMaterial({ color: CHAIN_IRON, metalness: 0.75, roughness: 0.4 });
const auraMaterial = new THREE.MeshBasicMaterial({ color: 0xa21030, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
const sealCrystalMaterial = new THREE.MeshStandardMaterial({ color: 0x241a3f, roughness: 0.25, metalness: 0.35, emissive: 0x4c1d95, emissiveIntensity: 0.35 });
const crackMaterial = new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const portalCoreMaterial = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const portalRimMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1c4d, roughness: 0.35, metalness: 0.5, emissive: 0x7c3aed, emissiveIntensity: 0.8 });
const sealShardMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2960, roughness: 0.3, emissive: 0xff2545, emissiveIntensity: 1.3 }); // 파열 파편 — 어둠 속에서도 또렷한 심홍 발광

// dispose-skip 등록용 — 위 재질들은 모듈 싱글턴이라 보스 removeObject(disposeObject3D)·컷씬 소품 정리 시
// dispose 되면 다음 스폰(사망 재도전·재입장)마다 GPU 재업로드가 반복된다. interiors 의 caveSharedMaterials 로 합류.
export function illiaSharedMaterials(): THREE.Material[] {
  return [hairMaterial, skinMaterial, dressMaterial, frillMaterial, featherMaterial, bladeMaterial, goldMaterial, eyeMaterial, roseMaterial, chainMaterial, auraMaterial, sealCrystalMaterial, sealShardMaterial, crackMaterial, portalCoreMaterial, portalRimMaterial];
}

// 깃털 날개 한 쪽 — 겹층 깃털 플레인을 부채 배열. side 1(오른쪽)/-1(왼쪽).
function createWing(side: number, span = 3.4, feathers = 9): THREE.Group {
  const wing = new THREE.Group();
  for (let i = 0; i < feathers; i += 1) {
    const t = i / (feathers - 1);
    const len = span * (0.55 + 0.65 * Math.sin(Math.PI * (0.25 + t * 0.6)));
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(0.34 - t * 0.12, len), featherMaterial);
    feather.position.set(side * (0.18 + t * 0.5), -len / 2 + 0.4 - t * 0.32, -0.05 - t * 0.05);
    feather.rotation.z = side * (0.28 + t * 1.15);
    wing.add(feather);
  }
  wing.userData.wingSide = side;
  return wing;
}

// 일리아 본체 — phase 1(봉인: 사슬·지면 고정) / 2(해방: 부유·6익·오라).
export function createIlliaModel(phase: 1 | 2): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "illia-body";

  // 드레스(스커트) — 라스 프로파일 + 흰 프릴 층.
  const skirtPoints = [new THREE.Vector2(0.22, 1.35), new THREE.Vector2(0.34, 0.95), new THREE.Vector2(0.72, 0.28), new THREE.Vector2(0.95, 0.02)];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtPoints, 20), dressMaterial);
  body.add(skirt);
  for (const [y, r] of [[0.1, 0.9], [0.34, 0.68], [0.6, 0.5]] as const) {
    const frill = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 22), frillMaterial);
    frill.rotation.x = Math.PI / 2;
    frill.position.y = y;
    body.add(frill);
  }
  // 상체·어깨 퍼프 소매.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.62, 12), dressMaterial);
  torso.position.y = 1.62;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 6, 14), frillMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.92;
  const rose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), roseMaterial);
  rose.position.set(0, 1.78, 0.24);
  body.add(torso, collar, rose);
  for (const side of [-1, 1]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), dressMaterial);
    puff.position.set(side * 0.34, 1.8, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.62, 8), dressMaterial);
    arm.position.set(side * 0.42, 1.42, 0.05);
    arm.rotation.z = side * 0.35;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMaterial);
    hand.position.set(side * 0.52, 1.12, 0.1);
    body.add(puff, arm, hand);
  }
  // 머리·백발·레이스 헤어밴드·붉은 눈.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), skinMaterial);
  head.position.y = 2.16;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMaterial);
  hairCap.position.y = 2.2;
  const hairBack = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.7), hairMaterial);
  hairBack.position.set(0, 1.5, -0.24);
  hairBack.userData.hairFlow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 16, Math.PI), dressMaterial);
  band.position.y = 2.34;
  band.rotation.x = -0.5;
  body.add(head, hairCap, hairBack, band);
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.25), hairMaterial);
    tail.position.set(side * 0.26, 1.62, -0.1);
    tail.rotation.y = side * 0.25;
    tail.userData.hairFlow = true;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMaterial);
    eye.position.set(side * 0.09, 2.18, 0.2);
    body.add(tail, eye);
  }
  // 장검(오른손) — 십자가드 세검.
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.45, 0.012), bladeMaterial);
  blade.position.y = -0.75;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), goldMaterial);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), goldMaterial);
  grip.position.y = 0.13;
  sword.add(blade, guard, grip);
  sword.position.set(0.55, 1.1, 0.12);
  sword.rotation.z = phase === 1 ? 0.35 : -0.6;
  sword.name = "illia-sword";
  body.add(sword);

  // 흑익 — P1 = 2익, P2 = 6익(3쌍) 화려하게.
  const wingPairs = phase === 1 ? 1 : 3;
  for (let pair = 0; pair < wingPairs; pair += 1) {
    for (const side of [-1, 1]) {
      const wing = createWing(side, 3.4 - pair * 0.5);
      wing.position.set(side * 0.22, 1.95 - pair * 0.34, -0.28 - pair * 0.12);
      wing.rotation.y = side * (0.35 + pair * 0.18);
      wing.userData.wingFlap = { side, pair };
      body.add(wing);
    }
  }

  root.add(body);
  if (phase === 1) {
    // 4방 구속 사슬 — 몸통에서 바닥 앵커로. 링 체인(토러스 6개/줄).
    for (let d = 0; d < 4; d += 1) {
      const angle = (Math.PI / 2) * d + Math.PI / 4;
      const chain = new THREE.Group();
      for (let i = 0; i < 6; i += 1) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 10), chainMaterial);
        const t = (i + 1) / 7;
        link.position.set(Math.cos(angle) * t * 3.4, 1.5 - t * 1.32, Math.sin(angle) * t * 3.4);
        link.rotation.set(Math.random() * 0.6, angle, i % 2 === 0 ? Math.PI / 2 : 0);
        chain.add(link);
      }
      const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.3, 8), chainMaterial);
      anchor.position.set(Math.cos(angle) * 3.5, 0.15, Math.sin(angle) * 3.5);
      chain.add(anchor);
      chain.userData.illiaChain = true;
      root.add(chain);
    }
  } else {
    // 해방 — 심홍 오라 구 + 부유 룬 링.
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.9, 18, 14), auraMaterial);
    aura.position.y = 1.4;
    aura.userData.illiaAura = true;
    const runeRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    runeRing.rotation.x = Math.PI / 2;
    runeRing.position.y = 0.25;
    runeRing.userData.illiaRing = true;
    root.add(aura, runeRing);
    body.position.y = 0.55; // 부유 기본 높이(애니메이션이 사인 가산)
  }
  const glow = new THREE.PointLight(phase === 1 ? 0x7c3aed : 0xff2d55, phase === 1 ? 1.1 : 1.8, 26, 1.6);
  glow.position.y = 2.4;
  root.add(glow);
  attachBossAura(root, phase === 1 ? "illia_sealed" : "illia_desperate", 2.0, 4.6); // 심연빛 넘실거리는 아우라(셰이더)
  root.userData.illiaPhase = phase;
  return root;
}

// 봉인석 — 컷씬 1 의 주인공. 크랙 플레인은 illiaBoss 컷씬이 opacity 를 올려 "금이 가는" 연출.
export function createSealStone(): THREE.Group {
  const root = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), sealCrystalMaterial.clone()); // clone — 컷씬이 균열 진행에 맞춰 emissiveIntensity 를 올림(내부 발광)
  crystal.position.y = 2.6;
  crystal.scale.set(0.72, 1.25, 0.72);
  crystal.name = "seal-crystal";
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x1d1530, roughness: 0.7 }));
  base.position.y = 0.35;
  root.add(crystal, base);
  // 크리스탈을 감는 사슬 2줄.
  for (const tilt of [0.5, -0.65]) {
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 6, 10), chainMaterial);
      link.position.set(Math.cos(a) * 1.5, 2.6 + Math.sin(a) * 1.15 * tilt, Math.sin(a) * 1.1);
      link.rotation.set(a, tilt, i % 2 ? Math.PI / 2 : 0);
      link.userData.sealChain = true;
      root.add(link);
    }
  }
  // 크랙(균열) — 컷씬이 opacity 0→1 로 올림.
  for (let i = 0; i < 5; i += 1) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.3 + i * 0.3), crackMaterial.clone());
    crack.position.set(Math.cos(i * 2.2) * 0.75, 2.3 + Math.sin(i * 1.7) * 0.8, Math.sin(i * 2.2) * 0.62);
    crack.rotation.set(Math.random() * 0.8, i * 1.3, Math.random() * 1.2);
    crack.userData.sealCrack = true;
    root.add(crack);
  }
  const glow = new THREE.PointLight(0x7c3aed, 1.4, 20, 1.5);
  glow.position.y = 3;
  root.add(glow);
  // 균열 내부 광원 — 컷씬이 균열 진행에 맞춰 intensity 0→강렬로 올림(빛이 새어나오는 연출)
  const innerLight = new THREE.PointLight(0xff2545, 0, 26, 1.4);
  innerLight.position.y = 2.6;
  innerLight.name = "seal-light";
  root.add(innerLight);
  // 균열에서 뻗는 광선 6줄(가산 혼합 평면) — 컷씬이 opacity·scale.y 로 성장 연출
  for (let i = 0; i < 6; i += 1) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5.5), crackMaterial.clone());
    ray.position.set(Math.cos(i * 1.05) * 0.5, 2.6, Math.sin(i * 1.05) * 0.4);
    ray.rotation.set(0.35 + (i % 3) * 0.5, i * 1.05, (i % 2) * 0.6 - 0.3);
    ray.userData.sealRay = true;
    (ray.material as THREE.MeshBasicMaterial).opacity = 0;
    root.add(ray);
  }
  // 파열 파편 10조각 — 평소 숨김, 컷씬 6s 에 방사 비산(방향·회전 시드는 인덱스 기반 결정적)
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.34 + (i % 3) * 0.14, 0), sealShardMaterial);
    const homeY = 2 + (i % 4) * 0.4;
    shard.position.set(Math.cos(a) * 0.6, homeY, Math.sin(a) * 0.6);
    shard.visible = false;
    shard.userData.sealShard = { dx: Math.cos(a) * (1 + (i % 3) * 0.4), dy: 0.9 + (i % 4) * 0.35, dz: Math.sin(a) * (1 + (i % 2) * 0.5), spin: 1 + (i % 5) * 0.6, homeX: Math.cos(a) * 0.6, homeY, homeZ: Math.sin(a) * 0.6 };
    root.add(shard);
  }
  return root;
}

// 차원의 문 — 불멸의 존재 처치 지점에 스폰되는 진입 포탈(소용돌이 + 부유석).
export function createDimensionGateVisual(): THREE.Group {
  const root = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 10, 36), portalRimMaterial);
  rim.position.y = 2.4;
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.7, 36), portalCoreMaterial);
  core.position.set(0, 2.4, 0.02);
  core.userData.portalSwirl = true;
  const core2 = new THREE.Mesh(new THREE.CircleGeometry(1.25, 30), new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  core2.position.set(0, 2.4, 0.05);
  core2.userData.portalSwirl = true;
  root.add(rim, core, core2);
  for (let i = 0; i < 6; i += 1) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + (i % 3) * 0.08), sealCrystalMaterial);
    shard.position.set(Math.cos(i * 1.05) * 2.6, 1.1 + (i % 3) * 0.9, Math.sin(i * 1.05) * 1.4);
    shard.userData.gateShard = { phase: i * 1.3 };
    root.add(shard);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.5, 0.35, 10), new THREE.MeshStandardMaterial({ color: 0x1d1530, roughness: 0.7 }));
  base.position.y = 0.17;
  const light = new THREE.PointLight(0x8b5cf6, 1.8, 24, 1.5);
  light.position.y = 2.6;
  root.add(base, light);
  return root;
}

// 공용 미세 애니메이션(게이트/봉인석) — 프레임당 변형만(할당 0).
export function animateIlliaProps(root: THREE.Object3D, t: number): void {
  for (const child of root.children) {
    const ud = child.userData;
    if (ud.portalSwirl) child.rotation.z = t * (ud === root.children[1]?.userData ? 0.8 : -1.2);
    else if (ud.gateShard) child.position.y = 1.1 + (Math.sin(t * 1.4 + ud.gateShard.phase) + 1) * 0.55;
  }
}

// 차원의 문 '개방' 트레일러 프레임 변형(할당 0) — 컷씬 전용. t(초): ~1.6s 지반 융기 → 6s 까지 링 형성·부유석 수렴 → 6s 점화(오버슈트+광량 스파이크) → 안정.
// 스케일·광량·부유석 위치만 만지고 머티리얼(공유)은 건드리지 않는다. 종료/스킵 시 resetGateVisual 로 원상복구.
export function animateGateOpening(root: THREE.Object3D, t: number): void {
  const form = Math.min(1, Math.max(0, (t - 1.6) / 4.4)); // 형성 진행도(1.6~6s)
  const pop = t < 6 ? 0 : Math.min(1, (t - 6) / 0.5); // 점화 순간 팽창
  const ringScale = Math.max(0.02, form * form * 0.55 + pop * 0.45 + (t >= 6.5 ? Math.sin((t - 6.5) * 3.2) * 0.02 : 0));
  for (const child of root.children) {
    const ud = child.userData;
    if (ud.portalSwirl) {
      child.scale.setScalar(ringScale);
      child.rotation.z = -t * (t < 6 ? 0.9 : 4.2); // 점화 후 소용돌이 가속
    } else if (ud.gateShard) {
      const info = ud.gateShard as { phase: number; hx?: number; hz?: number };
      if (info.hx === undefined || info.hz === undefined) { info.hx = child.position.x; info.hz = child.position.z; } // 정위치 1회 기억(리셋용)
      const spread = 1 + (1 - form) * 1.6; // 바깥에서 정위치로 수렴
      child.position.set(info.hx * spread, Math.max(-0.3, -0.3 + form * (1.4 + (info.phase % 3) * 0.9)) + (t >= 6 ? (Math.sin(t * 1.4 + info.phase) + 1) * 0.55 : 0), info.hz * spread);
      child.rotation.y = t * (0.6 + info.phase * 0.1);
    } else if ((child as THREE.PointLight).isLight) {
      (child as THREE.PointLight).intensity = t < 6 ? form * 1.2 : Math.max(1.8, 8 * (1 - (t - 6) * 1.2)); // 점화 섬광 → 평시 광량으로 감쇠
    } else if ((child as THREE.Mesh).geometry?.type === "TorusGeometry") {
      child.scale.setScalar(ringScale); // 림도 코어와 함께 형성
    }
  }
}

// ── 시네마틱 앰비언스(컷씬 전용) — 디아블로풍: 부유 엠버 + 갓레이 광선. props 로 등록돼 컷씬 종료 시 자동 제거. ──
const EMBER_GEO = new THREE.SphereGeometry(0.05, 6, 4); // 공유(컷씬당 1회 생성물이라 dispose 없이 유지)
export function createCinematicAmbience(color: number): THREE.Group {
  const group = new THREE.Group();
  const emberMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const emberMat2 = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 34; i += 1) {
    const ember = new THREE.Mesh(EMBER_GEO, i % 3 === 0 ? emberMat2 : emberMat);
    ember.userData.ember = { phase: i * 0.61, r: 2.5 + (i % 7) * 1.3, rise: 0.35 + (i % 5) * 0.14, sway: 0.4 + (i % 4) * 0.22 };
    ember.raycast = () => {};
    group.add(ember);
  }
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff3d8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i += 1) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 14), shaftMat);
    shaft.position.set(Math.cos(i * 2.1) * 4.5, 6.5, Math.sin(i * 2.1) * 4.5);
    shaft.rotation.z = 0.22 + i * 0.1; // 비스듬히 내려꽂는 광선
    shaft.userData.shaft = { speed: 0.05 + i * 0.03 };
    shaft.raycast = () => {};
    group.add(shaft);
  }
  return group;
}

// 매 프레임(컷씬 중에만) — 엠버 나선 상승 루프 + 광선 슬로우 회전. 할당 0.
export function animateCinematicAmbience(group: THREE.Object3D, t: number): void {
  for (const child of group.children) {
    const ember = child.userData.ember as { phase: number; r: number; rise: number; sway: number } | undefined;
    if (ember) {
      const a = ember.phase + t * ember.sway * 0.35;
      child.position.set(Math.cos(a) * ember.r, 0.4 + ((t * ember.rise + ember.phase) % 6.5), Math.sin(a) * ember.r * 0.7);
      continue;
    }
    const shaft = child.userData.shaft as { speed: number } | undefined;
    if (shaft) child.rotation.y = t * shaft.speed;
  }
}

// 컷씬 종료/스킵 시 게이트를 평시 상태로 원상복구 — 이후엔 animateIlliaProps 가 스월/부유석을 이어받는다.
export function resetGateVisual(root: THREE.Object3D): void {
  for (const child of root.children) {
    child.scale.setScalar(1);
    const ud = child.userData;
    if (ud.gateShard) {
      const info = ud.gateShard as { phase: number; hx?: number; hz?: number };
      if (info.hx !== undefined && info.hz !== undefined) child.position.set(info.hx, child.position.y, info.hz);
      child.rotation.y = 0;
    } else if ((child as THREE.PointLight).isLight) (child as THREE.PointLight).intensity = 1.8;
  }
}
