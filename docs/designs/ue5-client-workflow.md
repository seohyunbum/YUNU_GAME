# UE5 클라이언트 작업지침 (운영 체크리스트) — 매 변경 시 준수

> 이 문서는 **"어떻게 작업하는가"** 의 정본이다. 설계=[`ue5-client-design.md`](ue5-client-design.md), 게임규칙=[`../GAME_DESIGN_SPEC.md`](../GAME_DESIGN_SPEC.md).
> 작성 계기: 2026-07-17 빌드는 됐으나 **배포 동기화를 빠뜨려 바탕화면 아이콘에 아무 변경도 안 보인** 사고. 이런 기초 누락 재발 방지가 목적.

## 0. 절대 놓치지 말 것 (Definition of Done — 매 작업 종료 게이트)

작업을 "끝났다"고 말하기 전에 아래를 **전부** 자가 점검한다. 하나라도 아니면 미완이다.

- [ ] **IP 프라이버시**: repo 비공개 유지. 크로스오버 IP(귀멸·마블·Fate) 캐릭터·이미지는 **공개·상업·외부 공유 절대 금지** (가족 사적 이용 한정).
- [ ] **빌드 후 배포**: 코드/에셋 변경 시 `python scripts/deploy-ue-client.py` 실행. **안 하면 바탕화면 아이콘(wc-game)에 반영 0.** ← 2026-07-17 실제 누락 지점.
- [ ] **실행본으로 검증**: QA 샷은 **아이콘이 실행하는 wc-game .uproject** 로 찍는다(WCUE 아님). §2 경로 지도 참조.
- [ ] **스펙 근거**: 새 UI/기능은 `GAME_DESIGN_SPEC.md` 의 해당 절을 근거로. 임의 발명 금지.
- [ ] **코드-퍼스트**: Blueprint(.uasset) 저작 금지 — C++ Slate/UMG 로만. (AI 가 바이너리 못 읽음)
- [ ] **그래픽 기준**: §3 품질 기준 통과. 절차생성 단색/글자 placeholder 를 최종물로 내지 않는다.
- [ ] **콘솔 폴백 무손상**: play/solo/panel 콘솔 모드가 여전히 동작.
- [ ] **커밋+푸시**: 소스+에셋 pathspec 지정 커밋 후 push (feedback_always_commit_push).

## 1. 표준 파이프라인 (편집 → 화면까지)

```
① 소스/에셋 편집  (worktree = C:\Users\Public\WCUE, junction)
② kill UE         taskkill /F /IM UnrealEditor.exe ; /IM UnrealEditor-Cmd.exe    (Live Coding 잠금 해제)
③ 빌드           "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" \
                    WorldConquestUEEditor Win64 Development -Project="C:\Users\Public\WCUE\WorldConquestUE.uproject" -WaitMutex
④ 에셋 임포트     (텍스처/초상 변경 시) UnrealEditor-Cmd.exe <uproj> -run=pythonscript -script=Scripts\import_*.py -unattended
⑤ 배포           python scripts\deploy-ue-client.py         ← WCUE → wc-game 동기화 (필수!)
⑥ QA 샷 (실행본)  UnrealEditor.exe "C:\Users\Public\wc-game\ue\WorldConquestUE\WorldConquestUE.uproject" \
                    -game -RenderOffscreen -WCShot [-WCCity=hanseong|-WCReveal=<id>] -resx=1600 -resy=900 -nosplash -nosound
                  → Saved\Screenshots\WindowsEditor\ScreenShot00000.png 를 이미지 판독
⑥' 클릭 QA (UI 변경 시 [MUST])
                  python ue\WorldConquestUE\Scripts\click_test.py <clientX> <clientY>
                  창모드로 띄워 **실제 마우스 클릭을 주입**하고 전/후 스샷·로그로 판정.
                  오프스크린 샷(⑥)은 그림만 찍으므로 **클릭 동작을 절대 검증하지 못한다** — 이 하네스가
                  없어서 "클릭 안 됨" 을 두 번 놓쳤다(2026-07-17). 다른 앱이 포그라운드를 뺏으면 무효 판정됨.
⑦ 커밋+푸시
```

> **폰트 임포트만 예외**: 에디터 임포트는 commandlet 에서 크래시 → TTF 를 `Content/Fonts/` 에 두고 런타임 `FStandaloneCompositeFont` 로드(WCStyle). 텍스처·초상 임포트는 ④ 정상.

## 2. 경로 지도 (혼동 금지 — 사고 원인)

| 역할 | 경로 | 비고 |
|---|---|---|
| **빌드/QA/개발** | `C:\Users\Public\WCUE` | worktree 와 junction 동일 트리. 여기서 빌드·임포트. |
| **실행본(아이콘)** | `C:\Users\Public\wc-game\ue\WorldConquestUE` | 바탕화면 "세계정복 3D" 가 `-game` 으로 실행. **별도 real dir** — ⑤ 배포로만 갱신. |
| **C# 서버** | `C:\Users\서현범\WorldConquest\app` | 클라가 자식 스폰(표준경로). `deploy-local.py` 가 배포. |
| **바탕 아이콘** | `~\Desktop\세계정복 3D.lnk` → `~\WorldConquest\WorldConquest3D.bat` | .bat 이 wc-game .uproject 를 실행. |

## 3. 그래픽 품질 기준 & 에셋 정책 [핵심]

사용자 기준: **"언리얼5 = 최신 고퀄리티". 절차생성 도형·글자카드 = 불합격("애들 장난").**

원칙 (우선순위 순):
1. **손으로 못 그리면 외부 소스부터 빡세게 탐색** — 절차 PNG 를 최종물로 내지 말 것. 실제 아트 에셋을 확보해 넣는다.
2. **에셋 소스 우선순위**: ① 직접 다운로드 CC0(Kenney·OpenGameArt·itch.io CC0) → ② Fab 무료(런처 "프로젝트에 추가" = 유저 클릭 필요) → ③ game-icons.net(CC-BY, 4000+ 아이콘) → ④ 절차생성은 *배경 텍스처·틴트·조합* 보조로만.
3. **3D 배경**: 거점 디오라마 = Fab "Stylized Eastern Village"(비취 궁궐) 검증됨. 세계지도 = NASA 위성+GEBCO 지형.
4. **UI 스킨**: 9-slice 오너먼트 프레임 텍스처 + FButtonStyle 3-state + 아이콘. 단색 브러시는 폴백일 뿐 목표 아님.
5. **폰트**: 제목=Gugi, 본문=GothicA1(+폴백). 두부(□) 0.

### 3.1 승인된 에셋 레지스트리 (2026-07-17 리서치 + 라이선스 실검증)

| 에셋 | 라이선스 | 용도 | 상태 |
|---|---|---|---|
| **game-icons.net** (Lorc·Delapouite 외) | **CC BY 3.0** (크레딧 필요) | 거점 UI 아이콘 20종 → `RawAssets/Icons` → `/Game/Icons/T_icon_*` | **채택·적용** |
| Fab "Stylized Eastern Village" | Fab 무료 | 거점 3D 디오라마(비취 궁궐) | 채택 (런처 필요) |
| Gugi / Gothic A1 | OFL | 제목/본문 폰트 | 채택 |
| Kenney Fantasy UI Borders / UI Pack | CC0 | 9-slice 프레임 후보 | 미채택 — 플랫 톤 |
| Golden UI (Buch) | CC0 | 프레임 후보 | 미채택 — **픽셀아트**라 톤 불일치 |
| FANTASY Parchment Set (MELLE) | CC0 | 양피지 배경 후보 | 미채택 — 두루마리 일러스트(9-slice 불가) |
| Crusenho Complete UI (Wood/Paper 테마) | CC BY 4.0 | **회화풍 목판/종이 오너먼트 프레임** | **유료 $3.5~3.9 — 사용자 결정 대기** |

**아이콘 URL 패턴** (직접 취득): `https://game-icons.net/icons/ffffff/transparent/1x1/{author}/{name}.png` — 색조합은 고정 4종만 유효. 흰색/투명으로 받아 Slate `TintColor` 로 금색화(`FWCStyle::Icon`).

**크레딧 의무 [MUST]**: game-icons.net 은 CC BY → 게임 내 크레딧 1줄 필요
(`Icons by Lorc, Delapouite & contributors — game-icons.net, CC BY 3.0`). 가족 전용이라도 표기 유지.

> **알려진 한계 (정직한 기록)**: 무료 CC0 UI 키트는 대부분 픽셀아트·플랫 벡터라 **"회화풍 오너먼트 프레임"은 무료로 확보되지 않는다.** 현재 패널 프레임은 절차생성 9-slice. 진짜 목판/종이 질감 프레임이 필요하면 위 유료 팩(수천 원) 도입이 가장 빠른 경로 — 구매는 사용자 결정.

> Fab 의존 상세: `docs/fab-assets.md`.

## 4. 거점(도시) UI 스펙 — §2.3 기반

거점 화면 = 3컬럼 [내정 | 군사 | 주막]. 현재 구현 대비 목표:

| 컬럼 | 스펙(§2.3) 요구 | 현재 | 확장 목표 |
|---|---|---|---|
| **내정** | 시설 6종(시장·농지·병영·학당·성벽·항구) 레벨 1~3 건설/증축, 상업·농업 개발, **민심 0~100·세율**, 기술 | 시장·농지 버튼만, 생산 텍스트 | 시설 6종 슬롯(레벨 pip·건설 큐·비용), 민심 게이지·세율 조절, 자원 아이콘 |
| **군사** | 징병(인구 트레이드오프), 부대 편성, 병종 | 징병10/50·병종 순환 | 부대 목록·병력바, 병종 아이콘, 인구/징병가능 표시 |
| **주막** | 초빙(가챠) 확률·천장·리빌, 소속 무장, **아이템 구매·교역** | 초빙·확률·소속무장 카드 | 무장 초상 카드 그리드 확대, 아이템/교역(스펙 확장 시), 등용 성공률(매력) |

공통: 상단 거점 헤더(이름·세력·인구·항구), 하단 [세계지도로]. 배경=3D 디오라마.

## 5. 흔한 함정 (실측 누적)

- 빌드만 하고 ⑤ 배포 누락 → 아이콘 반영 0 (2026-07-17).
- 배포 스크립트의 **Content 하위 고정 목록** → 새 폴더(Icons) 조용히 누락 (2026-07-17). → 자동 열거로 수정.
- WCUE 로 QA 찍고 "됐다" 판단 → 유저는 wc-game 실행 (2026-07-17).
- **⚠ 배포는 실행 중인 게임을 강제 종료한다** (DLL 잠금 해제용 taskkill). **가족이 플레이 중일 땐 배포 금지** — 갑자기 꺼진다.
- **Slate 브러시가 미루팅 UTexture2D 참조 → GC 후 크래시** (`UObjectArray.h` "Index >= 0" assertion, SlateCore 스택). 초상·아이콘 등 모든 텍스처는 **AddToRoot 한 static 캐시**(`FWCStyle::Icon/Portrait`)로만 로드. 위젯에서 직접 `LoadObject`+`SetResourceObject` 금지 [MUST].
- **입력 모드 기본값 GameOnly → 뷰포트가 마우스를 영구 캡처**. PlayerController::BeginPlay 에서 `FInputModeGameAndUI` 필수 [MUST].
- **★ 오버레이 위젯 자신의 Visibility 가 클릭을 전부 삼킨다** (거점·지도 버튼 전멸의 진짜 원인, 2026-07-17 확정).
  `SCompoundWidget` 기본 Visibility = `Visible` → **자식만 Collapsed 로 숨기면 위젯 자신은 전체 화면을 덮는 '투명한 벽'** 이 되어
  아래 ZOrder 위젯의 클릭을 전부 가로챈다. 최상단 `SWCRevealOverlay`(ZOrder 30)가 리빌이 없을 때도 모든 버튼을 막고 있었다.
  → 전체화면 오버레이 위젯은 **Construct 에서 `SetVisibility(EVisibility::SelfHitTestInvisible)` 필수** [MUST] (자신=클릭 대상 아님, 자식=정상).
  진단법: 커서 아래 위젯 경로를 `FSlateApplication::LocateWindowUnderMouse` 로 찍으면 범인이 바로 보인다.
- 폰트 장식체(Gugi) 문장부호 글리프 없음 → 폴백 타입페이스 필수.
- Live Coding 잠금 → Build 전 UE 프로세스 kill.
- 절차생성 도형을 고퀄로 착각 → 외부 에셋 확보가 정답.
