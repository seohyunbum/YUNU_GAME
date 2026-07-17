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
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> Fallback(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    BaseMaterial = Fallback.Object;
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

    // 바닥 = NASA 세계지도 평면 (에디터 Python 이 생성한 /Game/WorldMap 에셋, unlit)
    if (UStaticMesh* Plane = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Plane.Plane")))
    {
        UStaticMeshComponent* Floor = NewObject<UStaticMeshComponent>(this, TEXT("worldmap_floor"));
        Floor->SetupAttachment(RootComponent);
        Floor->RegisterComponent();
        Floor->SetStaticMesh(Plane);
        Floor->SetRelativeLocation(FVector(0, 0, -12.0));
        // 이미지 U(서→동)=월드 +Y, V(북→남)=월드 -X 가 되도록 yaw 90 (실측-교정은 QA 샷)
        Floor->SetRelativeRotation(FRotator(0.f, 90.f, 0.f));
        Floor->SetRelativeScale3D(FVector(200.0, 100.0, 1.0));   // 20000×10000cm
        Floor->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        if (UMaterialInterface* MapMat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/WorldMap/M_WorldMap.M_WorldMap")))
            Floor->SetMaterial(0, MapMat);
        else
            UE_LOG(LogWCMap, Warning, TEXT("M_WorldMap 에셋 없음 — Scripts/import_worldmap.py 실행 필요"));
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
        const FVector World = BoardToWorld(Pos->GetNumberField(TEXT("x")), Pos->GetNumberField(TEXT("y")));
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

    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this);
    Mesh->SetupAttachment(RootComponent);
    Mesh->RegisterComponent();
    Mesh->SetStaticMesh(CylinderMesh);
    Mesh->SetRelativeLocation(Pos);
    // 병력 규모에 따라 마커 높이 가변 (시각 신호) — 육군=기둥, 함대=낮고 넓게
    const double Troops = FMath::Max(1.0, Force->GetNumberField(TEXT("total_troops")));
    const double Height = FMath::Clamp(0.6 + Troops / 200.0, 0.6, 3.0);
    Mesh->SetRelativeScale3D(bFleet ? FVector(1.0, 1.0, 0.5) : FVector(0.55, 0.55, Height));
    Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);   // 노드 클릭을 가리지 않게

    UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Mat->SetVectorParameterValue(TEXT("Color"), GetFactionColor(Force->GetStringField(TEXT("faction_id"))));
    Mesh->SetMaterial(0, Mat);
    UnitMarkers.Add(Mesh);
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
    // 테두리(흑) 원판 — 밝은 위성지도 위에서 마커 윤곽 확보
    UStaticMeshComponent* Rim = NewObject<UStaticMeshComponent>(this);
    Rim->SetupAttachment(RootComponent);
    Rim->RegisterComponent();
    Rim->SetStaticMesh(CylinderMesh);
    Rim->SetRelativeLocation(Pos - FVector(0, 0, 3.0));
    Rim->SetRelativeScale3D(bSea ? FVector(3.2, 3.2, 0.06) : FVector(2.6, 2.6, 0.4));
    Rim->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    UMaterialInstanceDynamic* RimMat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    RimMat->SetVectorParameterValue(TEXT("Color"), RimColor);
    Rim->SetMaterial(0, RimMat);

    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this, *FString::Printf(TEXT("node_%s"), *NodeId));
    Mesh->SetupAttachment(RootComponent);
    Mesh->RegisterComponent();
    Mesh->SetStaticMesh(CylinderMesh);
    Mesh->SetRelativeLocation(Pos);
    // 지도 위 도시 마커 — 촘촘한 동아시아에서도 겹치지 않는 크기 (등장방형은 도시 간격이 좁음)
    Mesh->SetRelativeScale3D(bSea ? FVector(2.6, 2.6, 0.08) : FVector(2.0, 2.0, 0.5));
    Mesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);   // M2 클릭 픽킹 대비

    UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Mat->SetVectorParameterValue(TEXT("Color"), bSea ? SeaColor : NeutralColor);
    Mesh->SetMaterial(0, Mat);
    NodeMaterials.Add(NodeId, Mat);
    NodeMeshes.Add(NodeId, Mesh);
    return Mesh;
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
    Mesh->SetRelativeScale3D(FVector(0.5, 0.5, Length / 100.0));
    Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    UMaterialInstanceDynamic* Mat = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Mat->SetVectorParameterValue(TEXT("Color"), bSeaRoute ? SeaEdgeColor : LandEdgeColor);
    Mesh->SetMaterial(0, Mat);
}

void AWCMapActor::SetNodeColor(const FString& NodeId, const FLinearColor& Color)
{
    if (UMaterialInstanceDynamic* Mat = NodeMaterials.FindRef(NodeId))
        Mat->SetVectorParameterValue(TEXT("Color"), Color);
}
