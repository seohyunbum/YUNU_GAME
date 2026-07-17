#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"

class AWCGameMode;

/**
 * 세력 선택 화면 (게임 시작 첫 화면).
 *
 * 원래 Canvas HUD 로 그려서 (a) 골드/양피지 스킨이 안 먹고 (b) Slate 가 아니라 **마우스 클릭이 불가**했다
 * (2026-07-17 사용자 지적: "톤앤매너가 전혀 맞지 않고 마우스로 선택도 안됨").
 * → 다른 창과 같은 FWCStyle 스킨을 쓰는 Slate 화면으로 재작성. 숫자키·[H] 는 그대로 병행 동작.
 */
class SWCFactionSelect : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCFactionSelect) {}
        SLATE_ARGUMENT(AWCGameMode*, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;
    EVisibility SelectVisibility() const;
    TSharedRef<SWidget> MakeModeButton(const FString& Label, bool bWantHotseat);
    TSharedPtr<class SVerticalBox> FactionList;
    mutable int32 BuiltCount = -1;   // 세력 목록은 static 도착 후에 채워진다 → 개수 변화 시 재구성
};
