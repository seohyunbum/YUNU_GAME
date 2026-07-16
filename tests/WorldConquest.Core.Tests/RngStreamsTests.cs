using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>명명 스트림(설계문서 §4.4·§2.7.3): 결정적 파생·스트림 격리·세이브 복원.</summary>
public class RngStreamsTests
{
    [Fact]
    public void 같은_마스터시드는_같은_스트림_시퀀스()
    {
        var a = new RngStreams(2026);
        var b = new RngStreams(2026);
        for (var i = 0; i < 50; i++)
            Assert.Equal(a.Stream(RngStreams.Combat).NextUInt32(),
                         b.Stream(RngStreams.Combat).NextUInt32());
    }

    [Fact]
    public void 스트림_소비는_다른_스트림을_바꾸지_않는다()
    {
        // combat 을 잔뜩 소비한 뒤 world_events 를 읽어도, combat 을 안 쓴 경우의 world_events 와 동일해야 한다.
        var withNoise = new RngStreams(7);
        for (var i = 0; i < 100; i++) withNoise.Stream(RngStreams.Combat).NextUInt32();
        var noisy = withNoise.Stream(RngStreams.WorldEvents).NextUInt32();

        var clean = new RngStreams(7).Stream(RngStreams.WorldEvents).NextUInt32();
        Assert.Equal(clean, noisy);
    }

    [Fact]
    public void 세력별_summon_스트림은_서로_독립()
    {
        var rng = new RngStreams(7);
        var father = rng.Stream(RngStreams.Summon("father")).NextUInt32();
        var son = rng.Stream(RngStreams.Summon("son")).NextUInt32();
        // 완전히 같을 확률은 무시 가능 — 세이브스컴 방지의 세력 격리(§2.8.5).
        Assert.NotEqual(father, son);
    }

    [Fact]
    public void 스냅샷_복원_후_시퀀스_연속()
    {
        var rng = new RngStreams(12345);
        for (var i = 0; i < 10; i++) rng.Stream(RngStreams.Combat).NextUInt32();

        // 세이브 = 활성 스트림 상태 스냅샷 → 새 객체에 복원
        var snapshot = rng.Snapshot();
        var restored = new RngStreams(12345);
        foreach (var (name, pcg) in snapshot)
            restored.Restore(name, pcg.State, pcg.Inc);

        for (var i = 0; i < 50; i++)
            Assert.Equal(rng.Stream(RngStreams.Combat).NextUInt32(),
                         restored.Stream(RngStreams.Combat).NextUInt32());
    }

    [Fact]
    public void 미조회_스트림은_로드후_재파생되어_동일()
    {
        // world_events 를 저장 시점에 안 썼다면 스냅샷에 없다 → 로드 후 첫 조회 시 재파생이 원본과 같아야 한다(D8).
        var rng = new RngStreams(999);
        rng.Stream(RngStreams.Combat).NextUInt32();   // combat 만 소비

        var restored = new RngStreams(999);
        foreach (var (name, pcg) in rng.Snapshot())
            restored.Restore(name, pcg.State, pcg.Inc);

        Assert.Equal(rng.Stream(RngStreams.WorldEvents).NextUInt32(),
                     restored.Stream(RngStreams.WorldEvents).NextUInt32());
    }
}
