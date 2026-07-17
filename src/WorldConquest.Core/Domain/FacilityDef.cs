namespace WorldConquest.Core.Domain;

/// <summary>
/// 시설 정의 (설계문서 §2.3). 레벨당 효과는 전부 정수 스케일 (§4.4 — market 3레벨 = 금 +75%).
/// 경제: 시장(금)·농지(식량)·항구(교역=금+식량) / 기술: 학당(기술점/턴) /
/// 군사: 병영(징병 할인)·성벽(수비 전투 방어). 효과 필드는 범용이라 새 시설은 JSON만으로 조합 (§5 데이터 주도).
/// 항구는 시설 슬롯 시설이자 맵 port 속성과 별개 개념(맵 속성 = 함선 건조 가능 여부).
/// </summary>
public sealed record FacilityDef(
    int CostGold,
    int MaxLevel,
    int GoldBonusPctPerLevel,
    int FoodBonusPctPerLevel,
    int TechPointsPerLevel = 0,          // 학당: 레벨당 턴 기술 포인트 (누적 → 레벨업, §2.3.1)
    int RecruitDiscountPctPerLevel = 0,  // 병영: 징병 비용 할인 %
    int DefenseBonusPctPerLevel = 0);    // 성벽: 수비 전투 방어 보정 % (CombatManager 배선)
