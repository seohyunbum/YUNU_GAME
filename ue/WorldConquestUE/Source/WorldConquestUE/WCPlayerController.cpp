#include "WCPlayerController.h"
#include "WCGameMode.h"
#include "Components/PrimitiveComponent.h"

AWCPlayerController::AWCPlayerController()
{
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableMouseOverEvents = true;
}

void AWCPlayerController::BeginPlay()
{
    Super::BeginPlay();

    // GameAndUI — Slate 위젯과 게임 픽킹이 마우스를 함께 받게 한다(기본 GameOnly 는 뷰포트가 영구 캡처).
    // 주의: 이것만으로는 부족했다 — 거점 클릭 전멸의 실제 범인은 오버레이 위젯 자신의 기본 Visibility 였다.
    // (SCompoundWidget 기본값 Visible → 내용이 Collapsed 여도 전체 화면을 덮는 투명 벽. WCStyle 계열
    //  오버레이는 Construct 에서 SelfHitTestInvisible 로 해제. 2026-07-17 위젯 경로 계측으로 확정)
    FInputModeGameAndUI Mode;
    Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
    Mode.SetHideCursorDuringCapture(false);
    SetInputMode(Mode);
    bShowMouseCursor = true;
}

void AWCPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    const auto GM = [this]() { return GetWorld()->GetAuthGameMode<AWCGameMode>(); };

    InputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &AWCPlayerController::OnEndTurnPressed);
    InputComponent->BindKey(EKeys::LeftMouseButton, IE_Pressed, this, &AWCPlayerController::OnClick);
    InputComponent->BindKey(EKeys::LeftMouseButton, IE_Released, this, &AWCPlayerController::OnClickReleased);
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


    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM) return;

    // 도시 화면·오버레이 중엔 지도 카메라 조작 무시
    const bool bMapActive = !GM->UiInCity() && !GM->ActiveBattle.IsSet()
        && !GM->ActiveReveal.IsSet() && !GM->GetActiveCutsceneDef();

    // 우클릭 드래그 = 오빗(요/틸트 회전)
    if (bMapActive && IsInputKeyDown(EKeys::RightMouseButton))
    {
        float DX = 0.f, DY = 0.f;
        GetInputMouseDelta(DX, DY);
        GM->OrbitCamera(DX, DY);
    }

    // 좌클릭 드래그 = 지도 팬 (임계값 6px 넘으면 드래그로 승격 → 릴리즈 시 선택 억제)
    if (bLeftDown && IsInputKeyDown(EKeys::LeftMouseButton))
    {
        float DX = 0.f, DY = 0.f;
        GetInputMouseDelta(DX, DY);
        LeftDragDist += FMath::Abs(DX) + FMath::Abs(DY);
        if (LeftDragDist > 6.f)
        {
            bLeftDragged = true;
            if (bMapActive) GM->PanCamera(DX, DY);
        }
    }
}

void AWCPlayerController::OnEndTurnPressed()
{
    if (AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>())
        GM->EndTurn();
}

void AWCPlayerController::OnClick()
{
    bLeftDown = false;
    bLeftDragged = false;
    LeftDragDist = 0.f;

    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM) return;

    // 오버레이는 누름 즉시 처리(즉각 반응): 전투 → 리빌 → 컷씬 → (도시면 지도 무시)
    if (GM->ActiveBattle.IsSet()) { GM->DismissBattle(); return; }
    if (GM->ActiveReveal.IsSet()) { GM->DismissReveal(); return; }
    if (GM->GetActiveCutsceneDef()) { GM->AdvanceCutscene(); return; }
    if (GM->UiInCity()) return;

    // 지도: 선택은 릴리즈까지 보류(드래그면 팬으로 소비, 아니면 선택)
    bLeftDown = true;
}

void AWCPlayerController::OnClickReleased()
{
    if (!bLeftDown) return;
    bLeftDown = false;

    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM || bLeftDragged) return;   // 드래그였으면 선택하지 않음(팬으로 소비)

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
