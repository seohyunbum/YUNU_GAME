namespace WorldConquest.Core.Domain;

/// <summary>
/// 시설 정의 (설계문서 §2.3). 레벨당 생산 보너스는 정수 % (§4.4 — market 3레벨 = 금 +75%).
/// 경제 시설: 시장(금)·농지(식량)·항구(교역=금+식량)·학당(기술/턴).
/// 병영·성벽(전투 방어)은 전투 결합이라 Phase 2 확장 (전투 DefMod 배선 필요).
/// </summary>
public sealed record FacilityDef(
    int CostGold,
    int MaxLevel,
    int GoldBonusPctPerLevel,
    int FoodBonusPctPerLevel,
    int TechBonusPerLevel = 0);   // 레벨당 턴 기술점 (학당). 기본 0 → 기존 시설 무영향.
