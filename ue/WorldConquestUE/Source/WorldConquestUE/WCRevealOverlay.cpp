#include "WCRevealOverlay.h"
#include "WCGameMode.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Text/STextBlock.h"
#include "Engine/Font.h"
#include "Engine/Texture2D.h"
#include "WCStyle.h"

namespace
{
    FSlateFontInfo RevealFont(int32 Size) { return FWCStyle::Font(Size); }

    FLinearColor RevealColor(int32 Rarity)
    {
        switch (Rarity)
        {
            case 5: return FLinearColor(0.95f, 0.78f, 0.25f);
            case 4: return FLinearColor(0.72f, 0.45f, 0.95f);
            default: return FLinearColor(0.62f, 0.68f, 0.75f);
        }
    }

    FText RevealPhrase(int32 Rarity)
    {
        switch (Rarity)   // §2.8.10 — 게이트 색은 진실 신호 (페이크아웃 미채택)
        {
            case 5: return FText::FromString(TEXT("하늘이 울린다…  ─ 금색 문이 열린다 ─"));
            case 4: return FText::FromString(TEXT("─ 자색 문이 열린다 ─"));
            default: return FText::FromString(TEXT("새로운 인재가 합류합니다"));
        }
    }

    const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }
}

void SWCRevealOverlay::Construct(const FArguments& InArgs)
{
    GM = InArgs._GameMode;
    PortraitBrush = MakeShared<FSlateBrush>();
    PortraitBrush->DrawAs = ESlateBrushDrawType::Image;

    ChildSlot
    [
        SNew(SBorder)   // 전면 암전 (클릭은 PlayerController 가 DismissReveal 로)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(FLinearColor(0, 0, 0, 0.88f)))
        .Visibility(this, &SWCRevealOverlay::RevealVisibility)
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [
            SNew(SVerticalBox)

            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
            [
                SNew(STextBlock).Font(RevealFont(22))
                .ColorAndOpacity_Lambda([this]
                { return FSlateColor(GM.IsValid() && GM->ActiveReveal.IsSet() ? RevealColor(GM->ActiveReveal->Rarity) : FLinearColor::White); })
                .Text_Lambda([this]
                { return GM.IsValid() && GM->ActiveReveal.IsSet() ? RevealPhrase(GM->ActiveReveal->Rarity) : FText::GetEmpty(); })
            ]

            // 등급색 프레임 초상
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 22, 0, 0)
            [
                SNew(SBorder).BorderImage(White()).Padding(3.f)
                .BorderBackgroundColor_Lambda([this]
                { return FSlateColor(GM.IsValid() && GM->ActiveReveal.IsSet() ? RevealColor(GM->ActiveReveal->Rarity) : FLinearColor::White); })
                [
                    SNew(SBox).WidthOverride(300).HeightOverride(375)
                    [ SNew(SImage).Image(this, &SWCRevealOverlay::GetPortraitBrush) ]
                ]
            ]

            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 20, 0, 0)
            [
                SNew(STextBlock).Font(RevealFont(20))
                .ColorAndOpacity_Lambda([this]
                { return FSlateColor(GM.IsValid() && GM->ActiveReveal.IsSet() ? RevealColor(GM->ActiveReveal->Rarity) : FLinearColor::White); })
                .Text_Lambda([this]
                {
                    if (!GM.IsValid() || !GM->ActiveReveal.IsSet()) return FText::GetEmpty();
                    FString Stars;
                    for (int32 i = 0; i < GM->ActiveReveal->Rarity; ++i) Stars += TEXT("★");
                    return FText::FromString(Stars);
                })
            ]
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 4, 0, 0)
            [
                SNew(STextBlock).Font(FWCStyle::Title(36)).ColorAndOpacity(FSlateColor(FLinearColor::White))
                .ShadowOffset(FVector2D(2, 2))
                .Text_Lambda([this]
                { return GM.IsValid() && GM->ActiveReveal.IsSet() ? FText::FromString(GM->ActiveReveal->Name) : FText::GetEmpty(); })
            ]

            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 26, 0, 0)
            [
                SNew(STextBlock).Font(RevealFont(13)).ColorAndOpacity(FSlateColor(FLinearColor(0.6f, 0.6f, 0.6f)))
                .Text(FText::FromString(TEXT("(클릭 — 계속)")))
            ]
        ]
    ];
}

const FSlateBrush* SWCRevealOverlay::GetPortraitBrush() const
{
    // rooted static 캐시 사용 [MUST] — 직접 LoadObject 하면 텍스처가 GC 되어 죽은 포인터 참조 크래시.
    const FString CharId = GM.IsValid() && GM->ActiveReveal.IsSet() ? GM->ActiveReveal->CharId : FString();
    if (const FSlateBrush* B = FWCStyle::Portrait(CharId, FVector2D(300, 375))) return B;
    return PortraitBrush.Get();   // 초상 부재 = 빈 브러시(등급 프레임만 표시)
}

EVisibility SWCRevealOverlay::RevealVisibility() const
{
    return GM.IsValid() && GM->ActiveReveal.IsSet() ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
}
