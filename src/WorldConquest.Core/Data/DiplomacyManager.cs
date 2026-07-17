using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>외교 명령 결과.</summary>
public enum DiplomacyOutcome
{
    Success,
    NoSuchFaction,
    SelfTarget,
    AtWar,               // 전쟁 중 동맹 불가 — 먼저 종전
    NotAtWar,            // 종전 대상 아님
    NotAllied,           // 자원 지원은 동맹 전용 (§1.2)
    InvalidAmount,
    TransferCapExceeded, // 턴당 상한 초과 (alliance_transfer_cap_per_turn) — 지원·조공 공유 예산 (E7)
    InsufficientResources,
    AlliedTarget,        // 조공은 비동맹 전용 — 동맹에겐 자원 지원(send)을 쓸 것 (E6)
    NotNeutral           // 불가침은 중립에서만 — 전쟁 중이면 먼저 종전, 동맹이면 격하 불가
}

/// <summary>
/// 외교 제안·수락·관계 변화·자원 지원 (설계문서 §4.2·§1.2). 양측 관계를 동기화한다 —
/// Phase 1 Faction 도메인은 자기 시점만 바꾸므로, 상호 일관성은 이 매니저의 책임 (SRP).
/// 핫시트 2인은 동석 구두 합의 전제 — 제안/수락 절차는 AI 외교(후속)에서 확장.
/// </summary>
public sealed class DiplomacyManager
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus? _bus;

    public DiplomacyManager(GameState state, GameDatabase db, EventBus? bus = null)
    {
        _state = state;
        _db = db;
        _bus = bus;
    }

    public bool AreAllied(string a, string b) =>
        Find(a)?.Relations.GetValueOrDefault(b) == DiplomaticState.Alliance &&
        Find(b)?.Relations.GetValueOrDefault(a) == DiplomaticState.Alliance;

    /// <summary>동맹 체결 (§1.2) — 전쟁 중에는 종전 없이 불가. 양측 관계 동기화.</summary>
    public DiplomacyOutcome FormAlliance(string a, string b)
    {
        var (fa, fb, guard) = Pair(a, b);
        if (guard != DiplomacyOutcome.Success) return guard;
        if (fa!.Relations.GetValueOrDefault(b) == DiplomaticState.War) return DiplomacyOutcome.AtWar;
        fa.Relations[b] = DiplomaticState.Alliance;
        fb!.Relations[a] = DiplomaticState.Alliance;
        Ledger.Apply(a, b, FavorSource.AllianceFormed);
        _state.Progress.Add($"alliance:{Canonical(a, b)}");   // id-set — 최초 동맹 컷씬 트리거원 (§2.7 유형 C)
        var bothHuman = fa.Controller.StartsWith("human") && fb.Controller.StartsWith("human");
        _bus?.Publish(GameEvent.Of("AllianceFormed",
            ("a", a), ("b", b), ("both_human", bothHuman ? "true" : "false")));
        return DiplomacyOutcome.Success;
    }

    /// <summary>
    /// 선전포고 — 동맹 파기(배신) 포함 어떤 상태에서도 가능 (§4.2).
    /// 동맹 중이었다면 **배신**: 피배신자와의 관계가 무너지고, 제3국 전체가 등을 돌린다(§5.2).
    /// 배신에 아무 대가가 없으면 동맹은 그저 공짜 방패가 된다.
    /// </summary>
    public DiplomacyOutcome DeclareWar(string a, string b)
    {
        var (fa, fb, guard) = Pair(a, b);
        if (guard != DiplomacyOutcome.Success) return guard;
        var wasAllied = AreAllied(a, b);
        fa!.Relations[b] = DiplomaticState.War;
        fb!.Relations[a] = DiplomaticState.War;
        if (wasAllied)
        {
            Ledger.Apply(a, b, FavorSource.Betrayal);
            Ledger.ApplyToThirdParties(a, b, FavorSource.BetrayalReputation);   // 국제적 고립
            _bus?.Publish(GameEvent.Of("AllianceBetrayed", ("a", a), ("b", b)));
        }
        return DiplomacyOutcome.Success;
    }

    /// <summary>종전 — 전쟁 상태에서만, 중립으로.</summary>
    public DiplomacyOutcome MakePeace(string a, string b)
    {
        var (fa, fb, guard) = Pair(a, b);
        if (guard != DiplomacyOutcome.Success) return guard;
        if (fa!.Relations.GetValueOrDefault(b) != DiplomaticState.War) return DiplomacyOutcome.NotAtWar;
        fa.Relations[b] = DiplomaticState.Neutral;
        fb!.Relations[a] = DiplomaticState.Neutral;
        Ledger.Apply(a, b, FavorSource.PeaceMade);
        return DiplomacyOutcome.Success;
    }

    /// <summary>
    /// 불가침 체결 — 중립에서만. 양측 동기화.
    /// 이전에는 DiplomaticState.NonAggression 이 enum 에만 있고 이를 **쓰는 런타임 경로가 없어**
    /// 도달 불가한 죽은 분기였다(설계 G6). AI 필터는 이미 이 상태를 읽고 있었다.
    /// </summary>
    public DiplomacyOutcome SetNonAggression(string a, string b)
    {
        var (fa, fb, guard) = Pair(a, b);
        if (guard != DiplomacyOutcome.Success) return guard;
        if (fa!.Relations.GetValueOrDefault(b) != DiplomaticState.Neutral) return DiplomacyOutcome.NotNeutral;
        fa.Relations[b] = DiplomaticState.NonAggression;
        fb!.Relations[a] = DiplomaticState.NonAggression;
        _bus?.Publish(GameEvent.Of("NonAggressionSigned", ("a", a), ("b", b)));
        return DiplomacyOutcome.Success;
    }

    /// <summary>동맹 자원 지원 (§1.2) — 턴당 상한(alliance_transfer_cap_per_turn), 동맹 전용.</summary>
    public DiplomacyOutcome TransferResources(string fromId, string toId, int gold, int food)
    {
        var (from, to, guard) = Pair(fromId, toId);
        if (guard != DiplomacyOutcome.Success) return guard;
        if (gold < 0 || food < 0 || (gold == 0 && food == 0)) return DiplomacyOutcome.InvalidAmount;
        if (!AreAllied(fromId, toId)) return DiplomacyOutcome.NotAllied;

        var cap = _db.Rules.AllianceTransferCapPerTurn;
        if (from!.TransferredGoldThisTurn + gold > cap.Gold ||
            from.TransferredFoodThisTurn + food > cap.Food)
            return DiplomacyOutcome.TransferCapExceeded;
        if (from.Treasury < gold || from.Food < food) return DiplomacyOutcome.InsufficientResources;

        from.Treasury -= gold; from.Food -= food;
        to!.Treasury += gold; to.Food += food;
        from.TransferredGoldThisTurn += gold;
        from.TransferredFoodThisTurn += food;
        return DiplomacyOutcome.Success;
    }

    /// <summary>
    /// 조공 (요구: "조공을 보내 우호도를 올린다") — **비동맹 대상 전용**. 금·식량만.
    ///
    /// [MUST] 천명(Mandate)은 품목이 될 수 없다 (§2.8.3 "천명 직접 이전은 §1.2 동맹 자원 지원
    /// 대상에서 제외 — 재화 퍼널링 차단"). 시그니처에 Mandate 인자가 없어 컴파일 수준으로 보장된다.
    ///
    /// [MUST] 턴당 캡은 동맹 자원지원과 **예산을 공유**한다 (E7) — TransferredGold/FoodThisTurn 를
    /// 함께 증가시킨다. 조공 전용 캡을 따로 두면 "동맹 A 에게 지원 500 → 비동맹 B 에게 조공 500"
    /// 으로 턴당 1000 이 빠져나가 §1.2 '자원 지원 턴당 상한' 이 무력화된다. 캡은 대상별이 아니라
    /// **보내는 세력의 턴 누계**라 예산 공유가 유일하게 정합한 해석이다.
    ///
    /// 우호도 상승은 favor_ceiling 에서 멈춘다 (§5.3) — 돈으로 맹우를 살 수는 없다.
    /// </summary>
    public DiplomacyOutcome SendTribute(string fromId, string toId, int gold, int food)
    {
        var (from, to, guard) = Pair(fromId, toId);
        if (guard != DiplomacyOutcome.Success) return guard;
        if (gold < 0 || food < 0 || (gold == 0 && food == 0)) return DiplomacyOutcome.InvalidAmount;
        if (AreAllied(fromId, toId)) return DiplomacyOutcome.AlliedTarget;   // 동맹엔 TransferResources

        var cap = _db.Rules.AllianceTransferCapPerTurn;
        if (from!.TransferredGoldThisTurn + gold > cap.Gold ||
            from.TransferredFoodThisTurn + food > cap.Food)
            return DiplomacyOutcome.TransferCapExceeded;
        if (from.Treasury < gold || from.Food < food) return DiplomacyOutcome.InsufficientResources;

        from.Treasury -= gold; from.Food -= food;
        to!.Treasury += gold; to.Food += food;
        from.TransferredGoldThisTurn += gold;   // 지원과 공유 예산 [MUST]
        from.TransferredFoodThisTurn += food;

        var gained = Ledger.ApplyTribute(fromId, toId, gold, food);
        _bus?.Publish(GameEvent.Of("TributeSent",
            ("from", fromId), ("to", toId), ("gold", gold.ToString()), ("food", food.ToString()),
            ("favor_gained", gained.ToString())));
        return DiplomacyOutcome.Success;
    }

    private RelationLedger Ledger => new(_state, _db);

    private FactionState? Find(string id) => _state.Factions.FirstOrDefault(f => f.Id == id);

    private (FactionState?, FactionState?, DiplomacyOutcome) Pair(string a, string b)
    {
        if (a == b) return (null, null, DiplomacyOutcome.SelfTarget);
        var fa = Find(a); var fb = Find(b);
        if (fa is null || fb is null) return (null, null, DiplomacyOutcome.NoSuchFaction);
        return (fa, fb, DiplomacyOutcome.Success);
    }

    // Canonical 은 RelationLedger 로 이관됐다 (외교 E3) — private static 이라 별개 클래스에서
    // 호출할 수 없었기 때문. `alliance:{canonical}` Progress 규약은 동일 함수를 계속 쓴다.
    private static string Canonical(string a, string b) => RelationLedger.Canonical(a, b);
}
