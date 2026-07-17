#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Styling/SlateBrush.h"

class AWCGameMode;

/**
 * 초빙 리빌 연출 (§2.8.10 — 진실 신호: ★5 금문 · ★4 자문 · ★3 합류).
 * 전면 암전 + 등급색 프레임 초상 + 등급별 문구. 클릭으로 다음 (리빌 소진 후 등장씬).
 */
class SWCRevealOverlay : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCRevealOverlay) {}
        SLATE_ARGUMENT(TWeakObjectPtr<AWCGameMode>, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;

    const FSlateBrush* GetPortraitBrush() const;
    mutable TSharedPtr<FSlateBrush> PortraitBrush;
    mutable FString LoadedCharId;

    EVisibility RevealVisibility() const;
};
