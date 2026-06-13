import { claimTutorialObjective, type TutorialObjective } from "./objectives";
import type { ItemId, TutorialProgress } from "./game/types";

// 퀘스트 보상 수령 로직 — 클릭(목표 카드)과 Q 단축키가 공유한다. main.ts 메서드 추가를 피하려 분리.
export interface ObjectiveClaimDeps {
  gainExperience(amount: number): void;
  addItem(item: ItemId, count: number): boolean;
  dropItem(item: ItemId, count: number): void;
  showMessage(text: string): void;
  renderHud(): void;
}

// 완료된 튜토리얼 목표면 보상 지급(XP + 아이템, 가방 가득이면 바닥 드롭) 후 true. 아니면 안내 후 false.
export function claimObjective(progress: TutorialProgress, objective: TutorialObjective, deps: ObjectiveClaimDeps): boolean {
  const claimed = claimTutorialObjective(progress, objective);
  if (!claimed) {
    deps.showMessage("아직 완료되지 않은 목표입니다. 마우스를 올리면 상세 설명을 볼 수 있습니다.");
    return false;
  }
  if (claimed.reward.experience > 0) deps.gainExperience(claimed.reward.experience);
  for (const [item, count] of Object.entries(claimed.reward.items ?? {})) if (!deps.addItem(item as ItemId, count ?? 0)) deps.dropItem(item as ItemId, count ?? 0);
  deps.showMessage(`튜토리얼 완료: ${claimed.title}. 보상: ${claimed.reward.label}`);
  deps.renderHud();
  return true;
}
