/* =========================================================================
 * weather.js — 지역 분위기 입자 (눈 · 반딧불 · 동굴 먼지)
 *
 * 플레이어 주변 상자 안에서만 돌려 쓴다(밖으로 나가면 반대쪽으로 감는다).
 * 전부 InstancedMesh 하나씩 = 드로우콜 하나. update 안에서 new 금지.
 * ========================================================================= */
(function (L) {
  'use strict';

  const BOX = 46;         // 플레이어를 둘러싼 입자 상자 반지름

  function makeField(count, geo, mat) {
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;      // r150 InstancedMesh 는 바운딩 구가 없다
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.visible = false;
    return inst;
  }

  function Weather(scene) {
    this.scene = scene;
    this.kind = 'none';
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.time = 0;

    // 눈송이: 작은 흰 판이 흩날린다
    this.snow = makeField(300, L.box(0.4, 0.4, 0.12), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9,
    }));
    // 반딧불: 늪을 떠다니는 연두빛 알갱이
    this.fire = makeField(90, L.sph(0.32, 6), new THREE.MeshBasicMaterial({
      color: 0xc9f06a, transparent: true, opacity: 0.95,
    }));
    // 동굴 먼지: 천천히 떠오르는 흐린 알갱이
    this.dust = makeField(120, L.sph(0.22, 5), new THREE.MeshBasicMaterial({
      color: 0xffd9a0, transparent: true, opacity: 0.45,
    }));
    // 마법 가루: 위로 흩날리는 보랏빛 알갱이(판타지 지역)
    this.sparkle = makeField(140, L.box(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({
      color: 0xd8b8ff, transparent: true, opacity: 0.9,
    }));
    scene.add(this.snow, this.fire, this.dust, this.sparkle);

    this.fields = {
      snow: { mesh: this.snow, data: this._seed(300, 1) },
      firefly: { mesh: this.fire, data: this._seed(90, 2) },
      dust: { mesh: this.dust, data: this._seed(120, 3) },
      sparkle: { mesh: this.sparkle, data: this._seed(140, 4) },
    };
  }

  Weather.prototype._seed = function (n, kind) {
    const d = new Float32Array(n * 6);   // x,y,z, vx,vy,vz
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      d[o] = (Math.random() - 0.5) * BOX * 2;
      d[o + 1] = Math.random() * BOX;
      d[o + 2] = (Math.random() - 0.5) * BOX * 2;
      if (kind === 1) {          // 눈: 아래로 + 옆으로 흔들
        d[o + 3] = (Math.random() - 0.5) * 2.5;
        d[o + 4] = -(3 + Math.random() * 4);
        d[o + 5] = (Math.random() - 0.5) * 2.5;
      } else if (kind === 2) {   // 반딧불: 느리게 떠다닌다
        d[o + 3] = (Math.random() - 0.5) * 2.2;
        d[o + 4] = (Math.random() - 0.5) * 1.2;
        d[o + 5] = (Math.random() - 0.5) * 2.2;
      } else if (kind === 4) {   // 마법 가루: 위로 흩날린다
        d[o + 3] = (Math.random() - 0.5) * 3.2;
        d[o + 4] = 1.6 + Math.random() * 2.6;
        d[o + 5] = (Math.random() - 0.5) * 3.2;
      } else {                   // 먼지: 아주 천천히 위로
        d[o + 3] = (Math.random() - 0.5) * 0.8;
        d[o + 4] = 0.4 + Math.random() * 0.8;
        d[o + 5] = (Math.random() - 0.5) * 0.8;
      }
    }
    return d;
  };

  /** 'snow' | 'firefly' | 'dust' | 'none' */
  Weather.prototype.set = function (kind) {
    if (this.kind === kind) return;
    this.kind = kind;
    for (const key in this.fields) this.fields[key].mesh.visible = (key === kind);
  };

  Weather.prototype.update = function (dt, playerPos) {
    if (this.kind === 'none') return;
    const f = this.fields[this.kind];
    if (!f) return;
    this.time += dt;
    const d = f.data;
    const n = f.mesh.count;
    const m = this._m, q = this._q, p = this._p, s = this._s;
    q.identity();
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      d[o] += d[o + 3] * dt;
      d[o + 1] += d[o + 4] * dt;
      d[o + 2] += d[o + 5] * dt;
      // 반딧불은 방향을 살랑살랑 바꾼다
      if (this.kind === 'firefly' || this.kind === 'sparkle') {
        d[o + 3] += Math.sin(this.time * 1.3 + i) * dt * 1.4;
        d[o + 5] += Math.cos(this.time * 1.1 + i * 0.7) * dt * 1.4;
      }
      // 상자 밖으로 나가면 반대쪽으로 감는다
      if (d[o] > BOX) d[o] -= BOX * 2; else if (d[o] < -BOX) d[o] += BOX * 2;
      if (d[o + 2] > BOX) d[o + 2] -= BOX * 2; else if (d[o + 2] < -BOX) d[o + 2] += BOX * 2;
      if (d[o + 1] > BOX) d[o + 1] -= BOX; else if (d[o + 1] < -6) d[o + 1] += BOX;

      p.set(playerPos.x + d[o], playerPos.y + d[o + 1], playerPos.z + d[o + 2]);
      const twinkle = (this.kind === 'firefly' || this.kind === 'sparkle')
        ? 0.5 + Math.abs(Math.sin(this.time * (this.kind === 'sparkle' ? 5 : 3) + i)) * 1.1
        : 1;
      s.set(twinkle, twinkle, twinkle);
      m.compose(p, q, s);
      f.mesh.setMatrixAt(i, m);
    }
    f.mesh.instanceMatrix.needsUpdate = true;
  };

  L.Weather = Weather;
})(window.LEGO);
