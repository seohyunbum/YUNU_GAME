/* =========================================================================
 * wilds.js — 사냥터 사이의 들판을 채우는 자잘한 것들
 *
 * 세상이 넓어지면 "가는 길"이 지루해진다. 그래서 플레이어 주변에
 * 나무·바위·덤불을 좌표 해시로(언제나 같은 자리에) 흩뿌린다.
 *   · 종류는 InstancedMesh 네 개뿐 = 드로우콜 네 개
 *   · 플레이어가 80 스터드쯤 움직이면 한 번에 다시 배치한다
 *   · 길 위·도시 안·물속·너무 가파른 곳은 피한다
 * ========================================================================= */
(function (L) {
  'use strict';
  const C = L.COLORS;
  const N = L.terrainNoise;

  const CELL = 24;          // 이 간격의 격자마다 최대 한 그루
  const RADIUS = 400;       // 플레이어 주변 반경
  const MOVE_REBUILD = 80;  // 이만큼 움직이면 다시 배치

  const CAP = { trunk: 420, leaf: 1500, rock: 420, bush: 420 };

  function Wilds(world, scene) {
    this.world = world;
    this.scene = scene;
    this.center = new THREE.Vector3(1e9, 0, 1e9);

    const trunkMat = L.mat(C.brown, 'matte');
    const leafMat = L.studAllMaterial(0xffffff, 2);
    const rockMat = L.mat(0x6c6e68, 'matte');
    const bushMat = L.mat(0xffffff, 'matte');

    this.trunk = this._mesh(L.cyl(0.85, 1.05, 7, 7), trunkMat, CAP.trunk, true);
    this.leaf = this._mesh(L.box(1, 0.45, 1), leafMat, CAP.leaf, true);
    this.rock = this._mesh(L.box(1, 1, 1), rockMat, CAP.rock, true);
    this.bush = this._mesh(L.box(1, 1, 1), bushMat, CAP.bush, false);
    scene.add(this.trunk, this.leaf, this.rock, this.bush);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  Wilds.prototype._mesh = function (geo, mat, count, shadow) {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;     // r150 InstancedMesh 는 인스턴스 바운딩 구가 없다
    m.castShadow = !!shadow;
    m.receiveShadow = true;
    m.count = 0;
    // instanceColor 를 미리 만들어 둔다(나중에 색을 넣어도 되게)
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    return m;
  };

  /** 이 자리에 무엇을 심을까 — 지형과 지역이 정한다 */
  Wilds.prototype._pick = function (x, z, h, region) {
    const r = N.hash2(Math.round(x * 3.1), Math.round(z * 3.7));
    if (region) {
      if (region.id === 'mount') {
        if (h > 74) return null;                       // 설선 위는 비워 둔다
        if (h > 34) return r < 0.55 ? 'pine' : 'rock';
        return r < 0.6 ? 'pine' : (r < 0.8 ? 'rock' : 'bush');
      }
      if (region.id === 'cave') return r < 0.75 ? 'rock' : 'bush';
      if (region.id === 'zombie') return r < 0.5 ? 'dead' : (r < 0.75 ? 'bush' : 'rock');
      if (region.id === 'swamp') return r < 0.6 ? 'dead' : 'bush';
    }
    if (h > 26) return r < 0.6 ? 'rock' : 'pine';
    return r < 0.52 ? 'tree' : (r < 0.78 ? 'bush' : 'rock');
  };

  Wilds.prototype.rebuild = function (px, pz) {
    const world = this.world, terrain = world.terrain;
    const m = this._m, q = this._q, e = this._e, p = this._p, s = this._s, c = this._c;
    let nTrunk = 0, nLeaf = 0, nRock = 0, nBush = 0;

    const ci0 = Math.floor((px - RADIUS) / CELL), ci1 = Math.floor((px + RADIUS) / CELL);
    const cj0 = Math.floor((pz - RADIUS) / CELL), cj1 = Math.floor((pz + RADIUS) / CELL);

    for (let ci = ci0; ci <= ci1; ci++) {
      for (let cj = cj0; cj <= cj1; cj++) {
        const seed = N.hash2(ci, cj);
        if (seed > 0.34) continue;                       // 밀도
        const jx = N.hash2(ci + 7777, cj), jz = N.hash2(ci, cj + 5555);
        const x = ci * CELL + jx * CELL, z = cj * CELL + jz * CELL;
        if (Math.hypot(x - px, z - pz) > RADIUS) continue;
        if (terrain.flatZoneAt(x, z)) continue;          // 도시 안에는 안 심는다
        const road = terrain.pathAt(x, z);
        if (road && road.d < road.path.width * 1.5) continue;   // 길 위도 비운다
        const h = terrain.heightAt(x, z);
        const slope = Math.max(
          Math.abs(h - terrain.heightAt(x + 6, z)),
          Math.abs(h - terrain.heightAt(x, z + 6)));
        if (slope > 3.6) continue;                       // 절벽에는 못 자란다
        const region = terrain.regionAt(x, z);
        if (region && region.waterY !== undefined && h < region.waterY + 0.3) continue;
        const kind = this._pick(x, z, h, region);
        if (!kind) continue;
        const rot = N.hash2(ci + 31, cj + 17) * 6.28;
        const scale = 0.75 + N.hash2(ci + 91, cj + 3) * 0.75;

        if (kind === 'rock') {
          if (nRock + 2 > CAP.rock) continue;
          for (let k = 0; k < 2; k++) {
            e.set(0, rot + k, 0);
            q.setFromEuler(e);
            p.set(x + (k ? 1.6 * scale : 0), h + (k ? 1.4 : 0.8) * scale, z + (k ? -1.2 * scale : 0));
            s.set((k ? 2.2 : 3.4) * scale, (k ? 1.6 : 1.9) * scale, (k ? 2.0 : 3.0) * scale);
            m.compose(p, q, s);
            this.rock.setMatrixAt(nRock, m);
            const g = 0.78 + N.hash2(ci + k, cj) * 0.3;
            this.rock.setColorAt(nRock, c.setRGB(g, g, g * 0.98));
            nRock++;
          }
          continue;
        }
        if (kind === 'bush') {
          if (nBush >= CAP.bush) continue;
          e.set(0, rot, 0);
          q.setFromEuler(e);
          p.set(x, h + 0.9 * scale, z);
          s.set(2.6 * scale, 1.8 * scale, 2.6 * scale);
          m.compose(p, q, s);
          this.bush.setMatrixAt(nBush, m);
          const dry = region && (region.id === 'zombie' || region.id === 'swamp');
          c.setHex(dry ? 0x5c6b40 : (N.hash2(ci, cj + 9) > 0.5 ? 0x3f8f43 : 0x2c6e3a));
          this.bush.setColorAt(nBush, c);
          nBush++;
          continue;
        }

        // 나무류: 줄기 하나 + 잎 몇 장
        if (nTrunk >= CAP.trunk) continue;
        const dead = kind === 'dead';
        const pine = kind === 'pine';
        e.set(0, rot, 0);
        q.setFromEuler(e);
        const th = (dead ? 6.5 : (pine ? 8 : 7)) * scale;
        p.set(x, h + th * 0.5, z);
        s.set(scale, th / 7, scale);
        m.compose(p, q, s);
        this.trunk.setMatrixAt(nTrunk, m);
        c.setHex(dead ? 0x5a4632 : (pine ? 0x583927 : 0x6b4a2f));
        this.trunk.setColorAt(nTrunk, c);
        nTrunk++;

        if (dead) continue;                              // 죽은 나무는 잎이 없다
        const leaves = pine ? 3 : 4;
        for (let k = 0; k < leaves && nLeaf < CAP.leaf; k++) {
          const t = k / leaves;
          const rr = (pine ? 3.6 - t * 2.2 : 3.4 - t * 1.4) * scale;
          const ly = h + th * (pine ? 0.85 + t * 0.55 : 0.95 + t * 0.4);
          e.set(0, rot + k * 1.1, 0);
          q.setFromEuler(e);
          p.set(x + Math.cos(rot + k * 2.1) * rr * 0.25, ly, z + Math.sin(rot + k * 2.1) * rr * 0.25);
          s.set(rr * 1.7, (pine ? 1.5 : 1.9) * scale, rr * 1.7);
          m.compose(p, q, s);
          this.leaf.setMatrixAt(nLeaf, m);
          c.setHex(pine
            ? (k % 2 ? 0x1f5b34 : 0x17452a)
            : (k % 3 === 0 ? 0x2c6e3a : (k % 3 === 1 ? 0x3f8f43 : 0x57a34a)));
          this.leaf.setColorAt(nLeaf, c);
          nLeaf++;
        }
      }
    }

    this.trunk.count = nTrunk;
    this.leaf.count = nLeaf;
    this.rock.count = nRock;
    this.bush.count = nBush;
    for (const mesh of [this.trunk, this.leaf, this.rock, this.bush]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.center.set(px, 0, pz);
  };

  Wilds.prototype.update = function (px, pz) {
    if (Math.hypot(px - this.center.x, pz - this.center.z) < MOVE_REBUILD) return;
    this.rebuild(px, pz);
  };

  L.Wilds = Wilds;
})(window.LEGO);
