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
    AlreadyAssigned,   // 다른 부대가 이미 그 무장을 지휘관으로 씀
    NotYourCharacter,  // 소속(CharacterOwners) 세력이 아님 (§2.8 로스터 단일 장부)
    IsGovernor         // 태수와 겸직 불가 (§2.3.1 한 무장 = 한 보직)
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

/// <summary>
/// 게임 흐름 오케스트레이션 (설계문서 §4.2). 페이즈 전이(TurnSystem) + 페이즈별 시스템 실행.
/// 전투·내정 공식은 여기 두지 않는다(§4.4 God Class 금지) — 해당 시스템에 위임한다.
/// </summary>
public sealed class GameManager
{
    private readonly GameDatabase _db;
    private readonly InternalAffairsManager _internal;
    public GameState State { get; }

    /// <summary>Core→Presentation 이벤트 버스 (§4.3). CutsceneDirector 가 구독해 컷씬을 선택·발행한다.</summary>
    public EventBus Bus { get; }

    public GameManager(GameState state, GameDatabase db, EventBus? bus = null)
    {
        State = state;
        _db = db;
        Bus = bus ?? new EventBus();
        _internal = new InternalAffairsManager(state, db, Bus);   // 내정 공식 소유 (§4.4 God Class 금지)
        _ = new CutsceneDirector(state, db, Bus);   // 구독 등록 (§2.7.2)
    }

    /// <summary>다음 페이즈로 진행하고, 진입한 페이즈의 시스템을 실행한다.</summary>
    public void AdvancePhase()
    {
        TurnSystem.Advance(State);
        if (State.Phase == TurnPhase.Income) CollectIncome();
        else if (State.Phase == TurnPhase.AiAction) new AIController(State, _db, this).RunAll();   // §2.2 [4]
    }

    /// <summary>내정 시스템 (§2.3.1) — 태수·세율·민심·수입 미리보기 등 조회·명령의 진입점.</summary>
    public InternalAffairsManager Internal => _internal;

    /// <summary>수입 페이즈 (§2.2 [1]) — 내정 공식은 InternalAffairsManager 소유 (§4.4 God Class 금지).</summary>
    public void CollectIncome() => _internal.ProcessIncomePhase();

    /// <summary>시설 건설·업그레이드 (§2.3) — InternalAffairsManager 위임.</summary>
    public FacilityOutcome BuildFacility(string factionId, string provinceId, string facilityType) =>
        _internal.BuildFacility(factionId, provinceId, facilityType);

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
        _internal.OnProvinceTaken(provinceId, hostile: false);        // 무혈 점령 민심·태수 (§2.3.1)
        if (State.Progress.Add($"captured:{provinceId}"))
            faction.Mandate += _db.Rules.SummonIncomeFirstCapture;   // §2.8.3
        Bus.Publish(GameEvent.Of("ProvinceCaptured",                  // 표현층 연출용 (§4.3) — 무혈 점령
            ("faction", factionId), ("province", provinceId), ("bloodless", "true")));
        return CaptureOutcome.Success;
    }

    /// <summary>징병 (§2.3 병력 = 인구에서 징병) — InternalAffairsManager 위임. musterGeneralId 지정 시 군수 통솔 할인 (§2.3.2).</summary>
    public RecruitOutcome Recruit(string factionId, string provinceId, string unitTypeId, int count, string? musterGeneralId = null) =>
        _internal.Recruit(factionId, provinceId, unitTypeId, count, musterGeneralId);

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
        if (State.CharacterOwners.GetValueOrDefault(characterId) != factionId)
            return AssignOutcome.NotYourCharacter;   // 소속 무장만 (§2.8 단일 장부)
        if (State.Provinces.Any(p => p.GovernorId == characterId))
            return AssignOutcome.IsGovernor;         // 태수 겸직 불가 (§2.3.1)
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
            // 관계도 (외교 §5.2·E8): 해상전도 전투다. 이 분기는 PublishBattleEvents 를 호출하지 않고
            // 조기 return 하므로 훅을 여기 직접 건다 — 이벤트 발행 함수 안에 넣으면 누락된다.
            // 해상 방어측은 소유·동맹 필터가 없어 여러 세력이 섞일 수 있다(F3) → distinct 각각 적용.
            ApplyBattleFavor(factionId, enemyFleets.Select(f => f.FactionId));
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

        // 공동 수비 (§1.2 공동 전투): 영지 소유자 + 그 동맹의 주둔군이 함께 방어한다.
        var dip = new DiplomacyManager(State, _db);
        var defenders = State.Armies
            .Where(a => a.LocationNodeId == targetNodeId &&
                        (a.FactionId == owner.Id || dip.AreAllied(a.FactionId, owner.Id)) &&
                        a.FactionId != factionId)
            .Cast<MilitaryForce>().ToList();
        if (defenders.Count == 0)
        {
            // 주둔군 없는 적 영지 — 무저항 함락
            battle = new BattleResult(true, 0, 0, 0, Array.Empty<SkillEvent>());
            // 관계도 (외교 §5.2·E8): 이 분기도 조기 return 이라 훅을 직접 건다. 피 흘리진 않았어도
            // 영지를 빼앗겼으니 관계는 상한다(전투분보다 약하게).
            new RelationLedger(State, _db).Apply(factionId, owner.Id, FavorSource.BloodlessCapture);
            TransferProvince(owner, State.Factions.First(f => f.Id == factionId), targetNodeId, force);
            return AttackOutcome.AttackerWon;
        }

        // 전투 전 스냅샷 (결과 화면용 — §4.3 표현층이 전·후를 대비)
        var atkTroopsBefore = force.TotalTroops;
        var defTroopsBefore = defenders.Sum(d => d.TotalTroops);
        var atkCommander = force.CommanderId;
        var defCommander = defenders.FirstOrDefault(d => d.CommanderId is not null)?.CommanderId;

        battle = new CombatManager(_db).ResolveAuto(force, defenders, land, State.Rng.Stream(RngStreams.Combat), landing,
            _internal.DefenseBonusPct(targetNodeId));   // 성벽 등 시설 방어 보정 (§2.3.1·§2.6)

        // 전멸 부대 정리 (양측)
        State.Armies.RemoveAll(a => a.TotalTroops == 0);
        State.Fleets.RemoveAll(f => f.TotalTroops == 0);

        PublishBattleEvents(battle, targetNodeId, factionId, owner.Id,
            atkTroopsBefore, defTroopsBefore, atkCommander, defCommander);

        // 관계도 (외교 §5.2·E8): 공격자 ↔ **병력을 낸 모든 방어 세력** 각각.
        // 소유자 단독이 아니다 — 공동 수비(§1.2)로 동맹을 도와 피 흘린 세력이 어느 쌍에도
        // 안 걸리면 "동맹을 도와 싸워도 공격자와 관계가 나빠지지 않는" 구멍이 생긴다.
        ApplyBattleFavor(factionId, defenders.Select(d => d.FactionId));

        // 천명 보상 (§2.8.3): 전투 승자 + 일기토 승자
        var winnerFaction = battle.AttackerWon ? factionId : owner.Id;
        var wf = State.Factions.FirstOrDefault(f => f.Id == winnerFaction);
        if (wf is not null) wf.Mandate += _db.Rules.SummonIncomeBattleVictory;
        if (battle.Duel is not null)
        {
            var duelWinnerFaction = State.CharacterOwners.GetValueOrDefault(battle.Duel.WinnerCharacterId)
                ?? (battle.Duel.AttackerWon ? factionId : owner.Id);
            State.Factions.FirstOrDefault(f => f.Id == duelWinnerFaction)!.Mandate += _db.Rules.SummonIncomeDuelVictory;
        }

        if (!battle.AttackerWon) return AttackOutcome.DefenderHeld;
        // 영지 상실은 소유자 관계만 추가로 악화 (§5.2 — 도우러 온 동맹은 땅을 잃은 게 아니다)
        new RelationLedger(State, _db).Apply(factionId, owner.Id, FavorSource.ProvinceLost);
        TransferProvince(owner, State.Factions.First(f => f.Id == factionId), targetNodeId, force);
        return AttackOutcome.AttackerWon;
    }

    /// <summary>
    /// 전투 관계도 하락 — 공격자 ↔ 방어에 참여한 각 세력(distinct, ordinal 순으로 결정적).
    /// 자기 자신은 제외(공격자 함대가 방어측에 섞이는 F3 상황 방어).
    /// </summary>
    private void ApplyBattleFavor(string attackerId, IEnumerable<string> defenderFactionIds)
    {
        var led = new RelationLedger(State, _db);
        foreach (var d in defenderFactionIds
                     .Where(id => id != attackerId)
                     .Distinct()
                     .OrderBy(id => id, StringComparer.Ordinal))
            led.Apply(attackerId, d, FavorSource.BattleFought);
    }

    /// <summary>전투 결과를 불변 이벤트로 발행 (§4.3) — 컷씬 트리거·콘솔/UE5 결과 화면의 원천.</summary>
    private void PublishBattleEvents(BattleResult battle, string node,
        string attackerFaction, string defenderFaction,
        int attackerBefore, int defenderBefore, string? attackerCommander, string? defenderCommander)
    {
        if (battle.Duel is not null)
        {
            var d = battle.Duel;
            // 참가자별 관점 발행 — actor_is 조건이 어느 쪽 캐릭터든 매칭 가능하게
            Bus.Publish(GameEvent.Of("DuelStarted", ("actor", d.WinnerCharacterId), ("opponent", d.LoserCharacterId), ("node", node)));
            Bus.Publish(GameEvent.Of("DuelStarted", ("actor", d.LoserCharacterId), ("opponent", d.WinnerCharacterId), ("node", node)));
            Bus.Publish(GameEvent.Of("DuelEnded", ("actor", d.WinnerCharacterId), ("winner", "actor"), ("node", node)));
            Bus.Publish(GameEvent.Of("DuelEnded", ("actor", d.LoserCharacterId), ("winner", "opponent"), ("node", node)));
        }
        foreach (var ev in battle.SkillEvents.Where(e => e.SkillId != "duel"))
            Bus.Publish(GameEvent.Of("SkillExecuted", ("skill", ev.SkillId), ("side", ev.Side), ("node", node)));
        // 전투 결과 상세 — 표현층(전투 화면)이 양측 병력·손실·라운드·지휘관·일기토를 대비 표시
        Bus.Publish(GameEvent.Of("BattleEnded",
            ("node", node),
            ("attacker_won", battle.AttackerWon ? "true" : "false"),
            ("attacker_faction", attackerFaction), ("defender_faction", defenderFaction),
            ("attacker_before", attackerBefore.ToString()), ("defender_before", defenderBefore.ToString()),
            ("attacker_losses", battle.AttackerLosses.ToString()), ("defender_losses", battle.DefenderLosses.ToString()),
            ("rounds", battle.Rounds.ToString()),
            ("attacker_commander", attackerCommander ?? ""), ("defender_commander", defenderCommander ?? ""),
            ("duel_winner", battle.Duel?.WinnerCharacterId ?? ""), ("duel_loser", battle.Duel?.LoserCharacterId ?? "")));
    }

    private void TransferProvince(FactionState from, FactionState to, string provinceId, MilitaryForce occupier)
    {
        from.OwnedProvinceIds.Remove(provinceId);
        to.OwnedProvinceIds.Add(provinceId);
        _internal.OnProvinceTaken(provinceId, hostile: true);   // 전투 점령 민심·태수 해임 (§2.3.1)
        occupier.LocationNodeId = provinceId;   // 점령군 진주
        if (State.Progress.Add($"captured:{provinceId}"))       // 캠페인 최초 점령 (§2.8.3)
            to.Mandate += _db.Rules.SummonIncomeFirstCapture;
        // 키 계약: 무혈 점령(TryCapture)과 동일하게 faction 사용 — 표현층이 단일 경로로 소비 (§4.3)
        Bus.Publish(GameEvent.Of("ProvinceCaptured", ("faction", to.Id), ("province", provinceId), ("from", from.Id)));
    }

    /// <summary>
    /// 승리 판정 (§2.2 [7]·§1.2): 단독 = 한 세력이 전 육상 영지 소유.
    /// 공동 승리 = 두 인간 플레이어가 동맹 유지 + 합산 전 육상 영지 소유(각자 1개 이상).
    /// </summary>
    public IReadOnlyList<string> CheckVictory()
    {
        var totalLand = _db.Map.LandProvinces.Count();
        int LandOwned(FactionState f) => f.OwnedProvinceIds.Count(id => _db.Map.GetNode(id) is LandProvince);

        foreach (var faction in State.Factions)
            if (LandOwned(faction) == totalLand)
                return new[] { faction.Id };

        var p1 = State.Factions.FirstOrDefault(f => f.Controller == "human_p1");
        var p2 = State.Factions.FirstOrDefault(f => f.Controller == "human_p2");
        if (p1 is not null && p2 is not null && new DiplomacyManager(State, _db).AreAllied(p1.Id, p2.Id))
        {
            var a = LandOwned(p1); var b = LandOwned(p2);
            if (a > 0 && b > 0 && a + b == totalLand)
                return new[] { p1.Id, p2.Id };   // 공동 승리 (§1.2 [MUST])
        }
        return Array.Empty<string>();
    }

    /// <summary>단독 승리 편의 오버로드 (기존 호환).</summary>
    public bool IsVictory(out string? winnerFactionId)
    {
        var winners = CheckVictory();
        winnerFactionId = winners.Count == 1 ? winners[0] : null;
        return winners.Count > 0;
    }
}
