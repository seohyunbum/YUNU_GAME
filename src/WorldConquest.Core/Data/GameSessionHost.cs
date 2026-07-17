using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// 그래픽 클라이언트용 세션 호스트 (ue5-client-design §2) — HTTP 와 분리된 순수 계층이라 그대로 테스트한다.
/// 책임: 캠페인 수명(new/load/save) · 이벤트 저널(seq) · 명령 디스패치 · 멱등성 캐시.
/// 페이즈 오케스트레이션은 <see cref="SessionDriver"/> 공유 [MUST] — PlaySession 과 갈라지지 않는다.
/// 스레드 안전: 호출자가 직렬화한다 (ApiServer 는 요청을 lock 으로 직렬 처리 — 턴제라 충분).
/// </summary>
public sealed class GameSessionHost
{
    private readonly GameDatabase _db;
    private readonly SaveSystem _save = new();

    private GameManager? _gm;
    private string _campaignId = "";
    private IReadOnlyList<string>? _winners;

    // 이벤트 저널 — 캠페인 내 seq 단조 증가. 캠페인 교체 시 리셋 (Bus 도 새로 생성해 구독자 누적 차단).
    private readonly List<EventView> _journal = new();

    // 명령 멱등성 (ue5-client-design §2.3): 클라 seq 단조 증가 전제, 중복 seq → 캐시 응답 재전송.
    private readonly Dictionary<long, CommandResult> _seqCache = new();
    private long _lastSeq = -1;
    private const int SeqCacheKeep = 100;

    public GameSessionHost(GameDatabase db) => _db = db;

    public bool HasCampaign => _gm is not null;

    // ---------- 캠페인 수명 ----------

    /// <summary>새 캠페인. player2 가 null 이면 1인 vs AI. 첫 입력 지점까지 전진한 스냅샷을 반환.</summary>
    public StateSnapshot NewCampaign(string player1, string? player2, ulong seed)
    {
        var state = GameSetup.NewCampaign(_db, seed, player1, player2);
        AttachCampaign(new GameManager(state, _db), $"c{seed:x}");
        _gm!.CollectIncome();   // 새 캠페인 첫 턴 수입 — Program·PlaySessionTests 와 동일 규약
        DriveToInput();
        return Snapshot();
    }

    /// <summary>세이브 로드 이어하기. fail-soft 스킵 항목은 SaveLoaded 이벤트 data 로 고지 (D9 무음 금지).</summary>
    public StateSnapshot LoadCampaign(string path)
    {
        var result = _save.Load(path, _db);
        AttachCampaign(new GameManager(result.State, _db), $"l{result.State.CampaignSeed:x}t{result.State.Turn}");
        _gm!.Bus.Publish(GameEvent.Of("SaveLoaded",
            ("path", path), ("skipped", string.Join(",", result.Skipped))));
        DriveToInput();   // 저장은 명령 페이즈에서만 가능하므로 보통 즉시 반환 — 방어적 호출
        return Snapshot();
    }

    public void SaveCampaign(string path) => _save.Save(RequireGame().State, path);

    private void AttachCampaign(GameManager gm, string campaignId)
    {
        _gm = gm;                       // Bus 는 GameManager 생성 시 새로 만들어짐 — 구독자 누적 없음
        _campaignId = campaignId;
        _winners = null;
        _journal.Clear();
        _seqCache.Clear();
        _lastSeq = -1;
        gm.Bus.Subscribe(evt => _journal.Add(
            new EventView(_journal.Count, evt.Type, evt.Data.ToDictionary(kv => kv.Key, kv => kv.Value))));
    }

    // ---------- 조회 ----------

    public StateSnapshot Snapshot()
    {
        var ia = RequireGame().Internal;
        var s = RequireGame().State;
        var owners = s.Factions
            .SelectMany(f => f.OwnedProvinceIds.Select(p => (p, f.Id)))
            .ToDictionary(x => x.p, x => x.Id);
        var facilities = s.Provinces.ToDictionary(p => p.Id, p => p.Facilities);

        return new StateSnapshot(
            ApiProtocol.Version,
            _campaignId,
            s.Turn,
            s.Phase.ToString(),
            _winners is null ? s.Actor : null,
            _winners,
            s.Factions.Select(f => new FactionView(
                f.Id, f.Controller, f.Treasury, f.Food, f.TechLevel, f.Mandate, f.PityCount,
                f.OwnedProvinceIds.ToList(),
                f.Relations.ToDictionary(kv => kv.Key, kv => kv.Value.ToString().ToLowerInvariant()),
                f.TaxLevel.Length > 0 ? f.TaxLevel : _db.Rules.InternalAffairs.DefaultTaxLevel,
                f.TechPoints)).ToList(),
            _db.Map.LandProvinces.Select(p => new ProvinceOwnershipView(
                p.Id,
                owners.TryGetValue(p.Id, out var o) ? o : null,
                facilities.TryGetValue(p.Id, out var fc) ? fc : new Dictionary<string, int>(),
                ia.GetPublicOrder(p.Id), ia.GetPopulation(p.Id), ia.GovernorOf(p.Id)?.Id,
                ia.GetCommerce(p.Id), ia.CommerceMax(p.Id), ia.GetAgriculture(p.Id), ia.AgricultureMax(p.Id))).ToList(),
            s.Armies.Select(ForceView).ToList(),
            s.Fleets.Select(ForceView).ToList(),
            new Dictionary<string, string>(s.CharacterOwners),
            _journal.Count);
    }

    private static ForceView ForceView(MilitaryForce f) => new(
        f.Id, f.FactionId, f.LocationNodeId, f.CommanderId, f.Morale,
        f.Units.ToDictionary(kv => kv.Key, kv => kv.Value), f.TotalTroops);

    /// <summary>이벤트 저널 재동기 — cursor 이후 전부 (유실 복구, ue5-client-design §2.3).</summary>
    public List<EventView> EventsSince(long cursor) =>
        _journal.Where(e => e.Seq >= cursor).ToList();

    /// <summary>초빙 확률 공시 (§2.8.6 [MUST] — 판정과 동일 함수) + 천장·비용·풀 정보 (도시 주막 UI 용).</summary>
    public Dictionary<string, object> SummonRates(string factionId)
    {
        var gm = RequireGame();
        var faction = gm.State.Factions.FirstOrDefault(f => f.Id == factionId)
            ?? throw new ArgumentException($"세력 없음: {factionId}");
        var sys = new SummonSystem(gm.State, _db, gm.Bus);
        var pool = sys.GetPool();
        return new Dictionary<string, object>
        {
            ["mandate"] = faction.Mandate,
            ["cost_single"] = _db.Rules.SummonCostSingle,
            ["pity_count"] = faction.PityCount,
            ["hard_pity"] = _db.Rules.SummonHardPity,
            ["pool_total"] = pool.Count,
            ["rates"] = sys.GetCurrentRates(factionId)
                .OrderByDescending(kv => kv.Key)
                .Select(kv => new Dictionary<string, object>
                {
                    ["rarity"] = kv.Key,
                    ["permyriad"] = kv.Value,   // 만분율 (§4.4 정수 스케일)
                    ["remaining"] = pool.Count(c => c.Rarity == kv.Key),
                }).ToList(),
        };
    }

    // ---------- 명령 ----------

    /// <summary>
    /// 명령 실행. seq 멱등: 이미 처리한 seq 는 캐시된 원 응답을 재전송해 HTTP 재시도의
    /// RNG 이중 소모(가챠 이중 뽑기 등)를 프로토콜 수준에서 차단한다.
    /// </summary>
    public CommandResult Execute(long seq, string factionId, string verb, string[] args)
    {
        var gm = RequireGame();

        if (_seqCache.TryGetValue(seq, out var cached)) return cached;      // 재시도 → 원 응답
        if (seq <= _lastSeq)
            return Error($"오래된 seq {seq} (마지막 {_lastSeq}) — 캐시 범위 밖");

        var result = ExecuteCore(gm, factionId, verb, args);

        _lastSeq = seq;
        _seqCache[seq] = result;
        if (_seqCache.Count > SeqCacheKeep)
            foreach (var old in _seqCache.Keys.Where(k => k <= seq - SeqCacheKeep).ToList())
                _seqCache.Remove(old);
        return result;
    }

    private CommandResult ExecuteCore(GameManager gm, string factionId, string verb, string[] args)
    {
        var s = gm.State;
        if (_winners is not null) return Error("게임이 이미 종료되었습니다.");
        if (s.Actor != factionId) return Error($"현재 입력 차례가 아닙니다 (대기: {s.Actor})");

        var journalStart = _journal.Count;
        string message;
        try
        {
            message = Dispatch(gm, factionId, verb, args, out var ok);
            if (!ok) return Error(message, journalStart);
        }
        catch (Exception ex)
        {
            return Error($"명령 처리 오류: {ex.Message}", journalStart);   // 세션은 죽지 않는다 (콘솔과 동일 규약)
        }
        return new CommandResult("ok", message, EventsSince(journalStart), Snapshot());
    }

    /// <summary>verb → GameManager 디스패치. PlaySession 의 명령 세트와 1:1 (표시용 텍스트만 다름).</summary>
    private string Dispatch(GameManager gm, string factionId, string verb, string[] args, out bool ok)
    {
        ok = true;
        var s = gm.State;
        switch (verb)
        {
            case "capture":
            {
                Require(args, 1, "capture <영지id>");
                var o = gm.TryCapture(factionId, args[0]);
                if (o != CaptureOutcome.Success) { ok = false; return $"점령 실패: {o}"; }
                return $"{args[0]} 점령";
            }
            case "recruit":
            {
                Require(args, 3, "recruit <영지id> <병종id> <수> [군수무장id]");
                if (!int.TryParse(args[2], out var count)) { ok = false; return "수는 정수여야 합니다."; }
                var muster = args.Length > 3 ? args[3] : null;   // 군수 파견 시 통솔 할인 (§2.3.2)
                var o = gm.Recruit(factionId, args[0], args[1], count, muster);
                if (o != RecruitOutcome.Success) { ok = false; return $"징병 실패: {o}"; }
                return $"{args[0]}에서 {args[1]} {count} 징병";
            }
            case "develop":
            {
                Require(args, 3, "develop <영지id> <commerce|agriculture> <무장id>");
                var res = gm.Internal.Develop(factionId, args[0], args[1], args[2]);
                if (res.Outcome != DevelopOutcome.Success) { ok = false; return $"개발 실패: {res.Outcome}"; }
                return $"{args[0]} {args[1]} +{res.Gain} (→ {res.NewValue}/{res.Max})";
            }
            case "search":
            {
                Require(args, 1, "search <사신무장id>");
                var rs = new RecruitmentSystem(s, _db, gm.Bus);
                var res = rs.Search(factionId, args[0]);
                if (res.Outcome == SearchOutcome.Success) return $"{args[0]} 탐색 성공 — 금 +{res.GoldReward} (성공률 {res.ChancePermyriad / 100}%)";
                if (res.Outcome == SearchOutcome.Failed) return $"{args[0]} 탐색 — 소득 없음 (성공률 {res.ChancePermyriad / 100}%)";
                ok = false; return $"탐색 불가: {res.Outcome}";
            }
            case "move":
            {
                Require(args, 2, "move <부대id> <목적지id>");
                var o = gm.MoveArmy(args[0], args[1]);
                if (o != MoveOutcome.Success) { ok = false; return $"이동 실패: {o}"; }
                return $"{args[0]} → {args[1]} 이동";
            }
            case "assign":
            {
                Require(args, 2, "assign <부대id> <캐릭터id>");
                var o = gm.AssignCommander(factionId, args[0], args[1]);
                if (o != AssignOutcome.Success) { ok = false; return $"임명 실패: {o}"; }
                return $"{args[0]} 지휘관 = {args[1]}";
            }
            case "attack":
            {
                Require(args, 2, "attack <부대id> <목표id>");
                var o = gm.Attack(factionId, args[0], args[1], out var battle);
                if (o is not (AttackOutcome.AttackerWon or AttackOutcome.DefenderHeld))
                { ok = false; return $"공격 불가: {o}"; }
                return o == AttackOutcome.AttackerWon
                    ? $"{args[1]} 점령! ({battle!.Rounds}라운드 · 아군 손실 {battle.AttackerLosses} · 적 손실 {battle.DefenderLosses})"
                    : $"공격 실패 — 수비 견고 ({battle!.Rounds}라운드)";
            }
            case "build":
            {
                Require(args, 2, "build <영지id> <시설>");
                var o = gm.BuildFacility(factionId, args[0], args[1]);
                if (o != FacilityOutcome.Success) { ok = false; return $"건설 실패: {o}"; }
                return $"{args[0]}에 {args[1]} 건설/증축";
            }
            case "governor":
            {
                Require(args, 2, "governor <영지id> <캐릭터id>");
                var o = gm.Internal.AppointGovernor(factionId, args[0], args[1]);
                if (o != GovernorOutcome.Success) { ok = false; return $"태수 임명 실패: {o}"; }
                return $"{args[0]} 태수 = {args[1]}";
            }
            case "dismiss":
            {
                Require(args, 1, "dismiss <영지id>");
                var o = gm.Internal.DismissGovernor(factionId, args[0]);
                if (o != GovernorOutcome.Success) { ok = false; return $"해임 실패: {o}"; }
                return $"{args[0]} 태수 해임";
            }
            case "tax":
            {
                Require(args, 1, "tax <단계>");
                var o = gm.Internal.SetTaxLevel(factionId, args[0]);
                if (o != TaxOutcome.Success) { ok = false; return $"세율 변경 실패: {o}"; }
                return $"세율 = {args[0]}";
            }
            case "enlist":
            {
                Require(args, 2, "enlist <대상무장id> <사신무장id>");
                var rs = new RecruitmentSystem(s, _db, gm.Bus);
                var res = rs.TryRecruit(factionId, args[0], args[1]);
                if (res.Outcome == RecruitGeneralOutcome.Success) return $"{args[0]} 등용 성공 (성공률 {res.ChancePermyriad / 100}%)";
                if (res.Outcome == RecruitGeneralOutcome.Failed) return $"{args[0]} 등용 실패 — 거절 (성공률 {res.ChancePermyriad / 100}% · 비용 소모)";
                ok = false; return $"등용 불가: {res.Outcome}";
            }
            case "summon":
            {
                var n = args.Length > 0 && int.TryParse(args[0], out var sn) ? sn : 1;
                var sys = new SummonSystem(s, _db, gm.Bus);
                var o = sys.DrawBatch(factionId, n, out var pulls);
                if (o != SummonOutcome.Success) { ok = false; return $"초빙 실패: {o}"; }
                return $"초빙 {pulls.Count}명: {string.Join(", ", pulls.Select(p => $"★{p.Rarity} {p.CharacterId}"))}";
            }
            case "ally" or "war" or "peace":
            {
                Require(args, 1, $"{verb} <세력id>");
                var dip = new DiplomacyManager(s, _db, gm.Bus);
                var o = verb switch
                {
                    "ally" => dip.FormAlliance(factionId, args[0]),
                    "war" => dip.DeclareWar(factionId, args[0]),
                    _ => dip.MakePeace(factionId, args[0])
                };
                if (o != DiplomacyOutcome.Success) { ok = false; return $"외교 실패: {o}"; }
                return $"{verb}: {args[0]}";
            }
            case "send":
            {
                Require(args, 3, "send <세력id> <금> <식량>");
                if (!int.TryParse(args[1], out var g) || !int.TryParse(args[2], out var f))
                { ok = false; return "금·식량은 정수여야 합니다."; }
                var o = new DiplomacyManager(s, _db).TransferResources(factionId, args[0], g, f);
                if (o != DiplomacyOutcome.Success) { ok = false; return $"지원 실패: {o}"; }
                return $"{args[0]}에 금 {g}·식량 {f} 지원";
            }
            case "end":
            {
                gm.AdvancePhase();     // 명령 페이즈 종료
                DriveToInput();        // AI·판정 페이즈 통과 — 발생 이벤트는 저널로 흐름
                return _winners is null ? "턴 종료" : "게임 종료";
            }
            default:
                ok = false;
                return $"알 수 없는 명령: {verb}";
        }
    }

    private static void Require(string[] args, int n, string usage)
    {
        if (args.Length < n) throw new ArgumentException($"사용법: {usage}");
    }

    private void DriveToInput()
    {
        if (SessionDriver.AdvanceUntilInput(_gm!, out var winners) == DriverStop.GameEnded)
            _winners = winners;
    }

    private CommandResult Error(string message, int journalStart = -1) =>
        new("error", message,
            journalStart < 0 ? new List<EventView>() : EventsSince(journalStart),
            Snapshot());

    private GameManager RequireGame() =>
        _gm ?? throw new InvalidOperationException("캠페인이 없습니다 — /api/new 또는 /api/load 먼저");
}
