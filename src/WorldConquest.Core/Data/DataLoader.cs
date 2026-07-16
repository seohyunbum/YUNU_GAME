using System.Text.Json;
using System.Text.RegularExpressions;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// data/ 폴더의 JSON을 로드·검증해 GameDatabase를 만든다 (설계문서 §4.2, §5.5).
/// 검증 실패는 조용히 스킵하지 않고 전 건을 모아 DataValidationException으로 기동을 실패시킨다 [MUST].
/// </summary>
public sealed class DataLoader
{
    public const string RulesFile = "config/game_rules.json";
    public const string TerrainFile = "terrain/terrain_modifiers.json";
    public const string LandUnitsFile = "units/land_units.json";
    public const string NavalUnitsFile = "units/naval_units.json";
    public const string SkillsFile = "skills/skills.json";
    public const string CharactersFile = "characters/characters.json";
    public const string MapFile = "map/world_map.json";
    public const string FactionsFile = "factions/factions.json";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    private static readonly Regex ColorRegex = new("^#[0-9A-Fa-f]{6}$", RegexOptions.Compiled);

    public GameDatabase Load(string dataDir)
    {
        var errors = new List<ValidationError>();

        // 1) 전역 상수 — 이후 모든 검증의 기준이므로 단독으로 먼저 확정한다.
        var rulesDto = ReadFile<GameRulesDto>(dataDir, RulesFile, errors);
        var rules = rulesDto is null ? null : BuildRules(rulesDto, errors);
        if (rules is null) throw new DataValidationException(errors);

        // 2) 나머지 파일 로드 (파싱 실패는 오류 수집 후 빈 목록으로 진행 — 오류를 최대한 모아서 보고).
        var terrainDtos = ReadFile<List<TerrainModifierDto>>(dataDir, TerrainFile, errors) ?? new();
        var landUnitDtos = ReadFile<List<UnitTypeDto>>(dataDir, LandUnitsFile, errors) ?? new();
        var navalUnitDtos = ReadFile<List<UnitTypeDto>>(dataDir, NavalUnitsFile, errors) ?? new();
        var skillDtos = ReadFile<List<SkillDto>>(dataDir, SkillsFile, errors) ?? new();
        var charDtos = ReadFile<List<CharacterDto>>(dataDir, CharactersFile, errors) ?? new();
        var mapDto = ReadFile<WorldMapDto>(dataDir, MapFile, errors) ?? new WorldMapDto();
        var factionDtos = ReadFile<List<FactionDto>>(dataDir, FactionsFile, errors) ?? new();

        // 3) 참조 무결성 검증용 id 집합 (캐릭터↔세력, 스킬↔병종이 상호 참조하므로 id 먼저 수집).
        var unitDtos = landUnitDtos.Select(u => (Dto: u, File: LandUnitsFile))
            .Concat(navalUnitDtos.Select(u => (Dto: u, File: NavalUnitsFile)))
            .ToList();
        var unitIds = CollectIds(unitDtos.Select(u => u.Dto.Id));
        var skillIds = CollectIds(skillDtos.Select(s => s.Id));
        var charIds = CollectIds(charDtos.Select(c => c.Id));
        var factionIds = CollectIds(factionDtos.Select(f => f.Id));
        var nodeDtos = mapDto.Nodes ?? new();
        var nodeIds = CollectIds(nodeDtos.Select(n => n.Id));
        var skillById = skillDtos.Where(s => !string.IsNullOrWhiteSpace(s.Id))
            .GroupBy(s => s.Id!).ToDictionary(g => g.Key, g => g.First());
        var unitById = unitDtos.Where(u => !string.IsNullOrWhiteSpace(u.Dto.Id))
            .GroupBy(u => u.Dto.Id!).ToDictionary(g => g.Key, g => g.First().Dto);
        var nodeById = nodeDtos.Where(n => !string.IsNullOrWhiteSpace(n.Id))
            .GroupBy(n => n.Id!).ToDictionary(g => g.Key, g => g.First());

        // 4) 파일별 검증
        ValidateTerrain(terrainDtos, rules, errors);
        ValidateUnits(unitDtos, charIds, rules, errors);
        ValidateSkills(skillDtos, unitIds, rules, errors);
        ValidateCharacters(charDtos, skillById, unitById, factionIds, rules, errors);
        ValidateMap(nodeDtos, mapDto.Edges ?? new(), nodeById, rules, errors);
        ValidateFactions(factionDtos, charIds, nodeById, errors);
        ValidateFactionDispositions(factionDtos, rules, errors);

        if (errors.Count > 0) throw new DataValidationException(errors);

        // 5) 검증 통과 → 도메인 객체 조립
        return Build(rules, terrainDtos, unitDtos.Select(u => u.Dto).ToList(),
            skillDtos, charDtos, nodeDtos, mapDto.Edges!, factionDtos);
    }

    // ---------- 파일 읽기 ----------

    private static T? ReadFile<T>(string dataDir, string relPath, List<ValidationError> errors) where T : class
    {
        var full = Path.Combine(dataDir, relPath);
        if (!File.Exists(full))
        {
            errors.Add(new ValidationError(relPath, "-", "파일이 존재하지 않습니다."));
            return null;
        }
        try
        {
            using var stream = File.OpenRead(full);
            var result = JsonSerializer.Deserialize<T>(stream, JsonOpts);
            if (result is null)
                errors.Add(new ValidationError(relPath, "-", "JSON 내용이 비어 있습니다."));
            return result;
        }
        catch (JsonException ex)
        {
            errors.Add(new ValidationError(relPath, "-", $"JSON 파싱 실패: {ex.Message}"));
            return null;
        }
    }

    private static HashSet<string> CollectIds(IEnumerable<string?> ids) =>
        ids.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id!).ToHashSet();

    // ---------- 전역 상수 ----------

    private static GameRules? BuildRules(GameRulesDto dto, List<ValidationError> errors)
    {
        var missing = new List<string>();
        void Need(object? v, string name) { if (v is null) missing.Add(name); }

        Need(dto.StatMin, "stat_min"); Need(dto.StatMax, "stat_max");
        Need(dto.RarityMin, "rarity_min"); Need(dto.RarityMax, "rarity_max");
        Need(dto.LevelCap, "level_cap"); Need(dto.ExpCurveBase, "exp_curve_base");
        Need(dto.LoyaltyMin, "loyalty_min"); Need(dto.LoyaltyMax, "loyalty_max");
        Need(dto.MoraleMax, "morale_max");
        Need(dto.GrowthRateMin, "growth_rate_min"); Need(dto.GrowthRateMax, "growth_rate_max");
        Need(dto.UltimateGaugeMax, "ultimate_gauge_max");
        Need(dto.GaugeChargeOnAttack, "gauge_charge_on_attack");
        Need(dto.GaugeChargeOnDamaged, "gauge_charge_on_damaged");
        Need(dto.LandingAttackModifier, "landing_attack_modifier");
        Need(dto.LandingDebuffTurns, "landing_debuff_turns");
        Need(dto.AllianceTransferCapPerTurn, "alliance_transfer_cap_per_turn");
        Need(dto.BaseTaxRate, "base_tax_rate");
        Need(dto.UnitClassAdvantage, "unit_class_advantage");
        Need(dto.ValidTerrains, "valid_terrains"); Need(dto.ValidClimates, "valid_climates");
        Need(dto.ValidRegions, "valid_regions"); Need(dto.ValidOrigins, "valid_origins");
        Need(dto.ValidEffectTypes, "valid_effect_types"); Need(dto.ValidSkillTargets, "valid_skill_targets");
        Need(dto.ValidBuffStats, "valid_buff_stats"); Need(dto.ValidConditionTypes, "valid_condition_types");
        Need(dto.ValidBattleDomains, "valid_battle_domains"); Need(dto.ValidScalingStats, "valid_scaling_stats");
        Need(dto.ValidUnitClassesLand, "valid_unit_classes_land"); Need(dto.ValidUnitClassesNaval, "valid_unit_classes_naval");
        Need(dto.ValidAiDispositions, "valid_ai_dispositions"); Need(dto.ValidCurrentDirections, "valid_current_directions");

        foreach (var name in missing)
            errors.Add(new ValidationError(RulesFile, name, "필수 필드 누락"));
        if (missing.Count > 0) return null;

        void Check(bool ok, string entry, string message)
        { if (!ok) errors.Add(new ValidationError(RulesFile, entry, message)); }

        Check(dto.StatMin!.Value >= 1 && dto.StatMin.Value <= dto.StatMax!.Value, "stat_min/stat_max", "1 <= stat_min <= stat_max 이어야 합니다.");
        Check(dto.RarityMin!.Value >= 1 && dto.RarityMin.Value <= dto.RarityMax!.Value, "rarity_min/rarity_max", "1 <= rarity_min <= rarity_max 이어야 합니다.");
        Check(dto.LevelCap!.Value >= 1, "level_cap", "1 이상이어야 합니다.");
        Check(dto.ExpCurveBase!.Value >= 1, "exp_curve_base", "1 이상이어야 합니다.");
        Check(dto.GrowthRateMin!.Value >= 0 && dto.GrowthRateMin.Value <= dto.GrowthRateMax!.Value, "growth_rate_min/max", "0 <= min <= max 이어야 합니다.");
        Check(dto.LandingAttackModifier!.Value is >= -100 and <= 0, "landing_attack_modifier", "-100 ~ 0 범위여야 합니다 (정수 스케일 ×100).");
        Check(dto.LandingDebuffTurns!.Value >= 0, "landing_debuff_turns", "0 이상이어야 합니다.");
        Check(dto.UltimateGaugeMax!.Value >= 1, "ultimate_gauge_max", "1 이상이어야 합니다.");
        Check(dto.AllianceTransferCapPerTurn!.Gold is >= 0 && dto.AllianceTransferCapPerTurn.Food is >= 0,
            "alliance_transfer_cap_per_turn", "gold/food는 0 이상 필수입니다.");
        Check(dto.BaseTaxRate!.Value is >= 0 and <= 100, "base_tax_rate", "0 ~ 100 범위여야 합니다 (정수 스케일 ×100).");
        foreach (var (atk, row) in dto.UnitClassAdvantage!)
            foreach (var (def, mult) in row)
                Check(mult > 0, "unit_class_advantage", $"{atk}->{def} 배율은 0보다 커야 합니다.");
        foreach (var (list, name) in new (List<string>?, string)[]
                 {
                     (dto.ValidTerrains, "valid_terrains"), (dto.ValidClimates, "valid_climates"),
                     (dto.ValidRegions, "valid_regions"), (dto.ValidOrigins, "valid_origins"),
                     (dto.ValidEffectTypes, "valid_effect_types"), (dto.ValidSkillTargets, "valid_skill_targets"),
                     (dto.ValidBuffStats, "valid_buff_stats"), (dto.ValidConditionTypes, "valid_condition_types"),
                     (dto.ValidBattleDomains, "valid_battle_domains"), (dto.ValidScalingStats, "valid_scaling_stats"),
                     (dto.ValidUnitClassesLand, "valid_unit_classes_land"), (dto.ValidUnitClassesNaval, "valid_unit_classes_naval"),
                     (dto.ValidAiDispositions, "valid_ai_dispositions"), (dto.ValidCurrentDirections, "valid_current_directions")
                 })
            Check(list!.Count > 0, name, "목록이 비어 있습니다.");

        return new GameRules
        {
            StatMin = dto.StatMin.Value,
            StatMax = dto.StatMax!.Value,
            RarityMin = dto.RarityMin.Value,
            RarityMax = dto.RarityMax!.Value,
            LevelCap = dto.LevelCap.Value,
            ExpCurveBase = dto.ExpCurveBase.Value,
            LoyaltyMin = dto.LoyaltyMin!.Value,
            LoyaltyMax = dto.LoyaltyMax!.Value,
            MoraleMax = dto.MoraleMax!.Value,
            GrowthRateMin = dto.GrowthRateMin.Value,
            GrowthRateMax = dto.GrowthRateMax!.Value,
            UltimateGaugeMax = dto.UltimateGaugeMax.Value,
            GaugeChargeOnAttack = dto.GaugeChargeOnAttack!.Value,
            GaugeChargeOnDamaged = dto.GaugeChargeOnDamaged!.Value,
            LandingAttackModifier = dto.LandingAttackModifier.Value,
            LandingDebuffTurns = dto.LandingDebuffTurns.Value,
            AllianceTransferCapPerTurn = new ResourceYield(
                dto.AllianceTransferCapPerTurn.Gold!.Value, dto.AllianceTransferCapPerTurn.Food!.Value),
            BaseTaxRate = dto.BaseTaxRate.Value,
            UnitClassAdvantage = dto.UnitClassAdvantage.ToDictionary(
                kv => kv.Key, kv => (IReadOnlyDictionary<string, int>)kv.Value),
            ValidTerrains = dto.ValidTerrains!.ToHashSet(),
            ValidClimates = dto.ValidClimates!.ToHashSet(),
            ValidRegions = dto.ValidRegions!.ToHashSet(),
            ValidOrigins = dto.ValidOrigins!.ToHashSet(),
            ValidEffectTypes = dto.ValidEffectTypes!.ToHashSet(),
            ValidSkillTargets = dto.ValidSkillTargets!.ToHashSet(),
            ValidBuffStats = dto.ValidBuffStats!.ToHashSet(),
            ValidConditionTypes = dto.ValidConditionTypes!.ToHashSet(),
            ValidBattleDomains = dto.ValidBattleDomains!.ToHashSet(),
            ValidScalingStats = dto.ValidScalingStats!.ToHashSet(),
            ValidUnitClassesLand = dto.ValidUnitClassesLand!.ToHashSet(),
            ValidUnitClassesNaval = dto.ValidUnitClassesNaval!.ToHashSet(),
            ValidAiDispositions = dto.ValidAiDispositions!.ToHashSet(),
            ValidCurrentDirections = dto.ValidCurrentDirections!.ToHashSet()
        };
    }

    // ---------- 지형 ----------

    private static void ValidateTerrain(List<TerrainModifierDto> dtos, GameRules rules, List<ValidationError> errors)
    {
        var seen = new HashSet<string>();
        for (var i = 0; i < dtos.Count; i++)
        {
            var t = dtos[i];
            var entry = t.Id ?? $"index {i}";
            if (string.IsNullOrWhiteSpace(t.Id)) { errors.Add(new(TerrainFile, entry, "필수 필드 누락: id")); continue; }
            if (!seen.Add(t.Id)) errors.Add(new(TerrainFile, entry, "중복 id"));
            if (string.IsNullOrWhiteSpace(t.NameKo)) errors.Add(new(TerrainFile, entry, "필수 필드 누락: name_ko"));
            if (t.AtkMod is null || t.AtkMod is < -100 or > 100) errors.Add(new(TerrainFile, entry, "atk_mod는 -100 ~ 100 범위 필수입니다 (정수 스케일 ×100)."));
            if (t.DefMod is null || t.DefMod is < -100 or > 100) errors.Add(new(TerrainFile, entry, "def_mod는 -100 ~ 100 범위 필수입니다 (정수 스케일 ×100)."));
            if (t.MoveCost is null or < 1) errors.Add(new(TerrainFile, entry, "move_cost는 1 이상 필수입니다."));
        }
        foreach (var required in rules.ValidTerrains)
            if (!seen.Contains(required))
                errors.Add(new(TerrainFile, required, $"valid_terrains에 선언된 지형 '{required}'의 보정 데이터가 없습니다."));
    }

    // ---------- 병종 ----------

    private static void ValidateUnits(
        List<(UnitTypeDto Dto, string File)> units, HashSet<string> charIds, GameRules rules, List<ValidationError> errors)
    {
        var seen = new HashSet<string>();
        for (var i = 0; i < units.Count; i++)
        {
            var (u, file) = units[i];
            var entry = u.Id ?? $"index {i}";
            if (string.IsNullOrWhiteSpace(u.Id)) { errors.Add(new(file, entry, "필수 필드 누락: id")); continue; }
            if (!seen.Add(u.Id)) errors.Add(new(file, entry, "중복 id (병종 id는 육상·해상 통틀어 고유해야 합니다)"));
            if (string.IsNullOrWhiteSpace(u.NameKo)) errors.Add(new(file, entry, "필수 필드 누락: name_ko"));

            var expectedDomain = file == LandUnitsFile ? "land" : "naval";
            if (u.Domain != expectedDomain)
                errors.Add(new(file, entry, $"domain 불일치: '{u.Domain}' (이 파일의 병종은 '{expectedDomain}' 이어야 합니다)"));

            var validClasses = expectedDomain == "land" ? rules.ValidUnitClassesLand : rules.ValidUnitClassesNaval;
            if (u.Class is null || !validClasses.Contains(u.Class))
                errors.Add(new(file, entry, $"class '{u.Class}'는 허용 목록에 없습니다: [{string.Join(", ", validClasses)}]"));

            if (u.Atk is null or <= 0) errors.Add(new(file, entry, "atk는 1 이상 필수입니다."));
            if (u.Def is null or <= 0) errors.Add(new(file, entry, "def는 1 이상 필수입니다."));
            if (u.Speed is null or <= 0) errors.Add(new(file, entry, "speed는 1 이상 필수입니다."));
            if (u.RecruitCostGold is null or < 0) errors.Add(new(file, entry, "recruit_cost_gold는 0 이상 필수입니다."));
            if (u.UpkeepFood is null or < 0) errors.Add(new(file, entry, "upkeep_food는 0 이상 필수입니다."));
            if (u.TechRequired is null or < 0) errors.Add(new(file, entry, "tech_required는 0 이상 필수입니다."));
            if (u.UniqueTo is not null && !charIds.Contains(u.UniqueTo))
                errors.Add(new(file, entry, $"unique_to가 존재하지 않는 캐릭터를 참조합니다: '{u.UniqueTo}'"));
        }
    }

    // ---------- 스킬 ----------

    private static void ValidateSkills(
        List<SkillDto> dtos, HashSet<string> unitIds, GameRules rules, List<ValidationError> errors)
    {
        var seen = new HashSet<string>();
        for (var i = 0; i < dtos.Count; i++)
        {
            var s = dtos[i];
            var entry = s.Id ?? $"index {i}";
            if (string.IsNullOrWhiteSpace(s.Id)) { errors.Add(new(SkillsFile, entry, "필수 필드 누락: id")); continue; }
            if (!seen.Add(s.Id)) errors.Add(new(SkillsFile, entry, "중복 id"));
            if (string.IsNullOrWhiteSpace(s.NameKo)) errors.Add(new(SkillsFile, entry, "필수 필드 누락: name_ko"));

            if (s.Type is not ("passive" or "ultimate"))
            {
                errors.Add(new(SkillsFile, entry, $"type은 passive|ultimate 이어야 합니다: '{s.Type}'"));
            }
            else if (s.Type == "passive")
            {
                if (s.GaugeCost is not 0) errors.Add(new(SkillsFile, entry, "passive 스킬의 gauge_cost는 0이어야 합니다."));
            }
            else
            {
                if (s.GaugeCost is null or <= 0) errors.Add(new(SkillsFile, entry, "ultimate 스킬의 gauge_cost는 1 이상 필수입니다."));
                else if (s.GaugeCost > rules.UltimateGaugeMax)
                    errors.Add(new(SkillsFile, entry, $"gauge_cost({s.GaugeCost})가 ultimate_gauge_max({rules.UltimateGaugeMax})를 초과합니다."));
                if (string.IsNullOrWhiteSpace(s.CutsceneId))
                    errors.Add(new(SkillsFile, entry, "ultimate 스킬은 cutscene_id가 필수입니다 (설계문서 §2.4 궁극기 컷씬)."));
            }

            foreach (var c in s.Conditions ?? new())
            {
                if (c.Type is null || !rules.ValidConditionTypes.Contains(c.Type))
                { errors.Add(new(SkillsFile, entry, $"condition type '{c.Type}'는 허용 목록에 없습니다.")); continue; }
                if (c.Type == "battle_domain" && (c.Value is null || !rules.ValidBattleDomains.Contains(c.Value)))
                    errors.Add(new(SkillsFile, entry, $"battle_domain 값 '{c.Value}'는 허용 목록에 없습니다."));
                if (c.Type == "terrain_is" && (c.Value is null || !rules.ValidTerrains.Contains(c.Value)))
                    errors.Add(new(SkillsFile, entry, $"terrain_is 값 '{c.Value}'는 유효한 지형이 아닙니다."));
            }

            if (s.Effects is null || s.Effects.Count == 0)
            {
                errors.Add(new(SkillsFile, entry, "effects는 1건 이상 필수입니다."));
                continue;
            }
            foreach (var e in s.Effects)
                ValidateEffect(e, entry, unitIds, rules, errors);
        }
    }

    private static void ValidateEffect(
        SkillEffectDto e, string entry, HashSet<string> unitIds, GameRules rules, List<ValidationError> errors)
    {
        if (e.Type is null || !rules.ValidEffectTypes.Contains(e.Type))
        {
            errors.Add(new(SkillsFile, entry, $"effect type '{e.Type}'는 허용 목록에 없습니다: [{string.Join(", ", rules.ValidEffectTypes)}]"));
            return;
        }
        if (e.Target is null || !rules.ValidSkillTargets.Contains(e.Target))
            errors.Add(new(SkillsFile, entry, $"effect target '{e.Target}'는 허용 목록에 없습니다."));

        switch (e.Type)
        {
            case "aoe_damage" or "single_damage" or "heal":
                if (e.Power is null or <= 0)
                    errors.Add(new(SkillsFile, entry, $"{e.Type} 효과는 power(1 이상)가 필수입니다."));
                if (e.ScalingStat is null || !rules.ValidScalingStats.Contains(e.ScalingStat))
                    errors.Add(new(SkillsFile, entry, $"{e.Type} 효과의 scaling_stat '{e.ScalingStat}'는 유효한 스탯이 아닙니다."));
                break;
            case "buff" or "debuff":
                if (e.Stat is null || !rules.ValidBuffStats.Contains(e.Stat))
                    errors.Add(new(SkillsFile, entry, $"{e.Type} 효과의 stat '{e.Stat}'는 허용 목록에 없습니다."));
                if (e.Amount is null or 0)
                    errors.Add(new(SkillsFile, entry, $"{e.Type} 효과는 amount(0이 아닌 값)가 필수입니다."));
                if (e.DurationTurns is <= 0)
                    errors.Add(new(SkillsFile, entry, "duration_turns는 null(상시) 또는 1 이상이어야 합니다."));
                break;
            case "shield":
                if (e.DurationTurns is null or <= 0)
                    errors.Add(new(SkillsFile, entry, "shield 효과는 duration_turns(1 이상)가 필수입니다."));
                if (e.AbsorbAmount is <= 0)
                    errors.Add(new(SkillsFile, entry, "absorb_amount는 null(완전 무효) 또는 1 이상이어야 합니다."));
                break;
            case "summon_unit":
                if (e.UnitId is null || !unitIds.Contains(e.UnitId))
                    errors.Add(new(SkillsFile, entry, $"summon_unit이 존재하지 않는 병종을 참조합니다: '{e.UnitId}'"));
                if (e.Amount is null or <= 0)
                    errors.Add(new(SkillsFile, entry, "summon_unit 효과는 amount(1 이상)가 필수입니다."));
                break;
            case "gauge_drain":
                if (e.Amount is null or <= 0)
                    errors.Add(new(SkillsFile, entry, "gauge_drain 효과는 amount(1 이상)가 필수입니다."));
                break;
        }
    }

    // ---------- 캐릭터 ----------

    private static void ValidateCharacters(
        List<CharacterDto> dtos, Dictionary<string, SkillDto> skillById, Dictionary<string, UnitTypeDto> unitById,
        HashSet<string> factionIds, GameRules rules, List<ValidationError> errors)
    {
        var seen = new HashSet<string>();
        for (var i = 0; i < dtos.Count; i++)
        {
            var c = dtos[i];
            var entry = c.Id ?? $"index {i}";
            if (string.IsNullOrWhiteSpace(c.Id)) { errors.Add(new(CharactersFile, entry, "필수 필드 누락: id")); continue; }
            if (!seen.Add(c.Id)) errors.Add(new(CharactersFile, entry, "중복 id"));
            if (string.IsNullOrWhiteSpace(c.NameKo)) errors.Add(new(CharactersFile, entry, "필수 필드 누락: name_ko"));
            if (string.IsNullOrWhiteSpace(c.VoiceSet)) errors.Add(new(CharactersFile, entry, "필수 필드 누락: voice_set"));
            if (string.IsNullOrWhiteSpace(c.PortraitAsset)) errors.Add(new(CharactersFile, entry, "필수 필드 누락: portrait_asset"));

            if (c.Origin is null || !rules.ValidOrigins.Contains(c.Origin))
                errors.Add(new(CharactersFile, entry, $"origin '{c.Origin}'는 허용 목록에 없습니다."));
            if (c.Rarity is null || c.Rarity < rules.RarityMin || c.Rarity > rules.RarityMax)
                errors.Add(new(CharactersFile, entry, $"rarity는 {rules.RarityMin}~{rules.RarityMax} 범위 필수입니다: {c.Rarity}"));

            ValidateStats(c.Stats, entry, rules, errors);
            ValidateGrowth(c.GrowthRates, entry, rules, errors);

            ValidateSkillRef(c.PassiveSkillId, "passive_skill_id", "passive", entry, skillById, errors);
            ValidateSkillRef(c.UltimateSkillId, "ultimate_skill_id", "ultimate", entry, skillById, errors);

            if (c.UniqueUnitId is not null)
            {
                if (!unitById.TryGetValue(c.UniqueUnitId, out var unit))
                    errors.Add(new(CharactersFile, entry, $"unique_unit_id가 존재하지 않는 병종을 참조합니다: '{c.UniqueUnitId}'"));
                else if (unit.UniqueTo != c.Id)
                    errors.Add(new(CharactersFile, entry,
                        $"unique_unit_id '{c.UniqueUnitId}'의 unique_to('{unit.UniqueTo}')가 이 캐릭터와 일치하지 않습니다."));
            }

            if (c.StartFaction is null || (c.StartFaction != "player_selectable" && !factionIds.Contains(c.StartFaction)))
                errors.Add(new(CharactersFile, entry,
                    $"start_faction '{c.StartFaction}'는 'player_selectable' 또는 존재하는 세력 id여야 합니다."));
        }
    }

    private static void ValidateStats(StatsDto? stats, string entry, GameRules rules, List<ValidationError> errors)
    {
        if (stats is null) { errors.Add(new(CharactersFile, entry, "필수 필드 누락: stats")); return; }
        foreach (var (value, name) in new (int?, string)[]
                 { (stats.Ldr, "ldr"), (stats.Str, "str"), (stats.Int, "int"), (stats.Pol, "pol"), (stats.Cha, "cha"), (stats.Nav, "nav") })
        {
            if (value is null)
                errors.Add(new(CharactersFile, entry, $"필수 스탯 누락: {name}"));
            else if (value < rules.StatMin || value > rules.StatMax)
                errors.Add(new(CharactersFile, entry, $"스탯 {name}={value}가 허용 범위({rules.StatMin}~{rules.StatMax})를 벗어났습니다."));
        }
    }

    private static void ValidateGrowth(GrowthRatesDto? growth, string entry, GameRules rules, List<ValidationError> errors)
    {
        if (growth is null) { errors.Add(new(CharactersFile, entry, "필수 필드 누락: growth_rates")); return; }
        foreach (var (value, name) in new (int?, string)[]
                 { (growth.Ldr, "ldr"), (growth.Str, "str"), (growth.Int, "int"), (growth.Pol, "pol"), (growth.Cha, "cha"), (growth.Nav, "nav") })
        {
            if (value is null)
                errors.Add(new(CharactersFile, entry, $"필수 성장률 누락: {name}"));
            else if (value < rules.GrowthRateMin || value > rules.GrowthRateMax)
                errors.Add(new(CharactersFile, entry, $"성장률 {name}={value}가 허용 범위({rules.GrowthRateMin}~{rules.GrowthRateMax})를 벗어났습니다."));
        }
    }

    private static void ValidateSkillRef(
        string? skillId, string fieldName, string expectedType, string entry,
        Dictionary<string, SkillDto> skillById, List<ValidationError> errors)
    {
        if (string.IsNullOrWhiteSpace(skillId))
        {
            errors.Add(new(CharactersFile, entry, $"필수 필드 누락: {fieldName}"));
            return;
        }
        if (!skillById.TryGetValue(skillId, out var skill))
            errors.Add(new(CharactersFile, entry, $"{fieldName}가 존재하지 않는 스킬을 참조합니다: '{skillId}'"));
        else if (skill.Type != expectedType)
            errors.Add(new(CharactersFile, entry, $"{fieldName} '{skillId}'는 {expectedType} 타입이어야 합니다 (실제: '{skill.Type}')."));
    }

    // ---------- 맵 ----------

    private static void ValidateMap(
        List<MapNodeDto> nodes, List<MapEdgeDto> edges, Dictionary<string, MapNodeDto> nodeById,
        GameRules rules, List<ValidationError> errors)
    {
        if (nodes.Count == 0)
        {
            errors.Add(new(MapFile, "-", "nodes가 비어 있습니다."));
            return;
        }

        var seen = new HashSet<string>();
        foreach (var n in nodes)
        {
            var entry = n.Id ?? "(id 없음)";
            if (string.IsNullOrWhiteSpace(n.Id)) { errors.Add(new(MapFile, entry, "필수 필드 누락: id")); continue; }
            if (!seen.Add(n.Id)) errors.Add(new(MapFile, entry, "중복 id"));
            if (string.IsNullOrWhiteSpace(n.NameKo)) errors.Add(new(MapFile, entry, "필수 필드 누락: name_ko"));
            if (n.Region is null || !rules.ValidRegions.Contains(n.Region))
                errors.Add(new(MapFile, entry, $"region '{n.Region}'는 허용 목록에 없습니다."));
            if (n.Adjacent is null || n.Adjacent.Count == 0)
                errors.Add(new(MapFile, entry, "adjacent는 1건 이상 필수입니다 (고립 노드 금지)."));

            switch (n.Type)
            {
                case "land":
                    if (n.Terrain is null || !rules.ValidTerrains.Contains(n.Terrain))
                        errors.Add(new(MapFile, entry, $"terrain '{n.Terrain}'는 허용 목록에 없습니다."));
                    if (n.Population is null or <= 0) errors.Add(new(MapFile, entry, "population은 1 이상 필수입니다."));
                    if (n.BaseProduction?.Gold is null or < 0 || n.BaseProduction?.Food is null or < 0)
                        errors.Add(new(MapFile, entry, "base_production의 gold/food는 0 이상 필수입니다."));
                    if (n.FacilitySlots is null or < 1) errors.Add(new(MapFile, entry, "facility_slots는 1 이상 필수입니다."));
                    if (n.DefenseLevel is null or < 0) errors.Add(new(MapFile, entry, "defense_level은 0 이상 필수입니다."));
                    if (n.Port is null) errors.Add(new(MapFile, entry, "필수 필드 누락: port"));
                    if (n.Climate is null || !rules.ValidClimates.Contains(n.Climate))
                        errors.Add(new(MapFile, entry, $"climate '{n.Climate}'는 허용 목록에 없습니다."));
                    if (n.CurrentDirection is not null)
                        errors.Add(new(MapFile, entry, "육상 노드에는 current_direction을 정의할 수 없습니다."));
                    break;
                case "sea":
                    if (n.CurrentDirection is null || !rules.ValidCurrentDirections.Contains(n.CurrentDirection))
                        errors.Add(new(MapFile, entry, $"해상 노드의 current_direction '{n.CurrentDirection}'는 8방위여야 합니다."));
                    if (n.Terrain is not null || n.Population is not null || n.Port is not null)
                        errors.Add(new(MapFile, entry, "해상 노드에는 terrain/population/port를 정의할 수 없습니다."));
                    break;
                default:
                    errors.Add(new(MapFile, entry, $"type은 land|sea 이어야 합니다: '{n.Type}'"));
                    break;
            }
        }

        // 간선 검증
        var edgePairs = new Dictionary<(string, string), string>();
        foreach (var e in edges)
        {
            var entry = $"{e.From ?? "?"}-{e.To ?? "?"}";
            if (string.IsNullOrWhiteSpace(e.From) || string.IsNullOrWhiteSpace(e.To))
            { errors.Add(new(MapFile, entry, "간선의 from/to는 필수입니다.")); continue; }
            if (e.From == e.To) { errors.Add(new(MapFile, entry, "self-loop 간선은 허용되지 않습니다.")); continue; }
            if (!nodeById.ContainsKey(e.From))
            { errors.Add(new(MapFile, entry, $"간선이 존재하지 않는 노드를 참조합니다: '{e.From}'")); continue; }
            if (!nodeById.ContainsKey(e.To))
            { errors.Add(new(MapFile, entry, $"간선이 존재하지 않는 노드를 참조합니다: '{e.To}'")); continue; }

            var key = string.CompareOrdinal(e.From, e.To) < 0 ? (e.From, e.To) : (e.To, e.From);
            if (edgePairs.ContainsKey(key)) { errors.Add(new(MapFile, entry, "중복 간선")); continue; }
            if (e.Type is not ("land" or "sea" or "port"))
            { errors.Add(new(MapFile, entry, $"간선 type은 land|sea|port 이어야 합니다: '{e.Type}'")); continue; }
            edgePairs[key] = e.Type;

            var fromNode = nodeById[e.From];
            var toNode = nodeById[e.To];
            switch (e.Type)
            {
                case "land" when fromNode.Type != "land" || toNode.Type != "land":
                    errors.Add(new(MapFile, entry, "land 간선은 육상 노드끼리만 연결할 수 있습니다."));
                    break;
                case "sea" when fromNode.Type != "sea" || toNode.Type != "sea":
                    errors.Add(new(MapFile, entry, "sea 간선은 해상 노드끼리만 연결할 수 있습니다."));
                    break;
                case "port":
                    var land = fromNode.Type == "land" ? fromNode : toNode.Type == "land" ? toNode : null;
                    var sea = fromNode.Type == "sea" ? fromNode : toNode.Type == "sea" ? toNode : null;
                    if (land is null || sea is null)
                        errors.Add(new(MapFile, entry, "port 간선은 육상 노드 1개와 해상 노드 1개를 연결해야 합니다."));
                    else if (land.Port != true)
                        errors.Add(new(MapFile, entry, $"port 간선의 육상 노드 '{land.Id}'는 port=true 여야 합니다."));
                    break;
            }
        }

        // 인접 목록 ↔ 간선 정합성 (양방향)
        foreach (var n in nodes)
        {
            if (n.Id is null || n.Adjacent is null) continue;
            if (n.Adjacent.Count != n.Adjacent.Distinct().Count())
                errors.Add(new(MapFile, n.Id, "adjacent에 중복 항목이 있습니다."));
            foreach (var a in n.Adjacent)
            {
                if (a == n.Id) { errors.Add(new(MapFile, n.Id, "adjacent에 자기 자신이 있습니다.")); continue; }
                if (!nodeById.ContainsKey(a))
                { errors.Add(new(MapFile, n.Id, $"adjacent가 존재하지 않는 노드를 참조합니다: '{a}'")); continue; }
                var key = string.CompareOrdinal(n.Id, a) < 0 ? (n.Id, a) : (a, n.Id);
                if (!edgePairs.ContainsKey(key))
                    errors.Add(new(MapFile, n.Id, $"adjacent '{a}'에 대응하는 간선이 edges에 없습니다."));
            }
        }
        foreach (var ((a, b), _) in edgePairs)
        {
            if (nodeById.TryGetValue(a, out var na) && (na.Adjacent is null || !na.Adjacent.Contains(b)))
                errors.Add(new(MapFile, a, $"간선 {a}-{b}가 '{a}'의 adjacent에 반영되지 않았습니다."));
            if (nodeById.TryGetValue(b, out var nb) && (nb.Adjacent is null || !nb.Adjacent.Contains(a)))
                errors.Add(new(MapFile, b, $"간선 {a}-{b}가 '{b}'의 adjacent에 반영되지 않았습니다."));
        }

        // port=true ↔ port 간선 존재 정합성
        foreach (var n in nodes.Where(n => n.Type == "land" && n.Id is not null))
        {
            var hasPortEdge = edgePairs.Any(kv =>
                kv.Value == "port" && (kv.Key.Item1 == n.Id || kv.Key.Item2 == n.Id));
            if (n.Port == true && !hasPortEdge)
                errors.Add(new(MapFile, n.Id!, "port=true 인데 port 간선이 없습니다."));
            if (n.Port == false && hasPortEdge)
                errors.Add(new(MapFile, n.Id!, "port=false 인데 port 간선이 있습니다."));
        }

        // 전체 연결성 (BFS) — 도달 불가 노드는 게임 진행 불가이므로 오류
        var validIds = nodes.Where(n => n.Id is not null).Select(n => n.Id!).ToList();
        if (validIds.Count > 0 && edgePairs.Count > 0)
        {
            var adjacency = new Dictionary<string, List<string>>();
            foreach (var ((a, b), _) in edgePairs)
            {
                adjacency.TryAdd(a, new List<string>());
                adjacency.TryAdd(b, new List<string>());
                adjacency[a].Add(b);
                adjacency[b].Add(a);
            }
            var visited = new HashSet<string> { validIds[0] };
            var queue = new Queue<string>();
            queue.Enqueue(validIds[0]);
            while (queue.Count > 0)
            {
                var cur = queue.Dequeue();
                if (!adjacency.TryGetValue(cur, out var nexts)) continue;
                foreach (var next in nexts)
                    if (visited.Add(next))
                        queue.Enqueue(next);
            }
            var unreachable = validIds.Where(id => !visited.Contains(id)).ToList();
            if (unreachable.Count > 0)
                errors.Add(new(MapFile, string.Join(",", unreachable),
                    $"그래프가 분리되어 있습니다 — '{validIds[0]}'에서 도달 불가: [{string.Join(", ", unreachable)}]"));
        }
    }

    // ---------- 세력 ----------

    private static void ValidateFactions(
        List<FactionDto> dtos, HashSet<string> charIds, Dictionary<string, MapNodeDto> nodeById, List<ValidationError> errors)
    {
        var seen = new HashSet<string>();
        var provinceOwner = new Dictionary<string, string>();
        for (var i = 0; i < dtos.Count; i++)
        {
            var f = dtos[i];
            var entry = f.Id ?? $"index {i}";
            if (string.IsNullOrWhiteSpace(f.Id)) { errors.Add(new(FactionsFile, entry, "필수 필드 누락: id")); continue; }
            if (f.Id == "player_selectable")
                errors.Add(new(FactionsFile, entry, "'player_selectable'은 예약어라 세력 id로 쓸 수 없습니다."));
            if (!seen.Add(f.Id)) errors.Add(new(FactionsFile, entry, "중복 id"));
            if (string.IsNullOrWhiteSpace(f.NameKo)) errors.Add(new(FactionsFile, entry, "필수 필드 누락: name_ko"));
            if (f.Color is null || !ColorRegex.IsMatch(f.Color))
                errors.Add(new(FactionsFile, entry, $"color는 #RRGGBB 형식 필수입니다: '{f.Color}'"));
            if (f.IsPlayerSelectable is null) errors.Add(new(FactionsFile, entry, "필수 필드 누락: is_player_selectable"));
            if (f.AiDisposition is null)
                errors.Add(new(FactionsFile, entry, "필수 필드 누락: ai_disposition"));
            if (f.LeaderCharacterId is not null && !charIds.Contains(f.LeaderCharacterId))
                errors.Add(new(FactionsFile, entry, $"leader_character_id가 존재하지 않는 캐릭터를 참조합니다: '{f.LeaderCharacterId}'"));

            if (f.StartProvinces is null || f.StartProvinces.Count == 0)
                errors.Add(new(FactionsFile, entry, "start_provinces는 1건 이상 필수입니다."));
            else
            {
                foreach (var p in f.StartProvinces)
                {
                    if (!nodeById.TryGetValue(p, out var node))
                    { errors.Add(new(FactionsFile, entry, $"start_provinces가 존재하지 않는 노드를 참조합니다: '{p}'")); continue; }
                    if (node.Type != "land")
                        errors.Add(new(FactionsFile, entry, $"시작 영지 '{p}'는 육상 영지여야 합니다."));
                    if (provinceOwner.TryGetValue(p, out var owner))
                        errors.Add(new(FactionsFile, entry, $"영지 '{p}'는 이미 세력 '{owner}'의 시작 영지입니다."));
                    else provinceOwner[p] = f.Id;
                }
            }

            if (f.StartResources?.Gold is null or < 0 || f.StartResources?.Food is null or < 0)
                errors.Add(new(FactionsFile, entry, "start_resources의 gold/food는 0 이상 필수입니다."));
            if (f.StartTechLevel is null or < 0) errors.Add(new(FactionsFile, entry, "start_tech_level은 0 이상 필수입니다."));
            if (f.DifficultyModifier?.ResourceBonus is null or <= 0)
                errors.Add(new(FactionsFile, entry, "difficulty_modifier.resource_bonus는 0보다 커야 합니다."));
            if (f.DifficultyModifier?.AiAggression is null or < 0)
                errors.Add(new(FactionsFile, entry, "difficulty_modifier.ai_aggression은 0 이상 필수입니다."));
        }
    }

    // ---------- ai_disposition 검증 (rules 의존이라 분리) ----------

    private static void ValidateFactionDispositions(List<FactionDto> dtos, GameRules rules, List<ValidationError> errors)
    {
        foreach (var f in dtos)
        {
            if (f.Id is null || f.AiDisposition is null) continue;
            if (!rules.ValidAiDispositions.Contains(f.AiDisposition))
                errors.Add(new(FactionsFile, f.Id, $"ai_disposition '{f.AiDisposition}'는 허용 목록에 없습니다."));
        }
    }

    // ---------- 조립 ----------

    private GameDatabase Build(
        GameRules rules,
        List<TerrainModifierDto> terrainDtos,
        List<UnitTypeDto> unitDtos,
        List<SkillDto> skillDtos,
        List<CharacterDto> charDtos,
        List<MapNodeDto> nodeDtos,
        List<MapEdgeDto> edgeDtos,
        List<FactionDto> factionDtos)
    {
        var terrain = terrainDtos.ToDictionary(
            t => t.Id!,
            t => new TerrainModifier(t.Id!, t.NameKo!, t.AtkMod!.Value, t.DefMod!.Value, t.MoveCost!.Value));

        var units = unitDtos.ToDictionary(
            u => u.Id!,
            u => new UnitType(u.Id!, u.NameKo!, u.Domain!, u.Class!, u.Atk!.Value, u.Def!.Value,
                u.Speed!.Value, u.RecruitCostGold!.Value, u.UpkeepFood!.Value, u.TechRequired!.Value, u.UniqueTo));

        var skills = skillDtos.ToDictionary(
            s => s.Id!,
            s => new Skill(
                s.Id!, s.NameKo!, s.Type!, s.GaugeCost!.Value, s.CutsceneId,
                (s.Conditions ?? new()).Select(c => new SkillCondition(c.Type!, c.Value!)).ToList(),
                s.Effects!.Select(e => new SkillEffect(
                    e.Type!, e.Target!, e.Power, e.ScalingStat, e.Stat, e.Amount,
                    e.DurationTurns, e.UnitId, e.AbsorbAmount)).ToList()));

        var characters = charDtos.ToDictionary(
            c => c.Id!,
            c => new Character(
                c.Id!, c.NameKo!, c.Origin!, c.Rarity!.Value,
                new CharacterStats(c.Stats!.Ldr!.Value, c.Stats.Str!.Value, c.Stats.Int!.Value,
                    c.Stats.Pol!.Value, c.Stats.Cha!.Value, c.Stats.Nav!.Value),
                new GrowthRates(c.GrowthRates!.Ldr!.Value, c.GrowthRates.Str!.Value, c.GrowthRates.Int!.Value,
                    c.GrowthRates.Pol!.Value, c.GrowthRates.Cha!.Value, c.GrowthRates.Nav!.Value),
                c.PassiveSkillId!, c.UltimateSkillId!, c.UniqueUnitId,
                c.StartFaction!, c.VoiceSet!, c.PortraitAsset!,
                rules.StatMax, rules.LevelCap, rules.ExpCurveBase));

        var provinces = nodeDtos.Select(Province (n) => n.Type == "land"
            ? new LandProvince(
                n.Id!, n.NameKo!, n.Region!, n.Adjacent!,
                n.Terrain!, n.Population!.Value,
                new ResourceYield(n.BaseProduction!.Gold!.Value, n.BaseProduction.Food!.Value),
                n.FacilitySlots!.Value, n.DefenseLevel!.Value, n.Port!.Value, n.Climate!)
            : new SeaZone(n.Id!, n.NameKo!, n.Region!, n.Adjacent!, n.CurrentDirection!)).ToList();

        var edges = edgeDtos.Select(e => new MapEdge(e.From!, e.To!, e.Type switch
        {
            "land" => EdgeType.Land,
            "sea" => EdgeType.Sea,
            _ => EdgeType.Port
        })).ToList();

        var factions = factionDtos.ToDictionary(
            f => f.Id!,
            f => new Faction(
                f.Id!, f.NameKo!, f.Color!, f.IsPlayerSelectable!.Value,
                f.AiDisposition!, f.LeaderCharacterId,
                f.StartResources!.Gold!.Value, f.StartResources.Food!.Value, f.StartTechLevel!.Value,
                f.DifficultyModifier!.ResourceBonus!.Value, f.DifficultyModifier.AiAggression!.Value,
                f.StartProvinces!));

        return new GameDatabase
        {
            Rules = rules,
            Characters = characters,
            Skills = skills,
            Units = units,
            TerrainModifiers = terrain,
            Factions = factions,
            Map = new WorldMap(provinces, edges)
        };
    }
}
