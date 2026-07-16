using System.Text.Json.Nodes;
using WorldConquest.Core.Data;

namespace WorldConquest.Core.Tests;

/// <summary>
/// Phase 0 DoD — 로더 검증 케이스: 깨진 참조·범위 위반이 파일·항목·사유와 함께 검출되는지 (설계문서 §5.5).
/// 실데이터 사본을 변조해 각 위반 유형이 잡히는지 확인한다.
/// </summary>
public class ValidationTests
{
    private static DataValidationException LoadFails(MutableDataDir dir) =>
        Assert.Throws<DataValidationException>(() => new DataLoader().Load(dir.Path));

    private static void AssertError(DataValidationException ex, string file, string entryContains, string messageContains) =>
        Assert.Contains(ex.Errors, e =>
            e.File == file && e.Entry.Contains(entryContains) && e.Message.Contains(messageContains));

    [Fact]
    public void 존재하지_않는_스킬_참조_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!["passive_skill_id"] = "no_such_skill");
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "존재하지 않는 스킬");
    }

    [Fact]
    public void 스탯_범위_위반_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!["stats"]!["nav"] = 130);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "허용 범위");
    }

    [Fact]
    public void 희귀도_범위_위반_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!["rarity"] = 9);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "rarity");
    }

    [Fact]
    public void 필수_필드_누락_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!.AsObject().Remove("name_ko"));
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "필수 필드 누락: name_ko");
    }

    [Fact]
    public void 중복_id_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[1]!["id"] = "yi_sunsin");
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "중복 id");
    }

    [Fact]
    public void 궁극기를_패시브로_참조하면_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!["passive_skill_id"] = "crane_wing_formation");
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "passive 타입이어야 합니다");
    }

    [Fact]
    public void 존재하지_않는_세력_참조_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n => n.AsArray()[0]!["start_faction"] = "rome_empire");
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "start_faction");
    }

    [Fact]
    public void 고유병종_소유자_불일치_검출()
    {
        using var dir = new MutableDataDir();
        // 거북선(unique_to: yi_sunsin)을 관우가 참조하면 오류
        dir.Mutate(DataLoader.CharactersFile, n =>
        {
            var guanYu = n.AsArray().First(c => (string?)c!["id"] == "guan_yu");
            guanYu!["unique_unit_id"] = "geobukseon";
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "guan_yu", "일치하지 않습니다");
    }

    [Fact]
    public void 소환효과의_존재하지_않는_병종_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.SkillsFile, n =>
        {
            var arise = n.AsArray().First(s => (string?)s!["id"] == "arise");
            arise!["effects"]![0]!["unit_id"] = "ghost_legion";
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.SkillsFile, "arise", "존재하지 않는 병종");
    }

    [Fact]
    public void 허용되지_않는_효과타입_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.SkillsFile, n => n.AsArray()[0]!["effects"]![0]!["type"] = "instant_win");
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.SkillsFile, "undefeated_admiral", "허용 목록에 없습니다");
    }

    [Fact]
    public void 궁극기_컷씬_누락_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.SkillsFile, n =>
        {
            var ult = n.AsArray().First(s => (string?)s!["id"] == "excalibur");
            ult!["cutscene_id"] = null;
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.SkillsFile, "excalibur", "cutscene_id");
    }

    [Fact]
    public void 간선없는_인접목록_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            var hanseong = n["nodes"]!.AsArray().First(x => (string?)x!["id"] == "hanseong");
            hanseong!["adjacent"]!.AsArray().Add("sydney");
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "hanseong", "간선이 edges에 없습니다");
    }

    [Fact]
    public void 인접목록에_반영되지_않은_간선_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            var edge = new JsonObject { ["from"] = "paris", ["to"] = "baghdad", ["type"] = "land" };
            n["edges"]!.AsArray().Add(edge);
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "paris", "adjacent에 반영되지 않았습니다");
    }

    [Fact]
    public void 항구없는_영지의_port간선_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            // 내륙 영지 평양에 port 간선을 붙이면 오류 (port=false)
            n["edges"]!.AsArray().Add(new JsonObject
            { ["from"] = "pyongyang", ["to"] = "sea_east_asia", ["type"] = "port" });
            var pyongyang = n["nodes"]!.AsArray().First(x => (string?)x!["id"] == "pyongyang");
            pyongyang!["adjacent"]!.AsArray().Add("sea_east_asia");
            var sea = n["nodes"]!.AsArray().First(x => (string?)x!["id"] == "sea_east_asia");
            sea!["adjacent"]!.AsArray().Add("pyongyang");
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "pyongyang", "port=true");
    }

    [Fact]
    public void 분리된_그래프_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            // 도쿄-태평양 항구 간선을 끊으면 도쿄·교토가 고립된다
            var edges = n["edges"]!.AsArray();
            var idx = edges.Select((e, i) => (e, i))
                .First(x => (string?)x.e!["from"] == "tokyo" && (string?)x.e!["to"] == "sea_pacific").i;
            edges.RemoveAt(idx);
            var nodes = n["nodes"]!.AsArray();
            var tokyo = nodes.First(x => (string?)x!["id"] == "tokyo")!;
            tokyo["port"] = false;
            var adj = tokyo["adjacent"]!.AsArray();
            adj.RemoveAt(adj.Select((a, i) => (a, i)).First(x => (string?)x.a == "sea_pacific").i);
            var sea = nodes.First(x => (string?)x!["id"] == "sea_pacific")!;
            var seaAdj = sea["adjacent"]!.AsArray();
            seaAdj.RemoveAt(seaAdj.Select((a, i) => (a, i)).First(x => (string?)x.a == "tokyo").i);
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "tokyo", "도달 불가");
    }

    [Fact]
    public void 시작영지_중복소유_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.FactionsFile, n =>
        {
            var wei = n.AsArray().First(f => (string?)f!["id"] == "wei");
            wei!["start_provinces"]!.AsArray().Add("hanseong");
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.FactionsFile, "wei", "이미 세력");
    }

    [Fact]
    public void 해상노드의_잘못된_조류방향_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            var sea = n["nodes"]!.AsArray().First(x => (string?)x!["id"] == "sea_pacific");
            sea!["current_direction"] = "NNE";
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "sea_pacific", "8방위");
    }

    [Fact]
    public void 오류는_한번에_모두_보고된다()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.CharactersFile, n =>
        {
            n.AsArray()[0]!["stats"]!["nav"] = 999;
            n.AsArray()[1]!["passive_skill_id"] = "no_such_skill";
        });
        var ex = LoadFails(dir);
        Assert.True(ex.Errors.Count >= 2, "여러 오류를 모아서 한 번에 보고해야 합니다 (조용한 스킵 금지)");
    }
}
