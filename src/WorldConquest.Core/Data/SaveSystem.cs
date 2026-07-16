using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>fail-soft 로드 결과 (D9): 정규화된 상태 + 스킵된 정의 참조 목록.</summary>
public sealed record LoadResult(GameState State, IReadOnlyList<string> Skipped);

/// <summary>
/// 게임 상태 직렬화/역직렬화 — 모든 세이브 읽기의 단일 진입점 (설계문서 §4.2, design save-system).
/// <para>계약: Load=새 GameState 생성(D1) · 단일 Normalize 경로(D2) · 미래 버전만 거부(D3) ·
/// atomic write(D7) · RNG 스트림 상태 직렬화(D8).</para>
/// </summary>
public sealed class SaveSystem
{
    public const int CurrentSaveVersion = 1;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
    };

    /// <summary>atomic write (D7): 임시 파일 완성 후 교체 — 실패 시 기존 파일 무손상.</summary>
    public void Save(GameState state, string filePath)
    {
        var json = JsonSerializer.Serialize(ToDto(state), JsonOpts);
        var dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

        var tmp = filePath + ".tmp";
        File.WriteAllText(tmp, json);
        if (File.Exists(filePath)) File.Replace(tmp, filePath, destinationBackupFileName: null);
        else File.Move(tmp, filePath);
    }

    public GameState Load(string filePath)
    {
        var dto = JsonSerializer.Deserialize<SaveDto>(File.ReadAllText(filePath), JsonOpts)
                  ?? throw new InvalidOperationException("세이브 파일이 비어 있습니다.");
        return Normalize(dto);
    }

    /// <summary>db 대조 fail-soft 로드 (D9) — 삭제된 정의 id 참조 항목을 스킵하고 Skipped 로 표면화한다.</summary>
    public LoadResult Load(string filePath, GameDatabase db)
    {
        var dto = JsonSerializer.Deserialize<SaveDto>(File.ReadAllText(filePath), JsonOpts)
                  ?? throw new InvalidOperationException("세이브 파일이 비어 있습니다.");
        var skipped = new List<string>();
        return new LoadResult(Normalize(dto, db, skipped), skipped);
    }

    /// <summary>전 필드 nullable DTO → 새 GameState 단일 정규화 경로 (D1·D2·D3).</summary>
    internal static GameState Normalize(SaveDto dto) => Normalize(dto, null, null);

    /// <summary>db 를 주면 삭제된 정의 id 참조를 fail-soft 로 스킵하고 skipped 에 기록한다 (D9).</summary>
    internal static GameState Normalize(SaveDto dto, GameDatabase? db, List<string>? skipped)
    {
        var version = dto.SaveVersion
            ?? throw new InvalidOperationException("세이브에 save_version 이 없습니다.");
        if (version > CurrentSaveVersion)
            throw new InvalidOperationException(
                $"미래 세이브 버전({version})은 로드할 수 없습니다. 지원: {CurrentSaveVersion} 이하 (빌드 롤백 시 진행 판 보호).");

        var seed = ParseHex(dto.CampaignSeed ?? throw new InvalidOperationException("campaign_seed 누락"));
        var rng = new RngStreams(seed);
        if (dto.RngStreams is not null)
            foreach (var (name, s) in dto.RngStreams)
                rng.Restore(name,
                    ParseHex(s.State ?? throw new InvalidOperationException($"rng '{name}' state 누락")),
                    ParseHex(s.Inc ?? throw new InvalidOperationException($"rng '{name}' inc 누락")));

        var factions = (dto.Factions ?? new()).Select(f => new FactionState
        {
            Id = f.Id ?? throw new InvalidOperationException("faction id 누락"),
            Controller = f.Controller ?? "ai",
            Treasury = f.Treasury ?? 0,
            Food = f.Food ?? 0,
            TechLevel = f.TechLevel ?? 1,
            OwnedProvinceIds = f.OwnedProvinceIds ?? new(),
            Relations = f.Relations ?? new()
        })
        .Where(f =>
        {
            if (db is not null && !db.Factions.ContainsKey(f.Id)) { skipped?.Add($"faction:{f.Id}"); return false; }
            return true;
        })
        .ToList();

        var liveFactionIds = factions.Select(f => f.Id).ToHashSet();

        // D9 fail-soft: 삭제된 정의 참조는 건별 스킵 (정의=fail-fast §5.5 와 대칭, 세이브=fail-soft).
        if (db is not null)
            foreach (var f in factions)
            {
                foreach (var pid in f.OwnedProvinceIds.Where(p => !db.Map.Nodes.ContainsKey(p)).ToList())
                {
                    f.OwnedProvinceIds.Remove(pid);
                    skipped?.Add($"province:{pid}@{f.Id}");
                }
                // 삭제(스킵)된 세력을 참조하는 외교 관계 키 프루닝
                foreach (var key in f.Relations.Keys.Where(k => !liveFactionIds.Contains(k)).ToList())
                {
                    f.Relations.Remove(key);
                    skipped?.Add($"relation:{key}@{f.Id}");
                }
            }

        var armies = (dto.Armies ?? new())
            .Select(a =>
            {
                var commanderId = a.CommanderId;
                if (commanderId is not null && db is not null && !db.Characters.ContainsKey(commanderId))
                { skipped?.Add($"commander:{commanderId}@{a.Id}"); commanderId = null; }   // 삭제된 지휘관 정규화
                var army = new Army(
                    a.Id ?? throw new InvalidOperationException("army id 누락"),
                    a.FactionId ?? throw new InvalidOperationException($"army '{a.Id}' faction 누락"),
                    a.LocationNodeId ?? throw new InvalidOperationException($"army '{a.Id}' location 누락"))
                { CommanderId = commanderId, Morale = a.Morale ?? MilitaryForce.MoraleMax, Supply = a.Supply ?? 0 };
                foreach (var (unitId, count) in a.Units ?? new())
                    if (count > 0 && (db is null || db.Units.ContainsKey(unitId))) army.AddUnits(unitId, count);
                    else if (db is not null && !db.Units.ContainsKey(unitId)) skipped?.Add($"unit:{unitId}@{a.Id}");
                return army;
            })
            .Where(army =>
            {
                if (db is null) return true;
                if (!liveFactionIds.Contains(army.FactionId)) { skipped?.Add($"army:{army.Id}(faction {army.FactionId})"); return false; }
                if (!db.Map.Nodes.ContainsKey(army.LocationNodeId)) { skipped?.Add($"army:{army.Id}(location {army.LocationNodeId})"); return false; }
                return true;
            })
            .ToList();

        var provinces = (dto.Provinces ?? new())
            .Select(p => new ProvinceState
            {
                Id = p.Id ?? throw new InvalidOperationException("province id 누락"),
                Facilities = p.Facilities ?? new()
            })
            .Where(p =>
            {
                if (db is null) return true;
                if (!db.Map.Nodes.ContainsKey(p.Id)) { skipped?.Add($"province_state:{p.Id}"); return false; }
                return true;
            })
            .ToList();

        // 삭제된 시설 정의 참조 프루닝
        if (db is not null)
            foreach (var p in provinces)
                foreach (var ftype in p.Facilities.Keys.Where(k => !db.Rules.Facilities.ContainsKey(k)).ToList())
                {
                    p.Facilities.Remove(ftype);
                    skipped?.Add($"facility:{ftype}@{p.Id}");
                }

        // 행동 세력(Actor)이 스킵됐으면 빈 문자열로 정규화 — 이어하기 시 PlaySession 이 방어(FirstOrDefault).
        var actor = dto.Actor ?? "";
        if (db is not null && actor.Length > 0 && !liveFactionIds.Contains(actor))
        { skipped?.Add($"actor:{actor}"); actor = ""; }

        return new GameState
        {
            DataSchemaVersion = dto.DataSchemaVersion ?? DataLoader.SupportedSchemaVersion,
            CampaignSeed = seed,
            Turn = dto.Turn ?? 1,
            Phase = dto.Phase ?? TurnPhase.Income,
            Actor = actor,
            Rng = rng,
            Factions = factions,
            Progress = (dto.Progress ?? new()).ToHashSet(),
            Armies = armies,
            Provinces = provinces,
            MigratedFromVersion = version
        };
    }

    private static SaveDto ToDto(GameState s) => new()
    {
        SaveVersion = CurrentSaveVersion,
        MigratedFromVersion = s.MigratedFromVersion == 0 ? CurrentSaveVersion : s.MigratedFromVersion,
        DataSchemaVersion = s.DataSchemaVersion,
        CampaignSeed = ToHex(s.CampaignSeed),
        Turn = s.Turn,
        Phase = s.Phase,
        Actor = s.Actor,
        RngStreams = s.Rng.Snapshot().ToDictionary(
            kv => kv.Key,
            kv => new RngStreamDto { State = ToHex(kv.Value.State), Inc = ToHex(kv.Value.Inc) }),
        Factions = s.Factions.Select(f => new FactionStateDto
        {
            Id = f.Id, Controller = f.Controller,
            Treasury = f.Treasury, Food = f.Food, TechLevel = f.TechLevel,
            OwnedProvinceIds = f.OwnedProvinceIds,
            Relations = f.Relations
        }).ToList(),
        // ordinal 정렬 직렬화 — 동일 상태 = 동일 바이트(세이브 §2.7.12, 왕복 비교 단순화).
        Progress = s.Progress.OrderBy(x => x, StringComparer.Ordinal).ToList(),
        Armies = s.Armies.Select(a => new ArmyDto
        {
            Id = a.Id, FactionId = a.FactionId, LocationNodeId = a.LocationNodeId,
            CommanderId = a.CommanderId, Morale = a.Morale, Supply = a.Supply,
            Units = a.Units.ToDictionary(kv => kv.Key, kv => kv.Value)
        }).ToList(),
        Provinces = s.Provinces.Select(p => new ProvinceStateDto
        {
            Id = p.Id,
            Facilities = p.Facilities.ToDictionary(kv => kv.Key, kv => kv.Value)
        }).ToList()
    };

    private static string ToHex(ulong v) => v.ToString("x16", CultureInfo.InvariantCulture);
    private static ulong ParseHex(string hex) => ulong.Parse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
}
