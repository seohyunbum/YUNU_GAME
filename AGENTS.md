# AGENTS.md — 마피아 게임 작업 지침

## 구조

- `lib/game/`: UI·네트워크와 분리된 순수 규칙 코어와 규칙 기반 AI
- `lib/online/`: PeerJS 전송, 프로토콜, 호스트 권위 세션
- `app/`: 표현과 사용자 입력. 규칙을 다시 구현하지 않고 코어 API만 사용
- `data/`: 역할·게임 수치 정본
- `docs/DESIGN.md`: 사용자 승인 규칙 정본

## 불변 규칙

1. 규칙 변경은 `docs/DESIGN.md`와 `data/*.json`을 먼저 갱신한다.
2. 호스트만 전체 `GameState`를 소유한다. 게스트에는 `PlayerView`만 보낸다.
3. 게스트 입력은 intent로 검증하며 임의 상태 덮어쓰기를 허용하지 않는다.
4. 랜덤 판정은 시드 RNG를 사용해 테스트 재현성을 유지한다.
5. 외부 LLM·Firebase를 게임 진행에 사용하지 않는다.
6. 커밋 전 `npm run verify`를 통과한다.
