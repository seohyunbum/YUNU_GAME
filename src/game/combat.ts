export function calculateCombatDamage(attackPower: number, defense: number) {
  const attack = Math.max(0, Math.floor(attackPower));
  const armor = Math.max(0, Math.floor(defense));
  const gap = attack - armor;
  if (gap <= -20) return 0;
  if (gap < 0) return Math.max(1, Math.floor((attack * (20 + gap)) / 20));
  return Math.max(1, attack + Math.floor(gap / 10));
}
