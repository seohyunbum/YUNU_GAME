import * as THREE from "three";
import type { ObjectType, WorldObject } from "./types";

export interface SpawnContext {
  addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra?: Partial<WorldObject>): WorldObject;
}

export interface SpawnObjectSpec {
  type: ObjectType;
  name: string;
  root: THREE.Object3D;
  extra?: Partial<WorldObject>;
}

export function spawnObject(context: SpawnContext, spec: SpawnObjectSpec) {
  return context.addWorldObject(spec.type, spec.name, spec.root, spec.extra ?? {});
}
