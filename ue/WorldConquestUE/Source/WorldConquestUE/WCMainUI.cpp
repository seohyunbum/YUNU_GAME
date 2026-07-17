#include "WCMainUI.h"
#include "WCGameMode.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Engine/Font.h"

namespace
{
    // 엔진 레거시 폰트 — Canvas 에서 한글 폴백이 검증된 폰트를 Slate 로 (Roboto 는 한글 글리프 없음)
    FSlateFontInfo KFont(int32 Size)
    {
        FSlateFontInfo Info = GEngine->GetLargeFont()->GetLegacySlateFontInfo();
        Info.Size = Size;
        return Info;
    }

    const FLinearColor PanelBg(0.02f, 0.02f, 0.05f, 0.82f);
    const FLinearColor Gold(0.85f, 0.72f, 0.3f);
}

void SWCMainUI::Construct(const FArguments& InArgs)
{
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SOverlay)
        .Visibility(this, &SWCMainUI::PlayingVisibility)

        // ── 상단 자원 바 ──
        + SOverlay::Slot().HAlign(HAlign_Fill).VAlign(VAlign_Top)
        [
            MakeTopBar()
        ]

        // ── 우측 영지 정보/명령 창 ──
        + SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Center).Padding(0, 0, 14, 0)
        [
            MakeProvincePanel()
        ]

        // ── 우하단 전역 버튼 ──
        + SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Bottom).Padding(0, 0, 14, 14)
        [
            MakeGlobalPanel()
        ]
    ];
}

TSharedRef<SWidget> SWCMainUI::MakeTopBar()
{
    return SNew(SBorder)
        .BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
        .BorderBackgroundColor(FSlateColor(PanelBg))
        .Padding(FMargin(18, 8))
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
            [
                SNew(STextBlock)
                .Font(KFont(17))
                .ColorAndOpacity(FSlateColor(Gold))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiTurnText() : FText::GetEmpty(); })
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(36, 0, 0, 0)
            [
                SNew(STextBlock)
                .Font(KFont(15))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); })
            ]
        ];
}

TSharedRef<SWidget> SWCMainUI::MakeProvincePanel()
{
    return SNew(SBox).WidthOverride(280)
    [
        SNew(SBorder)
        .BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
        .BorderBackgroundColor(FSlateColor(PanelBg))
        .Padding(FMargin(14, 12))
        .Visibility(this, &SWCMainUI::SelectionVisibility)
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(STextBlock).Font(KFont(19)).ColorAndOpacity(FSlateColor(Gold))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiSelectionTitle() : FText::GetEmpty(); })
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 10)
            [
                SNew(STextBlock).Font(KFont(12)).AutoWrapText(true)
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiSelectionDetail() : FText::GetEmpty(); })
            ]
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).HeightOverride(40)
                [
                    SNew(SButton)
                    .ButtonColorAndOpacity(FSlateColor(Gold))
                    .IsEnabled_Lambda([this] { return GM.IsValid() && GM->UiCanEnterSelected(); })
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->EnterSelectedCity(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(KFont(15)).ColorAndOpacity(FSlateColor(FLinearColor::Black))
                        .Text(FText::FromString(TEXT("🏯 도시 진입"))) ]
                ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)[ MakeButton(FText::FromString(TEXT("점령 (빈 영지)")),
                [](AWCGameMode* G) { G->CaptureSelected(); }) ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("징병 10")),
                    [](AWCGameMode* G) { G->RecruitSelected(10); }) ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("징병 50")),
                    [](AWCGameMode* G) { G->RecruitSelected(50); }) ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CycleRecruitUnit(); return FReply::Handled(); })
                [ SNew(STextBlock).Font(KFont(13))
                    .Text_Lambda([this] { return GM.IsValid() ? GM->UiRecruitUnitText() : FText::GetEmpty(); }) ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("시장 건설")),
                    [](AWCGameMode* G) { G->BuildSelected(TEXT("market")); }) ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("농지 건설")),
                    [](AWCGameMode* G) { G->BuildSelected(TEXT("farm")); }) ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("부대 이동")),
                    [](AWCGameMode* G) { G->BeginMoveMode(); },
                    TAttribute<bool>::CreateLambda([this] { return GM.IsValid() && GM->UiArmyReady(); })) ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("부대 공격")),
                    [](AWCGameMode* G) { G->BeginAttackMode(); },
                    TAttribute<bool>::CreateLambda([this] { return GM.IsValid() && GM->UiArmyReady(); })) ]
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCMainUI::MakeGlobalPanel()
{
    return SNew(SBorder)
        .BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush"))
        .BorderBackgroundColor(FSlateColor(PanelBg))
        .Padding(FMargin(12, 10))
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()[ MakeButton(FText::FromString(TEXT("★ 무장 초빙")),
                [](AWCGameMode* G) { G->SummonOnce(); }) ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("저장")),
                    [](AWCGameMode* G) { G->QuickSave(); }) ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("이어하기")),
                    [](AWCGameMode* G) { G->QuickLoad(); }) ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
            [
                SNew(SBox).HeightOverride(46)
                [
                    SNew(SButton)
                    .ButtonColorAndOpacity(FSlateColor(Gold))
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->EndTurn(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(KFont(17)).ColorAndOpacity(FSlateColor(FLinearColor::Black))
                        .Text(FText::FromString(TEXT("▶ 턴 종료"))) ]
                ]
            ]
        ];
}

TSharedRef<SWidget> SWCMainUI::MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action,
                                          TAttribute<bool> Enabled)
{
    return SNew(SButton)
        .IsEnabled(Enabled)
        .OnClicked_Lambda([this, Action] { if (GM.IsValid()) Action(GM.Get()); return FReply::Handled(); })
        .HAlign(HAlign_Center)
        [ SNew(STextBlock).Font(KFont(13)).Text(Label) ];
}

EVisibility SWCMainUI::PlayingVisibility() const
{
    // 도시 화면 중엔 지도용 UI 를 숨긴다 (도시 화면이 전면 대체)
    return GM.IsValid() && GM->UiIsPlaying() && !GM->UiInCity() ? EVisibility::Visible : EVisibility::Collapsed;
}

EVisibility SWCMainUI::SelectionVisibility() const
{
    return GM.IsValid() && GM->UiHasSelection() ? EVisibility::Visible : EVisibility::Collapsed;
}
