namespace WorldConquest.Core.Domain;

/// <summary>턴 페이즈 순서·전이 규칙 (설계문서 §2.2·§4.2). GameState 만 다루는 순수 전이.</summary>
public static class TurnSystem
{
    private static readonly TurnPhase[] Order =
    {
        TurnPhase.Income, TurnPhase.Player1Command, TurnPhase.Player2Command,
        TurnPhase.AiAction, TurnPhase.Resolution, TurnPhase.Events, TurnPhase.VictoryCheck
    };

    public static TurnPhase Next(TurnPhase phase) =>
        Order[(Array.IndexOf(Order, phase) + 1) % Order.Length];

    /// <summary>다음 페이즈로 전이. VictoryCheck→Income 회귀 시 턴 증가. Actor 는 페이즈에서 도출(§2.2·D6).</summary>
    public static void Advance(GameState state)
    {
        var wrapping = state.Phase == TurnPhase.VictoryCheck;
        state.Phase = Next(state.Phase);
        if (wrapping) state.Turn++;
        state.Actor = ActorFor(state);
    }

    /// <summary>현재 페이즈의 행동 세력 id (플레이어 페이즈만; 시스템·AI 페이즈는 빈 문자열).</summary>
    public static string ActorFor(GameState state) => state.Phase switch
    {
        TurnPhase.Player1Command => ControllerFaction(state, "human_p1"),
        TurnPhase.Player2Command => ControllerFaction(state, "human_p2"),
        _ => ""
    };

    private static string ControllerFaction(GameState state, string controller) =>
        state.Factions.FirstOrDefault(f => f.Controller == controller)?.Id ?? "";
}
