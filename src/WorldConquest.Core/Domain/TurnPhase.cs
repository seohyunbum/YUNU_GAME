namespace WorldConquest.Core.Domain;

/// <summary>턴 페이즈 순서 (설계문서 §2.2 [1]~[7]). 저장은 페이즈 경계에서만 허용(세이브 D6).</summary>
public enum TurnPhase
{
    Income,          // [1] 수입 정산
    Player1Command,  // [2] 플레이어1 명령
    Player2Command,  // [3] 플레이어2 명령
    AiAction,        // [4] AI 세력 행동
    Resolution,      // [5] 이동 완료·전투 판정
    Events,          // [6] 이벤트
    VictoryCheck     // [7] 승리 판정
}
