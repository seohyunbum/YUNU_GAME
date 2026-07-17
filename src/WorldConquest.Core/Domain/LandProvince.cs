namespace WorldConquest.Core.Domain;

/// <summary>육상 영지. 내정(개발·시설·방어)의 대상 (설계문서 §5.3·§2.3.2).</summary>
public sealed class LandProvince : Province
{
    public string Terrain { get; }
    public int Population { get; internal set; }
    public ResourceYield BaseProduction { get; }   // 무개발 기본 수입 floor (§2.3.2)
    public int FacilitySlots { get; }
    public int DefenseLevel { get; internal set; }
    public bool Port { get; }
    public string Climate { get; }

    /// <summary>상업 개발 상한 — 거점 특성별 (§2.3.2). 금 수입의 주 동력 ceiling.</summary>
    public int CommerceMax { get; }
    /// <summary>농업 개발 상한 — 거점 특성별. 식량 수입의 주 동력 ceiling.</summary>
    public int AgricultureMax { get; }

    public LandProvince(
        string id, string nameKo, string region, IReadOnlyList<string> adjacent,
        string terrain, int population, ResourceYield baseProduction,
        int facilitySlots, int defenseLevel, bool port, string climate,
        int commerceMax, int agricultureMax)
        : base(id, nameKo, region, adjacent)
    {
        Terrain = terrain;
        Population = population;
        BaseProduction = baseProduction;
        FacilitySlots = facilitySlots;
        DefenseLevel = defenseLevel;
        Port = port;
        Climate = climate;
        CommerceMax = commerceMax;
        AgricultureMax = agricultureMax;
    }

    /// <summary>무개발 기본 수입 (§2.3.2 floor). 개발 수치(상업·농업)는 ProvinceState 에서 별도 가산.</summary>
    public ResourceYield Produce() => BaseProduction;
}
