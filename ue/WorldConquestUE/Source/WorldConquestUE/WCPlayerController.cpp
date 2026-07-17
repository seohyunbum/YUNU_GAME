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
    InputComponent->BindKey(EKeys::LeftMouseButton, IE_DoubleClick, this, &AWCPlayerController::OnDoubleClick);
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

    // 카메라 줌 (마우스 휠)
    Bind(EKeys::MouseScrollUp, [](AWCGameMode* G) { G->ZoomCamera(1.f); });
    Bind(EKeys::MouseScrollDown, [](AWCGameMode* G) { G->ZoomCamera(-1.f); });

    // 세력 선택 (숫자키 1~9) + 핫시트 토글
    const FKey Digits[] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four,
                            EKeys::Five, EKeys::Six, EKeys::Seven, EKeys::Eight, EKeys::Nine };
    for (int32 i = 0; i < UE_ARRAY_COUNT(Digits); ++i)
        Bind(Digits[i], [i](AWCGameMode* G) { G->SelectFactionByIndex(i); });
    Bind(EKeys::H, [](AWCGameMode* G) { G->ToggleHotseat(); });
}

void AWCPlayerController::PlayerTick(float DeltaTime)
{
    Super::PlayerTick(DeltaTime);
    // 우클릭 드래그 팬 — KOEI식 지도 탐색
    if (IsInputKeyDown(EKeys::RightMouseButton))
    {
        float DX = 0.f, DY = 0.f;
        GetInputMouseDelta(DX, DY);
        if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
            GM->PanCamera(DX, DY);
    }
}

void AWCPlayerController::OnEndTurnPressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->EndTurn();
}

void AWCPlayerController::OnClick()
{
    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM) return;

    // 클릭 우선순위: 리빌 → 컷씬 → (도시 화면이면 지도 클릭 무시)
    if (GM->ActiveReveal.IsSet()) { GM->DismissReveal(); return; }
    if (GM->GetActiveCutsceneDef()) { GM->AdvanceCutscene(); return; }
    if (GM->UiInCity()) return;

    FHitResult Hit;
    if (GetHitResultUnderCursor(ECC_Visibility, false, Hit) && Hit.GetComponent())
        GM->HandleNodeClick(Hit.GetComponent());
}

void AWCPlayerController::OnDoubleClick()
{
    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM || GM->GetActiveCutsceneDef() || GM->UiInCity()) return;
    FHitResult Hit;
    if (GetHitResultUnderCursor(ECC_Visibility, false, Hit) && Hit.GetComponent())
        GM->HandleNodeDoubleClick(Hit.GetComponent());
}

void AWCPlayerController::OnCapturePressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->CaptureSelected();
}
