using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// 관계도(Favor) 장부의 **단일 소유자** (외교 설계 E2·E3·E5 — SRP §4.2).
///
/// 설계 계약:
///  · Favor 는 쌍 단위 **대칭 단일값** — favor(a,b) == favor(b,a). 세력별 Dictionary 로 쪼개면
///    양측 이중 장부가 되고, AIController 가 관계를 단방향으로만 조회하는 구조와 결합하면 오독한다.
///  · 변동은 **FavorSource 화이트리스트로만** [MUST]. 수치는 전부 game_rules.json:diplomacy (§5).
///  · 조약(DiplomaticState)은 별개 축이다 — Favor 가 조약을 자동 전이시키지 않는다(E1).
///    전이는 항상 명시적 행위(DiplomacyManager). 핫시트 2인에서 플레이어 동의 없이 상태가
///    바뀌면 통제를 잃기 때문.
///  · 난수 없음 — 결정적. (계략 확률만 무상태 해시 파생, SchemeSystem)
///
/// Canonical(a,b) 의 소유자이기도 하다 — DiplomacyManager 의 private static 이었으나 별개
/// 클래스에서 호출할 수 없어 이관했다. `alliance:{canonical}` Progress 규약은 그대로 유지된다.
/// </summary>
public sealed class RelationLedger
{
    private readonly GameState _state;
    private readonly DiplomacyRules _rules;

    public RelationLedger(GameState state, GameDatabase db)
    {
        _state = state;
        _rules = db.Rules.Diplomacy;
    }

    /// <summary>쌍 정규화 키 — ordinal 정렬이라 순서 무관 단일 키 ("{a}+{b}").</summary>
    public static string Canonical(string a, string b) =>
        StringComparer.Ordinal.Compare(a, b) <= 0 ? $"{a}+{b}" : $"{b}+{a}";

    /// <summary>현재 관계도. 레코드가 없으면 초기값(키 부재 = 중립 규약과 동형).</summary>
    public int Favor(string a, string b) => Find(a, b)?.Favor ?? _rules.FavorInitial;

    /// <summary>Favor 구간의 파생 태도 (§5.1).</summary>
    public Attitude AttitudeOf(string a, string b) => _rules.AttitudeOf(Favor(a, b));

    /// <summary>화이트리스트 소스로 고정 델타 적용 (E5). 조공은 ApplyTribute 를 쓸 것.</summary>
    public void Apply(string a, string b, FavorSource source) =>
        Adjust(a, b, _rules.DeltaOf(source));

    /// <summary>
    /// 배신의 국제적 대가 — actor 와 **제3국 전체**의 관계를 떨어뜨린다(§5.2 BetrayalReputation).
    /// except 는 피배신자(이미 Betrayal 로 별도 처리됨).
    /// </summary>
    public void ApplyToThirdParties(string actor, string except, FavorSource source)
    {
        foreach (var f in _state.Factions
                     .Where(f => f.Id != actor && f.Id != except)
                     .OrderBy(f => f.Id, StringComparer.Ordinal))
            Apply(actor, f.Id, source);
    }

    /// <summary>
    /// 조공 수령 — 금액 비례 상승, **천장(favor_ceiling) 적용**(§5.3).
    /// 천장이 없으면 금으로 전 세계 우호도를 도배해 외교가 자판기가 된다: 맹우는 행동으로만.
    /// 반환 = 실제로 오른 Favor(천장에 걸리면 0 일 수 있다).
    /// </summary>
    public int ApplyTribute(string a, string b, int gold, int food)
    {
        var t = _rules.Tribute;
        // 정수 나눗셈 = 0 방향 절사 (§4.4). gold·food 는 항상 0 이상이라 절사 == 내림.
        var gain = gold / t.GoldPerFavor + food / t.FoodPerFavor;
        if (gain <= 0) return 0;

        var current = Favor(a, b);
        if (current >= t.FavorCeiling) return 0;             // 이미 천장
        var capped = Math.Min(current + gain, t.FavorCeiling);
        var applied = capped - current;
        Adjust(a, b, applied);
        return applied;
    }

    /// <summary>
    /// 수입 페이즈 (§2.2 [1]) 관계 정산 — 감쇠 + 공동의 적.
    /// **Decay 는 음수(적대) 구간에만** [MUST]: 감쇠의 입법 취지는 영구 원한 방지(판이 굳지 않게)다.
    /// 우호까지 감쇠시키면 CommonEnemy 축적을 상시 상쇄해 AI 동맹이 산술적으로 도달 불가해진다(§5.5).
    /// </summary>
    public void ProcessTurn()
    {
        // 공동의 적: 같은 세력과 교전 중인 쌍 — AI 가 자연스럽게 뭉치는 주 엔진.
        foreach (var (a, b) in AllPairs())
            if (SharesEnemy(a, b))
                Apply(a, b, FavorSource.CommonEnemy);

        // 감쇠: 적대 구간만 0 방향으로. 레코드가 없는 쌍(=초기값)은 건드릴 필요 없다.
        foreach (var r in _state.Relations)
        {
            if (r.Favor >= 0) continue;
            r.Favor = Math.Min(0, r.Favor + _rules.DecayPerTurn);
        }
    }

    /// <summary>a·b 가 동시에 전쟁 중인 제3국이 있는가 (양측 시점 모두 War 인 상대).</summary>
    private bool SharesEnemy(string a, string b)
    {
        var fa = _state.Factions.FirstOrDefault(f => f.Id == a);
        var fb = _state.Factions.FirstOrDefault(f => f.Id == b);
        if (fa is null || fb is null) return false;
        return _state.Factions.Any(t =>
            t.Id != a && t.Id != b &&
            fa.Relations.GetValueOrDefault(t.Id) == DiplomaticState.War &&
            fb.Relations.GetValueOrDefault(t.Id) == DiplomaticState.War);
    }

    /// <summary>살아있는 세력 쌍 전체 — ordinal 순 (결정적).</summary>
    private IEnumerable<(string A, string B)> AllPairs()
    {
        var ids = _state.Factions.Select(f => f.Id).OrderBy(x => x, StringComparer.Ordinal).ToList();
        for (var i = 0; i < ids.Count; i++)
            for (var j = i + 1; j < ids.Count; j++)
                yield return (ids[i], ids[j]);
    }

    private RelationState? Find(string a, string b)
    {
        var key = Canonical(a, b);
        return _state.Relations.FirstOrDefault(r => r.PairKey == key);
    }

    private void Adjust(string a, string b, int delta)
    {
        if (delta == 0) return;
        var r = Find(a, b);
        if (r is null)
        {
            var (first, second) = StringComparer.Ordinal.Compare(a, b) <= 0 ? (a, b) : (b, a);
            r = new RelationState { FactionA = first, FactionB = second, Favor = _rules.FavorInitial };
            _state.Relations.Add(r);
        }
        r.Favor = Math.Clamp(r.Favor + delta, _rules.FavorMin, _rules.FavorMax);
    }
}
