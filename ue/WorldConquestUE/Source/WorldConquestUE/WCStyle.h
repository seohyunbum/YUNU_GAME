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

    /** 버튼 스타일 (일반/hover/pressed 3-state 스킨). */
    static FButtonStyle Button();
    static FButtonStyle PrimaryButton();

private:
    static const FSlateBrush* Box(const TCHAR* Path, float Margin, const FLinearColor& Fallback);
};
