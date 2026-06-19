# 전직 시스템 설계 (Job Advancement) — 1·2·3차 (as-built)

> 상태: **1·2·3차 전직 전부 구현 완료** (브랜치 `feat/job-advancement-tier1`).
> 작업지침 정본은 `AGENTS.md`, 밸런스 컨텍스트는 `docs/boss-chapter-economy-balance.md`.

## 0. 한 줄 요약

레벨 도달(1차 30·2차 50·3차 70) + **차수별 전용 전직 아이템**(1차 전직의 표식 `job_seal` / 2차 전직의 각서 `job_decree` / 3차 상급 전직의 각서 `job_decree_high`)을 각 1개 사용해 전직하면 → ① **1차**: 직업별 새 3번째 스킬(F) 해금 · ② 전투 스탯이 차수마다 누적 상승(+5/+10/+17레벨) · ③ **2·3차**: 모든 스킬 쿨다운 단축(기존 스킬 강화) · ④ 차수가 오를수록 외형이 직업 특징에 맞게 화려해짐 · ⑤ 차수별 전직 퀘스트.

> **2026-06-19 개편**: 종전 "전직의 인장 1종을 차수당 1·2·3개" → **차수별 전용 아이템 3종**으로 변경. 전직의서 드랍이 흔해 1차가 너무 쉬웠던 점을 보정. 레시피: 표식 = 전직의서 3 / 각서 = 흑요석 2 + 표식 1 + 전직의서 5 / 상급 각서 = 표식 5 + 각서 1 + 용의 꼬리 1 + 흑요석 7. (내부 식별자 `JobTierDef.advanceItem`, 각 차수 1개 소비. 세이브 마이그레이션 불필요 — `job_seal` id·jobTier 불변.)

## 1. 확정 결정 (사용자 승인 2026-06-19)

| # | 결정 | 채택 |
| --- | --- | --- |
| D1 | "스킬 하나 더"의 정체 | **새 3번째 스킬 추가** (R 1차 / T 2차는 그대로, 1차 전직 시 F 3차 신규 해금) |
| D2 | 3차 스킬 단축키 | **F** |
| D4 | 전직 조건 | 레벨(1차 30·2차 50·3차 70) + 차수별 전용 전직 아이템 1개 사용 |
| D5 | 전직 아이템 흐름 | 전직의서 → 차수별 전직 아이템(표식/각서/상급 각서) 제작 → 사용 → 전직. 상위 아이템은 하위 아이템·고급 재료(흑요석·용의 꼬리)로 제작 *(2026-06-19 개편, 0번 항목 참조)* |
| D6 | 2·3차 방식 | **신규 스킬 없이 기존 스킬 강화** = 스탯 누적 상승 + 모든 스킬 쿨다운 단축(2차 ×0.85, 3차 ×0.8 누적) |

> 코드에 이미 직업별 2번째 스킬(T)이 잠금 없이 존재(`SECOND_SKILLS`). 1차 전직은 그걸 잠그는 게 아니라 **별도의 3번째 스킬(F)을 신규 해금**한다.

## 2. 현 코드 토대 (재사용)

| 시스템 | 근거 |
| --- | --- |
| 직업 6종 · 스킬 인프라(디스패치·쿨다운·UI) | `game/classes.ts`·`classSkills.ts`·`ui/skillBar.ts`·`main.ts` |
| 전직의서 `job_change_tome`(epic, 요새 보스 드랍) | `items.ts`·`main.ts` |
| 스탯 단일 레버 `levelStatBonus(L)=L-1` → HP·공격·방어·전 스킬 | `main.ts` |
| 외형 `createAvatarModel(...,jobTier)` + tier SSOT | `avatar.ts`·`game/tierVisuals.ts` |
| 퀘스트 `TUTORIAL_STEPS`+`ObjectiveSnapshot` / 세이브 마이그레이션 | `objectives.ts` / `saveMigration.ts` |

## 3. 데이터 모델 — `game/jobAdvancement.ts`

```ts
interface JobTierDef {
  tier: 1 | 2 | 3;
  title: string;            // 직업·차수별 칭호
  requiredLevel: number;    // 30 / 50 / 70
  statLevelBonus: number;   // 5 / 5 / 7 (levelStatBonus 에 누적 가산)
  advanceItem: ItemId;      // 차수별 전용 전직 아이템(1개 소비): job_seal / job_decree / job_decree_high
  unlockThirdSkill?: boolean;   // 1차만
  skillCooldownMult?: number;   // 2차 0.85 / 3차 0.8 (누적 곱)
}
export const JOB_TIERS: Record<PlayerClassId, JobTierDef[]>;  // 직업당 3차
```
- 헬퍼: `jobTierStatBonus`(누적 합, 할당 없는 루프) · `jobTierCooldownMult`(누적 곱) · `canAdvanceJob`(레벨+다음차수) · `jobTierTitle` · `normalizeJobTier`.
- 상태: `SavedGame.player.jobTier`(0~3). **SAVE_VERSION 11→12** + `jobTier`/`thirdSkillCooldownRemainingMs` 마이그레이션(구세이브 0) + roundtrip/migration 테스트.

## 4. 효과별 구현

| 효과 | 구현 |
| --- | --- |
| 새 3스킬(F, 1차) | `classSkills.THIRD_SKILLS`+`useThirdClassSkill`(2스킬 컨텍스트+광역/자가회복). `main.ts` F입력→`useThirdSkill`(jobTier<1 차단). `skillBar` 3슬롯 전직 시 표시 |
| 스탯 +레벨(누적) | `main.ts:levelStatBonus()` 에 `jobTierStatBonus` 가산 → HP·공격·방어·전 스킬 한 지점 상승 |
| 스킬 쿨다운 단축(2·3차) | `main.ts:trySpendSkill` cdMs 에 `jobTierCooldownMult` 곱 |
| 외형(차수 누적) | `game/jobTierVisuals.ts:createJobTierCosmetic` — `buildTier1/2/3` 레이어 누적. `avatar.ts` 가 `jobTier` 로 부착 |
| 제작→사용 | `job_seal`/`job_decree`/`job_decree_high`(items/itemInfo) + 레시피 3종(제작대) + `hotbarUse`(`isJobAdvanceItem`) → `tryAdvanceJob(usedItem)`(레벨·아이템 일치 확인·1개 소비·전이) |
| 퀘스트 | `objectives.ts` `advance_job_tier1/2/3` (jobTier>=N) |

## 5. 직업별 전직 사양 (칭호 / 외형 누적)

| 직업 | 1차 (Lv30) | 2차 (Lv50) | 3차 (Lv70) | 외형 진화 |
| --- | --- | --- | --- | --- |
| 전사 | 광전사 | 버서커 | 워로드 | 붉은 견갑→스파이크+오라→뿔+대형 망토 |
| 힐러 | 사제 | 주교 | 대성자 | 빛 고리→2중 고리→천사 날개 |
| 마법사 | 원소술사 | 대마법사 | 현자 | 룬 오브→오브 추가→머리 위 룬 큐브 |
| 소환사 | 야수술사 | 야수군주 | 정령왕 | 가죽 견갑·깃털→깃털 추가→정령 날개 |
| 거너 | 총사 | 저격수 | 총사령관 | 챙모자·탄띠→코트 자락→대형 챙+바이저 |
| 탱커 | 수호기사 | 성기사 | 불멸기사 | 강철 견갑→대형 견갑→왕관+등 배너 |

- 신규 스킬은 1차에서만(직업별 시그니처): 전사 대지가르기 · 힐러 심판의 빛 · 마법사 메테오 · 소환사 정령 폭풍 · 거너 관통 강탄 · 탱커 불굴의 함성.
- 2·3차는 새 스킬 없이 **스탯↑ + 전 스킬 쿨다운↓ + 외형 강화**.

## 6. 가드레일 준수

- 로직은 전부 리프(`jobAdvancement`·`jobTierVisuals`·`classSkills`·`hotbarUse`·`objectives`·`saveMigration`). main.ts는 배선만. ratchet 갱신 `MAX_MAIN_LINES 9489→9534`, `MAX_METHODS 460→462`(사유 주석+work-history).
- leaf 규칙(신규 모듈 main.ts import 없음) / save 마이그레이션+테스트 / 핫패스 무영향(외형은 아바타 1회 생성, 전직 로직은 update*/animate* 아님).
- **visual-check**: 외형/skillBar 변경 → 픽셀 베이스라인 갱신 필요. 차수별 메시 증가로 `perf-check` 전후 비교 권장.

## 7. 검증 (환경 제약)

- **개발 PC에 Node 미설치** → 이 머신에서 `npm run verify`/dev/visual-check 실행 불가. 코드는 패턴 준수로 작성·커밋했고 정적 점검만 수행(괄호/문자열 균형 OK, ratchet 실측, 타입 경유 지점 수기 확인, 차수 로직 단위 검증을 `gameplay-systems-test` 에 추가).
- **머지 전 dev 머신에서 `npm run verify`(+`verify:full`/`visual-check` 베이스라인 갱신) 실행 필수.** `master` push는 CI가 즉시 GitHub Pages 배포 → 검증 통과 후에만.

## 8. 추가 튜닝 여지 (코드 변경 없이 데이터로)

- 레벨/스탯/쿨다운/인장 비용은 `JOB_TIERS` 데이터만 조정. 차수별 신규 스킬을 원하면 `THIRD_SKILLS` 패턴을 4스킬로 확장(키 추가) — 단 단축키 예산 고려.
- 외형 강도/요소는 `jobTierVisuals` 의 `buildTier2/3` 에서 조정.
