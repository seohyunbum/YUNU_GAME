namespace WorldConquest.Core.Domain;

/// <summary>
/// 시설 정의 (설계문서 §2.3). 레벨당 생산 보너스는 정수 % (§4.4 — market 3레벨 = 금 +75%).
/// Phase 1 은 생산 시설(시장·농지)만. 병영·학당·성벽·항구는 전투·기술과 함께 Phase 2 확장.
/// </summary>
public sealed record FacilityDef(
    int CostGold,
    int MaxLevel,
    int GoldBonusPctPerLevel,
    int FoodBonusPctPerLevel);
