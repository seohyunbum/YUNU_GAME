#include "WCHUD.h"
#include "WCGameMode.h"
#include "WCMapActor.h"
#include "Engine/Canvas.h"

void AWCHUD::DrawHUD()
{
    Super::DrawHUD();
    AWCGameMode* GM = GetWorld()->GetAuthGameMode<AWCGameMode>();
    if (!GM || !Canvas) return;

    UFont* Large = GEngine->GetLargeFont();
    UFont* Small = GEngine->GetMediumFont();

    // [MUST] 거점 화면·모달 중엔 지도용 Canvas HUD(이벤트 로그·도시명 라벨·명령 안내줄)를 그리지 않는다.
    // Canvas 는 Slate 와 별개 레이어라 서로를 모른다 → 가드가 없으면 거점 패널·모달을 뚫고 그려
    // "상점 창에 겹쳐 가려짐" 이 된다 (2026-07-17 사용자 보고의 실제 원인).
    const bool bMapHudHidden = GM->UiInCity()
        || GM->ActiveBattle.IsSet() || GM->ActiveReveal.IsSet();

    // ── 상단 상태줄: Playing 중엔 Slate 자원바가 대체 — 부팅/선택/오류 메시지만 Canvas ──
    if (!GM->UiIsPlaying())
    {
        FCanvasTextItem Title(FVector2D(24, 20), FText::FromString(GM->HudLine), Large, FLinearColor::White);
        Title.EnableShadow(FLinearColor::Black);
        Title.Scale = FVector2D(1.5, 1.5);
        Canvas->DrawItem(Title);
    }

    // ── 하단: 명령·모드 안내줄 (이벤트 로그 바로 위에 동적 배치) ──
    if (!bMapHudHidden && !GM->HudModeLine.IsEmpty())
    {
        const float LogHeight = 30.f + 24.f * GM->EventLog.Num();
        FCanvasTextItem Mode(FVector2D(24, Canvas->ClipY - LogHeight - 36.f),
                             FText::FromString(GM->HudModeLine), Large, FLinearColor(0.7f, 0.9f, 1.f));
        Mode.EnableShadow(FLinearColor::Black);
        Canvas->DrawItem(Mode);
    }

    // ── 도시명 라벨: 겹침 회피 그리디 배치 (엔진 폰트의 한글 폴백 사용 — TextRender 한글 문제 회피) ──
    //
    // 42거점으로 늘린 뒤 유럽·중동 밀집대에서 라벨이 서로 겹쳐 "카에로살렘바그다테히" 처럼 뭉쳤다.
    // 전부 그리지 않고 **우선순위 높은 순으로 놓되, 이미 놓인 라벨과 겹치면 건너뛴다**.
    // 줌인하면 화면 투영 좌표가 벌어져 충돌이 사라지므로 자동으로 다시 다 보인다 — 별도 LOD 임계 불필요.
    if (!bMapHudHidden)
    if (const AWCMapActor* Map = GM->GetMapActor())
    {
        const TMap<FString, FString>& Owners = Map->GetNodeOwners();

        struct FMapLabel { FString Text; float X, Y, W, H; double Score; bool bSelected; };
        TArray<FMapLabel> Labels;
        Labels.Reserve(Map->GetNodePositions().Num());

        for (const auto& Pair : Map->GetNodePositions())
        {
            const FVector Screen = Canvas->Project(Pair.Value + FVector(0, 0, 60.0));
            if (Screen.Z <= 0.f) continue;   // 카메라 뒤
            const FString Name = GM->ProvinceNames.FindRef(Pair.Key);
            if (Name.IsEmpty()) continue;

            const bool bSelected = Pair.Key == GM->SelectedNodeId;

            // 충돌 박스 폭은 **선택 여부와 무관하게 이름 그대로** 잰다. 예전엔 선택 시 "[ 이름 ]" 으로
            // 넓혀 그렸는데, 그러면 선택 라벨 박스가 커지고 우선순위 1e9 로 먼저 배치되면서 옆 라벨들을
            // 밀어내 — 거점을 클릭할 때마다 이웃 라벨이 깜빡였다(리뷰 confirmed). 선택 표시는 색(노랑)만으로.
            float W = 0.f, H = 0.f;
            Canvas->TextSize(Small, Name, W, H);   // 실측 폭 — 한글은 글자당 폭이 달라 Len*상수는 부정확

            // 우선순위 점수(높을수록 먼저 배치 → 충돌 시 승리): 선택 ≫ 소유 거점 ≫ 인구.
            double Score = 0.0;
            if (bSelected)                 Score += 1.0e9;   // 선택 노드는 항상 표시
            if (Owners.Contains(Pair.Key)) Score += 1.0e6;   // 소유·점령 거점 우선 (공백지보다)
            if (const AWCGameMode::FWCNodeInfo* Info = GM->NodeInfos.Find(Pair.Key))
                Score += Info->Population;                    // 큰 도시부터 (0~26만)

            Labels.Add({ Name, (float)(Screen.X - W * 0.5f), (float)(Screen.Y - 34.0f), W, H, Score, bSelected });
        }

        // 점수 내림차순 — 동점은 텍스트로 안정 정렬(프레임 간 표시/숨김 깜빡임 방지)
        Labels.Sort([](const FMapLabel& A, const FMapLabel& B)
        {
            return A.Score != B.Score ? A.Score > B.Score : A.Text < B.Text;
        });

        const float Pad = 3.f;   // 라벨 간 최소 간격
        TArray<FBox2D> Placed;
        Placed.Reserve(Labels.Num());
        for (const FMapLabel& L : Labels)
        {
            const FBox2D Box(FVector2D(L.X - Pad, L.Y - Pad), FVector2D(L.X + L.W + Pad, L.Y + L.H + Pad));
            bool bOverlap = false;
            for (const FBox2D& P : Placed)
                if (Box.Intersect(P)) { bOverlap = true; break; }
            if (bOverlap) continue;   // 더 높은 우선순위 라벨에 자리 양보 → 이 라벨은 숨김
            Placed.Add(Box);

            FCanvasTextItem Text(FVector2D(L.X, L.Y), FText::FromString(L.Text), Small,
                L.bSelected ? FLinearColor(1.f, 0.9f, 0.3f) : FLinearColor(0.92f, 0.92f, 0.92f));
            Text.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(Text);
        }
    }

    // ── 좌하단: 이벤트 로그 (최신이 아래) ──
    if (!bMapHudHidden)
    {
        const float LogBottom = Canvas->ClipY - 30.f;
        for (int32 i = 0; i < GM->EventLog.Num(); ++i)
        {
            const float Alpha = 1.f - 0.08f * i;
            FCanvasTextItem Line(FVector2D(24, LogBottom - 24.f * i),
                FText::FromString(GM->EventLog[i]), Small, FLinearColor(1.f, 1.f, 1.f, FMath::Max(0.25f, Alpha)));
            Line.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(Line);
        }
    }

    // 세력 선택 화면은 Slate(SWCFactionSelect) 로 옮겼다 — Canvas 로는 스킨도 마우스 입력도 못 준다.

    // ── 컷씬 오버레이 (자막 스타일 — T0 대본을 3D 위에) ──
    if (const FWCCutscene* Scene = GM->GetActiveCutsceneDef())
    {
        const int32 LineIdx = GM->ActiveCutscene->LineIndex;
        if (Scene->Lines.IsValidIndex(LineIdx))
        {
            const float BoxY = Canvas->ClipY * 0.68f;
            FCanvasTileItem Box(FVector2D(Canvas->ClipX * 0.5f - 560.f, BoxY),
                FVector2D(1120.f, 130.f), FLinearColor(0.f, 0.f, 0.f, 0.8f));
            Box.BlendMode = SE_BLEND_Translucent;
            Canvas->DrawItem(Box);

            FCanvasTextItem SceneTitle(FVector2D(Canvas->ClipX * 0.5f - 530.f, BoxY + 14),
                FText::FromString(FString::Printf(TEXT("『%s』"), *Scene->TitleKo)), Small, FLinearColor(1.f, 0.8f, 0.3f));
            SceneTitle.EnableShadow(FLinearColor::Black);
            Canvas->DrawItem(SceneTitle);

            const FWCCutsceneLine& L = Scene->Lines[LineIdx];
            const FString SpeakerName = L.Speaker.IsEmpty() ? FString() :
                FString::Printf(TEXT("%s:  "), *GM->CharacterNames.FindRef(L.Speaker));
            FCanvasTextItem Text(FVector2D(Canvas->ClipX * 0.5f - 530.f, BoxY + 48),
                FText::FromString(SpeakerName + L.TextKo), Large, FLinearColor::White);
            Text.EnableShadow(FLinearColor::Black);
            Text.Scale = FVector2D(1.35, 1.35);
            Canvas->DrawItem(Text);

            FCanvasTextItem Hint(FVector2D(Canvas->ClipX * 0.5f + 380.f, BoxY + 100),
                FText::FromString(TEXT("(클릭 — 다음)")), Small, FLinearColor(0.7f, 0.7f, 0.7f));
            Canvas->DrawItem(Hint);
        }
    }
}
