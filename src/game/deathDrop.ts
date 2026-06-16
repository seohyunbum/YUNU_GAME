import type { ItemId } from "./types";

// 사망 시 슬롯 드롭 결정 (순수 함수 — 골든 테스트 가능).
export interface DeathDropContext {
  protectedItems: ReadonlySet<ItemId>; // tutorial_book / medkit / 직업 기본무기
  equippedArmor: ItemId | null;
  equippedShield: ItemId | null;
  equippedNecklace?: ItemId | null;
  isWeapon(item: ItemId): boolean; // WEAPON_DAMAGE 보유 여부
}

// true = 떨굼, false = 유지.
// 유지: (1) 현재 손에 든 슬롯이 무기류일 때, (2) 보호 아이템, (3) 착용 중인 방어구/방패.
// isHeldSlot 은 "선택된(손에 든) 슬롯인가" — 같은 무기가 다른 슬롯에 있으면 그건 떨군다(슬롯 동일성으로 판정).
export function shouldDropSlotOnDeath(item: ItemId, isHeldSlot: boolean, ctx: DeathDropContext): boolean {
  if (isHeldSlot && ctx.isWeapon(item)) return false; // 착용 중인 무기
  if (ctx.protectedItems.has(item)) return false; // 튜토리얼 책 / 구급상자 / 기본무기
  if (item === ctx.equippedArmor || item === ctx.equippedShield || item === ctx.equippedNecklace) return false; // 착용 중인 방어구/방패/목걸이
  return true;
}
