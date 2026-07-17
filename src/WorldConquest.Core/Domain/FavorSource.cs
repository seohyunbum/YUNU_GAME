namespace WorldConquest.Core.Domain;

/// <summary>
/// 관계도(Favor) 변동 소스 **화이트리스트** [MUST] (외교 설계 E5).
/// Favor 는 <c>RelationLedger.Apply(a, b, FavorSource)</c> 로만 변한다 — 이 열거에 없는 이유로
/// Favor 를 쓰는 코드는 리젝. 천명 수입원 화이트리스트(§2.8.3)의 동형 적용으로, 수치 인플레
/// 경로를 열거로 봉인하고 밸런스 추적성을 확보한다.
/// 각 소스의 실제 수치는 전부 data/config/game_rules.json:diplomacy (§5 하드코딩 금지).
/// </summary>
public enum FavorSource
{
    BattleFought,        // 전투 발생 — 공격자 ↔ 병력을 낸 모든 방어 세력 (§5.2: 방어측은 단일 세력이 아니다)
    ProvinceLost,        // 영지 피탈 — 공격자 ↔ 소유자만
    BloodlessCapture,    // 무혈 점령당함
    TributeReceived,     // 조공 수령 — 금액 비례라 RelationLedger.ApplyTribute 전용
    AllianceFormed,      // 동맹 체결
    PeaceMade,           // 종전
    Betrayal,            // 동맹 중 선전포고 — 배신자 ↔ 피배신자
    BetrayalReputation,  // 배신의 국제적 대가 — 배신자 ↔ 제3국 전체
    SchemeDiscord,       // 이간계 성공 — 대상 두 세력
    SchemeExposed,       // 이간계 발각 — 시전자 ↔ 각 대상
    CommonEnemy,         // 공동의 적 — 같은 세력과 교전 중인 쌍 (AI 동맹의 주 엔진, §5.5)
    Decay                // 시간 감쇠 — **음수(적대) 구간에만** 적용 [MUST] (§5.2·§5.5)
}
