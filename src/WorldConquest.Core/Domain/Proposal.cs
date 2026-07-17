namespace WorldConquest.Core.Domain;

/// <summary>외교 제안 종류 (외교 설계 E9).</summary>
public enum ProposalKind
{
    Alliance,
    NonAggression,
    Peace
}

/// <summary>
/// 외교 제안 — 상대의 동의가 필요한 행위 (외교 설계 E9).
/// 스펙 §4.2 는 `ProposeAlliance()` 를 명세했으나 구현엔 없었고, FormAlliance 가 상대 동의 없이
/// 일방 호출로 즉시 양측을 체결했다(G8). DiplomacyManager 주석도 "제안/수락 절차는 AI 외교(후속)
/// 에서 확장" 으로 유예해뒀다.
///
/// 핫시트 인간 2인 간에는 여전히 즉시 체결(FormAlliance)을 쓴다 — §1.2 가 '동석 구두 합의' 를
/// 전제하므로 절차가 불필요하다. 제안은 **AI 가 관여할 때**만 쓴다.
///
/// ExpiresOnTurn 까지 유효(포함). AI 순회가 id ordinal 순이라 같은 페이즈에 응답될 수도,
/// 다음 턴에 응답될 수도 있어 최소 1턴은 살아 있어야 한다.
/// </summary>
public sealed class Proposal
{
    public required string From { get; init; }
    public required string To { get; init; }
    public required ProposalKind Kind { get; init; }
    public required int ExpiresOnTurn { get; set; }
}
