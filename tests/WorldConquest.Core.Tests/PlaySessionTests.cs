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
    public void 미존재_영지_명령도_세션_안죽음()   // QA critical: 오타 명령이 세션 크래시
    {
        var db = Db();
        var (_, output) = RunScript("capture zzz\nrecruit zzz spearman 5\nbuild zzz market\nquit\n", db);
        Assert.Contains("게임을 종료합니다", output);   // 크래시 없이 정상 종료
        Assert.Contains("실패", output);                 // 각 명령이 실패로 안내됨
    }

    [Fact]
    public void EOF는_게임_종료()
    {
        var db = Db();
        var (_, output) = RunScript("", db);   // 즉시 EOF
        Assert.Contains("게임을 종료합니다", output);
    }

    [Fact]
    public void 솔로_캠페인은_조작자_1명_나머지_전부_AI()   // 1인 플레이: p2=null
    {
        var db = Db();
        var state = GameSetup.NewCampaign(db, 1, "joseon");   // p2 미지정
        Assert.Single(state.Factions, f => f.Controller == "human_p1");
        Assert.DoesNotContain(state.Factions, f => f.Controller == "human_p2");
        Assert.Equal(db.Factions.Count - 1, state.Factions.Count(f => f.Controller == "ai"));
    }

    [Fact]
    public void 솔로_플레이는_P2페이즈_자동스킵하고_AI가_행동한다()   // 엔진이 1인 플레이 완주 가능
    {
        var db = Db();
        var state = GameSetup.NewCampaign(db, 1, "joseon");   // 조선만 사람, 나머지 6 AI
        var gm = new GameManager(state, db);
        gm.CollectIncome();
        var output = new StringWriter();
        // 조작자는 조선 턴만 입력한다(P2 프롬프트는 오지 않아야 정상) — 3턴 넘기고 종료
        new PlaySession(gm, db, new StringReader("end\nend\nquit\n"), output).Run();

        var text = output.ToString();
        Assert.DoesNotContain("human_p2", text);          // P2 프롬프트 없음(자동 스킵)
        Assert.True(state.Turn >= 2, "사람 입력 없이도 AI 페이즈 거쳐 턴 진행");
        Assert.Contains("게임을 종료합니다", text);        // 크래시 없이 정상 종료
    }
}
