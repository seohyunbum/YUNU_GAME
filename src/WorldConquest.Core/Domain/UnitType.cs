namespace WorldConquest.Core.Domain;

/// <summary>병종 정의 (설계문서 §2.5). 상성 배율은 game_rules.json의 unit_class_advantage 참조.
/// PopCost = 1병당 소모 인구 (§2.3 병력 = 인구에서 징병 — 0 허용: 그림자 병사 등 비인간 병종).</summary>
public sealed record UnitType(
    string Id,
    string NameKo,
    string Domain,
    string Class,
    int Atk,
    int Def,
    int Speed,
    int RecruitCostGold,
    int UpkeepFood,
    int PopCost,
    int TechRequired,
    string? UniqueTo);
