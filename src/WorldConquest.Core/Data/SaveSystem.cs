using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

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

    /// <summary>전 필드 nullable DTO → 새 GameState 단일 정규화 경로 (D1·D2·D3). SaveDto 가 internal 이라 internal.</summary>
    internal static GameState Normalize(SaveDto dto)
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
        }).ToList();

        return new GameState
        {
            DataSchemaVersion = dto.DataSchemaVersion ?? DataLoader.SupportedSchemaVersion,
            CampaignSeed = seed,
            Turn = dto.Turn ?? 1,
            Phase = dto.Phase ?? TurnPhase.Income,
            Actor = dto.Actor ?? "",
            Rng = rng,
            Factions = factions,
            Progress = (dto.Progress ?? new()).ToHashSet(),
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
        Progress = s.Progress.OrderBy(x => x, StringComparer.Ordinal).ToList()
    };

    private static string ToHex(ulong v) => v.ToString("x16", CultureInfo.InvariantCulture);
    private static ulong ParseHex(string hex) => ulong.Parse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
}
