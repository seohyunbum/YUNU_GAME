using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>노드 그래프 경로 탐색 (§2.1·§6.3): 최단 경로·간선 제한·경로 없음.</summary>
public class PathfindingTests
{
    private static readonly WorldMap Map = new DataLoader().Load(TestPaths.RepoDataDir).Map;

    [Fact]
    public void 같은_노드는_자기자신_경로()
    {
        var path = Pathfinding.FindPath(Map, "hanseong", "hanseong");
        Assert.Equal(new[] { "hanseong" }, path);
    }

    [Fact]
    public void 인접_노드_직접_경로()
    {
        // 한성-부산은 인접 (§5.3 예시).
        var path = Pathfinding.FindPath(Map, "hanseong", "busan");
        Assert.NotNull(path);
        Assert.Equal("hanseong", path![0]);
        Assert.Equal("busan", path[^1]);
        Assert.Equal(2, path.Count);
    }

    [Fact]
    public void 다중_홉_경로_유효성()
    {
        // 전 노드가 연결된 그래프(DataLoader BFS 검증)이므로 임의 두 노드 간 경로가 존재하고,
        // 반환 경로의 인접쌍이 실제 간선이어야 한다.
        var path = Pathfinding.FindPath(Map, "hanseong", "baghdad");
        Assert.NotNull(path);
        Assert.Equal("hanseong", path![0]);
        Assert.Equal("baghdad", path[^1]);
        for (var i = 0; i + 1 < path.Count; i++)
            Assert.NotNull(Map.GetEdgeType(path[i], path[i + 1]));
    }

    [Fact]
    public void 육로만_허용시_해상경유_경로_차단()
    {
        // 도쿄(섬)는 항구/해로로만 대륙과 연결 → 육로(Land)만 허용하면 한성에서 도달 불가.
        var landOnly = Pathfinding.FindPath(Map, "hanseong", "tokyo", e => e == EdgeType.Land);
        var anyEdge = Pathfinding.FindPath(Map, "hanseong", "tokyo");
        Assert.Null(landOnly);
        Assert.NotNull(anyEdge);   // 제한 없으면 경로 존재
    }
}
