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

// ★볼륨 주의: BGM 보이스는 bgmMasterGain(=profile.master)을 거쳐 출력된다. 따라서 최종 음량 ≈ 보이스볼륨 × master.
// master 는 BGM 버스 레벨(0.5~0.7, SFX 버스 0.78 과 동급)이고, lead/bass/pad 가 실제 믹스. (예전엔 master 0.03 이라 무음이었음)

// 전투 프로파일 — 베이스(현재 맵)의 루트/조성을 유지하되 긴장감(빠른 펄스·강한 베이스·단조 멜로디)으로 전환. 같은 키 변주라 자연스럽게 크로스페이드.
function tenseFrom(base: AudioProfile): AudioProfile {
  return {
    root: base.root,
    melody: [...MELODY.tense],
    chord: [0, 3, 7],
    beat: Math.max(0.34, base.beat * 0.6),
    master: Math.min(0.85, base.master * 1.12),
    lead: base.lead * 1.1,
    bass: base.bass * 1.6,
    pad: base.pad * 0.7,
    ambient: "tense",
  };
}

// 루트를 한 단계 높이고(밝게) 템포를 빠르게(경쾌). 저역 무게(bass)는 줄였다 — '쳐짐'/오류음 느낌 제거. (베이스/패드 옥타브-다운은 scheduler 에서 제거.)
function baseProfile(hour: number, locationMode: LocationMode, nearLava: boolean, spookyMap: boolean): AudioProfile {
  if (nearLava) return { root: 146.83, melody: [...MELODY.lava], chord: [0, 5, 10], beat: 0.48, master: 0.6, lead: 0.058, bass: 0.05, pad: 0.04, ambient: "lava" };
  if (locationMode === "cave") return { root: 174.61, melody: [...MELODY.cave], chord: [0, 3, 7], beat: 0.58, master: 0.55, lead: 0.052, bass: 0.05, pad: 0.044, ambient: "cave" };
  if (locationMode === "house") return { root: 261.63, melody: [...MELODY.house], chord: [0, 4, 7], beat: 0.52, master: 0.5, lead: 0.055, bass: 0.042, pad: 0.038, ambient: "house" };
  if (spookyMap) return { root: 155.56, melody: [...MELODY.spooky], chord: [0, 3, 6], beat: 0.72, master: 0.55, lead: 0.046, bass: 0.05, pad: 0.048, ambient: "night" };
  const night = hour >= 20 || hour < 5;
  const dawnOrEvening = (hour >= 5 && hour < 8) || (hour >= 17 && hour < 20);
  if (night) return { root: 207.65, melody: [...MELODY.night], chord: [0, 3, 7], beat: 0.6, master: 0.58, lead: 0.052, bass: 0.046, pad: 0.044, ambient: "night" };
  if (dawnOrEvening) return { root: 233.08, melody: [...MELODY.dawn], chord: [0, 5, 9], beat: 0.54, master: 0.6, lead: 0.057, bass: 0.044, pad: 0.04, ambient: "day" };
  return { root: 293.66, melody: [...MELODY.day], chord: [0, 4, 7], beat: 0.46, master: 0.62, lead: 0.064, bass: 0.046, pad: 0.04, ambient: "day" };
}

export function currentAudioProfile(hour: number, locationMode: LocationMode, nearLava: boolean, spookyMap = false, combat = false): AudioProfile {
  const base = baseProfile(hour, locationMode, nearLava, spookyMap);
  return combat ? tenseFrom(base) : base;
}
