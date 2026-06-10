import { IRON_GUARD_ARMOR, IRON_GUARD_DURATION_SECONDS, TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST } from "./constants";
import { ARMOR_VALUE, SHIELD_DEFENSE, SHIELD_DURABILITY } from "./items";
import { CLASS_PASSIVES } from "./classPassives";
import type { ItemId, PlayerClassId } from "./types";

export { TANKER_SKILL_COOLDOWN, TANKER_SKILL_COST };

export interface ShieldHitResult {
  equippedShield: ItemId | null;
  shieldDurabilityUsed: number;
  brokenItem: ItemId | null;
}

export function isShieldItem(item: ItemId | null | undefined) {
  return Boolean(item && SHIELD_DEFENSE[item]);
}

export function shouldAutoEquipShield(item: ItemId, equippedShield: ItemId | null) {
  return isShieldItem(item) && (!equippedShield || SHIELD_DEFENSE[item] > (SHIELD_DEFENSE[equippedShield] ?? 0));
}

export function bestShieldItem(counts: Record<ItemId, number>) {
  return Object.keys(counts).reduce<ItemId | null>((best, item) => (
    !isShieldItem(item) ? best : !best || SHIELD_DEFENSE[item] > (SHIELD_DEFENSE[best] ?? 0) ? item : best
  ), null);
}

export function ironGuardUntil(now: number) {
  return now + IRON_GUARD_DURATION_SECONDS * 1000;
}

export function ironGuardMessage() {
  return `철갑수호! ${IRON_GUARD_DURATION_SECONDS}초 동안 방어 +${IRON_GUARD_ARMOR}.`;
}

export function equipmentArmorValue(equippedArmor: ItemId | null, equippedShield: ItemId | null, playerClass: PlayerClassId, ironGuardUntilMs: number, now: number) {
  const armor = equippedArmor ? ARMOR_VALUE[equippedArmor] ?? 0 : 0;
  const shield = equippedShield ? SHIELD_DEFENSE[equippedShield] ?? 0 : 0;
  const guard = ironGuardUntilMs > now ? IRON_GUARD_ARMOR : 0;
  return armor + shield + CLASS_PASSIVES[playerClass].armorBonus + guard;
}

export function consumeShieldHit(equippedShield: ItemId | null, shieldDurabilityUsed: number): ShieldHitResult {
  if (!equippedShield) return { equippedShield: null, shieldDurabilityUsed: 0, brokenItem: null };
  const used = shieldDurabilityUsed + 1;
  if (used < (SHIELD_DURABILITY[equippedShield] ?? 1)) return { equippedShield, shieldDurabilityUsed: used, brokenItem: null };
  return { equippedShield: null, shieldDurabilityUsed: 0, brokenItem: equippedShield };
}

export function tankerHudStatus(equippedShield: ItemId | null, shieldDurabilityUsed: number, ironGuardUntilMs: number, now: number) {
  const shield = equippedShield ? `${Math.max(0, (SHIELD_DURABILITY[equippedShield] ?? 0) - shieldDurabilityUsed)}/${SHIELD_DURABILITY[equippedShield] ?? 0}` : "없음";
  const guardSeconds = Math.ceil(Math.max(0, (ironGuardUntilMs - now) / 1000));
  return `방패 ${shield}${guardSeconds > 0 ? ` · 철갑수호 ${guardSeconds}초` : ""}`;
}
