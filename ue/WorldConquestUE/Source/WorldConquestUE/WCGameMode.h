#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Dom/JsonObject.h"
#include "WCGameMode.generated.h"

class AWCMapActor;

/**
 * WorldConquest 클라이언트 진입 게임모드 (ue5-client-design §3 — 코드 퍼스트, 로직 0).
 * M1 수직 슬라이스: 서버 핸드셰이크 → (캠페인 없으면 solo 생성) → static 보드 생성 →
 * 상태 색 반영 → 탑다운 카메라. Enter = 턴 종료.
 */
UCLASS()
class WORLDCONQUESTUE_API AWCGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AWCGameMode();
    virtual void BeginPlay() override;

    /** 현재 차례 세력으로 end 명령 전송 (WCPlayerController 의 Enter). */
    void EndTurn();

    /** HUD 표시용 상태 요약 (WCHUD 가 읽음). */
    FString HudLine = TEXT("연결 중...");

private:
    void BootSequence();
    void RefreshState();
    void OnState(TSharedPtr<FJsonObject> State);

    UPROPERTY()
    TObjectPtr<AWCMapActor> MapActor;

    FString PendingActor;   // 현재 입력 차례 세력 (명령의 faction 인자)
    bool bBusy = false;     // 명령 중복 전송 방지

    /** QA 하네스 (-WCShot): 첫 상태 적용 후 스크린샷 → 종료. AI 시각 검증용 (ue5-client-design §3). */
    bool bShotScheduled = false;
    void ScheduleQaShotIfRequested();

    /** QA 하네스 (-WCTurns=N): 샷 전에 N턴 자동 end — 상태 갱신에 지도가 반응하는지 검증. */
    int32 AutoTurnsRemaining = -1;   // -1 = 미파싱
};
