import { makeGlowMaterial, makeMetalMaterial, makeToonMaterial } from "../visuals";

// 무기·방어구 티어 비주얼 단일 진실원천(SSOT). 한 곳에서 색/광택/발광/보석을 정의해
// heldItemVisuals(무기)와 avatar(갑옷 오버레이)가 같은 진행을 공유한다.
// 진행 순서: wood → stone → copper → iron → gold → diamond → obsidian(최상).
export type TierId = "wood" | "stone" | "copper" | "iron" | "gold" | "diamond" | "obsidian";

export interface TierVisual {
  rank: number; // 0..6 — 길이·크기 스케일링용
  base: number; // 본체(블레이드/판금) 색
  metalness: number;
  roughness: number;
  emissive: number; // 본체 자체 발광(고티어)
  emissiveIntensity: number;
  gem: number | null; // 보석/엣지 강조색 (null = 보석 없음, 저티어)
  glow: number; // 보석/엣지 발광 강도
  fancy: boolean; // gold+ : 추가 지오메트리(fuller·엣지·그리브)
}

export const TIER_VISUALS: Record<TierId, TierVisual> = {
  wood: { rank: 0, base: 0x8b5a2b, metalness: 0.05, roughness: 0.78, emissive: 0x000000, emissiveIntensity: 0, gem: null, glow: 0, fancy: false },
  stone: { rank: 1, base: 0x8a8f93, metalness: 0.1, roughness: 0.72, emissive: 0x000000, emissiveIntensity: 0, gem: null, glow: 0, fancy: false },
  copper: { rank: 2, base: 0xb87345, metalness: 0.4, roughness: 0.42, emissive: 0x000000, emissiveIntensity: 0, gem: 0xffd86b, glow: 0.3, fancy: false },
  iron: { rank: 3, base: 0xb8b7b0, metalness: 0.48, roughness: 0.36, emissive: 0x000000, emissiveIntensity: 0, gem: 0x8fd7ff, glow: 0.35, fancy: false },
  gold: { rank: 4, base: 0xe5b83e, metalness: 0.6, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.15, gem: 0xfff1a8, glow: 0.45, fancy: true },
  diamond: { rank: 5, base: 0x6ee7f2, metalness: 0.5, roughness: 0.24, emissive: 0x0a4d55, emissiveIntensity: 0.6, gem: 0xaffcff, glow: 0.7, fancy: true },
  obsidian: { rank: 6, base: 0x25102f, metalness: 0.55, roughness: 0.22, emissive: 0x7c2dff, emissiveIntensity: 0.85, gem: 0xc89bff, glow: 1.0, fancy: true },
};

const TIER_ORDER: TierId[] = ["obsidian", "diamond", "gold", "iron", "copper", "stone", "wood"];

// 아이템 id 에서 티어 추출 (예: "diamond_sword" → "diamond"). 못 찾으면 null.
export function tierOf(item: string): TierId | null {
  for (const t of TIER_ORDER) if (item.includes(t)) return t;
  return null;
}

// 무기/도구 빌더용 — 티어 없으면 wood 기본값으로 폴백(항상 descriptor 반환).
export function tierVisual(item: string): TierVisual {
  return TIER_VISUALS[tierOf(item) ?? "wood"];
}

// 방어구 티어 (leather 는 wood-rank 의 무광 가죽 느낌으로 매핑). 알 수 없으면 null.
export function armorTierOf(item: string | null | undefined): TierId | null {
  if (!item) return null;
  if (item.includes("leather")) return "wood";
  return tierOf(item);
}

// 본체(블레이드/판금) 재료 — 저티어 무광, 중티어 금속 광택, 고티어 발광.
export function tierBladeMaterial(t: TierVisual) {
  if (t.rank <= 1) return makeToonMaterial(t.base, { roughness: t.roughness });
  return makeMetalMaterial(t.base, { metalness: t.metalness, roughness: t.roughness, emissive: t.emissive, emissiveIntensity: t.emissiveIntensity });
}

// 보석/포멜 재료 (copper+).
export function tierGemMaterial(t: TierVisual) {
  const c = t.gem ?? t.base;
  return makeGlowMaterial(c, c, { emissiveIntensity: Math.max(0.4, t.glow) });
}

// 발광 엣지/트림 재료 (gold+).
export function tierEdgeMaterial(t: TierVisual) {
  const c = t.emissive || t.base;
  return makeGlowMaterial(c, c, { emissiveIntensity: t.glow * 1.3, transparent: true, opacity: 0.85 });
}
