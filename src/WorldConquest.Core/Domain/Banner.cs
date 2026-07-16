namespace WorldConquest.Core.Domain;

/// <summary>초빙 배너 (§5.8). v1 = standard 상시 1종 — 테마 배너·rate_up 은 확장 여지.</summary>
public sealed record Banner(string Id, string NameKo, string RateTableId);

/// <summary>등급 확률표 (§5.8) — 만분율(permyriad, §4.4 정수 확률 표준). 합 10000 은 로더 검증.</summary>
public sealed record RateTable(string Id, IReadOnlyDictionary<int, int> WeightsPermyriad);
