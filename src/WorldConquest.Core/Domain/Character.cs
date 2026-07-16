namespace WorldConquest.Core.Domain;

/// <summary>
/// 무장 1명 (설계문서 §4.2). 파생 클래스 금지 — 캐릭터 간 차이는 전부 데이터(스탯·스킬·고유병종)로 표현한다.
/// </summary>
public sealed class Character
{
    public string Id { get; }
    public string NameKo { get; }
    public string Origin { get; }
    public int Rarity { get; }
    public CharacterStats Stats { get; }
    public GrowthRates Growth { get; }
    public string PassiveSkillId { get; }
    public string UltimateSkillId { get; }
    public string? UniqueUnitId { get; }
    public string StartFaction { get; }
    public string VoiceSet { get; }
    public string PortraitAsset { get; }

    public int Level { get; private set; } = 1;
    public int Exp { get; private set; }
    public int Loyalty { get; set; } = 100;

    private readonly int _statMax;
    private readonly int _levelCap;
    private readonly int _expCurveBase;

    public Character(
        string id, string nameKo, string origin, int rarity,
        CharacterStats stats, GrowthRates growth,
        string passiveSkillId, string ultimateSkillId, string? uniqueUnitId,
        string startFaction, string voiceSet, string portraitAsset,
        int statMax = 120, int levelCap = 50, int expCurveBase = 100)
    {
        Id = id;
        NameKo = nameKo;
        Origin = origin;
        Rarity = rarity;
        Stats = stats;
        Growth = growth;
        PassiveSkillId = passiveSkillId;
        UltimateSkillId = ultimateSkillId;
        UniqueUnitId = uniqueUnitId;
        StartFaction = startFaction;
        VoiceSet = voiceSet;
        PortraitAsset = portraitAsset;
        _statMax = statMax;
        _levelCap = levelCap;
        _expCurveBase = expCurveBase;
    }

    /// <summary>다음 레벨까지 필요한 경험치. 레벨에 비례해 증가.</summary>
    public int ExpToNextLevel => _expCurveBase * Level;

    /// <summary>
    /// 경험치 획득 → 레벨업 처리. 성장은 floor(L*g) - floor((L-1)*g) 방식으로
    /// 부동소수 누적 오차 없이 결정적으로 계산한다 (시드 재현성 원칙, 설계문서 §4.4).
    /// </summary>
    public void GainExp(int amount)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount), "경험치는 음수가 될 수 없습니다.");
        if (Level >= _levelCap) return;

        Exp += amount;
        while (Level < _levelCap && Exp >= ExpToNextLevel)
        {
            Exp -= ExpToNextLevel;
            Level++;
            ApplyGrowth(Level);
        }
        if (Level >= _levelCap) Exp = 0;
    }

    private void ApplyGrowth(int newLevel)
    {
        Stats.Ldr = Grow(Stats.Ldr, Growth.Ldr, newLevel);
        Stats.Str = Grow(Stats.Str, Growth.Str, newLevel);
        Stats.Int = Grow(Stats.Int, Growth.Int, newLevel);
        Stats.Pol = Grow(Stats.Pol, Growth.Pol, newLevel);
        Stats.Cha = Grow(Stats.Cha, Growth.Cha, newLevel);
        Stats.Nav = Grow(Stats.Nav, Growth.Nav, newLevel);
    }

    // rate100 = 성장률 정수 스케일 ×100 (120 = ×1.2). 정수 나눗셈은 rate100 ≥ 0 에서 floor 와 동일하므로
    // 부동소수 없이 floor(L*g) - floor((L-1)*g) 를 그대로 재현한다 (설계문서 §4.4 결정론).
    private int Grow(int current, int rate100, int newLevel)
    {
        var gain = (int)((long)newLevel * rate100 / 100 - (long)(newLevel - 1) * rate100 / 100);
        return Math.Min(current + gain, _statMax);
    }
}
