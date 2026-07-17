#include "WCApiSubsystem.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

DEFINE_LOG_CATEGORY_STATIC(LogWCApi, Log, All);

void UWCApiSubsystem::FetchInfo(FWCJsonCallback Callback)
{
    Request(TEXT("GET"), TEXT("/api/info"), FString(),
        [Callback](TSharedPtr<FJsonObject> Json)
        {
            if (Json.IsValid())
                UE_LOG(LogWCApi, Log, TEXT("서버 핸드셰이크 OK — protocol v%d, campaign=%s"),
                    static_cast<int32>(Json->GetNumberField(TEXT("protocol_version"))),
                    Json->GetBoolField(TEXT("has_campaign")) ? TEXT("yes") : TEXT("no"));
            if (Callback) Callback(Json);
        });
}

void UWCApiSubsystem::FetchStatic(FWCJsonCallback Callback)
{
    Request(TEXT("GET"), TEXT("/api/static"), FString(), MoveTemp(Callback));
}

void UWCApiSubsystem::FetchState(FWCJsonCallback Callback)
{
    Request(TEXT("GET"), TEXT("/api/state"), FString(), MoveTemp(Callback));
}

void UWCApiSubsystem::NewCampaign(const FString& Player1, const FString& Player2, FWCJsonCallback Callback)
{
    const TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("p1"), Player1);
    if (!Player2.IsEmpty()) Body->SetStringField(TEXT("p2"), Player2);

    FString BodyText;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyText);
    FJsonSerializer::Serialize(Body, Writer);
    Request(TEXT("POST"), TEXT("/api/new"), BodyText, MoveTemp(Callback));
}

void UWCApiSubsystem::SendCommand(const FString& Faction, const FString& Verb, const TArray<FString>& Args, FWCJsonCallback Callback)
{
    const TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetNumberField(TEXT("seq"), static_cast<double>(NextSeq++));
    Body->SetStringField(TEXT("faction"), Faction);
    Body->SetStringField(TEXT("verb"), Verb);
    TArray<TSharedPtr<FJsonValue>> ArgValues;
    for (const FString& Arg : Args) ArgValues.Add(MakeShared<FJsonValueString>(Arg));
    Body->SetArrayField(TEXT("args"), ArgValues);

    FString BodyText;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyText);
    FJsonSerializer::Serialize(Body, Writer);
    Request(TEXT("POST"), TEXT("/api/command"), BodyText, MoveTemp(Callback));
}

void UWCApiSubsystem::Request(const FString& Verb, const FString& Path, const FString& Body, FWCJsonCallback Callback)
{
    const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(FString::Printf(TEXT("http://localhost:%d%s"), ServerPort, *Path));
    Req->SetVerb(Verb);
    Req->SetTimeout(30.0f);   // end 는 AI 6세력 턴을 동기 처리 — 넉넉히
    if (!Body.IsEmpty())
    {
        Req->SetHeader(TEXT("Content-Type"), TEXT("application/json; charset=utf-8"));
        Req->SetContentAsString(Body);
    }
    Req->OnProcessRequestComplete().BindLambda(
        [Path, Callback](FHttpRequestPtr, FHttpResponsePtr Response, bool bOk)
        {
            TSharedPtr<FJsonObject> Json;
            if (bOk && Response.IsValid())
            {
                const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
                FJsonSerializer::Deserialize(Reader, Json);
            }
            if (!Json.IsValid())
                UE_LOG(LogWCApi, Warning, TEXT("%s 실패 — C# 게임 서버(server 모드)가 떠 있는지 확인"), *Path);
            if (Callback) Callback(Json);
        });
    Req->ProcessRequest();
}
