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
    public required int GrowthRateMin { get; init; }   // 정수 스케일 ×100. §4.4
    public required int GrowthRateMax { get; init; }
    public required int UltimateGaugeMax { get; init; }
    public required int GaugeChargeOnAttack { get; init; }
    public required int GaugeChargeOnDamaged { get; init; }
    public required int LandingAttackModifier { get; init; }   // 정수 스케일 ×100 (-25 = -0.25)
    public required int LandingDebuffTurns { get; init; }
    public required ResourceYield AllianceTransferCapPerTurn { get; init; }
    public required InternalAffairsRules InternalAffairs { get; init; }   // 내정 상수 (§2.3 — 세율·민심·태수·인구·기술)
    public required IReadOnlyDictionary<string, IReadOnlyDictionary<string, int>> UnitClassAdvantage { get; init; }   // 배율 ×100 (150 = ×1.5)
    public required IReadOnlyDictionary<string, FacilityDef> Facilities { get; init; }   // 시설 종류 → 정의 (§2.3)
    public required int CombatVariancePct { get; init; }        // 전투 라운드 데미지 변동 ±% (§2.6)
    public required int CombatDamagePerCasualty { get; init; }  // 데미지 → 병력 손실 환산
    public required int CombatMaxRounds { get; init; }          // 교착 상한 (초과 시 수비 승)
    public required int NavalWindAtkPct { get; init; }          // 해상전 풍향 정렬 공격 보정 ±% (§2.6)
    public required int NavalCurrentAtkPct { get; init; }       // 해상전 조류 정렬 가중 ±%
    public required int DuelStrGapMax { get; init; }            // 일기토 성사 무력 격차 상한 (§2.6)
    public required int DuelVariancePct { get; init; }
    public required int DuelWinnerMoraleBonus { get; init; }    // 승자 측 공격 버프 %
    public required int DuelWinnerGaugeBonus { get; init; }     // 승자 측 게이지 보너스

    // ── 초빙 (§2.8 — 천장·비용은 밸런스 패널 §5.6 조정 대상) ──
    public required int SummonIncomeBasePerTurn { get; init; }
    public required int SummonIncomeBattleVictory { get; init; }
    public required int SummonIncomeFirstCapture { get; init; }
    public required int SummonIncomeDuelVictory { get; init; }
    public required int SummonCostSingle { get; init; }
    public required int SummonCostBatch10 { get; init; }
    public required int SummonSoftPityStart { get; init; }
    public required int SummonSoftPityAddPermyriad { get; init; }
    public required int SummonHardPity { get; init; }           // [MUST] ≤ MaxPityThreshold
    public required int SummonMaxPityThreshold { get; init; }
    public required bool SummonBatchMinRarity4 { get; init; }
    public required int SummonMaxPerTurn { get; init; }
    public required int SummonJoinLoyalty { get; init; }

    // ── 등용 (§2.8 recruit — 재야 무장 영입. 사신 매력이 성공률을 좌우) ──
    public required int RecruitBaseCostGold { get; init; }
    public required int RecruitCostPerRarity { get; init; }        // 비용 = base + 대상 rarity × 이 값
    public required int RecruitBaseChancePermyriad { get; init; }
    public required int RecruitEnvoyChaPermyriadPer100 { get; init; }  // 사신 매력 100당 성공률 가산(만분율)
    public required int RecruitRarityPenaltyPermyriad { get; init; }   // 대상 rarity 당 성공률 차감(만분율)
    public required int RecruitChanceMinPermyriad { get; init; }       // clamp 하한
    public required int RecruitChanceMaxPermyriad { get; init; }       // clamp 상한
    public required int RecruitJoinLoyalty { get; init; }
    public required int RecruitMaxPerTurn { get; init; }

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

    /// <summary>공격 병종 class → 방어 병종 class 상성 배율 (정수 스케일 ×100). 미정의 조합은 100(=×1.0).</summary>
    public int GetClassAdvantage(string attackerClass, string defenderClass) =>
        UnitClassAdvantage.TryGetValue(attackerClass, out var row) &&
        row.TryGetValue(defenderClass, out var mult)
            ? mult
            : 100;
}
