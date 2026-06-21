# 세이브 시스템 — 변경 이력 · 유의사항 · 잔여 리스크 (LIVING DOC)

> 목적: 반복되는 "저장 유실 / 원치 않는 덮어쓰기 / 저장이 안 보임 / 중복 슬롯" 류 패치의 **시도·변경·함정**을 한곳에 적재.
> **세이브 코드를 건드리기 전 §1(아키텍처)·§2(유의사항)을 반드시 읽고, 변경 후 §3에 한 줄 추가할 것.**
> 관련: `docs/save-duplicate-slots-fix-design.md`(중복슬롯 설계). 코어=`src/game/saveRepository.ts`, 흐름=`src/main.ts` `saveGame`/`saveOverwrite`, 직렬화=`saveManager.ts`, 마이그레이션=`saveMigration.ts`, 복원=`saveRestore.ts`.

---

## 1. 아키텍처 — 4개 저장 레이어
| 레이어 | 키(constants.ts) | 범위/개수 | 용도 |
|---|---|---|---|
| **명명 수동 슬롯** | `SAVE_LIST_KEY` | **전역(닉네임 무관)**, `MAX_SAVE_SLOTS`=10, **savedAt 으로 dedup** | 사용자가 '저장' → 로드 패널 목록 |
| 최신본(latest) | `SAVE_KEY` | 1 | 마지막 저장 빠른 복구 |
| 백업 링 | `SAVE_HISTORY_KEY` | **닉네임별** `SAVE_HISTORY_PER_NICKNAME`=15 | 자동 백업 이력(복구 UI) |
| 자동저장 | `SAVE_AUTOSAVE_KEY` | **닉네임별** `SAVE_AUTOSAVE_PER_NICKNAME`=1 (계속 덮어씀) | 이탈/주기 자동저장 — **수동 슬롯 절대 미덮어씀** |

- **읽기 경로 2종**(혼동 주의): 표시(loadGame)=`readSaveSlots`(LIST+KEY+BACKUP **병합**), 저장/가득판정=`readStoredSlotList`(**LIST 만**).
- 슬롯은 deflate+base64 `packed` 압축(`packSaveData`). 미지원 환경은 비압축 `save`.
- `writeSaveSlots(slots, storage, {allowTrim})`: 기본 trim=true(앞=신규, 뒤=오래된 것부터 떨굼). 덮어쓰기 등 '교체만'은 **allowTrim:false**(공간부족 시 throw, 기존 보존).
- `SAVE_VERSION`=12. optional 추가필드는 버전 안 올림(마이그레이션이 누락필드 보정).

---

## 2. 핵심 유의사항 (함정) — 세이브 변경 전 필독
1. **변동 진행상태는 전부 `SavedGame.player` 에 넣어라.** 세이브 밖 전역 키에만 있는 값(과거 `arcadePoints`)은 **로드 시 롤백 안 돼 복제 익스플로잇**이 된다(판매→로드→판매 무한증식). → cfef101에서 포인트를 세이브로 이관. 신규 누적/통화/재화는 반드시 세이브 포함 + restore에서 롤백.
2. **`savedAt` 은 ms 정밀(`new Date().toISOString()`)이고 표시는 초 단위.** dedup/비교를 `savedAt` 정확일치로 하면 **같은 초의 반복 저장이 빠져나가 중복 슬롯**이 된다(75d4701). → 비교는 `savedAt.slice(0,19)`(초). **단 `savedAt` 원본은 절대 절단 금지**(history 링·autosave·로드 키로 ms값을 그대로 씀 — 절단 시 키 충돌).
3. **`saveInProgress` 가드는 "겹치는" 저장만 막는다(연속은 통과).** 빠른 연타·이중발화는 `lastSaveCompletedAt`+`SAVE_DEBOUNCE_MS` 디바운스로 막는다. 새 저장 트리거를 추가하면 디바운스 영향권인지 확인.
4. **quota(용량부족) 폴백이 복구 안전망을 통째로 날리지 않게.** 과거 `writeJsonStorage` 폴백이 BACKUP/AUTOSAVE/HISTORY를 전닉네임 삭제했음(유실 안전망 파괴). 점진 축출(오래된 1개씩)·정본(LIST) 우선 기록 원칙.
5. **명명 슬롯은 전역(닉네임 무관)** — 캐릭터 간 강제 덮어쓰기·혼선 위험(아래 §4 잔여). 슬롯 추가/필터 작업 시 닉네임 귀속 고려.
6. **Ctrl+S 오토리피트** 다중발화 주의(`!event.repeat`로 첫 입력만).
7. **테스트는 순수 재현 가능**: `scripts/save-*-test.mjs`(vite ssrLoadModule + MemoryStorage mock). 세이브 로직 변경 시 반드시 돌리고 기대값 갱신.

---

## 3. 변경 이력 (시간순, 최신이 아래)
> 새 세이브 패치 시 **여기에 한 줄 추가**(commit · 무엇 · 왜).

**기반 구축**
- `b242f89` 저장/재시작 컨트롤 · `9d74bec` 직렬화 추출 · `c60e788` 복원 헬퍼 추출 · `862efa5` bossChapter 필드(SAVE_VERSION 7)+마이그레이션.
- `f701837` 압축 슬롯 5개 · `0ee882c` 덮어쓰기 선택창 · `e4bc658` export/import.

**유실/덮어쓰기 1차 (~2026-06 초)**
- `5f7b163` 읽을 수 없는 슬롯에서 로드가 조용히 죽던 것 수정. `c0c859f` localStorage quota로 저장-로드가 죽던 것 수정("저장2" 근본원인).
- `e332f78` **가득 시 묻지 않고 덮어쓰던 유실** 수정. `505a3ac` 정수 HP 요약·슬롯 디테일 백필.
- `8c08503` 자동 백업 링(닉당 30)+복구 UI. `6caf317` 백업키 NUL 제거. `64b612b` 슬롯 5→10.
- `6586f06` 뒤로가기 이탈 차단 + **별도 자동저장 슬롯**(수동 미덮어씀). `74b95c4` 용량부족 시 부가백업 희생+정본 먼저("저장 실패" 대신 성공). `37bc09d` 자동저장 닉당 1개. `d678abb` 백업링 30→15.

**적대적 감사 핵심 (2026-06-19, 885e47f~)**
- `885e47f` ★**유실 핵심 2건**: ① 동시 saveGame lost-update → `saveInProgress` 직렬화 가드(+Ctrl+S !repeat) ② 덮어쓰기 quota 무경고 유실 → `allowTrim:false`+떨군 슬롯 이름 경고.
- `e80d2a2` 후속 3건: quota **점증 희생**(전삭제 폐지)·표시 **id dedup**(같은 savedAt 다른 슬롯)·로드 세이브 **명명슬롯 승급**(`promoteSaveToSlotList`, 유령슬롯 방지).
- `cfef101` 경제 익스플로잇: `arcadePoints` 세이브 이관(판매→로드 복제 차단)+판매가 70%↓.

**진행/멀티 관련**
- `b89c430` 요새 보상 즉시저장 + 패널닫기 자동저장(데이터 손실 방지). `8e3be1d` 옛 세이브에 야생 밀도 소급 탑업.
- `68ddba6`·`2fc20c2` 파티 줍기 유실(게스트 화이트리스트). `cc0ae40`·`0f7cfe2`·`ded6c22` **복제 차단** 캐릭터 귀속 비가역 거래 원장(save-scum dupe) + 설치/회수 대칭 기록.

**중복 슬롯 (2026-06-21)**
- `2abf2e1`(설계) → `75d4701` ★**저장 1회→동일슬롯 3중복** 수정: savedAt ms정밀+dedup 정확일치 → 같은 초 반복저장이 dedup 통과 → cap 3배소모로 타 캐릭터 슬롯 trim 유실. **A 디바운스**(`lastSaveCompletedAt`+`SAVE_DEBOUNCE_MS`=1500)·**B 초단위 dedup**(`savedAt.slice(0,19)`)·**C 로드 청소**(`readStoredSlotList` 같은-초 중복 제거).

---

## 4. 알려진 잔여 리스크 / 백로그
> "여전히 완벽하지 않은" 부분. 또 유실/혼선 신고 오면 여기부터.
- **명명 슬롯이 전역(닉네임 무관)** — 다른 캐릭터로 저장 시 한 풀(10칸)을 공유해 서로 밀어냄. `StoredSaveSlot`에 nickname 필드+필터(autosave/history 패턴 차용), 슬롯카드에 닉네임/클래스 표기. ← **가장 큰 잔여 혼선원**.
- **언로드 동기 자동저장이 raw(비압축) 기록** 가능성 → quota 유발↑. 직전 압축본 캐시 재사용 검토.
- **디바운스(1500ms)는 같은-탭 단일 인스턴스 기준** — 두 탭 동시 플레이 등 멀티-탭 경합은 별개(스토리지 이벤트/락 미도입).
- **표시 경로 병합(LIST+KEY+BACKUP)** 의 "유령 슬롯"은 승급(e80d2a2)으로 완화됐으나, 승급이 가득(≥MAX)이면 미작동(allowTrim:false) — 가득 상태의 유령 표기/안내 일관성 점검 여지.
- (추정 해결) quota 전삭제(e80d2a2), 유령 슬롯(e80d2a2 승급), id dedup(e80d2a2) — 회귀 감시 대상.

---

## 5. 테스트
- `npm run test:save-repository` / `test:save-migration` / `test:save-roundtrip` — MemoryStorage mock으로 순수 재현. 세이브 로직 변경 시 필수 + 기대값 갱신.
- 수동: ① 저장 버튼/Ctrl+S **빠르게 3회** → 슬롯 1개("방금 저장했습니다" 반복). ② 가득(10) 상태 저장 → 덮어쓰기 선택창, 다른 슬롯 보존. ③ 캐릭터 A 저장 후 B로 저장 → A 슬롯 잔존 확인(현재 전역이라 주의). ④ 자동저장이 수동 슬롯 안 건드리는지.

## 6. 디버깅 체크리스트 ("유실" 신고 시)
1. 어느 레이어? (LIST 명명슬롯 / KEY latest / BACKUP 링 / AUTOSAVE) — 키별로 localStorage 직접 확인.
2. 어느 출처(origin)? localhost vs github.io 는 **스토리지 분리**(다른 도메인). → [[yunu-game-dual-origin-saves]].
3. quota 임박? 슬롯 packed 크기·총 사용량. 폴백이 무엇을 희생했나(메시지).
4. dedup/savedAt: 같은 초 중복? 전역 슬롯 캐릭터 혼선?
5. 복구: BACKUP 링·AUTOSAVE에서 복구 UI 제공. LevelDB 스냅샷+SST 파서 복구는 시간 민감(즉시).
