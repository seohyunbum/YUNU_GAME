import * as THREE from "three";
import { JAMMINI_MAX_HP } from "./constants";
import { createDragonVisual, type DragonVisualStats } from "./bossVisuals";
import { createAnimalVisual, createJamminiVisual, createPredatorVisual } from "./creatureVisuals";
import type {
  AnimalKind,
  BossKind,
  ObjectType,
  PredatorKind,
  WalkCycle,
  WalkPartSetup,
  WorldObject,
} from "./types";

export interface EntityBossStats extends DragonVisualStats {
  name: string;
  maxHp: number;
  armor: number;
  fireDamage: number;
  attackRange: number;
  collisionRadius: number;
  collisionHeight: number;
}

export interface EntityPredatorStats {
  hp: number;
  attackDamage: number;
}

export interface EntitySpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
  getGroundHeightAt(x: number, z: number): number;
  createWalkCycle(parts: WalkPartSetup[], amplitude?: number, speed?: number, lift?: number): WalkCycle;
  predatorStats(kind?: PredatorKind): EntityPredatorStats;
  predatorAggroRange(kind?: PredatorKind): number;
  bossStats(kind?: BossKind): EntityBossStats;
}

export function spawnAnimal(context: EntitySpawnContext, position: THREE.Vector3, preferredType?: AnimalKind) {
  const visual = createAnimalVisual(preferredType);
  visual.group.position.copy(position);
  return context.addWorldObject("animal", visual.name, visual.group, {
    hp: visual.hp,
    animalKind: visual.animalType,
    wanderAngle: Math.random() * Math.PI * 2,
    collidable: true,
    collisionRadius: visual.collisionRadius,
    collisionHeight: visual.collisionHeight,
    walkCycle: context.createWalkCycle(visual.walkParts, visual.walk.amplitude, visual.walk.speed, visual.walk.lift),
  });
}

export function spawnPredator(context: EntitySpawnContext, position: THREE.Vector3, preferredType?: PredatorKind) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const visual = createPredatorVisual(preferredType);
  visual.group.position.copy(position);
  const stats = context.predatorStats(visual.predatorKind);
  return context.addWorldObject("wildPredator", visual.name, visual.group, {
    hp: stats.hp,
    predatorKind: visual.predatorKind,
    collidable: true,
    collisionRadius: visual.collisionRadius,
    collisionHeight: visual.collisionHeight,
    wanderAngle: Math.random() * Math.PI * 2,
    attackRange: context.predatorAggroRange(visual.predatorKind),
    attackDamage: stats.attackDamage,
    walkCycle: context.createWalkCycle(visual.walkParts, visual.walk.amplitude, visual.walk.speed, visual.walk.lift),
  });
}

export function spawnDragon(context: EntitySpawnContext, position: THREE.Vector3, bossKind: BossKind = "dragon") {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const stats = context.bossStats(bossKind);
  const group = createDragonVisual(bossKind, stats);
  group.position.copy(position);
  return context.addWorldObject("dragon", stats.name, group, {
    hp: stats.maxHp,
    armor: stats.armor,
    collidable: true,
    collisionRadius: stats.collisionRadius,
    collisionHeight: stats.collisionHeight,
    attackRange: stats.attackRange,
    attackDamage: stats.fireDamage,
    bossKind,
  });
}

export function spawnJammini(context: EntitySpawnContext, position: THREE.Vector3) {
  position.y = context.getGroundHeightAt(position.x, position.z);
  const visual = createJamminiVisual();
  visual.group.position.copy(position);
  return context.addWorldObject("jammini", "잼미니", visual.group, {
    hp: JAMMINI_MAX_HP,
    armor: 0,
    collidable: true,
    collisionRadius: 0.72,
    collisionHeight: 1.95,
    wanderAngle: Math.random() * Math.PI * 2,
    attackRange: 18,
    attackDamage: 5,
    attackCooldown: THREE.MathUtils.randFloat(0.4, 1.7),
    walkCycle: context.createWalkCycle(visual.walkParts, visual.walk.amplitude, visual.walk.speed, visual.walk.lift),
  });
}
