# 전직 시스템 설계 (Job Advancement) — 1차 전직 (as-built)

> 상태: **1차 전직 구현 완료** (브랜치 `feat/job-advancement-tier1`). 2·3차는 데이터 구조만 미리 확장하고 비워 둠.
> 작업지침 정본은 `AGENTS.md`, 밸런스 컨텍스트는 `docs/boss-chapter-economy-balance.md`.

## 0. 한 줄 요약

레벨 30 도달 + **전직의서**로 만든 **전직의 인장**을 사용해 **1차 전직**하면 → ① 직업별 **새 3번째 스킬(F)** 해금 · ② 전투 스탯이 "+5레벨"만큼 상승 · ③ 외형이 직업 특징에 맞게 멋있어짐 · ④ 전직 퀘스트로 안내. 차수(1·2·3차)는 데이터로 미리 설계하되 지금은 1차만 채움.

## 1. 확정 결정 (사용자 승인 2026-06-19)

| # | 결정 | 채택 |
| --- | --- | --- |
| D1 | "스킬 하나 더"의 정체 | **새 3번째 스킬 추가** (기존 R 1차 / T 2차는 그대로, 전직 시 F 3차 신규 해금) |
| D2 | 3차 스킬 단축키 | **F** (WASD 근처 홈로우, 사용자가 우려한 Y보다 가까움) |
| D4 | 1차 전직 조건 | **레벨 ≥ 30** + 전직의 인장 사용 |
| D5 | 전직 아이템 흐름 | **전직의서 → 전직의 인장 제작 → 인장 사용 → 전직** |
| D6 | 차수 확장 | `JOB_TIERS[class][]` 배열 — 1차만 채움. 2·3차는 신규 스킬 대신 `skillUpgrade`(기존 스킬 강화) 필드로 설계 |

> 참고: 코드에는 이미 직업별 2번째 스킬(T)이 잠금 없이 존재한다(`SECOND_SKILLS`). 1차 전직은 그것을 잠그는 게 아니라 **별도의 3번째 스킬(F)을 새로 해금**한다.

## 2. 현 코드 토대 (재사용)

| 시스템 | 근거 |
| --- | --- |
| 직업 6종 `Record<PlayerClassId>` | `game/classes.ts`, `game/types.ts` |
| 스킬 인프라(1·2스킬 디스패치·쿨다운·UI) | `game/classSkills.ts`, `ui/skillBar.ts`, `main.ts` |
| 전직의서 `job_change_tome`(epic, 요새 보스 드랍) | `items.ts`, `main.ts` |
| 스탯 단일 레버 `levelStatBonus(L)=L-1` → HP(+2/Lv)·공격(+1/Lv)·**방어(+1/Lv)**·전 스킬 | `main.ts:levelStatBonus/currentDamage/currentArmor/maxHealthForLevel` |
| 외형 `createAvatarModel(...,classId,armorTier,jobTier)` + tier SSOT | `avatar.ts`, `game/tierVisuals.ts` |
| 퀘스트 `TUTORIAL_STEPS` + `ObjectiveSnapshot` | `objectives.ts` |
| 세이브 마이그레이션 | `game/saveMigration.ts`, `SAVE_VERSION` |

## 3. 데이터 모델 (3차 확장형 · 1차만 구현)

- 상태: `SavedGame.player.jobTier`(0=미전직, 1=1차…). 신규 리프 `game/jobAdvancement.ts` 의 `JOB_TIERS: Record<PlayerClassId, JobTierDef[]>`.
- `JobTierDef = { tier, title, requiredLevel, statLevelBonus, unlockThirdSkill?, skillUpgrade? }`.
- `skillUpgrade`(미사용·예약) = 2·3차에서 신규 스킬 대신 기존 스킬 강화(`{ target, damageMult?, cooldownMult? }`).
- **SAVE_VERSION 11 → 12** + `jobTier`/`thirdSkillCooldownRemainingMs` 마이그레이션(구세이브 기본 0) + roundtrip/migration 테스트.

## 4. 다섯 효과의 구현

### 4.1 새 3번째 스킬 (F)
- `game/classSkills.ts` 에 `THIRD_SKILLS` 테이블 + `useThirdClassSkill(ThirdSkillContext)` (2스킬 컨텍스트 재사용 + 광역대상/자가회복 보강). 신규 버프 `unbreakableUntil`(탱커) + `unbreakableArmorBonus`.
- `main.ts`: F 입력 → `useThirdSkill()`(jobTier<1이면 안내 후 차단) → `useThirdClassSkill(thirdSkillContext)`. 쿨다운 슬롯 `"third"` 추가.
- `ui/skillBar.ts`: jobTier>=1이면 3번째 슬롯(F) 표시, 미전직이면 숨김.

### 4.2 스탯 "+5레벨"
- `main.ts:levelStatBonus()` 한 줄에 `jobTierStatBonus(class, jobTier)` 가산 → HP·공격·방어·전 스킬이 한 지점에서 +5레벨치 상승. 전직 직후 `maxHealth` 재계산(레벨업 경로 재사용).

### 4.3 외형
- 신규 순수 팩토리 `game/jobTierVisuals.ts:createJobTierCosmetic(classId, jobTier)`. `avatar.ts` 가 `jobTier` 파라미터로 코스메틱 부착. 아바타 1회 생성(거울/파티)이라 핫패스 무관. **visual-check 픽셀 베이스라인 갱신 필요**.

### 4.4 전직 아이템: 제작 → 사용
- 신규 아이템 `job_seal`("전직의 인장", epic) — `items.ts`/`itemInfo.ts`.
- 레시피(`recipes.ts`, 제작대): `job_change_tome 1 + gold 3 → job_seal 1`.
- 사용(`hotbarUse.ts`): `job_seal` → `ctx.tryAdvanceJob()`.
- `main.ts:tryAdvanceJob()`: `canAdvanceJob`(레벨 30 확인) → 인장 소비 → jobTier++ → 스탯 재계산 → 외형 갱신 → 팡파레/메시지.

### 4.5 전직 퀘스트
- `objectives.ts`: `checkQuest("advance_job_tier1", s => s.jobTier >= 1, ...)` (요새 보스 퀘 뒤). `ObjectiveSnapshot.jobTier` 추가.

## 5. 직업별 1차 전직 사양

| 직업 | 1차 칭호 | 신규 3번째 스킬(F) | 스탯(+5레벨 공통) | 외형 컨셉 |
| --- | --- | --- | --- | --- |
| 전사 | 광전사 | **대지가르기**(주변 광역 공격력 2배) | HP+10·공격+5·방어+5 | 붉은 견갑+스파이크 + 등 망토 |
| 힐러 | 사제 | **심판의 빛**(신성 투사체+자힐 30) | 〃 | 머리 위 빛 고리 + 성스러운 천 |
| 마법사 | 원소술사 | **메테오**(대형 운석 광역) | 〃 | 떠다니는 룬 오브 + 발광 보석 |
| 소환사 | 야수술사 | **정령 폭풍**(주변 바람 광역) | 〃 | 가죽 견갑 + 깃털 + 금빛 토템 |
| 거너 | 총사 | **관통 강탄**(고속 관통탄) | 〃 | 챙모자 + 어깨 탄띠 |
| 탱커 | 수호기사 | **불굴의 함성**(방어+6 20초+광역 화상) | 〃 | 대형 강철 견갑 + 가슴 엠블럼 |

## 6. 가드레일 준수

- **main.ts**: 로직은 전부 리프(`jobAdvancement`·`jobTierVisuals`·`classSkills`·`hotbarUse`·`objectives`·`saveMigration`)에. main.ts는 배선만(필드·F입력·levelStatBonus 1줄·useThirdSkill·thirdSkillContext·tryAdvanceJob·세이브/로드/스냅샷·아바타 인자). 순증으로 ratchet 갱신: `MAX_MAIN_LINES 9489→9532`, `MAX_METHODS 460→462` (사유 주석 + work-history 기록).
- **leaf 규칙**: 신규 모듈 main.ts import 없음(`check:architecture` 통과).
- **save**: SAVE_VERSION↑ + 마이그레이션 + roundtrip/migration 테스트 보강.
- **perf/hotpath**: 신규 코드는 update*/animate* 가 아니며 핫패스 할당 0(`check:hotpath` 무영향).
- **visual-check**: 외형/skillBar 변경 → 픽셀 베이스라인 갱신 필요.

## 7. 검증 (중요 — 환경 제약)

- **개발 PC에 Node 미설치** → 이 머신에서 `npm run verify`/dev 서버 실행 불가. 코드는 패턴을 정확히 따라 작성·브랜치 커밋했고, **검증은 dev 머신에서 `npm run verify`(필요 시 `verify:full` + `visual-check` 베이스라인 갱신) 실행 필요**.
- CI(`deploy.yml`)는 `master` push 시에만 `tsc && vite build` + GitHub Pages 배포 → 검증 전 master push 금지.
- 로컬에서 수행한 정적 점검: 변경 파일 괄호·문자열 균형(OK), ratchet 실측 갱신(9532줄/462메서드), 타입 경유 지점(`PartialSavedGame`·material 시그니처·`fireSkillProjectile` "arrow" 허용) 수기 확인.

## 8. 후속 (2·3차)

- `JOB_TIERS[class]` 에 tier 2·3 push: `requiredLevel`↑, `statLevelBonus`↑, `skillUpgrade`(기존 스킬 강화).
- 상위 전직의서/인장 아이템 + 외형 `jobTier>=2` 분기(`jobTierVisuals`).
- 2·3차 전직 퀘스트 단계.
