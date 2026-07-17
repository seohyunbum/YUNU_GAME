#include "WCCityView.h"
#include "WCGameMode.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SWrapBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Notifications/SProgressBar.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Engine/Font.h"
#include "Engine/Texture2D.h"

namespace
{
    FSlateFontInfo CityFont(int32 Size)
    {
        FSlateFontInfo Info = GEngine->GetLargeFont()->GetLegacySlateFontInfo();
        Info.Size = Size;
        return Info;
    }

    const FLinearColor Gold(0.85f, 0.72f, 0.30f);
    const FLinearColor GoldDim(0.55f, 0.45f, 0.20f, 0.9f);
    const FLinearColor PanelBg(0.05f, 0.045f, 0.035f, 0.90f);
    const FLinearColor CardBg(0.10f, 0.09f, 0.07f, 0.95f);
    const FLinearColor TextDim(0.75f, 0.73f, 0.68f);

    FLinearColor RarityColor(int32 Rarity)
    {
        switch (Rarity)
        {
            case 5: return FLinearColor(0.95f, 0.78f, 0.25f);   // 금
            case 4: return FLinearColor(0.72f, 0.45f, 0.95f);   // 자
            default: return FLinearColor(0.62f, 0.68f, 0.75f);  // 은회
        }
    }

    const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }
}

void SWCCityView::Construct(const FArguments& InArgs)
{
    GM = InArgs._GameMode;
    BgBrush = MakeShared<FSlateBrush>();
    BgBrush->DrawAs = ESlateBrushDrawType::Image;

    ChildSlot
    [
        SNew(SOverlay)
        .Visibility(this, &SWCCityView::CityVisibility)

        // ── 배경: 도시 위성 이미지 (진입 시 lazy 교체) ──
        + SOverlay::Slot()
        [
            SNew(SImage).Image(this, &SWCCityView::GetBgBrush)
        ]

        // ── 콘텐츠 ──
        + SOverlay::Slot().Padding(46, 26)
        [
            SNew(SVerticalBox)

            // 헤더: 세력색 배너 + 도시명 + 자원
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().AutoWidth()
                [
                    SNew(SBox).WidthOverride(8)
                    [ SNew(SBorder).BorderImage(White())
                      .BorderBackgroundColor_Lambda([this]
                      { return FSlateColor(GM.IsValid() ? GM->UiFactionColor() : FLinearColor::Gray); }) ]
                ]
                + SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center).Padding(16, 0, 0, 0)
                [
                    SNew(STextBlock).Font(CityFont(30)).ColorAndOpacity(FSlateColor(Gold))
                    .ShadowOffset(FVector2D(2, 2))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiCityHeader() : FText::GetEmpty(); })
                ]
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
                [
                    SNew(STextBlock).Font(CityFont(16)).ColorAndOpacity(FSlateColor(TextDim))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); })
                ]
            ]

            // 금색 구분선
            + SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 16)
            [ SNew(SBox).HeightOverride(2)[ SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(GoldDim)) ] ]

            // 3컬럼
            + SVerticalBox::Slot().FillHeight(1)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 12, 0)[ MakeDomesticPanel() ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 12, 0)[ MakeMilitaryPanel() ]
                + SHorizontalBox::Slot().FillWidth(1)[ MakeTavernPanel() ]
            ]

            // 하단 복귀
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 16, 0, 0)
            [
                SNew(SBox).WidthOverride(280).HeightOverride(42)
                [
                    SNew(SButton)
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->LeaveCity(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(CityFont(15)).Text(FText::FromString(TEXT("◀ 세계지도로  (ESC)"))) ]
                ]
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCCityView::MakeFramedPanel(const FText& Title, TSharedRef<SWidget> Content)
{
    // 이중 프레임: 외곽 금색 라인 + 내부 다크 패널
    return SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(GoldDim)).Padding(1.5f)
    [
        SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(PanelBg)).Padding(FMargin(16, 12))
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [ SNew(STextBlock).Font(CityFont(19)).ColorAndOpacity(FSlateColor(Gold)).Text(Title) ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 10)
            [ SNew(SBox).HeightOverride(1)[ SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(FLinearColor(1, 1, 1, 0.12f))) ] ]
            + SVerticalBox::Slot().FillHeight(1)
            [ Content ]
        ]
    ];
}

TSharedRef<SWidget> SWCCityView::MakeDomesticPanel()
{
    return MakeFramedPanel(FText::FromString(TEXT("내정")),
        SNew(SVerticalBox)
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(STextBlock).Font(CityFont(14)).ColorAndOpacity(FSlateColor(TextDim))
            .Text_Lambda([this]
            {
                if (!GM.IsValid()) return FText::GetEmpty();
                const auto* Info = GM->NodeInfos.Find(GM->EnteredCityId);
                return Info ? FText::FromString(FString::Printf(TEXT("기본 생산 —  금 %d  ·  식량 %d"), Info->Gold, Info->Food)) : FText::GetEmpty();
            })
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 6)
        [ SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(Gold)).Text(FText::FromString(TEXT("시설"))) ]
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(STextBlock).Font(CityFont(14))
            .Text_Lambda([this]
            {
                if (!GM.IsValid()) return FText::GetEmpty();
                const auto Rows = GM->UiCityFacilityRows();
                if (Rows.Num() == 0) return FText::FromString(TEXT("(시설 없음 — 아래에서 건설)"));
                FString Text;
                for (const auto& Row : Rows)
                {
                    FString Pips;
                    for (int32 i = 1; i <= 3; ++i) Pips += (i <= Row.Level) ? TEXT("●") : TEXT("○");
                    Text += FString::Printf(TEXT("%s   %s  Lv%d\n"), *Row.NameKo, *Pips, Row.Level);
                }
                return FText::FromString(Text);
            })
        ]
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("시장 건설/증축")),
                [](AWCGameMode* G) { G->BuildSelected(TEXT("market")); }) ]
            + SHorizontalBox::Slot().FillWidth(1).Padding(8, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("농지 건설/증축")),
                [](AWCGameMode* G) { G->BuildSelected(TEXT("farm")); }) ]
        ]);
}

TSharedRef<SWidget> SWCCityView::MakeMilitaryPanel()
{
    return MakeFramedPanel(FText::FromString(TEXT("군사")),
        SNew(SVerticalBox)
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(SScrollBox)
            + SScrollBox::Slot()
            [
                SNew(STextBlock).Font(CityFont(14))
                .Text_Lambda([this]
                {
                    if (!GM.IsValid()) return FText::GetEmpty();
                    const auto Cards = GM->UiCityArmyCards();
                    if (Cards.Num() == 0) return FText::FromString(TEXT("(주둔 부대 없음 — 아래에서 징병)"));
                    FString Text;
                    for (const auto& Card : Cards)
                    {
                        Text += FString::Printf(TEXT("⚔ %s  —  총 %d\n    %s\n"), *Card.Id, Card.Troops, *Card.Detail);
                        if (!Card.Commander.IsEmpty())
                            Text += FString::Printf(TEXT("    지휘: %s\n"), *Card.Commander);
                        Text += TEXT("\n");
                    }
                    return FText::FromString(Text);
                })
            ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("징병 10")),
                [](AWCGameMode* G) { G->RecruitSelected(10); }) ]
            + SHorizontalBox::Slot().FillWidth(1).Padding(8, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("징병 50")),
                [](AWCGameMode* G) { G->RecruitSelected(50); }) ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
        [
            SNew(SButton)
            .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CycleRecruitUnit(); return FReply::Handled(); })
            .HAlign(HAlign_Center)
            [ SNew(STextBlock).Font(CityFont(13))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiRecruitUnitText() : FText::GetEmpty(); }) ]
        ]);
}

TSharedRef<SWidget> SWCCityView::MakeTavernPanel()
{
    return MakeFramedPanel(FText::FromString(TEXT("주막 — 무장 초빙")),
        SNew(SVerticalBox)
        + SVerticalBox::Slot().AutoHeight()
        [ SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(Gold))
            .Text_Lambda([this] { return GM.IsValid() ? GM->UiMandateText() : FText::GetEmpty(); }) ]

        // 확률 공시 (§2.8.6) — 희귀도 색상 행
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()[ MakeRateRow(0) ]
            + SVerticalBox::Slot().AutoHeight()[ MakeRateRow(1) ]
            + SVerticalBox::Slot().AutoHeight()[ MakeRateRow(2) ]
        ]

        // 천장 진행 바
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(SBox).HeightOverride(10)
            [ SNew(SProgressBar).Percent_Lambda([this] { return GM.IsValid() ? GM->UiPityProgress() : 0.f; })
              .FillColorAndOpacity(FSlateColor(Gold)) ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 3, 0, 0)
        [ SNew(STextBlock).Font(CityFont(12)).ColorAndOpacity(FSlateColor(TextDim))
            .Text_Lambda([this] { return GM.IsValid() ? GM->UiPityText() : FText::GetEmpty(); }) ]

        // 소속 무장 카드 그리드
        + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 6)
        [ SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(Gold)).Text(FText::FromString(TEXT("소속 무장"))) ]
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(SScrollBox)
            + SScrollBox::Slot()
            [
                SAssignNew(CharacterGrid, SWrapBox).UseAllottedSize(true)
            ]
        ]

        // 초빙 버튼
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(SBox).HeightOverride(46)
            [
                SNew(SButton)
                .ButtonColorAndOpacity(FSlateColor(Gold))
                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->SummonOnce(); return FReply::Handled(); })
                .HAlign(HAlign_Center).VAlign(VAlign_Center)
                [ SNew(STextBlock).Font(CityFont(17)).ColorAndOpacity(FSlateColor(FLinearColor::Black))
                    .Text(FText::FromString(TEXT("★ 무장 초빙 (1회)"))) ]
            ]
        ]);
}

TSharedRef<SWidget> SWCCityView::MakeRateRow(int32 Index)
{
    return SNew(STextBlock).Font(CityFont(14))
        .ColorAndOpacity_Lambda([this, Index]
        {
            if (!GM.IsValid() || !GM->UiRateRows().IsValidIndex(Index)) return FSlateColor(FLinearColor::Transparent);
            return FSlateColor(RarityColor(GM->UiRateRows()[Index].Rarity));
        })
        .Text_Lambda([this, Index]
        {
            if (!GM.IsValid() || !GM->UiRateRows().IsValidIndex(Index)) return FText::GetEmpty();
            const auto& Row = GM->UiRateRows()[Index];
            FString Stars;
            for (int32 i = 0; i < Row.Rarity; ++i) Stars += TEXT("★");
            return FText::FromString(FString::Printf(TEXT("%s   %d.%02d%%   (잔여 %d명)"),
                *Stars, Row.Permyriad / 100, Row.Permyriad % 100, Row.Remaining));
        });
}

void SWCCityView::RebuildCharacterGrid() const
{
    if (!CharacterGrid.IsValid() || !GM.IsValid()) return;
    CharacterGrid->ClearChildren();
    for (const auto& Card : GM->UiMyCharacterCards())
    {
        FString Stars;
        for (int32 i = 0; i < Card.Rarity; ++i) Stars += TEXT("★");
        CharacterGrid->AddSlot().Padding(0, 0, 8, 8)
        [
            SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(RarityColor(Card.Rarity))).Padding(1.5f)
            [
                SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(CardBg)).Padding(FMargin(12, 8))
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot().AutoHeight()
                    [ SNew(STextBlock).Font(CityFont(11)).ColorAndOpacity(FSlateColor(RarityColor(Card.Rarity)))
                        .Text(FText::FromString(Stars)) ]
                    + SVerticalBox::Slot().AutoHeight()
                    [ SNew(STextBlock).Font(CityFont(15)).Text(FText::FromString(Card.Name)) ]
                ]
            ]
        ];
    }
}

const FSlateBrush* SWCCityView::GetBgBrush() const
{
    // 진입 도시가 바뀌면 배경 텍스처 lazy 교체 (/Game/CityBg/T_<id>)
    if (GM.IsValid() && GM->EnteredCityId != BgLoadedCity)
    {
        BgLoadedCity = GM->EnteredCityId;
        RebuildCharacterGrid();   // 도시 진입 시 무장 그리드도 갱신
        if (UTexture2D* Tex = LoadObject<UTexture2D>(nullptr,
                *FString::Printf(TEXT("/Game/CityBg/T_%s.T_%s"), *BgLoadedCity, *BgLoadedCity)))
        {
            BgBrush->SetResourceObject(Tex);
            BgBrush->ImageSize = FVector2D(Tex->GetSizeX(), Tex->GetSizeY());
        }
        else
        {
            BgBrush->SetResourceObject(nullptr);
        }
    }
    // 무장 수가 바뀌면(초빙) 그리드 갱신 — 카드 수 비교로 저비용 감지
    if (GM.IsValid() && CharacterGrid.IsValid() && CharacterGrid->GetChildren()->Num() != GM->UiMyCharacterCards().Num())
        RebuildCharacterGrid();
    return BgBrush.Get();
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
