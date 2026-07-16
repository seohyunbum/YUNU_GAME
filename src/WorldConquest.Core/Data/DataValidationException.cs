namespace WorldConquest.Core.Data;

/// <summary>데이터 검증 실패. 조용한 스킵 금지 — 모든 오류를 모아 기동을 실패시킨다 (설계문서 §5.5).</summary>
public sealed class DataValidationException : Exception
{
    public IReadOnlyList<ValidationError> Errors { get; }

    public DataValidationException(IReadOnlyList<ValidationError> errors)
        : base($"데이터 검증 실패 — {errors.Count}건:\n" + string.Join("\n", errors))
    {
        Errors = errors;
    }
}
