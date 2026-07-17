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

        // T0 컷씬 재생 — CutsceneTriggered 구독 (§2.7.2: Core 는 선택만, 재생은 Presentation)
        // 턴 시작 배너 — SessionDriver 가 발행하는 TurnStarted 를 콘솔식으로 표현 (UE5 는 같은 이벤트를 연출로)
        var player = new TextCutscenePlayer(db, output);
        gm.Bus.Subscribe(evt =>
        {
            switch (evt.Type)
            {
                case "CutsceneTriggered":
                    player.Play(evt.Get("cutscene")!, evt.Get("first_fire") == "true");
                    break;
                case "TurnStarted":
                    _out.WriteLine($"\n── {evt.Get("turn")}턴 시작 · 수입 정산 완료 ──");
                    break;
            }
        });
    }

    public void Run()
    {
        _out.WriteLine("=== PROJECT WORLD CONQUEST — 핫시트 플레이 (Phase 1) ===");
        // 첫 턴 수입은 호출자(새 캠페인)가 정산한다 — 로드 이어하기는 이미 반영돼 있어 이중 수입을 피한다.
        // 페이즈 오케스트레이션은 SessionDriver 단일 구현 공유 (UE5 설계 §2.3 [MUST]).
        while (true)
        {
            if (SessionDriver.AdvanceUntilInput(_gm, out var winners) == DriverStop.GameEnded)
            {
                _out.WriteLine(winners.Count == 1
                    ? $"\n🏆 {FactionName(winners[0])} 세력이 전 육상 영지를 정복했습니다! 게임 종료."
                    : $"\n🏆🏆 공동 승리! {string.Join(" · ", winners.Select(FactionName))} 동맹이 세계를 정복했습니다! (§1.2)");
                break;
            }
            if (!PlayerTurn(_gm.State)) break;
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
        _out.WriteLine("명령: status / armies / chars / province [영지id] / capture <영지id> / recruit <영지id> <병종id> <수> / move <부대id> <목적지id> / assign <부대id> <캐릭터id> / governor <영지id> <캐릭터id> / dismiss <영지id> / tax <단계> / attack <부대id> <목표id> / build <영지id> <시설> / summon [n] / rates / ally|war|peace <세력id> / send <세력id> <금> <식량> / save <경로> / end / quit");

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

                case "summon":
                {
                    var n = t.Length > 1 && int.TryParse(t[1], out var sn) ? sn : 1;
                    var sys = new SummonSystem(s, _db, _gm.Bus);
                    var so2 = sys.DrawBatch(actor.Id, n, out var pulls);
                    if (so2 != SummonOutcome.Success) { _out.WriteLine($"✘ 초빙 실패: {so2}"); break; }
                    foreach (var r in pulls) PrintReveal(r);
                    _out.WriteLine($"  (천명 잔액 {actor.Mandate})");
                    break;
                }

                case "rates":
                {
                    var sys = new SummonSystem(s, _db, _gm.Bus);
                    var rates = sys.GetCurrentRates(actor.Id);
                    var pool = sys.GetPool();
                    _out.WriteLine($"── 초빙 정보 (§2.8.6 확률 공시) ── 천명 {actor.Mandate} · 단발 {_db.Rules.SummonCostSingle}");
                    if (pool.Count == 0) { _out.WriteLine("  천하의 인재를 모두 만났습니다 — 풀 소진."); break; }
                    foreach (var (rarity, w) in rates.OrderByDescending(kv => kv.Key))
                        _out.WriteLine($"  ★{rarity}: {w / 100}.{w % 100:00}%  (잔여 {pool.Count(c => c.Rarity == rarity)}명)");
                    var toPity = _db.Rules.SummonHardPity - actor.PityCount;
                    if (pool.Any(c => c.Rarity >= 5))
                        _out.WriteLine($"  천장: 다음 ★5까지 최대 {toPity}회");
                    break;
                }

                case "ally":
                case "war":
                case "peace":
                    if (t.Length < 2) { _out.WriteLine($"사용법: {t[0]} <세력id>"); break; }
                    var dip = new DiplomacyManager(s, _db, _gm.Bus);
                    var dr = t[0] switch
                    {
                        "ally" => dip.FormAlliance(actor.Id, t[1]),
                        "war" => dip.DeclareWar(actor.Id, t[1]),
                        _ => dip.MakePeace(actor.Id, t[1])
                    };
                    _out.WriteLine(dr == DiplomacyOutcome.Success
                        ? t[0] switch
                        {
                            "ally" => $"🤝 {FactionName(t[1])} 와(과) 동맹 체결",
                            "war" => $"⚔ {FactionName(t[1])} 에 선전포고",
                            _ => $"🕊 {FactionName(t[1])} 와(과) 종전"
                        }
                        : $"✘ 외교 실패: {dr}");
                    break;

                case "send":
                    if (t.Length < 4 || !int.TryParse(t[2], out var sg) || !int.TryParse(t[3], out var sf))
                    { _out.WriteLine("사용법: send <세력id> <금> <식량>"); break; }
                    var tr = new DiplomacyManager(s, _db).TransferResources(actor.Id, t[1], sg, sf);
                    _out.WriteLine(tr == DiplomacyOutcome.Success
                        ? $"📦 {FactionName(t[1])} 에 금 {sg}·식량 {sf} 지원"
                        : $"✘ 지원 실패: {tr}");
                    break;

                case "governor":
                    if (t.Length < 3) { _out.WriteLine("사용법: governor <영지id> <캐릭터id>"); break; }
                    var go = _gm.Internal.AppointGovernor(actor.Id, t[1], t[2]);
                    _out.WriteLine(go == GovernorOutcome.Success
                        ? $"✔ {ProvinceName(t[1])} 태수 = {CharacterName(t[2])}"
                        : $"✘ 태수 임명 실패: {go}");
                    break;

                case "dismiss":
                    if (t.Length < 2) { _out.WriteLine("사용법: dismiss <영지id>"); break; }
                    var dgo = _gm.Internal.DismissGovernor(actor.Id, t[1]);
                    _out.WriteLine(dgo == GovernorOutcome.Success
                        ? $"✔ {ProvinceName(t[1])} 태수 해임"
                        : $"✘ 해임 실패: {dgo}");
                    break;

                case "tax":
                {
                    var levels = string.Join("|", _db.Rules.InternalAffairs.TaxLevels.Keys);
                    if (t.Length < 2) { _out.WriteLine($"사용법: tax <{levels}>"); break; }
                    var to2 = _gm.Internal.SetTaxLevel(actor.Id, t[1]);
                    _out.WriteLine(to2 == TaxOutcome.Success
                        ? $"✔ 세율 = {t[1]} (금 {_db.Rules.InternalAffairs.TaxLevels[t[1]].GoldPct}% · 민심 {_db.Rules.InternalAffairs.TaxLevels[t[1]].PoDrift:+0;-#;0}/턴)"
                        : $"✘ 세율 변경 실패: {to2} (가능: {levels})");
                    break;
                }

                case "province":
                    if (t.Length >= 2) PrintProvinceDetail(actor, t[1]);
                    else foreach (var pid in actor.OwnedProvinceIds) PrintProvinceLine(pid);
                    break;

                case "chars":
                    PrintCharacters(actor.Id);
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

    /// <summary>초빙 리빌 — 등급별 차등 연출 (§2.8.10 진실 신호·★5 는 등장씬이 별도 재생됨).</summary>
    private void PrintReveal(SummonResult r)
    {
        var name = CharacterName(r.CharacterId);
        switch (r.Rarity)
        {
            case >= 5:
                _out.WriteLine("  하늘이 울린다…  ─ 금색 문이 열린다 ─");
                _out.WriteLine($"  ★★★★★ 「{name}」 {(r.PityTriggered ? "— 천명이 응답했다!" : "")}");
                break;
            case 4:
                _out.WriteLine($"  ─ 자색 문 ─  ★★★★ 「{name}」");
                break;
            default:
                _out.WriteLine($"  ★{r.Rarity} {name} 합류");
                break;
        }
    }

    /// <summary>명령 토큰 뒤의 나머지 인자 전체(공백 포함 경로 등). 토큰 분해로 잘리지 않게.</summary>
    private static string ArgAfter(string line, string cmd)
    {
        var trimmed = line.Trim();
        return trimmed.Length > cmd.Length ? trimmed[cmd.Length..].Trim() : "";
    }

    /// <summary>영지 한 줄 요약 (province 무인자).</summary>
    private void PrintProvinceLine(string pid)
    {
        var ia = _gm.Internal;
        var p = ia.PreviewIncome(pid);
        var gov = ia.GovernorOf(pid);
        _out.WriteLine($"  {ProvinceName(pid)}[{pid}] 민심 {p.PublicOrder} · 인구 {ia.GetPopulation(pid):N0} · " +
                       $"수입 금{p.FinalGold}/식량{p.FinalFood} · 태수 {(gov is null ? "-" : gov.NameKo)}");
    }

    /// <summary>영지 상세 (province &lt;id&gt;) — 수입 산출 내역·시설·태수 효과 (§2.3.1).</summary>
    private void PrintProvinceDetail(FactionState actor, string pid)
    {
        if (!actor.OwnedProvinceIds.Contains(pid)) { _out.WriteLine($"✘ 소유 영지가 아닙니다: {pid}"); return; }
        var ia = _gm.Internal;
        var p = ia.PreviewIncome(pid);
        var gov = ia.GovernorOf(pid);
        var ps = _gm.State.Provinces.FirstOrDefault(x => x.Id == pid);
        var facilities = ps is null || ps.Facilities.Count == 0
            ? "(없음)"
            : string.Join(", ", ps.Facilities.Select(kv => $"{kv.Key} Lv{kv.Value}"));
        _out.WriteLine($"── {ProvinceName(pid)} [{pid}] ──");
        _out.WriteLine($"  민심 {p.PublicOrder} (생산 승수 {p.PoOutputPct}%) · 인구 {ia.GetPopulation(pid):N0}");
        _out.WriteLine($"  시설: {facilities}");
        _out.WriteLine($"  태수: {(gov is null ? "(공석)" : $"{gov.NameKo} — 정치 {gov.Stats.Pol}·매력 {gov.Stats.Cha}·지력 {gov.Stats.Int}")}");
        _out.WriteLine($"  수입: 금 {p.BaseGold}→{p.FinalGold} (시설 +{p.FacilityGoldPct}% · 태수 +{p.GovernorGoldPct}% · 민심 {p.PoOutputPct}% · 세율 {p.TaxGoldPct}%)");
        _out.WriteLine($"       식량 {p.BaseFood}→{p.FinalFood} (시설 +{p.FacilityFoodPct}% · 태수 +{p.GovernorFoodPct}% · 민심 {p.PoOutputPct}%)");
        _out.WriteLine($"  징병 할인 {ia.RecruitDiscountPct(pid)}% · 수비 보정 +{ia.DefenseBonusPct(pid)}%");
    }

    /// <summary>보유 무장 목록 — 보직(지휘관/태수/대기) 표시 (§2.3.1·§2.8).</summary>
    private void PrintCharacters(string factionId)
    {
        var ia = _gm.Internal;
        var owned = _gm.State.CharacterOwners
            .Where(kv => kv.Value == factionId && _db.Characters.ContainsKey(kv.Key))
            .Select(kv => _db.Characters[kv.Key])
            .OrderBy(c => c.Id, StringComparer.Ordinal)
            .ToList();
        if (owned.Count == 0) { _out.WriteLine("  (보유 무장 없음)"); return; }
        foreach (var c in owned)
        {
            var force = _gm.State.Armies.FirstOrDefault(a => a.CommanderId == c.Id)?.Id
                        ?? _gm.State.Fleets.FirstOrDefault(f => f.CommanderId == c.Id)?.Id;
            var governed = ia.GovernorProvinceOf(c.Id);
            var role = force is not null ? $"지휘관 @ {force}"
                     : governed is not null ? $"태수 @ {ProvinceName(governed)}"
                     : "대기";
            _out.WriteLine($"  {c.NameKo,-8} 통{c.Stats.Ldr,3} 무{c.Stats.Str,3} 지{c.Stats.Int,3} 정{c.Stats.Pol,3} 매{c.Stats.Cha,3} 해{c.Stats.Nav,3} · {role}");
        }
    }

    private void PrintArmies(string factionId)
    {
        var forces = _gm.State.Armies.Where(a => a.FactionId == factionId).Cast<MilitaryForce>()
            .Concat(_gm.State.Fleets.Where(f => f.FactionId == factionId)).ToList();
        if (forces.Count == 0) { _out.WriteLine("  (편성된 부대 없음)"); return; }
        foreach (var a in forces)
            _out.WriteLine($"  {(a is Fleet ? "⚓" : "⚔")} {a.Id} @ {ProvinceName(a.LocationNodeId)} · 병력 {a.TotalTroops} " +
                           $"({string.Join(", ", a.Units.Select(u => $"{u.Key} {u.Value}"))})" +
                           (a.CommanderId is null ? "" : $" · 지휘 {CharacterName(a.CommanderId)}"));
    }

    private void PrintStatus(FactionState f)
    {
        var ia = _gm.Internal;
        var tax = f.TaxLevel.Length > 0 ? f.TaxLevel : _db.Rules.InternalAffairs.DefaultTaxLevel;
        _out.WriteLine($"  금 {f.Treasury} · 식량 {f.Food} · 세율 {tax} · 기술 Lv{f.TechLevel} ({f.TechPoints}pt) · " +
                       $"영지 {f.OwnedProvinceIds.Count}개: {string.Join(", ", f.OwnedProvinceIds.Select(ProvinceName))}");
        var unrest = f.OwnedProvinceIds
            .Where(pid => _db.Map.GetNode(pid) is LandProvince && ia.GetPublicOrder(pid) < _db.Rules.InternalAffairs.RebellionThreshold)
            .Select(ProvinceName).ToList();
        if (unrest.Count > 0)
            _out.WriteLine($"  ⚠ 반란 위험(민심 {_db.Rules.InternalAffairs.RebellionThreshold} 미만): {string.Join(", ", unrest)}");

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
