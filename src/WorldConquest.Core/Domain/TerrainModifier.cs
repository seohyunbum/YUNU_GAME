namespace WorldConquest.Core.Domain;

/// <summary>지형별 전투·이동 보정 (설계문서 §2.6 육상전). AtkMod/DefMod 는 정수 스케일 ×100 (30 = +0.30). §4.4.</summary>
public sealed record TerrainModifier(string Id, string NameKo, int AtkMod, int DefMod, int MoveCost);
