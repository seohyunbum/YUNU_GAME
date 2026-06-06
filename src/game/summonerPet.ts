import * as THREE from "three";
import { createEagleVisual } from "./creatureVisuals";
import { CLASS_PASSIVES, DEFAULT_SUMMONER_PET_PROGRESS, experienceForNextPetLevel, summonerPetDamage } from "./classPassives";
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
    new THREE.SphereGeometry(0.62, 14, 8),
    new THREE.MeshBasicMaterial({
      color: 0x76f0ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  aura.userData.skipRaycastTarget = true;
  aura.userData.skipStaticMerge = true;
  root.add(aura);
  return context.addWorldObject("summonerPet", passive.label, root, {
    collidable: false,
    collisionRadius: 0.72,
    collisionHeight: 1.25,
  });
}

function nearestPetTarget(context: SummonerPetContext, pet: WorldObject, range: number) {
  let nearest: WorldObject | null = null;
  let nearestDistance = Infinity;
  for (const target of context.objectsNear(pet.root.position, range + 2)) {
    if (target.type !== "wildPredator" && target.type !== "jammini") continue;
    if ((target.hp ?? 0) <= 0) continue;
    const distance = Math.hypot(target.root.position.x - pet.root.position.x, target.root.position.z - pet.root.position.z);
    if (distance > range || distance >= nearestDistance) continue;
    nearest = target;
    nearestDistance = distance;
  }
  return nearest;
}

function updatePetFlight(context: SummonerPetContext, pet: WorldObject, delta: number, target: WorldObject | null) {
  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return;
  const yaw = context.yaw();
  desiredPosition.set(
    context.playerPosition.x + Math.sin(yaw + 0.75) * passive.followDistance,
    0,
    context.playerPosition.z + Math.cos(yaw + 0.75) * passive.followDistance,
  );
  desiredPosition.y = context.getGroundHeightAt(desiredPosition.x, desiredPosition.z) + 1.72 + Math.sin(context.elapsedTime() * 3.2) * 0.16;
  pet.root.position.lerp(desiredPosition, Math.min(1, delta * 4.2));
  context.refreshSpatialObject(pet);

  if (target) {
    toTarget.subVectors(target.root.position, pet.root.position);
    pet.root.rotation.y = -Math.atan2(toTarget.z, toTarget.x) + Math.PI / 2;
  } else {
    pet.root.rotation.y = yaw;
  }

  const flap = Math.sin(context.elapsedTime() * 13.5) * 0.5;
  pet.root.traverse((child) => {
    const side = child.userData.flapSide;
    if (typeof side === "number") child.rotation.z = side * (0.36 + flap);
  });
}

function attackTarget(runtime: SummonerPetRuntime, context: SummonerPetContext, target: WorldObject) {
  const passive = CLASS_PASSIVES.summoner.pet;
  if (!passive) return;
  const damage = summonerPetDamage(context.getPetProgress());
  target.hp = (target.hp ?? 1) - damage;
  target.angryUntil = context.now() + 8_000;
  runtime.attackCooldown = passive.attackInterval;
  context.spawnHitEffect(target);
  context.playTone(880, 0.055, "triangle", 0.018);
  context.playTone(420, 0.05, "sine", 0.012);
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
    return;
  }

  if (target.type === "jammini") {
    const plasticCount = context.grantRewardItem("plastic_block", 1, "jammini");
    context.removeObject(target.id);
    context.showMessage(`독수리 정령이 잼미니를 물리쳤습니다. 레고 조각 ${plasticCount}개를 얻었습니다.`);
    awardSummonerExperience(context.experienceRewardFor(target), context, true);
  }
}

function awardSummonerExperience(reward: number, context: SummonerPetContext, activePet: boolean) {
  if (reward <= 0) return;
  const pet = CLASS_PASSIVES.summoner.pet;
  if (pet && activePet) {
    const petExperience = Math.max(1, Math.round(reward * pet.petXpShare));
    context.gainPlayerExperience(Math.max(0, reward - petExperience));
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
  if (target && runtime.attackCooldown <= 0) attackTarget(runtime, context, target);
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
