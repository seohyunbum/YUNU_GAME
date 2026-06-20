# 스킬 밸런스 조정 — 상세설계서 (6종)

> 상태: **설계 완료 / 구현 대기** (다른 세션 작업 완료 후 착수)
> 근거: 밸런스 검토(효용성/마나/쿨타임) 후 사용자 지정 6개 조정. 데스크톱/모바일 공통.
> 기준 코드: classSkills.ts·classPassives.ts 가 최근(다른 세션) 변경됨 — 본 설계는 그 현재값 기준.

## 변경 요약
| # | 스킬 | 변경 | 난이도 |
|---|---|---|---|
| 1 | mage TNT 발사(R) | 마나 10→**15**, 쿨 10→**11** | 단순 |
| 2 | gunner 강탄(R) | 쿨 45→**30** | 단순 |
| 3 | mage 메테오(F) | 쿨 32→**22** | 단순 |
| 4 | tanker 불타는 방패(T) | 마나 35→**40**, 지속 30→**20**, 쿨 60→**50** | 단순 |
| 5 | summoner 바람 정령(T) | coeff 1.2→**1.4**, 쿨 20→**16** | 단순 |
| 6 | **tanker 불굴의 함성(F)** | 효과 **변경** → 자신+파티 전원 **방어 +20%/20초**, 쿨 70→**60** | **신규 메커니즘** |

---

## 1. mage TNT 발사 (R) — 마나 15 / 쿨 11
`src/game/constants.ts:132-133`
```ts
export const MAGE_TNT_COST = 15;     // 10 → 15
export const MAGE_TNT_COOLDOWN = 11; // 10 → 11
```
(R 핸들러 useMageSkill 가 이 상수로 trySpend — 코드 무수정, 상수만.)

## 2. gunner 강탄 (R) — 쿨 30
`src/game/constants.ts:137`
```ts
export const GUNNER_SKILL_COOLDOWN = 30; // 45 → 30
```
(GUNNER_SKILL_COST 등 그대로. 단순.)

## 3. mage 메테오 (F) — 쿨 22
`src/game/classSkills.ts:324` THIRD_SKILLS.mage literal:
```ts
mage: { name: "메테오", summary: "...", manaCost: 55, cooldown: 22 }, // cooldown 32 → 22
```

## 4. tanker 불타는 방패 (T) — 마나 40 / 지속 20 / 쿨 50
- `src/game/classSkills.ts:48` SECOND_SKILLS.tanker literal:
```ts
tanker: { name: "불타는 방패", summary: "20초 동안 방어 +1, 가까이 붙은 적이 매초 화상 피해.", manaCost: 40, cooldown: 50 }, // manaCost 35→40, cooldown 60→50, summary 30→20초
```
- `src/game/classSkills.ts:73` 지속 상수:
```ts
export const BURNING_SHIELD_SECONDS = 20; // 30 → 20
```
(방어 +1·화상 coeff 등 나머지 그대로.)

## 5. summoner 바람 정령 (T) — coeff 1.4 / 쿨 16
- `src/game/classSkills.ts:69` 데미지 공식:
```ts
export function windSpiritDamage(levelBonus: number) {
  return scaledSkillValue(WIND_CUTTER_DAMAGE, levelBonus, 1.4); // coeff 1.2 → 1.4
}
```
- `src/game/classSkills.ts:46` SECOND_SKILLS.summoner literal:
```ts
summoner: { name: "바람 정령", summary: "...", manaCost: 25, cooldown: 16 }, // cooldown 20 → 16
```
(WIND_CUTTER_DAMAGE base·mana 그대로. 빙의 윈드커터(possessedEagleDamage)는 별도 경로라 무관.)

---

## 6. ★ tanker 불굴의 함성 (F) — 파티 방어버프로 효과 변경

### 현재
`useThirdClassSkill` tanker 분기(classSkills.ts:~403-410): `buffs.unbreakableUntil`(자신 방어 +6, 20초) + 주변 즉시 화상 burst. THIRD_SKILLS.tanker(classSkills.ts:327) mana50/cd70.

### 변경 후
**자신 포함 같은 맵 파티원 전원에게 방어력 +20% / 20초 버프.** burst·자신전용 +6 폐지. cd 70→60.
→ **이미 구현된 "심판의 빛"(empower 파티 버프) 패턴을 그대로 미러**한다(이번 세션 구현분). 단 방어 전용 ×1.2, 20초.

### 6.1 classSkills.ts (leaf)
```ts
// SkillBuffs 에 필드 추가 (line 86 unbreakableUntil 옆/대체)
rallyDefUntil: number; // 불굴의 함성 — 자신·파티 방어 ×RALLY_DEF_MULT

// createSkillBuffs(line 93) / resetSecondSkillEffects 에 rallyDefUntil: 0 추가

// 상수
export const RALLY_DEF_MULT = 1.2;     // 방어 +20%
export const RALLY_DEF_SECONDS = 20;   // 지속 20초
export const RALLY_PARTY_RADIUS = 999; // 같은 맵 파티원 전원(EMPOWER_PARTY_RADIUS 와 동일)

// 헬퍼 (empowerMultiplier 옆)
export function rallyDefenseMultiplier(buffs: SkillBuffs, now: number) {
  return buffs.rallyDefUntil > now ? RALLY_DEF_MULT : 1;
}

// import: partyEmpowerNearby 옆에 partyRallyNearby 추가 (from "./partyPresence")
```
```ts
// THIRD_SKILLS.tanker (classSkills.ts:327) — summary·cooldown 변경
tanker: { name: "불굴의 함성", summary: "20초 동안 자신과 파티원 전체의 방어력을 +20% 높입니다.", manaCost: 50, cooldown: 60 },
```
```ts
// useThirdClassSkill tanker 분기(403-410) 교체 — burst·unbreakable 제거, 파티 방어버프
  if (!context.trySpend(skill)) return;
  context.castImpact();
  context.buffs.rallyDefUntil = context.now() + RALLY_DEF_SECONDS * 1000; // 자신
  const buffed = partyRallyNearby(RALLY_DEF_SECONDS * 1000, RALLY_PARTY_RADIUS); // 파티원
  context.playHandAction("melee");
  context.playTone(220, 0.2, "sawtooth", 0.035);
  context.showMessage(buffed > 0 ? `불굴의 함성! 20초간 나와 파티원 ${buffed}명 방어 +20%.` : "불굴의 함성! 20초간 방어 +20%.");
  context.renderHud();
```
- 정리(선택): `unbreakableUntil`·`unbreakableArmorBonus`·`UNBREAKABLE_SECONDS`·`UNBREAKABLE_ARMOR`·`RALLY_BURST_RADIUS` 는 이제 미사용 → 제거 가능(main.ts equippedArmorValue 의 `unbreakableArmorBonus(...)` 항도 함께 제거). 남겨도 항상 0이라 무해하나 정리 권장.

### 6.2 partyPresence.ts (leaf) — partyEmpowerNearby 미러
```ts
// 송신 (partyEmpowerNearby 와 동일 구조)
export function partyRallyNearby(durationMs: number, radius: number): number {
  const session = context?.session();
  if (!session || !context) return 0;
  const me = context.localPresence();
  if (!me.inGame) return 0;
  const radiusSq = radius * radius;
  let count = 0;
  for (const remote of remotes.values()) {
    if (!remote.onLocalMap) continue;
    const dx = remote.root.position.x - me.x, dz = remote.root.position.z - me.z;
    if (dx * dx + dz * dz > radiusSq) continue;
    session.sendGame({ type: "partyRally", recipient: remote.data.nickname, durationMs, mapId: me.mapId });
    count += 1;
  }
  return count;
}
// 수신 (receiveGame 의 partyEmpower 블록 옆)
if (message.type === "partyRally") {
  const me = context.localPresence();
  if (message.recipient === me.nickname && me.inGame && message.mapId === me.mapId) context.world?.rallyLocalPlayer?.(message.durationMs);
}
```

### 6.3 party.ts (leaf) — 메시지 타입
```ts
// PartyMessage 유니온에 추가 (partyEmpower 옆)
| { type: "partyRally"; recipient: string; durationMs: number; mapId: string }
```

### 6.4 partyWorldSync.ts (leaf) — 컨텍스트
```ts
// PartyWorldContext 에 (empowerLocalPlayer 옆)
rallyLocalPlayer?(durationMs: number): void;
```

### 6.5 main.ts
```ts
// equippedArmorValue(4902-4903) — 방어 총합에 ×rallyDefenseMultiplier 추가
return Math.round((... 기존 합 ...) * empowerMultiplier(this.skillBuffs, performance.now()) * rallyDefenseMultiplier(this.skillBuffs, performance.now()));
// (import: classSkills 에서 rallyDefenseMultiplier 추가. unbreakableArmorBonus 항은 6.1 정리 시 제거.)

// 파티 컨텍스트(initPartyPresence world 객체, ~935) — empowerLocalPlayer 옆에 추가
rallyLocalPlayer: (durationMs) => { this.skillBuffs.rallyDefUntil = performance.now() + durationMs; this.showMessage("아군의 불굴의 함성! 20초간 방어 +20%."); this.renderHud(); },
```

### 6.6 정합/엣지
- empower(심판의빛)와 **독립 버프** — 두 버프 동시 활성 시 방어 = base × 1.1(empower) × 1.2(rally) 곱연산. 의도된 스택(설계상 허용; 과하면 가산으로 변경 가능).
- 휘발 버프(저장 안 함). 사망/로드 시 reset(resetSecondSkillEffects 에 rallyDefUntil=0).
- 호출 시점 평가 → 빙의 등에도 즉시 반영(equippedArmorValue 가 빙의 방어계산에도 쓰임).

---

## 7. 영향/게이트
- 1·2·3·4·5: 전부 leaf(constants/classSkills) 상수·literal — main.ts 무관, 게이트 무영향.
- 6: classSkills·partyPresence·party·partyWorldSync(leaf) + main.ts(equippedArmorValue ±0 줄 수정, 파티 컨텍스트 +1 property = 거대 라인 내, 필드 추가 가능성). main.ts 순증 시 `MAX_MAIN_LINES` ratchet. 6.1 정리(unbreakable 제거)로 상쇄 가능.
- 테스트: gameplay-systems-test/content-test 에 불굴의함성·바람정령·메테오·TNT·강탄 관련 단정이 있으면 기대값 갱신(예 EAGLE 처럼). 구현 시 verify 로 확인.

## 8. 구현 체크리스트
1. constants.ts: MAGE_TNT_COST 15·MAGE_TNT_COOLDOWN 11·GUNNER_SKILL_COOLDOWN 30.
2. classSkills.ts: 메테오 cd22 · 불타는방패(mana40/cd50/summary)·BURNING_SHIELD_SECONDS 20 · 바람정령(coeff1.4/cd16) · 불굴의함성(§6.1: 필드·상수·헬퍼·THIRD_SKILLS·분기·import).
3. partyPresence.ts: partyRallyNearby + receiveGame partyRally.
4. party.ts: partyRally 타입. partyWorldSync.ts: rallyLocalPlayer.
5. main.ts: equippedArmorValue ×rallyDefenseMultiplier + rallyLocalPlayer 배선 (+ unbreakable 정리).
6. build·verify(테스트 기대값 갱신, 필요 시 ratchet) → 배포.
