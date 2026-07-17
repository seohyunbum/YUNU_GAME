using System.Text.Json.Nodes;
using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>
/// 내정 시스템 (§2.3) — 태수 스탯 연동(정치→생산·건설, 매력→민심·징병, 지력→기술),
/// 민심·세율·인구·기술·반란. 모든 기대값은 정수 산술(§4.4)로 수기 계산.
/// </summary>
public class InternalAffairsTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm) NewGame(GameDatabase db, ulong seed = 1)
    {
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        return (s, new GameManager(s, db));
    }

    private static ProvinceState Province(GameState s, string id)
    {
        var ps = s.Provinces.FirstOrDefault(p => p.Id == id);
        if (ps is null)
        {
            ps = new ProvinceState { Id = id, Facilities = new() };
            s.Provinces.Add(ps);
        }
        return ps;
    }

    // ═══════════════ 태수 ═══════════════

    [Fact]
    public void 태수_임명_소속검증()
    {
        var db = Db();
        var (_, gm) = NewGame(db);
        var ia = gm.Internal;
        Assert.Equal(GovernorOutcome.Success, ia.AppointGovernor("joseon", "hanseong", "yi_sunsin"));
        Assert.Equal("yi_sunsin", ia.GovernorOf("hanseong")!.Id);
        Assert.Equal(GovernorOutcome.NotYourCharacter, ia.AppointGovernor("joseon", "busan", "cao_cao"));      // 위 소속
        Assert.Equal(GovernorOutcome.UnknownCharacter, ia.AppointGovernor("joseon", "busan", "nobody"));
        Assert.Equal(GovernorOutcome.NotOwnedLandProvince, ia.AppointGovernor("joseon", "beijing", "yi_sunsin"));
        Assert.Equal(GovernorOutcome.AlreadyGovernorElsewhere, ia.AppointGovernor("joseon", "busan", "yi_sunsin"));
        Assert.Equal(GovernorOutcome.Success, ia.AppointGovernor("joseon", "hanseong", "yi_sunsin"));   // 같은 영지 재임명 무해
    }

    [Fact]
    public void 태수_지휘관_겸직_금지_양방향()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var army = new Army("joseon_army_1", "joseon", "hanseong");
        army.AddUnits("spearman", 10);
        s.Armies.Add(army);

        // 지휘관 → 태수 불가
        Assert.Equal(AssignOutcome.Success, gm.AssignCommander("joseon", "joseon_army_1", "yi_sunsin"));
        Assert.Equal(GovernorOutcome.AlreadyCommander, gm.Internal.AppointGovernor("joseon", "hanseong", "yi_sunsin"));

        // 태수 → 지휘관 불가
        army.CommanderId = null;
        Assert.Equal(GovernorOutcome.Success, gm.Internal.AppointGovernor("joseon", "hanseong", "yi_sunsin"));
        Assert.Equal(AssignOutcome.IsGovernor, gm.AssignCommander("joseon", "joseon_army_1", "yi_sunsin"));
    }

    [Fact]
    public void 태수_해임()
    {
        var db = Db();
        var (_, gm) = NewGame(db);
        gm.Internal.AppointGovernor("joseon", "hanseong", "yi_sunsin");
        Assert.Equal(GovernorOutcome.Success, gm.Internal.DismissGovernor("joseon", "hanseong"));
        Assert.Null(gm.Internal.GovernorOf("hanseong"));
        Assert.Equal(GovernorOutcome.NoGovernor, gm.Internal.DismissGovernor("joseon", "hanseong"));
    }

    [Fact]
    public void 태수_정치력이_생산을_올린다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        gm.Internal.AppointGovernor("joseon", "hanseong", "yi_sunsin");   // 정치 70

        var p = gm.Internal.PreviewIncome("hanseong");
        Assert.Equal(10, p.GovernorGoldPct);   // 70 × 15 / 100 = 10 (내림)
        Assert.Equal(7, p.GovernorFoodPct);    // 70 × 10 / 100 = 7
        Assert.Equal(132, p.FinalGold);        // 120 × 110% = 132 (민심 70→100%·세율 100%)
        Assert.Equal(96, p.FinalFood);         // 90 × 107% = 96 (내림)

        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var g0 = joseon.Treasury; var f0 = joseon.Food;
        gm.CollectIncome();
        Assert.Equal(g0 + 132 + 100, joseon.Treasury);   // 한성 132 + 부산 100
        Assert.Equal(f0 + 96 + 70, joseon.Food);
    }

    [Fact]
    public void 태수_정치력이_건설비를_할인한다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        s.CharacterOwners["cao_cao"] = "joseon";   // 정치 96 — 테스트용 영입
        gm.Internal.AppointGovernor("joseon", "hanseong", "cao_cao");

        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 1000;
        Assert.Equal(FacilityOutcome.Success, gm.BuildFacility("joseon", "hanseong", "market"));
        // 96 × 20 / 100 = 19% 할인 (상한 30% 미만) → 300 × 81% = 243
        Assert.Equal(1000 - 243, joseon.Treasury);
        Assert.Equal(1, s.Provinces.Single(p => p.Id == "hanseong").Facilities["market"]);
    }

    // ═══════════════ 징병 (§2.3 병력 = 인구에서 징병) ═══════════════

    [Fact]
    public void 징병은_인구를_소모하고_부족하면_거부()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        s.Factions.Single(f => f.Id == "joseon").Treasury = 100_000;

        Assert.Equal(180_000, gm.Internal.GetPopulation("hanseong"));
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "hanseong", "spearman", 1000));
        Assert.Equal(179_000, gm.Internal.GetPopulation("hanseong"));
        Assert.Equal(RecruitOutcome.InsufficientPopulation, gm.Recruit("joseon", "hanseong", "spearman", 200_000));
    }

    [Fact]
    public void 징병_기술_게이트()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        Assert.Equal(RecruitOutcome.TechLevelTooLow, gm.Recruit("joseon", "busan", "geobukseon", 1));   // tech 3 > Lv1
        joseon.TechLevel = 3;
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "busan", "geobukseon", 1));
    }

    [Fact]
    public void 징병은_민심을_떨어뜨린다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        s.Factions.Single(f => f.Id == "joseon").Treasury = 100_000;
        gm.Recruit("joseon", "hanseong", "spearman", 1000);
        Assert.Equal(68, gm.Internal.GetPublicOrder("hanseong"));   // 70 − (1000 × 2 / 1000)
    }

    [Fact]
    public void 징병_할인_병영과_태수_매력_합산()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        Province(s, "hanseong").Facilities["barracks"] = 3;         // 3 × 5 = 15%
        s.CharacterOwners["jeanne_darc"] = "joseon";                // 매력 105 → 15%
        gm.Internal.AppointGovernor("joseon", "hanseong", "jeanne_darc");
        Assert.Equal(30, gm.Internal.RecruitDiscountPct("hanseong"));

        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 100_000;
        gm.Recruit("joseon", "hanseong", "spearman", 1000);         // 50,000 × 70% = 35,000
        Assert.Equal(100_000 - 35_000, joseon.Treasury);
    }

    [Fact]
    public void 그림자병사는_인구를_소모하지_않는다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 100_000;
        joseon.TechLevel = 3;
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "hanseong", "shadow_soldiers", 100));
        Assert.Equal(180_000, gm.Internal.GetPopulation("hanseong"));   // pop_cost 0
        Assert.Equal(70, gm.Internal.GetPublicOrder("hanseong"));       // 민심 타격도 없음
    }

    // ═══════════════ 세율 ═══════════════

    [Fact]
    public void 세율은_금수입_배율과_민심_드리프트를_바꾼다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        Assert.Equal(TaxOutcome.UnknownTaxLevel, gm.Internal.SetTaxLevel("joseon", "confiscatory"));
        Assert.Equal(TaxOutcome.Success, gm.Internal.SetTaxLevel("joseon", "high"));

        var p = gm.Internal.PreviewIncome("hanseong");
        Assert.Equal(130, p.TaxGoldPct);
        Assert.Equal(156, p.FinalGold);   // 120 × 130%
        Assert.Equal(90, p.FinalFood);    // 식량은 세율 무관

        gm.CollectIncome();
        Assert.Equal(65, gm.Internal.GetPublicOrder("hanseong"));   // 70 − 5 (고세율 드리프트)

        gm.Internal.SetTaxLevel("joseon", "low");
        gm.CollectIncome();
        Assert.Equal(68, gm.Internal.GetPublicOrder("hanseong"));   // 65 + 3 (저세율 회복)
        // 민심 68 → 승수 99% (65+34): 120 × 99% = 118 → × 70% = 82
        Assert.Equal(82, gm.Internal.PreviewIncome("hanseong").FinalGold);
    }

    // ═══════════════ 민심 ═══════════════

    [Fact]
    public void 민심이_낮으면_생산이_줄어든다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        Province(s, "hanseong").PublicOrder = 20;
        var p = gm.Internal.PreviewIncome("hanseong");
        Assert.Equal(75, p.PoOutputPct);   // 65 + 20 × 50 / 100
        Assert.Equal(90, p.FinalGold);     // 120 × 75%
        Assert.Equal(67, p.FinalFood);     // 90 × 75% = 67 (내림)
    }

    [Fact]
    public void 태수_매력이_민심을_회복시키고_100에서_클램프()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        s.CharacterOwners["jeanne_darc"] = "joseon";   // 매력 105 → +5/턴
        gm.Internal.AppointGovernor("joseon", "hanseong", "jeanne_darc");

        Province(s, "hanseong").PublicOrder = 40;
        gm.CollectIncome();
        Assert.Equal(45, gm.Internal.GetPublicOrder("hanseong"));

        Province(s, "hanseong").PublicOrder = 98;
        gm.CollectIncome();
        Assert.Equal(100, gm.Internal.GetPublicOrder("hanseong"));   // 98+5 → 100 클램프
    }

    [Fact]
    public void 민심_임계_미만이면_결정적으로_반란이_난다()
    {
        var db = Db();
        var (s, gm) = NewGame(db, seed: 7);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        gm.Internal.AppointGovernor("joseon", "busan", "yi_sunsin");
        Province(s, "busan").PublicOrder = 5;   // 임계(20) 미만 — 태수 회복(+4)로도 못 벗어남? 5+4=9 <20 ✓ 단 수턴 내 발생 기대
        Province(s, "busan").GovernorId = null; // 회복 차단 — 순수 반란 경로 검증
        var rebelled = new List<GameEvent>();
        gm.Bus.Subscribe(e => { if (e.Type == "ProvinceRebelled") rebelled.Add(e); });

        for (var i = 0; i < 60 && joseon.OwnedProvinceIds.Contains("busan"); i++)
            gm.CollectIncome();   // 25%/턴 — 60턴 내 미발생 확률 사실상 0 (시드 고정이라 결정적)

        Assert.DoesNotContain("busan", joseon.OwnedProvinceIds);
        Assert.DoesNotContain(s.Factions, f => f.OwnedProvinceIds.Contains("busan"));   // 중립 독립
        Assert.Equal(50, gm.Internal.GetPublicOrder("busan"));                          // po_after_rebellion
        Assert.Contains(rebelled, e => e.Get("province") == "busan" && e.Get("from") == "joseon");
    }

    [Fact]
    public void 민심_임계_이상이면_반란_없음()
    {
        var db = Db();
        var (s, gm) = NewGame(db, seed: 7);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        Province(s, "busan").PublicOrder = 20;   // 임계와 같음 = 안전 (미만만 판정)
        for (var i = 0; i < 60; i++) gm.CollectIncome();
        Assert.Contains("busan", joseon.OwnedProvinceIds);
    }

    [Fact]
    public void 점령_민심_전이_무혈60_전투40_태수해임()
    {
        var db = Db();
        var (s, gm) = NewGame(db);

        // 무혈 점령 → 60
        Assert.Equal(CaptureOutcome.Success, gm.TryCapture("joseon", "pyongyang"));
        Assert.Equal(60, gm.Internal.GetPublicOrder("pyongyang"));

        // 전투 점령 (무저항 함락) → 40 + 구세력 태수 해임
        gm.Internal.AppointGovernor("wei", "beijing", "cao_cao");
        var army = new Army("joseon_army_1", "joseon", "pyongyang");
        army.AddUnits("spearman", 1000);
        s.Armies.Add(army);
        Assert.Equal(AttackOutcome.AttackerWon, gm.Attack("joseon", "joseon_army_1", "beijing", out _));
        Assert.Equal(40, gm.Internal.GetPublicOrder("beijing"));
        Assert.Null(gm.Internal.GovernorOf("beijing"));
    }

    // ═══════════════ 인구 성장 ═══════════════

    [Fact]
    public void 인구는_민심에_비례해_성장하고_상한이_있다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        gm.CollectIncome();
        // 180,000 × 100(만분율) × 70(민심) / 100 / 10000 = 1,260
        Assert.Equal(181_260, gm.Internal.GetPopulation("hanseong"));

        Province(s, "hanseong").Population = 270_000;   // 상한 = 180,000 × 150%
        gm.CollectIncome();
        Assert.Equal(270_000, gm.Internal.GetPopulation("hanseong"));
    }

    // ═══════════════ 기술 (학당 + 태수 지력) ═══════════════

    [Fact]
    public void 학당과_태수_지력이_기술을_올린다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        Province(s, "hanseong").Facilities["academy"] = 3;   // 3 × 30 = 90/턴
        s.CharacterOwners["iron_man"] = "joseon";            // 지력 110 → 11/턴
        gm.Internal.AppointGovernor("joseon", "hanseong", "iron_man");
        var events = new List<GameEvent>();
        gm.Bus.Subscribe(e => { if (e.Type == "TechLevelUp") events.Add(e); });

        gm.CollectIncome();   // +101
        Assert.Equal(1, joseon.TechLevel);
        Assert.Equal(101, joseon.TechPoints);
        gm.CollectIncome();   // 202 ≥ 200 (Lv1→2 비용) → 레벨업, 잔여 2
        Assert.Equal(2, joseon.TechLevel);
        Assert.Equal(2, joseon.TechPoints);
        Assert.Contains(events, e => e.Get("faction") == "joseon" && e.Get("level") == "2");
    }

    [Fact]
    public void 기술_레벨캡에서_멈춘다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.TechLevel = 5;   // tech_level_cap
        Province(s, "hanseong").Facilities["academy"] = 3;
        for (var i = 0; i < 20; i++) gm.CollectIncome();
        Assert.Equal(5, joseon.TechLevel);
    }

    // ═══════════════ 성벽 (전투 방어 배선 §2.6) ═══════════════

    [Fact]
    public void 성벽은_수비_피해를_줄인다()
    {
        var db = Db();
        var land = (LandProvince)db.Map.GetNode("pyongyang");   // 평지 — 지형 보정 0
        var cm = new CombatManager(db);

        BattleResult Fight(int wallPct)
        {
            var atk = new Army("a", "joseon", "hanseong"); atk.AddUnits("spearman", 1000);
            var def = new Army("d", "wei", "pyongyang"); def.AddUnits("spearman", 1000);
            return cm.ResolveAuto(atk, new MilitaryForce[] { def }, land, new Pcg32(7, 1), false, wallPct);
        }

        var without = Fight(0);
        var with30 = Fight(30);   // walls Lv3 = 30%
        Assert.True(with30.DefenderLosses < without.DefenderLosses,
            $"성벽 30% 적용 시 수비 손실이 줄어야 함: {with30.DefenderLosses} vs {without.DefenderLosses}");
    }

    [Fact]
    public void 성벽_레벨은_수비보정으로_합산된다()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        Province(s, "hanseong").Facilities["walls"] = 2;
        Assert.Equal(20, gm.Internal.DefenseBonusPct("hanseong"));
    }

    // ═══════════════ AI 내정 ═══════════════

    [Fact]
    public void AI는_태수를_파견하고_시설을_짓는다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 7);
        var gm = new GameManager(s, db);
        gm.CollectIncome();
        new AIController(s, db, gm).RunAll();

        // AI 는 살아남은 영지에 소속 무장을 태수로 파견한다 (여러 세력이 최소 1명 이상 배치)
        var appointed = s.Provinces.Count(p => p.GovernorId is not null);
        Assert.True(appointed >= 1, "AI 가 태수를 1명 이상 파견해야 함");
        // 파견된 태수는 그 영지 소유 세력의 소속 무장이어야 한다 (소속 검증 §2.8)
        foreach (var p in s.Provinces.Where(p => p.GovernorId is not null))
        {
            var owner = s.Factions.First(f => f.OwnedProvinceIds.Contains(p.Id));
            Assert.Equal(owner.Id, s.CharacterOwners[p.GovernorId!]);
        }
        // 여유 자금(≥ 비용×3) 세력은 시장부터 건설
        Assert.True(s.Provinces.Any(p => p.Facilities.GetValueOrDefault("market") >= 1),
            "AI가 시설을 1건 이상 건설해야 함");
    }

    // ═══════════════ 세이브 (additive 왕복·fail-soft) ═══════════════

    [Fact]
    public void 세이브_왕복_내정_필드_보존()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.TaxLevel = "high";
        joseon.TechPoints = 77;
        gm.Internal.AppointGovernor("joseon", "hanseong", "yi_sunsin");
        var ps = Province(s, "hanseong");
        ps.PublicOrder = 55;
        ps.Population = 123_456;

        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", $"ia_{Guid.NewGuid():N}.json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            var lj = loaded.Factions.Single(f => f.Id == "joseon");
            Assert.Equal("high", lj.TaxLevel);
            Assert.Equal(77, lj.TechPoints);
            var lp = loaded.Provinces.Single(p => p.Id == "hanseong");
            Assert.Equal(55, lp.PublicOrder);
            Assert.Equal(123_456, lp.Population);
            Assert.Equal("yi_sunsin", lp.GovernorId);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 구세이브는_내정_기본값으로_로드된다()
    {
        var db = Db();
        var json = """
        {
          "save_version": 1,
          "campaign_seed": "0000000000000001",
          "turn": 3,
          "phase": "income",
          "actor": "joseon",
          "factions": [{
            "id": "joseon", "controller": "human_p1", "treasury": 500, "food": 400,
            "tech_level": 1, "owned_province_ids": ["hanseong"], "relations": {}
          }],
          "provinces": [{ "id": "hanseong", "facilities": { "market": 2 } }]
        }
        """;
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", $"old_{Guid.NewGuid():N}.json");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        try
        {
            File.WriteAllText(path, json);
            var loaded = new SaveSystem().Load(path);
            var f = loaded.Factions.Single();
            Assert.Equal("", f.TaxLevel);
            Assert.Equal(0, f.TechPoints);
            var p = loaded.Provinces.Single();
            Assert.Null(p.PublicOrder);
            Assert.Null(p.Population);
            Assert.Null(p.GovernorId);

            // 기본값 해석: 민심 po_initial, 인구는 정의값, 세율은 기본 단계
            var ia = new InternalAffairsManager(loaded, db);
            Assert.Equal(70, ia.GetPublicOrder("hanseong"));
            Assert.Equal(180_000, ia.GetPopulation("hanseong"));
            Assert.Equal(100, ia.TaxOf(f).GoldPct);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 삭제된_태수와_미인식_세율은_failsoft_프루닝()
    {
        var db = Db();
        var (s, gm) = NewGame(db);
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", $"prune_{Guid.NewGuid():N}.json");
        try
        {
            new SaveSystem().Save(s, path);
            var node = JsonNode.Parse(File.ReadAllText(path))!;
            node["factions"]![0]!["tax_level"] = "weird_tax";
            node["provinces"] = new JsonArray(new JsonObject
            {
                ["id"] = "hanseong",
                ["facilities"] = new JsonObject(),
                ["governor_id"] = "ghost_char"
            });
            File.WriteAllText(path, node.ToJsonString());

            var result = new SaveSystem().Load(path, db);
            Assert.Contains(result.Skipped, x => x.Contains("governor:ghost_char"));
            Assert.Contains(result.Skipped, x => x.Contains("tax_level:weird_tax"));
            Assert.Null(result.State.Provinces.Single(p => p.Id == "hanseong").GovernorId);
            Assert.Equal("", result.State.Factions.First(f => f.Id == node["factions"]![0]!["id"]!.GetValue<string>()).TaxLevel);
        }
        finally { File.Delete(path); }
    }

    // ═══════════════ 데이터 검증 (§5.5) ═══════════════

    [Fact]
    public void 병종_pop_cost_누락_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.LandUnitsFile, n => n.AsArray()[0]!.AsObject().Remove("pop_cost"));
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Message.Contains("pop_cost"));
    }

    [Fact]
    public void 기본_세율이_tax_levels에_없으면_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["internal_affairs"]!["default_tax_level"] = "confiscatory");
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Entry.Contains("default_tax_level"));
    }

    [Fact]
    public void 민심_계수_범위_위반_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["internal_affairs"]!["po_initial"] = 150);
        var ex = Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));
        Assert.Contains(ex.Errors, e => e.Entry.Contains("po_initial"));
    }
}
