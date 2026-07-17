#include "WCPlayerController.h"
#include "WCGameMode.h"
#include "Components/PrimitiveComponent.h"
#include "Framework/Application/SlateApplication.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCInput, Log, All);

// -WCInputProbe : 커서 아래 위젯 경로·마우스 캡처 상태를 주기 로그.
// UI 클릭이 안 먹을 때 범인(화면을 덮은 오버레이 등)을 즉시 특정하는 상시 진단 도구.
// (2026-07-17: SWCRevealOverlay 가 전 화면을 막던 버그를 이 방법으로 확정)
static void WCLogInputProbe(APlayerController* PC)
{
    if (!FParse::Param(FCommandLine::Get(), TEXT("WCInputProbe")) || !FSlateApplication::IsInitialized()) return;
    static int32 N = 0;
    if ((N++ % 120) != 0) return;

    FSlateApplication& S = FSlateApplication::Get();
    FWidgetPath Path = S.LocateWindowUnderMouse(S.GetCursorPos(), S.GetInteractiveTopLevelWindows());
    FString Chain;
    for (int32 i = 0; i < Path.Widgets.Num(); ++i) Chain += Path.Widgets[i].Widget->GetTypeAsString() + TEXT(" > ");
    UE_LOG(LogWCInput, Warning, TEXT("[PROBE] captor=%d cursor=%s UNDER: %s"),
        (int32)S.HasAnyMouseCaptor(), *S.GetCursorPos().ToString(),
        Chain.IsEmpty() ? TEXT("(히트 없음)") : *Chain);
}

AWCPlayerController::AWCPlayerController()
{
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableMouseOverEvents = true;
}

void AWCPlayerController::BeginPlay()
{
    Super::BeginPlay();

    // UI 클릭이 살아있으려면 아래 3개가 **모두** 필요하다 (2026-07-17 실측으로 원인 2개 확정).
    //  ① Config/DefaultInput.ini: bCaptureMouseOnLaunch=False — 런치 시 뷰포트가 마우스를 영구 캡처하는 것 차단.
    //  ② 여기: GameAndUI + 잔류 캡처 해제. SetMouseCaptureMode 는 '필드만' 바꾸고 이미 잡힌 캡처를 풀지 않아,
    //     창 활성화 타이밍에 따라 캡처가 남으면 Slate 가 히트테스트를 건너뛰어 버튼이 죽는다(간헐 증상의 정체).
    //  ③ 전체화면 오버레이 위젯의 SetVisibility(SelfHitTestInvisible) — 자신이 투명 벽이 되어 클릭을 삼키는 것 방지.
    FInputModeGameAndUI Mode;
    Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
    Mode.SetHideCursorDuringCapture(false);
    SetInputMode(Mode);
    bShowMouseCursor = true;

    // 지연 FReply(SlateOperations)에 의존하지 말고 즉시 해제 — 캡처가 남아 있으면 커서가 화면 중앙으로 끌려간다.
    if (FSlateApplication::IsInitialized())
        FSlateApplication::Get().ReleaseAllPointerCapture();
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
    WCLogInputProbe(this);   // -WCInputProbe 일 때만 동작

    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM) return;

    // 도시 화면·오버레이 중엔 지도 카메라 조작 무시
    const bool bMapActive = !GM->UiInCity() && !GM->ActiveBattle.IsSet()
        && !GM->ActiveReveal.IsSet() && !GM->GetActiveCutsceneDef();


    // 좌클릭 드래그 = 지도 팬 (임계값 6px 넘으면 드래그로 승격 → 릴리즈 시 선택 억제)
    FVector2D D;
    const bool bMoved = ReadCursorDelta(D);

    // 우클릭 드래그 = 오빗(요/틸트 회전) — 커서 델타 기반
    if (bMapActive && bMoved && IsInputKeyDown(EKeys::RightMouseButton))
        GM->OrbitCamera(D.X, D.Y);

    if (bLeftDown && IsInputKeyDown(EKeys::LeftMouseButton) && bMoved)
    {
        LeftDragDist += FMath::Abs(D.X) + FMath::Abs(D.Y);
        if (LeftDragDist > 6.f)
        {
            bLeftDragged = true;
            if (bMapActive) GM->PanCamera(D.X, D.Y);
        }
    }
}

bool AWCPlayerController::ReadCursorDelta(FVector2D& OutDelta)
{
    float MX = 0.f, MY = 0.f;
    if (!GetMousePosition(MX, MY)) { bHasLastCursor = false; return false; }   // 커서가 뷰포트 밖
    const FVector2D Cur(MX, MY);
    const bool bValid = bHasLastCursor;
    OutDelta = bValid ? Cur - LastCursor : FVector2D::ZeroVector;
    LastCursor = Cur;
    bHasLastCursor = true;
    return bValid && !OutDelta.IsNearlyZero();
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
