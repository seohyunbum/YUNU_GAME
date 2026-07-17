namespace WorldConquest.Core.Domain;

/// <summary>
/// 세력의 진행 중 가변 상태 (세이브 대상, design save-system §4·D4).
/// 정의(색·성향·시작값)는 factions.json 참조 — 여기엔 참조 id 와 가변 값만 둔다.
/// </summary>
public sealed class FactionState
{
    public required string Id { get; init; }            // factions.json 참조 id
    public required string Controller { get; init; }    // human_p1 / human_p2 / ai (핫시트 2인 매핑)
    public required int Treasury { get; set; }
    public required int Food { get; set; }
    public required int TechLevel { get; set; }
    public required List<string> OwnedProvinceIds { get; init; }
    public required Dictionary<string, DiplomaticState> Relations { get; init; }

    /// <summary>이번 턴 동맹 자원 지원 누계 (§1.2 턴당 상한 — additive 세이브, 수입 페이즈에 리셋).</summary>
    public int TransferredGoldThisTurn { get; set; }
    public int TransferredFoodThisTurn { get; set; }

    /// <summary>천명 잔고 (§2.8 초빙 전용 재화 — 실물 과금 절대 없음 [MUST]. additive 세이브).</summary>
    public int Mandate { get; set; }

    /// <summary>5성 미획득 누적 뽑기 수 — soft/hard pity 근거 (§2.8.6. additive 세이브).</summary>
    public int PityCount { get; set; }

    /// <summary>이번 턴 초빙 횟수 (max_summons_per_turn 캡. 수입 페이즈 리셋).</summary>
    public int SummonsThisTurn { get; set; }

    /// <summary>이번 턴 등용 시도 횟수 (§2.8 recruit — recruit_general.max_per_turn 캡. 수입 페이즈 리셋. additive 세이브).</summary>
    public int RecruitsThisTurn { get; set; }

    /// <summary>이번 턴 탐색 시도 횟수 (§2.8 search — search.max_per_turn 캡. 수입 페이즈 리셋. additive 세이브).</summary>
    public int SearchesThisTurn { get; set; }

    /// <summary>세율 단계 id (§2.3 — internal_affairs.tax_levels 키). 빈 값·미인식 = 기본 세율 해석 (additive 세이브).</summary>
    public string TaxLevel { get; set; } = "";

    /// <summary>기술 포인트 누적 (§2.3 기술 — 학당 + 태수 지력. 임계 도달 시 TechLevel 상승. additive 세이브).</summary>
    public int TechPoints { get; set; }

    /// <summary>이번 턴 파견 행동을 마친 무장 id (§2.3.2 — 무장 1명 턴당 1회: 개발·징병·등용·탐색. 수입 페이즈 리셋. additive 세이브).</summary>
    public HashSet<string> ActedCharacterIds { get; init; } = new();
}
