namespace WorldConquest.Core.Tests;

/// <summary>
/// 레이어 분리 정적 게이트 (설계문서 §4.1·§0.3-5): Core 는 순수 C# — 외부 패키지·표현층 의존 0.
/// honor-system 이 아니라 테스트로 기계 강제한다. 화이트리스트가 아닌 0-tolerance 불변식.
/// </summary>
public class ArchitectureTests
{
    private static readonly string CoreDir = LocateCore();

    private static string LocateCore()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "src", "WorldConquest.Core");
            if (File.Exists(Path.Combine(candidate, "WorldConquest.Core.csproj")))
                return candidate;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Core 프로젝트를 찾을 수 없습니다.");
    }

    [Fact]
    public void Core는_외부_패키지나_프로젝트를_참조하지_않는다()
    {
        var csproj = File.ReadAllText(Path.Combine(CoreDir, "WorldConquest.Core.csproj"));
        Assert.DoesNotContain("<PackageReference", csproj);
        Assert.DoesNotContain("<ProjectReference", csproj);
    }

    [Fact]
    public void Core는_표현층_네임스페이스나_콘솔API를_사용하지_않는다()
    {
        // 컴파일러가 못 잡는 나머지 절반: 표현층 using·Console 직접 호출 (§4.1 의존 방향, §0.3-5 엔진 의존 금지).
        string[] forbidden =
            { "UnityEngine", "UnrealEngine", "Godot", "System.Windows", "Avalonia", "Console." };
        var sep = Path.DirectorySeparatorChar;
        var violations = new List<string>();
        foreach (var file in Directory.EnumerateFiles(CoreDir, "*.cs", SearchOption.AllDirectories))
        {
            if (file.Contains($"{sep}bin{sep}") || file.Contains($"{sep}obj{sep}")) continue;
            var text = File.ReadAllText(file);
            foreach (var pat in forbidden)
                if (text.Contains(pat))
                    violations.Add($"{Path.GetFileName(file)}: '{pat}'");
        }
        Assert.True(violations.Count == 0, "Core 레이어 금지 참조 발견:\n" + string.Join("\n", violations));
    }
}
