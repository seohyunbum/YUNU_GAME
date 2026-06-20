// 파티 거래 비가역 원장 단위테스트 (순수 로직, headless). `npm run verify` 에 포함.
// 핵심: save.epoch 초과 이벤트만 재적용 → 파티로 넘긴 아이템은 어떤 세이브 불러와도 안 돌아옴(복제 차단), 단 유실도 0(보존).
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
let failures = 0;
const assert = (cond, msg) => { if (!cond) { console.error("✗", msg); failures++; } };

try {
  const { appendPartyLedgerEvent, latestPartyLedgerEpoch, reconcilePartyLedger, clearPartyLedger } = await server.ssrLoadModule("/src/game/partyLedger.ts");

  const makeStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  const makeInv = (init = {}, addOk = true) => {
    const inv = { ...init };
    return { inv, add: (i, c) => { if (!addOk) return false; inv[i] = (inv[i] ?? 0) + c; return true; }, remove: (i, c) => { inv[i] = Math.max(0, (inv[i] ?? 0) - c); }, onLeftover: () => {} };
  };

  // 1. give → reload-old-save: 준 아이템이 다시 빠진다(복제 차단의 핵심)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "stone", -5); // epoch 1
    const a = makeInv({ stone: 5 }); reconcilePartyLedger(s, "A", 0, a); // savedEpoch 0
    assert(a.inv.stone === 0, `give→reload-old: stone 0 기대, got ${a.inv.stone}`); }

  // 2. reload save@(양도 이후): 이중차감 없음
  { const s = makeStore(); const e = appendPartyLedgerEvent(s, "A", "stone", -5); // returns 1
    const a = makeInv({ stone: 0 }); reconcilePartyLedger(s, "A", e, a); // savedEpoch 1 >= event epoch 1
    assert(a.inv.stone === 0, `no double-remove: stone 0 유지, got ${a.inv.stone}`); }

  // 3. deposit(-) + bounce(+) 순증 0 (창고 입고 후 가득차 되돌림)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "iron", -3); appendPartyLedgerEvent(s, "A", "iron", 3);
    const a = makeInv({ iron: 3 }); reconcilePartyLedger(s, "A", 0, a);
    assert(a.inv.iron === 3, `deposit+bounce net 0: iron 3, got ${a.inv.iron}`); }

  // 4. 캐릭터 격리
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "gold", -1);
    const b = makeInv({ gold: 1 }); reconcilePartyLedger(s, "B", 0, b);
    assert(b.inv.gold === 1, `char isolation: B의 gold 불변, got ${b.inv.gold}`); }

  // 5. inbound 재적용(받은 뒤 옛 세이브 로드 → 보존)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "meat", 2);
    const a = makeInv({}); reconcilePartyLedger(s, "A", 0, a);
    assert(a.inv.meat === 2, `inbound replay: meat 2, got ${a.inv.meat}`); }

  // 6. inbound 인벤 가득 → onLeftover (유실 방지)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "wood", 4); let leftover = 0;
    reconcilePartyLedger(s, "A", 0, { add: () => false, remove: () => {}, onLeftover: (i, c) => { leftover += c; } });
    assert(leftover === 4, `inbound full → onLeftover 4, got ${leftover}`); }

  // 7. 추가 순서대로 재적용(-then+ 순증 0)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "coal", -2); appendPartyLedgerEvent(s, "A", "coal", 2);
    const a = makeInv({ coal: 2 }); reconcilePartyLedger(s, "A", 0, a);
    assert(a.inv.coal === 2, `seq net: coal 2, got ${a.inv.coal}`); }

  // 8. clear(새 게임): 이벤트 삭제
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "stone", -1); clearPartyLedger(s, "A");
    const a = makeInv({ stone: 1 }); reconcilePartyLedger(s, "A", 0, a);
    assert(a.inv.stone === 1, `clear: 이벤트 사라짐, stone 1, got ${a.inv.stone}`); }

  // 9. latestPartyLedgerEpoch = 카운터 최신값
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "stone", -1); appendPartyLedgerEvent(s, "A", "iron", -1);
    assert(latestPartyLedgerEpoch(s, "A") === 2, `latest epoch 2, got ${latestPartyLedgerEpoch(s, "A")}`); }

  // 10. 단조성: 옛 세이브 로드 후에도 새 이벤트 epoch 는 카운터 이어받아 더 커짐(중복 epoch 없음)
  { const s = makeStore(); appendPartyLedgerEvent(s, "A", "stone", -1); // epoch 1
    const a = makeInv({ stone: 1 }); reconcilePartyLedger(s, "A", 0, a); // 옛 세이브@0 로드 모사
    const e2 = appendPartyLedgerEvent(s, "A", "iron", -1); // 로드 후 새 거래
    assert(e2 === 2, `reload 후 새 이벤트 epoch 2, got ${e2}`); }

  // 11. ★저장 실패(quota) → 카운터 전진 안 함 + 이벤트 미영속(epoch 가 디스크보다 앞서가 과다/과소 재적용되는 소실·복제 차단)
  { const m = new Map(); let throwing = false;
    const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (throwing) throw new Error("quota"); m.set(k, v); } };
    const e1 = appendPartyLedgerEvent(s, "A", "stone", -1); assert(e1 === 1, `정상 기록 counter 1, got ${e1}`);
    throwing = true; const e2 = appendPartyLedgerEvent(s, "A", "iron", -1); // 저장 실패
    assert(e2 === 1, `저장 실패 시 prev 카운터 반환(전진 안 함), got ${e2}`);
    throwing = false; assert(latestPartyLedgerEpoch(s, "A") === 1, `디스크 카운터 1 유지(실패분 미영속), got ${latestPartyLedgerEpoch(s, "A")}`); }

  // 12. ★마이그레이션 보존 — characterId/partyLedgerEpoch 가 살아남아야(stripped 되면 매 로드 epoch 0=과다재적용→소실). 구세이브는 생략(legacy 백필).
  { const { migrateSaveData } = await server.ssrLoadModule("/src/game/saveMigration.ts");
    const kept = migrateSaveData({ player: { characterId: "uuid-xyz", partyLedgerEpoch: 7 } });
    assert(kept.player.characterId === "uuid-xyz", `마이그레이션이 characterId 보존, got ${kept.player.characterId}`);
    assert(kept.player.partyLedgerEpoch === 7, `마이그레이션이 partyLedgerEpoch 보존, got ${kept.player.partyLedgerEpoch}`);
    const legacy = migrateSaveData({ player: {} });
    assert(legacy.player.characterId === undefined && legacy.player.partyLedgerEpoch === undefined, `구세이브는 필드 생략(legacy 백필용)`); }

} finally {
  await server.close();
}

if (failures > 0) { console.error(`\nPARTY-LEDGER TEST: ${failures} 실패`); process.exit(1); }
console.log("✓ party-ledger-test: 전부 통과");
