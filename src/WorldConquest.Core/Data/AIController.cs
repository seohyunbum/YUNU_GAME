using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// AI 세력 의사결정 — 규칙 기반 우선순위 스코어링 (설계문서 §2.6 [SHOULD]·§4.2·전투 C8).
/// 난수 없이 결정적(ordinal 순회)이라 시드 리플레이(§8)와 자동 정합. AI 성향(ai_disposition)과
/// 난이도 보정(ai_aggression ×100)은 factions.json 데이터 (§5 — 성향별 if문은 데이터 값 해석만).
/// 시간 예산(§6.3 50ms)은 규칙 기반 특성상 여유가 커 계측은 배치 시뮬 성능 관측 시 도입.
/// </summary>
public sealed class AIController
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly GameManager _gm;

    public AIController(GameState state, GameDatabase db, GameManager gm)
    {
        _state = state;
        _db = db;
        _gm = gm;
    }

    /// <summary>AI 페이즈 (§2.2 [4]): 모든 AI 세력이 id ordinal 순으로 행동한다.</summary>
    public void RunAll()
    {
        foreach (var faction in _state.Factions
                     .Where(f => f.Controller == "ai")
                     .OrderBy(f => f.Id, StringComparer.Ordinal))
            TakeTurn(faction);
    }

    private void TakeTurn(FactionState faction)
    {
        if (faction.OwnedProvinceIds.Count == 0) return;   // 멸망 세력
        var def = _db.Factions[faction.Id];

        MergeStacks(faction);            // 같은 위치 소부대 병합 — 개별 threshold 교착 방지
        CaptureEmptyNeighbors(faction);
        ManageInternalAffairs(faction);  // 태수 파견·시설 투자 (§2.3.1 — 전선 행동 전 예산 배분)

        var landReachable = LandReachableEnemyExists(faction);
        if (landReachable)
        {
            RecruitByDisposition(faction, def);
            AttackWeakNeighbors(faction, def);
            AdvanceTowardEnemies(faction);   // 공격 기회가 없던 부대는 전선으로 진군
        }
        else
        {
            // 고립(대륙 통일 등) — 육군 증강은 낭비. 해군에 예산 집중해 원정 (§1.1 대륙 간 정복)
            NavalOperations(faction, def);
        }
    }

    // ── 관계 술어 (외교 설계 E13) ───────────────────────────────────────────────
    // 두 술어는 의미가 다르다. 섞으면 AI 가 죽는다:
    //  · IsHostile   = "공격해도 되는가" — 동맹·불가침 제외.
    //  · IsNonAllied = "동맹이 아닌가"   — 동맹만 제외(불가침 포함).
    // LandReachableEnemyExists 는 공격 필터가 아니라 **분기 게이트**다(false 면 징병 포함
    // 육상 분기 전체를 건너뛰고 해상 원정으로 간다). 여기에 IsHostile 을 쓰면 육상 이웃
    // 전부와 불가침인 세력이 '고립' 판정 → NavalOperations 도 목표 0 으로 즉시 return →
    // 징병조차 못 하는 영구 무행동에 빠진다(불가침은 만료가 없어 회복 경로도 없음).
    // 따라서 전선 판정(LandReachableEnemyExists·RecruitByDisposition 교두보)은 IsNonAllied 를 쓴다.

    /// <summary>공격 대상으로 삼아도 되는가 — 동맹·불가침은 제외 (§1.2).</summary>
    private static bool IsHostile(FactionState faction, string otherId)
    {
        var r = faction.Relations.GetValueOrDefault(otherId);
        return r != DiplomaticState.Alliance && r != DiplomaticState.NonAggression;
    }

    /// <summary>동맹이 아닌가 — 전선·교두보 판정용(불가침 상대도 '전선'으로 센다).</summary>
    private static bool IsNonAllied(FactionState faction, string otherId) =>
        faction.Relations.GetValueOrDefault(otherId) != DiplomaticState.Alliance;

    /// <summary>육로로 도달 가능한 (비동맹) 적 육상 영지가 존재하는가.</summary>
    private bool LandReachableEnemyExists(FactionState faction)
    {
        var enemyLand = _state.Factions
            .Where(f => f.Id != faction.Id && IsNonAllied(faction, f.Id))
            .SelectMany(f => f.OwnedProvinceIds)
            .Where(id => _db.Map.GetNode(id) is LandProvince)
            .ToList();
        return faction.OwnedProvinceIds.Any(own =>
            enemyLand.Any(t => Pathfinding.FindPath(_db.Map, own, t, e => e == EdgeType.Land) is not null));
    }

    /// <summary>같은 노드의 자기 부대·함대들을 ordinal 첫 스택으로 흡수 병합 (지휘관은 첫 유효값 유지).</summary>
    private void MergeStacks(FactionState faction)
    {
        Merge(_state.Armies.Where(a => a.FactionId == faction.Id).Cast<MilitaryForce>(),
            f => _state.Armies.Remove((Army)f));
        Merge(_state.Fleets.Where(f => f.FactionId == faction.Id).Cast<MilitaryForce>(),
            f => _state.Fleets.Remove((Fleet)f));

        static void Merge(IEnumerable<MilitaryForce> forces, Action<MilitaryForce> remove)
        {
            foreach (var group in forces.GroupBy(a => a.LocationNodeId).Where(g => g.Count() > 1).ToList())
            {
                var ordered = group.OrderBy(a => a.Id, StringComparer.Ordinal).ToList();
                var host = ordered[0];
                foreach (var other in ordered.Skip(1))
                {
                    foreach (var (unitId, count) in other.Units.ToList())
                    {
                        other.RemoveUnits(unitId, count);
                        host.AddUnits(unitId, count);
                    }
                    host.CommanderId ??= other.CommanderId;
                    remove(other);
                }
            }
        }
    }

    /// <summary>
    /// 5) 해상 원정 — 육로 목표가 없을 때(고립·대륙 통일): 항구에서 함대에 예산 집중(90%) →
    /// 적 항구 영지를 향해 해로 진출 → 전력 우위면 상륙 공격. 상륙 후엔 교두보 징병이 육상 정복 재개.
    /// </summary>
    private void NavalOperations(FactionState faction, Faction def)
    {
        var enemyTargets = _state.Factions
            .Where(f => f.Id != faction.Id && IsNonAllied(faction, f.Id))
            .SelectMany(f => f.OwnedProvinceIds)
            .Where(id => _db.Map.GetNode(id) is LandProvince)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();
        if (enemyTargets.Count == 0) return;

        var portTargets = enemyTargets.Where(t => _db.Map.GetNode(t) is LandProvince { Port: true }).ToList();
        if (portTargets.Count == 0) return;   // 상륙 지점 없음 (적이 전부 내륙 — 후속: 수송)

        // 함대 건조 (자기 항구 영지에서, 고립 상태라 예산 집중 90%)
        var homePort = faction.OwnedProvinceIds
            .Where(id => _db.Map.GetNode(id) is LandProvince { Port: true })
            .OrderBy(id => id, StringComparer.Ordinal)
            .FirstOrDefault();
        if (homePort is not null && _db.Units.TryGetValue("medium_ship", out var ship))
        {
            var count = (int)((long)faction.Treasury * 90 / 100 / ship.RecruitCostGold);
            if (count > 0) _gm.Recruit(faction.Id, homePort, "medium_ship", count);
        }

        // 함대 기동: 상륙 가능 위치면 전력 판정 후 상륙, 아니면 목표 직전 해역으로 진출
        foreach (var fleet in _state.Fleets
                     .Where(f => f.FactionId == faction.Id && f.TotalTroops > 0)
                     .OrderBy(f => f.Id, StringComparer.Ordinal)
                     .ToList())
        {
            var adjacentPort = portTargets.FirstOrDefault(t =>
                _db.Map.GetEdgeType(fleet.LocationNodeId, t) == EdgeType.Port);
            if (adjacentPort is not null)
            {
                var garrison = _state.Armies
                    .Where(a => a.LocationNodeId == adjacentPort && a.FactionId != faction.Id)
                    .Sum(a => a.TotalTroops);
                var threshold = (long)garrison * 150 / Math.Max(1, def.AiAggression);
                // 함선 1척의 전투가치 ≈ 보병 3인 (atk/def 스탯비 기반 휴리스틱 — 병력 수 직접 비교는 함대에 과소평가)
                if ((long)fleet.TotalTroops * 3 > threshold)
                    _gm.Attack(faction.Id, fleet.Id, adjacentPort, out _);
                continue;   // 전력 부족이면 해역 대기 (증원 함대가 병합해 성장)
            }

            IReadOnlyList<string>? best = null;
            foreach (var t in portTargets)
            {
                var path = Pathfinding.FindPath(_db.Map, fleet.LocationNodeId, t,
                    e => e is EdgeType.Sea or EdgeType.Port);
                if (path is not null && path.Count >= 2 && (best is null || path.Count < best.Count))
                    best = path;
            }
            if (best is not null)
                _gm.MoveArmy(fleet.Id, best[^2]);   // 상륙 목표 직전 해역
        }
    }

    /// <summary>
    /// 1.5) 내정 (§2.3.1·§2.3.2): ①보직 없는 소속 무장을 정치 순으로 태수 공석 영지(생산 순)에 파견
    /// ②여유 자금(비용 3배 보유) 시 최고 생산 영지부터 시설 우선순위대로 턴당 1건 건설
    /// ③남은 유휴 무장을 상업·농업 개발에 파견(정치 순, 여유 자금 가드) — 수치제 경제 성장 (§2.3.2).
    /// 전부 ordinal 정렬 — 난수 없이 결정적.
    /// </summary>
    private void ManageInternalAffairs(FactionState faction)
    {
        var ia = _gm.Internal;

        // ① 태수 파견 — 후보: 소속 && 지휘관 아님 && 태수 아님, 정치 내림차순
        var vacant = faction.OwnedProvinceIds
            .Where(pid => _db.Map.GetNode(pid) is LandProvince && ia.GovernorOf(pid) is null)
            .OrderByDescending(pid =>
            {
                var land = (LandProvince)_db.Map.GetNode(pid);
                return land.BaseProduction.Gold + land.BaseProduction.Food;
            })
            .ThenBy(pid => pid, StringComparer.Ordinal)
            .ToList();
        foreach (var (pid, cid) in vacant.Zip(IdleGenerals(faction)))
            ia.AppointGovernor(faction.Id, pid, cid);

        // ② 시설 투자 — 경제·기술 우선, 여유 자금일 때만 (전비 잠식 방지), 턴당 1건
        var provincesByYield = faction.OwnedProvinceIds
            .Where(pid => _db.Map.GetNode(pid) is LandProvince)
            .OrderByDescending(pid =>
            {
                var land = (LandProvince)_db.Map.GetNode(pid);
                return land.BaseProduction.Gold + land.BaseProduction.Food;
            })
            .ThenBy(pid => pid, StringComparer.Ordinal)
            .ToList();
        BuildOneFacility(faction, provincesByYield);   // 턴당 1건 (건설했으면 그걸로, 없으면 스킵)

        // ③ 개발 파견 (§2.3.2): 남은 유휴 무장을 상업·농업이 상한 미달인 영지에 정치 순으로 파견.
        // 여유 자금 가드(비용 3배) — 전비 잠식 방지. 무장 1명 = 1영지(ActedCharacterIds 로 자동 제한).
        var candidates = provincesByYield
            .SelectMany(pid => new[]
            {
                (pid, kind: "commerce", head: ia.CommerceMax(pid) - ia.GetCommerce(pid)),
                (pid, kind: "agriculture", head: ia.AgricultureMax(pid) - ia.GetAgriculture(pid))
            })
            .Where(x => x.head > 0)
            .OrderByDescending(x => x.head).ThenBy(x => x.pid, StringComparer.Ordinal).ThenBy(x => x.kind, StringComparer.Ordinal)
            .ToList();
        if (candidates.Count == 0) return;
        var ci = 0;
        foreach (var cid in IdleGenerals(faction))
        {
            if (faction.Treasury < (long)_db.Rules.DevCostGold * 3) break;   // 여유 자금 가드
            var pick = candidates[ci % candidates.Count];
            ia.Develop(faction.Id, pick.pid, pick.kind, cid);
            ci++;
        }
    }

    /// <summary>여유 자금(비용 3배) 시 생산 높은 영지부터 시설 우선순위대로 턴당 1건 건설.</summary>
    private void BuildOneFacility(FactionState faction, List<string> provincesByYield)
    {
        var ia = _gm.Internal;
        foreach (var ftype in new[] { "port", "academy", "barracks", "walls" })
        {
            if (!_db.Rules.Facilities.TryGetValue(ftype, out var def)) continue;
            if (faction.Treasury < (long)def.CostGold * 3) continue;   // 여유 자금 가드
            foreach (var pid in provincesByYield)
                if (ia.BuildFacility(faction.Id, pid, ftype) == FacilityOutcome.Success)
                    return;   // 턴당 1건
        }
    }

    /// <summary>보직 없는(지휘관·태수 아님) && 이번 턴 미행동 소속 무장 — 정치 내림차순·ordinal. 파견 후보.</summary>
    private IEnumerable<string> IdleGenerals(FactionState faction) =>
        _state.CharacterOwners
            .Where(kv => kv.Value == faction.Id && _db.Characters.ContainsKey(kv.Key))
            .Select(kv => kv.Key)
            .Where(id => !_state.Armies.Any(a => a.CommanderId == id) &&
                         !_state.Fleets.Any(f => f.CommanderId == id) &&
                         _gm.Internal.GovernorProvinceOf(id) is null &&
                         !faction.ActedCharacterIds.Contains(id))
            .OrderByDescending(id => _db.Characters[id].Stats.Pol)
            .ThenBy(id => id, StringComparer.Ordinal)
            .ToList();

    /// <summary>1) 인접 빈 육상 영지 무혈 점령 — 모든 성향 공통 (확장은 공짜).</summary>
    private void CaptureEmptyNeighbors(FactionState faction)
    {
        var allOwned = _state.Factions.SelectMany(f => f.OwnedProvinceIds).ToHashSet();
        var targets = faction.OwnedProvinceIds
            .SelectMany(id => _db.Map.GetAdjacent(id))
            .Distinct()
            .Where(a => _db.Map.GetNode(a) is LandProvince && !allOwned.Contains(a))
            .OrderBy(a => a, StringComparer.Ordinal)
            .ToList();
        foreach (var t in targets)
            _gm.TryCapture(faction.Id, t);
    }

    /// <summary>2) 징병 — 성향별 예산율·선호 병종 (§5 데이터 성향의 해석).</summary>
    private void RecruitByDisposition(FactionState faction, Faction def)
    {
        var (budgetPct, unitId) = def.AiDisposition switch
        {
            "aggressive" => (70, "cavalry"),
            "expansionist" => (55, "archer"),
            _ => (40, "spearman")   // defensive 및 기타
        };
        if (!_db.Units.TryGetValue(unitId, out var unit)) return;

        var budget = (long)faction.Treasury * budgetPct / 100;
        var count = (int)(budget / unit.RecruitCostGold);
        if (count <= 0) return;

        // 교두보 우선: 적 영지와 육로로 연결된 소유 영지(원정 거점)에서 편성, 없으면 수도(ordinal 첫)
        var owned = faction.OwnedProvinceIds
            .Where(id => _db.Map.GetNode(id) is LandProvince)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();
        var enemyLand = _state.Factions
            .Where(f => f.Id != faction.Id && IsNonAllied(faction, f.Id))
            .SelectMany(f => f.OwnedProvinceIds)
            .Where(id => _db.Map.GetNode(id) is LandProvince)
            .ToList();
        var home = owned.FirstOrDefault(o =>
                       enemyLand.Any(t => Pathfinding.FindPath(_db.Map, o, t, e => e == EdgeType.Land) is not null))
                   ?? owned.FirstOrDefault();
        if (home is not null) _gm.Recruit(faction.Id, home, unitId, count);
    }

    /// <summary>
    /// 3) 공격 — 부대별로 인접 적 육상 영지 중 가장 약한 곳을, 전력 우위(성향 보정)일 때만.
    /// 공격 문턱 = 적 병력 × 150 / ai_aggression (공격성 높을수록 과감; 100=1.5배 우위 요구).
    /// </summary>
    private void AttackWeakNeighbors(FactionState faction, Faction def)
    {
        foreach (var army in _state.Armies
                     .Where(a => a.FactionId == faction.Id && a.TotalTroops > 0)
                     .OrderBy(a => a.Id, StringComparer.Ordinal)
                     .ToList())
        {
            var target = _db.Map.GetAdjacent(army.LocationNodeId)
                .Where(n => _db.Map.GetEdgeType(army.LocationNodeId, n) == EdgeType.Land)
                .Where(n => _db.Map.GetNode(n) is LandProvince)
                .Select(n => (Id: n, Owner: _state.Factions.FirstOrDefault(f => f.OwnedProvinceIds.Contains(n))))
                .Where(x => x.Owner is not null && x.Owner.Id != faction.Id &&
                            IsHostile(faction, x.Owner!.Id))
                .Select(x => (x.Id, Garrison: _state.Armies
                    .Where(a => a.FactionId == x.Owner!.Id && a.LocationNodeId == x.Id)
                    .Sum(a => a.TotalTroops)))
                .OrderBy(x => x.Garrison).ThenBy(x => x.Id, StringComparer.Ordinal)
                .ToList();
            if (target.Count == 0) continue;

            var threshold = (long)target[0].Garrison * 150 / Math.Max(1, def.AiAggression);
            if (army.TotalTroops > threshold)
                _gm.Attack(faction.Id, army.Id, target[0].Id, out _);
        }
    }

    /// <summary>4) 진군 — 인접에 공격 대상이 없는 부대는 가장 가까운 적 육상 영지의 직전 노드로 이동해 전선을 만든다.</summary>
    private void AdvanceTowardEnemies(FactionState faction)
    {
        var enemyProvinces = _state.Factions
            .Where(f => f.Id != faction.Id && IsNonAllied(faction, f.Id))
            .SelectMany(f => f.OwnedProvinceIds)
            .Where(id => _db.Map.GetNode(id) is LandProvince)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToList();
        if (enemyProvinces.Count == 0) return;

        foreach (var army in _state.Armies
                     .Where(a => a.FactionId == faction.Id && a.TotalTroops > 0)
                     .OrderBy(a => a.Id, StringComparer.Ordinal)
                     .ToList())
        {
            // 이미 적 영지에 인접(육로)이면 대기 — 다음 턴 공격 판정 대상
            var adjacentEnemy = _db.Map.GetAdjacent(army.LocationNodeId).Any(n =>
                _db.Map.GetEdgeType(army.LocationNodeId, n) == EdgeType.Land && enemyProvinces.Contains(n));
            if (adjacentEnemy) continue;

            // 최단 경로의 적 영지를 향해, 그 직전 노드까지 진군 (결정적 — ordinal 타이브레이크)
            IReadOnlyList<string>? best = null;
            foreach (var target in enemyProvinces)
            {
                var path = Pathfinding.FindPath(_db.Map, army.LocationNodeId, target, e => e == EdgeType.Land);
                if (path is not null && path.Count >= 2 && (best is null || path.Count < best.Count))
                    best = path;
            }
            if (best is not null)
                _gm.MoveArmy(army.Id, best[^2]);   // 적 영지 직전 노드
        }
    }
}
