#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Styling/SlateBrush.h"

class AWCGameMode;
class SWrapBox;

/**
 * 거점(도시) 화면 — 배경은 3D 디오라마, 그 위에 **건물 간판**이 서 있다.
 *
 * ux-design §5: 3컬럼 동시표시(내정|군사|주막)를 폐기했다. 좁고 겹쳤으며 KOEI 어느 작품에도 없다.
 * 대신 **건물 간판을 클릭하면 그 건물 패널 하나만** 우측에 뜬다(한 번에 하나 — §1 P-1).
 * 아무것도 안 열면 디오라마 전경이 다 보인다.
 *
 * 여기 없는 것 (의도적):
 *  - 주막/초빙 → 초빙은 노드 인자가 없는 **세력 명령**이라 지도 좌측에 산다(§0). 거점에 두면 1→4클릭 퇴보.
 *  - 징병·건설 → 지도 선택 패널에서 이미 2클릭. 고빈도는 지도(§1 P-3).
 * 모든 판정은 서버 [MUST].
 */
class SWCCityView : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SWCCityView) {}
        SLATE_ARGUMENT(TWeakObjectPtr<AWCGameMode>, GameMode)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    TWeakObjectPtr<AWCGameMode> GM;

    TSharedRef<SWidget> MakeFramedPanel(const FText& Title, TSharedRef<SWidget> Content);
    TSharedRef<SWidget> MakeRateRow(int32 Index);
    TSharedRef<SWidget> MakeButton(const FText& Label, TFunction<void(AWCGameMode*)> Action);
    /** 파견 행동 버튼 (개발·탐색) — 무장이 선택돼 있을 때만 활성 (§2.3.2). */
    TSharedRef<SWidget> MakeDispatchButton(const FText& Label, TFunction<void(AWCGameMode*)> Action);

    /** 디오라마 위의 건물 간판 — 클릭하면 그 건물 패널이 열린다(다시 누르면 닫힘). */
    TSharedRef<SWidget> MakeSignboard(const FString& Kind, const TCHAR* IconName, const FText& Label);
    /** 열린 건물 하나의 패널 (우측 도킹). Kind 별 내용. */
    TSharedRef<SWidget> MakeBuildingPanel();
    TSharedRef<SWidget> MakeFacilityBody(const FString& Kind);   // 시설 공통: 효과 + 크게 만들기
    TSharedRef<SWidget> MakeBarracksBody();                      // 병영: 부대 목록
    TSharedRef<SWidget> MakeCharactersBody();                    // 무장: 초상 그리드

    /** 시설 카드 (아이콘 · 이름 · 레벨 핍 · 건설/증축). Kind = 서버 시설 종류(market/farm/port/academy). */
    TSharedRef<SWidget> MakeFacilityCard(const FString& Kind, const TCHAR* IconName, const FText& Label);
    /** 아이콘 + 라벨 + 값 한 줄 (자원 스트립·정보행 공용). */
    TSharedRef<SWidget> MakeIconStat(const TCHAR* IconName, const FLinearColor& Tint,
                                     TFunction<FText()> ValueGetter, int32 IconSize = 20, int32 FontSize = 14);
    int32 FacilityLevelOf(const FString& Kind) const;

    void RebuildCharacterGrid() const;
    const FSlateBrush* GetBgBrush() const;

    // 배경·무장 그리드는 진입/초빙 시 lazy 갱신 (어트리뷰트 평가 스레드 = 게임 스레드)
    mutable TSharedPtr<FSlateBrush> BgBrush;
    mutable FString BgLoadedCity;
    TSharedPtr<SWrapBox> CharacterGrid;   // 초상 브러시 수명·GC 루팅은 FWCStyle::Portrait 가 소유


    EVisibility CityVisibility() const;
};
