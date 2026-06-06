import type { HouseBuildOption } from "./types";

export const HOUSE_BUILD_OPTIONS: HouseBuildOption[] = [
  {
    id: "wood_cabin",
    name: "작은 통나무집",
    description: "가장 기본적인 내 집입니다. 내부에는 상자 하나가 있습니다.",
    ingredients: { wood: 120, stick: 60, stone: 40, hammer: 2 },
    houseKind: "home",
    variant: 0,
  },
  {
    id: "stone_house",
    name: "튼튼한 돌집",
    description: "돌과 철을 많이 쓰는 단단한 집입니다.",
    ingredients: { wood: 120, stone: 150, iron: 24, hammer: 3 },
    houseKind: "home",
    variant: 1,
  },
  {
    id: "two_story_house",
    name: "이층집",
    description: "계단으로 2층까지 오르내릴 수 있는 큰 집입니다.",
    ingredients: { wood: 240, refined_wood: 80, stone: 180, iron: 40, hammer: 4 },
    houseKind: "twoStory",
    variant: 3,
  },
];
