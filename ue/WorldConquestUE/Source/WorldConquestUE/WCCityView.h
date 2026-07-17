#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class AWCGameMode;

/**
 * 거점(도시) 화면 (KOEI 식 — 세계지도와 별개의 내정 뷰).
 * 3컬럼: [내정 — 시설·생산·건설] [군사 — 주둔·징병] [주막 — 확률 공시·초빙·소속 무장].
 * 전면 오버레이라 지도 입력을 자연 차단. 모든 판정은 서버 [MUST].
 */
class SWCCityView : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCCityView) {}
        SLATE_ARGUMENT(TWeakObjectPtr<AWCGameMode>, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;

    TSharedRef<SWidget> MakeColumn(const FText& Title, TAttribute<FText> Body, TSharedRef<SWidget> Actions);
    TSharedRef<SWidget> MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action);

    EVisibility CityVisibility() const;
};
