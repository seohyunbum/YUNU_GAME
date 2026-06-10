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

export function formatSaveDate(savedAt: string) {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? savedAt : date.toLocaleString();
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

export function createSaveSlot(save: SavedGame, formatSaveDate: (savedAt: string) => string, description?: string): SaveSlot {
  return {
    id: `save-${crypto.randomUUID()}`,
    savedAt: save.savedAt,
    label: formatSaveDate(save.savedAt),
    description,
    save,
  };
}

// 세이브 1개를 deflate 압축 + base64 로 패킹 — localStorage 사용량을 수 배 줄여
// 슬롯 5개가 안정적으로 들어가게 한다. CompressionStream 미지원 환경이면 null.
export async function packSaveData(save: SavedGame): Promise<string | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([JSON.stringify(save)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    return btoa(binary);
  } catch {
    return null;
  }
}

export async function unpackSaveData(packed: string): Promise<PartialSavedGame> {
  const binary = atob(packed);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return JSON.parse(await new Response(stream).text()) as PartialSavedGame;
}

// 슬롯의 세이브를 사용 가능한 형태로 해제한다 (레거시 raw / 압축본 모두 지원)
export async function resolveSlotSave(slot: SaveSlot): Promise<PartialSavedGame | null> {
  if (slot.save) return slot.save;
  if (slot.packed) return unpackSaveData(slot.packed);
  return null;
}

export function readSaveSlots({
  migrateSaveData,
  formatSaveDate,
  storage = localStorage,
}: ReadSaveSlotsOptions): SaveSlot[] {
  const slots: SaveSlot[] = [];
  const seen = new Set<string>();
  const seenSavedAt = new Set<string>();
  const addSlot = (candidate: unknown, fallbackId: string) => {
    try {
      if (!candidate || typeof candidate !== "object") return;
      const record = candidate as StoredSaveSlot & PartialSavedGame;
      if (typeof record.packed === "string" && typeof record.savedAt === "string") {
        // 압축 슬롯 — 목록 표시는 메타데이터만으로, 해제는 로드 시점에
        if (seenSavedAt.has(record.savedAt)) return;
        seenSavedAt.add(record.savedAt);
        slots.push({
          id: typeof record.id === "string" ? record.id : fallbackId,
          savedAt: record.savedAt,
          label: typeof record.label === "string" ? record.label : formatSaveDate(record.savedAt),
          description: typeof record.description === "string" ? record.description : undefined,
          packed: record.packed,
        });
        return;
      }
      const source = record.save ?? record;
      const save = migrateSaveData(source as PartialSavedGame);
      const dedupeKey = `${save.savedAt}:${save.player.position.x.toFixed(2)},${save.player.position.y.toFixed(2)},${save.player.position.z.toFixed(2)}`;
      if (seen.has(dedupeKey) || seenSavedAt.has(save.savedAt)) return;
      seen.add(dedupeKey);
      seenSavedAt.add(save.savedAt);
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

export async function writeSaveSlots(slots: SaveSlot[], storage = localStorage) {
  let trimmed = slots.slice(0, MAX_SAVE_SLOTS);
  const stored: StoredSaveSlot[] = [];
  for (const slot of trimmed) {
    const packed = slot.packed ?? (slot.save ? await packSaveData(slot.save) : null);
    stored.push(
      packed
        ? { id: slot.id, savedAt: slot.savedAt, label: slot.label, description: slot.description, packed }
        : { id: slot.id, savedAt: slot.savedAt, label: slot.label, description: slot.description, save: slot.save },
    );
  }
  let lastError: unknown = null;
  while (stored.length > 0) {
    try {
      writeJsonStorage(SAVE_LIST_KEY, stored, storage);
      return stored.length;
    } catch (error) {
      lastError = error;
      stored.pop();
      trimmed = trimmed.slice(0, -1);
    }
  }
  throw lastError ?? new Error("No save slots could be written.");
}
