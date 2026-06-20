# 직업별 패시브 개편 — 상세 설계서 (구현 대기)

> 상태: **구현 완료** (2026-06). classPassives.ts/items.ts/classSkills.ts/main.ts 에 반영, verify+E2E 통과.
> 코드 라인은 동시 배포로 이동 가능 → **심볼(함수/상수)명 기준**으로 기술.
> 관련 파일: `src/game/classPassives.ts`(데이터), `src/game/tanker.ts`(방어합산), `src/main.ts`(스탯 계산·회복·이동·스킬), `src/game/classSkills.ts`(2·3스킬 데미지).

## 0. 변경 요약 (직업 × 효과)

| 직업 | 방어 | 회복 | 무기조건 데미지 | 기타 |
|---|---|---|---|---|
| 전사 warrior | 기본 **+4**, **레벨업당 +0.2** | — | **근접무기** 장착 시 **+10%**(스킬 포함) | — |
| 힐러 healer | — | 체력 +0.25/s **+ 마나 +0.25/s** | **지팡이** 장착 시 **+10%**(스킬·**힐량** 포함) | — |
| 마법사 mage | — | 마나 회복 ×2(기존) | **지팡이** 장착 시 **+15%**(스킬 포함) | — |
| 소환사 summoner | — | — | **지팡이** 장착 시 **+10%**(스킬 포함) | 독수리 펫(기존) |
| 거너 gunner | — | — | — | **총기** 장착 시 쿨다운 ×0.667(조건화), **이동속도 +10%** |
| 탱커 tanker | 기본 **+8**, **레벨업당 +0.4** | **방패 장착 시 체력 +(0.25 + 레벨/50)/s** | — | — |

핵심 변경점 3가지: ① 방어에 **레벨 스케일** 신설(전사 base 6→4, 탱커 base 8 유지), ② **무기 종류 조건부 데미지 배수**(전사 근접/힐·마·소 지팡이), ③ 거너 쿨감을 **총기 전용으로 조건화** + 이동속도, 탱커 방패 회복.

---

## 1. 데이터 모델 — `ClassPassive` 인터페이스 확장 (`classPassives.ts`)

기존 필드: `armorBonus`, `rangedCooldownScale`, `manaRegenScale`, `healthRegenPerSec`, `pet?`.

**추가 필드:**
```ts
export interface ClassPassive {
  // ...기존...
  armorPerLevel: number;            // 레벨업(레벨-1)당 방어 가산. 전사 0.2 / 탱커 0.4 / 그 외 0
  manaRegenFlat: number;            // 마나 회복 평탄 가산(초당). 힐러 0.25 / 그 외 0
  shieldHealthRegenBase: number;    // 방패 장착 시 체력 회복 base(초당). 탱커 0.25 / 그 외 0
  shieldHealthRegenPerLevel: number;// 방패 장착 시 레벨당 추가 회복(초당). 탱커 0.02(=1/50) / 그 외 0
  moveSpeedMult: number;            // 이동속도 배수. 거너 1.1 / 그 외 1
  gunOnlyRangedCooldown: boolean;   // rangedCooldownScale 을 총기 장착 시에만 적용. 거너 true / 그 외 false
  weaponDamage?: { group: "melee" | "staff"; pct: number; affectsHeal?: boolean }; // 무기조건 데미지 배수. 전사{melee,0.10}/힐러{staff,0.10,affectsHeal}/마법사{staff,0.15}/소환사{staff,0.10}
}
```

**값 테이블 (구현 시 그대로 세팅):**

| class | armorBonus | armorPerLevel | manaRegenScale | manaRegenFlat | healthRegenPerSec | shieldHealthRegenBase | shieldHealthRegenPerLevel | rangedCooldownScale | gunOnlyRangedCooldown | moveSpeedMult | weaponDamage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| warrior | **4** (was 6) | **0.2** | 1 | 0 | 0 | 0 | 0 | 1 | false | 1 | **{melee,0.10}** |
| healer | 0 | 0 | 1 | **0.25** | 0.25 | 0 | 0 | 1 | false | 1 | **{staff,0.10,affectsHeal:true}** |
| mage | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 1 | false | 1 | **{staff,0.15}** |
| summoner | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | false | 1 | **{staff,0.10}** |
| gunner | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **0.667** | **true** | **1.1** | — |
| tanker | **8** | **0.4** | 1 | 0 | 0 | **0.25** | **0.02** | 1 | false | 1 | — |

> 마이그레이션 영향 **없음** — 패시브는 직업에서 파생되는 런타임 값이고 세이브에 저장되지 않음.

---

## 2. 무기군 판별 헬퍼 (신설)

`src/game/items.ts` 또는 신규 `src/game/weaponGroups.ts` 에 정의(리프). main.ts 가 import.

```ts
// 지팡이류 = 마법 투사체 무기 (RANGED_PROJECTILE[item] === "magic" 과 동치)
export const STAFF_WEAPONS = new Set<ItemId>(["magic_wand", "crystal_staff", "arcane_staff", "sharp_obsidian_staff"]);
export function isStaffWeapon(item: ItemId | null | undefined) { return Boolean(item && STAFF_WEAPONS.has(item)); }

// 근접무기 = WEAPON_DAMAGE 보유 && 원거리 아님 && 방패 아님 (도끼 포함 확정 — 결정 #1)
export function isMeleeWeapon(item: ItemId | null | undefined) {
  return Boolean(item && WEAPON_DAMAGE[item] !== undefined && !RANGED_WEAPONS.has(item)
    && item !== "iron_shield" && item !== "sharp_obsidian_shield");
}
// 총기류 = 기존 GUN_WEAPONS (pistol/rifle/sharp_obsidian_gun) 재사용
```

**무기조건 데미지 배수 헬퍼** (`classPassives.ts`):
```ts
import { isStaffWeapon, isMeleeWeapon } from "./items";
export function classWeaponDamageMult(playerClass: PlayerClassId, heldItem: ItemId | null): number {
  const wd = CLASS_PASSIVES[playerClass].weaponDamage;
  if (!wd) return 1;
  const match = wd.group === "melee" ? isMeleeWeapon(heldItem) : isStaffWeapon(heldItem);
  return match ? 1 + wd.pct : 1;
}
```
`heldItem` = `this.hotbar[this.selectedHotbarIndex]?.item ?? null` (현재 손에 든 슬롯).

---

## 3. 방어: base + 레벨 스케일

**현재:** `tanker.ts equipmentArmorValue()` 가 `... + CLASS_PASSIVES[class].armorBonus + guard` 반환. 레벨 미반영.

**변경:** 레벨 가산은 `main.ts equippedArmorValue()` 에서 더한다(거기서만 `this.level` 접근 가능, `tanker.ts` 시그니처 변경 불필요).
```ts
// main.ts equippedArmorValue() 의 합산식에 추가:
+ CLASS_PASSIVES[this.playerClass].armorPerLevel * Math.max(0, Math.floor(this.level) - 1)
```
- **주의:** `levelStatBonus()` 가 아니라 `Math.floor(this.level)-1` 사용. `levelStatBonus()` 는 이제 `jobTierStatBonus`(전직 보너스)를 포함하므로 "레벨업당"의 의도와 어긋남.
- `armorBonus` 값만 테이블대로 교체(전사 6→4). 탱커는 8 유지.
- 최종 방어는 `Math.round(... )` 로 감싸므로 소수 0.2/0.4 누적은 자연 반올림됨(현재 구조 그대로).
- **밸런스 메모:** 전사는 레벨11(레벨업 10회)에서 4+2.0=6 으로 구 수치 회복 → 그 이하 구간은 약간 물러짐. 탱커는 전 구간 순상향.

---

## 4. 회복: 힐러 마나 +0.25/s, 탱커 방패 체력 +1/s

**현재:** `main.ts updateMana()`
```ts
let healthRegen = (CLASS_PASSIVES[class].healthRegenPerSec + HUNGER_HP_REGEN[hungerLevel]) * restMul;
// ...isResting floor..., hunger<=0 → 0
this.mana += (MANA_REGEN_PER_SECOND * manaRegenScale + necklaceManaRegenBonus(...)) * delta;
```

**변경 (체력 — 탱커 방패, 레벨 스케일):** 초당 `0.25 + 레벨/50`.
```ts
// restMul 곱 이후 평탄 가산(휴식배수 비적용). 레벨은 raw 레벨(Math.floor(this.level)).
const p = CLASS_PASSIVES[this.playerClass];
healthRegen += (this.equippedShield ? p.shieldHealthRegenBase + p.shieldHealthRegenPerLevel * Math.floor(this.level) : 0);
```
- 위치: `let healthRegen = ...` 다음 줄, `isResting floor`/`hunger<=0 → 0` 보다 **앞**. → 배고픔 0이면 함께 정지(기존 규칙 일관). 침대 floor 와는 `Math.max` 라 더 큰 쪽 적용.
- 수치 예: Lv1 = 0.27/s, Lv25 = 0.75/s, Lv50 = 1.25/s. (방패 미장착 시 0)
- **레벨 기준:** 사용자 지정 공식 그대로 raw 레벨(`level/50`). `levelStatBonus()`(전직 포함) 아님.

**변경 (마나 — 힐러 평탄):**
```ts
this.mana = Math.min(this.maxMana, this.mana
  + (MANA_REGEN_PER_SECOND * manaRegenScale + CLASS_PASSIVES[class].manaRegenFlat + necklaceManaRegenBonus(this.equippedNecklace)) * delta);
```
- 평탄 보너스(0.25)는 `necklaceManaRegenBonus` 와 동일하게 **restMul 미적용**(평탄). manaRegenScale 만 restMul 곱(기존 유지).
- **밸런스 메모:** 탱커 +1/s 는 최대체력 대비 강력한 자가 지속력 → 방패 상시 착용 유도. 수치 과하면 0.5 로 조정 여지.

---

## 5. 무기조건 데미지 배수 — 기본공격 + 스킬 (핵심·복잡)

설계 원칙: `empowerMultiplier`(심판의 빛 ×1.1)와 **동일 패턴**으로 `classWeaponDamageMult` 를 곱한다. 두 배수는 곱연산으로 자연 스택(의도).

### 5-1. 기본공격 (필수)
- **근접:** `bodyMeleeAttackPower()` 최종 반환을 `* classWeaponDamageMult(this.playerClass, heldItem)` 로 감쌈. → 전사 근접 +10%.
  - `currentDamage()` 는 `bodyMeleeAttackPower()` 에 위임하므로 자동 반영.
  - **자동 포함:** 전사 2스킬 **불타는 공격**(`burningStrikeDamage = currentDamage×2`), 3스킬 **대지가르기**(`earthCleaveDamage = currentDamage×2`) → currentDamage 경유라 **별도 처리 금지(이중적용 주의)**.
- **원거리/마법:** `currentRangedDamage(item)` 최종 반환을 `* classWeaponDamageMult(this.playerClass, item)` 로 감쌈. → 힐러/마법사/소환사가 지팡이 발사 시 +10/15/10%. (거너는 weaponDamage 없음 → 1.0)

### 5-2. 플랫(고정 스케일) 즉발 스킬 (스킬데미지 커버용)
currentDamage 에서 파생되지 **않는** 스킬은 명시적으로 곱해야 함. `heldItem` 기준 동일 헬퍼 사용.

| 스킬 | 직업 | 계산 함수 | 위치 | 조치 |
|---|---|---|---|---|
| 무거운공격(1) 폭발 | warrior | `warriorExplosionDamage` | main.ts(폭발 장판 생성부) | `* classWeaponDamageMult` |
| TNT발사(1) | mage | `mageTntDamage` | main.ts | `* classWeaponDamageMult` |
| 파이어볼(2) | mage | `fireballDamage` | classSkills.ts `useSecondClassSkill` | context.`damageMult()` 곱 |
| 메테오(3) | mage | `meteorDamage` | classSkills.ts `useThirdClassSkill` | context.`damageMult()` 곱 |
| 바람 정령(2) | summoner | `windSpiritDamage` | classSkills.ts | context.`damageMult()` 곱 |
| 강탄(1)/관통(3) | gunner | `gunnerShotDamage`/`piercingShotDamage` | main.ts/classSkills | **무변경**(거너 데미지배수 없음) |
| **천상치유(1) 힐량** | healer | `healerHealAmount` | main.ts(힐러 1스킬) | **`* classWeaponDamageMult`** (힐량도 +10% — 결정 #2) |
| 치유의 비(2)/심판의 빛(3) | healer | `healingRainTick`/buff | classSkills.ts(틱)/buff | **무변경**(HoT 틱은 §5-3 DoT 제외, 버프는 데미지 아님) |

**classSkills 컨텍스트 확장:** `SecondSkillContext`·`ThirdSkillContext` 에 `damageMult(): number` 추가. main.ts 의 `secondSkillContext`/`thirdSkillContext` 에서 `() => classWeaponDamageMult(this.playerClass, this.hotbar[this.selectedHotbarIndex]?.item ?? null)` 로 주입. 각 플랫 스킬 데미지에 곱하되, **`burningStrikeDamage`/`earthCleaveDamage` 에는 곱하지 않음**(이미 currentDamage 경유).

### 5-3. 지속(DoT) 스킬 — 범위 결정 필요
`spiritStormDamage`(소환사 정령폭풍), 화상/가시, `healingRainTick`(치유의 비) 등 틱은 `updateSecondSkillEffects` 에서 틱 시점에 재계산되어 **시전 시 무기 정보가 없음**.
- **확정(v1, 결정 #5):** 모든 DoT/HoT 틱은 배수 **제외**(즉발 명중·즉발 힐만 커버).
- **선택(v2, 미채택):** 시전 시 `classWeaponDamageMult` 를 곱한 값을 버프 상태에 저장해 틱에 사용(정령폭풍은 `spiritStormTicksLeft` 와 함께 `spiritStormDamageCached` 추가). 추가 복잡도 있어 v1 보류.

---

## 6. 거너 — 총기 전용 쿨감 + 이동속도

**쿨다운 (총기 전용화):** `main.ts fireRangedWeapon(item)` 의
```ts
... * CLASS_PASSIVES[this.playerClass].rangedCooldownScale * ...
```
를
```ts
... * (CLASS_PASSIVES[this.playerClass].gunOnlyRangedCooldown && !GUN_WEAPONS.has(item) ? 1 : CLASS_PASSIVES[this.playerClass].rangedCooldownScale) * ...
```
로 변경. → 거너가 **활/지팡이**를 쏠 땐 0.667 미적용(1.0), **총기**일 때만 0.667. (기존 `GUN_FIRE_RATE_SCALE` 는 그대로 별도 적용 — 총기는 두 보정 모두 받음, 의도.)

**이동속도:** `main.ts` 이동 계산 `let speed = WALK_SPEED * (sprinting ? RUN_MULTIPLIER : 1);` 에 곱:
```ts
let speed = WALK_SPEED * (sprinting ? RUN_MULTIPLIER : 1) * CLASS_PASSIVES[this.playerClass].moveSpeedMult;
```
→ 거너 상시 +10%. 웅크리기(×0.38)·걷기(×0.62)와도 곱연산으로 일관. (점프/중력 등 수직은 불변.)

---

## 7. UI/표기 반영 (선택)
- `CLASS_PASSIVES[*].summary` 문구를 새 효과로 갱신(전사 "방어 +4, 레벨당 +0.2 / 근접 무기 +10% 피해" 등). 타이틀 화면 직업 선택·캐릭터창 노출.
- 캐릭터창(K) 공격력/방어력 표시는 `displayedAttackPower()`/`equippedArmorValue()` 경유라 배수 자동 반영(별도 작업 불필요).

---

## 8. 결정 사항 (사용자 확정 완료, 2026-06)
1. ✅ **근접무기에 도끼 포함.** `isMeleeWeapon` = WEAPON_DAMAGE 보유 && 원거리 아님 && 방패 아님 → 도끼 포함, 방패만 제외. (§2 그대로)
2. ✅ **맨손 보너스 없음** (WEAPON_DAMAGE 없는 손은 배수 1.0).
3. ✅ **힐러 +10% 힐량에도 적용.** 천상치유(즉발 힐) 적용. 치유의 비(HoT 틱)는 §5-3 DoT 제외 규칙에 따라 v1 미적용.
4. ✅ **펫/빙의 비적용** — 독수리 펫 데미지·빙의 박치기는 플레이어 무기 데미지가 아님.
5. ✅ **DoT v1 제외 확정** — 정령폭풍·화상·가시·치유의비 틱 모두 배수 미적용. (필요 시 v2에서 시전값 캐시)
6. ✅ **탱커 방패 회복 = 초당 0.25 + 레벨/50** (레벨 스케일, §4). 배고픔 0 시 정지 일관.
7. ✅ **전사 방어 base 6→4 의도 확정** — 저레벨 약화 / Lv11에서 구수치(6) 회복 / 이후 상향.
8. (참고) **방어 소수 누적:** 최종 `Math.round` 반올림에 의존(중간 소수 유지). 정수 고정 원하면 `Math.floor` 사전 절삭 — 현재는 반올림 유지.

---

## 9. 검증 계획 (구현 후)
- **유닛(content/systems golden):** `classWeaponDamageMult`(직업×무기 매트릭스), 방어 base+레벨, 회복 가산을 순수함수로 골든 테스트.
- **E2E (`scripts/_tmp-*.mjs`, `window.__wildernessGame`):**
  - 직업별로 `g.playerClass` 세팅 + 무기 장착(`g.hotbar` selected) 후 `g.displayedAttackPower()` 배수 확인(전사 근접 ×1.1, 마법사 지팡이 ×1.15 등; 무관 무기 시 ×1.0).
  - `g.equippedArmorValue()` 가 레벨에 따라 증가(전사/탱커), 비교군 불변 확인.
  - 거너: 총기 vs 활 `g.rangedCooldown` 차이, 이동속도 배수.
  - 탱커: `equippedShield` 유/무 + 레벨별 `updateMana` 체력 회복 차이(Lv1≈0.27, Lv50≈1.25/s).
  - 힐러: 마나 회복률 +0.25/s, **지팡이 장착 시 천상치유 힐량 ×1.1**(다른 무기 시 ×1.0).
- `npm run verify` + `npm run build` 녹색, main.ts 라인/메서드 예산 준수(헬퍼는 리프 파일로 빼 main.ts 증분 최소화).
