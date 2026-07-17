#include "WCGameMode.h"
#include "WCApiSubsystem.h"

DEFINE_LOG_CATEGORY_STATIC(LogWorldConquest, Log, All);

void AWCGameMode::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogWorldConquest, Log, TEXT("WorldConquest UE client boot (protocol v1)"));

    if (UWCApiSubsystem* Api = GetGameInstance()->GetSubsystem<UWCApiSubsystem>())
    {
        Api->FetchInfo();   // Day-0: C# 서버가 떠 있으면 /api/info 응답을 로그로 확인
    }
}
