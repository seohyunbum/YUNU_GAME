namespace WorldConquest.Core.Domain;

/// <summary>
/// 맵 노드의 보드지도 좌표 (렌더링용, 0~1000×0~700 데포르메 캔버스).
/// 게임 규칙 계산에는 절대 사용하지 않는다 — 거리·인접은 그래프(Adjacent·edges)가 SSOT.
/// </summary>
public readonly record struct MapPos(int X, int Y);

/// <summary>맵 노드 공통 부모 (설계문서 §2.1, §4.2). 육상 영지와 해상 거점이 상속한다.</summary>
public abstract class Province
{
    public string Id { get; }
    public string NameKo { get; }
    public string Region { get; }
    public IReadOnlyList<string> Adjacent { get; }

    /// <summary>보드지도 좌표 — 그래픽 클라이언트(UE5 등)의 노드 배치용.</summary>
    public MapPos MapPos { get; init; }

    protected Province(string id, string nameKo, string region, IReadOnlyList<string> adjacent)
    {
        Id = id;
        NameKo = nameKo;
        Region = region;
        Adjacent = adjacent;
    }
}
