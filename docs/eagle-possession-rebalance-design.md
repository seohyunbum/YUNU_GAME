# 독수리 빙의 후반 강화 — 상세설계서

> 상태: **설계 완료 / 구현 대기** (다른 세션 작업 완료 후 착수)
> 근거: 후반부 빙의가 무의미 → 사용자 지정 3개 변경. 데스크톱/모바일 공통(플랫폼 무관).

## 0. 목표 (사용자 스펙)
1. **생존 스케일**: 독수리 HP 65 / 방어 8 (고정) → **본체 HP + 65 / 본체 방어 + 8** (본체 능력치에 가산).
2. **데미지 스케일**: 빙의 공격이 **훈련스탯·제작분배·목걸이·버프 등을 본체와 동일하게** 반영.
3. **할퀴기(R)**: 쿨다운 30s → **14s** + **입힌 데미지의 30% 흡혈**(독수리 HP 회복).

## 1. 현재 구조 (요약)
- 빙의 데미지: `possessedEagleDamage(base, item, levelBonus) = base + WEAPON_DAMAGE[item] + levelBonus` ([eaglePossession.ts:32](../src/game/eaglePossession.ts)). **훈련/제작/목걸이/버프 누락.**
- 독수리 생성: `spawnEagleSummon` ([main.ts:4933](../src/main.ts))이 `hp: EAGLE_MAX_HP(65), armor: EAGLE_ARMOR(8)` 고정.
- 피격: 방어 `EAGLE_ARMOR` 고정, hp 차감, `EAGLE_MAX_HP`를 max로 메시지/HUD 표기 ([main.ts:4985~5001](../src/main.ts), HUD [main.ts:6456](../src/main.ts)).
- 할퀴기: `EAGLE_CLAW_DAMAGE(20)`, 쿨 `EAGLE_CLAW_COOLDOWN(30)` ([eaglePossession.ts:46~68](../src/game/eaglePossession.ts)).

---

## 2. 변경 ① — HP/방어를 본체 가산으로

### 2.1 신규 필드 (main.ts)
```ts
private eaglePossessionMaxHp = 0; // 빙의 시 독수리 최대 HP = 본체 maxHealth + EAGLE_MAX_HP (메시지·HUD·흡혈 캡)
```

### 2.2 생성 시 HP (spawnEagleSummon, main.ts:4933-4938)
```ts
// before: hp: EAGLE_MAX_HP, armor: EAGLE_ARMOR
this.eaglePossessionMaxHp = this.maxHealth + EAGLE_MAX_HP;   // 호출 직전(useSummonerSkill) 또는 여기서 세팅
const eagle = this.addWorldObject("eagleSummon", "소환 독수리", root, {
  hp: this.eaglePossessionMaxHp,        // = 본체 maxHealth + 65
  armor: EAGLE_ARMOR,                    // armor 필드는 표시용; 실제 피해계산은 §2.3 에서 동적
  ...
});
```
- ★결정: 시작 HP 기준은 **본체 maxHealth**(가득 찬 새 풀). 현재 HP 기준을 원하면 `this.health + EAGLE_MAX_HP` 로 1줄 교체(상처 입은 채 빙의하면 비례). **권장=maxHealth**(직관적).

### 2.3 피격 방어 (main.ts:4985)
```ts
// before: const armor = ignoreArmor ? 0 : EAGLE_ARMOR;
const armor = ignoreArmor ? 0 : this.equippedArmorValue() + EAGLE_ARMOR; // 본체 방어 + 8
```
- 동적 계산 → 빙의 중 본체 방어 버프(불굴/심판의빛 등)도 즉시 반영(스펙 "버프 동일"). `equippedArmorValue()`는 이미 장비·레벨·훈련·제작·목걸이·버프(×심판의빛) 합산.

### 2.4 max 표기 교체 (EAGLE_MAX_HP → eaglePossessionMaxHp)
- 피해 메시지 [main.ts:5000](../src/main.ts): `... ${Math.ceil(eagle.hp)}/${this.eaglePossessionMaxHp}`.
- HUD [main.ts:6456](../src/main.ts): `eagleMaxHp: this.eaglePossessionMaxHp`.
- (4937 `eagle.hp ?? EAGLE_MAX_HP` 폴백, 4993 동일 — 폴백값도 `this.eaglePossessionMaxHp` 권장이나 hp 는 항상 세팅되므로 무영향.)

---

## 3. 변경 ② — 빙의 데미지가 본체 능력치 전부 반영

### 3.1 본체 공격력 추출 (main.ts) — currentDamage 리팩터
현재 `currentDamage()`([main.ts:4850](../src/main.ts))는 빙의 시 `possessedEagleDamage(EAGLE_RAM_DAMAGE, item, bonus)` 반환. 비-빙의 분기(무기+레벨+훈련+제작+목걸이 ×버프)를 **메서드로 추출**:
```ts
private bodyMeleeAttackPower(): number {  // 본체 일반 근접 공격력(훈련/제작/목걸이/심판의빛 전부 포함)
  const bonus = this.levelStatBonus();
  const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
  const selectedMelee = selectedItem && !this.isRangedWeapon(selectedItem) ? (WEAPON_DAMAGE[selectedItem] ?? 0) : 0;
  return Math.round((Math.max(1, selectedMelee, this.bestPower(MELEE_WEAPON_DAMAGE)) + bonus
    + this.trainingStats.attack + this.craftStatAlloc.attack + necklaceAttackBonus(this.equippedNecklace))
    * empowerMultiplier(this.skillBuffs, performance.now()));
}
private currentDamage() {
  if (this.possessedEagleId) return this.bodyMeleeAttackPower() + EAGLE_RAM_DAMAGE; // 빙의 박치기 = 본체 공격력 + 5
  return this.bodyMeleeAttackPower();
}
```
- (원거리 빙의 분기 [main.ts:4870](../src/main.ts)도 동일하게 `bodyMeleeAttackPower() + EAGLE_RAM_DAMAGE` 로 교체.)

### 3.2 EagleActionContext: levelBonus → bodyAttackPower (eaglePossession.ts)
```ts
// interface 변경: levelBonus(): number  →  bodyAttackPower(): number;
// + 흡혈용(§4): healEagle(amount: number): void;
```
```ts
// possessedEagleDamage 재정의 — 무기/레벨 대신 본체 전체 공격력 + 스킬 플랫 보너스
export function possessedEagleDamage(skillBase: number, bodyAttack: number) {
  return skillBase + bodyAttack;   // bodyAttack 에 무기·훈련·제작·목걸이·버프 모두 포함
}
// eagleHeldWeaponDamage 는 더 이상 사용 안 함(제거 또는 유지 무방).
```
- 호출부 교체:
  - 할퀴기 [eaglePossession.ts:58](../src/game/eaglePossession.ts): `possessedEagleDamage(EAGLE_CLAW_DAMAGE, context.bodyAttackPower())`
  - 윈드커터 [eaglePossession.ts:90](../src/game/eaglePossession.ts): `possessedEagleDamage(WIND_CUTTER_DAMAGE, context.bodyAttackPower())`
  - 박치기(main.ts currentDamage)는 §3.1 에서 처리(컨텍스트 무관).
- main.ts eagleActionContext 배선: `bodyAttackPower: () => this.bodyMeleeAttackPower()` (기존 `levelBonus: () => this.levelStatBonus()` 교체).

> 효과: 할퀴기 = 본체공격력 + 20, 윈드커터 = 본체공격력 + 35, 박치기 = 본체공격력 + 5. 훈련/제작/목걸이/심판의빛 전부 반영 → 후반에도 본체 수준 화력.

---

## 4. 변경 ③ — 할퀴기 쿨 14s + 30% 흡혈

### 4.1 쿨다운 (constants.ts:123)
```ts
export const EAGLE_CLAW_COOLDOWN = 14; // 30 → 14
```

### 4.2 흡혈 (eaglePossession.ts tryEagleClaw, :58~)
```ts
const damage = possessedEagleDamage(EAGLE_CLAW_DAMAGE, context.bodyAttackPower());
context.setClawCooldownUntil(performance.now() + EAGLE_CLAW_COOLDOWN * 1000);
...
context.applyDamage(target, damage, "wind");
context.healEagle(Math.round(damage * 0.3)); // ★흡혈 30% — 독수리 HP 회복
context.renderHud();
```
- `healEagle` 배선(main.ts eagleActionContext):
```ts
healEagle: (amount) => {
  const eagle = this.possessedEagleId ? this.objects.get(this.possessedEagleId) : null;
  if (!eagle) return;
  eagle.hp = Math.min(this.eaglePossessionMaxHp, (eagle.hp ?? 0) + Math.max(0, amount));
  this.renderHud();
},
```
- ★흡혈 기준: 위 설계는 **할퀴기 산출 damage(대상 방어 적용 전)**의 30%. 실제 입힌 피해 기준이 더 정확하나, `applyDamage` 가 입힌 값을 반환하지 않음 → 산출값 기준으로 근사(단순·일관). 정밀히 하려면 applyDamage 가 적용 피해를 반환하도록 별도 변경 필요(범위 밖).
- 회복은 §2 의 동적 max(`eaglePossessionMaxHp`)로 캡.

---

## 5. 엣지/정합
- **빙의 종료/사망**: 기존대로 `eagle.hp <= 0` → `endEaglePossession(true)`. 흡혈로 hp 가 올라 생존 연장(의도).
- **본체 HP 무관**: 빙의 중 피해는 eagle.hp 에만 누적. 종료 시 본체는 자기 HP 유지(기존 동작 보존). 흡혈은 빙의 폼 지속용.
- **버프 동기**: equippedArmorValue·bodyMeleeAttackPower 모두 호출 시점 평가 → 빙의 중 버프 변화 즉시 반영.
- **저장**: 빙의는 휘발(저장 안 됨) → 세이브 변경 불필요. eaglePossessionMaxHp 도 런타임 필드.
- **HUD/메시지**: max 표기 일괄 `eaglePossessionMaxHp`.

## 6. main.ts 크기게이트
- 추가 추정: `bodyMeleeAttackPower` 메서드(+4), `currentDamage` 분기(±0), `eaglePossessionMaxHp` 필드(+1), eagleActionContext 에 `healEagle`/`bodyAttackPower`(거대 객체 라인 내 +0~1), 메시지/HUD/armor/spawn 교체(±0). ⇒ **약 +6**. `MAX_MAIN_LINES` **ratchet** 필요(다른 세션과 겹치면 isolated-hunk).
- eaglePossession.ts·constants.ts 는 leaf(게이트 무관).

## 7. 밸런스 메모 (구현 후 검토)
- 빙의 화력이 **본체 + 흡혈 + 14s 할퀴기 + 본체방어+65HP**로 크게 상향 → 강력. 과하면: 할퀴기 base(20)·흡혈%·EAGLE_*_DAMAGE/HP 보너스 상수로 조정.
- 윈드커터 쿨 40s(>빙의 30s)는 이번 스펙 밖 — 필요 시 후속(예 18~20s)으로 빙의 중 재사용 가능하게.

## 8. 구현 체크리스트
1. constants.ts: `EAGLE_CLAW_COOLDOWN` 30→14.
2. eaglePossession.ts: EagleActionContext(`levelBonus`→`bodyAttackPower`, `healEagle` 추가) · `possessedEagleDamage` 시그니처 · 할퀴기/윈드커터 호출 교체 · 할퀴기 흡혈 1줄.
3. main.ts: `eaglePossessionMaxHp` 필드 · `bodyMeleeAttackPower` 추출 + currentDamage(근접/원거리) 분기 · spawnEagleSummon hp · 피격 armor · 메시지/HUD max · eagleActionContext(`bodyAttackPower`/`healEagle`).
4. `npm run build && npm run verify` (필요 시 MAX_MAIN_LINES ratchet).
5. 배포 → 소환사로 빙의 후반 화력·생존·흡혈 체감 검증 → 상수 튜닝.

## 9. 범위 밖 (후속 후보)
- 윈드커터 쿨다운 단축, 빙의를 '고기동 돌진/광역' 정체성으로 차별화(T 바람정령과 중복 해소), 흡혈을 실제-입힌-피해 기준으로 정밀화(applyDamage 반환값).
