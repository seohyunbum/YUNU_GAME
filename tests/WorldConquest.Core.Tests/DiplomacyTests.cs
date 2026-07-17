using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>외교 (§1.2·§4.2): 동맹 양측 동기·자원지원 상한·공동 수비·공동 승리.</summary>
public class DiplomacyTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    private static (GameState s, GameManager gm, DiplomacyManager dip) Setup(ulong seed = 1)
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, seed, "joseon", "wei");
        return (s, new GameManager(s, db), new DiplomacyManager(s, db));
    }

    // ── 관계도(Favor) 장부 — 외교 설계 E2·E3·E5 ────────────────────────────────

    private static RelationLedger Ledger(GameState s) => new(s, Db());

    [Fact]
    public void 관계도는_쌍_단위_대칭이고_순서에_무관()
    {
        var (s, _, _) = Setup();
        var led = Ledger(s);

        led.Apply("joseon", "wei", FavorSource.BattleFought);   // -120

        Assert.Equal(led.Favor("joseon", "wei"), led.Favor("wei", "joseon"));   // 대칭 (E2)
        Assert.Equal(-120, led.Favor("wei", "joseon"));
        Assert.Single(s.Relations);                                             // 이중 장부 아님 — 레코드 1개
        Assert.Equal("joseon+wei", s.Relations[0].PairKey);                     // ordinal 정규화
    }

    [Fact]
    public void 관계도는_favor_범위로_clamp된다()
    {
        var (s, _, _) = Setup();
        var led = Ledger(s);
        var min = Db().Rules.Diplomacy.FavorMin;

        for (var i = 0; i < 20; i++) led.Apply("joseon", "wei", FavorSource.Betrayal);   // -600 × 20

        Assert.Equal(min, led.Favor("joseon", "wei"));
    }

    [Fact]
    public void 태도는_임계값을_포함한다()   // E4 경계 소유 — -600 은 Nemesis, +600 은 Devoted
    {
        var db = Db();
        var r = db.Rules.Diplomacy;
        Assert.Equal(Attitude.Nemesis, r.AttitudeOf(r.Thresholds.Nemesis));
        Assert.Equal(Attitude.Hostile, r.AttitudeOf(r.Thresholds.Nemesis + 1));
        Assert.Equal(Attitude.Hostile, r.AttitudeOf(r.Thresholds.Hostile));
        Assert.Equal(Attitude.Neutral, r.AttitudeOf(0));
        Assert.Equal(Attitude.Friendly, r.AttitudeOf(r.Thresholds.Friendly));
        Assert.Equal(Attitude.Devoted, r.AttitudeOf(r.Thresholds.Devoted));
    }

    /// <summary>E5: 조공은 금액 비례라 고정 델타 표에 없다 — 실수로 Apply 하면 즉시 터진다.</summary>
    [Fact]
    public void 조공_소스를_고정델타로_쓰면_거부()
    {
        var r = Db().Rules.Diplomacy;
        Assert.Throws<ArgumentOutOfRangeException>(() => r.DeltaOf(FavorSource.TributeReceived));
    }

    /// <summary>
    /// §5.2·§5.5 [MUST]: Decay 는 **음수 구간에만**. 우호까지 감쇠시키면 CommonEnemy 축적을
    /// 상시 상쇄해 AI 동맹이 산술적으로 도달 불가해진다.
    /// </summary>
    [Fact]
    public void 감쇠는_적대_구간에만_적용된다()
    {
        var (s, _, _) = Setup();
        var led = Ledger(s);
        var decay = Db().Rules.Diplomacy.DecayPerTurn;

        led.Apply("joseon", "wei", FavorSource.BattleFought);    // -120 (적대)
        led.Apply("joseon", "france", FavorSource.AllianceFormed); // +200 (우호)

        led.ProcessTurn();

        Assert.Equal(-120 + decay, led.Favor("joseon", "wei"));   // 0 방향으로 회복
        Assert.Equal(200, led.Favor("joseon", "france"));         // 우호는 그대로
    }

    [Fact]
    public void 감쇠는_0을_넘어_양수로_가지_않는다()
    {
        var (s, _, _) = Setup();
        var led = Ledger(s);
        s.Relations.Add(new RelationState { FactionA = "joseon", FactionB = "wei", Favor = -2 });

        led.ProcessTurn();   // decay 5 > |−2|

        Assert.Equal(0, led.Favor("joseon", "wei"));
    }

    /// <summary>§5.5 AI 동맹의 주 엔진 — 같은 세력과 교전 중인 쌍은 서로 가까워진다.</summary>
    [Fact]
    public void 공동의_적이_있으면_우호가_쌓인다()
    {
        var (s, _, dip) = Setup();
        var led = Ledger(s);
        var bonus = Db().Rules.Diplomacy.CommonEnemyPerTurn;

        dip.DeclareWar("joseon", "france");
        dip.DeclareWar("wei", "france");     // joseon·wei 의 공동의 적 = france

        led.ProcessTurn();

        Assert.Equal(bonus, led.Favor("joseon", "wei"));
    }

    [Fact]
    public void 조공_우호도는_천장에서_멈춘다()   // §5.3 — 돈으로 맹우를 살 수 없다
    {
        var (s, _, _) = Setup();
        var led = Ledger(s);
        var t = Db().Rules.Diplomacy.Tribute;

        var gained = led.ApplyTribute("joseon", "wei", t.GoldPerFavor * 100000, 0);

        Assert.Equal(t.FavorCeiling, led.Favor("joseon", "wei"));
        Assert.Equal(t.FavorCeiling, gained);
        Assert.Equal(0, led.ApplyTribute("joseon", "wei", t.GoldPerFavor * 10, 0));   // 천장 도달 후 0
    }

    [Fact]
    public void 관계도_세이브_왕복_보존()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var led = new RelationLedger(s, db);
        led.Apply("joseon", "wei", FavorSource.BattleFought);
        s.Relations[0].TruceUntilTurn = 7;

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", $"{Guid.NewGuid()}.json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path, db).State;

            var r = Assert.Single(loaded.Relations);
            Assert.Equal("joseon+wei", r.PairKey);
            Assert.Equal(-120, r.Favor);
            Assert.Equal(7, r.TruceUntilTurn);
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    /// <summary>D9 fail-soft: 죽은 세력을 가리키는 쌍은 프루닝 + 고지 (무음 금지).</summary>
    [Fact]
    public void 죽은_세력_관계쌍은_프루닝되고_고지된다()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var led = new RelationLedger(s, db);
        led.Apply("joseon", "wei", FavorSource.BattleFought);
        s.Relations.Add(new RelationState { FactionA = "joseon", FactionB = "ghost_faction", Favor = -50 });

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", $"{Guid.NewGuid()}.json");
        try
        {
            new SaveSystem().Save(s, path);
            var result = new SaveSystem().Load(path, db);

            Assert.Single(result.State.Relations);                            // 유령 쌍 제거
            Assert.Equal("joseon+wei", result.State.Relations[0].PairKey);
            Assert.Contains(result.Skipped, x => x.Contains("relation_pair:") && x.Contains("ghost_faction"));
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    /// <summary>구세이브(관계도 필드 부재)는 마이그레이션 없이 빈 리스트로 로드 (SPEC:525 additive).</summary>
    [Fact]
    public void 구세이브는_관계도_없이도_로드된다()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var path = Path.Combine(Path.GetTempPath(), "wc_saves", $"{Guid.NewGuid()}.json");
        try
        {
            new SaveSystem().Save(s, path);
            var json = File.ReadAllText(path);
            json = json.Replace("\"relations\"", "\"relations_removed_for_test\"");   // 필드 자체를 없앤 구세이브 모사
            File.WriteAllText(path, json);

            var loaded = new SaveSystem().Load(path, db).State;

            Assert.Empty(loaded.Relations);
            Assert.Equal(0, new RelationLedger(loaded, db).Favor("joseon", "wei"));   // 초기값
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }

    [Fact]
    public void 동맹은_양측_관계가_동기화()
    {
        var (s, _, dip) = Setup();
        Assert.Equal(DiplomacyOutcome.Success, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomaticState.Alliance, s.Factions.Single(f => f.Id == "joseon").Relations["wei"]);
        Assert.Equal(DiplomaticState.Alliance, s.Factions.Single(f => f.Id == "wei").Relations["joseon"]);
        Assert.True(dip.AreAllied("joseon", "wei"));
        Assert.Contains("alliance:joseon+wei", s.Progress);   // 최초 동맹 — 컷씬 트리거원
    }

    [Fact]
    public void 전쟁중_동맹불가_종전후_가능()
    {
        var (_, _, dip) = Setup();
        dip.DeclareWar("joseon", "wei");
        Assert.Equal(DiplomacyOutcome.AtWar, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.Success, dip.MakePeace("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.Success, dip.FormAlliance("joseon", "wei"));
        Assert.Equal(DiplomacyOutcome.NotAtWar, dip.MakePeace("joseon", "wei"));   // 전쟁 아님
    }

    [Fact]
    public void 자원지원_동맹전용_상한_잔고()
    {
        var (s, gm, dip) = Setup();
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var wei = s.Factions.Single(f => f.Id == "wei");
        joseon.Treasury = 1000; joseon.Food = 1000;
        var cap = Db().Rules.AllianceTransferCapPerTurn;   // 데이터 상한

        Assert.Equal(DiplomacyOutcome.NotAllied, dip.TransferResources("joseon", "wei", 100, 0));
        dip.FormAlliance("joseon", "wei");

        var g0 = wei.Treasury;
        Assert.Equal(DiplomacyOutcome.Success, dip.TransferResources("joseon", "wei", 100, 50));
        Assert.Equal(900, joseon.Treasury);
        Assert.Equal(g0 + 100, wei.Treasury);

        // 턴당 상한 초과
        Assert.Equal(DiplomacyOutcome.TransferCapExceeded,
            dip.TransferResources("joseon", "wei", cap.Gold, 0));
        // 수입 페이즈(새 턴)에서 리셋 → 다시 가능
        gm.CollectIncome();
        Assert.Equal(DiplomacyOutcome.Success, dip.TransferResources("joseon", "wei", 100, 0));

        // 잔고 부족·무효 금액
        joseon.Treasury = 10;
        Assert.Equal(DiplomacyOutcome.InsufficientResources, dip.TransferResources("joseon", "wei", 50, 0));
        Assert.Equal(DiplomacyOutcome.InvalidAmount, dip.TransferResources("joseon", "wei", 0, 0));
        Assert.Equal(DiplomacyOutcome.InvalidAmount, dip.TransferResources("joseon", "wei", -5, 0));
    }

    [Fact]
    public void 동맹군은_공동_수비에_참여한다()   // §1.2 공동 전투
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 42, "joseon", "wei");
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        // france(AI)가 pyongyang 소유, joseon 이 france 와 동맹 → joseon 주둔군이 공동 수비
        s.Factions.Single(f => f.Id == "france").OwnedProvinceIds.Add("pyongyang");
        dip.FormAlliance("joseon", "france");

        var allyGarrison = new Army("joseon_army_1", "joseon", "pyongyang");
        allyGarrison.AddUnits("spearman", 3000);   // 동맹 수비 대군
        s.Armies.Add(allyGarrison);

        var atk = new Army("wei_army_1", "wei", "beijing");
        atk.AddUnits("cavalry", 300);
        s.Armies.Add(atk);

        var outcome = gm.Attack("wei", "wei_army_1", "pyongyang", out var battle);

        Assert.Equal(AttackOutcome.DefenderHeld, outcome);   // 동맹군 없었으면 무저항 함락이었을 상황
        Assert.True(battle!.DefenderLosses < 3000);
        Assert.Contains("pyongyang", s.Factions.Single(f => f.Id == "france").OwnedProvinceIds);
    }

    [Fact]
    public void 공동_승리_판정()   // §1.2 [MUST]
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        dip.FormAlliance("joseon", "wei");

        // 전 육상 영지를 두 인간 세력이 분점
        var allLand = db.Map.LandProvinces.Select(p => p.Id).ToList();
        foreach (var f in s.Factions) f.OwnedProvinceIds.Clear();
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var wei = s.Factions.Single(f => f.Id == "wei");
        joseon.OwnedProvinceIds.AddRange(allLand.Take(5));
        wei.OwnedProvinceIds.AddRange(allLand.Skip(5));

        var winners = gm.CheckVictory();
        Assert.Equal(2, winners.Count);
        Assert.Contains("joseon", winners);
        Assert.Contains("wei", winners);

        // 동맹 파기(배신) 시 공동 승리 불성립
        dip.DeclareWar("joseon", "wei");
        Assert.Empty(gm.CheckVictory());
    }

    [Fact]
    public void 이전_누계는_세이브_왕복_보존()
    {
        var (s, _, dip) = Setup();
        dip.FormAlliance("joseon", "wei");
        s.Factions.Single(f => f.Id == "joseon").Treasury = 1000;
        dip.TransferResources("joseon", "wei", 80, 0);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            Assert.Equal(80, loaded.Factions.Single(f => f.Id == "joseon").TransferredGoldThisTurn);
        }
        finally { File.Delete(path); }
    }
}
