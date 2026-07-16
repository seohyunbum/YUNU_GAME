namespace WorldConquest.Core.Domain;

/// <summary>
/// 영지의 진행 중 가변 상태 (세이브 대상). 정의(인구·기본생산·슬롯)는 world_map.json 참조 (세이브 D4).
/// Phase 1 은 시설 레벨만 — 인구 감소 등은 이후 확장.
/// </summary>
public sealed class ProvinceState
{
    public required string Id { get; init; }                    // world_map.json 노드 참조
    public required Dictionary<string, int> Facilities { get; init; }   // 시설 종류 → 레벨
}
