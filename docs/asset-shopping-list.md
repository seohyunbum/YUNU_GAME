# 에셋 추가 목록 (사용자 작업) — 거점 배경 · 지도 마커/깃발

> 2026-07-17 조사. 각 항목을 **실제 브라우저로 열어** 가격·라이선스·UE 버전·데모맵 포함 여부를 대조했다(Fab 은 WebFetch 를 403 차단해 봇으로는 검증 불가 — 403 을 링크 사망으로 오판 금지).
> 코드는 이미 준비돼 있다: 팩을 넣으면 `WCCityDiorama.cpp` 의 `DioramaTable()` 에 **한 줄만 추가**하면 그 지역 거점이 해당 배경으로 바뀐다. 팩이 없는 지역은 자동으로 동양 마을 폴백이라 게임은 항상 돈다.

## ⚠ 먼저 — 기간 한정 (놓치면 유료)

| 팩 | 마감 | 비고 |
|---|---|---|
| **Stylized Village** (Hivemind) — [Fab](https://www.fab.com/listings/587858fc-892c-4594-a5e0-3d243b00531d) | **2026-07-28 22:59 KST (약 11일)** | 정가 유료 → -100%. **기간 내 "내 라이브러리에 추가"만 눌러두면 영구 보유.** 지금 클레임 권장 |

> **Fab 무료는 2주 로테이션**이라 하드코딩 목록은 금방 썩는다. 조사 중 검색에 뜬 무료 팩 2개가 이미 만료였다(하나는 3일 전 만료). 아래 "상시무료(Permanent)" 항목만 안심하고, 한정 항목은 위 표대로 지금 받아두는 게 안전하다.

## 1. 거점 배경 — 지역별 (Fab, 런처에서 "프로젝트에 추가")

| 지역 (거점) | 팩 | 가격 | UE | 데모맵 | 비고 |
|---|---|---|---|---|---|
| 동아시아 (한성·베이징·교토) | **Stylized Eastern Village** ✅보유중 | 상시무료 | 5.0–5.7 (5.8에서 동작 확인) | ✔ | 현재 기준점. 무료 대체재 없음 — 이걸로 계속 커버 |
| 중동 (카이로·바그다드) | **[Stylized Egypt](https://www.fab.com/listings/c935ca3e-dbb1-4b7d-a080-65de129c60bd)** | 상시무료 | 5.0–5.7 → **stub 우회 필요** | ✖ 미명시 | ★1순위. **현재 팩과 동일 제작자**(AleksandrIvanov) → 톤·머티리얼이 자동 일치, 이질감 리스크 0 |
| 유럽 (파리·로마) | **[FANTASTIC – Village Pack](https://www.fab.com/listings/52529a12-e88e-41a0-8834-b87306f20c24)** | 상시무료 | **5.8 정식** → 우회 불필요 | ✔ 명시 | ★1순위. 452메시, 데모신 포함 = 우리 로드 방식에 즉시 부합 |
| 유럽 (대안/병행) | **[Stylized Village](https://www.fab.com/listings/587858fc-892c-4594-a5e0-3d243b00531d)** (Hivemind) | **⚠한정 07-28** | **5.8 정식** | ✔ 1x1km 완성맵 | 완성도 높음. 무료인 동안 받아두고 위와 비교 |
| 아메리카 (뉴욕) + 시드니 | **[Assetsville Town](https://www.fab.com/listings/fd558d8c-bd7e-461f-8449-a7cc9c277078)** | 상시무료 | 5.0–5.7 → **stub 우회** | ✔ 명시 | ★현대도시 유일한 제대로 된 무료 팩. 800+ 모델. **단 검증 결과 "저폴리 만화풍 소도시"** — 뉴욕 마천루 기대는 금물 |
| 중동 (보완) | [Desert Castle](https://www.fab.com/listings/178c1ed7-b5e8-4768-8a86-da3af516778b) | 무료(CC BY — **크레딧 필요**) | **5.5 단독** → 우회 리스크 큼 | ✖ | 바그다드를 카이로와 구분하고 싶을 때만. 우선순위 낮음 |
| 오세아니아 | ~~Rural Australia~~ | 무료 | 5.0–5.4 | ✔ | **비추천** — 포토리얼이라 스타일라이즈드 톤과 충돌, 게다가 시드니=도시인데 팩은 시골. 시드니는 Assetsville 로 |

**stub 우회** = 이미 해본 방법. `AssetGrab57`(EngineAssociation 5.7) 스텁 프로젝트로 받아서 `Content/<팩>` 폴더를 우리 프로젝트로 복사. 현재 쓰는 Eastern Village 가 **5.7 태그인데 5.8에서 정상 동작 중**이라 같은 태그 팩들도 통한다는 실증이 있다.

### 추천 순서
1. **FANTASTIC – Village Pack** (유럽, 5.8 정식 → 마찰 0)
2. **Stylized Egypt** (중동, 동일 제작자 → 톤 일치)
3. **Assetsville Town** (뉴욕·시드니)
4. (시간되면) **Stylized Village** — 07-28 전에 라이브러리 추가만

## 2. 지도 마커·깃발 (CC0 — 다운로드만, 계정 불필요)

현재 지도 마커·깃발은 엔진 기본 도형(실린더·콘)이라 허접하다. 아래로 교체한다.

| 용도 | 팩 | 라이선스 | 비고 |
|---|---|---|---|
| **깃발/배너** | **[Kenney Castle Kit](https://kenney.nl/assets/castle-kit)** | CC0 | 성벽·타워·성문·공성무기 + **깃발 포함**(제작자 명시). 2.2MB. FBX/glTF |
| **세력색 틴트용** | **[Quaternius Ultimate RPG Pack](https://quaternius.com/packs/ultimaterpg.html)** | CC0 | **텍스처 없음(무지 베이스)** = 머티리얼 컬러 파라미터만 꽂으면 세력색이 바로 먹는다. 아틀라스 UV 씨름 불필요 |
| 거점 등급 마커 | [Kenney Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 | 타워 38개가 **모듈러 적층**(base→bottom→middle→top→roof) → 소도시/요새/대성 계층 표현 가능. **단 검증 결과 성·요새 메시는 없음**(적 유닛이 UFO인 SF 팩) |

> **검증에서 걸러진 것**: Ultimate RPG Pack 에는 **깃발이 없다**(작가의 깃발 모델은 별개 단독 모델). 깃발은 **Castle Kit** 에서 가져오고, 틴트가 필요한 부분만 Quaternius 무지 메시를 쓰는 조합이 맞다. 낱개 깃발이 필요하면 [poly.pizza](https://poly.pizza) 에서 모델 단위로 받되 **모델별 라이선스를 개별 확인**할 것(CC0·CC-BY 혼재).

## 3. 넣은 뒤 내가 할 일 (코드)

1. **배경**: `WCCityDiorama.cpp` → `DioramaTable()` 에 `{ TEXT("europe"), { TEXT("/Game/<팩>/Maps/<데모맵>"), FVector(중심) } }` 한 줄 추가.
   클러스터 중심은 `Scripts/dump_village_layout.py` 로 액터 분포를 떠서 구한다.
2. **마커/깃발**: FBX/glTF 를 `RawAssets/Markers/` 에 두고 `Scripts/import_markers.py`(신규)로 임포트 → `WCMapActor` 의 도형 조합을 메시로 교체 + 깃발 메시에 세력색 MID.
   Kenney 임포트 시 **Recompute Normals/Tangents 끄기**, 포맷은 **GLB 권장**(Kenney 공식 가이드).
3. **git**: 대용량 팩은 `.gitignore` 하고 배포 시 수동 복사(현재 Asian_Village 와 동일 취급).
