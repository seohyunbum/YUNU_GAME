#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Styling/SlateBrush.h"

class AWCGameMode;
class SWrapBox;

/**
 * 거점(도시) 화면 (KOEI 식 — 세계지도와 별개의 내정 뷰).
 * 배경 = 해당 도시의 실제 위성 이미지(/Game/CityBg — RawAssets 에서 에디터 Python 임포트).
 * 3컬럼: [내정 — 생산·시설 레벨·건설] [군사 — 부대·징병] [주막 — 확률 공시·천장 바·무장 카드·초빙].
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

    TSharedRef<SWidget> MakeFramedPanel(const FText& Title, TSharedRef<SWidget> Content);
    TSharedRef<SWidget> MakeDomesticPanel();
    TSharedRef<SWidget> MakeMilitaryPanel();
    TSharedRef<SWidget> MakeTavernPanel();
    TSharedRef<SWidget> MakeRateRow(int32 Index);
    TSharedRef<SWidget> MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action);

    void RebuildCharacterGrid() const;
    const FSlateBrush* GetBgBrush() const;

    // 배경·무장 그리드는 진입/초빙 시 lazy 갱신 (어트리뷰트 평가 스레드 = 게임 스레드)
    mutable TSharedPtr<FSlateBrush> BgBrush;
    mutable FString BgLoadedCity;
    TSharedPtr<SWrapBox> CharacterGrid;
    mutable TArray<TSharedPtr<FSlateBrush>> PortraitBrushes;   // 카드 초상 브러시 수명 관리

    EVisibility CityVisibility() const;
};
