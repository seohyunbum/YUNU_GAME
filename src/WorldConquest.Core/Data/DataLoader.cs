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
    public const string RetiredIdsFile = "config/retired_ids.json";
    public const string CutsceneTriggersFile = "cinematics/cutscene_triggers.json";
    public const string CutsceneScriptsFile = "cinematics/cutscene_scripts.json";
    public const string BannersFile = "summon/banners.json";
    public const string RateTablesFile = "summon/rate_tables.json";

    private static readonly HashSet<string> KnownAcquisitionChannels = new() { "start", "summon", "recruit", "event" };

    /// <summary>컷씬 트리거가 구독 가능한 이벤트 타입 (§2.7.4 — 신규 타입은 코드 확장과 함께 추가).</summary>
    private static readonly HashSet<string> KnownEventTypes = new()
    { "DuelStarted", "DuelEnded", "BattleEnded", "ProvinceCaptured", "AllianceFormed", "GameEnded", "SkillExecuted", "CharacterJoined" };

    private static readonly HashSet<string> KnownConditionTypes = new()
    { "actor_is", "event_field", "not_fired", "chance_permyriad" };

    private static readonly HashSet<string> KnownBeats = new() { "line", "narration", "title_card", "pause" };

    /// <summary>지원하는 데이터 스키마 버전 (game_rules.json:schema_version). 미래 버전은 로드 거부 (§5.5).</summary>
    public const int SupportedSchemaVersion = 2;

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

        // 5.5) 시네마틱 (§5.7): 트리거↔스크립트 조인·조건 DSL·궁극기 cutscene_id 실존 검증
        var triggersDto = ReadFile<CutsceneTriggersFileDto>(dataDir, CutsceneTriggersFile, errors) ?? new();
        var scriptsDto = ReadFile<CutsceneScriptsFileDto>(dataDir, CutsceneScriptsFile, errors) ?? new();
        var cutsceneIds = ValidateCutscenes(triggersDto, scriptsDto, charIds, skillDtos, errors);

        // 5.6) 초빙 (§5.8): 배너→확률표 조인·만분율 합·acquisition channels 검증
        var bannersDto = ReadFile<BannersFileDto>(dataDir, BannersFile, errors) ?? new();
        var rateTablesDto = ReadFile<RateTablesFileDto>(dataDir, RateTablesFile, errors) ?? new();
        ValidateSummon(bannersDto, rateTablesDto, charDtos, cutsceneIds, errors);

        // 6) 콘텐츠 id 생애주기 (§5.5): 결번(retired) 등재 id 를 신규 데이터가 재사용하면 기동 실패.
        var terrainIds = CollectIds(terrainDtos.Select(t => t.Id));
        var retired = CollectIds(ReadFile<RetiredIdsDto>(dataDir, RetiredIdsFile, errors)?.RetiredIds);
        if (retired.Count > 0)
            foreach (var (ids, file) in new (HashSet<string>, string)[]
            {
                (charIds, CharactersFile), (skillIds, SkillsFile), (unitIds, LandUnitsFile),
                (factionIds, FactionsFile), (nodeIds, MapFile), (terrainIds, TerrainFile),
                (cutsceneIds, CutsceneScriptsFile)
            })
                foreach (var id in ids.Where(retired.Contains))
                    errors.Add(new(file, id, "결번(retired) id 재사용 금지 — 삭제된 id 는 retired_ids.json 에 영구 등재되며 재사용할 수 없습니다 (§5.5 id 생애주기)."));

        if (errors.Count > 0) throw new DataValidationException(errors);

        // 5) 검증 통과 → 도메인 객체 조립
        return Build(rules, terrainDtos, unitDtos.Select(u => u.Dto).ToList(),
            skillDtos, charDtos, nodeDtos, mapDto.Edges!, factionDtos, triggersDto, scriptsDto,
            bannersDto, rateTablesDto);
    }

    // ---------- 초빙 (§5.8) ----------

    private static void ValidateSummon(BannersFileDto bannersFile, RateTablesFileDto ratesFile,
        List<CharacterDto> charDtos, HashSet<string> cutsceneIds, List<ValidationError> errors)
    {
        var rateIds = CollectIds((ratesFile.RateTables ?? new()).Select(r => r.Id));

        foreach (var b in bannersFile.Banners ?? new())
        {
            var entry = b.Id ?? "(id 없음)";
            if (string.IsNullOrWhiteSpace(b.Id)) { errors.Add(new(BannersFile, entry, "필수 필드 누락: id")); continue; }
            if (b.RateTableId is null || !rateIds.Contains(b.RateTableId))
                errors.Add(new(BannersFile, entry, $"rate_table_id '{b.RateTableId}' — 존재하지 않는 확률표."));
        }

        foreach (var r in ratesFile.RateTables ?? new())
        {
            var entry = r.Id ?? "(id 없음)";
            if (r.WeightsPermyriad is null || r.WeightsPermyriad.Count == 0)
            { errors.Add(new(RateTablesFile, entry, "weights_permyriad 필수.")); continue; }
            var sum = r.WeightsPermyriad.Values.Sum();
            if (sum != 10000)
                errors.Add(new(RateTablesFile, entry, $"만분율 합이 10000 이어야 합니다 (현재 {sum})."));
            foreach (var key in r.WeightsPermyriad.Keys)
                if (!int.TryParse(key, out var rar) || rar is < 1 or > 5)
                    errors.Add(new(RateTablesFile, entry, $"등급 키 '{key}' 는 1~5 여야 합니다."));
        }

        foreach (var c in charDtos)
        {
            var entry = c.Id ?? "?";
            if (c.Acquisition?.Channels is null || c.Acquisition.Channels.Count == 0)
            { errors.Add(new(CharactersFile, entry, "필수 필드 누락: acquisition.channels (§2.8.2)")); continue; }
            foreach (var ch in c.Acquisition.Channels)
                if (!KnownAcquisitionChannels.Contains(ch))
                    errors.Add(new(CharactersFile, entry, $"acquisition channel '{ch}' 미지원 (start/summon/recruit/event)."));
            if (c.EntryCutsceneId is not null && !cutsceneIds.Contains(c.EntryCutsceneId))
                errors.Add(new(CharactersFile, entry, $"entry_cutscene_id '{c.EntryCutsceneId}' — 대응 스크립트 없음 (§5.7)."));
        }
    }

    // ---------- 시네마틱 (§5.7) ----------

    private static HashSet<string> ValidateCutscenes(
        CutsceneTriggersFileDto triggersFile, CutsceneScriptsFileDto scriptsFile,
        HashSet<string> charIds, List<SkillDto> skillDtos, List<ValidationError> errors)
    {
        var triggers = triggersFile.Triggers ?? new();
        var scripts = scriptsFile.Scripts ?? new();
        var scriptIds = CollectIds(scripts.Select(s => s.Id));
        var triggerIds = CollectIds(triggers.Select(t => t.Id));

        void Err(string file, string entry, string msg) => errors.Add(new(file, entry, msg));

        // 트리거 검증
        var seen = new HashSet<string>();
        foreach (var t in triggers)
        {
            var entry = t.Id ?? "(id 없음)";
            if (string.IsNullOrWhiteSpace(t.Id)) { Err(CutsceneTriggersFile, entry, "필수 필드 누락: id"); continue; }
            if (!seen.Add(t.Id)) Err(CutsceneTriggersFile, entry, "중복 id");
            if (t.Id.Contains('#')) Err(CutsceneTriggersFile, entry, "id 에 '#' 금지 (fired 복합키 예약 문자)");
            if (t.OnEvent is null || !KnownEventTypes.Contains(t.OnEvent))
                Err(CutsceneTriggersFile, entry, $"on_event '{t.OnEvent}' 는 지원 이벤트가 아닙니다.");
            if (t.Priority is null) Err(CutsceneTriggersFile, entry, "필수 필드 누락: priority");
            if (t.OncePer is not (null or "save"))
                Err(CutsceneTriggersFile, entry, $"once_per '{t.OncePer}' 미지원 (v1: save).");
            if (!scriptIds.Contains(t.Id))
                Err(CutsceneTriggersFile, entry, "대응하는 스크립트가 없습니다 (트리거↔스크립트 조인).");

            foreach (var c in t.Conditions ?? new())
            {
                if (c.Type is null || !KnownConditionTypes.Contains(c.Type))
                { Err(CutsceneTriggersFile, entry, $"조건 타입 '{c.Type}' 미지원."); continue; }
                switch (c.Type)
                {
                    case "actor_is" when c.Value is null || !charIds.Contains(c.Value):
                        Err(CutsceneTriggersFile, entry, $"actor_is '{c.Value}' — 존재하지 않는 캐릭터.");
                        break;
                    case "not_fired" when c.Value is not "self" && (c.Value is null || !triggerIds.Contains(c.Value)):
                        Err(CutsceneTriggersFile, entry, $"not_fired '{c.Value}' — self 또는 실존 컷씬 id 여야 합니다.");
                        break;
                    case "event_field" when c.Field is null || c.Op is not "eq" || c.Value is null:
                        Err(CutsceneTriggersFile, entry, "event_field 는 field·op(eq)·value 필수.");
                        break;
                    case "chance_permyriad" when c.Permyriad is null or < 0 or > 10000:
                        Err(CutsceneTriggersFile, entry, "chance_permyriad 는 0~10000.");
                        break;
                }
            }
        }

        // 스크립트 검증 (비트 enum·speaker 실존)
        var seenScripts = new HashSet<string>();
        foreach (var s in scripts)
        {
            var entry = s.Id ?? "(id 없음)";
            if (string.IsNullOrWhiteSpace(s.Id)) { Err(CutsceneScriptsFile, entry, "필수 필드 누락: id"); continue; }
            if (!seenScripts.Add(s.Id)) Err(CutsceneScriptsFile, entry, "중복 id");
            foreach (var b in (s.Script ?? new()).Concat(s.ShortScript ?? new()))
            {
                if (b.Beat is null || !KnownBeats.Contains(b.Beat))
                { Err(CutsceneScriptsFile, entry, $"비트 '{b.Beat}' 미지원."); continue; }
                if (b.Beat is "line" && (b.TextKo is null || b.SpeakerRef is null))
                    Err(CutsceneScriptsFile, entry, "line 비트는 speaker_ref·text_ko 필수.");
                if (b.Beat is "line" && b.SpeakerRef is not (null or "actor") && !charIds.Contains(b.SpeakerRef))
                    Err(CutsceneScriptsFile, entry, $"speaker_ref '{b.SpeakerRef}' — 존재하지 않는 캐릭터.");
                if (b.Beat is "narration" && b.TextKo is null)
                    Err(CutsceneScriptsFile, entry, "narration 비트는 text_ko 필수.");
                if (b.Beat is "title_card" && s.TitleCard?.Text is null && b.Text is null)
                    Err(CutsceneScriptsFile, entry, "title_card 비트는 스크립트 title_card.text 또는 비트 text 필요.");
            }
        }

        // 궁극기 cutscene_id 는 스크립트에 실존해야 (§5.7 — A2 연출 계약)
        foreach (var sk in skillDtos.Where(x => x.Type == "ultimate" && x.CutsceneId is not null))
            if (!scriptIds.Contains(sk.CutsceneId!))
                Err(SkillsFile, sk.Id ?? "?", $"cutscene_id '{sk.CutsceneId}' 에 대응하는 컷씬 스크립트가 없습니다.");

        return scriptIds.Concat(triggerIds).ToHashSet();
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
        catch (Exception ex) when (ex is JsonException or IOException or UnauthorizedAccessException)
        {
            // 파싱뿐 아니라 잠김·권한거부·디스크오류도 전건 수집으로 흡수 (조용한 스킵·중단 없음, §5.5).
            errors.Add(new ValidationError(relPath, "-", $"파일 읽기/파싱 실패: {ex.Message}"));
            return null;
        }
    }

    private static HashSet<string> CollectIds(IEnumerable<string?>? ids) =>
        (ids ?? Enumerable.Empty<string?>()).Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id!).ToHashSet();

    // ---------- 전역 상수 ----------

    private static GameRules? BuildRules(GameRulesDto dto, List<ValidationError> errors)
    {
        var missing = new List<string>();
        void Need(object? v, string name) { if (v is null) missing.Add(name); }

        Need(dto.SchemaVersion, "schema_version");
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
        Need(dto.InternalAffairs, "internal_affairs");
        Need(dto.UnitClassAdvantage, "unit_class_advantage");
        Need(dto.Facilities, "facilities");
        Need(dto.Combat, "combat");
        Need(dto.Duel, "duel");
        Need(dto.Summon, "summon");
        Need(dto.RecruitGeneral, "recruit_general");
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

        Check(dto.SchemaVersion!.Value is >= 1 and <= SupportedSchemaVersion, "schema_version",
            $"지원하지 않는 스키마 버전({dto.SchemaVersion.Value}). 지원: 1~{SupportedSchemaVersion} (미래 버전 거부).");
        Check(dto.StatMin!.Value >= 1 && dto.StatMin.Value <= dto.StatMax!.Value, "stat_min/stat_max", "1 <= stat_min <= stat_max 이어야 합니다.");
        Check(dto.RarityMin!.Value >= 1 && dto.RarityMin.Value <= dto.RarityMax!.Value, "rarity_min/rarity_max", "1 <= rarity_min <= rarity_max 이어야 합니다.");
        Check(dto.LevelCap!.Value >= 1, "level_cap", "1 이상이어야 합니다.");
        Check(dto.ExpCurveBase!.Value >= 1, "exp_curve_base", "1 이상이어야 합니다.");
        Check(dto.GrowthRateMin!.Value >= 0 && dto.GrowthRateMin.Value <= dto.GrowthRateMax!.Value, "growth_rate_min/max", "0 <= min <= max 이어야 합니다.");
        Check(dto.LandingAttackModifier!.Value is >= -100 and <= 0, "landing_attack_modifier", "-100 ~ 0 범위여야 합니다 (정수 스케일 ×100).");
        Check(dto.LandingDebuffTurns!.Value >= 0, "landing_debuff_turns", "0 이상이어야 합니다.");
        Check(dto.UltimateGaugeMax!.Value >= 1, "ultimate_gauge_max", "1 이상이어야 합니다.");
        Check(dto.GaugeChargeOnAttack!.Value is >= 0 && dto.GaugeChargeOnAttack.Value <= dto.UltimateGaugeMax.Value, "gauge_charge_on_attack", "0 ~ ultimate_gauge_max 범위여야 합니다.");
        Check(dto.GaugeChargeOnDamaged!.Value is >= 0 && dto.GaugeChargeOnDamaged.Value <= dto.UltimateGaugeMax.Value, "gauge_charge_on_damaged", "0 ~ ultimate_gauge_max 범위여야 합니다.");
        Check(dto.AllianceTransferCapPerTurn!.Gold is >= 0 && dto.AllianceTransferCapPerTurn.Food is >= 0,
            "alliance_transfer_cap_per_turn", "gold/food는 0 이상 필수입니다.");
        ValidateInternalAffairs(dto.InternalAffairs!, Check);
        Check(dto.LoyaltyMin!.Value <= dto.LoyaltyMax!.Value, "loyalty_min/loyalty_max", "loyalty_min <= loyalty_max 이어야 합니다.");
        Check(dto.MoraleMax!.Value >= 1, "morale_max", "1 이상이어야 합니다.");
        Check(dto.Combat!.VariancePct is >= 0 and <= 100, "combat.variance_pct", "0 ~ 100 범위여야 합니다.");
        Check(dto.Combat.DamagePerCasualty is >= 1, "combat.damage_per_casualty", "1 이상이어야 합니다.");
        Check(dto.Combat.MaxRounds is >= 1, "combat.max_rounds", "1 이상이어야 합니다.");
        Check(dto.Combat.NavalWindAtkPct is >= 0 and <= 100, "combat.naval_wind_atk_pct", "0 ~ 100 범위여야 합니다.");
        Check(dto.Combat.NavalCurrentAtkPct is >= 0 and <= 100, "combat.naval_current_atk_pct", "0 ~ 100 범위여야 합니다.");
        Check(dto.Duel!.StrGapMax is >= 0, "duel.str_gap_max", "0 이상이어야 합니다.");
        Check(dto.Duel.VariancePct is >= 0 and <= 100, "duel.variance_pct", "0 ~ 100 범위여야 합니다.");
        Check(dto.Duel.WinnerMoraleBonus is >= 0, "duel.winner_morale_bonus", "0 이상이어야 합니다.");
        Check(dto.Duel.WinnerGaugeBonus is >= 0, "duel.winner_gauge_bonus", "0 이상이어야 합니다.");
        Check(dto.Summon!.Income is not null, "summon.income", "필수 필드 누락");
        Check(dto.Summon.CostSingle is >= 1, "summon.cost_single", "1 이상이어야 합니다.");
        Check(dto.Summon.CostBatch10 is >= 1, "summon.cost_batch10", "1 이상이어야 합니다.");
        Check(dto.Summon.HardPity is >= 1, "summon.hard_pity", "1 이상이어야 합니다.");
        Check(dto.Summon.MaxPityThreshold is >= 1, "summon.max_pity_threshold", "1 이상이어야 합니다.");
        Check(dto.Summon.HardPity <= dto.Summon.MaxPityThreshold,
            "summon.hard_pity", $"천장({dto.Summon.HardPity})은 상한({dto.Summon.MaxPityThreshold}) 이하 [MUST — 다크패턴 봉인].");
        Check(dto.Summon.SoftPityStart is >= 0, "summon.soft_pity_start", "0 이상이어야 합니다.");
        Check(dto.Summon.SoftPityAddPermyriad is >= 0, "summon.soft_pity_add_permyriad", "0 이상이어야 합니다.");
        var rg = dto.RecruitGeneral;
        Check(rg?.BaseCostGold is >= 0, "recruit_general.base_cost_gold", "0 이상이어야 합니다.");
        Check(rg?.CostPerRarity is >= 0, "recruit_general.cost_per_rarity", "0 이상이어야 합니다.");
        Check(rg?.BaseChancePermyriad is >= 0 and <= 10000, "recruit_general.base_chance_permyriad", "0~10000 이어야 합니다.");
        Check(rg?.EnvoyChaPermyriadPer100 is >= 0, "recruit_general.envoy_cha_permyriad_per_100", "0 이상이어야 합니다.");
        Check(rg?.RarityPenaltyPermyriad is >= 0, "recruit_general.rarity_penalty_permyriad", "0 이상이어야 합니다.");
        Check(rg?.ChanceMinPermyriad is >= 0 and <= 10000, "recruit_general.chance_min_permyriad", "0~10000 이어야 합니다.");
        Check(rg?.ChanceMaxPermyriad is >= 0 and <= 10000, "recruit_general.chance_max_permyriad", "0~10000 이어야 합니다.");
        Check((rg?.ChanceMinPermyriad ?? 0) <= (rg?.ChanceMaxPermyriad ?? 10000), "recruit_general.chance_min_permyriad", "min 은 max 이하여야 합니다.");
        Check(rg?.JoinLoyalty is >= 0 and <= 100, "recruit_general.join_loyalty", "0~100 이어야 합니다.");
        Check(rg?.MaxPerTurn is >= 1, "recruit_general.max_per_turn", "1 이상이어야 합니다.");
        Check(dto.Summon.MaxSummonsPerTurn is >= 1, "summon.max_summons_per_turn", "1 이상이어야 합니다.");
        foreach (var (atk, row) in dto.UnitClassAdvantage!)
        {
            if (row is null) { Check(false, $"unit_class_advantage.{atk}", "행(row)이 null 입니다."); continue; }
            foreach (var (def, mult) in row)
                Check(mult > 0, "unit_class_advantage", $"{atk}->{def} 배율은 0보다 커야 합니다.");
        }
        foreach (var (ftype, fdef) in dto.Facilities!)
        {
            if (fdef is null) { Check(false, $"facilities.{ftype}", "시설 정의가 null 입니다."); continue; }
            Check(fdef.CostGold is > 0, $"facilities.{ftype}", "cost_gold 는 0보다 커야 합니다.");
            Check(fdef.MaxLevel is >= 1, $"facilities.{ftype}", "max_level 은 1 이상이어야 합니다.");
            Check(fdef.GoldBonusPctPerLevel is >= 0, $"facilities.{ftype}", "gold_bonus_pct_per_level 은 0 이상이어야 합니다.");
            Check(fdef.FoodBonusPctPerLevel is >= 0, $"facilities.{ftype}", "food_bonus_pct_per_level 은 0 이상이어야 합니다.");
            Check((fdef.TechPointsPerLevel ?? 0) >= 0, $"facilities.{ftype}", "tech_points_per_level 은 0 이상이어야 합니다.");
            Check((fdef.RecruitDiscountPctPerLevel ?? 0) is >= 0 and <= 100, $"facilities.{ftype}", "recruit_discount_pct_per_level 은 0~100 이어야 합니다.");
            Check((fdef.DefenseBonusPctPerLevel ?? 0) is >= 0 and <= 100, $"facilities.{ftype}", "defense_bonus_pct_per_level 은 0~100 이어야 합니다.");
        }
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
                dto.AllianceTransferCapPerTurn.Gold ?? 0, dto.AllianceTransferCapPerTurn.Food ?? 0),   // null 은 위 Check 가 잡음
            InternalAffairs = BuildInternalAffairs(dto.InternalAffairs!),
            UnitClassAdvantage = dto.UnitClassAdvantage.ToDictionary(
                kv => kv.Key, kv => (IReadOnlyDictionary<string, int>)kv.Value),
            // 값 자체(kv.Value)·필드 null 은 위 Check 가 errors 로 잡아 Load 가 기동 실패시킨다 — 매핑은 NRE 방지용 기본값.
            Facilities = dto.Facilities.ToDictionary(
                kv => kv.Key,
                kv => new FacilityDef(kv.Value?.CostGold ?? 0, kv.Value?.MaxLevel ?? 1,
                    kv.Value?.GoldBonusPctPerLevel ?? 0, kv.Value?.FoodBonusPctPerLevel ?? 0,
                    kv.Value?.TechPointsPerLevel ?? 0, kv.Value?.RecruitDiscountPctPerLevel ?? 0,
                    kv.Value?.DefenseBonusPctPerLevel ?? 0)),
            CombatVariancePct = dto.Combat.VariancePct ?? 0,
            CombatDamagePerCasualty = dto.Combat.DamagePerCasualty ?? 1,
            CombatMaxRounds = dto.Combat.MaxRounds ?? 1,
            NavalWindAtkPct = dto.Combat.NavalWindAtkPct ?? 0,
            NavalCurrentAtkPct = dto.Combat.NavalCurrentAtkPct ?? 0,
            DuelStrGapMax = dto.Duel.StrGapMax ?? 0,
            DuelVariancePct = dto.Duel.VariancePct ?? 0,
            DuelWinnerMoraleBonus = dto.Duel.WinnerMoraleBonus ?? 0,
            DuelWinnerGaugeBonus = dto.Duel.WinnerGaugeBonus ?? 0,
            SummonIncomeBasePerTurn = dto.Summon.Income?.BasePerTurn ?? 0,
            SummonIncomeBattleVictory = dto.Summon.Income?.BattleVictory ?? 0,
            SummonIncomeFirstCapture = dto.Summon.Income?.FirstCapture ?? 0,
            SummonIncomeDuelVictory = dto.Summon.Income?.DuelVictory ?? 0,
            SummonCostSingle = dto.Summon.CostSingle ?? 1,
            SummonCostBatch10 = dto.Summon.CostBatch10 ?? 1,
            SummonSoftPityStart = dto.Summon.SoftPityStart ?? 0,
            SummonSoftPityAddPermyriad = dto.Summon.SoftPityAddPermyriad ?? 0,
            SummonHardPity = dto.Summon.HardPity ?? 1,
            SummonMaxPityThreshold = dto.Summon.MaxPityThreshold ?? 1,
            SummonBatchMinRarity4 = dto.Summon.BatchMinRarity4Guarantee ?? false,
            SummonMaxPerTurn = dto.Summon.MaxSummonsPerTurn ?? 1,
            SummonJoinLoyalty = dto.Summon.JoinLoyalty ?? 100,
            RecruitBaseCostGold = dto.RecruitGeneral!.BaseCostGold ?? 0,
            RecruitCostPerRarity = dto.RecruitGeneral.CostPerRarity ?? 0,
            RecruitBaseChancePermyriad = dto.RecruitGeneral.BaseChancePermyriad ?? 0,
            RecruitEnvoyChaPermyriadPer100 = dto.RecruitGeneral.EnvoyChaPermyriadPer100 ?? 0,
            RecruitRarityPenaltyPermyriad = dto.RecruitGeneral.RarityPenaltyPermyriad ?? 0,
            RecruitChanceMinPermyriad = dto.RecruitGeneral.ChanceMinPermyriad ?? 0,
            RecruitChanceMaxPermyriad = dto.RecruitGeneral.ChanceMaxPermyriad ?? 10000,
            RecruitJoinLoyalty = dto.RecruitGeneral.JoinLoyalty ?? 80,
            RecruitMaxPerTurn = dto.RecruitGeneral.MaxPerTurn ?? 1,
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

    /// <summary>internal_affairs 블록 검증 (§2.3.1·§5.5 — 필수·범위. 민심은 0~100 고정 스케일).</summary>
    private static void ValidateInternalAffairs(InternalAffairsDto ia, Action<bool, string, string> check)
    {
        void Po(int? v, string name) => check(v is >= 0 and <= 100, $"internal_affairs.{name}", "0~100 범위 필수입니다.");
        Po(ia.PoInitial, "po_initial");
        Po(ia.PoAfterHostileCapture, "po_after_hostile_capture");
        Po(ia.PoAfterPeacefulCapture, "po_after_peaceful_capture");
        Po(ia.PoAfterRebellion, "po_after_rebellion");
        Po(ia.RebellionThreshold, "rebellion_threshold");
        check(ia.PoOutputBasePct is >= 0 and <= 200, "internal_affairs.po_output_base_pct", "0~200 범위 필수입니다.");
        check(ia.PoOutputSlopePct is >= 0 and <= 200, "internal_affairs.po_output_slope_pct", "0~200 범위 필수입니다.");
        check(ia.RebellionChancePermyriad is >= 0 and <= 10000, "internal_affairs.rebellion_chance_permyriad", "0~10000(만분율) 필수입니다.");
        check(ia.RecruitPoPenaltyPer1000 is >= 0, "internal_affairs.recruit_po_penalty_per_1000", "0 이상 필수입니다.");
        foreach (var (v, name) in new (int?, string)[]
                 {
                     (ia.GovernorGoldPctPer100Pol, "governor_gold_pct_per_100_pol"),
                     (ia.GovernorFoodPctPer100Pol, "governor_food_pct_per_100_pol"),
                     (ia.GovernorBuildDiscountPctPer100Pol, "governor_build_discount_pct_per_100_pol"),
                     (ia.GovernorRecruitDiscountPctPer100Cha, "governor_recruit_discount_pct_per_100_cha"),
                     (ia.GovernorPoRegenPer100Cha, "governor_po_regen_per_100_cha"),
                     (ia.GovernorTechPointsPer100Int, "governor_tech_points_per_100_int")
                 })
            check(v is >= 0 and <= 100, $"internal_affairs.{name}", "0~100 범위 필수입니다.");
        check(ia.BuildDiscountMaxPct is >= 0 and <= 90, "internal_affairs.build_discount_max_pct", "0~90 범위 필수입니다 (100%면 공짜 건설).");
        check(ia.RecruitDiscountMaxPct is >= 0 and <= 90, "internal_affairs.recruit_discount_max_pct", "0~90 범위 필수입니다.");
        check(ia.PopGrowthPermyriadAtPo100 is >= 0 and <= 10000, "internal_affairs.pop_growth_permyriad_at_po100", "0~10000(만분율) 필수입니다.");
        check(ia.PopCapPctOfBase is >= 100, "internal_affairs.pop_cap_pct_of_base", "100 이상 필수입니다 (정의 인구 미만 상한 금지).");
        check(ia.TechCostPerLevel is >= 1, "internal_affairs.tech_cost_per_level", "1 이상 필수입니다.");
        check(ia.TechLevelCap is >= 1, "internal_affairs.tech_level_cap", "1 이상 필수입니다.");
        if (ia.TaxLevels is null || ia.TaxLevels.Count == 0)
        {
            check(false, "internal_affairs.tax_levels", "세율 단계가 1개 이상 필수입니다.");
            return;
        }
        foreach (var (id, tl) in ia.TaxLevels)
        {
            check(tl?.GoldPct is >= 1 and <= 1000, $"internal_affairs.tax_levels.{id}", "gold_pct 는 1~1000 필수입니다.");
            check(tl?.PoDrift is >= -100 and <= 100, $"internal_affairs.tax_levels.{id}", "po_drift 는 -100~100 필수입니다.");
        }
        check(ia.DefaultTaxLevel is not null && ia.TaxLevels.ContainsKey(ia.DefaultTaxLevel),
            "internal_affairs.default_tax_level", $"tax_levels 에 존재하는 키여야 합니다: '{ia.DefaultTaxLevel}'");
    }

    private static InternalAffairsRules BuildInternalAffairs(InternalAffairsDto ia) => new()
    {
        PoInitial = ia.PoInitial ?? 0,
        PoAfterHostileCapture = ia.PoAfterHostileCapture ?? 0,
        PoAfterPeacefulCapture = ia.PoAfterPeacefulCapture ?? 0,
        PoAfterRebellion = ia.PoAfterRebellion ?? 0,
        PoOutputBasePct = ia.PoOutputBasePct ?? 100,
        PoOutputSlopePct = ia.PoOutputSlopePct ?? 0,
        RebellionThreshold = ia.RebellionThreshold ?? 0,
        RebellionChancePermyriad = ia.RebellionChancePermyriad ?? 0,
        RecruitPoPenaltyPer1000 = ia.RecruitPoPenaltyPer1000 ?? 0,
        GovernorGoldPctPer100Pol = ia.GovernorGoldPctPer100Pol ?? 0,
        GovernorFoodPctPer100Pol = ia.GovernorFoodPctPer100Pol ?? 0,
        GovernorBuildDiscountPctPer100Pol = ia.GovernorBuildDiscountPctPer100Pol ?? 0,
        BuildDiscountMaxPct = ia.BuildDiscountMaxPct ?? 0,
        GovernorRecruitDiscountPctPer100Cha = ia.GovernorRecruitDiscountPctPer100Cha ?? 0,
        RecruitDiscountMaxPct = ia.RecruitDiscountMaxPct ?? 0,
        GovernorPoRegenPer100Cha = ia.GovernorPoRegenPer100Cha ?? 0,
        GovernorTechPointsPer100Int = ia.GovernorTechPointsPer100Int ?? 0,
        PopGrowthPermyriadAtPo100 = ia.PopGrowthPermyriadAtPo100 ?? 0,
        PopCapPctOfBase = ia.PopCapPctOfBase ?? 100,
        TechCostPerLevel = ia.TechCostPerLevel ?? 1,
        TechLevelCap = ia.TechLevelCap ?? 1,
        TaxLevels = (ia.TaxLevels ?? new()).ToDictionary(
            kv => kv.Key, kv => new TaxLevelDef(kv.Value?.GoldPct ?? 100, kv.Value?.PoDrift ?? 0)),
        DefaultTaxLevel = ia.DefaultTaxLevel ?? ""
    };

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
            if (u.PopCost is null or < 0) errors.Add(new(file, entry, "pop_cost는 0 이상 필수입니다 (§2.3 징병 인구 소모)."));
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
        var seenPos = new Dictionary<(int, int), string>();   // 좌표 중복 = 렌더 겹침 → 오류
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

            // 보드지도 좌표 — 그래픽 클라이언트 배치용 (규칙 계산 미사용, Province.MapPos 참조)
            if (n.MapPos?.X is null || n.MapPos.Y is null)
                errors.Add(new(MapFile, entry, "필수 필드 누락: map_pos { x, y }"));
            else if (n.MapPos.X < 0 || n.MapPos.Y < 0)
                errors.Add(new(MapFile, entry, "map_pos의 x/y는 0 이상이어야 합니다."));
            else if (!seenPos.TryAdd((n.MapPos.X.Value, n.MapPos.Y.Value), n.Id))
                errors.Add(new(MapFile, entry, $"map_pos ({n.MapPos.X},{n.MapPos.Y})가 '{seenPos[(n.MapPos.X.Value, n.MapPos.Y.Value)]}'와 중복됩니다 (렌더 겹침)."));

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
        var charOwner = new Dictionary<string, string>();   // 시작 무장(리더+start_characters) 중복 소속 검출
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
            else if (f.LeaderCharacterId is not null)
            {
                if (charOwner.TryGetValue(f.LeaderCharacterId, out var o0))
                    errors.Add(new(FactionsFile, entry, $"무장 '{f.LeaderCharacterId}'는 이미 세력 '{o0}'의 시작 무장입니다."));
                else charOwner[f.LeaderCharacterId] = f.Id!;
            }

            // start_characters (선택) — 리더 외 시작 무장. 존재·중복 소속·리더 중복 검증 (§2.8).
            foreach (var cid in f.StartCharacters ?? new())
            {
                if (!charIds.Contains(cid))
                { errors.Add(new(FactionsFile, entry, $"start_characters가 존재하지 않는 캐릭터를 참조합니다: '{cid}'")); continue; }
                if (cid == f.LeaderCharacterId)
                    errors.Add(new(FactionsFile, entry, $"start_characters '{cid}'가 leader_character_id 와 중복됩니다."));
                if (charOwner.TryGetValue(cid, out var o1))
                    errors.Add(new(FactionsFile, entry, $"무장 '{cid}'는 이미 세력 '{o1}'의 시작 무장입니다."));
                else charOwner[cid] = f.Id!;
            }

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
        List<FactionDto> factionDtos,
        CutsceneTriggersFileDto triggersFile,
        CutsceneScriptsFileDto scriptsFile,
        BannersFileDto bannersFile,
        RateTablesFileDto ratesFile)
    {
        var terrain = terrainDtos.ToDictionary(
            t => t.Id!,
            t => new TerrainModifier(t.Id!, t.NameKo!, t.AtkMod!.Value, t.DefMod!.Value, t.MoveCost!.Value));

        var units = unitDtos.ToDictionary(
            u => u.Id!,
            u => new UnitType(u.Id!, u.NameKo!, u.Domain!, u.Class!, u.Atk!.Value, u.Def!.Value,
                u.Speed!.Value, u.RecruitCostGold!.Value, u.UpkeepFood!.Value, u.PopCost!.Value,
                u.TechRequired!.Value, u.UniqueTo));

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
            c => Attach(new Character(
                c.Id!, c.NameKo!, c.Origin!, c.Rarity!.Value,
                new CharacterStats(c.Stats!.Ldr!.Value, c.Stats.Str!.Value, c.Stats.Int!.Value,
                    c.Stats.Pol!.Value, c.Stats.Cha!.Value, c.Stats.Nav!.Value),
                new GrowthRates(c.GrowthRates!.Ldr!.Value, c.GrowthRates.Str!.Value, c.GrowthRates.Int!.Value,
                    c.GrowthRates.Pol!.Value, c.GrowthRates.Cha!.Value, c.GrowthRates.Nav!.Value),
                c.PassiveSkillId!, c.UltimateSkillId!, c.UniqueUnitId,
                c.StartFaction!, c.VoiceSet!, c.PortraitAsset!,
                rules.StatMax, rules.LevelCap, rules.ExpCurveBase), c));

        static Character Attach(Character ch, CharacterDto dto)
        {
            ch.AcquisitionChannels = dto.Acquisition?.Channels ?? new List<string>();   // §2.8.2
            ch.EntryCutsceneId = dto.EntryCutsceneId;                                    // §2.7.7 A1
            return ch;
        }

        var provinces = nodeDtos.Select(Province (n) => n.Type == "land"
            ? new LandProvince(
                n.Id!, n.NameKo!, n.Region!, n.Adjacent!,
                n.Terrain!, n.Population!.Value,
                new ResourceYield(n.BaseProduction!.Gold!.Value, n.BaseProduction.Food!.Value),
                n.FacilitySlots!.Value, n.DefenseLevel!.Value, n.Port!.Value, n.Climate!)
                { MapPos = new MapPos(n.MapPos!.X!.Value, n.MapPos.Y!.Value) }
            : new SeaZone(n.Id!, n.NameKo!, n.Region!, n.Adjacent!, n.CurrentDirection!)
                { MapPos = new MapPos(n.MapPos!.X!.Value, n.MapPos.Y!.Value) }).ToList();

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
                f.StartProvinces!, f.StartCharacters ?? new()));

        var cutsceneTriggers = (triggersFile.Triggers ?? new()).ToDictionary(
            t => t.Id!,
            t => new CutsceneTrigger(
                t.Id!, t.Category ?? "misc", t.OnEvent!,
                (t.Conditions ?? new()).Select(c =>
                    new CutsceneCondition(c.Type!, c.Field, c.Op, c.Value, c.Permyriad)).ToList(),
                t.Priority!.Value, t.OncePer ?? "save"));

        var cutsceneScripts = (scriptsFile.Scripts ?? new()).ToDictionary(
            s => s.Id!,
            s => new CutsceneScript(
                s.Id!, s.TitleKo, s.TitleCard?.Text,
                (s.Script ?? new()).Select(ToBeat).ToList(),
                (s.ShortScript ?? new()).Select(ToBeat).ToList()));

        return new GameDatabase
        {
            Rules = rules,
            Characters = characters,
            Skills = skills,
            Units = units,
            TerrainModifiers = terrain,
            Factions = factions,
            Map = new WorldMap(provinces, edges),
            CutsceneTriggers = cutsceneTriggers,
            CutsceneScripts = cutsceneScripts,
            Banners = (bannersFile.Banners ?? new()).ToDictionary(
                b => b.Id!, b => new Banner(b.Id!, b.NameKo ?? b.Id!, b.RateTableId!)),
            RateTables = (ratesFile.RateTables ?? new()).ToDictionary(
                r => r.Id!, r => new RateTable(r.Id!,
                    r.WeightsPermyriad!.ToDictionary(kv => int.Parse(kv.Key), kv => kv.Value)))
        };

        static CutsceneBeat ToBeat(CutsceneBeatDto b) => new(b.Beat!, b.TextKo, b.SpeakerRef, b.Text);
    }
}
