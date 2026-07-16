namespace WorldConquest.Core.Domain;

/// <summary>레벨업 시 스탯별 성장률. 1.0 = 레벨당 평균 +1.</summary>
public sealed record GrowthRates(double Ldr, double Str, double Int, double Pol, double Cha, double Nav);
