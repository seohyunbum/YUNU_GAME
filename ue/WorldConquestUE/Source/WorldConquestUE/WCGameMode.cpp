#include "WCGameMode.h"
#include "WCApiSubsystem.h"
#include "WCMapActor.h"
#include "WCPlayerController.h"
#include "WCHUD.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/DirectionalLight.h"
#include "Components/LightComponent.h"

DEFINE_LOG_CATEGORY_STATIC(LogWorldConquest, Log, All);

AWCGameMode::AWCGameMode()
{
    PlayerControllerClass = AWCPlayerController::StaticClass();
    HUDClass = AWCHUD::StaticClass();
    DefaultPawnClass = nullptr;   // 지도 보드 게임 — 폰 불필요 (카메라 고정)
}

void AWCGameMode::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogWorldConquest, Log, TEXT("WorldConquest UE client boot (protocol v1)"));

    // 조명 — Entry 맵은 비어 있으므로 코드로 스폰 (코드-퍼스트, 에셋 저작 없음)
    if (ADirectionalLight* Sun = GetWorld()->SpawnActor<ADirectionalLight>(
            FVector::ZeroVector, FRotator(-60.f, 30.f, 0.f)))
    {
        Sun->GetLightComponent()->SetIntensity(4.0f);
        Sun->GetLightComponent()->SetCastShadows(false);   // 원판 보드 — 그림자 불필요·성능 절약
    }

    // 직교 탑다운 카메라 — 보드게임 정석: 원근 왜곡 0, 지도 전체 고정 프레이밍.
    // BoardToWorld 매핑과 짝: 화면 위 = +X(북), 화면 오른쪽 = +Y(동).
    if (ACameraActor* Camera = GetWorld()->SpawnActor<ACameraActor>(
            FVector(0, 0, 10000.0), FRotator(-90.f, 0.f, 0.f)))
    {
        UCameraComponent* Cam = Camera->GetCameraComponent();
        Cam->ProjectionMode = ECameraProjectionMode::Orthographic;
        Cam->OrthoWidth = 23000.f;   // 보드 가로 20000(1000×20cm) + 여백
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTarget(Camera);
    }

    MapActor = GetWorld()->SpawnActor<AWCMapActor>(FVector::ZeroVector, FRotator::ZeroRotator);
    BootSequence();
}

void AWCGameMode::BootSequence()
{
    UWCApiSubsystem* Api = GetGameInstance()->GetSubsystem<UWCApiSubsystem>();
    HudLine = TEXT("서버 연결 중...");

    Api->FetchInfo([this, Api](TSharedPtr<FJsonObject> Info)
    {
        if (!Info.IsValid()) { HudLine = TEXT("✘ C# 게임 서버 미응답 — server 모드 확인"); return; }

        const auto BuildBoard = [this, Api]()
        {
            Api->FetchStatic([this](TSharedPtr<FJsonObject> Static)
            {
                if (MapActor) MapActor->BuildFromStatic(Static);
                RefreshState();
            });
        };

        if (Info->GetBoolField(TEXT("has_campaign")))
        {
            BuildBoard();
        }
        else
        {
            // M1: solo 조선 자동 시작 (세력 선택 UI 는 M2)
            Api->NewCampaign(TEXT("joseon"), FString(), [BuildBoard](TSharedPtr<FJsonObject>) { BuildBoard(); });
        }
    });
}

void AWCGameMode::RefreshState()
{
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->FetchState(
        [this](TSharedPtr<FJsonObject> State) { OnState(State); });
}

void AWCGameMode::OnState(TSharedPtr<FJsonObject> State)
{
    bBusy = false;
    if (!State.IsValid()) { HudLine = TEXT("✘ 상태 조회 실패"); return; }

    if (MapActor) MapActor->ApplyState(State);

    const int32 Turn = static_cast<int32>(State->GetNumberField(TEXT("turn")));
    PendingActor.Empty();
    State->TryGetStringField(TEXT("pending_actor"), PendingActor);

    const TArray<TSharedPtr<FJsonValue>>* Winners = nullptr;
    if (State->TryGetArrayField(TEXT("winners"), Winners) && Winners && Winners->Num() > 0)
    {
        HudLine = FString::Printf(TEXT("🏆 게임 종료 — 승자: %s"), *(*Winners)[0]->AsString());
    }
    else
    {
        HudLine = FString::Printf(TEXT("%d턴 · 차례: %s   [Enter] 턴 종료"), Turn, *PendingActor);
    }
    UE_LOG(LogWorldConquest, Log, TEXT("상태 갱신 — %s"), *HudLine);

    // QA: -WCTurns=N 이면 샷 전에 N턴 자동 소화 (EndTurn 콜백이 다시 OnState 로 돌아와 루프)
    if (AutoTurnsRemaining < 0)
    {
        AutoTurnsRemaining = 0;
        FParse::Value(FCommandLine::Get(), TEXT("WCTurns="), AutoTurnsRemaining);
    }
    if (AutoTurnsRemaining > 0 && !PendingActor.IsEmpty())
    {
        AutoTurnsRemaining--;
        UE_LOG(LogWorldConquest, Log, TEXT("QA 자동 턴 진행 (잔여 %d)"), AutoTurnsRemaining);
        EndTurn();
        return;
    }
    ScheduleQaShotIfRequested();
}

void AWCGameMode::ScheduleQaShotIfRequested()
{
    if (bShotScheduled || !FParse::Param(FCommandLine::Get(), TEXT("WCShot"))) return;
    bShotScheduled = true;

    // 렌더 안정화 2초 후 촬영, 4초 후 종료 — AI 오프스크린 검증 루프의 표준 왕복
    FTimerHandle ShotTimer, QuitTimer;
    GetWorld()->GetTimerManager().SetTimer(ShotTimer, []()
    {
        FScreenshotRequest::RequestScreenshot(false);
        UE_LOG(LogWorldConquest, Log, TEXT("QA 스크린샷 요청 완료"));
    }, 2.0f, false);
    GetWorld()->GetTimerManager().SetTimer(QuitTimer, [this]()
    {
        UE_LOG(LogWorldConquest, Log, TEXT("QA 하네스 종료"));
        FPlatformMisc::RequestExit(false);
    }, 5.0f, false);
}

void AWCGameMode::EndTurn()
{
    if (bBusy || PendingActor.IsEmpty()) return;
    bBusy = true;
    HudLine = TEXT("턴 진행 중... (AI 세력 행동)");
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->SendCommand(
        PendingActor, TEXT("end"), {},
        [this](TSharedPtr<FJsonObject> Result) { OnState(Result.IsValid() ? Result->GetObjectField(TEXT("state")) : nullptr); });
}
