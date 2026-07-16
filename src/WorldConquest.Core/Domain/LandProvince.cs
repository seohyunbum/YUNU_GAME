namespace WorldConquest.Core.Domain;

/// <summary>육상 영지. 내정(생산·시설·방어)의 대상 (설계문서 §5.3).</summary>
public sealed class LandProvince : Province
{
    public string Terrain { get; }
    public int Population { get; internal set; }
    public ResourceYield BaseProduction { get; }
    public int FacilitySlots { get; }
    public int DefenseLevel { get; internal set; }
    public bool Port { get; }
    public string Climate { get; }

    public LandProvince(
        string id, string nameKo, string region, IReadOnlyList<string> adjacent,
        string terrain, int population, ResourceYield baseProduction,
        int facilitySlots, int defenseLevel, bool port, string climate)
        : base(id, nameKo, region, adjacent)
    {
        Terrain = terrain;
        Population = population;
        BaseProduction = baseProduction;
        FacilitySlots = facilitySlots;
        DefenseLevel = defenseLevel;
        Port = port;
        Climate = climate;
    }

    /// <summary>
    /// 1턴 생산량. Phase 0에서는 기본 생산량만 반환한다.
    /// 시설·민심·담당관 보정은 Phase 1(내정 시스템)에서 이 메서드를 확장한다.
    /// </summary>
    public ResourceYield Produce() => BaseProduction;
}
