namespace WorldConquest.Core.Domain;

/// <summary>
/// 전역 게임 상수 (data/config/game_rules.json — 설계문서 §5.4).
/// §2의 모든 매직넘버는 여기로 외부화한다 [MUST].
/// </summary>
public sealed class GameRules
{
    public required int StatMin { get; init; }
    public required int StatMax { get; init; }
    public required int RarityMin { get; init; }
    public required int RarityMax { get; init; }
    public required int LevelCap { get; init; }
    public required int ExpCurveBase { get; init; }
    public required int LoyaltyMin { get; init; }
    public required int LoyaltyMax { get; init; }
    public required int MoraleMax { get; init; }
    public required double GrowthRateMin { get; init; }
    public required double GrowthRateMax { get; init; }
    public required int UltimateGaugeMax { get; init; }
    public required int GaugeChargeOnAttack { get; init; }
    public required int GaugeChargeOnDamaged { get; init; }
    public required double LandingAttackModifier { get; init; }
    public required int LandingDebuffTurns { get; init; }
    public required ResourceYield AllianceTransferCapPerTurn { get; init; }
    public required double BaseTaxRate { get; init; }
    public required IReadOnlyDictionary<string, IReadOnlyDictionary<string, double>> UnitClassAdvantage { get; init; }

    public required IReadOnlySet<string> ValidTerrains { get; init; }
    public required IReadOnlySet<string> ValidClimates { get; init; }
    public required IReadOnlySet<string> ValidRegions { get; init; }
    public required IReadOnlySet<string> ValidOrigins { get; init; }
    public required IReadOnlySet<string> ValidEffectTypes { get; init; }
    public required IReadOnlySet<string> ValidSkillTargets { get; init; }
    public required IReadOnlySet<string> ValidBuffStats { get; init; }
    public required IReadOnlySet<string> ValidConditionTypes { get; init; }
    public required IReadOnlySet<string> ValidBattleDomains { get; init; }
    public required IReadOnlySet<string> ValidScalingStats { get; init; }
    public required IReadOnlySet<string> ValidUnitClassesLand { get; init; }
    public required IReadOnlySet<string> ValidUnitClassesNaval { get; init; }
    public required IReadOnlySet<string> ValidAiDispositions { get; init; }
    public required IReadOnlySet<string> ValidCurrentDirections { get; init; }

    /// <summary>공격 병종 class → 방어 병종 class 상성 배율. 미정의 조합은 1.0.</summary>
    public double GetClassAdvantage(string attackerClass, string defenderClass) =>
        UnitClassAdvantage.TryGetValue(attackerClass, out var row) &&
        row.TryGetValue(defenderClass, out var mult)
            ? mult
            : 1.0;
}
