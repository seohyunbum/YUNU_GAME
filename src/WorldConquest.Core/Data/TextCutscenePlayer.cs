using WorldConquest.Core.Domain;

namespace WorldConquest.Core.Data;

/// <summary>
/// T0 텍스트 컷씬 재생기 (설계문서 §2.7.9 — 전 컷씬 의무 최저 티어이자 정본).
/// CutsceneTriggered 이벤트를 받아 스크립트 비트를 텍스트로 재생한다. Presentation 책임 —
/// 재생·스킵이 Core 상태에 영향 0 (비권위 [MUST]). UE5 는 같은 비트를 영상으로 재해석(Phase 3).
/// </summary>
public sealed class TextCutscenePlayer
{
    private readonly GameDatabase _db;
    private readonly TextWriter _out;

    public TextCutscenePlayer(GameDatabase db, TextWriter output)
    {
        _db = db;
        _out = output;
    }

    /// <summary>firstFire=false 면 쇼트 버전(§2.7.8 — 2회차 피로 방지. 쇼트 없으면 생략).</summary>
    public void Play(string cutsceneId, bool firstFire)
    {
        if (!_db.CutsceneScripts.TryGetValue(cutsceneId, out var script)) return;   // 결번 무해

        var beats = firstFire ? script.Script
                  : script.ShortScript.Count > 0 ? script.ShortScript
                  : Array.Empty<CutsceneBeat>() as IReadOnlyList<CutsceneBeat>;
        if (beats.Count == 0) return;

        _out.WriteLine();
        foreach (var b in beats)
        {
            switch (b.Beat)
            {
                case "line":
                    var speaker = b.SpeakerRef is not null && _db.Characters.TryGetValue(b.SpeakerRef, out var c)
                        ? c.NameKo : b.SpeakerRef ?? "";
                    _out.WriteLine($"  「{speaker}」 {b.TextKo}");
                    break;
                case "narration":
                    _out.WriteLine($"  {b.TextKo}");
                    break;
                case "title_card":
                    var text = b.Text ?? script.TitleCardText ?? script.TitleKo ?? cutsceneId;
                    _out.WriteLine($"  ══════ {text} ══════");
                    break;
                case "pause":
                    _out.WriteLine();
                    break;
            }
        }
        _out.WriteLine();
    }
}
