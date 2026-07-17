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
    InsufficientPopulation,   // 영지 인구 부족 (§2.3 병력 = 인구에서 징병)
    MusterGeneralInvalid,     // 군수(파견 무장)가 존재/소속하지 않음 (§2.3.2)
    MusterGeneralAlreadyActed // 군수가 이번 턴 이미 파견 행동을 함
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

/// <summary>개발 파견 결과 (§2.3.2 — 무장 파견으로 상업·농업 수치 개발).</summary>
public enum DevelopOutcome
{
    Success,
    NoSuchFaction,
    NotOwnedLandProvince,
    UnknownKind,             // commerce / agriculture 외
    UnknownGeneral,
    NotYourGeneral,          // 소속(CharacterOwners) 세력이 아님
    GeneralAlreadyActed,     // 이 무장은 이번 턴 이미 파견 행동을 함 (§2.3.2 무장 1명 턴당 1회)
    AlreadyMaxed,            // 거점 특성상 상한 도달 (더 개발 불가)
    InsufficientGold
}

/// <summary>개발 1건 결과 상세 (콘솔·API 표시). 실패 시 Gain=0.</summary>
public sealed record DevelopResult(
    DevelopOutcome Outcome, string Kind, int Gain, int NewValue, int Max);

/// <summary>
/// 영지 1턴 수입 산출 내역 (콘솔 `province` 상세·수입 정산의 단일 산식).
/// 금·식량 수입의 주 동력은 상업·농업 개발 수치(§2.3.2) — 기본생산은 무개발 floor.
/// </summary>
public sealed record ProvinceIncomePreview(
    int BaseGold, int BaseFood,
    int Commerce, int CommerceMax, int Agriculture, int AgricultureMax,
    int CommerceGold, int AgricultureFood,
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

    /// <summary>거점 상업 개발 상한 (거점 특성별, §2.3.2). 육상 아니면 0.</summary>
    public int CommerceMax(string provinceId) =>
        _db.Map.TryGetNode(provinceId, out var n) && n is LandProvince l ? l.CommerceMax : 0;

    /// <summary>거점 농업 개발 상한 (거점 특성별, §2.3.2). 육상 아니면 0.</summary>
    public int AgricultureMax(string provinceId) =>
        _db.Map.TryGetNode(provinceId, out var n) && n is LandProvince l ? l.AgricultureMax : 0;

    /// <summary>상업 개발 수치. 상태 없으면 시작값(max × dev_start_pct_of_max).</summary>
    public int GetCommerce(string provinceId) =>
        StateOf(provinceId)?.Commerce ?? StartDevValue(CommerceMax(provinceId));

    /// <summary>농업 개발 수치. 상태 없으면 시작값(max × dev_start_pct_of_max).</summary>
    public int GetAgriculture(string provinceId) =>
        StateOf(provinceId)?.Agriculture ?? StartDevValue(AgricultureMax(provinceId));

    /// <summary>무개발 시작 수치 = max × dev_start_pct_of_max / 100 (§2.3.2 정수).</summary>
    private int StartDevValue(int max) => (int)((long)max * _db.Rules.DevStartPctOfMax / 100);

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
    /// 영지 1턴 수입 미리보기 — 수입 정산과 동일한 단일 산식 (§4.4 정수, §2.3.2 수치제 경제).
    /// 산식: (기본생산 floor + 개발수치×계수) × (100+시설%+태수%) /100 × 민심승수 /100 × 세율(금만) /100. 각 단계 내림.
    /// 개발수치(상업·농업)가 수입의 주 동력 — 무장 파견 개발·태수 자동개발로 거점별 상한까지 성장.
    /// </summary>
    public ProvinceIncomePreview PreviewIncome(string provinceId)
    {
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land)
            return new ProvinceIncomePreview(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                R.PoInitial, R.OutputPct(R.PoInitial), 100, 0, 0);

        var owner = _state.Factions.FirstOrDefault(f => f.OwnedProvinceIds.Contains(provinceId));
        var (facGold, facFood) = FacilityBonus(provinceId);
        var gov = GovernorOf(provinceId);
        var govGold = gov is null ? 0 : gov.Stats.Pol * R.GovernorGoldPctPer100Pol / 100;
        var govFood = gov is null ? 0 : gov.Stats.Pol * R.GovernorFoodPctPer100Pol / 100;
        var po = GetPublicOrder(provinceId);
        var poPct = R.OutputPct(po);
        var taxPct = owner is null ? 100 : TaxOf(owner).GoldPct;

        // 개발수치 → 수입 기여 (§2.3.2): 상업×gold_per_commerce_permil/1000, 농업×food_per_agriculture_permil/1000
        var commerce = GetCommerce(provinceId);
        var agriculture = GetAgriculture(provinceId);
        var commerceGold = (int)((long)commerce * _db.Rules.GoldPerCommercePermil / 1000);
        var agricultureFood = (int)((long)agriculture * _db.Rules.FoodPerAgriculturePermil / 1000);

        var y = land.Produce();
        var grossGold = y.Gold + commerceGold;    // 무개발 floor + 상업 개발분
        var grossFood = y.Food + agricultureFood;  // 무개발 floor + 농업 개발분

        var gold = (long)grossGold * (100 + facGold + govGold) / 100;
        gold = gold * poPct / 100;
        gold = gold * taxPct / 100;
        var food = (long)grossFood * (100 + facFood + govFood) / 100;
        food = food * poPct / 100;

        return new ProvinceIncomePreview(
            y.Gold, y.Food,
            commerce, land.CommerceMax, agriculture, land.AgricultureMax,
            commerceGold, agricultureFood,
            facGold, facFood, govGold, govFood,
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
            faction.SearchesThisTurn = 0;          // 탐색 턴당 캡 리셋 (§2.8 search)
            faction.ActedCharacterIds.Clear();     // 파견 행동 소진 리셋 (§2.3.2 무장 1명 턴당 1회)
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

                // ④.5 태수 자동 개발 (§2.3.2): 태수 정치력 비례로 상업·농업이 상한까지 서서히 성장
                if (gov is not null) GovernorAutoDevelop(provinceId, land, gov);

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

    // ═══════════════ 개발 파견 (§2.3.2 — 무장 파견으로 상업·농업 수치 개발) ═══════════════

    /// <summary>
    /// 개발 파견 — 소속 무장 1명을 보내 거점의 상업(commerce) 또는 농업(agriculture) 수치를 올린다.
    /// 증가량 = dev_base_gain + 무장 정치력 × dev_pol_gain_per_100 / 100, 거점 상한에서 clamp.
    /// 비용 dev_cost_gold 소모, 무장은 이번 턴 파견 소진(ActedCharacterIds) — 한 무장 = 턴당 1행동.
    /// </summary>
    public DevelopResult Develop(string factionId, string provinceId, string kind, string generalId)
    {
        DevelopResult Fail(DevelopOutcome o) => new(o, kind, 0, 0, 0);

        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return Fail(DevelopOutcome.NoSuchFaction);
        if (!_db.Map.TryGetNode(provinceId, out var node) || node is not LandProvince land ||
            !faction.OwnedProvinceIds.Contains(provinceId))
            return Fail(DevelopOutcome.NotOwnedLandProvince);
        var isCommerce = kind == "commerce";
        if (!isCommerce && kind != "agriculture") return Fail(DevelopOutcome.UnknownKind);
        if (!_db.Characters.TryGetValue(generalId, out var gen)) return Fail(DevelopOutcome.UnknownGeneral);
        if (_state.CharacterOwners.GetValueOrDefault(generalId) != factionId)
            return Fail(DevelopOutcome.NotYourGeneral);
        if (faction.ActedCharacterIds.Contains(generalId)) return Fail(DevelopOutcome.GeneralAlreadyActed);

        var max = isCommerce ? land.CommerceMax : land.AgricultureMax;
        var cur = isCommerce ? GetCommerce(provinceId) : GetAgriculture(provinceId);
        if (cur >= max) return Fail(DevelopOutcome.AlreadyMaxed);
        if (faction.Treasury < _db.Rules.DevCostGold) return Fail(DevelopOutcome.InsufficientGold);

        var gain = _db.Rules.DevBaseGain + gen.Stats.Pol * _db.Rules.DevPolGainPer100 / 100;
        var next = Math.Min(cur + gain, max);
        var applied = next - cur;

        faction.Treasury -= _db.Rules.DevCostGold;
        faction.ActedCharacterIds.Add(generalId);
        var ps = EnsureState(provinceId);
        if (isCommerce) ps.Commerce = next; else ps.Agriculture = next;

        _bus?.Publish(GameEvent.Of("ProvinceDeveloped",
            ("province", provinceId), ("faction", factionId), ("kind", kind),
            ("general", generalId), ("gain", applied.ToString()), ("value", next.ToString())));
        return new DevelopResult(DevelopOutcome.Success, kind, applied, next, max);
    }

    /// <summary>태수 자동 개발 (수입 페이즈): 태수 정치 100당 governor_dev_gain_per_100_pol 만큼 상업·농업이 상한까지 성장.</summary>
    private void GovernorAutoDevelop(string provinceId, LandProvince land, Character gov)
    {
        var step = gov.Stats.Pol * _db.Rules.GovernorDevGainPer100Pol / 100;
        if (step <= 0) return;
        var commerce = GetCommerce(provinceId);
        var agriculture = GetAgriculture(provinceId);
        var newC = Math.Min(commerce + step, land.CommerceMax);
        var newA = Math.Min(agriculture + step, land.AgricultureMax);
        if (newC == commerce && newA == agriculture) return;
        var ps = EnsureState(provinceId);
        ps.Commerce = newC;
        ps.Agriculture = newA;
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

    /// <summary>군수(파견 무장) 통솔 기반 추가 징병 할인 % — muster_ldr_discount_per_100, 상한 muster_discount_max_pct.</summary>
    public int MusterDiscountPct(Character muster) =>
        Math.Min(muster.Stats.Ldr * _db.Rules.MusterLdrDiscountPer100 / 100, _db.Rules.MusterDiscountMaxPct);

    /// <summary>
    /// 징병: ①기술 해금 ②인구(병종별 pop_cost 소모) ③금(병영+태수 매력 할인 + 군수 통솔 할인) 검사 후
    /// 부대 편성 + 인구 차감 + 민심 하락(인구 1000당 recruit_po_penalty_per_1000).
    /// <paramref name="musterGeneralId"/> 지정 시 그 무장의 통솔이 비용을 추가 할인하고, 무장은 이번 턴 파견 소진(§2.3.2).
    /// </summary>
    public RecruitOutcome Recruit(string factionId, string provinceId, string unitTypeId, int count, string? musterGeneralId = null)
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

        // 군수 파견(선택): 자기 세력 소속 && 이번 턴 미행동 (§2.3.2)
        Character? muster = null;
        if (musterGeneralId is not null)
        {
            if (!_db.Characters.TryGetValue(musterGeneralId, out muster) ||
                _state.CharacterOwners.GetValueOrDefault(musterGeneralId) != factionId)
                return RecruitOutcome.MusterGeneralInvalid;
            if (faction.ActedCharacterIds.Contains(musterGeneralId))
                return RecruitOutcome.MusterGeneralAlreadyActed;
        }

        var popNeed = (long)unit.PopCost * count;   // long — 거대 count 곱 오버플로 방지
        var pop = GetPopulation(provinceId);
        if (popNeed > pop) return RecruitOutcome.InsufficientPopulation;

        var discount = RecruitDiscountPct(provinceId) + (muster is null ? 0 : MusterDiscountPct(muster));
        var baseCost = (long)unit.RecruitCostGold * count;
        var cost = baseCost * (100 - discount) / 100;
        if (faction.Treasury < cost) return RecruitOutcome.InsufficientGold;

        faction.Treasury -= (int)cost;
        if (muster is not null) faction.ActedCharacterIds.Add(musterGeneralId!);   // 군수 파견 소진
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
