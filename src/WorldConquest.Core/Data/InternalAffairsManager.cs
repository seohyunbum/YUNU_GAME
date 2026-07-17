using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>징병 결과 (§2.3 병력 = 인구에서 징병).</summary>
public enum RecruitOutcome
{
    Success,
    InvalidCount,
    NoSuchFaction,
    NotOwnedLandProvince,
    UnknownUnit,
    RequiresPortProvince,     // 해상 병종은 항구 영지에서만 건조 (§2.3 항구 시설·§2.1 port)
    InsufficientGold,
    TechLevelTooLow,          // 병종 해금 기술 미달 (§2.3 기술)
    InsufficientPopulation    // 영지 인구 부족 (§2.3 병력 = 인구에서 징병)
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

/// <summary>태수 임명·해임 결과 (§2.3 태수 파견).</summary>
public enum GovernorOutcome
{
    Success,
    NoSuchFaction,
    NotOwnedLandProvince,
    UnknownCharacter,
    NotYourCharacter,          // 소속(CharacterOwners) 세력이 아님
    AlreadyCommander,          // 부대·함대 지휘관과 겸직 불가
    AlreadyGovernorElsewhere,  // 다른 영지 태수와 겸직 불가
    NoGovernor                 // (해임) 태수가 없음
}

/// <summary>세율 변경 결과 (§2.3 세율).</summary>
public enum TaxOutcome
{
    Success,
    NoSuchFaction,
    UnknownTaxLevel
}

/// <summary>영지 1턴 수입 산출 내역 (콘솔 `province` 상세·수입 정산의 단일 산식).</summary>
public sealed record ProvinceIncomePreview(
    int BaseGold, int BaseFood,
    int FacilityGoldPct, int FacilityFoodPct,
    int GovernorGoldPct, int GovernorFoodPct,
    int PublicOrder, int PoOutputPct, int TaxGoldPct,
    int FinalGold, int FinalFood);

/// <summary>
/// 내정 시스템 (설계문서 §2.3·§4.2) — 수입·시설·징병·태수·민심·세율·인구·기술·반란.
/// GameManager 에서 분리된 내정 공식의 단일 소유자 (§4.4 God Class 금지).
/// 태수 스탯 연동: 정치(POL)→생산·건설할인 / 매력(CHA)→민심회복·징병할인 / 지력(INT)→기술.
/// 모든 산술은 정수 (§4.4) — 계수 정의는 game_rules.internal_affairs (§5.4).
/// </summary>
public sealed class InternalAffairsManager
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus? _bus;

    private InternalAffairsRules R => _db.Rules.InternalAffairs;

    public InternalAffairsManager(GameState state, GameDatabase db, EventBus? bus = null)
    {
        _state = state;
        _db = db;
        _bus = bus;
    }

    // ═══════════════ 조회 (Presentation·AI 공용) ═══════════════

    /// <summary>영지 민심 (0~100). 상태 없으면 기본값(po_initial).</summary>
    public int GetPublicOrder(string provinceId) =>
        StateOf(provinceId)?.PublicOrder ?? R.PoInitial;

    /// <summary>영지 현재 인구. 상태 없으면 정의값(world_map population).</summary>
    public int GetPopulation(string provinceId) =>
        StateOf(provinceId)?.Population
        ?? (_db.Map.TryGetNode(provinceId, out var n) && n is LandProvince land ? land.Population : 0);

    /// <summary>영지 태수. 없으면 null.</summary>
    public Character? GovernorOf(string provinceId)
    {
        var id = StateOf(provinceId)?.GovernorId;
        return id is not null && _db.Characters.TryGetValue(id, out var c) ? c : null;
    }

    /// <summary>무장이 태수로 있는 영지 id. 없으면 null.</summary>
    public string? GovernorProvinceOf(string characterId) =>
        _state.Provinces.FirstOrDefault(p => p.GovernorId == characterId)?.Id;

    /// <summary>세력의 실효 세율 정의 (빈 값·미인식은 기본 세율).</summary>
    public TaxLevelDef TaxOf(FactionState faction) => R.ResolveTaxLevel(faction.TaxLevel);

    /// <summary>영지 시설 합산 수비 방어 보정 % (성벽 등 — 전투 §2.6 배선).</summary>
    public int DefenseBonusPct(string provinceId)
    {
        var ps = StateOf(provinceId);
        if (ps is null) return 0;
        var sum = 0;
        foreach (var (type, level) in ps.Facilities)
            if (_db.Rules.Facilities.TryGetValue(type, out var def))
                sum += level * def.DefenseBonusPctPerLevel;
        return sum;
    }

    /// <summary>
    /// 영지 1턴 수입 미리보기 — 수입 정산과 동일한 단일 산식 (§4.4 정수).
    /// 산식: 기본 × (100+시설%+태수%) /100 × 민심승수 /100 × 세율(금만) /100. 각 단계 내림.
    /// </summary>
    public ProvinceIncomePreview PreviewIncome(string provinceId)
    {
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land)
            return new ProvinceIncomePreview(0, 0, 0, 0, 0, 0, R.PoInitial, R.OutputPct(R.PoInitial), 100, 0, 0);

        var owner = _state.Factions.FirstOrDefault(f => f.OwnedProvinceIds.Contains(provinceId));
        var (facGold, facFood) = FacilityBonus(provinceId);
        var gov = GovernorOf(provinceId);
        var govGold = gov is null ? 0 : gov.Stats.Pol * R.GovernorGoldPctPer100Pol / 100;
        var govFood = gov is null ? 0 : gov.Stats.Pol * R.GovernorFoodPctPer100Pol / 100;
        var po = GetPublicOrder(provinceId);
        var poPct = R.OutputPct(po);
        var taxPct = owner is null ? 100 : TaxOf(owner).GoldPct;

        var y = land.Produce();
        var gold = (long)y.Gold * (100 + facGold + govGold) / 100;
        gold = gold * poPct / 100;
        gold = gold * taxPct / 100;
        var food = (long)y.Food * (100 + facFood + govFood) / 100;
        food = food * poPct / 100;

        return new ProvinceIncomePreview(y.Gold, y.Food, facGold, facFood, govGold, govFood,
            po, poPct, taxPct, (int)gold, (int)food);
    }

    // ═══════════════ 수입 페이즈 (§2.2 [1]) ═══════════════

    /// <summary>
    /// 수입 페이즈: ①턴당 카운터 리셋·천명 ②영지별 수입(시설·태수·민심·세율) ③인구 성장
    /// ④민심 드리프트(세율+태수 매력) ⑤기술 포인트(학당+태수 지력)·레벨업 ⑥반란 판정.
    /// 순회는 저장 순서 그대로 — 결정적 (§4.4 world_events 스트림).
    /// </summary>
    public void ProcessIncomePhase()
    {
        foreach (var faction in _state.Factions)
        {
            faction.TransferredGoldThisTurn = 0;   // 동맹 지원 턴당 상한 리셋 (§1.2)
            faction.TransferredFoodThisTurn = 0;
            faction.SummonsThisTurn = 0;           // 초빙 턴당 캡 리셋 (§2.8)
            faction.RecruitsThisTurn = 0;          // 등용 턴당 캡 리셋 (§2.8 recruit)
            faction.Mandate += _db.Rules.SummonIncomeBasePerTurn;   // 천명 기본 수입 (§2.8.3)
        }

        foreach (var faction in _state.Factions)
        {
            var techGain = 0;
            foreach (var provinceId in faction.OwnedProvinceIds)
            {
                if (_db.Map.GetNode(provinceId) is not LandProvince land) continue;

                // ② 수입 — PreviewIncome 과 동일 산식 (단일 소스)
                var p = PreviewIncome(provinceId);
                faction.Treasury += p.FinalGold;
                faction.Food += p.FinalFood;

                // ③ 인구 성장 — 민심 비례, 정의 인구의 pop_cap_pct_of_base 상한
                GrowPopulation(provinceId, land, p.PublicOrder);

                // ④ 민심 드리프트 = 세율 + 태수 매력 회복
                var gov = GovernorOf(provinceId);
                var drift = TaxOf(faction).PoDrift
                            + (gov is null ? 0 : gov.Stats.Cha * R.GovernorPoRegenPer100Cha / 100);
                if (drift != 0) SetPublicOrder(provinceId, p.PublicOrder + drift);

                // ⑤ 기술 포인트 = 학당(시설) + 태수 지력
                techGain += FacilityTechPoints(provinceId)
                            + (gov is null ? 0 : gov.Stats.Int * R.GovernorTechPointsPer100Int / 100);
            }

            if (techGain > 0)
            {
                faction.TechPoints += techGain;
                while (faction.TechLevel < R.TechLevelCap &&
                       faction.TechPoints >= R.TechCostPerLevel * faction.TechLevel)
                {
                    faction.TechPoints -= R.TechCostPerLevel * faction.TechLevel;
                    faction.TechLevel++;
                    _bus?.Publish(GameEvent.Of("TechLevelUp",
                        ("faction", faction.Id), ("level", faction.TechLevel.ToString())));
                }
            }
        }

        ProcessRebellions();
    }

    private void GrowPopulation(string provinceId, LandProvince land, int publicOrder)
    {
        var pop = GetPopulation(provinceId);
        var cap = (int)((long)land.Population * R.PopCapPctOfBase / 100);
        if (pop >= cap) return;
        var growth = (int)((long)pop * R.PopGrowthPermyriadAtPo100 * publicOrder / 100 / 10000);
        if (growth <= 0) return;
        EnsureState(provinceId).Population = Math.Min(pop + growth, cap);
    }

    private int FacilityTechPoints(string provinceId)
    {
        var ps = StateOf(provinceId);
        if (ps is null) return 0;
        var sum = 0;
        foreach (var (type, level) in ps.Facilities)
            if (_db.Rules.Facilities.TryGetValue(type, out var def))
                sum += level * def.TechPointsPerLevel;
        return sum;
    }

    /// <summary>
    /// 반란 (§2.3 민심): 민심 &lt; rebellion_threshold 인 영지는 world_events 스트림으로 판정 —
    /// 발생 시 영지가 중립(무소유)으로 독립하고 태수는 해임된다. 진압 = 재점령.
    /// </summary>
    private void ProcessRebellions()
    {
        if (R.RebellionChancePermyriad <= 0) return;
        var rng = _state.Rng.Stream(RngStreams.WorldEvents);
        foreach (var faction in _state.Factions)
            foreach (var provinceId in faction.OwnedProvinceIds.ToList())   // 제거 중 순회 방지 스냅샷
            {
                if (_db.Map.GetNode(provinceId) is not LandProvince) continue;
                if (GetPublicOrder(provinceId) >= R.RebellionThreshold) continue;
                if (rng.NextInt(10000) >= R.RebellionChancePermyriad) continue;

                faction.OwnedProvinceIds.Remove(provinceId);
                var ps = EnsureState(provinceId);
                ps.GovernorId = null;
                ps.PublicOrder = Clamp(R.PoAfterRebellion);
                _bus?.Publish(GameEvent.Of("ProvinceRebelled",
                    ("province", provinceId), ("from", faction.Id)));
            }
    }

    // ═══════════════ 태수 (§2.3 태수 파견) ═══════════════

    /// <summary>
    /// 태수 임명 — 소속 무장만, 지휘관·타 영지 태수와 겸직 불가 (한 무장 = 한 보직).
    /// 같은 영지에 재임명하면 교체(기존 태수 자동 해임).
    /// </summary>
    public GovernorOutcome AppointGovernor(string factionId, string provinceId, string characterId)
    {
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return GovernorOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince ||
            !faction.OwnedProvinceIds.Contains(provinceId))
            return GovernorOutcome.NotOwnedLandProvince;
        if (!_db.Characters.ContainsKey(characterId)) return GovernorOutcome.UnknownCharacter;
        if (_state.CharacterOwners.GetValueOrDefault(characterId) != factionId)
            return GovernorOutcome.NotYourCharacter;
        if (_state.Armies.Any(a => a.CommanderId == characterId) ||
            _state.Fleets.Any(f => f.CommanderId == characterId))
            return GovernorOutcome.AlreadyCommander;
        var current = GovernorProvinceOf(characterId);
        if (current is not null && current != provinceId)
            return GovernorOutcome.AlreadyGovernorElsewhere;

        EnsureState(provinceId).GovernorId = characterId;
        return GovernorOutcome.Success;
    }

    /// <summary>태수 해임.</summary>
    public GovernorOutcome DismissGovernor(string factionId, string provinceId)
    {
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return GovernorOutcome.NoSuchFaction;
        if (!faction.OwnedProvinceIds.Contains(provinceId)) return GovernorOutcome.NotOwnedLandProvince;
        var ps = StateOf(provinceId);
        if (ps?.GovernorId is null) return GovernorOutcome.NoGovernor;
        ps.GovernorId = null;
        return GovernorOutcome.Success;
    }

    // ═══════════════ 세율 (§2.3) ═══════════════

    public TaxOutcome SetTaxLevel(string factionId, string taxLevel)
    {
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return TaxOutcome.NoSuchFaction;
        if (!R.TaxLevels.ContainsKey(taxLevel)) return TaxOutcome.UnknownTaxLevel;
        faction.TaxLevel = taxLevel;
        return TaxOutcome.Success;
    }

    // ═══════════════ 시설 (§2.3) ═══════════════

    /// <summary>실효 건설 비용 — 태수 정치 할인 (상한 build_discount_max_pct).</summary>
    public int EffectiveBuildCost(string provinceId, FacilityDef def)
    {
        var gov = GovernorOf(provinceId);
        var discount = gov is null ? 0
            : Math.Min(gov.Stats.Pol * R.GovernorBuildDiscountPctPer100Pol / 100, R.BuildDiscountMaxPct);
        return (int)((long)def.CostGold * (100 - discount) / 100);
    }

    /// <summary>시설 건설·업그레이드: 금 지불(태수 정치 할인 적용) → 레벨 +1.</summary>
    public FacilityOutcome BuildFacility(string factionId, string provinceId, string facilityType)
    {
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return FacilityOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land || !faction.OwnedProvinceIds.Contains(provinceId))
            return FacilityOutcome.NotOwnedLandProvince;
        if (!_db.Rules.Facilities.TryGetValue(facilityType, out var def))
            return FacilityOutcome.UnknownFacility;

        var ps = StateOf(provinceId);
        var level = ps?.Facilities.GetValueOrDefault(facilityType) ?? 0;
        if (level >= def.MaxLevel) return FacilityOutcome.MaxLevelReached;
        if (level == 0 && (ps?.Facilities.Count ?? 0) >= land.FacilitySlots) return FacilityOutcome.NoFreeSlot;
        var cost = EffectiveBuildCost(provinceId, def);
        if (faction.Treasury < cost) return FacilityOutcome.InsufficientGold;

        faction.Treasury -= cost;
        ps ??= EnsureState(provinceId);
        ps.Facilities[facilityType] = level + 1;
        return FacilityOutcome.Success;
    }

    /// <summary>영지의 시설 누적 생산 보너스(정수 %). 시설 상태가 없으면 0.</summary>
    private (int GoldPct, int FoodPct) FacilityBonus(string provinceId)
    {
        var ps = StateOf(provinceId);
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

    // ═══════════════ 징병 (§2.3 병력 = 인구에서 징병) ═══════════════

    /// <summary>실효 징병 할인 % — 병영 시설 + 태수 매력, 합산 후 상한(recruit_discount_max_pct).</summary>
    public int RecruitDiscountPct(string provinceId)
    {
        var facility = 0;
        var ps = StateOf(provinceId);
        if (ps is not null)
            foreach (var (type, level) in ps.Facilities)
                if (_db.Rules.Facilities.TryGetValue(type, out var def))
                    facility += level * def.RecruitDiscountPctPerLevel;
        var gov = GovernorOf(provinceId);
        var cha = gov is null ? 0 : gov.Stats.Cha * R.GovernorRecruitDiscountPctPer100Cha / 100;
        return Math.Min(facility + cha, R.RecruitDiscountMaxPct);
    }

    /// <summary>
    /// 징병: ①기술 해금 ②인구(병종별 pop_cost 소모) ③금(병영+태수 매력 할인) 검사 후
    /// 부대 편성 + 인구 차감 + 민심 하락(인구 1000당 recruit_po_penalty_per_1000).
    /// </summary>
    public RecruitOutcome Recruit(string factionId, string provinceId, string unitTypeId, int count)
    {
        if (count <= 0) return RecruitOutcome.InvalidCount;
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return RecruitOutcome.NoSuchFaction;
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land || !faction.OwnedProvinceIds.Contains(provinceId))
            return RecruitOutcome.NotOwnedLandProvince;
        if (!_db.Units.TryGetValue(unitTypeId, out var unit))
            return RecruitOutcome.UnknownUnit;
        var naval = unit.Domain == "naval";
        if (naval && !land.Port) return RecruitOutcome.RequiresPortProvince;   // 함선 건조 = 항구 영지만
        if (unit.TechRequired > faction.TechLevel) return RecruitOutcome.TechLevelTooLow;   // §2.3 병종 해금

        var popNeed = (long)unit.PopCost * count;   // long — 거대 count 곱 오버플로 방지
        var pop = GetPopulation(provinceId);
        if (popNeed > pop) return RecruitOutcome.InsufficientPopulation;

        var baseCost = (long)unit.RecruitCostGold * count;
        var cost = baseCost * (100 - RecruitDiscountPct(provinceId)) / 100;
        if (faction.Treasury < cost) return RecruitOutcome.InsufficientGold;

        faction.Treasury -= (int)cost;
        if (popNeed > 0)
        {
            EnsureState(provinceId).Population = pop - (int)popNeed;
            var penalty = (int)(popNeed * R.RecruitPoPenaltyPer1000 / 1000);
            if (penalty > 0) SetPublicOrder(provinceId, GetPublicOrder(provinceId) - penalty);
        }

        if (naval)
        {
            var fleet = _state.Fleets.FirstOrDefault(f => f.FactionId == factionId && f.LocationNodeId == provinceId)
                        ?? CreateFleet(factionId, provinceId);
            fleet.AddUnits(unitTypeId, count);
        }
        else
        {
            var army = _state.Armies.FirstOrDefault(a => a.FactionId == factionId && a.LocationNodeId == provinceId)
                       ?? CreateArmy(factionId, provinceId);
            army.AddUnits(unitTypeId, count);
        }
        return RecruitOutcome.Success;
    }

    // ═══════════════ 점령 훅 (GameManager 가 호출) ═══════════════

    /// <summary>영지 점령 시 내정 상태 전이 — 민심 재설정(전투/무혈 차등) + 구세력 태수 해임 (§2.3).</summary>
    public void OnProvinceTaken(string provinceId, bool hostile)
    {
        var ps = EnsureState(provinceId);
        ps.GovernorId = null;
        ps.PublicOrder = Clamp(hostile ? R.PoAfterHostileCapture : R.PoAfterPeacefulCapture);
    }

    // ═══════════════ 내부 헬퍼 ═══════════════

    private ProvinceState? StateOf(string provinceId) =>
        _state.Provinces.FirstOrDefault(p => p.Id == provinceId);

    private ProvinceState EnsureState(string provinceId)
    {
        var ps = StateOf(provinceId);
        if (ps is null)
        {
            ps = new ProvinceState { Id = provinceId, Facilities = new() };
            _state.Provinces.Add(ps);
        }
        return ps;
    }

    private void SetPublicOrder(string provinceId, int value) =>
        EnsureState(provinceId).PublicOrder = Clamp(value);

    private static int Clamp(int po) => Math.Clamp(po, 0, 100);

    private Army CreateArmy(string factionId, string locationNodeId)
    {
        // 충돌 없는 최소 순번(fail-soft 로 중간 부대가 드롭돼도 기존 id 와 겹치지 않게).
        var existing = _state.Armies.Select(a => a.Id).ToHashSet();
        var seq = 1;
        while (existing.Contains($"{factionId}_army_{seq}")) seq++;
        var army = new Army($"{factionId}_army_{seq}", factionId, locationNodeId);
        _state.Armies.Add(army);
        return army;
    }

    private Fleet CreateFleet(string factionId, string locationNodeId)
    {
        var existing = _state.Fleets.Select(f => f.Id).ToHashSet();
        var seq = 1;
        while (existing.Contains($"{factionId}_fleet_{seq}")) seq++;
        var fleet = new Fleet($"{factionId}_fleet_{seq}", factionId, locationNodeId);
        _state.Fleets.Add(fleet);
        return fleet;
    }
}
