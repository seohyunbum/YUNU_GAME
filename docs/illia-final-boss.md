# 최종 보스 '일리아' — 설계·구현 문서 (2026-07-04)

불멸의 존재(챕터 6) 뒤에 오는 진짜 최종 콘텐츠. 컨셉: 백발·붉은 눈·흑익의 타천사풍 군주(사용자 첨부 이미지 참조).
콘텐츠 흐름 = **차원의 문 → 인엔진 컷씬(스킵 가능) → 2페이즈 패턴 보스 → 엔딩 크레딧**.

## 진행 흐름

1. **불멸의 존재 처치**(챕터 완주, `bossChapter === FINAL_BOSS_CHAPTER`) → 기존 엔딩(startFinale) 대신 **차원의 문**이 용의 땅 (420, -386) 에 스폰. 기존 클리어 세이브도 로드/텔레포트/신규시드 시 `ensureDimensionGate` 로 소급.
2. **문 진입(E)** → 차원 아레나(cave 모드, `createIlliaArenaInterior`) + **각성 컷씬**(~10초): 쇠사슬 봉인석 균열 진행 → 파열 → 봉인된 군주 등장. Space/Esc/Enter/클릭 = 스킵. 세션 내 1회(사망 재도전 시 생략).
3. **P1 — 봉인된 군주 일리아**: 중앙 사슬 고정(이동 없음). 붉은 텔레그래프 패턴 6종(낙인 3연·회전 십자빔·속박 링·부채꼴 참격 2연·졸개 소환·절망의 비). 피격 = **최대체력 ×50%**(튜너블 `illia_hit_pct`) — 컨트롤 회피가 핵심.
4. **사망 특례**: 아이템 미드랍 + 아레나 입구 부활 + **보스 풀피 리셋**(사용자 확정 사항). 패턴을 학습해 재도전.
5. **P1 처치** → **해방 컷씬**(~10초): 사슬이 하나씩 끊기며 → 3쌍 흑익 각성. 종료 시 **저장 confirm**(위치는 차원의 문 앞 오버월드로 스왑 저장 — `createSaveData` 가 `saveGame` 동기 프리픽스임을 이용) → `illiaProgress=1`.
6. **P2 — 절망의 군주 일리아**: 이동 해금. 완전히 다른 패턴 5종(돌진 대시 2연·비행 후 착탄 투척·연쇄 참격·깃털 폭풍 링·중앙 강림+충격 링). 부유·오라·룬링 비주얼.
7. **P2 처치** → `illiaProgress=2` + 기존 엔딩 크레딧(startFinale) + **신규 CC0 엔딩 BGM**(`public/bgm/ending.mp3` — "emotional soundtrack 1" by Alex McCulloch, CC0). 크레딧 닫으면 BGM 해제.
8. **재진입**: `illiaProgress>=1` 세이브면 컷씬 없이 바로 P2. 클리어 후에도 재도전 가능.

## 아키텍처 (main.ts 크기 게이트 준수)

| 파일 | 역할 |
| --- | --- |
| `src/game/illiaBoss.ts` (leaf) | 텔레그래프 패턴 엔진(원/링/직선/부채꼴 스폰·펄스·판정·폭발), P1/P2 패턴 테이블, P2 이동(아레나 클램프), 컷씬 시퀀서 2종(타임라인+원샷 스텝), idle 애니(`animateIlliaBody`), 컷씬 오버레이 DOM 헬퍼 |
| `src/game/illiaVisuals.ts` (leaf) | `createIlliaModel(1|2)`(백발·붉은 눈·고딕 드레스·흑익 1/3쌍·P1 사슬·P2 오라/룬링), `createSealStone()`(sealCrack/sealChain userData), `createDimensionGateVisual()`, `animateIlliaProps` |
| `src/game/interiors.ts` | `createIlliaArenaInterior` — 심연 위 원형 제단·이중 룬링·부유 파편 12·심홍/보라 조명·출구 |
| `src/main.ts` | 전부 화살표 필드/인라인 배선: `illiaContext`/`illiaCutsceneContext`/`spawnIlliaBoss`/`spawnDimensionGate`/`ensureDimensionGate`/`enterIlliaDimension`, recordBossDefeat 일리아 분기, 사망 특례(요새 분기 앞), 컷씬 입력·카메라 잠금(handleKeyDown/rotateCameraByMouse/mousedown/updateMovement 게이트), 보스바 아레나 분기, 엔딩 BGM(`endingTheme`) |

- 보스 개체 = `type:"dragon"` + `bossKind:"illia_sealed"|"illia_desperate"`. `updateDragons` 는 오버월드 전용이라 아레나에서 일리아 AI 를 안 건드림(패턴 엔진 전담). `dragonCounterAttack` 은 일리아 가드.
- 졸개 = `spawnFortressMonster`(cave AI 재사용) + `arenaBounds` 를 `illiaFight.active` 에도 적용.
- 처치 파이프라인은 기존 dragon kill 경로 재사용(combat.ts) — 일리아만 전리품 생략+전용 메시지, 후속 연출은 recordBossDefeat 가 담당.

## 세이브

`illiaProgress: 0|1|2` — 5곳 규칙(types SavedGame + saveManager 스냅샷 + saveMigration 조건부 클램프 + main createSaveData/restore + resetGameState). 결전·컷씬 중 수동 저장 차단(아레나 cave 위치가 일반 동굴로 오복원되는 것 방지). 차원의 문은 세이브 객체(`dimensionGate` restore 케이스) + `ensureDimensionGate` 이중 보장.

## 튜너블 (어드민 패널 — 총 47종)

| key | def | 의미 |
| --- | --- | --- |
| `illia_p1_hp` | 3000 | P1 체력(스폰 시 ×난이도, 보스바 분모 동일 산식) |
| `illia_p2_hp` | 4200 | P2 체력 |
| `illia_armor` | 0 | 방어 가산(BOSS_STATS 90/110 에 +) |
| `illia_hit_pct` | 0.5 | 피격 = 최대체력 비율 |
| `illia_telegraph_scale` | 1 | 예고 시간 배율(높을수록 쉬움) |

부수 정정: BOSS_STATS 상수 테이블 내 `bal()` 은 모듈 로드 1회 평가라 전역 오버라이드 미반영이던 기존 버그 → `dragon_hp`/`dragon_armor` 를 스폰(entitySpawns)·보스바 분모 시점 평가로 이동.

## 테스트

- `scripts/illia-test.mjs`(verify 편입): 텔레그래프 판정 기하 골든 / 전투 수명주기(적중·회피·튜너블·리셋) / P2 2분 시뮬 경계 클램프 / 컷씬 완주·스킵 onFinish 1회 / BOSS_STATS·XP·튜너블 def 골든 / illiaProgress 마이그레이션 왕복·클램프.
- 실브라우저 E2E(Edge headless, 일회성): 문 스폰→진입→컷씬→스킵→P1 개전→텔레그래프 피격(16→6)→사망 특례(미드랍·입구 부활·풀피 3000)→P1 처치→해방 컷씬+저장 confirm(슬롯에 progress=1·오버월드 문 앞 기록 확인)→P2 개전(4200)→P2 처치→엔딩(크레딧+ending.mp3 로드)→이탈·재진입 즉시 P2. 콘솔 오류 0.

## 적대 리뷰 반영 (2026-07-05)

- **파티 소환 누출**: `leaveCave` 가 컷씬 활성 시 소품·오버레이·active 를 수동 해제(요새 플래그와 동일 정책).
- **패널 일시정지**: `updateIlliaFight` 초입에서 `isPanelOpen` 시 모든 벽시계 타이머(detonateAt/pending/nextPatternAt/move)를 경과분만큼 시프트 — 재개 시 잔여 예고 시간 그대로.
- **볼리 안전**: 폭발분 선분리 수집 후 판정, 사망(`applyPlayerHit` 반환값) 시 잔여 폭발 중단.
- **저장 가드 통합**: `illiaInArena` 플래그(진입 true/이탈·리셋 false)로 수동 saveGame + flushAutosave(주기·패널닫기·navGuard) 전부 차단. 해방 스왑 저장만 플래그 임시 해제.
- **근접 막타 분기**: `applyMeleeDragonAttack` 도 일리아 전리품 생략(재도전 즉시 가능 → 파밍 루프 차단).
- **자원 수명**: 텔레그래프 geometry+clone 재질 dispose, 일리아 모듈 공유 재질·아레나 공유 자산은 dispose-skip 레지스트리 등록(사망 재도전 GPU 재업로드 방지).
- **보스바 회귀 보완**: 기본 드래곤 분모도 `bal("dragon_hp")` 반영.
