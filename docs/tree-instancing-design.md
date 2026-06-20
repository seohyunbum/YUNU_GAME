> ⚠️ **우선순위 주의 (2026-06-19 측정 기반)**: 본 설계는 유효하나, 드로우콜 규명 결과 **나무는 스폰뷰 draws 의 1~2%뿐**(이미 그루당 1 draw + 235m 컬링)이라 **ROI 가 낮음**. 진짜 병목은 크리처·NPC(미머지 15~22메시 × 아웃라인 ×2 + 접지그림자, 6150 의 70~80%). 따라서 **나무 InstancedMesh 는 후순위**, 크리처/NPC 최적화(아웃라인 게이트=PC / 메시 머지·접지그림자 인스턴싱=모바일)가 선행 권장. 본 문서는 추후 나무 작업 착수 시 참조용.

---

# 나무 InstancedMesh 정밀 설계서

> 대상: `C:\ai-game-lab` (Bash `/c/ai-game-lab`, branch `master`). Three.js + Vite + TS 1인칭 오픈월드.
> 베이스라인: PC 고화질 스폰 뷰 ≈ 6,150 draws/frame ≈ 가시메시 수(객체당 draw 1, 배칭 거의 없음). `docs/perf-measurement.md` 참조.
> 본 문서는 `docs/tree-instancing-design.md` 로 그대로 저장될 구현 지침이다. 모든 인용은 file:line.

## 0. 목표 / 비목표

### 목표
- 나무(`smallTree` 78% + `bigTree` 22%, 월드 1144 + 수동 10그루)의 **시각 렌더를 InstancedMesh 로 배칭**해 나무 가시 draw 를 "그루 수"에서 "타입×서브지오메트리 수(상수)"로 축약.
- **화질 무손실**: 현재 정점색(`paintGeometry` main.ts:6248) 기반 외형을 비트 단위로 유지. 색은 머티리얼이 아니라 정점색이라 InstancedMesh 1개로도 모든 색 차이가 그대로 표현됨.
- **거리 컬링 유지**: 현행은 그루별 `object.root.visible` 토글(main.ts:2685-2699, 235m). 인스턴싱 후에는 **청크 단위 InstancedMesh** 로 거리 컬링을 유지(`registerDistanceCulledVisual` renderPerformance.ts:82 재사용).
- **정합성 최우선**: 벌목 시 유령 나무 0, 세이브/로드/월드맵 전환 복원 무손상, 리스폰(나무는 미해당) 영향 0.
- **게임로직 0수정**: 충돌·레이캐스트·`this.objects` 맵·spatial 버킷은 **현행 per-tree WorldObject 그대로**. 시각만 InstancedMesh 로 분리하는 하이브리드.

### 비목표
- 충돌/레이캐스트/objects 맵 구조 변경 — 하지 않음.
- bigTree/smallTree 외 타입(크리처·NPC) 인스턴싱 — 본 설계 범위 밖(ROI 섹션 참조).
- 메모리 회수 최적화 — 나무 지오메트리는 이미 공유(`treeVertexMaterial` main.ts:380), 인스턴스 dispose 불가는 무관.

---

## 1. 현행 구조 (근거)

### 1.1 한 그루 = scene draw 1개
`spawnTree(type, position)` (main.ts:8022-8079):
1. `geometries[]` 를 `mergeGeometries` 로 합친 **단일 `THREE.Mesh`** (main.ts:8064), 공유 `this.treeVertexMaterial` (main.ts:380, `gameMaterial(0xffffff, {vertexColors:true})`). 색은 전부 정점색(`paintGeometry` main.ts:6248-6255 가 geometry 마다 `color` attribute 채움).
   - **smallTree** (8047-8062): trunk(Cylinder) + leaf(Sphere) + highlight(Sphere) + 꽃 3개(Sphere). = 6 sub-geometry.
   - **bigTree** (8033-8046): trunk + lowerLeaves/upperLeaves/brightEdge(Cone×3) + lowGlow(Sphere). = 5 sub-geometry.
   - size 스케일은 타입 상수(small 1.92, big 2.28, main.ts:8025), **변이 없음**.
2. `markVisualOnly(group)` (8066 → main.ts:6242): 시각 메시 전체 `userData.skipRaycastTarget=true` → addWorldObject 의 raycast 등록 루프(main.ts:9353)에서 제외.
3. invisible 레이캐스트 타겟 `interactionTarget` Cylinder 1개 (main.ts:8067-8072, `invisibleTargetMaterial` colorWrite:false main.ts:381). 실제 클릭/조준 타겟. `shouldHideInvisibleMeshFromRender` (renderPerformance.ts:129) 로 `visible=false` 지만 `raycastTargets` 에 등록됨.
4. `group.position.copy(position)` (8073) → `addWorldObject(type, name, group, {collidable, collisionRadius: big 2.55/small 1.55, collisionHeight: big 9.5/small 4.45})` (8074-8078).

핵심: 나무 = (합쳐진 가시 Mesh 1) + (invisible 레이캐스트 Cylinder 1) Group 1개 = scene draw 1개. 나무는 **아웃라인 제외**(`shouldOutlineType` 에서 smallTree/bigTree 제외, main.ts:9397권역) + **접지그림자 제외**(`shadowOptionsForType` noShadowTypes 에 포함, main.ts:9380-9391) → 그루당 정확히 draw 1, ×2 아님.

### 1.2 스폰 루프 (회전/스케일 변이 0)
`seedOverworld()` (main.ts:1884):
- main.ts:1891 `for i < Math.round(1144 * (mapDef.treeScale ?? 1))` → `spawnTree(Math.random()<0.78 ? "smallTree":"bigTree", this.randomGroundPoint())`. 약 78% small / 22% big.
- 고정 small 8그루(1892-1904) + 고정 big 2그루(1905-1906).
- **rotation/추가 scale 적용 없음**. 모든 나무 yaw=0, 타입별 동일 크기 → 인스턴스 행렬은 position 만 다르고 rotation=0·scale=1.
- `randomGroundPoint()` (main.ts:9578)은 마을·안전지대·물 회피 지상점(y=`getGroundHeightAt`).

### 1.3 addWorldObject — 인스턴싱 후에도 보존해야 할 의존
`addWorldObject` (main.ts:9343-9377):
- `WorldObject = {id:`${type}-uuid`, type, name, root:Group, ...extra}` (9362), `this.objects.set` (9363), `objectIdsByType` (9364-9369).
- `registerSpatialObject(object)` (9370): spatial 버킷(main.ts:364)에 `root.position` 기준 등록. **충돌(main.ts:3206/3539/5452), `objectsNear` 질의가 전부 이 버킷 + `object.root.position` 의존**.
- `raycastTargetsByObject.set(id, raycastMeshes)` (9371) + `raycastTargets.push` (9357). 나무는 invisible Cylinder 1개만 등록.

> **불변식**: `object.root.position` 만 살아있으면 spatial·충돌·거리컬링(현행 visibility cull)·복원이 그대로 동작. 따라서 시각 Mesh 만 InstancedMesh 로 빼고, root 는 **invisible Cylinder 1개만 담은 경량 Group** 으로 남긴다.

### 1.4 벌목 / 제거
`harvestSmallTree` (main.ts:4189-4203) → 완료 시 `removeObject(target.id)` (4200). `harvestBigTree` (4205-4223) → `removeObject` (4220). 조준 raycast(main.ts:5435권역)가 invisible interactionTarget 적중 → `findObjectId`(userData.objectId 부모 탐색) → `objects.get`.

`removeObject` (main.ts:9520-9542):
1. 리스폰 큐 — 나무 타입 **제외**(9525, wildPredator/jammini/village* 만).
2. `scene.remove(object.root)` (9528).
3. `objects.delete` + `objectIdsByType.delete` (9529-9530).
4. `unregisterSpatialObject` (9531).
5. `raycastTargetsByObject.delete` (9532) + `raycastTargets` splice (9538-9540).
6. `disposeObject3D(object.root)` (9541) — geometry dispose, 단 `sharedMaterials`/`sharedGeometries` WeakSet/Set 가드(main.ts:393-401, 6098-6106)로 공유 자산 보존.

### 1.5 리스폰 / 세이브 / 복원
- 나무는 `respawnQueue` 미진입(영구 제거). 처리 루프(main.ts:3668권역)도 무관.
- 직렬화 `createSavedWorldState` (saveManager.ts:122): 그루별 `SavedObject` — `position=toSavedVector(object.root.position)` (138), `harvestProgress` (172), `rotationY=object.root.rotation.y` (187, 현재 항상 0).
- 복원 `restoreWorldObject` (main.ts:6131) → smallTree/bigTree 면 `spawnTree(savedObject.type, position)` (6136). 월드맵 전환 복원도 동일 경로. → **spawnTree 가 신규·복원 공통 진입점**.

### 1.6 기존 InstancedMesh 패턴 (이 repo 의 정본 템플릿)
`biomeDecor.ts` 가 이미 정확한 패턴을 확립했다 — **이를 그대로 따른다**:
- 지오메트리/머티리얼 조합당 `THREE.InstancedMesh(geo, mat, count)` 1개(biomeDecor.ts:40-47).
- `dummy = new THREE.Object3D()` → position/quaternion/scale 설정 → `dummy.updateMatrix()` → `mesh.setMatrixAt(i, dummy.matrix)` (biomeDecor.ts:55, 94).
- `finalizeInstances(...meshes)` (biomeDecor.ts:110-115): `instanceMatrix.needsUpdate=true` + `computeBoundingSphere()`.
- `markBiomeDistanceCull` (biomeDecor.ts:117-121) 로 `userData.distanceCull{CenterX,CenterZ,Radius}` 직접 세팅 후 `addBiomeMesh` → `registerDistanceCulledVisual` (main.ts:8002-8006).

거리 컬링 엔진: `updateDistanceCulledVisuals(visuals, playerPos, fogFar)` (renderPerformance.ts:103-127). `userData.distanceCull*` 구(球) 기준 `visual.visible` 토글. 매 프레임 `updateVisibilityCulling` 에서 `this.biomeMeshes`·`this.mountainMeshes` 에 대해 호출(main.ts:2700-2702, fogFar).

---

## 2. 아키텍처

### 2.1 신규 모듈 — `src/game/treeInstances.ts` (leaf, main.ts 크기게이트 회피)
main.ts 크기게이트 여유가 적으므로(MEMORY: main.ts 크기게이트 여유0→배선 인라인), **인스턴스 풀·매트릭스 계산·청크 관리는 신규 leaf 파일** `src/game/treeInstances.ts` 로 분리. main.ts 에는 호출 배선만 최소 인라인.

이 모듈이 소유하는 것:
- 청크 그리드(chunk = 청크 좌표 → 청크별 InstancedMesh 세트).
- 인스턴스 풀 / free-list (슬롯 재사용).
- `instanceRef ↔ WorldObject.id` 양방향 매핑.
- 빌드/해제/벌목숨김/세이브복원 API.

### 2.2 타입별 × 서브지오메트리별 InstancedMesh
- 현재 spawnTree 는 sub-geometry 들을 `mergeGeometries` 로 1메시화. InstancedMesh 는 인스턴스 단위로 머지 메시를 그대로 쓸 수 있으므로 **타입당 머지된 단일 지오메트리 1개 → InstancedMesh 1개**가 가능(권장 P1).
  - `smallTreeGeometry` = smallTree 의 6 sub-geometry 를 `paintGeometry` 후 `mergeGeometries` (= spawnTree 8047-8064 의 시각 부분만 추출, position 미적용 원점 기준).
  - `bigTreeGeometry` = bigTree 의 5 sub-geometry 머지(8033-8064).
  - 머티리얼: 기존 `treeVertexMaterial`(main.ts:380) **그대로 공유**. 정점색이 머지 지오메트리에 굳어 있으므로 InstancedMesh 1개로 무손실.
- **청크 분할**: 거리 컬링을 유지하려면 InstancedMesh 1개가 너무 크면 안 됨(전부-or-전무 컬링이 됨). 월드를 고정 격자(예: 48×48m 청크, ground 96×96 기준 약 2×2~4×4)로 나누고 **(청크, 타입)당 InstancedMesh 1개**. 즉 draw 수 = 활성 청크수 × 2(타입). 청크당 max 인스턴스 count 는 여유 있게(예: 256) 잡고 부족 시 청크를 더 잘게.
  - 청크 중심·반경을 `userData.distanceCull{CenterX,CenterZ,Radius}` 로 세팅(biomeDecor.ts:117-121 패턴) → `registerDistanceCulledVisual` 스킵(이미 세팅돼 있으면 early-return, renderPerformance.ts:83-89) → `updateDistanceCulledVisuals` 가 청크 단위로 visible 토글.

### 2.3 인스턴스 풀 / free-list (벌목·복원 슬롯 재사용)
청크별 타입별로:
```ts
interface TreeChunkSlot {
  mesh: THREE.InstancedMesh;        // (chunk,type) 의 InstancedMesh
  capacity: number;                  // 생성 시 count 상한
  count: number;                     // 현재 활성 슬롯 수 (= mesh.count)
  free: number[];                    // 회수된 슬롯 index 스택 (free-list)
  slotToObjectId: (string | null)[]; // index → WorldObject.id (null=빈슬롯)
}
```
전역 매핑:
```ts
// WorldObject.id → 인스턴스 위치
const treeInstanceRef = new Map<string, { chunkKey: string; type: "smallTree"|"bigTree"; index: number }>();
```
> `WorldObject` 에 필드를 추가하지 않고 모듈-로컬 Map 으로 유지(게임로직 0수정 원칙). 단 정합성을 위해 `removeObject`/복원에서 이 Map 을 동기화하는 배선만 main.ts 에 인라인.

### 2.4 root 경량화 (시각 분리)
spawnTree 가 만들던 시각 Mesh 를 **root 에서 제거**하고 InstancedMesh 풀에 인스턴스로 추가. root Group 에는 **invisible interactionTarget Cylinder 1개만** 남긴다. `markVisualOnly` 는 더 이상 시각 Mesh 가 없으므로 사실상 no-op(호출 유지 무해). root.position 은 그대로 → spatial/충돌/복원/save(`object.root.position`, `object.root.rotation.y`) 전부 불변.

---

## 3. 핵심 동작 의사코드

### 3.1 인스턴스 추가 (spawnTree 의 시각 부분 대체)
```ts
// treeInstances.ts
function addTreeInstance(type, position, yaw = 0): { chunkKey, index } {
  const chunkKey = chunkKeyFor(position.x, position.z);
  const slot = ensureChunkSlot(chunkKey, type); // 없으면 InstancedMesh 생성 + scene.add + distanceCull userData + registerDistanceCulledVisual + trees.push(mesh)
  let index = slot.free.pop();
  if (index === undefined) {
    if (slot.count >= slot.capacity) { /* 청크 분할 또는 capacity 확장: 새 InstancedMesh 생성 */ }
    index = slot.count++;
    slot.mesh.count = slot.count; // count 갱신
  }
  dummy.position.copy(position);
  dummy.rotation.set(0, yaw, 0);  // yaw 변이는 P3 옵션
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  slot.mesh.setMatrixAt(index, dummy.matrix);
  slot.mesh.instanceMatrix.needsUpdate = true;
  slot.mesh.computeBoundingSphere(); // 컬링 정확도 (배치 빌드 시엔 마지막에 1회)
  slot.slotToObjectId[index] = /* caller 가 WorldObject 생성 후 채움 */ null;
  return { chunkKey, index };
}
```

### 3.2 spawnTree 리팩터 (신규 + 복원 공통 진입점)
spawnTree 시그니처에 `yaw=0` 추가(복원 시 `savedObject.rotationY` 전달 가능하게):
```ts
private spawnTree(type, position, yaw = 0) {
  const group = new THREE.Group();
  // 시각 Mesh 생성/추가 삭제 → InstancedMesh 로
  const interactionTarget = new THREE.Mesh(/* 기존 8067-8072 그대로 */);
  interactionTarget.position.y = isBig ? 2.9 : 1.6;
  group.add(interactionTarget);
  group.position.copy(position);
  group.rotation.y = yaw; // save(rotationY) 일관성
  const object = this.addWorldObject(type, name, group, {/* collidable 등 8074-8078 그대로 */});
  const ref = addTreeInstance(type, position, yaw); // 시각 인스턴스
  treeInstanceRef.set(object.id, { ...ref, type });
  setSlotObjectId(ref, object.id);
  return object;
}
```
> `addWorldObject` 안의 `addCartoonOutlines`/`addContactShadow` 는 나무가 이미 제외 타입이라 invisible Cylinder 만 남은 root 에 영향 없음. `mergeStaticMeshes` 도 smallTree/bigTree 가 `shouldMergeStaticType` 비대상이라 무관.

### 3.3 벌목 — 인스턴스 숨김 (swap-and-pop 권장)
`removeObject` (main.ts:9528) 에서 `scene.remove(object.root)` 직전/직후에 시각 인스턴스 회수 배선 인라인:
```ts
// main.ts removeObject 내, 나무 타입일 때
if (object.type === "smallTree" || object.type === "bigTree") {
  releaseTreeInstance(object.id); // treeInstances.ts
}
```
`releaseTreeInstance` 두 가지 전략:

**(A) zero-scale 숨김 (단순·안전, 권장 P2 초기)**
```ts
function releaseTreeInstance(id) {
  const ref = treeInstanceRef.get(id); if (!ref) return;
  const slot = slots[ref.chunkKey][ref.type];
  dummy.position.set(0,0,0); dummy.scale.set(0,0,0); dummy.updateMatrix();
  slot.mesh.setMatrixAt(ref.index, dummy.matrix); // 0스케일=비가시
  slot.mesh.instanceMatrix.needsUpdate = true;
  slot.slotToObjectId[ref.index] = null;
  slot.free.push(ref.index); // 슬롯 재사용 큐
  treeInstanceRef.delete(id);
}
```
- 장점: index 안정 → 매핑 단순, 유령나무 0(0스케일은 GPU 가 컬). count 미감소(빈 슬롯 잔존, 정점셰이더 비용 미세).
- free-list 로 다음 추가가 빈 슬롯 재사용 → 풀 비대화 방지.

**(B) swap-and-pop (밀집 유지, P4 선택)**
마지막 활성 슬롯을 회수 슬롯으로 이동하고 `count--`. swap 된 그루의 `treeInstanceRef` index 를 갱신해야 함. 더 빠르지만 매핑 갱신 정합성 위험 → A 로 검증 후 필요 시 전환.

> **세이브 정합**: 벌목된 나무는 `removeObject` 가 `objects.delete` → `createSavedWorldState` 가 `this.objects` 만 직렬화하므로 저장 안 됨(영구 반영). 인스턴스 숨김과 무관하게 정합 유지.

### 3.4 세이브 복원 / 월드맵 전환 — 일괄 재구성
복원은 `restoreWorldObject` (main.ts:6136) 가 그루별 `spawnTree` 호출 → 위 3.2 리팩터로 자동으로 인스턴스 풀에 들어감. 단 **성능을 위해 배치 빌드**:
- 복원 시작 전 `beginTreeBatch()` 호출 → addTreeInstance 가 `instanceMatrix.needsUpdate`/`computeBoundingSphere` 를 매 그루 호출하지 않고 deferred.
- 복원 끝 `endTreeBatch()` → 청크별로 `finalizeInstances(...)` 1회(biomeDecor.ts:110 패턴).
- 월드맵 전환 시 기존 청크 InstancedMesh 전부 해제(`disposeTreeInstances()`: scene.remove + geometry.dispose, **treeVertexMaterial 은 sharedMaterials 가드라 미dispose**) 후 재빌드.

복원 시 `spawnTree(savedObject.type, position, savedObject.rotationY ?? 0)` 로 yaw 전달 → 인스턴스 yaw 복원.

### 3.5 거리 컬링
- 청크 InstancedMesh 를 `this.treeInstanceMeshes` (신규 배열) 에 push 하고, 매 프레임 `updateVisibilityCulling` (main.ts:2700권역)에 `updateDistanceCulledVisuals(this.treeInstanceMeshes, this.playerPosition, 235)` 한 줄 추가(나무 컬링 거리 235m = `visibilityDistanceForType` main.ts:2711 와 동일).
- **충돌/spatial 컬링은 현행 그대로**: per-tree WorldObject 의 visibility cull(main.ts:2685-2699)은 root(invisible Cylinder)에 적용되나 어차피 colorWrite=false 라 렌더 영향 0, spatial/충돌 로직은 visible 과 무관(position 기반). 즉 게임로직 0수정.

---

## 4. 정합성 / 위험 / 롤백

| 위험 | 원인 | 방어 |
|---|---|---|
| **유령 나무**(벌목했는데 시각 잔존) | `removeObject` 가 root 만 제거, 인스턴스 미회수 | removeObject 에 `releaseTreeInstance` 배선 필수. P2 검증: 벌목 직후 해당 좌표 시각 0 확인 |
| **세이브 깨짐** | 인스턴스 index 를 save 에 넣으면 재구성 시 불일치 | **index 를 save 하지 않음**. save 는 현행 `position`/`rotationY`/`harvestProgress` 그대로. 인스턴스는 복원 시 position 으로 재구성 |
| **복원 중복/누락** | spawnTree 가 신규·복원 공통이라 양쪽서 인스턴스 추가 | 단일 진입점 유지 + `treeInstanceRef` 로 id당 1슬롯 보장. 월드맵 전환 시 `disposeTreeInstances` 선행 |
| **free-list 인덱스 꼬임** | swap-pop 매핑 갱신 누락 | P2 는 zero-scale(A)만 사용(index 불변). swap-pop(B)은 P4 별도 검증 후 |
| **청크 capacity 초과** | 한 청크에 나무 밀집 | capacity 256 여유 + 초과 시 보조 InstancedMesh 생성 경로. P1 에서 실측 분포 확인 |
| **거리컬링 거칠어짐**(청크 통째 깜빡임) | 청크가 너무 큼 | 청크 48m + DISTANCE_CULL_MARGIN(renderPerformance.ts:122) 로 경계 완화. 너무 거칠면 24m 로 |
| **머티리얼 dispose** | 월드맵 전환 dispose 시 treeVertexMaterial 파괴 | `sharedMaterials` WeakSet(main.ts:393)에 이미 포함 → 가드됨. geometry 는 신규라 dispose OK |

**롤백**: 신규 leaf 모듈 + spawnTree 의 분기 1곳 + removeObject 배선 1곳 + 컬링 1줄. 기능 플래그(`USE_TREE_INSTANCING`)로 감싸 spawnTree 가 구 경로(시각 Mesh 를 group 에 add, main.ts:8064-8065)로 폴백 가능하게 두면 단계별 롤백 안전.

---

## 5. 단계별 구현 계획 (P0~P5, 각 단계 검증)

### P0 — 측정 베이스라인 고정 (코드 변경 0)
- `docs/perf-measurement.md` A절 절차로 PC 고화질 스폰 뷰 dpf 기록(현재 ≈6150).
- **나무 보는 쪽 vs 하늘 보는 쪽** dpf 차이 측정 → 나무+지형 기여분 확정(설계 ROI 근거). `?touch=1` 모바일 dpf 도 기록.
- 검증: 베이스라인 수치 문서화. **이 차이가 작으면 나무 ROI 재평가**(ROI 섹션).

### P1 — 인스턴스 풀 모듈 + 신규 스폰만 인스턴싱 (벌목/복원 미변경)
- `src/game/treeInstances.ts` 작성: 청크 그리드 + (chunk,type) InstancedMesh + free-list + 매핑.
- `smallTreeGeometry`/`bigTreeGeometry` 머지 빌더(spawnTree 8033-8064 시각부 추출, paintGeometry 동일).
- spawnTree 리팩터(3.2): 시각 Mesh 제거, addTreeInstance 호출, root=invisible Cylinder만.
- `USE_TREE_INSTANCING` 플래그.
- 검증: 새 게임 스폰 → 나무 외형 동일(스크린샷 비교, 무손실 확인) + dpf 측정. **dpf 가 베이스라인 대비 나무 기여분만큼 하락**해야 성공. 충돌(나무에 막힘)·조준(나무 클릭 식별) 정상 확인.

### P2 — 벌목 인스턴스 회수 (zero-scale + free-list)
- `removeObject` (main.ts:9528권역)에 나무 분기 `releaseTreeInstance` 배선.
- 검증: 작은/큰 나무 벌목 → **시각 즉시 소멸(유령 0)**, 나무 아이템 획득, 같은 자리 재스폰 시 free 슬롯 재사용(메모리 비대 X). 인접 나무 미영향.

### P3 — yaw 변이 (화질↑, draw 0 추가) [선택]
- spawnTree 신규 경로에서 `yaw = randomYaw()` 부여, save `rotationY` 에 반영(이미 `object.root.rotation.y` 직렬화). 복원은 P4 에서.
- 검증: 나무 회전 다양성 시각 확인, dpf 불변(InstancedMesh 라 draw 미추가).

### P4 — 세이브/로드 + 월드맵 전환 복원 일괄 재구성
- `restoreWorldObject` (main.ts:6136) → `spawnTree(type, pos, savedObject.rotationY ?? 0)`.
- `beginTreeBatch`/`endTreeBatch` 로 복원 배치 최적화. 월드맵 전환 시 `disposeTreeInstances` 선행.
- 검증: 나무 일부 벌목 → 저장 → 로드 → **벌목분 미복원·생존분 위치/회전 정확**. 월드맵 전환 왕복 후 나무 정상(중복·누락 0), dpf 복원 후에도 낮음. `harvestProgress` 보존 확인.

### P5 — swap-and-pop 밀집화 [선택, ROI 측정 후]
- zero-scale 빈 슬롯의 정점셰이더 비용이 측정상 유의미할 때만. 매핑 갱신 단위 테스트 필수.
- 검증: 대량 벌목 후 count 가 실제 활성 수와 일치, 유령 0, 매핑 무결.

---

## 6. 측정 검증 (before/after)
- 도구: `scripts/perf-probe.js` (docs/perf-measurement.md). `window.__perfSnapshot()` / `window.__perf`.
- before: P0 베이스라인 dpf(스폰 뷰, 나무 보는 쪽).
- after(P1·P2): 동일 스폰 시드·동일 카메라 각도에서 dpf 재측정. 기대: 나무 draw 가 "가시 그루 수(40~120)"에서 "활성 청크수 × 2"로 축약. 컬링 차이 보정 위해 **나무 보는 쪽 - 하늘 보는 쪽** delta 의 before/after 비교가 가장 깨끗.
- 모바일(`?touch=1`): 나무는 아웃라인/그림자 비대상이라 PC=모바일 기여 동일 → dpf 절대 감소량 동일하게 나와야 함.
