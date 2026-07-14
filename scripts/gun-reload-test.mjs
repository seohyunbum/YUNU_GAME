// 거너 장전 시스템 — 골든/불변식 테스트 (illia-test 패턴: vite ssrLoadModule).
//   1) 탄창 크기 — 권총<소총<흑요석권총, 등급 단조
//   2) 초기 만탄 · 소비 · 소진
//   3) 장전 — 시작 조건(만탄 거부·중복 거부), 1.5초 후 완료·만탄 복구
//   4) 발사 가능 판정 — 장전 중/탄 없음 차단, 비총기는 항상 허용
//   5) 리셋 — 만탄·장전 해제
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const gun = await server.ssrLoadModule("/src/game/gunReload.ts");

  // ── 1) 탄창 크기 ──
  assert.equal(gun.gunMagazineSize("rifle"), 8, "소총 8발");
  assert.equal(gun.gunMagazineSize("sharp_obsidian_gun"), 40, "날카로운 흑요석 권총 40발");
  assert.equal(gun.gunMagazineSize("minigun"), 60, "미니건 60발(거너 레전더리)");
  assert.ok(gun.gunMagazineSize("pistol") < gun.gunMagazineSize("rifle"), "권총 < 소총");
  assert.ok(gun.gunMagazineSize("rifle") < gun.gunMagazineSize("sharp_obsidian_gun"), "소총 < 흑요석권총(등급 단조)");
  assert.ok(gun.gunMagazineSize("sharp_obsidian_gun") < gun.gunMagazineSize("minigun"), "흑요석권총 < 미니건");
  assert.equal(gun.isReloadableGun("rifle"), true);
  assert.equal(gun.isReloadableGun("bow"), false, "활은 장전 대상 아님");
  assert.equal(gun.isReloadableGun(null), false);
  assert.equal(gun.gunMagazineSize("bow"), 0);
  assert.equal(gun.GUN_RELOAD_MS, 1500, "장전 1.5초");

  // ── 2) 초기 만탄 · 소비 ──
  const st = gun.createReloadState();
  assert.equal(gun.ammoInGun(st, "rifle"), 8, "처음 든 총은 만탄");
  assert.equal(gun.ammoInGun(st, "bow"), 0, "비총기 0");
  let remain = 8;
  for (let i = 0; i < 8; i += 1) { remain = gun.consumeGunShot(st, "rifle"); }
  assert.equal(remain, 0, "8발 소비 후 0");
  assert.equal(gun.ammoInGun(st, "rifle"), 0);
  assert.equal(gun.consumeGunShot(st, "rifle"), 0, "0에서 더 못 내려감");
  assert.equal(gun.consumeGunShot(st, "bow"), 1, "비총기 소비는 무시(양수)");

  // ── 3) 장전 ──
  const now = 10_000;
  assert.equal(gun.canFireGun(st, "rifle", now), false, "탄 없으면 발사 불가");
  assert.equal(gun.beginReload(st, "rifle", now), true, "빈 총 장전 시작");
  assert.equal(gun.isReloading(st, now), true);
  assert.equal(gun.isReloading(st, now + 800), true, "0.8초 시점 아직 장전 중");
  assert.equal(gun.beginReload(st, "rifle", now + 800), false, "장전 중 재시작 거부");
  assert.equal(gun.canFireGun(st, "rifle", now + 800), false, "장전 중 발사 불가");
  assert.ok(gun.reloadProgress(st, now + 750) > 0.4 && gun.reloadProgress(st, now + 750) < 0.6, "진행도 ~0.5");
  assert.equal(gun.tickReload(st, now + 800), false, "완료 전 tick false");
  assert.equal(gun.tickReload(st, now + 1500), true, "1.5초 후 완료 true");
  assert.equal(gun.ammoInGun(st, "rifle"), 8, "완료 시 만탄 복구");
  assert.equal(gun.isReloading(st, now + 1500), false);
  assert.equal(gun.tickReload(st, now + 1600), false, "완료 후 재트리거 없음");
  assert.equal(gun.canFireGun(st, "rifle", now + 1600), true, "만탄이면 발사 가능");

  // 만탄에서 수동 장전은 거부(발수 낭비 방지 — 이미 가득)
  assert.equal(gun.beginReload(st, "rifle", now + 1600), false, "만탄 수동 장전 거부");
  // 부분 소비 후 수동 장전 허용 (다 쓰지 않고도 장전)
  gun.consumeGunShot(st, "rifle"); gun.consumeGunShot(st, "rifle"); // 8→6
  assert.equal(gun.ammoInGun(st, "rifle"), 6);
  assert.equal(gun.beginReload(st, "rifle", now + 2000), true, "부분 소비 후 수동 장전 허용");
  gun.tickReload(st, now + 2000 + 1500);
  assert.equal(gun.ammoInGun(st, "rifle"), 8, "수동 장전도 만탄 복구");

  // ── 4) 비총기 발사 항상 허용 ──
  assert.equal(gun.canFireGun(gun.createReloadState(), "bow", 0), true);

  // ── 5) 리셋 ──
  const st2 = gun.createReloadState();
  gun.consumeGunShot(st2, "sharp_obsidian_gun");
  gun.beginReload(st2, "sharp_obsidian_gun", 5000);
  gun.resetReloadState(st2);
  assert.equal(gun.ammoInGun(st2, "sharp_obsidian_gun"), 40, "리셋 후 만탄");
  assert.equal(gun.isReloading(st2, 5000), false, "리셋 후 장전 해제");

  console.log("✓ gun-reload-test: 탄창 크기 · 소비/소진 · 장전(1.5s)·수동장전 · 발사판정 · 리셋 전부 통과");
} finally {
  await server.close();
}
