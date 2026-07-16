namespace WorldConquest.Core.Domain;

/// <summary>
/// 세력의 진행 중 가변 상태 (세이브 대상, design save-system §4·D4).
/// 정의(색·성향·시작값)는 factions.json 참조 — 여기엔 참조 id 와 가변 값만 둔다.
/// </summary>
public sealed class FactionState
{
    public required string Id { get; init; }            // factions.json 참조 id
    public required string Controller { get; init; }    // human_p1 / human_p2 / ai (핫시트 2인 매핑)
    public required int Treasury { get; set; }
    public required int Food { get; set; }
    public required int TechLevel { get; set; }
    public required List<string> OwnedProvinceIds { get; init; }
    public required Dictionary<string, DiplomaticState> Relations { get; init; }

    /// <summary>이번 턴 동맹 자원 지원 누계 (§1.2 턴당 상한 — additive 세이브, 수입 페이즈에 리셋).</summary>
    public int TransferredGoldThisTurn { get; set; }
    public int TransferredFoodThisTurn { get; set; }
}
