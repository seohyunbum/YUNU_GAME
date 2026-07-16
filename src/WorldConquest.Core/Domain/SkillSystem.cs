namespace WorldConquest.Core.Domain;

/// <summary>전투 중 스킬 발동 기록 — 콘솔 로그·오라클 이벤트의 원천 (§4.3·Phase 2 DoD '수치 변화 검증').</summary>
public sealed record SkillEvent(string SkillId, string SkillNameKo, string Side, string Detail);

/// <summary>전투 한 측의 스킬 관련 상태 (게이지·버프·실드·펜딩 효과). 전투 내 생성·소멸 — 세이브 대상 아님(C6).</summary>
public sealed class BattleSideState
{
    private sealed class ActiveBuff { public required string Stat; public int Amount; public int RoundsLeft; }

    private readonly List<ActiveBuff> _buffs = new();

    public int Gauge { get; set; }
    public int ShieldRounds { get; private set; }
    public long ShieldAbsorb { get; private set; }          // -1 = 완전 무효 (마슈 로드 카멜롯)
    public int PendingSkillDamage { get; set; }             // 이번 라운드 적용될 스킬 직접 데미지
    public int PendingHeal { get; set; }                    // 이번 라운드 병력 회복량
    public Dictionary<string, int> PendingSummons { get; } = new();   // 병종 id → 소환 수

    public void AddBuff(string stat, int amount, int rounds) =>
        _buffs.Add(new ActiveBuff { Stat = stat, Amount = amount, RoundsLeft = rounds });

    /// <summary>해당 stat 의 활성 버프 합 (debuff 는 음수로 저장됨).</summary>
    public int SumBuff(string stat) => _buffs.Where(b => b.Stat == stat).Sum(b => b.Amount);

    public void SetShield(int rounds, long absorb) { ShieldRounds = rounds; ShieldAbsorb = absorb; }

    /// <summary>실드에 데미지 통과 — 무효(-1)면 0, 흡수형이면 잔량 차감 후 초과분만 통과.</summary>
    public int AbsorbDamage(int damage)
    {
        if (ShieldRounds <= 0) return damage;
        if (ShieldAbsorb < 0) return 0;                     // 완전 무효
        if (ShieldAbsorb >= damage) { ShieldAbsorb -= damage; return 0; }
        var passed = (int)(damage - ShieldAbsorb);
        ShieldAbsorb = 0;
        return passed;
    }

    /// <summary>라운드 종료 — 버프·실드 지속시간 감쇠.</summary>
    public void TickRound()
    {
        foreach (var b in _buffs) b.RoundsLeft--;
        _buffs.RemoveAll(b => b.RoundsLeft <= 0);
        if (ShieldRounds > 0) ShieldRounds--;
    }
}

/// <summary>
/// 스킬 게이지·발동 조건·EffectType 해석기 (설계문서 §2.4·§5.2·§4.2·전투 C4/C5).
/// 미지 EffectType·조건 타입은 조용히 무시하지 않고 throw [MUST — §5.5 의 런타임 확장].
/// 캐릭터별 if문 없음 — 전부 데이터(effects 배열) 해석.
/// </summary>
public static class SkillSystem
{
    /// <summary>게이지 충전 (§2.4 — 피해를 주고받을 때). gauge_charge_rate 버프 반영.</summary>
    public static void Charge(BattleSideState side, int amount, int gaugeMax)
    {
        var rate = 100 + side.SumBuff("gauge_charge_rate");
        var next = side.Gauge + (long)amount * rate / 100;
        side.Gauge = next > gaugeMax ? gaugeMax : (int)next;
    }

    /// <summary>발동 조건 검사. 미지 조건 타입 = throw (조용한 스킵 금지).</summary>
    public static bool ConditionsMet(Skill skill, string battleDomain) =>
        skill.Conditions.All(c => c.Type switch
        {
            "battle_domain" => c.Value == battleDomain,
            _ => throw new InvalidOperationException(
                $"스킬 '{skill.Id}' 의 미구현 조건 타입 '{c.Type}' — 조용한 무시 금지 [MUST §5.2]")
        });

    /// <summary>
    /// EffectType 해석·적용 (§5.2 초기 세트 중 데이터 사용분 7종). 반환 = 발동 이벤트 로그.
    /// 전투 무관 스탯 버프(scheme_success 등)도 상태에 등록된다(무시 아님) — 전투 데미지 합성에서만 미사용.
    /// </summary>
    public static void Execute(Skill skill, CharacterStats caster, BattleSideState own, BattleSideState enemy,
        List<SkillEvent> events, string side)
    {
        foreach (var e in skill.Effects)
        {
            switch (e.Type)
            {
                case "aoe_damage":
                case "single_damage":
                    var dmg = ClampInt((long)(e.Power ?? 0) * StatValue(caster, e.ScalingStat) / 100);
                    enemy.PendingSkillDamage = ClampInt((long)enemy.PendingSkillDamage + dmg);
                    events.Add(new(skill.Id, skill.NameKo, side, $"{e.Type} {dmg} → {e.Target}"));
                    break;

                case "buff":
                    own.AddBuff(e.Stat!, e.Amount ?? 0, e.DurationTurns ?? 1);
                    events.Add(new(skill.Id, skill.NameKo, side, $"buff {e.Stat}+{e.Amount} ({e.DurationTurns ?? 1}R)"));
                    break;

                case "debuff":
                    enemy.AddBuff(e.Stat!, -(e.Amount ?? 0), e.DurationTurns ?? 1);
                    events.Add(new(skill.Id, skill.NameKo, side, $"debuff {e.Stat}-{e.Amount} ({e.DurationTurns ?? 1}R)"));
                    break;

                case "shield":
                    own.SetShield(e.DurationTurns ?? 1, e.AbsorbAmount ?? -1);   // absorb 미지정 = 완전 무효 (마슈)
                    events.Add(new(skill.Id, skill.NameKo, side,
                        e.AbsorbAmount is null ? $"피해 무효 {e.DurationTurns ?? 1}R" : $"실드 {e.AbsorbAmount} ({e.DurationTurns ?? 1}R)"));
                    break;

                case "heal":
                    var heal = ClampInt((long)(e.Power ?? 0) * StatValue(caster, e.ScalingStat) / 100);
                    own.PendingHeal = ClampInt((long)own.PendingHeal + heal);
                    events.Add(new(skill.Id, skill.NameKo, side, $"heal {heal}"));
                    break;

                case "summon_unit":
                    own.PendingSummons[e.UnitId!] = own.PendingSummons.GetValueOrDefault(e.UnitId!) + (e.Amount ?? 0);
                    events.Add(new(skill.Id, skill.NameKo, side, $"소환 {e.UnitId} ×{e.Amount}"));
                    break;

                default:
                    throw new InvalidOperationException(
                        $"스킬 '{skill.Id}' 의 미구현 EffectType '{e.Type}' — 조용한 무시 금지 [MUST §5.2·§8]");
            }
        }
    }

    private static int StatValue(CharacterStats s, string? stat) => stat switch
    {
        "ldr" => s.Ldr, "str" => s.Str, "int" => s.Int, "pol" => s.Pol, "cha" => s.Cha, "nav" => s.Nav,
        null => 100,   // scaling 미지정 = ×1.0
        _ => throw new InvalidOperationException($"미지원 scaling_stat '{stat}' [MUST §5.2]")
    };

    private static int ClampInt(long v) => v > int.MaxValue ? int.MaxValue : v < 0 ? 0 : (int)v;
}
