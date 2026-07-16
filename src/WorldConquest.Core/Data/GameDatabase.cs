using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// 검증 완료된 게임 정의 데이터의 인메모리 캐시 (설계문서 §4.2 DataLoader 산출물).
/// 정의 데이터(불변)만 담는다 — 진행 중 게임 상태(세력 자원 변동 등)는 Phase 1 GameState 책임.
/// </summary>
public sealed class GameDatabase
{
    public required GameRules Rules { get; init; }
    public required IReadOnlyDictionary<string, Character> Characters { get; init; }
    public required IReadOnlyDictionary<string, Skill> Skills { get; init; }
    public required IReadOnlyDictionary<string, UnitType> Units { get; init; }
    public required IReadOnlyDictionary<string, TerrainModifier> TerrainModifiers { get; init; }
    public required IReadOnlyDictionary<string, Faction> Factions { get; init; }
    public required WorldMap Map { get; init; }
}
