import * as THREE from "three";
import { createEagleVisual } from "./creatureVisuals";
import { CLASS_PASSIVES, DEFAULT_SUMMONER_PET_PROGRESS, experienceForNextPetLevel, summonerPetDamage } from "./classPassives";
import { partyGuestAttackIntercept, partyHostNotifyKill } from "./partyWorldSync";
import { PREDATOR_RETALIATE_MS } from "./constants";
import type { CompanionProgress, ItemId, ObjectType, PlayerClassId, SummonerPetProgress, WorldObject } from "./types";

export interface SummonerPetRuntime {
  petId: string | null;
  attackCooldown: number;
}

export interface SummonerPetContext {
  playerPosition: THREE.Vector3;
  playerClass(): PlayerClassId;
  possessedEagleId(): string | null;
  yaw(): number;
  elapsedTime(): number;
  now(): number;
  getObject(id: string): WorldObject | undefined;
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  removeObject(id: string): void;
  refreshSpatialObject(object: WorldObject): void;
  getGroundHeightAt(x: number, z: number): number;
  objectsNear(point: THREE.Vector3, radius: number): Iterable<WorldObject>;
  spawnHitEffect(target: WorldObject): void;
  playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void;
  showMessage(text: string): void;
  getPetProgress(): SummonerPetProgress;
  itemName(item: ItemId): string;
  rollRewardChance(baseChance: number, source: "predator" | "jammini", item: ItemId): boolean;
  grantRewardItem(item: ItemId, baseCount: number, source: "predator" | "jammini"): number;
  experienceRewardFor(target: WorldObject): number;
  gainPlayerExperience(amount: number): void;
  celebratePetLevel(level: number): void;
  renderHud(): void;
}

const desiredPosition = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const petTargetSearchCenter = new THREE.Vector3();
const PET_AURA_MIN_OPACITY = 0.24;
const PET_AURA_MAX_OPACITY = 0.42;
const PET_TRAIL_COUNT = 4;
const PET_ATTACK_FLASH_SECONDS = 0.34;

function shouldHavePet(context: SummonerPetContext) {
  return context.playerClass() === "summoner" && !context.possessedEagleId();
}

function createPassivePet(context: SummonerPetContext) {
  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return null;
  const root = createEagleVisual();
  root.scale.setScalar(0.74);
  root.position.copy(context.playerPosition);
  root.position.y = context.getGroundHeightAt(root.position.x, root.position.z) + 1.55;
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 18, 10),
    new THREE.MeshBasicMaterial({
      color: 0x9af7ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  aura.userData.skipRaycastTarget = true;
  aura.userData.skipStaticMerge = true;
  aura.userData.petAura = true;
  root.add(aura);
  const attackBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.1, 2.6, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9af7ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  attackBeam.rotation.x = Math.PI / 2;
  attackBeam.position.set(0, 0.46, -1.25);
  attackBeam.userData.skipRaycastTarget = true;
  attackBeam.userData.skipStaticMerge = true;
  attackBeam.userData.petAttackBeam = true;
  root.add(attackBeam);
  const trailGeometry = new THREE.SphereGeometry(0.11, 10, 6);
  for (let index = 0; index < PET_TRAIL_COUNT; index += 1) {
    const trail = new THREE.Mesh(
      trailGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x9af7ff,
        transparent: true,
        opacity: 0.2 - index * 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    trail.position.set(0, 0.52 - index * 0.045, 0.72 + index * 0.18);
    trail.scale.setScalar(1 - index * 0.13);
    trail.userData.skipRaycastTarget = true;
    trail.userData.skipStaticMerge = true;
    trail.userData.petTrailIndex = index;
    root.add(trail);
  }
  return context.addWorldObject("summonerPet", passive.label, root, {
    collidable: false,
    collisionRadius: 0.72,
    collisionHeight: 1.25,
  });
}

function nearestPetTarget(context: SummonerPetContext, pet: WorldObject, range: number) {
  let nearest: WorldObject | null = null;
  let nearestDistance = Infinity;
  petTargetSearchCenter.copy(context.playerPosition).lerp(pet.root.position, 0.45);
  for (const target of context.objectsNear(petTargetSearchCenter, range + 7)) {
    if (target.type !== "wildPredator" && target.type !== "jammini") continue;
    if ((target.hp ?? 0) <= 0) continue;
    const petDistance = Math.hypot(target.root.position.x - pet.root.position.x, target.root.position.z - pet.root.position.z);
    const playerDistance = Math.hypot(target.root.position.x - context.playerPosition.x, target.root.position.z - context.playerPosition.z);
    const distance = Math.min(petDistance, playerDistance);
    if (distance > range || petDistance >= nearestDistance) continue;
    nearest = target;
    nearestDistance = petDistance;
  }
  return nearest;
}

function updatePetFlight(context: SummonerPetContext, pet: WorldObject, delta: number, target: WorldObject | null) {
  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return;
  const yaw = context.yaw();
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const elapsed = context.elapsedTime();
  desiredPosition.set(
    context.playerPosition.x + forwardX * passive.flightAhead + rightX * passive.flightSide,
    context.playerPosition.y + passive.flightRise + Math.sin(elapsed * 3.2) * 0.16,
    context.playerPosition.z + forwardZ * passive.flightAhead + rightZ * passive.flightSide,
  );
  pet.root.position.lerp(desiredPosition, Math.min(1, delta * 4.2));
  context.refreshSpatialObject(pet);

  if (target) {
    toTarget.subVectors(target.root.position, pet.root.position);
    pet.root.rotation.y = -Math.atan2(toTarget.z, toTarget.x) + Math.PI / 2;
  } else {
    pet.root.rotation.y = yaw;
  }

  const flap = Math.sin(elapsed * 13.5) * 0.5;
  const auraPulse = (Math.sin(elapsed * 4) + 1) * 0.5;
  const attackStartedAt = Number(pet.root.userData.petAttackStartedAt ?? -999);
  const attackAge = elapsed - attackStartedAt;
  const attackPulse = attackAge >= 0 && attackAge < PET_ATTACK_FLASH_SECONDS ? Math.sin((attackAge / PET_ATTACK_FLASH_SECONDS) * Math.PI) : 0;
  pet.root.scale.setScalar(0.74 + attackPulse * 0.14);
  pet.root.traverse((child) => {
    const side = child.userData.flapSide;
    if (typeof side === "number") child.rotation.z = side * (0.36 + flap);
    if (child.userData.petAura && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.scale.setScalar(1 + auraPulse * 0.12 + attackPulse * 0.2);
      child.material.opacity = Math.min(0.72, PET_AURA_MIN_OPACITY + (PET_AURA_MAX_OPACITY - PET_AURA_MIN_OPACITY) * auraPulse + attackPulse * 0.22);
    }
    if (child.userData.petAttackBeam && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.visible = attackPulse > 0.02;
      child.scale.set(1 + attackPulse * 0.8, 1 + attackPulse * 0.6, 1);
      child.material.opacity = attackPulse * 0.62;
    }
    const trailIndex = child.userData.petTrailIndex;
    if (typeof trailIndex === "number" && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      const trailPulse = (Math.sin(elapsed * 5.2 - trailIndex * 0.7) + 1) * 0.5;
      child.position.x = Math.sin(elapsed * 4.1 - trailIndex) * 0.035;
      child.position.y = 0.52 - trailIndex * 0.045 + trailPulse * 0.035;
      child.scale.setScalar((1 - trailIndex * 0.13) * (0.9 + trailPulse * 0.18));
      child.material.opacity = Math.max(0.045, 0.2 - trailIndex * 0.035) * (0.68 + trailPulse * 0.32);
    }
  });
}

function attackTarget(runtime: SummonerPetRuntime, context: SummonerPetContext, pet: WorldObject, target: WorldObject) {
  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return;
  const damage = summonerPetDamage(context.getPetProgress());
  pet.root.userData.petAttackStartedAt = context.elapsedTime();
  runtime.attackCooldown = passive.attackInterval;
  context.spawnHitEffect(target);
  context.playTone(880, 0.055, "triangle", 0.018);
  context.playTone(420, 0.05, "sine", 0.012);
  // 파티 게스트의 동기화 몬스터는 호스트가 판정 — 연출(쿨다운·이펙트)만 로컬 재생
  if (partyGuestAttackIntercept(target, damage, "pet")) return;
  target.hp = (target.hp ?? 1) - damage;
  target.angryUntil = context.now() + PREDATOR_RETALIATE_MS;
  if ((target.hp ?? 0) <= 0) {
    grantSummonerPetKill(context, target);
    return;
  }
  context.showMessage(`독수리 정령이 ${target.name}에게 ${damage} 피해를 줬습니다.`);
}

function grantSummonerPetKill(context: SummonerPetContext, target: WorldObject) {
  if (target.type === "wildPredator") {
    const loot = target.predatorKind === "spider" ? "coal" : "meat";
    const lootCount = context.rollRewardChance(1, "predator", loot) ? context.grantRewardItem(loot, target.predatorKind === "lion" ? 3 : 1, "predator") : 0;
    context.removeObject(target.id);
    context.showMessage(lootCount > 0 ? `독수리 정령이 ${target.name}을 물리치고 ${context.itemName(loot)} ${lootCount}개를 얻었습니다.` : `독수리 정령이 ${target.name}을 물리쳤습니다.`);
    awardSummonerExperience(context.experienceRewardFor(target), context, true);
    partyHostNotifyKill(target); // 호스트 펫 처치도 파티 XP 분배 (비호스트면 no-op)
    return;
  }

  if (target.type === "jammini") {
    const plasticCount = context.grantRewardItem("plastic_block", 1, "jammini");
    context.removeObject(target.id);
    context.showMessage(`독수리 정령이 잼미니를 물리쳤습니다. 레고 조각 ${plasticCount}개를 얻었습니다.`);
    awardSummonerExperience(context.experienceRewardFor(target), context, true);
    partyHostNotifyKill(target);
  }
}

function awardSummonerExperience(reward: number, context: SummonerPetContext, activePet: boolean) {
  if (reward <= 0) return;
  const pet = CLASS_PASSIVES.summoner.pet;
  if (pet && activePet) {
    const petExperience = Math.max(1, Math.round(reward * pet.petXpShare));
    context.gainPlayerExperience(Math.round(reward * pet.playerXpShare)); // 플레이어 85%(15% 손해) — 펫 몫은 별도 추가 보너스
    gainSummonerPetExperience(context, petExperience);
    return;
  }
  context.gainPlayerExperience(reward);
}

function gainSummonerPetExperience(context: SummonerPetContext, amount: number) {
  const progress = context.getPetProgress();
  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0) return;
  progress.experience += gained;
  let levelUps = 0;
  while (progress.experience >= experienceForNextPetLevel(progress.level)) {
    progress.experience -= experienceForNextPetLevel(progress.level);
    progress.level += 1;
    levelUps += 1;
  }
  if (levelUps > 0) {
    context.showMessage(`독수리 정령 레벨업! Lv ${progress.level}. 공격력 ${summonerPetDamage(progress)}.`);
    context.celebratePetLevel(progress.level);
  }
  context.renderHud();
}

export function updateSummonerPassivePet(runtime: SummonerPetRuntime, context: SummonerPetContext, delta: number) {
  if (!shouldHavePet(context)) {
    if (runtime.petId) context.removeObject(runtime.petId);
    runtime.petId = null;
    runtime.attackCooldown = 0;
    return;
  }

  let pet = runtime.petId ? context.getObject(runtime.petId) : undefined;
  if (!pet) {
    pet = createPassivePet(context) ?? undefined;
    runtime.petId = pet?.id ?? null;
    runtime.attackCooldown = CLASS_PASSIVES.summoner.pet?.attackInterval ?? 1.5;
    if (!pet) return;
  }

  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return;
  runtime.attackCooldown = Math.max(0, runtime.attackCooldown - delta);
  const target = nearestPetTarget(context, pet, passive.attackRange);
  updatePetFlight(context, pet, delta, target);
  if (target && runtime.attackCooldown <= 0) attackTarget(runtime, context, pet, target);
}

export class SummonerCompanionController {
  private readonly runtime: SummonerPetRuntime = { petId: null, attackCooldown: 0 };
  private readonly progress: SummonerPetProgress = { ...DEFAULT_SUMMONER_PET_PROGRESS };

  update(context: SummonerPetContext, delta: number) {
    updateSummonerPassivePet(this.runtime, context, delta);
  }

  awardExperience(reward: number, context: SummonerPetContext) {
    awardSummonerExperience(reward, context, Boolean(this.runtime.petId && context.getObject(this.runtime.petId)));
  }

  companionProgress(): CompanionProgress {
    return { summoner: { ...this.progress } };
  }

  petProgress(): SummonerPetProgress {
    return this.progress;
  }

  petActive(): boolean { return this.runtime.petId !== null; } // 패시브 펫 존재 여부(원격 표시용 프레즌스). 빙의 중엔 펫이 제거돼 false.

  restore(progress: CompanionProgress | undefined) {
    const summoner = progress?.summoner ?? DEFAULT_SUMMONER_PET_PROGRESS;
    this.progress.level = Math.max(1, Math.floor(summoner.level));
    this.progress.experience = Math.max(0, Math.floor(summoner.experience));
    this.runtime.petId = null;
    this.runtime.attackCooldown = 0;
  }

  reset() {
    this.restore({ summoner: DEFAULT_SUMMONER_PET_PROGRESS });
  }

  forgetObject(id: string) {
    if (this.runtime.petId === id) this.runtime.petId = null;
  }
}
