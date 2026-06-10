import type { LocationMode } from "./types";

export interface AudioProfile {
  root: number;
  melody: number[];
  chord: number[];
  beat: number;
  master: number;
  lead: number;
  bass: number;
  pad: number;
  ambient: "day" | "night" | "cave" | "house" | "lava";
}

export function currentAudioProfile(hour: number, locationMode: LocationMode, nearLava: boolean): AudioProfile {
  if (nearLava) return { root: 110, melody: [0, 1, 5, 7, 10, 7, 5, 1], chord: [0, 5, 10], beat: 0.56, master: 0.038, lead: 0.011, bass: 0.018, pad: 0.008, ambient: "lava" };
  if (locationMode === "cave") return { root: 146.83, melody: [0, 3, 5, 7, 10, 7, 5, 3], chord: [0, 3, 7], beat: 0.74, master: 0.034, lead: 0.009, bass: 0.017, pad: 0.009, ambient: "cave" };
  if (locationMode === "house") return { root: 220, melody: [0, 4, 7, 9, 7, 4, 2, 0], chord: [0, 4, 7], beat: 0.68, master: 0.029, lead: 0.01, bass: 0.011, pad: 0.008, ambient: "house" };
  const night = hour >= 20 || hour < 5;
  const dawnOrEvening = (hour >= 5 && hour < 8) || (hour >= 17 && hour < 20);
  if (night) return { root: 174.61, melody: [0, 3, 7, 10, 12, 10, 7, 3], chord: [0, 3, 7], beat: 0.78, master: 0.031, lead: 0.009, bass: 0.014, pad: 0.009, ambient: "night" };
  return {
    root: dawnOrEvening ? 196 : 261.63,
    melody: dawnOrEvening ? [0, 2, 5, 7, 9, 7, 5, 2] : [0, 2, 4, 7, 9, 12, 9, 7],
    chord: dawnOrEvening ? [0, 5, 9] : [0, 4, 7],
    beat: dawnOrEvening ? 0.7 : 0.58,
    master: dawnOrEvening ? 0.03 : 0.032,
    lead: dawnOrEvening ? 0.01 : 0.012,
    bass: 0.012,
    pad: 0.008,
    ambient: "day",
  };
}
