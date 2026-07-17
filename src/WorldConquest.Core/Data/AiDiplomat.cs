using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// AI 1세력의 외교 의사결정 (외교 설계 §7·E11).
///
/// 없던 것을 만든다: 기존 AIController 는 Relations 를 **읽기 전용 필터로만** 썼고(쓰기 0건)
/// DiplomacyManager 를 참조조차 하지 않았다 — 즉 국제정치가 존재하지 않았다. AI 가 인간을
/// 편애한 적은 없다(Controller 참조 1곳). "다 나만 노린다" 는 체감의 진짜 원인은 ①목표 선정이
/// '가장 약한 인접 영지' 단일 축이라 초반 최약체에게 쇄도 ②Neutral 이 곧 공격 허용(만인 대 만인)
/// ③AI 가 외교를 못함. 이 클래스가 ③을, §7.3 스코어가 ①을, 관계도가 ②를 푼다.
///
/// **순수 결정적 [MUST]** (E11) — 난수를 쓰지 않는다. AIController 의 계약이 "난수 없이
/// 결정적(ordinal 순회)이라 시드 리플레이(§8)와 자동 정합" 이라, 여기에 난수를 넣으면 골든
/// 리플레이가 전부 무효가 된다. 확률이 필요한 것은 계략 판정뿐이고 그건 무상태 해시 파생이다.
///
/// **행위-major 순회 [MUST]** (§7.2) — 세력-major(대상마다 전 행위 검사)로 짜면 행 번호가
/// 우선순위 의미를 잃고 실질 우선순위가 '대상 id ordinal' 이 되며, 무엇보다 **계략은 대상이
/// 단수가 아니라 (A,B) 쌍**이라 대상 루프에 구조적으로 들어가지 못한다.
/// </summary>
public sealed class AiDiplomat
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly DiplomacyManager _dip;
    private readonly SchemeSystem _scheme;
    private readonly RelationLedger _led;
    private readonly AiDiplomacyRules _r;
    private readonly DiplomacyRules _d;

    public AiDiplomat(GameState state, GameDatabase db, EventBus? bus = null)
    {
        _state = state;
        _db = db;
        _dip = new DiplomacyManager(state, db, bus);
        _scheme = new SchemeSystem(state, db, bus);
        _led = new RelationLedger(state, db);
        _d = db.Rules.Diplomacy;
        _r = _d.Ai;
    }

    private enum Act { Respond, Peace, GrowTribute, Alliance, NonAggression, AppeaseTribute, Scheme, War }

    /// <summary>
    /// 성향별 행위 우선순위 — **순열**이다(§7.2). 순서 재배치는 수치가 아니라 규칙이므로 코드에 둔다;
    /// 수치인 문턱 델타만 데이터(disposition_war_favor_delta).
    /// Respond 는 항상 최우선이며 행동 예산에 포함되지 않는다(응답 불능 = 제안 사문화).
    /// </summary>
    private static Act[] Order(string disposition) => disposition switch
    {
        // 공격적: 조공으로 돈 쓰지 않는다 — 문턱 완화는 데이터 델타로.
        "aggressive" => new[] { Act.Peace, Act.Alliance, Act.NonAggression, Act.Scheme, Act.War },
        // 방어적: 불가침·조공으로 전쟁을 회피한다.
        "defensive" => new[] { Act.Peace, Act.NonAggression, Act.AppeaseTribute, Act.GrowTribute, Act.Alliance, Act.Scheme, Act.War },
        // 팽창형: 계략을 선호한다.
        "expansionist" => new[] { Act.Peace, Act.Scheme, Act.GrowTribute, Act.Alliance, Act.NonAggression, Act.AppeaseTribute, Act.War },
        _ => new[] { Act.Peace, Act.GrowTribute, Act.Alliance, Act.NonAggression, Act.AppeaseTribute, Act.Scheme, Act.War }
    };

    /// <summary>AI 1세력의 외교 턴. 첫 매칭 1건만 실행하고 종료 (actions_per_turn).</summary>
    public void Decide(FactionState self)
    {
        var def = _db.Factions[self.Id];
        RespondToIncoming(self);   // 예산 밖 — 최우선

        var budget = _r.ActionsPerTurn;
        foreach (var act in Order(def.AiDisposition))
        {
            if (budget <= 0) return;
            if (TryAct(self, def, act)) budget--;
        }
    }

    /// <summary>0행: 수신 제안 응답 — 수락 조건은 전부 데이터 문턱 (§7.2).</summary>
    private void RespondToIncoming(FactionState self)
    {
        foreach (var p in _state.PendingProposals
                     .Where(p => p.To == self.Id)
                     .OrderBy(p => p.From, StringComparer.Ordinal)
                     .ThenBy(p => p.Kind)
                     .ToList())
            _dip.RespondToProposal(self.Id, p.From, p.Kind, WouldAccept(self.Id, p.From, p.Kind));
    }

    /// <summary>
    /// 수락 판정 — **응답과 제안이 같은 술어를 공유한다** [MUST].
    ///
    /// 이걸 공유하지 않으면 라이브락이 생긴다(실측): Favor 가 -900 인 전쟁 상대에게 '국력 열세' 를
    /// 이유로 매턴 종전을 제안하는데 상대는 매턴 거절하고, 제안 등록 자체는 항상 성공이라
    /// **턴당 1 행동 예산을 영구히 잡아먹어** 동맹 행이 평생 평가되지 않는다.
    /// Favor 는 대칭(E2)이라 상대의 수락 여부를 제안 전에 정확히 계산할 수 있다 —
    /// 거절당할 제안은 아예 하지 않는다. 결정적이므로 §8 리플레이 계약도 유지된다.
    /// </summary>
    private bool WouldAccept(string target, string from, ProposalKind kind)
    {
        var favor = _led.Favor(target, from);
        return kind switch
        {
            ProposalKind.Alliance => favor >= _r.AllianceFavorMin
                                     && AllianceCount(target) < _r.MaxAlliances
                                     && _d.AttitudeOf(favor) != Attitude.Nemesis,
            ProposalKind.NonAggression => favor >= _r.NonAggressionFavorMin
                                          && _d.AttitudeOf(favor) != Attitude.Nemesis,
            ProposalKind.Peace => favor >= _r.PeaceFavorMin
                                  || Power(target) < Power(from) * _r.PeacePowerRatio / 100,
            _ => false
        };
    }

    /// <summary>이미 같은 제안이 계류 중이면 중복 제안으로 예산을 낭비하지 않는다.</summary>
    private bool Pending(string from, string to, ProposalKind kind) =>
        _state.PendingProposals.Any(p => p.From == from && p.To == to && p.Kind == kind);

    /// <summary>제안 가능한가 — 상대가 수락할 것이고, 중복이 아닐 때만.</summary>
    private bool CanPropose(FactionState self, string t, ProposalKind kind) =>
        !Pending(self.Id, t, kind) && WouldAccept(t, self.Id, kind);

    private bool TryAct(FactionState self, Faction def, Act act) => act switch
    {
        Act.Peace => First(self, t => Rel(self, t) == DiplomaticState.War
                                      && (_led.Favor(self.Id, t) >= _r.PeaceFavorMin
                                          || Power(self.Id) < Power(t) * _r.PeacePowerRatio / 100)
                                      && CanPropose(self, t, ProposalKind.Peace),
            t => _dip.Propose(self.Id, t, ProposalKind.Peace)),

        // 2행: 동맹 육성 조공 — 이 행이 없으면 favor_ceiling 이 AI 에게 사문(死文)이 된다.
        // 조공 조건을 '적대일 때만' 으로 두면 Favor 가 오르는 순간 조건이 꺼져 자기종료한다(§5.5).
        Act.GrowTribute => First(self, t => _led.Favor(self.Id, t) >= 0
                                            && _led.Favor(self.Id, t) < _r.AllianceFavorMin
                                            && SharesEnemy(self.Id, t)
                                            && self.Treasury > _d.Scheme.CostGold * 2
                                            && Rel(self, t) != DiplomaticState.War,
            t => _dip.SendTribute(self.Id, t, TributeStep(self), 0)),

        // 3행: 동맹 제안. Rel 조건이 **Neutral 또는 NonAggression** 이어야 한다 — Neutral 만 허용하면
        // 불가침을 먼저 맺은 쌍은 Rel 이 영영 Neutral 로 안 돌아와 동맹이 영구 차단된다(실측: favor 420
        // 인 쌍이 불가침에 갇혀 동맹 0). 불가침은 동맹의 전 단계지 막다른 길이 아니다.
        // 공동의 적은 '동맹의 계기' 지만, 맹우(Devoted) 수준이면 그 자체로 충분하다 — 작은 맵에서는
        // 공동의 적이 먼저 멸망해 조건이 사라지는 일이 잦다.
        Act.Alliance => First(self, t => _led.Favor(self.Id, t) >= _r.AllianceFavorMin
                                         && (SharesEnemy(self.Id, t)
                                             || _d.AttitudeOf(_led.Favor(self.Id, t)) == Attitude.Devoted)
                                         && AllianceCount(self.Id) < _r.MaxAlliances
                                         && Rel(self, t) is DiplomaticState.Neutral or DiplomaticState.NonAggression
                                         && CanPropose(self, t, ProposalKind.Alliance),
            t => _dip.Propose(self.Id, t, ProposalKind.Alliance)),

        Act.NonAggression => First(self, t => _led.Favor(self.Id, t) >= _r.NonAggressionFavorMin
                                              && Power(t) > Power(self.Id)
                                              && Rel(self, t) == DiplomaticState.Neutral
                                              && CanPropose(self, t, ProposalKind.NonAggression),
            t => _dip.Propose(self.Id, t, ProposalKind.NonAggression)),

        // 5행: 전쟁 회피 조공 — 훨씬 강한 적대 이웃을 돈으로 달랜다.
        Act.AppeaseTribute => First(self, t => _d.AttitudeOf(_led.Favor(self.Id, t)) <= Attitude.Hostile
                                               && Power(t) > Power(self.Id) * _r.TributePowerRatio / 100
                                               && self.Treasury > _d.Scheme.CostGold * 2
                                               && !Allied(self, t),
            t => _dip.SendTribute(self.Id, t, TributeStep(self), 0)),

        Act.Scheme => TryScheme(self),

        Act.War => First(self, t => _led.Favor(self.Id, t) <= WarThreshold(def)
                                    && Rel(self, t) == DiplomaticState.Neutral
                                    && Power(self.Id) > Power(t) * _r.WarPowerRatio / 100,
            t => _dip.DeclareWar(self.Id, t)),

        _ => false
    };

    /// <summary>
    /// 6행: 이간계 — 자기 적 둘이 서로 우호적이면 갈라놓는다. **쌍 인자**라 대상 루프에 못 들어간다.
    /// 이 행이 AI 가 플레이어의 동맹을 깨러 오는 경로다.
    /// </summary>
    private bool TryScheme(FactionState self)
    {
        if (self.Treasury < _d.Scheme.CostGold || self.SchemesThisTurn >= _d.Scheme.PerTurn) return false;
        var ids = Others(self).ToList();
        for (var i = 0; i < ids.Count; i++)
            for (var j = i + 1; j < ids.Count; j++)
            {
                var (a, b) = (ids[i], ids[j]);
                if (_d.AttitudeOf(_led.Favor(self.Id, a)) > Attitude.Hostile) continue;
                if (_d.AttitudeOf(_led.Favor(self.Id, b)) > Attitude.Hostile) continue;
                if (_d.AttitudeOf(_led.Favor(a, b)) < Attitude.Friendly) continue;
                var o = _scheme.SowDiscord(self.Id, a, b);
                return o is SchemeOutcome.Success or SchemeOutcome.Exposed;
            }
        return false;
    }

    /// <summary>단수 대상 행위 — id ordinal 순으로 첫 매칭 1건 실행 (결정적).</summary>
    private bool First(FactionState self, Func<string, bool> match, Func<string, DiplomacyOutcome> act)
    {
        foreach (var t in Others(self))
            if (match(t) && act(t) == DiplomacyOutcome.Success)
                return true;
        return false;
    }

    private IEnumerable<string> Others(FactionState self) => _state.Factions
        .Where(f => f.Id != self.Id && f.OwnedProvinceIds.Count > 0)   // 멸망 세력 제외
        .Select(f => f.Id)
        .OrderBy(x => x, StringComparer.Ordinal);

    /// <summary>선전포고 문턱 = 데이터 기본 + 성향 델타 (§5 하드코딩 금지).</summary>
    private int WarThreshold(Faction def) =>
        _r.WarFavorMax + _r.DispositionWarFavorDelta.GetValueOrDefault(def.AiDisposition, 0);

    /// <summary>국력 = 육상 영지 수 × 가중 + 총병력 (§7.2 — 정수). 지표를 정의해야 하드코딩을 막는다.</summary>
    private int Power(string factionId)
    {
        var f = _state.Factions.FirstOrDefault(x => x.Id == factionId);
        if (f is null) return 0;
        var land = f.OwnedProvinceIds.Count(id => _db.Map.GetNode(id) is LandProvince);
        var troops = _state.Armies.Where(a => a.FactionId == factionId).Sum(a => a.TotalTroops)
                     + _state.Fleets.Where(x => x.FactionId == factionId).Sum(x => x.TotalTroops);
        return land * _r.PowerMetricProvinceWeight + troops;
    }

    /// <summary>조공 1회 금액 — 캡(지원과 공유 예산)을 넘지 않게 잔여분으로 제한.</summary>
    private int TributeStep(FactionState self)
    {
        var cap = _db.Rules.AllianceTransferCapPerTurn.Gold;
        var remain = Math.Max(0, cap - self.TransferredGoldThisTurn);
        return Math.Min(Math.Min(remain, self.Treasury / 2), _d.Tribute.GoldPerFavor * 20);
    }

    private int AllianceCount(string id) =>
        _state.Factions.Count(f => f.Id != id &&
                                   f.Relations.GetValueOrDefault(id) == DiplomaticState.Alliance);

    private bool SharesEnemy(string a, string b)
    {
        var fa = _state.Factions.First(f => f.Id == a);
        var fb = _state.Factions.First(f => f.Id == b);
        return _state.Factions.Any(t => t.Id != a && t.Id != b &&
                                        fa.Relations.GetValueOrDefault(t.Id) == DiplomaticState.War &&
                                        fb.Relations.GetValueOrDefault(t.Id) == DiplomaticState.War);
    }

    private DiplomaticState Rel(FactionState self, string t) => self.Relations.GetValueOrDefault(t);
    private bool Allied(FactionState self, string t) => Rel(self, t) == DiplomaticState.Alliance;
}
