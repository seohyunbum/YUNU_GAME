export function shouldFireRangedDuringInteract(isRangedWeaponSelected: boolean, hasTarget: boolean, isCombatTarget: boolean) {
  return isRangedWeaponSelected && (!hasTarget || isCombatTarget);
}
