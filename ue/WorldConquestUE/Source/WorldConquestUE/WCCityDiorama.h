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

    /** 거점 지역(east_asia·europe·middle_east·north_america …)에 맞는 배경 레벨을 로드/전환.
        해당 팩이 없으면 동양 마을로 폴백한다 — 팩을 하나씩 늘려도 게임은 항상 돈다.
        지역별 팩 등재표 = WCCityDiorama.cpp 의 DioramaTable(). */
    void LoadForRegion(const FString& Region);

private:
    bool bLoaded = false;

    UPROPERTY()
    TMap<FString, TObjectPtr<class ULevelStreamingDynamic>> Instances;   // 레벨경로 → 인스턴스(가시성 토글 재사용)
    FString LoadedLevel;
    FString CurrentRegion;
    double CurrentCamDist = 9000.0;   // 현재 배경 팩 규모에 맞춘 부감 거리
    FVector VillageCenter = FVector::ZeroVector;   // 배치 원점 보정용 (마을을 액터 원점으로 이동)

    UPROPERTY()
    TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> FactionFlagHisms;
};
