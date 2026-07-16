# CLAUDE.md

이 저장소(WorldConquest, orphan 브랜치)에서 작업하는 Claude Code 를 위한 지침.

@AGENTS.md

## 절대 규칙 (요약 — 정본은 위 링크 + docs/GAME_DESIGN_SPEC.md)

1. **작업 전 [`docs/GAME_DESIGN_SPEC.md`](docs/GAME_DESIGN_SPEC.md) §0.3 와 현재 Phase(§7) DoD 를 먼저 읽는다.** §4 아키텍처·§5 데이터 스키마를 위반하는 코드는 작성하지 않는다.
2. **커밋 전 `verify`**(`dotnet build -warnaserror && dotnet test`) 녹색 필수. 커밋은 pathspec 한정 (이 repo 는 master=별개 프로젝트와 공존하는 orphan 브랜치).
3. **밸런스 수치 하드코딩 금지** — 전부 `data/*.json` (§5). 게임플레이 산술은 정수/고정소수만 (§4.4).
4. **Phase 3 이전 엔진 의존 코드 0줄.** 콘솔판이 오라클이다.
