using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>외교 (§1.2·§4.2): 동맹 양측 동기·자원지원 상한·공동 수비·공동 승리.</summary>
public class DiplomacyTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm, DiplomacyManager dip) Setup(ulong seed = 1)
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        return (s, new GameManager(s, db), new DiplomacyManager(s, db));
    }

    [Fact]
    public void 동맹은_양측_관계가_동기화()
    {
        var (s, _, dip) = Setup();
        Assert.Equal(DiplomacyOutcome.Success, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomaticState.Alliance, s.Factions.Single(f => f.Id == "joseon").Relations["wei"]);
        Assert.Equal(DiplomaticState.Alliance, s.Factions.Single(f => f.Id == "wei").Relations["joseon"]);
        Assert.True(dip.AreAllied("joseon", "wei"));
        Assert.Contains("alliance:joseon+wei", s.Progress);   // 최초 동맹 — 컷씬 트리거원
    }

    [Fact]
    public void 전쟁중_동맹불가_종전후_가능()
    {
        var (_, _, dip) = Setup();
        dip.DeclareWar("joseon", "wei");
        Assert.Equal(DiplomacyOutcome.AtWar, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.Success, dip.MakePeace("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.Success, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.NotAtWar, dip.MakePeace("joseon", "wei"));   // 전쟁 아님
    }

    [Fact]
    public void 자원지원_동맹전용_상한_잔고()
    {
        var (s, gm, dip) = Setup();
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var wei = s.Factions.Single(f => f.Id == "wei");
        joseon.Treasury = 1000; joseon.Food = 1000;
        var cap = Db().Rules.AllianceTransferCapPerTurn;   // 데이터 상한

        Assert.Equal(DiplomacyOutcome.NotAllied, dip.TransferResources("joseon", "wei", 100, 0));
        dip.FormAlliance("joseon", "wei");

        var g0 = wei.Treasury;
        Assert.Equal(DiplomacyOutcome.Success, dip.TransferResources("joseon", "wei", 100, 50));
        Assert.Equal(900, joseon.Treasury);
        Assert.Equal(g0 + 100, wei.Treasury);

        // 턴당 상한 초과
        Assert.Equal(DiplomacyOutcome.TransferCapExceeded,
            dip.TransferResources("joseon", "wei", cap.Gold, 0));
        // 수입 페이즈(새 턴)에서 리셋 → 다시 가능
        gm.CollectIncome();
        Assert.Equal(DiplomacyOutcome.Success, dip.TransferResources("joseon", "wei", 100, 0));

        // 잔고 부족·무효 금액
        joseon.Treasury = 10;
        Assert.Equal(DiplomacyOutcome.InsufficientResources, dip.TransferResources("joseon", "wei", 50, 0));
        Assert.Equal(DiplomacyOutcome.InvalidAmount, dip.TransferResources("joseon", "wei", 0, 0));
        Assert.Equal(DiplomacyOutcome.InvalidAmount, dip.TransferResources("joseon", "wei", -5, 0));
    }

    [Fact]
    public void 동맹군은_공동_수비에_참여한다()   // §1.2 공동 전투
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 42, "joseon", "wei");
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        // france(AI)가 pyongyang 소유, joseon 이 france 와 동맹 → joseon 주둔군이 공동 수비
        s.Factions.Single(f => f.Id == "france").OwnedProvinceIds.Add("pyongyang");
        dip.FormAlliance("joseon", "france");

        var allyGarrison = new Army("joseon_army_1", "joseon", "pyongyang");
        allyGarrison.AddUnits("spearman", 3000);   // 동맹 수비 대군
        s.Armies.Add(allyGarrison);

        var atk = new Army("wei_army_1", "wei", "beijing");
        atk.AddUnits("cavalry", 300);
        s.Armies.Add(atk);

        var outcome = gm.Attack("wei", "wei_army_1", "pyongyang", out var battle);

        Assert.Equal(AttackOutcome.DefenderHeld, outcome);   // 동맹군 없었으면 무저항 함락이었을 상황
        Assert.True(battle!.DefenderLosses < 3000);
        Assert.Contains("pyongyang", s.Factions.Single(f => f.Id == "france").OwnedProvinceIds);
    }

    [Fact]
    public void 공동_승리_판정()   // §1.2 [MUST]
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        dip.FormAlliance("joseon", "wei");

        // 전 육상 영지를 두 인간 세력이 분점
        var allLand = db.Map.LandProvinces.Select(p => p.Id).ToList();
        foreach (var f in s.Factions) f.OwnedProvinceIds.Clear();
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var wei = s.Factions.Single(f => f.Id == "wei");
        joseon.OwnedProvinceIds.AddRange(allLand.Take(5));
        wei.OwnedProvinceIds.AddRange(allLand.Skip(5));

        var winners = gm.CheckVictory();
        Assert.Equal(2, winners.Count);
        Assert.Contains("joseon", winners);
        Assert.Contains("wei", winners);

        // 동맹 파기(배신) 시 공동 승리 불성립
        dip.DeclareWar("joseon", "wei");
        Assert.Empty(gm.CheckVictory());
    }

    [Fact]
    public void 이전_누계는_세이브_왕복_보존()
    {
        var (s, _, dip) = Setup();
        dip.FormAlliance("joseon", "wei");
        s.Factions.Single(f => f.Id == "joseon").Treasury = 1000;
        dip.TransferResources("joseon", "wei", 80, 0);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            Assert.Equal(80, loaded.Factions.Single(f => f.Id == "joseon").TransferredGoldThisTurn);
        }
        finally { File.Delete(path); }
    }
}
