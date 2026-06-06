# AI Game Lab — Claude Code 지침

이 프로젝트의 **엔지니어링 작업지침·아키텍처 설계도는 `AGENTS.md` 가 정본**이다.
Codex 와 Claude Code 가 같은 규칙을 공유하도록, 상세는 한 파일에만 둔다. 변경 작업 전 반드시 읽는다.

@AGENTS.md

## 절대 규칙 (요약 — 상세·근거는 AGENTS.md)

1. **신규 기능 코드를 `src/main.ts` 에 추가하지 않는다.** 로직은 `src/game/`, 표현은 `src/ui/`. `main.ts` 는 배선만, 축소만.
2. **추출은 7단계 의식대로**: 커밋 → 테스트 먼저 → "이동만(동작 보존)" → `npm run verify` 녹색 → 커밋. 이동(move) ≠ 개선(improve).
3. **커밋 전 `npm run verify` 녹색.** 큰 리팩터를 미커밋 상태로 두지 않는다. 커밋은 pathspec 으로 한정.
4. `game/`·`ui/` 는 **`main.ts` 를 import 하지 않는다**(leaf 규칙). 엔진은 Three.js(phaser/react 미사용).
