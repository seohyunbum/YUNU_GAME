namespace WorldConquest.Core.Domain;

/// <summary>
/// 데미지 공식 순수 함수 모음 (설계문서 §2.6·§4.2·전투 C1). 상태·부작용 없음 — 같은 입력이면 항상 같은 결과.
/// 모든 보정은 정수 스케일 ×100 (§4.4), 나눗셈은 내림. variance(난수 변동)는 호출자(CombatManager)가
/// combat 스트림으로 얹는다 — 이 함수는 결정적 기대값만 낸다.
/// </summary>
public static class DamageCalculator
{
    /// <summary>
    /// 1회 교전 데미지. attackPower/defensePower 는 호출자가 집계한 기본 공격력·방어력(병종 atk/def × 병력 등).
    /// classAdvantagePct=상성 배율 ×100(100=등배·150=우세), terrain 보정은 ×100(-100~100).
    /// 결과는 최소 1(교착 방지 — §2.8 도달가능성 불변식과 정합).
    /// </summary>
    public static int Calculate(
        int attackPower,
        int defensePower,
        int classAdvantagePct,
        int attackerTerrainAtkPct,
        int defenderTerrainDefPct)
    {
        // 공격력에 상성·공격 지형 보정을 곱해 합성 (long 위드닝 — 오버플로 방지).
        long atk = (long)attackPower * classAdvantagePct / 100;
        atk = atk * (100 + attackerTerrainAtkPct) / 100;

        // 방어력에 방어 지형 보정. 방어는 데미지를 절반 계수로 상쇄(Phase 2 초기 계수 — 배치 시뮬로 튜닝).
        long def = (long)defensePower * (100 + defenderTerrainDefPct) / 100;

        var damage = atk - def / 2;
        if (damage < 1) return 1;                       // 최소 1 (교착 방지)
        return damage > int.MaxValue ? int.MaxValue : (int)damage;   // 상한 clamp — (int) 캐스팅 오버플로 방지
    }
}
