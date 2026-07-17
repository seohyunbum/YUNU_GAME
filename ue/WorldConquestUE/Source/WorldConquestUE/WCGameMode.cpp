#include "WCGameMode.h"
#include "WCApiSubsystem.h"
#include "WCMapActor.h"
#include "WCMainUI.h"
#include "WCCityView.h"
#include "WCRevealOverlay.h"
#include "WCPlayerController.h"
#include "WCHUD.h"
#include "Engine/GameViewportClient.h"
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
    BoardCamera = GetWorld()->SpawnActor<ACameraActor>(FVector(0, 0, 10000.0), FRotator(-90.f, 0.f, 0.f));
    if (BoardCamera)
    {
        UCameraComponent* Cam = BoardCamera->GetCameraComponent();
        Cam->ProjectionMode = ECameraProjectionMode::Orthographic;
        Cam->OrthoWidth = 21000.f;   // 지도 평면 20000(등장방형 2:1) + 여백
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTarget(BoardCamera);
    }

    MapActor = GetWorld()->SpawnActor<AWCMapActor>(FVector::ZeroVector, FRotator::ZeroRotator);

    // KOEI 식 메인 UI (Slate — 코드 퍼스트). Playing 단계에서만 보임.
    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCMainUI).GameMode(this), 10);
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCCityView).GameMode(this), 20);   // 도시 화면
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCRevealOverlay).GameMode(this), 30);   // 리빌 — 최상위
    }

    BootSequence();
}

void AWCGameMode::BootSequence()
{
    UWCApiSubsystem* Api = GetGameInstance()->GetSubsystem<UWCApiSubsystem>();
    HudLine = TEXT("게임 서버 시작 중...");

    // 서버가 없으면 자식 프로세스로 자동 스폰 — 가족용 원클릭 실행 (ue5-client-design §4)
    Api->EnsureServer([this, Api](TSharedPtr<FJsonObject> Info)
    {
        if (!Info.IsValid()) { HudLine = TEXT("✘ 게임 서버 실행 실패 — deploy-local.py 재실행 필요"); return; }
        const bool bHasCampaign = Info->GetBoolField(TEXT("has_campaign"));

        // static 은 캠페인 무관 — 이름·보드(중립색)·컷씬·세력 목록을 먼저 준비
        Api->FetchStatic([this, bHasCampaign](TSharedPtr<FJsonObject> Static)
        {
            ParseNames(Static);
            if (MapActor) MapActor->BuildFromStatic(Static);

            if (bHasCampaign) { Phase = EWCPhase::Playing; RefreshState(); return; }

            // QA 하네스는 세력 선택을 건너뛰고 solo 조선 자동 시작 (기존 QA 시나리오 호환).
            // -WCShowSelect 는 예외 — 선택 화면 자체를 촬영.
            const TCHAR* Cmd = FCommandLine::Get();
            const bool bShowSelect = FParse::Param(Cmd, TEXT("WCShowSelect"));
            if (!bShowSelect &&
                (FParse::Param(Cmd, TEXT("WCShot")) || FString(Cmd).Contains(TEXT("WCCmd=")) ||
                 FString(Cmd).Contains(TEXT("WCTurns="))))
            {
                StartCampaign(TEXT("joseon"), FString());
                return;
            }
            Phase = EWCPhase::FactionSelect;
            HudLine = TEXT("세력을 선택하십시오");
            if (bShowSelect) ScheduleQaShotIfRequested();
        });
    });
}

void AWCGameMode::StartCampaign(const FString& P1, const FString& P2)
{
    Phase = EWCPhase::Playing;
    HudLine = TEXT("캠페인 생성 중...");
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->NewCampaign(P1, P2,
        [this](TSharedPtr<FJsonObject> Snap)
        {
            if (!Snap.IsValid()) { HudLine = TEXT("✘ 캠페인 생성 실패"); return; }
            OnState(Snap);
        });
}

void AWCGameMode::SelectFactionByIndex(int32 Index)
{
    if (Phase != EWCPhase::FactionSelect || !SelectableFactions.IsValidIndex(Index)) return;
    const FString Picked = SelectableFactions[Index];

    if (!bHotseat) { StartCampaign(Picked, FString()); return; }

    if (HotseatFirstPick.IsEmpty())
    {
        HotseatFirstPick = Picked;
        HudLine = FString::Printf(TEXT("1P = %s — 2P 세력을 선택하십시오"), *NameOf(FactionNames, Picked));
        return;
    }
    if (Picked == HotseatFirstPick) return;   // 같은 세력 불가 — 서버도 거부하지만 UI 에서 차단
    StartCampaign(HotseatFirstPick, Picked);
}

void AWCGameMode::ToggleHotseat()
{
    if (Phase != EWCPhase::FactionSelect) return;
    bHotseat = !bHotseat;
    HotseatFirstPick.Empty();
    HudLine = bHotseat ? TEXT("핫시트 2인 — 1P 세력을 선택하십시오") : TEXT("세력을 선택하십시오");
}

void AWCGameMode::ParseNames(const TSharedPtr<FJsonObject>& StaticJson)
{
    if (!StaticJson.IsValid()) return;
    for (const TSharedPtr<FJsonValue>& N : StaticJson->GetObjectField(TEXT("map"))->GetArrayField(TEXT("nodes")))
    {
        const TSharedPtr<FJsonObject> Node = N->AsObject();
        const FString Id = Node->GetStringField(TEXT("id"));
        ProvinceNames.Add(Id, Node->GetStringField(TEXT("name_ko")));

        FWCNodeInfo Info;   // 도시 화면 헤더용 불변 정보
        Node->TryGetStringField(TEXT("terrain"), Info.Terrain);
        Node->TryGetBoolField(TEXT("port"), Info.bPort);
        double Num = 0;
        if (Node->TryGetNumberField(TEXT("population"), Num)) Info.Population = static_cast<int32>(Num);
        const TSharedPtr<FJsonObject>* Prod = nullptr;
        if (Node->TryGetObjectField(TEXT("production"), Prod) && Prod)
        {
            Info.Gold = static_cast<int32>((*Prod)->GetNumberField(TEXT("gold")));
            Info.Food = static_cast<int32>((*Prod)->GetNumberField(TEXT("food")));
        }
        NodeInfos.Add(Id, Info);
    }
    for (const TSharedPtr<FJsonValue>& F : StaticJson->GetArrayField(TEXT("factions")))
    {
        const TSharedPtr<FJsonObject> Faction = F->AsObject();
        FactionNames.Add(Faction->GetStringField(TEXT("id")), Faction->GetStringField(TEXT("name_ko")));
        if (Faction->GetBoolField(TEXT("player_selectable")))
            SelectableFactions.Add(Faction->GetStringField(TEXT("id")));
    }
    for (const TSharedPtr<FJsonValue>& C : StaticJson->GetArrayField(TEXT("characters")))
    {
        const TSharedPtr<FJsonObject> Ch = C->AsObject();
        CharacterNames.Add(Ch->GetStringField(TEXT("id")), Ch->GetStringField(TEXT("name_ko")));
        CharacterRarity.Add(Ch->GetStringField(TEXT("id")), static_cast<int32>(Ch->GetNumberField(TEXT("rarity"))));
    }

    // 징병 병종 목록 (육상만 — 함선 건조 UI 는 후속)
    for (const TSharedPtr<FJsonValue>& U : StaticJson->GetArrayField(TEXT("units")))
    {
        const TSharedPtr<FJsonObject> Unit = U->AsObject();
        UnitNames.Add(Unit->GetStringField(TEXT("id")), Unit->GetStringField(TEXT("name_ko")));
        if (Unit->GetStringField(TEXT("domain")) == TEXT("land"))
            LandUnitIds.Add(Unit->GetStringField(TEXT("id")));
    }
    // 컷씬 대본 — CutsceneTriggered 이벤트의 id 로 조회해 오버레이 재생 (§5.7 Presentation 소비)
    for (const TSharedPtr<FJsonValue>& C : StaticJson->GetArrayField(TEXT("cutscenes")))
    {
        const TSharedPtr<FJsonObject> Obj = C->AsObject();
        FWCCutscene Scene;
        Obj->TryGetStringField(TEXT("title_ko"), Scene.TitleKo);
        Obj->TryGetStringField(TEXT("title_card"), Scene.TitleCard);
        for (const TSharedPtr<FJsonValue>& L : Obj->GetArrayField(TEXT("lines")))
        {
            FWCCutsceneLine Line;
            L->AsObject()->TryGetStringField(TEXT("speaker"), Line.Speaker);
            L->AsObject()->TryGetStringField(TEXT("text_ko"), Line.TextKo);
            if (!Line.TextKo.IsEmpty()) Scene.Lines.Add(Line);
        }
        Cutscenes.Add(Obj->GetStringField(TEXT("id")), Scene);
    }

    QuickSavePath = FPlatformMisc::GetEnvironmentVariable(TEXT("USERPROFILE")) / TEXT("WorldConquest/saves/quick.json");
    UpdateModeLine();

    // QA: -WCCutscene=<id> — 임의 컷씬 강제 재생 (표현층 시각 검증 전용, 게임 규칙 무관)
    FString QaCutscene;
    if (FParse::Value(FCommandLine::Get(), TEXT("WCCutscene="), QaCutscene) && !QaCutscene.IsEmpty())
        StartCutscene(QaCutscene);
}

void AWCGameMode::StartCutscene(const FString& Id)
{
    if (!Cutscenes.Contains(Id)) return;
    ActiveCutscene = FWCActiveCutscene{ Id, 0 };
    // 라인당 3.5초 자동 진행 (클릭으로 즉시 다음)
    GetWorld()->GetTimerManager().SetTimer(CutsceneTimer, this, &AWCGameMode::AdvanceCutscene, 3.5f, true);
}

void AWCGameMode::TryStartNextCutscene()
{
    if (ActiveReveal.IsSet()) return;   // 리빌 연출 우선 — 소진 후 등장씬
    if (ActiveCutscene.IsSet() || CutsceneQueue.Num() == 0) return;
    const FString Next = CutsceneQueue[0];
    CutsceneQueue.RemoveAt(0);
    StartCutscene(Next);
}

void AWCGameMode::AdvanceCutscene()
{
    if (!ActiveCutscene.IsSet()) return;
    const FWCCutscene* Def = GetActiveCutsceneDef();
    if (!Def || ++ActiveCutscene->LineIndex >= Def->Lines.Num())
    {
        ActiveCutscene.Reset();
        GetWorld()->GetTimerManager().ClearTimer(CutsceneTimer);
        TryStartNextCutscene();
    }
}

const FWCCutscene* AWCGameMode::GetActiveCutsceneDef() const
{
    return ActiveCutscene.IsSet() ? Cutscenes.Find(ActiveCutscene->Id) : nullptr;
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

    // QA: -WCSelect=<id> 자동 선택 · -WCCity=<id> 도시 화면 자동 진입 (시각 검증)
    if (!bQaSelectDone)
    {
        bQaSelectDone = true;
        FString QaSelect;
        if (FParse::Value(FCommandLine::Get(), TEXT("WCSelect="), QaSelect) && !QaSelect.IsEmpty())
        {
            SelectedNodeId = QaSelect;
            UpdateSelectionInfo();
        }
        FString QaCity;
        if (FParse::Value(FCommandLine::Get(), TEXT("WCCity="), QaCity) && !QaCity.IsEmpty())
            EnterCity(QaCity);
        FString QaReveal;   // 리빌 연출 강제 (표현층 시각 검증 전용)
        if (FParse::Value(FCommandLine::Get(), TEXT("WCReveal="), QaReveal) && !QaReveal.IsEmpty())
        {
            FWCReveal Reveal;
            Reveal.CharId = QaReveal;
            Reveal.Name = NameOf(CharacterNames, QaReveal);
            Reveal.Rarity = CharacterRarity.FindRef(QaReveal);
            RevealQueue.Add(Reveal);
            TryStartNextReveal();
        }
    }

    // QA: -WCCmd="verb a b|verb c" — 명령 체인 자동 실행 (클릭 없이 명령 경로 시각 검증)
    RunQaCommandsIfRequested();
    if (QaCommands.Num() > 0) return;   // 명령 소진 후에야 턴·샷

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

void AWCGameMode::RunQaCommandsIfRequested()
{
    if (!bQaCmdParsed)
    {
        bQaCmdParsed = true;
        FString Script;
        FParse::Value(FCommandLine::Get(), TEXT("WCCmd="), Script);
        if (!Script.IsEmpty()) Script.ParseIntoArray(QaCommands, TEXT("|"));
    }
    if (QaCommands.Num() == 0 || bBusy || PendingActor.IsEmpty()) return;

    TArray<FString> Tokens;
    QaCommands[0].ParseIntoArray(Tokens, TEXT(" "));
    QaCommands.RemoveAt(0);
    if (Tokens.Num() == 0) return;
    const FString Verb = Tokens[0];
    Tokens.RemoveAt(0);
    UE_LOG(LogWorldConquest, Log, TEXT("QA 명령: %s (%d args, 잔여 %d)"), *Verb, Tokens.Num(), QaCommands.Num());
    SendVerb(Verb, Tokens);   // 콜백 → OnCommandResult → OnState → 다음 QA 명령
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
    if (UiInCity()) RefreshRates();   // 초빙·징병 후 주막 확률·천명 최신화
}

void AWCGameMode::AppendEvents(const TArray<TSharedPtr<FJsonValue>>& Events)
{
    for (const TSharedPtr<FJsonValue>& E : Events)
    {
        const TSharedPtr<FJsonObject> Event = E->AsObject();
        EventLog.Insert(EventToLine(Event), 0);
        const FString Type = Event->GetStringField(TEXT("type"));
        if (Type == TEXT("CutsceneTriggered"))
            CutsceneQueue.Add(Event->GetObjectField(TEXT("data"))->GetStringField(TEXT("cutscene")));
        else if (Type == TEXT("CharacterJoined"))
        {
            // 초빙 리빌 — 내 세력 합류만 연출 (AI 초빙은 로그로 충분)
            const TSharedPtr<FJsonObject> Data = Event->GetObjectField(TEXT("data"));
            FString Faction;
            Data->TryGetStringField(TEXT("faction"), Faction);
            if (Faction == PendingActor)
            {
                FWCReveal Reveal;
                Data->TryGetStringField(TEXT("character"), Reveal.CharId);
                Reveal.Name = NameOf(CharacterNames, Reveal.CharId);
                Reveal.Rarity = CharacterRarity.FindRef(Reveal.CharId);
                RevealQueue.Add(Reveal);
            }
        }
    }
    while (EventLog.Num() > EventLogMax) EventLog.RemoveAt(EventLog.Num() - 1);
    TryStartNextReveal();
    TryStartNextCutscene();
}

void AWCGameMode::TryStartNextReveal()
{
    if (ActiveReveal.IsSet() || RevealQueue.Num() == 0) return;
    ActiveReveal = RevealQueue[0];
    RevealQueue.RemoveAt(0);
}

void AWCGameMode::DismissReveal()
{
    ActiveReveal.Reset();
    TryStartNextReveal();
    TryStartNextCutscene();   // 리빌 소진 후 대기 중이던 등장씬 재생
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

    // 이동·공격 모드: 이번 클릭 = 목표 지정 (주어 = 선택 부대)
    if (ClickMode == EWCClickMode::MoveTarget && !SelectedArmyId.IsEmpty())
    {
        ClickMode = EWCClickMode::Normal;
        UpdateModeLine();
        SendVerb(TEXT("move"), { SelectedArmyId, NodeId });
        return;
    }
    if (ClickMode == EWCClickMode::AttackTarget && !SelectedArmyId.IsEmpty())
    {
        ClickMode = EWCClickMode::Normal;
        UpdateModeLine();
        SendVerb(TEXT("attack"), { SelectedArmyId, NodeId });
        return;
    }

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
    // 선택 영지의 "내(현재 차례 세력) 부대" 자동 선택 — 이동·공격의 주어
    SelectedArmyId.Empty();
    int32 Troops = 0;
    for (const TSharedPtr<FJsonValue>& A : LastState->GetArrayField(TEXT("armies")))
    {
        const TSharedPtr<FJsonObject> Army = A->AsObject();
        if (Army->GetStringField(TEXT("location")) != SelectedNodeId) continue;
        Troops += static_cast<int32>(Army->GetNumberField(TEXT("total_troops")));
        if (SelectedArmyId.IsEmpty() && Army->GetStringField(TEXT("faction_id")) == PendingActor)
            SelectedArmyId = Army->GetStringField(TEXT("id"));
    }

    HudSelection = FString::Printf(TEXT("▶ %s — 소유: %s%s%s"),
        *NameOf(ProvinceNames, SelectedNodeId), *OwnerName,
        Troops > 0 ? *FString::Printf(TEXT(" · 주둔 %d"), Troops) : TEXT(""),
        SelectedArmyId.IsEmpty() ? TEXT("") : *FString::Printf(TEXT(" · 아군부대 %s"), *SelectedArmyId));
}

void AWCGameMode::RecruitSelected(int32 Count)
{
    if (SelectedNodeId.IsEmpty() || LandUnitIds.Num() == 0) return;
    SendVerb(TEXT("recruit"), { SelectedNodeId, LandUnitIds[RecruitUnitIndex], FString::FromInt(Count) });
}

void AWCGameMode::CycleRecruitUnit()
{
    if (LandUnitIds.Num() == 0) return;
    RecruitUnitIndex = (RecruitUnitIndex + 1) % LandUnitIds.Num();
    UpdateModeLine();
}

void AWCGameMode::BuildSelected(const FString& Facility)
{
    if (SelectedNodeId.IsEmpty()) return;
    SendVerb(TEXT("build"), { SelectedNodeId, Facility });
}

void AWCGameMode::SummonOnce()
{
    SendVerb(TEXT("summon"), { TEXT("1") });
}

void AWCGameMode::BeginMoveMode()
{
    if (UiInCity()) return;   // 이동·공격 목표 지정은 지도 화면 전용
    if (SelectedArmyId.IsEmpty()) { EventLog.Insert(TEXT("✘ 먼저 아군 부대가 있는 영지를 선택"), 0); return; }
    ClickMode = EWCClickMode::MoveTarget;
    UpdateModeLine();
}

void AWCGameMode::BeginAttackMode()
{
    if (UiInCity()) return;
    if (SelectedArmyId.IsEmpty()) { EventLog.Insert(TEXT("✘ 먼저 아군 부대가 있는 영지를 선택"), 0); return; }
    ClickMode = EWCClickMode::AttackTarget;
    UpdateModeLine();
}

void AWCGameMode::CancelMode()
{
    if (UiInCity()) { LeaveCity(); return; }   // 도시 화면에서 ESC = 지도 복귀
    ClickMode = EWCClickMode::Normal;
    UpdateModeLine();
}

void AWCGameMode::HandleNodeDoubleClick(const UPrimitiveComponent* Component)
{
    if (!MapActor || !Component || UiInCity()) return;
    const FString NodeId = MapActor->FindNodeIdByComponent(Component);
    if (NodeId.IsEmpty()) return;
    SelectedNodeId = NodeId;
    UpdateSelectionInfo();
    if (UiCanEnterSelected()) EnterCity(NodeId);
}

void AWCGameMode::QuickSave()
{
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->SaveGame(QuickSavePath,
        [this](TSharedPtr<FJsonObject> R)
        {
            EventLog.Insert(R.IsValid() && R->GetStringField(TEXT("status")) == TEXT("ok")
                ? TEXT("💾 저장 완료 (quick)") : TEXT("✘ 저장 실패"), 0);
        });
}

void AWCGameMode::QuickLoad()
{
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->LoadGame(QuickSavePath,
        [this](TSharedPtr<FJsonObject> State)
        {
            if (!State.IsValid()) { EventLog.Insert(TEXT("✘ 로드 실패 (저장 파일 없음?)"), 0); return; }
            EventLog.Insert(TEXT("📂 이어하기 (quick)"), 0);
            OnState(State);
            UpdateSelectionInfo();
        });
}

void AWCGameMode::UpdateModeLine()
{
    const FString UnitName = LandUnitIds.IsValidIndex(RecruitUnitIndex)
        ? NameOf(UnitNames, LandUnitIds[RecruitUnitIndex]) : TEXT("-");
    switch (ClickMode)
    {
        case EWCClickMode::MoveTarget:
            HudModeLine = FString::Printf(TEXT("🎯 이동 목표를 클릭하십시오 (%s)  [ESC] 취소"), *SelectedArmyId); break;
        case EWCClickMode::AttackTarget:
            HudModeLine = FString::Printf(TEXT("⚔ 공격 목표를 클릭하십시오 (%s)  [ESC] 취소"), *SelectedArmyId); break;
        default:
            HudModeLine = FString::Printf(
                TEXT("[R]징병10 [T]50 (병종:%s [U]변경) [M]이동 [A]공격 [B]시장 [N]농지 [S]초빙 [F5]저장 [F9]로드"), *UnitName);
            break;
    }
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

// ───────── 도시(거점) 화면 ─────────

bool AWCGameMode::UiCanEnterSelected() const
{
    if (SelectedNodeId.IsEmpty() || !LastState.IsValid() || PendingActor.IsEmpty()) return false;
    for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
    {
        const TSharedPtr<FJsonObject> Province = P->AsObject();
        if (Province->GetStringField(TEXT("id")) != SelectedNodeId) continue;
        FString OwnerId;
        return Province->TryGetStringField(TEXT("owner_faction_id"), OwnerId) && OwnerId == PendingActor;
    }
    return false;
}

void AWCGameMode::EnterCity(const FString& NodeId)
{
    EnteredCityId = NodeId;
    SelectedNodeId = NodeId;
    UpdateSelectionInfo();
    RefreshRates();   // 주막 확률 공시 (§2.8.6)
}

void AWCGameMode::LeaveCity()
{
    EnteredCityId.Empty();
}

void AWCGameMode::RefreshRates()
{
    if (PendingActor.IsEmpty()) return;
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->FetchRates(PendingActor,
        [this](TSharedPtr<FJsonObject> R)
        {
            if (!R.IsValid()) { CityRatesText = TEXT("(확률 조회 실패)"); return; }
            RateMandate = static_cast<int32>(R->GetNumberField(TEXT("mandate")));
            RateCost = static_cast<int32>(R->GetNumberField(TEXT("cost_single")));
            RatePity = static_cast<int32>(R->GetNumberField(TEXT("pity_count")));
            RateHardPity = static_cast<int32>(R->GetNumberField(TEXT("hard_pity")));
            RatePool = static_cast<int32>(R->GetNumberField(TEXT("pool_total")));
            RateRows.Reset();
            for (const TSharedPtr<FJsonValue>& Rate : R->GetArrayField(TEXT("rates")))
            {
                const TSharedPtr<FJsonObject> Obj = Rate->AsObject();
                FWCRateRow Row;
                Row.Rarity = static_cast<int32>(Obj->GetNumberField(TEXT("rarity")));
                Row.Permyriad = static_cast<int32>(Obj->GetNumberField(TEXT("permyriad")));
                Row.Remaining = static_cast<int32>(Obj->GetNumberField(TEXT("remaining")));
                RateRows.Add(Row);
            }
            CityRatesText = RatePool == 0 ? TEXT("천하의 인재를 모두 만났습니다 — 풀 소진") : TEXT("");
        });
}

FText AWCGameMode::UiPityText() const
{
    if (RatePool == 0) return FText::FromString(TEXT("풀 소진"));
    return FText::FromString(FString::Printf(TEXT("천장 %d / %d — 다음 ★5까지 최대 %d회"),
        RatePity, RateHardPity, RateHardPity - RatePity));
}

FText AWCGameMode::UiMandateText() const
{
    return FText::FromString(FString::Printf(TEXT("천명 %d · 초빙 1회 %d"), RateMandate, RateCost));
}

FLinearColor AWCGameMode::UiFactionColor() const
{
    return MapActor ? MapActor->GetFactionColor(PendingActor) : FLinearColor::Gray;
}

TArray<AWCGameMode::FWCCharCard> AWCGameMode::UiMyCharacterCards() const
{
    TArray<FWCCharCard> Cards;
    if (!LastState.IsValid() || PendingActor.IsEmpty()) return Cards;
    const TSharedPtr<FJsonObject>* Owners = nullptr;
    if (LastState->TryGetObjectField(TEXT("character_owners"), Owners) && Owners)
        for (const auto& Pair : (*Owners)->Values)
            if (Pair.Value->AsString() == PendingActor)
            {
                FWCCharCard Card;
                Card.Id = FString(Pair.Key);
                Card.Name = NameOf(CharacterNames, Card.Id);
                Card.Rarity = CharacterRarity.FindRef(Card.Id);
                Cards.Add(Card);
            }
    Cards.Sort([](const FWCCharCard& A, const FWCCharCard& B) { return A.Rarity > B.Rarity; });
    return Cards;
}

TArray<AWCGameMode::FWCArmyCard> AWCGameMode::UiCityArmyCards() const
{
    TArray<FWCArmyCard> Cards;
    if (EnteredCityId.IsEmpty() || !LastState.IsValid()) return Cards;
    for (const TSharedPtr<FJsonValue>& A : LastState->GetArrayField(TEXT("armies")))
    {
        const TSharedPtr<FJsonObject> Army = A->AsObject();
        if (Army->GetStringField(TEXT("location")) != EnteredCityId) continue;
        FWCArmyCard Card;
        Card.Id = Army->GetStringField(TEXT("id"));
        Card.Troops = static_cast<int32>(Army->GetNumberField(TEXT("total_troops")));
        const TSharedPtr<FJsonObject>* UnitsObj = nullptr;
        if (Army->TryGetObjectField(TEXT("units"), UnitsObj) && UnitsObj)
            for (const auto& Pair : (*UnitsObj)->Values)
                Card.Detail += FString::Printf(TEXT("%s %d   "), *NameOf(UnitNames, FString(Pair.Key)),
                    static_cast<int32>(Pair.Value->AsNumber()));
        FString Commander;
        if (Army->TryGetStringField(TEXT("commander_id"), Commander) && !Commander.IsEmpty())
            Card.Commander = NameOf(CharacterNames, Commander);
        Cards.Add(Card);
    }
    return Cards;
}

TArray<AWCGameMode::FWCFacilityRow> AWCGameMode::UiCityFacilityRows() const
{
    TArray<FWCFacilityRow> Rows;
    if (EnteredCityId.IsEmpty() || !LastState.IsValid()) return Rows;
    for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
    {
        const TSharedPtr<FJsonObject> Province = P->AsObject();
        if (Province->GetStringField(TEXT("id")) != EnteredCityId) continue;
        const TSharedPtr<FJsonObject>* Facilities = nullptr;
        if (Province->TryGetObjectField(TEXT("facilities"), Facilities) && Facilities)
            for (const auto& Pair : (*Facilities)->Values)
            {
                const FString Kind(Pair.Key);
                FWCFacilityRow Row;
                Row.NameKo = Kind == TEXT("market") ? TEXT("시장") : Kind == TEXT("farm") ? TEXT("농지") : Kind;
                Row.Level = static_cast<int32>(Pair.Value->AsNumber());
                Rows.Add(Row);
            }
        break;
    }
    return Rows;
}

FText AWCGameMode::UiCityHeader() const
{
    if (EnteredCityId.IsEmpty()) return FText::GetEmpty();
    const FWCNodeInfo* Info = NodeInfos.Find(EnteredCityId);
    FString OwnerName = TEXT("공백지");
    if (LastState.IsValid())
        for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
        {
            const TSharedPtr<FJsonObject> Province = P->AsObject();
            if (Province->GetStringField(TEXT("id")) != EnteredCityId) continue;
            FString OwnerId;
            if (Province->TryGetStringField(TEXT("owner_faction_id"), OwnerId) && !OwnerId.IsEmpty())
                OwnerName = NameOf(FactionNames, OwnerId);
            break;
        }
    return FText::FromString(FString::Printf(TEXT("%s — %s%s%s"),
        *NameOf(ProvinceNames, EnteredCityId), *OwnerName,
        Info && Info->Population > 0 ? *FString::Printf(TEXT(" · 인구 %s"), *FText::AsNumber(Info->Population).ToString()) : TEXT(""),
        Info && Info->bPort ? TEXT(" · 항구") : TEXT("")));
}

FText AWCGameMode::UiCityFacilities() const
{
    if (EnteredCityId.IsEmpty() || !LastState.IsValid()) return FText::GetEmpty();
    const FWCNodeInfo* Info = NodeInfos.Find(EnteredCityId);
    FString Text = Info ? FString::Printf(TEXT("기본 생산: 금 %d · 식량 %d\n\n시설:\n"), Info->Gold, Info->Food) : TEXT("시설:\n");
    bool bAny = false;
    for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
    {
        const TSharedPtr<FJsonObject> Province = P->AsObject();
        if (Province->GetStringField(TEXT("id")) != EnteredCityId) continue;
        const TSharedPtr<FJsonObject>* Facilities = nullptr;
        if (Province->TryGetObjectField(TEXT("facilities"), Facilities) && Facilities)
            for (const auto& Pair : (*Facilities)->Values)
            {
                Text += FString::Printf(TEXT("  %s Lv%d\n"),
                    Pair.Key == TEXT("market") ? TEXT("시장") : Pair.Key == TEXT("farm") ? TEXT("농지") : *Pair.Key,
                    static_cast<int32>(Pair.Value->AsNumber()));
                bAny = true;
            }
        break;
    }
    if (!bAny) Text += TEXT("  (없음 — 아래에서 건설)");
    return FText::FromString(Text);
}

FText AWCGameMode::UiCityArmies() const
{
    if (EnteredCityId.IsEmpty() || !LastState.IsValid()) return FText::GetEmpty();
    FString Text;
    for (const TSharedPtr<FJsonValue>& A : LastState->GetArrayField(TEXT("armies")))
    {
        const TSharedPtr<FJsonObject> Army = A->AsObject();
        if (Army->GetStringField(TEXT("location")) != EnteredCityId) continue;
        FString Units;
        const TSharedPtr<FJsonObject>* UnitsObj = nullptr;
        if (Army->TryGetObjectField(TEXT("units"), UnitsObj) && UnitsObj)
            for (const auto& Pair : (*UnitsObj)->Values)
                Units += FString::Printf(TEXT("%s %d  "), *NameOf(UnitNames, FString(Pair.Key)),
                    static_cast<int32>(Pair.Value->AsNumber()));
        FString Commander;
        Army->TryGetStringField(TEXT("commander_id"), Commander);
        Text += FString::Printf(TEXT("⚔ %s — %s%s\n"), *Army->GetStringField(TEXT("id")), *Units,
            Commander.IsEmpty() ? TEXT("") : *FString::Printf(TEXT("· 지휘 %s"), *NameOf(CharacterNames, Commander)));
    }
    return FText::FromString(Text.IsEmpty() ? TEXT("(주둔 부대 없음 — 아래에서 징병)") : Text);
}

FText AWCGameMode::UiCityCharacters() const
{
    if (!LastState.IsValid() || PendingActor.IsEmpty()) return FText::GetEmpty();
    FString Text;
    const TSharedPtr<FJsonObject>* Owners = nullptr;
    if (LastState->TryGetObjectField(TEXT("character_owners"), Owners) && Owners)
        for (const auto& Pair : (*Owners)->Values)
            if (Pair.Value->AsString() == PendingActor)
            {
                const FString CharId(Pair.Key);   // UE5.8: Values 키 = FStringType(UTF8)
                Text += FString::Printf(TEXT("★%d %s\n"), CharacterRarity.FindRef(CharId),
                    *NameOf(CharacterNames, CharId));
            }
    return FText::FromString(Text.IsEmpty() ? TEXT("(소속 무장 없음)") : Text);
}

FText AWCGameMode::UiCityRates() const
{
    return FText::FromString(CityRatesText);
}

FText AWCGameMode::UiTurnText() const
{
    if (!LastState.IsValid()) return FText::FromString(HudLine);
    const int32 Turn = static_cast<int32>(LastState->GetNumberField(TEXT("turn")));
    return FText::FromString(FString::Printf(TEXT("%d턴 · %s 차례"), Turn, *NameOf(FactionNames, PendingActor)));
}

FText AWCGameMode::UiResourceText() const
{
    if (!LastState.IsValid() || PendingActor.IsEmpty()) return FText::GetEmpty();
    for (const TSharedPtr<FJsonValue>& F : LastState->GetArrayField(TEXT("factions")))
    {
        const TSharedPtr<FJsonObject> Faction = F->AsObject();
        if (Faction->GetStringField(TEXT("id")) != PendingActor) continue;
        return FText::FromString(FString::Printf(TEXT("금 %d   식량 %d   천명 %d"),
            static_cast<int32>(Faction->GetNumberField(TEXT("treasury"))),
            static_cast<int32>(Faction->GetNumberField(TEXT("food"))),
            static_cast<int32>(Faction->GetNumberField(TEXT("mandate")))));
    }
    return FText::GetEmpty();
}

FText AWCGameMode::UiSelectionTitle() const
{
    if (SelectedNodeId.IsEmpty()) return FText::GetEmpty();
    return FText::FromString(NameOf(ProvinceNames, SelectedNodeId));
}

FText AWCGameMode::UiSelectionDetail() const
{
    return FText::FromString(HudSelection);
}

FText AWCGameMode::UiRecruitUnitText() const
{
    const FString UnitName = LandUnitIds.IsValidIndex(RecruitUnitIndex)
        ? NameOf(UnitNames, LandUnitIds[RecruitUnitIndex]) : TEXT("-");
    return FText::FromString(FString::Printf(TEXT("병종: %s ▸"), *UnitName));
}

void AWCGameMode::ZoomCamera(float WheelDelta)
{
    if (!BoardCamera || FMath::IsNearlyZero(WheelDelta)) return;
    UCameraComponent* Cam = BoardCamera->GetCameraComponent();
    Cam->OrthoWidth = FMath::Clamp(Cam->OrthoWidth * (1.f - WheelDelta * 0.12f), 2500.f, 21000.f);
}

void AWCGameMode::PanCamera(float DeltaX, float DeltaY)
{
    if (!BoardCamera) return;
    const float Scale = BoardCamera->GetCameraComponent()->OrthoWidth / 1200.f;   // 줌 비례 감도
    FVector Pos = BoardCamera->GetActorLocation();
    Pos.Y -= DeltaX * Scale;        // 마우스 우 = 지도 좌로 끌기
    Pos.X += DeltaY * Scale;        // 마우스 상 = 지도 아래로 끌기 (드래그 관성 방향)
    Pos.X = FMath::Clamp(Pos.X, -5200.0, 5200.0);
    Pos.Y = FMath::Clamp(Pos.Y, -10200.0, 10200.0);
    BoardCamera->SetActorLocation(Pos);
}

void AWCGameMode::ScheduleQaShotIfRequested()
{
    if (bShotScheduled || !FParse::Param(FCommandLine::Get(), TEXT("WCShot"))) return;
    bShotScheduled = true;

    FTimerHandle ShotTimer, QuitTimer;
    GetWorld()->GetTimerManager().SetTimer(ShotTimer, []()
    {
        FScreenshotRequest::RequestScreenshot(true);   // true = Slate UI 포함 (false 는 UI 제외 캡처)
        UE_LOG(LogWorldConquest, Log, TEXT("QA 스크린샷 요청 완료"));
    }, 2.0f, false);
    GetWorld()->GetTimerManager().SetTimer(QuitTimer, [this]()
    {
        UE_LOG(LogWorldConquest, Log, TEXT("QA 하네스 종료"));
        FPlatformMisc::RequestExit(false);
    }, 5.0f, false);
}
