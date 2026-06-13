import { PLAYER_CLASSES } from "./classes";
import { gameClockText, timeOfDayName } from "./timeOfDay";
import {
  BASE_MAX_MANA,
  DAY_LENGTH_SECONDS,
  HUNGER_MAX,
  MAX_SAVE_SLOTS,
  SAVE_BACKUP_KEY,
  SAVE_HISTORY_KEY,
  SAVE_HISTORY_PER_NICKNAME,
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
  try {
    // 쓰기 가능 여부만 확인한다 — 전체 본문을 프로브로 쓰면 일시적으로 사용량이 2배가 되어 대형 세이브에서 quota 를 터뜨린다.
    storage.setItem(SAVE_WRITE_TEST_KEY, "1");
    storage.removeItem(SAVE_WRITE_TEST_KEY);
    storage.setItem(key, raw);
  } catch (error) {
    // 용량 초과 — 편의용 백업본을 비우고 한 번 더 시도한다
    storage.removeItem(SAVE_BACKUP_KEY);
    storage.removeItem(SAVE_WRITE_TEST_KEY);
    storage.setItem(key, raw);
  }
}

// 최신본(SAVE_KEY)도 슬롯과 같은 압축 스텁으로 저장한다 — Lv451급 대형 세이브의 raw JSON 이 quota 를 다 먹는 것을 막는다.
// 압축 불가 환경에서는 기존 raw 형태 유지. readSaveSlots 의 packed 분기가 그대로 읽는다.
export async function writeLatestSave(save: SavedGame, storage = localStorage) {
  const packed = await packSaveData(save);
  writeJsonStorage(SAVE_KEY, packed ? { savedAt: save.savedAt, label: formatSaveDate(save.savedAt), packed } : save, storage);
}

// 로드 시점의 최신본 갱신은 부가 기능 — 실패(용량 부족 등)해도 로드를 막지 않는다.
export async function persistLatestSaveQuietly(save: SavedGame, storage = localStorage) {
  try {
    backupLatestSave(storage);
    await writeLatestSave(save, storage);
    return true;
  } catch (error) {
    console.warn("최신 저장 기록 실패 — 로드는 계속 진행합니다.", error);
    return false;
  }
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

// 손상된 압축 슬롯에서도 throw 대신 null 을 반환한다 — 호출부가 우아하게 실패하도록.
export async function resolveSlotSaveOrNull(slot: SaveSlot): Promise<PartialSavedGame | null> {
  try {
    return await resolveSlotSave(slot);
  } catch (error) {
    console.error(error);
    return null;
  }
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

// 명명된 슬롯(SAVE_LIST_KEY)만 — latest/backup 병합 없이 실제 저장 목록(≤MAX)을 그대로 반환한다.
// 덮어쓰기 picker/저장 시 쓰는 집합과 보여주는 집합을 일치시켜, 병합본을 5칸으로 trim 하다
// 고르지 않은 저장이 사라지는 사고(데이터 유실)를 막는다. 표시는 readSaveSlots(병합)를 계속 쓴다.
export function readStoredSlotList({ migrateSaveData, formatSaveDate, storage = localStorage }: ReadSaveSlotsOptions): SaveSlot[] {
  const slots: SaveSlot[] = [];
  try {
    const raw = storage.getItem(SAVE_LIST_KEY);
    if (!raw) return slots;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return slots;
    parsed.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const record = entry as StoredSaveSlot & PartialSavedGame;
      const id = typeof record.id === "string" ? record.id : `save-list-${index}`;
      if (typeof record.packed === "string" && typeof record.savedAt === "string") {
        slots.push({ id, savedAt: record.savedAt, label: typeof record.label === "string" ? record.label : formatSaveDate(record.savedAt), description: typeof record.description === "string" ? record.description : undefined, packed: record.packed });
        return;
      }
      try {
        const save = migrateSaveData((record.save ?? record) as PartialSavedGame);
        slots.push({ id, savedAt: save.savedAt, label: typeof record.label === "string" ? record.label : formatSaveDate(save.savedAt), save });
      } catch {
        // skip broken entry
      }
    });
  } catch {
    // no usable list
  }
  return slots;
}

export async function writeSaveSlots(slots: SaveSlot[], storage = localStorage) {
  let trimmed = slots.slice(0, MAX_SAVE_SLOTS);
  const stored: StoredSaveSlot[] = [];
  for (const slot of trimmed) {
    const packed = slot.packed ?? (slot.save ? await packSaveData(slot.save) : null);
    const description = slot.description ?? (slot.save ? saveSummary(slot.save) : undefined);
    stored.push(
      packed
        ? { id: slot.id, savedAt: slot.savedAt, label: slot.label, description, packed }
        : { id: slot.id, savedAt: slot.savedAt, label: slot.label, description, save: slot.save },
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

export function saveSummary(save: SavedGame) {
  const hour = (((save.player.worldTimeSeconds ?? DAY_LENGTH_SECONDS * (8 / 24)) / DAY_LENGTH_SECONDS) * 24) % 24;
  const location = save.player.locationMode === "cave" ? "동굴" : save.player.locationMode === "house" ? "집 안" : "야생";
  const className = PLAYER_CLASSES[save.player.playerClass ?? "warrior"]?.name ?? "전사";
  const filledSlots = [...save.player.hotbar, ...save.player.bagSlots].filter((slot) => slot.item && slot.count > 0).length;
  return `${className} · Lv ${save.player.level} · 체력 ${Math.ceil(save.player.health)}/${save.player.maxHealth} · 마나 ${Math.floor(save.player.mana ?? BASE_MAX_MANA)}/${save.player.maxMana ?? BASE_MAX_MANA} · 배고픔 ${save.player.hunger ?? HUNGER_MAX}/${HUNGER_MAX} · ${timeOfDayName(hour)} ${gameClockText(hour)} · ${location} · 걸음 ${Math.floor(save.player.totalSteps)} · 아이템칸 ${filledSlots}`;
}

// ── 자동 백업 링 (닉네임별 최신 30개) ─────────────────────────────
// 저장할 때마다 압축 백업을 쌓아, 슬롯 덮어쓰기/유실 사고에도 과거 시점으로 복구할 수 있게 한다.
// label/summary 는 평문으로 같이 저장해 목록을 풀지 않고도 보여준다. 본문은 packed(없으면 save).
export interface SaveHistoryEntry {
  nickname: string;
  savedAt: string;
  label: string;
  summary: string;
  packed?: string;
  save?: SavedGame;
}

function readRawHistory(storage: Storage): SaveHistoryEntry[] {
  try {
    const raw = storage.getItem(SAVE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((e) => e && typeof e === "object") as SaveHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function appendSaveToHistory(save: SavedGame, nickname: string, storage = localStorage): Promise<void> {
  const key = nickname || "";
  const packed = await packSaveData(save);
  const entry: SaveHistoryEntry = { nickname: key, savedAt: save.savedAt, label: formatSaveDate(save.savedAt), summary: saveSummary(save), ...(packed ? { packed } : { save }) };
  // 같은 닉네임+시각 중복 제거 후 추가
  let history = readRawHistory(storage).filter((e) => !(e.nickname === key && e.savedAt === entry.savedAt));
  history.push(entry);
  // 해당 닉네임은 최신 SAVE_HISTORY_PER_NICKNAME 개만 유지(오래된 것부터 제거)
  const mine = history.filter((e) => e.nickname === key).sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
  if (mine.length > SAVE_HISTORY_PER_NICKNAME) {
    const evictSavedAt = new Set(mine.slice(0, mine.length - SAVE_HISTORY_PER_NICKNAME).map((e) => e.savedAt));
    history = history.filter((e) => e.nickname !== key || !evictSavedAt.has(e.savedAt));
  }
  // 용량 초과 시 전체에서 가장 오래된 것부터 떨궈가며 재시도(백업은 부가 기능 — 실패해도 본 저장은 막지 않음)
  try {
    writeJsonStorage(SAVE_HISTORY_KEY, history, storage);
  } catch {
    history.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    while (history.length > 0) {
      history.pop();
      try {
        writeJsonStorage(SAVE_HISTORY_KEY, history, storage);
        return;
      } catch {
        /* keep shrinking */
      }
    }
  }
}

// 닉네임의 백업 목록 — 최신순. 본문은 풀지 않고 메타데이터만(목록 표시용). 복구 시 resolveSlotSave 로 해제.
export function readSaveHistory(nickname: string, storage = localStorage): SaveHistoryEntry[] {
  const key = nickname || "";
  return readRawHistory(storage)
    .filter((e) => e.nickname === key && typeof e.savedAt === "string")
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

// 백업 엔트리를 로드 가능한 형태로 해제 (raw save / 압축본 모두 지원, 손상 시 null)
export async function resolveHistorySave(entry: SaveHistoryEntry): Promise<PartialSavedGame | null> {
  if (entry.save) return entry.save;
  if (entry.packed) {
    try {
      return await unpackSaveData(entry.packed);
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return null;
}

// 요약(description)이 없는 구버전 압축 슬롯: 해제해서 요약을 만들고, 다음을 위해 저장까지 해 둔다.
export async function backfillSlotDescription(slot: SaveSlot, migrate: (save: PartialSavedGame) => SavedGame, allSlots: SaveSlot[], storage = localStorage): Promise<string | null> {
  const save = await resolveSlotSaveOrNull(slot);
  if (!save) return null;
  const summary = saveSummary(migrate(save));
  void writeSaveSlots(allSlots.map((candidate) => (candidate.id === slot.id ? { ...candidate, description: summary } : candidate)), storage).catch(() => {});
  return summary;
}
