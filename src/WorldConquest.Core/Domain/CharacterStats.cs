namespace WorldConquest.Core.Domain;

/// <summary>캐릭터 6대 스탯 (설계문서 §2.4). 범위 검증은 DataLoader, 상한 클램프는 Character가 담당.</summary>
public sealed class CharacterStats
{
    public int Ldr { get; internal set; }
    public int Str { get; internal set; }
    public int Int { get; internal set; }
    public int Pol { get; internal set; }
    public int Cha { get; internal set; }
    public int Nav { get; internal set; }

    public CharacterStats(int ldr, int str, int @int, int pol, int cha, int nav)
    {
        Ldr = ldr;
        Str = str;
        Int = @int;
        Pol = pol;
        Cha = cha;
        Nav = nav;
    }
}
