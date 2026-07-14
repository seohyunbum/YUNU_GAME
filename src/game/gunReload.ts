import type { ItemId } from "./types";

// 거너 총기 장전 시스템 — 순수 로직 leaf(main.ts import 금지).
// 총기는 탄창(발수)을 가지며, 소진 시(또는 수동으로) 1.5초 장전. 등급 높은 총일수록 탄창이 크다.
// 탄약은 세션 내 상태(세이브 미지속) — 로드/새 게임 시 만탄으로 초기화한다.

export const GUN_RELOAD_MS = 1500; // 장전 소요(장전음과 함께)

// 총기별 탄창 크기 — 권총 6 < 소총 8 < 날카로운 흑요석 권총 40 (등급 오름차순).
export const GUN_MAGAZINE: Record<ItemId, number> = {
  pistol: 6,
  rifle: 8,
  sharp_obsidian_gun: 40,
};

export function isReloadableGun(item: ItemId | null | undefined): item is ItemId {
  return !!item && GUN_MAGAZINE[item] !== undefined;
}
export function gunMagazineSize(item: ItemId): number {
  return GUN_MAGAZINE[item] ?? 0;
}

export interface ReloadState {
  ammoByGun: Record<ItemId, number>; // 총기별 현재 탄약(미기록=만탄으로 취급)
  reloadingGun: ItemId | null;
  reloadingUntil: number; // 장전 완료 시각(ms, performance.now 기준). 0=장전 안 함
}

export function createReloadState(): ReloadState {
  return { ammoByGun: {}, reloadingGun: null, reloadingUntil: 0 };
}

// 세션 초기화(로드/새 게임) — 모든 총 만탄, 장전 상태 해제.
export function resetReloadState(state: ReloadState): void {
  state.ammoByGun = {};
  state.reloadingGun = null;
  state.reloadingUntil = 0;
}

// 현재 탄약 — 미기록이면 만탄(처음 든 총). 비총기는 0.
export function ammoInGun(state: ReloadState, item: ItemId): number {
  if (!isReloadableGun(item)) return 0;
  const recorded = state.ammoByGun[item];
  return recorded === undefined ? gunMagazineSize(item) : recorded;
}

export function isReloading(state: ReloadState, now: number): boolean {
  return state.reloadingUntil > 0 && now < state.reloadingUntil;
}

// 장전 진행도 0..1(HUD·연출용). 장전 중 아니면 1.
export function reloadProgress(state: ReloadState, now: number): number {
  if (state.reloadingUntil <= 0) return 1;
  const remain = state.reloadingUntil - now;
  if (remain <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - remain / GUN_RELOAD_MS));
}

// 발사 가능? — 장전 중 아님 + 탄약 있음.
export function canFireGun(state: ReloadState, item: ItemId, now: number): boolean {
  if (!isReloadableGun(item)) return true; // 비총기(활·석궁 등)는 장전 개념 없음
  if (isReloading(state, now)) return false;
  return ammoInGun(state, item) > 0;
}

// 한 발 소비 → 남은 탄약 반환. 총기 아니면 무시(양수 반환).
export function consumeGunShot(state: ReloadState, item: ItemId): number {
  if (!isReloadableGun(item)) return 1;
  const remain = Math.max(0, ammoInGun(state, item) - 1);
  state.ammoByGun[item] = remain;
  return remain;
}

// 장전 시작 — 유효 총기 + 만탄 아님 + 이미 장전 중 아님일 때만 true. now 기준 reloadingUntil 설정.
export function beginReload(state: ReloadState, item: ItemId, now: number): boolean {
  if (!isReloadableGun(item)) return false;
  if (isReloading(state, now)) return false;
  if (ammoInGun(state, item) >= gunMagazineSize(item)) return false; // 이미 가득
  state.reloadingGun = item;
  state.reloadingUntil = now + GUN_RELOAD_MS;
  return true;
}

// 매 프레임 — 장전 완료 시각이 지났으면 만탄 채우고 상태 해제. 이번 틱에 완료됐으면 true(완료음/HUD 트리거용).
export function tickReload(state: ReloadState, now: number): boolean {
  if (state.reloadingUntil <= 0 || now < state.reloadingUntil) return false;
  const gun = state.reloadingGun;
  if (gun) state.ammoByGun[gun] = gunMagazineSize(gun);
  state.reloadingGun = null;
  state.reloadingUntil = 0;
  return true;
}
