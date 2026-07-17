namespace WorldConquest.Core.Domain;

/// <summary>
/// 관계도(Favor) 구간의 파생 표현형 (외교 설계 E4). 저장하지 않는다 — 단일 진실원은 Favor.
/// 임계값은 해당 태도에 포함(경계 소유): favor == nemesis 면 Nemesis, favor == devoted 면 Devoted.
/// </summary>
public enum Attitude
{
    Nemesis,    // 숙적 — 최우선 표적. 동맹·불가침 제안 거부
    Hostile,    // 적대 — 선전포고 검토
    Neutral,    // 중립 — 기회주의(약하면 친다)
    Friendly,   // 우호 — 불가침 제안, 공격 회피
    Devoted     // 맹우 — 동맹 제안·유지, 공격 후보에서 제외
}
