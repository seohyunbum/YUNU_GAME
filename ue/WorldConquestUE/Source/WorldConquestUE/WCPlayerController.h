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
    virtual void BeginPlay() override;
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

    /**
     * 드래그 델타는 **커서 좌표 차분**으로 구한다 [MUST].
     * GetInputMouseDelta 는 마우스 캡처가 있어야 값이 들어오는데, 본 게임은 UI 클릭을 살리려고
     * 캡처를 끈다(Config/DefaultInput.ini) → 캡처 기반 델타는 항상 0 이 된다 (2026-07-17 실측).
     */
    FVector2D LastCursor = FVector2D::ZeroVector;
    bool      bHasLastCursor = false;
    bool ReadCursorDelta(FVector2D& OutDelta);
};
