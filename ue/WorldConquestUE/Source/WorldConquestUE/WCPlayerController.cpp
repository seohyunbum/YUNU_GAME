#include "WCPlayerController.h"
#include "WCGameMode.h"

AWCPlayerController::AWCPlayerController()
{
    bShowMouseCursor = true;   // 보드 게임 — 커서 상시 (M2 클릭 픽킹 대비)
}

void AWCPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
}

void AWCPlayerController::OnEndTurnPressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->EndTurn();
}
