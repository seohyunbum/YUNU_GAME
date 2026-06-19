import type { ItemId, PointShopOffer, SellShopOffer, TradeOffer } from "./types";

export const TRADE_OFFERS: TradeOffer[] = [
  { id: "meat_for_iron", name: "고기와 철 교환", give: { meat: 2 }, receive: { iron: 1 } },
  { id: "iron_powder_for_meat", name: "철 가루와 고기 교환", give: { iron_powder: 3 }, receive: { meat: 2 } },
  { id: "copper_powder_for_leather", name: "구리 가루와 가죽 교환", give: { copper_powder: 4 }, receive: { leather: 1 } },
  { id: "coal_powder_for_wood", name: "석탄 가루와 나무 교환", give: { coal_powder: 3 }, receive: { wood: 2 } },
  { id: "diamond_powder_for_gold", name: "다이아몬드 가루와 금 교환", give: { diamond_powder: 1 }, receive: { gold: 3 } },
];

export const BLACKSMITH_TRADE_OFFERS: TradeOffer[] = [
  { id: "stone_powder_for_hammer", name: "돌 가루로 망치 교환", give: { stone_powder: 20 }, receive: { hammer: 1 } },
  { id: "copper_powder_for_hammer", name: "구리 가루로 망치 교환", give: { copper_powder: 10 }, receive: { hammer: 1 } },
  { id: "iron_powder_for_hammer", name: "철 가루로 망치 교환", give: { iron_powder: 5 }, receive: { hammer: 1 } },
  { id: "diamond_powder_for_hammer", name: "다이아몬드 가루로 망치 교환", give: { diamond_powder: 1 }, receive: { hammer: 1 } },
  { id: "stone_powder_for_workbench", name: "돌 가루로 제작대 교환", give: { stone_powder: 50 }, receive: { crafting_table: 1 } },
  { id: "copper_powder_for_workbench", name: "구리 가루로 제작대 교환", give: { copper_powder: 25 }, receive: { crafting_table: 1 } },
  { id: "iron_powder_for_workbench", name: "철 가루로 제작대 교환", give: { iron_powder: 12 }, receive: { crafting_table: 1 } },
  { id: "diamond_powder_for_workbench", name: "다이아몬드 가루로 제작대 교환", give: { diamond_powder: 3 }, receive: { crafting_table: 1 } },
  { id: "iron_powder_for_grinder", name: "철/구리 가루로 분쇄기 교환", give: { iron_powder: 18, copper_powder: 12 }, receive: { grinder: 1 } },
  { id: "gold_powder_for_extended_workbench", name: "금/철 가루로 확장 제작대 교환", give: { gold_powder: 8, iron_powder: 8 }, receive: { extended_workbench: 1 } },
  { id: "diamond_powder_for_extended_workbench", name: "다이아몬드 가루로 확장 제작대 교환", give: { diamond_powder: 4, stone_powder: 20 }, receive: { extended_workbench: 1 } },
  { id: "stone_powder_for_smelter", name: "돌/석탄 가루로 제련대 교환", give: { stone_powder: 70, coal_powder: 10 }, receive: { smelter: 1 } },
  { id: "iron_powder_for_smelter", name: "철/석탄 가루로 제련대 교환", give: { iron_powder: 20, coal_powder: 5 }, receive: { smelter: 1 } },
  { id: "obsidian_powder_for_special_smelter", name: "흑요석/다이아몬드 가루로 특수 제련대 교환", give: { obsidian_powder: 6, diamond_powder: 2 }, receive: { special_smelter: 1 } },
];

export const POINT_SHOP_OFFERS: PointShopOffer[] = [
  { id: "meat_pack", name: "고기 3개", cost: 160, receive: { meat: 3 }, note: "배고픔이 급할 때 쓰는 기본 식량입니다." },
  { id: "wood_pack", name: "나무 묶음", cost: 220, receive: { wood: 12 }, note: "초반 제작과 집짓기 재료를 조금 보탭니다." },
  { id: "leather_pack", name: "가죽 3개", cost: 260, receive: { leather: 3 }, note: "가방과 가죽 갑옷을 더 빨리 준비할 수 있습니다." },
  { id: "hammer", name: "망치 1개", cost: 500, receive: { hammer: 1 }, note: "미니게임 몇 판으로 살 수 있는 핵심 초반 도구입니다." },
  { id: "stone_bundle", name: "돌 8개", cost: 550, receive: { stone: 8 }, note: "곡괭이와 집짓기에 필요한 기본 광물입니다." },
  { id: "iron_bundle", name: "철 2개", cost: 900, receive: { iron: 2 }, note: "중반 제작 재료입니다. 한 번에 많이 사기는 어렵게 책정했습니다." },
  { id: "smelter", name: "제련대 1개", cost: 2600, receive: { smelter: 1 }, note: "상자 운이 안 좋을 때 노려볼 수 있는 비싼 제작 도구입니다." },
  { id: "diamond", name: "다이아몬드 1개", cost: 3200, receive: { diamond: 1 }, note: "여러 판을 모아야 살 수 있는 희귀 재료입니다." },
  { id: "grinder", name: "분쇄기 1개", cost: 4200, receive: { grinder: 1 }, note: "가루 제작과 거래 루트를 빠르게 여는 고가 아이템입니다." },
  // ── 확장 품목(일반·고급·희귀 중심) — 가격은 위 기존 단가와 희귀도에 맞춰 책정 ──
  { id: "stick_pack", name: "나무 막대기 10개", cost: 120, receive: { stick: 10 }, note: "도구 손잡이로 두루 쓰는 값싼 소모 재료입니다." },
  { id: "coal_pack", name: "석탄 6개", cost: 360, receive: { coal: 6 }, note: "제련 연료입니다. 돌과 비슷한 단가로 책정했습니다." },
  { id: "copper_bundle", name: "구리 4개", cost: 500, receive: { copper: 4 }, note: "초중반 금속. 돌보다 비싸고 철보다 쌉니다." },
  { id: "refined_iron_pack", name: "제련된 철 3개", cost: 1500, receive: { refined_iron: 3 }, note: "철 도구·무기·방어구의 핵심 재료입니다(제련 수고를 덜어주는 값)." },
  { id: "medkit_pack", name: "구급상자 3개", cost: 600, receive: { medkit: 3 }, note: "체력 회복 소모품. 위급할 때 비축해 두세요." },
  { id: "iron_shield_buy", name: "철 방패 1개", cost: 1200, receive: { iron_shield: 1 }, note: "방어 +5의 고급 방패. 직접 만들기 전 대안입니다." },
  { id: "iron_armor_buy", name: "철 갑옷 1개", cost: 1400, receive: { iron_armor: 1 }, note: "방어 +10의 고급 방어구입니다." },
  { id: "gold_bundle", name: "금 2개", cost: 1800, receive: { gold: 2 }, note: "희귀 금속. 철보다 비싸고 다이아몬드보다 쌉니다." },
  { id: "gold_armor_buy", name: "금 갑옷 1개", cost: 2600, receive: { gold_armor: 1 }, note: "방어 +15의 희귀 방어구입니다." },
];

// 판매가 배수 — 0.595(0.85×0.70)에서 다시 현재의 70% 수준으로 하향(0.595×0.70≈0.4165).
// 판매로 얻는 포인트 이득을 더 낮춰 포인트 파밍 유인을 줄인다(로드 복제 익스플로잇 차단과 함께).
export const SELL_SHOP_RATE = 0.4165;

function roundedSellPrice(shopUnitPrice: number) {
  const raw = shopUnitPrice * SELL_SHOP_RATE;
  const step = raw >= 1000 ? 50 : raw >= 100 ? 5 : 1;
  return Math.max(1, Math.floor(raw / step) * step);
}

export const SELL_SHOP_OFFERS: SellShopOffer[] = POINT_SHOP_OFFERS.flatMap((offer) =>
  Object.entries(offer.receive).map(([item, count]) => {
    const shopUnitPrice = Math.ceil(offer.cost / Math.max(1, count));
    return {
      id: `${offer.id}_${item}_sell`,
      item,
      points: roundedSellPrice(shopUnitPrice),
      shopUnitPrice,
      note: `${offer.name} 기준 매입가입니다.`,
    };
  }),
);

export const POINT_EXCHANGE_OFFERS = [
  { id: "dragon_scale_points", item: "dragon_scale", points: 4000, name: "용의 비늘 교환" },
  { id: "dragon_tail_points", item: "dragon_tail", points: 5000, name: "용의 꼬리 교환" },
  { id: "dragon_horn_points", item: "dragon_horn", points: 10000, name: "용의 뿔 교환" },
] satisfies { id: string; item: ItemId; points: number; name: string }[];
