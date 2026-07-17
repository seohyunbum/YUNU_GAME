using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>Phase 1 게임플레이 — 캠페인 셋업·페이즈 전이·수입 정산·세이브 왕복(§2.2·§7).</summary>
public class GameplayTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void 새_캠페인_초기상태()
    {
        var s = GameSetup.NewCampaign(Db(), 42, "joseon", "wei");
        Assert.Equal(1, s.Turn);
        Assert.Equal(TurnPhase.Income, s.Phase);
        Assert.Equal("joseon", s.Actor);
        Assert.Equal("human_p1", s.Factions.Single(f => f.Id == "joseon").Controller);
        Assert.Equal("human_p2", s.Factions.Single(f => f.Id == "wei").Controller);
        Assert.All(s.Factions.Where(f => f.Id is not ("joseon" or "wei")),
                   f => Assert.Equal("ai", f.Controller));
    }

    [Fact]
    public void 같은_세력_두명은_예외()
    {
        Assert.Throws<ArgumentException>(() => GameSetup.NewCampaign(Db(), 1, "joseon", "joseon"));
    }

    [Fact]
    public void 페이즈_전이_7단계_순환하며_턴_증가()
    {
        var s = GameSetup.NewCampaign(Db(), 1, "joseon", "wei");
        TurnPhase[] expected =
        {
            TurnPhase.Player1Command, TurnPhase.Player2Command, TurnPhase.AiAction,
            TurnPhase.Resolution, TurnPhase.Events, TurnPhase.VictoryCheck, TurnPhase.Income
        };
        foreach (var e in expected) { TurnSystem.Advance(s); Assert.Equal(e, s.Phase); }
        Assert.Equal(2, s.Turn);   // VictoryCheck → Income 회귀 시 턴 증가
    }

    [Fact]
    public void 플레이어_페이즈_actor는_해당_컨트롤러_세력()
    {
        var s = GameSetup.NewCampaign(Db(), 1, "joseon", "wei");
        TurnSystem.Advance(s); Assert.Equal("joseon", s.Actor);   // Player1Command
        TurnSystem.Advance(s); Assert.Equal("wei", s.Actor);      // Player2Command
        TurnSystem.Advance(s); Assert.Equal("", s.Actor);         // AiAction (시스템)
    }

    [Fact]
    public void 수입_페이즈_소유영지_생산량_정산()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var gold0 = joseon.Treasury; var food0 = joseon.Food;

        gm.CollectIncome();

        // §2.3.2 수치제 경제: 기본생산 floor + 상업/농업 개발분(시작 = max×40%, ×250permil).
        // 한성 금 120+(1008×40%=403→100) =220 · 식 90+(360×40%=144→36) =126
        // 부산 금 100+(840×40%=336→84)  =184 · 식 70+(280×40%=112→28) =98
        Assert.Equal(gold0 + 220 + 184, joseon.Treasury);   // +404
        Assert.Equal(food0 + 126 + 98, joseon.Food);        // +224
    }

    [Fact]
    public void 무혈_점령_빈영지_인접_성공()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        // 평양(pyongyang)은 빈 영지이고 한성(joseon 소유)에 인접 → 점령 가능.
        Assert.Equal(CaptureOutcome.Success, gm.TryCapture("joseon", "pyongyang"));
        Assert.Contains("pyongyang", joseon.OwnedProvinceIds);
        Assert.Contains("captured:pyongyang", s.Progress);
    }

    [Fact]
    public void 무혈_점령_실패_케이스()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        Assert.Equal(CaptureOutcome.AlreadyOwned, gm.TryCapture("joseon", "hanseong"));   // 이미 소유
        Assert.Equal(CaptureOutcome.AlreadyOwned, gm.TryCapture("joseon", "beijing"));    // wei 소유
        Assert.Equal(CaptureOutcome.NotAdjacent, gm.TryCapture("joseon", "baghdad"));     // 비인접 빈 영지
        Assert.Equal(CaptureOutcome.NoSuchFaction, gm.TryCapture("nobody", "pyongyang"));
    }

    [Fact]
    public void 징병_금_소비하고_부대_편성()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();   // joseon 금 1220
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        var gold0 = joseon.Treasury;

        // spearman(비용 50) 10명 → 500 금
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "hanseong", "spearman", 10));
        Assert.Equal(gold0 - 500, joseon.Treasury);
        var army = s.Armies.Single(a => a.FactionId == "joseon" && a.LocationNodeId == "hanseong");
        Assert.Equal(10, army.Units["spearman"]);

        // 같은 영지 재징병은 같은 부대에 합쳐짐
        Assert.Equal(RecruitOutcome.Success, gm.Recruit("joseon", "hanseong", "archer", 5));
        Assert.Single(s.Armies.Where(a => a.FactionId == "joseon"));
        Assert.Equal(15, army.TotalTroops);
    }

    [Fact]
    public void 징병_실패_케이스()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        Assert.Equal(RecruitOutcome.TechLevelTooLow, gm.Recruit("joseon", "hanseong", "siege_ram", 100));  // 공성추 tech 2 > Lv1 (§2.3 해금)
        Assert.Equal(RecruitOutcome.InsufficientGold, gm.Recruit("joseon", "hanseong", "spearman", 100));  // 50×100=5000 > 1000
        Assert.Equal(RecruitOutcome.NotOwnedLandProvince, gm.Recruit("joseon", "beijing", "spearman", 1));   // wei 소유
        Assert.Equal(RecruitOutcome.UnknownUnit, gm.Recruit("joseon", "hanseong", "nope", 1));
        Assert.Equal(RecruitOutcome.InvalidCount, gm.Recruit("joseon", "hanseong", "spearman", 0));
    }

    [Fact]
    public void 부대_이동_경로있으면_성공_없으면_실패()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();
        gm.Recruit("joseon", "hanseong", "spearman", 5);
        var army = s.Armies.Single();

        // 한성→평양 (인접 육로) 성공
        Assert.Equal(MoveOutcome.Success, gm.MoveArmy(army.Id, "pyongyang"));
        Assert.Equal("pyongyang", army.LocationNodeId);
        // 같은 위치 이동
        Assert.Equal(MoveOutcome.SameLocation, gm.MoveArmy(army.Id, "pyongyang"));
        // 없는 부대
        Assert.Equal(MoveOutcome.NoSuchArmy, gm.MoveArmy("nope", "hanseong"));
    }

    [Fact]
    public void 시설_건설_수입_보너스_그리고_슬롯_최대레벨()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");

        // 항구 건설 (비용 350) — 한성 소유. 경제 시설(금 +18%/lv, §2.3.2 개발과 별개의 % 보정)
        Assert.Equal(FacilityOutcome.Success, gm.BuildFacility("joseon", "hanseong", "port"));
        Assert.Equal(1, s.Provinces.Single(p => p.Id == "hanseong").Facilities["port"]);

        // 항구 1레벨(+18% 금) → 한성 총생산(기본120+상업100=220) × 118% = 259. 부산 184(시설 없음). 합 443.
        joseon.Treasury = 0;
        gm.CollectIncome();
        Assert.Equal(259 + 184, joseon.Treasury);

        // 최대 레벨(3)까지 증축 (증축 비용 확보)
        joseon.Treasury = 10000;
        gm.BuildFacility("joseon", "hanseong", "port");   // lv2
        gm.BuildFacility("joseon", "hanseong", "port");   // lv3 = max
        Assert.Equal(FacilityOutcome.MaxLevelReached, gm.BuildFacility("joseon", "hanseong", "port"));
    }

    [Fact]
    public void 시설_실패_케이스()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        Assert.Equal(FacilityOutcome.NotOwnedLandProvince, gm.BuildFacility("joseon", "beijing", "port"));
        Assert.Equal(FacilityOutcome.UnknownFacility, gm.BuildFacility("joseon", "hanseong", "casino"));
        s.Factions.Single(f => f.Id == "joseon").Treasury = 10;
        Assert.Equal(FacilityOutcome.InsufficientGold, gm.BuildFacility("joseon", "hanseong", "port"));
    }

    [Fact]
    public void 부대_상태_세이브_왕복()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();
        gm.Recruit("joseon", "hanseong", "spearman", 12);
        gm.Recruit("joseon", "hanseong", "cavalry", 3);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new SaveSystem().Save(s, path);
            var loaded = new SaveSystem().Load(path);
            var army = loaded.Armies.Single();
            Assert.Equal("hanseong", army.LocationNodeId);
            Assert.Equal("joseon", army.FactionId);
            Assert.Equal(12, army.Units["spearman"]);
            Assert.Equal(3, army.Units["cavalry"]);
        }
        finally { File.Delete(path); }
    }

    // ── 적대 QA 회귀 (2026-07-16) ──

    [Fact]
    public void 미존재_영지_명령은_크래시없이_거부()   // QA critical: GetNode 인덱서 KeyNotFound
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        Assert.Equal(CaptureOutcome.NotLandProvince, gm.TryCapture("joseon", "zzz"));
        Assert.Equal(RecruitOutcome.NotOwnedLandProvince, gm.Recruit("joseon", "zzz", "spearman", 1));
        Assert.Equal(FacilityOutcome.NotOwnedLandProvince, gm.BuildFacility("joseon", "zzz", "market"));
    }

    [Fact]
    public void 징병_거대_count_정수오버플로_우회_방지()   // QA high: cost = RecruitCostGold*count wrap
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        var joseon = s.Factions.Single(f => f.Id == "joseon");
        joseon.Treasury = 1000;
        joseon.TechLevel = 3;   // 기술 게이트 통과시켜 오버플로 경로만 검증
        // 인구 검사(§2.3)가 거대 count 를 먼저 차단 — pop_need 도 long 승격이라 wrap 없음
        Assert.Equal(RecruitOutcome.InsufficientPopulation, gm.Recruit("joseon", "hanseong", "spearman", 43_000_000));
        // pop_cost 0 병종(그림자 병사)으로 금 검사 경로: 300 × 43,000,000 = 1.29e10 > int.MaxValue — long 승격으로 InsufficientGold
        Assert.Equal(RecruitOutcome.InsufficientGold, gm.Recruit("joseon", "hanseong", "shadow_soldiers", 43_000_000));
        Assert.Equal(1000, joseon.Treasury);
        Assert.Empty(s.Armies);
    }

    [Fact]
    public void 부대_이동_해상노드_및_미존재_목적지_거부()   // QA high: MoveArmy Port/해역 우회
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();
        gm.Recruit("joseon", "hanseong", "spearman", 5);
        var army = s.Armies.Single();
        Assert.Equal(MoveOutcome.NoPath, gm.MoveArmy(army.Id, "sea_east_asia"));   // 해역 노드
        Assert.Equal(MoveOutcome.NoPath, gm.MoveArmy(army.Id, "zzz"));             // 미존재 목적지
        Assert.Equal("hanseong", army.LocationNodeId);
    }

    [Fact]
    public void 오십턴_자동진행_스모크_예외_및_자원음수_없음()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 1, "joseon", "wei");
        var gm = new GameManager(s, db);
        gm.CollectIncome();   // 첫 턴 수입
        while (s.Turn <= 50)
        {
            gm.AdvancePhase();
            foreach (var f in s.Factions)
            {
                Assert.True(f.Treasury >= 0, $"{f.Id} 금고 음수: {f.Treasury}");
                Assert.True(f.Food >= 0, $"{f.Id} 식량 음수: {f.Food}");
            }
        }
        Assert.True(s.Turn > 50);
    }

    [Fact]
    public void 세이브_왕복_실제_게임상태()
    {
        var db = Db();
        var s = GameSetup.NewCampaign(db, 12345, "joseon", "wei");
        new GameManager(s, db).CollectIncome();
        for (var i = 0; i < 10; i++) TurnSystem.Advance(s);

        var path = Path.Combine(Path.GetTempPath(), "wc_saves", Guid.NewGuid().ToString("N") + ".json");
        try
        {
            var sys = new SaveSystem();
            sys.Save(s, path);
            var loaded = sys.Load(path);
            Assert.Equal(s.Turn, loaded.Turn);
            Assert.Equal(s.Phase, loaded.Phase);
            var oj = s.Factions.Single(f => f.Id == "joseon");
            var lj = loaded.Factions.Single(f => f.Id == "joseon");
            Assert.Equal(oj.Treasury, lj.Treasury);
            Assert.Equal(oj.OwnedProvinceIds, lj.OwnedProvinceIds);
        }
        finally { File.Delete(path); }
    }
}
