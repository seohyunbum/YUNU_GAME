using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>AI 컨트롤러·배치 시뮬 (§2.6 [SHOULD]·§8): 확장·징병·결정론·시뮬 완주.</summary>
public class AiTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void AI는_빈_영지를_점령하고_징병한다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 1);
        var gm = new GameManager(s, db);
        gm.CollectIncome();

        var ownedBefore = s.Factions.Sum(f => f.OwnedProvinceIds.Count);
        // 1턴 진행 (Income→…→AiAction 포함 한 바퀴)
        while (s.Turn == 1) gm.AdvancePhase();

        var ownedAfter = s.Factions.Sum(f => f.OwnedProvinceIds.Count);
        Assert.True(ownedAfter > ownedBefore, "AI 가 빈 영지를 점령하지 않음");
        Assert.True(s.Armies.Count > 0, "AI 가 징병하지 않음");
    }

    [Fact]
    public void AI_행동은_결정적_같은_시드_같은_상태()
    {
        var db = Db();
        GameState Run(ulong seed)
        {
            var s = GameSetup.AiCampaign(db, seed);
            var gm = new GameManager(s, db);
            gm.CollectIncome();
            while (s.Turn <= 10) gm.AdvancePhase();
            return s;
        }

        var a = Run(777);
        var b = Run(777);
        foreach (var fa in a.Factions)
        {
            var fb = b.Factions.Single(f => f.Id == fa.Id);
            Assert.Equal(fa.Treasury, fb.Treasury);
            Assert.Equal(fa.OwnedProvinceIds, fb.OwnedProvinceIds);
        }
        Assert.Equal(a.Armies.Count, b.Armies.Count);
    }

    [Fact]
    public void AI는_동맹을_공격하지_않는다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 5);
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        gm.CollectIncome();

        // wei(aggressive) 와 joseon 을 동맹으로 — 인접 관계에서도 공격 금지 확인
        dip.FormAlliance("wei", "joseon");
        var joseonBefore = s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds.ToList();

        while (s.Turn <= 5) gm.AdvancePhase();

        var joseon = s.Factions.Single(f => f.Id == "joseon");
        foreach (var p in joseonBefore)
            Assert.Contains(p, joseon.OwnedProvinceIds);   // 동맹의 시작 영지 침탈 없음
    }

    [Fact]
    public void 배치_시뮬_같은_시드_같은_결과()   // §8 시드 고정 리플레이 — 게임 전체 수준
    {
        var db = Db();
        var (w1, t1, d1) = BatchSimulator.RunOne(db, 4242, turnCap: 60);
        var (w2, t2, d2) = BatchSimulator.RunOne(db, 4242, turnCap: 60);
        Assert.Equal(w1, w2);
        Assert.Equal(t1, t2);
        Assert.Equal(d1, d2);
    }

    [Fact]
    public void 배치_시뮬_리포트_집계()
    {
        var db = Db();
        var report = BatchSimulator.Run(db, games: 6, baseSeed: 100, turnCap: 80);
        Assert.Equal(6, report.Games);
        // AI 캠페인은 공동 승리가 없으므로(인간 플레이어 부재) 승수 합 + 무승부 = 판수
        Assert.Equal(6, report.WinsByFaction.Values.Sum() + report.Draws);
        Assert.True(report.AverageTurns > 0);
        Assert.InRange(report.MaxWinRatePct, 0, 100);
    }
}
