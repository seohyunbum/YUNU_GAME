#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Dom/JsonObject.h"
#include "WCApiSubsystem.generated.h"

/** JSON 응답 콜백 — 실패 시 nullptr. */
using FWCJsonCallback = TFunction<void(TSharedPtr<FJsonObject>)>;

/**
 * C# 권위 시뮬 서버와의 HTTP 통신 서브시스템 (ue5-client-design §2).
 * 클라이언트는 로직 0 [MUST] — 상태 조회·명령 전송·이벤트 수신만 한다.
 * 명령 seq 는 여기서 단조 발급 (멱등 계약 §2.3 — 재시도 시 같은 seq 재전송은 M2 에서).
 */
UCLASS()
class WORLDCONQUESTUE_API UWCApiSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    /** /api/info — 프로토콜 버전·캠페인 유무 핸드셰이크. */
    void FetchInfo(FWCJsonCallback Callback = nullptr);

    /** /api/static — 맵(노드 map_pos·간선)·세력 색·캐릭터·병종 정의. */
    void FetchStatic(FWCJsonCallback Callback);

    /** /api/state — 전체 상태 스냅샷. */
    void FetchState(FWCJsonCallback Callback);

    /** /api/new — 새 캠페인 (Player2 빈 문자열 = 1인 vs AI). */
    void NewCampaign(const FString& Player1, const FString& Player2, FWCJsonCallback Callback);

    /** /api/command — 명령 실행. Args 는 verb 인자 배열. */
    void SendCommand(const FString& Faction, const FString& Verb, const TArray<FString>& Args, FWCJsonCallback Callback);

    /** 서버 포트 — 자식 스폰 stdout 핸드셰이크(WC_API_PORT=)는 M2. */
    int32 ServerPort = 8378;

private:
    void Request(const FString& Verb, const FString& Path, const FString& Body, FWCJsonCallback Callback);

    int64 NextSeq = 0;   // 명령 멱등 seq (캠페인 교체 시 서버가 캐시 리셋)
};
