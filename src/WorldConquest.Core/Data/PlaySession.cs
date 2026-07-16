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
        var actor = s.Factions.FirstOrDefault(f => f.Id == s.Actor);
        if (actor is null) { _gm.AdvancePhase(); return true; }   // 행동 세력 부재(fail-soft 삭제 등) → 페이즈 스킵(크래시 방지)
        _out.WriteLine($"\n=== {s.Turn}턴 · {FactionName(actor.Id)} ({actor.Controller}) ===");
        PrintStatus(actor);
        _out.WriteLine("명령: status / armies / capture <영지id> / recruit <영지id> <병종id> <수> / move <부대id> <목적지id> / assign <부대id> <캐릭터id> / attack <부대id> <적영지id> / build <영지id> <시설> / save <경로> / end / quit");

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

                case "assign":
                    if (t.Length < 3) { _out.WriteLine("사용법: assign <부대id> <캐릭터id>"); break; }
                    var so = _gm.AssignCommander(actor.Id, t[1], t[2]);
                    _out.WriteLine(so == AssignOutcome.Success
                        ? $"✔ {t[1]} 지휘관 = {CharacterName(t[2])}"
                        : $"✘ 임명 실패: {so}");
                    break;

                case "attack":
                    if (t.Length < 3) { _out.WriteLine("사용법: attack <부대id> <적영지id>"); break; }
                    var ao = _gm.Attack(actor.Id, t[1], t[2], out var battle);
                    if (battle is not null)
                        foreach (var ev in battle.SkillEvents)
                            _out.WriteLine($"  ✨ [{ev.Side}] {ev.SkillNameKo} — {ev.Detail}");
                    _out.WriteLine(ao switch
                    {
                        AttackOutcome.AttackerWon when battle!.Rounds == 0
                            => $"⚔ {ProvinceName(t[2])} 무저항 함락!",
                        AttackOutcome.AttackerWon
                            => $"⚔ {ProvinceName(t[2])} 점령! ({battle!.Rounds}라운드 · 아군 손실 {battle.AttackerLosses} · 적 손실 {battle.DefenderLosses})",
                        AttackOutcome.DefenderHeld
                            => $"✘ 공격 실패 — 수비 견고 ({battle!.Rounds}라운드 · 아군 손실 {battle.AttackerLosses} · 적 손실 {battle.DefenderLosses})",
                        _ => $"✘ 공격 불가: {ao}"
                    });
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
                    var savePath = ArgAfter(line, t[0]);   // 공백 포함 경로 보존
                    if (savePath.Length == 0) { _out.WriteLine("사용법: save <경로>"); break; }
                    try { _save.Save(s, savePath); _out.WriteLine($"💾 저장 완료: {savePath}"); }
                    catch (Exception ex) { _out.WriteLine($"✘ 저장 실패: {ex.Message}"); }   // 쓰기 실패로 세션이 죽지 않게
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

    /// <summary>명령 토큰 뒤의 나머지 인자 전체(공백 포함 경로 등). 토큰 분해로 잘리지 않게.</summary>
    private static string ArgAfter(string line, string cmd)
    {
        var trimmed = line.Trim();
        return trimmed.Length > cmd.Length ? trimmed[cmd.Length..].Trim() : "";
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

    private string CharacterName(string id) =>
        _db.Characters.TryGetValue(id, out var c) ? c.NameKo : id;
}
