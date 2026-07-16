namespace WorldConquest.Core.Domain;

/// <summary>세력 간 외교 상태 (설계문서 §2 외교).</summary>
public enum DiplomaticState
{
    Neutral,
    NonAggression,
    Alliance,
    War
}
