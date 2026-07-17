#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Dom/JsonObject.h"
#include "WCGameMode.generated.h"

class AWCMapActor;
class UPrimitiveComponent;

/** 클릭 해석 모드 — 이동/공격은 "명령 키 → 목표 클릭" 2단계. */
enum class EWCClickMode : uint8 { Normal, MoveTarget, AttackTarget };

/** 클라이언트 화면 단계. */
enum class EWCPhase : uint8 { Boot, FactionSelect, Playing };

/** 컷씬 대본 (static 에서 파싱 — Presentation 소비 §5.7). */
struct FWCCutsceneLine { FString Speaker; FString TextKo; };
struct FWCCutscene { FString TitleKo; FString TitleCard; TArray<FWCCutsceneLine> Lines; };

/**
 * WorldConquest 클라이언트 진입 게임모드 (ue5-client-design §3 — 코드 퍼스트, 로직 0).
 * M2: 서버 자식 스폰(원클릭) · 노드 클릭 선택 · 이벤트 로그 · 도시명 라벨 데이터.
 */
UCLASS()
class WORLDCONQUESTUE_API AWCGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AWCGameMode();
    virtual void BeginPlay() override;

    /** 현재 차례 세력으로 end 명령 전송 (Enter/Space). */
    void EndTurn();

    /** 클릭 픽킹 결과 처리 — 노드 선택. */
    void HandleNodeClick(const UPrimitiveComponent* Component);

    /** 더블클릭 — 소유 도시면 진입. */
    void HandleNodeDoubleClick(const UPrimitiveComponent* Component);

    /** 선택 영지 점령 시도 (C 키). 로직 판정은 전부 서버 [MUST]. */
    void CaptureSelected();

    // ── M2 명령 (전부 서버 판정 — 클라는 인자만 만든다) ──
    void RecruitSelected(int32 Count);            // R=10 · T=50, 병종은 U 로 순환
    void CycleRecruitUnit();                      // U
    void BuildSelected(const FString& Facility);  // B=market · N=farm
    void SummonOnce();                            // S
    void BeginMoveMode();                         // M → 목표 클릭
    void BeginAttackMode();                       // A → 목표 클릭
    void CancelMode();                            // ESC
    void QuickSave();                             // F5
    void QuickLoad();                             // F9

    FString HudModeLine;                          // 모드·병종 안내줄

    // ── 세력 선택 (Boot → FactionSelect → Playing) ──
    EWCPhase Phase = EWCPhase::Boot;
    TArray<FString> SelectableFactions;           // player_selectable 순서 = 숫자키
    bool bHotseat = false;                        // [H] 토글 — 2인 핫시트
    FString HotseatFirstPick;
    void SelectFactionByIndex(int32 Index);       // 숫자키 1~9
    void ToggleHotseat();

    // ── 시네마틱 카메라 (원근 틸트 + 돌리 줌/팬/오빗) ──
    void ZoomCamera(float WheelDelta);            // 휠 — 거리 3500~30000
    void PanCamera(float DeltaX, float DeltaY);   // 좌클릭 드래그 — 화면기준 타깃 이동
    void OrbitCamera(float DeltaX, float DeltaY); // 우클릭 드래그 — 요/피치 회전
    void UpdateBoardCamera();
    TObjectPtr<class ACameraActor> BoardCamera;
    FVector CamTarget = FVector(-900, 0, 0);      // 주시점 — 틸트 보정 남쪽 오프셋
    float CamDist = 14000.f;                      // 시작 줌 — 거점이 크게 보이도록(외곽 극지방은 잘려도 무방)
    float CamPitch = -52.f;
    float CamYaw = 0.f;                           // 오빗 회전 (우클릭 드래그)
    float CamPitchManual = 0.f;                   // 우클릭 세로드래그 추가 틸트 오프셋

    // ── 전투 결과 연출 (§4.3 BattleEnded — 양측 병력·손실·라운드·지휘관·일기토) ──
    struct FWCBattle
    {
        FString Node, AtkFaction, DefFaction, AtkCommander, DefCommander, DuelWinner, DuelLoser;
        int32 AtkBefore = 0, DefBefore = 0, AtkLosses = 0, DefLosses = 0, Rounds = 0;
        bool bAttackerWon = false, bMine = false;
    };
    TOptional<FWCBattle> ActiveBattle;
    TArray<FWCBattle> BattleQueue;
    void DismissBattle();
    void TryStartNextBattle();
    // 결과 화면 뷰모델
    FText UiBattleTitle() const;      // "한성 공방전 — 승리 / 패배"
    FText UiBattleAtkLine() const;    // "조선 (관우) — 100 → 62 (-38)"
    FText UiBattleDefLine() const;
    FText UiBattleFooter() const;     // "3라운드 · 일기토: 관우 승"
    FLinearColor UiBattleAtkColor() const;
    FLinearColor UiBattleDefColor() const;

    // ── 초빙 리빌 연출 (§2.8.10 진실 신호 — 금문/자문, 표현 전용) ──
    struct FWCReveal { FString CharId; FString Name; int32 Rarity = 3; };
    TOptional<FWCReveal> ActiveReveal;
    TArray<FWCReveal> RevealQueue;
    void DismissReveal();                 // 클릭 — 다음 리빌 또는 대기 컷씬
    void TryStartNextReveal();

    // ── 컷씬 오버레이 (표현 전용 — fired 판정은 서버) ──
    struct FWCActiveCutscene { FString Id; int32 LineIndex = 0; };
    TMap<FString, FWCCutscene> Cutscenes;
    TOptional<FWCActiveCutscene> ActiveCutscene;
    TArray<FString> CutsceneQueue;
    void AdvanceCutscene();                       // 클릭/자동 타이머 — 다음 라인
    const FWCCutscene* GetActiveCutsceneDef() const;
    FTimerHandle CutsceneTimer;

    // ── 도시(거점) 화면 — 세계지도와 별개의 내정·군사·초빙 뷰 ──
    void EnterCity(const FString& NodeId);   // 소유 도시만 (더블클릭 / [도시 진입] 버튼)
    void LeaveCity();
    TObjectPtr<class AWCCityDiorama> Diorama;   // 도시 3D 배경 (먼 위치, 도시 화면 카메라 전용)
    TObjectPtr<class ACameraActor> CityCamera;
    bool UiInCity() const { return !EnteredCityId.IsEmpty(); }
    bool UiCanEnterSelected() const;         // 선택 영지가 현재 차례 세력 소유인가
    void EnterSelectedCity() { if (UiCanEnterSelected()) EnterCity(SelectedNodeId); }
    FText UiCityHeader() const;              // "한성 — 조선 · 인구 180,000 · 도시 · 항구"
    FText UiCityFacilities() const;          // 시설·생산
    FText UiCityArmies() const;              // 주둔 부대 목록
    FText UiCityCharacters() const;          // 소속 무장 목록
    FText UiCityRates() const;               // 초빙 확률 공시 (서버 조회 캐시)
    void RefreshRates();                     // 진입·초빙 후 갱신 (§2.8.6)
    FString EnteredCityId;

    /** 거점에서 지금 열려 있는 건물 패널 (ux-design §5.2 — 한 번에 하나).
        빈 문자열 = 아무 패널도 안 열림 → 디오라마가 다 보인다. */
    FString OpenBuilding;
    void OpenCityBuilding(const FString& Kind) { OpenBuilding = (OpenBuilding == Kind) ? FString() : Kind; }
    void CloseCityBuilding() { OpenBuilding.Reset(); }
    bool UiBuildingOpen(const FString& Kind) const { return OpenBuilding == Kind; }
    bool UiAnyBuildingOpen() const { return !OpenBuilding.IsEmpty(); }

    // ── 구조화 뷰모델 (카드·표 UI 용) ──
    struct FWCCharCard { FString Id; FString Name; int32 Rarity = 3; };
    struct FWCArmyCard { FString Id; FString Detail; FString Commander; int32 Troops = 0; };
    struct FWCFacilityRow { FString NameKo; FString Kind; int32 Level = 0; int32 MaxLevel = 3; };
    /** 시설 종류 → 한글명 (§2.3). 미정의 종류는 원문 유지. */
    static FString FacilityNameKo(const FString& Kind);
    struct FWCRateRow { int32 Rarity = 3; int32 Permyriad = 0; int32 Remaining = 0; };
    TArray<FWCCharCard> UiMyCharacterCards() const;
    TArray<FWCArmyCard> UiCityArmyCards() const;
    TArray<FWCFacilityRow> UiCityFacilityRows() const;
    const TArray<FWCRateRow>& UiRateRows() const { return RateRows; }
    float UiPityProgress() const { return RateHardPity > 0 ? float(RatePity) / RateHardPity : 0.f; }
    FText UiPityText() const;
    FText UiMandateText() const;             // "천명 5 · 1회 100"
    FLinearColor UiFactionColor() const;     // 현재 차례 세력 색 (헤더 배너)

    // ── Slate UI 뷰모델 (TAttribute 폴링 — 매 프레임 평가) ──
    FText UiTurnText() const;          // "3턴 · 조선 차례"
    FText UiResourceText() const;      // "금 1220 · 식량 960 · 천명 25"
    FText UiSelectionTitle() const;    // "평양 (소유: 위)"
    FText UiSelectionDetail() const;   // 주둔·아군부대
    FText UiRecruitUnitText() const;   // "병종: 창병"
    bool UiHasSelection() const { return !SelectedNodeId.IsEmpty(); }
    bool UiArmyReady() const { return !SelectedArmyId.IsEmpty(); }
    bool UiIsPlaying() const { return Phase == EWCPhase::Playing; }

    // ── 턴 흐름 안내 (ux-design §3) ──
    FText UiNextUpText() const;         // "턴을 끝내면: 다른 나라 ▶ 이동·전투 ▶ 사건"
    FText UiFreeActionHint() const;     // 자원 툴팁 — "횟수 제한 없어요"
    /** 이번 달에 내가 한 일 (턴 시작 시 비고, 명령 성공마다 한 줄). 행동력이 없으므로
        '남은 기회'가 아니라 '한 일'을 보여준다 — ux-design §3.1. */
    TArray<FString> MyTurnActions;
    FText UiMyTurnActionsText() const;

    // ── 턴 종료 확인 (ux-design §3.3) ──
    bool bConfirmEndTurn = false;
    void RequestEndTurn();             // 확인창 띄우기
    void ConfirmEndTurn();             // 실제 종료
    void CancelEndTurn() { bConfirmEndTurn = false; }
    bool UiConfirmingEndTurn() const { return bConfirmEndTurn; }

    // ── 턴 리포트 (ux-design §4) — 내 턴 밖에서 벌어진 일 ──
    struct FWCReport { TArray<FString> Battle, World, Home; };
    FWCReport Report;
    bool bShowReport = false;
    bool UiShowingReport() const { return bShowReport; }
    void DismissReport() { bShowReport = false; }
    FText UiReportTitle() const;
    const FWCReport& UiReport() const { return Report; }

    // ── HUD 조회용 ──
    FString HudLine = TEXT("연결 중...");
    FString HudSelection;                       // 선택 정보 줄
    TArray<FString> EventLog;                   // 최근 이벤트 (아래에서 위로)
    FString SelectedNodeId;
    TMap<FString, FString> ProvinceNames;       // id → name_ko (라벨·로그 공용)
    TMap<FString, FString> FactionNames;
    TMap<FString, FString> CharacterNames;
    TMap<FString, FString> UnitNames;

    /** 노드 불변 정보 (도시 화면 헤더용 — static 파싱). */
    struct FWCNodeInfo { int32 Population = 0; FString Terrain; FString Region; bool bPort = false; int32 Gold = 0; int32 Food = 0; };
    TMap<FString, FWCNodeInfo> NodeInfos;
    TMap<FString, int32> CharacterRarity;       // 소속 무장 표시용
    AWCMapActor* GetMapActor() const { return MapActor; }

private:
    void BootSequence();
    void RefreshState();
    void OnState(TSharedPtr<FJsonObject> State);
    void OnCommandResult(TSharedPtr<FJsonObject> Result);
    void ParseNames(const TSharedPtr<FJsonObject>& StaticJson);
    void StartCampaign(const FString& P1, const FString& P2);
    void StartCutscene(const FString& Id);
    void TryStartNextCutscene();
    void UpdateSelectionInfo();
    void AppendEvents(const TArray<TSharedPtr<FJsonValue>>& Events);
    FString EventToLine(const TSharedPtr<FJsonObject>& Event) const;
    FString NameOf(const TMap<FString, FString>& Table, const FString& Id) const;
    void SendVerb(const FString& Verb, const TArray<FString>& Args);

    UPROPERTY()
    TObjectPtr<AWCMapActor> MapActor;

    TSharedPtr<FJsonObject> LastState;   // 선택 정보 표시용 (소유·부대)
    FString PendingActor;
    bool bBusy = false;
    FString LastVerb;                    // 직전 명령 — "end" 응답의 이벤트가 곧 턴 리포트 재료
    int32 LastTurn = -1;                 // 턴 바뀜 감지 (한 일 로그 리셋)
    void RouteReportEvent(const TSharedPtr<FJsonObject>& Event);   // 이벤트 → 리포트 섹션
    FString VerbToKoreanAction(const FString& Verb) const;          // 명령 → "한 일" 문장 (아이 말)

    // 명령 상태 (표현 전용 — 게임 규칙 아님)
    EWCClickMode ClickMode = EWCClickMode::Normal;
    FString SelectedArmyId;              // 선택 영지의 내 부대 (이동·공격의 주어)
    TArray<FString> LandUnitIds;         // static 병종 (land) — U 순환
    int32 RecruitUnitIndex = 0;
    FString QuickSavePath;
    FString CityRatesText;               // /api/rates 캐시 (진입·초빙 시 갱신)
    TArray<FWCRateRow> RateRows;         // 구조화 확률 캐시
    int32 RatePity = 0, RateHardPity = 30, RateMandate = 0, RateCost = 100, RatePool = 0;
    void UpdateModeLine();
    void RunQaCommandsIfRequested();     // -WCCmd="verb a b|verb c" QA 스크립트
    bool bQaCmdParsed = false;
    TArray<FString> QaCommands;          // 남은 QA 명령 큐 (소진 후에야 WCTurns·WCShot)

    /** QA 하네스 (-WCShot / -WCTurns=N / -WCSelect=id) — ue5-client-design §3. */
    bool bShotScheduled = false;
    void ScheduleQaShotIfRequested();
    int32 AutoTurnsRemaining = -1;
    bool bQaSelectDone = false;
};
