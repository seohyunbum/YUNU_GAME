#include "WCCityDiorama.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    // 팔레트 (동아시아 성곽 톤)
    const FLinearColor Ground(0.24f, 0.28f, 0.16f);     // 잔디 대지
    const FLinearColor Stone(0.52f, 0.50f, 0.46f);      // 석축·성벽
    const FLinearColor DarkStone(0.34f, 0.32f, 0.29f);
    const FLinearColor Plaster(0.80f, 0.76f, 0.68f);    // 회벽
    const FLinearColor Timber(0.34f, 0.22f, 0.13f);     // 목재 기둥
    const FLinearColor RoofTile(0.22f, 0.20f, 0.22f);   // 기와 (짙은 청회)
    const FLinearColor RoofTileWarm(0.35f, 0.16f, 0.12f);// 단청 처마 붉은기
    const FLinearColor Water(0.18f, 0.34f, 0.42f);
    const FLinearColor FarmGreen(0.30f, 0.42f, 0.14f);
}

AWCCityDiorama::AWCCityDiorama()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

    static ConstructorHelpers::FObjectFinder<UStaticMesh> C(TEXT("/Engine/BasicShapes/Cube.Cube"));
    Cube = C.Object;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Co(TEXT("/Engine/BasicShapes/Cone.Cone"));
    Cone = Co.Object;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cy(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    Cylinder = Cy.Object;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Pl(TEXT("/Engine/BasicShapes/Plane.Plane"));
    Plane = Pl.Object;
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> M(TEXT("/Game/WorldMap/M_UnlitColor.M_UnlitColor"));
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> MFallback(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    BaseMat = M.Succeeded() ? M.Object : MFallback.Object;
}

UStaticMeshComponent* AWCCityDiorama::Add(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                          const FLinearColor& Color, const FRotator& Rot, UMaterialInstanceDynamic** OutMid)
{
    UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
    Comp->SetupAttachment(RootComponent);
    Comp->RegisterComponent();
    Comp->SetStaticMesh(Mesh);
    Comp->SetRelativeLocation(Pos);
    Comp->SetRelativeRotation(Rot);
    Comp->SetRelativeScale3D(Scale);
    Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(BaseMat, this);
    Mid->SetVectorParameterValue(TEXT("Color"), Color);
    Comp->SetMaterial(0, Mid);
    if (OutMid) *OutMid = Mid;
    return Comp;
}

// 성채 단(段) — 석축 기단 + 회벽 몸체 + 목주 + 처마 + 기와 지붕(맨 위층만 세력색 강조 대상)
void AWCCityDiorama::BuildKeep(const FVector& Base)
{
    // 석축 기단 (성채를 높여 원경에서도 존재감)
    Add(Cube, Base + FVector(0, 0, 130), FVector(9.0, 9.0, 2.6), Stone);
    const FVector Top = Base + FVector(0, 0, 260);
    const double Sizes[] = { 780, 590, 410 };   // 3층, 위로 축소 (기단 위 대형)
    double z = Top.Z - Base.Z;
    for (int32 lv = 0; lv < 3; ++lv)
    {
        const double s = Sizes[lv];
        const double bodyH = 230;
        Add(Cube, Base + FVector(0, 0, z + bodyH * 0.5), FVector(s / 100.0, s / 100.0, bodyH / 100.0), Plaster);          // 회벽 몸체
        // 네 모서리 목주
        for (int32 c = 0; c < 4; ++c)
        {
            const double sx = (c & 1) ? 1 : -1, sy = (c & 2) ? 1 : -1;
            Add(Cube, Base + FVector(sx * s * 0.45, sy * s * 0.45, z + bodyH * 0.5),
                FVector(0.14, 0.14, bodyH / 100.0), Timber);
        }
        // 처마 판 (몸체보다 넓게 돌출)
        Add(Cube, Base + FVector(0, 0, z + bodyH + 12), FVector(s / 100.0 * 1.35, s / 100.0 * 1.35, 0.24), RoofTileWarm);
        // 기와 지붕 (넓은 피라미드)
        UMaterialInstanceDynamic* RoofMid = nullptr;
        Add(Cone, Base + FVector(0, 0, z + bodyH + 24 + 70), FVector(s / 100.0 * 1.5, s / 100.0 * 1.5, 1.4),
            RoofTile, FRotator::ZeroRotator, lv == 2 ? &RoofMid : nullptr);
        if (RoofMid) FactionTargets.Add(RoofMid);   // 최상층 지붕만 세력색 은은히 (기와 톤과 혼합은 색만 교체)
        z += bodyH + 24 + 40;   // 다음 층은 처마 위
    }
    // 천수각 꼭대기 세력 깃발
    BuildBanner(Base + FVector(0, 0, z + 30), 340);
}

void AWCCityDiorama::BuildHouse(const FVector& Base, double Yaw, double Scale, const FLinearColor& Roof)
{
    const FRotator R(0, Yaw, 0);
    const double w = 220 * Scale, d = 300 * Scale, h = 130 * Scale;
    Add(Cube, Base + FVector(0, 0, h * 0.5), FVector(w / 100.0, d / 100.0, h / 100.0), Plaster, R);       // 벽체
    // 맞배지붕 = 눕힌 삼각기둥 대용으로 넓은 콘 2겹
    Add(Cube, Base + FVector(0, 0, h + 8), FVector(w / 100.0 * 1.3, d / 100.0 * 1.25, 0.16), Timber, R);   // 처마
    Add(Cone, Base + FVector(0, 0, h + 55 * Scale), FVector(w / 100.0 * 1.35, d / 100.0 * 1.3, 0.9 * Scale), Roof, R);
}

void AWCCityDiorama::BuildWall(const FVector& A, const FVector& B)
{
    const FVector Mid = (A + B) * 0.5;
    const double Len = FVector::Dist(A, B);
    const FRotator R = (B - A).Rotation();
    Add(Cube, Mid + FVector(0, 0, 90), FVector(Len / 100.0, 0.5, 1.8), Stone, R);                 // 성벽 본체
    Add(Cube, Mid + FVector(0, 0, 195), FVector(Len / 100.0, 0.66, 0.22), DarkStone, R);          // 여장(총안)
}

void AWCCityDiorama::BuildBanner(const FVector& Base, double Height)
{
    Add(Cylinder, Base + FVector(0, 0, Height * 0.5), FVector(0.09, 0.09, Height / 100.0), DarkStone);    // 깃대
    UMaterialInstanceDynamic* FlagMid = nullptr;
    Add(Cube, Base + FVector(0, 55, Height - 60), FVector(0.05, 1.0, 0.72), FLinearColor::White, FRotator::ZeroRotator, &FlagMid);
    FactionTargets.Add(FlagMid);   // 깃발 = 세력색 주 대상
}

void AWCCityDiorama::BeginPlay()
{
    Super::BeginPlay();

    // 대지 (넓은 잔디 평면)
    Add(Plane, FVector(0, 0, 0), FVector(90, 90, 1), Ground);
    // 해자/호안 (앞쪽 물)
    Add(Plane, FVector(-4200, 0, 5), FVector(26, 90, 1), Water);

    // 성벽 사각 (본곽) — 네 변
    const double W = 2400;
    const FVector NW(-W, -W, 0), NE(W, -W, 0), SE(W, W, 0), SW(-W, W, 0);
    BuildWall(NW, NE); BuildWall(NE, SE); BuildWall(SE, SW); BuildWall(SW, NW);
    // 성문루 (남벽 중앙)
    Add(Cube, FVector(-W, 0, 240), FVector(5.2, 0.7, 1.0), Plaster);
    Add(Cone, FVector(-W, 0, 360), FVector(6.4, 2.0, 0.7), RoofTile);

    // 천수각 (중앙)
    BuildKeep(FVector(0, 0, 20));

    // 민가 군집 (성 안 좌우) — 결정적 배치
    const FLinearColor Roofs[] = { RoofTile, RoofTileWarm, DarkStone };
    for (int32 i = 0; i < 10; ++i)
    {
        const double ang = i * 0.9;
        const double rad = 1050 + (i % 3) * 240;
        const FVector p(FMath::Cos(ang) * rad, FMath::Sin(ang) * rad * 1.1, 0);
        if (FMath::Abs(p.X) < 620 && FMath::Abs(p.Y) < 620) continue;   // 천수각 자리 회피
        BuildHouse(p, ang * 57.3, 0.85 + (i % 4) * 0.12, Roofs[i % 3]);
    }

    // 시설 부속 — 시장(상점 채, 성문 안쪽), 농지(성 밖 논밭), 항구(물가 부두). 기본 숨김, Configure 로 표시.
    for (int32 i = 0; i < 3; ++i)
    {
        UStaticMeshComponent* Shop = Add(Cube, FVector(-1500, -700 + i * 520, 65),
            FVector(2.4, 3.2, 1.3), Plaster);
        Add(Cone, FVector(-1500, -700 + i * 520, 175), FVector(3.4, 4.2, 0.6), RoofTileWarm);   // 상점 지붕(항상 붙되 본체 가시성으로 제어)
        Shop->SetVisibility(false);
        MarketBuildings.Add(Shop);
    }
    for (int32 i = 0; i < 3; ++i)
    {
        UStaticMeshComponent* Farm = Add(Plane, FVector(3600 + i * 900, -1500 + i * 1400, 6),
            FVector(7, 7, 1), FarmGreen);
        Farm->SetVisibility(false);
        FarmPatches.Add(Farm);
    }
    for (int32 i = 0; i < 2; ++i)
    {
        UStaticMeshComponent* Dock = Add(Cube, FVector(-4000, -600 + i * 1200, 20),
            FVector(0.5, 3.0, 0.3), Timber);
        Dock->SetVisibility(false);
        PortDocks.Add(Dock);
    }
}

void AWCCityDiorama::Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort)
{
    for (UMaterialInstanceDynamic* Mid : FactionTargets)
        if (Mid) Mid->SetVectorParameterValue(TEXT("Color"), FactionColor);

    const auto SetVisible = [](const TArray<TObjectPtr<UStaticMeshComponent>>& Arr, int32 Count)
    {
        for (int32 i = 0; i < Arr.Num(); ++i)
            if (Arr[i]) Arr[i]->SetVisibility(i < Count);
    };
    SetVisible(MarketBuildings, MarketLv);   // 시장 Lv → 상점 채(棟) 수
    SetVisible(FarmPatches, FarmLv);         // 농지 Lv → 논밭 구획 수
    for (UStaticMeshComponent* Dock : PortDocks)
        if (Dock) Dock->SetVisibility(bPort);
}

FTransform AWCCityDiorama::GetViewpoint() const
{
    // 남서쪽 상공에서 성 전체를 내려다보는 부감 — 성벽·천수각·민가가 화면 상부(패널 위)에 펼쳐지게
    const FVector Origin = GetActorLocation();
    const FVector CamPos = Origin + FVector(-4700, -3500, 3500);
    const FVector LookAt = Origin + FVector(300, 300, 250);      // 성 중심 하부
    const FRotator Rot = FRotationMatrix::MakeFromX(LookAt - CamPos).Rotator();
    return FTransform(Rot, CamPos);
}
