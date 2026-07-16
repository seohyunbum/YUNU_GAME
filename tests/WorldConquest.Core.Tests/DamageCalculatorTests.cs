using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>데미지 공식 순수 함수 (§2.6·전투 C1): 상성·지형 합성·최소 1·결정성·오버플로.</summary>
public class DamageCalculatorTests
{
    [Fact]
    public void 상성_우세는_데미지_증가()
    {
        var even = DamageCalculator.Calculate(1000, 400, 100, 0, 0);   // 상성 등배
        var advantage = DamageCalculator.Calculate(1000, 400, 150, 0, 0); // 상성 ×1.5
        Assert.True(advantage > even);
    }

    [Fact]
    public void 방어_지형_보정은_데미지_감소()
    {
        var plain = DamageCalculator.Calculate(1000, 400, 100, 0, 0);
        var fortified = DamageCalculator.Calculate(1000, 400, 100, 0, 40);  // 방어 지형 +40%
        Assert.True(fortified < plain);
    }

    [Fact]
    public void 공격_지형_보정은_데미지_증가()
    {
        var plain = DamageCalculator.Calculate(1000, 400, 100, 0, 0);
        var highGround = DamageCalculator.Calculate(1000, 400, 100, 30, 0); // 공격 지형 +30%
        Assert.True(highGround > plain);
    }

    [Fact]
    public void 데미지는_최소_1_보장()
    {
        // 방어력이 공격력을 압도해도 교착(0 데미지) 없이 최소 1 (도달가능성 §2.8)
        var dmg = DamageCalculator.Calculate(10, 100000, 100, 0, 0);
        Assert.Equal(1, dmg);
    }

    [Fact]
    public void 결정적_같은_입력_같은_결과()
    {
        for (var i = 0; i < 100; i++)
            Assert.Equal(
                DamageCalculator.Calculate(1234, 567, 150, 20, 30),
                DamageCalculator.Calculate(1234, 567, 150, 20, 30));
    }

    [Fact]
    public void 큰_입력_오버플로_없음()
    {
        // int.MaxValue 근처 병력·공격력에서도 long 위드닝으로 예외·음수 없이 양수 데미지
        var dmg = DamageCalculator.Calculate(int.MaxValue, 1000, 200, 100, 0);
        Assert.True(dmg > 0);
    }
}
