using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>결정론 PRNG (설계문서 §4.4·세이브 D8): 같은 시드 = 같은 시퀀스, (state,inc) 로 완전 복원.</summary>
public class Pcg32Tests
{
    [Fact]
    public void 같은_시드는_같은_시퀀스()
    {
        var a = new Pcg32(42, 7);
        var b = new Pcg32(42, 7);
        for (var i = 0; i < 100; i++)
            Assert.Equal(a.NextUInt32(), b.NextUInt32());
    }

    [Fact]
    public void 다른_시퀀스는_다른_스트림()
    {
        var a = new Pcg32(42, 1);
        var b = new Pcg32(42, 2);
        // 첫 몇 값이 전부 같을 확률은 무시 가능 — 스트림 격리(§4.4) 확인.
        var same = 0;
        for (var i = 0; i < 20; i++)
            if (a.NextUInt32() == b.NextUInt32()) same++;
        Assert.True(same < 20, "다른 seq 스트림이 동일 시퀀스를 냈습니다");
    }

    [Fact]
    public void 상태_직렬화_왕복_후_시퀀스_동일()
    {
        var rng = new Pcg32(12345, 3);
        for (var i = 0; i < 10; i++) rng.NextUInt32();   // 임의 위치까지 진행

        // 세이브 = (state, inc) 저장 → 복원
        var restored = Pcg32.FromState(rng.State, rng.Inc);

        // 이후 시퀀스가 완전히 동일해야 한다 (세이브→로드 연속성, D8)
        for (var i = 0; i < 50; i++)
            Assert.Equal(rng.NextUInt32(), restored.NextUInt32());
    }

    [Fact]
    public void NextInt_는_범위내_그리고_결정적()
    {
        var a = new Pcg32(99);
        var b = new Pcg32(99);
        for (var i = 0; i < 1000; i++)
        {
            var v = a.NextInt(6);
            Assert.InRange(v, 0, 5);
            Assert.Equal(v, b.NextInt(6));
        }
    }

    [Fact]
    public void NextInt_bound_0이하는_예외()
    {
        var rng = new Pcg32(1);
        Assert.Throws<ArgumentOutOfRangeException>(() => rng.NextInt(0));
        Assert.Throws<ArgumentOutOfRangeException>(() => rng.NextInt(-3));
    }

    [Fact]
    public void NextInt_대략_균등_분포()
    {
        var rng = new Pcg32(2026);
        var counts = new int[6];
        const int n = 60_000;
        for (var i = 0; i < n; i++) counts[rng.NextInt(6)]++;
        // 각 버킷이 기대치(n/6)의 ±10% 안 — 편향 제거(rejection) 대략 확인.
        foreach (var c in counts)
            Assert.InRange(c, n / 6 * 9 / 10, n / 6 * 11 / 10);
    }
}
