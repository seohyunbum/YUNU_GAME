namespace WorldConquest.Core.Domain;

/// <summary>
/// 쌍(pair) 단위 관계 레코드 — 런타임·세이브 정본 (외교 설계 E2·E3).
/// Favor 는 **대칭 단일값**이다: favor(a,b) == favor(b,a). 세력별 Dictionary 로 쪼개면 양측
/// 이중 장부가 되어 동기화 버그의 원천이 되고, AIController 가 관계를 단방향(자기 시점)으로만
/// 조회하는 현 구조와 결합하면 즉시 오독한다.
///
/// FactionA/FactionB 를 **필드로** 들고 있는 이유 [MUST]: PairKey 문자열만 저장하면 세이브
/// fail-soft 프루닝(D9)이 "{a}+{b}" 를 역파싱해야 하는데, 세력 id 에 '+' 가 없다는 보장이 없다
/// (ValidateFactions 에 id 문자 제약 없음). 기존 Relations 프루닝은 Dictionary 키가 곧 세력 id 라
/// 파싱이 불필요했다 — 동형이 되려면 두 id 를 직접 들고 있어야 한다.
/// </summary>
public sealed class RelationState
{
    /// <summary>Canonical 정렬(ordinal)의 앞 세력 id.</summary>
    public required string FactionA { get; init; }

    /// <summary>Canonical 정렬(ordinal)의 뒤 세력 id.</summary>
    public required string FactionB { get; init; }

    /// <summary>관계도 — diplomacy.favor_min ~ favor_max 로 clamp. 초기 favor_initial.</summary>
    public required int Favor { get; set; }

    /// <summary>정전 쿨다운 만료 턴 (미사용 시 null) — 종전 후 즉시 재선포 억제용 확장 지점.</summary>
    public int? TruceUntilTurn { get; set; }

    /// <summary>정렬 직렬화·프루닝 고지용 파생 키 — 저장하지 않는다.</summary>
    public string PairKey => $"{FactionA}+{FactionB}";
}
