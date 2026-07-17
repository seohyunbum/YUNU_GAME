#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "WCPlayerController.generated.h"

/** M1 최소 입력: Enter = 턴 종료. 클릭 픽킹·명령 UI 는 M2. */
UCLASS()
class WORLDCONQUESTUE_API AWCPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AWCPlayerController();

protected:
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;

private:
    void OnEndTurnPressed();
    void OnClick();
    void OnCapturePressed();
};
