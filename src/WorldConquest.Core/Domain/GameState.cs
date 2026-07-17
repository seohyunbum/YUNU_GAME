namespace WorldConquest.Core.Domain;

/// <summary>
/// 진행 중 전체 가변 게임 상태 (세이브 직렬화 루트 — 설계문서 §4.2, design save-system §4).
/// <para>Load 는 이 객체를 <b>새로 생성</b>한다(D1) — '새 게임 초기화 후 되채움' 금지.
/// required/init 로 필드 누락을 컴파일 타임에 노출한다.</para>
/// <para>필드는 게임플레이 구현과 함께 additive 로 확장한다(가산 필드는 SaveVersion 을 올리지 않음, D2).</para>
/// </summary>
public sealed class GameState
{
    public required int DataSchemaVersion { get; init; }   // 저장 당시 game_rules schema_version (드리프트 감지)
    public required ulong CampaignSeed { get; init; }
    public required int Turn { get; set; }
    public required TurnPhase Phase { get; set; }
    public required string Actor { get; set; }             // 현재 행동 세력 id
    public required RngStreams Rng { get; init; }
    public required List<FactionState> Factions { get; init; }
    public required HashSet<string> Progress { get; init; } // id-set 진행도(D5) — 콘텐츠 삽입 시 마이그레이션 0줄

    /// <summary>부대 목록 (additive — SaveVersion 을 올리지 않음, D2/B-3). 구세이브는 빈 리스트로 로드.</summary>
    public List<Army> Armies { get; init; } = new();

    /// <summary>함대 목록 (additive). 해상 병종만 편성 — 위치는 해역 또는 항구 육상(정박).</summary>
    public List<Fleet> Fleets { get; init; } = new();

    /// <summary>영지 가변 상태(시설 등, additive). 시설 없는 영지는 목록에 없음 — 구세이브 호환.</summary>
    public List<ProvinceState> Provinces { get; init; } = new();

    /// <summary>발동된 컷씬 id-set (§2.7.12 fired=seen — 트리거 시점 기록·not_fired 의 유일 근거, additive).</summary>
    public HashSet<string> FiredCutsceneIds { get; init; } = new();

    /// <summary>캐릭터 소속 (charId → factionId, §2.8 — 미기록 = 재야. 초빙 풀은 여기서 파생, 이중 장부 금지).</summary>
    public Dictionary<string, string> CharacterOwners { get; init; } = new();

    /// <summary>
    /// 쌍 단위 관계도 (외교 E3) — additive, 구세이브는 빈 리스트로 로드(SaveVersion 유지).
    /// 세력별이 아니라 **루트에** 두는 이유: 쌍 상태를 세력별로 쪼개면 양측 이중 장부가 된다.
    /// 쓰기는 RelationLedger 단독 (E5 화이트리스트).
    /// </summary>
    public List<RelationState> Relations { get; init; } = new();

    /// <summary>이 상태가 로드될 때 정규화된 원본 세이브 버전 (신규 게임은 현재 버전).</summary>
    public int MigratedFromVersion { get; init; }
}
