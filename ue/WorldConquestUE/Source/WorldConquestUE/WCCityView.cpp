#include "WCCityView.h"
#include "WCGameMode.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Engine/Font.h"

namespace
{
    FSlateFontInfo CityFont(int32 Size)
    {
        FSlateFontInfo Info = GEngine->GetLargeFont()->GetLegacySlateFontInfo();
        Info.Size = Size;
        return Info;
    }
    const FLinearColor ScreenBg(0.04f, 0.03f, 0.02f, 0.96f);   // 전면 다크 (지도 차단)
    const FLinearColor ColumnBg(0.10f, 0.08f, 0.05f, 1.0f);
    const FLinearColor Gold(0.85f, 0.72f, 0.3f);
}

void SWCCityView::Construct(const FArguments& InArgs)
{
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SBorder)
        .BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
        .BorderBackgroundColor(FSlateColor(ScreenBg))
        .Visibility(this, &SWCCityView::CityVisibility)
        .Padding(FMargin(40, 26))
        [
            SNew(SVerticalBox)

            // ── 헤더: 도시명·소유·인구·항구 + 자원 ──
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center)
                [
                    SNew(STextBlock).Font(CityFont(26)).ColorAndOpacity(FSlateColor(Gold))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiCityHeader() : FText::GetEmpty(); })
                ]
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
                [
                    SNew(STextBlock).Font(CityFont(15))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); })
                ]
            ]

            // ── 3컬럼: 내정 / 군사 / 주막 ──
            + SVerticalBox::Slot().FillHeight(1).Padding(0, 18, 0, 0)
            [
                SNew(SHorizontalBox)

                + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 10, 0)
                [
                    MakeColumn(FText::FromString(TEXT("내정")),
                        TAttribute<FText>::CreateLambda([this] { return GM.IsValid() ? GM->UiCityFacilities() : FText::GetEmpty(); }),
                        SNew(SHorizontalBox)
                        + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("시장 건설/증축")),
                            [](AWCGameMode* G) { G->BuildSelected(TEXT("market")); }) ]
                        + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("농지 건설/증축")),
                            [](AWCGameMode* G) { G->BuildSelected(TEXT("farm")); }) ])
                ]

                + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 10, 0)
                [
                    MakeColumn(FText::FromString(TEXT("군사")),
                        TAttribute<FText>::CreateLambda([this] { return GM.IsValid() ? GM->UiCityArmies() : FText::GetEmpty(); }),
                        SNew(SVerticalBox)
                        + SVerticalBox::Slot().AutoHeight()
                        [
                            SNew(SHorizontalBox)
                            + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("징병 10")),
                                [](AWCGameMode* G) { G->RecruitSelected(10); }) ]
                            + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("징병 50")),
                                [](AWCGameMode* G) { G->RecruitSelected(50); }) ]
                        ]
                        + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
                        [
                            SNew(SButton)
                            .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CycleRecruitUnit(); return FReply::Handled(); })
                            .HAlign(HAlign_Center)
                            [ SNew(STextBlock).Font(CityFont(13))
                                .Text_Lambda([this] { return GM.IsValid() ? GM->UiRecruitUnitText() : FText::GetEmpty(); }) ]
                        ])
                ]

                + SHorizontalBox::Slot().FillWidth(1)
                [
                    MakeColumn(FText::FromString(TEXT("주막 — 무장 초빙")),
                        TAttribute<FText>::CreateLambda([this]
                        {
                            if (!GM.IsValid()) return FText::GetEmpty();
                            return FText::FromString(GM->UiCityRates().ToString() + TEXT("\n\n─ 소속 무장 ─\n")
                                + GM->UiCityCharacters().ToString());
                        }),
                        SNew(SBox).HeightOverride(44)
                        [
                            SNew(SButton)
                            .ButtonColorAndOpacity(FSlateColor(Gold))
                            .OnClicked_Lambda([this]
                            {
                                if (GM.IsValid()) GM->SummonOnce();   // 확률 갱신은 응답 후 자동 (OnCommandResult)
                                return FReply::Handled();
                            })
                            .HAlign(HAlign_Center).VAlign(VAlign_Center)
                            [ SNew(STextBlock).Font(CityFont(16)).ColorAndOpacity(FSlateColor(FLinearColor::Black))
                                .Text(FText::FromString(TEXT("★ 무장 초빙 (1회)"))) ]
                        ])
                ]
            ]

            // ── 하단: 지도 복귀 ──
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 16, 0, 0)
            [
                SNew(SBox).WidthOverride(260).HeightOverride(42)
                [
                    SNew(SButton)
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->LeaveCity(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(CityFont(15)).Text(FText::FromString(TEXT("◀ 세계지도로"))) ]
                ]
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCCityView::MakeColumn(const FText& Title, TAttribute<FText> Body, TSharedRef<SWidget> Actions)
{
    return SNew(SBorder)
        .BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
        .BorderBackgroundColor(FSlateColor(ColumnBg))
        .Padding(FMargin(16, 12))
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [ SNew(STextBlock).Font(CityFont(18)).ColorAndOpacity(FSlateColor(Gold)).Text(Title) ]
            + SVerticalBox::Slot().FillHeight(1).Padding(0, 10, 0, 10)
            [ SNew(STextBlock).Font(CityFont(13)).AutoWrapText(true).Text(Body) ]
            + SVerticalBox::Slot().AutoHeight()
            [ Actions ]
        ];
}

TSharedRef<SWidget> SWCCityView::MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action)
{
    return SNew(SButton)
        .OnClicked_Lambda([this, Action] { if (GM.IsValid()) Action(GM.Get()); return FReply::Handled(); })
        .HAlign(HAlign_Center)
        [ SNew(STextBlock).Font(CityFont(13)).Text(Label) ];
}

EVisibility SWCCityView::CityVisibility() const
{
    return GM.IsValid() && GM->UiInCity() ? EVisibility::Visible : EVisibility::Collapsed;
}
