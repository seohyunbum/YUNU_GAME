using System.Text.Json.Nodes;
using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>
/// 시작 무장(start_characters) + 등용(recruit) 시스템 (§2.8).
/// 등용은 재야(recruit 채널·미소속) 무장을 금+사신 매력으로 영입 — 초빙(가챠)과 별개 경로.
/// 성공률·비용은 정수 산술(§4.4)로 수기 검증, 판정은 recruit:{faction} 스트림으로 결정적.
/// </summary>
public class RecruitmentTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm) NewGame(GameDatabase db, ulong seed = 1)
    {
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        return (s, new GameManager(s, db));
    }

    // ═══════════════ 시작 무장 (start_characters) ═══════════════

    [Fact]
    public void 세력은_리더_외_시작무장을_데리고_시작한다()
    {
        var db = Db();
        var (s, _) = NewGame(db);
        // joseon: 리더 이순신 + start_characters 장영실
        Assert.Equal("joseon", s.CharacterOwners["yi_sunsin"]);
        Assert.Equal("joseon", s.CharacterOwners["jang_yeongsil"]);
        // wei: 조조 + 곽가 / shu: 제갈량 + 관우
        Assert.Equal("wei", s.CharacterOwners["cao_cao"]);
        Assert.Equal("wei", s.CharacterOwners["guo_jia"]);
        Assert.Equal("shu", s.CharacterOwners["zhuge_liang"]);
        Assert.Equal("shu", s.CharacterOwners["guan_yu"]);
    }

    [Fact]
    public void 시작무장은_초빙_등용_풀에서_제외된다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var summonPool = new SummonSystem(s, db, gm.Bus).GetPool().Select(c => c.Id).ToHashSet();
        var recruitPool = new RecruitmentSystem(s, db, gm.Bus).GetRecruitablePool().Select(c => c.Id).ToHashSet();
        foreach (var owned in new[] { "guan_yu", "guo_jia", "jang_yeongsil", "taishi_ci", "hulk", "mash_kyrielight" })
        {
            Assert.DoesNotContain(owned, summonPool);
            Assert.DoesNotContain(owned, recruitPool);
        }
    }

    [Fact]
    public void 시작무장은_AI_캠페인에도_적용된다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 7);
        Assert.Equal("wu", s.CharacterOwners["sun_quan"]);       // 리더
        Assert.Equal("wu", s.CharacterOwners["taishi_ci"]);      // start_character
    }

    // ═══════════════ 등용 (recruit) ═══════════════

    private static string FirstRecruitable(GameState s, GameDatabase db, GameManager gm, int rarity)
    {
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        return rs.GetRecruitablePool().First(c => c.Rarity == rarity).Id;
    }

    [Fact]
    public void 재야_무장_등용_성공_시_세력에_합류()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 1_000_000;
        s.CharacterOwners["jeanne_darc"] = "joseon";   // 매력 105 사신 — 성공률↑
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        var target = rs.GetRecruitablePool().First(c => c.Rarity == 4).Id;   // 성공률 높은 ★4

        // 결정적 스트림 — 넉넉히 시도하면 사실상 확실히 성공 (~30%/회, 40회)
        RecruitAttempt res = default!;
        for (var i = 0; i < 40; i++)
        {
            joseon.RecruitsThisTurn = 0;   // 캡 리셋(테스트 편의 — 성공 판정에 집중)
            res = rs.TryRecruit("joseon", target, "jeanne_darc");
            if (res.Outcome == RecruitGeneralOutcome.Success) break;
        }
        Assert.Equal(RecruitGeneralOutcome.Success, res.Outcome);
        Assert.Equal("joseon", s.CharacterOwners[target]);
        Assert.DoesNotContain(rs.GetRecruitablePool(), c => c.Id == target);   // 풀 이탈
    }

    [Fact]
    public void 등용은_사신_매력이_높을수록_성공률이_높다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        s.CharacterOwners["jeanne_darc"] = "joseon";   // 매력 105 사신 (테스트 영입)
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        var target = db.Characters[rs.GetRecruitablePool().First(c => c.Rarity == 5).Id];
        var lowCha = rs.ChanceFor(db.Characters["yi_sunsin"], target);      // 매력 88
        var highCha = rs.ChanceFor(db.Characters["jeanne_darc"], target);   // 매력 105
        Assert.True(highCha > lowCha, $"매력 높은 사신 성공률↑: {highCha} vs {lowCha}");
        // 수기: base 3000 + 88×4000/100 − 5×1000 = 3000+3520−5000 = 1520
        Assert.Equal(1520, lowCha);
    }

    [Fact]
    public void 등용_비용은_대상_희귀도에_비례()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        // base 200 + rarity×150 → ★4=800, ★5=950
        Assert.Equal(800, rs.CostFor(db.Characters[rs.GetRecruitablePool().First(c => c.Rarity == 4).Id]));
        Assert.Equal(950, rs.CostFor(db.Characters[rs.GetRecruitablePool().First(c => c.Rarity == 5).Id]));
    }

    [Fact]
    public void 실패해도_비용은_소모된다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 100_000;
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        var target = db.Characters[rs.GetRecruitablePool().First(c => c.Rarity == 5).Id];   // 성공률 낮음
        var before = joseon.Treasury;
        var res = rs.TryRecruit("joseon", target.Id, "yi_sunsin");
        Assert.Equal(before - rs.CostFor(target), joseon.Treasury);   // 성공/실패 무관 비용 소모
    }

    [Fact]
    public void 등용_거부_케이스()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 100_000;
        var rs = new RecruitmentSystem(s, db, gm.Bus);

        Assert.Equal(RecruitGeneralOutcome.UnknownTarget, rs.TryRecruit("joseon", "nobody", "yi_sunsin").Outcome);
        Assert.Equal(RecruitGeneralOutcome.NotRecruitable, rs.TryRecruit("joseon", "cao_cao", "yi_sunsin").Outcome);      // 리더=recruit 채널 없음
        Assert.Equal(RecruitGeneralOutcome.TargetAlreadyOwned, rs.TryRecruit("joseon", "guan_yu", "yi_sunsin").Outcome);  // 촉 시작 무장(recruit 채널이나 이미 소속)
        var target = rs.GetRecruitablePool().First().Id;
        Assert.Equal(RecruitGeneralOutcome.NoEnvoy, rs.TryRecruit("joseon", target, "nobody").Outcome);
        Assert.Equal(RecruitGeneralOutcome.EnvoyBusyOrForeign, rs.TryRecruit("joseon", target, "cao_cao").Outcome);      // 사신이 타세력
    }

    [Fact]
    public void 금_부족이면_거부되고_비용_미소모()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 10;
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        var target = rs.GetRecruitablePool().First().Id;
        Assert.Equal(RecruitGeneralOutcome.InsufficientGold, rs.TryRecruit("joseon", target, "yi_sunsin").Outcome);
        Assert.Equal(10, joseon.Treasury);   // 미소모
    }

    [Fact]
    public void 턴당_등용_시도_캡()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 100_000;
        var rs = new RecruitmentSystem(s, db, gm.Bus);
        var target = rs.GetRecruitablePool().First(c => c.Rarity == 5).Id;   // 잘 실패 → 여러 번 시도
        var cap = db.Rules.RecruitMaxPerTurn;
        for (var i = 0; i < cap; i++) rs.TryRecruit("joseon", target, "yi_sunsin");
        // 실패로 target 이 아직 재야일 때만 캡 검증 의미 — 성공했으면 스킵
        if (!s.CharacterOwners.ContainsKey(target))
            Assert.Equal(RecruitGeneralOutcome.TurnCapExceeded, rs.TryRecruit("joseon", target, "yi_sunsin").Outcome);
    }

    [Fact]
    public void 등용은_결정적이고_세이브스컴_불가()   // §2.8.5 recruit:{faction} 스트림
    {
        var db = Db();
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var (s, gm) = NewGame(db, 4242);
            var joseon = s.Factions.Single(f => f.Id == "joseon");
            joseon.Treasury = 100_000;
            var target = new RecruitmentSystem(s, db, gm.Bus).GetRecruitablePool().First(c => c.Rarity == 5).Id;

            new SaveSystem().Save(s, path);
            var expected = new RecruitmentSystem(s, db, gm.Bus).TryRecruit("joseon", target, "yi_sunsin");

            var loaded = new SaveSystem().Load(path);
            var gm2 = new GameManager(loaded, db);
            var actual = new RecruitmentSystem(loaded, db, gm2.Bus).TryRecruit("joseon", target, "yi_sunsin");

            Assert.Equal(expected.Outcome, actual.Outcome);   // 리로드해도 같은 결과 = 리세마라 불가
            Assert.Equal(expected.RollPermyriad, actual.RollPermyriad);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 세이브_왕복_RecruitsThisTurn_보존()
    {
        var db = Db();
        var (s, _) = NewGame(db);
        s.Factions.Single(f => f.Id == "joseon").RecruitsThisTurn = 2;
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            Assert.Equal(2, loaded.Factions.Single(f => f.Id == "joseon").RecruitsThisTurn);
        }
        finally { File.Delete(path); }
    }

    // ═══════════════ 데이터 검증 (§5.5) ═══════════════

    [Fact]
    public void start_characters_존재하지_않는_캐릭터_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.FactionsFile, n =>
        {
            var joseon = n.AsArray().First(f => (string?)f!["id"] == "joseon");
            joseon!["start_characters"] = new JsonArray("ghost_general");
        });
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Message.Contains("ghost_general"));
    }

    [Fact]
    public void start_characters_중복_소속_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.FactionsFile, n =>
        {
            // 관우(shu 시작 무장)를 wei 에도 넣으면 중복 소속
            var wei = n.AsArray().First(f => (string?)f!["id"] == "wei");
            wei!["start_characters"] = new JsonArray("guo_jia", "guan_yu");
        });
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Message.Contains("guan_yu") && e.Message.Contains("이미"));
    }

    [Fact]
    public void 등용_상수_범위_위반_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["recruit_general"]!["base_chance_permyriad"] = 20000);
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Entry.Contains("base_chance_permyriad"));
    }
}
