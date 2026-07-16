using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>무혈 점령 시도 결과 (§2.2 무혈 점령 — 수비대 0 빈 영지).</summary>
public enum CaptureOutcome
{
    Success,
    NoSuchFaction,
    NotLandProvince,
    AlreadyOwned,     // 어느 세력이든 이미 소유 (빈 영지 아님)
    NotAdjacent       // 점령 세력의 소유 영지에 인접하지 않음
}

/// <summary>
/// 게임 흐름 오케스트레이션 (설계문서 §4.2). 페이즈 전이(TurnSystem) + 페이즈별 시스템 실행.
/// 전투·내정 공식은 여기 두지 않는다(§4.4 God Class 금지) — 해당 시스템에 위임한다.
/// </summary>
public sealed class GameManager
{
    private readonly GameDatabase _db;
    public GameState State { get; }

    public GameManager(GameState state, GameDatabase db)
    {
        State = state;
        _db = db;
    }

    /// <summary>다음 페이즈로 진행하고, 진입한 페이즈의 시스템을 실행한다.</summary>
    public void AdvancePhase()
    {
        TurnSystem.Advance(State);
        if (State.Phase == TurnPhase.Income) CollectIncome();
    }

    /// <summary>수입 페이즈 (§2.2 [1]): 각 세력이 소유 육상 영지의 기본 생산량을 정산한다.</summary>
    public void CollectIncome()
    {
        foreach (var faction in State.Factions)
            foreach (var provinceId in faction.OwnedProvinceIds)
                if (_db.Map.GetNode(provinceId) is LandProvince land)
                {
                    var yield = land.Produce();
                    faction.Treasury += yield.Gold;
                    faction.Food += yield.Food;
                }
    }

    /// <summary>
    /// 무혈 점령 (§2.2): 어느 세력도 소유하지 않은 빈 육상 영지를, 점령 세력의 소유 영지에 인접할 때 접수한다.
    /// 수비대·전투는 Phase 2 — 여기서는 빈 영지 접수만 (Phase 1 DoD '빈 영지 점령').
    /// </summary>
    public CaptureOutcome TryCapture(string factionId, string provinceId)
    {
        var faction = State.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return CaptureOutcome.NoSuchFaction;
        if (_db.Map.GetNode(provinceId) is not LandProvince) return CaptureOutcome.NotLandProvince;
        if (State.Factions.Any(f => f.OwnedProvinceIds.Contains(provinceId))) return CaptureOutcome.AlreadyOwned;
        if (!faction.OwnedProvinceIds.Any(owned => _db.Map.GetEdgeType(owned, provinceId) is not null))
            return CaptureOutcome.NotAdjacent;

        faction.OwnedProvinceIds.Add(provinceId);
        State.Progress.Add($"captured:{provinceId}");
        return CaptureOutcome.Success;
    }

    /// <summary>승리 판정 (§2.2 [7] stub): 한 세력이 전 육상 영지를 소유하면 승리.</summary>
    public bool IsVictory(out string? winnerFactionId)
    {
        var totalLand = _db.Map.LandProvinces.Count();
        foreach (var faction in State.Factions)
        {
            var landOwned = faction.OwnedProvinceIds.Count(id => _db.Map.GetNode(id) is LandProvince);
            if (landOwned == totalLand)
            {
                winnerFactionId = faction.Id;
                return true;
            }
        }
        winnerFactionId = null;
        return false;
    }
}
