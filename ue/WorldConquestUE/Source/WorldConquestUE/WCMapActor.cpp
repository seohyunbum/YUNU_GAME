#include "WCMapActor.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCMap, Log, All);

namespace
{
    constexpr double BoardScale = 20.0;     // map_pos 1 단위 = 20cm
    constexpr double BoardCenterX = 500.0;  // 0~1000
    constexpr double BoardCenterY = 350.0;  // 0~700

    const FLinearColor NeutralColor(0.35f, 0.35f, 0.35f);
    const FLinearColor SeaColor(0.05f, 0.15f, 0.40f);
    const FLinearColor LandEdgeColor(0.6f, 0.5f, 0.3f);
    const FLinearColor SeaEdgeColor(0.1f, 0.3f, 0.6f);
}

AWCMapActor::AWCMapActor()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

    // 엔진 내장 에셋만 사용 (코드-퍼스트 [MUST]) — 프로젝트 에셋 저작 없음
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    CylinderMesh = Cylinder.Object;
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> Material(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    BaseMaterial = Material.Object;
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
}

UStaticMeshComponent* AWCMapActor::MakeNodeMesh(const FString& NodeId, const FVector& Pos, bool bSea)
{
    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this, *FString::Printf(TEXT("node_%s"), *NodeId));
    Mesh->SetupAttachment(RootComponent);
    Mesh->RegisterComponent();
    Mesh->SetStaticMesh(CylinderMesh);
    Mesh->SetRelativeLocation(Pos);
    // 육상 = 굵은 원판, 해역 = 낮고 넓은 원판 (직교 원경에서도 식별되는 크기)
    Mesh->SetRelativeScale3D(bSea ? FVector(3.4, 3.4, 0.08) : FVector(2.4, 2.4, 0.45));
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
    Mesh->SetRelativeScale3D(FVector(0.25, 0.25, Length / 100.0));
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
