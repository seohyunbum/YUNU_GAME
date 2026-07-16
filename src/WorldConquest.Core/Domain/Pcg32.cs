namespace WorldConquest.Core.Domain;

/// <summary>
/// 상태 직렬화 가능 결정론 PRNG (PCG XSH-RR 32/64) — 설계문서 §4.4·§2.7.3·세이브 D8/D10.
/// System.Random 은 내부 상태 직렬화가 불가해 세이브→로드 스트림 연속성이 깨지므로 직접 구현한다
/// (§4.1 외부 패키지 금지 — 레이어 게이트가 강제). (state, inc) 만으로 완전 복원된다.
/// </summary>
public sealed class Pcg32
{
    private const ulong Mult = 6364136223846793005UL;

    private ulong _state;
    private readonly ulong _inc;

    /// <summary>seed + 스트림 시퀀스(seq)로 초기화 (표준 PCG seeding).</summary>
    public Pcg32(ulong seed, ulong seq = 0)
    {
        unchecked
        {
            _state = 0UL;
            _inc = (seq << 1) | 1UL;      // inc 는 항상 홀수
            NextUInt32();
            _state += seed;
            NextUInt32();
        }
    }

    private Pcg32(ulong state, ulong inc, bool _)
    {
        _state = state;
        _inc = inc | 1UL;                 // inc 홀수 불변식 보존
    }

    /// <summary>세이브에서 (state, inc) 로 정확 복원.</summary>
    public static Pcg32 FromState(ulong state, ulong inc) => new(state, inc, true);

    public ulong State => _state;
    public ulong Inc => _inc;

    public uint NextUInt32()
    {
        unchecked
        {
            var old = _state;
            _state = old * Mult + _inc;
            var xorshifted = (uint)(((old >> 18) ^ old) >> 27);
            var rot = (int)(old >> 59);
            return (xorshifted >> rot) | (xorshifted << ((-rot) & 31));
        }
    }

    /// <summary>[0, bound) 균등 정수 (bound ≥ 1). 모듈로 편향 제거(rejection sampling).</summary>
    public int NextInt(int bound)
    {
        if (bound <= 0) throw new ArgumentOutOfRangeException(nameof(bound), "bound는 1 이상이어야 합니다.");
        unchecked
        {
            var b = (uint)bound;
            var threshold = (0u - b) % b;   // (2^32 - b) % b = 2^32 % b (uint wrap)
            while (true)
            {
                var r = NextUInt32();
                if (r >= threshold) return (int)(r % b);
            }
        }
    }
}
