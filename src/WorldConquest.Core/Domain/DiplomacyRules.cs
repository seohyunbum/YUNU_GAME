namespace WorldConquest.Core.Domain;

/// <summary>태도 임계값 (§5.1) — 임계값은 **해당 태도에 포함**(경계 소유, E4).</summary>
public sealed record AttitudeThresholds(int Devoted, int Friendly, int Hostile, int Nemesis);

/// <summary>
/// 조공 상수. FavorCeiling = 조공으로 도달 가능한 Favor **천장** — 캡(턴당 이전 총량)과 다른 장치다.
/// 없으면 금으로 전 세계 우호도를 도배해 외교가 자판기가 된다: 맹우는 행동으로만 도달해야 한다.
/// </summary>
public sealed record TributeRules(int GoldPerFavor, int FoodPerFavor, int FavorCeiling);

/// <summary>계략(이간계) 상수 — 확률은 전부 만분율(0~10000), 정수 산술 (§4.4).</summary>
public sealed record SchemeRules(
    int CostGold,
    int PerTurn,
    int BaseSuccessPermyriad,
    int IntDiffPermyriadPerPoint,
    int SuccessPermyriadMin,
    int SuccessPermyriadMax,
    int DiscordFavor,
    int ExposedFavor);

/// <summary>
/// AI 외교 상수 (§7). 국력비 문턱은 백분율(×100): power(self) &gt; power(t) * WarPowerRatio / 100.
/// DispositionWarFavorDelta 키는 valid_ai_dispositions 와 일치해야 한다(DataLoader 검증).
/// </summary>
public sealed record AiDiplomacyRules(
    int ActionsPerTurn,
    int AllianceFavorMin,
    int NonAggressionFavorMin,
    int WarFavorMax,
    int PeaceFavorMin,
    int MaxAlliances,
    int PowerMetricProvinceWeight,
    int PeacePowerRatio,
    int WarPowerRatio,
    int TributePowerRatio,
    int TargetFavorWeight,
    IReadOnlyDictionary<string, int> DispositionWarFavorDelta);

/// <summary>
/// 외교 상수 (data/config/game_rules.json:diplomacy — 외교 설계 §6.1·§5.4).
/// 스펙 §4.2 가 "관계도 변화" 를 명세해놓고 비워둔 빈칸을 채운다. 전 계수 정수 (§4.4).
/// </summary>
public sealed class DiplomacyRules
{
    public required int FavorMin { get; init; }
    public required int FavorMax { get; init; }
    public required int FavorInitial { get; init; }
    public required AttitudeThresholds Thresholds { get; init; }

    /// <summary>턴당 감쇠 — **음수(적대) 구간에만** 적용 [MUST]. 우호까지 감쇠시키면 AI 동맹이 성립하지 않는다(§5.5).</summary>
    public required int DecayPerTurn { get; init; }

    /// <summary>공동의 적 — 같은 세력과 교전 중인 쌍의 턴당 우호 축적. AI 동맹의 주 엔진(§5.5).</summary>
    public required int CommonEnemyPerTurn { get; init; }

    public required int OnBattleFought { get; init; }
    public required int OnProvinceLost { get; init; }
    public required int OnBloodlessCapture { get; init; }
    public required int OnAllianceFormed { get; init; }
    public required int OnPeaceMade { get; init; }
    public required int OnBetrayal { get; init; }
    public required int OnBetrayalReputation { get; init; }

    public required TributeRules Tribute { get; init; }
    public required SchemeRules Scheme { get; init; }
    public required AiDiplomacyRules Ai { get; init; }

    /// <summary>Favor → 태도 (§5.1). 임계값은 해당 태도에 포함 — 판정 순서가 경계 소유를 정한다.</summary>
    public Attitude AttitudeOf(int favor) =>
        favor <= Thresholds.Nemesis ? Attitude.Nemesis
        : favor <= Thresholds.Hostile ? Attitude.Hostile
        : favor >= Thresholds.Devoted ? Attitude.Devoted
        : favor >= Thresholds.Friendly ? Attitude.Friendly
        : Attitude.Neutral;

    /// <summary>
    /// FavorSource → 고정 델타 (E5 화이트리스트). 미등록 소스는 throw — 데이터 없이 Favor 를
    /// 움직이는 경로를 컴파일·런타임 양쪽에서 막는다.
    /// </summary>
    public int DeltaOf(FavorSource source) => source switch
    {
        FavorSource.BattleFought => OnBattleFought,
        FavorSource.ProvinceLost => OnProvinceLost,
        FavorSource.BloodlessCapture => OnBloodlessCapture,
        FavorSource.AllianceFormed => OnAllianceFormed,
        FavorSource.PeaceMade => OnPeaceMade,
        FavorSource.Betrayal => OnBetrayal,
        FavorSource.BetrayalReputation => OnBetrayalReputation,
        FavorSource.SchemeDiscord => Scheme.DiscordFavor,
        FavorSource.SchemeExposed => Scheme.ExposedFavor,
        FavorSource.CommonEnemy => CommonEnemyPerTurn,
        FavorSource.Decay => DecayPerTurn,
        FavorSource.TributeReceived => throw new ArgumentOutOfRangeException(
            nameof(source), "조공은 금액 비례 — RelationLedger.ApplyTribute 를 쓸 것"),
        _ => throw new ArgumentOutOfRangeException(nameof(source), $"미등록 Favor 소스 (E5 화이트리스트): {source}")
    };
}
