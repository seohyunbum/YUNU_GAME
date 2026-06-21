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
  ambient: "day" | "night" | "cave" | "house" | "lava" | "tense";
}

// 잔잔하고 아름다운 16음 프레이즈(파랜드택틱스류) — 8음 반복보다 덜 단조롭게 흐른다. 펜타토닉/장조 중심으로 부드럽게 상승·하강.
const MELODY = {
  day: [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2],
  dawn: [0, 2, 5, 7, 9, 7, 5, 4, 2, 5, 9, 7, 5, 2, 0, -3],
  night: [0, 3, 7, 10, 12, 10, 7, 5, 3, 7, 10, 12, 14, 12, 10, 7],
  cave: [0, 3, 5, 7, 10, 7, 5, 3, 0, 5, 7, 10, 12, 10, 7, 5],
  house: [0, 4, 7, 9, 7, 4, 2, 0, 4, 9, 7, 4, 2, 0, -3, 0],
  lava: [0, 1, 5, 7, 8, 7, 5, 1, 0, 5, 8, 7, 5, 3, 1, 0],
  spooky: [0, 1, 3, 6, 7, 6, 3, 1, 0, 3, 6, 8, 7, 6, 3, 1],
  // 전투 — 루트·5도 구동 펄스 + 단조 색채(긴장). 빠른 비트와 함께 쓴다.
  tense: [0, 7, 3, 7, 0, 7, 5, 8, 0, 7, 3, 7, 6, 7, 5, 3],
} as const;

// 전투 프로파일 — 베이스(현재 맵)의 루트/조성을 유지하되 긴장감(빠른 펄스·강한 베이스·단조 멜로디)으로 전환. 급변 대신 같은 키의 변주라 자연스럽게 크로스페이드된다.
function tenseFrom(base: AudioProfile): AudioProfile {
  return {
    root: base.root,
    melody: [...MELODY.tense],
    chord: [0, 3, 7],
    beat: Math.max(0.34, base.beat * 0.6),
    master: base.master * 1.18,
    lead: base.lead * 1.12,
    bass: base.bass * 1.7,
    pad: base.pad * 0.65,
    ambient: "tense",
  };
}

function baseProfile(hour: number, locationMode: LocationMode, nearLava: boolean, spookyMap: boolean): AudioProfile {
  if (nearLava) return { root: 110, melody: [...MELODY.lava], chord: [0, 5, 10], beat: 0.56, master: 0.038, lead: 0.011, bass: 0.018, pad: 0.011, ambient: "lava" };
  if (locationMode === "cave") return { root: 146.83, melody: [...MELODY.cave], chord: [0, 3, 7], beat: 0.74, master: 0.034, lead: 0.0095, bass: 0.017, pad: 0.012, ambient: "cave" };
  if (locationMode === "house") return { root: 220, melody: [...MELODY.house], chord: [0, 4, 7], beat: 0.68, master: 0.029, lead: 0.01, bass: 0.011, pad: 0.011, ambient: "house" };
  if (spookyMap) return { root: 138.59, melody: [...MELODY.spooky], chord: [0, 3, 6], beat: 0.88, master: 0.031, lead: 0.0085, bass: 0.016, pad: 0.013, ambient: "night" };
  const night = hour >= 20 || hour < 5;
  const dawnOrEvening = (hour >= 5 && hour < 8) || (hour >= 17 && hour < 20);
  if (night) return { root: 174.61, melody: [...MELODY.night], chord: [0, 3, 7], beat: 0.78, master: 0.031, lead: 0.0095, bass: 0.014, pad: 0.012, ambient: "night" };
  if (dawnOrEvening) return { root: 196, melody: [...MELODY.dawn], chord: [0, 5, 9], beat: 0.7, master: 0.03, lead: 0.0105, bass: 0.012, pad: 0.011, ambient: "day" };
  return { root: 261.63, melody: [...MELODY.day], chord: [0, 4, 7], beat: 0.6, master: 0.032, lead: 0.012, bass: 0.012, pad: 0.011, ambient: "day" };
}

export function currentAudioProfile(hour: number, locationMode: LocationMode, nearLava: boolean, spookyMap = false, combat = false): AudioProfile {
  const base = baseProfile(hour, locationMode, nearLava, spookyMap);
  return combat ? tenseFrom(base) : base;
}
