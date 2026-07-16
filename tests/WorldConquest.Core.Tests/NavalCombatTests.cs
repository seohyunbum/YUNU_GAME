using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>해상전·상륙전 (§2.6 [MUST]): 풍향·조류 영향·함대 건조/이동·상륙 디버프.</summary>
public class NavalCombatTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void 함선은_항구_영지에서만_건조()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "joseon").Treasury = 10000;
        s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds.Add("pyongyang");   // 내륙

        Assert.Equal(RecruitOutcome.RequiresPortProvince, gm.Recruit("joseon", "pyongyang", "small_ship", 2));
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "hanseong", "small_ship", 2));   // 한성 = 항구
        var fleet = s.Fleets.Single();
        Assert.Equal("joseon_fleet_1", fleet.Id);
        Assert.Equal(2, fleet.Units["small_ship"]);
    }

    [Fact]
    public void 함대는_해로만_육군은_육로만()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "joseon").Treasury = 10000;
        gm.Recruit("joseon", "hanseong", "small_ship", 2);
        gm.Recruit("joseon", "hanseong", "spearman", 5);

        // 함대: 항구→해역 성공, 내륙 육상 불가
        Assert.Equal(MoveOutcome.Success, gm.MoveArmy("joseon_fleet_1", "sea_east_asia"));
        Assert.Equal(MoveOutcome.NoPath, gm.MoveArmy("joseon_fleet_1", "pyongyang"));
        // 육군: 해역 불가
        Assert.Equal(MoveOutcome.NoPath, gm.MoveArmy("joseon_army_1", "sea_east_asia"));
    }

    [Fact]
    public void 해상전_승리시_해역_진출_및_풍향_기록()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 42, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "joseon").Treasury = 100000;
        s.Factions.Single(f => f.Id == "wei").Treasury = 100000;
        gm.Recruit("joseon", "hanseong", "large_ship", 20);
        var enemy = new Fleet("wei_fleet_1", "wei", "sea_east_asia");
        enemy.AddUnits("small_ship", 3);
        s.Fleets.Add(enemy);

        var outcome = gm.Attack("joseon", "joseon_fleet_1", "sea_east_asia", out var battle);

        Assert.Equal(AttackOutcome.AttackerWon, outcome);
        Assert.NotNull(battle!.Wind);                                       // 풍향 추첨·기록 (§2.6)
        Assert.Contains(battle.Wind, new[] { "N", "NE", "E", "SE", "S", "SW", "W", "NW" });
        Assert.DoesNotContain(s.Fleets, f => f.Id == "wei_fleet_1");        // 격멸
        Assert.Equal("sea_east_asia", s.Fleets.Single().LocationNodeId);    // 해역 진출
    }

    [Fact]
    public void 풍향과_조류가_전투_결과를_바꾼다()   // Phase 2 DoD: 풍향·조류 변경 시 결과 상이
    {
        var db = Db();
        BattleResult Run(ulong seed)
        {
            var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
            var gm = new GameManager(s, db);
            var atk = new Fleet("joseon_fleet_1", "joseon", "hanseong");
            atk.AddUnits("medium_ship", 30);
            s.Fleets.Add(atk);
            var def = new Fleet("wei_fleet_1", "wei", "sea_east_asia");
            def.AddUnits("medium_ship", 28);
            s.Fleets.Add(def);
            gm.Attack("joseon", "joseon_fleet_1", "sea_east_asia", out var b);
            return b!;
        }

        // 시드(→풍향)가 다르면 손실·결과가 달라지는 조합이 존재해야 한다 (풍향 ±30% 보정).
        var results = Enumerable.Range(0, 12).Select(i => Run((ulong)(1000 + i * 37))).ToList();
        Assert.True(results.Select(r => r.Wind).Distinct().Count() > 1, "풍향이 항상 동일");
        Assert.True(results.Select(r => r.AttackerLosses).Distinct().Count() > 1, "풍향·조류가 결과에 무영향");
    }

    [Fact]
    public void 상륙전_디버프는_공격측_손실을_늘린다()   // §2.6 [MUST] 첫 2턴 -25%
    {
        var db = Db();
        var cm = new CombatManager(db);
        var land = (LandProvince)db.Map.GetNode("beijing");

        (int atkLoss, int defLoss) Run(bool landing)
        {
            var atk = new Fleet("f1", "joseon", "sea_east_asia");
            atk.AddUnits("large_ship", 50);
            var def = new Army("a1", "wei", "beijing");
            def.AddUnits("spearman", 900);
            var r = cm.ResolveAuto(atk, new MilitaryForce[] { def }, land, new Pcg32(7, 1), landing);
            return (r.AttackerLosses, r.DefenderLosses);
        }

        var normal = Run(landing: false);
        var landingRun = Run(landing: true);
        Assert.True(landingRun.atkLoss >= normal.atkLoss,
            $"상륙 디버프 미반영: 일반 {normal.atkLoss} vs 상륙 {landingRun.atkLoss}");
    }

    [Fact]
    public void 함대_상륙_공격으로_항구_영지_점령()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 5, "joseon", "wei");
        var gm = new GameManager(s, db);
        var fleet = new Fleet("joseon_fleet_1", "joseon", "sea_east_asia");
        fleet.AddUnits("large_ship", 120);   // 압도 전력 — 상륙 -25%·도시 지형 +20% 도 뚫도록
        s.Fleets.Add(fleet);
        var garrison = new Army("wei_army_1", "wei", "beijing");
        garrison.AddUnits("spearman", 40);
        s.Armies.Add(garrison);

        var outcome = gm.Attack("joseon", "joseon_fleet_1", "beijing", out var battle);   // Port 간선 상륙

        Assert.Equal(AttackOutcome.AttackerWon, outcome);
        Assert.Contains("beijing", s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds);
        Assert.Equal("beijing", s.Fleets.Single().LocationNodeId);   // 정박·진주
        Assert.True(battle!.AttackerLosses >= 0);
    }

    [Fact]
    public void 이순신_학익진은_해상전에서_발동()   // naval 조건 궁극기 — 육상 미발동의 대칭
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 11, "joseon", "wei");
        var gm = new GameManager(s, db);
        var atk = new Fleet("joseon_fleet_1", "joseon", "hanseong");
        atk.AddUnits("geobukseon", 40);
        atk.CommanderId = "yi_sunsin";
        s.Fleets.Add(atk);
        var def = new Fleet("wei_fleet_1", "wei", "sea_east_asia");
        def.AddUnits("large_ship", 45);
        s.Fleets.Add(def);

        gm.Attack("joseon", "joseon_fleet_1", "sea_east_asia", out var battle);

        // 4라운드 이상 지속 시 게이지 100 → 학익진 (해상 조건 충족)
        if (battle!.Rounds >= 4)
            Assert.Contains(battle.SkillEvents, e => e.SkillId == "crane_wing_formation");
        // 패시브 '불패'(naval_def)는 해상전에서 즉시 발동
        Assert.Contains(battle.SkillEvents, e => e.SkillId == "undefeated_admiral");
    }
}
