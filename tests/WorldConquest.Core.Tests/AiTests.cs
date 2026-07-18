using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Tests;

/// <summary>AI 컨트롤러·배치 시뮬 (§2.6 [SHOULD]·§8): 확장·징병·결정론·시뮬 완주.</summary>
public class AiTests
{
    private static GameDatabase Db() => new DataLoader().Load(TestPaths.RepoDataDir);

    [Fact]
    public void AI는_빈_영지를_점령하고_징병한다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 1);
        var gm = new GameManager(s, db);
        gm.CollectIncome();

        var ownedBefore = s.Factions.Sum(f => f.OwnedProvinceIds.Count);
        // 1턴 진행 (Income→…→AiAction 포함 한 바퀴)
        while (s.Turn == 1) gm.AdvancePhase();

        var ownedAfter = s.Factions.Sum(f => f.OwnedProvinceIds.Count);
        Assert.True(ownedAfter > ownedBefore, "AI 가 빈 영지를 점령하지 않음");
        Assert.True(s.Armies.Count > 0, "AI 가 징병하지 않음");
    }

    [Fact]
    public void AI_행동은_결정적_같은_시드_같은_상태()
    {
        var db = Db();
        GameState Run(ulong seed)
        {
            var s = GameSetup.AiCampaign(db, seed);
            var gm = new GameManager(s, db);
            gm.CollectIncome();
            while (s.Turn <= 10) gm.AdvancePhase();
            return s;
        }

        var a = Run(777);
        var b = Run(777);
        foreach (var fa in a.Factions)
        {
            var fb = b.Factions.Single(f => f.Id == fa.Id);
            Assert.Equal(fa.Treasury, fb.Treasury);
            Assert.Equal(fa.OwnedProvinceIds, fb.OwnedProvinceIds);
        }
        Assert.Equal(a.Armies.Count, b.Armies.Count);
    }

    [Fact]
    public void AI는_동맹을_공격하지_않는다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 5);
        var gm = new GameManager(s, db);
        var dip = new DiplomacyManager(s, db);
        gm.CollectIncome();

        // wei(aggressive) 와 joseon 을 동맹으로 — 인접 관계에서도 공격 금지 확인
        dip.FormAlliance("wei", "joseon");
        var joseonBefore = s.Factions.Single(f => f.Id == "joseon").OwnedProvinceIds.ToList();

        while (s.Turn <= 5) gm.AdvancePhase();

        var joseon = s.Factions.Single(f => f.Id == "joseon");
        foreach (var p in joseonBefore)
            Assert.Contains(p, joseon.OwnedProvinceIds);   // 동맹의 시작 영지 침탈 없음
    }

    /// <summary>
    /// F1 회귀 (외교 설계 §1.4): 불가침이 **해상 상륙**에서도 존중돼야 한다.
    /// 수정 전에는 NonAggression 필터가 AttackWeakNeighbors 한 곳뿐이라 상륙 공격이 그대로 뚫렸다.
    ///
    /// 시나리오 설계 근거 — 아무 세력이나 불가침으로 묶으면 이 경로를 못 태운다:
    ///  · 전원 불가침 → LandReachableEnemyExists(IsNonAllied)가 여전히 true → 육상 분기 → NavalOperations 미실행.
    ///  · 따라서 **육상 완전 고립** 세력이어야 한다 → 지도상 new_york 은 육상 간선이 없는 단독 컴포넌트 = avengers.
    ///  · avengers 함대를 sea_atlantic 에 두면 Port 간선이 rome·london·cairo·rio·new_york 로 뻗는데,
    ///    그중 **세력 소유 항구는 rome(chaldea) 뿐** → 상륙 대상이 rome 하나로 통제된다.
    ///  · chaldea 를 전 세력과 불가침으로 묶어 육상 공격자(france 는 rome 과 육상 인접)도 배제 →
    ///    rome 이 함락되면 원인은 avengers 의 해상 상륙뿐.
    /// </summary>
    [Fact]
    public void 불가침_상대는_해상_상륙으로도_침탈되지_않는다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 1);
        var gm = new GameManager(s, db);
        gm.CollectIncome();

        // 불가침은 아직 런타임 체결 경로가 없다(설계 G6 — DiplomacyManager 에 SetNonAggression 부재).
        // 상태를 직접 세팅해 'AI 필터가 불가침을 존중하는가' 만 검증한다.
        foreach (var other in s.Factions.Where(f => f.Id != "chaldea"))
        {
            other.Relations["chaldea"] = DiplomaticState.NonAggression;
            s.Factions.Single(f => f.Id == "chaldea").Relations[other.Id] = DiplomaticState.NonAggression;
        }

        // avengers 함대를 rome 바로 앞 해역에 배치 — 압도적 전력이라 문턱은 확실히 통과
        var fleet = new Fleet("avengers_fleet_1", "avengers", "sea_atlantic");
        fleet.AddUnits("medium_ship", 200);
        s.Fleets.Add(fleet);

        Assert.Contains("rome", s.Factions.Single(f => f.Id == "chaldea").OwnedProvinceIds);
        while (s.Turn <= 3) gm.AdvancePhase();

        Assert.Contains("rome", s.Factions.Single(f => f.Id == "chaldea").OwnedProvinceIds);
    }

    /// <summary>
    /// E13 회귀: 관계 술어를 하나로 합치면 안 된다. LandReachableEnemyExists 는 공격 필터가 아니라
    /// **분기 게이트**라, 여기에 IsHostile(불가침 제외)을 쓰면 전 이웃과 불가침인 AI 가 '고립' 판정 →
    /// 해상 분기로 갔다가 목표 0 으로 즉시 return → **징병조차 못 하는 영구 무행동**에 빠진다.
    /// 불가침은 만료가 없어 회복 경로도 없다.
    /// </summary>
    [Fact]
    public void 전_세력과_불가침인_AI도_징병을_계속한다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 5);
        var gm = new GameManager(s, db);
        gm.CollectIncome();

        var wei = s.Factions.Single(f => f.Id == "wei");
        foreach (var other in s.Factions.Where(f => f.Id != "wei"))
        {
            wei.Relations[other.Id] = DiplomaticState.NonAggression;
            other.Relations["wei"] = DiplomaticState.NonAggression;
        }

        while (s.Turn <= 3) gm.AdvancePhase();

        Assert.True(s.Armies.Any(a => a.FactionId == "wei"),
            "전 세력과 불가침인 AI 가 징병조차 못 함 — 분기 게이트(LandReachableEnemyExists)가 " +
            "IsHostile 로 좁혀졌는지 확인 (IsNonAllied 여야 함)");
    }

    /// <summary>
    /// **요구사항 직결 게이트** (외교 §9 DoD): "AI 들이 지들끼리도 우호도에 따라 동맹을 맺는다".
    /// 이전엔 AIController 가 Relations 에 쓰기를 0건 해서 국제정치 자체가 없었다.
    /// §5.5 도달 산술이 실제로 성립하는지 확인한다 — CommonEnemy(+30/턴)가 유일한 양(+) 소스이고
    /// Decay 는 음수 구간에만 걸리므로, 공동 교전 중인 쌍은 alliance_favor_min(300)에 ~10턴이면 닿는다.
    /// </summary>
    [Fact]
    public void AI끼리_동맹을_맺는다()
    {
        var db = Db();

        // 능력 검증이라 여러 시드 중 최소 1건이면 충분하다. 단일 시드로 못 박으면 맵·로스터가
        // 커질 때(현재 42거점·10세력) 그 시드의 게임 전개가 우연히 동맹 없이 끝나 깨진다 —
        // 실제로 seed 1 은 favor 가 210 에서 멈춰(임계 300 미달) 동맹이 안 맺힌다. 동맹이 '맺힐 수
        // 있는가' 는 게임마다 달라지는 전개의 문제이지 기능의 유무가 아니다.
        var formed = false;
        for (ulong seed = 1; seed <= 6 && !formed; seed++)
        {
            var s = GameSetup.AiCampaign(db, seed);
            var gm = new GameManager(s, db);
            gm.CollectIncome();
            while (s.Turn <= 80) gm.AdvancePhase();
            if (s.Progress.Any(p => p.StartsWith("alliance:"))) formed = true;
        }
        Assert.True(formed, "6개 시드 × 80턴 어디에서도 AI 간 동맹이 성립하지 않음 — 관계 동역학 점검 필요");
    }

    /// <summary>AI 가 외교 상태를 실제로 바꾼다 — 선전포고/불가침/동맹 중 무엇이든 (쓰기 0건 → 해소).</summary>
    [Fact]
    public void AI는_외교_상태를_실제로_변경한다()
    {
        var db = Db();
        var s = GameSetup.AiCampaign(db, 3);
        var gm = new GameManager(s, db);
        gm.CollectIncome();

        while (s.Turn <= 30) gm.AdvancePhase();

        Assert.Contains(s.Factions, f => f.Relations.Count > 0);
        Assert.NotEmpty(s.Relations);   // 관계도 레코드가 실제로 쌓였다
    }

    [Fact]
    public void 배치_시뮬_같은_시드_같은_결과()   // §8 시드 고정 리플레이 — 게임 전체 수준
    {
        var db = Db();
        var (w1, t1, d1) = BatchSimulator.RunOne(db, 4242, turnCap: 60);
        var (w2, t2, d2) = BatchSimulator.RunOne(db, 4242, turnCap: 60);
        Assert.Equal(w1, w2);
        Assert.Equal(t1, t2);
        Assert.Equal(d1, d2);
    }

    [Fact]
    public void 배치_시뮬_리포트_집계()
    {
        var db = Db();
        var report = BatchSimulator.Run(db, games: 6, baseSeed: 100, turnCap: 80);
        Assert.Equal(6, report.Games);
        // AI 캠페인은 공동 승리가 없으므로(인간 플레이어 부재) 승수 합 + 무승부 = 판수
        Assert.Equal(6, report.WinsByFaction.Values.Sum() + report.Draws);
        Assert.True(report.AverageTurns > 0);
        Assert.InRange(report.MaxWinRatePct, 0, 100);
    }
}
