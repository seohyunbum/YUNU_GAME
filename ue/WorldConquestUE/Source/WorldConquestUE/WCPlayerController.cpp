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
    const auto GM = [this]() { return GetWorld()->GetAuthGameMode<AWCGameMode>(); };

    InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::LeftMouseButton, IE_Pressed, this, &AWCPlayerController::OnClick);
    InputComponent->BindKey(EKeys::C, IE_Pressed, this, &AWCPlayerController::OnCapturePressed);

    // M2 명령 키 — FInputKeyBinding 수동 람다 (핸들러 메서드 폭발 방지)
    const auto Bind = [this, GM](const FKey& Key, TFunction<void(AWCGameMode*)> Fn)
    {
        FInputKeyBinding KB(FInputChord(Key), IE_Pressed);
        KB.KeyDelegate.GetDelegateForManualSet().BindLambda([GM, Fn]()
        {
            if (AWCGameMode* G = GM()) Fn(G);
        });
        InputComponent->KeyBindings.Add(MoveTemp(KB));
    };
    Bind(EKeys::R, [](AWCGameMode* G) { G->RecruitSelected(10); });
    Bind(EKeys::T, [](AWCGameMode* G) { G->RecruitSelected(50); });
    Bind(EKeys::U, [](AWCGameMode* G) { G->CycleRecruitUnit(); });
    Bind(EKeys::M, [](AWCGameMode* G) { G->BeginMoveMode(); });
    Bind(EKeys::A, [](AWCGameMode* G) { G->BeginAttackMode(); });
    Bind(EKeys::B, [](AWCGameMode* G) { G->BuildSelected(TEXT("market")); });
    Bind(EKeys::N, [](AWCGameMode* G) { G->BuildSelected(TEXT("farm")); });
    Bind(EKeys::S, [](AWCGameMode* G) { G->SummonOnce(); });
    Bind(EKeys::Escape, [](AWCGameMode* G) { G->CancelMode(); });
    Bind(EKeys::F5, [](AWCGameMode* G) { G->QuickSave(); });
    Bind(EKeys::F9, [](AWCGameMode* G) { G->QuickLoad(); });
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
