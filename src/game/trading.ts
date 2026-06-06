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
];

export const SELL_SHOP_RATE = 0.85;

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
