#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "WCGameMode.generated.h"

/**
 * WorldConquest 클라이언트 진입 게임모드 (ue5-client-design §3 — 코드 퍼스트, 로직 0).
 * Day-0: 부팅·렌더 검증. M1 에서 지도 절차 생성과 API 연결이 붙는다.
 */
UCLASS()
class WORLDCONQUESTUE_API AWCGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    virtual void BeginPlay() override;
};
