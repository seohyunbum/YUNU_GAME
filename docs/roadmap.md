# 로드맵 (now / next / later)

> 점-요청에 묻히기 쉬운 "중요하나 안 급한" 일을 가시화하는 경량 백로그.
> 우선순위는 아래 **North star** 결정에 따라 재정렬된다. 실패·보류 상세는 `docs/work-history.md`.

## 🎯 먼저 정해야 할 것 (미결정)

- **North star — 주 플레이어/주 목적.** 자녀가 즐길 게임인가(→ 스코프 단순화·온보딩·짧은 승리 루프), 아니면 부모의 AI 창작 프로젝트인가(→ 스코프 유지, 빌드 속도·학습 최적화)? **이 한 줄이 아래 전부의 우선순위를 정한다.** 둘 다 정당하나 미결정 자체가 미스-우선순위의 원인.

## Now (이번 묶음)

- ✅ 멀티에이전트 협업 규약 (`AGENTS.md §12`)
- ✅ 죽은 의존성 제거 (phaser / react / react-dom)
- ✅ 데이터주도 확대 — 클래스 스킬 디스패치(`Record<PlayerClassId>` 로 누락 시 컴파일 에러 강제)

## Next (가까운 우선)

- **진행 척추 — 보스 게이팅.** `bossChapter` 저장 필드 + 이전 보스 처치로 다음 보스 개방 + 첫 10분 목표 가이드(`objectives`). 설계는 `docs/boss-chapter-economy-balance.md` 에 이미 있음 — 구현만. *(turn 2부터 지적된 핵심 제품 갭)*
- **QA 사각 메우기.** ① 시각 검증 복구(preview 환경 or 수동 스크린샷 프로토콜 or `visual-check` 를 거너·신무기까지 확장). ② 자녀 플레이테스트 정례화 + 매회 관찰 3개 `docs/playtest-log.md`.
- **데이터주도 확대 — 스킬 "행동".** `game/classSkills.ts` 로 스킬 로직을 좁은 `GameContext` 와 함께 추출 → 클래스 추가가 leaf-only 가 되게.

## Later (여유 시)

- 무기 강화 시스템 (보류됨)
- God Object 지속 축소 (`main.ts` 현재 ~9.7k줄·472메서드 → 목표치)
- 상위 보스 패턴 차별화 (화염 장판·예고선·시야 방해 등, 밸런스 문서 참조)
- 경제 인플레이션 점검 (보스 전리품 기대값 vs 상점가)

## 완료된 굵직한 작업 (참고)

- 거버넌스: typecheck + 10 게이트(size/method ratchet, architecture, content/balance 불변식, perf budget), work-history
- 거너 직업 + 직업별 외형/거울, 평타 ÷10(+보스 방어 90), 도끼/원거리 무기 확대(데이터주도)
- God Object 추출 다수(UI/스폰/전투효과/비주얼 모듈화), 비주얼 인스턴싱
