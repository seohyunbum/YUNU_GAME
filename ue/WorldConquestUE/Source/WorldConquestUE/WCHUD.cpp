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

    // ── 상단: 턴/차례 + 선택 정보 ──
    FCanvasTextItem Title(FVector2D(24, 20), FText::FromString(GM->HudLine), Large, FLinearColor::White);
    Title.EnableShadow(FLinearColor::Black);
    Title.Scale = FVector2D(1.5, 1.5);
    Canvas->DrawItem(Title);

    if (!GM->HudSelection.IsEmpty())
    {
        FCanvasTextItem Sel(FVector2D(24, 52), FText::FromString(GM->HudSelection), Large, FLinearColor(1.f, 0.9f, 0.5f));
        Sel.EnableShadow(FLinearColor::Black);
        Sel.Scale = FVector2D(1.2, 1.2);
        Canvas->DrawItem(Sel);
    }

    // ── 하단: 명령·모드 안내줄 (이벤트 로그 바로 위에 동적 배치) ──
    if (!GM->HudModeLine.IsEmpty())
    {
        const float LogHeight = 30.f + 24.f * GM->EventLog.Num();
        FCanvasTextItem Mode(FVector2D(24, Canvas->ClipY - LogHeight - 36.f),
                             FText::FromString(GM->HudModeLine), Large, FLinearColor(0.7f, 0.9f, 1.f));
        Mode.EnableShadow(FLinearColor::Black);
        Canvas->DrawItem(Mode);
    }

    // ── 도시명 라벨: 월드 → 화면 투영 (엔진 폰트의 한글 폴백 사용 — TextRender 한글 문제 회피) ──
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
