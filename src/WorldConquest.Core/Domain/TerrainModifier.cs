namespace WorldConquest.Core.Domain;

/// <summary>지형별 전투·이동 보정 (설계문서 §2.6 육상전).</summary>
public sealed record TerrainModifier(string Id, string NameKo, double AtkMod, double DefMod, int MoveCost);
