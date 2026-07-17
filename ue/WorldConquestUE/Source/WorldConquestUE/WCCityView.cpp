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
#include "Widgets/SNullWidget.h"
#include "WCStyle.h"

namespace
{
    FSlateFontInfo CityFont(int32 Size) { return FWCStyle::Font(Size); }   // 본문 = Gothic A1

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
    const FButtonStyle PrimaryStyle = FWCStyle::PrimaryButton();

    // 지연 초기화 — 스타일이 위젯보다 오래 살아야 하고(SButton 이 포인터 보관),
    // 텍스처 LoadObject 는 정적 초기화 시점이 아니라 첫 위젯 생성 시점에 해야 안전.
    const FButtonStyle& BtnStyle() { static const FButtonStyle S = FWCStyle::Button(); return S; }
}

void SWCCityView::Construct(const FArguments& InArgs)
{
    // [MUST] 위젯 '자신' 은 히트테스트에서 제외한다 — SCompoundWidget 의 기본 Visibility 는 Visible 이라
    // 내용이 Collapsed 여도 위젯 자체가 화면 전체를 덮는 '투명한 벽' 이 되어 아래 위젯의 클릭을 전부 삼킨다.
    // (실측 2026-07-17: ZOrder 30 인 SWCRevealOverlay 가 리빌이 없을 때도 모든 버튼 클릭을 차단)
    // SelfHitTestInvisible = 자신은 클릭 대상 아님 + 자식은 정상 클릭.
    SetVisibility(EVisibility::SelfHitTestInvisible);

    GM = InArgs._GameMode;
    BgBrush = MakeShared<FSlateBrush>();
    BgBrush->DrawAs = ESlateBrushDrawType::Image;

    ChildSlot
    [
        SNew(SOverlay)
        .Visibility(this, &SWCCityView::CityVisibility)

        // 배경 = 3D 디오라마(뷰포트가 직접 렌더). 하단 그라데이션 대신 상/하 살짝 어둡게만.
        + SOverlay::Slot().VAlign(VAlign_Top)
        [
            SNew(SBox).HeightOverride(96)
            [ SNew(SImage).Image(this, &SWCCityView::GetBgBrush) ]   // 헤더 가독용 다크 바 (브러시는 단색)
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
                    SNew(STextBlock).Font(FWCStyle::Title(32)).ColorAndOpacity(FSlateColor(Gold))
                    .ShadowOffset(FVector2D(2, 2))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiCityHeader() : FText::GetEmpty(); })
                ]
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
                [
                    SNew(STextBlock).Font(CityFont(16)).ColorAndOpacity(FSlateColor(TextDim))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); })
                ]
            ]

            // 상단 여백 = 디오라마(천수각)가 보이는 구간
            + SVerticalBox::Slot().FillHeight(1)
            [ SNullWidget::NullWidget ]

            // 3컬럼 패널 — 하단 스트립 (KOEI 식: 3D 도시 위에 명령 패널)
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).HeightOverride(452)   // 시설 카드 4종 + 무장 그리드가 잘리지 않는 최소 높이
                [
                    SNew(SHorizontalBox)
                    + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 12, 0)[ MakeDomesticPanel() ]
                    + SHorizontalBox::Slot().FillWidth(1).Padding(0, 0, 12, 0)[ MakeMilitaryPanel() ]
                    + SHorizontalBox::Slot().FillWidth(1)[ MakeTavernPanel() ]
                ]
            ]

            // 하단 복귀
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 12, 0, 0)
            [
                SNew(SBox).WidthOverride(300).HeightOverride(44)
                [
                    MakeButton(FText::FromString(TEXT("◀ 세계지도로  (ESC)")),
                        [](AWCGameMode* G) { G->LeaveCity(); })
                ]
            ]

            // 에셋 크레딧 — game-icons.net 은 CC BY 3.0 이라 표기 의무 [MUST]
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 5, 0, 0)
            [
                SNew(STextBlock).Font(CityFont(9))
                .ColorAndOpacity(FSlateColor(FLinearColor(0.55f, 0.53f, 0.48f, 0.75f)))
                .Text(FText::FromString(TEXT("Icons by Lorc, Delapouite & contributors — game-icons.net (CC BY 3.0)")))
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCCityView::MakeFramedPanel(const FText& Title, TSharedRef<SWidget> Content)
{
    // 금테·양피지 9-slice 프레임 (WCStyle 스킨)
    return SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(22, 18))
    [
        SNew(SVerticalBox)
        + SVerticalBox::Slot().AutoHeight()
        [ SNew(STextBlock).Font(FWCStyle::Font(20)).ColorAndOpacity(FSlateColor(FWCStyle::GoldHi))
            .ShadowOffset(FVector2D(1, 1)).Text(Title) ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 7, 0, 11)
        [ SNew(SBox).HeightOverride(2)[ SNew(SImage).Image(White()).ColorAndOpacity(FSlateColor(FWCStyle::Gold * 0.6f)) ] ]
        + SVerticalBox::Slot().FillHeight(1)
        [ Content ]
    ];
}

int32 SWCCityView::FacilityLevelOf(const FString& Kind) const
{
    if (!GM.IsValid()) return 0;
    for (const auto& Row : GM->UiCityFacilityRows())
        if (Row.Kind == Kind) return Row.Level;
    return 0;   // 미건설
}

TSharedRef<SWidget> SWCCityView::MakeIconStat(const TCHAR* IconName, const FLinearColor& Tint,
                                              TFunction<FText()> ValueGetter, int32 IconSize, int32 FontSize)
{
    return SNew(SHorizontalBox)
        + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
        [ SNew(SBox).WidthOverride(IconSize).HeightOverride(IconSize)
            [ SNew(SImage).Image(FWCStyle::Icon(IconName, Tint, IconSize)) ] ]
        + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(6, 0, 0, 0)
        [ SNew(STextBlock).Font(CityFont(FontSize)).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
            .Text_Lambda([ValueGetter] { return ValueGetter(); }) ];
}

TSharedRef<SWidget> SWCCityView::MakeFacilityCard(const FString& Kind, const TCHAR* IconName, const FText& Label)
{
    return SNew(SBorder)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(CardBg))
        .Padding(FMargin(9, 7))
        [
            SNew(SHorizontalBox)
            // 시설 아이콘 (game-icons.net, 금색 틴트) — 미건설이면 흐리게
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
            [
                SNew(SBox).WidthOverride(32).HeightOverride(32)
                [
                    SNew(SImage)
                    .Image_Lambda([this, Kind, IconName]
                    {
                        const bool bBuilt = FacilityLevelOf(Kind) > 0;
                        return FWCStyle::Icon(IconName, bBuilt ? FWCStyle::GoldHi : GoldDim, 32);
                    })
                ]
            ]
            // 이름 + 레벨 핍
            + SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center).Padding(9, 0, 0, 0)
            [
                SNew(SVerticalBox)
                + SVerticalBox::Slot().AutoHeight()
                [ SNew(STextBlock).Font(CityFont(14)).ColorAndOpacity(FSlateColor(FWCStyle::Ink)).Text(Label) ]
                + SVerticalBox::Slot().AutoHeight()
                [
                    SNew(STextBlock).Font(CityFont(12))
                    .ColorAndOpacity_Lambda([this, Kind]
                    { return FSlateColor(FacilityLevelOf(Kind) > 0 ? Gold : TextDim); })
                    .Text_Lambda([this, Kind]
                    {
                        const int32 Lv = FacilityLevelOf(Kind);
                        if (Lv <= 0) return FText::FromString(TEXT("미건설"));
                        FString Pips;
                        for (int32 i = 1; i <= 3; ++i) Pips += (i <= Lv) ? TEXT("●") : TEXT("○");
                        return FText::FromString(FString::Printf(TEXT("%s  Lv%d"), *Pips, Lv));
                    })
                ]
            ]
            // 건설/증축 (레벨 3 = 최대)
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
            [
                SNew(SBox).WidthOverride(62).HeightOverride(30)
                [
                    SNew(SButton).ButtonStyle(&BtnStyle())
                    .IsEnabled_Lambda([this, Kind] { return FacilityLevelOf(Kind) < 3; })
                    .OnClicked_Lambda([this, Kind]
                    { if (GM.IsValid()) GM->BuildSelected(Kind); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [
                        SNew(STextBlock).Font(CityFont(12)).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                        .Text_Lambda([this, Kind]
                        {
                            const int32 Lv = FacilityLevelOf(Kind);
                            return FText::FromString(Lv <= 0 ? TEXT("건설") : Lv >= 3 ? TEXT("최대") : TEXT("증축"));
                        })
                    ]
                ]
            ]
        ];
}

TSharedRef<SWidget> SWCCityView::MakeDomesticPanel()
{
    return MakeFramedPanel(FText::FromString(TEXT("내정")),
        SNew(SVerticalBox)
        // 생산 스트립 (아이콘) — 이 거점의 기본 생산
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().AutoWidth()
            [ MakeIconStat(TEXT("gold"), Gold, [this]
              {
                  const auto* I = GM.IsValid() ? GM->NodeInfos.Find(GM->EnteredCityId) : nullptr;
                  return FText::FromString(I ? FString::Printf(TEXT("금 %d"), I->Gold) : TEXT("-"));
              }) ]
            + SHorizontalBox::Slot().AutoWidth().Padding(18, 0, 0, 0)
            [ MakeIconStat(TEXT("food"), FLinearColor(0.62f, 0.82f, 0.45f), [this]
              {
                  const auto* I = GM.IsValid() ? GM->NodeInfos.Find(GM->EnteredCityId) : nullptr;
                  return FText::FromString(I ? FString::Printf(TEXT("식량 %d"), I->Food) : TEXT("-"));
              }) ]
            + SHorizontalBox::Slot().AutoWidth().Padding(18, 0, 0, 0)
            [ MakeIconStat(TEXT("pop"), FLinearColor(0.72f, 0.78f, 0.88f), [this]
              {
                  const auto* I = GM.IsValid() ? GM->NodeInfos.Find(GM->EnteredCityId) : nullptr;
                  return FText::FromString(I && I->Population > 0
                      ? FString::Printf(TEXT("인구 %s"), *FText::AsNumber(I->Population).ToString()) : TEXT("-"));
              }) ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 6)
        [ SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(Gold))
            .Text(FText::FromString(TEXT("시설  (슬롯 4)"))) ]
        // 시설 카드 4종 (§2.3 경제 시설 — 병영·성벽은 전투 Phase 2)
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(SScrollBox)
            + SScrollBox::Slot()
            [
                SNew(SVerticalBox)
                + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 5)
                [ MakeFacilityCard(TEXT("market"), TEXT("market"), FText::FromString(TEXT("시장  — 금 +25%/Lv"))) ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 5)
                [ MakeFacilityCard(TEXT("farm"), TEXT("farm"), FText::FromString(TEXT("농지  — 식량 +25%/Lv"))) ]
                + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 5)
                [ MakeFacilityCard(TEXT("port"), TEXT("port"), FText::FromString(TEXT("항구  — 교역 금+18% 식량+10%"))) ]
                + SVerticalBox::Slot().AutoHeight()
                [ MakeFacilityCard(TEXT("academy"), TEXT("academy"), FText::FromString(TEXT("학당  — 기술 +2/Lv 매턴"))) ]
            ]
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
                        Text += FString::Printf(TEXT("▶ %s  —  총 %d\n    %s\n"), *Card.Id, Card.Troops, *Card.Detail);
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

        // 초빙 버튼 (금색 강조 스킨)
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(SBox).HeightOverride(48)
            [
                SNew(SButton).ButtonStyle(&PrimaryStyle)
                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->SummonOnce(); return FReply::Handled(); })
                .HAlign(HAlign_Center).VAlign(VAlign_Center)
                [ SNew(STextBlock).Font(FWCStyle::Font(18)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
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
        // 초상 = rooted static 캐시 (WCStyle). 드롭인 교체 가능, 없으면 텍스트 카드 폴백.
        const FSlateBrush* Brush = FWCStyle::Portrait(Card.Id, FVector2D(96, 120));

        TSharedRef<SWidget> Inner = SNullWidget::NullWidget;
        if (Brush)
        {
            Inner = SNew(SBox).WidthOverride(96).HeightOverride(120)
                [ SNew(SImage).Image(Brush) ];
        }
        else
        {
            FString Stars;
            for (int32 i = 0; i < Card.Rarity; ++i) Stars += TEXT("★");
            Inner = SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(CardBg)).Padding(FMargin(12, 8))
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot().AutoHeight()
                    [ SNew(STextBlock).Font(CityFont(11)).ColorAndOpacity(FSlateColor(RarityColor(Card.Rarity)))
                        .Text(FText::FromString(Stars)) ]
                    + SVerticalBox::Slot().AutoHeight()
                    [ SNew(STextBlock).Font(CityFont(15)).Text(FText::FromString(Card.Name)) ]
                ];
        }

        CharacterGrid->AddSlot().Padding(0, 0, 8, 8)
        [
            SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FSlateColor(RarityColor(Card.Rarity))).Padding(1.5f)
            [ Inner ]
        ];
    }
}

const FSlateBrush* SWCCityView::GetBgBrush() const
{
    // 배경은 3D 디오라마가 렌더 — 이 브러시는 헤더 가독용 상단 다크 그라데이션 바.
    static FSlateBrush DarkBar;
    DarkBar.TintColor = FSlateColor(FLinearColor(0.02f, 0.02f, 0.03f, 0.72f));
    // 진입 도시 변경·무장 수 변화 감지로 카드 그리드 갱신 (어트리뷰트 평가 = 게임 스레드)
    if (GM.IsValid() && GM->EnteredCityId != BgLoadedCity)
    {
        BgLoadedCity = GM->EnteredCityId;
        RebuildCharacterGrid();
    }
    if (GM.IsValid() && CharacterGrid.IsValid() && CharacterGrid->GetChildren()->Num() != GM->UiMyCharacterCards().Num())
        RebuildCharacterGrid();
    return &DarkBar;
}

TSharedRef<SWidget> SWCCityView::MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action)
{
    static const FButtonStyle Style = FWCStyle::Button();
    return SNew(SButton).ButtonStyle(&Style)
        .OnClicked_Lambda([this, Action] { if (GM.IsValid()) Action(GM.Get()); return FReply::Handled(); })
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        .ContentPadding(FMargin(8, 7))
        [ SNew(STextBlock).Font(FWCStyle::Font(14)).ColorAndOpacity(FSlateColor(FWCStyle::Ink)).Text(Label) ];
}

EVisibility SWCCityView::CityVisibility() const
{
    return GM.IsValid() && GM->UiInCity() ? EVisibility::Visible : EVisibility::Collapsed;
}
