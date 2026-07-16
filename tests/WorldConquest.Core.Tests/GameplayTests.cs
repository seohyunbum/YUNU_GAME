using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>Phase 1 게임플레이 — 캠페인 셋업·페이즈 전이·수입 정산·세이브 왕복(§2.2·§7).</summary>
public class GameplayTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void 새_캠페인_초기상태()
    {
        var s = GameSetup.NewCampaign(Db(), 42, "joseon", "wei");
        Assert.Equal(1, s.Turn);
        Assert.Equal(TurnPhase.Income, s.Phase);
        Assert.Equal("joseon", s.Actor);
        Assert.Equal("human_p1", s.Factions.Single(f => f.Id == "joseon").Controller);
        Assert.Equal("human_p2", s.Factions.Single(f => f.Id == "wei").Controller);
        Assert.All(s.Factions.Where(f => f.Id is not ("joseon" or "wei")),
                   f => Assert.Equal("ai", f.Controller));
    }

    [Fact]
    public void 같은_세력_두명은_예외()
    {
        Assert.Throws<ArgumentException>(() => GameSetup.NewCampaign(Db(), 1, "joseon", "joseon"));
    }

    [Fact]
    public void 페이즈_전이_7단계_순환하며_턴_증가()
    {
        var s = GameSetup.NewCampaign(Db(), 1, "joseon", "wei");
        TurnPhase[] expected =
        {
            TurnPhase.Player1Command, TurnPhase.Player2Command, TurnPhase.AiAction,
            TurnPhase.Resolution, TurnPhase.Events, TurnPhase.VictoryCheck, TurnPhase.Income
        };
        foreach (var e in expected) { TurnSystem.Advance(s); Assert.Equal(e, s.Phase); }
        Assert.Equal(2, s.Turn);   // VictoryCheck → Income 회귀 시 턴 증가
    }

    [Fact]
    public void 플레이어_페이즈_actor는_해당_컨트롤러_세력()
    {
        var s = GameSetup.NewCampaign(Db(), 1, "joseon", "wei");
        TurnSystem.Advance(s); Assert.Equal("joseon", s.Actor);   // Player1Command
        TurnSystem.Advance(s); Assert.Equal("wei", s.Actor);      // Player2Command
        TurnSystem.Advance(s); Assert.Equal("", s.Actor);         // AiAction (시스템)
    }

    [Fact]
    public void 수입_페이즈_소유영지_생산량_정산()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var gold0 = joseon.Treasury; var food0 = joseon.Food;

        gm.CollectIncome();

        // joseon 소유 = 한성(금120/식90) + 부산(금100/식70) → +220/+160
        Assert.Equal(gold0 + 220, joseon.Treasury);
        Assert.Equal(food0 + 160, joseon.Food);
    }

    [Fact]
    public void 세이브_왕복_실제_게임상태()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 12345, "joseon", "wei");
        new GameManager(s, db).CollectIncome();
        for (var i = 0; i < 10; i++) TurnSystem.Advance(s);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var sys = new SaveSystem();
            sys.Save(s, path);
            var loaded = sys.Load(path);
            Assert.Equal(s.Turn, loaded.Turn);
            Assert.Equal(s.Phase, loaded.Phase);
            var oj = s.Factions.Single(f => f.Id == "joseon");
            var lj = loaded.Factions.Single(f => f.Id == "joseon");
            Assert.Equal(oj.Treasury, lj.Treasury);
            Assert.Equal(oj.OwnedProvinceIds, lj.OwnedProvinceIds);
        }
        finally { File.Delete(path); }
    }
}
