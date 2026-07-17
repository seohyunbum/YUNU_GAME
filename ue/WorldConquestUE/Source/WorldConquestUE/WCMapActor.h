#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Dom/JsonObject.h"
#include "WCMapActor.generated.h"

class UStaticMeshComponent;
class UMaterialInstanceDynamic;

/**
 * 세계지도 절차 생성 렌더 (ue5-client-design §3 코드-퍼스트 — .umap 저작 없음).
 * /api/static 의 노드 map_pos(0~1000×0~700)·간선을 3D 보드로 생성하고,
 * /api/state 의 영지 소유를 세력 색으로 칠한다. 규칙 계산은 전혀 하지 않는다 [MUST].
 */
UCLASS()
class WORLDCONQUESTUE_API AWCMapActor : public AActor
{
    GENERATED_BODY()

public:
    AWCMapActor();

    /** static 정의로 보드 생성 (1회). */
    void BuildFromStatic(const TSharedPtr<FJsonObject>& StaticJson);

    /** 상태 스냅샷으로 소유 색 갱신 (매 턴). */
    void ApplyState(const TSharedPtr<FJsonObject>& StateJson);

    /** map_pos(x, y) → 월드 좌표. 보드 중심이 원점. */
    static FVector BoardToWorld(double X, double Y);

    /** 클릭 픽킹: 히트 컴포넌트 → 노드 id (아니면 빈 문자열). */
    FString FindNodeIdByComponent(const UPrimitiveComponent* Component) const;

    /** HUD 라벨용 — 노드 id → 월드 좌표. */
    const TMap<FString, FVector>& GetNodePositions() const { return NodePositions; }

    /** 세력 색 (부대 마커·HUD 공용). */
    FLinearColor GetFactionColor(const FString& FactionId) const;

private:
    UStaticMeshComponent* MakeNodeMesh(const FString& NodeId, const FVector& Pos, bool bSea);
    void MakeEdgeMesh(const FVector& A, const FVector& B, bool bSeaRoute);
    void SetNodeColor(const FString& NodeId, const FLinearColor& Color);

    UPROPERTY()
    TMap<FString, TObjectPtr<UStaticMeshComponent>> NodeMeshes;

    UPROPERTY()
    TMap<FString, TObjectPtr<UMaterialInstanceDynamic>> NodeMaterials;

    /** faction id → 세력 색 (/api/static factions[].color). */
    TMap<FString, FLinearColor> FactionColors;

    /** 노드 id → map_pos 월드 좌표 (간선 연결용). */
    TMap<FString, FVector> NodePositions;

    UPROPERTY()
    TObjectPtr<UStaticMesh> CylinderMesh;

    UPROPERTY()
    TObjectPtr<UMaterialInterface> BaseMaterial;

    UPROPERTY()
    TObjectPtr<UStaticMeshComponent> Terrain;

    /** 지형 표면 높이 (라인트레이스) — 마커·간선 부착용. */
    double TerrainZ(const FVector& At) const;

    /** 부대·함대 마커 — ApplyState 마다 재생성. */
    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> UnitMarkers;

    void MakeUnitMarker(const TSharedPtr<FJsonObject>& Force, bool bFleet, int32 IndexAtNode);
};
