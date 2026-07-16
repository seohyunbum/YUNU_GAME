using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>배치 시뮬 리포트 (§8): 세력별 승수·무승부·평균 게임 길이.</summary>
public sealed record SimReport(
    int Games,
    IReadOnlyDictionary<string, int> WinsByFaction,
    int Draws,
    int AverageTurns)
{
    /// <summary>최고 승률 % (무승부 제외 분모 아님 — 전체 판 기준, Phase 2 DoD '70% 초과 없음').</summary>
    public int MaxWinRatePct => Games == 0 ? 0
        : WinsByFaction.Count == 0 ? 0
        : WinsByFaction.Values.Max() * 100 / Games;

    /// <summary>판정승(턴캡 최다 영지) 판 수 — 정복승과 구분 표기용.</summary>
    public int DecisionWins { get; init; }
}

/// <summary>
/// AI 대 AI 자동 대전 N판 (설계문서 §8·Phase 2 DoD [SHOULD]). 판별 시드 = baseSeed + index —
/// 같은 시드는 같은 결과(§4.4 결정론), 리포트는 밸런스 판정(승률 70% 초과 없음)의 기계 근거.
/// </summary>
public static class BatchSimulator
{
    /// <summary>
    /// 1판 실행 — 승자 목록과 종료 턴. Decision=true 는 턴캡 도달 시 최다 육상 영지 판정승
    /// (시뮬 밸런스 측정 전용 — 스펙 §1 승리 조건은 세계 정복 그대로. 동률은 무승부).
    /// </summary>
    public static (IReadOnlyList<string> Winners, int Turns, bool Decision) RunOne(
        GameDatabase db, ulong seed, int turnCap = 200)
    {
        var state = GameSetup.AiCampaign(db, seed);
        var gm = new GameManager(state, db);
        gm.CollectIncome();   // 첫 턴 수입

        while (state.Turn <= turnCap)
        {
            gm.AdvancePhase();
            if (state.Phase == TurnPhase.VictoryCheck)
            {
                var winners = gm.CheckVictory();
                if (winners.Count > 0) return (winners, state.Turn, false);
            }
        }

        // 턴캡 — 최다 육상 영지 판정승
        var byLand = state.Factions
            .Select(f => (f.Id, Land: f.OwnedProvinceIds.Count(id => db.Map.GetNode(id) is LandProvince)))
            .OrderByDescending(x => x.Land).ThenBy(x => x.Id, StringComparer.Ordinal)
            .ToList();
        if (byLand.Count >= 2 && byLand[0].Land > byLand[1].Land && byLand[0].Land > 0)
            return (new[] { byLand[0].Id }, turnCap, true);
        return (Array.Empty<string>(), turnCap, false);
    }

    public static SimReport Run(GameDatabase db, int games, ulong baseSeed = 1000, int turnCap = 200)
    {
        var wins = new Dictionary<string, int>();
        var draws = 0;
        var decisions = 0;
        long totalTurns = 0;

        for (var i = 0; i < games; i++)
        {
            var (winners, turns, decision) = RunOne(db, baseSeed + (ulong)i, turnCap);
            totalTurns += turns;
            if (decision) decisions++;
            if (winners.Count == 0) draws++;
            else foreach (var w in winners)
                wins[w] = wins.GetValueOrDefault(w) + 1;
        }

        return new SimReport(games, wins, draws, games == 0 ? 0 : (int)(totalTurns / games))
        { DecisionWins = decisions };
    }
}
