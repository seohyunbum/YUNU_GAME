namespace WorldConquest.Core.Domain;

/// <summary>레벨업 시 스탯별 성장률. 정수 스케일 ×100 (100 = 레벨당 평균 +1, 120 = ×1.2). 부동소수 금지 (설계문서 §4.4).</summary>
public sealed record GrowthRates(int Ldr, int Str, int Int, int Pol, int Cha, int Nav);
