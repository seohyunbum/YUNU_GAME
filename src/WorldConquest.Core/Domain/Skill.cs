namespace WorldConquest.Core.Domain;

/// <summary>
/// 스킬 정의 (설계문서 §5.2). 효과는 EffectType 조합으로 데이터 정의 —
/// 캐릭터별 분기 하드코딩 금지 [MUST]. 효과 해석기(SkillSystem)는 Phase 2.
/// </summary>
public sealed class Skill
{
    public string Id { get; }
    public string NameKo { get; }
    /// <summary>"passive" | "ultimate"</summary>
    public string Type { get; }
    public int GaugeCost { get; }
    public string? CutsceneId { get; }
    public IReadOnlyList<SkillCondition> Conditions { get; }
    public IReadOnlyList<SkillEffect> Effects { get; }

    public Skill(string id, string nameKo, string type, int gaugeCost, string? cutsceneId,
        IReadOnlyList<SkillCondition> conditions, IReadOnlyList<SkillEffect> effects)
    {
        Id = id;
        NameKo = nameKo;
        Type = type;
        GaugeCost = gaugeCost;
        CutsceneId = cutsceneId;
        Conditions = conditions;
        Effects = effects;
    }
}

/// <summary>스킬 발동 조건 (예: battle_domain=naval).</summary>
public sealed record SkillCondition(string Type, string Value);

/// <summary>스킬 효과 1건. 효과 타입별로 사용하는 필드가 다르다 (§5.2 EffectType 조합 방식).</summary>
public sealed record SkillEffect(
    string Type,
    string Target,
    int? Power = null,
    string? ScalingStat = null,
    string? Stat = null,
    int? Amount = null,
    int? DurationTurns = null,
    string? UnitId = null,
    int? AbsorbAmount = null);
