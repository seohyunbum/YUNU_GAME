using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>드라이버 정지 사유 — 인간 입력 대기 또는 게임 종료.</summary>
public enum DriverStop { NeedInput, GameEnded }

/// <summary>
/// 페이즈 오케스트레이션 드라이버 (UE5 설계 §2.3 [MUST]) — "다음 인간 입력 지점(또는 게임 종료)까지
/// 자동 페이즈 전진"의 단일 구현. PlaySession(콘솔)과 GameSessionHost(API)가 반드시 이것을 공유한다
/// — 첫 턴 수입 이중정산·페이즈 스킵 규칙이 표현층마다 갈라지는 것을 구조적으로 차단.
/// 턴 시작·게임 종료는 EventBus 이벤트(TurnStarted·GameEnded)로 발행해 모든 표현층이 같은 신호를 받는다.
/// </summary>
public static class SessionDriver
{
    /// <summary>페이즈 전진 안전 상한 — 인간 컨트롤러가 전무한 상태의 무한 루프 방어.</summary>
    private const int MaxSteps = 100_000;

    /// <summary>
    /// 인간 입력 페이즈(Actor 존재) 또는 게임 종료까지 페이즈를 전진시킨다.
    /// 호출 전제: 새 캠페인은 호출자가 CollectIncome() 을 이미 정산했다 (Program·GameSetup 규약 유지).
    /// Income 페이즈에 '머물러 있는' 상태에서는 재정산하지 않고 TurnStarted 발행 후 전진만 한다.
    /// </summary>
    public static DriverStop AdvanceUntilInput(GameManager gm, out IReadOnlyList<string> winners)
    {
        var s = gm.State;
        for (var step = 0; step < MaxSteps; step++)
        {
            switch (s.Phase)
            {
                case TurnPhase.Player1Command:
                case TurnPhase.Player2Command:
                    if (s.Actor.Length > 0) { winners = Array.Empty<string>(); return DriverStop.NeedInput; }
                    gm.AdvancePhase();   // 해당 컨트롤러 부재(solo 의 P2 등) → 자동 스킵
                    break;

                case TurnPhase.Income:
                    // 정산 자체는 GameManager.AdvancePhase 의 Income '진입' 시 실행됨 — 여기는 통과만.
                    gm.Bus.Publish(GameEvent.Of("TurnStarted", ("turn", s.Turn.ToString())));
                    gm.AdvancePhase();
                    break;

                case TurnPhase.VictoryCheck:
                    var w = gm.CheckVictory();
                    if (w.Count > 0)
                    {
                        gm.Bus.Publish(GameEvent.Of("GameEnded",
                            ("outcome", w.Count > 1 ? "joint_victory" : "conquest"),
                            ("winners", string.Join(",", w))));
                        winners = w;
                        return DriverStop.GameEnded;
                    }
                    gm.AdvancePhase();
                    break;

                default:   // AiAction · Resolution · Events — 시스템 페이즈 자동 통과
                    gm.AdvancePhase();
                    break;
            }
        }
        throw new InvalidOperationException("SessionDriver: 페이즈 전진 상한 초과 — 인간 컨트롤러 부재 상태로 추정");
    }
}
