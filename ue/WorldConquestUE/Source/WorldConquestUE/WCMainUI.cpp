#include "WCMainUI.h"
#include "WCGameMode.h"
#include "WCStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"

namespace
{
    FSlateFontInfo KFont(int32 Size) { return FWCStyle::Font(Size); }
    const FLinearColor Gold = FWCStyle::GoldHi;
    const FButtonStyle PrimaryStyle = FWCStyle::PrimaryButton();
    const FButtonStyle ButtonStyle = FWCStyle::Button();
}

void SWCMainUI::Construct(const FArguments& InArgs)
{
    // [MUST] 위젯 '자신' 은 히트테스트에서 제외한다 — SCompoundWidget 의 기본 Visibility 는 Visible 이라
    // 내용이 Collapsed 여도 위젯 자체가 화면 전체를 덮는 '투명한 벽' 이 되어 아래 위젯의 클릭을 전부 삼킨다.
    // (실측 2026-07-17: ZOrder 30 인 SWCRevealOverlay 가 리빌이 없을 때도 모든 버튼 클릭을 차단)
    // SelfHitTestInvisible = 자신은 클릭 대상 아님 + 자식은 정상 클릭.
    SetVisibility(EVisibility::SelfHitTestInvisible);

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
        .BorderImage(FWCStyle::Header())
        .Padding(FMargin(22, 10))
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
            [
                SNew(STextBlock)
                .Font(FWCStyle::Title(18))
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
    return SNew(SBox).WidthOverride(300)
    [
        SNew(SBorder)
        .BorderImage(FWCStyle::Panel())
        .Padding(FMargin(22, 20))
        .Visibility(this, &SWCMainUI::SelectionVisibility)
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(STextBlock).Font(FWCStyle::Title(21)).ColorAndOpacity(FSlateColor(Gold))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiSelectionTitle() : FText::GetEmpty(); })
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 10)
            [
                SNew(STextBlock).Font(KFont(12)).AutoWrapText(true)
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiSelectionDetail() : FText::GetEmpty(); })
            ]
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).HeightOverride(42)
                [
                    SNew(SButton).ButtonStyle(&PrimaryStyle)
                    .IsEnabled_Lambda([this] { return GM.IsValid() && GM->UiCanEnterSelected(); })
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->EnterSelectedCity(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(KFont(15)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                        .Text(FText::FromString(TEXT("도시 진입 ▶"))) ]
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
                SNew(SButton).ButtonStyle(&ButtonStyle)
                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CycleRecruitUnit(); return FReply::Handled(); })
                .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(8, 6))
                [ SNew(STextBlock).Font(KFont(13)).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
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
        .BorderImage(FWCStyle::Panel())
        .Padding(FMargin(18, 16))
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
                SNew(SBox).HeightOverride(48)
                [
                    SNew(SButton).ButtonStyle(&PrimaryStyle)
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->EndTurn(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(KFont(17)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                        .Text(FText::FromString(TEXT("▶ 턴 종료"))) ]
                ]
            ]
        ];
}

TSharedRef<SWidget> SWCMainUI::MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action,
                                          TAttribute<bool> Enabled)
{
    return SNew(SButton).ButtonStyle(&ButtonStyle)
        .IsEnabled(Enabled)
        .OnClicked_Lambda([this, Action] { if (GM.IsValid()) Action(GM.Get()); return FReply::Handled(); })
        .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(8, 6))
        [ SNew(STextBlock).Font(KFont(14)).ColorAndOpacity(FSlateColor(FWCStyle::Ink)).Text(Label) ];
}

EVisibility SWCMainUI::PlayingVisibility() const
{
    // 도시 화면 중엔 지도용 UI 를 숨긴다 (도시 화면이 전면 대체).
    // [MUST] Visible 이 아니라 SelfHitTestInvisible — 이 SOverlay 는 전체 화면을 덮으므로 Visible 이면
    // 빈 지도 영역의 클릭·드래그까지 삼켜 지도 선택/팬이 죽는다(2026-07-17 실측: keyDown=0).
    // SelfHitTestInvisible = 이 컨테이너는 통과, 자식 패널·버튼만 클릭 대상.
    // 모달(전투 결과·초빙 리빌·컷씬)이 떠 있는 동안 지도 UI 를 숨긴다 —
    // 없으면 딤 뒤의 [턴 종료]·[저장]·[징병] 이 그대로 클릭된다(실측).
    const bool bModal = GM.IsValid()
        && (GM->ActiveBattle.IsSet() || GM->ActiveReveal.IsSet() || GM->GetActiveCutsceneDef() != nullptr);
    return GM.IsValid() && GM->UiIsPlaying() && !GM->UiInCity() && !bModal
        ? EVisibility::SelfHitTestInvisible : EVisibility::Collapsed;
}

EVisibility SWCMainUI::SelectionVisibility() const
{
    return GM.IsValid() && GM->UiHasSelection() ? EVisibility::Visible : EVisibility::Collapsed;
}
