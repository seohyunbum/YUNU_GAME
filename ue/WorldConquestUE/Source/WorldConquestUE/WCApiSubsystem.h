#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WCApiSubsystem.generated.h"

/**
 * C# 권위 시뮬 서버와의 HTTP 통신 서브시스템 (ue5-client-design §2).
 * Day-0 은 /api/info 핸드셰이크만 — 자식 프로세스 스폰·Job Object·상태 스냅샷은 M1.
 */
UCLASS()
class WORLDCONQUESTUE_API UWCApiSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    /** localhost C# 게임 서버의 /api/info 를 조회해 프로토콜 버전을 로그로 남긴다. */
    void FetchInfo();

    /** 서버 포트 — M1 에서 자식 스폰 stdout 핸드셰이크(WC_API_PORT=)로 대체된다. */
    int32 ServerPort = 8378;
};
