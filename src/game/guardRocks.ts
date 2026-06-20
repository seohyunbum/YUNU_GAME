import * as THREE from "three";

// 마을 골렘의 바위 던지기(원거리 스킬) — 포물선으로 날아가 던질 때 노린 지점에 착탄.
// 착탄 시 그 자리에 플레이어가 있으면 피해(이동하면 회피 가능). leaf: main.ts 미import.

export interface GuardRock {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3; // 던질 때 노린 착탄 지점(발밑)
  t: number;
  duration: number;
  damage: number;
}

export interface GuardRockContext {
  add(mesh: THREE.Object3D): void;
  remove(mesh: THREE.Object3D): void;
  playerPosition: THREE.Vector3; // 눈높이
  damagePlayer(amount: number, showParticles: boolean, reason: string): boolean;
  impact(position: THREE.Vector3): void;
}

const HIT_RADIUS = 2.4; // 착탄 지점에서 이 반경 안이면 피격(이 밖이면 회피)

function createRockMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({ color: 0x6b6e72, roughness: 0.96, metalness: 0.08, flatShading: true }),
  );
  mesh.scale.set(1, 0.85, 1.12);
  return mesh;
}

export function spawnGuardRock(rocks: GuardRock[], ctx: GuardRockContext, from: THREE.Vector3, to: THREE.Vector3, damage: number): void {
  const mesh = createRockMesh();
  mesh.position.copy(from);
  ctx.add(mesh);
  const dist = from.distanceTo(to);
  rocks.push({ mesh, from: from.clone(), to: to.clone(), t: 0, duration: THREE.MathUtils.clamp(dist / 13, 0.5, 1.3), damage });
}

export function updateGuardRocks(rocks: GuardRock[], ctx: GuardRockContext, delta: number): void {
  for (let i = rocks.length - 1; i >= 0; i -= 1) {
    const rock = rocks[i];
    rock.t += delta / rock.duration;
    if (rock.t >= 1) {
      ctx.impact(rock.to);
      const px = ctx.playerPosition.x;
      const pz = ctx.playerPosition.z;
      if ((px - rock.to.x) ** 2 + (pz - rock.to.z) ** 2 < HIT_RADIUS * HIT_RADIUS) {
        ctx.damagePlayer(rock.damage, true, "마을 골렘이 던진 바위에 맞아 체력이 모두 떨어졌습니다.");
      }
      ctx.remove(rock.mesh);
      rocks.splice(i, 1);
      continue;
    }
    rock.mesh.position.set(
      THREE.MathUtils.lerp(rock.from.x, rock.to.x, rock.t),
      THREE.MathUtils.lerp(rock.from.y, rock.to.y, rock.t) + Math.sin(rock.t * Math.PI) * 2.4, // 포물선 아치
      THREE.MathUtils.lerp(rock.from.z, rock.to.z, rock.t),
    );
    rock.mesh.rotation.x += delta * 6;
    rock.mesh.rotation.z += delta * 4;
  }
}
