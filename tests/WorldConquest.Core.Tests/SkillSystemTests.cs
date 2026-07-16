using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>EffectType 해석기·게이지·실드 (§2.4·§5.2·전투 C4/C5). 미지 타입 throw [MUST].</summary>
public class SkillSystemTests
{
    private static readonly CharacterStats Caster = new(100, 100, 100, 100, 100, 100);

    private static Skill MakeSkill(params SkillEffect[] effects) =>
        new("test_skill", "테스트", "ultimate", 100, "cs", Array.Empty<SkillCondition>(), effects);

    [Fact]
    public void 미지_EffectType은_throw()   // C4 [MUST] — 조용한 무시 금지
    {
        var skill = MakeSkill(new SkillEffect("instant_win", "enemy_all"));
        var ex = Assert.Throws<InvalidOperationException>(() =>
            SkillSystem.Execute(skill, Caster, new BattleSideState(), new BattleSideState(), new(), "공격"));
        Assert.Contains("instant_win", ex.Message);
    }

    [Fact]
    public void 미지_조건타입은_throw()
    {
        var skill = new Skill("s", "s", "ultimate", 100, null,
            new[] { new SkillCondition("moon_phase", "full") }, Array.Empty<SkillEffect>());
        Assert.Throws<InvalidOperationException>(() => SkillSystem.ConditionsMet(skill, "land"));
    }

    [Fact]
    public void battle_domain_조건_판정()
    {
        var naval = new Skill("s", "s", "ultimate", 100, null,
            new[] { new SkillCondition("battle_domain", "naval") }, Array.Empty<SkillEffect>());
        Assert.False(SkillSystem.ConditionsMet(naval, "land"));
        Assert.True(SkillSystem.ConditionsMet(naval, "naval"));
    }

    [Fact]
    public void 데미지_스킬은_스케일링_스탯_반영()
    {
        var own = new BattleSideState(); var enemy = new BattleSideState();
        var skill = MakeSkill(new SkillEffect("aoe_damage", "enemy_all", Power: 250, ScalingStat: "nav"));
        var caster = new CharacterStats(0, 0, 0, 0, 0, 120);   // nav 120
        SkillSystem.Execute(skill, caster, own, enemy, new(), "공격");
        Assert.Equal(250 * 120 / 100, enemy.PendingSkillDamage);   // 300
    }

    [Fact]
    public void 실드_무효와_흡수()
    {
        var s = new BattleSideState();
        s.SetShield(rounds: 2, absorb: -1);          // 완전 무효 (마슈)
        Assert.Equal(0, s.AbsorbDamage(99999));
        s.TickRound(); s.TickRound();                 // 만료
        Assert.Equal(500, s.AbsorbDamage(500));

        var t = new BattleSideState();
        t.SetShield(rounds: 3, absorb: 300);          // 흡수형
        Assert.Equal(0, t.AbsorbDamage(200));         // 잔량 100
        Assert.Equal(150, t.AbsorbDamage(250));       // 100 흡수 후 150 통과
    }

    [Fact]
    public void 버프는_지속시간_만료로_소멸()
    {
        var s = new BattleSideState();
        s.AddBuff("atk", 30, rounds: 2);
        Assert.Equal(30, s.SumBuff("atk"));
        s.TickRound();
        Assert.Equal(30, s.SumBuff("atk"));
        s.TickRound();
        Assert.Equal(0, s.SumBuff("atk"));
    }

    [Fact]
    public void 게이지_충전은_상한_캡과_충전률_버프_반영()
    {
        var s = new BattleSideState();
        SkillSystem.Charge(s, 30, gaugeMax: 100);
        Assert.Equal(30, s.Gauge);
        s.AddBuff("gauge_charge_rate", 100, 5);   // +100% → 2배
        SkillSystem.Charge(s, 30, gaugeMax: 100);
        Assert.Equal(90, s.Gauge);
        SkillSystem.Charge(s, 30, gaugeMax: 100);
        Assert.Equal(100, s.Gauge);               // 캡
    }
}

/// <summary>지휘관·궁극기가 실전투에 통합되는지 (§2.4·C5, Phase 2 DoD '스킬 수치 변화 검증').</summary>
public class CommanderBattleTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm) Scenario(GameDatabase db, ulong seed)
    {
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        var gm = new GameManager(s, db);
        s.Factions.Single(f => f.Id == "wei").OwnedProvinceIds.Add("pyongyang");
        var atk = new Army("joseon_army_1", "joseon", "hanseong");
        atk.AddUnits("spearman", 1000);
        s.Armies.Add(atk);
        var def = new Army("wei_army_1", "wei", "pyongyang");
        def.AddUnits("spearman", 1000);
        s.Armies.Add(def);
        return (s, gm);
    }

    [Fact]
    public void 지휘관_임명과_검증()
    {
        var db = Db();
        var (s, gm) = Scenario(db, 1);
        Assert.Equal(AssignOutcome.Success, gm.AssignCommander("joseon", "joseon_army_1", "guan_yu"));
        Assert.Equal("guan_yu", s.Armies.Single(a => a.Id == "joseon_army_1").CommanderId);
        Assert.Equal(AssignOutcome.UnknownCharacter, gm.AssignCommander("joseon", "joseon_army_1", "nobody"));
        Assert.Equal(AssignOutcome.NotYourArmy, gm.AssignCommander("joseon", "wei_army_1", "cao_cao"));
        // 같은 무장을 다른 부대가 중복 임명 불가
        var second = new Army("joseon_army_2", "joseon", "hanseong");
        second.AddUnits("archer", 10);
        s.Armies.Add(second);
        Assert.Equal(AssignOutcome.AlreadyAssigned, gm.AssignCommander("joseon", "joseon_army_2", "guan_yu"));
    }

    [Fact]
    public void 궁극기가_전투중_자동발동_로그된다()
    {
        var db = Db();
        var (s, gm) = Scenario(db, 42);
        gm.AssignCommander("joseon", "joseon_army_1", "guan_yu");        // 청룡언월참 (land)
        gm.AssignCommander("wei", "wei_army_1", "mash_kyrielight");      // 로드 카멜롯 (무조건 실드)

        gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);

        Assert.True(battle!.Rounds >= 4, $"게이지 발동 전 종전: {battle.Rounds}라운드");
        Assert.Contains(battle.SkillEvents, e => e.SkillId == "green_dragon_slash" && e.Side == "공격");
        Assert.Contains(battle.SkillEvents, e => e.SkillId == "lord_camelot" && e.Side == "수비");
    }

    [Fact]
    public void 지휘관_전투도_같은_시드_같은_결과()
    {
        var db = Db();
        var (_, gm1) = Scenario(db, 777);
        gm1.AssignCommander("joseon", "joseon_army_1", "guan_yu");
        gm1.AssignCommander("wei", "wei_army_1", "mash_kyrielight");
        gm1.Attack("joseon", "joseon_army_1", "pyongyang", out var b1);

        var (_, gm2) = Scenario(db, 777);
        gm2.AssignCommander("joseon", "joseon_army_1", "guan_yu");
        gm2.AssignCommander("wei", "wei_army_1", "mash_kyrielight");
        gm2.Attack("joseon", "joseon_army_1", "pyongyang", out var b2);

        Assert.Equal(b1!.AttackerWon, b2!.AttackerWon);
        Assert.Equal(b1.Rounds, b2.Rounds);
        Assert.Equal(b1.SkillEvents.Count, b2.SkillEvents.Count);
        Assert.Equal(b1.AttackerLosses, b2.AttackerLosses);
    }

    [Fact]
    public void naval_궁극기는_육상전에서_미발동()   // 이순신 학익진 — 조건 불충족
    {
        var db = Db();
        var (_, gm) = Scenario(db, 5);
        gm.AssignCommander("joseon", "joseon_army_1", "yi_sunsin");
        gm.Attack("joseon", "joseon_army_1", "pyongyang", out var battle);
        Assert.DoesNotContain(battle!.SkillEvents, e => e.SkillId == "crane_wing_formation");
    }
}
