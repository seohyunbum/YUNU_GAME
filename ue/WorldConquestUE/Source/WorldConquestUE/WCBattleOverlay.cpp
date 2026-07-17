#include "WCBattleOverlay.h"
#include "WCGameMode.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Engine/Font.h"

namespace
{
    FSlateFontInfo BFont(int32 Size)
    {
        FSlateFontInfo Info = GEngine->GetLargeFont()->GetLegacySlateFontInfo();
        Info.Size = Size;
        return Info;
    }
    const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }
    const FLinearColor Gold(0.85f, 0.72f, 0.30f);
}

void SWCBattleOverlay::Construct(const FArguments& InArgs)
{
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SBorder)   // 암전 배경 (클릭 = DismissBattle, PlayerController)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(FLinearColor(0, 0, 0, 0.86f)))
        .Visibility(this, &SWCBattleOverlay::BattleVisibility)
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [
            SNew(SBox).WidthOverride(920)
            [
                SNew(SVerticalBox)

                // 제목
                + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
                [
                    SNew(STextBlock).Font(BFont(34)).ColorAndOpacity(FSlateColor(Gold)).ShadowOffset(FVector2D(2, 2))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiBattleTitle() : FText::GetEmpty(); })
                ]

                // 금색 구분선
                + SVerticalBox::Slot().AutoHeight().Padding(0, 16, 0, 20)
                [ SNew(SBox).HeightOverride(2)[ SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(Gold)) ] ]

                // 공격 측 / VS / 수비 측
                + SVerticalBox::Slot().AutoHeight()[ SideRow(true) ]
                + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 8, 0, 8)
                [ SNew(STextBlock).Font(BFont(24)).ColorAndOpacity(FSlateColor(FLinearColor(0.7f, 0.7f, 0.7f)))
                    .Text(FText::FromString(TEXT("⚔  VS  ⚔"))) ]
                + SVerticalBox::Slot().AutoHeight()[ SideRow(false) ]

                // 푸터 (라운드·일기토)
                + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 24, 0, 0)
                [ SNew(STextBlock).Font(BFont(16)).ColorAndOpacity(FSlateColor(FLinearColor(0.85f, 0.82f, 0.75f)))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiBattleFooter() : FText::GetEmpty(); }) ]

                + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 22, 0, 0)
                [ SNew(STextBlock).Font(BFont(13)).ColorAndOpacity(FSlateColor(FLinearColor(0.55f, 0.55f, 0.55f)))
                    .Text(FText::FromString(TEXT("(클릭 — 계속)"))) ]
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCBattleOverlay::SideRow(bool bAttacker)
{
    return SNew(SBorder)
        .BorderImage(White())
        .BorderBackgroundColor_Lambda([this, bAttacker]
        {
            if (!GM.IsValid()) return FSlateColor(FLinearColor::Gray);
            FLinearColor C = bAttacker ? GM->UiBattleAtkColor() : GM->UiBattleDefColor();
            C.A = 0.28f;   // 세력색 반투명 밴드
            return FSlateColor(C);
        })
        .Padding(FMargin(20, 14))
        [
            SNew(STextBlock).Font(BFont(21)).ColorAndOpacity(FSlateColor(FLinearColor::White)).ShadowOffset(FVector2D(1, 1))
            .Text_Lambda([this, bAttacker]
            {
                if (!GM.IsValid()) return FText::GetEmpty();
                return bAttacker ? GM->UiBattleAtkLine() : GM->UiBattleDefLine();
            })
        ];
}

EVisibility SWCBattleOverlay::BattleVisibility() const
{
    return GM.IsValid() && GM->ActiveBattle.IsSet() ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
}
