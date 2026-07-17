#include "WCPlayerController.h"
#include "WCGameMode.h"
#include "Components/PrimitiveComponent.h"

AWCPlayerController::AWCPlayerController()
{
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableMouseOverEvents = true;
}

void AWCPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::LeftMouseButton, IE_Pressed, this, &AWCPlayerController::OnClick);
    InputComponent->BindKey(EKeys::C, IE_Pressed, this, &AWCPlayerController::OnCapturePressed);
}

void AWCPlayerController::OnEndTurnPressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->EndTurn();
}

void AWCPlayerController::OnClick()
{
    FHitResult Hit;
    if (GetHitResultUnderCursor(ECC_Visibility, false, Hit) && Hit.GetComponent())
        if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
            GM->HandleNodeClick(Hit.GetComponent());
}

void AWCPlayerController::OnCapturePressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->CaptureSelected();
}
