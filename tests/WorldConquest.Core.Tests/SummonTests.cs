using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>초빙/가챠 (§2.8): 풀 파생·비복원·천장·결정론·세이브스컴 방지·등장씬.</summary>
public class SummonTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm, SummonSystem sys) Setup(ulong seed, int mandate = 10000)
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "joseon").Mandate = mandate;
        return (s, gm, new SummonSystem(s, db, gm.Bus));
    }

    [Fact]
    public void 풀은_미소속_summon_채널만()   // 리더 7명 제외 — 관우·잔다르크·마슈
    {
        var (_, _, sys) = Setup(1);
        var pool = sys.GetPool().Select(c => c.Id).ToList();
        Assert.Equal(new[] { "guan_yu", "jeanne_darc", "mash_kyrielight" }, pool);
    }

    [Fact]
    public void 초빙은_비복원_전원_유일()
    {
        var (s, _, sys) = Setup(42);
        var outcome = sys.DrawBatch("joseon", 3, out var results);

        Assert.Equal(SummonOutcome.Success, outcome);
        Assert.Equal(3, results.Count);
        Assert.Equal(3, results.Select(r => r.CharacterId).Distinct().Count());   // 중복 없음
        Assert.All(results, r => Assert.Equal("joseon", s.CharacterOwners[r.CharacterId]));
        Assert.Empty(sys.GetPool());                                              // 풀 소진
        Assert.Equal(SummonOutcome.PoolExhausted, sys.DrawBatch("joseon", 1, out _));
    }

    [Fact]
    public void 천명_부족_거부()
    {
        var (_, _, sys) = Setup(1, mandate: 10);
        Assert.Equal(SummonOutcome.InsufficientMandate, sys.DrawBatch("joseon", 1, out _));
    }

    [Fact]
    public void hard_pity_도달시_최고등급_확정()
    {
        var (s, _, sys) = Setup(7);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.PityCount = Db().Rules.SummonHardPity - 1;   // 29 — 다음 뽑기가 천장

        sys.DrawBatch("joseon", 1, out var results);

        Assert.True(results[0].PityTriggered);
        Assert.Equal(5, results[0].Rarity);
        Assert.Equal("guan_yu", results[0].CharacterId);    // 풀 유일 ★5
        Assert.Equal(0, joseon.PityCount);                  // 리셋
    }

    [Fact]
    public void 같은_시드는_같은_뽑기_결과()   // §2.8.5 결정론
    {
        var (_, _, sys1) = Setup(999);
        sys1.DrawBatch("joseon", 3, out var r1);
        var (_, _, sys2) = Setup(999);
        sys2.DrawBatch("joseon", 3, out var r2);
        Assert.Equal(r1.Select(x => x.CharacterId), r2.Select(x => x.CharacterId));
    }

    [Fact]
    public void 세이브_로드_후_뽑기_결과_불변()   // 세이브스컴 방지 (§2.8.5)
    {
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var db = Db();
            var (s, _, sys) = Setup(4242);
            sys.DrawBatch("joseon", 1, out var first);      // 스트림 소비 후 저장
            new SaveSystem().Save(s, path);
            sys.DrawBatch("joseon", 1, out var expected);   // 저장 시점 이후 다음 뽑기

            var loaded = new SaveSystem().Load(path);
            var gm2 = new GameManager(loaded, db);
            var sys2 = new SummonSystem(loaded, db, gm2.Bus);
            sys2.DrawBatch("joseon", 1, out var actual);    // 리로드 후 같은 뽑기

            Assert.Equal(expected[0].CharacterId, actual[0].CharacterId);   // 리세마라 불가
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 별5_초빙은_등장씬을_재생한다()   // §2.8.10 — A1 재사용
    {
        var (s, _, sys) = Setup(7);
        s.Factions.Single(f => f.Id == "joseon").PityCount = Db().Rules.SummonHardPity - 1;   // 관우 확정
        sys.DrawBatch("joseon", 1, out _);
        Assert.Contains("cs_entry_guan_yu", s.FiredCutsceneIds);
    }

    [Fact]
    public void 턴당_초빙_캡()
    {
        var (s, _, sys) = Setup(1);
        s.Factions.Single(f => f.Id == "joseon").SummonsThisTurn = Db().Rules.SummonMaxPerTurn;
        Assert.Equal(SummonOutcome.TurnCapExceeded, sys.DrawBatch("joseon", 1, out _));
    }

    [Fact]
    public void 천명_수입_수입페이즈와_점령()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");

        gm.CollectIncome();
        Assert.Equal(db.Rules.SummonIncomeBasePerTurn, joseon.Mandate);   // 기본 수입

        gm.TryCapture("joseon", "pyongyang");                              // 최초 점령
        Assert.Equal(db.Rules.SummonIncomeBasePerTurn + db.Rules.SummonIncomeFirstCapture, joseon.Mandate);
    }

    [Fact]
    public void 확률_공시는_판정과_동일_함수_풀고갈_반영()   // §2.8.6 [MUST]
    {
        var (s, _, sys) = Setup(1);
        // 관우(★5) 를 소속시켜 풀에서 제거 → ★5 질량이 ★4 로 귀착돼야
        s.CharacterOwners["guan_yu"] = "wei";
        var rates = sys.GetCurrentRates("joseon");
        Assert.False(rates.ContainsKey(5));
        Assert.Equal(10000, rates.Values.Sum());   // 합 보존
    }
}
