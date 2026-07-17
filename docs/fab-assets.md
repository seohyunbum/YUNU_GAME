# Fab 에셋 의존 (도시 3D 디오라마)

도시(거점) 화면 3D 배경은 **Fab 무료 에셋**을 쓴다. repo 에는 1GB 바이너리를 넣지 않으므로(gitignore), 새 PC/체크아웃에서 도시 화면 3D 를 보려면 아래를 1회 수행한다. **없어도 크래시는 없다**(디오라마 로드 실패 시 빈 배경 폴백).

## Stylized Eastern Village (AleksandrIvanov, 무료·Permanent)
- https://www.fab.com/listings/9841fee2-683f-4e68-adb8-bafec270a251
- 언리얼 엔진 포맷 · 4.9★ · 243 메시(건물 200 모듈·나무·물·데모맵). UE 5.0–5.7 표기.

### 추가 절차 (5.8 프로젝트라 버전 우회 필요 — 실측 2026-07-17)
1. 링크 → [내 라이브러리에 추가]
2. 런처 "프로젝트에 추가"가 5.8 프로젝트를 못 찾음(에셋 5.7 표기) → **5.7 로 표기한 빈 스텁 프로젝트**를 만들어 우회:
   `C:\Users\서현범\Documents\Unreal Projects\AssetGrab57\AssetGrab57.uproject` (EngineAssociation "5.7")
   런처 "모든 프로젝트 표시" 체크 → AssetGrab57 선택 → 다운로드.
3. 받아진 `AssetGrab57/Content/Asian_Village` 폴더를 우리 프로젝트 `Content/Asian_Village` 로 복사.
   (배포/3D 바로가기용 wc-game 에도 동일 복사 — deploy 시 함께.)

### 통합 방식 (코드)
- `WCCityDiorama` 가 `ULevelStreamingDynamic::LoadLevelInstance("/Game/Asian_Village/maps/Asian_Village_Demo")` 로
  **아티스트 데모 맵을 통째 로드**(원본 조명·재질). 클러스터 중심(27010,5030,2500)을 액터 원점에 정렬.
- ※ 재구성(HISM/개별메시)은 우리 씬 조명에서 무채색이 됨 — 데모 맵의 자체 라이팅이 정답(실측).
- 데모 맵의 전역 조명(directional/sky/fog)은 세계지도와 공존해도 무해(실측). 화면 경고는 GAreScreenMessagesEnabled=false 로 억제.
