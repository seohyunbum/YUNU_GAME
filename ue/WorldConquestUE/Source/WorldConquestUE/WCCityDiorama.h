#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WCCityDiorama.generated.h"

class UStaticMeshComponent;
class UMaterialInstanceDynamic;

/**
 * 도시 3D 디오라마 (KOEI 거점 화면 배경) — 엔진 기본 도형으로 절차 생성한 동아시아 성곽 마을.
 * 세계지도 밖 먼 위치(도시 화면 전용 카메라가 비춤)에 1회 스폰, 진입 도시의 세력색·시설로 갱신.
 * 코드-퍼스트 [MUST] — 외부 에셋 0. Fab 건물팩이 들어오면 프리미티브를 메시로 교체하는 자리.
 */
UCLASS()
class WORLDCONQUESTUE_API AWCCityDiorama : public AActor
{
    GENERATED_BODY()

public:
    AWCCityDiorama();
    virtual void BeginPlay() override;

    /** 진입 도시 갱신 — 세력색(깃발·지붕 강조), 시설 레벨(부속 건물 수). */
    void Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort);

    /** 도시 화면 카메라가 볼 시점(뷰 타깃 트랜스폼). */
    FTransform GetViewpoint() const;

private:
    // 절차 배치 도형 헬퍼
    UStaticMeshComponent* Add(UStaticMesh* Mesh, const FVector& Pos, const FVector& Scale,
                              const FLinearColor& Color, const FRotator& Rot = FRotator::ZeroRotator,
                              UMaterialInstanceDynamic** OutMid = nullptr);
    void BuildKeep(const FVector& Base);            // 천수각(3층 기와 성채)
    void BuildHouse(const FVector& Base, double Yaw, double Scale, const FLinearColor& Roof);
    void BuildWall(const FVector& A, const FVector& B);
    void BuildBanner(const FVector& Base, double Height);

    UPROPERTY() TObjectPtr<UStaticMesh> Cube;
    UPROPERTY() TObjectPtr<UStaticMesh> Cone;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    UPROPERTY() TObjectPtr<UStaticMesh> Plane;
    UPROPERTY() TObjectPtr<UMaterialInterface> BaseMat;

    // 세력색 반응 대상 (깃발·천수각 최상층 지붕)
    UPROPERTY() TArray<TObjectPtr<UMaterialInstanceDynamic>> FactionTargets;
    // 시설 연동 부속 (레벨↑ 시 표시)
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> MarketBuildings;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> FarmPatches;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> PortDocks;
};
