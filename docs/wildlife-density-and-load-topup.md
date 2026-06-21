# 야생 몹 밀도 상향(2.4/1.5) + 로드 시 탑업(소급) — 상세 설계 (구현 대기)

> 상태: **구현 완료** (2026-06-21). constants.ts(밀도 상수·wildlifePredatorTarget)·main.ts(seedPredators·ensureWildlifeDensity·로드/텔레포트 훅·capMul 단일화). 결정 반영: 포식자만 탑업 / 다른맵 방문 시 보강 O·동굴복귀 X / 배수 2.4·1.5. verify+build+E2E 통과.
> 라인 번호는 동시 작업으로 이동 가능 → **심볼명 기준**. 구현 시작 시 각 지점 재확인 필수.
> 배경 진단: `docs/work-history.md`(시간대×지역 게이트) + memory `yunu-game-map-seeding-and-load-reset`.

## 0. 목표 (사용자 확정)
1. **로드 직후 야생 몹을 현재 목표 밀도까지 즉시 보충(탑업)** — 밀도 상향/균등분포 이전에 저장한 옛 세이브도 소급 적용.
2. **밀도 배수 상향**: 고품질 `2.0 → 2.4`, 저사양 `1.3 → 1.5`.

## 1. 현재 동작(왜 옛 세이브가 듬성한가)
- `restoreSaveData`(main.ts) 는 `resetGameState({ reseed: false })` 후 **저장된 worldState.objects 를 그대로 복원만** 함 → `seedOverworld`(신규 균등·고밀도 시딩)는 **새 게임에서만** 실행, **로드 경로엔 없음**.
- `shouldPersistObject`(saveManager.ts) 가 `wildPredator`/`animal` 을 **저장 대상에 포함** → 옛 분포가 그대로 복원됨.
- 밀도 배수는 **두 곳**에 동일 리터럴(`performance ? 1.3 : 2.0`):
  - `seedOverworld` 의 `ambientMul`(초기 시딩 수) — main.ts:1977
  - 런타임 야간 스폰 틱의 `capMul`(리전 정상상태 캡) — main.ts:3857

## 2. 변경 ① — 밀도 배수 상향 + 단일 소스화

**문제**: 같은 "배수"가 2곳에 중복 리터럴. 따로 바꾸면 시딩과 캡이 어긋나 인구가 한쪽으로 감쇠함. 탑업(아래 ③)도 같은 값을 써야 하므로 **상수로 단일화**한다.

`src/game/constants.ts` 에 추가:
```ts
// 야생 몹 밀도 배수 — 시딩·로드 탑업·런타임 캡이 공유(드리프트 방지).
export const WILDLIFE_DENSITY_MUL_HIGH = 2.4; // 고품질/보통 (구 2.0)
export const WILDLIFE_DENSITY_MUL_PERF = 1.5; // 저사양 (구 1.3)
```
`main.ts` 적용:
- 1977 `const ambientMul = this.qualityMode === "performance" ? WILDLIFE_DENSITY_MUL_PERF : WILDLIFE_DENSITY_MUL_HIGH;`
- 3857 `const capMul = this.qualityMode === "performance" ? WILDLIFE_DENSITY_MUL_PERF : WILDLIFE_DENSITY_MUL_HIGH;`
- import 에 두 상수 추가.

**효과(수치)**:
- 시작맵 시딩 목표: `60 × 2.4 = 144`마리(고품질) / `60 × 1.5 = 90`(저사양). (구: 120/78)
- 야간 틱 리전 캡: 밤 `8×2.4≈19`, 낮 `12×2.4≈29` (구 16/24).
- ※ 시딩 총량(맵 전체)과 캡(리전별)은 스코프가 다르지만, ~5리전×캡 ≈ 시딩 총량 수준이라 정합. 캡이 시딩보다 충분히 커서 초기 인구가 감쇠로 줄지 않음(기존 주석 의도 유지).

## 3. 변경 ② — seedOverworld 의 포식자 시딩 추출(탑업과 공유)

탑업이 **신규 시딩과 100% 동일한 분포·레벨 규칙**을 쓰도록, seedOverworld 의 포식자 루프(main.ts:1977-1985)를 메서드로 추출한다.

```ts
// 현재 맵의 목표 포식자 수(시딩=탑업 공통 기준)
private overworldPredatorTarget(): number {
  const mul = this.qualityMode === "performance" ? WILDLIFE_DENSITY_MUL_PERF : WILDLIFE_DENSITY_MUL_HIGH;
  return Math.round((this.currentWorldMapId === DEFAULT_WORLD_MAP_ID ? 60 : 78) * mul);
}

// count 마리를 맵 전역 균등 분포로 스폰(리전 밖 평원은 최근접 리전 종/레벨). 시딩·탑업 공용.
private seedPredators(count: number) {
  for (let i = 0; i < count; i += 1) {
    const point = this.randomPredatorSpawnPoint(null); if (!point) continue;
    const region = regionAtPosition(point, this.activeRegions) ?? nearestRegion(point, this.activeRegions); if (!region) continue;
    const monsterId = chooseRegionPredatorMonster(region);
    const predator = spawnPredatorEntity(this.entitySpawnContext, point, predatorKindForMonster(monsterId));
    applyPredatorMonsterDefinition(predator, region, monsterId, this.level);
  }
}
```
- seedOverworld 의 해당 블록을 `this.seedPredators(this.overworldPredatorTarget());` 한 줄로 교체.

## 4. 변경 ③ — 로드 시 탑업 `ensureWildlifeDensity()`

```ts
// 현재 오버월드 포식자 수가 목표보다 적으면 차액만큼 즉시 보충(옛 세이브 소급). 멱등.
private ensureWildlifeDensity() {
  if (this.locationMode !== "overworld") return;       // 동굴/집 씬에선 보충 안 함(오버월드 복귀 시 적용)
  if (partyWorldGuestActive()) return;                 // 게스트는 호스트 월드 뷰 — 호스트만 권위
  let have = 0; for (const _p of this.objectsOfType("wildPredator")) have += 1;
  const deficit = this.overworldPredatorTarget() - have;
  if (deficit > 0) this.seedPredators(deficit);
}
```

**훅 위치**: `restoreSaveData` 의 **끝부분**(오버월드 오브젝트 복원 + locationMode 복원 완료 후)에서 호출.
```ts
// restoreSaveData 말미, locationMode/cave·house 진입 처리 이후:
this.ensureWildlifeDensity();
```
- `locationMode==="overworld"` 게이트가 메서드 내부에 있으므로, 동굴/집 상태로 저장된 세이브는 자동 skip.

## 5. 엣지/정합성
1. **파티 게스트**: 탑업 skip(호스트 권위). 야간 틱도 동일 게이트라 일관.
2. **동굴/집 상태로 저장된 세이브**: 로드 시 `locationMode≠overworld` → 탑업 skip. **권장 보강**: `leaveCave()`/`leaveHouse()`(오버월드 복귀) 끝에 `ensureWildlifeDensity()` 1줄 추가 → 복귀 즉시 보충. (오버월드 오브젝트가 동굴 중 어떻게 보존되는지 구현자가 확인 후 배선.)
3. **다른 맵**: 로드는 현재 맵만 보충. 이미 방문한(저장된) 다른 맵은 `teleportToWorldMap` 복원 분기 끝에서 `ensureWildlifeDensity()` 호출하면 소급(권장 확장, v1 선택).
4. **멱등/과스폰 방지**: deficit≤0 이면 no-op. 최근 세이브(이미 목표치)는 변화 없음.
5. **분포 과밀 우려 없음**: 탑업도 `randomPredatorSpawnPoint(null)`(맵 전역 랜덤)이라 신규 시딩과 동일 분포. 리전 캡은 야간 틱이 별도 유지(탑업이 캡을 넘겨도 틱이 그 리전엔 추가만 안 함 — 신규 게임 시딩과 동일 동작).
6. **세이브 스키마 영향 없음** — 런타임 보충일 뿐 저장 포맷 불변. (다음 저장 때 늘어난 몹이 worldState 에 같이 저장됨 → 이후 로드는 deficit 0.)

## 6. 성능 주의 (★work-history watch item)
- 배수 +20%(고품질)·+15%(저사양)로 **상시 밀도 자체가 올라감** → draw call/가시 메시 증가. 모바일(저사양) 특히 주의.
- 탑업은 옛 듬성 세이브 로드 시 **최대 ~144마리(차액)를 한 번에 스폰** = 신규 게임 시딩과 동일 비용(이미 배포된 부하). 일회성 스파이크.
- **구현 후 `perf-check`(가능하면 모바일 실측) 필수.** 과하면 배수를 2.2/1.4 등으로 미세 하향.

## 7. main.ts 라인 예산
- 신규 메서드 3개(overworldPredatorTarget·seedPredators·ensureWildlifeDensity) + 호출 ~2 → 약 +10~13줄. seedOverworld 블록 추출로 일부 상쇄(~ -5).
- 예산(check-main-size) 여유가 작으니 **import 압축 등으로 순증분 흡수**하거나, 부담되면 시딩 헬퍼를 leaf(`game/wildlifeSeeding.ts`, context 주입)로 추출. (단 entitySpawnContext·activeRegions·randomPredatorSpawnPoint 의존이라 leaf 추출은 컨텍스트 배선 비용 있음 → v1 은 main.ts 내 + 라인 흡수 권장.)

## 8. 미결 결정 (구현 전 확인)
1. **동물(소/돼지 등)도 탑업?** — 사용자 요청은 "몹"(포식자). v1 포식자만. 동물 herd 도 원하면 `seedPredators` 패턴으로 별도 추가(선택).
2. **다른 맵 소급(§5-3)·동굴복귀 보강(§5-2)** 포함 범위 — 권장: 둘 다 포함(1줄씩). 최소면 로드 현재맵만.
3. **배수 최종치** — 2.4/1.5 확정. perf-check 결과 과하면 하향 여지.

## 9. 검증 계획 (구현 후)
- **골든/유닛**: `overworldPredatorTarget()` 공식(고품질 60×2.4=144, 저사양 90; dragon_lands 78×2.4) 단위 검증.
- **E2E(window.__wildernessGame)**:
  - 옛 세이브 흉내: 오버월드 포식자를 일부만 둔 상태에서 `g.ensureWildlifeDensity()` 호출 → `objectsOfType('wildPredator')` 수가 목표치와 일치.
  - 이미 목표치면 호출해도 불변(멱등).
  - `g.qualityMode='performance'` 시 목표=×1.5 적용 확인.
  - 게스트(partyWorldGuestActive 모킹) 시 skip 확인.
- **perf-check** 전후 비교(밀도 +20%·탑업 스파이크). 모바일 실측 권장.
- `npm run verify` + `build` 녹색, main.ts 예산 준수.
