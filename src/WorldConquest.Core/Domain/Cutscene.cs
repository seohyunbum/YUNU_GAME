namespace WorldConquest.Core.Domain;

/// <summary>컷씬 트리거 조건 1건 (§2.7.5 — EffectType 패턴 동형 DSL).</summary>
public sealed record CutsceneCondition(string Type, string? Field, string? Op, string? Value, int? Permyriad);

/// <summary>Core 소비 컷씬 트리거 (§5.7 cutscene_triggers.json — script·에셋은 Presentation 파일).</summary>
public sealed record CutsceneTrigger(
    string Id,
    string Category,
    string OnEvent,
    IReadOnlyList<CutsceneCondition> Conditions,
    int Priority,
    string OncePer);   // "save" (v1)

/// <summary>연출 비트 1건 (§5.7 — T0 SSOT. 하위 티어는 모르는 비트 무시).</summary>
public sealed record CutsceneBeat(string Beat, string? TextKo, string? SpeakerRef, string? Text);

/// <summary>Presentation 소비 컷씬 스크립트 (§5.7 cutscene_scripts.json).</summary>
public sealed record CutsceneScript(
    string Id,
    string? TitleKo,
    string? TitleCardText,
    IReadOnlyList<CutsceneBeat> Script,
    IReadOnlyList<CutsceneBeat> ShortScript);
