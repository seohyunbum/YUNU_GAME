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
    // 간선은 '보조 정보' — 거점보다 튀면 안 된다. 얇고 흐리게 (2026-07-17: 선만 보인다는 피드백)
    const FLinearColor LandEdgeColor(0.42f, 0.34f, 0.22f);  // 육로 = 흐린 갈색
    const FLinearColor SeaEdgeColor(0.25f, 0.42f, 0.62f);   // 해로 = 흐린 청회색
    constexpr double EdgeThickness = 0.10;                  // 0.3 → 0.10 (거점 마커가 주인공)
    // 세력 영역 원판 반경. **성탑(150 폭)보다 크고 거점 간격(최소 113)에 준하는** 값이어야 한다.
    //  - 1500 은 26배 과대라 12개가 통째로 겹쳐 지도가 동심원 호로 뭉개졌다(실측).
    //  - 42 는 성탑 밑에 가려 안 보였다(실측).
    // 이웃 영역이 살짝 겹치는 건 정상 — 인접 영토가 맞닿는 것으로 읽힌다.
    // 링이 아니라 '번짐' 이라 이웃과 겹쳐도 자연스럽다(같은 세력=합쳐진 영토, 다른 세력=색 경계).
    // 덕분에 거점 간격(최소 113)보다 크게 잡아 세계 줌에서도 영토가 읽히게 할 수 있다.
    constexpr double TerritoryRadius = 420.0;

    // Kenney 마커 스케일 — 원본 성탑 100x100x131, 깃발 10x43x86 (실측 bounds).
    // 기존 도형 마커(폭 ~200, 높이 ~200)와 눈에 띄는 크기를 맞춘다.
    // 성탑+깃발 마커 — 2026-07-17 사용자 요청으로 70% 축소 (지도가 조밀해져 마커가 서로 붙었다).
    // 세력 영역(TerritoryRadius)은 그대로 — 축소 대상은 '깃발+받침대' 아이콘뿐이다.
    constexpr double kTowerScale = 1.05;    // 1.5 × 0.7
    constexpr double kTowerTopZ  = 133.0;   // 190 × 0.7 — 깃발이 성탑 총안 위에 그대로 얹히도록 함께 축소
    constexpr double kFlagScale  = 2.8;     // 4.0 × 0.7 (깃발이 세력 구분 전담이라 여전히 크게)
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
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Plane(TEXT("/Engine/BasicShapes/Plane.Plane"));
    PlaneMesh = Plane.Object;
    static ConstructorHelpers::FObjectFinder<UMaterialInterface> Fallback(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    BaseMaterial = Fallback.Object;
}

UStaticMeshComponent* AWCMapActor::AddShape(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                            const FLinearColor& Color, const FRotator& Rot,
                                            UMaterialInstanceDynamic** OutMid, USceneComponent* Parent)
{
    UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
    Comp->SetupAttachment(Parent ? Parent : ToRawPtr(RootComponent));
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

UStaticMeshComponent* AWCMapActor::AddMesh(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                           const FRotator& Rot, USceneComponent* Parent)
{
    // 메시가 들고 온 머티리얼(Kenney colormap 아틀라스)을 그대로 쓴다 — 성벽·지붕 색이 원본대로 나온다.
    UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
    Comp->SetupAttachment(Parent ? Parent : ToRawPtr(RootComponent));
    Comp->RegisterComponent();
    Comp->SetStaticMesh(Mesh);
    Comp->SetRelativeLocation(Pos);
    Comp->SetRelativeRotation(Rot);
    Comp->SetRelativeScale3D(Scale);
    Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
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

    // Kenney Castle Kit 마커 메시 (CC0). 없으면 기본 도형 폴백 — 크래시 없이 degrade.
    TowerMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Markers/tower-square/StaticMeshes/SM_tower_square.SM_tower_square"));
    FlagMesh  = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Markers/flag/StaticMeshes/SM_flag.SM_flag"));
    if (!TowerMesh || !FlagMesh)
        UE_LOG(LogWCMap, Warning, TEXT("마커 메시 없음 — 기본 도형 폴백 (Scripts/import_markers.py 실행 필요)"));

    // 세력 영역 데칼 머티리얼 (없으면 영역 표시 생략 — 크래시 없이 degrade)
    TerritoryMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/WorldMap/M_Territory.M_Territory"));
    if (!TerritoryMaterial)
        UE_LOG(LogWCMap, Warning, TEXT("M_Territory 없음 — 세력 영역 미표시 (Scripts/import_worldmap.py 실행 필요)"));

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

    UE_LOG(LogWCMap, Log, TEXT("보드 생성: 노드 %d · 간선 연결 완료 · 세력영역 데칼 %d"), NodePositions.Num(), TerritoryDecals.Num());
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
            SetTerritoryColor(Id, Color ? *Color : NeutralColor, true);   // 거점 주변에 소유 세력색 확산
            NodeOwners.Add(Id, OwnerId);
        }
        else
        {
            SetNodeColor(Id, NeutralColor);
            SetTerritoryColor(Id, NeutralColor, false);                   // 공백지 = 영역 없음
            NodeOwners.Remove(Id);
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

    // 노드 루트 — 이 아래 모든 마커를 상대좌표로 붙인다. 줌 스케일은 이 하나만 건드리면
    // 깃발 오프셋까지 함께 따라와 성탑에서 떨어지지 않는다.
    USceneComponent* NodeRoot = NewObject<USceneComponent>(this);
    NodeRoot->SetupAttachment(RootComponent);
    NodeRoot->RegisterComponent();
    NodeRoot->SetRelativeLocation(Pos);
    NodeRoot->SetRelativeScale3D(FVector(MarkerZoom));
    NodeRoots.Add(NodeRoot);

    const FVector O = FVector::ZeroVector;   // 이제 위치는 노드 루트 기준
    UStaticMeshComponent* PickTarget = nullptr;
    if (bSea)
    {
        // 해역 거점 = 청색 원판 + 세력기
        AddShape(CylinderMesh, O - FVector(0, 0, 4), FVector(2.1, 2.1, 0.06), RimColor,
                 FRotator::ZeroRotator, nullptr, NodeRoot);
        UMaterialInstanceDynamic* DiscMid = nullptr;
        PickTarget = AddShape(CylinderMesh, O, FVector(1.7, 1.7, 0.1), SeaColor,
                              FRotator::ZeroRotator, &DiscMid, NodeRoot);
        ColorTargets.Add(DiscMid);
        UMaterialInstanceDynamic* FlagMid = nullptr;
        if (FlagMesh)
        {
            AddShape(FlagMesh, O, FVector(kFlagScale), SeaColor, FRotator(0, -35.f, 0), &FlagMid, NodeRoot);
        }
        else
        {
            AddShape(CylinderMesh, O + FVector(0, 0, 60), FVector(0.12, 0.12, 1.2), WallColor,
                     FRotator::ZeroRotator, nullptr, NodeRoot);
            AddShape(CubeMesh, O + FVector(0, 24, 108), FVector(0.04, 0.45, 0.3), SeaColor,
                     FRotator::ZeroRotator, &FlagMid, NodeRoot);
        }
        ColorTargets.Add(FlagMid);
    }
    else
    {
        // 도시 = Kenney 성탑(원본 텍스처) + 세력색 깃발.
        // 성탑은 아틀라스 텍스처를 그대로 써야 성벽·지붕 디테일이 살고, 세력 구분은 깃발이 맡는다
        // (Kenney 메시는 머티리얼 슬롯이 1개뿐이라 부위별 틴트가 불가 — 실측 확인).
        AddShape(CylinderMesh, O - FVector(0, 0, 4), FVector(2.0, 2.0, 0.07), RimColor,
                 FRotator::ZeroRotator, nullptr, NodeRoot);
        if (TowerMesh && FlagMesh)
        {
            PickTarget = AddMesh(TowerMesh, O, FVector(kTowerScale), FRotator::ZeroRotator, NodeRoot);
            UMaterialInstanceDynamic* FlagMid = nullptr;
            AddShape(FlagMesh, O + FVector(0, 0, kTowerTopZ), FVector(kFlagScale),
                     NeutralColor, FRotator(0, -35.f, 0), &FlagMid, NodeRoot);
            ColorTargets.Add(FlagMid);
        }
        else
        {   // 폴백 — 팩 미설치 시 기존 도형
            AddShape(CylinderMesh, O, FVector(1.6, 1.6, 0.3), WallColor,
                     FRotator::ZeroRotator, nullptr, NodeRoot);
            PickTarget = AddShape(CubeMesh, O + FVector(0, 0, 34), FVector(1.05, 1.05, 0.8), StoneColor,
                                  FRotator::ZeroRotator, nullptr, NodeRoot);
            UMaterialInstanceDynamic* RoofMid = nullptr;
            AddShape(ConeMesh, O + FVector(0, 0, 82), FVector(1.35, 1.35, 0.7), NeutralColor,
                     FRotator::ZeroRotator, &RoofMid, NodeRoot);
            ColorTargets.Add(RoofMid);
        }

        // 세력 영역 — 같은 노드 루트에 붙여 함께 스케일된다
        if (TerritoryMaterial)
        {
            UStaticMeshComponent* Zone = NewObject<UStaticMeshComponent>(this);
            Zone->SetupAttachment(NodeRoot);
            Zone->RegisterComponent();
            Zone->SetStaticMesh(PlaneMesh);
            // Z 는 **양수**여야 한다 — 음수면 줌 배율(최대 3.5배)에 곱해져 지형 아래로 파묻힌다(실측).
            Zone->SetRelativeLocation(FVector(0, 0, 2));
            Zone->SetRelativeScale3D(FVector(TerritoryRadius * 2.0 / 100.0, TerritoryRadius * 2.0 / 100.0, 1.0));
            Zone->SetCollisionEnabled(ECollisionEnabled::NoCollision);
            UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(TerritoryMaterial, this);
            Zone->SetMaterial(0, Mid);
            TerritoryDecals.Add(NodeId, Zone);
            TerritoryMids.Add(NodeId, Mid);
            Zone->SetVisibility(false);   // 소유 확정 전엔 숨김 (ApplyState 가 켬)
        }
    }

    // 클릭 픽킹 대상 등록 (본체/원판)
    PickTarget->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    PickTarget->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
    PickTarget->Rename(*FString::Printf(TEXT("node_%s"), *NodeId));
    NodeMaterials.Add(NodeId, ColorTargets);
    NodeMeshes.Add(NodeId, PickTarget);
    return PickTarget;
}

void AWCMapActor::ApplyMarkerZoom(double ZoomFactor)
{
    if (FMath::IsNearlyEqual(MarkerZoom, ZoomFactor, 0.01)) return;   // 미세 변화는 무시(매 프레임 호출 방지)
    MarkerZoom = ZoomFactor;
    for (USceneComponent* Root : NodeRoots)
        if (Root) Root->SetRelativeScale3D(FVector(ZoomFactor));
    for (UStaticMeshComponent* Marker : UnitMarkers)
        if (Marker) Marker->SetRelativeScale3D(Marker->GetRelativeScale3D().GetSafeNormal() * ZoomFactor);
}

void AWCMapActor::MakeTerritoryDecal(const FString& NodeId, const FVector& Pos)
{
    if (!TerritoryMaterial) return;

    // Plane(100x100, +Z 향함, UV 0~1) 을 지형 살짝 위에 눕힌다 — UV 가 깔끔해 방사 그라데이션이 정확히 맵핑.
    UStaticMeshComponent* Zone = NewObject<UStaticMeshComponent>(this);
    Zone->SetupAttachment(RootComponent);
    Zone->RegisterComponent();
    Zone->SetStaticMesh(PlaneMesh);
    Zone->SetRelativeLocation(Pos + FVector(0, 0, 6));    // 지도 표면 바로 위 (마커보다 아래)
    Zone->SetRelativeScale3D(FVector(TerritoryRadius * 2.0 / 100.0, TerritoryRadius * 2.0 / 100.0, 1.0));
    Zone->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(TerritoryMaterial, this);
    Zone->SetMaterial(0, Mid);
    TerritoryDecals.Add(NodeId, Zone);
    TerritoryMids.Add(NodeId, Mid);
    Zone->SetVisibility(false);         // 소유 확정 전엔 숨김 (ApplyState 가 켬)
}

void AWCMapActor::SetTerritoryColor(const FString& NodeId, const FLinearColor& Color, bool bOwned)
{
    if (TObjectPtr<UStaticMeshComponent>* Decal = TerritoryDecals.Find(NodeId))
        if (*Decal) (*Decal)->SetVisibility(bOwned);
    if (TObjectPtr<UMaterialInstanceDynamic>* Mid = TerritoryMids.Find(NodeId))
        if (*Mid) (*Mid)->SetVectorParameterValue(TEXT("Color"), Color);
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
    Mesh->SetRelativeScale3D(FVector(EdgeThickness, EdgeThickness, Length / 100.0));
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
