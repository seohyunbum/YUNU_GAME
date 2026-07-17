#include "WCFactionSelect.h"
#include "WCGameMode.h"
#include "WCMapActor.h"
#include "WCStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"

namespace
{
    const FSlateBrush* White() { return FCoreStyle::Get().GetBrush("WhiteBrush"); }
}

/**
 * 1인/2인 토글 버튼 한 개. bWantHotseat = 이 버튼이 켜는 모드.
 *
 * 선택 표시는 **두 스킨(밝은 금색 Primary / 어두운 Normal)을 겹쳐두고 Visibility 로 교체**한다.
 * ButtonStyle 은 attribute 가 아니라(_Lambda 불가) 런타임 교체가 안 되고, 어두운 Normal 브러시를
 * 금색으로 틴트하면 murky brown 이 돼 '선택'이 오히려 비활성처럼 보였다(2026-07-17 실측).
 * 겹친 두 버튼 중 항상 하나만 Visible → 그 하나가 클릭을 받는다.
 */
TSharedRef<SWidget> SWCFactionSelect::MakeModeButton(const FString& Label, bool bWantHotseat)
{
    auto OnClick = [this, bWantHotseat]
    {
        if (GM.IsValid() && GM->bHotseat != bWantHotseat) GM->ToggleHotseat();
        return FReply::Handled();
    };
    auto VisWhen = [this, bWantHotseat](bool bSelected)
    {
        return [this, bWantHotseat, bSelected]
        {
            const bool bOn = GM.IsValid() && GM->bHotseat == bWantHotseat;
            return (bOn == bSelected) ? EVisibility::Visible : EVisibility::Collapsed;
        };
    };

    return SNew(SBox).WidthOverride(230).HeightOverride(58)
    [
        SNew(SOverlay)
        // 선택됨 — 밝은 금색 Primary + 진한 글씨
        + SOverlay::Slot()
        [
            SNew(SButton).ButtonStyle(&FWCStyle::PrimaryButtonRef())
            .Visibility_Lambda(VisWhen(true)).OnClicked_Lambda(OnClick)
            .HAlign(HAlign_Center).VAlign(VAlign_Center)
            [ SNew(STextBlock).Font(FWCStyle::Bold(16))
                .ColorAndOpacity(FSlateColor(FLinearColor(0.10f, 0.07f, 0.02f)))
                .Text(FText::FromString(Label)) ]
        ]
        // 미선택 — 어두운 Normal + 밝은 글씨
        + SOverlay::Slot()
        [
            SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef())
            .Visibility_Lambda(VisWhen(false)).OnClicked_Lambda(OnClick)
            .HAlign(HAlign_Center).VAlign(VAlign_Center)
            [ SNew(STextBlock).Font(FWCStyle::Font(16))
                .ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                .Text(FText::FromString(Label)) ]
        ]
    ];
}

void SWCFactionSelect::Construct(const FArguments& InArgs)
{
    // 위젯 자신은 클릭 대상 아님 — 자식(딤)이 Visible 일 때만 입력을 잡는다.
    SetVisibility(EVisibility::SelfHitTestInvisible);
    GM = InArgs._GameMode;

    ChildSlot
    [
        SNew(SBorder)
        .BorderImage(White())
        .BorderBackgroundColor(FSlateColor(FLinearColor(0.f, 0.f, 0.f, 0.72f)))   // 지도 위 암전
        .Visibility(this, &SWCFactionSelect::SelectVisibility)
        .HAlign(HAlign_Center).VAlign(VAlign_Center)
        [
            SNew(SBox).WidthOverride(620)
            [
                SNew(SBorder).BorderImage(FWCStyle::Panel()).Padding(FMargin(40, 32))
                [
                    SNew(SVerticalBox)

                    // 제목
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
                    [
                        SNew(STextBlock).Font(FWCStyle::Title(34))
                        .ColorAndOpacity(FSlateColor(FWCStyle::GoldHi)).ShadowOffset(FVector2D(2, 2))
                        .Text(FText::FromString(TEXT("세계 정복")))
                    ]
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 6, 0, 0)
                    [
                        SNew(STextBlock).Font(FWCStyle::Font(14))
                        .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                        .Text(FText::FromString(TEXT("어느 나라로 시작할까요?")))
                    ]
                    + SVerticalBox::Slot().AutoHeight().Padding(0, 16, 0, 18)
                    [ SNew(SBox).HeightOverride(2)
                        [ SNew(SImage).Image(White()).ColorAndOpacity(FSlateColor(FWCStyle::Gold * 0.7f)) ] ]

                    // 1인 / 2인 — 마우스로 고른다 ([H] 키도 그대로 동작).
                    //
                    // 선택 상태를 ButtonStyle 교체로 표현할 수 없다 [MUST]: SButton 의 ButtonStyle 은
                    // SLATE_STYLE_ARGUMENT 라 TAttribute 가 아니고 _Lambda 바인더가 없다(빌드 에러).
                    // 대신 TAttribute 인 ButtonColorAndOpacity 로 브러시를 틴트한다 — 선택=금색, 비선택=무틴트.
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
                    [
                        SNew(SHorizontalBox)
                        + SHorizontalBox::Slot().AutoWidth()
                        [ MakeModeButton(TEXT("혼자 하기"), false) ]
                        + SHorizontalBox::Slot().AutoWidth().Padding(12, 0, 0, 0)
                        [ MakeModeButton(TEXT("둘이 하기"), true) ]
                    ]
                    + SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(0, 8, 0, 0)
                    [
                        SNew(STextBlock).Font(FWCStyle::Font(12))
                        .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                        .Text_Lambda([this]
                        {
                            if (!GM.IsValid()) return FText::GetEmpty();
                            return FText::FromString(GM->bHotseat
                                ? TEXT("한 화면에서 번갈아 합니다. 먼저 아빠 나라, 그다음 아들 나라를 고르세요.")
                                : TEXT("나머지 나라는 컴퓨터가 맡습니다."));
                        })
                    ]

                    // 세력 목록
                    + SVerticalBox::Slot().AutoHeight().Padding(0, 22, 0, 8)
                    [
                        SNew(STextBlock).Font(FWCStyle::Font(15)).ColorAndOpacity(FSlateColor(FWCStyle::Gold))
                        .Text_Lambda([this]
                        {
                            if (!GM.IsValid()) return FText::GetEmpty();
                            return FText::FromString(GM->bHotseat && GM->HotseatFirstPick.IsEmpty()
                                ? TEXT("아빠 나라 고르기") : TEXT("나라 고르기"));
                        })
                    ]
                    + SVerticalBox::Slot().AutoHeight()
                    [ SAssignNew(FactionList, SVerticalBox) ]
                ]
            ]
        ]
    ];
}

EVisibility SWCFactionSelect::SelectVisibility() const
{
    if (!GM.IsValid() || GM->Phase != EWCPhase::FactionSelect) return EVisibility::Collapsed;

    // 세력 목록은 /api/static 이 온 뒤에 채워지므로, 개수가 바뀌면 그때 버튼을 만든다.
    const int32 Count = GM->SelectableFactions.Num();
    if (Count != BuiltCount && FactionList.IsValid())
    {
        BuiltCount = Count;
        FactionList->ClearChildren();
        for (int32 i = 0; i < Count; ++i)
        {
            const FString Id = GM->SelectableFactions[i];
            const FString Name = GM->FactionNames.FindRef(Id);
            // 세력색 정본은 지도(FactionColors) — 목록 배너와 지도 깃발 색이 어긋나지 않게 같은 표를 쓴다.
            const AWCMapActor* Map = GM->GetMapActor();
            const FLinearColor Color = Map ? Map->GetFactionColor(Id) : FLinearColor::Gray;
            FactionList->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
            [
                SNew(SBox).HeightOverride(52)
                [
                    SNew(SButton).ButtonStyle(&FWCStyle::ButtonRef())
                    .OnClicked_Lambda([this, i] { if (GM.IsValid()) GM->SelectFactionByIndex(i); return FReply::Handled(); })
                    .HAlign(HAlign_Fill).VAlign(VAlign_Center).ContentPadding(FMargin(14, 8))
                    [
                        SNew(SHorizontalBox)
                        // 세력색 배너 — 지도 깃발 색과 같아서 어느 나라인지 바로 이어진다
                        + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Fill)
                        [ SNew(SBox).WidthOverride(8)
                            [ SNew(SImage).Image(White()).ColorAndOpacity(FSlateColor(Color)) ] ]
                        + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(14, 0, 0, 0)
                        [ SNew(STextBlock).Font(FWCStyle::Font(17))
                            .ColorAndOpacity(FSlateColor(FWCStyle::Ink))
                            .Text(FText::FromString(Name)) ]
                        + SHorizontalBox::Slot().FillWidth(1).HAlign(HAlign_Right).VAlign(VAlign_Center)
                        [ SNew(STextBlock).Font(FWCStyle::Font(11))
                            .ColorAndOpacity(FSlateColor(FWCStyle::InkDim))
                            .Text(FText::FromString(FString::Printf(TEXT("[%d]"), i + 1))) ]
                    ]
                ]
            ];
        }
    }
    return EVisibility::Visible;   // Visible = 딤이 뒤쪽 클릭을 흡수
}
