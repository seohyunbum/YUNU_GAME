namespace WorldConquest.Core.Domain;

/// <summary>세율 단계 정의 (§2.3 세율): 금 수입 배율(×100) ↔ 민심 드리프트(턴당) 트레이드오프.</summary>
public sealed record TaxLevelDef(int GoldPct, int PoDrift);

/// <summary>
/// 내정 상수 (data/config/game_rules.json:internal_affairs — §2.3·§5.4).
/// 민심(PublicOrder)은 0~100 고정 스케일. 모든 계수는 정수 (§4.4) —
/// "per_100_stat" 계수는 스탯 100 기준 효과량 (실효 = 스탯 × 계수 / 100, 내림).
/// </summary>
public sealed class InternalAffairsRules
{
    // ── 민심 (PublicOrder 0~100) ──
    public required int PoInitial { get; init; }                 // 신규/기본 민심
    public required int PoAfterHostileCapture { get; init; }     // 전투 점령 직후
    public required int PoAfterPeacefulCapture { get; init; }    // 무혈 점령 직후
    public required int PoAfterRebellion { get; init; }          // 반란 후 (중립화된 영지)
    public required int PoOutputBasePct { get; init; }           // 생산 승수 = base + PO×slope/100
    public required int PoOutputSlopePct { get; init; }
    public required int RebellionThreshold { get; init; }        // 이 값 미만이면 반란 판정
    public required int RebellionChancePermyriad { get; init; }  // 턴당 반란 확률 (만분율)
    public required int RecruitPoPenaltyPer1000 { get; init; }   // 징병 인구 1000당 민심 하락

    // ── 태수(Governor) 스탯 연동 계수 ──
    public required int GovernorGoldPctPer100Pol { get; init; }          // 정치 → 금 생산 %
    public required int GovernorFoodPctPer100Pol { get; init; }          // 정치 → 식량 생산 %
    public required int GovernorBuildDiscountPctPer100Pol { get; init; } // 정치 → 건설 할인 %
    public required int BuildDiscountMaxPct { get; init; }
    public required int GovernorRecruitDiscountPctPer100Cha { get; init; } // 매력 → 징병 할인 %
    public required int RecruitDiscountMaxPct { get; init; }               // (병영 할인과 합산 후 상한)
    public required int GovernorPoRegenPer100Cha { get; init; }            // 매력 → 민심 회복/턴
    public required int GovernorTechPointsPer100Int { get; init; }         // 지력 → 기술 포인트/턴

    // ── 인구 (§2.3 병력 = 인구에서 징병) ──
    public required int PopGrowthPermyriadAtPo100 { get; init; }  // 민심 100 기준 턴당 성장 만분율
    public required int PopCapPctOfBase { get; init; }            // 정의 인구 대비 상한 %

    // ── 기술 (학당 + 태수 지력 → 병종 해금) ──
    public required int TechCostPerLevel { get; init; }   // L→L+1 비용 = L × 이 값
    public required int TechLevelCap { get; init; }

    // ── 세율 ──
    public required IReadOnlyDictionary<string, TaxLevelDef> TaxLevels { get; init; }
    public required string DefaultTaxLevel { get; init; }

    /// <summary>민심 → 생산 승수(×100). po_initial 에서 정확히 100이 되도록 데이터를 잡는 것을 권장.</summary>
    public int OutputPct(int publicOrder) => PoOutputBasePct + publicOrder * PoOutputSlopePct / 100;

    /// <summary>세율 해석 — 빈 값·미인식 값은 기본 세율로 (세이브 fail-soft 대칭).</summary>
    public TaxLevelDef ResolveTaxLevel(string taxLevel) =>
        TaxLevels.TryGetValue(taxLevel, out var def) ? def : TaxLevels[DefaultTaxLevel];
}
