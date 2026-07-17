#include "WCGameMode.h"
#include "WCApiSubsystem.h"
#include "WCMapActor.h"
#include "WCPlayerController.h"
#include "WCHUD.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/DirectionalLight.h"
#include "Components/LightComponent.h"
#include "Components/PrimitiveComponent.h"

DEFINE_LOG_CATEGORY_STATIC(LogWorldConquest, Log, All);

namespace
{
    constexpr int32 EventLogMax = 10;
}

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
        Sun->GetLightComponent()->SetCastShadows(false);
    }

    // 직교 탑다운 카메라 — BoardToWorld 매핑과 짝: 화면 위 = +X(북), 화면 오른쪽 = +Y(동).
    if (ACameraActor* Camera = GetWorld()->SpawnActor<ACameraActor>(
            FVector(0, 0, 10000.0), FRotator(-90.f, 0.f, 0.f)))
    {
        UCameraComponent* Cam = Camera->GetCameraComponent();
        Cam->ProjectionMode = ECameraProjectionMode::Orthographic;
        Cam->OrthoWidth = 23000.f;
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTarget(Camera);
    }

    MapActor = GetWorld()->SpawnActor<AWCMapActor>(FVector::ZeroVector, FRotator::ZeroRotator);
    BootSequence();
}

void AWCGameMode::BootSequence()
{
    UWCApiSubsystem* Api = GetGameInstance()->GetSubsystem<UWCApiSubsystem>();
    HudLine = TEXT("게임 서버 시작 중...");

    // M2: 서버가 없으면 자식 프로세스로 자동 스폰 — 가족용 원클릭 실행 (ue5-client-design §4)
    Api->EnsureServer([this, Api](TSharedPtr<FJsonObject> Info)
    {
        if (!Info.IsValid()) { HudLine = TEXT("✘ 게임 서버 실행 실패 — deploy-local.py 재실행 필요"); return; }

        const auto BuildBoard = [this, Api]()
        {
            Api->FetchStatic([this](TSharedPtr<FJsonObject> Static)
            {
                ParseNames(Static);
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
            // M2 임시: solo 조선 자동 시작 (세력 선택 화면은 M2 후반)
            Api->NewCampaign(TEXT("joseon"), FString(), [BuildBoard](TSharedPtr<FJsonObject>) { BuildBoard(); });
        }
    });
}

void AWCGameMode::ParseNames(const TSharedPtr<FJsonObject>& StaticJson)
{
    if (!StaticJson.IsValid()) return;
    for (const TSharedPtr<FJsonValue>& N : StaticJson->GetObjectField(TEXT("map"))->GetArrayField(TEXT("nodes")))
        ProvinceNames.Add(N->AsObject()->GetStringField(TEXT("id")), N->AsObject()->GetStringField(TEXT("name_ko")));
    for (const TSharedPtr<FJsonValue>& F : StaticJson->GetArrayField(TEXT("factions")))
        FactionNames.Add(F->AsObject()->GetStringField(TEXT("id")), F->AsObject()->GetStringField(TEXT("name_ko")));
    for (const TSharedPtr<FJsonValue>& C : StaticJson->GetArrayField(TEXT("characters")))
        CharacterNames.Add(C->AsObject()->GetStringField(TEXT("id")), C->AsObject()->GetStringField(TEXT("name_ko")));
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
    LastState = State;

    if (MapActor) MapActor->ApplyState(State);

    const int32 Turn = static_cast<int32>(State->GetNumberField(TEXT("turn")));
    PendingActor.Empty();
    State->TryGetStringField(TEXT("pending_actor"), PendingActor);

    const TArray<TSharedPtr<FJsonValue>>* Winners = nullptr;
    if (State->TryGetArrayField(TEXT("winners"), Winners) && Winners && Winners->Num() > 0)
    {
        HudLine = FString::Printf(TEXT("🏆 게임 종료 — 승자: %s"), *NameOf(FactionNames, (*Winners)[0]->AsString()));
    }
    else
    {
        HudLine = FString::Printf(TEXT("%d턴 · 차례: %s   [클릭] 선택  [C] 점령  [Enter] 턴 종료"),
            Turn, *NameOf(FactionNames, PendingActor));
    }
    UE_LOG(LogWorldConquest, Log, TEXT("상태 갱신 — %s"), *HudLine);

    // QA: -WCSelect=<id> — 첫 상태에서 자동 선택 (선택 UI 시각 검증)
    if (!bQaSelectDone)
    {
        bQaSelectDone = true;
        FString QaSelect;
        if (FParse::Value(FCommandLine::Get(), TEXT("WCSelect="), QaSelect) && !QaSelect.IsEmpty())
        {
            SelectedNodeId = QaSelect;
            UpdateSelectionInfo();
        }
    }

    // QA: -WCTurns=N — 샷 전에 N턴 자동 소화
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

void AWCGameMode::OnCommandResult(TSharedPtr<FJsonObject> Result)
{
    bBusy = false;
    if (!Result.IsValid()) { HudLine = TEXT("✘ 명령 전송 실패"); return; }

    // 메시지·이벤트를 로그로 (연출은 이벤트가 SSOT — §4.3)
    FString Message;
    if (Result->TryGetStringField(TEXT("message"), Message) && !Message.IsEmpty()
        && Result->GetStringField(TEXT("status")) != TEXT("ok"))
        EventLog.Insert(FString::Printf(TEXT("✘ %s"), *Message), 0);

    const TArray<TSharedPtr<FJsonValue>>* Events = nullptr;
    if (Result->TryGetArrayField(TEXT("events"), Events) && Events)
        AppendEvents(*Events);

    const TSharedPtr<FJsonObject>* StateObj = nullptr;
    if (Result->TryGetObjectField(TEXT("state"), StateObj) && StateObj)
        OnState(*StateObj);
    UpdateSelectionInfo();
}

void AWCGameMode::AppendEvents(const TArray<TSharedPtr<FJsonValue>>& Events)
{
    for (const TSharedPtr<FJsonValue>& E : Events)
        EventLog.Insert(EventToLine(E->AsObject()), 0);
    while (EventLog.Num() > EventLogMax) EventLog.RemoveAt(EventLog.Num() - 1);
}

FString AWCGameMode::EventToLine(const TSharedPtr<FJsonObject>& Event) const
{
    const TSharedPtr<FJsonObject> Data = Event->GetObjectField(TEXT("data"));
    const FString Type = Event->GetStringField(TEXT("type"));
    const auto D = [&Data](const TCHAR* Key) { FString V; Data->TryGetStringField(Key, V); return V; };

    if (Type == TEXT("TurnStarted"))
        return FString::Printf(TEXT("── %s턴 시작 ──"), *D(TEXT("turn")));
    if (Type == TEXT("ProvinceCaptured"))
        return FString::Printf(TEXT("%s ▶ %s 점령%s"), *NameOf(FactionNames, D(TEXT("faction"))),
            *NameOf(ProvinceNames, D(TEXT("province"))), D(TEXT("bloodless")) == TEXT("true") ? TEXT(" (무혈)") : TEXT(""));
    if (Type == TEXT("CharacterJoined"))
        return FString::Printf(TEXT("★ %s, %s 합류"), *NameOf(CharacterNames, D(TEXT("character"))),
            *NameOf(FactionNames, D(TEXT("faction"))));
    if (Type == TEXT("CutsceneTriggered"))
        return FString::Printf(TEXT("『컷씬』 %s"), *D(TEXT("cutscene")));
    if (Type == TEXT("BattleEnded"))
        return FString::Printf(TEXT("⚔ %s 공방전 — %s"), *NameOf(ProvinceNames, D(TEXT("node"))),
            D(TEXT("attacker_won")) == TEXT("true") ? TEXT("공격 측 승리") : TEXT("수비 성공"));
    if (Type == TEXT("DuelStarted"))
        return FString::Printf(TEXT("⚡ 일기토! %s vs %s"), *NameOf(CharacterNames, D(TEXT("actor"))),
            *NameOf(CharacterNames, D(TEXT("opponent"))));
    if (Type == TEXT("GameEnded"))
        return FString::Printf(TEXT("🏆 세계 정복 — %s"), *D(TEXT("winners")));

    // 미지 타입 폴백 — 유실 없이 원형 표시 (신규 이벤트가 클라 수정 없이도 보인다)
    FString Line = Type;
    for (const auto& Pair : Data->Values)
        Line += FString::Printf(TEXT(" %s=%s"), *Pair.Key, *Pair.Value->AsString());
    return Line;
}

FString AWCGameMode::NameOf(const TMap<FString, FString>& Table, const FString& Id) const
{
    const FString* Name = Table.Find(Id);
    return Name ? *Name : Id;
}

void AWCGameMode::HandleNodeClick(const UPrimitiveComponent* Component)
{
    if (!MapActor || !Component) return;
    const FString NodeId = MapActor->FindNodeIdByComponent(Component);
    if (NodeId.IsEmpty()) return;
    SelectedNodeId = NodeId;
    UpdateSelectionInfo();
}

void AWCGameMode::UpdateSelectionInfo()
{
    if (SelectedNodeId.IsEmpty() || !LastState.IsValid()) { HudSelection.Empty(); return; }

    // 소유·시설·주둔 요약 — 전부 서버 스냅샷에서 (클라 로직 0)
    FString OwnerName = TEXT("공백지");
    for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
    {
        const TSharedPtr<FJsonObject> Province = P->AsObject();
        if (Province->GetStringField(TEXT("id")) != SelectedNodeId) continue;
        FString OwnerId;
        if (Province->TryGetStringField(TEXT("owner_faction_id"), OwnerId) && !OwnerId.IsEmpty())
            OwnerName = NameOf(FactionNames, OwnerId);
        break;
    }
    int32 Troops = 0;
    for (const TSharedPtr<FJsonValue>& A : LastState->GetArrayField(TEXT("armies")))
        if (A->AsObject()->GetStringField(TEXT("location")) == SelectedNodeId)
            Troops += static_cast<int32>(A->AsObject()->GetNumberField(TEXT("total_troops")));

    HudSelection = FString::Printf(TEXT("▶ %s — 소유: %s%s"),
        *NameOf(ProvinceNames, SelectedNodeId), *OwnerName,
        Troops > 0 ? *FString::Printf(TEXT(" · 주둔 %d"), Troops) : TEXT(""));
}

void AWCGameMode::SendVerb(const FString& Verb, const TArray<FString>& Args)
{
    if (bBusy || PendingActor.IsEmpty()) return;
    bBusy = true;
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->SendCommand(
        PendingActor, Verb, Args,
        [this](TSharedPtr<FJsonObject> Result) { OnCommandResult(Result); });
}

void AWCGameMode::EndTurn()
{
    if (bBusy || PendingActor.IsEmpty()) return;
    HudLine = TEXT("턴 진행 중... (AI 세력 행동)");
    SendVerb(TEXT("end"), {});
}

void AWCGameMode::CaptureSelected()
{
    if (SelectedNodeId.IsEmpty()) return;
    SendVerb(TEXT("capture"), { SelectedNodeId });
}

void AWCGameMode::ScheduleQaShotIfRequested()
{
    if (bShotScheduled || !FParse::Param(FCommandLine::Get(), TEXT("WCShot"))) return;
    bShotScheduled = true;

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
