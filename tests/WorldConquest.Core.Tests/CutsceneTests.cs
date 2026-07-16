using System.Text.Json.Nodes;
using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>시네마틱 T0 (§2.7): 트리거·fired=seen·일기토 명장면·궁극기 컷씬·세이브 왕복·로더 검증.</summary>
public class CutsceneTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    /// <summary>관우(무력 140) vs 세이버(무력 140) — 격차 0 이라 일기토 성사.</summary>
    private static (GameState s, GameManager gm) DuelScenario(GameDatabase db, ulong seed)
    {
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds.Add("pyongyang");
        var atk = new Army("joseon_army_1", "joseon", "hanseong") { CommanderId = "guan_yu" };
        atk.AddUnits("spearman", 900);
        s.Armies.Add(atk);
        var def = new Army("wei_army_1", "wei", "pyongyang") { CommanderId = "saber_artoria" };
        def.AddUnits("spearman", 900);
        s.Armies.Add(def);
        return (s, gm);
    }

    [Fact]
    public void 일기토_성사되고_관우_승리시_온주참화웅_발동()
    {
        var db = Db();
        // 관우가 이기는 시드를 찾는다 (변동 ±20% — 대부분 성사, 승자만 다름)
        for (ulong seed = 1; seed <= 40; seed++)
        {
            var (s, gm) = DuelScenario(db, seed);
            gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);
            if (battle!.Duel is { WinnerCharacterId: "guan_yu" })
            {
                Assert.Contains("cs_moment_warm_wine", s.FiredCutsceneIds);   // 페이오프 fired=seen
                return;
            }
        }
        Assert.Fail("40개 시드에서 관우 일기토 승리가 한 번도 없음 — 판정 로직 의심");
    }

    [Fact]
    public void 온주참화웅은_세이브당_1회만()
    {
        var db = Db();
        for (ulong seed = 1; seed <= 40; seed++)
        {
            var (s, gm) = DuelScenario(db, seed);
            gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);
            if (battle!.Duel is { WinnerCharacterId: "guan_yu" })
            {
                var fired = new List<string>();
                gm.Bus.Subscribe(e => { if (e.Type == "CutsceneTriggered") fired.Add(e.Get("cutscene")!); });
                // 같은 조건 재발동 시도 — once_per save 라 재발동 없음
                gm.Bus.Publish(GameEvent.Of("DuelEnded", ("actor", "guan_yu"), ("winner", "actor"), ("node", "x")));
                Assert.DoesNotContain("cs_moment_warm_wine", fired);
                return;
            }
        }
        Assert.Fail("관우 승리 시드 없음");
    }

    [Fact]
    public void 궁극기_발동은_컷씬으로_이어진다()   // A2 — skills.json cutscene_id 직접 매핑
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 42, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds.Add("pyongyang");
        var atk = new Army("joseon_army_1", "joseon", "hanseong") { CommanderId = "cao_cao" };   // str 낮아 일기토 불발
        atk.AddUnits("spearman", 1000);
        s.Armies.Add(atk);
        var def = new Army("wei_army_1", "wei", "pyongyang");
        def.AddUnits("spearman", 1000);
        s.Armies.Add(def);

        gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);

        if (battle!.SkillEvents.Any(e => e.SkillId == "overlord_march"))
            Assert.Contains("cs_overlord_march", s.FiredCutsceneIds);
    }

    [Fact]
    public void 동맹_컷씬은_두_인간_플레이어일_때만()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db, gm.Bus);

        dip.FormAlliance("joseon", "france");   // 인간+AI — 미발동
        Assert.DoesNotContain("cs_first_alliance", s.FiredCutsceneIds);

        dip.FormAlliance("joseon", "wei");      // 인간+인간 — 발동
        Assert.Contains("cs_first_alliance", s.FiredCutsceneIds);
    }

    [Fact]
    public void 콘솔에서_동맹_컷씬이_재생된다()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();
        var output = new StringWriter();
        new PlaySession(gm, db, new StringReader("ally wei\nquit\n"), output).Run();

        Assert.Contains("盟約", output.ToString());   // 타이틀카드 재생 확인
        Assert.Contains("천하도 좁다", output.ToString());
    }

    [Fact]
    public void fired_컷씬은_세이브_왕복_보존()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        new DiplomacyManager(s, db, gm.Bus).FormAlliance("joseon", "wei");
        Assert.Contains("cs_first_alliance", s.FiredCutsceneIds);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            Assert.Contains("cs_first_alliance", loaded.FiredCutsceneIds);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 로더가_깨진_컷씬_참조를_검출()
    {
        using var dir = new MutableDataDir();
        // 트리거의 actor_is 가 존재하지 않는 캐릭터를 참조하면 기동 실패
        dir.Mutate(DataLoader.CutsceneTriggersFile, n =>
        {
            var t = n["triggers"]!.AsArray().First(x => (string?)x!["id"] == "cs_moment_warm_wine");
            t!["conditions"]!.AsArray()[0]!["value"] = "no_such_character";
        });
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.File == DataLoader.CutsceneTriggersFile && e.Message.Contains("존재하지 않는 캐릭터"));
    }

    [Fact]
    public void 로더가_스크립트_없는_트리거를_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CutsceneTriggersFile, n =>
        {
            var orphan = new JsonObject
            {
                ["id"] = "cs_orphan",
                ["category"] = "misc",
                ["on_event"] = "BattleEnded",
                ["conditions"] = new JsonArray(),
                ["priority"] = 1,
                ["once_per"] = "save"
            };
            n["triggers"]!.AsArray().Add(orphan);
        });
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Entry == "cs_orphan" && e.Message.Contains("스크립트"));
    }
}
