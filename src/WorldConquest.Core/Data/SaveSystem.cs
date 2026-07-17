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
            Relations = f.Relations ?? new(),
            TransferredGoldThisTurn = f.TransferredGoldThisTurn ?? 0,
            TransferredFoodThisTurn = f.TransferredFoodThisTurn ?? 0,
            Mandate = f.Mandate ?? 0,
            PityCount = f.PityCount ?? 0,
            SummonsThisTurn = f.SummonsThisTurn ?? 0,
            RecruitsThisTurn = f.RecruitsThisTurn ?? 0,
            SearchesThisTurn = f.SearchesThisTurn ?? 0,
            TaxLevel = f.TaxLevel ?? "",   // 빈 값 = 기본 세율 해석 (§2.3, additive)
            TechPoints = Math.Max(f.TechPoints ?? 0, 0),
            ActedCharacterIds = (f.ActedCharacterIds ?? new()).ToHashSet()   // 파견 소진 (§2.3.2, additive)
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
                if (f.TaxLevel.Length > 0 && !db.Rules.InternalAffairs.TaxLevels.ContainsKey(f.TaxLevel))
                {
                    skipped?.Add($"tax_level:{f.TaxLevel}@{f.Id}");
                    f.TaxLevel = "";   // 기본 세율로 정규화
                }
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

        // 쌍 단위 관계도(Favor) — 위 세력별 Relations 프루닝과 **동형**으로 처리한다 (외교 E3·D9).
        // 술어는 db.Factions 가 아니라 liveFactionIds 여야 한다: db 정의엔 있으나 세이브 Factions
        // 목록에서 이미 스킵된 세력을 가리키는 쌍이 살아남으면 dangling RelationState 가 된다.
        var relations = (dto.Relations ?? new())
            .Where(r => r.FactionA is not null && r.FactionB is not null)
            .Select(r => new RelationState
            {
                FactionA = r.FactionA!,
                FactionB = r.FactionB!,
                Favor = r.Favor ?? 0,
                TruceUntilTurn = r.TruceUntilTurn
            })
            .Where(r =>
            {
                if (db is null) return true;
                if (liveFactionIds.Contains(r.FactionA) && liveFactionIds.Contains(r.FactionB)) return true;
                skipped?.Add($"relation_pair:{r.PairKey}");
                return false;
            })
            .ToList();

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

        var fleets = (dto.Fleets ?? new())
            .Select(f =>
            {
                var commanderId = f.CommanderId;
                if (commanderId is not null && db is not null && !db.Characters.ContainsKey(commanderId))
                { skipped?.Add($"commander:{commanderId}@{f.Id}"); commanderId = null; }
                var fleet = new Fleet(
                    f.Id ?? throw new InvalidOperationException("fleet id 누락"),
                    f.FactionId ?? throw new InvalidOperationException($"fleet '{f.Id}' faction 누락"),
                    f.LocationNodeId ?? throw new InvalidOperationException($"fleet '{f.Id}' location 누락"))
                { CommanderId = commanderId, Morale = f.Morale ?? MilitaryForce.MoraleMax, Supply = f.Supply ?? 0 };
                foreach (var (unitId, count) in f.Units ?? new())
                    if (count > 0 && (db is null || db.Units.ContainsKey(unitId))) fleet.AddUnits(unitId, count);
                    else if (db is not null && !db.Units.ContainsKey(unitId)) skipped?.Add($"unit:{unitId}@{f.Id}");
                return fleet;
            })
            .Where(fleet =>
            {
                if (db is null) return true;
                if (!liveFactionIds.Contains(fleet.FactionId)) { skipped?.Add($"fleet:{fleet.Id}(faction {fleet.FactionId})"); return false; }
                if (!db.Map.Nodes.ContainsKey(fleet.LocationNodeId)) { skipped?.Add($"fleet:{fleet.Id}(location {fleet.LocationNodeId})"); return false; }
                return true;
            })
            .ToList();

        var provinces = (dto.Provinces ?? new())
            .Select(p => new ProvinceState
            {
                Id = p.Id ?? throw new InvalidOperationException("province id 누락"),
                Facilities = p.Facilities ?? new(),
                PublicOrder = p.PublicOrder is { } po ? Math.Clamp(po, 0, 100) : null,   // §2.3 (additive)
                Population = p.Population is { } pop and >= 0 ? pop : null,
                GovernorId = p.GovernorId,
                Commerce = p.Commerce is { } c and >= 0 ? c : null,          // §2.3.2 (additive)
                Agriculture = p.Agriculture is { } a and >= 0 ? a : null
            })
            .Where(p =>
            {
                if (db is null) return true;
                if (!db.Map.Nodes.ContainsKey(p.Id)) { skipped?.Add($"province_state:{p.Id}"); return false; }
                return true;
            })
            .ToList();

        // 삭제된 시설 정의·태수 캐릭터 참조 프루닝
        if (db is not null)
            foreach (var p in provinces)
            {
                foreach (var ftype in p.Facilities.Keys.Where(k => !db.Rules.Facilities.ContainsKey(k)).ToList())
                {
                    p.Facilities.Remove(ftype);
                    skipped?.Add($"facility:{ftype}@{p.Id}");
                }
                if (p.GovernorId is not null && !db.Characters.ContainsKey(p.GovernorId))
                {
                    skipped?.Add($"governor:{p.GovernorId}@{p.Id}");
                    p.GovernorId = null;
                }
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
            Fleets = fleets,
            Provinces = provinces,
            FiredCutsceneIds = (dto.FiredCutsceneIds ?? new()).ToHashSet(),   // 결번 id 잔존 무해(정의 없는 id 무시)
            CharacterOwners = dto.CharacterOwners ?? new(),
            Relations = relations,   // 외교 관계도 (additive — 구세이브는 빈 리스트)
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
            Relations = f.Relations,
            TransferredGoldThisTurn = f.TransferredGoldThisTurn,
            TransferredFoodThisTurn = f.TransferredFoodThisTurn,
            Mandate = f.Mandate,
            PityCount = f.PityCount,
            SummonsThisTurn = f.SummonsThisTurn,
            RecruitsThisTurn = f.RecruitsThisTurn,
            SearchesThisTurn = f.SearchesThisTurn,
            TaxLevel = f.TaxLevel.Length > 0 ? f.TaxLevel : null,   // 기본값은 미기록 (세이브 슬림)
            TechPoints = f.TechPoints,
            ActedCharacterIds = f.ActedCharacterIds.Count > 0
                ? f.ActedCharacterIds.OrderBy(x => x, StringComparer.Ordinal).ToList()   // 결정적 직렬화
                : null   // 빈 집합은 미기록 (세이브 슬림)
        }).ToList(),
        // ordinal 정렬 직렬화 — 동일 상태 = 동일 바이트(세이브 §2.7.12, 왕복 비교 단순화).
        Progress = s.Progress.OrderBy(x => x, StringComparer.Ordinal).ToList(),
        FiredCutsceneIds = s.FiredCutsceneIds.OrderBy(x => x, StringComparer.Ordinal).ToList(),
        CharacterOwners = s.CharacterOwners.OrderBy(kv => kv.Key, StringComparer.Ordinal)
            .ToDictionary(kv => kv.Key, kv => kv.Value),
        // 관계도도 ordinal 정렬 직렬화 — 동일 상태 = 동일 바이트 (위 규약과 동형)
        Relations = s.Relations.OrderBy(r => r.PairKey, StringComparer.Ordinal)
            .Select(r => new RelationStateDto
            {
                FactionA = r.FactionA, FactionB = r.FactionB,
                Favor = r.Favor, TruceUntilTurn = r.TruceUntilTurn
            }).ToList(),
        Armies = s.Armies.Select(a => new ArmyDto
        {
            Id = a.Id, FactionId = a.FactionId, LocationNodeId = a.LocationNodeId,
            CommanderId = a.CommanderId, Morale = a.Morale, Supply = a.Supply,
            Units = a.Units.ToDictionary(kv => kv.Key, kv => kv.Value)
        }).ToList(),
        Fleets = s.Fleets.Select(f => new ArmyDto
        {
            Id = f.Id, FactionId = f.FactionId, LocationNodeId = f.LocationNodeId,
            CommanderId = f.CommanderId, Morale = f.Morale, Supply = f.Supply,
            Units = f.Units.ToDictionary(kv => kv.Key, kv => kv.Value)
        }).ToList(),
        Provinces = s.Provinces.Select(p => new ProvinceStateDto
        {
            Id = p.Id,
            Facilities = p.Facilities.ToDictionary(kv => kv.Key, kv => kv.Value),
            PublicOrder = p.PublicOrder,
            Population = p.Population,
            GovernorId = p.GovernorId,
            Commerce = p.Commerce,
            Agriculture = p.Agriculture
        }).ToList()
    };

    private static string ToHex(ulong v) => v.ToString("x16", CultureInfo.InvariantCulture);
    private static ulong ParseHex(string hex) => ulong.Parse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
}
