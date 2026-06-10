// 엔딩 피날레 — 불멸의 존재(마지막 챕터) 토벌 시 폭죽 연사 + 승리 팡파레 + 엔딩 크레딧.
// 상태기계는 순수 데이터, 모든 부수효과는 좁은 컨텍스트로 주입받는다.
import * as THREE from "three";
import { spawnFireworkBurst, type CombatEffectContext } from "./combatEffects";

export const FINALE_FIREWORKS_MS = 26_000;
export const FINALE_CREDITS_DELAY_MS = 3_800;

// 승리 팡파레 — [주파수 Hz, 길이 s, 다음 음까지 ms]
const FANFARE: readonly [number, number, number][] = [
  [523.25, 0.16, 170],
  [659.25, 0.16, 170],
  [783.99, 0.16, 170],
  [1046.5, 0.34, 360],
  [783.99, 0.16, 170],
  [1046.5, 0.55, 620],
  [587.33, 0.16, 170],
  [739.99, 0.16, 170],
  [880.0, 0.16, 170],
  [1174.66, 0.34, 360],
  [880.0, 0.16, 170],
  [1174.66, 0.7, 760],
  [1046.5, 0.2, 200],
  [1174.66, 0.2, 200],
  [1318.51, 0.9, 0],
];

const FIREWORK_PALETTES: readonly (readonly number[])[] = [
  [0xff5a5a, 0xffd166, 0xfff7d6],
  [0x60a5fa, 0xa78bfa, 0xe0f2fe],
  [0x4ade80, 0xbbf7d0, 0xfacc15],
  [0xf472b6, 0xfb7185, 0xfde68a],
  [0xfacc15, 0xfb923c, 0xfff7d6],
];

const burstPosition = new THREE.Vector3();

export interface FinaleState {
  active: boolean;
  startedAt: number;
  nextBurstAt: number;
  melodyIndex: number;
  nextNoteAt: number;
  creditsShown: boolean;
}

export function createFinaleState(): FinaleState {
  return { active: false, startedAt: 0, nextBurstAt: 0, melodyIndex: 0, nextNoteAt: 0, creditsShown: false };
}

export interface FinaleContext {
  state: FinaleState;
  effects(): CombatEffectContext;
  playerPosition: THREE.Vector3;
  cameraForward(): { x: number; z: number };
  now(): number;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
  showCredits(): void;
  showMessage(text: string): void;
}

export function startFinale(context: FinaleContext) {
  const now = context.now();
  context.state.active = true;
  context.state.startedAt = now;
  context.state.nextBurstAt = now;
  context.state.melodyIndex = 0;
  context.state.nextNoteAt = now + 220;
  context.state.creditsShown = false;
  context.showMessage("🎆 불멸의 존재 토벌! 야생 마을의 전설이 되었습니다!");
}

export function updateFinale(context: FinaleContext) {
  const state = context.state;
  if (!state.active) return;
  const now = context.now();

  // 폭죽 연사 — 시야 전방 하늘 위주로, 좌우로 넓게
  if (now <= state.startedAt + FINALE_FIREWORKS_MS && now >= state.nextBurstAt) {
    state.nextBurstAt = now + THREE.MathUtils.randFloat(240, 520);
    const forward = context.cameraForward();
    const distance = THREE.MathUtils.randFloat(9, 20);
    const side = THREE.MathUtils.randFloatSpread(22);
    burstPosition.set(
      context.playerPosition.x + forward.x * distance - forward.z * side,
      context.playerPosition.y + THREE.MathUtils.randFloat(6, 14),
      context.playerPosition.z + forward.z * distance + forward.x * side,
    );
    spawnFireworkBurst(context.effects(), burstPosition, FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)]);
  }

  // 승리 팡파레
  if (state.melodyIndex < FANFARE.length && now >= state.nextNoteAt) {
    const [frequency, duration, gap] = FANFARE[state.melodyIndex];
    context.playTone(frequency, duration, "triangle", 0.06);
    context.playTone(frequency / 2, duration, "sine", 0.03);
    state.melodyIndex += 1;
    state.nextNoteAt = now + gap;
  }

  // 크레딧
  if (!state.creditsShown && now >= state.startedAt + FINALE_CREDITS_DELAY_MS) {
    state.creditsShown = true;
    context.showCredits();
  }

  if (now > state.startedAt + FINALE_FIREWORKS_MS && state.melodyIndex >= FANFARE.length) state.active = false;
}
