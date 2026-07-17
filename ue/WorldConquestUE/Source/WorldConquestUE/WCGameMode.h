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

    // ── 카메라 줌/팬 (휠 + 우클릭 드래그) ──
    void ZoomCamera(float WheelDelta);            // 휠 — OrthoWidth 3000~21000
    void PanCamera(float DeltaX, float DeltaY);   // 우클릭 드래그 — 지도 범위 클램프
    TObjectPtr<class ACameraActor> BoardCamera;

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

    // ── Slate UI 뷰모델 (TAttribute 폴링 — 매 프레임 평가) ──
    FText UiTurnText() const;          // "3턴 · 조선 차례"
    FText UiResourceText() const;      // "금 1220 · 식량 960 · 천명 25"
    FText UiSelectionTitle() const;    // "평양 (소유: 위)"
    FText UiSelectionDetail() const;   // 주둔·아군부대
    FText UiRecruitUnitText() const;   // "병종: 창병"
    bool UiHasSelection() const { return !SelectedNodeId.IsEmpty(); }
    bool UiArmyReady() const { return !SelectedArmyId.IsEmpty(); }
    bool UiIsPlaying() const { return Phase == EWCPhase::Playing; }

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
    struct FWCNodeInfo { int32 Population = 0; FString Terrain; bool bPort = false; int32 Gold = 0; int32 Food = 0; };
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

    // 명령 상태 (표현 전용 — 게임 규칙 아님)
    EWCClickMode ClickMode = EWCClickMode::Normal;
    FString SelectedArmyId;              // 선택 영지의 내 부대 (이동·공격의 주어)
    TArray<FString> LandUnitIds;         // static 병종 (land) — U 순환
    int32 RecruitUnitIndex = 0;
    FString QuickSavePath;
    FString CityRatesText;               // /api/rates 캐시 (진입·초빙 시 갱신)
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
