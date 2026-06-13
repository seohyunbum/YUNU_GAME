import { FINAL_BOSS_CHAPTER, nextBossTarget } from "./game/bossChapters";
import { getWorldMapById } from "./game/worldMaps";
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
  countItem(item: ItemId): number;
  totalSteps: number;
  level: number;
  inCave: boolean;
  predatorKills: number;
  mapOpened: boolean;
  saved: boolean;
  shopOpened: boolean;
  hasWorkbench: boolean;
  hasPickaxe: boolean;
  hasBag: boolean;
  playerClass: PlayerClassId;
  classWeaponCount: number;
  hasBasicArmor: boolean;
  hasSmelter: boolean;
  trainingTotal: number;
  trainingKindsDone: number;
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

// 단계 빌더 — 수량형(n/목표)과 체크형(0/1)
function countQuest(id: string, goal: number, count: (snapshot: ObjectiveSnapshot) => number, titleText: string, detail: string, reward: TutorialReward): TutorialStep {
  return {
    id,
    title: (snapshot) => `${titleText} (${Math.min(count(snapshot), goal)}/${goal})`,
    detail,
    progress: (snapshot) => `${Math.min(count(snapshot), goal)}/${goal}`,
    completed: (snapshot) => count(snapshot) >= goal,
    reward,
  };
}

function checkQuest(id: string, done: (snapshot: ObjectiveSnapshot) => boolean, titleText: string, detail: string, reward: TutorialReward): TutorialStep {
  return {
    id,
    title: (snapshot) => `${titleText} (${done(snapshot) ? 1 : 0}/1)`,
    detail,
    progress: (snapshot) => `${done(snapshot) ? 1 : 0}/1`,
    completed: done,
    reward,
  };
}

const SHOVEL_ITEMS: ItemId[] = ["wood_shovel", "stone_shovel", "copper_shovel", "iron_shovel", "gold_shovel", "diamond_shovel"];

// 25단계 초보자 가이드 — 이동·채집·제작·사냥·광질·동굴·제련·전투·회복·지도·저장·마을·성장·직업무기 순.
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  // ── 1장. 첫걸음 ──
  countQuest("first_steps", 50, (s) => s.totalSteps, "주변을 50걸음 걸어보기", "WASD로 움직이고 마우스로 시점을 돌립니다. Space로 점프, Shift+W로 달릴 수 있습니다. 가볍게 주변을 둘러보세요.", { experience: 12, items: { meat: 1 }, label: "경험치 12 + 고기 1개" }),
  countQuest("gather_wood", 3, (s) => s.countItem("wood"), "작은 나무를 캐서 나무 3개 모으기", "작은 나무는 맨손으로 캘 수 있습니다. 가까이 다가가서 십자선으로 바라본 뒤 E 또는 좌클릭을 눌러 여러 번 휘두르세요.", { experience: 20, items: { stick: 4 }, label: "경험치 20 + 나무 막대기 4개" }),
  {
    id: "find_hammer",
    title: (snapshot) => `상자를 열어 망치 구하기 (${snapshot.countItem("hammer") > 0 ? 1 : 0}/1)`,
    detail: "100걸음마다 상자가 나타날 수 있습니다. 상자를 바라보고 E 또는 좌클릭으로 열면 망치가 나올 수 있습니다.",
    progress: (snapshot) => `${snapshot.countItem("hammer") > 0 ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.countItem("hammer") > 0 || snapshot.countItem("crafting_table") > 0 || snapshot.hasWorkbench,
    reward: { experience: 28, items: { meat: 3 }, label: "경험치 28 + 고기 3개" },
  },
  {
    id: "craft_workbench_item",
    title: (snapshot) => `인벤토리 2x2에서 제작대 만들기 (${snapshot.countItem("crafting_table") > 0 || snapshot.hasWorkbench ? 1 : 0}/1)`,
    detail: "I 키로 인벤토리를 열고 미니 제작대 2x2에 나무 3개와 망치 1개를 넣으세요. 재료 위치는 상관없습니다.",
    progress: (snapshot) => `${snapshot.countItem("crafting_table") > 0 || snapshot.hasWorkbench ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.countItem("crafting_table") > 0 || snapshot.hasWorkbench,
    reward: { experience: 36, items: { wood: 6 }, label: "경험치 36 + 나무 6개" },
  },
  checkQuest("place_workbench", (s) => s.hasWorkbench, "제작대를 설치하고 사용하기", "인벤토리에서 제작대를 우클릭하면 바로 설치됩니다. 설치된 제작대는 좌클릭 또는 E로 3x3 제작창을 열 수 있습니다.", { experience: 44, items: { leather: 3 }, label: "경험치 44 + 가죽 3개" }),
  // ── 2장. 생존 기초 ──
  countQuest("stock_meat", 5, (s) => s.countItem("meat"), "고기 5개 비축하기", "동물을 사냥하면 고기가 나옵니다. 배고픔이 낮아지면 고기를 핫바에서 선택해 먹으세요. 배고픔이 0이 되면 체력이 줄어듭니다.", { experience: 52, items: { medkit: 1 }, label: "경험치 52 + 구급상자 1개" }),
  {
    id: "gather_leather",
    title: (snapshot) => `동물을 사냥해 가죽 7개 모으기 (${Math.min(snapshot.countItem("leather"), 7)}/7)`,
    detail: "말, 소, 돼지 같은 동물은 공격하면 천천히 도망갑니다. 가죽은 가방 제작에 꼭 필요합니다.",
    progress: (snapshot) => `${Math.min(snapshot.countItem("leather"), 7)}/7`,
    completed: (snapshot) => snapshot.countItem("leather") >= 7 || snapshot.hasBag,
    reward: { experience: 80, items: { medkit: 3 }, label: "경험치 80 + 구급상자 3개" },
  },
  checkQuest("craft_bag", (s) => s.hasBag, "제작대에서 가방 만들기", "제작대에서 가죽 7개로 가방을 만들면 인벤토리 가방 칸이 40칸으로 확장됩니다.", { experience: 96, items: { stone: 12, stick: 6 }, label: "경험치 96 + 돌 12개 + 막대기 6개" }),
  countQuest("craft_shovel", 1, (s) => SHOVEL_ITEMS.reduce((sum, item) => sum + s.countItem(item), 0), "나무 삽 만들기", "제작대에서 나무 1개 + 막대기 2개로 나무 삽을 만드세요. 삽이 있으면 흙을 훨씬 빠르게 팔 수 있습니다.", { experience: 110, items: { wood: 4 }, label: "경험치 110 + 나무 4개" }),
  // ── 3장. 도구와 광물 ──
  checkQuest("craft_pickaxe", (s) => s.hasPickaxe, "돌 곡괭이 만들기", "제작대 3x3에서 막대기 2개와 돌 4개를 조합하면 돌 곡괭이를 만들 수 있습니다. 광물 채집의 시작입니다.", { experience: 120, items: { coal: 4 }, label: "경험치 120 + 석탄 4개" }),
  countQuest("mine_stone", 6, (s) => s.countItem("stone"), "곡괭이로 돌 6개 캐기", "산 지형의 회색 돌 바닥을 곡괭이로 캐면 돌이 나옵니다. 돌은 도구와 건축의 기본 재료입니다.", { experience: 140, items: { stone: 4 }, label: "경험치 140 + 돌 4개" }),
  countQuest("mine_coal", 4, (s) => s.countItem("coal"), "석탄 4개 캐기", "검은 점이 박힌 석탄 광맥을 곡괭이로 캐세요. 석탄은 제련의 연료입니다.", { experience: 160, items: { iron: 2 }, label: "경험치 160 + 철 2개" }),
  checkQuest("visit_cave", (s) => s.inCave, "동굴에 들어가보기", "500걸음마다 낮은 확률로 동굴 입구가 나타납니다. 동굴 안에는 돌·석탄·철은 물론 금과 다이아몬드도 있습니다.", { experience: 180, items: { medkit: 2 }, label: "경험치 180 + 구급상자 2개" }),
  checkQuest("get_grinder", (s) => s.countItem("grinder") > 0, "분쇄기 구하기", "제작대 3×3에서 망치 2개 + 철 6개로 분쇄기를 만드세요. 분쇄기가 있으면 광물을 가루로 만들 수 있어, 철 가루 20개 + 석탄 가루 5개를 모아 거래상에게 제련대와 교환할 수 있습니다. 마을 상점에서 4200P에 구매할 수도 있습니다.", { experience: 190, items: { coal: 4, iron: 2 }, label: "경험치 190 + 석탄 4개 + 철 2개" }),
  checkQuest("get_smelter", (s) => s.hasSmelter || s.countItem("smelter") > 0, "제련대 구하기", "분쇄기로 철 가루 20개 + 석탄 가루 5개를 만들어 마을 거래상에게 제련대와 교환하세요. 상자 드랍(2% 확률)이나 마을 상점(2600P)으로도 얻을 수 있습니다. 제련대가 있어야 철을 제련할 수 있습니다.", { experience: 200, items: { coal: 6 }, label: "경험치 200 + 석탄 6개" }),
  countQuest("smelt_iron", 3, (s) => s.countItem("refined_iron"), "철 3개 제련하기", "설치한 제련대에 철과 석탄을 넣어 제련된 철을 만드세요. 제련된 철은 철 도구·무기·갑옷의 재료입니다.", { experience: 220, items: { iron: 4 }, label: "경험치 220 + 철 4개" }),
  // ── 4장. 전투와 회복 ──
  countQuest("hunt_predators", 3, (s) => s.predatorKills, "야생 몬스터 3마리 처치하기", "거미나 늑대 같은 야생 몬스터가 부르르 떨면 공격 신호입니다. 옆으로 피했다가 반격해 보세요.", { experience: 240, items: { meat: 6 }, label: "경험치 240 + 고기 6개" }),
  checkQuest("craft_basic_armor", (s) => s.hasBasicArmor, "초급 방어구 만들기", "제작대에서 가죽 8개로 가죽 갑옷을 만들 수 있습니다. 방어력이 오르면 거미나 늑대의 피해를 더 잘 버팁니다.", { experience: 270, items: { leather: 6, iron: 3 }, label: "경험치 270 + 가죽 6개 + 철 3개" }),
  countQuest("craft_bed", 1, (s) => s.countItem("bed"), "침대 만들기", "제작대에서 가죽 3 + 나무 3 + 막대기 3으로 침대를 만드세요. 설치한 침대에서 우클릭으로 자면 체력이 회복됩니다.", { experience: 280, items: { leather: 4 }, label: "경험치 280 + 가죽 4개" }),
  // ── 5장. 세상 익히기 ──
  checkQuest("open_map", (s) => s.mapOpened, "지도 열어보기", "M 키로 지역 지도를 엽니다. 지역별 권장 레벨, 보스 위치, 원정 맵 텔레포트를 확인할 수 있습니다.", { experience: 290, items: { meat: 4 }, label: "경험치 290 + 고기 4개" }),
  checkQuest("save_game", (s) => s.saved, "게임 저장하기", "Ctrl+S 또는 왼쪽 위 저장 버튼으로 진행 상황을 저장하세요. 저장은 5개까지 보관됩니다.", { experience: 300, items: { medkit: 2 }, label: "경험치 300 + 구급상자 2개" }),
  checkQuest("visit_shop", (s) => s.shopOpened, "마을 상점 구경하기", "들판의 마을을 찾아 상점 건물에 들어가 보세요. 미니게임 포인트로 물건을 사고팔 수 있습니다.", { experience: 320, items: { gold: 2 }, label: "경험치 320 + 금 2개" }),
  countQuest("reach_level8", 8, (s) => s.level, "레벨 8 달성하기", "몬스터 사냥과 퀘스트 보상으로 경험치를 모으세요. 레벨이 오를 때마다 체력·공격·방어가 +1씩 늘어납니다.", { experience: 400, items: { iron: 6, gold: 3 }, label: "경험치 400 + 철 6개 + 금 3개" }),
  countQuest("train_once", 1, (s) => Math.min(1, s.trainingTotal), "훈련장에서 훈련 1번 성공하기", "시작 초원 마을 동쪽의 울타리 훈련장(레벨 10부터)에서 역기들기·과녁맞추기 같은 훈련에 도전하세요. 성공하면 스탯이 영구히 오릅니다!", { experience: 420, items: { medkit: 2 }, label: "경험치 420 + 구급상자 2개" }),
  countQuest("train_all_kinds", 4, (s) => s.trainingKindsDone, "네 가지 훈련 모두 성공하기", "역기들기(체력)·과녁맞추기(공격)·방패막기(방어)·명상호흡(마나)을 한 번씩 성공해 보세요. 훈련은 할수록 어려워지지만 스탯은 계속 쌓입니다.", { experience: 460, items: { diamond: 1, medkit: 2 }, label: "경험치 460 + 다이아몬드 1개 + 구급상자 2개" }),
  // ── 졸업 과제 ──
  {
    id: "craft_basic_weapon",
    title: (snapshot) => `${CLASS_WEAPON_QUESTS[snapshot.playerClass].title} (${snapshot.classWeaponCount > 0 ? 1 : 0}/1)`,
    detail: "직업에 맞는 다음 단계 무기를 만드는 졸업 과제입니다.",
    progress: (snapshot) => `${snapshot.classWeaponCount > 0 ? 1 : 0}/1`,
    completed: (snapshot) => snapshot.classWeaponCount > 0,
    reward: { experience: 500, items: { iron: 8, diamond: 1, medkit: 3 }, label: "경험치 500 + 철 8개 + 다이아몬드 1개 + 구급상자 3개" },
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
      detail: `${getWorldMapById(nextBoss.mapId).name}에 있습니다 (지도 M에서 텔레포트, 권장 레벨 ${nextBoss.recommendedLevel} 이상). 장비를 강화한 뒤 처치하면 다음 보스의 봉인이 풀립니다.`,
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
