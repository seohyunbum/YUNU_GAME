// 파티 아이템 거래 비가역 원장 — 세이브-스컴 복제(dupe) 차단.
//
// 문제: 파티로 아이템을 동료에게 넘긴 뒤 "저장 안 하고 불러오기" 하면, 롤백된 내 세이브엔 아이템이 그대로라
//       동료(보관)와 합쳐 복제된다. 저장 슬롯이 여러 개라 단순 "준 것 빼기"로는 이중차감/누락이 생긴다.
//
// 해법: 파티 주고받기 이벤트를 "캐릭터(플레이스루)별"로 단조 증가 epoch 와 함께 기록(세이브 밖 localStorage).
//       epoch 는 거래마다 +1(이벤트 구동) — 세이브는 그 시점 카운터를 "기록만" 한다(올리지 않음 → 읽기전용 안전).
//       불러오기 시 save.epoch 를 "초과하는" 이벤트만 인벤에 재적용 → 그 세이브 이후의 파티 거래가 다시 반영되어
//       넘긴 아이템이 돌아오지 않는다. 솔로/죽음 드랍은 기록하지 않으므로 기존처럼 불러오기로 복구된다(사용자 요구).
//
// 캐릭터별 분리: '1번 마법사'와 '2번 마법사'는 서로 다른 characterId 라 원장이 섞이지 않는다.
// 순수 모듈(주입식 storage) — node 에서 단위테스트 가능.

import type { ItemId } from "./types";

export const PARTY_LEDGER_KEY = "ai-game-lab:party-transfer-ledger-v1";
const MAX_EVENTS_PER_CHARACTER = 5000; // 무한증가 방지(넉넉히). 과보존은 안전, 과소제거만 위험하므로 크게 둔다.

export interface LedgerEvent {
  epoch: number; // 단조 증가 — 비교(>savedEpoch) + 재적용 순서 둘 다 담당
  item: ItemId;
  delta: number; // <0 = 나감/양도(OUTBOUND), >0 = 받음(INBOUND)
  durabilityUsed?: number; // 참고용(재적용은 addItem/removeItem 의미를 따름)
}
interface CharacterLedger {
  counter: number; // 이 캐릭터의 단조 증가 epoch 카운터(최신값)
  events: LedgerEvent[]; // epoch 오름차순(추가 순)
}
type LedgerStore = Record<string, CharacterLedger>;

// localStorage 호환 최소 인터페이스 (테스트에서 in-memory 주입).
export interface LedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readStore(storage: LedgerStorage): LedgerStore {
  try {
    const parsed = JSON.parse(storage.getItem(PARTY_LEDGER_KEY) ?? "null") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as LedgerStore) : {};
  } catch {
    return {};
  }
}
function writeStore(storage: LedgerStorage, store: LedgerStore): void {
  try {
    storage.setItem(PARTY_LEDGER_KEY, JSON.stringify(store));
  } catch {
    // quota 등 — 게임을 막지 않는다(기록 실패 시 그 1건은 비가역화 안 됨. 차단보다 진행 우선).
  }
}
function charLedger(store: LedgerStore, characterId: string): CharacterLedger {
  let led = store[characterId];
  if (!led) {
    led = { counter: 0, events: [] };
    store[characterId] = led;
  }
  return led;
}

// 캐릭터의 현재 epoch 카운터(최신). 불러오기 후 라이브 카운터를 이 값으로 이어 단조성 유지.
export function latestPartyLedgerEpoch(storage: LedgerStorage, characterId: string): number {
  if (!characterId) return 0;
  return readStore(storage)[characterId]?.counter ?? 0;
}

// 파티 거래 1건 기록 — 카운터 +1 후 그 값을 epoch 로 이벤트 추가. 새 카운터 반환(호출자가 currentEpoch 동기화).
export function appendPartyLedgerEvent(storage: LedgerStorage, characterId: string, item: ItemId, delta: number, durabilityUsed?: number): number {
  const store = readStore(storage);
  const led = charLedger(store, characterId);
  if (!characterId || delta === 0) return led.counter;
  led.counter += 1;
  led.events.push({ epoch: led.counter, item, delta, durabilityUsed });
  if (led.events.length > MAX_EVENTS_PER_CHARACTER) led.events.splice(0, led.events.length - MAX_EVENTS_PER_CHARACTER);
  writeStore(storage, store);
  return led.counter;
}

export interface ReconcileApply {
  add(item: ItemId, count: number): boolean; // 인벤 추가, 성공 여부
  remove(item: ItemId, count: number): void; // 인벤 제거(없으면 0까지만)
  onLeftover(item: ItemId, count: number): void; // add 실패분(인벤 꽉 참) — 유실 방지로 바닥에 떨구는 등
}

// 불러오기 — savedEpoch 를 "초과하는" 이벤트만 epoch(=추가) 순으로 인벤에 재적용.
export function reconcilePartyLedger(storage: LedgerStorage, characterId: string, savedEpoch: number, apply: ReconcileApply): void {
  if (!characterId) return;
  const led = readStore(storage)[characterId];
  if (!led) return;
  for (const event of led.events) {
    if (event.epoch <= savedEpoch) continue; // 이 세이브가 이미 반영한 거래
    if (event.delta < 0) apply.remove(event.item, -event.delta);
    else if (event.delta > 0) { if (!apply.add(event.item, event.delta)) apply.onLeftover(event.item, event.delta); }
  }
}

// 새 게임 — 해당 캐릭터 원장 초기화.
export function clearPartyLedger(storage: LedgerStorage, characterId: string): void {
  if (!characterId) return;
  const store = readStore(storage);
  delete store[characterId];
  writeStore(storage, store);
}
