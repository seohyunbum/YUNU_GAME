namespace WorldConquest.Core.Domain;

/// <summary>
/// 게임 이벤트 — 불변 객체 (설계문서 §4.3 [MUST]). Type = 이벤트 종류(DuelEnded 등),
/// Data = 문자열 컨텍스트(actor·winner·node 등). Core 는 '무슨 일이 일어났는지'만 발행하고
/// 어떻게 보여줄지 모른다. 강타입 이벤트 정제는 Phase 3(오라클 시퀀스 비교)에서.
/// </summary>
public sealed record GameEvent(string Type, IReadOnlyDictionary<string, string> Data)
{
    public static GameEvent Of(string type, params (string Key, string Value)[] data) =>
        new(type, data.ToDictionary(kv => kv.Key, kv => kv.Value));

    public string? Get(string key) => Data.TryGetValue(key, out var v) ? v : null;
}

/// <summary>
/// Core → Presentation 이벤트 버스 (설계문서 §4.2·§4.3 [MUST]). 발행/구독만 — fire-and-forget,
/// 역방향 통지 채널 없음(§2.7.2). 콘솔·UE5 가 같은 이벤트를 각자 표현한다.
/// </summary>
public sealed class EventBus
{
    private readonly List<Action<GameEvent>> _subscribers = new();

    public void Subscribe(Action<GameEvent> handler) => _subscribers.Add(handler);

    public void Publish(GameEvent evt)
    {
        foreach (var s in _subscribers) s(evt);
    }
}
