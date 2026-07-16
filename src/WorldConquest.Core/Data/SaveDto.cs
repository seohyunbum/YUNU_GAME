using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

// 세이브 역직렬화 전용 DTO — 전 필드 nullable 로 받고 Normalize 가 새 GameState 를 조립한다(세이브 D2).
// ulong(seed·rng 상태)은 언어중립(§4.4)·JS 정밀도 안전을 위해 hex 문자열로 표현한다.

internal sealed class SaveDto
{
    public int? SaveVersion { get; set; }
    public int? MigratedFromVersion { get; set; }
    public int? DataSchemaVersion { get; set; }
    public string? CampaignSeed { get; set; }          // hex
    public int? Turn { get; set; }
    public TurnPhase? Phase { get; set; }
    public string? Actor { get; set; }
    public Dictionary<string, RngStreamDto>? RngStreams { get; set; }
    public List<FactionStateDto>? Factions { get; set; }
    public List<string>? Progress { get; set; }
}

internal sealed class RngStreamDto
{
    public string? State { get; set; }   // hex
    public string? Inc { get; set; }     // hex
}

internal sealed class FactionStateDto
{
    public string? Id { get; set; }
    public string? Controller { get; set; }
    public int? Treasury { get; set; }
    public int? Food { get; set; }
    public int? TechLevel { get; set; }
    public List<string>? OwnedProvinceIds { get; set; }
    public Dictionary<string, DiplomaticState>? Relations { get; set; }
}
