export interface ObjectiveSnapshot {
  health: number;
  hunger: number;
  wood: number;
  hammer: number;
  craftingTable: number;
  leather: number;
  hasWorkbench: boolean;
  hasPickaxe: boolean;
  hasBag: boolean;
  hasSmelter: boolean;
  smelter: number;
}

export function currentObjective(snapshot: ObjectiveSnapshot) {
  if (snapshot.health <= 3) return "현재 목표: 안전한 곳에서 고기를 먹거나 침대에서 회복하기";
  if (snapshot.hunger <= 1) return "현재 목표: 고기를 먹어 배고픔 회복하기";
  if (snapshot.wood < 3 && !snapshot.hasWorkbench && snapshot.craftingTable <= 0) {
    return `현재 목표: 작은 나무를 캐서 나무 3개 모으기 (${snapshot.wood}/3)`;
  }
  if (snapshot.hammer <= 0 && !snapshot.hasWorkbench && snapshot.craftingTable <= 0) {
    return "현재 목표: 상자를 찾아 망치 얻기";
  }
  if (snapshot.craftingTable <= 0 && !snapshot.hasWorkbench) {
    return "현재 목표: 인벤토리 2x2에서 나무 3개 + 망치 1개로 제작대 만들기";
  }
  if (!snapshot.hasWorkbench) {
    return "현재 목표: 제작대를 선택하고 P로 설치한 뒤 E/좌클릭으로 사용하기";
  }
  if (!snapshot.hasPickaxe) {
    return "현재 목표: 제작대 3x3에서 막대기 2개 + 돌 3개로 곡괭이 만들기";
  }
  if (!snapshot.hasBag) {
    return `현재 목표: 가죽 13개를 모아 가방 만들기 (${snapshot.leather}/13)`;
  }
  if (!snapshot.hasSmelter && snapshot.smelter <= 0) {
    return "현재 목표: 상자를 더 찾아 재련대 얻기";
  }
  return "현재 목표: 동굴과 마을을 탐험하며 더 좋은 장비 만들기";
}
