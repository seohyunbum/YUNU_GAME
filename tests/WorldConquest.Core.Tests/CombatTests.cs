using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>자동 전투 (§2.6·전투 C2/C3): 결정성·압도 승리·점령 이전·검증 거부.</summary>
public class CombatTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    /// <summary>표준 시나리오: joseon 대군이 pyongyang(중립→wei 소유로 조작) 수비군을 공격.</summary>
    private static (GameState s, GameManager gm) AttackScenario(GameDatabase db, ulong seed,
        int attackerTroops = 5000, int defenderTroops = 500)
    {
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        var gm = new GameManager(s, db);
        var wei = s.Factions.Single(f => f.Id == "wei");
        wei.OwnedProvinceIds.Add("pyongyang");   // 한성 인접 육로 — 공격 대상

        var atk = new Army("joseon_army_1", "joseon", "hanseong");
        atk.AddUnits("spearman", attackerTroops);
        s.Armies.Add(atk);
        var def = new Army("wei_army_1", "wei", "pyongyang");
        def.AddUnits("archer", defenderTroops);
        s.Armies.Add(def);
        return (s, gm);
    }

    [Fact]
    public void 압도적_공격은_점령하고_수비는_소멸()
    {
        var db = Db();
        var (s, gm) = AttackScenario(db, 42);
        var outcome = gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);

        Assert.Equal(AttackOutcome.AttackerWon, outcome);
        Assert.True(battle!.DefenderLosses >= 500, "수비 전멸");
        Assert.Contains("pyongyang", s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds);
        Assert.DoesNotContain("pyongyang", s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds);
        Assert.DoesNotContain(s.Armies, a => a.Id == "wei_army_1");           // 전멸 부대 제거
        Assert.Equal("pyongyang", s.Armies.Single(a => a.Id == "joseon_army_1").LocationNodeId);   // 진주
        Assert.Contains("captured:pyongyang", s.Progress);
    }

    [Fact]
    public void 같은_시드는_같은_전투_결과()   // §4.4 결정론 — combat 스트림
    {
        var db = Db();
        var (_, gm1) = AttackScenario(db, 12345, 800, 700);
        gm1.Attack("joseon", "joseon_army_1", "pyongyang", out var b1);
        var (_, gm2) = AttackScenario(db, 12345, 800, 700);
        gm2.Attack("joseon", "joseon_army_1", "pyongyang", out var b2);

        Assert.Equal(b1!.AttackerWon, b2!.AttackerWon);
        Assert.Equal(b1.AttackerLosses, b2.AttackerLosses);
        Assert.Equal(b1.DefenderLosses, b2.DefenderLosses);
        Assert.Equal(b1.Rounds, b2.Rounds);
    }

    [Fact]
    public void 압도적_수비는_공격을_격퇴()
    {
        var db = Db();
        var (s, gm) = AttackScenario(db, 7, attackerTroops: 300, defenderTroops: 8000);
        var outcome = gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);

        Assert.Equal(AttackOutcome.DefenderHeld, outcome);
        Assert.Contains("pyongyang", s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds);   // 소유 유지
        Assert.True(battle!.AttackerLosses > 0);
    }

    [Fact]
    public void 주둔군_없는_적영지는_무저항_함락()
    {
        var db = Db();
        var (s, gm) = AttackScenario(db, 1);
        s.Armies.RemoveAll(a => a.Id == "wei_army_1");   // 수비군 제거
        var outcome = gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);

        Assert.Equal(AttackOutcome.AttackerWon, outcome);
        Assert.Equal(0, battle!.Rounds);
        Assert.Contains("pyongyang", s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds);
    }

    [Fact]
    public void 공격_검증_거부_케이스()
    {
        var db = Db();
        var (s, gm) = AttackScenario(db, 1);
        Assert.Equal(AttackOutcome.NoSuchArmy, gm.Attack("joseon", "nope", "pyongyang", out _));
        Assert.Equal(AttackOutcome.NotYourArmy, gm.Attack("joseon", "wei_army_1", "hanseong", out _));
        Assert.Equal(AttackOutcome.NotEnemyProvince, gm.Attack("joseon", "joseon_army_1", "hanseong", out _)); // 자기 영지
        Assert.Equal(AttackOutcome.NotEnemyProvince, gm.Attack("joseon", "joseon_army_1", "zzz", out _));       // 미존재
        Assert.Equal(AttackOutcome.NotAdjacent, gm.Attack("joseon", "joseon_army_1", "beijing", out _));        // 비인접(wei 소유)
    }

    [Fact]
    public void 상성_우세가_전투_손실을_줄인다()   // §2.5 창→기 상성이 실전에 반영되는지
    {
        var db = Db();
        // 같은 규모: 창병(vs 기병 ×1.5) vs 기병(vs 창병 ×1.0)
        var s = GameSetup.NewCampaign(db, 99, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds.Add("pyongyang");
        var spear = new Army("joseon_army_1", "joseon", "hanseong");
        spear.AddUnits("spearman", 2000);
        s.Armies.Add(spear);
        var cav = new Army("wei_army_1", "wei", "pyongyang");
        cav.AddUnits("cavalry", 2000);
        s.Armies.Add(cav);

        gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);
        // 창병이 상성 우세(150) — 같은 병력이면 공격측이 유리하게 손실 교환
        Assert.True(battle!.DefenderLosses > battle.AttackerLosses,
            $"상성 우세 미반영: 아군 {battle.AttackerLosses} vs 적 {battle.DefenderLosses}");
    }
}
