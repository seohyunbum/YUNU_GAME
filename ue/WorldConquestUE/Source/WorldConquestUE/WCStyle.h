#pragma once

#include "CoreMinimal.h"
#include "Engine/Font.h"
#include "Styling/SlateBrush.h"
#include "Styling/SlateTypes.h"
#include "Engine/Texture2D.h"

/**
 * KOEI 풍 UI 스킨 (코드 퍼스트) — /Game/UI 텍스처를 9-slice 브러시로 캐시.
 * 위젯들이 공유. 텍스처 부재 시 단색 브러시 폴백(크래시 없음).
 */
class FWCStyle
{
public:
    static const FLinearColor Gold;
    static const FLinearColor GoldHi;
    static const FLinearColor Parchment;
    static const FLinearColor Ink;
    static const FLinearColor InkDim;

    static FSlateFontInfo Font(int32 Size);    // 본문 (Gothic A1 Medium)
    static FSlateFontInfo Bold(int32 Size);    // 강조 (Gothic A1 Bold)
    static FSlateFontInfo Title(int32 Size);   // 제목 (Gugi — 전통/붓)

    /** 9-slice 박스 브러시 (테두리 Margin px). 텍스처 96px 기준 margin=0.28. */
    static const FSlateBrush* Panel();
    static const FSlateBrush* Header();

    /**
     * 거점 UI 아이콘 (/Game/Icons/T_icon_<Name>). 출처=game-icons.net CC BY 3.0 (흰색/투명 → 틴트).
     * Name 예: gold food pop tech mandate market farm port academy barracks wall build recruit summon back
     *          pagoda lantern gong dragon troops
     */
    static const FSlateBrush* Icon(const TCHAR* Name, const FLinearColor& Tint, int32 Size = 22);

    /**
     * 무장 초상 (/Game/Portraits/T_<CharId>). 없으면 nullptr → 호출부가 텍스트 카드로 폴백.
     * [MUST] 텍스처를 AddToRoot 한 static 캐시로 소유한다 — 브러시가 GC 된 UObject 를 참조하면
     * SlateCore 가 죽은 포인터를 역참조해 크래시한다(UObjectArray.h "Index >= 0" assertion, 실측).
     */
    static const FSlateBrush* Portrait(const FString& CharId, const FVector2D& Size);

    /** 버튼 스타일 (일반/hover/pressed 3-state 스킨). */
    static FButtonStyle Button();
    static FButtonStyle PrimaryButton();

private:
    static const FSlateBrush* Box(const TCHAR* Path, float Margin, const FLinearColor& Fallback);
};
