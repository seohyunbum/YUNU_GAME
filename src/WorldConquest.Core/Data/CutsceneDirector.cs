using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// 게임 이벤트를 컷씬 트리거와 대조해 발동할 컷씬을 '선택'만 한다 (설계문서 §2.7.2 [MUST] 계약).
/// - 비권위: 컷씬은 게임 상태를 바꾸지 않는다 — 효과는 이미 선(先)커밋됨.
/// - fired=seen: 트리거 시점에 FiredCutsceneIds 기록(스킵 무관). not_fired 의 유일 근거.
/// - 결정적 선택: 복수 매치 시 priority desc → id asc 로 1편.
/// - chance_permyriad 는 무상태 해시 파생(§2.7.3) — 컷씬 삽입이 combat 스트림을 오염시키지 않는다.
/// 발동 시 CutsceneTriggered(cutsceneId, firstFire) 를 버스로 발행 — 재생은 Presentation 몫.
/// </summary>
public sealed class CutsceneDirector
{
    private readonly GameState _state;
    private readonly GameDatabase _db;
    private readonly EventBus _bus;

    public CutsceneDirector(GameState state, GameDatabase db, EventBus bus)
    {
        _state = state;
        _db = db;
        _bus = bus;
        _bus.Subscribe(Handle);
    }

    private void Handle(GameEvent evt)
    {
        if (evt.Type == "CutsceneTriggered") return;   // 자기 발행 이벤트 재귀 방지

        // A2 궁극기 컷씬 (§2.7.7): SkillExecuted 는 skills.json 의 cutscene_id 로 직접 매핑 — 트리거 항목 불필요
        if (evt.Type == "SkillExecuted")
        {
            var skillId = evt.Get("skill");
            if (skillId is not null && _db.Skills.TryGetValue(skillId, out var skill) &&
                skill.CutsceneId is not null && _db.CutsceneScripts.ContainsKey(skill.CutsceneId))
                Fire(skill.CutsceneId);
            return;
        }

        // 데이터 트리거 매칭 — priority desc → id asc 로 최고 1편 (§2.7.6 같은 순간 2연속 컷씬 방지)
        var match = _db.CutsceneTriggers.Values
            .Where(t => t.OnEvent == evt.Type && ConditionsMet(t, evt))
            .OrderByDescending(t => t.Priority)
            .ThenBy(t => t.Id, StringComparer.Ordinal)
            .FirstOrDefault();
        if (match is not null) Fire(match.Id);
    }

    private void Fire(string cutsceneId)
    {
        var firstFire = _state.FiredCutsceneIds.Add(cutsceneId);   // fired=seen — 트리거 시점 기록
        _bus.Publish(GameEvent.Of("CutsceneTriggered",
            ("cutscene", cutsceneId), ("first_fire", firstFire ? "true" : "false")));
    }

    private bool ConditionsMet(CutsceneTrigger trigger, GameEvent evt)
    {
        // once_per: save — 이미 발동했으면 재발동 안 함 (쇼트 재생은 A2 계열만; 데이터 트리거는 1회성)
        if (trigger.OncePer == "save" && _state.FiredCutsceneIds.Contains(trigger.Id)) return false;

        foreach (var c in trigger.Conditions)
        {
            var ok = c.Type switch
            {
                "actor_is" => evt.Get("actor") == c.Value,
                "event_field" => evt.Get(c.Field!) == c.Value,
                "not_fired" => !_state.FiredCutsceneIds.Contains(c.Value == "self" ? trigger.Id : c.Value!),
                "chance_permyriad" => HashPermyriad(trigger.Id) < (c.Permyriad ?? 0),
                _ => throw new InvalidOperationException(
                    $"컷씬 '{trigger.Id}' 의 미구현 조건 '{c.Type}' — 조용한 무시 금지 [MUST §5.5]")
            };
            if (!ok) return false;
        }
        return true;
    }

    /// <summary>무상태 해시 파생 확률 (§2.7.3): Hash(campaign_seed, cutscene_id, turn) % 10000 —
    /// 소비 카운터가 없어 컷씬 데이터 삽입·평가 순서가 combat 스트림을 절대 교란하지 않는다.</summary>
    private int HashPermyriad(string cutsceneId)
    {
        unchecked
        {
            ulong h = 14695981039346656037UL;
            void Mix(ulong v) { h ^= v; h *= 1099511628211UL; }
            Mix(_state.CampaignSeed);
            foreach (var ch in cutsceneId) Mix(ch);
            Mix((ulong)_state.Turn);
            return (int)(h % 10000);
        }
    }
}
