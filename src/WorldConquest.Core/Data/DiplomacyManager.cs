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
    TransferCapExceeded, // 턴당 상한 초과 (alliance_transfer_cap_per_turn)
    InsufficientResources
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

    public DiplomacyManager(GameState state, GameDatabase db)
    {
        _state = state;
        _db = db;
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
        _state.Progress.Add($"alliance:{Canonical(a, b)}");   // id-set — 최초 동맹 컷씬 트리거원 (§2.7 유형 C)
        return DiplomacyOutcome.Success;
    }

    /// <summary>선전포고 — 동맹 파기(배신) 포함 어떤 상태에서도 가능 (§4.2).</summary>
    public DiplomacyOutcome DeclareWar(string a, string b)
    {
        var (fa, fb, guard) = Pair(a, b);
        if (guard != DiplomacyOutcome.Success) return guard;
        fa!.Relations[b] = DiplomaticState.War;
        fb!.Relations[a] = DiplomaticState.War;
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

    private FactionState? Find(string id) => _state.Factions.FirstOrDefault(f => f.Id == id);

    private (FactionState?, FactionState?, DiplomacyOutcome) Pair(string a, string b)
    {
        if (a == b) return (null, null, DiplomacyOutcome.SelfTarget);
        var fa = Find(a); var fb = Find(b);
        if (fa is null || fb is null) return (null, null, DiplomacyOutcome.NoSuchFaction);
        return (fa, fb, DiplomacyOutcome.Success);
    }

    private static string Canonical(string a, string b) =>
        StringComparer.Ordinal.Compare(a, b) <= 0 ? $"{a}+{b}" : $"{b}+{a}";
}
