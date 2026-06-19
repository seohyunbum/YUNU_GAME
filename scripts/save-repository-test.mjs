import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  store = new Map();

  get length() {
    return this.store.size;
  }

  key(index) {
    return [...this.store.keys()][index] ?? null;
  }

  getItem(key) {
    return this.store.get(key) ?? null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const repository = await server.ssrLoadModule("/src/game/saveRepository.ts");
  const migration = await server.ssrLoadModule("/src/game/saveMigration.ts");
  const constants = await server.ssrLoadModule("/src/game/constants.ts");

  const {
    backupLatestSave,
    persistLatestSaveQuietly,
    readSaveSlots,
    readStoredSlotList,
    promoteSaveToSlotList,
    resolveSlotSave,
    writeJsonStorage,
    writeLatestSave,
    writeSaveSlots,
  } = repository;
  const { migrateSaveData } = migration;
  const {
    SAVE_BACKUP_KEY,
    SAVE_AUTOSAVE_KEY,
    SAVE_HISTORY_KEY,
    SAVE_KEY,
    SAVE_LIST_KEY,
    SAVE_WRITE_TEST_KEY,
  } = constants;

  const storage = new MemoryStorage();
  const save = migrateSaveData({
    version: 1,
    savedAt: "2026-01-01T00:00:00.000Z",
    player: {
      position: { x: 1, y: 2, z: 3 },
      totalSteps: 12,
      hotbar: [{ item: "tutorial_book", count: 1 }],
      bagSlots: [],
      craftSlots: [],
    },
    mountains: [],
    objects: [],
  });

  writeJsonStorage(SAVE_KEY, save, storage);
  assert.ok(storage.getItem(SAVE_KEY), "latest save should be written");
  assert.equal(storage.getItem(SAVE_WRITE_TEST_KEY), null, "write probe key should be removed");

  backupLatestSave(storage);
  assert.equal(storage.getItem(SAVE_BACKUP_KEY), storage.getItem(SAVE_KEY), "latest save should be copied to backup");

  await writeSaveSlots(
    [
      { id: "slot-a", savedAt: save.savedAt, label: "Slot A", description: "요약", save },
      { id: "slot-duplicate", savedAt: save.savedAt, label: "Duplicate", save },
    ],
    storage,
  );
  assert.ok(storage.getItem(SAVE_LIST_KEY), "save slot list should be written");
  const storedList = JSON.parse(storage.getItem(SAVE_LIST_KEY));
  assert.ok(storedList[0].packed && !storedList[0].save, "slots should be stored compressed (packed, no raw save)");

  const slots = readSaveSlots({
    migrateSaveData,
    formatSaveDate: (savedAt) => `formatted:${savedAt}`,
    storage,
  });

  // 명명 슬롯은 id 로 구분 — savedAt 가 같아도 서로 다른 슬롯(slot-a/slot-duplicate)이면 둘 다 보존(저장했는데 안 보이던 유실 방지).
  // latest(SAVE_KEY)/backup 의 같은 savedAt 사본만 억제되어 중복 표시되지 않는다.
  assert.equal(slots.length, 2, "distinct named slots (by id) must both stay visible; only latest/backup copies are suppressed");
  assert.ok(!slots.some((s) => s.id === "latest-save" || s.id === "backup-save"), "latest/backup copies of a named slot must not appear as extra phantom slots");
  assert.equal(slots[0].id, "slot-a", "first valid slot id should be preserved");
  assert.equal(slots[0].label, "Slot A", "stored slot label should be preserved");
  assert.equal(slots[0].description, "요약", "stored slot description should be preserved");
  const resolved = await resolveSlotSave(slots[0]);
  assert.equal(resolved.player.position.x, 1, "packed slot should decompress back to the same save");

  const exportedFile = JSON.stringify(migrateSaveData(resolved));
  const importedSave = migrateSaveData(JSON.parse(exportedFile));
  assert.deepEqual(importedSave, migrateSaveData(resolved), "file export/import roundtrip should preserve the migrated save");

  // 최신본(SAVE_KEY)도 압축 스텁으로 저장된다 — 대형 세이브의 raw JSON 이 quota 를 먹지 않도록
  await writeLatestSave(save, storage);
  const latestStub = JSON.parse(storage.getItem(SAVE_KEY));
  assert.ok(latestStub.packed && !latestStub.player, "latest save should be stored packed, not raw");
  const latestListed = readSaveSlots({ migrateSaveData, formatSaveDate: (savedAt) => savedAt, storage });
  const latestResolved = await resolveSlotSave(latestListed.find((slot) => slot.savedAt === save.savedAt));
  assert.equal(latestResolved.player.position.x, 1, "packed latest save should resolve back to the same save");

  // 용량 초과 시: 백업본을 희생하고 한 번 더 시도한다
  let failuresLeft = 1;
  const flakyStorage = new MemoryStorage();
  flakyStorage.setItem(SAVE_BACKUP_KEY, "백업본");
  const originalSet = flakyStorage.setItem.bind(flakyStorage);
  flakyStorage.setItem = (key, value) => {
    if (key !== SAVE_BACKUP_KEY && failuresLeft > 0) {
      failuresLeft -= 1;
      throw new Error("QuotaExceededError(시뮬레이션)");
    }
    originalSet(key, value);
  };
  writeJsonStorage("quota-key", { ok: true }, flakyStorage);
  assert.equal(flakyStorage.getItem(SAVE_BACKUP_KEY), null, "quota pressure should evict the backup copy");
  assert.ok(flakyStorage.getItem("quota-key"), "retry after evicting the backup should succeed");

  // 로드 중 북키핑은 조용히 실패한다 — 저장소가 완전히 막혀도 로드를 막지 않는다
  const blockedStorage = new MemoryStorage();
  blockedStorage.setItem = () => {
    throw new Error("storage blocked");
  };
  const persisted = await persistLatestSaveQuietly(save, blockedStorage);
  assert.equal(persisted, false, "persistLatestSaveQuietly must swallow storage failures and report false");

  // 손상된 압축 슬롯: 목록에는 남되 resolveSlotSave 가 reject 해야 한다 — UI 는 이 reject 를 잡아 우아하게 실패한다.
  storage.setItem(SAVE_LIST_KEY, JSON.stringify([{ id: "slot-bad", savedAt: "2026-02-02T00:00:00.000Z", label: "Corrupt", packed: btoa("NOT_VALID_DEFLATE") }]));
  const corruptSlot = readSaveSlots({
    migrateSaveData,
    formatSaveDate: (savedAt) => `formatted:${savedAt}`,
    storage,
  }).find((slot) => slot.id === "slot-bad");
  assert.ok(corruptSlot, "a corrupt packed slot should still be listed so the UI can show it");
  await assert.rejects(() => resolveSlotSave(corruptSlot), "resolving a corrupt packed slot must reject so callers can catch it");

  storage.setItem(SAVE_LIST_KEY, JSON.stringify([{ save: { version: 999 } }, { id: "slot-a", save }]));
  const recoveredSlots = readSaveSlots({
    migrateSaveData,
    formatSaveDate: (savedAt) => `formatted:${savedAt}`,
    storage,
  });
  assert.equal(recoveredSlots.length, 1, "broken slot list entries should be ignored");

  // allowTrim:false (덮어쓰기 '교체만') — 공간 부족이면 다른 슬롯을 조용히 떨구지 않고 throw + 기존 SAVE_LIST 그대로 보존.
  // (적대적 감사에서 확인된 '덮어쓰기 시 비선택 슬롯이 무경고로 사라지던' 데이터 유실의 회귀 가드)
  {
    const capStorage = new MemoryStorage();
    const seeded = JSON.stringify([{ id: "keep", savedAt: "2026-03-01T00:00:00.000Z", label: "Keep", packed: "AA" }]);
    capStorage.setItem(SAVE_LIST_KEY, seeded);
    const realSet = capStorage.setItem.bind(capStorage);
    capStorage.setItem = (key, value) => {
      if (key === SAVE_LIST_KEY) { let n = 0; try { n = JSON.parse(value).length; } catch {} if (n > 1) throw new Error("QuotaExceededError(시뮬레이션: 슬롯 1개만 수용)"); }
      realSet(key, value);
    };
    const twoSlots = [
      { id: "keep", savedAt: "2026-03-01T00:00:00.000Z", label: "Keep", save },
      { id: "incoming", savedAt: "2026-03-10T00:00:00.000Z", label: "Incoming", save },
    ];
    await assert.rejects(() => writeSaveSlots(twoSlots, capStorage, { allowTrim: false }), "allowTrim:false must throw under quota, not silently drop a non-chosen slot");
    assert.equal(capStorage.getItem(SAVE_LIST_KEY), seeded, "failed allowTrim:false write must leave the existing SAVE_LIST untouched (no slot lost)");
    const storedCount = await writeSaveSlots(twoSlots, capStorage);
    assert.ok(storedCount < twoSlots.length, "default writeSaveSlots trims under quota and reports a reduced count");
  }

  // 점증 희생(graceful) — quota 가 BACKUP 제거만으로 풀리면 AUTOSAVE/HISTORY(복구 링)는 보존(과거엔 세 키를 통째로 전삭제했다).
  {
    const gradualStorage = new MemoryStorage();
    gradualStorage.setItem(SAVE_BACKUP_KEY, "백업본");
    gradualStorage.setItem(SAVE_AUTOSAVE_KEY, "자동저장");
    gradualStorage.setItem(SAVE_HISTORY_KEY, "복구링");
    const baseSet = gradualStorage.setItem.bind(gradualStorage);
    gradualStorage.setItem = (key, value) => {
      // 'main' 키 쓰기는 BACKUP 이 남아있는 동안에만 실패(=BACKUP 제거하면 통과)
      if (key === "main" && gradualStorage.getItem(SAVE_BACKUP_KEY) !== null) throw new Error("QuotaExceededError(시뮬레이션)");
      baseSet(key, value);
    };
    writeJsonStorage("main", { ok: 1 }, gradualStorage);
    assert.equal(gradualStorage.getItem(SAVE_BACKUP_KEY), null, "gradual sacrifice removes the least-valuable key (backup) first");
    assert.equal(gradualStorage.getItem(SAVE_AUTOSAVE_KEY), "자동저장", "autosave ring is preserved when backup alone frees enough space");
    assert.equal(gradualStorage.getItem(SAVE_HISTORY_KEY), "복구링", "history recovery ring is preserved (no wholesale wipe)");
    assert.ok(gradualStorage.getItem("main"), "the primary write succeeds after gradual sacrifice");
  }

  // promoteSaveToSlotList — 명명 슬롯에 없던 로드 세이브(백업/자동저장 복구·유령 latest)를 명명 슬롯으로 승급.
  // 이미 있으면 무시(중복 방지), 가득(MAX)이면 승급 안 함(다른 슬롯 떨굼 방지). 유령 슬롯이 저장 2회 만에 사라지던 유실의 회귀 가드.
  {
    const promoStorage = new MemoryStorage();
    const opts = { migrateSaveData, formatSaveDate: (a) => a, storage: promoStorage };
    assert.equal(await promoteSaveToSlotList(save, opts), true, "loading a save absent from the slot list should promote it to a named slot");
    assert.equal(readStoredSlotList(opts).length, 1, "promotion adds exactly one named slot");
    assert.equal(await promoteSaveToSlotList(save, opts), false, "re-promoting the same savedAt is a no-op (no duplicate)");
    assert.equal(readStoredSlotList(opts).length, 1, "no duplicate named slot after re-promote");
    const full = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, savedAt: `2026-04-${String(i + 10)}T00:00:00.000Z`, label: `S${i}`, packed: "AA" }));
    promoStorage.setItem(SAVE_LIST_KEY, JSON.stringify(full));
    const freshSave = migrateSaveData({ version: 1, savedAt: "2026-05-05T00:00:00.000Z", player: { position: { x: 7, y: 0, z: 0 }, totalSteps: 1, hotbar: [], bagSlots: [], craftSlots: [] }, mountains: [], objects: [] });
    assert.equal(await promoteSaveToSlotList(freshSave, opts), false, "promotion must not run when slots are full (would risk dropping another slot)");
    assert.equal(readStoredSlotList(opts).length, 10, "a blocked (full) promotion leaves the slot list untouched");
  }

  console.log(JSON.stringify({ ok: true, checks: ["json write probe", "latest backup", "compressed slot roundtrip", "file export/import roundtrip", "slot dedupe", "packed latest save", "quota fallback evicts backup", "quiet bookkeeping failure", "corrupt packed slot rejects", "broken slot recovery", "allowTrim:false overwrite preserves other slots (no silent loss)", "graceful quota: gradual sacrifice", "promote loaded phantom save to named slot"] }, null, 2));
} finally {
  await server.close();
}
