import type { ItemId, TutorialProgress } from "./game/types";

export interface ObjectiveSnapshot {
  health: number;
  hunger: number;
  wood: number;
  hammer: number;
  craftingTable: number;
  leather: number;
  stone: number;
  hasWorkbench: boolean;
  hasPickaxe: boolean;
  hasBag: boolean;
  hasBasicWeapon: boolean;
  hasBasicArmor: boolean;
  hasSmelter: boolean;
  smelter: number;
  nextBossName: string | null;
  completedStepIds: readonly string[];
}

export interface TutorialReward {
  experience: number;
  items?: Partial<Record<ItemId, number>>;
  label: string;
}

export interface TutorialObjective {
  id: string;
  title: string;
  detail: string;
  progress: string;
  reward: TutorialReward;
  completed: boolean;
  kind: "tutorial" | "survival" | "boss" | "complete";
}

interface TutorialStep {
  id: string;
  title(snapshot: ObjectiveSnapshot): string;
  detail: string;
  progress(snapshot: ObjectiveSnapshot): string;
  completed(snapshot: ObjectiveSnapshot): boolean;
  reward: TutorialReward;
}

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = { completedStepIds: [] };

const completed = (snapshot: ObjectiveSnapshot, id: string) => snapshot.completedStepIds.includes(id);

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "gather_wood",
    title: (snapshot) => `작은 나무를 캐서 나무 3개 모으기 (${Math.min(snapshot.wood, 3)}/3)`,
    detail: "작은 나무는 맨손으로 캘 수 있습니다. 가까이 다가가서 십자선으로 바라본 뒤 E 또는 좌클릭을 눌러 여러 번 휘두르세요.",
    progress: (snapshot) => `${Math.min(snapshot.wood, 3)}/3`,
    completed: (snapshot) => snapshot.wood >= 3,
    reward: { experience: 8, items: { stick: 2 }, label: "경험치 8 + 나무 막대기 2개" },
  },
  {
    id: "find_hammer",
    title: (snapshot) => `상자를 열어 망치 구하기 (${snapshot.hammer > 0 ? 1 : 0}/1)`,
    detail: "100걸음마다 상자가 나타날 수 있습니다. 상자를 바라보고 E 또는 좌클릭으로 열면 망치가 나올 수 있습니다.",
    progress: (snapshot) => `${snapshot.hammer > 0 ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hammer > 0 || snapshot.craftingTable > 0 || snapshot.hasWorkbench,
    reward: { experience: 10, items: { meat: 2 }, label: "경험치 10 + 고기 2개" },
  },
  {
    id: "craft_workbench_item",
    title: (snapshot) => `인벤토리 2x2에서 제작대 만들기 (${snapshot.craftingTable > 0 || snapshot.hasWorkbench ? 1 : 0}/1)`,
    detail: "I 키로 인벤토리를 열고 미니 제작대 2x2에 나무 3개와 망치 1개를 넣으세요. 재료 위치는 상관없습니다.",
    progress: (snapshot) => `${snapshot.craftingTable > 0 || snapshot.hasWorkbench ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.craftingTable > 0 || snapshot.hasWorkbench,
    reward: { experience: 12, items: { wood: 2 }, label: "경험치 12 + 나무 2개" },
  },
  {
    id: "place_workbench",
    title: (snapshot) => `제작대를 설치하고 사용하기 (${snapshot.hasWorkbench ? 1 : 0}/1)`,
    detail: "인벤토리에서 제작대를 아래 드롭존으로 드래그해 설치하세요. 설치된 제작대는 좌클릭 또는 E로 3x3 제작창을 열 수 있습니다.",
    progress: (snapshot) => `${snapshot.hasWorkbench ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasWorkbench,
    reward: { experience: 12, items: { leather: 2 }, label: "경험치 12 + 가죽 2개" },
  },
  {
    id: "gather_leather",
    title: (snapshot) => `동물을 사냥해 가죽 7개 모으기 (${Math.min(snapshot.leather, 7)}/7)`,
    detail: "말, 소, 돼지 같은 동물은 공격하면 천천히 도망갑니다. 가죽은 가방 제작에 꼭 필요합니다.",
    progress: (snapshot) => `${Math.min(snapshot.leather, 7)}/7`,
    completed: (snapshot) => snapshot.leather >= 7 || snapshot.hasBag,
    reward: { experience: 24, items: { medkit: 2 }, label: "경험치 24 + 구급상자 2개" },
  },
  {
    id: "craft_bag",
    title: (snapshot) => `제작대에서 가방 만들기 (${snapshot.hasBag ? 1 : 0}/1)`,
    detail: "제작대에서 가죽 7개로 가방을 만들면 인벤토리 가방 칸이 40칸으로 확장됩니다.",
    progress: (snapshot) => `${snapshot.hasBag ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasBag,
    reward: { experience: 35, items: { stone: 4, stick: 2 }, label: "경험치 35 + 돌 4개 + 막대기 2개" },
  },
  {
    id: "craft_pickaxe",
    title: (snapshot) => `돌 곡괭이 만들기 (${snapshot.hasPickaxe ? 1 : 0}/1)`,
    detail: "제작대 3x3에서 막대기 2개와 돌 4개를 조합하면 돌 곡괭이를 만들 수 있습니다. 광물 채집의 시작입니다.",
    progress: (snapshot) => `${snapshot.hasPickaxe ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasPickaxe,
    reward: { experience: 30, items: { coal: 2 }, label: "경험치 30 + 석탄 2개" },
  },
  {
    id: "craft_basic_weapon",
    title: (snapshot) => `초급 무기 만들기 (${snapshot.hasBasicWeapon ? 1 : 0}/1)`,
    detail: "제작대에서 나무 또는 돌 단검/검을 만들어 보세요. 무기를 들면 사냥과 몬스터 대응이 훨씬 쉬워집니다.",
    progress: (snapshot) => `${snapshot.hasBasicWeapon ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasBasicWeapon,
    reward: { experience: 35, items: { leather: 2 }, label: "경험치 35 + 가죽 2개" },
  },
  {
    id: "craft_basic_armor",
    title: (snapshot) => `초급 방어구 만들기 (${snapshot.hasBasicArmor ? 1 : 0}/1)`,
    detail: "제작대에서 가죽 8개로 가죽 갑옷을 만들 수 있습니다. 방어력이 오르면 거미나 늑대의 피해를 더 잘 버팁니다.",
    progress: (snapshot) => `${snapshot.hasBasicArmor ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasBasicArmor,
    reward: { experience: 50, items: { iron: 2 }, label: "경험치 50 + 철 2개" },
  },
];

export function currentObjective(snapshot: ObjectiveSnapshot): TutorialObjective {
  if (snapshot.health <= 3) return survivalObjective("체력이 낮습니다", "고기를 먹거나 침대/구급상자로 회복하세요.", "생존 우선");
  if (snapshot.hunger <= 1) return survivalObjective("배고픔이 낮습니다", "고기를 먹어 배고픔을 회복하세요. 배고픔이 0이면 체력이 줄어듭니다.", "생존 우선");
  const nextStep = TUTORIAL_STEPS.find((step) => !completed(snapshot, step.id));
  if (nextStep) {
    return {
      id: nextStep.id,
      title: nextStep.title(snapshot),
      detail: nextStep.detail,
      progress: nextStep.progress(snapshot),
      reward: nextStep.reward,
      completed: nextStep.completed(snapshot),
      kind: "tutorial",
    };
  }
  if (snapshot.nextBossName) {
    return {
      id: "boss_progression",
      title: `${snapshot.nextBossName} 처치 준비하기`,
      detail: "가방, 곡괭이, 무기, 방어구까지 익혔다면 더 높은 레벨 지역으로 이동해 장비를 강화하고 보스를 공략하세요.",
      progress: "장기 목표",
      reward: { experience: 0, label: "보스 전리품과 다음 성장 단계" },
      completed: false,
      kind: "boss",
    };
  }
  return {
    id: "final_complete",
    title: "불멸의 존재를 쓰러뜨렸습니다",
    detail: "최종 목표를 달성했습니다. 이제 마을과 세계를 자유롭게 확장해 보세요.",
    progress: "완료",
    reward: { experience: 0, label: "자유 플레이" },
    completed: true,
    kind: "complete",
  };
}

export function claimTutorialObjective(progress: TutorialProgress, objective: TutorialObjective) {
  if (objective.kind !== "tutorial" || !objective.completed || progress.completedStepIds.includes(objective.id)) return null;
  progress.completedStepIds.push(objective.id);
  return objective;
}

function survivalObjective(title: string, detail: string, progress: string): TutorialObjective {
  return {
    id: `survival_${title}`,
    title,
    detail,
    progress,
    reward: { experience: 0, label: "먼저 살아남기" },
    completed: false,
    kind: "survival",
  };
}
