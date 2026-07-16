namespace WorldConquest.Core.Domain;

/// <summary>맵 노드 공통 부모 (설계문서 §2.1, §4.2). 육상 영지와 해상 거점이 상속한다.</summary>
public abstract class Province
{
    public string Id { get; }
    public string NameKo { get; }
    public string Region { get; }
    public IReadOnlyList<string> Adjacent { get; }

    protected Province(string id, string nameKo, string region, IReadOnlyList<string> adjacent)
    {
        Id = id;
        NameKo = nameKo;
        Region = region;
        Adjacent = adjacent;
    }
}
