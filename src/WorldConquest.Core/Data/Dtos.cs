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
    public AcquisitionDto? Acquisition { get; set; }      // §2.8.2 획득 경로
    public string? EntryCutsceneId { get; set; }          // §2.7.7 A1 등장씬
}

internal sealed class AcquisitionDto
{
    public List<string>? Channels { get; set; }           // start|summon|recruit|event
    public string? InitialStatus { get; set; }
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
    public int? PopCost { get; set; }
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
    public MapPosDto? MapPos { get; set; }
    public int? CommerceMax { get; set; }      // §2.3.2 상업 개발 상한 (선택 — 미지정 시 base_production.gold×5)
    public int? AgricultureMax { get; set; }   // §2.3.2 농업 개발 상한 (선택 — 미지정 시 base_production.food×5)
}

internal sealed class MapPosDto
{
    public int? X { get; set; }
    public int? Y { get; set; }
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
    public List<string>? StartCharacters { get; set; }   // 리더 외 시작 무장 (선택, §2.8)
    public ResourceAmountDto? StartResources { get; set; }
    public int? StartTechLevel { get; set; }
    public DifficultyModifierDto? DifficultyModifier { get; set; }
}

internal sealed class CombatRulesDto
{
    public int? VariancePct { get; set; }        // 라운드 데미지 변동 ±% (combat 스트림)
    public int? DamagePerCasualty { get; set; }  // 데미지 → 병력 손실 환산 계수
    public int? MaxRounds { get; set; }          // 교착 상한 (초과 시 수비 승)
    public int? NavalWindAtkPct { get; set; }    // 해상전 풍향 정렬 공격 보정 ±% (§2.6)
    public int? NavalCurrentAtkPct { get; set; } // 해상전 조류 정렬 가중 ±%
}

internal sealed class SummonRulesDto
{
    public SummonIncomeDto? Income { get; set; }
    public int? CostSingle { get; set; }
    public int? CostBatch10 { get; set; }
    public int? SoftPityStart { get; set; }
    public int? SoftPityAddPermyriad { get; set; }
    public int? HardPity { get; set; }
    public int? MaxPityThreshold { get; set; }   // 천장 다크패턴 봉인 상한 [MUST]
    public bool? BatchMinRarity4Guarantee { get; set; }
    public int? MaxSummonsPerTurn { get; set; }
    public int? JoinLoyalty { get; set; }
}

internal sealed class RecruitGeneralRulesDto
{
    public int? BaseCostGold { get; set; }
    public int? CostPerRarity { get; set; }
    public int? BaseChancePermyriad { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("envoy_cha_permyriad_per_100")]
    public int? EnvoyChaPermyriadPer100 { get; set; }
    public int? RarityPenaltyPermyriad { get; set; }
    public int? ChanceMinPermyriad { get; set; }
    public int? ChanceMaxPermyriad { get; set; }
    public int? JoinLoyalty { get; set; }
    public int? MaxPerTurn { get; set; }
}

internal sealed class EconomyRulesDto
{
    public int? GoldPerCommercePermil { get; set; }
    public int? FoodPerAgriculturePermil { get; set; }
    public int? DevStartPctOfMax { get; set; }
    public int? DevCostGold { get; set; }
    public int? DevBaseGain { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("dev_pol_gain_per_100")]
    public int? DevPolGainPer100 { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_dev_gain_per_100_pol")]
    public int? GovernorDevGainPer100Pol { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("muster_ldr_discount_per_100")]
    public int? MusterLdrDiscountPer100 { get; set; }
    public int? MusterDiscountMaxPct { get; set; }
}

internal sealed class SearchRulesDto
{
    public int? BaseChancePermyriad { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("envoy_int_permyriad_per_100")]
    public int? EnvoyIntPermyriadPer100 { get; set; }
    public int? ChanceMinPermyriad { get; set; }
    public int? ChanceMaxPermyriad { get; set; }
    public int? GoldReward { get; set; }
    public int? MaxPerTurn { get; set; }
}

internal sealed class SummonIncomeDto
{
    public int? BasePerTurn { get; set; }
    public int? BattleVictory { get; set; }
    public int? FirstCapture { get; set; }
    public int? DuelVictory { get; set; }
}

internal sealed class BannersFileDto
{
    public List<BannerDto>? Banners { get; set; }
}

internal sealed class BannerDto
{
    public string? Id { get; set; }
    public string? NameKo { get; set; }
    public string? RateTableId { get; set; }
}

internal sealed class RateTablesFileDto
{
    public List<RateTableDto>? RateTables { get; set; }
}

internal sealed class RateTableDto
{
    public string? Id { get; set; }
    public Dictionary<string, int>? WeightsPermyriad { get; set; }   // rarity(string) → 만분율
}

internal sealed class DuelRulesDto
{
    public int? StrGapMax { get; set; }         // 무력 격차 상한 — 이내여야 성사 (§2.6)
    public int? VariancePct { get; set; }
    public int? WinnerMoraleBonus { get; set; }
    public int? WinnerGaugeBonus { get; set; }
}

internal sealed class FacilityDefDto
{
    public int? CostGold { get; set; }
    public int? MaxLevel { get; set; }
    public int? GoldBonusPctPerLevel { get; set; }
    public int? FoodBonusPctPerLevel { get; set; }
    public int? TechPointsPerLevel { get; set; }         // 학당 — 레벨당 턴 기술 포인트 (선택, 기본 0)
    public int? RecruitDiscountPctPerLevel { get; set; } // 병영 — 징병 할인 % (선택)
    public int? DefenseBonusPctPerLevel { get; set; }    // 성벽 — 수비 방어 % (선택)
}

internal sealed class TaxLevelDefDto
{
    public int? GoldPct { get; set; }
    public int? PoDrift { get; set; }
}

internal sealed class InternalAffairsDto
{
    public int? PoInitial { get; set; }
    public int? PoAfterHostileCapture { get; set; }
    public int? PoAfterPeacefulCapture { get; set; }
    public int? PoAfterRebellion { get; set; }
    public int? PoOutputBasePct { get; set; }
    public int? PoOutputSlopePct { get; set; }
    public int? RebellionThreshold { get; set; }
    public int? RebellionChancePermyriad { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("recruit_po_penalty_per_1000")]
    public int? RecruitPoPenaltyPer1000 { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_gold_pct_per_100_pol")]
    public int? GovernorGoldPctPer100Pol { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_food_pct_per_100_pol")]
    public int? GovernorFoodPctPer100Pol { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_build_discount_pct_per_100_pol")]
    public int? GovernorBuildDiscountPctPer100Pol { get; set; }
    public int? BuildDiscountMaxPct { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_recruit_discount_pct_per_100_cha")]
    public int? GovernorRecruitDiscountPctPer100Cha { get; set; }
    public int? RecruitDiscountMaxPct { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_po_regen_per_100_cha")]
    public int? GovernorPoRegenPer100Cha { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("governor_tech_points_per_100_int")]
    public int? GovernorTechPointsPer100Int { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("pop_growth_permyriad_at_po100")]
    public int? PopGrowthPermyriadAtPo100 { get; set; }
    public int? PopCapPctOfBase { get; set; }
    public int? TechCostPerLevel { get; set; }
    public int? TechLevelCap { get; set; }
    public Dictionary<string, TaxLevelDefDto>? TaxLevels { get; set; }
    public string? DefaultTaxLevel { get; set; }
}

// ── 시네마틱 (§5.7) ──

internal sealed class CutsceneTriggersFileDto
{
    public int? SchemaVersion { get; set; }
    public List<CutsceneTriggerDto>? Triggers { get; set; }
}

internal sealed class CutsceneTriggerDto
{
    public string? Id { get; set; }
    public string? Category { get; set; }
    public string? OnEvent { get; set; }
    public List<CutsceneConditionDto>? Conditions { get; set; }
    public int? Priority { get; set; }
    public string? OncePer { get; set; }
}

internal sealed class CutsceneConditionDto
{
    public string? Type { get; set; }
    public string? Field { get; set; }
    public string? Op { get; set; }
    public string? Value { get; set; }
    public int? Permyriad { get; set; }
}

internal sealed class CutsceneScriptsFileDto
{
    public int? SchemaVersion { get; set; }
    public List<CutsceneScriptDto>? Scripts { get; set; }
}

internal sealed class CutsceneScriptDto
{
    public string? Id { get; set; }
    public string? TitleKo { get; set; }
    public TitleCardDto? TitleCard { get; set; }
    public List<CutsceneBeatDto>? Script { get; set; }
    public List<CutsceneBeatDto>? ShortScript { get; set; }
}

internal sealed class TitleCardDto
{
    public string? Text { get; set; }
}

internal sealed class CutsceneBeatDto
{
    public string? Beat { get; set; }
    public string? TextKo { get; set; }
    public string? SpeakerRef { get; set; }
    public string? Text { get; set; }
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
    public InternalAffairsDto? InternalAffairs { get; set; }   // 내정 상수 (§2.3.1)
    public Dictionary<string, Dictionary<string, int>>? UnitClassAdvantage { get; set; }   // 배율 ×100
    public Dictionary<string, FacilityDefDto>? Facilities { get; set; }   // 시설 정의 (§2.3)
    public CombatRulesDto? Combat { get; set; }   // 전투 상수 (§2.6)
    public DuelRulesDto? Duel { get; set; }       // 일기토 상수 (§2.6, 2026-07-16 구현 확정)
    public SummonRulesDto? Summon { get; set; }
    public RecruitGeneralRulesDto? RecruitGeneral { get; set; }   // 초빙 상수 (§2.8)
    public EconomyRulesDto? Economy { get; set; }                 // 개발 상수 (§2.3.2)
    public SearchRulesDto? Search { get; set; }                   // 탐색 상수 (§2.8)
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
