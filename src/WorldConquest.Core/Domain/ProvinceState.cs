namespace WorldConquest.Core.Domain;

/// <summary>
/// 영지의 진행 중 가변 상태 (세이브 대상). 정의(인구·기본생산·슬롯)는 world_map.json 참조 (세이브 D4).
/// 신규 필드는 additive (SaveVersion 불변, D2) — null 은 "정의/기본값 사용" 의미라 구세이브 호환.
/// </summary>
public sealed class ProvinceState
{
    public required string Id { get; init; }                    // world_map.json 노드 참조
    public required Dictionary<string, int> Facilities { get; init; }   // 시설 종류 → 레벨

    /// <summary>민심 0~100 (§2.3). null = 기본값(internal_affairs.po_initial).</summary>
    public int? PublicOrder { get; set; }

    /// <summary>현재 인구. null = 정의값(world_map population). 징병 소모·민심 비례 회복 (§2.3).</summary>
    public int? Population { get; set; }

    /// <summary>파견된 태수(무장 id). 정치→생산·건설, 매력→민심·징병, 지력→기술 (§2.3 태수).</summary>
    public string? GovernorId { get; set; }

    /// <summary>상업 개발 수치 (§2.3.2). null = 시작값(commerce_max×start_pct). 금 수입의 주 동력, 거점별 max 상한.</summary>
    public int? Commerce { get; set; }

    /// <summary>농업 개발 수치 (§2.3.2). null = 시작값(agriculture_max×start_pct). 식량 수입의 주 동력, 거점별 max 상한.</summary>
    public int? Agriculture { get; set; }
}
