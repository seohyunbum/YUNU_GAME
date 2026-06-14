import type { HouseBuildOption } from "./types";

// 내 집 공통 혜택: 안전지대 · 침대 완전 회복(체력+마나+배고픔1) · 집 창고 24칸 · 30분마다 보급 상자 · 사망 시 집 앞 부활 · 지도 표시
export const HOUSE_BUILD_OPTIONS: HouseBuildOption[] = [
  {
    id: "wood_cabin",
    name: "작은 통나무집",
    description: "기본 베이스캠프. 안전지대 + 침대 완전 회복 + 집 창고 + 보급 상자 + 죽으면 집 앞 부활.",
    ingredients: { wood: 120, stick: 60, stone: 40, hammer: 2 },
    houseKind: "home",
    variant: 0,
    craftXp: 100,
  },
  {
    id: "stone_house",
    name: "튼튼한 돌집",
    description: "돌과 철로 지은 단단한 베이스캠프. 통나무집과 같은 혜택을 모두 줍니다.",
    ingredients: { wood: 120, stone: 150, iron: 24, hammer: 3 },
    houseKind: "home",
    variant: 1,
    craftXp: 150,
  },
  {
    id: "two_story_house",
    name: "이층집",
    description: "2층까지 있는 가장 큰 베이스캠프. 모든 집 혜택 + 넓은 공간.",
    ingredients: { wood: 240, refined_wood: 80, stone: 180, iron: 40, hammer: 4 },
    houseKind: "twoStory",
    variant: 3,
    craftXp: 200,
  },
];
