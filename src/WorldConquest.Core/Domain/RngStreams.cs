namespace WorldConquest.Core.Domain;

/// <summary>
/// 마스터 시드에서 결정적으로 파생되는 명명(named) 난수 스트림 집합 (설계문서 §4.4·§2.7.3·세이브 D8).
/// 스트림 간 소비 격리 [MUST] — 한 스트림의 난수 소비가 다른 스트림 시퀀스를 바꾸지 않는다.
/// v1 스트림: combat / world_events / summon:{factionId} / recruit:{factionId}. cinematic 은 무상태 해시 파생이라 여기서 관리하지 않는다.
/// </summary>
public sealed class RngStreams
{
    public const string Combat = "combat";
    public const string WorldEvents = "world_events";
    public static string Summon(string factionId) => $"summon:{factionId}";
    public static string Recruit(string factionId) => $"recruit:{factionId}";
    public static string Search(string factionId) => $"search:{factionId}";

    private readonly ulong _masterSeed;
    private readonly Dictionary<string, Pcg32> _streams = new();

    public RngStreams(ulong masterSeed) => _masterSeed = masterSeed;

    public ulong MasterSeed => _masterSeed;

    /// <summary>스트림 조회 — 없으면 마스터 시드 + 이름 해시로 결정적 파생 후 캐시.</summary>
    public Pcg32 Stream(string name)
    {
        if (!_streams.TryGetValue(name, out var s))
        {
            s = Derive(_masterSeed, name);
            _streams[name] = s;
        }
        return s;
    }

    /// <summary>세이브에서 스트림 상태 복원 (파생 대신 저장된 (state, inc) 주입).</summary>
    public void Restore(string name, ulong state, ulong inc) =>
        _streams[name] = Pcg32.FromState(state, inc);

    /// <summary>활성화(파생·복원·소비)된 스트림만의 상태 스냅샷 — 세이브 직렬화용.
    /// 미조회 스트림은 저장하지 않으며 로드 후 첫 조회 시 동일하게 재파생된다(D8).</summary>
    public IReadOnlyDictionary<string, Pcg32> Snapshot() => _streams;

    private static Pcg32 Derive(ulong master, string name)
    {
        // FNV-1a 64 로 이름 해시 → 이름이 다르면 스트림이 독립(seed·seq 분리).
        ulong h = 14695981039346656037UL;
        foreach (var ch in name)
            unchecked { h ^= ch; h *= 1099511628211UL; }
        unchecked { return new Pcg32(master ^ h, h); }
    }
}
