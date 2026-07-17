#include "WCHUD.h"
#include "WCGameMode.h"
#include "Engine/Canvas.h"

void AWCHUD::DrawHUD()
{
    Super::DrawHUD();
    const AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM || !Canvas) return;

    FCanvasTextItem Text(FVector2D(24, 24), FText::FromString(GM->HudLine),
                         GEngine->GetLargeFont(), FLinearColor::White);
    Text.EnableShadow(FLinearColor::Black);
    Text.Scale = FVector2D(1.6, 1.6);
    Canvas->DrawItem(Text);
}
