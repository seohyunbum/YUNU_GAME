using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>자동 전투 결과 (§2.6 전투 위임).</summary>
public sealed record BattleResult(bool AttackerWon, int AttackerLosses, int DefenderLosses, int Rounds);

/// <summary>
/// 전투 준비·자동 계산·승패 판정 (설계문서 §2.6·§4.2·전투 C3). 그래픽 없이 Core 에서 완결 [MUST].
/// 데미지 기대값 = DamageCalculator(순수), 변동은 combat 명명 스트림(§4.4·C2)에서만 —
/// 같은 시드·같은 전투 순서면 결과가 완전히 재현된다. 상수는 game_rules.combat (§5 데이터 주도).
/// </summary>
public sealed class CombatManager
{
    private readonly GameDatabase _db;

    public CombatManager(GameDatabase db) => _db = db;

    /// <summary>
    /// 자동 계산(Auto-Resolve): 라운드마다 양측이 동시 타격 → 손실 적용, 한쪽 전멸까지.
    /// max_rounds 초과 교착은 수비 승(공성 실패). 참가 부대의 병력 손실은 이 메서드가 직접 반영한다.
    /// </summary>
    public BattleResult ResolveAuto(Army attacker, IReadOnlyList<Army> defenders, LandProvince battlefield, Pcg32 rng)
    {
        var rules = _db.Rules;
        var terrain = _db.TerrainModifiers[battlefield.Terrain];
        var atkStart = attacker.TotalTroops;
        var defStart = defenders.Sum(a => a.TotalTroops);
        var advAtk = WeightedAdvantagePct(new[] { attacker }, defenders);
        var advDef = WeightedAdvantagePct(defenders, new[] { attacker });

        var rounds = 0;
        while (attacker.TotalTroops > 0 && defenders.Sum(a => a.TotalTroops) > 0 && rounds < rules.CombatMaxRounds)
        {
            rounds++;
            // 동시 타격: 라운드 시작 시점 전력으로 양측 데미지 산출 (선공 이점 없음 — 결정성·대칭)
            var dmgToDef = RollDamage(AttackPower(new[] { attacker }), DefensePower(defenders),
                advAtk, terrain.AtkMod, terrain.DefMod, rng, rules.CombatVariancePct);
            var dmgToAtk = RollDamage(AttackPower(defenders), DefensePower(new[] { attacker }),
                advDef, terrain.AtkMod, 0, rng, rules.CombatVariancePct);   // 공격측은 야전 — 지형 방어 보정 없음

            ApplyCasualties(defenders, Casualties(dmgToDef, rules.CombatDamagePerCasualty));
            ApplyCasualties(new[] { attacker }, Casualties(dmgToAtk, rules.CombatDamagePerCasualty));
        }

        var attackerWon = attacker.TotalTroops > 0 && defenders.Sum(a => a.TotalTroops) == 0;
        return new BattleResult(
            attackerWon,
            atkStart - attacker.TotalTroops,
            defStart - defenders.Sum(a => a.TotalTroops),
            rounds);
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

    private int AttackPower(IEnumerable<Army> side) => Power(side, u => u.Atk);
    private int DefensePower(IEnumerable<Army> side) => Power(side, u => u.Def);

    private int Power(IEnumerable<Army> side, Func<UnitType, int> stat)
    {
        long sum = 0;
        foreach (var army in side)
            foreach (var (unitId, count) in army.Units)
                if (_db.Units.TryGetValue(unitId, out var unit))
                    sum += (long)stat(unit) * count;
        return sum > int.MaxValue ? int.MaxValue : (int)sum;
    }

    /// <summary>병력 가중 평균 상성 배율(×100) — 병종별 if문 없이 구성비로 합성 (§4.4·§2.5).</summary>
    private int WeightedAdvantagePct(IEnumerable<Army> atkSide, IEnumerable<Army> defSide)
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
    private static void ApplyCasualties(IEnumerable<Army> side, int casualties)
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
