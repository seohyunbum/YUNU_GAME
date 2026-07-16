namespace WorldConquest.Core.Data;

// JSON 역직렬화 전용 DTO. 필수 필드 검증을 위해 전부 nullable로 받고 DataLoader가 검사한다.
// 프로퍼티명은 SnakeCaseLower 정책으로 JSON 키와 매핑된다 (예: NameKo ↔ name_ko).

internal sealed class StatsDto
{
    public int? Ldr { get; set; }
    public int? Str { get; set; }
    public int? Int { get; set; }
    public int? Pol { get; set; }
    public int? Cha { get; set; }
    public int? Nav { get; set; }
}

internal sealed class GrowthRatesDto
{
    // 정수 스케일 ×100 (120 = ×1.2). 부동소수 금지 §4.4.
    public int? Ldr { get; set; }
    public int? Str { get; set; }
    public int? Int { get; set; }
    public int? Pol { get; set; }
    public int? Cha { get; set; }
    public int? Nav { get; set; }
}

internal sealed class CharacterDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public string? Origin { get; set; }
    public int? Rarity { get; set; }
    public StatsDto? Stats { get; set; }
    public GrowthRatesDto? GrowthRates { get; set; }
    public string? PassiveSkillId { get; set; }
    public string? UltimateSkillId { get; set; }
    public string? UniqueUnitId { get; set; }
    public string? StartFaction { get; set; }
    public string? VoiceSet { get; set; }
    public string? PortraitAsset { get; set; }
}

internal sealed class SkillConditionDto
{
    public string? Type { get; set; }
    public string? Value { get; set; }
}

internal sealed class SkillEffectDto
{
    public string? Type { get; set; }
    public string? Target { get; set; }
    public int? Power { get; set; }
    public string? ScalingStat { get; set; }
    public string? Stat { get; set; }
    public int? Amount { get; set; }
    public int? DurationTurns { get; set; }
    public string? UnitId { get; set; }
    public int? AbsorbAmount { get; set; }
}

internal sealed class SkillDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public string? Type { get; set; }
    public int? GaugeCost { get; set; }
    public string? CutsceneId { get; set; }
    public List<SkillConditionDto>? Conditions { get; set; }
    public List<SkillEffectDto>? Effects { get; set; }
}

internal sealed class UnitTypeDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public string? Domain { get; set; }
    public string? Class { get; set; }
    public int? Atk { get; set; }
    public int? Def { get; set; }
    public int? Speed { get; set; }
    public int? RecruitCostGold { get; set; }
    public int? UpkeepFood { get; set; }
    public int? TechRequired { get; set; }
    public string? UniqueTo { get; set; }
}

internal sealed class TerrainModifierDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public int? AtkMod { get; set; }   // 정수 스케일 ×100
    public int? DefMod { get; set; }
    public int? MoveCost { get; set; }
}

internal sealed class ResourceAmountDto
{
    public int? Gold { get; set; }
    public int? Food { get; set; }
}

internal sealed class MapNodeDto
{
    public string? Id { get; set; }
    public string? Type { get; set; }
    public string? NameKo { get; set; }
    public string? Region { get; set; }
    public string? Terrain { get; set; }
    public int? Population { get; set; }
    public ResourceAmountDto? BaseProduction { get; set; }
    public int? FacilitySlots { get; set; }
    public int? DefenseLevel { get; set; }
    public bool? Port { get; set; }
    public string? Climate { get; set; }
    public string? CurrentDirection { get; set; }
    public List<string>? Adjacent { get; set; }
}

internal sealed class MapEdgeDto
{
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Type { get; set; }
}

internal sealed class WorldMapDto
{
    public List<MapNodeDto>? Nodes { get; set; }
    public List<MapEdgeDto>? Edges { get; set; }
}

internal sealed class DifficultyModifierDto
{
    public int? ResourceBonus { get; set; }   // 정수 스케일 ×100
    public int? AiAggression { get; set; }
}

internal sealed class FactionDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public string? Color { get; set; }
    public bool? IsPlayerSelectable { get; set; }
    public string? AiDisposition { get; set; }
    public string? LeaderCharacterId { get; set; }
    public List<string>? StartProvinces { get; set; }
    public ResourceAmountDto? StartResources { get; set; }
    public int? StartTechLevel { get; set; }
    public DifficultyModifierDto? DifficultyModifier { get; set; }
}

internal sealed class FacilityDefDto
{
    public int? CostGold { get; set; }
    public int? MaxLevel { get; set; }
    public int? GoldBonusPctPerLevel { get; set; }
    public int? FoodBonusPctPerLevel { get; set; }
}

internal sealed class RetiredIdsDto
{
    // 삭제된 콘텐츠 id 의 영구 결번 목록 (§5.5 id 생애주기). 재사용 시 기동 실패.
    public List<string>? RetiredIds { get; set; }
}

internal sealed class GameRulesDto
{
    public int? SchemaVersion { get; set; }   // 데이터 스키마 버전 앵커 (§5.5). 미래 버전 로드 거부.
    public int? StatMin { get; set; }
    public int? StatMax { get; set; }
    public int? RarityMin { get; set; }
    public int? RarityMax { get; set; }
    public int? LevelCap { get; set; }
    public int? ExpCurveBase { get; set; }
    public int? LoyaltyMin { get; set; }
    public int? LoyaltyMax { get; set; }
    public int? MoraleMax { get; set; }
    public int? GrowthRateMin { get; set; }   // 정수 스케일 ×100
    public int? GrowthRateMax { get; set; }
    public int? UltimateGaugeMax { get; set; }
    public int? GaugeChargeOnAttack { get; set; }
    public int? GaugeChargeOnDamaged { get; set; }
    public int? LandingAttackModifier { get; set; }   // 정수 스케일 ×100 (-25)
    public int? LandingDebuffTurns { get; set; }
    public ResourceAmountDto? AllianceTransferCapPerTurn { get; set; }
    public int? BaseTaxRate { get; set; }   // 정수 스케일 ×100 (10)
    public Dictionary<string, Dictionary<string, int>>? UnitClassAdvantage { get; set; }   // 배율 ×100
    public Dictionary<string, FacilityDefDto>? Facilities { get; set; }   // 시설 정의 (§2.3)
    public List<string>? ValidTerrains { get; set; }
    public List<string>? ValidClimates { get; set; }
    public List<string>? ValidRegions { get; set; }
    public List<string>? ValidOrigins { get; set; }
    public List<string>? ValidEffectTypes { get; set; }
    public List<string>? ValidSkillTargets { get; set; }
    public List<string>? ValidBuffStats { get; set; }
    public List<string>? ValidConditionTypes { get; set; }
    public List<string>? ValidBattleDomains { get; set; }
    public List<string>? ValidScalingStats { get; set; }
    public List<string>? ValidUnitClassesLand { get; set; }
    public List<string>? ValidUnitClassesNaval { get; set; }
    public List<string>? ValidAiDispositions { get; set; }
    public List<string>? ValidCurrentDirections { get; set; }
}
