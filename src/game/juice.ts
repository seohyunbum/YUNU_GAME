// 큰 순간 주스(게임 필) 오케스트레이션 — 파티클 + 배너 + 소리를 조합.
// main.ts 는 juiceDeps 만 넘기고 호출만 한다(배선 최소화). 데이터/연출 튜닝은 이 leaf 에서.
import { celebrationBurst, sparkleBurst, type CombatEffectContext } from "./combatEffects";
import { ITEM_NAMES, itemRarity } from "./items";
import { showBanner } from "../ui/banner";
import type { ItemId } from "./types";

export interface JuiceDeps {
  context: CombatEffectContext;
  banner: HTMLDivElement;
  playTone: (frequency: number, duration?: number, type?: OscillatorType, volume?: number) => void;
}

function playSting(deps: JuiceDeps, notes: number[], type: OscillatorType, volume: number, gapMs: number) {
  notes.forEach((freq, i) => setTimeout(() => deps.playTone(freq, 0.12, type, volume), i * gapMs));
}

export function celebrateLevelUp(deps: JuiceDeps, level: number) {
  celebrationBurst(deps.context);
  setTimeout(() => celebrationBurst(deps.context), 180);
  setTimeout(() => sparkleBurst(deps.context, true), 360);
  showBanner(deps.banner, `레벨 업!  Lv ${level}`, "levelup");
  playSting(deps, [392, 523, 659, 784, 1047, 1319, 1568], "triangle", 0.072, 82);
  playSting(deps, [196, 262, 330, 392, 523], "sine", 0.04, 128);
  setTimeout(() => {
    deps.playTone(1047, 0.22, "triangle", 0.07);
    deps.playTone(1319, 0.22, "sine", 0.045);
    deps.playTone(1568, 0.26, "triangle", 0.052);
  }, 620);
}

export function celebrateRareDrop(deps: JuiceDeps, item: ItemId) {
  const rarity = itemRarity(item);
  if (rarity === "common") return;
  const epic = rarity === "epic";
  sparkleBurst(deps.context, epic);
  showBanner(deps.banner, `${epic ? "대박!" : "✨ 희귀"}  ${ITEM_NAMES[item] ?? item}!`, epic ? "epic" : "rare");
  playSting(deps, epic ? [784, 1175, 1568] : [1046, 1568], "sine", 0.045, 90);
}
