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

    /**
     * 마커·영역을 **화면상 크기가 일정**하도록 재조정한다 (카메라 줌 변화 시 호출).
     *
     * 왜 필요한가: 지도는 세계 스케일(20000 유닛)인데 거점 간격은 동아시아에서 113 유닛뿐이라,
     * 월드 고정 크기로 두면 세계 조망에서 마커·영토가 점으로 사라진다(실측). 대부분의 전략게임처럼
     * 마커를 카메라 거리에 비례해 키워 화면 점유율을 고정한다.
     * ZoomFactor = CurrentCamDist / kMarkerRefDist.
     */
    void ApplyMarkerZoom(double ZoomFactor);

private:
    UStaticMeshComponent* MakeNodeMesh(const FString& NodeId, const FVector& Pos, bool bSea);
    void MakeEdgeMesh(const FVector& A, const FVector& B, bool bSeaRoute);
    void SetNodeColor(const FString& NodeId, const FLinearColor& Color);

    /** 거점 주변 세력 영역 원판 (누가 점령했는지 한눈에). 미소유면 숨김. */
    void MakeTerritoryDecal(const FString& NodeId, const FVector& Pos);
    void SetTerritoryColor(const FString& NodeId, const FLinearColor& Color, bool bOwned);

    UPROPERTY()
    TMap<FString, TObjectPtr<UStaticMeshComponent>> TerritoryDecals;

    UPROPERTY()
    TObjectPtr<UStaticMesh> PlaneMesh;

    TMap<FString, TObjectPtr<UMaterialInstanceDynamic>> TerritoryMids;

    UPROPERTY()
    TObjectPtr<UMaterialInterface> TerritoryMaterial;

    UPROPERTY()
    TMap<FString, TObjectPtr<UStaticMeshComponent>> NodeMeshes;

    /** 노드별 마커 루트 — 성탑·깃발·영역이 전부 이 아래 붙는다. 줌 스케일은 이것만 건드린다. */
    UPROPERTY()
    TArray<TObjectPtr<USceneComponent>> NodeRoots;

    double MarkerZoom = 1.0;   // 현재 적용된 줌 배율 (부대 마커 재생성 시 재적용)

    /** 노드별 세력색 대상 MID (지붕·깃발 등 복수) — ApplyState 가 일괄 갱신. */
    TMap<FString, TArray<TObjectPtr<UMaterialInstanceDynamic>>> NodeMaterials;

    /** 도형 배치 헬퍼 — 메시·위치·스케일·색·회전. 반환 = 컴포넌트 (픽킹 등록용).
        Parent 를 주면 그 아래 붙는다(노드 마커는 노드 루트에 붙여 통째로 스케일한다). */
    UStaticMeshComponent* AddShape(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                   const FLinearColor& Color, const FRotator& Rot = FRotator::ZeroRotator,
                                   UMaterialInstanceDynamic** OutMid = nullptr,
                                   USceneComponent* Parent = nullptr);

    /** Kenney Castle Kit (CC0) — 거점 성탑·깃발. 부재 시 기본 도형으로 폴백한다. */
    UPROPERTY()
    TObjectPtr<UStaticMesh> TowerMesh;

    UPROPERTY()
    TObjectPtr<UStaticMesh> FlagMesh;

    /** 메시의 '자기 머티리얼'을 그대로 쓰는 배치 (AddShape 는 단색 MID 로 덮어쓴다). */
    UStaticMeshComponent* AddMesh(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                                  const FRotator& Rot = FRotator::ZeroRotator,
                                  USceneComponent* Parent = nullptr);

    UPROPERTY()
    TObjectPtr<UStaticMesh> CubeMesh;

    UPROPERTY()
    TObjectPtr<UStaticMesh> ConeMesh;

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
