#include "WCCityDiorama.h"
#include "Engine/LevelStreamingDynamic.h"
#include "Engine/AssetManager.h"
#include "UObject/UObjectGlobals.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCDiorama, Log, All);

namespace
{
    // 건물 밀집 중앙 (dump 분석값) — 데모 맵을 이 점이 액터 원점에 오도록 로드
    const FVector kClusterCenter(27010.0, 5030.0, 2500.0);

    /**
     * 지역(region) → 거점 배경 레벨.
     *
     * [에셋 추가 방법]  새 Fab/CC0 환경 팩을 프로젝트에 넣은 뒤 **이 표에 한 줄만 추가**하면 된다.
     * 팩이 없는 지역은 자동으로 동양 마을로 폴백하므로, 하나씩 늘려가도 게임은 항상 돈다.
     * 지역 값의 정본 = data/map/world_map.json 의 node.region (east_asia · europe · middle_east ·
     * north_america · south_america · africa · oceania · south_asia ...).
     *
     * 클러스터 중심(kClusterCenter)은 팩마다 다르다 — 새 팩을 넣으면 Scripts/dump_village_layout.py
     * 로 액터 분포를 떠서 중심을 구하고 아래 Offset 에 적는다.
     */
    struct FWCDioramaDef { const TCHAR* Level; FVector Center; };

    const TMap<FString, FWCDioramaDef>& DioramaTable()
    {
        static const TMap<FString, FWCDioramaDef> Table = {
            { TEXT("east_asia"), { TEXT("/Game/Asian_Village/maps/Asian_Village_Demo"), kClusterCenter } },
            // TODO(에셋 대기): 팩을 추가하면 아래 형식으로 한 줄씩 등재한다.
            //  { TEXT("europe"),        { TEXT("/Game/<유럽마을팩>/Maps/<데모맵>"),  FVector(...) } },
            //  { TEXT("middle_east"),   { TEXT("/Game/<중동팩>/Maps/<데모맵>"),      FVector(...) } },
            //  { TEXT("north_america"), { TEXT("/Game/<현대도시팩>/Maps/<데모맵>"),  FVector(...) } },
        };
        return Table;
    }

    const FWCDioramaDef& DefForRegion(const FString& Region)
    {
        static const FWCDioramaDef Fallback{ TEXT("/Game/Asian_Village/maps/Asian_Village_Demo"), kClusterCenter };
        if (const FWCDioramaDef* Found = DioramaTable().Find(Region)) return *Found;
        return Fallback;   // 팩 미보유 지역 = 동양 마을 (게임은 항상 돈다)
    }
}

AWCCityDiorama::AWCCityDiorama()
{
    PrimaryActorTick.bCanEverTick = false;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AWCCityDiorama::BeginPlay()
{
    Super::BeginPlay();
    LoadForRegion(TEXT("east_asia"));   // 기본 배경 — 거점 진입 시 그 지역으로 교체된다
}

void AWCCityDiorama::LoadForRegion(const FString& Region)
{
    const FWCDioramaDef& Def = DefForRegion(Region);
    const FString LevelPath = Def.Level;
    if (LevelPath == LoadedLevel) { CurrentRegion = Region; return; }   // 같은 배경이면 재로드 없음

    // 이전 배경 숨김 — 언로드가 아니라 가시성 토글이라 재진입이 즉시(스트리밍 히칭 회피).
    if (TObjectPtr<ULevelStreamingDynamic>* Prev = Instances.Find(LoadedLevel))
        if (*Prev) (*Prev)->SetShouldBeVisible(false);

    if (TObjectPtr<ULevelStreamingDynamic>* Cached = Instances.Find(LevelPath))
    {
        if (*Cached) (*Cached)->SetShouldBeVisible(true);
    }
    else
    {
        // 클러스터 중심이 액터 원점에 오도록 오프셋 배치 (팩마다 중심이 다르다)
        const FVector LoadAt = GetActorLocation() - Def.Center;
        bool bSuccess = false;
        ULevelStreamingDynamic* Inst = ULevelStreamingDynamic::LoadLevelInstance(
            this, LevelPath, LoadAt, FRotator::ZeroRotator, bSuccess);
        if (bSuccess && Inst)
        {
            Instances.Add(LevelPath, Inst);
        }
        else
        {
            UE_LOG(LogWCDiorama, Warning, TEXT("배경 레벨 로드 실패: %s (지역 %s) — 팩 미설치?"),
                *LevelPath, *Region);
            return;
        }
    }

    LoadedLevel = LevelPath;
    CurrentRegion = Region;
    bLoaded = true;
    UE_LOG(LogWCDiorama, Log, TEXT("거점 배경: 지역 %s → %s"), *Region, *LevelPath);
}

void AWCCityDiorama::Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort)
{
    // 마을 자체는 지역 배경 — 세력색은 UI 헤더 배너로 표현. (깃발 메시 틴트는 에셋 도입 후)
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
