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

/// <summary>징병 결과 (§2.3 병력 = 인구에서 징병).</summary>
public enum RecruitOutcome
{
    Success,
    InvalidCount,
    NoSuchFaction,
    NotOwnedLandProvince,
    UnknownUnit,
    InsufficientGold
}

/// <summary>부대 이동 결과 (§2.1 노드 그래프 · A*).</summary>
public enum MoveOutcome
{
    Success,
    NoSuchArmy,
    SameLocation,
    NoPath            // 육로·항구로 도달 불가
}

/// <summary>시설 건설·업그레이드 결과 (§2.3 내정).</summary>
public enum FacilityOutcome
{
    Success,
    NoSuchFaction,
    NotOwnedLandProvince,
    UnknownFacility,
    MaxLevelReached,
    NoFreeSlot,       // 새 시설인데 영지 시설 슬롯이 가득 참
    InsufficientGold
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

    /// <summary>수입 페이즈 (§2.2 [1]): 소유 육상 영지의 기본 생산량 + 시설 보너스(§2.3)를 정산한다.</summary>
    public void CollectIncome()
    {
        foreach (var faction in State.Factions)
            foreach (var provinceId in faction.OwnedProvinceIds)
                if (_db.Map.GetNode(provinceId) is LandProvince land)
                {
                    var y = land.Produce();
                    var (goldPct, foodPct) = FacilityBonus(provinceId);
                    // 정수 스케일 (§4.4). 곱은 long 으로 위드닝해 오버플로 방지.
                    faction.Treasury += (int)((long)y.Gold * (100 + goldPct) / 100);
                    faction.Food += (int)((long)y.Food * (100 + foodPct) / 100);
                }
    }

    /// <summary>영지의 시설 누적 생산 보너스(정수 %). 시설 상태가 없으면 0.</summary>
    private (int GoldPct, int FoodPct) FacilityBonus(string provinceId)
    {
        var ps = State.Provinces.FirstOrDefault(p => p.Id == provinceId);
        if (ps is null) return (0, 0);
        int gold = 0, food = 0;
        foreach (var (type, level) in ps.Facilities)
            if (_db.Rules.Facilities.TryGetValue(type, out var def))
            {
                gold += level * def.GoldBonusPctPerLevel;
                food += level * def.FoodBonusPctPerLevel;
            }
        return (gold, food);
    }

    /// <summary>시설 건설·업그레이드 (§2.3): 소유 육상 영지에 금을 지불해 시설 레벨을 올린다.</summary>
    public FacilityOutcome BuildFacility(string factionId, string provinceId, string facilityType)
    {
        var faction = State.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return FacilityOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land || !faction.OwnedProvinceIds.Contains(provinceId))
            return FacilityOutcome.NotOwnedLandProvince;
        if (!_db.Rules.Facilities.TryGetValue(facilityType, out var def))
            return FacilityOutcome.UnknownFacility;

        var ps = State.Provinces.FirstOrDefault(p => p.Id == provinceId);
        var level = ps?.Facilities.GetValueOrDefault(facilityType) ?? 0;
        if (level >= def.MaxLevel) return FacilityOutcome.MaxLevelReached;
        if (level == 0 && (ps?.Facilities.Count ?? 0) >= land.FacilitySlots) return FacilityOutcome.NoFreeSlot;
        if (faction.Treasury < def.CostGold) return FacilityOutcome.InsufficientGold;

        faction.Treasury -= def.CostGold;
        ps ??= CreateProvinceState(provinceId);
        ps.Facilities[facilityType] = level + 1;
        return FacilityOutcome.Success;
    }

    private ProvinceState CreateProvinceState(string provinceId)
    {
        var ps = new ProvinceState { Id = provinceId, Facilities = new() };
        State.Provinces.Add(ps);
        return ps;
    }

    /// <summary>
    /// 무혈 점령 (§2.2): 어느 세력도 소유하지 않은 빈 육상 영지를, 점령 세력의 소유 영지에 인접할 때 접수한다.
    /// 수비대·전투는 Phase 2 — 여기서는 빈 영지 접수만 (Phase 1 DoD '빈 영지 점령').
    /// </summary>
    public CaptureOutcome TryCapture(string factionId, string provinceId)
    {
        var faction = State.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return CaptureOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince) return CaptureOutcome.NotLandProvince;
        if (State.Factions.Any(f => f.OwnedProvinceIds.Contains(provinceId))) return CaptureOutcome.AlreadyOwned;
        if (!faction.OwnedProvinceIds.Any(owned => _db.Map.GetEdgeType(owned, provinceId) is not null))
            return CaptureOutcome.NotAdjacent;

        faction.OwnedProvinceIds.Add(provinceId);
        State.Progress.Add($"captured:{provinceId}");
        return CaptureOutcome.Success;
    }

    /// <summary>
    /// 징병 (§2.3): 소유 육상 영지에서 금을 지불해 병력을 편성한다. 영지에 주둔한 자기 부대에 합치거나 새로 만든다.
    /// 인구 감소는 ProvinceState 도입 시(Phase 1 확장) — 지금은 금 비용만.
    /// </summary>
    public RecruitOutcome Recruit(string factionId, string provinceId, string unitTypeId, int count)
    {
        if (count <= 0) return RecruitOutcome.InvalidCount;
        var faction = State.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return RecruitOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince || !faction.OwnedProvinceIds.Contains(provinceId))
            return RecruitOutcome.NotOwnedLandProvince;
        if (!_db.Units.TryGetValue(unitTypeId, out var unit))
            return RecruitOutcome.UnknownUnit;

        long cost = (long)unit.RecruitCostGold * count;   // long 승격 — 거대 count 곱 오버플로로 금 검사 우회 방지
        if (faction.Treasury < cost) return RecruitOutcome.InsufficientGold;

        faction.Treasury -= (int)cost;
        var army = State.Armies.FirstOrDefault(a => a.FactionId == factionId && a.LocationNodeId == provinceId)
                   ?? CreateArmy(factionId, provinceId);
        army.AddUnits(unitTypeId, count);
        return RecruitOutcome.Success;
    }

    /// <summary>부대 이동 (§2.1): 육로·항구 경로가 있으면 목적지로 이동한다. 이동력·턴 소비는 Phase 1 확장.</summary>
    public MoveOutcome MoveArmy(string armyId, string destProvinceId)
    {
        var army = State.Armies.FirstOrDefault(a => a.Id == armyId);
        if (army is null) return MoveOutcome.NoSuchArmy;
        if (army.LocationNodeId == destProvinceId) return MoveOutcome.SameLocation;

        // 육상 부대는 육로만. 상륙(Port 간선)·해역은 함대와 함께 Phase 2. 목적지도 육상 영지여야 한다.
        if (!_db.Map.TryGetNode(destProvinceId, out var dest) || dest is not LandProvince)
            return MoveOutcome.NoPath;
        var path = Pathfinding.FindPath(_db.Map, army.LocationNodeId, destProvinceId, e => e == EdgeType.Land);
        if (path is null) return MoveOutcome.NoPath;

        army.LocationNodeId = destProvinceId;
        return MoveOutcome.Success;
    }

    private Army CreateArmy(string factionId, string locationNodeId)
    {
        // 충돌 없는 최소 순번(fail-soft 로 중간 부대가 드롭돼도 기존 id 와 겹치지 않게).
        var existing = State.Armies.Select(a => a.Id).ToHashSet();
        var seq = 1;
        while (existing.Contains($"{factionId}_army_{seq}")) seq++;
        var army = new Army($"{factionId}_army_{seq}", factionId, locationNodeId);
        State.Armies.Add(army);
        return army;
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
