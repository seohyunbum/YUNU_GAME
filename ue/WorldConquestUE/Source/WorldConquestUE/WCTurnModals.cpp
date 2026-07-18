#include "WCTurnModals.h"
#include "WCGameMode.h"
#include "WCStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"

namespace
{
    const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }
    const FLinearColor Dim(0.f, 0.f, 0.f, 0.82f);
}

// ─────────────────────────── 턴 리포트 ───────────────────────────

void SWCTurnReport::Construct(const FArguments& InArgs)
{
    // 위젯 자신은 클릭 대상 아님 — 자식(딤)이 Visible 일 때만 입력을 막는다.
    SetVisibility(EVisibility::SelfHitTestInvisible);
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SBorder)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(Dim))
        .Visibility(this, &SWCTurnReport::ReportVisibility)   // Visible = 딤이 클릭 흡수
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [
            SNew(SBox).WidthOverride(760)
            [
                SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(36, 28))
                [
                    SNew(SVerticalBox)

                    // 제목
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
                    [
                        SNew(STextBlock).Font(FWCStyle::Title(30))
                        .ColorAndOpacity(FSlateColor(FWCStyle::GoldHi)).ShadowOffset(FVector2D(2, 2))
                        .Text_Lambda([this] { return GM.IsValid() ? GM->UiReportTitle() : FText::GetEmpty(); })
                    ]
                    + SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 16)
                    [ SNew(SBox).HeightOverride(2)
                        [ SNew(SImage).Image(White()).ColorAndOpacity(FSlateColor(FWCStyle::Gold * 0.7f)) ] ]

                    // 섹션 (비면 자동 숨김)
                    + SVerticalBox::Slot().FillHeight(1).MaxHeight(420)
                    [
                        SNew(SScrollBox)
                        + SScrollBox::Slot()
                        [
                            SNew(SVerticalBox)
                            + SVerticalBox::Slot().AutoHeight()
                            [ MakeSection(FText::FromString(TEXT("싸움")),
                                [this]() -> const TArray<FString>* { return GM.IsValid() ? &GM->UiReport().Battle : nullptr; }) ]
                            + SVerticalBox::Slot().AutoHeight()
                            [ MakeSection(FText::FromString(TEXT("다른 나라")),
                                [this]() -> const TArray<FString>* { return GM.IsValid() ? &GM->UiReport().World : nullptr; }) ]
                            + SVerticalBox::Slot().AutoHeight()
                            [ MakeSection(FText::FromString(TEXT("내 땅")),
                                [this]() -> const TArray<FString>* { return GM.IsValid() ? &GM->UiReport().Home : nullptr; }) ]
                        ]
                    ]

                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 22, 0, 0)
                    [
                        SNew(SBox).WidthOverride(260)   // 높이 고정 제거 — ContentPadding 11(고 DPI 짤림 방지)
                        [
                            SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())
                            .OnClicked_Lambda([this] { if (GM.IsValid()) GM->DismissReport(); return FReply::Handled(); })
                            .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(0, 11))
                            [ SNew(STextBlock).Font(FWCStyle::Font(17))
                                .ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                                .Text(FText::FromString(TEXT("확인 · 내 차례"))) ]
                        ]
                    ]
                ]
            ]
        ]
    ];
}

TSharedRef<SWidget> SWCTurnReport::MakeSection(const FText& Title, TFunction<const TArray<FString>*()> Rows)
{
    return SNew(SVerticalBox)
        // 빈 섹션은 통째로 숨긴다 (ux-design §4)
        .Visibility_Lambda([Rows]
        {
            const TArray<FString>* R = Rows();
            return (R && R->Num() > 0) ? EVisibility::Visible : EVisibility::Collapsed;
        })
        + SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 6)
        [ SNew(STextBlock).Font(FWCStyle::Font(18)).ColorAndOpacity(FSlateColor(FWCStyle::Gold)).Text(Title) ]
        + SVerticalBox::Slot().AutoHeight().Padding(14, 0, 0, 8)
        [
            SNew(STextBlock).Font(FWCStyle::Font(15)).AutoWrapText(true)
            .ColorAndOpacity(FSlateColor(FWCStyle::Ink))
            .Text_Lambda([Rows]
            {
                const TArray<FString>* R = Rows();
                if (!R) return FText::GetEmpty();
                FString S;
                for (const FString& Line : *R) S += FString::Printf(TEXT("· %s\n"), *Line);
                return FText::FromString(S.TrimEnd());
            })
        ];
}

EVisibility SWCTurnReport::ReportVisibility() const
{
    return GM.IsValid() && GM->UiShowingReport() ? EVisibility::Visible : EVisibility::Collapsed;
}

// ─────────────────────────── 턴 종료 확인 ───────────────────────────

void SWCEndTurnConfirm::Construct(const FArguments& InArgs)
{
    SetVisibility(EVisibility::SelfHitTestInvisible);
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SBorder)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(Dim))
        .Visibility(this, &SWCEndTurnConfirm::ConfirmVisibility)
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [
            SNew(SBox).WidthOverride(560)
            [
                SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(34, 26))
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
                    [ SNew(STextBlock).Font(FWCStyle::Title(24)).ColorAndOpacity(FSlateColor(FWCStyle::GoldHi))
                        .Text(FText::FromString(TEXT("이번 달을 끝낼까요?"))) ]

                    + SVerticalBox::Slot().AutoHeight().Padding(0, 18, 0, 6)
                    [ SNew(STextBlock).Font(FWCStyle::Font(16)).ColorAndOpacity(FSlateColor(FWCStyle::Gold))
                        .Text(FText::FromString(TEXT("내가 한 일"))) ]
                    + SVerticalBox::Slot().AutoHeight().Padding(14, 0, 0, 10)
                    [ SNew(STextBlock).Font(FWCStyle::Font(15)).AutoWrapText(true)
                        .ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                        .Text_Lambda([this] { return GM.IsValid() ? GM->UiMyTurnActionsText() : FText::GetEmpty(); }) ]

                    + SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
                    [ SNew(STextBlock).Font(FWCStyle::Font(14)).ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                        .Text_Lambda([this] { return GM.IsValid() ? GM->UiResourceText() : FText::GetEmpty(); }) ]
                    + SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 0)
                    [ SNew(STextBlock).Font(FWCStyle::Font(13)).AutoWrapText(true)
                        .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                        .Text_Lambda([this] { return GM.IsValid() ? GM->UiNextUpText() : FText::GetEmpty(); }) ]
                    + SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)
                    [ SNew(STextBlock).Font(FWCStyle::Font(13))
                        .ColorAndOpacity(FSlateColor(FLinearColor(0.95f, 0.72f, 0.35f)))
                        // ※ 를 쓴다 — GothicA1 에 ⚠(U+26A0) 글리프가 없어 두부(□)로 뜬다(실측)
                        .Text(FText::FromString(TEXT("※ 끝내면 이번 달 명령은 못 바꿔요."))) ]

                    + SVerticalBox::Slot().AutoHeight().Padding(0, 22, 0, 0)
                    [
                        SNew(SHorizontalBox)
                        + SHorizontalBox::Slot().FillWidth(1)
                        [
                            SNew(SBox)   // 높이 고정 제거 — ContentPadding 11(고 DPI 짤림 방지)
                            [
                                SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef())
                                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->CancelEndTurn(); return FReply::Handled(); })
                                .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(0, 11))
                                [ SNew(STextBlock).Font(FWCStyle::Font(16)).ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                                    .Text(FText::FromString(TEXT("더 할래요"))) ]
                            ]
                        ]
                        + SHorizontalBox::Slot().FillWidth(1).Padding(10, 0, 0, 0)
                        [
                            SNew(SBox)   // 높이 고정 제거 — ContentPadding 11(고 DPI 짤림 방지)
                            [
                                SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())
                                .OnClicked_Lambda([this] { if (GM.IsValid()) GM->ConfirmEndTurn(); return FReply::Handled(); })
                                .HAlign(HAlign_Center).VAlign(VAlign_Center).ContentPadding(FMargin(0, 11))
                                [ SNew(STextBlock).Font(FWCStyle::Font(16))
                                    .ColorAndOpacity(FSlateColor(FLinearColor(0.1f, 0.07f, 0.02f)))
                                    .Text(FText::FromString(TEXT("이번 달 끝내기"))) ]
                            ]
                        ]
                    ]
                ]
            ]
        ]
    ];
}

EVisibility SWCEndTurnConfirm::ConfirmVisibility() const
{
    return GM.IsValid() && GM->UiConfirmingEndTurn() ? EVisibility::Visible : EVisibility::Collapsed;
}
