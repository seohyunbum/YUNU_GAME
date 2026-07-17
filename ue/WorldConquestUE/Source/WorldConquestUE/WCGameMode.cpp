#include "WCGameMode.h"
#include "WCApiSubsystem.h"
#include "WCMapActor.h"
#include "WCCityDiorama.h"
#include "WCMainUI.h"
#include "WCCityView.h"
#include "WCRevealOverlay.h"
#include "WCTurnModals.h"
#include "WCBattleOverlay.h"
#include "WCPlayerController.h"
#include "WCHUD.h"
#include "Engine/GameViewportClient.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Engine/PostProcessVolume.h"
#include "Components/LightComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/VolumetricCloudComponent.h"
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

    // 화면 디버그 경고 억제 (라이팅 리빌드·다중 directional light 등 — 플레이 화면에 노출 금지)
    GAreScreenMessagesEnabled = false;
    if (GEngine) GEngine->bEnableOnScreenDebugMessages = false;

    // ── 시네마틱 환경 (전부 코드 스폰 — 코드-퍼스트) ──
    // 태양: 낮은 사선 + 그림자 → 지형 릴리프가 살아남. 대기 연동으로 일몰빛.
    if (ADirectionalLight* Sun = GetWorld()->SpawnActor<ADirectionalLight>(
            FVector::ZeroVector, FRotator(-32.f, 215.f, 0.f)))
    {
        UDirectionalLightComponent* SunComp = CastChecked<UDirectionalLightComponent>(Sun->GetLightComponent());
        SunComp->SetIntensity(6.0f);
        SunComp->SetCastShadows(true);
        SunComp->SetAtmosphereSunLight(true);   // SkyAtmosphere 연동
    }
    // 대기·하늘빛·안개·구름 — RTK 식 원경 무드
    if (AActor* Sky = GetWorld()->SpawnActor<AActor>())
    {
        USkyAtmosphereComponent* Atmo = NewObject<USkyAtmosphereComponent>(Sky);
        Atmo->RegisterComponent();
    }
    if (ASkyLight* SkyLight = GetWorld()->SpawnActor<ASkyLight>())
    {
        SkyLight->GetLightComponent()->SetIntensity(1.0f);   // 청색 하늘광 완화 (벽 세척 방지)
        SkyLight->GetLightComponent()->SetRealTimeCapture(true);
    }
    // 안개 최소 — 세계지도가 뿌옇게 세척되지 않도록 (데모 맵도 자체 안개를 가져오므로 내 것은 거의 0)
    if (AExponentialHeightFog* Fog = GetWorld()->SpawnActor<AExponentialHeightFog>())
    {
        Fog->GetComponent()->SetFogDensity(0.000003f);
        Fog->GetComponent()->SetFogHeightFalloff(0.02f);
        Fog->GetComponent()->SetFogMaxOpacity(0.35f);
    }
    if (AActor* Clouds = GetWorld()->SpawnActor<AActor>())
    {
        UVolumetricCloudComponent* Cloud = NewObject<UVolumetricCloudComponent>(Clouds);
        Cloud->RegisterComponent();
        Cloud->SetLayerBottomAltitude(8.0f);   // km — 지도 위 높은 구름층
        Cloud->SetLayerHeight(4.0f);
    }
    if (APostProcessVolume* Post = GetWorld()->SpawnActor<APostProcessVolume>())
    {
        Post->bUnbound = true;
        Post->Settings.bOverride_BloomIntensity = true;
        Post->Settings.BloomIntensity = 0.35f;
        Post->Settings.bOverride_AmbientOcclusionIntensity = true;
        Post->Settings.AmbientOcclusionIntensity = 0.7f;
        Post->Settings.bOverride_VignetteIntensity = true;
        Post->Settings.VignetteIntensity = 0.35f;
        // 노출 — 자동 적응하되 범위 제한 (세계지도 밝은 바다 세척 방지 + 도시 어둠 방지)
        Post->Settings.bOverride_AutoExposureMinBrightness = true;
        Post->Settings.AutoExposureMinBrightness = 0.5f;
        Post->Settings.bOverride_AutoExposureMaxBrightness = true;
        Post->Settings.AutoExposureMaxBrightness = 2.0f;
        Post->Settings.bOverride_AutoExposureBias = true;
        Post->Settings.AutoExposureBias = 0.0f;
        // 화이트밸런스 약간 따뜻하게 (청색 하늘광 상쇄)
        Post->Settings.bOverride_WhiteTemp = true;
        Post->Settings.WhiteTemp = 6900.f;
        Post->Settings.bOverride_ColorSaturation = true;
        Post->Settings.ColorSaturation = FVector4(1.12f, 1.12f, 1.12f, 1.0f);   // 채도 +12%
    }

    // ── 시네마틱 카메라: 원근 틸트(-52°) + 돌리 줌 (RTK14 앵글). 화면 위 ≈ 북쪽 유지 ──
    BoardCamera = GetWorld()->SpawnActor<ACameraActor>(FVector::ZeroVector, FRotator::ZeroRotator);
    if (BoardCamera)
    {
        UCameraComponent* Cam = BoardCamera->GetCameraComponent();
        Cam->ProjectionMode = ECameraProjectionMode::Perspective;
        Cam->SetFieldOfView(46.f);
        UpdateBoardCamera();
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTarget(BoardCamera);
    }

    MapActor = GetWorld()->SpawnActor<AWCMapActor>(FVector::ZeroVector, FRotator::ZeroRotator);

    // 도시 디오라마 — 지도에서 멀리 떨어진 곳(간섭 방지)에 1회 스폰. 도시 진입 시 전용 카메라가 비춤.
    const FVector DioramaOrigin(0, 0, 200000);
    Diorama = GetWorld()->SpawnActor<AWCCityDiorama>(DioramaOrigin, FRotator::ZeroRotator);
    CityCamera = GetWorld()->SpawnActor<ACameraActor>();
    if (CityCamera)
    {
        CityCamera->GetCameraComponent()->SetFieldOfView(50.f);
        const FTransform Vp = Diorama->GetViewpoint();   // 액터 월드 위치 기준 절대 트랜스폼
        CityCamera->SetActorLocationAndRotation(Vp.GetLocation(), Vp.Rotator());
    }

    // (디오라마 채움광 없음 — directional light 는 위치 무관 전역 조명이라 지도 태양이 이미 비춘다.
    //  두 번째 directional light 는 "다중 주광 경쟁" 경고를 유발하므로 스폰하지 않는다.)

    // KOEI 식 메인 UI (Slate — 코드 퍼스트). Playing 단계에서만 보임.
    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCMainUI).GameMode(this), 10);
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCCityView).GameMode(this), 20);   // 도시 화면
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCTurnReport).GameMode(this), 26);      // 턴 리포트
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCEndTurnConfirm).GameMode(this), 27);   // 턴 종료 확인
        GEngine->GameViewport->AddViewportWidgetContent(SNew(SWCBattleOverlay).GameMode(this), 28);   // 전투 결과
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
        Node->TryGetStringField(TEXT("region"), Info.Region);   // 거점 배경(디오라마) 선택 키
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
    if (ActiveBattle.IsSet() || ActiveReveal.IsSet()) return;   // 전투·리빌 우선 — 소진 후 컷씬
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
        HudLine = FString::Printf(TEXT("♛ 게임 종료 — 승자: %s"), *NameOf(FactionNames, (*Winners)[0]->AsString()));
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
        // QA: -WCLook=<노드id>[,거리] — 카메라 근접 (마커 디테일 촬영)
        FString QaLook;
        if (FParse::Value(FCommandLine::Get(), TEXT("WCLook="), QaLook) && !QaLook.IsEmpty())
        {
            FString NodeId = QaLook, DistStr;
            QaLook.Split(TEXT(","), &NodeId, &DistStr);
            if (MapActor)
                if (const FVector* NodePos = MapActor->GetNodePositions().Find(NodeId.IsEmpty() ? QaLook : NodeId))
                {
                    CamTarget = *NodePos;
                    CamDist = DistStr.IsEmpty() ? 5000.f : FCString::Atof(*DistStr);
                    UpdateBoardCamera();
                }
        }
        if (FParse::Param(FCommandLine::Get(), TEXT("WCBattle")))   // 전투 결과 화면 강제 (QA)
        {
            FWCBattle B;
            B.Node = TEXT("hanseong"); B.AtkFaction = TEXT("wei"); B.DefFaction = PendingActor;
            B.AtkBefore = 120; B.DefBefore = 80; B.AtkLosses = 45; B.DefLosses = 80;
            B.Rounds = 4; B.bAttackerWon = true; B.bMine = true;
            B.AtkCommander = TEXT("guan_yu"); B.DuelWinner = TEXT("guan_yu"); B.DuelLoser = TEXT("yi_sunsin");
            BattleQueue.Add(B);
            TryStartNextBattle();
        }
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

    // 성공한 내 명령을 "이번 달에 한 일" 로 (ux-design §3.1 — 행동력이 없으니 '한 일'을 보여준다)
    const bool bOk = Result->GetStringField(TEXT("status")) == TEXT("ok");
    if (bOk && LastVerb != TEXT("end") && LastVerb != TEXT("save") && LastVerb != TEXT("load"))
    {
        const FString Did = VerbToKoreanAction(LastVerb);
        if (!Did.IsEmpty()) MyTurnActions.Add(Did);
    }

    const TSharedPtr<FJsonObject>* StateObj = nullptr;
    if (Result->TryGetObjectField(TEXT("state"), StateObj) && StateObj)
        OnState(*StateObj);
    UpdateSelectionInfo();
    if (UiInCity()) RefreshRates();   // 초빙·징병 후 주막 확률·천명 최신화

    // 턴 종료 응답 → 그 사이 벌어진 일이 있으면 리포트를 띄운다 (없으면 띄우지 않는다)
    if (LastVerb == TEXT("end"))
    {
        MyTurnActions.Reset();
        bShowReport = Report.Battle.Num() + Report.World.Num() + Report.Home.Num() > 0;
        if (!bShowReport) EventLog.Insert(TEXT("조용한 한 달이었어요."), 0);
    }
}

void AWCGameMode::AppendEvents(const TArray<TSharedPtr<FJsonValue>>& Events)
{
    for (const TSharedPtr<FJsonValue>& E : Events)
    {
        const TSharedPtr<FJsonObject> Event = E->AsObject();
        EventLog.Insert(EventToLine(Event), 0);
        // 턴 종료 응답의 이벤트 = [4]AI·[5]해결·[6]이벤트에서 벌어진 일 → 턴 리포트 재료
        if (LastVerb == TEXT("end")) RouteReportEvent(Event);
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
        else if (Type == TEXT("BattleEnded"))
        {
            // 전투 결과 화면 — 내 세력이 관여한 전투만 연출 (AI끼리는 로그)
            const TSharedPtr<FJsonObject> D = Event->GetObjectField(TEXT("data"));
            FWCBattle B;
            D->TryGetStringField(TEXT("node"), B.Node);
            D->TryGetStringField(TEXT("attacker_faction"), B.AtkFaction);
            D->TryGetStringField(TEXT("defender_faction"), B.DefFaction);
            D->TryGetStringField(TEXT("attacker_commander"), B.AtkCommander);
            D->TryGetStringField(TEXT("defender_commander"), B.DefCommander);
            D->TryGetStringField(TEXT("duel_winner"), B.DuelWinner);
            D->TryGetStringField(TEXT("duel_loser"), B.DuelLoser);
            FString V;
            B.bAttackerWon = D->TryGetStringField(TEXT("attacker_won"), V) && V == TEXT("true");
            const auto Num = [&D](const TCHAR* K) { FString S; D->TryGetStringField(K, S); return FCString::Atoi(*S); };
            B.AtkBefore = Num(TEXT("attacker_before")); B.DefBefore = Num(TEXT("defender_before"));
            B.AtkLosses = Num(TEXT("attacker_losses")); B.DefLosses = Num(TEXT("defender_losses"));
            B.Rounds = Num(TEXT("rounds"));
            B.bMine = (B.AtkFaction == PendingActor || B.DefFaction == PendingActor);
            if (B.bMine && B.AtkBefore + B.DefBefore > 0) BattleQueue.Add(B);   // 무저항 함락(병력0)은 화면 생략
        }
    }
    while (EventLog.Num() > EventLogMax) EventLog.RemoveAt(EventLog.Num() - 1);
    TryStartNextBattle();
    TryStartNextReveal();
    TryStartNextCutscene();
}

void AWCGameMode::TryStartNextBattle()
{
    if (ActiveBattle.IsSet() || BattleQueue.Num() == 0) return;
    ActiveBattle = BattleQueue[0];
    BattleQueue.RemoveAt(0);
}

void AWCGameMode::DismissBattle()
{
    ActiveBattle.Reset();
    TryStartNextBattle();
    TryStartNextReveal();
    TryStartNextCutscene();
}

FText AWCGameMode::UiBattleTitle() const
{
    if (!ActiveBattle.IsSet()) return FText::GetEmpty();
    const auto& B = *ActiveBattle;
    const bool bWon = (B.AtkFaction == PendingActor) ? B.bAttackerWon : !B.bAttackerWon;
    return FText::FromString(FString::Printf(TEXT("%s 공방전 — %s"),
        *NameOf(ProvinceNames, B.Node), bWon ? TEXT("승 리") : TEXT("패 배")));
}

FText AWCGameMode::UiBattleAtkLine() const
{
    if (!ActiveBattle.IsSet()) return FText::GetEmpty();
    const auto& B = *ActiveBattle;
    const FString Cmd = B.AtkCommander.IsEmpty() ? FString() : FString::Printf(TEXT(" (%s)"), *NameOf(CharacterNames, B.AtkCommander));
    return FText::FromString(FString::Printf(TEXT("공격  %s%s\n%d  →  %d   (-%d)"),
        *NameOf(FactionNames, B.AtkFaction), *Cmd, B.AtkBefore, FMath::Max(0, B.AtkBefore - B.AtkLosses), B.AtkLosses));
}

FText AWCGameMode::UiBattleDefLine() const
{
    if (!ActiveBattle.IsSet()) return FText::GetEmpty();
    const auto& B = *ActiveBattle;
    const FString Cmd = B.DefCommander.IsEmpty() ? FString() : FString::Printf(TEXT(" (%s)"), *NameOf(CharacterNames, B.DefCommander));
    return FText::FromString(FString::Printf(TEXT("수비  %s%s\n%d  →  %d   (-%d)"),
        *NameOf(FactionNames, B.DefFaction), *Cmd, B.DefBefore, FMath::Max(0, B.DefBefore - B.DefLosses), B.DefLosses));
}

FText AWCGameMode::UiBattleFooter() const
{
    if (!ActiveBattle.IsSet()) return FText::GetEmpty();
    const auto& B = *ActiveBattle;
    FString Text = FString::Printf(TEXT("%d 라운드"), B.Rounds);
    if (!B.DuelWinner.IsEmpty())
        Text += FString::Printf(TEXT("   ·   ◆ 일기토: %s ▶ %s"),
            *NameOf(CharacterNames, B.DuelWinner), *NameOf(CharacterNames, B.DuelLoser));
    return FText::FromString(Text);
}

FLinearColor AWCGameMode::UiBattleAtkColor() const
{
    return ActiveBattle.IsSet() && MapActor ? MapActor->GetFactionColor(ActiveBattle->AtkFaction) : FLinearColor::White;
}

FLinearColor AWCGameMode::UiBattleDefColor() const
{
    return ActiveBattle.IsSet() && MapActor ? MapActor->GetFactionColor(ActiveBattle->DefFaction) : FLinearColor::White;
}

void AWCGameMode::TryStartNextReveal()
{
    if (ActiveBattle.IsSet()) return;   // 전투 결과 → 리빌 순
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
        return FString::Printf(TEXT("✕ %s 공방전 — %s"), *NameOf(ProvinceNames, D(TEXT("node"))),
            D(TEXT("attacker_won")) == TEXT("true") ? TEXT("공격 측 승리") : TEXT("수비 성공"));
    if (Type == TEXT("DuelStarted"))
        return FString::Printf(TEXT("◆ 일기토! %s vs %s"), *NameOf(CharacterNames, D(TEXT("actor"))),
            *NameOf(CharacterNames, D(TEXT("opponent"))));
    if (Type == TEXT("GameEnded"))
        return FString::Printf(TEXT("♛ 세계 정복 — %s"), *D(TEXT("winners")));

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
                ? TEXT("◈ 저장 완료 (quick)") : TEXT("✘ 저장 실패"), 0);
        });
}

void AWCGameMode::QuickLoad()
{
    GetGameInstance()->GetSubsystem<UWCApiSubsystem>()->LoadGame(QuickSavePath,
        [this](TSharedPtr<FJsonObject> State)
        {
            if (!State.IsValid()) { EventLog.Insert(TEXT("✘ 로드 실패 (저장 파일 없음?)"), 0); return; }
            EventLog.Insert(TEXT("▶ 이어하기 (quick)"), 0);
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
            HudModeLine = FString::Printf(TEXT("◎ 이동 목표를 클릭하십시오 (%s)  [ESC] 취소"), *SelectedArmyId); break;
        case EWCClickMode::AttackTarget:
            HudModeLine = FString::Printf(TEXT("✕ 공격 목표를 클릭하십시오 (%s)  [ESC] 취소"), *SelectedArmyId); break;
        default:
            HudModeLine = FString::Printf(
                TEXT("[R]징병10 [T]50 (병종:%s [U]변경) [M]이동 [A]공격 [B]시장 [N]농지 [S]초빙 [F5]저장 [F9]로드"), *UnitName);
            break;
    }
}

void AWCGameMode::SendVerb(const FString& Verb, const TArray<FString>& Args)
{
    LastVerb = Verb;
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
    Report = FWCReport();       // 이번 종료로 새로 벌어질 일만 담는다
    SendVerb(TEXT("end"), {});
}

// ── 턴 종료 확인 (ux-design §3.3) — 차단하지 않는다. 되돌릴 수 없음을 한 번 알릴 뿐 ──
void AWCGameMode::RequestEndTurn()
{
    if (bBusy || PendingActor.IsEmpty()) return;
    bConfirmEndTurn = true;
}

void AWCGameMode::ConfirmEndTurn()
{
    bConfirmEndTurn = false;
    EndTurn();
}

// ── 턴 흐름 안내 (ux-design §3.2) ──
// 페이즈 진행 애니메이션은 만들지 않는다 — 서버가 [4]~[1]을 한 응답에 원자 처리해
// 클라가 중간을 관측할 수 없다. 대신 "끝내면 무슨 일이 벌어지는지" 를 글로 예고한다.
FText AWCGameMode::UiNextUpText() const
{
    if (!UiIsPlaying() || PendingActor.IsEmpty()) return FText::GetEmpty();
    return FText::FromString(TEXT("턴을 끝내면 → 다른 나라들이 움직이고 → 부대 이동·전투 → 사건이 일어나요"));
}

FText AWCGameMode::UiFreeActionHint() const
{
    // 스펙 §2.2 — 행동력 개념 없음. 유일한 캡은 초빙(천명).
    return FText::FromString(TEXT("금·식량이 있으면 얼마든지 명령할 수 있어요. 횟수 제한은 없어요.\n(사람 부르기만 한 달에 10번까지)"));
}

FText AWCGameMode::UiMyTurnActionsText() const
{
    if (MyTurnActions.Num() == 0)
        return FText::FromString(TEXT("아직 아무것도 안 했어요."));
    FString S;
    for (const FString& A : MyTurnActions) S += FString::Printf(TEXT("· %s\n"), *A);
    return FText::FromString(S.TrimEnd());
}

FText AWCGameMode::UiReportTitle() const
{
    const int32 Turn = LastState.IsValid() ? static_cast<int32>(LastState->GetNumberField(TEXT("turn"))) : 0;
    return FText::FromString(FString::Printf(TEXT("%d턴 소식"), Turn));
}

// 명령 → "이번 달에 한 일" 문장. 한자어·약어를 쓰지 않는다 (ux-design §7 — 아들이 주 플레이어).
FString AWCGameMode::VerbToKoreanAction(const FString& Verb) const
{
    const FString Where = SelectedNodeId.IsEmpty() ? FString() :
        FString::Printf(TEXT(" (%s)"), *NameOf(ProvinceNames, SelectedNodeId));
    if (Verb == TEXT("recruit")) return FString::Printf(TEXT("병사 모으기%s"), *Where);
    if (Verb == TEXT("build"))   return FString::Printf(TEXT("건물 짓기%s"), *Where);
    if (Verb == TEXT("capture")) return FString::Printf(TEXT("땅 차지하기%s"), *Where);
    if (Verb == TEXT("move"))    return TEXT("부대 옮기기");
    if (Verb == TEXT("attack"))  return TEXT("공격하기");
    if (Verb == TEXT("summon"))  return TEXT("사람 부르기");
    return FString();   // 그 밖의 명령은 기록하지 않는다
}

// 이벤트 → 리포트 섹션 (ux-design §4). 재료는 기존 13종 — 신규 이벤트 발행 없음.
void AWCGameMode::RouteReportEvent(const TSharedPtr<FJsonObject>& Event)
{
    const FString Type = Event->GetStringField(TEXT("type"));
    const FString Line = EventToLine(Event);

    if (Type == TEXT("BattleEnded") || Type == TEXT("DuelStarted") || Type == TEXT("DuelEnded")
        || Type == TEXT("SkillExecuted") || Type == TEXT("ProvinceCaptured"))
        Report.Battle.Add(Line);
    else if (Type == TEXT("AllianceFormed") || Type == TEXT("CharacterJoined")
        || Type == TEXT("TechLevelUp") || Type == TEXT("CutsceneTriggered"))
        Report.World.Add(Line);
    else if (Type == TEXT("ProvinceRebelled"))
        Report.Home.Add(Line);
    // TurnStarted·SaveLoaded·GameEnded 는 리포트에 넣지 않는다 (각각 헤더·시스템·종료화면)
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
    OpenBuilding.Reset();     // 진입 시엔 패널 없이 거점 전경부터 보여준다 (ux-design §5.2)
    SelectedNodeId = NodeId;

    // 거점 지역에 맞는 배경으로 전환 (뉴욕이 동양 마을로 보이던 문제).
    // 팩이 없는 지역은 디오라마가 알아서 폴백한다 — WCCityDiorama::DioramaTable 에 한 줄 추가하면 붙는다.
    if (Diorama)
    {
        const FWCNodeInfo* Info = NodeInfos.Find(NodeId);
        Diorama->LoadForRegion(Info ? Info->Region : FString());
        // 배경마다 마을 규모가 달라 부감 거리도 다르다 → 카메라를 새 배경 기준으로 다시 맞춘다
        if (CityCamera)
        {
            const FTransform Vp = Diorama->GetViewpoint();
            CityCamera->SetActorLocationAndRotation(Vp.GetLocation(), Vp.Rotator());
        }
    }
    UpdateSelectionInfo();
    RefreshRates();   // 주막 확률 공시 (§2.8.6)

    // 디오라마 갱신 + 카메라 전환 (도시 3D 배경)
    if (Diorama)
    {
        FString OwnerId;
        if (LastState.IsValid())
            for (const TSharedPtr<FJsonValue>& P : LastState->GetArrayField(TEXT("provinces")))
                if (P->AsObject()->GetStringField(TEXT("id")) == NodeId)
                { P->AsObject()->TryGetStringField(TEXT("owner_faction_id"), OwnerId); break; }
        int32 MarketLv = 0, FarmLv = 0;
        for (const auto& Row : UiCityFacilityRows())
        {
            if (Row.NameKo == TEXT("시장")) MarketLv = Row.Level;
            else if (Row.NameKo == TEXT("농지")) FarmLv = Row.Level;
        }
        const FWCNodeInfo* Info = NodeInfos.Find(NodeId);
        Diorama->Configure(MapActor ? MapActor->GetFactionColor(OwnerId) : FLinearColor::Gray,
            MarketLv, FarmLv, Info && Info->bPort);
    }
    if (CityCamera)
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTargetWithBlend(CityCamera, 0.6f);   // 부드러운 진입 전환
}

void AWCGameMode::LeaveCity()
{
    OpenBuilding.Reset();
    EnteredCityId.Empty();
    if (BoardCamera)
        if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
            PC->SetViewTargetWithBlend(BoardCamera, 0.5f);   // 지도 복귀
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

FString AWCGameMode::FacilityNameKo(const FString& Kind)
{
    // §2.3 시설. 경제 4종 구현 — 병영·성벽은 전투 결합이라 Phase 2 (ue5-client-workflow.md §4).
    if (Kind == TEXT("market"))   return TEXT("시장");
    if (Kind == TEXT("farm"))     return TEXT("농지");
    if (Kind == TEXT("port"))     return TEXT("항구");
    if (Kind == TEXT("academy"))  return TEXT("학당");
    if (Kind == TEXT("barracks")) return TEXT("병영");
    if (Kind == TEXT("wall"))     return TEXT("성벽");
    return Kind;
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
                Row.Kind = Kind;
                Row.NameKo = FacilityNameKo(Kind);
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
                const FString Kind(Pair.Key);
                Text += FString::Printf(TEXT("  %s Lv%d\n"), *FacilityNameKo(Kind),
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
        Text += FString::Printf(TEXT("▶ %s — %s%s\n"), *Army->GetStringField(TEXT("id")), *Units,
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
    return FText::FromString(FString::Printf(TEXT("병종: %s »"), *UnitName));
}

void AWCGameMode::UpdateBoardCamera()
{
    if (!BoardCamera) return;
    // 줌인할수록 틸트를 세워 근경 디테일(-58° → 원경 -46°) + 우드래그 수동 오프셋
    const float AutoPitch = FMath::Lerp(-58.f, -46.f, FMath::GetMappedRangeValueClamped(
        FVector2D(3000.f, 19000.f), FVector2D(0.f, 1.f), CamDist));   // 줌 클램프와 동일 범위 유지
    CamPitch = FMath::Clamp(AutoPitch + CamPitchManual, -80.f, -18.f);
    const FRotator ViewRot(CamPitch, CamYaw, 0.f);   // 요 회전 포함
    BoardCamera->SetActorLocationAndRotation(CamTarget - ViewRot.Vector() * CamDist, ViewRot);
}

void AWCGameMode::ZoomCamera(float WheelDelta)
{
    if (!BoardCamera || FMath::IsNearlyZero(WheelDelta)) return;
    CamDist = FMath::Clamp(CamDist * (1.f - WheelDelta * 0.13f), 3000.f, 19000.f);   // 최대 줌아웃 축소 = 거점 확대
    UpdateBoardCamera();
}

void AWCGameMode::PanCamera(float DeltaX, float DeltaY)
{
    if (!BoardCamera) return;
    // [1:1 grab-and-pull] 임의 배율이 아니라 **실제 투영**으로 환산한다 —
    // 커서 아래 지점이 커서를 그대로 따라오는 것이 가장 직관적이고, 줌·화면크기가 바뀌어도 감각이 같다.
    //   화면폭 = 2·D·tan(FOV/2)  →  1픽셀당 월드 거리 = 그 값 / 뷰포트폭
    // (배율 상수를 손으로 튜닝하면 "너무 느림 → 너무 빠름" 을 반복하게 된다. 2026-07-17 실제로 그랬다)
    FVector2D Viewport(1280.f, 720.f);
    if (GEngine && GEngine->GameViewport) GEngine->GameViewport->GetViewportSize(Viewport);
    const float Fov = BoardCamera->GetCameraComponent()->FieldOfView;
    const double UnitsPerPx = 2.0 * CamDist * FMath::Tan(FMath::DegreesToRadians(Fov * 0.5f))
                              / FMath::Max(1.0, (double)Viewport.X);
    // 세로는 지형이 기울어 보이는 만큼(틸트) 더 움직여야 커서를 따라온다
    const double TiltComp = FMath::Max(0.35, FMath::Sin(FMath::DegreesToRadians(FMath::Abs(CamPitch))));
    const float Scale = UnitsPerPx;   // 가로 기준
    // 화면 기준 팬 — 카메라 요를 반영해 "끌리는" 방향이 시야와 일치.
    // [grab-and-pull] 지도를 손으로 잡아 끄는 감각 = 드래그한 방향으로 '지도가' 따라온다.
    // → 카메라는 그 반대로 움직여야 한다. (2026-07-17 드래그 주입 실측: 이전 부호는 지도가 반대로 밀렸음)
    const float Yaw = FMath::DegreesToRadians(CamYaw);
    const float S = FMath::Sin(Yaw), C = FMath::Cos(Yaw);
    // 입력은 '커서 화면 좌표 델타' (오른쪽 +X, 아래쪽 +Y).
    // grab-and-pull = 지도가 커서를 따라온다 → 카메라는 반대로 움직인다.
    //   커서 오른쪽(+X) → 카메라 왼쪽(-Y, 화면오른쪽=월드+Y)
    //   커서 아래(+Y)   → 카메라 위(+X, 화면위=월드+X)
    const float MoveRight = -DeltaX * Scale;
    const float MoveFwd   =  DeltaY * Scale / TiltComp;
    CamTarget.X += MoveFwd * C - MoveRight * S;
    CamTarget.Y += MoveFwd * S + MoveRight * C;
    CamTarget.X = FMath::Clamp(CamTarget.X, -6000.0, 6000.0);
    CamTarget.Y = FMath::Clamp(CamTarget.Y, -10500.0, 10500.0);
    UpdateBoardCamera();

    if (FParse::Param(FCommandLine::Get(), TEXT("WCInputProbe")))   // 드래그 방향 실측용
        UE_LOG(LogWorldConquest, Warning, TEXT("[PAN] dx=%.2f dy=%.2f -> CamTarget=(%.0f, %.0f)"),
            DeltaX, DeltaY, CamTarget.X, CamTarget.Y);
}

void AWCGameMode::OrbitCamera(float DeltaX, float DeltaY)
{
    if (!BoardCamera) return;
    CamYaw = FMath::Fmod(CamYaw + DeltaX * 0.35f, 360.f);   // 좌우 = 요 회전
    CamPitchManual = FMath::Clamp(CamPitchManual - DeltaY * 0.22f, -22.f, 22.f);  // 상하 = 틸트
    UpdateBoardCamera();
}

void AWCGameMode::ScheduleQaShotIfRequested()
{
    if (bShotScheduled || !FParse::Param(FCommandLine::Get(), TEXT("WCShot"))) return;
    bShotScheduled = true;

    FTimerHandle ShotTimer, QuitTimer;
    // 도시 진입 샷은 데모 맵(레벨 인스턴스) 비동기 로드 + 셰이더 컴파일 여유 필요
    const float ShotAt = UiInCity() ? 12.0f : 2.0f;
    GetWorld()->GetTimerManager().SetTimer(ShotTimer, []()
    {
        FScreenshotRequest::RequestScreenshot(true);   // true = Slate UI 포함 (false 는 UI 제외 캡처)
        UE_LOG(LogWorldConquest, Log, TEXT("QA 스크린샷 요청 완료"));
    }, ShotAt, false);
    GetWorld()->GetTimerManager().SetTimer(QuitTimer, [this]()
    {
        UE_LOG(LogWorldConquest, Log, TEXT("QA 하네스 종료"));
        FPlatformMisc::RequestExit(false);
    }, ShotAt + 3.0f, false);
}
