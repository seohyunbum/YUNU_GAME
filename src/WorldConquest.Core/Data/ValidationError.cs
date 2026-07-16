namespace WorldConquest.Core.Data;

/// <summary>
/// 데이터 검증 오류 1건 (설계문서 §5.5).
/// 어떤 파일의 어떤 항목이 왜 틀렸는지 반드시 명시한다 [MUST].
/// </summary>
public sealed record ValidationError(string File, string Entry, string Message)
{
    public override string ToString() => $"[{File}] ({Entry}) {Message}";
}
