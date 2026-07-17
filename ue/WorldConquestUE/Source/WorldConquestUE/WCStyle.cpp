#include "WCStyle.h"
#include "Fonts/CompositeFont.h"
#include "Misc/Paths.h"

const FLinearColor FWCStyle::Gold(0.78f, 0.64f, 0.29f);
const FLinearColor FWCStyle::GoldHi(0.93f, 0.82f, 0.52f);
const FLinearColor FWCStyle::Parchment(0.86f, 0.80f, 0.66f);
const FLinearColor FWCStyle::Ink(0.93f, 0.90f, 0.82f);
const FLinearColor FWCStyle::InkDim(0.72f, 0.68f, 0.58f);

namespace
{
    // TTF 를 런타임 로드 (에셋 임포트 불필요) — 파일별 1회 캐시. 부재 시 엔진 폰트 폴백.
    // Fallback: 주 폰트에 없는 글리프(문장부호·심볼)를 대체할 TTF (예: 장식체 Gugi → GothicA1).
    FSlateFontInfo LoadTtf(const TCHAR* File, int32 Size, const TCHAR* Fallback = nullptr)
    {
        static TMap<FString, TSharedPtr<FCompositeFont>> Cache;
        TSharedPtr<FCompositeFont>* Found = Cache.Find(File);
        if (!Found)
        {
            const FString Dir = FPaths::ProjectContentDir() / TEXT("Fonts");
            const FString Path = Dir / File;
            TSharedPtr<FCompositeFont> Cf;
            if (FPaths::FileExists(Path))
            {
                TSharedRef<FStandaloneCompositeFont> Std = MakeShared<FStandaloneCompositeFont>(
                    NAME_None, Path, EFontHinting::Default, EFontLoadingPolicy::LazyLoad);
                // 폴백 타입페이스 — 주 폰트에 없는 글리프를 여기서 해결
                const FString FbPath = Fallback ? (Dir / Fallback) : FString();
                if (Fallback && FPaths::FileExists(FbPath))
                    Std->FallbackTypeface.Typeface.AppendFont(
                        NAME_None, FbPath, EFontHinting::Default, EFontLoadingPolicy::LazyLoad);
                Cf = Std;
            }
            Found = &Cache.Add(File, Cf);
        }
        if (Found->IsValid())
        {
            FSlateFontInfo Info(*Found, Size);
            return Info;
        }
        FSlateFontInfo Fb = GEngine->GetLargeFont()->GetLegacySlateFontInfo();   // 폴백
        Fb.Size = Size;
        return Fb;
    }
}

FSlateFontInfo FWCStyle::Font(int32 Size)  { return LoadTtf(TEXT("GothicA1-Medium.ttf"), Size); }
FSlateFontInfo FWCStyle::Bold(int32 Size)  { return LoadTtf(TEXT("GothicA1-Bold.ttf"), Size, TEXT("GothicA1-Medium.ttf")); }
FSlateFontInfo FWCStyle::Title(int32 Size) { return LoadTtf(TEXT("Gugi-Regular.ttf"), Size, TEXT("GothicA1-Medium.ttf")); }

const FSlateBrush* FWCStyle::Box(const TCHAR* Path, float Margin, const FLinearColor& Fallback)
{
    // 브러시는 위젯 수명과 무관하게 살아야 함 → static 캐시. 텍스처는 GC 방지로 AddToRoot.
    static TMap<FString, TSharedPtr<FSlateBrush>> Cache;
    if (TSharedPtr<FSlateBrush>* Found = Cache.Find(Path)) return Found->Get();

    TSharedPtr<FSlateBrush> Brush = MakeShared<FSlateBrush>();
    if (UTexture2D* Tex = LoadObject<UTexture2D>(nullptr, Path))
    {
        Tex->AddToRoot();
        Brush->SetResourceObject(Tex);
        Brush->ImageSize = FVector2D(Tex->GetSizeX(), Tex->GetSizeY());
        Brush->DrawAs = ESlateBrushDrawType::Box;               // 9-slice
        Brush->Margin = FMargin(Margin);                        // 테두리 비율
        Brush->TintColor = FSlateColor(FLinearColor::White);
    }
    else
    {
        Brush->TintColor = FSlateColor(Fallback);               // 폴백 = 단색
    }
    Cache.Add(Path, Brush);
    return Brush.Get();
}

const FSlateBrush* FWCStyle::Icon(const TCHAR* Name, const FLinearColor& Tint, int32 Size)
{
    // (이름·크기·틴트)별 static 캐시 — 브러시는 위젯보다 오래 살아야 함. 텍스처는 GC 방지 AddToRoot.
    static TMap<FString, TSharedPtr<FSlateBrush>> Cache;
    const FString Key = FString::Printf(TEXT("%s|%d|%s"), Name, Size, *Tint.ToString());
    if (TSharedPtr<FSlateBrush>* Found = Cache.Find(Key)) return Found->Get();

    TSharedPtr<FSlateBrush> Brush = MakeShared<FSlateBrush>();
    const FString Path = FString::Printf(TEXT("/Game/Icons/T_icon_%s.T_icon_%s"), Name, Name);
    if (UTexture2D* Tex = LoadObject<UTexture2D>(nullptr, *Path))
    {
        Tex->AddToRoot();
        Brush->SetResourceObject(Tex);
        Brush->DrawAs = ESlateBrushDrawType::Image;
        Brush->ImageSize = FVector2D(Size, Size);
        Brush->TintColor = FSlateColor(Tint);     // 흰 아이콘을 금/비취색으로
    }
    else
    {
        Brush->DrawAs = ESlateBrushDrawType::NoDrawType;   // 아이콘 부재 = 조용히 생략(레이아웃 유지)
        Brush->ImageSize = FVector2D(Size, Size);
    }
    Cache.Add(Key, Brush);
    return Brush.Get();
}

const FSlateBrush* FWCStyle::Panel()
{
    return Box(TEXT("/Game/UI/T_panel.T_panel"), 0.30f, FLinearColor(0.05f, 0.045f, 0.035f, 0.92f));
}

const FSlateBrush* FWCStyle::Header()
{
    // 가로로 늘어나되 상/하 금선 유지 (세로 margin 위주)
    return Box(TEXT("/Game/UI/T_header.T_header"), 0.12f, FLinearColor(0.02f, 0.02f, 0.03f, 0.85f));
}

FButtonStyle FWCStyle::Button()
{
    FButtonStyle S;
    S.SetNormal(*Box(TEXT("/Game/UI/T_button.T_button"), 0.28f, FLinearColor(0.14f, 0.11f, 0.07f, 0.95f)));
    S.SetHovered(*Box(TEXT("/Game/UI/T_button_hover.T_button_hover"), 0.28f, FLinearColor(0.22f, 0.17f, 0.10f, 0.98f)));
    S.SetPressed(*Box(TEXT("/Game/UI/T_button.T_button"), 0.28f, FLinearColor(0.10f, 0.08f, 0.05f, 1.0f)));
    S.SetNormalPadding(FMargin(6, 5));
    S.SetPressedPadding(FMargin(6, 6, 6, 4));
    return S;
}

FButtonStyle FWCStyle::PrimaryButton()
{
    FButtonStyle S;
    S.SetNormal(*Box(TEXT("/Game/UI/T_button_primary.T_button_primary"), 0.22f, Gold));
    S.SetHovered(*Box(TEXT("/Game/UI/T_button_primary.T_button_primary"), 0.22f, GoldHi));
    S.SetPressed(*Box(TEXT("/Game/UI/T_button_primary.T_button_primary"), 0.22f, Gold));
    S.SetNormalPadding(FMargin(6, 6));
    S.SetPressedPadding(FMargin(6, 7, 6, 5));
    return S;
}
