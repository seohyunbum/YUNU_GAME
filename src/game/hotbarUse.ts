import { HUNGER_MAX } from "./constants";
import { ARMOR_VALUE, HEAL_ITEMS, ITEM_NAMES, PLACEABLE_TYPES, RANGED_WEAPONS, SHIELD_DEFENSE } from "./items";
import type { ItemId, PanelType } from "./types";

const HEAL_ITEM_COOLDOWN_MS = 1000;

export interface HotbarUseContext {
  currentPanel(): PanelType;
  health(): number;
  maxHealth(): number;
  hunger(): number;
  healItemCooldownUntil(): number;
  now(): number;
  setHealth(value: number): void;
  setHunger(value: number): void;
  setHealItemCooldownUntil(value: number): void;
  resetStarvationTimer(): void;
  openPanel(panel: Exclude<PanelType, null>): void;
  fireRangedWeapon(item: ItemId): void;
  useSelectedBucketOnLook(): void;
  useDragonSpawnItem(): void;
  showMirrorView(): void;
  removeItem(item: ItemId, count: number): boolean;
  equipArmor(item: ItemId): void;
  equipShield(item: ItemId): void;
  playHandAction(): void;
  spawnHealEffect(): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
  showMessage(text: string): void;
  renderHud(): void;
}

function isBucketItem(item: ItemId) {
  return item === "bucket" || item === "water_bucket" || item === "lava_bucket";
}

export function useHotbarItem(item: ItemId | null | undefined, context: HotbarUseContext) {
  if (!item) return;
  if (item === "tutorial_book") {
    context.openPanel("book");
    return;
  }
  if (context.currentPanel() !== null) return;
  if (RANGED_WEAPONS.has(item)) {
    context.fireRangedWeapon(item);
    return;
  }
  if (isBucketItem(item)) {
    context.useSelectedBucketOnLook();
    return;
  }
  if (item === "dragon_spawn") {
    context.useDragonSpawnItem();
    return;
  }
  if (item === "building_block") {
    context.showMessage("쌓기블록을 들었습니다. 오른쪽 클릭으로 바라보는 블록의 옆에 붙이고 좌클릭/E로 회수합니다.");
    return;
  }
  if (PLACEABLE_TYPES[item]) {
    context.showMessage("설치 아이템은 인벤토리에서 아래 드롭존으로 드래그하면 설치합니다.");
    return;
  }
  if (item === "mirror") {
    context.showMirrorView();
    return;
  }

  const healAmount = HEAL_ITEMS[item];
  if (healAmount) {
    if (context.health() >= context.maxHealth()) {
      context.showMessage("체력이 이미 가득 차 있습니다.");
      return;
    }
    const remainingMs = context.healItemCooldownUntil() - context.now();
    if (remainingMs > 0) {
      context.showMessage(`구급상자는 ${Math.ceil(remainingMs / 1000)}초 후 다시 사용할 수 있습니다.`);
      return;
    }
    if (context.removeItem(item, 1)) {
      const healed = Math.min(healAmount, context.maxHealth() - context.health());
      context.setHealth(Math.min(context.maxHealth(), context.health() + healAmount));
      context.setHealItemCooldownUntil(context.now() + HEAL_ITEM_COOLDOWN_MS);
      context.playHandAction();
      context.spawnHealEffect();
      context.playTone(720, 0.1, "triangle", 0.026);
      context.showMessage(`${ITEM_NAMES[item] ?? item} 사용: 체력 ${Math.ceil(healed)} 회복.`);
      context.renderHud();
    }
    return;
  }

  if (item === "meat") {
    if (context.hunger() >= HUNGER_MAX) {
      context.showMessage("배고픔이 이미 가득 차 있습니다.");
      return;
    }
    if (context.removeItem("meat", 1)) {
      const hunger = Math.min(HUNGER_MAX, context.hunger() + 1);
      context.setHunger(hunger);
      if (hunger > 0) context.resetStarvationTimer();
      context.playHandAction();
      context.showMessage(`고기를 먹어 배고픔이 회복되었습니다. 배고픔 ${hunger}/${HUNGER_MAX}.`);
      context.renderHud();
    }
    return;
  }

  if (ARMOR_VALUE[item]) {
    context.equipArmor(item);
    context.showMessage(`${ITEM_NAMES[item] ?? item}을 착용했습니다.`);
    context.renderHud();
    return;
  }
  if (SHIELD_DEFENSE[item]) {
    context.equipShield(item);
    context.showMessage(`${ITEM_NAMES[item] ?? item}을 장착했습니다.`);
    context.renderHud();
  }
}
