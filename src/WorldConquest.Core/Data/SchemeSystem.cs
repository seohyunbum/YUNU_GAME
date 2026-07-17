using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>계략 실행 결과.</summary>
public enum SchemeOutcome
{
    Success,             // 이간계 성공 — 대상 두 세력의 관계 악화
    Exposed,             // 발각 — 시전자와 두 대상의 관계 악화 (역효과)
    NoSuchFaction,
    SelfTarget,          // 시전자가 대상에 포함 — 이간계는 제3자 둘을 갈라놓는 것
    SameTarget,          // 두 대상이 동일
    SchemeCapExceeded,   // 턴당 상한 (diplomacy.scheme.per_turn)
    InsufficientResources
}

/// <summary>
/// 계략 — 이간계(Sow Discord). 세력 C 가 제3국 A·B 의 사이를 벌린다 (외교 설계 §5.4·E10·E12).
///
/// **확률은 무상태 해시 파생** — 순차 소비 스트림이 아니다 (§2.7.3 cinematic 과 동형).
/// 스펙 §4.4 가 스트림 신설을 개정 항목으로 묶은 이유는 **소비 격리 [MUST]** 위반 위험인데,
/// 무상태 파생은 소비 카운터가 없어 다른 스트림 시퀀스를 **구조적으로 바꿀 수 없다**.
/// combat 스트림 재사용은 금지(전투 골든 리플레이 오염). 부수 효과로 세이브스컴도 자동 차단된다 —
/// 같은 (캠페인 시드·턴·시전자·대상 쌍) 은 재시도해도 같은 결과다.
///
/// INT·POL 이 실제로 게임플레이에 쓰이는 **첫 경로**다 (설계 G4·G5) — 스펙 §2.4 는 지력 =
/// "계략 성공/회피", 정치 = "외교 성공률" 이라 규정해놓고 어디서도 읽지 않았다.
///
/// 초판은 이간계 1종만 (E12). 매수·유언비어는 [MAY, Phase 5].
/// 조조 패시브 hero_of_chaos 의 scheme_success(+15) 는 여전히 연결되지 않는다 — 그 버프는
/// 전투 버프 경로(BattleSideState)에만 등록되고 계략은 전투 밖 행위라, 전투 밖 패시브 조회
/// 경로라는 별도 설계가 필요하다 (U-D4, Phase 5 [MAY]). 정직한 서술: 초판은 순수 INT.
/// </summary>
public sealed class SchemeSystem
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus? _bus;

    public SchemeSystem(GameState state, GameDatabase db, EventBus? bus = null)
    {
        _state = state;
        _db = db;
        _bus = bus;
    }

    /// <summary>이간계 — executor 가 targetA·targetB 의 관계를 떨어뜨린다.</summary>
    public SchemeOutcome SowDiscord(string executorId, string targetA, string targetB)
    {
        if (targetA == targetB) return SchemeOutcome.SameTarget;
        if (executorId == targetA || executorId == targetB) return SchemeOutcome.SelfTarget;

        var ex = Find(executorId);
        var a = Find(targetA);
        var b = Find(targetB);
        if (ex is null || a is null || b is null) return SchemeOutcome.NoSuchFaction;

        var rules = _db.Rules.Diplomacy.Scheme;
        if (ex.SchemesThisTurn >= rules.PerTurn) return SchemeOutcome.SchemeCapExceeded;
        if (ex.Treasury < rules.CostGold) return SchemeOutcome.InsufficientResources;

        ex.Treasury -= rules.CostGold;
        ex.SchemesThisTurn++;

        var led = new RelationLedger(_state, _db);
        var success = Roll(executorId, targetA, targetB) < SuccessPermyriad(executorId, targetA, targetB);
        if (success)
        {
            led.Apply(targetA, targetB, FavorSource.SchemeDiscord);
        }
        else
        {
            // 발각 — 시전자가 양쪽에서 신뢰를 잃는다
            led.Apply(executorId, targetA, FavorSource.SchemeExposed);
            led.Apply(executorId, targetB, FavorSource.SchemeExposed);
        }

        _bus?.Publish(GameEvent.Of("SchemeResolved",
            ("kind", "sow_discord"), ("executor", executorId), ("a", targetA), ("b", targetB),
            ("success", success ? "true" : "false")));
        return success ? SchemeOutcome.Success : SchemeOutcome.Exposed;
    }

    /// <summary>
    /// 성공 확률(만분율) = base + (시전자 최고 지력 − 대상 최고 정치) × 점당계수, clamp.
    /// 대상 저항은 두 세력 중 **더 높은** 정치 — 둘 다 이 이간을 막으려 하기 때문.
    /// </summary>
    public int SuccessPermyriad(string executorId, string targetA, string targetB)
    {
        var r = _db.Rules.Diplomacy.Scheme;
        var p = r.BaseSuccessPermyriad
                + (MaxStat(executorId, s => s.Int) - Math.Max(MaxStat(targetA, s => s.Pol), MaxStat(targetB, s => s.Pol)))
                * r.IntDiffPermyriadPerPoint;
        return Math.Clamp(p, r.SuccessPermyriadMin, r.SuccessPermyriadMax);
    }

    /// <summary>세력이 보유한 캐릭터 중 최대 스탯 (보유 0 이면 0).</summary>
    private int MaxStat(string factionId, Func<CharacterStats, int> pick)
    {
        var best = 0;
        foreach (var (charId, owner) in _state.CharacterOwners)
        {
            if (owner != factionId) continue;
            if (!_db.Characters.TryGetValue(charId, out var c)) continue;   // 삭제된 정의 fail-soft
            var v = pick(c.Stats);
            if (v > best) best = v;
        }
        return best;
    }

    /// <summary>
    /// 무상태 해시 파생 (§2.7.3 동형): Hash(campaign_seed, "diplomacy", turn, executor, canonical(a,b)) % 10000.
    /// 대상 쌍을 Canonical 로 정규화해 (A,B)·(B,A) 가 같은 결과를 내게 한다 — 인자 순서로 재굴림 불가.
    /// </summary>
    private int Roll(string executorId, string targetA, string targetB)
    {
        unchecked
        {
            ulong h = 14695981039346656037UL;
            void Mix(ulong v) { h ^= v; h *= 1099511628211UL; }
            void MixStr(string s) { foreach (var ch in s) Mix(ch); }
            Mix(_state.CampaignSeed);
            MixStr("diplomacy");
            Mix((ulong)_state.Turn);
            MixStr(executorId);
            MixStr(RelationLedger.Canonical(targetA, targetB));
            return (int)(h % 10000);
        }
    }

    private FactionState? Find(string id) => _state.Factions.FirstOrDefault(f => f.Id == id);
}
