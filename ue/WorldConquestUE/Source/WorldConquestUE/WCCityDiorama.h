#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WCCityDiorama.generated.h"

class UHierarchicalInstancedStaticMeshComponent;

/**
 * 도시 3D 디오라마 (KOEI 거점 화면 배경) — Fab "Stylized Eastern Village" 팩의
 * 데모 맵 배치(village_layout.json, 2944 액터)를 메시별 HISM 인스턴싱으로 정확 재현.
 * 세계지도 밖 먼 위치에 1회 스폰, 도시 화면 전용 카메라가 건물 밀집부를 비춘다.
 * 에셋/JSON 부재 시 안전 폴백(빈 액터) — 크래시 없음.
 */
UCLASS()
class WORLDCONQUESTUE_API AWCCityDiorama : public AActor
{
    GENERATED_BODY()

public:
    AWCCityDiorama();
    virtual void BeginPlay() override;

    /** 진입 도시 갱신 — 세력 깃발 색 (마을 자체는 공통). */
    void Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort);

    /** 도시 화면 카메라 뷰포인트 (건물 밀집부를 바라보는 시네마틱 앵글). */
    FTransform GetViewpoint() const;

    bool IsLoaded() const { return bLoaded; }

private:
    bool bLoaded = false;
    FVector VillageCenter = FVector::ZeroVector;   // 배치 원점 보정용 (마을을 액터 원점으로 이동)

    UPROPERTY()
    TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> FactionFlagHisms;
};
