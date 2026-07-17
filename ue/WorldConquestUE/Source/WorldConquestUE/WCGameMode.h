#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Dom/JsonObject.h"
#include "WCGameMode.generated.h"

class AWCMapActor;
class UPrimitiveComponent;

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

    /** 선택 영지 점령 시도 (C 키). 로직 판정은 전부 서버 [MUST]. */
    void CaptureSelected();

    // ── HUD 조회용 ──
    FString HudLine = TEXT("연결 중...");
    FString HudSelection;                       // 선택 정보 줄
    TArray<FString> EventLog;                   // 최근 이벤트 (아래에서 위로)
    FString SelectedNodeId;
    TMap<FString, FString> ProvinceNames;       // id → name_ko (라벨·로그 공용)
    TMap<FString, FString> FactionNames;
    TMap<FString, FString> CharacterNames;
    AWCMapActor* GetMapActor() const { return MapActor; }

private:
    void BootSequence();
    void RefreshState();
    void OnState(TSharedPtr<FJsonObject> State);
    void OnCommandResult(TSharedPtr<FJsonObject> Result);
    void ParseNames(const TSharedPtr<FJsonObject>& StaticJson);
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

    /** QA 하네스 (-WCShot / -WCTurns=N / -WCSelect=id) — ue5-client-design §3. */
    bool bShotScheduled = false;
    void ScheduleQaShotIfRequested();
    int32 AutoTurnsRemaining = -1;
    bool bQaSelectDone = false;
};
