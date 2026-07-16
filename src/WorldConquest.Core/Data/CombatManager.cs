using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>일기토 결과 (§2.6, 2026-07-16 구현 확정) — 컷씬 트리거(온주참화웅)·연출의 원천.</summary>
public sealed record DuelInfo(string WinnerCharacterId, string LoserCharacterId, bool AttackerWon);

/// <summary>자동 전투 결과 (§2.6 전투 위임). SkillEvents = 발동 스킬 로그(콘솔 표시·DoD 수치 검증).</summary>
public sealed record BattleResult(
    bool AttackerWon, int AttackerLosses, int DefenderLosses, int Rounds,
    IReadOnlyList<SkillEvent> SkillEvents, string? Wind = null, DuelInfo? Duel = null);

/// <summary>
/// 전투 준비·자동 계산·승패 판정 (설계문서 §2.6·§4.2·전투 C3). 그래픽 없이 Core 에서 완결 [MUST].
/// 데미지 기대값 = DamageCalculator(순수), 변동은 combat 명명 스트림(§4.4·C2)에서만 —
/// 같은 시드·같은 전투 순서면 결과가 완전히 재현된다. 상수는 game_rules.combat (§5 데이터 주도).
/// 지휘관(CommanderId)이 있으면 패시브 상시 + 게이지 충전 → 궁극기 자동 발동 (§2.4·C5).
/// </summary>
public sealed class CombatManager
{
    /// <summary>8방위 (§2.6 풍향·조류). 로더 valid_current_directions 와 동일 집합.</summary>
    private static readonly string[] Directions = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" };

    private readonly GameDatabase _db;

    public CombatManager(GameDatabase db) => _db = db;

    /// <summary>
    /// 자동 계산(Auto-Resolve): 라운드마다 양측이 동시 타격 → 손실 적용, 한쪽 전멸까지.
    /// max_rounds 초과 교착은 수비 승(공성 실패). 참가 부대의 병력 손실은 이 메서드가 직접 반영한다.
    /// </summary>
    public BattleResult ResolveAuto(MilitaryForce attacker, IReadOnlyList<MilitaryForce> defenders,
        LandProvince battlefield, Pcg32 rng, bool landing = false)
    {
        var terrain = _db.TerrainModifiers[battlefield.Terrain];
        return ResolveCore(attacker, defenders, "land", terrain.AtkMod, terrain.DefMod, landing, rng, wind: null);
    }

    /// <summary>
    /// 해상전 (§2.6 [MUST]): 풍향은 combat 스트림에서 8방위 추첨, 해역 조류(current_direction)와의
    /// 정렬로 공격 보정 — 순풍·순류 = +(wind+current)%, 역풍·역류 = -(wind+current)%, 그 외 중립.
    /// </summary>
    public BattleResult ResolveNaval(MilitaryForce attacker, IReadOnlyList<MilitaryForce> defenders,
        SeaZone sea, Pcg32 rng)
    {
        var wind = Directions[rng.NextInt(Directions.Length)];
        var swing = _db.Rules.NavalWindAtkPct + _db.Rules.NavalCurrentAtkPct;
        var atkBonus = wind == sea.CurrentDirection ? swing
                     : wind == Opposite(sea.CurrentDirection) ? -swing : 0;
        return ResolveCore(attacker, defenders, "naval", atkBonus, 0, false, rng, wind);
    }

    private static string Opposite(string dir) =>
        Directions[(Array.IndexOf(Directions, dir) + 4) % Directions.Length];

    private BattleResult ResolveCore(MilitaryForce attacker, IReadOnlyList<MilitaryForce> defenders,
        string domain, int atkTerrainPct, int defTerrainPct, bool landing, Pcg32 rng, string? wind)
    {
        var rules = _db.Rules;
        var atkSide = new MilitaryForce[] { attacker };
        var atkStart = attacker.TotalTroops;
        var defStart = defenders.Sum(a => a.TotalTroops);
        var advAtk = WeightedAdvantagePct(atkSide, defenders);
        var advDef = WeightedAdvantagePct(defenders, atkSide);

        var events = new List<SkillEvent>();
        var atkState = new BattleSideState();
        var defState = new BattleSideState();
        var atkCmdr = Commander(atkSide);
        var defCmdr = Commander(defenders);

        // 패시브: 전투 시작 시 상시 발동 (§2.4) — 조건(battle_domain) 통과 시
        ApplyPassive(atkCmdr, atkState, defState, events, "공격", domain);
        ApplyPassive(defCmdr, defState, atkState, events, "수비", domain);

        // 일기토 (§2.6): 육상전 + 양측 지휘관 + 무력 격차가 상한 이내면 개전 전 1:1 — 승자 측 사기·게이지 이득
        DuelInfo? duel = null;
        if (domain == "land" && atkCmdr is not null && defCmdr is not null &&
            Math.Abs(atkCmdr.Stats.Str - defCmdr.Stats.Str) <= rules.DuelStrGapMax)
        {
            int DuelRoll(int str, BattleSideState side)
            {
                var power = str + side.SumBuff("duel_power");
                var swing = rng.NextInt(2 * rules.DuelVariancePct + 1) - rules.DuelVariancePct;
                return (int)((long)power * (100 + swing) / 100);
            }
            var atkWins = DuelRoll(atkCmdr.Stats.Str, atkState) >= DuelRoll(defCmdr.Stats.Str, defState);
            var winnerState = atkWins ? atkState : defState;
            winnerState.AddBuff("morale", rules.DuelWinnerMoraleBonus, rules.CombatMaxRounds);   // 전투 내내
            SkillSystem.Charge(winnerState, rules.DuelWinnerGaugeBonus, rules.UltimateGaugeMax);
            duel = new DuelInfo(
                atkWins ? atkCmdr.Id : defCmdr.Id,
                atkWins ? defCmdr.Id : atkCmdr.Id,
                atkWins);
            events.Add(new SkillEvent("duel", "일기토", atkWins ? "공격" : "수비",
                $"{duel.WinnerCharacterId} 승 — 사기+{rules.DuelWinnerMoraleBonus}%·게이지+{rules.DuelWinnerGaugeBonus}"));
        }

        var rounds = 0;
        while (attacker.TotalTroops > 0 && defenders.Sum(a => a.TotalTroops) > 0 && rounds < rules.CombatMaxRounds)
        {
            rounds++;

            // 게이지 충전 (§2.4 — 피해를 주고받을 때. 동시 타격이라 양측 모두 공격+피격)
            var charge = rules.GaugeChargeOnAttack + rules.GaugeChargeOnDamaged;
            SkillSystem.Charge(atkState, charge, rules.UltimateGaugeMax);
            SkillSystem.Charge(defState, charge, rules.UltimateGaugeMax);

            // 궁극기 자동 발동 — 공격측 우선 (결정적 순서, C5)
            TryUltimate(atkCmdr, atkState, defState, events, "공격", domain);
            TryUltimate(defCmdr, defState, atkState, events, "수비", domain);

            // 소환 병력 반영 (전력 계산 전 — arise 등)
            ApplySummons(atkState, atkSide);
            ApplySummons(defState, defenders);

            // 버프 합성: 공격% = atk + land_atk + morale / 피해 감소% = damage_reduction (전투 무관 스탯은 미사용)
            var domainAtkBuff = domain == "land" ? "land_atk" : "naval_atk";
            var domainDefBuff = domain == "naval" ? "naval_def" : "land_def";
            var atkBonusA = atkState.SumBuff("atk") + atkState.SumBuff(domainAtkBuff) + atkState.SumBuff("morale");
            var atkBonusD = defState.SumBuff("atk") + defState.SumBuff(domainAtkBuff) + defState.SumBuff("morale");
            var defBonusD = defState.SumBuff(domainDefBuff);

            // 상륙전 (§2.6 [MUST]): 첫 landing_debuff_turns 라운드 동안 공격측 landing_attack_modifier(-25%)
            if (landing && rounds <= rules.LandingDebuffTurns)
                atkBonusA += rules.LandingAttackModifier;

            var dmgToDef = RollDamage(Scale(AttackPower(atkSide), atkBonusA), Scale(DefensePower(defenders), defBonusD),
                advAtk, atkTerrainPct, defTerrainPct, rng, rules.CombatVariancePct);
            var dmgToAtk = RollDamage(Scale(AttackPower(defenders), atkBonusD), DefensePower(atkSide),
                advDef, atkTerrainPct, 0, rng, rules.CombatVariancePct);   // 공격측은 야전 — 지형 방어 보정 없음

            // 스킬 직접 데미지(aoe/single) 합산 → 피해 감소 → 실드 통과
            dmgToDef = AddClamp(dmgToDef, defState.PendingSkillDamage); defState.PendingSkillDamage = 0;
            dmgToAtk = AddClamp(dmgToAtk, atkState.PendingSkillDamage); atkState.PendingSkillDamage = 0;
            dmgToDef = Reduce(dmgToDef, defState.SumBuff("damage_reduction"));
            dmgToAtk = Reduce(dmgToAtk, atkState.SumBuff("damage_reduction"));
            dmgToDef = defState.AbsorbDamage(dmgToDef);
            dmgToAtk = atkState.AbsorbDamage(dmgToAtk);

            if (dmgToDef > 0) ApplyCasualties(defenders, Casualties(dmgToDef, rules.CombatDamagePerCasualty));
            if (dmgToAtk > 0) ApplyCasualties(atkSide, Casualties(dmgToAtk, rules.CombatDamagePerCasualty));

            // 회복 (divine_standard 등) — 손실 적용 후, 첫 부대 첫 병종에 결정적으로
            ApplyHeal(atkState, atkSide, rules.CombatDamagePerCasualty);
            ApplyHeal(defState, defenders, rules.CombatDamagePerCasualty);

            atkState.TickRound();
            defState.TickRound();
        }

        var attackerWon = attacker.TotalTroops > 0 && defenders.Sum(a => a.TotalTroops) == 0;
        return new BattleResult(
            attackerWon,
            atkStart - attacker.TotalTroops,
            Math.Max(0, defStart - defenders.Sum(a => a.TotalTroops)),   // 소환으로 시작치 초과 가능 — 음수 방지
            rounds,
            events,
            wind,
            duel);
    }

    private Character? Commander(IEnumerable<MilitaryForce> side)
    {
        foreach (var a in side.OrderBy(a => a.Id, StringComparer.Ordinal))
            if (a.CommanderId is not null && _db.Characters.TryGetValue(a.CommanderId, out var c))
                return c;
        return null;
    }

    private void ApplyPassive(Character? cmdr, BattleSideState own, BattleSideState enemy,
        List<SkillEvent> events, string side, string domain)
    {
        if (cmdr is null) return;
        var skill = _db.Skills[cmdr.PassiveSkillId];
        if (SkillSystem.ConditionsMet(skill, domain))
            SkillSystem.Execute(skill, cmdr.Stats, own, enemy, events, side);
    }

    private void TryUltimate(Character? cmdr, BattleSideState own, BattleSideState enemy,
        List<SkillEvent> events, string side, string domain)
    {
        if (cmdr is null || own.Gauge < _db.Rules.UltimateGaugeMax) return;
        var skill = _db.Skills[cmdr.UltimateSkillId];
        if (!SkillSystem.ConditionsMet(skill, domain)) return;   // 조건 불충족 — 게이지 유지·미발동
        SkillSystem.Execute(skill, cmdr.Stats, own, enemy, events, side);
        own.Gauge -= skill.GaugeCost;
    }

    private void ApplySummons(BattleSideState state, IEnumerable<MilitaryForce> side)
    {
        if (state.PendingSummons.Count == 0) return;
        var host = side.Where(a => a.TotalTroops > 0).OrderBy(a => a.Id, StringComparer.Ordinal).FirstOrDefault();
        if (host is null) { state.PendingSummons.Clear(); return; }
        foreach (var (unitId, count) in state.PendingSummons.OrderBy(kv => kv.Key, StringComparer.Ordinal))
            if (count > 0 && _db.Units.ContainsKey(unitId)) host.AddUnits(unitId, count);
        state.PendingSummons.Clear();
    }

    private static void ApplyHeal(BattleSideState state, IEnumerable<MilitaryForce> side, int damagePerCasualty)
    {
        if (state.PendingHeal <= 0) return;
        var troops = state.PendingHeal / damagePerCasualty;
        state.PendingHeal = 0;
        if (troops <= 0) return;
        var host = side.Where(a => a.TotalTroops > 0).OrderBy(a => a.Id, StringComparer.Ordinal).FirstOrDefault();
        var unit = host?.Units.Keys.OrderBy(k => k, StringComparer.Ordinal).FirstOrDefault();
        if (host is not null && unit is not null) host.AddUnits(unit, troops);
    }

    private static int Scale(int value, int bonusPct)
    {
        var v = (long)value * (100 + Math.Max(-100, bonusPct)) / 100;
        return v < 0 ? 0 : v > int.MaxValue ? int.MaxValue : (int)v;
    }

    private static int Reduce(int damage, int cutPct) =>
        (int)((long)damage * (100 - Math.Clamp(cutPct, 0, 100)) / 100);

    private static int AddClamp(int a, int b)
    {
        var v = (long)a + b;
        return v > int.MaxValue ? int.MaxValue : (int)v;
    }

    private int RollDamage(int atkPower, int defPower, int advPct, int terrainAtkPct, int terrainDefPct,
        Pcg32 rng, int variancePct)
    {
        var expected = DamageCalculator.Calculate(atkPower, defPower, advPct, terrainAtkPct, terrainDefPct);
        if (variancePct == 0) return expected;
        var swing = rng.NextInt(2 * variancePct + 1) - variancePct;   // ±variance
        var dmg = (long)expected * (100 + swing) / 100;
        return dmg < 1 ? 1 : dmg > int.MaxValue ? int.MaxValue : (int)dmg;
    }

    private static int Casualties(int damage, int damagePerCasualty)
    {
        var c = damage / damagePerCasualty;
        return c < 1 ? 1 : c;   // 최소 1 — 교착 방지
    }

    private int AttackPower(IEnumerable<MilitaryForce> side) => Power(side, u => u.Atk);
    private int DefensePower(IEnumerable<MilitaryForce> side) => Power(side, u => u.Def);

    private int Power(IEnumerable<MilitaryForce> side, Func<UnitType, int> stat)
    {
        long sum = 0;
        foreach (var army in side)
            foreach (var (unitId, count) in army.Units)
                if (_db.Units.TryGetValue(unitId, out var unit))
                    sum += (long)stat(unit) * count;
        return sum > int.MaxValue ? int.MaxValue : (int)sum;
    }

    /// <summary>병력 가중 평균 상성 배율(×100) — 병종별 if문 없이 구성비로 합성 (§4.4·§2.5).</summary>
    private int WeightedAdvantagePct(IEnumerable<MilitaryForce> atkSide, IEnumerable<MilitaryForce> defSide)
    {
        long num = 0, denom = 0;
        foreach (var a in atkSide)
            foreach (var (au, ac) in a.Units)
            {
                if (!_db.Units.TryGetValue(au, out var atkUnit)) continue;
                foreach (var d in defSide)
                    foreach (var (du, dc) in d.Units)
                    {
                        if (!_db.Units.TryGetValue(du, out var defUnit)) continue;
                        var w = (long)ac * dc;
                        num += w * _db.Rules.GetClassAdvantage(atkUnit.Class, defUnit.Class);
                        denom += w;
                    }
            }
        return denom == 0 ? 100 : (int)(num / denom);
    }

    /// <summary>손실을 부대·병종에 비례 배분 (id ordinal 순 결정적, 잔여는 앞에서부터).</summary>
    private static void ApplyCasualties(IEnumerable<MilitaryForce> side, int casualties)
    {
        var armies = side.Where(a => a.TotalTroops > 0).OrderBy(a => a.Id, StringComparer.Ordinal).ToList();
        var total = armies.Sum(a => a.TotalTroops);
        if (total == 0) return;
        if (casualties >= total)
        {
            foreach (var a in armies)
                foreach (var (u, c) in a.Units.ToList())
                    a.RemoveUnits(u, c);
            return;
        }

        var remaining = casualties;
        foreach (var a in armies)
        {
            // 부대별 비례 몫 (마지막 부대가 잔여 흡수)
            var armyShare = a == armies[^1] ? remaining : (int)((long)casualties * a.TotalTroops / total);
            armyShare = Math.Min(armyShare, Math.Min(remaining, a.TotalTroops));
            remaining -= armyShare;

            var units = a.Units.OrderBy(kv => kv.Key, StringComparer.Ordinal).ToList();
            var armyTotal = a.TotalTroops;
            var left = armyShare;
            for (var i = 0; i < units.Count && left > 0; i++)
            {
                var (u, c) = units[i];
                var share = i == units.Count - 1 ? left : (int)((long)armyShare * c / armyTotal);
                share = Math.Min(share, Math.Min(left, c));
                if (share > 0) { a.RemoveUnits(u, share); left -= share; }
            }
            remaining += left;   // 병종 단위 못 채운 잔여는 다음 부대로
        }
    }
}
