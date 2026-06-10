import { cloneSavedWorldState } from "./saveManager";
import type { SavedWorldState, WorldMapId } from "./types";

export type WorldStateStore = Partial<Record<WorldMapId, SavedWorldState>>;

export function clearWorldStateStore(store: WorldStateStore) {
  for (const key of Object.keys(store) as WorldMapId[]) delete store[key];
}

export function installWorldStates(store: WorldStateStore, states: WorldStateStore | undefined, currentMapId: WorldMapId, fallback: SavedWorldState) {
  clearWorldStateStore(store);
  if (states) {
    for (const [id, state] of Object.entries(states) as [WorldMapId, SavedWorldState][]) {
      if (state) store[id] = cloneSavedWorldState(state);
    }
  }
  if (!store[currentMapId]) store[currentMapId] = cloneSavedWorldState(fallback);
}

export function rememberWorldState(store: WorldStateStore, id: WorldMapId, state: SavedWorldState | undefined) {
  if (state) store[id] = cloneSavedWorldState(state);
}
