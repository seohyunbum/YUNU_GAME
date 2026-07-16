using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

public class CharacterTests
{
    private static Character NewCharacter(
        int ldr = 50, int growthAll = 120, int statMax = 120, int levelCap = 50, int expBase = 100) =>
        new(
            "test_char", "테스트", "history_korea", 3,
            new CharacterStats(ldr, 50, 50, 50, 50, 50),
            new GrowthRates(growthAll, growthAll, growthAll, growthAll, growthAll, growthAll),
            "p", "u", null, "player_selectable", "v", "a",
            statMax, levelCap, expBase);

    [Fact]
    public void 경험치_획득으로_레벨업()
    {
        var c = NewCharacter();
        c.GainExp(100);
        Assert.Equal(2, c.Level);
        Assert.Equal(0, c.Exp);
    }

    [Fact]
    public void 성장률_1_2는_레벨2에서_스탯_1_상승()
    {
        // (2*120)/100 - (1*120)/100 = 2 - 1 = 1  (정수 스케일 ×100)
        var c = NewCharacter(ldr: 50, growthAll: 120);
        c.GainExp(100);
        Assert.Equal(51, c.Stats.Ldr);
    }

    [Fact]
    public void 성장은_결정적이다_같은_경험치는_같은_스탯()
    {
        var a = NewCharacter();
        var b = NewCharacter();
        a.GainExp(700);
        b.GainExp(300);
        b.GainExp(400);
        Assert.Equal(a.Level, b.Level);
        Assert.Equal(a.Stats.Ldr, b.Stats.Ldr);
    }

    [Fact]
    public void 여러_레벨_한번에_상승()
    {
        // 레벨1→2: 100, 레벨2→3: 200 필요
        var c = NewCharacter();
        c.GainExp(300);
        Assert.Equal(3, c.Level);
        Assert.Equal(0, c.Exp);
    }

    [Fact]
    public void 스탯은_상한에서_클램프된다()
    {
        var c = NewCharacter(ldr: 119, growthAll: 300);
        c.GainExp(100);
        Assert.Equal(120, c.Stats.Ldr);
        c.GainExp(200);
        Assert.Equal(120, c.Stats.Ldr);
    }

    [Fact]
    public void 레벨캡_도달_후_경험치_무시()
    {
        var c = NewCharacter(levelCap: 2);
        c.GainExp(100);
        Assert.Equal(2, c.Level);
        c.GainExp(10_000);
        Assert.Equal(2, c.Level);
        Assert.Equal(0, c.Exp);
    }

    [Fact]
    public void 음수_경험치는_예외()
    {
        var c = NewCharacter();
        Assert.Throws<ArgumentOutOfRangeException>(() => c.GainExp(-1));
    }
}

public class FactionTests
{
    private static Faction NewFaction(string id = "joseon") =>
        new(id, "조선", "#1E5AA8", true, "defensive", null, 1000, 800, 1, 100, 100, new[] { "hanseong" });

    [Fact]
    public void 기본_관계는_중립()
    {
        Assert.Equal(DiplomaticState.Neutral, NewFaction().GetRelation("wei"));
    }

    [Fact]
    public void 선전포고()
    {
        var f = NewFaction();
        f.DeclareWar("wei");
        Assert.Equal(DiplomaticState.War, f.GetRelation("wei"));
    }

    [Fact]
    public void 전쟁중_동맹은_불가()
    {
        var f = NewFaction();
        f.DeclareWar("wei");
        Assert.Throws<InvalidOperationException>(() => f.FormAlliance("wei"));
    }

    [Fact]
    public void 종전후_동맹_가능()
    {
        var f = NewFaction();
        f.DeclareWar("wei");
        f.MakePeace("wei");
        f.FormAlliance("wei");
        Assert.Equal(DiplomaticState.Alliance, f.GetRelation("wei"));
    }

    [Fact]
    public void 동맹_배신_선전포고_가능()
    {
        var f = NewFaction();
        f.FormAlliance("wei");
        f.DeclareWar("wei");
        Assert.Equal(DiplomaticState.War, f.GetRelation("wei"));
    }

    [Fact]
    public void 불가침은_중립에서만()
    {
        var f = NewFaction();
        f.SetNonAggression("wei");
        Assert.Equal(DiplomaticState.NonAggression, f.GetRelation("wei"));

        var g = NewFaction();
        g.FormAlliance("wei");
        Assert.Throws<InvalidOperationException>(() => g.SetNonAggression("wei"));
    }

    [Fact]
    public void 자기자신과_외교_불가()
    {
        var f = NewFaction("joseon");
        Assert.Throws<ArgumentException>(() => f.DeclareWar("joseon"));
        Assert.Throws<ArgumentException>(() => f.FormAlliance("joseon"));
    }

    [Fact]
    public void 영지_추가_제거()
    {
        var f = NewFaction();
        f.AddProvince("busan");
        Assert.Equal(new[] { "hanseong", "busan" }, f.OwnedProvinceIds);
        Assert.Throws<InvalidOperationException>(() => f.AddProvince("busan"));
        Assert.True(f.RemoveProvince("busan"));
        Assert.False(f.RemoveProvince("busan"));
    }
}

public class MilitaryForceTests
{
    [Fact]
    public void 병력_추가_누적_및_합계()
    {
        var army = new Army("a1", "joseon", "hanseong");
        army.AddUnits("spearman", 1000);
        army.AddUnits("spearman", 500);
        army.AddUnits("archer", 300);
        Assert.Equal(1500, army.Units["spearman"]);
        Assert.Equal(1800, army.TotalTroops);
    }

    [Fact]
    public void 병력_제거_부족시_예외()
    {
        var army = new Army("a1", "joseon", "hanseong");
        army.AddUnits("spearman", 100);
        army.RemoveUnits("spearman", 40);
        Assert.Equal(60, army.Units["spearman"]);
        Assert.Throws<InvalidOperationException>(() => army.RemoveUnits("spearman", 61));
        army.RemoveUnits("spearman", 60);
        Assert.False(army.Units.ContainsKey("spearman"));
    }

    [Fact]
    public void 사기는_0에서_100으로_클램프()
    {
        var fleet = new Fleet("f1", "joseon", "sea_east_asia");
        fleet.Morale = 150;
        Assert.Equal(100, fleet.Morale);
        fleet.Morale = -30;
        Assert.Equal(0, fleet.Morale);
    }

    [Fact]
    public void 잘못된_병력수는_예외()
    {
        var army = new Army("a1", "joseon", "hanseong");
        Assert.Throws<ArgumentOutOfRangeException>(() => army.AddUnits("spearman", 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => army.RemoveUnits("spearman", -5));
    }
}

public class ProvinceTests
{
    [Fact]
    public void 육상영지_생산은_기본생산량_반환()
    {
        var p = new LandProvince(
            "hanseong", "한성", "east_asia", new[] { "busan" },
            "urban", 180000, new ResourceYield(120, 90), 4, 3, true, "temperate");
        var yield = p.Produce();
        Assert.Equal(120, yield.Gold);
        Assert.Equal(90, yield.Food);
    }
}
