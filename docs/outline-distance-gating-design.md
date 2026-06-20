# 아웃라인 거리 게이트 (Outline Distance Gating) — 상세설계서

> 상태: **설계 완료 / 구현 대기** (다른 세션의 main.ts 작업 완료 후 착수)
> 작성 근거: 2026-06-20 PC 마을 렉 원인 검토 세션. 옵션 A 채택.

## 1. 목표 / 증상

- **증상**: PC(`qualityMode==="high"`)에서 **마을을 바라볼 때 드물게 렉**. 모바일과 달리 PC는 아웃라인이 켜져 있어 마을 draws가 ~2배.
- **목표**: **그래픽 품질을 거의 낮추지 않으면서** 멀리 있는 객체의 아웃라인을 끄는 거리 게이트를 도입해, "멀리서 마을 볼 때"의 누적 아웃라인 드로우콜을 제거.
- **비목표**: 모바일(아웃라인 이미 off → 영향 없음). 건물 자체 아웃라인 제거(옵션 B)·디테일 메시 아웃라인 제외(옵션 C)·집 간 머지(옵션 C-merge)는 본 설계 범위 밖(향후).

## 2. 근본 원인 (코드 근거)

- 아웃라인 대상: `shouldOutlineType` ([main.ts:9405](../src/main.ts)) — **water·terrainPatch·dirtPatch·mountain·caveExit·houseExit·smallTree·bigTree·villageFence·buildingBlock 만 제외**. 즉 **집·창고·대장간·상점·모든 마을 NPC 는 아웃라인 대상**.
- 생성: `addCartoonOutlines` ([main.ts:9441](../src/main.ts)) — 머지 후 객체의 **메시마다 BackSide 복제 1개**(`cartoonOutlineMaterial`, scale 1.05~1.12)를 추가. ⇒ 객체 draws **×2**.
  - 집 1채 ≈ 머지 후 ~13 메시 → 아웃라인 +~13 → **~26 draws (PC)**.
- 가시성 규칙(현재): `shouldShowPerformanceHiddenVisual` ([renderPerformance.ts:57](../src/game/renderPerformance.ts)) =
  - `sprintRenderOptimized` 면 false (스프린트 중 아웃라인 off)
  - `isCartoonOutline && qualityMode !== "high"` 면 false (모바일/저사양 off)
  - 그 외 true.
- **⇒ 거리 게이트가 전혀 없음.** 시야에 든 모든 아웃라인이 거리 무관하게 그려짐. 마을이 ~95m 거리(스폰)에 통째로 보이면 수백 개 아웃라인이 누적.

### 왜 무손실에 가까운가
아웃라인은 객체를 1.05~1.12배 확대한 외곽 쉘. **먼 객체(예 ≥85m)의 외곽선은 화면상 서브픽셀**이라 사실상 안 보임 → 끄더라도 체감 품질 손실 ~0. 가까이 가면(쉘이 보이는 거리) 그대로 켜짐.

## 3. 설계 개요

> 한 줄 요약: **아웃라인을 "객체 본체보다 더 짧은 거리"에서 컬링.** 기존 증분 가시성 컬링 패스(`updateVisibilityCulling`)에 객체별 아웃라인 토글을 끼워넣는다.

- 본체 컬링 거리: `visibilityDistanceForType` (트리 235 / 동물·NPC 175 / 마을 구조물 275 …).
- **아웃라인 컬링 거리**: 신규 상수 `OUTLINE_VISIBILITY_DISTANCE`(기본 85m, 본체보다 짧음). 본체는 보이되 아웃라인만 꺼지는 구간이 생김.

## 4. 변경 명세 (파일별)

### 4.1 `src/game/constants.ts` (leaf) — 상수 추가
```ts
// 아웃라인(외곽선) 거리 게이트 — 이 거리 밖 객체는 본체는 보이되 아웃라인만 끔(PC 전용; 모바일은 아웃라인 자체가 off).
// 먼 외곽선은 서브픽셀이라 체감 품질 손실 ~0. HUD 로 튜닝 가능(낮출수록 절감↑, 팝인 거리↑).
export const OUTLINE_VISIBILITY_DISTANCE = 85;
```
- (선택) 제곱값을 main.ts 에서 한 번 계산해 캐시: `OUTLINE_VISIBILITY_DISTANCE * OUTLINE_VISIBILITY_DISTANCE`.

### 4.2 `src/game/types.ts` (leaf) — WorldObject 필드 추가
[types.ts:126](../src/game/types.ts) `interface WorldObject` 에:
```ts
  /** 이 객체에 속한 카툰 아웃라인 메시들(거리 게이트로 토글). 없으면 undefined. */
  outlines?: THREE.Object3D[];
```

### 4.3 `src/game/renderPerformance.ts` (leaf) — 통합 규칙 헬퍼
기존 `shouldShowPerformanceHiddenVisual` 를 재사용하되 거리 항을 더한 단일 판정 함수 추가:
```ts
export function outlineVisibleAtDistance(
  qualityMode: QualityMode,
  sprintRenderOptimized: boolean,
  dist2: number,
  maxDist2: number,
): boolean {
  if (sprintRenderOptimized) return false;
  if (qualityMode !== "high") return false;
  return dist2 <= maxDist2;
}
```
> 기존 `shouldShowPerformanceHiddenVisual`(qualityMode+sprint)과 의미가 일치 + 거리 항만 추가. 둘이 충돌하지 않음(아래 §5).

### 4.4 `src/main.ts` — (a) 아웃라인 per-object 보관
`addCartoonOutlines` ([main.ts:9441](../src/main.ts))가 생성한 아웃라인 배열을 **반환**하도록 변경하고, `addWorldObject`([main.ts:9365](../src/main.ts))에서 생성된 WorldObject 에 할당:
```ts
// addCartoonOutlines: 끝에서 push 한 outline 들을 모아 return THREE.Object3D[]
// addWorldObject: 객체 생성 직후
const outlines = this.addCartoonOutlines(root, type);
if (outlines.length) object.outlines = outlines;   // object = 방금 만든 WorldObject
```
- 대안(필드 추가 없이): 컬링 패스에서 `object.root.traverse(c => c.userData.isCartoonOutline)` 로 매번 수집 → **비추천**(증분 스캔마다 traverse 비용). per-object 배열 보관이 정석.

### 4.5 `src/main.ts` — (b) 컬링 패스에 거리 게이트 삽입 ★핵심
`updateVisibilityCulling` 의 객체 루프([main.ts:2688~2704](../src/main.ts)), 본체 `visible`·`dist2` 계산 직후:
```ts
const dx = object.root.position.x - playerX;
const dz = object.root.position.z - playerZ;
const dist2 = dx * dx + dz * dz;
const visible = dist2 <= distance * distance;
if (object.root.visible !== visible) { object.root.visible = visible; changes += 1; }

// ▼ 추가: 아웃라인 거리 게이트 (본체 보일 때만 의미. 본체 컬링되면 어차피 자식도 미렌더)
if (object.outlines) {
  const wantOutline = visible && outlineVisibleAtDistance(
    this.qualityMode, this.sprintRenderOptimized, dist2, OUTLINE_VISIBILITY_DISTANCE_SQ,
  );
  for (const o of object.outlines) if (o.visible !== wantOutline) o.visible = wantOutline;
}
```
- `changes` 카운터는 **증가시키지 않음**(아웃라인 토글은 값싸므로 패스당 스캔 객체 수를 줄이지 않게). 본체 가시성 변화에만 기존대로 `changes += 1`.
- `dist2` 를 한 번만 계산하도록 기존 `dx*dx+dz*dz` 를 변수화(위 스니펫 반영).

## 5. 기존 토글과의 공존 / 우선순위

| 트리거 | 기존 동작 | 본 설계와의 관계 |
|---|---|---|
| **qualityMode 변경/새 게임** | `refreshTrackedVisualVisibility(outlineVisuals, …)` 가 qualityMode+sprint 로 전 아웃라인 visible 설정(거리 무관) | high 전환 시 잠깐 먼 아웃라인까지 켜졌다가 다음 컬링 패스(≤~0.35s)에 거리로 다시 꺼짐 — 허용. (원하면 전환 직후 컬링 1회 강제) |
| **스프린트** | `sprintHiddenVisuals` 로 전 아웃라인 off | 본 규칙도 `sprintRenderOptimized`면 false → **일치**. 스프린트 해제 시 refresh 가 켜고 컬링이 먼 것 다시 끔 |
| **본체 거리 컬링** | `root.visible=false` 면 자식(아웃라인) 미렌더 | `wantOutline = visible && …` 이라 본체 꺼지면 아웃라인도 false 로 정리(일관성) |
| **런타임 신규 스폰**(NPC·드랍템) | 생성 시 `outline.visible = shouldShowPerformanceHiddenVisual(…)`(거리 무관) | 먼 곳에 스폰되면 다음 컬링 스캔 전까지 잠깐 아웃라인 보임 → 무시 가능(점진적, 본체 컬링과 동일 성질) |

> 결론: 본 거리 게이트는 기존 규칙에 **거리 조건을 AND 로 더하는** 추가 제약이라 충돌 없음. 단일 진실원천은 `outlineVisibleAtDistance`.

## 6. main.ts 크기게이트 전략

- 현재 `MAX_MAIN_LINES` 여유 ≈ 0~1. 본 변경의 main.ts 순증 추정: 컬링 패스 +3~4, addWorldObject 연결 +2, dist2 변수화 ±0 ⇒ **+5~6줄**.
- 처리: **(1)** 상수·타입·헬퍼는 전부 leaf(constants/types/renderPerformance)로 빠져 main.ts 부담 최소화. **(2)** 남는 +5~6 은 `scripts/check-main-size.mjs` 의 `MAX_MAIN_LINES` 를 **ratchet**(사유 주석: "outline distance gating") 하거나, 인근 멀티스테이트먼트 합치기로 상쇄. 다른 세션 작업과 겹치면 **isolated-hunk 커밋**(`git apply --cached` 패턴)으로 내 변경만 분리.

## 7. 튜닝 / 검증

- **튜닝**: `OUTLINE_VISIBILITY_DISTANCE` 기본 85. 낮출수록 절감↑·팝인 거리↑. 마을이 스폰서 ~95m 이므로 85면 스폰뷰의 마을 외곽선 대부분 off, 마을 진입(≤~85m) 시 복귀.
  - (향후 옵션) 타입별 거리: 큰 건물은 길게(~120), 작은 NPC·아이템은 짧게(~55) `outlineVisibilityDistanceForType`. v1 은 단일값으로 단순화.
- **검증(PC, `?debug` HUD)**:
  1. 스폰에서 마을 보는 시야 draws — **적용 전 vs 후** (기대: 먼 마을 아웃라인 수백 draws 감소).
  2. 같은 시야 FPS — 드물던 렉 해소 확인.
  3. **근접 시 외곽선 정상**(육안) — 가까운 집·NPC 아웃라인 그대로.
  4. 스프린트/품질 토글/새 게임 후에도 아웃라인 상태 정상 수렴.

## 8. 리스크 / 롤백

- 리스크: **낮음~중**. 렌더 전용(게임플레이·세이브 무관). 팝인이 거슬리면 거리 상향. 단일 상수+격리된 컬링 분기라 **되돌리기 쉬움**.
- 잠재 이슈: 증분 컬링이라 정지 상태에서 먼 아웃라인이 ~1~2초 뒤 꺼짐(점진). 본체 컬링과 동일 성질 → 허용.

## 9. 적용 순서 (구현 시 체크리스트)

1. constants.ts: `OUTLINE_VISIBILITY_DISTANCE` 추가.
2. types.ts: `WorldObject.outlines?` 추가.
3. renderPerformance.ts: `outlineVisibleAtDistance` 추가.
4. main.ts: `addCartoonOutlines` return 배열화 → `addWorldObject` 에서 `object.outlines` 할당.
5. main.ts: 컬링 루프에 거리 게이트 분기 + `dist2` 변수화 + `OUTLINE_VISIBILITY_DISTANCE_SQ` 캐시 import.
6. `npm run build && npm run verify` (TS·크기게이트). 필요 시 MAX_MAIN_LINES ratchet.
7. 배포 → PC HUD 로 §7 검증 → 거리 튜닝.
8. (선택) 메모리 `yunu-game-mobile-touch` 의 성능 섹션에 "PC 아웃라인 거리게이트" 한 줄 추가.

## 10. 범위 밖(향후 후보)

- **B**: 큰 정적 구조물(집·상점)만 아웃라인 제외 — 효과 크나 스타일 변화.
- **C**: 초소형 디테일 메시 아웃라인 제외 — 무손실, 소폭.
- **C-merge**: 마을 집 간 정적 머지/InstancedMesh — 무손실·대폭, 대수술(생애주기·상호작용 영향 검토 필요).
- 모바일 경량화(디테일 제거·집 수·주민 감축)는 콘텐츠/품질 축소라 **PC 이식 안 함**.
