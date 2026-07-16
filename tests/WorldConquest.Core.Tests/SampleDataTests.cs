using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>Phase 0 DoD — 샘플 데이터가 규격(캐릭터 10·영지 12·해역 3·스킬 10+)대로 로드되는지.</summary>
public class SampleDataTests
{
    private static GameDatabase Load() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void 샘플데이터_로드_성공()
    {
        var db = Load();
        Assert.NotNull(db);
    }

    [Fact]
    public void 샘플데이터_규격_수량()
    {
        var db = Load();
        // Phase 0 최소 규격 = 하한(>=). Phase 5 'JSON 만으로 콘텐츠 추가' 시 확장마다 테스트가 깨지지 않도록.
        Assert.True(db.Characters.Count >= 10, $"캐릭터는 10 이상 (현재 {db.Characters.Count})");
        Assert.True(db.Map.LandProvinces.Count() >= 12, $"육상 영지는 12 이상 (현재 {db.Map.LandProvinces.Count()})");
        Assert.True(db.Map.SeaZones.Count() >= 3, $"해역은 3 이상 (현재 {db.Map.SeaZones.Count()})");
        Assert.True(db.Skills.Count >= 10, $"스킬은 10개 이상이어야 합니다 (현재 {db.Skills.Count})");
        Assert.True(db.Factions.Count >= 2, "부자 2인 플레이를 위해 세력은 2개 이상이어야 합니다");
    }

    [Fact]
    public void 이순신_스탯은_설계문서_5_1_예시와_일치()
    {
        // 스펙 §5.1 예시 계약 — 스펙 예시가 바뀔 때만 갱신 (콘텐츠 확장과 무관).
        var c = Load().Characters["yi_sunsin"];
        Assert.Equal("이순신", c.NameKo);
        Assert.Equal(5, c.Rarity);
        Assert.Equal(105, c.Stats.Ldr);
        Assert.Equal(82, c.Stats.Str);
        Assert.Equal(95, c.Stats.Int);
        Assert.Equal(70, c.Stats.Pol);
        Assert.Equal(88, c.Stats.Cha);
        Assert.Equal(120, c.Stats.Nav);
        Assert.Equal("undefeated_admiral", c.PassiveSkillId);
        Assert.Equal("crane_wing_formation", c.UltimateSkillId);
        Assert.Equal("geobukseon", c.UniqueUnitId);
        Assert.Equal("player_selectable", c.StartFaction);
    }

    [Fact]
    public void 학익진은_설계문서_5_2_예시와_일치()
    {
        // 스펙 §5.2 예시 계약 — 스펙 예시가 바뀔 때만 갱신.
        var s = Load().Skills["crane_wing_formation"];
        Assert.Equal("ultimate", s.Type);
        Assert.Equal(100, s.GaugeCost);
        Assert.Equal("cs_crane_wing", s.CutsceneId);
        Assert.Contains(s.Conditions, c => c is { Type: "battle_domain", Value: "naval" });
        Assert.Equal(2, s.Effects.Count);
        var dmg = s.Effects[0];
        Assert.Equal("aoe_damage", dmg.Type);
        Assert.Equal("enemy_front_row", dmg.Target);
        Assert.Equal(250, dmg.Power);
        Assert.Equal("nav", dmg.ScalingStat);
    }

    [Fact]
    public void 모든_캐릭터의_스킬타입이_올바르다()
    {
        var db = Load();
        foreach (var c in db.Characters.Values)
        {
            Assert.Equal("passive", db.Skills[c.PassiveSkillId].Type);
            Assert.Equal("ultimate", db.Skills[c.UltimateSkillId].Type);
        }
    }

    [Fact]
    public void 맵_인접목록과_간선이_양방향_정합()
    {
        var db = Load();
        foreach (var node in db.Map.Nodes.Values)
            foreach (var adj in node.Adjacent)
            {
                Assert.NotNull(db.Map.GetEdgeType(node.Id, adj));
                Assert.Contains(node.Id, db.Map.GetNode(adj).Adjacent);
            }
    }

    [Fact]
    public void 항구영지만_해역과_연결된다()
    {
        var db = Load();
        foreach (var p in db.Map.LandProvinces)
        {
            var portEdges = p.Adjacent.Count(a => db.Map.GetEdgeType(p.Id, a) == EdgeType.Port);
            if (p.Port) Assert.True(portEdges > 0, $"{p.Id}: port=true 인데 항구 간선이 없습니다");
            else Assert.Equal(0, portEdges);
        }
    }

    [Fact]
    public void 세력_시작영지는_겹치지_않는다()
    {
        var db = Load();
        var owned = db.Factions.Values.SelectMany(f => f.OwnedProvinceIds).ToList();
        Assert.Equal(owned.Count, owned.Distinct().Count());
        foreach (var id in owned)
            Assert.IsType<LandProvince>(db.Map.GetNode(id));
    }

    [Fact]
    public void 병종상성_배율_조회()
    {
        var rules = Load().Rules;
        // 정수 스케일 ×100 (150 = ×1.5, 100 = ×1.0)
        Assert.Equal(150, rules.GetClassAdvantage("spear", "cavalry"));
        Assert.Equal(150, rules.GetClassAdvantage("cavalry", "archer"));
        Assert.Equal(150, rules.GetClassAdvantage("archer", "spear"));
        Assert.Equal(100, rules.GetClassAdvantage("cavalry", "spear"));
        Assert.Equal(100, rules.GetClassAdvantage("special", "spear"));
    }

    [Fact]
    public void 고유병종은_소유_캐릭터와_상호일치()
    {
        var db = Load();
        foreach (var c in db.Characters.Values.Where(c => c.UniqueUnitId is not null))
            Assert.Equal(c.Id, db.Units[c.UniqueUnitId!].UniqueTo);
    }
}
