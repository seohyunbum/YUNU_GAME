#include "WCMapActor.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCMap, Log, All);

namespace
{
    // 등장방형 지구 좌표 (1000×500) — NASA 지도 이미지와 1:1 정합 (x=경도, y=위도)
    constexpr double BoardScale = 20.0;     // map_pos 1 단위 = 20cm → 지도 평면 20000×10000cm
    constexpr double BoardCenterX = 500.0;  // 0~1000
    constexpr double BoardCenterY = 250.0;  // 0~500

    const FLinearColor NeutralColor(0.75f, 0.73f, 0.68f);   // 지도 위 중립 마커 = 회백
    const FLinearColor SeaColor(0.15f, 0.4f, 0.85f);        // 해역 거점 = 청색
    const FLinearColor LandEdgeColor(0.35f, 0.25f, 0.12f);  // 육로 = 진갈색 (밝은 지도 위 대비)
    const FLinearColor SeaEdgeColor(0.06f, 0.2f, 0.45f);    // 해로 = 진남색
    const FLinearColor RimColor(0.03f, 0.03f, 0.03f);       // 마커 테두리 = 흑
}

AWCMapActor::AWCMapActor()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

    // 코드-퍼스트 [MUST] — 엔진 내장 메시만 생성자에서. /Game 에셋은 CDO 시점에
    // 레지스트리 미준비로 실패할 수 있어 BuildFromStatic 의 런타임 LoadObject 로.
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    CylinderMesh = Cylinder.Object;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    CubeMesh = Cube.Object;
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cone(TEXT("/Engine/BasicShapes/Cone.Cone"));
    ConeMesh = Cone.Object;
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> Fallback(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    BaseMaterial = Fallback.Object;
}

UStaticMeshComponent* AWCMapActor::AddShape(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                            const FLinearColor& Color, const FRotator& Rot,
                                            UMaterialInstanceDynamic** OutMid)
{
    UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
    Comp->SetupAttachment(RootComponent);
    Comp->RegisterComponent();
    Comp->SetStaticMesh(Mesh);
    Comp->SetRelativeLocation(Pos);
    Comp->SetRelativeRotation(Rot);
    Comp->SetRelativeScale3D(Scale);
    Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Mid->SetVectorParameterValue(TEXT("Color"), Color);
    Comp->SetMaterial(0, Mid);
    if (OutMid) *OutMid = Mid;
    return Comp;
}

FVector AWCMapActor::BoardToWorld(double X, double Y)
{
    // 직교 탑다운 카메라(-90 pitch, yaw 0)의 화면 정합: 화면 위 = 월드 +X, 화면 오른쪽 = 월드 +Y.
    // 지도 북쪽(보드 -y) = 화면 위, 동쪽(보드 +x) = 화면 오른쪽이 되도록 매핑한다.
    return FVector(-(Y - BoardCenterY) * BoardScale, (X - BoardCenterX) * BoardScale, 0.0);
}

void AWCMapActor::BuildFromStatic(const TSharedPtr<FJsonObject>& StaticJson)
{
    if (!StaticJson.IsValid()) { UE_LOG(LogWCMap, Error, TEXT("static 정의 없음")); return; }

    // 마커·간선 머티리얼 = unlit 색 (에디터 Python 생성물 — 런타임 로드, 미존재 시 lit 유지)
    if (UMaterialInterface* Unlit = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/WorldMap/M_UnlitColor.M_UnlitColor")))
        BaseMaterial = Unlit;
    else
        UE_LOG(LogWCMap, Warning, TEXT("M_UnlitColor 없음 — lit 폴백 (Scripts/import_worldmap.py 실행 필요)"));

    // 바닥 = NASA 고도 기반 3D 지형 (SM_Terrain — OBJ 가 UE 월드 좌표로 생성됨, RTK 식 릴리프)
    if (UStaticMesh* TerrainMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/WorldMap/SM_Terrain.SM_Terrain")))
    {
        Terrain = NewObject<UStaticMeshComponent>(this, TEXT("worldmap_terrain"));
        Terrain->SetupAttachment(RootComponent);
        Terrain->RegisterComponent();
        Terrain->SetStaticMesh(TerrainMesh);
        Terrain->SetCollisionEnabled(ECollisionEnabled::QueryOnly);   // 마커 부착 트레이스 + 픽킹
        Terrain->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
        if (UMaterialInterface* MapMat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/WorldMap/M_WorldMap.M_WorldMap")))
            Terrain->SetMaterial(0, MapMat);
    }
    else
    {
        UE_LOG(LogWCMap, Warning, TEXT("SM_Terrain 없음 — Scripts/import_terrain.py 실행 필요"));
    }

    // 세력 색 (#RRGGBB)
    for (const TSharedPtr<FJsonValue>& F : StaticJson->GetArrayField(TEXT("factions")))
    {
        const TSharedPtr<FJsonObject> Obj = F->AsObject();
        FactionColors.Add(Obj->GetStringField(TEXT("id")),
            FLinearColor(FColor::FromHex(Obj->GetStringField(TEXT("color")))));
    }

    const TSharedPtr<FJsonObject> Map = StaticJson->GetObjectField(TEXT("map"));

    for (const TSharedPtr<FJsonValue>& N : Map->GetArrayField(TEXT("nodes")))
    {
        const TSharedPtr<FJsonObject> Node = N->AsObject();
        const FString Id = Node->GetStringField(TEXT("id"));
        const TSharedPtr<FJsonObject> Pos = Node->GetObjectField(TEXT("map_pos"));
        const bool bSea = Node->GetStringField(TEXT("type")) == TEXT("sea");
        FVector World = BoardToWorld(Pos->GetNumberField(TEXT("x")), Pos->GetNumberField(TEXT("y")));
        World.Z = TerrainZ(World) + 14.0;   // 지형 표면 부착 (바다=0, 산악 도시=능선 위)
        NodePositions.Add(Id, World);
        MakeNodeMesh(Id, World, bSea);
    }

    for (const TSharedPtr<FJsonValue>& E : Map->GetArrayField(TEXT("edges")))
    {
        const TSharedPtr<FJsonObject> Edge = E->AsObject();
        const FVector* A = NodePositions.Find(Edge->GetStringField(TEXT("from")));
        const FVector* B = NodePositions.Find(Edge->GetStringField(TEXT("to")));
        if (A && B) MakeEdgeMesh(*A, *B, Edge->GetStringField(TEXT("type")) != TEXT("land"));
    }

    UE_LOG(LogWCMap, Log, TEXT("보드 생성: 노드 %d · 간선 연결 완료"), NodePositions.Num());
}

void AWCMapActor::ApplyState(const TSharedPtr<FJsonObject>& StateJson)
{
    if (!StateJson.IsValid()) return;

    for (const TSharedPtr<FJsonValue>& P : StateJson->GetArrayField(TEXT("provinces")))
    {
        const TSharedPtr<FJsonObject> Province = P->AsObject();
        const FString Id = Province->GetStringField(TEXT("id"));
        FString OwnerId;
        if (Province->TryGetStringField(TEXT("owner_faction_id"), OwnerId) && !OwnerId.IsEmpty())
        {
            const FLinearColor* Color = FactionColors.Find(OwnerId);
            SetNodeColor(Id, Color ? *Color : NeutralColor);
        }
        else
        {
            SetNodeColor(Id, NeutralColor);
        }
    }

    // 부대·함대 마커 재생성 (상태 스냅샷이 SSOT — 클라 캐시 없음)
    for (UStaticMeshComponent* Marker : UnitMarkers)
        if (Marker) Marker->DestroyComponent();
    UnitMarkers.Reset();

    TMap<FString, int32> CountAtNode;
    for (const TSharedPtr<FJsonValue>& A : StateJson->GetArrayField(TEXT("armies")))
    {
        const TSharedPtr<FJsonObject> Force = A->AsObject();
        MakeUnitMarker(Force, false, CountAtNode.FindOrAdd(Force->GetStringField(TEXT("location")))++);
    }
    for (const TSharedPtr<FJsonValue>& F : StateJson->GetArrayField(TEXT("fleets")))
    {
        const TSharedPtr<FJsonObject> Force = F->AsObject();
        MakeUnitMarker(Force, true, CountAtNode.FindOrAdd(Force->GetStringField(TEXT("location")))++);
    }
}

void AWCMapActor::MakeUnitMarker(const TSharedPtr<FJsonObject>& Force, bool bFleet, int32 IndexAtNode)
{
    const FVector* NodePos = NodePositions.Find(Force->GetStringField(TEXT("location")));
    if (!NodePos) return;

    // 같은 노드의 여러 부대는 노드 주위에 방사형 배치
    const double Angle = IndexAtNode * PI / 3.0;
    const FVector Pos = *NodePos + FVector(FMath::Cos(Angle) * 260.0, FMath::Sin(Angle) * 260.0, 40.0);

    // 군기(軍旗) 마커 — 받침 + 깃대 + 세력색 깃발 (병력 비례 크기). 함대 = 선체 + 돛.
    const FLinearColor FactionColor = GetFactionColor(Force->GetStringField(TEXT("faction_id")));
    const FLinearColor PoleColor(0.15f, 0.13f, 0.11f);
    const double Troops = FMath::Max(1.0, Force->GetNumberField(TEXT("total_troops")));
    const double Size = FMath::Clamp(0.8 + Troops / 220.0, 0.8, 2.2);   // 병력 비례

    if (bFleet)
    {
        UnitMarkers.Add(AddShape(CubeMesh, Pos + FVector(0, 0, 8), FVector(0.35, 0.9 * Size, 0.16), PoleColor));   // 선체
        UnitMarkers.Add(AddShape(CylinderMesh, Pos + FVector(0, 0, 55), FVector(0.05, 0.05, 1.0), PoleColor));      // 돛대
        UnitMarkers.Add(AddShape(CubeMesh, Pos + FVector(0, 0, 78), FVector(0.03, 0.55 * Size, 0.5 * Size), FactionColor));   // 돛
    }
    else
    {
        UnitMarkers.Add(AddShape(CylinderMesh, Pos, FVector(0.5, 0.5, 0.1), PoleColor));                            // 받침
        UnitMarkers.Add(AddShape(CylinderMesh, Pos + FVector(0, 0, 60), FVector(0.05, 0.05, 1.25), PoleColor));     // 깃대
        UnitMarkers.Add(AddShape(CubeMesh, Pos + FVector(0, 24 * Size, 108), FVector(0.03, 0.46 * Size, 0.34 * Size), FactionColor));   // 군기
    }
}

double AWCMapActor::TerrainZ(const FVector& At) const
{
    if (!Terrain) return 0.0;
    FHitResult Hit;
    const FVector Start(At.X, At.Y, 3000.0), End(At.X, At.Y, -200.0);
    if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility))
        return Hit.ImpactPoint.Z;
    return 0.0;
}

FString AWCMapActor::FindNodeIdByComponent(const UPrimitiveComponent* Component) const
{
    for (const auto& Pair : NodeMeshes)
        if (Pair.Value == Component) return Pair.Key;
    return FString();
}

FLinearColor AWCMapActor::GetFactionColor(const FString& FactionId) const
{
    const FLinearColor* Color = FactionColors.Find(FactionId);
    return Color ? *Color : NeutralColor;
}

UStaticMeshComponent* AWCMapActor::MakeNodeMesh(const FString& NodeId, const FVector& Pos, bool bSea)
{
    TArray<TObjectPtr<UMaterialInstanceDynamic>> ColorTargets;
    const FLinearColor StoneColor(0.42f, 0.40f, 0.36f);
    const FLinearColor WallColor(0.30f, 0.28f, 0.25f);

    UStaticMeshComponent* PickTarget = nullptr;
    if (bSea)
    {
        // 해역 거점 = 청색 원판 + 부표 구조물
        AddShape(CylinderMesh, Pos - FVector(0, 0, 4), FVector(2.1, 2.1, 0.06), RimColor);
        UMaterialInstanceDynamic* DiscMid = nullptr;
        PickTarget = AddShape(CylinderMesh, Pos, FVector(1.7, 1.7, 0.1), SeaColor, FRotator::ZeroRotator, &DiscMid);
        ColorTargets.Add(DiscMid);
        AddShape(CylinderMesh, Pos + FVector(0, 0, 60), FVector(0.12, 0.12, 1.2), WallColor);
        UMaterialInstanceDynamic* FlagMid = nullptr;
        AddShape(CubeMesh, Pos + FVector(0, 24, 108), FVector(0.04, 0.45, 0.3), SeaColor, FRotator::ZeroRotator, &FlagMid);
        ColorTargets.Add(FlagMid);
    }
    else
    {
        // 도시 = 성벽 원판 + 성채(본체·지붕) + 세력 깃발 — 지붕·깃발이 세력색
        AddShape(CylinderMesh, Pos - FVector(0, 0, 4), FVector(2.0, 2.0, 0.07), RimColor);          // 윤곽
        AddShape(CylinderMesh, Pos, FVector(1.6, 1.6, 0.3), WallColor);                              // 성벽
        PickTarget = AddShape(CubeMesh, Pos + FVector(0, 0, 34), FVector(1.05, 1.05, 0.8), StoneColor);   // 본체
        UMaterialInstanceDynamic* RoofMid = nullptr;
        AddShape(ConeMesh, Pos + FVector(0, 0, 82), FVector(1.35, 1.35, 0.7), NeutralColor, FRotator::ZeroRotator, &RoofMid);
        ColorTargets.Add(RoofMid);                                                                    // 지붕 = 세력색
        AddShape(CylinderMesh, Pos + FVector(28, 28, 95), FVector(0.10, 0.10, 1.9), WallColor);       // 깃대
        UMaterialInstanceDynamic* FlagMid = nullptr;
        AddShape(CubeMesh, Pos + FVector(28, 50, 172), FVector(0.04, 0.42, 0.28), NeutralColor, FRotator::ZeroRotator, &FlagMid);
        ColorTargets.Add(FlagMid);                                                                    // 깃발 = 세력색
    }

    // 클릭 픽킹 대상 등록 (본체/원판)
    PickTarget->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    PickTarget->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
    PickTarget->Rename(*FString::Printf(TEXT("node_%s"), *NodeId));
    NodeMaterials.Add(NodeId, ColorTargets);
    NodeMeshes.Add(NodeId, PickTarget);
    return PickTarget;
}

void AWCMapActor::MakeEdgeMesh(const FVector& A, const FVector& B, bool bSeaRoute)
{
    const FVector Mid = (A + B) * 0.5 - FVector(0, 0, 4.0);   // 노드 원판보다 살짝 아래
    const double Length = FVector::Dist(A, B);

    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this);
    Mesh->SetupAttachment(RootComponent);
    Mesh->RegisterComponent();
    Mesh->SetStaticMesh(CylinderMesh);
    Mesh->SetRelativeLocation(Mid);
    // 실린더 기본 축 = Z(높이 100) → 간선 방향으로 눕힌다
    Mesh->SetRelativeRotation(FRotationMatrix::MakeFromZ(B - A).Rotator());
    Mesh->SetRelativeScale3D(FVector(0.3, 0.3, Length / 100.0));
    Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Mat->SetVectorParameterValue(TEXT("Color"), bSeaRoute ? SeaEdgeColor : LandEdgeColor);
    Mesh->SetMaterial(0, Mat);
}

void AWCMapActor::SetNodeColor(const FString& NodeId, const FLinearColor& Color)
{
    if (const TArray<TObjectPtr<UMaterialInstanceDynamic>>* Mats = NodeMaterials.Find(NodeId))
        for (UMaterialInstanceDynamic* Mat : *Mats)
            if (Mat) Mat->SetVectorParameterValue(TEXT("Color"), Color);
}
