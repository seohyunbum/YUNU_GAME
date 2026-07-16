namespace WorldConquest.Core.Domain;

/// <summary>
/// 세력(국가) 단위의 자원·외교 상태·소유 영지 (설계문서 §4.2).
/// 외교 메서드는 자기 세력의 관계 상태만 변경한다 — 양측 동기화·수락 협상은
/// Phase 2의 DiplomacyManager 책임 (SRP).
/// </summary>
public sealed class Faction
{
    public string Id { get; }
    public string NameKo { get; }
    public string Color { get; }
    public bool IsPlayerSelectable { get; }
    public string AiDisposition { get; }
    public string? LeaderCharacterId { get; }

    public int Treasury { get; set; }
    public int Food { get; set; }
    public int TechLevel { get; set; }
    public double ResourceBonus { get; }
    public double AiAggression { get; }

    private readonly List<string> _ownedProvinceIds;
    public IReadOnlyList<string> OwnedProvinceIds => _ownedProvinceIds;

    private readonly Dictionary<string, DiplomaticState> _relations = new();
    public IReadOnlyDictionary<string, DiplomaticState> DiplomaticRelations => _relations;

    public Faction(
        string id, string nameKo, string color, bool isPlayerSelectable,
        string aiDisposition, string? leaderCharacterId,
        int treasury, int food, int techLevel,
        double resourceBonus, double aiAggression,
        IEnumerable<string> startProvinceIds)
    {
        Id = id;
        NameKo = nameKo;
        Color = color;
        IsPlayerSelectable = isPlayerSelectable;
        AiDisposition = aiDisposition;
        LeaderCharacterId = leaderCharacterId;
        Treasury = treasury;
        Food = food;
        TechLevel = techLevel;
        ResourceBonus = resourceBonus;
        AiAggression = aiAggression;
        _ownedProvinceIds = new List<string>(startProvinceIds);
    }

    public DiplomaticState GetRelation(string otherFactionId) =>
        _relations.TryGetValue(otherFactionId, out var state) ? state : DiplomaticState.Neutral;

    /// <summary>선전포고. 동맹 파기(배신)를 포함해 어떤 상태에서도 가능.</summary>
    public void DeclareWar(string otherFactionId)
    {
        GuardNotSelf(otherFactionId);
        _relations[otherFactionId] = DiplomaticState.War;
    }

    /// <summary>동맹 체결. 전쟁 중에는 종전(MakePeace) 없이 불가.</summary>
    public void FormAlliance(string otherFactionId)
    {
        GuardNotSelf(otherFactionId);
        if (GetRelation(otherFactionId) == DiplomaticState.War)
            throw new InvalidOperationException($"전쟁 중인 세력({otherFactionId})과는 동맹을 맺을 수 없습니다. 먼저 종전하십시오.");
        _relations[otherFactionId] = DiplomaticState.Alliance;
    }

    /// <summary>종전. 전쟁 상태에서만 의미가 있으며, 중립으로 되돌린다.</summary>
    public void MakePeace(string otherFactionId)
    {
        GuardNotSelf(otherFactionId);
        if (GetRelation(otherFactionId) != DiplomaticState.War)
            throw new InvalidOperationException($"세력({otherFactionId})과 전쟁 중이 아닙니다.");
        _relations[otherFactionId] = DiplomaticState.Neutral;
    }

    /// <summary>불가침 조약. 중립 상태에서만 체결 가능.</summary>
    public void SetNonAggression(string otherFactionId)
    {
        GuardNotSelf(otherFactionId);
        if (GetRelation(otherFactionId) != DiplomaticState.Neutral)
            throw new InvalidOperationException($"불가침 조약은 중립 상태에서만 체결할 수 있습니다. (현재: {GetRelation(otherFactionId)})");
        _relations[otherFactionId] = DiplomaticState.NonAggression;
    }

    public void AddProvince(string provinceId)
    {
        if (_ownedProvinceIds.Contains(provinceId))
            throw new InvalidOperationException($"이미 소유한 영지입니다: {provinceId}");
        _ownedProvinceIds.Add(provinceId);
    }

    public bool RemoveProvince(string provinceId) => _ownedProvinceIds.Remove(provinceId);

    private void GuardNotSelf(string otherFactionId)
    {
        if (otherFactionId == Id)
            throw new ArgumentException("자기 자신과는 외교할 수 없습니다.", nameof(otherFactionId));
    }
}
