#include "WCApiSubsystem.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCApi, Log, All);

void UWCApiSubsystem::FetchInfo()
{
    const FString Url = FString::Printf(TEXT("http://localhost:%d/api/info"), ServerPort);
    const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(Url);
    Request->SetVerb(TEXT("GET"));
    Request->SetTimeout(5.0f);
    Request->OnProcessRequestComplete().BindLambda(
        [](FHttpRequestPtr, FHttpResponsePtr Response, bool bOk)
        {
            if (!bOk || !Response.IsValid())
            {
                UE_LOG(LogWCApi, Warning, TEXT("C# 게임 서버 미응답 — server 모드가 떠 있는지 확인"));
                return;
            }
            TSharedPtr<FJsonObject> Json;
            const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
            if (FJsonSerializer::Deserialize(Reader, Json) && Json.IsValid())
            {
                UE_LOG(LogWCApi, Log, TEXT("서버 핸드셰이크 OK — protocol v%d, campaign=%s"),
                    static_cast<int32>(Json->GetNumberField(TEXT("protocol_version"))),
                    Json->GetBoolField(TEXT("has_campaign")) ? TEXT("yes") : TEXT("no"));
            }
        });
    Request->ProcessRequest();
}
