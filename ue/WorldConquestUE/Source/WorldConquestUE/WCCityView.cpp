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

            // 디오라마가 보이는 구간 — 좌측에 건물 간판, 우측에 열린 패널 하나
            + SVerticalBox::Slot().FillHeight(1).Padding(0, 18, 0, 0)
            [
                SNew(SHorizontalBox)

                // ── 건물 간판 (클릭 = 그 건물 패널) ──
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Top)
                [
                    SNew(SBox).WidthOverride(216)
                    [
                        SNew(SVerticalBox)
                        + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
                        [ SNew(STextBlock).Font(CityFont(13)).ColorAndOpacity(FSlateColor(TextDim))
                            .Text(FText::FromString(TEXT("건물을 눌러보세요"))) ]
                        + SVerticalBox::Slot().AutoHeight()[ MakeSignboard(TEXT("chars"),    TEXT("recruit"),  FText::FromString(TEXT("무장·개발"))) ]
                        + SVerticalBox::Slot().AutoHeight()[ MakeSignboard(TEXT("barracks"), TEXT("barracks"), FText::FromString(TEXT("병영"))) ]
                        + SVerticalBox::Slot().AutoHeight()[ MakeSignboard(TEXT("academy"),  TEXT("academy"),  FText::FromString(TEXT("학당"))) ]
                        + SVerticalBox::Slot().AutoHeight()[ MakeSignboard(TEXT("walls"),    TEXT("walls"),    FText::FromString(TEXT("성벽"))) ]
                        + SVerticalBox::Slot().AutoHeight()[ MakeSignboard(TEXT("port"),     TEXT("port"),     FText::FromString(TEXT("항구"))) ]
                    ]
                ]

                // 가운데 = 디오라마 전경 (아무것도 안 열면 다 보인다)
                + SHorizontalBox::Slot().FillWidth(1)[ SNullWidget::NullWidget ]

                // ── 열린 건물 패널 하나 (우측 도킹) ──
                + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Top)
                [
                    SNew(SBox).WidthOverride(360)
                    .Visibility_Lambda([this]
                    { return GM.IsValid() && GM->UiAnyBuildingOpen() ? EVisibility::Visible : EVisibility::Collapsed; })
                    [ MakeBuildingPanel() ]
                ]
            ]

            // 하단: 성문 = 지도로 나가기
            + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 12, 0, 0)
            [
                SNew(SBox).WidthOverride(300)   // 높이 고정 제거 — MakeButton 이 자동높이(고 DPI 짤림 방지)
                [
                    MakeButton(FText::FromString(TEXT("성문 — 세계지도로  (ESC)")),
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
                SNew(SBox).WidthOverride(62)   // 높이 고정 제거 — ContentPadding 8 로 자동높이+여유
                [
                    SNew(SButton).ButtonStyle(&BtnStyle())
                    .IsEnabled_Lambda([this, Kind] { return FacilityLevelOf(Kind) < 3; })
                    .OnClicked_Lambda([this, Kind]
                    { if (GM.IsValid()) GM->BuildSelected(Kind); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(6, 8))
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

// ── 건물 간판 — 클릭하면 그 건물 패널이 열린다 (다시 누르면 닫힘) ──
TSharedRef<SWidget> SWCCityView::MakeSignboard(const FString& Kind, const TCHAR* IconName, const FText& Label)
{
    // 칸 높이를 **고정하지 않는다** — 버튼이 내용(아이콘·글자)에 맞춰 자동으로 커지게 둔다.
    // 예전엔 HeightOverride(56) 로 높이를 고정했는데, 창을 최대화하면(2560x1440 = Slate DPI 스케일 ~1.5)
    // 글자 라인박스가 56px 안에 안 들어가 버튼이 내용을 하단에서 잘랐다(2026-07-18 최대화 재현). 1600x1000
    // (런처 기본)에선 스케일 1.0 이라 우연히 맞아 안 잘려 그동안 못 잡았다. 자동 높이면 어떤 DPI 든 안 잘린다.
    return SNew(SBox).Padding(FMargin(0, 0, 0, 7))
    [
        SNew(SButton)
        .ButtonStyle(&FWCStyle::ButtonRef())
        .OnClicked_Lambda([this, Kind] { if (GM.IsValid()) GM->OpenCityBuilding(Kind); return FReply::Handled(); })
        .HAlign(HAlign_Left).VAlign(VAlign_Center).ContentPadding(FMargin(12, 11))
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
            [
                SNew(SBox).WidthOverride(26).HeightOverride(26)
                [
                    SNew(SImage).Image_Lambda([this, Kind, IconName]
                    {
                        // 열린 건물은 금색, 나머지는 흐리게 — 지금 뭘 보고 있는지 표시
                        const bool bOpen = GM.IsValid() && GM->UiBuildingOpen(Kind);
                        return FWCStyle::Icon(IconName, bOpen ? FWCStyle::GoldHi : GoldDim, 26);
                    })
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(9, 0, 0, 0)
            [
                SNew(STextBlock).Font(CityFont(15)).Text(Label)
                .ColorAndOpacity_Lambda([this, Kind]
                {
                    const bool bOpen = GM.IsValid() && GM->UiBuildingOpen(Kind);
                    return FSlateColor(bOpen ? FWCStyle::GoldHi : FWCStyle::Ink);
                })
            ]
            // 시설이면 레벨(●○○) — 미건설이면 "아직 없음"
            + SHorizontalBox::Slot().FillWidth(1).HAlign(HAlign_Right).VAlign(VAlign_Center).Padding(10, 0, 0, 0)
            [
                SNew(STextBlock).Font(CityFont(11)).ColorAndOpacity(FSlateColor(TextDim))
                .Text_Lambda([this, Kind]
                {
                    if (Kind == TEXT("chars")) return FText::GetEmpty();
                    const int32 Lv = FacilityLevelOf(Kind);
                    if (Lv <= 0) return FText::FromString(TEXT("아직 없음"));
                    FString Pips;
                    for (int32 i = 1; i <= 3; ++i) Pips += (i <= Lv) ? TEXT("●") : TEXT("○");
                    return FText::FromString(Pips);
                })
            ]
        ]
    ];
}

// ── 열린 건물 패널 하나 (우측 도킹, ux-design §5.2 — 한 번에 하나) ──
TSharedRef<SWidget> SWCCityView::MakeBuildingPanel()
{
    return SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(20, 16))
    [
        SNew(SVerticalBox)

        // 제목 + 닫기
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center)
            [
                SNew(STextBlock).Font(FWCStyle::Title(21)).ColorAndOpacity(FSlateColor(FWCStyle::GoldHi))
                .Text_Lambda([this]
                {
                    if (!GM.IsValid()) return FText::GetEmpty();
                    const FString K = GM->OpenBuilding;
                    if (K == TEXT("chars")) return FText::FromString(TEXT("우리 무장"));
                    return FText::FromString(AWCGameMode::FacilityNameKo(K));
                })
            ]
            + SHorizontalBox::Slot().AutoWidth()
            [
                SNew(SBox).WidthOverride(34).HeightOverride(28)
                [
                    SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef())
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CloseCityBuilding(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [
                        SNew(STextBlock).Font(CityFont(13)).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                        .Text(FText::FromString(TEXT("✕")))
                    ]
                ]
            ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 7, 0, 11)
        [
            SNew(SBox).HeightOverride(2)
            [ SNew(SImage).Image(White()).ColorAndOpacity(FSlateColor(FWCStyle::Gold * 0.6f)) ]
        ]

        // 본문 — 건물별. 전부 만들어두고 해당하는 것만 보인다(전환 비용 0).
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).Visibility_Lambda([this]
                { return GM.IsValid() && GM->UiBuildingOpen(TEXT("barracks")) ? EVisibility::Visible : EVisibility::Collapsed; })
                [ MakeBarracksBody() ]
            ]
            + SVerticalBox::Slot().FillHeight(1)
            [
                SNew(SBox).Visibility_Lambda([this]
                { return GM.IsValid() && GM->UiBuildingOpen(TEXT("chars")) ? EVisibility::Visible : EVisibility::Collapsed; })
                [ MakeCharactersBody() ]
            ]
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).Visibility_Lambda([this]
                {
                    if (!GM.IsValid()) return EVisibility::Collapsed;
                    const FString K = GM->OpenBuilding;
                    const bool bFacility = !K.IsEmpty() && K != TEXT("chars") && K != TEXT("barracks");
                    return bFacility ? EVisibility::Visible : EVisibility::Collapsed;
                })
                [ MakeFacilityBody(FString()) ]
            ]
        ]
    ];
}

// 시설 공통 — 효과 설명 + 짓기/크게 만들기. 대상은 런타임의 OpenBuilding.
TSharedRef<SWidget> SWCCityView::MakeFacilityBody(const FString& /*Unused*/)
{
    return SNew(SVerticalBox)
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(STextBlock).Font(CityFont(14)).AutoWrapText(true).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
            .Text_Lambda([this]
            {
                if (!GM.IsValid()) return FText::GetEmpty();
                const FString K = GM->OpenBuilding;
                if (K == TEXT("academy")) return FText::FromString(TEXT("공부하는 곳이에요. 기술이 올라가요."));
                if (K == TEXT("walls"))   return FText::FromString(TEXT("성벽이 높으면 쳐들어와도 잘 버텨요."));
                if (K == TEXT("port"))    return FText::FromString(TEXT("배가 드나들어요. 교역으로 금·식량을 벌어요."));
                return FText::GetEmpty();
            })
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(STextBlock).Font(CityFont(13)).ColorAndOpacity(FSlateColor(TextDim))
            .Text_Lambda([this]
            {
                if (!GM.IsValid()) return FText::GetEmpty();
                const int32 Lv = FacilityLevelOf(GM->OpenBuilding);
                return FText::FromString(Lv <= 0 ? FString(TEXT("아직 없어요. 지어 보세요."))
                                                 : FString::Printf(TEXT("지금 크기: %d단계 / 3단계"), Lv));
            })
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 0)
        [
            SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())   // 높이 고정 제거 — ContentPadding 11
                .OnClicked_Lambda([this]
                {
                    if (GM.IsValid() && !GM->OpenBuilding.IsEmpty()) GM->BuildSelected(GM->OpenBuilding);
                    return FReply::Handled();
                })
                .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(0, 11))
                [
                    SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                    .Text_Lambda([this]
                    {
                        const int32 Lv = GM.IsValid() ? FacilityLevelOf(GM->OpenBuilding) : 0;
                        return FText::FromString(Lv <= 0 ? TEXT("짓기") : TEXT("크게 만들기"));
                    })
                ]
        ];
}

// 병영 — 주둔 부대 + 병사 모으기 (지도에도 있다 — 고빈도, ux-design §1 P-3)
TSharedRef<SWidget> SWCCityView::MakeBarracksBody()
{
    return SNew(SVerticalBox)
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(STextBlock).Font(CityFont(13)).AutoWrapText(true).ColorAndOpacity(FSlateColor(TextDim))
            .Text(FText::FromString(TEXT("병사를 모으고 부대를 두는 곳이에요. (지도에서도 모을 수 있어요)")))
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 6)
        [
            SNew(STextBlock).Font(CityFont(14)).ColorAndOpacity(FSlateColor(Gold))
            .Text(FText::FromString(TEXT("여기 있는 부대")))
        ]
        + SVerticalBox::Slot().AutoHeight()
        [
            SNew(STextBlock).Font(CityFont(13)).AutoWrapText(true).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
            .Text_Lambda([this] { return GM.IsValid() ? GM->UiCityArmies() : FText::GetEmpty(); })
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 0)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1)
            [ MakeButton(FText::FromString(TEXT("병사 모으기 10")), [](AWCGameMode* G) { G->RecruitSelected(10); }) ]
            + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)
            [ MakeButton(FText::FromString(TEXT("50")), [](AWCGameMode* G) { G->RecruitSelected(50); }) ]
        ]
        + SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 0)
        [ MakeFacilityBody(FString()) ];
}

// 우리 무장 — 초상 카드 그리드
TSharedRef<SWidget> SWCCityView::MakeCharactersBody()
{
    return SNew(SVerticalBox)
        // 상업·농업 개발 수치 (§2.3.2 수치제 경제)
        + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)
        [
            SNew(STextBlock).Font(CityFont(15)).ColorAndOpacity(FSlateColor(Gold))
            .Text_Lambda([this] { return GM.IsValid() ? GM->UiCityDevelopment() : FText::GetEmpty(); })
        ]
        // 안내 + 선택한 파견 무장
        + SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
        [
            SNew(STextBlock).Font(CityFont(13)).AutoWrapText(true).ColorAndOpacity(FSlateColor(TextDim))
            .Text_Lambda([this] { return GM.IsValid() ? GM->UiDispatchCharText() : FText::GetEmpty(); })
        ]
        // 초상 그리드 — 클릭하면 그 무장을 파견 대상으로 선택 (테두리 금색)
        + SVerticalBox::Slot().FillHeight(1)
        [
            SNew(SScrollBox)
            + SScrollBox::Slot()
            [ SAssignNew(CharacterGrid, SWrapBox).UseAllottedSize(true) ]
        ]
        // 파견 행동 — 선택 무장으로 이 고을 개발 / 재보 탐색 (§2.3.2, 무장 능력치에 성과 좌우)
        + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1)
            [ MakeDispatchButton(FText::FromString(TEXT("상업 개발")),
                [](AWCGameMode* G) { G->DevelopSelected(TEXT("commerce")); }) ]
            + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)
            [ MakeDispatchButton(FText::FromString(TEXT("농업 개발")),
                [](AWCGameMode* G) { G->DevelopSelected(TEXT("agriculture")); }) ]
            + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)
            [ MakeDispatchButton(FText::FromString(TEXT("재보 탐색")),
                [](AWCGameMode* G) { G->SearchSelected(); }) ]
        ];
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

        // 클릭 = 파견 대상 선택. 선택된 무장은 테두리 금색 (§2.3.2 개발·탐색의 주어).
        const FString CardId = Card.Id;
        const int32 CardRarity = Card.Rarity;
        CharacterGrid->AddSlot().Padding(0, 0, 8, 8)
        [
            SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef()).ContentPadding(FMargin(0))
            .OnClicked_Lambda([this, CardId] { if (GM.IsValid()) GM->SelectDispatchChar(CardId); return FReply::Handled(); })
            [
                SNew(SBorder).BorderImage(White())
                .BorderBackgroundColor_Lambda([this, CardId, CardRarity]
                {
                    const bool bSel = GM.IsValid() && GM->DispatchCharId == CardId;
                    return FSlateColor(bSel ? FLinearColor(0.98f, 0.85f, 0.30f) : RarityColor(CardRarity));
                })
                .Padding(2.5f)
                [ Inner ]
            ]
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
        .ContentPadding(FMargin(8, 10))   // 상하 10 = 고 DPI 글자 여유(하단 짤림 방지)
        [ SNew(STextBlock).Font(FWCStyle::Font(14)).ColorAndOpacity(FSlateColor(FWCStyle::Ink)).Text(Label) ];
}

// 파견 행동 버튼 (§2.3.2) — 파견할 무장이 선택돼 있을 때만 활성. 미선택이면 비활성(선택하라는 안내는 상단 텍스트).
TSharedRef<SWidget> SWCCityView::MakeDispatchButton(const FText& Label, TFunction<void(AWCGameMode*)> Action)
{
    return SNew(SButton).ButtonStyle(&BtnStyle())
        .IsEnabled_Lambda([this] { return GM.IsValid() && GM->UiHasDispatchChar(); })
        .OnClicked_Lambda([this, Action] { if (GM.IsValid()) Action(GM.Get()); return FReply::Handled(); })
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        .ContentPadding(FMargin(8, 7))
        [ SNew(STextBlock).Font(CityFont(13)).ColorAndOpacity(FSlateColor(FWCStyle::Ink)).Text(Label) ];
}

EVisibility SWCCityView::CityVisibility() const
{
    return GM.IsValid() && GM->UiInCity() ? EVisibility::Visible : EVisibility::Collapsed;
}
