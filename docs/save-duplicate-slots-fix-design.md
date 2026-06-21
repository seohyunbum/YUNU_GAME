# 저장 1회 → 동일 슬롯 3개 중복 버그 — 원인분석 + 수정설계

> 상태: **설계 완료 / 구현 대기** (다른 세션 푸시 완료 + 사용자 컨펌 후)
> 심각도: **크리티컬** — 슬롯 cap 을 빠르게 소모해 **다른 캐릭터 세이브가 trim 되어 유실**될 수 있음.

## 1. 증상
한 번 저장했는데 로드 패널에 **동일 데이터·동일 시각(초)의 슬롯이 3개**(저장 5/6/7) 생성됨. 화면 시각은 같은 초(11:04:31), 데이터(레벨/체력/걸음 등) 완전 동일.

## 2. 원인 (코드 근거)
### 2.1 savedAt 은 밀리초 정밀, 표시는 초
- `createSaveData` → `saveManager.ts` `savedAt: new Date().toISOString()` = `"...T23:04:31.123Z"` (**ms 포함**).
- 로드 패널 라벨은 `formatSaveDate(savedAt)` = **초 단위 표시**.
- → 같은 초에 저장된 3개는 **표시는 같지만 내부 savedAt 은 ms 가 달라 서로 다른 문자열**.

### 2.2 dedup 이 savedAt **정확 문자열 일치**라 같은-초 중복을 못 거른다
`saveGame()`([main.ts] `private async saveGame`):
```ts
const existingSaves = this.readStoredSlots().filter((slot) => slot.savedAt !== save.savedAt);
const requestedSaves = [createRepositorySaveSlot(save, ...), ...existingSaves];
await writeRepositorySaveSlots(requestedSaves);
```
- 의도: "같은 저장을 두 번 안 넣기". 그러나 `!==` 가 **ms 까지 비교** → `...31.123` ≠ `...31.456` → **dedup 미작동** → 3개 모두 잔류.
- `createSaveSlot` 의 `id` 도 `save-${crypto.randomUUID()}` 라 매번 달라 id 로도 안 걸림.

### 2.3 `saveInProgress` 가드는 "겹치는" 저장만 막고, "연속" 저장은 못 막는다
- 가드는 동기적으로 set 되어 **동시(같은 await 구간) 재진입만 차단**.
- saveGame 1회는 수십 ms(압축 `packSaveData`+localStorage)면 끝나 가드가 풀림 → **수십~수백 ms 간격으로 순차 발화된 저장은 각각 통과**.
- 발화 경로 3종이 존재: `[data-save-game]` click(setupUi), 터치 `saveBtn` touchstart(touchControls), `Ctrl+S` keydown(main.ts, repeat 만 가드). 사용자/이벤트의 짧은 연타·중복발화(터치+합성click, 더블클릭, 키 연타)가 들어오면 **N슬롯** 생성.

### 2.4 유실 메커니즘
- 슬롯 리스트 cap = `MAX_SAVE_SLOTS`(10). 신규는 **앞에** 추가, `writeSaveSlots` 가 `slice(0, MAX)` 로 **뒤(오래된 것) trim**.
- 1저장=3슬롯이면 cap 을 **3배 빨리 소모** → 오래된 다른 캐릭터 슬롯이 밀려 **삭제**. ← 사용자가 우려한 크리티컬 지점.

> **결론**: "발화원 N=3" 자체보다 **dedup 이 같은-초 반복을 못 막고 디바운스가 없는 것**이 근본. 어떤 트리거 경로든(연타·이벤트 중복) 같은-초 반복이면 슬롯이 늘어난다. → 수정은 **트리거 비의존(source-agnostic)** 으로 한다.

## 3. 수정 설계 (계층적)

### A. 디바운스 — 주(主) 방어, 트리거 비의존 ★
saveGame 의 **연속 재호출을 시간으로 차단**.
```ts
// main.ts 필드
private lastSaveCompletedAt = 0;
// 상수(constants.ts)
export const SAVE_DEBOUNCE_MS = 1500; // 직전 저장 후 이 시간 내 재요청은 무시

// saveGame() 진입부 — saveInProgress 가드 직후
if (Date.now() - this.lastSaveCompletedAt < SAVE_DEBOUNCE_MS) {
  this.showMessage("방금 저장했습니다.");
  return;
}
// ... 저장 성공 후(showMessage "저장 완료" 직전/직후)
this.lastSaveCompletedAt = Date.now();
```
- 효과: 버튼 연타·터치+click 이중발화·키 연타 무엇이든 **1.5초 내 반복은 1슬롯**. 데이터 안전 직접 보장.
- 주의: 의도적 빠른 재저장(상태 바뀐 뒤)도 1.5초 막힘 — 수동 저장 특성상 허용. (자동저장 flushAutosave 는 **별도 슬롯**이라 영향 없음.)

### B. 같은-초 dedup — 정리 + 안전망
slot 필터를 **초 단위**로 비교(또는 콘텐츠 시그니처).
```ts
const sec = (iso) => (typeof iso === "string" ? iso.slice(0, 19) : iso); // 'YYYY-MM-DDTHH:MM:SS'
const existingSaves = this.readStoredSlots().filter((slot) => sec(slot.savedAt) !== sec(save.savedAt));
```
- 효과: 혹시 A 를 빠져나온 같은-초 저장이 들어와도 기존 같은-초 슬롯을 **교체**(중복 방지). 기존에 쌓인 중복도 **다음 저장 시 1개로 수렴**.
- ★savedAt 자체는 절대 절단하지 말 것 — history 링·autosave·로드 키로 ms savedAt 을 그대로 쓰므로(절단 시 키 충돌). **비교만** 초 단위로.
- (더 강한 대안) 콘텐츠 시그니처(걸음·playSeconds·level·hp 해시)로 dedup → 같은 내용이면 초가 달라도 병합. B 만으로 충분하면 보류.

### C. 로드 시 기존 중복 청소 — 마이그레이션
이미 만들어진 3슬롯 중복을 제거.
```ts
// readStoredSlotList(또는 readSaveSlots) 반환 직전, 같은-초(또는 콘텐츠) 중복 제거 — 최신(앞) 1개만 유지
const seen = new Set();
const deduped = slots.filter((s) => { const k = sec(s.savedAt); if (seen.has(k)) return false; seen.add(k); return true; });
```
- 효과: 다음 로드/저장 패널 진입 시 자동 정리. (파괴적이므로 "같은-초 & 동일 라벨"로 좁혀 보수적으로.)
- 선택: 로드 시점 1회 정리분을 곧바로 `writeSaveSlots` 로 영속화(또는 다음 저장 때 B 가 영속화하도록 두기).

### D. 트리거 하드닝 — 보조(데이터 안전엔 A가 충분)
- 터치 `tap` 은 이미 `preventDefault`+`stopPropagation` → 합성 click 억제됨. `body.touch-mode .save-controls{display:none}`(style.css:3845)로 [data-save-game]도 터치서 숨김 → 이중발화 가능성 낮음.
- 구현 시 **임시 카운터 로그**(saveGame 진입마다 console.debug)로 실제 N 과 발화 간격을 1회 확인 → 만약 동일 클릭에서 다중 발화면 해당 바인딩(중복 addEventListener) 제거.

## 4. 권장 적용 순서/범위
1. **A(디바운스)** — 필수·즉효. main.ts +필드/가드 3~4줄, constants +1.
2. **B(초단위 dedup)** — 필수. saveGame 필터 1줄 + 덮어쓰기 경로(saveOverwrite 완료부)도 동일 비교 적용 점검.
3. **C(로드 청소)** — 권장(기존 중복 보유 사용자 구제). saveRepository(leaf) readStoredSlotList.
4. **D** — 구현 중 로그로 확인, 필요 시.
- 영향 파일: main.ts(A,B,로그), constants.ts(상수), saveRepository.ts(C, leaf). main.ts 순증 소폭 → 게이트 ratchet 가능.

## 5. 검증
- 저장 버튼/Ctrl+S **빠르게 3회 연타** → 슬롯 **1개만** 생성("방금 저장했습니다" 2회).
- 기존 3중복 보유 상태에서 로드 패널 진입 → **1개로 정리**(C) 또는 다음 저장 시 수렴(B).
- 정상 저장(간격 충분) → 평소처럼 1슬롯 추가, 다른 캐릭터 슬롯 보존 확인.
- 자동저장(별도 슬롯)·덮어쓰기 경로 회귀 없음 확인. save 관련 테스트(scripts/*save*) 기대값 갱신.

## 6. 리스크
- 낮음. A 는 순수 가드, B/C 는 비교만 초단위(savedAt 원본 불변). 파괴적 정리(C)는 "같은-초+동일 라벨"로 보수적 적용. 롤백 용이(상수/가드 제거).
