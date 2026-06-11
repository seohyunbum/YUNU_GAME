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
    readSaveSlots,
    resolveSlotSave,
    writeJsonStorage,
    writeSaveSlots,
  } = repository;
  const { migrateSaveData } = migration;
  const {
    SAVE_BACKUP_KEY,
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

  assert.equal(slots.length, 1, "duplicate save entries should be deduped across list/latest/backup");
  assert.equal(slots[0].id, "slot-a", "first valid slot id should be preserved");
  assert.equal(slots[0].label, "Slot A", "stored slot label should be preserved");
  assert.equal(slots[0].description, "요약", "stored slot description should be preserved");
  const resolved = await resolveSlotSave(slots[0]);
  assert.equal(resolved.player.position.x, 1, "packed slot should decompress back to the same save");

  const exportedFile = JSON.stringify(migrateSaveData(resolved));
  const importedSave = migrateSaveData(JSON.parse(exportedFile));
  assert.deepEqual(importedSave, migrateSaveData(resolved), "file export/import roundtrip should preserve the migrated save");

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

  console.log(JSON.stringify({ ok: true, checks: ["json write probe", "latest backup", "compressed slot roundtrip", "file export/import roundtrip", "slot dedupe", "corrupt packed slot rejects", "broken slot recovery"] }, null, 2));
} finally {
  await server.close();
}
