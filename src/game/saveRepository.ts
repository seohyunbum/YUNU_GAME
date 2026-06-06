import {
  MAX_SAVE_SLOTS,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_LIST_KEY,
  SAVE_WRITE_TEST_KEY,
} from "./constants";
import type { PartialSavedGame, SavedGame, SaveSlot, StoredSaveSlot } from "./types";

export interface ReadSaveSlotsOptions {
  migrateSaveData: (save: PartialSavedGame) => SavedGame;
  formatSaveDate: (savedAt: string) => string;
  storage?: Storage;
}

export function backupLatestSave(storage = localStorage) {
  const rawLatest = storage.getItem(SAVE_KEY);
  if (rawLatest) storage.setItem(SAVE_BACKUP_KEY, rawLatest);
}

export function writeJsonStorage(key: string, value: unknown, storage = localStorage) {
  const raw = JSON.stringify(value);
  storage.setItem(SAVE_WRITE_TEST_KEY, raw);
  storage.removeItem(SAVE_WRITE_TEST_KEY);
  storage.setItem(key, raw);
}

export function createSaveSlot(save: SavedGame, formatSaveDate: (savedAt: string) => string): SaveSlot {
  return {
    id: `save-${crypto.randomUUID()}`,
    savedAt: save.savedAt,
    label: formatSaveDate(save.savedAt),
    save,
  };
}

export function readSaveSlots({
  migrateSaveData,
  formatSaveDate,
  storage = localStorage,
}: ReadSaveSlotsOptions): SaveSlot[] {
  const slots: SaveSlot[] = [];
  const seen = new Set<string>();
  const addSlot = (candidate: unknown, fallbackId: string) => {
    try {
      if (!candidate || typeof candidate !== "object") return;
      const record = candidate as StoredSaveSlot & PartialSavedGame;
      const source = record.save ?? record;
      const save = migrateSaveData(source as PartialSavedGame);
      const dedupeKey = `${save.savedAt}:${save.player.position.x.toFixed(2)},${save.player.position.y.toFixed(2)},${save.player.position.z.toFixed(2)}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      slots.push({
        id: typeof record.id === "string" ? record.id : fallbackId,
        savedAt: save.savedAt,
        label: typeof record.label === "string" ? record.label : formatSaveDate(save.savedAt),
        save,
      });
    } catch {
      // Ignore a broken entry so the rest of the save list still works.
    }
  };

  try {
    const rawList = storage.getItem(SAVE_LIST_KEY);
    if (rawList) {
      const parsed = JSON.parse(rawList) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((entry, index) => addSlot(entry, `save-list-${index}`));
      }
    }
  } catch {
    // Fall through to the legacy single-save slot below.
  }

  try {
    const rawLatest = storage.getItem(SAVE_KEY);
    if (rawLatest) addSlot(JSON.parse(rawLatest), "latest-save");
  } catch {
    // No usable legacy/latest save.
  }

  try {
    const rawBackup = storage.getItem(SAVE_BACKUP_KEY);
    if (rawBackup) addSlot(JSON.parse(rawBackup), "backup-save");
  } catch {
    // No usable backup save.
  }

  return slots.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export function writeSaveSlots(slots: SaveSlot[], storage = localStorage) {
  let trimmed = slots.slice(0, MAX_SAVE_SLOTS);
  let lastError: unknown = null;
  while (trimmed.length > 0) {
    try {
      writeJsonStorage(
        SAVE_LIST_KEY,
        trimmed.map((slot) => ({ id: slot.id, savedAt: slot.savedAt, label: slot.label, save: slot.save })),
        storage,
      );
      return trimmed.length;
    } catch (error) {
      lastError = error;
      trimmed = trimmed.slice(0, -1);
    }
  }
  throw lastError ?? new Error("No save slots could be written.");
}
