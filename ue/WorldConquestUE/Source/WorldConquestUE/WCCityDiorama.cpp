#include "WCCityDiorama.h"
#include "Engine/LevelStreamingDynamic.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCDiorama, Log, All);

// 건물 밀집 중앙 (dump 분석값) — 데모 맵을 이 점이 액터 원점에 오도록 로드
namespace { const FVector kClusterCenter(27010.0, 5030.0, 2500.0); }

AWCCityDiorama::AWCCityDiorama()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AWCCityDiorama::BeginPlay()
{
    Super::BeginPlay();

    // 아티스트 데모 맵을 레벨 인스턴스로 로드 (조명·재질·배치 원본 그대로).
    // 클러스터 중심이 액터 원점(GetActorLocation)에 오도록 오프셋 배치.
    const FVector LoadAt = GetActorLocation() - kClusterCenter;
    bool bSuccess = false;
    ULevelStreamingDynamic* Inst = ULevelStreamingDynamic::LoadLevelInstance(
        this, TEXT("/Game/Asian_Village/maps/Asian_Village_Demo"),
        LoadAt, FRotator::ZeroRotator, bSuccess);
    bLoaded = bSuccess && Inst != nullptr;
    UE_LOG(LogWCDiorama, Log, TEXT("디오라마 데모 맵 로드: %s (offset %s)"),
        bLoaded ? TEXT("OK") : TEXT("실패"), *LoadAt.ToString());
}

void AWCCityDiorama::Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort)
{
    // 마을 자체는 공통 배경 — 세력색은 UI 헤더 배너로 표현. (깃발 메시 틴트는 후속 개선)
}

FTransform AWCCityDiorama::GetViewpoint() const
{
    // 마을 전경을 남서 상공에서 내려다보는 establishing 앵글 (지붕 군집이 펼쳐지게 원경)
    const FVector Origin = GetActorLocation();
    const FVector CamPos = Origin + FVector(-7000, -6200, 6400);
    const FVector LookAt = Origin + FVector(2600, 1400, 200);
    const FRotator Rot = FRotationMatrix::MakeFromX(LookAt - CamPos).Rotator();
    return FTransform(Rot, CamPos);
}
