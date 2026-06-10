import { FINAL_BOSS_CHAPTER, nextBossTarget } from "./game/bossChapters";
import type { FieldBossQuestView } from "./game/fieldBosses";
import { BOSS_STATS } from "./game/monsters";
import type { ItemId, PlayerClassId, TutorialProgress } from "./game/types";

// 직업별 "한 단계 위" 무기 제작 퀘스트 — 시작 무기보다 상위 티어를 정확한 레시피와 함께 안내한다.
export const CLASS_WEAPON_QUESTS: Record<PlayerClassId, { items: ItemId[]; title: string; detail: string }> = {
  warrior: { items: ["diamond_sword", "diamond_dagger"], title: "다이아 검 만들기", detail: "시작 무기인 철 검보다 강한 다이아 검(제련된 다이아몬드 2 + 막대기 1)을 제작대에서 만드세요. 다이아몬드는 동굴 깊은 곳에서 캘 수 있습니다." },
  healer: { items: ["crystal_staff", "arcane_staff"], title: "수정 지팡이 만들기", detail: "마법봉보다 강한 수정 지팡이(제련된 나무 3 + 다이아 가루 2 + 금 가루 2)를 만드세요. 가루는 분쇄기에서 만듭니다." },
  mage: { items: ["crystal_staff", "arcane_staff"], title: "수정 지팡이 만들기", detail: "마법봉보다 강한 수정 지팡이(제련된 나무 3 + 다이아 가루 2 + 금 가루 2)를 만드세요. 가루는 분쇄기에서 만듭니다." },
  summoner: { items: ["crystal_staff", "arcane_staff"], title: "수정 지팡이 만들기", detail: "마법봉보다 강한 수정 지팡이(제련된 나무 3 + 다이아 가루 2 + 금 가루 2)를 만드세요. 가루는 분쇄기에서 만듭니다." },
  gunner: { items: ["rifle"], title: "소총 만들기", detail: "권총보다 강한 소총(제련된 철 10 + 제련된 나무 4 + 석탄 4)을 확장 제작대에서 만드세요." },
  tanker: { items: ["iron_sword", "iron_dagger"], title: "철 검 만들기", detail: "방패와 함께 쓸 철 검(제련된 철 2 + 막대기 1)을 제작대에서 만드세요." },
};

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
  playerClass: PlayerClassId;
  classWeaponCount: number;
  hasBasicArmor: boolean;
  hasSmelter: boolean;
  smelter: number;
  bossChapter: number;
  fieldBossQuest: FieldBossQuestView | null;
  completedStepIds: readonly string[];
  achievedStepIds: readonly string[];
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

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = { completedStepIds: [], achievedStepIds: [] };

const completed = (snapshot: ObjectiveSnapshot, id: string) => snapshot.completedStepIds.includes(id);

// 한 번 조건을 달성한 단계는 영구 기록한다 — 제작대 회수 등으로 조건이 풀려도 "완료"가 유지된다.
export function latchAchievedObjectives(progress: TutorialProgress, snapshot: ObjectiveSnapshot) {
  for (const step of TUTORIAL_STEPS) {
    if (progress.achievedStepIds.includes(step.id)) continue;
    if (step.completed(snapshot)) progress.achievedStepIds.push(step.id);
  }
}

const stepAchieved = (snapshot: ObjectiveSnapshot, step: TutorialStep) => snapshot.achievedStepIds.includes(step.id) || step.completed(snapshot);

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "gather_wood",
    title: (snapshot) => `작은 나무를 캐서 나무 3개 모으기 (${Math.min(snapshot.wood, 3)}/3)`,
    detail: "작은 나무는 맨손으로 캘 수 있습니다. 가까이 다가가서 십자선으로 바라본 뒤 E 또는 좌클릭을 눌러 여러 번 휘두르세요.",
    progress: (snapshot) => `${Math.min(snapshot.wood, 3)}/3`,
    completed: (snapshot) => snapshot.wood >= 3,
    reward: { experience: 18, items: { stick: 4 }, label: "경험치 18 + 나무 막대기 4개" },
  },
  {
    id: "find_hammer",
    title: (snapshot) => `상자를 열어 망치 구하기 (${snapshot.hammer > 0 ? 1 : 0}/1)`,
    detail: "100걸음마다 상자가 나타날 수 있습니다. 상자를 바라보고 E 또는 좌클릭으로 열면 망치가 나올 수 있습니다.",
    progress: (snapshot) => `${snapshot.hammer > 0 ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hammer > 0 || snapshot.craftingTable > 0 || snapshot.hasWorkbench,
    reward: { experience: 24, items: { meat: 4 }, label: "경험치 24 + 고기 4개" },
  },
  {
    id: "craft_workbench_item",
    title: (snapshot) => `인벤토리 2x2에서 제작대 만들기 (${snapshot.craftingTable > 0 || snapshot.hasWorkbench ? 1 : 0}/1)`,
    detail: "I 키로 인벤토리를 열고 미니 제작대 2x2에 나무 3개와 망치 1개를 넣으세요. 재료 위치는 상관없습니다.",
    progress: (snapshot) => `${snapshot.craftingTable > 0 || snapshot.hasWorkbench ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.craftingTable > 0 || snapshot.hasWorkbench,
    reward: { experience: 30, items: { wood: 6 }, label: "경험치 30 + 나무 6개" },
  },
  {
    id: "place_workbench",
    title: (snapshot) => `제작대를 설치하고 사용하기 (${snapshot.hasWorkbench ? 1 : 0}/1)`,
    detail: "인벤토리에서 제작대를 아래 드롭존으로 드래그해 설치하세요. 설치된 제작대는 좌클릭 또는 E로 3x3 제작창을 열 수 있습니다.",
    progress: (snapshot) => `${snapshot.hasWorkbench ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasWorkbench,
    reward: { experience: 32, items: { leather: 5 }, label: "경험치 32 + 가죽 5개" },
  },
  {
    id: "gather_leather",
    title: (snapshot) => `동물을 사냥해 가죽 7개 모으기 (${Math.min(snapshot.leather, 7)}/7)`,
    detail: "말, 소, 돼지 같은 동물은 공격하면 천천히 도망갑니다. 가죽은 가방 제작에 꼭 필요합니다.",
    progress: (snapshot) => `${Math.min(snapshot.leather, 7)}/7`,
    completed: (snapshot) => snapshot.leather >= 7 || snapshot.hasBag,
    reward: { experience: 70, items: { medkit: 4, meat: 3 }, label: "경험치 70 + 구급상자 4개 + 고기 3개" },
  },
  {
    id: "craft_bag",
    title: (snapshot) => `제작대에서 가방 만들기 (${snapshot.hasBag ? 1 : 0}/1)`,
    detail: "제작대에서 가죽 7개로 가방을 만들면 인벤토리 가방 칸이 40칸으로 확장됩니다.",
    progress: (snapshot) => `${snapshot.hasBag ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasBag,
    reward: { experience: 95, items: { stone: 12, stick: 6 }, label: "경험치 95 + 돌 12개 + 막대기 6개" },
  },
  {
    id: "craft_pickaxe",
    title: (snapshot) => `돌 곡괭이 만들기 (${snapshot.hasPickaxe ? 1 : 0}/1)`,
    detail: "제작대 3x3에서 막대기 2개와 돌 4개를 조합하면 돌 곡괭이를 만들 수 있습니다. 광물 채집의 시작입니다.",
    progress: (snapshot) => `${snapshot.hasPickaxe ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasPickaxe,
    reward: { experience: 120, items: { coal: 8, iron: 2 }, label: "경험치 120 + 석탄 8개 + 철 2개" },
  },
  {
    id: "craft_basic_armor",
    title: (snapshot) => `초급 방어구 만들기 (${snapshot.hasBasicArmor ? 1 : 0}/1)`,
    detail: "제작대에서 가죽 8개로 가죽 갑옷을 만들 수 있습니다. 방어력이 오르면 거미나 늑대의 피해를 더 잘 버팁니다.",
    progress: (snapshot) => `${snapshot.hasBasicArmor ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.hasBasicArmor,
    reward: { experience: 160, items: { leather: 6, iron: 3 }, label: "경험치 160 + 가죽 6개 + 철 3개" },
  },
  {
    id: "craft_basic_weapon",
    title: (snapshot) => `${CLASS_WEAPON_QUESTS[snapshot.playerClass].title} (${snapshot.classWeaponCount > 0 ? 1 : 0}/1)`,
    detail: "직업에 맞는 다음 단계 무기를 만드는 졸업 과제입니다.",
    progress: (snapshot) => `${snapshot.classWeaponCount > 0 ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.classWeaponCount > 0,
    reward: { experience: 250, items: { iron: 8, diamond: 1, medkit: 3 }, label: "경험치 250 + 철 8개 + 다이아몬드 1개 + 구급상자 3개" },
  },
];

export function currentObjective(snapshot: ObjectiveSnapshot): TutorialObjective {
  if (snapshot.health <= 3) return survivalObjective("체력이 낮습니다", "고기를 먹거나 침대/구급상자로 회복하세요.", "생존 우선");
  if (snapshot.hunger <= 1) return survivalObjective("배고픔이 낮습니다", "고기를 먹어 배고픔을 회복하세요. 배고픔이 0이면 체력이 줄어듭니다.", "생존 우선");
  const nextStep = TUTORIAL_STEPS.find((step) => !completed(snapshot, step.id));
  if (nextStep) {
    const achieved = stepAchieved(snapshot, nextStep);
    return {
      id: nextStep.id,
      title: achieved ? `${nextStep.title(snapshot).replace(/\(\d+\/(\d+)\)/, "($1/$1)")}` : nextStep.title(snapshot),
      detail: nextStep.id === "craft_basic_weapon" ? CLASS_WEAPON_QUESTS[snapshot.playerClass].detail : nextStep.detail,
      progress: achieved ? "완료 — 클릭해서 보상 받기" : nextStep.progress(snapshot),
      reward: nextStep.reward,
      completed: achieved,
      kind: "tutorial",
    };
  }
  // 맵 필드 보스 퀘스트 — 현재 맵의 보스가 살아 있거나(처치 안내) 처치 후 보상 미수령이면 표시
  const fieldBossQuest = snapshot.fieldBossQuest;
  if (fieldBossQuest && !completed(snapshot, fieldBossQuest.id)) {
    return {
      id: fieldBossQuest.id,
      title: `${fieldBossQuest.mapName}의 ${fieldBossQuest.bossName} 처치하기 (${fieldBossQuest.defeated ? 1 : 0}/1)`,
      detail: `이 맵 어딘가에 Lv ${fieldBossQuest.level} ${fieldBossQuest.bossName}이(가) 있습니다. 지도(M)에 위치가 표시됩니다. 한 번 처치하면 다시 나타나지 않습니다.`,
      progress: fieldBossQuest.defeated ? "처치 완료 — 클릭해서 보상 받기" : "맵 보스",
      reward: { experience: fieldBossQuest.rewardExperience, items: fieldBossQuest.rewardItems, label: fieldBossQuest.rewardLabel },
      completed: fieldBossQuest.defeated,
      kind: "tutorial",
    };
  }

  const nextBoss = nextBossTarget(snapshot.bossChapter);
  if (nextBoss) {
    return {
      id: "boss_progression",
      title: `챕터 ${nextBoss.chapter}/${FINAL_BOSS_CHAPTER} — ${BOSS_STATS[nextBoss.kind].name} 처치 준비하기`,
      detail: `권장 레벨 ${nextBoss.recommendedLevel} 이상. 장비를 강화한 뒤 보스를 찾아가 처치하면 다음 보스의 봉인이 풀립니다.`,
      progress: `챕터 ${snapshot.bossChapter}/${FINAL_BOSS_CHAPTER} 클리어`,
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
