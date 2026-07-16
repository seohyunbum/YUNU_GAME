using System.Text.Json;
using System.Text.Json.Nodes;
using WorldConquest.Core.Data;

namespace WorldConquest.Core.Tests;

/// <summary>repo의 실제 data/ 폴더 위치를 찾는다 (테스트 실행 위치 무관).</summary>
internal static class TestPaths
{
    public static string RepoDataDir { get; } = Locate();

    private static string Locate()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "data");
            if (File.Exists(Path.Combine(candidate, DataLoader.RulesFile)))
                return candidate;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("repo의 data/ 폴더를 찾을 수 없습니다.");
    }
}

/// <summary>
/// 실데이터의 사본을 만들어 JSON을 변조(mutate)할 수 있는 임시 데이터 폴더.
/// 부정 케이스(깨진 참조·범위 위반 등) 검증용 — 설계문서 §5.5, Phase 0 DoD.
/// </summary>
internal sealed class MutableDataDir : IDisposable
{
    public string Path { get; }

    public MutableDataDir()
    {
        Path = System.IO.Path.Combine(AppContext.BaseDirectory, "fixtures", Guid.NewGuid().ToString("N"));
        CopyDirectory(TestPaths.RepoDataDir, Path);
    }

    public void Mutate(string relFile, Action<JsonNode> mutate)
    {
        var full = System.IO.Path.Combine(Path, relFile);
        var node = JsonNode.Parse(File.ReadAllText(full))
                   ?? throw new InvalidOperationException($"파싱 실패: {relFile}");
        mutate(node);
        File.WriteAllText(full, node.ToJsonString());
    }

    public void Dispose()
    {
        try { Directory.Delete(Path, recursive: true); } catch { /* 테스트 정리 실패는 무시 */ }
    }

    private static void CopyDirectory(string source, string dest)
    {
        Directory.CreateDirectory(dest);
        foreach (var file in Directory.GetFiles(source))
            File.Copy(file, System.IO.Path.Combine(dest, System.IO.Path.GetFileName(file)));
        foreach (var dir in Directory.GetDirectories(source))
            CopyDirectory(dir, System.IO.Path.Combine(dest, System.IO.Path.GetFileName(dir)));
    }
}
