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
            Progress = new HashSet<string>()
        };
    }

    public static GameState NewCampaign(GameDatabase db, ulong seed, string player1FactionId, string player2FactionId)
    {
        if (!db.Factions.ContainsKey(player1FactionId))
            throw new ArgumentException($"존재하지 않는 세력: {player1FactionId}", nameof(player1FactionId));
        if (!db.Factions.ContainsKey(player2FactionId))
            throw new ArgumentException($"존재하지 않는 세력: {player2FactionId}", nameof(player2FactionId));
        if (player1FactionId == player2FactionId)
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
            Progress = new HashSet<string>()
        };
    }
}
