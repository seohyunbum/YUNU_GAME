#include "WCApiSubsystem.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

#if PLATFORM_WINDOWS
#include "Windows/AllowWindowsPlatformTypes.h"
#include <windows.h>
#include "Windows/HideWindowsPlatformTypes.h"
#endif

DEFINE_LOG_CATEGORY_STATIC(LogWCApi, Log, All);

#if PLATFORM_WINDOWS
namespace
{
    /**
     * KILL_ON_JOB_CLOSE Job Object — UE 가 어떤 방식으로 죽든(크래시·taskkill 포함) OS 가
     * 자식 C# 서버를 함께 종료한다. Deinitialize 의 TerminateProc 은 정상 종료용 1차,
     * 이 Job 이 최후 방어선 (ue5-client-design §4 [MUST]).
     */
    HANDLE GServerJob = nullptr;

    void AttachToKillJob(void* ProcessHandle)
    {
        if (!GServerJob)
        {
            GServerJob = ::CreateJobObjectW(nullptr, nullptr);
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION Info = {};
            Info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            ::SetInformationJobObject(GServerJob, JobObjectExtendedLimitInformation, &Info, sizeof(Info));
        }
        if (GServerJob && ProcessHandle)
            ::AssignProcessToJobObject(GServerJob, static_cast<HANDLE>(ProcessHandle));
    }
}
#endif

void UWCApiSubsystem::Deinitialize()
{
    CleanupServer();
    Super::Deinitialize();
}

void UWCApiSubsystem::EnsureServer(FWCJsonCallback OnReady)
{
    // 이미 떠 있는 서버 우선 (개발 모드 — 수동 server 프로세스와 공존)
    FetchInfo([this, OnReady](TSharedPtr<FJsonObject> Info)
    {
        if (Info.IsValid()) { if (OnReady) OnReady(Info); return; }
        SpawnServer(OnReady);
    });
}

void UWCApiSubsystem::SpawnServer(FWCJsonCallback OnReady)
{
    // exe 탐색: ①-WCServer= 인자 ②배포 표준 경로 (%USERPROFILE%\WorldConquest\app)
    FString ExePath;
    if (!FParse::Value(FCommandLine::Get(), TEXT("WCServer="), ExePath) || !FPaths::FileExists(ExePath))
    {
        ExePath = FPlatformMisc::GetEnvironmentVariable(TEXT("USERPROFILE"))
                / TEXT("WorldConquest/app/WorldConquest.ConsoleHost.exe");
    }
    if (!FPaths::FileExists(ExePath))
    {
        UE_LOG(LogWCApi, Error, TEXT("게임 서버 exe 미발견: %s — scripts/deploy-local.py 재실행 필요"), *ExePath);
        if (OnReady) OnReady(nullptr);
        return;
    }

    FPlatformProcess::CreatePipe(PipeRead, PipeWrite);
    // 고아 차단 = 부모 PID 감시 (stdin EOF 는 핸들 상속 시 불발 — work-history 참조)
    const FString Args = FString::Printf(TEXT("server --port 0 --parent-pid %u"),
        FPlatformProcess::GetCurrentProcessId());
    ServerProc = FPlatformProcess::CreateProc(*ExePath, *Args,
        /*bLaunchDetached*/ false, /*bLaunchHidden*/ true, /*bLaunchReallyHidden*/ true,
        nullptr, 0, *FPaths::GetPath(ExePath), PipeWrite);
    if (!ServerProc.IsValid())
    {
        UE_LOG(LogWCApi, Error, TEXT("게임 서버 스폰 실패: %s"), *ExePath);
        CleanupServer();
        if (OnReady) OnReady(nullptr);
        return;
    }
#if PLATFORM_WINDOWS
    AttachToKillJob(ServerProc.Get());   // UE 사망 시 OS 가 자식도 종료 — 고아 원천 차단
#endif
    UE_LOG(LogWCApi, Log, TEXT("게임 서버 스폰: %s (포트 핸드셰이크 대기)"), *ExePath);

    // stdout 에서 "WC_API_PORT=<n>" 파싱 — 폴링 티커 (최대 15초)
    const TSharedRef<FString> Buffer = MakeShared<FString>();
    const TSharedRef<double> Deadline = MakeShared<double>(FPlatformTime::Seconds() + 15.0);
    PipeTicker = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateLambda(
        [this, Buffer, Deadline, OnReady](float) -> bool
        {
            *Buffer += FPlatformProcess::ReadPipe(PipeRead);
            int32 Idx = Buffer->Find(TEXT("WC_API_PORT="));
            if (Idx != INDEX_NONE)
            {
                ServerPort = FCString::Atoi(**Buffer + Idx + 12);
                UE_LOG(LogWCApi, Log, TEXT("서버 포트 핸드셰이크: %d"), ServerPort);
                FetchInfo(OnReady);
                return false;   // 티커 종료
            }
            if (FPlatformTime::Seconds() > *Deadline || !FPlatformProcess::IsProcRunning(ServerProc))
            {
                UE_LOG(LogWCApi, Error, TEXT("서버 핸드셰이크 타임아웃/조기 종료"));
                CleanupServer();
                if (OnReady) OnReady(nullptr);
                return false;
            }
            return true;   // 계속 폴링
        }), 0.2f);
}

void UWCApiSubsystem::CleanupServer()
{
    if (PipeTicker.IsValid()) { FTSTicker::GetCoreTicker().RemoveTicker(PipeTicker); PipeTicker.Reset(); }
    if (ServerProc.IsValid())
    {
        // 정중한 종료 시도 후 강제 — 고아 프로세스 차단 (ue5-client-design §4)
        FPlatformProcess::TerminateProc(ServerProc, true);
        FPlatformProcess::CloseProc(ServerProc);
    }
    if (PipeRead || PipeWrite)
    {
        FPlatformProcess::ClosePipe(PipeRead, PipeWrite);
        PipeRead = PipeWrite = nullptr;
    }
}

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

void UWCApiSubsystem::SaveGame(const FString& Path, FWCJsonCallback Callback)
{
    const TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("path"), Path);
    FString BodyText;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyText);
    FJsonSerializer::Serialize(Body, Writer);
    Request(TEXT("POST"), TEXT("/api/save"), BodyText, MoveTemp(Callback));
}

void UWCApiSubsystem::LoadGame(const FString& Path, FWCJsonCallback Callback)
{
    const TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("path"), Path);
    FString BodyText;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyText);
    FJsonSerializer::Serialize(Body, Writer);
    Request(TEXT("POST"), TEXT("/api/load"), BodyText, MoveTemp(Callback));
}

void UWCApiSubsystem::FetchRates(const FString& Faction, FWCJsonCallback Callback)
{
    Request(TEXT("GET"), FString::Printf(TEXT("/api/rates?faction=%s"), *Faction), FString(), MoveTemp(Callback));
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
