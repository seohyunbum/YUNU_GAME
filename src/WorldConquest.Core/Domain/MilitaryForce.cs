namespace WorldConquest.Core.Domain;

/// <summary>부대·함대 공통 부모. 편성 상태(지휘관·병력·사기·보급)만 담당 — 이동은 Phase 1, 전투는 Phase 2.</summary>
public abstract class MilitaryForce
{
    public const int MoraleMax = 100;

    public string Id { get; }
    public string FactionId { get; }
    public string? CommanderId { get; set; }
    public string LocationNodeId { get; set; }

    private int _morale = MoraleMax;
    public int Morale
    {
        get => _morale;
        set => _morale = Math.Clamp(value, 0, MoraleMax);
    }

    public int Supply { get; set; }

    private readonly Dictionary<string, int> _units = new();
    /// <summary>병종 id → 병력 수.</summary>
    public IReadOnlyDictionary<string, int> Units => _units;

    public int TotalTroops => _units.Values.Sum();

    protected MilitaryForce(string id, string factionId, string locationNodeId)
    {
        Id = id;
        FactionId = factionId;
        LocationNodeId = locationNodeId;
    }

    public void AddUnits(string unitTypeId, int count)
    {
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count), "추가 병력은 1 이상이어야 합니다.");
        _units[unitTypeId] = _units.TryGetValue(unitTypeId, out var cur) ? cur + count : count;
    }

    public void RemoveUnits(string unitTypeId, int count)
    {
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count), "제거 병력은 1 이상이어야 합니다.");
        if (!_units.TryGetValue(unitTypeId, out var cur) || cur < count)
            throw new InvalidOperationException($"병력이 부족합니다: {unitTypeId} 보유 {(_units.TryGetValue(unitTypeId, out var c) ? c : 0)} < 제거 {count}");
        if (cur == count) _units.Remove(unitTypeId);
        else _units[unitTypeId] = cur - count;
    }
}

/// <summary>육상 부대.</summary>
public sealed class Army : MilitaryForce
{
    public Army(string id, string factionId, string locationNodeId) : base(id, factionId, locationNodeId) { }
}

/// <summary>함대.</summary>
public sealed class Fleet : MilitaryForce
{
    public Fleet(string id, string factionId, string locationNodeId) : base(id, factionId, locationNodeId) { }
}
