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

    // ── 외교 diplomacy 블록 (외교 설계 §6.1 — DataLoader 3중 훅 중 Need·Check) ──

    [Fact]
    public void 외교_블록_누락_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n.AsObject().Remove("diplomacy"));
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy", "필수 필드 누락");
    }

    [Fact]
    public void 외교_태도_임계값_순서_위반_검출()
    {
        using var dir = new MutableDataDir();
        // friendly(200) > devoted 가 되도록 뒤집기 → nemesis < hostile < 0 < friendly < devoted 파괴
        dir.Mutate(DataLoader.RulesFile, n => n["diplomacy"]!["attitude_thresholds"]!["devoted"] = 100);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy.attitude_thresholds", "순서 필수");
    }

    /// <summary>
    /// §5.5 도달 산술 보호: common_enemy_per_turn 이 0 이면 비동맹 AI 쌍에 걸리는 지속적 양(+) 소스가
    /// 사라져 AI 간 동맹이 영영 성립하지 않는다 — 요구사항 게이트가 데이터만으로 죽는 것을 로더가 막는다.
    /// </summary>
    [Fact]
    public void 외교_공동의적_축적이_0이면_거부()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["diplomacy"]!["common_enemy_per_turn"] = 0);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy.common_enemy_per_turn", "0 초과");
    }

    [Fact]
    public void 외교_전투_우호도_변화가_양수면_거부()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["diplomacy"]!["on_battle_fought"] = 50);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy.on_battle_fought", "음수 필수");
    }

    [Fact]
    public void 외교_계략_확률_만분율_범위_위반_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["diplomacy"]!["scheme"]!["base_success_permyriad"] = 20000);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy.scheme.base_success_permyriad", "만분율");
    }

    /// <summary>성향 델타 키는 valid_ai_dispositions 와 일치해야 한다 — 누락 시 AI 가 조용히 기본값을 쓰게 된다.</summary>
    [Fact]
    public void 외교_성향_델타에_유효성향_누락_검출()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile,
            n => n["diplomacy"]!["ai"]!["disposition_war_favor_delta"]!.AsObject().Remove("aggressive"));
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "diplomacy.ai.disposition_war_favor_delta", "aggressive");
    }

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
    public void 맵좌표_누락_검출()   // 그래픽 클라이언트 배치용 map_pos 는 필수
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            var hanseong = n["nodes"]!.AsArray().First(x => (string?)x!["id"] == "hanseong");
            hanseong!.AsObject().Remove("map_pos");
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "hanseong", "map_pos");
    }

    [Fact]
    public void 맵좌표_중복_검출()   // 두 노드가 같은 좌표 = 렌더 겹침
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.MapFile, n =>
        {
            var nodes = n["nodes"]!.AsArray();
            var busan = nodes.First(x => (string?)x!["id"] == "busan");
            var hanseong = nodes.First(x => (string?)x!["id"] == "hanseong");
            busan!["map_pos"] = new JsonObject
            {
                ["x"] = (int)hanseong!["map_pos"]!["x"]!,
                ["y"] = (int)hanseong["map_pos"]!["y"]!
            };
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "busan", "중복");
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
            // 대상 노드(sydney)의 모든 간선·인접 참조를 제거해 본토에서 완전 고립시킨다.
            // 특정 도시쌍 위상에 의존하지 않으므로 맵이 확장돼도(신규 도시 추가) 안정적으로 도달 불가 성분을 만든다.
            const string target = "sydney";
            var edges = n["edges"]!.AsArray();
            for (var i = edges.Count - 1; i >= 0; i--)
                if ((string?)edges[i]!["from"] == target || (string?)edges[i]!["to"] == target)
                    edges.RemoveAt(i);
            var nodes = n["nodes"]!.AsArray();
            foreach (var node in nodes)
            {
                var adj = node!["adjacent"]?.AsArray();
                if (adj is null) continue;
                for (var i = adj.Count - 1; i >= 0; i--)
                    if ((string?)adj[i] == target) adj.RemoveAt(i);
            }
            var t = nodes.First(x => (string?)x!["id"] == target)!;
            t["adjacent"] = new JsonArray();
            t["port"] = false;   // 항구 간선 제거 후 port 정합
        });
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.MapFile, "sydney", "도달 불가");
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

    [Fact]
    public void 미래_스키마버전_거부()
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["schema_version"] = 999);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "schema_version", "미래 버전 거부");
    }

    [Fact]
    public void 시설_정의_null_이면_크래시없이_검출()   // QA high: facilities 값 null → NRE
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["facilities"]!["port"] = null);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "facilities.port", "null");
    }

    [Fact]
    public void 상성표_행_null_이면_크래시없이_검출()   // QA medium: unit_class_advantage row null → NRE
    {
        using var dir = new MutableDataDir();
        dir.Mutate(DataLoader.RulesFile, n => n["unit_class_advantage"]!["spear"] = null);
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.RulesFile, "unit_class_advantage.spear", "null");
    }

    [Fact]
    public void 결번_id_재사용_거부()
    {
        using var dir = new MutableDataDir();
        // 이순신 id 를 결번 등재한 뒤 데이터에 그대로 두면 재사용으로 검출된다 (§5.5 id 생애주기).
        dir.Mutate(DataLoader.RetiredIdsFile, n => n["retired_ids"]!.AsArray().Add("yi_sunsin"));
        var ex = LoadFails(dir);
        AssertError(ex, DataLoader.CharactersFile, "yi_sunsin", "결번");
    }
}
