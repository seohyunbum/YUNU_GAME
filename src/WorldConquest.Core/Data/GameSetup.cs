using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>새 캠페인의 초기 <see cref="GameState"/> 생성 — 정의 데이터의 시작값을 가변 상태로 복사한다.</summary>
public static class GameSetup
{
    /// <summary>전 세력 AI 캠페인 — 배치 시뮬(§8) 전용. 인간 플레이어 없음.</summary>
    public static GameState AiCampaign(GameDatabase db, ulong seed)
    {
        var factions = db.Factions.Values.Select(f => new FactionState
        {
            Id = f.Id,
            Controller = "ai",
            Treasury = f.Treasury,
            Food = f.Food,
            TechLevel = f.TechLevel,
            OwnedProvinceIds = f.OwnedProvinceIds.ToList(),
            Relations = new Dictionary<string, DiplomaticState>()
        }).ToList();

        return new GameState
        {
            DataSchemaVersion = DataLoader.SupportedSchemaVersion,
            CampaignSeed = seed,
            Turn = 1,
            Phase = TurnPhase.Income,
            Actor = "",
            Rng = new RngStreams(seed),
            Factions = factions,
            Progress = new HashSet<string>(),
            CharacterOwners = StartOwners(db)
        };
    }

    /// <summary>시작 소속 (§2.8): 세력 리더 + start_characters(추가 시작 무장). 초빙·등용 풀은 미소속 파생.</summary>
    private static Dictionary<string, string> StartOwners(GameDatabase db)
    {
        var owners = new Dictionary<string, string>();
        foreach (var f in db.Factions.Values)
        {
            if (f.LeaderCharacterId is not null) owners[f.LeaderCharacterId] = f.Id;
            foreach (var cid in f.StartCharacterIds) owners[cid] = f.Id;   // 검증에서 중복·존재 보장
        }
        return owners;
    }

    /// <summary>
    /// 새 캠페인. <paramref name="player2FactionId"/> 가 null 이면 1인 플레이(조작자 1명, 나머지 전부 AI).
    /// 지정하면 부자 핫시트 2인. 미지정 세력은 항상 AI 라 <see cref="AIController"/> 가 AiAction 페이즈에서 구동하고,
    /// human_p2 부재 시 Player2Command 페이즈는 <see cref="PlaySession"/> 이 Actor 부재로 자동 스킵한다.
    /// </summary>
    public static GameState NewCampaign(GameDatabase db, ulong seed, string player1FactionId, string? player2FactionId = null)
    {
        if (!db.Factions.ContainsKey(player1FactionId))
            throw new ArgumentException($"존재하지 않는 세력: {player1FactionId}", nameof(player1FactionId));
        if (player2FactionId is not null && !db.Factions.ContainsKey(player2FactionId))
            throw new ArgumentException($"존재하지 않는 세력: {player2FactionId}", nameof(player2FactionId));
        if (player2FactionId == player1FactionId)
            throw new ArgumentException("두 플레이어는 서로 다른 세력이어야 합니다.");

        var factions = db.Factions.Values.Select(f => new FactionState
        {
            Id = f.Id,
            Controller = f.Id == player1FactionId ? "human_p1"
                       : f.Id == player2FactionId ? "human_p2" : "ai",
            Treasury = f.Treasury,
            Food = f.Food,
            TechLevel = f.TechLevel,
            OwnedProvinceIds = f.OwnedProvinceIds.ToList(),
            Relations = new Dictionary<string, DiplomaticState>()
        }).ToList();

        return new GameState
        {
            DataSchemaVersion = DataLoader.SupportedSchemaVersion,
            CampaignSeed = seed,
            Turn = 1,
            Phase = TurnPhase.Income,
            Actor = player1FactionId,
            Rng = new RngStreams(seed),
            Factions = factions,
            Progress = new HashSet<string>(),
            CharacterOwners = StartOwners(db)
        };
    }
}
