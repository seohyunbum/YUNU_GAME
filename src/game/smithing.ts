import type { SmithingProduct } from "./types";

export const SMITHING_PRODUCTS: SmithingProduct[] = ([
  ["copper", "구리"],
  ["iron", "철"],
  ["gold", "금"],
  ["diamond", "다이아몬드"],
] as const).flatMap(([material, label]) => [
  { id: `${material}_dagger`, material, name: `${label}칼`, kind: "dagger" },
  { id: `${material}_sword`, material, name: `${label}검`, kind: "sword" },
  { id: `${material}_axe`, material, name: `${label}도끼`, kind: "axe" },
  { id: `${material}_pickaxe`, material, name: `${label}곡괭이`, kind: "pickaxe" },
  { id: `${material}_armor`, material, name: `${label}갑옷`, kind: "armor" },
]);
