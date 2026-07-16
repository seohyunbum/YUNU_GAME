using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>세이브 왕복 (설계문서 §8·Phase 1 DoD): 풍부 상태 왕복 동일성·RNG 연속성·미래 버전 거부.</summary>
public class SaveSystemTests
{
    // 전 필드 비기본값 '풍부 상태' 픽스처 — 2인 협동 상태(동맹·전쟁·복수 세력) 포함.
    private static GameState RichState()
    {
        var rng = new RngStreams(0xDEADBEEFUL);
        rng.Stream(RngStreams.Combat).NextUInt32();          // 스트림 소비(비기본 상태)
        rng.Stream(RngStreams.WorldEvents).NextUInt32();
        return new GameState
        {
            DataSchemaVersion = 1,
            CampaignSeed = 0xDEADBEEFUL,
            Turn = 12,
            Phase = TurnPhase.Player2Command,
            Actor = "son",
            Rng = rng,
            Factions = new()
            {
                new FactionState
                {
                    Id = "father", Controller = "human_p1",
                    Treasury = 1200, Food = 800, TechLevel = 2,
                    OwnedProvinceIds = new() { "hanseong", "busan" },
                    Relations = new() { ["son"] = DiplomaticState.Alliance, ["wei"] = DiplomaticState.War }
                },
                new FactionState
                {
                    Id = "son", Controller = "human_p2",
                    Treasury = 900, Food = 750, TechLevel = 1,
                    OwnedProvinceIds = new() { "tokyo" },
                    Relations = new() { ["father"] = DiplomaticState.Alliance }
                }
            },
            Progress = new() { "captured:pyongyang", "first_alliance" }
        };
    }

    private static string TempSavePath() =>
        Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");

    [Fact]
    public void 저장_로드_상태_동일성()
    {
        var path = TempSavePath();
        try
        {
            var sys = new SaveSystem();
            var original = RichState();
            sys.Save(original, path);
            var loaded = sys.Load(path);

            Assert.Equal(original.Turn, loaded.Turn);
            Assert.Equal(original.Phase, loaded.Phase);
            Assert.Equal(original.Actor, loaded.Actor);
            Assert.Equal(original.CampaignSeed, loaded.CampaignSeed);
            Assert.Equal(original.Progress, loaded.Progress);
            Assert.Equal(original.Factions.Count, loaded.Factions.Count);

            var of = original.Factions[0]; var lf = loaded.Factions.Single(f => f.Id == of.Id);
            Assert.Equal(of.Controller, lf.Controller);
            Assert.Equal(of.Treasury, lf.Treasury);
            Assert.Equal(of.OwnedProvinceIds, lf.OwnedProvinceIds);
            Assert.Equal(of.Relations, lf.Relations);   // 2인 협동 상태(동맹·전쟁)
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 저장_로드_후_RNG_시퀀스_연속()
    {
        var path = TempSavePath();
        try
        {
            var sys = new SaveSystem();
            var original = RichState();
            // 저장 직전 combat 스트림의 다음 값들을 미리 채취
            var expected = new List<uint>();
            var probe = RichState();
            for (var i = 0; i < 20; i++) expected.Add(probe.Rng.Stream(RngStreams.Combat).NextUInt32());

            sys.Save(original, path);
            var loaded = sys.Load(path);

            // 로드된 상태에서 combat 스트림을 이어 돌리면 저장 시점 이후 시퀀스와 동일해야 한다(D8).
            for (var i = 0; i < 20; i++)
                Assert.Equal(expected[i], loaded.Rng.Stream(RngStreams.Combat).NextUInt32());
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 기존_파일_덮어쓰기_atomic()
    {
        var path = TempSavePath();
        try
        {
            var sys = new SaveSystem();
            var a = RichState(); a.Turn = 1;
            sys.Save(a, path);
            var b = RichState(); b.Turn = 99;
            sys.Save(b, path);   // 기존 파일 존재 → File.Replace 경로
            Assert.Equal(99, sys.Load(path).Turn);
            Assert.False(File.Exists(path + ".tmp"), "임시 파일이 남았습니다");
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 미래_세이브버전_거부()
    {
        var path = TempSavePath();
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var future = SaveSystem.CurrentSaveVersion + 1;
            File.WriteAllText(path, $"{{\"save_version\": {future}, \"campaign_seed\": \"0000000000000001\"}}");
            var ex = Assert.Throws<InvalidOperationException>(() => new SaveSystem().Load(path));
            Assert.Contains("미래 세이브 버전", ex.Message);
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void 로드시_삭제된_정의_id는_failsoft_스킵()
    {
        var path = TempSavePath();
        try
        {
            var db = new DataLoader().Load(TestPaths.RepoDataDir);
            var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
            // 존재하지 않는 영지 참조 + 존재하지 않는 세력을 세이브에 주입
            s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds.Add("atlantis");
            s.Factions.Add(new FactionState
            {
                Id = "ghost_faction", Controller = "ai", Treasury = 0, Food = 0, TechLevel = 1,
                OwnedProvinceIds = new(), Relations = new()
            });
            new SaveSystem().Save(s, path);

            var result = new SaveSystem().Load(path, db);   // db 대조 fail-soft
            var joseon = result.State.Factions.Single(f => f.Id == "joseon");

            Assert.DoesNotContain("atlantis", joseon.OwnedProvinceIds);              // 삭제 영지 스킵
            Assert.DoesNotContain(result.State.Factions, f => f.Id == "ghost_faction"); // 삭제 세력 스킵
            Assert.Contains(result.Skipped, x => x.Contains("atlantis"));            // 고지됨
            Assert.Contains(result.Skipped, x => x.Contains("ghost_faction"));
            Assert.Contains("hanseong", joseon.OwnedProvinceIds);                    // 유효 영지는 유지
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void save_version_누락은_예외()
    {
        var path = TempSavePath();
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, "{\"campaign_seed\": \"0000000000000001\"}");
            Assert.Throws<InvalidOperationException>(() => new SaveSystem().Load(path));
        }
        finally { File.Delete(path); }
    }
}
