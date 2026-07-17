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
    void OnClickReleased();
    void OnDoubleClick();
    void OnCapturePressed();

    // 좌클릭 클릭 vs 드래그 판별 (드래그 = 지도 팬, 클릭 = 노드 선택)
    bool  bLeftDown = false;
    bool  bLeftDragged = false;
    float LeftDragDist = 0.f;   // 누적 이동 픽셀 — 임계값 넘으면 드래그로 승격
};
