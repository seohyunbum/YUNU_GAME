using WorldConquest.Core.Data;

namespace WorldConquest.Core.Tests;

/// <summary>
/// UE5 클라이언트 API 계약 (ue5-client-design §2) — GameSessionHost 를 HTTP 없이 직접 검증.
/// 핵심 계약: 스냅샷 정확성 · 이벤트 저널 seq · 명령 멱등성(RNG 이중 소모 차단) · SessionDriver 공유 플로우.
/// </summary>
public class ApiContractTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameSessionHost host, GameDatabase db) NewSolo(ulong seed = 7)
    {
        var db = Db();
        var host = new GameSessionHost(db);
        host.NewCampaign("joseon", null, seed);
        return (host, db);
    }

    [Fact]
    public void 새_캠페인_스냅샷은_첫_입력_지점()
    {
        var db = Db();
        var host = new GameSessionHost(db);
        var snap = host.NewCampaign("joseon", "wei", 1);

        Assert.Equal(ApiProtocol.Version, snap.ProtocolVersion);
        Assert.Equal(1, snap.Turn);
        Assert.Equal("joseon", snap.PendingActor);                       // P1 입력 대기
        Assert.Null(snap.Winners);
        Assert.Equal(db.Factions.Count, snap.Factions.Count);
        Assert.Equal(db.Map.LandProvinces.Count(), snap.Provinces.Count);
        Assert.Contains(snap.Provinces, p => p.Id == "hanseong" && p.OwnerFactionId == "joseon");
        Assert.Contains(snap.Provinces, p => p.Id == "pyongyang" && p.OwnerFactionId is null);   // 빈 영지
        var joseon = snap.Factions.Single(f => f.Id == "joseon");
        Assert.True(joseon.Treasury > 0);                                 // 첫 턴 수입 정산됨
    }

    [Fact]
    public void 명령_실행과_이벤트_저널()
    {
        var (host, _) = NewSolo();
        var r = host.Execute(0, "joseon", "capture", new[] { "pyongyang" });

        Assert.Equal("ok", r.Status);
        Assert.Contains(r.State.Provinces, p => p.Id == "pyongyang" && p.OwnerFactionId == "joseon");
        Assert.Contains(r.Events, e => e.Type == "ProvinceCaptured" && e.Data["province"] == "pyongyang");
        // 저널 seq 는 단조 — 재동기 커서로 같은 구간 복구 가능
        var replay = host.EventsSince(r.Events.Count > 0 ? r.Events[0].Seq : 0);
        Assert.True(replay.Count >= r.Events.Count);
    }

    [Fact]
    public void 같은_seq_재전송은_같은_응답_RNG_이중소모_없음()   // 멱등 [MUST]
    {
        var (host, db) = NewSolo();
        host.RequireMandate("joseon", 10000, db);

        var first = host.Execute(0, "joseon", "summon", new[] { "1" });
        Assert.Equal("ok", first.Status);
        var pulled = first.State.Factions.Single(f => f.Id == "joseon");

        var retry = host.Execute(0, "joseon", "summon", new[] { "1" });   // HTTP 재시도 시뮬레이션
        Assert.Same(first, retry);                                        // 캐시된 원 응답 그대로
        // 상태도 불변 — 천명이 두 번 차감되지 않았다
        var now = host.Snapshot().Factions.Single(f => f.Id == "joseon");
        Assert.Equal(pulled.Mandate, now.Mandate);
        Assert.Equal(pulled.PityCount, now.PityCount);
    }

    [Fact]
    public void 차례가_아닌_세력의_명령은_거부()
    {
        var (host, _) = NewSolo();
        var r = host.Execute(0, "wei", "capture", new[] { "pyongyang" });   // wei 는 AI — 차례 아님
        Assert.Equal("error", r.Status);
        Assert.Contains("차례", r.Message);
    }

    [Fact]
    public void end는_AI턴을_지나_다음_입력까지_전진()   // solo: SessionDriver 공유 플로우
    {
        var (host, _) = NewSolo();
        var r = host.Execute(0, "joseon", "end", Array.Empty<string>());

        Assert.Equal("ok", r.Status);
        Assert.Equal(2, r.State.Turn);                    // AI 6세력·판정 페이즈 통과 후 다음 턴
        Assert.Equal("joseon", r.State.PendingActor);     // 다시 사람 차례
        Assert.Contains(r.Events, e => e.Type == "TurnStarted");   // 턴 시작 신호가 저널로
    }

    [Fact]
    public void 세이브_로드_왕복_후_이어하기()
    {
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var (host, _) = NewSolo();
            host.Execute(0, "joseon", "capture", new[] { "pyongyang" });
            host.SaveCampaign(path);

            var host2 = new GameSessionHost(Db());
            var snap = host2.LoadCampaign(path);
            Assert.Contains(snap.Provinces, p => p.Id == "pyongyang" && p.OwnerFactionId == "joseon");
            Assert.Equal("joseon", snap.PendingActor);    // 명령 페이즈에서 저장 → 즉시 입력 대기
            // 로드 후 새 캠페인 저널 — 명령이 정상 동작
            var r = host2.Execute(0, "joseon", "end", Array.Empty<string>());
            Assert.Equal("ok", r.Status);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 미지_명령과_인자_부족은_오류로_안내()   // 세션은 죽지 않는다
    {
        var (host, _) = NewSolo();
        Assert.Equal("error", host.Execute(0, "joseon", "zzz", Array.Empty<string>()).Status);
        var r = host.Execute(1, "joseon", "capture", Array.Empty<string>());
        Assert.Equal("error", r.Status);
        Assert.Contains("사용법", r.Message);
        // 이후 정상 명령은 여전히 동작
        Assert.Equal("ok", host.Execute(2, "joseon", "capture", new[] { "pyongyang" }).Status);
    }
}

internal static class ApiTestExtensions
{
    /// <summary>테스트 편의 — 천명 강제 주입 (스냅샷은 읽기 전용이라 상태 직접 접근이 필요).</summary>
    public static void RequireMandate(this GameSessionHost host, string factionId, int mandate, GameDatabase db)
    {
        // GameSessionHost 는 상태를 캡슐화하므로, 세이브 왕복으로 주입한다 — 공개 API 만 사용.
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            host.SaveCampaign(path);
            var json = File.ReadAllText(path);
            var node = System.Text.Json.Nodes.JsonNode.Parse(json)!;
            foreach (var f in node["factions"]!.AsArray())
                if ((string?)f!["id"] == factionId) f["mandate"] = mandate;
            File.WriteAllText(path, node.ToJsonString());
            host.LoadCampaign(path);
        }
        finally { File.Delete(path); }
    }
}
