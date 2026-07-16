namespace WorldConquest.Core.Domain;

/// <summary>
/// 노드 그래프 경로 탐색 (설계문서 §2.1·§6.3). Phase 1 은 균일 홉 비용 BFS 최단 경로.
/// 지형 이동비용(§2.6) 가중 A* 는 부대 이동 밸런스가 필요한 시점에 확장한다.
/// </summary>
public static class Pathfinding
{
    /// <summary>
    /// start→goal 최단 경로(노드 id 목록, start·goal 포함). 경로가 없으면 null.
    /// <paramref name="edgeAllowed"/> 로 통과 가능한 간선 종류를 제한한다(예: 육로만·해로만).
    /// </summary>
    public static IReadOnlyList<string>? FindPath(
        WorldMap map, string start, string goal, Func<EdgeType, bool>? edgeAllowed = null)
    {
        if (start == goal) return new[] { start };

        var cameFrom = new Dictionary<string, string> { [start] = start };
        var queue = new Queue<string>();
        queue.Enqueue(start);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var next in map.GetAdjacent(current))
            {
                if (cameFrom.ContainsKey(next)) continue;
                var edge = map.GetEdgeType(current, next);
                if (edge is null) continue;
                if (edgeAllowed is not null && !edgeAllowed(edge.Value)) continue;

                cameFrom[next] = current;
                if (next == goal) return Reconstruct(cameFrom, start, goal);
                queue.Enqueue(next);
            }
        }
        return null;
    }

    private static List<string> Reconstruct(Dictionary<string, string> cameFrom, string start, string goal)
    {
        var path = new List<string>();
        for (var node = goal; node != start; node = cameFrom[node])
            path.Add(node);
        path.Add(start);
        path.Reverse();
        return path;
    }
}
