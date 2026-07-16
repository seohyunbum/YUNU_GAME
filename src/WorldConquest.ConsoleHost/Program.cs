using System.Text;
using WorldConquest.Core.Data;
using WorldConquest.Core.Domain;

Console.OutputEncoding = Encoding.UTF8;

var playMode = args.Length > 0 && args[0] == "play";
var dataDir = playMode || args.Length == 0 ? FindDataDir() : args[0];
if (dataDir is null)
{
    Console.Error.WriteLine("data/ 폴더를 찾을 수 없습니다. 인자로 경로를 지정하십시오: dotnet run --project src/WorldConquest.ConsoleHost -- <data 경로>");
    return 1;
}

GameDatabase db;
try
{
    db = new DataLoader().Load(dataDir);
}
catch (DataValidationException ex)
{
    Console.Error.WriteLine($"✖ 데이터 검증 실패 — {ex.Errors.Count}건");
    foreach (var error in ex.Errors)
        Console.Error.WriteLine($"  {error}");
    return 1;
}

if (playMode)
{
    // 핫시트 2인 플레이 (§1.2). 플레이어 세력은 인자 또는 player_selectable 우선.
    var selectable = db.Factions.Values.Where(f => f.IsPlayerSelectable).Select(f => f.Id).ToList();
    var p1 = args.Length > 1 ? args[1] : selectable.ElementAtOrDefault(0) ?? db.Factions.Keys.First();
    var p2 = args.Length > 2 ? args[2] : selectable.FirstOrDefault(id => id != p1) ?? db.Factions.Keys.First(id => id != p1);
    var seed = (ulong)DateTime.Now.Ticks;   // 실제 플레이는 무작위 시드 (Presentation — 결정론 무관)
    var state = GameSetup.NewCampaign(db, seed, p1, p2);
    new PlaySession(new GameManager(state, db), db, Console.In, Console.Out).Run();
    return 0;
}

Console.WriteLine("════════════════════════════════════════════════════════");
Console.WriteLine(" PROJECT WORLD CONQUEST — Phase 0 데이터 로드 요약");
Console.WriteLine("════════════════════════════════════════════════════════");
Console.WriteLine($"데이터 경로: {Path.GetFullPath(dataDir)}");
Console.WriteLine($"검증: ✔ 통과 (캐릭터 {db.Characters.Count} · 스킬 {db.Skills.Count} · 병종 {db.Units.Count} · " +
                  $"육상 영지 {db.Map.LandProvinces.Count()} · 해역 {db.Map.SeaZones.Count()} · 세력 {db.Factions.Count})");

Console.WriteLine();
Console.WriteLine("── 세력 ────────────────────────────────────────────────");
foreach (var f in db.Factions.Values)
{
    var provinceNames = string.Join(", ", f.OwnedProvinceIds.Select(id => db.Map.GetNode(id).NameKo));
    var leader = f.LeaderCharacterId is null ? "-" : db.Characters[f.LeaderCharacterId].NameKo;
    Console.WriteLine($"  {f.NameKo,-8} | 군주: {leader,-8} | 금 {f.Treasury,5} | 식량 {f.Food,5} | 기술 Lv{f.TechLevel} | 성향 {f.AiDisposition,-12} | 영지: {provinceNames}");
}

Console.WriteLine();
Console.WriteLine("── 육상 영지 ───────────────────────────────────────────");
foreach (var p in db.Map.LandProvinces)
{
    var owner = db.Factions.Values.FirstOrDefault(f => f.OwnedProvinceIds.Contains(p.Id));
    var yield = p.Produce();
    Console.WriteLine($"  {p.NameKo,-6} | {p.Region,-11} | 지형 {db.TerrainModifiers[p.Terrain].NameKo,-3} | 인구 {p.Population,7:N0} | " +
                      $"생산 금{yield.Gold,4}/식량{yield.Food,4} | 방어 {p.DefenseLevel} | {(p.Port ? "항구" : "내륙")} | 소유 {(owner?.NameKo ?? "공백지")}");
}

Console.WriteLine();
Console.WriteLine("── 해상 거점 ───────────────────────────────────────────");
foreach (var s in db.Map.SeaZones)
    Console.WriteLine($"  {s.NameKo,-10} | 조류 {s.CurrentDirection,-2} | 인접: {string.Join(", ", s.Adjacent.Select(id => db.Map.GetNode(id).NameKo))}");

Console.WriteLine();
Console.WriteLine("── 캐릭터 ──────────────────────────────────────────────");
Console.WriteLine("  이름            | 통솔 무력 지력 정치 매력 해군 | 희귀 | 패시브 / 궁극기");
foreach (var c in db.Characters.Values)
{
    var faction = c.StartFaction == "player_selectable" ? "자유 무장" : db.Factions[c.StartFaction].NameKo;
    Console.WriteLine($"  {c.NameKo,-8}({faction,-5}) | {c.Stats.Ldr,4} {c.Stats.Str,4} {c.Stats.Int,4} {c.Stats.Pol,4} {c.Stats.Cha,4} {c.Stats.Nav,4} | ★{c.Rarity}  | " +
                      $"{db.Skills[c.PassiveSkillId].NameKo} / {db.Skills[c.UltimateSkillId].NameKo}");
}

Console.WriteLine();
Console.WriteLine($"── 맵 그래프: 노드 {db.Map.Nodes.Count}개, 간선 {db.Map.Edges.Count}개 (전체 연결 검증 완료) ──");
Console.WriteLine("Phase 0 DoD: 샘플 JSON 로드 → 세력·영지·캐릭터 요약 출력 ✔");
return 0;

static string? FindDataDir()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, "data");
        if (File.Exists(Path.Combine(candidate, DataLoader.RulesFile)))
            return candidate;
        dir = dir.Parent;
    }
    return null;
}
