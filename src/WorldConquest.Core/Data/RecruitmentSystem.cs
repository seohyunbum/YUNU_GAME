using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>등용 시도 결과 (§2.8 recruit — 재야 무장 영입).</summary>
public enum RecruitGeneralOutcome
{
    Success,
    Failed,               // 설득 실패 (비용 소모, 대상은 재야 유지)
    NoSuchFaction,
    UnknownTarget,
    NotRecruitable,       // 대상이 recruit 채널이 아님
    TargetAlreadyOwned,   // 이미 어느 세력에 소속 (재야 아님)
    NoEnvoy,              // 사신 무장이 존재/소속하지 않음
    EnvoyBusyOrForeign,   // 사신이 자기 세력 무장이 아님
    InsufficientGold,
    TurnCapExceeded
}

/// <summary>등용 1건 결과 상세 (콘솔·API 표시·성공률 공시).</summary>
public sealed record RecruitAttempt(
    RecruitGeneralOutcome Outcome, string TargetId, string EnvoyId,
    int Cost, int ChancePermyriad, int RollPermyriad, bool Joined);

/// <summary>
/// 등용(招聘·recruit) — 재야(미소속·recruit 채널) 무장을 금 + 사신 매력으로 영입 (설계문서 §2.8 recruit 채널).
/// 초빙(SummonSystem, 가챠)과 별개 경로: 특정 대상을 지목해 사신을 보낸다. KOEI 등용 관례.
/// 결정론·세이브스컴 방지(§2.8.5): 세력별 명명 스트림 recruit:{factionId} — 시도 1회 = 난수 1소비.
/// 성공률 = base + 사신 매력×계수 − 대상 rarity×페널티, [min,max] clamp. 전부 정수 만분율 (§4.4).
/// </summary>
public sealed class RecruitmentSystem
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus _bus;

    public RecruitmentSystem(GameState state, GameDatabase db, EventBus bus)
    {
        _state = state;
        _db = db;
        _bus = bus;
    }

    /// <summary>재야 등용 후보 — recruit 채널 && 미소속. ordinal 정렬(결정적).</summary>
    public IReadOnlyList<Character> GetRecruitablePool() =>
        _db.Characters.Values
            .Where(c => c.AcquisitionChannels.Contains("recruit") && !_state.CharacterOwners.ContainsKey(c.Id))
            .OrderBy(c => c.Id, StringComparer.Ordinal)
            .ToList();

    /// <summary>등용 비용 = base + 대상 rarity × cost_per_rarity.</summary>
    public int CostFor(Character target) =>
        _db.Rules.RecruitBaseCostGold + target.Rarity * _db.Rules.RecruitCostPerRarity;

    /// <summary>성공률(만분율) — 표시와 판정이 공유하는 단일 산식. 사신 매력↑·대상 rarity↓ 일수록 높다.</summary>
    public int ChanceFor(Character envoy, Character target)
    {
        var r = _db.Rules;
        var raw = r.RecruitBaseChancePermyriad
                  + envoy.Stats.Cha * r.RecruitEnvoyChaPermyriadPer100 / 100
                  - target.Rarity * r.RecruitRarityPenaltyPermyriad;
        return Math.Clamp(raw, r.RecruitChanceMinPermyriad, r.RecruitChanceMaxPermyriad);
    }

    /// <summary>
    /// 등용 시도. 사신(envoy)은 등용 세력 소속 무장(리더 포함). 성공 시 대상이 세력에 합류(CharacterJoined via=recruit).
    /// 실패해도 비용은 소모(사신 파견 경비) — 무한 재시도 억제. 시도는 recruit 스트림 1소비(세이브스컴 방지).
    /// </summary>
    public RecruitAttempt TryRecruit(string factionId, string targetId, string envoyId)
    {
        RecruitAttempt Fail(RecruitGeneralOutcome o) => new(o, targetId, envoyId, 0, 0, 0, false);

        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return Fail(RecruitGeneralOutcome.NoSuchFaction);
        if (!_db.Characters.TryGetValue(targetId, out var target)) return Fail(RecruitGeneralOutcome.UnknownTarget);
        if (!target.AcquisitionChannels.Contains("recruit")) return Fail(RecruitGeneralOutcome.NotRecruitable);
        if (_state.CharacterOwners.ContainsKey(targetId)) return Fail(RecruitGeneralOutcome.TargetAlreadyOwned);
        if (!_db.Characters.TryGetValue(envoyId, out var envoy)) return Fail(RecruitGeneralOutcome.NoEnvoy);
        if (_state.CharacterOwners.GetValueOrDefault(envoyId) != factionId)
            return Fail(RecruitGeneralOutcome.EnvoyBusyOrForeign);   // 사신은 자기 세력 소속만 (§2.8)

        if (faction.RecruitsThisTurn >= _db.Rules.RecruitMaxPerTurn) return Fail(RecruitGeneralOutcome.TurnCapExceeded);

        var cost = CostFor(target);
        if (faction.Treasury < cost) return Fail(RecruitGeneralOutcome.InsufficientGold);

        // 비용·시도 카운트는 성공/실패 무관 소모 (사신 파견 경비)
        faction.Treasury -= cost;
        faction.RecruitsThisTurn++;

        var chance = ChanceFor(envoy, target);
        var roll = _state.Rng.Stream(RngStreams.Recruit(factionId)).NextInt(10000);   // 시도 1회 = 1소비
        var joined = roll < chance;

        if (joined)
        {
            _state.CharacterOwners[targetId] = factionId;
            _bus.Publish(GameEvent.Of("CharacterJoined",
                ("actor", targetId), ("faction", factionId), ("via", "recruit"),
                ("envoy", envoyId), ("rarity", target.Rarity.ToString())));
        }
        else
        {
            _bus.Publish(GameEvent.Of("RecruitFailed",
                ("actor", targetId), ("faction", factionId), ("envoy", envoyId)));
        }

        return new RecruitAttempt(
            joined ? RecruitGeneralOutcome.Success : RecruitGeneralOutcome.Failed,
            targetId, envoyId, cost, chance, roll, joined);
    }
}
