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
    RequiresPortProvince,   // 해상 병종은 항구 영지에서만 건조 (§2.3 항구 시설·§2.1 port)
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

/// <summary>지휘관 임명 결과 (§2.4 — 부대에 무장 배치).</summary>
public enum AssignOutcome
{
    Success,
    NoSuchArmy,
    NotYourArmy,
    UnknownCharacter,
    AlreadyAssigned   // 다른 부대가 이미 그 무장을 지휘관으로 씀
}

/// <summary>공격 결과 (§2.6 자동 전투 점령).</summary>
public enum AttackOutcome
{
    AttackerWon,        // 수비 전멸 — 영지 점령
    DefenderHeld,       // 공격 부대 전멸 또는 교착(max_rounds) — 수비 승
    NoSuchArmy,
    NotYourArmy,
    NotAdjacent,        // 부대 위치에서 인접 아님 (육군=육로, 함대=해로/항구)
    NotEnemyProvince,   // 유효한 공격 대상이 아님 (빈 영지는 capture, 자기 영지 불가, 육군은 해역 불가)
    NoEnemyFleet        // 해역에 적 함대 없음
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
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land || !faction.OwnedProvinceIds.Contains(provinceId))
            return RecruitOutcome.NotOwnedLandProvince;
        if (!_db.Units.TryGetValue(unitTypeId, out var unit))
            return RecruitOutcome.UnknownUnit;
        var naval = unit.Domain == "naval";
        if (naval && !land.Port) return RecruitOutcome.RequiresPortProvince;   // 함선 건조 = 항구 영지만

        long cost = (long)unit.RecruitCostGold * count;   // long 승격 — 거대 count 곱 오버플로로 금 검사 우회 방지
        if (faction.Treasury < cost) return RecruitOutcome.InsufficientGold;

        faction.Treasury -= (int)cost;
        if (naval)
        {
            var fleet = State.Fleets.FirstOrDefault(f => f.FactionId == factionId && f.LocationNodeId == provinceId)
                        ?? CreateFleet(factionId, provinceId);
            fleet.AddUnits(unitTypeId, count);
        }
        else
        {
            var army = State.Armies.FirstOrDefault(a => a.FactionId == factionId && a.LocationNodeId == provinceId)
                       ?? CreateArmy(factionId, provinceId);
            army.AddUnits(unitTypeId, count);
        }
        return RecruitOutcome.Success;
    }

    /// <summary>
    /// 부대·함대 이동 (§2.1): 육군 = 육로·목적지 육상 / 함대 = 해로·항구 간선, 목적지 해역 또는 항구 육상(정박).
    /// 이동력·턴 소비는 후속 확장.
    /// </summary>
    public MoveOutcome MoveArmy(string forceId, string destNodeId)
    {
        var force = FindForce(forceId);
        if (force is null) return MoveOutcome.NoSuchArmy;
        if (force.LocationNodeId == destNodeId) return MoveOutcome.SameLocation;
        if (!_db.Map.TryGetNode(destNodeId, out var dest)) return MoveOutcome.NoPath;

        var isFleet = force is Fleet;
        var destOk = isFleet
            ? dest is SeaZone || (dest is LandProvince { Port: true })
            : dest is LandProvince;
        if (!destOk) return MoveOutcome.NoPath;

        var path = Pathfinding.FindPath(_db.Map, force.LocationNodeId, destNodeId,
            isFleet ? e => e is EdgeType.Sea or EdgeType.Port : e => e == EdgeType.Land);
        if (path is null) return MoveOutcome.NoPath;

        force.LocationNodeId = destNodeId;
        return MoveOutcome.Success;
    }

    private MilitaryForce? FindForce(string id) =>
        (MilitaryForce?)State.Armies.FirstOrDefault(a => a.Id == id)
        ?? State.Fleets.FirstOrDefault(f => f.Id == id);

    /// <summary>지휘관 임명 (§2.4): 부대·함대에 무장을 배치 — 패시브 상시·게이지 궁극기의 전제.</summary>
    public AssignOutcome AssignCommander(string factionId, string forceId, string characterId)
    {
        var force = FindForce(forceId);
        if (force is null) return AssignOutcome.NoSuchArmy;
        if (force.FactionId != factionId) return AssignOutcome.NotYourArmy;
        if (!_db.Characters.ContainsKey(characterId)) return AssignOutcome.UnknownCharacter;
        if (State.Armies.Any(a => a.Id != forceId && a.CommanderId == characterId) ||
            State.Fleets.Any(f => f.Id != forceId && f.CommanderId == characterId))
            return AssignOutcome.AlreadyAssigned;
        force.CommanderId = characterId;
        return AssignOutcome.Success;
    }

    /// <summary>
    /// 공격 (§2.6): 인접 적 육상 영지를 자동 전투로 공략. 승리 시 수비 부대 소멸·영지 점령·부대 진주.
    /// 패배 시 공격 부대 소멸. 병력 손실은 CombatManager 가 양측에 반영.
    /// </summary>
    public AttackOutcome Attack(string factionId, string forceId, string targetNodeId, out BattleResult? battle)
    {
        battle = null;
        var force = FindForce(forceId);
        if (force is null) return AttackOutcome.NoSuchArmy;
        if (force.FactionId != factionId) return AttackOutcome.NotYourArmy;
        if (!_db.Map.TryGetNode(targetNodeId, out var node)) return AttackOutcome.NotEnemyProvince;

        // ── 해상전 (§2.6 [MUST]): 함대가 인접 해역의 적 함대를 공격 ──
        if (force is Fleet && node is SeaZone sea)
        {
            if (_db.Map.GetEdgeType(force.LocationNodeId, targetNodeId) is not (EdgeType.Sea or EdgeType.Port))
                return AttackOutcome.NotAdjacent;
            var enemyFleets = State.Fleets
                .Where(f => f.FactionId != factionId && f.LocationNodeId == targetNodeId).ToList();
            if (enemyFleets.Count == 0) return AttackOutcome.NoEnemyFleet;

            battle = new CombatManager(_db).ResolveNaval(force, enemyFleets, sea, State.Rng.Stream(RngStreams.Combat));
            State.Fleets.RemoveAll(f => f.TotalTroops == 0);
            if (!battle.AttackerWon) return AttackOutcome.DefenderHeld;
            force.LocationNodeId = targetNodeId;   // 해역 장악 — 진출
            return AttackOutcome.AttackerWon;
        }

        if (node is not LandProvince land) return AttackOutcome.NotEnemyProvince;
        var owner = State.Factions.FirstOrDefault(f => f.OwnedProvinceIds.Contains(targetNodeId));
        if (owner is null || owner.Id == factionId) return AttackOutcome.NotEnemyProvince;   // 빈 영지=capture 로

        // 함대의 육상 공격 = 상륙전 (Port 간선, 첫 2턴 -25% §2.6 [MUST]) / 육군 = 육로
        var landing = force is Fleet;
        var requiredEdge = landing ? EdgeType.Port : EdgeType.Land;
        if (_db.Map.GetEdgeType(force.LocationNodeId, targetNodeId) != requiredEdge)
            return AttackOutcome.NotAdjacent;

        var defenders = State.Armies.Where(a => a.FactionId == owner.Id && a.LocationNodeId == targetNodeId)
            .Cast<MilitaryForce>().ToList();
        if (defenders.Count == 0)
        {
            // 주둔군 없는 적 영지 — 무저항 함락
            battle = new BattleResult(true, 0, 0, 0, Array.Empty<SkillEvent>());
            TransferProvince(owner, State.Factions.First(f => f.Id == factionId), targetNodeId, force);
            return AttackOutcome.AttackerWon;
        }

        battle = new CombatManager(_db).ResolveAuto(force, defenders, land, State.Rng.Stream(RngStreams.Combat), landing);

        // 전멸 부대 정리 (양측)
        State.Armies.RemoveAll(a => a.TotalTroops == 0);
        State.Fleets.RemoveAll(f => f.TotalTroops == 0);

        if (!battle.AttackerWon) return AttackOutcome.DefenderHeld;
        TransferProvince(owner, State.Factions.First(f => f.Id == factionId), targetNodeId, force);
        return AttackOutcome.AttackerWon;
    }

    private void TransferProvince(FactionState from, FactionState to, string provinceId, MilitaryForce occupier)
    {
        from.OwnedProvinceIds.Remove(provinceId);
        to.OwnedProvinceIds.Add(provinceId);
        occupier.LocationNodeId = provinceId;   // 점령군 진주
        State.Progress.Add($"captured:{provinceId}");
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

    private Fleet CreateFleet(string factionId, string locationNodeId)
    {
        var existing = State.Fleets.Select(f => f.Id).ToHashSet();
        var seq = 1;
        while (existing.Contains($"{factionId}_fleet_{seq}")) seq++;
        var fleet = new Fleet($"{factionId}_fleet_{seq}", factionId, locationNodeId);
        State.Fleets.Add(fleet);
        return fleet;
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
