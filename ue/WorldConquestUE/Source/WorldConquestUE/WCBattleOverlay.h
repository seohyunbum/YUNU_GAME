#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class AWCGameMode;

/**
 * 전투 결과 연출 (§4.3 BattleEnded). 암전 배경 + 양측 세력색 병력 대비 패널 + 일기토 요약.
 * 클릭으로 닫음 (전투 큐 → 리빌 → 컷씬 순). 판정은 서버, 화면은 표시만 [MUST].
 */
class SWCBattleOverlay : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCBattleOverlay) {}
        SLATE_ARGUMENT(TWeakObjectPtr<AWCGameMode>, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;
    TSharedRef<SWidget> SideRow(bool bAttacker);
    EVisibility BattleVisibility() const;
};
