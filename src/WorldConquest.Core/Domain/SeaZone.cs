namespace WorldConquest.Core.Domain;

/// <summary>해상 거점(해역). 함대 이동 경로이자 점령 가능한 요충지 (설계문서 §2.1, §2.6).</summary>
public sealed class SeaZone : Province
{
    /// <summary>조류 방향 (8방위). 해상전 이동력 보정에 사용 — Phase 2.</summary>
    public string CurrentDirection { get; }

    public SeaZone(string id, string nameKo, string region, IReadOnlyList<string> adjacent, string currentDirection)
        : base(id, nameKo, region, adjacent)
    {
        CurrentDirection = currentDirection;
    }
}
