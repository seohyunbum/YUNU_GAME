using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>초빙 결과 1건.</summary>
public sealed record SummonResult(string CharacterId, int Rarity, bool PityTriggered);

/// <summary>초빙 시도 결과.</summary>
public enum SummonOutcome
{
    Success,
    NoSuchFaction,
    NoSuchBanner,
    InsufficientMandate,
    TurnCapExceeded,     // max_summons_per_turn
    PoolExhausted        // 재야 인재 소진 — "천하의 인재를 모두 만났습니다"
}

/// <summary>
/// 초빙(招聘) — 인게임 가챠 (설계문서 §2.8). 실물 과금 절대 없음 [MUST] — 재화는 천명(인게임)뿐.
/// 결정론(§2.8.5): 세력별 명명 스트림 summon:{factionId} — 리로드+이질 행동에도 자기 뽑기 결과 불변.
/// 비복원 추출: 무장은 유일 개체 — 중복·명함·돌파 경제가 원천 부재. 천장(soft/hard pity §2.8.6).
/// </summary>
public sealed class SummonSystem
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus _bus;

    public SummonSystem(GameState state, GameDatabase db, EventBus bus)
    {
        _state = state;
        _db = db;
        _bus = bus;
    }

    /// <summary>재야 풀 — 소속 상태에서 파생 (이중 장부 금지, §2.8.4). ordinal 정렬 = 결정적.</summary>
    public IReadOnlyList<Character> GetPool() =>
        _db.Characters.Values
            .Where(c => c.AcquisitionChannels.Contains("summon") && !_state.CharacterOwners.ContainsKey(c.Id))
            .OrderBy(c => c.Id, StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// 표시값 = 판정 로직과 동일 근거 (§2.8.6 [MUST]) — 등급별 유효 만분율(풀 잔존 등급으로 귀착).
    /// </summary>
    public IReadOnlyDictionary<int, int> GetCurrentRates(string factionId)
    {
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        var table = _db.RateTables[_db.Banners.Values.First().RateTableId];
        return EffectiveWeights(table, GetPool(), faction?.PityCount ?? 0,
            _db.Rules.SummonSoftPityStart, _db.Rules.SummonSoftPityAddPermyriad);
    }

    /// <summary>단발/10연 초빙 (§2.8.5 결정론 명세). 결과 캐릭터는 즉시 소속 — CharacterJoined 발행.</summary>
    public SummonOutcome DrawBatch(string factionId, int count, out List<SummonResult> results)
    {
        results = new List<SummonResult>();
        var faction = _state.Factions.FirstOrDefault(f => f.Id == factionId);
        if (faction is null) return SummonOutcome.NoSuchFaction;
        var banner = _db.Banners.Values.OrderBy(b => b.Id, StringComparer.Ordinal).FirstOrDefault();
        if (banner is null) return SummonOutcome.NoSuchBanner;

        var rules = _db.Rules;
        var pool = GetPool().ToList();
        if (pool.Count == 0) return SummonOutcome.PoolExhausted;
        count = Math.Min(count, pool.Count);   // 풀보다 크면 축소 — 비용도 건별 재계산

        if (faction.SummonsThisTurn + count > rules.SummonMaxPerTurn) return SummonOutcome.TurnCapExceeded;
        long cost = count >= 10 ? rules.SummonCostBatch10 : (long)rules.SummonCostSingle * count;
        if (faction.Mandate < cost) return SummonOutcome.InsufficientMandate;

        faction.Mandate -= (int)cost;
        faction.SummonsThisTurn += count;
        var rng = _state.Rng.Stream(RngStreams.Summon(factionId));
        var table = _db.RateTables[banner.RateTableId];

        for (var i = 0; i < count && pool.Count > 0; i++)
        {
            // rarity 판정: hard pity 도달 = 최고 등급 확정, 아니면 soft pity 가산 가중 추첨 (§2.8.6)
            var pity = faction.PityCount;
            var weights = EffectiveWeights(table, pool, pity,
                rules.SummonSoftPityStart, rules.SummonSoftPityAddPermyriad);
            var maxRarity = weights.Keys.Max();
            int rarity;
            var pityTriggered = false;
            if (pity + 1 >= rules.SummonHardPity && weights.ContainsKey(maxRarity))
            {
                rarity = maxRarity;
                pityTriggered = true;
                rng.NextInt(10000);   // 불변식: 뽑기 1회 = rarity 1회 소비 (천장이어도 스트림 정렬 유지)
            }
            else
            {
                var roll = rng.NextInt(weights.Values.Sum());
                rarity = PickWeighted(weights, roll);
            }

            // 캐릭터 판정: 해당 등급 풀에서 균등 (ordinal 정렬 — 결정적)
            var candidates = pool.Where(c => c.Rarity == rarity).ToList();
            var chosen = candidates[candidates.Count == 1 ? 0 : rng.NextInt(candidates.Count)];

            // 즉시 소속 (비복원 — 풀 이탈) + pity 갱신
            _state.CharacterOwners[chosen.Id] = factionId;
            pool.Remove(chosen);
            faction.PityCount = chosen.Rarity >= 5 ? 0 : faction.PityCount + 1;
            results.Add(new SummonResult(chosen.Id, chosen.Rarity, pityTriggered));

            _bus.Publish(GameEvent.Of("CharacterJoined",
                ("actor", chosen.Id), ("faction", factionId), ("via", "summon"),
                ("rarity", chosen.Rarity.ToString()), ("pity", pityTriggered ? "true" : "false")));
        }
        return SummonOutcome.Success;
    }

    /// <summary>
    /// 유효 가중치 (§2.8.6 — 표시와 판정이 이 함수 하나를 공유 [MUST]):
    /// ①soft pity 가산(최고 등급에 +add×경과, 최저 등급에서 차감·clamp) ②풀에 없는 등급 질량을 인접 등급으로 귀착.
    /// </summary>
    private static Dictionary<int, int> EffectiveWeights(RateTable table, IReadOnlyList<Character> pool, int pity,
        int softStart, int softAddPermyriad)
    {
        // soft pity: 명목표 보정 (정수 만분율 — §4.4)
        var nominal = table.WeightsPermyriad.ToDictionary(kv => kv.Key, kv => kv.Value);
        if (softStart > 0 && pity >= softStart && nominal.Count > 1)
        {
            var top = nominal.Keys.Max();
            var bottom = nominal.Keys.Min();
            var add = Math.Min((pity - softStart + 1) * softAddPermyriad, nominal[bottom]);   // 최저에서 차감 가능한 만큼만
            nominal[top] += add;
            nominal[bottom] -= add;
        }

        var present = pool.Select(c => c.Rarity).ToHashSet();
        var weights = new Dictionary<int, int>();
        foreach (var (rarity, w) in nominal.OrderBy(kv => kv.Key))
        {
            var target = rarity;
            if (!present.Contains(target))
            {
                // 하위 → 상위 순 인접 귀착
                var fallback = present.Where(r => r < rarity).OrderByDescending(r => r).Cast<int?>().FirstOrDefault()
                               ?? present.Where(r => r > rarity).OrderBy(r => r).Cast<int?>().FirstOrDefault();
                if (fallback is null) continue;
                target = fallback.Value;
            }
            weights[target] = weights.GetValueOrDefault(target) + w;
        }
        return weights;
    }

    private static int PickWeighted(Dictionary<int, int> weights, int roll)
    {
        var acc = 0;
        foreach (var (rarity, w) in weights.OrderBy(kv => kv.Key))
        {
            acc += w;
            if (roll < acc) return rarity;
        }
        return weights.Keys.Max();
    }
}
