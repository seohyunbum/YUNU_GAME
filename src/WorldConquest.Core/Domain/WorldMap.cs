namespace WorldConquest.Core.Domain;

/// <summary>간선 종류 (설계문서 §2.1): 육로 / 해로 / 항구(육상↔해상 전환, 상륙전 발생 지점).</summary>
public enum EdgeType
{
    Land,
    Sea,
    Port
}

/// <summary>무방향 간선. From/To 순서는 의미 없음.</summary>
public sealed record MapEdge(string From, string To, EdgeType Type);

/// <summary>
/// 노드 그래프 세계 지도 (설계문서 §2.1). 검증(참조 무결성·연결성)은 DataLoader가 끝낸 뒤
/// 생성되므로, 이 클래스는 유효한 그래프를 전제한다.
/// </summary>
public sealed class WorldMap
{
    private readonly Dictionary<string, Province> _nodes;
    private readonly Dictionary<(string, string), EdgeType> _edgeIndex;

    public IReadOnlyDictionary<string, Province> Nodes => _nodes;
    public IReadOnlyList<MapEdge> Edges { get; }

    public WorldMap(IEnumerable<Province> nodes, IReadOnlyList<MapEdge> edges)
    {
        _nodes = nodes.ToDictionary(n => n.Id);
        Edges = edges;
        _edgeIndex = new Dictionary<(string, string), EdgeType>();
        foreach (var e in edges)
        {
            _edgeIndex[(e.From, e.To)] = e.Type;
            _edgeIndex[(e.To, e.From)] = e.Type;
        }
    }

    public Province GetNode(string id) => _nodes[id];

    public IReadOnlyList<string> GetAdjacent(string nodeId) => _nodes[nodeId].Adjacent;

    /// <summary>두 노드 사이 간선 종류. 인접하지 않으면 null.</summary>
    public EdgeType? GetEdgeType(string a, string b) =>
        _edgeIndex.TryGetValue((a, b), out var t) ? t : null;

    public IEnumerable<LandProvince> LandProvinces => _nodes.Values.OfType<LandProvince>();
    public IEnumerable<SeaZone> SeaZones => _nodes.Values.OfType<SeaZone>();
}
