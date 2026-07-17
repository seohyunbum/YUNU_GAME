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
    public List<ArmyDto>? Armies { get; set; }
    public List<ArmyDto>? Fleets { get; set; }   // 함대 — Army 와 동일 형태(MilitaryForce)
    public List<ProvinceStateDto>? Provinces { get; set; }
    public List<string>? FiredCutsceneIds { get; set; }   // §2.7.12 fired=seen (additive)
    public Dictionary<string, string>? CharacterOwners { get; set; }   // §2.8 캐릭터 소속 (additive)
    public List<RelationStateDto>? Relations { get; set; }   // 외교 관계도 — 쌍 단위 (additive, E3)
}

/// <summary>쌍 단위 관계도 (외교 E3). PairKey 는 파생값이라 저장하지 않는다 — 두 id 를 직접 들고 있어야
/// D9 프루닝이 "{a}+{b}" 역파싱 없이 동작한다(세력 id 문자 제약이 없으므로).</summary>
internal sealed class RelationStateDto
{
    public string? FactionA { get; set; }
    public string? FactionB { get; set; }
    public int? Favor { get; set; }
    public int? TruceUntilTurn { get; set; }
}

internal sealed class ProvinceStateDto
{
    public string? Id { get; set; }
    public Dictionary<string, int>? Facilities { get; set; }
    public int? PublicOrder { get; set; }     // 민심 (§2.3, additive)
    public int? Population { get; set; }      // 현재 인구 (additive — null=정의값)
    public string? GovernorId { get; set; }   // 태수 (additive)
    public int? Commerce { get; set; }        // 상업 개발 수치 (§2.3.2, additive — null=시작값)
    public int? Agriculture { get; set; }     // 농업 개발 수치 (§2.3.2, additive — null=시작값)
}

internal sealed class ArmyDto
{
    public string? Id { get; set; }
    public string? FactionId { get; set; }
    public string? LocationNodeId { get; set; }
    public string? CommanderId { get; set; }
    public int? Morale { get; set; }
    public int? Supply { get; set; }
    public Dictionary<string, int>? Units { get; set; }   // 병종 id → 병력 수 (병종은 정의 참조)
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
    public int? TransferredGoldThisTurn { get; set; }   // 동맹 지원 턴당 누계 (additive)
    public int? TransferredFoodThisTurn { get; set; }
    public int? Mandate { get; set; }            // 천명 (§2.8, additive)
    public int? PityCount { get; set; }          // 5성 천장 카운터
    public int? SummonsThisTurn { get; set; }
    public int? RecruitsThisTurn { get; set; }   // 등용 턴당 시도 (§2.8, additive)
    public int? SearchesThisTurn { get; set; }   // 탐색 턴당 시도 (§2.8 search, additive)
    public string? TaxLevel { get; set; }        // 세율 단계 (§2.3, additive)
    public int? TechPoints { get; set; }         // 기술 포인트 (§2.3, additive)
    public List<string>? ActedCharacterIds { get; set; }   // 이번 턴 파견 소진 무장 (§2.3.2, additive)
    public int? SchemesThisTurn { get; set; }    // 계략 턴당 캡 (외교 §5.4, additive)
}
