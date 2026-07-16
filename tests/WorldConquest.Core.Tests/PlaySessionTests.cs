using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>핫시트 콘솔 루프 (Phase 1 §1.2) — 스크립트 입력으로 명령·턴 넘기기·세이브를 구동한다.</summary>
public class PlaySessionTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState state, string output) RunScript(string script, GameDatabase db)
    {
        var state = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(state, db);
        gm.CollectIncome();   // 새 캠페인 첫 턴 수입 (Program 과 동일)
        var output = new StringWriter();
        new PlaySession(gm, db, new StringReader(script), output).Run();
        return (state, output.ToString());
    }

    [Fact]
    public void 두_플레이어_턴_넘기고_점령하고_종료()
    {
        var db = Db();
        // t1: joseon(capture pyongyang, end) → wei(end) → 자동 페이즈 → t2: joseon(quit)
        var (state, output) = RunScript("capture pyongyang\nend\nend\nquit\n", db);

        var joseon = state.Factions.Single(f => f.Id == "joseon");
        Assert.Contains("pyongyang", joseon.OwnedProvinceIds);   // 실제 점령됨
        Assert.Contains("점령", output);
        Assert.Contains("조선", output);                          // 세력명 표시
        Assert.Contains("위", output);                            // 상대 플레이어 턴도 진행
        Assert.True(state.Turn >= 2, "최소 2턴 진행");
    }

    [Fact]
    public void 징병하고_부대_이동_명령()
    {
        var db = Db();
        var (state, output) = RunScript("recruit hanseong spearman 10\narmies\nmove joseon_army_1 pyongyang\nquit\n", db);

        var army = state.Armies.Single();
        Assert.Equal("pyongyang", army.LocationNodeId);   // 징병 후 이동됨
        Assert.Equal(10, army.Units["spearman"]);
        Assert.Contains("징병", output);
        Assert.Contains("이동", output);
    }

    [Fact]
    public void 점령_실패도_안내된다()
    {
        var db = Db();
        // baghdad 는 joseon 비인접 → 실패 메시지
        var (_, output) = RunScript("capture baghdad\nquit\n", db);
        Assert.Contains("점령 실패", output);
        Assert.Contains("NotAdjacent", output);
    }

    [Fact]
    public void 세션에서_세이브_후_로드하면_상태_동일()
    {
        var db = Db();
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var (state, _) = RunScript($"capture pyongyang\nsave {path}\nquit\n", db);
            var loaded = new SaveSystem().Load(path);
            var lj = loaded.Factions.Single(f => f.Id == "joseon");
            Assert.Contains("pyongyang", lj.OwnedProvinceIds);   // 점령 상태가 세이브에 반영
            Assert.Equal(state.Factions.Single(f => f.Id == "joseon").Treasury, lj.Treasury);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void EOF는_게임_종료()
    {
        var db = Db();
        var (_, output) = RunScript("", db);   // 즉시 EOF
        Assert.Contains("게임을 종료합니다", output);
    }
}
