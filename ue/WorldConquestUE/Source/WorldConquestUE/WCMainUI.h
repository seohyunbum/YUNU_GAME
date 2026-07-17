#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class AWCGameMode;

/**
 * KOEI 식 메인 인터페이스 (Slate — 코드 퍼스트, UMG 에셋 0).
 * 상단 자원 바 · 영지 정보/명령 창(선택 시) · 전역 버튼 패널.
 * 상태는 TAttribute 로 GameMode 를 폴링, 버튼은 GameMode 명령 호출 — 로직 0 [MUST].
 */
class SWCMainUI : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCMainUI) {}
        SLATE_ARGUMENT(TWeakObjectPtr<AWCGameMode>, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;

    TSharedRef<SWidget> MakeTopBar();
    TSharedRef<SWidget> MakeProvincePanel();
    TSharedRef<SWidget> MakeGlobalPanel();
    TSharedRef<SWidget> MakeFactionPanel();
    TSharedRef<SWidget> MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action,
                                   TAttribute<bool> Enabled = true);

    EVisibility PlayingVisibility() const;
    EVisibility SelectionVisibility() const;
};
