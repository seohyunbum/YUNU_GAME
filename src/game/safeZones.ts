// leaf: 마을·훈련장 "안전구역" — 몬스터가 스폰/이동으로 들어오지 못하게 막는 원형 구역.
// main.ts 를 import 하지 않는다(전부 정적 데이터 + 순수 함수). VILLAGE_CENTERS 는 마을 배치(main.ts seedOverworld)와
// 안전구역의 단일 진실원천 — main.ts 가 이 배열로 마을을 스폰하므로 좌표가 절대 어긋나지 않는다.
// isInSafeZone/clampOutOfSafeZones 는 무할당(핫패스 이동 코드에서 호출되어도 안전).
import { TRAINING_CENTER } from "./training";

export const VILLAGE_CENTERS = [
  { x: 58, z: -76, special: true }, // 시작 지점에 가장 가까운 중앙 마을 — 큰 마을 + 대장간 확정(제련대 교환용)
  { x: -96, z: 120, special: false },
  { x: 245, z: 138, special: true },
] as const;

// 마을 울타리 반경 = ringRadius+7 (일반 25 / 특수 34). 그 바깥 +3 마진까지 안전구역으로 본다.
const VILLAGE_SAFE_RADIUS = 28;
const VILLAGE_SAFE_RADIUS_SPECIAL = 37;
const TRAINING_SAFE_RADIUS = 14; // 훈련장 울타리 11 + 마진. (훈련장은 기본 맵에만 있어 타 맵에선 작은 무스폰 원이 남지만 무해)

interface SafeCircle { x: number; z: number; r: number }
const SAFE_CIRCLES: readonly SafeCircle[] = [
  ...VILLAGE_CENTERS.map((v) => ({ x: v.x, z: v.z, r: v.special ? VILLAGE_SAFE_RADIUS_SPECIAL : VILLAGE_SAFE_RADIUS })),
  { x: TRAINING_CENTER.x, z: TRAINING_CENTER.z, r: TRAINING_SAFE_RADIUS },
];

// (x,z) 가 어떤 안전구역 안에 있는가. margin 만큼 더 바깥까지 막는다(스폰 제외용).
export function isInSafeZone(x: number, z: number, margin = 0): boolean {
  for (let i = 0; i < SAFE_CIRCLES.length; i += 1) {
    const c = SAFE_CIRCLES[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + margin;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

// 안전구역 안의 점을 가장 가까운 경계로 밀어낸다(제자리 변형, 무할당). 이동 클램프(추격 차단)용.
export function clampOutOfSafeZones(point: { x: number; z: number }): void {
  for (let i = 0; i < SAFE_CIRCLES.length; i += 1) {
    const c = SAFE_CIRCLES[i];
    const dx = point.x - c.x;
    const dz = point.z - c.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= c.r * c.r) continue;
    if (d2 > 1e-6) {
      const s = c.r / Math.sqrt(d2);
      point.x = c.x + dx * s;
      point.z = c.z + dz * s;
    } else {
      point.x = c.x + c.r; // 정확히 중심이면 +x 경계로
    }
  }
}
