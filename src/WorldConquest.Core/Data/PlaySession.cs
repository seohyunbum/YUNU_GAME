using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// 핫시트 2인 콘솔 플레이 루프 (설계문서 §1.2·§2.2·Phase 1). Presentation 로직이지만
/// Console 에 직접 의존하지 않고 <see cref="TextReader"/>/<see cref="TextWriter"/> 를 주입받는다
/// — 콘솔은 Program 이, 테스트는 StringReader/StringWriter 가 주입한다.
/// </summary>
public sealed class PlaySession
{
    private readonly GameManager _gm;
    private readonly GameDatabase _db;
    private readonly SaveSystem _save = new();
    private readonly TextReader _in;
    private readonly TextWriter _out;

    public PlaySession(GameManager gm, GameDatabase db, TextReader input, TextWriter output)
    {
        _gm = gm;
        _db = db;
        _in = input;
        _out = output;
    }

    public void Run()
    {
        _out.WriteLine("=== PROJECT WORLD CONQUEST — 핫시트 플레이 (Phase 1) ===");
        // 첫 턴 수입은 호출자(새 캠페인)가 정산한다 — 로드 이어하기는 이미 반영돼 있어 이중 수입을 피한다.
        var running = true;
        while (running)
        {
            var s = _gm.State;
            switch (s.Phase)
            {
                case TurnPhase.Player1Command:
                case TurnPhase.Player2Command:
                    running = PlayerTurn(s);
                    break;

                case TurnPhase.Income:
                    _out.WriteLine($"\n── {s.Turn}턴 시작 · 수입 정산 완료 ──");
                    _gm.AdvancePhase();
                    break;

                case TurnPhase.VictoryCheck:
                    if (_gm.IsVictory(out var winner))
                    {
                        _out.WriteLine($"\n🏆 {FactionName(winner!)} 세력이 전 육상 영지를 정복했습니다! 게임 종료.");
                        running = false;
                    }
                    else _gm.AdvancePhase();
                    break;

                default:   // AiAction · Resolution · Events (Phase 1 자동 통과)
                    _gm.AdvancePhase();
                    break;
            }
        }
        _out.WriteLine("게임을 종료합니다.");
    }

    /// <summary>한 플레이어의 명령 페이즈. 턴 종료(end)면 true, 게임 종료(quit/EOF)면 false.</summary>
    private bool PlayerTurn(GameState s)
    {
        var actor = s.Factions.First(f => f.Id == s.Actor);
        _out.WriteLine($"\n=== {s.Turn}턴 · {FactionName(actor.Id)} ({actor.Controller}) ===");
        PrintStatus(actor);
        _out.WriteLine("명령: status / armies / capture <영지id> / recruit <영지id> <병종id> <수> / move <부대id> <목적지id> / build <영지id> <시설> / save <경로> / end / quit");

        while (true)
        {
            _out.Write("> ");
            var line = _in.ReadLine();
            if (line is null) return false;   // EOF

            var t = line.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (t.Length == 0) continue;

            switch (t[0])
            {
                case "status":
                    PrintStatus(actor);
                    break;

                case "armies":
                    PrintArmies(actor.Id);
                    break;

                case "capture":
                    if (t.Length < 2) { _out.WriteLine("사용법: capture <영지id>"); break; }
                    var co = _gm.TryCapture(actor.Id, t[1]);
                    _out.WriteLine(co == CaptureOutcome.Success ? $"✔ {ProvinceName(t[1])} 점령" : $"✘ 점령 실패: {co}");
                    break;

                case "recruit":
                    if (t.Length < 4 || !int.TryParse(t[3], out var count))
                    { _out.WriteLine("사용법: recruit <영지id> <병종id> <수>"); break; }
                    var ro = _gm.Recruit(actor.Id, t[1], t[2], count);
                    _out.WriteLine(ro == RecruitOutcome.Success
                        ? $"✔ {ProvinceName(t[1])}에서 {t[2]} {count} 징병"
                        : $"✘ 징병 실패: {ro}");
                    break;

                case "build":
                    if (t.Length < 3) { _out.WriteLine("사용법: build <영지id> <시설: market|farm>"); break; }
                    var fo = _gm.BuildFacility(actor.Id, t[1], t[2]);
                    _out.WriteLine(fo == FacilityOutcome.Success
                        ? $"✔ {ProvinceName(t[1])}에 {t[2]} 건설/증축"
                        : $"✘ 건설 실패: {fo}");
                    break;

                case "move":
                    if (t.Length < 3) { _out.WriteLine("사용법: move <부대id> <목적지id>"); break; }
                    var mo = _gm.MoveArmy(t[1], t[2]);
                    _out.WriteLine(mo == MoveOutcome.Success
                        ? $"✔ {t[1]} → {ProvinceName(t[2])} 이동"
                        : $"✘ 이동 실패: {mo}");
                    break;

                case "save":
                    if (t.Length < 2) { _out.WriteLine("사용법: save <경로>"); break; }
                    _save.Save(s, t[1]);
                    _out.WriteLine($"💾 저장 완료: {t[1]}");
                    break;

                case "end":
                    _gm.AdvancePhase();
                    return true;

                case "quit":
                    return false;

                default:
                    _out.WriteLine($"알 수 없는 명령: {t[0]}");
                    break;
            }
        }
    }

    private void PrintArmies(string factionId)
    {
        var armies = _gm.State.Armies.Where(a => a.FactionId == factionId).ToList();
        if (armies.Count == 0) { _out.WriteLine("  (편성된 부대 없음)"); return; }
        foreach (var a in armies)
            _out.WriteLine($"  {a.Id} @ {ProvinceName(a.LocationNodeId)} · 병력 {a.TotalTroops} " +
                           $"({string.Join(", ", a.Units.Select(u => $"{u.Key} {u.Value}"))})");
    }

    private void PrintStatus(FactionState f)
    {
        _out.WriteLine($"  금 {f.Treasury} · 식량 {f.Food} · 기술 Lv{f.TechLevel} · " +
                       $"영지 {f.OwnedProvinceIds.Count}개: {string.Join(", ", f.OwnedProvinceIds.Select(ProvinceName))}");

        var allOwned = _gm.State.Factions.SelectMany(x => x.OwnedProvinceIds).ToHashSet();
        var capturable = f.OwnedProvinceIds
            .SelectMany(id => _db.Map.GetAdjacent(id))
            .Distinct()
            .Where(a => _db.Map.GetNode(a) is LandProvince && !allOwned.Contains(a))
            .ToList();
        if (capturable.Count > 0)
            _out.WriteLine($"  점령 가능(빈 영지): {string.Join(", ", capturable.Select(a => $"{ProvinceName(a)}[{a}]"))}");
    }

    private string ProvinceName(string id) =>
        _db.Map.Nodes.TryGetValue(id, out var node) ? node.NameKo : id;

    private string FactionName(string id) =>
        _db.Factions.TryGetValue(id, out var f) ? f.NameKo : id;
}
