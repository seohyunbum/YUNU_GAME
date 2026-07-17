namespace WorldConquest.Core.Data;

/// <summary>
/// UE5 클라이언트 API 계약 DTO — **계약의 정본** (ue5-client-design §2.1 [MUST]).
/// 클라이언트는 이 타입들의 직렬화 형태(snake_case)를 소비만 한다. 필드는 additive 로만 확장하고,
/// 제거·의미 변경 시 <see cref="ApiProtocol.Version"/> 을 올린다 (기동 핸드셰이크로 스큐 검출).
/// </summary>
public static class ApiProtocol
{
    public const int Version = 1;
}

/// <summary>전체 상태 스냅샷 — 세밀 RPC 대신 스냅샷 모델 (턴제라 비용 무시 가능).</summary>
public sealed record StateSnapshot(
    int ProtocolVersion,
    string CampaignId,
    int Turn,
    string Phase,
    string? PendingActor,          // 입력 대기 세력 id (게임 종료 시 null)
    IReadOnlyList<string>? Winners, // 게임 종료 시에만
    List<FactionView> Factions,
    List<ProvinceOwnershipView> Provinces,
    List<ForceView> Armies,
    List<ForceView> Fleets,
    Dictionary<string, string> CharacterOwners,
    long EventCursor);             // 저널 말단 — 클라 재동기 기준점

public sealed record FactionView(
    string Id, string Controller,
    int Treasury, int Food, int TechLevel, int Mandate, int PityCount,
    List<string> OwnedProvinceIds,
    Dictionary<string, string> Relations,   // 상대 세력 id → war|alliance|peace
    string TaxLevel = "normal",             // 세율 단계 (§2.3.1, additive)
    int TechPoints = 0);                    // 기술 포인트 누적 (additive)

/// <summary>
/// 영지 가변 상태 — 소유·시설·내정(민심·인구·태수). 정의(이름·좌표·생산)는 /api/static 쪽.
/// 내정 필드는 additive (§2.3.1) — 구 클라이언트는 무시, 신 클라이언트는 도시 화면에 표시.
/// </summary>
public sealed record ProvinceOwnershipView(
    string Id, string? OwnerFactionId, Dictionary<string, int> Facilities,
    int PublicOrder = 0, int Population = 0, string? GovernorId = null);

public sealed record ForceView(
    string Id, string FactionId, string Location, string? CommanderId,
    int Morale, Dictionary<string, int> Units, int TotalTroops);

/// <summary>이벤트 저널 항목 — seq 는 캠페인 내 단조 증가 (유실 감지·재동기의 근거).</summary>
public sealed record EventView(long Seq, string Type, Dictionary<string, string> Data);

/// <summary>명령 실행 응답. Status: ok | error | need_input(예약 — 향후 전투 중 상호작용).</summary>
public sealed record CommandResult(
    string Status,
    string Message,
    List<EventView> Events,        // 이 명령으로 새로 발생한 저널 구간
    StateSnapshot State);
