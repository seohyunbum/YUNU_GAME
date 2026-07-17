#include "WCHUD.h"
#include "WCGameMode.h"
#include "WCMapActor.h"
#include "Engine/Canvas.h"

void AWCHUD::DrawHUD()
{
    Super::DrawHUD();
    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM || !Canvas) return;

    UFont* Large = GEngine->GetLargeFont();
    UFont* Small = GEngine->GetMediumFont();

    // [MUST] 거점 화면·모달 중엔 지도용 Canvas HUD(이벤트 로그·도시명 라벨·명령 안내줄)를 그리지 않는다.
    // Canvas 는 Slate 와 별개 레이어라 서로를 모른다 → 가드가 없으면 거점 패널·모달을 뚫고 그려
    // "상점 창에 겹쳐 가려짐" 이 된다 (2026-07-17 사용자 보고의 실제 원인).
    const bool bMapHudHidden = GM->UiInCity()
        || GM->ActiveBattle.IsSet() || GM->ActiveReveal.IsSet();

    // ── 상단 상태줄: Playing 중엔 Slate 자원바가 대체 — 부팅/선택/오류 메시지만 Canvas ──
    if (!GM->UiIsPlaying())
    {
        FCanvasTextItem Title(FVector2D(24, 20), FText::FromString(GM->HudLine), Large, FLinearColor::White);
        Title.EnableShadow(FLinearColor::Black);
        Title.Scale = FVector2D(1.5, 1.5);
        Canvas->DrawItem(Title);
    }

    // ── 하단: 명령·모드 안내줄 (이벤트 로그 바로 위에 동적 배치) ──
    if (!bMapHudHidden && !GM->HudModeLine.IsEmpty())
    {
        const float LogHeight = 30.f + 24.f * GM->EventLog.Num();
        FCanvasTextItem Mode(FVector2D(24, Canvas->ClipY - LogHeight - 36.f),
                             FText::FromString(GM->HudModeLine), Large, FLinearColor(0.7f, 0.9f, 1.f));
        Mode.EnableShadow(FLinearColor::Black);
        Canvas->DrawItem(Mode);
    }

    // ── 도시명 라벨: 월드 → 화면 투영 (엔진 폰트의 한글 폴백 사용 — TextRender 한글 문제 회피) ──
    if (!bMapHudHidden)
    if (const AWCMapActor* Map = GM->GetMapActor())
    {
        for (const auto& Pair : Map->GetNodePositions())
        {
            const FVector Screen = Canvas->Project(Pair.Value + FVector(0, 0, 60.0));
            if (Screen.Z <= 0.f) continue;   // 카메라 뒤
            const FString Label = GM->ProvinceNames.FindRef(Pair.Key);
            if (Label.IsEmpty()) continue;

            const bool bSelected = Pair.Key == GM->SelectedNodeId;
            FCanvasTextItem Text(
                FVector2D(Screen.X - Label.Len() * 7.0, Screen.Y - 34.0),
                FText::FromString(bSelected ? FString::Printf(TEXT("[ %s ]"), *Label) : Label),
                Small, bSelected ? FLinearColor(1.f, 0.9f, 0.3f) : FLinearColor(0.92f, 0.92f, 0.92f));
            Text.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(Text);
        }
    }

    // ── 좌하단: 이벤트 로그 (최신이 아래) ──
    if (!bMapHudHidden)
    {
        const float LogBottom = Canvas->ClipY - 30.f;
        for (int32 i = 0; i < GM->EventLog.Num(); ++i)
        {
            const float Alpha = 1.f - 0.08f * i;
            FCanvasTextItem Line(FVector2D(24, LogBottom - 24.f * i),
                FText::FromString(GM->EventLog[i]), Small, FLinearColor(1.f, 1.f, 1.f, FMath::Max(0.25f, Alpha)));
            Line.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(Line);
        }
    }

    // ── 세력 선택 화면 (지도 배경 위 패널) ──
    if (GM->Phase == EWCPhase::FactionSelect)
    {
        const float PanelX = Canvas->ClipX * 0.5f - 300.f, PanelY = 140.f;
        FCanvasTileItem Panel(FVector2D(PanelX, PanelY),
            FVector2D(600.f, 120.f + 34.f * GM->SelectableFactions.Num()), FLinearColor(0.f, 0.f, 0.f, 0.75f));
        Panel.BlendMode = SE_BLEND_Translucent;
        Canvas->DrawItem(Panel);

        FCanvasTextItem Head(FVector2D(PanelX + 30, PanelY + 20),
            FText::FromString(FString::Printf(TEXT("세력 선택 — %s   [H] 모드 전환"),
                GM->bHotseat ? TEXT("부자 2인 핫시트") : TEXT("1인 vs AI"))),
            Large, FLinearColor(1.f, 0.85f, 0.4f));
        Head.EnableShadow(FLinearColor::Black);
        Head.Scale = FVector2D(1.3, 1.3);
        Canvas->DrawItem(Head);

        for (int32 i = 0; i < GM->SelectableFactions.Num(); ++i)
        {
            const FString& Id = GM->SelectableFactions[i];
            FCanvasTextItem Row(FVector2D(PanelX + 40, PanelY + 70 + 34.f * i),
                FText::FromString(FString::Printf(TEXT("[%d] %s"), i + 1, *GM->FactionNames.FindRef(Id))),
                Large, FLinearColor::White);
            Row.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(Row);
        }
    }

    // ── 컷씬 오버레이 (자막 스타일 — T0 대본을 3D 위에) ──
    if (const FWCCutscene* Scene = GM->GetActiveCutsceneDef())
    {
        const int32 LineIdx = GM->ActiveCutscene->LineIndex;
        if (Scene->Lines.IsValidIndex(LineIdx))
        {
            const float BoxY = Canvas->ClipY * 0.68f;
            FCanvasTileItem Box(FVector2D(Canvas->ClipX * 0.5f - 560.f, BoxY),
                FVector2D(1120.f, 130.f), FLinearColor(0.f, 0.f, 0.f, 0.8f));
            Box.BlendMode = SE_BLEND_Translucent;
            Canvas->DrawItem(Box);

            FCanvasTextItem SceneTitle(FVector2D(Canvas->ClipX * 0.5f - 530.f, BoxY + 14),
                FText::FromString(FString::Printf(TEXT("『%s』"), *Scene->TitleKo)), Small, FLinearColor(1.f, 0.8f, 0.3f));
            SceneTitle.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(SceneTitle);

            const FWCCutsceneLine& L = Scene->Lines[LineIdx];
            const FString SpeakerName = L.Speaker.IsEmpty() ? FString() :
                FString::Printf(TEXT("%s:  "), *GM->CharacterNames.FindRef(L.Speaker));
            FCanvasTextItem Text(FVector2D(Canvas->ClipX * 0.5f - 530.f, BoxY + 48),
                FText::FromString(SpeakerName + L.TextKo), Large, FLinearColor::White);
            Text.EnableShadow(FLinearColor::Black);
            Text.Scale = FVector2D(1.35, 1.35);
            Canvas->DrawItem(Text);

            FCanvasTextItem Hint(FVector2D(Canvas->ClipX * 0.5f + 380.f, BoxY + 100),
                FText::FromString(TEXT("(클릭 — 다음)")), Small, FLinearColor(0.7f, 0.7f, 0.7f));
            Canvas->DrawItem(Hint);
        }
    }
}
