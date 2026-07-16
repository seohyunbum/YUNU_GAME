namespace WorldConquest.Core.Domain;

/// <summary>병종 정의 (설계문서 §2.5). 상성 배율은 game_rules.json의 unit_class_advantage 참조.</summary>
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
    int TechRequired,
    string? UniqueTo);
