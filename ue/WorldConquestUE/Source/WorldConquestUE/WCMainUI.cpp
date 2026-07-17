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

        // ── 좌측: 세력 명령 + 이번 달에 한 일 (ux-design §3.1·§5.3) ──
        + SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(14, 56, 0, 0)
        [
            MakeFactionPanel()
        ]

        // ── 우하단: 턴 종료 **단독** — 유일한 진행 수단이라 이웃을 두지 않는다 ──
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
                // 행동력이 없다는 사실을 여기서 말한다 (ux-design §3.1)
                .ToolTipText_Lambda([this] { return GM.IsValid() ? GM->UiFreeActionHint() : FText::GetEmpty(); })
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); })
            ]
            // 턴을 끝내면 무슨 일이 벌어지는지 예고 (ux-design §3.2)
            + SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center).HAlign(HAlign_Right)
            [
                SNew(STextBlock)
                .Font(KFont(12))
                .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiNextUpText() : FText::GetEmpty(); })
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
                // 상업·농업은 §2.3.2 로 수치제 개발이 됐다(시장·농지 시설 폐지) — 개발·무장 파견·초빙은 도시 안에서.
                MakeButton(FText::FromString(TEXT("도시 들어가기 (개발·무장)")),
                    [](AWCGameMode* G) { G->EnterSelectedCity(); },
                    TAttribute<bool>::CreateLambda([this] { return GM.IsValid() && GM->UiCanEnterSelected(); }))
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
    // 턴 종료 단독 [MUST] — 유일한 진행 수단이므로 오조작할 이웃을 두지 않는다 (ux-design §3.3).
    return SNew(SBox).WidthOverride(230).HeightOverride(56)
    [
        SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())
        .OnClicked_Lambda([this] { if (GM.IsValid()) GM->RequestEndTurn(); return FReply::Handled(); })
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [ SNew(STextBlock).Font(KFont(18)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
            .Text(FText::FromString(TEXT("▶ 이번 달 끝내기"))) ]
    ];
}

TSharedRef<SWidget> SWCMainUI::MakeFactionPanel()
{
    // 세력 명령 = 거점이 아니라 여기 (초빙은 노드 인자가 없는 세력 명령 — ux-design §0·§5.1)
    return SNew(SBox).WidthOverride(250)
    [
        SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(16, 14))
        [
            SNew(SVerticalBox)
            + SVerticalBox::Slot().AutoHeight()
            [
                SNew(SBox).HeightOverride(44)
                [
                    SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())
                    .OnClicked_Lambda([this] { if (GM.IsValid()) GM->SummonOnce(); return FReply::Handled(); })
                    .HAlign(HAlign_Center).VAlign(VAlign_Center)
                    [ SNew(STextBlock).Font(KFont(15)).ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                        .Text(FText::FromString(TEXT("★ 사람 부르기"))) ]
                ]
            ]
            + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().FillWidth(1)[ MakeButton(FText::FromString(TEXT("저장")),
                    [](AWCGameMode* G) { G->QuickSave(); }) ]
                + SHorizontalBox::Slot().FillWidth(1).Padding(6, 0, 0, 0)[ MakeButton(FText::FromString(TEXT("이어하기")),
                    [](AWCGameMode* G) { G->QuickLoad(); }) ]
            ]
            // 이번 달에 한 일 — 행동력이 없으므로 '남은 기회'가 아니라 '한 일'을 보여준다
            + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 4)
            [ SNew(STextBlock).Font(KFont(13)).ColorAndOpacity(FSlateColor(Gold))
                .Text(FText::FromString(TEXT("이번 달에 한 일"))) ]
            + SVerticalBox::Slot().AutoHeight()
            [ SNew(STextBlock).Font(KFont(12)).AutoWrapText(true)
                .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                .Text_Lambda([this] { return GM.IsValid() ? GM->UiMyTurnActionsText() : FText::GetEmpty(); }) ]
        ]
    ];
}

TSharedRef<SWidget> SWCMainUI::MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action,
                                          TAttribute<bool> Enabled)
{
    return SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef())
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
