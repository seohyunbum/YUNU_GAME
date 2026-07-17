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
    // CamDist = 마을 규모에 맞춘 부감 거리(팩마다 스케일이 다르다 — 고정 앵글이면 지붕에 파묻힌다).
    struct FWCDioramaDef { const TCHAR* Level; FVector Center; double CamDist; };

    const TMap<FString, FWCDioramaDef>& DioramaTable()
    {
        // 키는 **data/map/world_map.json 의 node.region 실제 값**이어야 한다 [MUST].
        //   실측 사용값: east_asia · europe · middle_east · africa · america · oceania · ocean
        //   (2026-07-17: north_america·middle_east 로 넘겨짚었다가 카이로·뉴욕이 동양 마을로 나왔다.
        //    지역 키는 추측하지 말고 world_map.json 을 열어 확인할 것)
        // Center = 데모 맵 스태틱메시 액터 위치의 **중앙값**(Scripts/dump_pack_centers.py 실측).
        //   평균이 아니라 중앙값인 이유: 멀리 놓인 스카이박스·바닥판 하나가 평균을 끌고 가버린다.
        static const TMap<FString, FWCDioramaDef> Table = {
            // 한성·평양·부산·베이징·도쿄·교토·청두·난징·오사카 — Stylized Eastern Village
            { TEXT("east_asia"),   { TEXT("/Game/Asian_Village/maps/Asian_Village_Demo"),
                                     FVector(24140, 5135, 2240), 9000.0 } },
            // 파리·로마·런던 — FANTASTIC Village Pack (5.8 정식)
            { TEXT("europe"),      { TEXT("/Game/Fantastic_Village_Pack/maps/map_village_day"),
                                     FVector(216, 844, 684),     5200.0 } },
            // 바그다드·이스탄불 — Stylized Egypt (현 팩과 동일 제작자라 톤 일치)
            { TEXT("middle_east"), { TEXT("/Game/Stylized_Egypt/Maps/Stylized_Egypt_Demo"),
                                     FVector(-2865, -500, 855),  6500.0 } },
            // 카이로 — 이집트 팩이 지리적으로 정확 (africa 지만 나일 문명권)
            { TEXT("africa"),      { TEXT("/Game/Stylized_Egypt/Maps/Stylized_Egypt_Demo"),
                                     FVector(-2865, -500, 855),  6500.0 } },
            // 뉴욕·리우 — Assetsville Town. 저폴리 만화풍 소도시(마천루 아님)
            { TEXT("america"),     { TEXT("/Game/AssetsvilleTown/Maps/Demonstration"),
                                     FVector(680, -2400, 85),    7000.0 } },
            // 시드니 — 전용 무료 팩이 없어(조사 확인) 현대도시 팩 공용
            { TEXT("oceania"),     { TEXT("/Game/AssetsvilleTown/Maps/Demonstration"),
                                     FVector(680, -2400, 85),    7000.0 } },
        };
        return Table;
    }

    const FWCDioramaDef& DefForRegion(const FString& Region)
    {
        static const FWCDioramaDef Fallback{ TEXT("/Game/Asian_Village/maps/Asian_Village_Demo"), FVector(24140, 5135, 2240), 9000.0 };
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
    CurrentCamDist = Def.CamDist;
    bLoaded = true;
    UE_LOG(LogWCDiorama, Log, TEXT("거점 배경: 지역 %s → %s"), *Region, *LevelPath);
}

void AWCCityDiorama::Configure(const FLinearColor& FactionColor, int32 MarketLv, int32 FarmLv, bool bPort)
{
    // 마을 자체는 지역 배경 — 세력색은 UI 헤더 배너로 표현. (깃발 메시 틴트는 에셋 도입 후)
}

FTransform AWCCityDiorama::GetViewpoint() const
{
    // 마을 전경을 남서 상공에서 내려다보는 establishing 앵글 (지붕 군집이 펼쳐지게 원경).
    // 거리는 현재 배경 팩의 규모에 맞춘다 — 고정값이면 작은 마을에선 지붕에 파묻힌다(실측).
    const double D = CurrentCamDist > 0.0 ? CurrentCamDist : 9000.0;
    const FVector Origin = GetActorLocation();
    const FVector CamPos = Origin + FVector(-0.78, -0.69, 0.71) * D;
    const FVector LookAt = Origin + FVector(0.29, 0.16, 0.02) * D;
    const FRotator Rot = FRotationMatrix::MakeFromX(LookAt - CamPos).Rotator();
    return FTransform(Rot, CamPos);
}
