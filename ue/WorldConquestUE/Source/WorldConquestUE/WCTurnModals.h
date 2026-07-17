#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"

class AWCGameMode;

/**
 * 턴 리포트 — "내 턴 밖에서 무슨 일이 있었나" (ux-design §4).
 * 재료는 Core 이벤트 13종. 핫시트는 협동이라 둘이 같이 본다(스펙 §1.2·§2.7) — 관점 차단 없음.
 */
class SWCTurnReport : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCTurnReport) {}
        SLATE_ARGUMENT(AWCGameMode*, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;
    EVisibility ReportVisibility() const;
    TSharedRef<SWidget> MakeSection(const FText& Title, TFunction<const TArray<FString>*()> Rows);
};

/**
 * 턴 종료 확인 — "내가 한 일 + 남은 자원 + 되돌릴 수 없음" (ux-design §3.3).
 * 차단하지 않는다. 남은 일이 있다고 막지 않는다(행동력 개념이 없으므로 애초에 셀 수 없다).
 */
class SWCEndTurnConfirm : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCEndTurnConfirm) {}
        SLATE_ARGUMENT(AWCGameMode*, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;
    EVisibility ConfirmVisibility() const;
};
